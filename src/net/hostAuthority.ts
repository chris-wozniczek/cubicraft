/**
 * Cubicraft — host authority.
 *
 * The host's browser owns the world simulation.  This class is the gate
 * between what a guest asks for and what actually happens to the world:
 * every block edit is validated (reach, game mode, world bounds) before it is
 * applied and broadcast.
 */

import { log } from '../core/log';
import {
  MODE_CAPABILITIES,
  PROTOCOL_VERSION,
  WORLD_MAX_Y,
  WORLD_MIN_Y,
  type BlockPos,
  type GameMode,
  type PlayerAppearance,
  type PlayerState,
} from '../core/types';
import { encodeChunk, type ChunkPayload } from './codec';
import {
  dequantizeAngle,
  dequantizePos,
  NET_ERROR,
  Op,
  type BlockChange,
  type NetMessage,
} from './protocol';
import { exportWorldPassport, type WorldSave } from './persistence';

/** How far a player may reach, in blocks (measured from the eyes). */
export const MAX_REACH = 6;
/** Eye height above the player's feet, in blocks. */
export const EYE_HEIGHT = 1.62;

/** The kind of edit being validated. */
export type BlockEditKind = 'break' | 'place';

/** Result of a block edit validation. */
export interface BlockEditResult {
  ok: boolean;
  reason?: string;
}

/** Everything the host authority needs from the game. */
export interface HostAuthorityDeps {
  /** World seed, shared with every guest. */
  seed: number;
  /** Game mode of the session. */
  mode: GameMode;
  /** Current time of day. */
  getTime(): number;
  /** Current weather id. */
  getWeather(): number;
  /** All players in the world (from the engine). */
  getPlayers(): PlayerState[];
  /** The chunk at a column, or null when it is not loaded. */
  getChunk(cx: number, cz: number, dimension: string): ChunkPayload | null;
  /** Called after a validated edit, before it is broadcast. */
  onBlockChange(change: BlockChange): void;
  /** Called when a peer disconnects. */
  onPlayerLeave(playerId: string): void;
  /** Sends a message to one peer. */
  send(playerId: string, msg: NetMessage): void;
  /** The length of one in-game day. */
  getDayLengthSeconds?(): number;
  /** Called when a peer introduces itself. */
  onPlayerJoin?(playerId: string, player: PlayerState): void;
  /** A snapshot of the world, used when the host role is handed over. */
  exportWorld?(): WorldSave | null;
}

/**
 * Validate a block edit.
 *
 * Rejects edits that are out of reach, outside the world, or not allowed by
 * the player's game mode.
 */
export function validateBlockEdit(
  player: PlayerState,
  pos: BlockPos,
  kind: BlockEditKind,
): BlockEditResult {
  const capabilities = MODE_CAPABILITIES[player.mode];
  if (kind === 'break' && !capabilities.canBreak) {
    return { ok: false, reason: 'breaking blocks is not allowed in this game mode' };
  }
  if (kind === 'place' && !capabilities.canPlace) {
    return { ok: false, reason: 'placing blocks is not allowed in this game mode' };
  }
  if (pos.y < WORLD_MIN_Y || pos.y >= WORLD_MAX_Y) {
    return { ok: false, reason: 'that block is outside the world' };
  }
  const eyeX = player.x;
  const eyeY = player.y + EYE_HEIGHT;
  const eyeZ = player.z;
  const distance = Math.hypot(
    eyeX - (pos.x + 0.5),
    eyeY - (pos.y + 0.5),
    eyeZ - (pos.z + 0.5),
  );
  if (distance > MAX_REACH) {
    return { ok: false, reason: 'that block is too far away' };
  }
  return { ok: true };
}

/**
 * The host side of the session.
 *
 * One instance per world.  It tracks the peers that said HELLO, validates
 * their requests and broadcasts the results.
 */
export class HostAuthority {
  private readonly peers = new Map<string, PlayerState>();
  private playerCounter = 0;

  constructor(private readonly deps: HostAuthorityDeps) {}

  /** Peers that have introduced themselves. */
  get connectedPlayers(): PlayerState[] {
    return [...this.peers.values()];
  }

