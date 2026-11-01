import { describe, expect, it } from 'vitest';

import { generateChunk } from '../src/worldgen/generator';
import { convertGeneratedChunk } from '../src/engine/world/chunkManager';
import { Chunk } from '../src/engine/voxel/chunk';
import { initContent, blocks } from '../src/content';
import { MeshBuilder } from '../src/workers/mesher';
import { EMPTY_PROFILE, type BlockProfile } from '../src/engine/voxel/profiles';
import { CHUNK_X, CHUNK_Z } from '../src/core/types';

initContent();

function buildProfiles(): BlockProfile[] {
  const ids = ['air'];
  for (const block of blocks.all()) if (block.id !== 'air') ids.push(block.id);
  const index = new Map(ids.map((id, i) => [id, i]));
  const list: BlockProfile[] = new Array(ids.length);

  for (const block of blocks.all()) {
    const id = index.get(block.id)!;
    const isAir = block.id === 'air';
    list[id] = {
      id,
      name: block.id,
      render: isAir ? 'none' : block.render,
      shape: isAir ? 'empty' : block.shape,
      emission: block.lightEmission,
      transparent: isAir ? true : block.transparent,
      opaque: isAir ? false : !block.transparent && !block.liquid && block.shape === 'cube',
      liquid: block.liquid,
      slab: block.slabShape,
      axis: block.axis,
      layer: { top: 0, side: 0, bottom: 0, front: 0 },
      hardness: block.hardness,
      tool: block.tool,
      tier: block.requiresToolTier,
      flammable: block.flammable,
      correctToolDrops: block.correctToolDrops,
      tags: block.tags,
    };
  }
  list[0] = EMPTY_PROFILE;
  return list;
}

describe('the full world pipeline', () => {
  const seed = 20261101;
  const profiles = buildProfiles();
  const lookup = {
    id: (name: string) => {
      const index = profiles.findIndex((p) => p.name === name);
      return index < 0 ? 0 : index;
    },
  };

  it('meshes a generated chunk into a sane number of quads', () => {
    const generated = generateChunk(seed, 0, 0, 'overworld');
    const blocksArray = convertGeneratedChunk(generated.blocks, lookup);

    const builder = new MeshBuilder(profiles);
    builder.setChunk(0, 0, blocksArray);
    const groups = builder.build(0, 0, true, true);

    const solid = groups.find((g) => g.group === 'solid');
    expect(solid).toBeDefined();
    const quads = solid!.indices.length / 6;

    // A 16x16 chunk of terrain should need a few thousand quads at most. If
    // this explodes, the block profiles are not culling interior faces.
    expect(quads).toBeLessThan(8000);

    // And it should not be a handful either — that would mean nothing is
    // being drawn.
    expect(quads).toBeGreaterThan(50);
  });

  it('produces a chunk whose geometry matches its own height map', () => {
    const generated = generateChunk(seed, 0, 0, 'overworld');
    const blocksArray = convertGeneratedChunk(generated.blocks, lookup);
    const chunk = new Chunk(0, 0);
    chunk.fromBlockArray(blocksArray, generated.heightMap);

    // The height map says where the ground is; the block data must agree.
    let mismatches = 0;
    for (let lx = 0; lx < CHUNK_X; lx++) {
      for (let lz = 0; lz < CHUNK_Z; lz++) {
        const h = chunk.heightMap[lx * CHUNK_Z + lz];
        if (h <= 0) continue;
        if (chunk.getBlock(lx, h, lz) === 0) mismatches++;
      }
    }
    expect(mismatches).toBeLessThan(20);
  });
});

describe('pipeline diagnostics', () => {
  it('reports the light distribution', () => {
    const seed = 20261101;
    const profiles = buildProfiles();
    const lookup = {
      id: (name: string) => {
        const index = profiles.findIndex((p) => p.name === name);
        return index < 0 ? 0 : index;
      },
    };
    const generated = generateChunk(seed, 0, 0, 'overworld');
    const blocksArray = convertGeneratedChunk(generated.blocks, lookup);
    const builder = new MeshBuilder(profiles);
    builder.setChunk(0, 0, blocksArray);
    const groups = builder.build(0, 0, true, true);
    const solid = groups.find((g) => g.group === 'solid')!;
    const quads = solid.indices.length / 6;
    let lit = 0;
    let dark = 0;
    let maxSky = 0;
    for (let i = 1; i < solid.data.length; i += 4) {
      if (solid.data[i] > 0) lit++;
      else dark++;
      maxSky = Math.max(maxSky, solid.data[i]);
    }
    console.log(`quads=${quads} verts=${solid.positions.length / 3} litVerts=${lit} darkVerts=${dark} maxSky=${maxSky}`);
    expect(quads).toBeGreaterThan(0);
  });
});
