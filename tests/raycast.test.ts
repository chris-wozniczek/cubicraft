import { describe, expect, it } from 'vitest';

import { directionFromAngles, raycastVoxel, normalizeDir } from '../src/engine/voxel/raycast';

/** A tiny solid world: everything at or below y = 0 is solid. */
function floorWorld() {
  return (x: number, y: number, z: number) => y <= 0;
}

describe('DDA voxel raycasting', () => {
  it('hits a straight line along +X', () => {
    const hit = raycastVoxel(0.5, 0.5, 0.5, 1, 0, 0, {
      maxDistance: 10,
      test: (x, y, z) => x === 3 && y === 0 && z === 0,
    });
    expect(hit).not.toBeNull();
    expect(hit!.x).toBe(3);
    expect(hit!.y).toBe(0);
    expect(hit!.z).toBe(0);
    expect(hit!.nx).toBe(-1);
  });

  it('hits a straight line along +Y', () => {
    const hit = raycastVoxel(0.5, 0.5, 0.5, 0, 1, 0, {
      maxDistance: 10,
      test: (x, y, z) => y === 4 && x === 0 && z === 0,
    });
    expect(hit!.y).toBe(4);
    expect(hit!.ny).toBe(-1);
  });

  it('hits a diagonal', () => {
    const hit = raycastVoxel(0.5, 0.5, 0.5, 1, 1, 1, {
      maxDistance: 20,
      test: (x, y, z) => x === 2 && y === 2 && z === 2,
    });
    expect(hit!.x).toBe(2);
    expect(hit!.y).toBe(2);
    expect(hit!.z).toBe(2);
  });

  it('respects the reach limit', () => {
    const hit = raycastVoxel(0.5, 1.5, 0.5, 1, 0, 0, {
      maxDistance: 2,
      test: floorWorld(),
    });
    expect(hit).toBeNull();
  });

  it('returns the previous voxel', () => {
    const hit = raycastVoxel(0.5, 1.5, 0.5, 0, -1, 0, {
      maxDistance: 10,
      test: (_x, y, _z) => y === 0,
    });
    expect(hit!.y).toBe(0);
    expect(hit!.py).toBe(1);
  });

  it('reports no hit when nothing matches', () => {
    const hit = raycastVoxel(0.5, 0.5, 0.5, 1, 0, 0, { maxDistance: 10, test: () => false });
    expect(hit).toBeNull();
  });
});

describe('direction helpers', () => {
  it('normalises a direction', () => {
    const [x, y, z] = normalizeDir(3, 0, 4);
    expect(Math.hypot(x, y, z)).toBeCloseTo(1);
  });

  it('maps yaw 0 to -Z', () => {
    const [x, y, z] = directionFromAngles(0, 0);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(0);
    expect(z).toBeCloseTo(-1);
  });

  it('maps yaw PI/2 to -X', () => {
    const [x, _y, z] = directionFromAngles(Math.PI / 2, 0);
    expect(x).toBeCloseTo(-1);
    expect(z).toBeCloseTo(0);
  });
});
