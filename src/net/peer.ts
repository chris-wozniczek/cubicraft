/**
 * Cubicraft — WebRTC peer transport.
 *
 * Two data channels are used:
 * - `reliable` — ordered and reliable, for world data (chunks, block edits,
 *   inventory, chat).
 * - `fast` — unordered with `maxRetransmits: 0`, for position spam.  A lost
 *   position packet is worthless a moment later, so retransmitting it would
 *   only delay the packets that matter.
 *
 * `iceServers` is empty on purpose: only host candidates are gathered, which
 * keeps the game on the local network and works with no internet connection.
 */

import { log } from '../core/log';
import { decodeMessage, encodeMessage, isFastOp, type NetMessage, type Op } from './protocol';
import { decodeJoinPack, encodeJoinPack } from './pairing';
import { IceDiagnostics } from './diagnostics';

/** Transport level state of a peer. */
export type PeerState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'failed'
  | 'closed';

/** Construction options for a peer. */
export interface PeerOptions {
  /** True for the player whose browser owns the world. */
  isHost: boolean;
  /** Called for every decoded message. */
  onMessage: (msg: NetMessage) => void;
  /** Called whenever the transport state changes. */
  onStateChange: (state: PeerState) => void;
  /** Called once the reliable channel is open and queued frames were sent. */
  onOpen?: () => void;
  /** Shared diagnostics instance (one per session is fine). */
  diagnostics?: IceDiagnostics;
  /** How long to wait for ICE gathering before giving up (ms). */
  gatheringTimeoutMs?: number;
}

/** Maximum number of frames buffered while the channels are not open yet. */
const MAX_QUEUE = 512;

/** A frame waiting for its channel to open. */
interface QueuedFrame {
  frame: Uint8Array;
  op: number;
}

/**
 * `RTCDataChannel.send` only accepts a view backed by a plain `ArrayBuffer`.
 * Our frames always are, but `Uint8Array` defaults to `ArrayBufferLike`, so
 * the cast records that intent in one place.
 */
type SendableBytes = Uint8Array<ArrayBuffer>;

const DEFAULT_GATHERING_TIMEOUT_MS = 3000;

/** Shape of the stats entries we care about. */
interface IceStatsReport {
  id: string;
  type: string;
  state?: string;
  nominated?: boolean;
  protocol?: string;
  address?: string;
  port?: number;
  candidateType?: string;
  localCandidateId?: string;
  remoteCandidateId?: string;
}

/**
 * One WebRTC connection to another peer.
 *
 * The class never throws from `send`: if a channel is not open yet the frame
 * is queued and flushed as soon as it opens.
 */
export class PeerConnection {
  readonly diagnostics: IceDiagnostics;
  readonly isHost: boolean;

  private pc: RTCPeerConnection | null = null;
  private reliable: RTCDataChannel | null = null;
  private fast: RTCDataChannel | null = null;
  private readonly queue: QueuedFrame[] = [];
  private state: PeerState = 'idle';
  private openNotified = false;

  private readonly onMessage: (msg: NetMessage) => void;
  private readonly onStateChange: (state: PeerState) => void;
  private readonly onOpen?: () => void;
  private readonly gatheringTimeoutMs: number;

  constructor(opts: PeerOptions) {
    this.isHost = opts.isHost;
    this.onMessage = opts.onMessage;
    this.onStateChange = opts.onStateChange;
    this.onOpen = opts.onOpen;
    this.diagnostics = opts.diagnostics ?? new IceDiagnostics();
    this.gatheringTimeoutMs = opts.gatheringTimeoutMs ?? DEFAULT_GATHERING_TIMEOUT_MS;
  }

  /** Current transport state. */
  get currentState(): PeerState {
    return this.state;
  }

  /** True when the reliable channel can accept frames. */
  get isOpen(): boolean {
    return this.reliable?.readyState === 'open';
  }

  // -------------------------------------------------------------------------
  // Setup
  // -------------------------------------------------------------------------

