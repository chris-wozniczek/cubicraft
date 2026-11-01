/**
 * Cubicraft — interest management.
 *
 * The host knows the whole world; a guest only cares about what is near it.
 * This class decides, per peer:
 * - how often a position update may be sent (20 Hz up close, 5 Hz further out,
 *   never beyond 64 blocks);
 * - which chunks still need to be sent, and how many may be sent per second
 *   (chunks are prioritised by distance so the player sees their own
 *   surroundings first);
 * - which entities the peer already knows about.
 */

import { chunkKey, type ChunkPos } from '../core/types';

/** Distance bands and the rates that go with them. */
export const INTEREST = {
  /** Up to this distance a peer gets 20 Hz position updates. */
  NEAR_DISTANCE: 16,
  /** Up to this distance a peer gets 5 Hz position updates. */
  MID_DISTANCE: 64,
  /** Position update interval in the near band (50 ms = 20 Hz). */
  NEAR_INTERVAL_MS: 50,
  /** Position update interval in the mid band (200 ms = 5 Hz). */
  MID_INTERVAL_MS: 200,
  /** Chunks further away than this are not sent at all. */
  MAX_CHUNK_DISTANCE: 128,
  /** Entities further away than this are not sent. */
  MAX_ENTITY_DISTANCE: 64,
  /** Maximum number of chunk payloads sent to one peer per second. */
  MAX_CHUNKS_PER_SECOND: 8,
} as const;

/** Per-peer bookkeeping. */
export interface PeerInterest {
  playerId: string;
  x: number;
  y: number;
  z: number;
  loadedChunks: Set<string>;
  knownEntities: Set<number>;
  lastPositionSentAt: number;
  chunkTokens: number;
  chunkTokensUpdatedAt: number;
}

/** A minimal entity description used for distance filtering. */
export interface EntityStub {
  id: number;
  x: number;
  y: number;
  z: number;
}

/**
 * Tracks what each peer is interested in and paces what is sent to it.
 */
export class InterestManager {
  private readonly peers = new Map<string, PeerInterest>();

  constructor(
    private readonly maxChunksPerSecond: number = INTEREST.MAX_CHUNKS_PER_SECOND,
  ) {}

  /** Every peer currently being tracked. */
  get allPeers(): readonly PeerInterest[] {
    return [...this.peers.values()];
  }

  /** Start tracking a peer. */
  registerPeer(playerId: string, x = 0, y = 0, z = 0): PeerInterest {
    const existing = this.peers.get(playerId);
    if (existing) {
      existing.x = x;
      existing.y = y;
      existing.z = z;
      return existing;
    }
    const interest: PeerInterest = {
      playerId,
      x,
      y,
      z,
      loadedChunks: new Set<string>(),
      knownEntities: new Set<number>(),
      lastPositionSentAt: 0,
      chunkTokens: this.maxChunksPerSecond,
      chunkTokensUpdatedAt: 0,
    };
    this.peers.set(playerId, interest);
    return interest;
  }

  /** Stop tracking a peer. */
  removePeer(playerId: string): void {
    this.peers.delete(playerId);
  }

  /** Update where a peer is. */
  setPeerPosition(playerId: string, x: number, y: number, z: number): void {
    const peer = this.peers.get(playerId);
    if (!peer) {
      this.registerPeer(playerId, x, y, z);
      return;
    }
    peer.x = x;
    peer.y = y;
    peer.z = z;
  }

  /** The last known position of a peer. */
  getPeerPosition(playerId: string): { x: number; y: number; z: number } | null {
    const peer = this.peers.get(playerId);
    return peer ? { x: peer.x, y: peer.y, z: peer.z } : null;
  }

  /** Replace the set of chunks a peer currently has loaded. */
  setLoadedChunks(playerId: string, chunks: Iterable<string>): void {
    const peer = this.peers.get(playerId);
    if (!peer) return;
    peer.loadedChunks = new Set(chunks);
  }

  /** The chunks a peer currently has loaded. */
  getLoadedChunks(playerId: string): Set<string> {
    return this.peers.get(playerId)?.loadedChunks ?? new Set<string>();
  }

  /** Replace the set of entities a peer already knows about. */
  setKnownEntities(playerId: string, ids: Iterable<number>): void {
    const peer = this.peers.get(playerId);
    if (!peer) return;
    peer.knownEntities = new Set(ids);
  }

