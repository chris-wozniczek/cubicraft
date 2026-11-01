import { describe, expect, it } from 'vitest';
import {
  ByteReader,
  ByteWriter,
  crc32,
  decodeChunk,
  decodeSection,
  decodeVarintNumber,
  encodeChunk,
  encodeSection,
  encodeVarintNumber,
  readBlockPos,
  readVarint,
  readZigZag,
  rleDecode,
  rleEncode,
  writeBlockPos,
  writeVarint,
  writeZigZag,
  type ChunkPayload,
  type SectionPayload,
} from '../src/net/codec';
import { SeededRng } from '../src/core/rng';

const SECTION_VOLUME = 4096;

function varintRoundTrip(value: number): number {
  const writer = new ByteWriter(16);
  writeVarint(value, writer);
  return readVarint(new ByteReader(writer.bytes));
}

function zigzagRoundTrip(value: number): number {
  const writer = new ByteWriter(16);
  writeZigZag(value, writer);
  return readZigZag(new ByteReader(writer.bytes));
}

describe('varint', () => {
  it('round-trips the documented boundary values', () => {
    const values = [
      0, 1, 127, 128, 16383, 16384, 2 ** 21 - 1, 2 ** 21, 2 ** 28, 2 ** 31 - 1,
    ];
    for (const value of values) {
      expect(varintRoundTrip(value)).toBe(value);
    }
  });

  it('round-trips values above 2^31 (a 32-bit shift would corrupt them)', () => {
    expect(varintRoundTrip(2 ** 32)).toBe(2 ** 32);
    expect(varintRoundTrip(2 ** 40)).toBe(2 ** 40);
  });

  it('uses one byte for small values and grows from there', () => {
    expect(encodeVarintNumber(0).length).toBe(1);
    expect(encodeVarintNumber(127).length).toBe(1);
    expect(encodeVarintNumber(128).length).toBe(2);
    expect(encodeVarintNumber(16384).length).toBe(3);
  });

  it('rejects negative and non-finite values', () => {
    expect(() => writeVarint(-1, new ByteWriter())).toThrow(RangeError);
    expect(() => writeVarint(Number.NaN, new ByteWriter())).toThrow(RangeError);
  });

  it('decodes a standalone varint buffer', () => {
    expect(decodeVarintNumber(encodeVarintNumber(300))).toBe(300);
  });
});

describe('zig-zag', () => {
  it('round-trips negative values', () => {
    for (const value of [-1, -2, -100, -123456789, -(2 ** 20), -(2 ** 30)]) {
      expect(zigzagRoundTrip(value)).toBe(value);
    }
  });

  it('round-trips positive values', () => {
    for (const value of [0, 1, 2, 100, 123456789, 2 ** 30]) {
      expect(zigzagRoundTrip(value)).toBe(value);
    }
  });

  // Regression: the first implementation used `u >> 1`, which is a *signed*
  // 32-bit shift in JavaScript.  It silently corrupts anything beyond 2^30.
  it('REGRESSION: does not use a signed 32-bit shift when decoding', () => {
    expect(readZigZag(new ByteReader(encodeZigZagBytes(-123456789)))).toBe(-123456789);

    // A value just below 2^30: `u >> 1` rounds towards negative infinity.
    const nearLimit = 2 ** 30 - 1;
    expect(readZigZag(new ByteReader(encodeZigZagBytes(nearLimit)))).toBe(nearLimit);
    expect(readZigZag(new ByteReader(encodeZigZagBytes(-nearLimit)))).toBe(-nearLimit);

    // A value exactly at 2^30: the zig-zag value is 2^31, which overflows the
    // signed 32-bit range and flips the sign under `>>`.
    const atLimit = 2 ** 30;
    expect(readZigZag(new ByteReader(encodeZigZagBytes(atLimit)))).toBe(atLimit);
    expect(readZigZag(new ByteReader(encodeZigZagBytes(-atLimit)))).toBe(-atLimit);
  });

  it('REGRESSION: the buggy shift really would have failed these values', () => {
    const buggy = (u: number): number => (u & 1 ? -(u >> 1) - 1 : u >> 1);
    const atLimit = 2 ** 30;
    const encoded = readVarint(new ByteReader(encodeZigZagBytes(atLimit)));
    expect(buggy(encoded)).not.toBe(atLimit);
    expect(buggy(encoded)).toBeLessThan(0);
  });
});

function encodeZigZagBytes(value: number): Uint8Array {
  const writer = new ByteWriter(16);
  writeZigZag(value, writer);
  return writer.bytes;
}

describe('ByteWriter / ByteReader', () => {
  it('grows past its initial capacity', () => {
    const writer = new ByteWriter(4);
    for (let i = 0; i < 1000; i++) writer.writeUint8(i & 0xff);
    expect(writer.length).toBe(1000);
    const reader = new ByteReader(writer.bytes);
    expect(reader.remaining).toBe(1000);
    expect(reader.readUint8()).toBe(0);
    expect(reader.remaining).toBe(999);
  });

  it('round-trips block positions', () => {
    const writer = new ByteWriter(16);
    writeBlockPos({ x: -1024, y: -64, z: 4096 }, writer);
    const pos = readBlockPos(new ByteReader(writer.bytes));
    expect(pos).toEqual({ x: -1024, y: -64, z: 4096 });
  });
});

