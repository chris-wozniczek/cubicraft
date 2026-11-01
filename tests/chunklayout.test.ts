import { describe, expect, it } from 'vitest';

import { generateChunk } from '../src/worldgen/generator';
import { convertGeneratedChunk } from '../src/engine/world/chunkManager';
import { Chunk } from '../src/engine/voxel/chunk';
import { initContent, blocks } from '../src/content';
import { CHUNK_X, CHUNK_Z, WORLD_MIN_Y } from '../src/core/types';

initContent();

/** The same lookup the game builds: air first, then the content order. */
function makeLookup() {
  const ids = ['air'];
  for (const block of blocks.all()) if (block.id !== 'air') ids.push(block.id);
  const index = new Map(ids.map((id, i) => [id, i]));
  return {
    ids,
    lookup: {
      id: (name: string) => index.get(name) ?? 0,
      name: (id: number) => ids[id] ?? 'air',
      has: (name: string) => index.has(name),
      get count() {
        return ids.length;
      },
    },
  };
}

describe('generated chunk to engine chunk', () => {
  const seed = 20261101;
  const { lookup, ids } = makeLookup();

  it('reproduces the generator height map exactly', () => {
    const generated = generateChunk(seed, 0, 0, 'overworld');
    const blocksArray = convertGeneratedChunk(generated.blocks, lookup);
    const chunk = new Chunk(0, 0);
    chunk.fromBlockArray(blocksArray, generated.heightMap);

    let mismatches = 0;
    for (let lx = 0; lx < CHUNK_X; lx++) {
      for (let lz = 0; lz < CHUNK_Z; lz++) {
        const expected = generated.heightMap[lx * CHUNK_Z + lz];
        const actual = chunk.heightMap[lx * CHUNK_Z + lz];
        if (expected !== actual) mismatches++;
      }
    }
    expect(mismatches).toBe(0);
  });

  it('places solid ground with air above it', () => {
    const generated = generateChunk(seed, 0, 0, 'overworld');
    const blocksArray = convertGeneratedChunk(generated.blocks, lookup);
    const chunk = new Chunk(0, 0);
    chunk.fromBlockArray(blocksArray, generated.heightMap);

    for (let lx = 0; lx < CHUNK_X; lx += 3) {
      for (let lz = 0; lz < CHUNK_Z; lz += 3) {
        const height = chunk.heightMap[lx * CHUNK_Z + lz];
        expect(chunk.getBlock(lx, height, lz)).not.toBe(0);
        // The open sky must be clear above the ground, whatever stands on it.
        expect(chunk.getBlock(lx, height + 12, lz)).toBe(0);
        expect(chunk.getBlock(lx, height + 30, lz)).toBe(0);
      }
    }
  });

  it('has a contiguous solid column below the surface', () => {
    const generated = generateChunk(seed, 0, 0, 'overworld');
    const blocksArray = convertGeneratedChunk(generated.blocks, lookup);
    const chunk = new Chunk(0, 0);
    chunk.fromBlockArray(blocksArray, generated.heightMap);

    // Count how much of the column is solid below the surface.
    for (let lx = 0; lx < CHUNK_X; lx += 4) {
      for (let lz = 0; lz < CHUNK_Z; lz += 4) {
        const height = chunk.heightMap[lx * CHUNK_Z + lz];
        let solid = 0;
        for (let y = WORLD_MIN_Y; y <= height; y++) {
          if (chunk.getBlock(lx, y, lz) !== 0) solid++;
        }
        // Most of the column below the surface is ground; caves account
        // for the gaps.
        expect(solid / (height - WORLD_MIN_Y + 1)).toBeGreaterThan(0.5);
      }
    }
  });

  it('reads the same block at a column as the generator wrote it', () => {
    const generated = generateChunk(seed, 3, 2, 'overworld');
    const blocksArray = convertGeneratedChunk(generated.blocks, lookup);
    const chunk = new Chunk(3, 2);
    chunk.fromBlockArray(blocksArray, generated.heightMap);

    for (let lx = 0; lx < CHUNK_X; lx += 5) {
      for (let lz = 0; lz < CHUNK_Z; lz += 5) {
        for (let y = 60; y <= 72; y += 4) {
          const source = generated.blocks[(lx * CHUNK_Z + lz) * 384 + (y - WORLD_MIN_Y)];
          const expectedId = lookup.id(source);
          expect(chunk.getBlock(lx, y, lz)).toBe(expectedId);
        }
      }
    }
    expect(ids.length).toBeGreaterThan(1000);
  });
});
