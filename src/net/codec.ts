/**
 * Cubicraft — binary wire codec.
 *
 * Everything that crosses the wire (WebRTC DataChannel frames, BroadcastChannel
 * fallback frames, world passports) is encoded here so there is exactly one
 * byte layout to reason about.
 *
 * Design notes:
 * - Varints are LEB128. Values are plain JS numbers, so the codec supports the
 *   full safe-integer range (2^53-1) instead of the usual 32-bit ceiling.
 * - Signed numbers use zig-zag mapping so small negatives stay small on the
 *   wire.  The decoder MUST NOT use `>> 1` (see `readZigZag`).
 * - Writers grow a single Uint8Array; readers walk a cursor over one.  No
 *   intermediate arrays are allocated per field.
 */

import type { BlockPos } from '../core/types';

/** Minimal sink a varint/string can be written into. */
export interface DataViewWriter {
  writeUint8(value: number): void;
  writeBytes(bytes: Uint8Array): void;
}

/** Minimal source a varint/string can be read from. */
export interface DataViewReader {
  readUint8(): number;
  readBytes(length: number): Uint8Array;
}

const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder();

// ---------------------------------------------------------------------------
// Varint (LEB128, unsigned)
// ---------------------------------------------------------------------------

/**
 * Write an unsigned LEB128 varint.
 *
 * Uses division rather than `>>>` because block ids and palette indices can
 * exceed 2^31 and a 32-bit shift would silently corrupt them.
 */
export function writeVarint(value: number, out: DataViewWriter): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`varint must be a non-negative finite number, got ${value}`);
  }
  let v = Math.floor(value);
  while (v >= 0x80) {
    out.writeUint8((v % 0x80) | 0x80);
    v = Math.floor(v / 0x80);
  }
  out.writeUint8(v);
}

/** Read an unsigned LEB128 varint. */
export function readVarint(view: DataViewReader): number {
  let result = 0;
  let shift = 1;
  for (let i = 0; i < 10; i++) {
    const b = view.readUint8();
    result += (b & 0x7f) * shift;
    if ((b & 0x80) === 0) return result;
    shift *= 128;
  }
  throw new Error('varint is longer than 10 bytes — corrupt frame');
}

// ---------------------------------------------------------------------------
// Zig-zag (signed varints)
// ---------------------------------------------------------------------------

/** Write a signed integer using zig-zag mapping. */
export function writeZigZag(value: number, out: DataViewWriter): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`zig-zag value must be finite, got ${value}`);
  }
  const v = Math.trunc(value);
  // 0 -> 0, -1 -> 1, 1 -> 2, -2 -> 3 ...  keeps small magnitudes on one byte.
  writeVarint(v >= 0 ? v * 2 : -v * 2 - 1, out);
}

/**
 * Read a zig-zag encoded signed integer.
 *
 * CRITICAL: this uses `Math.floor(u / 2)`, never `u >> 1`.  `>>` is a *signed
 * 32-bit* shift in JavaScript, so `u >> 1` wraps to a negative number for any
 * unsigned value above 2^30 and silently corrupts coordinates.
 */
