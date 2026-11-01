/**
 * Cubicraft — network message catalogue.
 *
 * Every peer-to-peer message is one of the types below.  Each message has its
 * own `encode*`/`decode*` pair for the payload; `encodeMessage`/`decodeMessage`
 * wrap a payload in the wire frame:
 *
 *     varint length | opcode:u8 | payload
 *
 * The length prefix is redundant on a DataChannel (which frames messages for
 * us) but it lets the exact same bytes travel over BroadcastChannel, a Web
 * Worker postMessage, or a file drop without any extra framing layer.
 *
 * Movement values are *quantised* on the wire (see `quantizePos` /
 * `quantizeAngle`) so a position update costs a handful of bytes.
 */

import type { AvatarSpec, GameMode, PlayerAppearance } from '../core/types';
import {
  ByteReader,
  ByteWriter,
  readBytes,
  readFloat32,
  readString,
  readUint8,
  readVarint,
  readZigZag,
  writeBytes,
  writeFloat32,
  writeString,
  writeUint8,
  writeVarint,
  writeZigZag,
} from './codec';

// ---------------------------------------------------------------------------
// Opcodes
// ---------------------------------------------------------------------------

export const enum Op {
  // client -> host
  HELLO = 1,
  MOVE = 2,
  BLOCK_BREAK = 3,
  BLOCK_PLACE = 4,
  CHUNK_REQUEST = 5,
  CHAT = 6,
  INVENTORY_ACTION = 7,
  PING = 8,
  INPUT_ACTION = 9,
  RESPAWN = 10,
  WORLD_SAVE_REQUEST = 11,
  HOST_TRANSFER = 12,
  BEACON_JOIN = 13,
  // host -> client
  WELCOME = 64,
  PLAYER_JOIN = 65,
  PLAYER_LEAVE = 66,
  CHUNK_DATA = 67,
  BLOCK_CHANGE = 68,
  BULK_BLOCK_CHANGE = 69,
  ENTITY_SPAWN = 70,
  ENTITY_DESPAWN = 71,
  ENTITY_STATE = 72,
  ENTITY_MOVES = 73,
  INVENTORY_SYNC = 74,
  ITEM_PICKUP = 75,
  DAMAGE = 76,
  MOB_AI = 77,
  TIME_WEATHER = 78,
  WORLD_SAVE = 79,
  PONG = 80,
  CHUNK_UNLOAD = 81,
  CORRECTION = 82,
  HOST_TRANSFERRED = 83,
  ERROR = 84,
}

/** Bits carried in `MOVE.flags`. */
export const MOVE_FLAG = {
  ON_GROUND: 1 << 0,
  SNEAKING: 1 << 1,
  SPRINTING: 1 << 2,
  FLYING: 1 << 3,
} as const;

/** Error codes carried by `ERROR`. */
export const NET_ERROR = {
  PROTOCOL_MISMATCH: 1,
  NOT_AUTHORISED: 2,
  OUT_OF_REACH: 3,
  UNKNOWN_CHUNK: 4,
  MALFORMED: 5,
  INTERNAL: 6,
} as const;

const GAME_MODES: GameMode[] = [
  'survival',
  'creative',
  'adventure',
  'spectator',
  'hardcore',
  'sandbox',
];

// ---------------------------------------------------------------------------
// Quantisation
// ---------------------------------------------------------------------------

/** Fixed-point conversion: blocks -> 1/32 block units. */
export function quantizePos(v: number): number {
  return Math.round(v * 32);
}

/** Fixed-point conversion: 1/32 block units -> blocks. */
export function dequantizePos(q: number): number {
  return q / 32;
}

/**
 * Fixed-point conversion: radians -> 1/256 of a turn, wrapped to 0..255.
 *
 * Pitch uses the same unit as yaw.  A consumer that needs a signed pitch must
 * unwrap it into [-PI/2, PI/2] afterwards.
 */
export function quantizeAngle(a: number): number {
  const q = Math.round((a * 256) / (2 * Math.PI));
  return ((q % 256) + 256) % 256;
}

/** Fixed-point conversion: 1/256 of a turn -> radians. */
export function dequantizeAngle(q: number): number {
  return (q * 2 * Math.PI) / 256;
}

// ---------------------------------------------------------------------------
// Message payloads
// ---------------------------------------------------------------------------

export interface HelloMessage {
  op: Op.HELLO;
  protocolVersion: number;
  name: string;
  avatar: AvatarSpec;
}

export interface WelcomeMessage {
  op: Op.WELCOME;
  playerId: string;
  seed: number;
  timeOfDay: number;
  dayLengthSeconds: number;
  mode: GameMode;
  players: PlayerAppearance[];
  /** Encoded chunk payload of the host's spawn chunk (see `encodeChunk`). */
  chunkData: Uint8Array;
}

export interface MoveMessage {
  op: Op.MOVE;
  /** Position in 1/32-block fixed point (`quantizePos`). */
  x: number;
  y: number;
  z: number;
  /** Yaw in 1/256-turn units (`quantizeAngle`). */
  yaw: number;
  /** Pitch in 1/256-turn units (`quantizeAngle`). */
  pitch: number;
  /** Bit field, see `MOVE_FLAG`. */
  flags: number;
}

