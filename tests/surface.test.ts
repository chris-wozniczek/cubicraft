import { describe, expect, it } from 'vitest';
import { generateChunk } from '../src/worldgen/generator';
import { convertGeneratedChunk } from '../src/engine/world/chunkManager';
import { Chunk } from '../src/engine/voxel/chunk';
import { initContent, blocks } from '../src/content';
import { CHUNK_X, CHUNK_Z } from '../src/core/types';

initContent();

describe('surface integrity', () => {
  it('counts holes in the ground surface', () => {
    const ids = ['air'];
    for (const b of blocks.all()) if (b.id !== 'air') ids.push(b.id);
    const index = new Map(ids.map((id, i) => [id, i]));
    const lookup = { id: (n: string) => index.get(n) ?? 0 };

    let holes = 0;
    let columns = 0;
    const names = new Map<string, number>();
    for (let cx = -2; cx <= 2; cx++) {
      for (let cz = -2; cz <= 2; cz++) {
        const generated = generateChunk(20261101, cx, cz, 'overworld');
        const arr = convertGeneratedChunk(generated.blocks, lookup);
        const chunk = new Chunk(cx, cz);
        chunk.fromBlockArray(arr, generated.heightMap);
        for (let lx = 0; lx < CHUNK_X; lx++) {
          for (let lz = 0; lz < CHUNK_Z; lz++) {
            const h = chunk.heightMap[lx * CHUNK_Z + lz];
            if (h <= 0) continue;
            columns++;
            const above = chunk.getBlock(lx, h + 1, lz);
            if (above === 0) holes++;
            else {
              const name = ids[above];
              names.set(name, (names.get(name) ?? 0) + 1);
            }
          }
        }
      }
    }
    const top = [...names.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    console.log(`columns=${columns} holes=${holes} (${((holes / columns) * 100).toFixed(1)}%) topBlocks=${top.map(([n, c]) => `${n}:${c}`).join(' ')}`);
    expect(columns).toBeGreaterThan(0);
  });
});