  /** The state of one peer, if known. */
  getPlayer(playerId: string): PlayerState | undefined {
    return this.peers.get(playerId);
  }

  /** Handle a message from a peer. */
  handleMessage(fromPlayerId: string, msg: NetMessage): void {
    const op = msg.op;
    switch (msg.op) {
      case Op.HELLO:
        this.handleHello(fromPlayerId, msg);
        return;
      case Op.MOVE:
        this.handleMove(fromPlayerId, msg.x, msg.y, msg.z, msg.yaw, msg.pitch);
        return;
      case Op.BLOCK_BREAK:
        this.handleBlockEdit(fromPlayerId, { x: msg.x, y: msg.y, z: msg.z }, 'break');
        return;
      case Op.BLOCK_PLACE:
        this.handleBlockEdit(
          fromPlayerId,
          { x: msg.x, y: msg.y, z: msg.z },
          'place',
          msg.blockId,
          msg.state,
        );
        return;
      case Op.CHUNK_REQUEST:
        this.handleChunkRequest(fromPlayerId, msg.cx, msg.cz, msg.dimension);
        return;
      case Op.CHAT:
        this.broadcast({ op: Op.CHAT, from: this.nameOf(fromPlayerId), text: msg.text });
        return;
      case Op.PING:
        this.deps.send(fromPlayerId, { op: Op.PONG, id: msg.id, time: msg.time });
        return;
      case Op.WORLD_SAVE_REQUEST:
        void this.handleWorldSaveRequest(fromPlayerId);
        return;
      case Op.HOST_TRANSFER:
        void this.transferHost(msg.toPlayerId);
        return;
      case Op.RESPAWN:
      case Op.INVENTORY_ACTION:
      case Op.INPUT_ACTION:
      case Op.BEACON_JOIN:
        // These are handled by the engine; the host only relays what it must.
        log.debug(`net: host received opcode ${String(op)} from ${fromPlayerId}`);
        return;
      default:
        log.debug(`net: host ignored opcode ${String(op)}`);
    }
  }

  /** Send a message to every peer except one. */
  broadcast(msg: NetMessage, exceptPlayerId?: string): void {
    for (const playerId of this.peers.keys()) {
      if (playerId === exceptPlayerId) continue;
      this.deps.send(playerId, msg);
    }
  }

  /** Forget a peer that disconnected. */
  handleDisconnect(playerId: string): void {
    if (!this.peers.delete(playerId)) return;
    this.deps.onPlayerLeave(playerId);
    this.broadcast({ op: Op.PLAYER_LEAVE, playerId });
  }