export interface BlockBreakMessage {
  op: Op.BLOCK_BREAK;
  x: number;
  y: number;
  z: number;
}

export interface BlockPlaceMessage {
  op: Op.BLOCK_PLACE;
  x: number;
  y: number;
  z: number;
  blockId: number;
  state: number;
}

export interface ChunkRequestMessage {
  op: Op.CHUNK_REQUEST;
  cx: number;
  cz: number;
  dimension: string;
}

export interface ChatMessage {
  op: Op.CHAT;
  from: string;
  text: string;
}

export interface InventoryActionMessage {
  op: Op.INVENTORY_ACTION;
  slot: number;
  /** Engine-defined action id (e.g. pick up / drop / swap). */
  action: number;
  itemId: string;
  count: number;
}

export interface PingMessage {
  op: Op.PING;
  id: number;
  /** Client-side timestamp (ms) used to measure round-trip time. */
  time: number;
}

export interface InputActionMessage {
  op: Op.INPUT_ACTION;
  /** Engine-defined action id (e.g. attack / interact / use item). */
  action: number;
  value: number;
}

export interface RespawnMessage {
  op: Op.RESPAWN;
}

export interface WorldSaveRequestMessage {
  op: Op.WORLD_SAVE_REQUEST;
}

export interface HostTransferMessage {
  op: Op.HOST_TRANSFER;
  toPlayerId: string;
}

export interface BeaconJoinMessage {
  op: Op.BEACON_JOIN;
  playerId: string;
  name: string;
  avatar: AvatarSpec;
}

export interface PlayerJoinMessage {
  op: Op.PLAYER_JOIN;
  player: PlayerAppearance;
  dimension: string;
  x: number;
  y: number;
  z: number;
}

export interface PlayerLeaveMessage {
  op: Op.PLAYER_LEAVE;
  playerId: string;
}

export interface ChunkDataMessage {
  op: Op.CHUNK_DATA;
  cx: number;
  cz: number;
  dimension: string;
  /** Encoded chunk payload (see `encodeChunk`). */
  payload: Uint8Array;
}

export interface BlockChange {
  x: number;
  y: number;
  z: number;
  blockId: number;
  state: number;
}

export interface BlockChangeMessage {
  op: Op.BLOCK_CHANGE;
  x: number;
  y: number;
  z: number;
  blockId: number;
  state: number;
}

export interface BulkBlockChangeMessage {
  op: Op.BULK_BLOCK_CHANGE;
  changes: BlockChange[];
}

export interface EntitySpawnMessage {
  op: Op.ENTITY_SPAWN;
  id: number;
  type: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
}

export interface EntityDespawnMessage {
  op: Op.ENTITY_DESPAWN;
  id: number;
}

export interface EntityStateMessage {
  op: Op.ENTITY_STATE;
  id: number;
  /** Engine-defined state bit field. */
  state: number;
  health: number;
}

export interface EntityMovesMessage {
  op: Op.ENTITY_MOVES;
  id: number;
  dx: number;
  dy: number;
  dz: number;
  yaw: number;
  pitch: number;
}

export interface InventorySlot {
  slot: number;
  itemId: string;
  count: number;
  durability: number;
}

export interface InventorySyncMessage {
  op: Op.INVENTORY_SYNC;
  playerId: string;
  slots: InventorySlot[];
}

export interface ItemPickupMessage {
  op: Op.ITEM_PICKUP;
  itemId: string;
  count: number;
}

export interface DamageMessage {
  op: Op.DAMAGE;
  amount: number;
  health: number;
  source: string;
}

export interface MobAiMessage {
  op: Op.MOB_AI;
  id: number;
  goal: string;
  targetId: number;
}

export interface TimeWeatherMessage {
  op: Op.TIME_WEATHER;
  timeOfDay: number;
  dayLengthSeconds: number;
  /** Engine-defined weather id. */
  weather: number;
}

export interface WorldSaveMessage {
  op: Op.WORLD_SAVE;
  /** Deflate-compressed world passport (see `exportWorldPassport`). */
  bytes: Uint8Array;
}

export interface PongMessage {
  op: Op.PONG;
  id: number;
  time: number;
}

export interface ChunkUnloadMessage {
  op: Op.CHUNK_UNLOAD;
  cx: number;
  cz: number;
  dimension: string;
}

export interface CorrectionMessage {
  op: Op.CORRECTION;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
}

export interface HostTransferredMessage {
  op: Op.HOST_TRANSFERRED;
  newHostId: string;
  seed: number;
  timeOfDay: number;
  dayLengthSeconds: number;
  mode: GameMode;
  players: PlayerAppearance[];
  /** Full world passport so the new host can take over. */
  worldSave: Uint8Array;
}

export interface ErrorMessage {
  op: Op.ERROR;
  code: number;
  message: string;
}

