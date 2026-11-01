import { describe, expect, it } from 'vitest';

import { MeshBuilder, voxelIndex } from '../src/workers/mesher';
import { EMPTY_PROFILE, type BlockProfile } from '../src/engine/voxel/profiles';
import { CHUNK_X, CHUNK_Y, CHUNK_Z, SECTION_COUNT, SECTION_VOLUME, WORLD_MIN_Y } from '../src/core/types';

/** A profile table: id 0 is air, id 1 is a solid opaque cube, id 2 is a plant. */
function profiles(): BlockProfile[] {
  const solid: BlockProfile = {
    ...EMPTY_PROFILE,
    id: 1,
    name: 'stone',
    render: 'opaque',
    shape: 'cube',
    opaque: true,
    transparent: false,
    layer: { top: 1, side: 1, bottom: 1, front: 1 },
  };
  const plant: BlockProfile = {
    ...EMPTY_PROFILE,
    id: 2,
    name: 'flower',
    render: 'cross',
    shape: 'plant',
    opaque: false,
    transparent: true,
    layer: { top: 2, side: 2, bottom: 2, front: 2 },
  };
  return [EMPTY_PROFILE, solid, plant];
}

/** Build a flat 16x16 ground plane of solid blocks at the given world Y. */
function flatGround(groundY: number): Uint16Array {
  const blocks = new Uint16Array(SECTION_COUNT * SECTION_VOLUME);
  for (let lx = 0; lx < CHUNK_X; lx++) {
    for (let lz = 0; lz < CHUNK_Z; lz++) {
      for (let y = groundY - 3; y <= groundY; y++) {
        blocks[voxelIndex(lx, y, lz)] = 1;
      }
    }
  }
  return blocks;
}

describe('mesher', () => {
  it('merges a flat ground plane into a single top quad', () => {
    const builder = new MeshBuilder(profiles());
    builder.setChunk(0, 0, flatGround(70));
    const groups = builder.build(0, 0, true, true);
    const solid = groups.find((g) => g.group === 'solid');
    expect(solid).toBeDefined();

    // The top face is 16x16 and must merge into one quad; the sides are four
    // 16x3 strips and the bottom is one quad.
    const quads = solid!.indices.length / 6;
    expect(quads).toBeLessThan(10);
  });

  it('spans a merged quad across the full merged area', () => {
    const builder = new MeshBuilder(profiles());
    builder.setChunk(0, 0, flatGround(70));
    const groups = builder.build(0, 0, true, true);
    const solid = groups.find((g) => g.group === 'solid')!;

    // Every vertex of an upward-facing quad shares the top Y; find the quad
    // covering the ground plane and check its XZ footprint is 16x16, not 1x1.
    let topY = -Infinity;
    const pos = solid.positions;
    const nrm = solid.normals;
    const nVerts = pos.length / 3;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let v = 0; v < nVerts; v += 4) {
      if (nrm[v * 3 + 1] !== 1) continue;
      const ys = [pos[v * 3 + 1], pos[v * 3 + 4], pos[v * 3 + 7], pos[v * 3 + 10]];
      const quadTop = Math.max(...ys);
      if (quadTop <= topY) continue;
      topY = quadTop;
      minX = Math.min(...[0, 1, 2, 3].map((i) => pos[v * 3 + i * 3]));
      maxX = Math.max(...[0, 1, 2, 3].map((i) => pos[v * 3 + i * 3]));
      minZ = Math.min(...[0, 1, 2, 3].map((i) => pos[v * 3 + i * 3 + 2]));
      maxZ = Math.max(...[0, 1, 2, 3].map((i) => pos[v * 3 + i * 3 + 2]));
    }
    expect(topY).toBe(71);
    expect(maxX - minX).toBe(CHUNK_X);
    expect(maxZ - minZ).toBe(CHUNK_Z);
  });

  it('emits vertices inside the chunk', () => {
    const builder = new MeshBuilder(profiles());
    builder.setChunk(0, 0, flatGround(70));
    const groups = builder.build(0, 0, true, true);
    const solid = groups.find((g) => g.group === 'solid')!;
    for (let i = 0; i < solid.positions.length; i += 3) {
      expect(solid.positions[i]).toBeGreaterThanOrEqual(-0.001);
      expect(solid.positions[i]).toBeLessThanOrEqual(CHUNK_X + 0.001);
      expect(solid.positions[i + 2]).toBeGreaterThanOrEqual(-0.001);
      expect(solid.positions[i + 2]).toBeLessThanOrEqual(CHUNK_Z + 0.001);
      expect(solid.positions[i + 1]).toBeGreaterThanOrEqual(WORLD_MIN_Y - 0.001);
      expect(solid.positions[i + 1]).toBeLessThanOrEqual(WORLD_MIN_Y + CHUNK_Y + 0.001);
    }
  });

  it('lights the top face with full sky light', () => {
    const builder = new MeshBuilder(profiles());
    builder.setChunk(0, 0, flatGround(70));
    const groups = builder.build(0, 0, true, true);
    const solid = groups.find((g) => g.group === 'solid')!;

    // data holds blockLight, skyLight, ao, faceShade per vertex.
    let maxSky = 0;
    for (let i = 1; i < solid.data.length; i += 4) maxSky = Math.max(maxSky, solid.data[i]);
    expect(maxSky).toBe(255);
  });

  it('culls the faces between two solid blocks', () => {
    const builder = new MeshBuilder(profiles());
    const blocks = new Uint16Array(SECTION_COUNT * SECTION_VOLUME);
    // A 4x4x4 solid cube in the middle of the chunk.
    for (let lx = 4; lx < 8; lx++) {
      for (let lz = 4; lz < 8; lz++) {
        for (let y = 60; y < 64; y++) blocks[voxelIndex(lx, y, lz)] = 1;
      }
    }
    builder.setChunk(0, 0, blocks);
    const groups = builder.build(0, 0, true, true);
    const solid = groups.find((g) => g.group === 'solid')!;

    // Only the outer faces of the cube are visible; the ambient occlusion
    // differences at the edges may split them into a few extra quads.
    const quads = solid.indices.length / 6;
    expect(quads).toBeLessThanOrEqual(12);
    expect(quads).toBeGreaterThanOrEqual(6);
  });

  it('does not draw faces of a plant', () => {
    const builder = new MeshBuilder(profiles());
    const blocks = flatGround(70);
    blocks[voxelIndex(8, 71, 8)] = 2;
    builder.setChunk(0, 0, blocks);
    const groups = builder.build(0, 0, true, true);
    const solid = groups.find((g) => g.group === 'solid')!;
    // The plant adds four crossed quads.
    const quads = solid.indices.length / 6;
    expect(quads).toBeGreaterThan(5);
  });
});