  private ensurePeerConnection(): RTCPeerConnection {
    if (this.pc) return this.pc;
    if (typeof RTCPeerConnection === 'undefined') {
      throw new Error('net: this browser does not support WebRTC (RTCPeerConnection)');
    }
    // No ICE servers: LAN only, no internet required.
    const pc = new RTCPeerConnection({ iceServers: [] });

    pc.onconnectionstatechange = () => {
      this.diagnostics.recordState(pc.connectionState);
      this.setState(this.mapConnectionState(pc.connectionState));
      if (pc.connectionState === 'connected') {
        // Remember which candidate pair carried the connection.
        void this.collectStats();
      }
    };
    pc.oniceconnectionstatechange = () => {
      this.diagnostics.recordState(`ice:${pc.iceConnectionState}`);
    };
    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      this.diagnostics.recordCandidate({
        type: event.candidate.type ?? undefined,
        protocol: event.candidate.protocol ?? undefined,
        address: event.candidate.address ?? undefined,
        port: event.candidate.port ?? undefined,
      });
    };
    pc.ondatachannel = (event) => {
      this.adoptChannel(event.channel);
    };

    this.pc = pc;
    return pc;
  }

  private mapConnectionState(state: RTCPeerConnectionState): PeerState {
    switch (state) {
      case 'new':
        return 'idle';
      case 'connecting':
        return 'connecting';
      case 'connected':
        return 'connected';
      case 'disconnected':
        return 'disconnected';
      case 'failed':
        return 'failed';
      case 'closed':
        return 'closed';
      default:
        return this.state;
    }
  }

  private setState(state: PeerState): void {
    if (this.state === state) return;
    this.state = state;
    this.onStateChange(state);
  }

  /** Create the two data channels (host side). */
  private openHostChannels(pc: RTCPeerConnection): void {
    const reliable = pc.createDataChannel('reliable', { ordered: true });
    this.adoptChannel(reliable);
    const fast = pc.createDataChannel('fast', { ordered: false, maxRetransmits: 0 });
    this.adoptChannel(fast);
  }

  private adoptChannel(channel: RTCDataChannel): void {
    channel.binaryType = 'arraybuffer';
    if (channel.label === 'fast') this.fast = channel;
    else this.reliable = channel;

    channel.onopen = () => {
      this.flushQueue();
      if (!this.openNotified && this.reliable?.readyState === 'open') {
        this.openNotified = true;
        this.onOpen?.();
      }
    };
    channel.onclose = () => {
      this.diagnostics.recordState(`channel:${channel.label}:closed`);
    };
    channel.onerror = (event) => {
      log.warn(`net: data channel "${channel.label}" error`, event);
    };
    channel.onmessage = (event: MessageEvent) => {
      void this.handleIncoming(event.data);
    };
  }

  // -------------------------------------------------------------------------
  // Pairing
  // -------------------------------------------------------------------------

  /**
   * Create the host offer and wait for ICE gathering to finish.
   *
   * The returned string is the raw pairing payload (JSON).  Use
   * `encodeJoinPack` (or `createHostJoinPack`) to turn it into something a
   * guest can consume.
   */
  async createHostOffer(): Promise<string> {
    const pc = this.ensurePeerConnection();
    this.openHostChannels(pc);
    this.setState('connecting');

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await this.waitForIceGathering(pc);

    const sdp = pc.localDescription?.sdp ?? offer.sdp ?? '';
    return JSON.stringify({ sdp, type: 'offer' });
  }

  /** Same as `createHostOffer` but returns a compressed join pack. */
  async createHostJoinPack(): Promise<string> {
    return encodeJoinPack(await this.createHostOffer());
  }

  /** Accept the guest's answer pack (host side). */
  async acceptAnswer(answerPack: string): Promise<void> {
    const { sdp } = await decodeJoinPack(answerPack);
    const pc = this.ensurePeerConnection();
    await pc.setRemoteDescription({ type: 'answer', sdp });
    this.setState('connecting');
  }

  /**
   * Answer a host offer and return the raw pairing payload (JSON).
   *
   * `createGuestJoinPack` is the compressed variant.
   */
  async createGuestAnswer(hostOfferPack: string): Promise<string> {
    const { sdp } = await decodeJoinPack(hostOfferPack);
    const pc = this.ensurePeerConnection();
    this.setState('connecting');
    await pc.setRemoteDescription({ type: 'offer', sdp });
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await this.waitForIceGathering(pc);

    const answerSdp = pc.localDescription?.sdp ?? answer.sdp ?? '';
    return JSON.stringify({ sdp: answerSdp, type: 'answer' });
  }

  /** Same as `createGuestAnswer` but returns a compressed join pack. */
  async createGuestJoinPack(hostOfferPack: string): Promise<string> {
    return encodeJoinPack(await this.createGuestAnswer(hostOfferPack));
  }

  /**
   * Wait until ICE gathering completes.
   *
   * With no STUN/TURN servers this only collects host candidates, which is
   * fast.  A timeout still guards against a broken interface hanging the
   * join flow forever.
   */
  private waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
    if (pc.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise<void>((resolve) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = () => {
        if (timer !== undefined) clearTimeout(timer);
        pc.removeEventListener('icegatheringstatechange', onChange);
        resolve();
      };
      const onChange = () => {
        if (pc.iceGatheringState === 'complete') finish();
      };
      pc.addEventListener('icegatheringstatechange', onChange);
      timer = setTimeout(finish, this.gatheringTimeoutMs);
    });
  }

  // -------------------------------------------------------------------------
  // Messaging
  // -------------------------------------------------------------------------

  /**
   * Send a message.
   *
   * Position updates go on the unreliable channel, everything else on the
   * reliable one.  Frames sent before a channel opens are queued.
   */
  send(msg: NetMessage): void {
    let frame: Uint8Array;
    try {
      frame = encodeMessage(msg);
    } catch (err) {
      log.error('net: failed to encode message', err);
      return;
    }
    const channel = isFastOp(msg.op) ? this.fast : this.reliable;
    if (channel && channel.readyState === 'open') {
      try {
        channel.send(frame as SendableBytes);
        return;
      } catch (err) {
        log.warn('net: send failed, queueing frame', err);
      }
    }
    this.queue.push({ frame, op: msg.op });
    while (this.queue.length > MAX_QUEUE) this.queue.shift();
  }

  private flushQueue(): void {
    while (this.queue.length) {
      const pending = this.queue[0];
      const channel = isFastOp(pending.op as Op) ? this.fast : this.reliable;
      if (!channel || channel.readyState !== 'open') return;
      this.queue.shift();
      try {
        channel.send(pending.frame as SendableBytes);
      } catch (err) {
        log.warn('net: failed to flush queued frame', err);
        return;
      }
    }
  }

  private async handleIncoming(data: unknown): Promise<void> {
    try {
      let bytes: Uint8Array;
      if (data instanceof ArrayBuffer) {
        bytes = new Uint8Array(data);
      } else if (ArrayBuffer.isView(data)) {
        bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      } else if (typeof Blob !== 'undefined' && data instanceof Blob) {
        bytes = new Uint8Array(await data.arrayBuffer());
      } else {
        return;
      }
      const msg = decodeMessage(bytes);
      this.onMessage(msg);
    } catch (err) {
      log.warn('net: failed to decode incoming frame', err);
      this.diagnostics.recordState('decode-error', String(err));
    }
  }

  // -------------------------------------------------------------------------
  // Introspection
  // -------------------------------------------------------------------------

  /**
   * Read the ICE stats and remember which candidate pair was used.
   * Called after the connection is established.
   */
  async collectStats(): Promise<void> {
    const pc = this.pc;
    if (!pc) return;
    try {
      const report = await pc.getStats();
      const candidates = new Map<string, IceStatsReport>();
      report.forEach((entry) => {
        const stats = entry as unknown as IceStatsReport;
        candidates.set(stats.id, stats);
      });
      report.forEach((entry) => {
        const stats = entry as unknown as IceStatsReport;
        if (stats.type !== 'candidate-pair') return;
        if (stats.state !== 'succeeded' && !stats.nominated) return;
        const local = stats.localCandidateId ? candidates.get(stats.localCandidateId) : undefined;
        const remote = stats.remoteCandidateId ? candidates.get(stats.remoteCandidateId) : undefined;
        this.diagnostics.recordSelectedPair({
          localType: local?.candidateType,
          localAddress: local?.address,
          remoteType: remote?.candidateType,
          remoteAddress: remote?.address,
          protocol: stats.protocol ?? local?.protocol,
        });
      });
    } catch (err) {
      log.debug('net: getStats failed', err);
    }
  }

  /** Tear the connection down. */
  close(): void {
    this.queue.length = 0;
    for (const channel of [this.reliable, this.fast]) {
      if (!channel) continue;
      try {
        channel.onmessage = null;
        channel.onopen = null;
        channel.onclose = null;
        channel.onerror = null;
        channel.close();
      } catch (err) {
        log.debug('net: error while closing channel', err);
      }
    }
    this.reliable = null;
    this.fast = null;
    if (this.pc) {
      try {
        this.pc.close();
      } catch (err) {
        log.debug('net: error while closing peer connection', err);
      }
      this.pc = null;
    }
    this.setState('closed');
  }
}