export type NetMessage =
  | HelloMessage
  | WelcomeMessage
  | MoveMessage
  | BlockBreakMessage
  | BlockPlaceMessage
  | ChunkRequestMessage
  | ChatMessage
  | InventoryActionMessage
  | PingMessage
  | InputActionMessage
  | RespawnMessage
  | WorldSaveRequestMessage
  | HostTransferMessage
  | BeaconJoinMessage
  | PlayerJoinMessage
  | PlayerLeaveMessage
  | ChunkDataMessage
  | BlockChangeMessage
  | BulkBlockChangeMessage
  | EntitySpawnMessage
  | EntityDespawnMessage
  | EntityStateMessage
  | EntityMovesMessage
  | InventorySyncMessage
  | ItemPickupMessage
  | DamageMessage
  | MobAiMessage
  | TimeWeatherMessage
  | WorldSaveMessage
  | PongMessage
  | ChunkUnloadMessage
  | CorrectionMessage
  | HostTransferredMessage
  | ErrorMessage;

/** Opcodes that belong on the unreliable / unordered channel. */
export function isFastOp(op: Op): boolean {
  return op === Op.MOVE || op === Op.ENTITY_MOVES;
}

// ---------------------------------------------------------------------------
// Shared sub-payload helpers
// ---------------------------------------------------------------------------

function writeAvatar(avatar: AvatarSpec, w: ByteWriter): void {
  writeString(avatar.kit, w);
  writeUint8(avatar.skinTone, w);
  writeUint8(avatar.hair, w);
  writeVarint(avatar.hairColor, w);
  writeString(avatar.name, w);
  writeUint8(avatar.number, w);
}

function readAvatar(r: ByteReader): AvatarSpec {
  const kit = readString(r);
  const skinTone = readUint8(r);
  const hair = readUint8(r);
  const hairColor = readVarint(r);
  const name = readString(r);
  const number = readUint8(r);
  return { kit, skinTone, hair, hairColor, name, number };
}

function writeAppearance(player: PlayerAppearance, w: ByteWriter): void {
  writeString(player.id, w);
  writeString(player.name, w);
  writeAvatar(player.avatar, w);
}

function readAppearance(r: ByteReader): PlayerAppearance {
  const id = readString(r);
  const name = readString(r);
  const avatar = readAvatar(r);
  return { id, name, avatar };
}

function writeMode(mode: GameMode, w: ByteWriter): void {
  const index = GAME_MODES.indexOf(mode);
  writeUint8(index < 0 ? 0 : index, w);
}

function readMode(r: ByteReader): GameMode {
  const index = readUint8(r);
  return GAME_MODES[index] ?? 'survival';
}

function writeBlockChange(change: BlockChange, w: ByteWriter): void {
  writeZigZag(change.x, w);
  writeZigZag(change.y, w);
  writeZigZag(change.z, w);
  writeVarint(change.blockId, w);
  writeVarint(change.state, w);
}

function readBlockChange(r: ByteReader): BlockChange {
  const x = readZigZag(r);
  const y = readZigZag(r);
  const z = readZigZag(r);
  const blockId = readVarint(r);
  const state = readVarint(r);
  return { x, y, z, blockId, state };
}

// ---------------------------------------------------------------------------
// Per-message codecs
// ---------------------------------------------------------------------------

export function encodeHello(msg: HelloMessage): Uint8Array {
  const w = new ByteWriter(64);
  writeVarint(msg.protocolVersion, w);
  writeString(msg.name, w);
  writeAvatar(msg.avatar, w);
  return w.bytes.slice();
}

export function decodeHello(src: ByteReader | Uint8Array): HelloMessage {
  const r = src instanceof ByteReader ? src : new ByteReader(src);
  const protocolVersion = readVarint(r);
  const name = readString(r);
  const avatar = readAvatar(r);
  return { op: Op.HELLO, protocolVersion, name, avatar };
}

export function encodeWelcome(msg: WelcomeMessage): Uint8Array {
  const w = new ByteWriter(256);
  writeString(msg.playerId, w);
  writeVarint(msg.seed, w);
  writeFloat32(msg.timeOfDay, w);
  writeFloat32(msg.dayLengthSeconds, w);
  writeMode(msg.mode, w);
  writeVarint(msg.players.length, w);
  for (const player of msg.players) writeAppearance(player, w);
  writeBytes(msg.chunkData, w);
  return w.bytes.slice();
}

export function decodeWelcome(src: ByteReader | Uint8Array): WelcomeMessage {
  const r = src instanceof ByteReader ? src : new ByteReader(src);
  const playerId = readString(r);
  const seed = readVarint(r);
  const timeOfDay = readFloat32(r);
  const dayLengthSeconds = readFloat32(r);
  const mode = readMode(r);
  const playerCount = readVarint(r);
  const players: PlayerAppearance[] = [];
  for (let i = 0; i < playerCount; i++) players.push(readAppearance(r));
  const chunkData = readBytes(r);
  return { op: Op.WELCOME, playerId, seed, timeOfDay, dayLengthSeconds, mode, players, chunkData };
}

export function encodeMove(msg: MoveMessage): Uint8Array {
  const w = new ByteWriter(16);
  // Positions are zig-zag encoded: they are signed even after quantisation.
  writeZigZag(msg.x, w);
  writeZigZag(msg.y, w);
  writeZigZag(msg.z, w);
  writeUint8(msg.yaw, w);
  writeUint8(msg.pitch, w);
  writeUint8(msg.flags, w);
  return w.bytes.slice();
}

