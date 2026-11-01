/**
 * Cubicraft — ICE diagnostics.
 *
 * When two devices on a home Wi-Fi cannot see each other the failure is
 * almost always one of three things: the router blocks device-to-device
 * traffic, the firewall blocks the UDP port, or the mDNS name could not be
 * resolved.  This class records what actually happened so the UI can say
 * something useful instead of "connection failed".
 */

import { log } from '../core/log';

/** One gathered ICE candidate. */
export interface IceCandidateRecord {
  /** 'host' | 'srflx' | 'prflx' | 'relay' */
  type: string;
  protocol: string;
  address?: string;
  port?: number;
  at: number;
}

/** One connection-state transition. */
export interface IceTransition {
  state: string;
  at: number;
  detail?: string;
}

/** The candidate pair that actually carried the connection. */
export interface SelectedPair {
  localType?: string;
  localAddress?: string;
  remoteType?: string;
  remoteAddress?: string;
  protocol?: string;
}

/** Records ICE activity and turns it into a parent-readable diagnosis. */
export class IceDiagnostics {
  readonly candidates: IceCandidateRecord[] = [];
  readonly transitions: IceTransition[] = [];
  selected: SelectedPair | null = null;
  /** The mDNS / hostname the peer tried to reach, when one was used. */
  hostname: string | null = null;

  constructor(private readonly now: () => number = () => Date.now()) {}

  /** Note the hostname that was used to reach the peer. */
  noteHostname(hostname: string): void {
    this.hostname = hostname;
  }

  /** Record a gathered candidate. */
  recordCandidate(candidate: {
    type?: string;
    protocol?: string;
    address?: string;
    port?: number;
  }): void {
    this.candidates.push({
      type: candidate.type ?? 'unknown',
      protocol: candidate.protocol ?? 'unknown',
      address: candidate.address,
      port: candidate.port,
      at: this.now(),
    });
  }

  /** Record a connection / ICE state transition. */
  recordState(state: string, detail?: string): void {
    this.transitions.push({ state, at: this.now(), detail });
  }

  /** Record the candidate pair that was selected. */
  recordSelectedPair(pair: SelectedPair): void {
    this.selected = pair;
  }

  /** Distinct candidate types that were gathered. */
  get candidateTypes(): string[] {
    return [...new Set(this.candidates.map((c) => c.type))];
  }

  /** The most recent state that was recorded. */
  get lastState(): string | undefined {
    return this.transitions[this.transitions.length - 1]?.state;
  }

  /** A plain-object snapshot, handy for logging or a debug overlay. */
  toJSON(): {
    candidates: IceCandidateRecord[];
    transitions: IceTransition[];
    selected: SelectedPair | null;
    candidateTypes: string[];
  } {
    return {
      candidates: [...this.candidates],
      transitions: [...this.transitions],
      selected: this.selected,
      candidateTypes: this.candidateTypes,
    };
  }

  /**
   * A one-line diagnosis a parent can act on.
   *
   * The wording is deliberately plain: the people playing the game are
   * children, so the message says what to try rather than naming ICE states.
   */
  summary(): string {
    // ICE states are recorded as "ice:<state>"; the diagnosis only cares about
    // the state itself.
    const state = this.lastState?.replace(/^ice:/, '');
    const types = this.candidateTypes;
    const hasHost = types.includes('host');

    if (state === 'connected' || state === 'completed' || state === 'succeeded') {
      return 'The connection is working - the two devices can talk to each other.';
    }
    if (!this.candidates.length && !this.transitions.length) {
      return 'No connection attempt has been made yet.';
    }
    if (state === 'failed') {
      if (!this.candidates.length) {
        return 'The device found no other devices on this network. Check that both computers are on the same Wi-Fi and that the Wi-Fi is switched on.';
      }
      if (!hasHost && this.hostname) {
        return `The address "${this.hostname}" could not be resolved. Try joining by IP address instead, or re-share the code.`;
      }
      if (!hasHost) {
        return 'The devices are not on the same network. Connect both computers to the same Wi-Fi and try again.';
      }
      return 'Your router may be blocking device-to-device traffic. Turn off "AP isolation" / "client isolation" in the router settings, or try a phone hotspot.';
    }
    if (state === 'disconnected') {
      return 'The connection dropped. The device may have left the Wi-Fi network or gone to sleep.';
    }
    if (state === 'checking') {
      return 'Still looking for a route between the two devices.';
    }
    if (this.candidates.length && !hasHost) {
      return 'Only internet-routable addresses were found, so the devices cannot see each other directly.';
    }
    return 'The connection has not been established yet.';
  }

  /** Log the current state at debug level. */
  logSummary(): void {
    log.debug('net: ICE diagnostics', this.summary(), this.toJSON());
  }
}
