import { describe, expect, it } from 'vitest';

import { isOnGround, moveWithCollision, type CollisionWorld } from '../src/engine/physics/collision';

/** A world with a solid floor at y = 0 and an optional wall at x = 3. */
function makeWorld(options: { floor?: boolean; wallX?: number } = {}): CollisionWorld {
  const floor = options.floor !== false;
  const wallX = options.wallX;
  return {
    boxesAt(x, y, z) {
      if (floor && y <= 0) {
        return [{ minX: 0, minY: 0, minZ: 0, maxX: 1, maxY: 1, maxZ: 1 }];
      }
      if (wallX !== undefined && x === wallX && y > 0) {
        return [{ minX: 0, minY: 0, minZ: 0, maxX: 1, maxY: 1, maxZ: 1 }];
      }
      return [];
    },
    isLiquidAt: () => false,
    isClimbableAt: () => false,
  };
}

const SIZE = { w: 0.6, h: 1.8 };

describe('voxel collision', () => {
  it('lands the player on the floor', () => {
    const world = makeWorld();
    const result = moveWithCollision(world, { x: 0.5, y: 1.5, z: 0.5 }, SIZE, { x: 0, y: -0.6, z: 0 });
    expect(result.onGround).toBe(true);
    expect(result.y).toBeCloseTo(1, 1);
  });

  it('stops the player at a wall', () => {
    const world = makeWorld({ wallX: 1 });
    const result = moveWithCollision(world, { x: 0.5, y: 1, z: 0.5 }, SIZE, { x: 0.3, y: 0, z: 0 });
    expect(result.hitWall).toBe(true);
    expect(result.x).toBeLessThan(1);
  });

  it('does not sink into the floor', () => {
    const world = makeWorld();
    const result = moveWithCollision(world, { x: 0.5, y: 1.5, z: 0.5 }, SIZE, { x: 0, y: -0.6, z: 0 });
    expect(result.y).toBeGreaterThanOrEqual(1);
  });

  it('stops upward movement under a ceiling', () => {
    const world: CollisionWorld = {
      boxesAt(x, y, z) {
        if (y === 3) return [{ minX: 0, minY: 0, minZ: 0, maxX: 1, maxY: 1, maxZ: 1 }];
        return [];
      },
      isLiquidAt: () => false,
      isClimbableAt: () => false,
    };
    const result = moveWithCollision(world, { x: 0.5, y: 1, z: 0.5 }, SIZE, { x: 0, y: 1, z: 0 });
    expect(result.hitCeiling).toBe(true);
    expect(result.y + SIZE.h).toBeLessThanOrEqual(3.01);
  });

  it('reports standing on the ground', () => {
    const world = makeWorld();
    expect(isOnGround(world, 0.5, 1, 0.5, SIZE)).toBe(true);
    expect(isOnGround(world, 0.5, 3, 0.5, SIZE)).toBe(false);
  });

  it('lets the player slide along a wall', () => {
    const world = makeWorld({ wallX: 1 });
    const result = moveWithCollision(world, { x: 0.5, y: 1, z: 0.5 }, SIZE, { x: 0.2, y: 0, z: 0.2 });
    expect(result.z).toBeGreaterThan(0.5);
  });
});