export function decodeMove(src: ByteReader | Uint8Array): MoveMessage {
  const r = src instanceof ByteReader ? src : new ByteReader(src);
  const x = readZigZag(r);
  const y = readZigZag(r);
  const z = readZigZag(r);
  const yaw = readUint8(r);
  const pitch = readUint8(r);
  const flags = readUint8(r);
  return { op: Op.MOVE, x, y, z, yaw, pitch, flags };
}

export function encodeBlockBreak(msg: BlockBreakMessage): Uint8Array {
  const w = new ByteWriter(16);
  writeZigZag(msg.x, w);
  writeZigZag(msg.y, w);
  writeZigZag(msg.z, w);
  return w.bytes.slice();
}

export function decodeBlockBreak(src: ByteReader | Uint8Array): BlockBreakMessage {
  const r = src instanceof ByteReader ? src : new ByteReader(src);
  const x = readZigZag(r);
  const y = readZigZag(r);
  const z = readZigZag(r);
  return { op: Op.BLOCK_BREAK, x, y, z };
}

export function encodeBlockPlace(msg: BlockPlaceMessage): Uint8Array {
  const w = new ByteWriter(20);
  writeZigZag(msg.x, w);
  writeZigZag(msg.y, w);
  writeZigZag(msg.z, w);
  writeVarint(msg.blockId, w);
  writeVarint(msg.state, w);
  return w.bytes.slice();
}

export function decodeBlockPlace(src: ByteReader | Uint8Array): BlockPlaceMessage {
  const r = src instanceof ByteReader ? src : new ByteReader(src);
  const x = readZigZag(r);
  const y = readZigZag(r);
  const z = readZigZag(r);
  const blockId = readVarint(r);
  const state = readVarint(r);
  return { op: Op.BLOCK_PLACE, x, y, z, blockId, state };
}

export function encodeChunkRequest(msg: ChunkRequestMessage): Uint8Array {
  const w = new ByteWriter(32);
  writeZigZag(msg.cx, w);
  writeZigZag(msg.cz, w);
  writeString(msg.dimension, w);
  return w.bytes.slice();
}

export function decodeChunkRequest(src: ByteReader | Uint8Array): ChunkRequestMessage {
  const r = src instanceof ByteReader ? src : new ByteReader(src);
  const cx = readZigZag(r);
  const cz = readZigZag(r);
  const dimension = readString(r);
  return { op: Op.CHUNK_REQUEST, cx, cz, dimension };
}

export function encodeChat(msg: ChatMessage): Uint8Array {
  const w = new ByteWriter(64);
  writeString(msg.from, w);
  writeString(msg.text, w);
  return w.bytes.slice();
}

export function decodeChat(src: ByteReader | Uint8Array): ChatMessage {
  const r = src instanceof ByteReader ? src : new ByteReader(src);
  const from = readString(r);
  const text = readString(r);
  return { op: Op.CHAT, from, text };
}

export function encodeInventoryAction(msg: InventoryActionMessage): Uint8Array {
  const w = new ByteWriter(48);
  writeVarint(msg.slot, w);
  writeUint8(msg.action, w);
  writeString(msg.itemId, w);
  writeVarint(msg.count, w);
  return w.bytes.slice();
}

export function decodeInventoryAction(src: ByteReader | Uint8Array): InventoryActionMessage {
  const r = src instanceof ByteReader ? src : new ByteReader(src);
  const slot = readVarint(r);
  const action = readUint8(r);
  const itemId = readString(r);
  const count = readVarint(r);
  return { op: Op.INVENTORY_ACTION, slot, action, itemId, count };
}

export function encodePing(msg: PingMessage): Uint8Array {
  const w = new ByteWriter(16);
  writeVarint(msg.id, w);
  writeFloat32(msg.time, w);
  return w.bytes.slice();
}

export function decodePing(src: ByteReader | Uint8Array): PingMessage {
  const r = src instanceof ByteReader ? src : new ByteReader(src);
  const id = readVarint(r);
  const time = readFloat32(r);
  return { op: Op.PING, id, time };
}

export function encodeInputAction(msg: InputActionMessage): Uint8Array {
  const w = new ByteWriter(12);
  writeUint8(msg.action, w);
  writeFloat32(msg.value, w);
  return w.bytes.slice();
}

export function decodeInputAction(src: ByteReader | Uint8Array): InputActionMessage {
  const r = src instanceof ByteReader ? src : new ByteReader(src);
  const action = readUint8(r);
  const value = readFloat32(r);
  return { op: Op.INPUT_ACTION, action, value };
}

export function encodeRespawn(_msg: RespawnMessage): Uint8Array {
  return new Uint8Array(0);
}

export function decodeRespawn(_src: ByteReader | Uint8Array): RespawnMessage {
  return { op: Op.RESPAWN };
}

export function encodeWorldSaveRequest(_msg: WorldSaveRequestMessage): Uint8Array {
  return new Uint8Array(0);
}

export function decodeWorldSaveRequest(_src: ByteReader | Uint8Array): WorldSaveRequestMessage {
  return { op: Op.WORLD_SAVE_REQUEST };
}

export function encodeHostTransfer(msg: HostTransferMessage): Uint8Array {
  const w = new ByteWriter(32);
  writeString(msg.toPlayerId, w);
  return w.bytes.slice();
}

export function decodeHostTransfer(src: ByteReader | Uint8Array): HostTransferMessage {
  const r = src instanceof ByteReader ? src : new ByteReader(src);
  const toPlayerId = readString(r);
  return { op: Op.HOST_TRANSFER, toPlayerId };
}

