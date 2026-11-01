/**
 * Cubicraft — guest client.
 *
 * A guest does not own the world, so it predicts its own movement locally
 * and lets the host correct it.  The reconciliation follows the plan:
 *
 *   - less than 0.1 blocks apart -> ignore the correction (it is noise);
 *   - between 0.1 and 2.0 blocks   -> smooth the error out over a few frames;
 *   - more than 2.0 blocks apart  -> snap (the guest was teleported, blocked
 *     or fell).
 */

import { lerp, type PlayerState } from '../core/types';
import { PeerConnection, type PeerState } from './peer';
import { Op, type CorrectionMessage, type NetMessage } from './protocol';
import type { IceDiagnostics } from './diagnostics';

/** Corrections smaller than this are ignored. */
export const RECONCILE_IGNORE_DISTANCE = 0.1;
/** Corrections larger than this snap the player to the host position. */
export const RECONCILE_SNAP_DISTANCE = 2.0;

/** Movement speeds in blocks per second. */
export const WALK_SPEED = 4.317;
export const SPRINT_SPEED = 5.612;
export const SNEAK_SPEED = 1.295;

/** The input a guest applies to its own position each tick. */
export interface MoveInput {
  /** -1 (back) .. 1 (forward) */
  forward?: number;
  /** -1 (left) .. 1 (right) */
  strafe?: number;
  jump?: boolean;
  sneak?: boolean;
  sprint?: boolean;
  /** Facing in radians. */
  yaw?: number;
  pitch?: number;
  /** Tick length in seconds (defaults to 1/60). */
  dt?: number;
}

/** What the guest did with a correction. */
export type ReconcileAction = 'none' | 'lerp' | 'snap';

/** Dependencies of the guest client. */
export interface GuestClientDeps {
  /** Called for every message the host sends. */
  onMessage: (msg: NetMessage) => void;
  /** Called when the transport state changes. */
  onStateChange: (state: PeerState) => void;
  /** The local player, used for prediction and correction. */
  getLocalPlayer: () => PlayerState;
  /** Called once the connection is open, so the engine can send HELLO. */
  onOpen?: () => void;
  /** Shared ICE diagnostics. */
  diagnostics?: IceDiagnostics;
}

/** How a correction should be applied. */
export function reconcileAction(distance: number): ReconcileAction {
  if (distance < RECONCILE_IGNORE_DISTANCE) return 'none';
  if (distance > RECONCILE_SNAP_DISTANCE) return 'snap';
  return 'lerp';
}

/**
 * The guest side of a session.
 *
 * Owns the peer connection, tracks the local player and applies the host's
 * corrections to it.
 */
export class GuestClient {
  private readonly peer: PeerConnection;
  private localPlayerId: string | null = null;

  constructor(private readonly deps: GuestClientDeps) {
    this.peer = new PeerConnection({
      isHost: false,
      onMessage: (msg) => this.handleMessage(msg),
      onStateChange: (state) => this.deps.onStateChange(state),
      onOpen: () => this.deps.onOpen?.(),
      diagnostics: this.deps.diagnostics,
    });
  }

  /** The transport, exposed for diagnostics and host transfer. */
  get connection(): PeerConnection {
    return this.peer;
  }

  /** The player id the host assigned, once the welcome arrived. */
  get playerId(): string | null {
    return this.localPlayerId;
  }

  /**
   * Answer a host offer.
   *
   * Returns the answer pack that has to be given back to the host.
   */
  async join(hostOfferPack: string): Promise<string> {
    return this.peer.createGuestAnswer(hostOfferPack);
  }

  /** Send a message to the host. */
  send(msg: NetMessage): void {
    this.peer.send(msg);
  }

  /** Ask the host for a chunk. */
  requestChunk(cx: number, cz: number, dimension: string): void {
    this.peer.send({ op: Op.CHUNK_REQUEST, cx, cz, dimension });
  }

  /** Close the connection. */
  close(): void {
    this.peer.close();
  }

  private handleMessage(msg: NetMessage): void {
    if (msg.op === Op.WELCOME) {
      this.localPlayerId = msg.playerId;
    }
    this.deps.onMessage(msg);
  }

  /**
   * Predict where the player will be after applying an input.
   *
   * This is a simple kinematic estimate: the real physics live in the engine
   * and the host's correction is the authority.
   */
  predictMove(local: PlayerState, input: MoveInput): PlayerState {
    const dt = input.dt ?? 1 / 60;
    const yaw = input.yaw ?? local.yaw;
    const speed = input.sneak ? SNEAK_SPEED : input.sprint ? SPRINT_SPEED : WALK_SPEED;
    const forward = clampUnit(input.forward ?? 0);
    const strafe = clampUnit(input.strafe ?? 0);

    // Minecraft convention: yaw 0 faces +Z, the right hand points -X.
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    const dx = (forward * -sin + strafe * -cos) * speed * dt;
    const dz = (forward * cos + strafe * -sin) * speed * dt;

    const next: PlayerState = { ...local };
    next.x = local.x + dx;
    next.z = local.z + dz;
    if (input.jump && local.onGround) next.y = local.y + 1;
    next.yaw = yaw;
    if (input.pitch !== undefined) next.pitch = input.pitch;
    next.sneaking = input.sneak ?? local.sneaking;
    next.sprinting = input.sprint ?? local.sprinting;
    return next;
  }

  /**
   * Apply the host's authoritative position to the local player.
   *
   * Small errors are smoothed, big ones snap.
   */
  applyCorrection(local: PlayerState, correction: CorrectionMessage): PlayerState {
    const distance = Math.hypot(
      correction.x - local.x,
      correction.y - local.y,
      correction.z - local.z,
    );
    const action = reconcileAction(distance);
    if (action === 'none') return local;

    if (action === 'snap') {
      return {
        ...local,
        x: correction.x,
        y: correction.y,
        z: correction.z,
        yaw: correction.yaw,
        pitch: correction.pitch,
      };
    }

    // Blend the error out: the further off we are, the harder we pull.
    const t = (distance - RECONCILE_IGNORE_DISTANCE) /
      (RECONCILE_SNAP_DISTANCE - RECONCILE_IGNORE_DISTANCE);
    return {
      ...local,
      x: lerp(local.x, correction.x, t),
      y: lerp(local.y, correction.y, t),
      z: lerp(local.z, correction.z, t),
      yaw: lerp(local.yaw, correction.yaw, t),
      pitch: lerp(local.pitch, correction.pitch, t),
    };
  }
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < -1) return -1;
  if (value > 1) return 1;
  return value;
}
