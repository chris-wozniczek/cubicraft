import { describe, expect, it } from 'vitest';

import { generateChunk } from '../src/worldgen/generator';
import { convertGeneratedChunk } from '../src/engine/world/chunkManager';
import { initContent, blocks } from '../src/content';
import { MeshBuilder } from '../src/workers/mesher';
import { EMPTY_PROFILE, type BlockProfile } from '../src/engine/voxel/profiles';
import { CHUNK_X, CHUNK_Z } from '../src/core/types';

initContent();

function buildProfiles(): { ids: string[]; lookup: { id: (n: string) => number }; profiles: BlockProfile[] } {
  const ids = ['air'];
  for (const b of blocks.all()) if (b.id !== 'air') ids.push(b.id);
  const index = new Map(ids.map((id, i) => [id, i]));
  const profiles = ids.map((name, i) => {
    const b = blocks.get(name);
    const isAir = name === 'air';
    return {
      ...EMPTY_PROFILE,
      id: i,
      name,
      render: (isAir ? 'none' : b?.render ?? 'opaque') as BlockProfile['render'],
      shape: (isAir ? 'empty' : b?.shape ?? 'cube') as BlockProfile['shape'],
      emission: b?.lightEmission ?? 0,
      transparent: isAir ? true : (b?.transparent ?? false),
      opaque: isAir ? false : !(b?.transparent ?? false) && !(b?.liquid ?? false) && (b?.shape ?? 'cube') === 'cube',
      liquid: b?.liquid ?? false,
      slab: b?.slabShape ?? false,
      tool: (b?.tool ?? 'none') as BlockProfile['tool'],
      tier: (b?.requiresToolTier ?? 0) as BlockProfile['tier'],
      flammable: b?.flammable ?? false,
      correctToolDrops: b?.correctToolDrops ?? false,
      tags: b?.tags ?? [],
    };
  });
  return { ids, lookup: { id: (n: string) => index.get(n) ?? 0 }, profiles };
}

describe('top face coverage', () => {
  it('covers the columns of the surface', () => {
    const { lookup, profiles } = buildProfiles();
    const g = generateChunk(20261101, 0, 0, 'overworld');
    const arr = convertGeneratedChunk(g.blocks, lookup);

    const mb = new MeshBuilder(profiles);
    mb.setChunk(0, 0, arr);
    const groups = mb.build(0, 0, true, true);
    const solid = groups.find((x) => x.group === 'solid')!;

    const covered = new Set<string>();
    let upFaces = 0;
    for (let t = 0; t < solid.indices.length; t += 3) {
      const vi = solid.indices[t];
      if (solid.normals[vi * 3 + 1] > 0) {
        upFaces++;
        covered.add(`${Math.floor(solid.positions[vi * 3])},${Math.floor(solid.positions[vi * 3 + 2])}`);
      }
    }
    console.log(`upFaces=${upFaces} coveredColumns=${covered.size} of ${CHUNK_X * CHUNK_Z}`);
    expect(covered.size).toBeGreaterThan(CHUNK_X * CHUNK_Z * 0.5);
  });
});