export function encodeBeaconJoin(msg: BeaconJoinMessage): Uint8Array {
  const w = new ByteWriter(64);
  writeString(msg.playerId, w);
  writeString(msg.name, w);
  writeAvatar(msg.avatar, w);
  return w.bytes.slice();
}

export function decodeBeaconJoin(src: ByteReader | Uint8Array): BeaconJoinMessage {
  const r = src instanceof ByteReader ? src : new ByteReader(src);
  const playerId = readString(r);
  const name = readString(r);
  const avatar = readAvatar(r);
  return { op: Op.BEACON_JOIN, playerId, name, avatar };
}

export function encodePlayerJoin(msg: PlayerJoinMessage): Uint8Array {
  const w = new ByteWriter(96);
  writeAppearance(msg.player, w);
  writeString(msg.dimension, w);
  writeFloat32(msg.x, w);
  writeFloat32(msg.y, w);
  writeFloat32(msg.z, w);
  return w.bytes.slice();
}

export function decodePlayerJoin(src: ByteReader | Uint8Array): PlayerJoinMessage {
  const r = src instanceof ByteReader ? src : new ByteReader(src);
  const player = readAppearance(r);
  const dimension = readString(r);
  const x = readFloat32(r);
  const y = readFloat32(r);
  const z = readFloat32(r);
  return { op: Op.PLAYER_JOIN, player, dimension, x, y, z };
}

export function encodePlayerLeave(msg: PlayerLeaveMessage): Uint8Array {
  const w = new ByteWriter(32);
  writeString(msg.playerId, w);
  return w.bytes.slice();
}

export function decodePlayerLeave(src: ByteReader | Uint8Array): PlayerLeaveMessage {
  const r = src instanceof ByteReader ? src : new ByteReader(src);
  const playerId = readString(r);
  return { op: Op.PLAYER_LEAVE, playerId };
}

export function encodeChunkData(msg: ChunkDataMessage): Uint8Array {
  const w = new ByteWriter(1024);
  writeZigZag(msg.cx, w);
  writeZigZag(msg.cz, w);
  writeString(msg.dimension, w);
  writeBytes(msg.payload, w);
  return w.bytes.slice();
}

export function decodeChunkData(src: ByteReader | Uint8Array): ChunkDataMessage {
  const r = src instanceof ByteReader ? src : new ByteReader(src);
  const cx = readZigZag(r);
  const cz = readZigZag(r);
  const dimension = readString(r);
  const payload = readBytes(r);
  return { op: Op.CHUNK_DATA, cx, cz, dimension, payload };
}

export function encodeBlockChange(msg: BlockChangeMessage): Uint8Array {
  const w = new ByteWriter(20);
  writeBlockChange(msg, w);
  return w.bytes.slice();
}

export function decodeBlockChange(src: ByteReader | Uint8Array): BlockChangeMessage {
  const r = src instanceof ByteReader ? src : new ByteReader(src);
  const change = readBlockChange(r);
  return { op: Op.BLOCK_CHANGE, ...change };
}

export function encodeBulkBlockChange(msg: BulkBlockChangeMessage): Uint8Array {
  const w = new ByteWriter(64 + msg.changes.length * 8);
  writeVarint(msg.changes.length, w);
  for (const change of msg.changes) writeBlockChange(change, w);
  return w.bytes.slice();
}

export function decodeBulkBlockChange(src: ByteReader | Uint8Array): BulkBlockChangeMessage {
  const r = src instanceof ByteReader ? src : new ByteReader(src);
  const count = readVarint(r);
  const changes: BlockChange[] = [];
  for (let i = 0; i < count; i++) changes.push(readBlockChange(r));
  return { op: Op.BULK_BLOCK_CHANGE, changes };
}

export function encodeEntitySpawn(msg: EntitySpawnMessage): Uint8Array {
  const w = new ByteWriter(48);
  writeVarint(msg.id, w);
  writeString(msg.type, w);
  writeFloat32(msg.x, w);
  writeFloat32(msg.y, w);
  writeFloat32(msg.z, w);
  writeFloat32(msg.yaw, w);
  writeFloat32(msg.pitch, w);
  return w.bytes.slice();
}

export function decodeEntitySpawn(src: ByteReader | Uint8Array): EntitySpawnMessage {
  const r = src instanceof ByteReader ? src : new ByteReader(src);
  const id = readVarint(r);
  const type = readString(r);
  const x = readFloat32(r);
  const y = readFloat32(r);
  const z = readFloat32(r);
  const yaw = readFloat32(r);
  const pitch = readFloat32(r);
  return { op: Op.ENTITY_SPAWN, id, type, x, y, z, yaw, pitch };
}

export function encodeEntityDespawn(msg: EntityDespawnMessage): Uint8Array {
  const w = new ByteWriter(8);
  writeVarint(msg.id, w);
  return w.bytes.slice();
}

export function decodeEntityDespawn(src: ByteReader | Uint8Array): EntityDespawnMessage {
  const r = src instanceof ByteReader ? src : new ByteReader(src);
  const id = readVarint(r);
  return { op: Op.ENTITY_DESPAWN, id };
}