describe('rle', () => {
  const rng = new SeededRng('rle-test');

  it('round-trips an all-same section', () => {
    const values = new Uint16Array(SECTION_VOLUME).fill(7);
    const { palette, runs } = rleEncode(values);
    expect(palette).toEqual([7]);
    expect(runs).toEqual([SECTION_VOLUME, 0]);
    expect(Array.from(rleDecode(palette, runs))).toEqual(Array.from(values));
  });

  it('round-trips random values', () => {
    const values = new Uint16Array(SECTION_VOLUME);
    for (let i = 0; i < values.length; i++) values[i] = rng.int(0, 40);
    const { palette, runs } = rleEncode(values);
    expect(Array.from(rleDecode(palette, runs))).toEqual(Array.from(values));
  });

  it('round-trips alternating values', () => {
    const values = new Uint16Array(SECTION_VOLUME);
    for (let i = 0; i < values.length; i++) values[i] = i % 2 === 0 ? 1 : 2;
    const { palette, runs } = rleEncode(values);
    expect(Array.from(rleDecode(palette, runs))).toEqual(Array.from(values));
    // Two distinct values, but 4096 one-block runs.
    expect(palette.length).toBe(2);
    expect(runs.length).toBe(SECTION_VOLUME * 2);
  });

  it('round-trips sparse values', () => {
    const values = new Uint16Array(SECTION_VOLUME);
    for (let i = 0; i < values.length; i += 97) values[i] = rng.int(0, 300);
    const { palette, runs } = rleEncode(values);
    expect(Array.from(rleDecode(palette, runs))).toEqual(Array.from(values));
  });

  it('rejects a run list that points outside the palette', () => {
    expect(() => rleDecode([1, 2], [4, 5])).toThrow(/palette/);
  });

  it('rejects a run list with a missing length', () => {
    expect(() => rleDecode([1, 2], [4])).toThrow(/length\/index pairs/);
  });
});

describe('section codec', () => {
  it('round-trips a section', () => {
    const values = new Uint16Array(SECTION_VOLUME);
    for (let i = 0; i < values.length; i++) values[i] = i < 2048 ? 0 : 12;
    const { palette, runs } = rleEncode(values);
    const section: SectionPayload = { sy: 3, palette, runs };
    const decoded = decodeSection(encodeSection(section));
    expect(decoded.sy).toBe(3);
    expect(decoded.palette).toEqual(palette);
    expect(decoded.runs).toEqual(runs);
    expect(decoded.light).toBeUndefined();
  });

  it('keeps optional light data', () => {
    const section: SectionPayload = {
      sy: 0,
      palette: [1],
      runs: [SECTION_VOLUME, 0],
      light: new Uint8Array([1, 2, 3, 4]),
    };
    const decoded = decodeSection(encodeSection(section));
    expect(Array.from(decoded.light ?? [])).toEqual([1, 2, 3, 4]);
  });
});

describe('chunk codec', () => {
  const rng = new SeededRng('chunk-test');

  function buildChunk(sectionCount = 16): ChunkPayload {
    const sections: SectionPayload[] = [];
    for (let sy = 0; sy < sectionCount; sy++) {
      const values = new Uint16Array(SECTION_VOLUME);
      for (let i = 0; i < values.length; i++) {
        values[i] = rng.chance(0.08) ? rng.int(1, 30) : 0;
      }
      const { palette, runs } = rleEncode(values);
      sections.push({ sy, palette, runs });
    }
    return { cx: -3, cz: 7, dimension: 'overworld', sections };
  }

  it('round-trips a whole chunk', () => {
    const chunk = buildChunk();
    const decoded = decodeChunk(encodeChunk(chunk));
    expect(decoded.cx).toBe(chunk.cx);
    expect(decoded.cz).toBe(chunk.cz);
    expect(decoded.dimension).toBe('overworld');
    expect(decoded.sections.length).toBe(chunk.sections.length);
    for (let i = 0; i < chunk.sections.length; i++) {
      expect(decoded.sections[i].sy).toBe(chunk.sections[i].sy);
      expect(decoded.sections[i].palette).toEqual(chunk.sections[i].palette);
      expect(decoded.sections[i].runs).toEqual(chunk.sections[i].runs);
    }
  });

  it('re-encodes exactly one section when a single block changes', () => {
    const chunk = buildChunk(16);
    const before = chunk.sections.map((section) => encodeSection(section));

    // Edit one block inside section 5.
    const target = 5;
    const values = rleDecode(chunk.sections[target].palette, chunk.sections[target].runs);
    values[123] = 999;
    const encoded = rleEncode(values);
    const edited = {
      ...chunk,
      sections: chunk.sections.map((section, index) =>
        index === target ? { ...section, palette: encoded.palette, runs: encoded.runs } : section,
      ),
    };
    const after = edited.sections.map((section) => encodeSection(section));

    let changed = 0;
    for (let i = 0; i < before.length; i++) {
      if (Array.from(before[i]).join() !== Array.from(after[i]).join()) changed += 1;
    }
    expect(changed).toBe(1);

    // And the edited chunk still round-trips.
    const decoded = decodeChunk(encodeChunk(edited));
    const decodedValues = rleDecode(
      decoded.sections[target].palette,
      decoded.sections[target].runs,
    );
    expect(decodedValues[123]).toBe(999);
  });

  it('detects a desynced chunk with the CRC-32 trailer', () => {
    const bytes = encodeChunk(buildChunk(4));
    // Corrupt the CRC trailer itself: the body still parses, the check fails.
    const corrupt = bytes.slice();
    corrupt[corrupt.length - 1] ^= 0xff;
    expect(() => decodeChunk(corrupt)).toThrow(/CRC/);
  });

  it('detects a desynced chunk body', () => {
    const bytes = encodeChunk(buildChunk(4));
    const corrupt = bytes.slice();
    corrupt[corrupt.length - 8] ^= 0xff;
    expect(() => decodeChunk(corrupt)).toThrow();
  });
});

describe('crc32', () => {
  it('matches the standard check vector', () => {
    const text = new TextEncoder().encode('123456789');
    expect(crc32(text)).toBe(0xcbf43926);
  });

  it('returns 0 for empty input', () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });
});
