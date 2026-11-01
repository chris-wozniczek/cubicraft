import { describe, expect, it } from 'vitest';

import { generateChunk } from '../src/worldgen/generator';
import { Chunk } from '../src/engine/voxel/chunk';
import { CHUNK_X, CHUNK_Y, CHUNK_Z, SECTION_COUNT, SECTION_VOLUME, WORLD_MIN_Y } from '../src/core/types';

/** A lookup that assigns ids on first sight, the way the content registry does. */
function makeLookup() {
  const ids = new Map<string, number>([['air', 0]]);
  return {
    ids,
    lookup: {
      name: (id: number) => [...ids.entries()].find(([, v]) => v === id)?.[0] ?? 'air',
      id: (name: string) => {
        let id = ids.get(name);
        if (id === undefined) {
          id = ids.size;
          ids.set(name, id);
        }
        return id;
      },
      has: (name: string) => ids.has(name),
      get count() {
        return ids.size;
      },
    },
  };
}

describe('world generation into the voxel engine', () => {
  const seed = 424242;
  const { lookup } = makeLookup();

  it('produces a chunk with the expected shape', () => {
    const chunk = generateChunk(seed, 0, 0, 'overworld');
    expect(chunk.blocks.length).toBe(CHUNK_X * CHUNK_Y * CHUNK_Z);
    expect(chunk.biomes.length).toBeGreaterThan(0);
    expect(chunk.heightMap.length).toBe(CHUNK_X * CHUNK_Z);
  });

  it('is deterministic for the same seed', () => {
    const a = generateChunk(seed, 3, -2, 'overworld');
    const b = generateChunk(seed, 3, -2, 'overworld');
    expect(a.blocks[5000]).toBe(b.blocks[5000]);
    expect(a.blocks[40000]).toBe(b.blocks[40000]);
    expect(a.heightMap[100]).toBe(b.heightMap[100]);
  });

  it('produces different terrain for different seeds', () => {
    const a = generateChunk(seed, 5, 5, 'overworld');
    const b = generateChunk(seed + 1, 5, 5, 'overworld');
    const differing = a.blocks.some((block, i) => block !== b.blocks[i]);
    expect(differing).toBe(true);
  });

  it('converts cleanly into a chunk of the engine', () => {
    const generated = generateChunk(seed, 0, 0, 'overworld');
    const blocks = new Uint16Array(SECTION_COUNT * SECTION_VOLUME);
    for (let i = 0; i < generated.blocks.length; i++) {
      blocks[i] = lookup.id(generated.blocks[i]);
    }

    const chunk = new Chunk(0, 0);
    chunk.fromBlockArray(blocks);

    // The terrain must be solid somewhere and empty in the sky.
    let solid = 0;
    for (let x = 0; x < CHUNK_X; x++) {
      for (let z = 0; z < CHUNK_Z; z++) {
        const height = chunk.heightMap[x * CHUNK_Z + z];
        expect(height).toBeGreaterThan(WORLD_MIN_Y);
        expect(height).toBeLessThan(WORLD_MAX_Y_TEST);
        solid++;
        // Above the surface must be air.
        expect(chunk.getBlock(x, height + 1, z)).toBe(0);
        // Just below the surface must be solid.
        expect(chunk.getBlock(x, height, z)).not.toBe(0);
      }
    }
    expect(solid).toBe(CHUNK_X * CHUNK_Z);
  });

  it('uses more than one kind of block', () => {
    const generated = generateChunk(seed, 1, 1, 'overworld');
    const kinds = new Set(generated.blocks.filter((b) => b && b !== 'air'));
    expect(kinds.size).toBeGreaterThan(2);
  });
});

const WORLD_MAX_Y_TEST = 320;