export function encodeEntityState(msg: EntityStateMessage): Uint8Array {
  const w = new ByteWriter(16);
  writeVarint(msg.id, w);
  writeVarint(msg.state, w);
  writeFloat32(msg.health, w);
  return w.bytes.slice();
}

export function decodeEntityState(src: ByteReader | Uint8Array): EntityStateMessage {
  const r = src instanceof ByteReader ? src : new ByteReader(src);
  const id = readVarint(r);
  const state = readVarint(r);
  const health = readFloat32(r);
  return { op: Op.ENTITY_STATE, id, state, health };
}

export function encodeEntityMoves(msg: EntityMovesMessage): Uint8Array {
  const w = new ByteWriter(32);
  writeVarint(msg.id, w);
  writeFloat32(msg.dx, w);
  writeFloat32(msg.dy, w);
  writeFloat32(msg.dz, w);
  writeFloat32(msg.yaw, w);
  writeFloat32(msg.pitch, w);
  return w.bytes.slice();
}

export function decodeEntityMoves(src: ByteReader | Uint8Array): EntityMovesMessage {
  const r = src instanceof ByteReader ? src : new ByteReader(src);
  const id = readVarint(r);
  const dx = readFloat32(r);
  const dy = readFloat32(r);
  const dz = readFloat32(r);
  const yaw = readFloat32(r);
  const pitch = readFloat32(r);
  return { op: Op.ENTITY_MOVES, id, dx, dy, dz, yaw, pitch };
}

export function encodeInventorySync(msg: InventorySyncMessage): Uint8Array {
  const w = new ByteWriter(256);
  writeString(msg.playerId, w);
  writeVarint(msg.slots.length, w);
  for (const slot of msg.slots) {
    writeVarint(slot.slot, w);
    writeString(slot.itemId, w);
    writeVarint(slot.count, w);
    writeVarint(slot.durability, w);
  }
  return w.bytes.slice();
}

export function decodeInventorySync(src: ByteReader | Uint8Array): InventorySyncMessage {
  const r = src instanceof ByteReader ? src : new ByteReader(src);
  const playerId = readString(r);
  const count = readVarint(r);
  const slots: InventorySlot[] = [];
  for (let i = 0; i < count; i++) {
    const slot = readVarint(r);
    const itemId = readString(r);
    const itemCount = readVarint(r);
    const durability = readVarint(r);
    slots.push({ slot, itemId, count: itemCount, durability });
  }
  return { op: Op.INVENTORY_SYNC, playerId, slots };
}

export function encodeItemPickup(msg: ItemPickupMessage): Uint8Array {
  const w = new ByteWriter(32);
  writeString(msg.itemId, w);
  writeVarint(msg.count, w);
  return w.bytes.slice();
}

export function decodeItemPickup(src: ByteReader | Uint8Array): ItemPickupMessage {
  const r = src instanceof ByteReader ? src : new ByteReader(src);
  const itemId = readString(r);
  const count = readVarint(r);
  return { op: Op.ITEM_PICKUP, itemId, count };
}

export function encodeDamage(msg: DamageMessage): Uint8Array {
  const w = new ByteWriter(32);
  writeFloat32(msg.amount, w);
  writeFloat32(msg.health, w);
  writeString(msg.source, w);
  return w.bytes.slice();
}

export function decodeDamage(src: ByteReader | Uint8Array): DamageMessage {
  const r = src instanceof ByteReader ? src : new ByteReader(src);
  const amount = readFloat32(r);
  const health = readFloat32(r);
  const source = readString(r);
  return { op: Op.DAMAGE, amount, health, source };
}

export function encodeMobAi(msg: MobAiMessage): Uint8Array {
  const w = new ByteWriter(48);
  writeVarint(msg.id, w);
  writeString(msg.goal, w);
  writeVarint(msg.targetId, w);
  return w.bytes.slice();
}

export function decodeMobAi(src: ByteReader | Uint8Array): MobAiMessage {
  const r = src instanceof ByteReader ? src : new ByteReader(src);
  const id = readVarint(r);
  const goal = readString(r);
  const targetId = readVarint(r);
  return { op: Op.MOB_AI, id, goal, targetId };
}

export function encodeTimeWeather(msg: TimeWeatherMessage): Uint8Array {
  const w = new ByteWriter(16);
  writeFloat32(msg.timeOfDay, w);
  writeFloat32(msg.dayLengthSeconds, w);
  writeUint8(msg.weather, w);
  return w.bytes.slice();
}

export function decodeTimeWeather(src: ByteReader | Uint8Array): TimeWeatherMessage {
  const r = src instanceof ByteReader ? src : new ByteReader(src);
  const timeOfDay = readFloat32(r);
  const dayLengthSeconds = readFloat32(r);
  const weather = readUint8(r);
  return { op: Op.TIME_WEATHER, timeOfDay, dayLengthSeconds, weather };
}

export function encodeWorldSave(msg: WorldSaveMessage): Uint8Array {
  const w = new ByteWriter(msg.bytes.length + 16);
  writeBytes(msg.bytes, w);
  return w.bytes.slice();
}

export function decodeWorldSave(src: ByteReader | Uint8Array): WorldSaveMessage {
  const r = src instanceof ByteReader ? src : new ByteReader(src);
  const bytes = readBytes(r);
  return { op: Op.WORLD_SAVE, bytes };
}