  /** The entities a peer already knows about. */
  getKnownEntities(playerId: string): Set<number> {
    return this.peers.get(playerId)?.knownEntities ?? new Set<number>();
  }

  /** Distance from a peer to a world position. */
  distanceTo(playerId: string, x: number, y: number, z: number): number {
    const peer = this.peers.get(playerId);
    if (!peer) return Infinity;
    return Math.hypot(peer.x - x, peer.y - y, peer.z - z);
  }

  /**
   * The position-update interval for a distance.
   *
   * 0 means "do not send position updates at all".
   */
  positionIntervalFor(distance: number): number {
    if (distance <= INTEREST.NEAR_DISTANCE) return INTEREST.NEAR_INTERVAL_MS;
    if (distance <= INTEREST.MID_DISTANCE) return INTEREST.MID_INTERVAL_MS;
    return 0;
  }

  /** True when a position update may be sent to this peer right now. */
  canSendPosition(playerId: string, nowMs: number): boolean {
    const peer = this.peers.get(playerId);
    if (!peer) return false;
    const interval = this.positionIntervalFor(this.distanceTo(playerId, peer.x, peer.y, peer.z));
    if (interval === 0) return false;
    return nowMs - peer.lastPositionSentAt >= interval;
  }

  /** Record that a position update was sent. */
  notePositionSent(playerId: string, nowMs: number): void {
    const peer = this.peers.get(playerId);
    if (peer) peer.lastPositionSentAt = nowMs;
  }

  /**
   * Pick the chunks to send to a peer.
   *
   * Chunks the peer already has are skipped, chunks beyond the maximum
   * distance are skipped, the rest are sorted nearest-first and cut down to
   * the per-second budget.
   */
  selectChunksToSend(
    playerId: string,
    nowMs: number,
    candidates: ChunkPos[],
  ): ChunkPos[] {
    const peer = this.peers.get(playerId);
    if (!peer) return [];
    this.refillTokens(peer, nowMs);
    const budget = Math.floor(peer.chunkTokens);
    if (budget <= 0) return [];

    const wanted: { chunk: ChunkPos; distance: number }[] = [];
    for (const chunk of candidates) {
      const key = chunkKey(chunk.cx, chunk.cz);
      if (peer.loadedChunks.has(key)) continue;
      const distance = this.chunkDistance(peer, chunk);
      if (distance > INTEREST.MAX_CHUNK_DISTANCE) continue;
      wanted.push({ chunk, distance });
    }
    wanted.sort((a, b) => a.distance - b.distance);

    const selected = wanted.slice(0, budget).map((entry) => entry.chunk);
    peer.chunkTokens -= selected.length;
    return selected;
  }

  /** Distance from a peer to the nearest block of a chunk. */
  chunkDistance(peer: PeerInterest, chunk: ChunkPos): number {
    const cx = chunk.cx * 16 + 8;
    const cz = chunk.cz * 16 + 8;
    return Math.hypot(peer.x - cx, peer.y, peer.z - cz);
  }

  /** Note that a chunk was sent to a peer. */
  noteChunkSent(playerId: string, cx: number, cz: number): void {
    const peer = this.peers.get(playerId);
    if (!peer) return;
    peer.loadedChunks.add(chunkKey(cx, cz));
  }

  /** Entities that are close enough to be worth sending. */
  selectEntitiesToSend(playerId: string, entities: EntityStub[]): EntityStub[] {
    const peer = this.peers.get(playerId);
    if (!peer) return [];
    const out: EntityStub[] = [];
    for (const entity of entities) {
      if (peer.knownEntities.has(entity.id)) continue;
      const distance = Math.hypot(peer.x - entity.x, peer.y - entity.y, peer.z - entity.z);
      if (distance > INTEREST.MAX_ENTITY_DISTANCE) continue;
      out.push(entity);
    }
    return out;
  }

  /** Note that an entity is now known by a peer. */
  noteEntitySent(playerId: string, entityId: number): void {
    this.peers.get(playerId)?.knownEntities.add(entityId);
  }

  private refillTokens(peer: PeerInterest, nowMs: number): void {
    const elapsed = Math.max(0, nowMs - peer.chunkTokensUpdatedAt);
    peer.chunkTokensUpdatedAt = nowMs;
    peer.chunkTokens = Math.min(
      this.maxChunksPerSecond,
      peer.chunkTokens + (elapsed / 1000) * this.maxChunksPerSecond,
    );
  }
}