export function readZigZag(view: DataViewReader): number {
  const u = readVarint(view);
  return u % 2 === 0 ? Math.floor(u / 2) : -Math.floor(u / 2) - 1;
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export function writeUint8(value: number, out: DataViewWriter): void {
  out.writeUint8(value & 0xff);
}

export function readUint8(view: DataViewReader): number {
  return view.readUint8();
}

export function writeBool(value: boolean, out: DataViewWriter): void {
  out.writeUint8(value ? 1 : 0);
}

export function readBool(view: DataViewReader): boolean {
  return view.readUint8() !== 0;
}

export function writeInt32(value: number, out: DataViewWriter): void {
  const buf = new ArrayBuffer(4);
  new DataView(buf).setInt32(0, value | 0, true);
  out.writeBytes(new Uint8Array(buf));
}

export function readInt32(view: DataViewReader): number {
  const bytes = view.readBytes(4);
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getInt32(0, true);
}

export function writeFloat32(value: number, out: DataViewWriter): void {
  const buf = new ArrayBuffer(4);
  new DataView(buf).setFloat32(0, value, true);
  out.writeBytes(new Uint8Array(buf));
}

export function readFloat32(view: DataViewReader): number {
  const bytes = view.readBytes(4);
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getFloat32(0, true);
}

/** Write a length-prefixed UTF-8 string. */
export function writeString(value: string, out: DataViewWriter): void {
  const bytes = UTF8_ENCODER.encode(value);
  writeVarint(bytes.length, out);
  out.writeBytes(bytes);
}

/** Read a length-prefixed UTF-8 string. */
export function readString(view: DataViewReader): string {
  const length = readVarint(view);
  if (length === 0) return '';
  return UTF8_DECODER.decode(view.readBytes(length));
}

/** Write a length-prefixed byte blob. */
export function writeBytes(value: Uint8Array, out: DataViewWriter): void {
  writeVarint(value.length, out);
  out.writeBytes(value);
}

/** Read a length-prefixed byte blob. */
export function readBytes(view: DataViewReader): Uint8Array {
  const length = readVarint(view);
  return view.readBytes(length);
}

// ---------------------------------------------------------------------------
// Block positions
// ---------------------------------------------------------------------------

/** Write an integer block position as three zig-zag varints. */
export function writeBlockPos(pos: BlockPos, out: DataViewWriter): void {
  writeZigZag(pos.x, out);
  writeZigZag(pos.y, out);
  writeZigZag(pos.z, out);
}

/** Read an integer block position. */
export function readBlockPos(view: DataViewReader): BlockPos {
  const x = readZigZag(view);
  const y = readZigZag(view);
  const z = readZigZag(view);
  return { x, y, z };
}

// ---------------------------------------------------------------------------
// ByteWriter / ByteReader
// ---------------------------------------------------------------------------

/** Growable little-endian byte sink. */
export class ByteWriter implements DataViewWriter {
  private buffer: Uint8Array;
  private view: DataView;
  private offset = 0;

  constructor(initialCapacity = 256) {
    const cap = Math.max(8, initialCapacity | 0);
    this.buffer = new Uint8Array(cap);
    this.view = new DataView(this.buffer.buffer);
  }

  /** The bytes written so far (a view, not a copy). */
  get bytes(): Uint8Array {
    return this.buffer.subarray(0, this.offset);
  }

  /** Number of bytes written so far. */
  get length(): number {
    return this.offset;
  }

  private ensure(extra: number): void {
    const needed = this.offset + extra;
    if (needed <= this.buffer.length) return;
    let cap = this.buffer.length;
    while (cap < needed) cap *= 2;
    const next = new Uint8Array(cap);
    next.set(this.buffer.subarray(0, this.offset));
    this.buffer = next;
    this.view = new DataView(next.buffer);
  }

  writeUint8(value: number): void {
    this.ensure(1);
    this.view.setUint8(this.offset, value & 0xff);
    this.offset += 1;
  }

  writeBytes(bytes: Uint8Array): void {
    this.ensure(bytes.length);
    this.buffer.set(bytes, this.offset);
    this.offset += bytes.length;
  }

  writeVarint(value: number): void {
    writeVarint(value, this);
  }

  writeZigZag(value: number): void {
    writeZigZag(value, this);
  }

  writeBool(value: boolean): void {
    writeBool(value, this);
  }

  writeInt32(value: number): void {
    writeInt32(value, this);
  }

  writeFloat32(value: number): void {
    writeFloat32(value, this);
  }

  writeString(value: string): void {
    writeString(value, this);
  }

  writeBlockPos(pos: BlockPos): void {
    writeBlockPos(pos, this);
  }
}

/** Cursor-based reader over a byte buffer. */
export class ByteReader implements DataViewReader {
  private readonly data: Uint8Array;
  private readonly view: DataView;
  private cursor = 0;

  constructor(data: Uint8Array) {
    this.data = data;
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  }

  /** The underlying buffer. */
  get bytes(): Uint8Array {
    return this.data;
  }

  /** Current read position. */
  get offset(): number {
    return this.cursor;
  }

  /** Bytes left to read. */
  get remaining(): number {
    return this.data.length - this.cursor;
  }

  readUint8(): number {
    if (this.remaining < 1) throw new Error('codec: unexpected end of buffer');
    const value = this.view.getUint8(this.cursor);
    this.cursor += 1;
    return value;
  }

  readBytes(length: number): Uint8Array {
    if (length < 0 || this.remaining < length) throw new Error('codec: unexpected end of buffer');
    const slice = this.data.subarray(this.cursor, this.cursor + length);
    this.cursor += length;
    return slice;
  }

  readVarint(): number {
    return readVarint(this);
  }

  readZigZag(): number {
    return readZigZag(this);
  }

  readBool(): boolean {
    return readBool(this);
  }

  readInt32(): number {
    return readInt32(this);
  }

  readFloat32(): number {
    return readFloat32(this);
  }

  readString(): string {
    return readString(this);
  }

  readBlockPos(): BlockPos {
    return readBlockPos(this);
  }
}

// ---------------------------------------------------------------------------
// Convenience wrappers
// ---------------------------------------------------------------------------

/** Encode a single varint to its own byte array. */
export function encodeVarintNumber(value: number): Uint8Array {
  const w = new ByteWriter(10);
  w.writeVarint(value);
  return w.bytes.slice();
}

/** Decode a single varint from a byte array. */
export function decodeVarintNumber(bytes: Uint8Array): number {
  return readVarint(new ByteReader(bytes));
}

// ---------------------------------------------------------------------------
// CRC-32 (IEEE 802.3, reflected) — detects desynced chunk payloads
// ---------------------------------------------------------------------------

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

/**
 * Standard table-driven CRC-32.  `crc32("123456789") === 0xCBF43926`.
 */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ---------------------------------------------------------------------------
// Run-length encoding of block ids
// ---------------------------------------------------------------------------

export interface RleData {
  /** Distinct block ids, in first-appearance order. */
  palette: number[];
  /** Flat `[runLength, paletteIndex, runLength, paletteIndex, ...]`. */
  runs: number[];
}

/**
 * Encode a block-id array as palette + run lengths.
 *
 * The engine stores a section as 4096 block ids; runs of identical ids
 * collapse to a single entry, which is what makes a chunk cheap to send.
 */
export function rleEncode(values: Uint16Array): RleData {
  const palette: number[] = [];
  const paletteIndex = new Map<number, number>();
  const runs: number[] = [];

  let current = 0;
  let length = 0;
  let started = false;

  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (started && value === current) {
      length += 1;
      continue;
    }
    if (started) {
      runs.push(length, paletteIndex.get(current) as number);
    }
    let index = paletteIndex.get(value);
    if (index === undefined) {
      index = palette.length;
      palette.push(value);
      paletteIndex.set(value, index);
    }
    current = value;
    length = 1;
    started = true;
  }
  if (started) runs.push(length, paletteIndex.get(current) as number);

  return { palette, runs };
}