export function encodePong(msg: PongMessage): Uint8Array {
  const w = new ByteWriter(16);
  writeVarint(msg.id, w);
  writeFloat32(msg.time, w);
  return w.bytes.slice();
}

export function decodePong(src: ByteReader | Uint8Array): PongMessage {
  const r = src instanceof ByteReader ? src : new ByteReader(src);
  const id = readVarint(r);
  const time = readFloat32(r);
  return { op: Op.PONG, id, time };
}

export function encodeChunkUnload(msg: ChunkUnloadMessage): Uint8Array {
  const w = new ByteWriter(32);
  writeZigZag(msg.cx, w);
  writeZigZag(msg.cz, w);
  writeString(msg.dimension, w);
  return w.bytes.slice();
}

export function decodeChunkUnload(src: ByteReader | Uint8Array): ChunkUnloadMessage {
  const r = src instanceof ByteReader ? src : new ByteReader(src);
  const cx = readZigZag(r);
  const cz = readZigZag(r);
  const dimension = readString(r);
  return { op: Op.CHUNK_UNLOAD, cx, cz, dimension };
}

export function encodeCorrection(msg: CorrectionMessage): Uint8Array {
  const w = new ByteWriter(24);
  writeFloat32(msg.x, w);
  writeFloat32(msg.y, w);
  writeFloat32(msg.z, w);
  writeFloat32(msg.yaw, w);
  writeFloat32(msg.pitch, w);
  return w.bytes.slice();
}

export function decodeCorrection(src: ByteReader | Uint8Array): CorrectionMessage {
  const r = src instanceof ByteReader ? src : new ByteReader(src);
  const x = readFloat32(r);
  const y = readFloat32(r);
  const z = readFloat32(r);
  const yaw = readFloat32(r);
  const pitch = readFloat32(r);
  return { op: Op.CORRECTION, x, y, z, yaw, pitch };
}

export function encodeHostTransferred(msg: HostTransferredMessage): Uint8Array {
  const w = new ByteWriter(512);
  writeString(msg.newHostId, w);
  writeVarint(msg.seed, w);
  writeFloat32(msg.timeOfDay, w);
  writeFloat32(msg.dayLengthSeconds, w);
  writeMode(msg.mode, w);
  writeVarint(msg.players.length, w);
  for (const player of msg.players) writeAppearance(player, w);
  writeBytes(msg.worldSave, w);
  return w.bytes.slice();
}

export function decodeHostTransferred(src: ByteReader | Uint8Array): HostTransferredMessage {
  const r = src instanceof ByteReader ? src : new ByteReader(src);
  const newHostId = readString(r);
  const seed = readVarint(r);
  const timeOfDay = readFloat32(r);
  const dayLengthSeconds = readFloat32(r);
  const mode = readMode(r);
  const playerCount = readVarint(r);
  const players: PlayerAppearance[] = [];
  for (let i = 0; i < playerCount; i++) players.push(readAppearance(r));
  const worldSave = readBytes(r);
  return {
    op: Op.HOST_TRANSFERRED,
    newHostId,
    seed,
    timeOfDay,
    dayLengthSeconds,
    mode,
    players,
    worldSave,
  };
}

export function encodeError(msg: ErrorMessage): Uint8Array {
  const w = new ByteWriter(64);
  writeUint8(msg.code, w);
  writeString(msg.message, w);
  return w.bytes.slice();
}

export function decodeError(src: ByteReader | Uint8Array): ErrorMessage {
  const r = src instanceof ByteReader ? src : new ByteReader(src);
  const code = readUint8(r);
  const message = readString(r);
  return { op: Op.ERROR, code, message };
}

// ---------------------------------------------------------------------------
// Frame
// ---------------------------------------------------------------------------

/** Encode a message payload (without the opcode / length framing). */
export function encodePayload(msg: NetMessage): Uint8Array {
  switch (msg.op) {
    case Op.HELLO:
      return encodeHello(msg);
    case Op.WELCOME:
      return encodeWelcome(msg);
    case Op.MOVE:
      return encodeMove(msg);
    case Op.BLOCK_BREAK:
      return encodeBlockBreak(msg);
    case Op.BLOCK_PLACE:
      return encodeBlockPlace(msg);
    case Op.CHUNK_REQUEST:
      return encodeChunkRequest(msg);
    case Op.CHAT:
      return encodeChat(msg);
    case Op.INVENTORY_ACTION:
      return encodeInventoryAction(msg);
    case Op.PING:
      return encodePing(msg);
    case Op.INPUT_ACTION:
      return encodeInputAction(msg);
    case Op.RESPAWN:
      return encodeRespawn(msg);
    case Op.WORLD_SAVE_REQUEST:
      return encodeWorldSaveRequest(msg);
    case Op.HOST_TRANSFER:
      return encodeHostTransfer(msg);
    case Op.BEACON_JOIN:
      return encodeBeaconJoin(msg);
    case Op.PLAYER_JOIN:
      return encodePlayerJoin(msg);
    case Op.PLAYER_LEAVE:
      return encodePlayerLeave(msg);
    case Op.CHUNK_DATA:
      return encodeChunkData(msg);
    case Op.BLOCK_CHANGE:
      return encodeBlockChange(msg);
    case Op.BULK_BLOCK_CHANGE:
      return encodeBulkBlockChange(msg);
    case Op.ENTITY_SPAWN:
      return encodeEntitySpawn(msg);
    case Op.ENTITY_DESPAWN:
      return encodeEntityDespawn(msg);
    case Op.ENTITY_STATE:
      return encodeEntityState(msg);
    case Op.ENTITY_MOVES:
      return encodeEntityMoves(msg);
    case Op.INVENTORY_SYNC:
      return encodeInventorySync(msg);
    case Op.ITEM_PICKUP:
      return encodeItemPickup(msg);
    case Op.DAMAGE:
      return encodeDamage(msg);
    case Op.MOB_AI:
      return encodeMobAi(msg);
    case Op.TIME_WEATHER:
      return encodeTimeWeather(msg);
    case Op.WORLD_SAVE:
      return encodeWorldSave(msg);
    case Op.PONG:
      return encodePong(msg);
    case Op.CHUNK_UNLOAD:
      return encodeChunkUnload(msg);
    case Op.CORRECTION:
      return encodeCorrection(msg);
    case Op.HOST_TRANSFERRED:
      return encodeHostTransferred(msg);
    case Op.ERROR:
      return encodeError(msg);
    default: {
      const never: never = msg;
      throw new Error(`protocol: cannot encode message ${JSON.stringify(never)}`);
    }
  }
}