  /**
   * Hand the host role to another player.
   *
   * The new host receives the full world passport so it can continue the
   * simulation without losing anything.
   */
  async transferHost(toPlayerId: string): Promise<void> {
    if (!this.peers.has(toPlayerId)) {
      this.deps.send(toPlayerId, {
        op: Op.ERROR,
        code: NET_ERROR.NOT_AUTHORISED,
        message: 'that player cannot become the host',
      });
      return;
    }
    const save = this.deps.exportWorld?.() ?? null;
    const worldSave = save ? await exportWorldPassport(save) : new Uint8Array(0);
    const players = this.appearances();
    this.deps.send(toPlayerId, {
      op: Op.HOST_TRANSFERRED,
      newHostId: toPlayerId,
      seed: this.deps.seed,
      timeOfDay: this.deps.getTime(),
      dayLengthSeconds: this.dayLengthSeconds(),
      mode: this.deps.mode,
      players,
      worldSave,
    });
    log.info(`net: host role transferred to ${toPlayerId}`);
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private handleHello(
    fromPlayerId: string,
    msg: Extract<NetMessage, { op: Op.HELLO }>,
  ): void {
    if (msg.protocolVersion !== PROTOCOL_VERSION) {
      this.deps.send(fromPlayerId, {
        op: Op.ERROR,
        code: NET_ERROR.PROTOCOL_MISMATCH,
        message: `this game uses protocol version ${PROTOCOL_VERSION}`,
      });
      return;
    }
    const player = this.playerFrom(fromPlayerId, msg.name, msg.avatar);
    this.peers.set(fromPlayerId, player);

    this.deps.send(fromPlayerId, {
      op: Op.WELCOME,
      playerId: fromPlayerId,
      seed: this.deps.seed,
      timeOfDay: this.deps.getTime(),
      dayLengthSeconds: this.dayLengthSeconds(),
      mode: this.deps.mode,
      players: this.appearances(),
      chunkData: new Uint8Array(0),
    });
    this.broadcast(
      {
        op: Op.PLAYER_JOIN,
        player: { id: fromPlayerId, name: msg.name, avatar: msg.avatar },
        dimension: player.dimension,
        x: player.x,
        y: player.y,
        z: player.z,
      },
      fromPlayerId,
    );
    this.deps.onPlayerJoin?.(fromPlayerId, player);
  }

  private handleMove(
    fromPlayerId: string,
    x: number,
    y: number,
    z: number,
    yaw: number,
    pitch: number,
  ): void {
    const player = this.peers.get(fromPlayerId);
    if (!player) return;
    player.x = dequantizePos(x);
    player.y = dequantizePos(y);
    player.z = dequantizePos(z);
    player.yaw = dequantizeAngle(yaw);
    player.pitch = dequantizeAngle(pitch);
  }

  private handleBlockEdit(
    fromPlayerId: string,
    pos: BlockPos,
    kind: BlockEditKind,
    blockId = 0,
    state = 0,
  ): void {
    const player = this.peers.get(fromPlayerId);
    if (!player) return;
    const result = validateBlockEdit(player, pos, kind);
    if (!result.ok) {
      this.deps.send(fromPlayerId, {
        op: Op.ERROR,
        code: NET_ERROR.OUT_OF_REACH,
        message: result.reason ?? 'that edit is not allowed',
      });
      return;
    }
    const change: BlockChange = { x: pos.x, y: pos.y, z: pos.z, blockId, state };
    this.deps.onBlockChange(change);
    this.broadcast({ op: Op.BLOCK_CHANGE, ...change });
  }

  private handleChunkRequest(
    fromPlayerId: string,
    cx: number,
    cz: number,
    dimension: string,
  ): void {
    const chunk = this.deps.getChunk(cx, cz, dimension);
    if (!chunk) {
      this.deps.send(fromPlayerId, {
        op: Op.ERROR,
        code: NET_ERROR.UNKNOWN_CHUNK,
        message: 'that chunk is not loaded',
      });
      return;
    }
    this.deps.send(fromPlayerId, {
      op: Op.CHUNK_DATA,
      cx,
      cz,
      dimension,
      payload: encodeChunk(chunk),
    });
  }

  private async handleWorldSaveRequest(fromPlayerId: string): Promise<void> {
    const save = this.deps.exportWorld?.() ?? null;
    const bytes = save ? await exportWorldPassport(save) : new Uint8Array(0);
    this.deps.send(fromPlayerId, { op: Op.WORLD_SAVE, bytes });
  }

  private playerFrom(
    playerId: string,
    name: string,
    avatar: PlayerState['avatar'],
  ): PlayerState {
    const existing = this.deps.getPlayers().find((p) => p.id === playerId);
    if (existing) return existing;
    this.playerCounter += 1;
    return {
      id: playerId,
      name,
      x: 0,
      y: 0,
      z: 0,
      yaw: 0,
      pitch: 0,
      health: 20,
      hunger: 20,
      saturation: 5,
      xp: 0,
      level: 0,
      onGround: true,
      flying: false,
      sneaking: false,
      sprinting: false,
      mode: this.deps.mode,
      avatar,
      dimension: 'overworld',
    };
  }

  private appearances(): PlayerAppearance[] {
    return [...this.peers.values()].map((player) => ({
      id: player.id,
      name: player.name,
      avatar: player.avatar,
    }));
  }

  private nameOf(playerId: string): string {
    return this.peers.get(playerId)?.name ?? playerId;
  }

  private dayLengthSeconds(): number {
    return this.deps.getDayLengthSeconds?.() ?? 600;
  }
}