/** Decode palette + runs back into the original block-id array. */
export function rleDecode(palette: number[], runs: number[]): Uint16Array {
  if (runs.length % 2 !== 0) {
    throw new Error('codec: run list must contain length/index pairs');
  }
  let total = 0;
  for (let i = 0; i < runs.length; i += 2) total += runs[i];
  const out = new Uint16Array(total);
  let cursor = 0;
  for (let i = 0; i < runs.length; i += 2) {
    const length = runs[i];
    const blockId = palette[runs[i + 1]];
    if (blockId === undefined) throw new Error('codec: palette index out of range');
    out.fill(blockId, cursor, cursor + length);
    cursor += length;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Chunk / section codec
// ---------------------------------------------------------------------------

/** One 16-block-tall slice of a chunk column. */
export interface SectionPayload {
  /** Section index within the column (0 = bottom). */
  sy: number;
  /** Palette of numeric block ids used in this section. */
  palette: number[];
  /** Flat `[runLength, paletteIndex, ...]` covering all 4096 blocks. */
  runs: number[];
  /** Optional packed light data (opaque, engine-defined). */
  light?: Uint8Array;
}

/** A full chunk column as it travels over the wire. */
export interface ChunkPayload {
  cx: number;
  cz: number;
  dimension: string;
  sections: SectionPayload[];
}

/** Encode a single section (so a 1-block edit only re-encodes one section). */
export function encodeSection(section: SectionPayload): Uint8Array {
  const w = new ByteWriter(256);
  w.writeZigZag(section.sy);
  w.writeVarint(section.palette.length);
  for (const id of section.palette) w.writeVarint(id);
  w.writeVarint(section.runs.length);
  for (const run of section.runs) w.writeVarint(run);
  w.writeBool(section.light !== undefined);
  if (section.light) {
    w.writeVarint(section.light.length);
    w.writeBytes(section.light);
  }
  return w.bytes.slice();
}

/** Decode a single section. */
export function decodeSection(bytes: Uint8Array): SectionPayload {
  const r = new ByteReader(bytes);
  const sy = r.readZigZag();
  const paletteLength = r.readVarint();
  const palette: number[] = [];
  for (let i = 0; i < paletteLength; i++) palette.push(r.readVarint());
  const runsLength = r.readVarint();
  const runs: number[] = [];
  for (let i = 0; i < runsLength; i++) runs.push(r.readVarint());
  const hasLight = r.readBool();
  const light = hasLight ? r.readBytes(r.readVarint()) : undefined;
  const section: SectionPayload = { sy, palette, runs };
  if (light) section.light = light;
  return section;
}

/**
 * Encode a chunk column.
 *
 * Layout: `cx cz dimension sectionCount [sectionLen section]* crc32`.
 * The trailing CRC-32 lets the receiver detect a desynced chunk before the
 * world data is applied.
 */
export function encodeChunk(payload: ChunkPayload): Uint8Array {
  const w = new ByteWriter(4096);
  w.writeZigZag(payload.cx);
  w.writeZigZag(payload.cz);
  w.writeString(payload.dimension);
  w.writeVarint(payload.sections.length);
  for (const section of payload.sections) {
    const blob = encodeSection(section);
    w.writeVarint(blob.length);
    w.writeBytes(blob);
  }
  const body = w.bytes;
  const out = new Uint8Array(body.length + 4);
  out.set(body, 0);
  new DataView(out.buffer).setUint32(body.length, crc32(body), true);
  return out;
}

/** Decode a chunk column, verifying the CRC-32 trailer. */
export function decodeChunk(bytes: Uint8Array): ChunkPayload {
  const r = new ByteReader(bytes);
  const cx = r.readZigZag();
  const cz = r.readZigZag();
  const dimension = r.readString();
  const sectionCount = r.readVarint();
  const sections: SectionPayload[] = [];
  for (let i = 0; i < sectionCount; i++) {
    const length = r.readVarint();
    sections.push(decodeSection(r.readBytes(length)));
  }
  const bodyLength = r.offset;
  if (r.remaining < 4) throw new Error('codec: chunk is missing its CRC-32 trailer');
  const expected = new DataView(
    bytes.buffer,
    bytes.byteOffset + bodyLength,
    4,
  ).getUint32(0, true);
  const actual = crc32(bytes.subarray(0, bodyLength));
  if (expected !== actual) {
    throw new Error(
      `codec: chunk CRC mismatch (expected 0x${expected.toString(16)}, got 0x${actual.toString(16)})`,
    );
  }
  return { cx, cz, dimension, sections };
}