/** Decode a message payload for a known opcode. */
export function decodePayload(op: Op, payload: Uint8Array): NetMessage {
  switch (op) {
    case Op.HELLO:
      return decodeHello(payload);
    case Op.WELCOME:
      return decodeWelcome(payload);
    case Op.MOVE:
      return decodeMove(payload);
    case Op.BLOCK_BREAK:
      return decodeBlockBreak(payload);
    case Op.BLOCK_PLACE:
      return decodeBlockPlace(payload);
    case Op.CHUNK_REQUEST:
      return decodeChunkRequest(payload);
    case Op.CHAT:
      return decodeChat(payload);
    case Op.INVENTORY_ACTION:
      return decodeInventoryAction(payload);
    case Op.PING:
      return decodePing(payload);
    case Op.INPUT_ACTION:
      return decodeInputAction(payload);
    case Op.RESPAWN:
      return decodeRespawn(payload);
    case Op.WORLD_SAVE_REQUEST:
      return decodeWorldSaveRequest(payload);
    case Op.HOST_TRANSFER:
      return decodeHostTransfer(payload);
    case Op.BEACON_JOIN:
      return decodeBeaconJoin(payload);
    case Op.PLAYER_JOIN:
      return decodePlayerJoin(payload);
    case Op.PLAYER_LEAVE:
      return decodePlayerLeave(payload);
    case Op.CHUNK_DATA:
      return decodeChunkData(payload);
    case Op.BLOCK_CHANGE:
      return decodeBlockChange(payload);
    case Op.BULK_BLOCK_CHANGE:
      return decodeBulkBlockChange(payload);
    case Op.ENTITY_SPAWN:
      return decodeEntitySpawn(payload);
    case Op.ENTITY_DESPAWN:
      return decodeEntityDespawn(payload);
    case Op.ENTITY_STATE:
      return decodeEntityState(payload);
    case Op.ENTITY_MOVES:
      return decodeEntityMoves(payload);
    case Op.INVENTORY_SYNC:
      return decodeInventorySync(payload);
    case Op.ITEM_PICKUP:
      return decodeItemPickup(payload);
    case Op.DAMAGE:
      return decodeDamage(payload);
    case Op.MOB_AI:
      return decodeMobAi(payload);
    case Op.TIME_WEATHER:
      return decodeTimeWeather(payload);
    case Op.WORLD_SAVE:
      return decodeWorldSave(payload);
    case Op.PONG:
      return decodePong(payload);
    case Op.CHUNK_UNLOAD:
      return decodeChunkUnload(payload);
    case Op.CORRECTION:
      return decodeCorrection(payload);
    case Op.HOST_TRANSFERRED:
      return decodeHostTransferred(payload);
    case Op.ERROR:
      return decodeError(payload);
    default:
      throw new Error(`protocol: unknown opcode ${String(op)}`);
  }
}

/** Encode a message into a wire frame: `varint length | opcode | payload`. */
export function encodeMessage(msg: NetMessage): Uint8Array {
  const payload = encodePayload(msg);
  const body = new Uint8Array(payload.length + 1);
  body[0] = msg.op;
  body.set(payload, 1);
  const w = new ByteWriter(body.length + 5);
  w.writeVarint(body.length);
  w.writeBytes(body);
  return w.bytes.slice();
}

/** Decode a wire frame produced by `encodeMessage`. */
export function decodeMessage(bytes: Uint8Array): NetMessage {
  const r = new ByteReader(bytes);
  const length = readVarint(r);
  if (length < 1) throw new Error('protocol: frame length must cover the opcode');
  const op = readUint8(r) as Op;
  const payloadLength = length - 1;
  if (r.remaining < payloadLength) throw new Error('protocol: truncated frame');
  const payload = bytes.subarray(r.offset, r.offset + payloadLength);
  return decodePayload(op, payload);
}
