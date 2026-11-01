/**
 * Voxel collision.
 *
 * The player is an axis-aligned box moving through a grid of boxes. Each
 * axis is resolved separately (Y, then X, then Z) so the player slides along
 * walls instead of sticking to them, and a step-up of 0.6 blocks lets the
 * player walk over slabs and stairs without jumping.
 */

import type { Box } from '../voxel/shapes';

export interface CollisionWorld {
  /** Returns the collision boxes of the block at a world position. */
  boxesAt(x: number, y: number, z: number): Box[];
  /** Whether the block is a liquid. */
  isLiquidAt(x: number, y: number, z: number): boolean;
  /** Whether the block can be climbed (a ladder). */
  isClimbableAt(x: number, y: number, z: number): boolean;
}

export interface MoveResult {
  /** The position after the move. */
  x: number;
  y: number;
  z: number;
  onGround: boolean;
  hitCeiling: boolean;
  hitWall: boolean;
  /** Set when the player stepped up onto a block. */
  stepped: boolean;
}

const EPSILON = 1e-4;

/** Axis-aligned overlap test between two boxes. */
function overlaps(
  ax: number, ay: number, az: number,
  aw: number, ah: number, ad: number,
  bx: number, by: number, bz: number,
  bw: number, bh: number, bd: number,
): boolean {
  return (
    ax < bx + bw && ax + aw > bx &&
    ay < by + bh && ay + ah > by &&
    az < bz + bd && az + ad > bz
  );
}

/**
 * Move an axis-aligned box through the voxel world.
 */
export function moveWithCollision(
  world: CollisionWorld,
  position: { x: number; y: number; z: number },
  size: { w: number; h: number },
  delta: { x: number; y: number; z: number },
  stepHeight = 0.6,
): MoveResult {
  let { x, y, z } = position;
  const half = size.w / 2;
  let onGround = false;
  let hitCeiling = false;
  let hitWall = false;
  let stepped = false;

  // --- Y axis ---------------------------------------------------------
  const targetY = y + delta.y;
  const minX = x - half + EPSILON;
  const maxX = x + half - EPSILON;
  const minZ = z - half + EPSILON;
  const maxZ = z + half - EPSILON;

  const yBottom = delta.y < 0 ? targetY : y;
  const yTop = delta.y < 0 ? y + size.h : targetY + size.h;

  const minBlockY = Math.floor(yBottom);
  const maxBlockY = Math.floor(yTop);
  const minBlockX = Math.floor(minX);
  const maxBlockX = Math.floor(maxX);
  const minBlockZ = Math.floor(minZ);
  const maxBlockZ = Math.floor(maxZ);

  for (let by = minBlockY; by <= maxBlockY; by++) {
    for (let bx = minBlockX; bx <= maxBlockX; bx++) {
      for (let bz = minBlockZ; bz <= maxBlockZ; bz++) {
        const boxes = world.boxesAt(bx, by, bz);
        for (const box of boxes) {
          if (
            !overlaps(
              minX, yBottom, minZ, size.w, yTop - yBottom, size.w,
              bx + box.minX, by + box.minY, bz + box.minZ,
              box.maxX - box.minX, box.maxY - box.minY, box.maxZ - box.minZ,
            )
          ) {
            continue;
          }
          if (delta.y < 0) {
            y = by + box.maxY;
            onGround = true;
          } else {
            y = by + box.minY - size.h - EPSILON;
            hitCeiling = true;
          }
        }
      }
    }
  }

  // --- Step up --------------------------------------------------------
  if (delta.y <= 0 && delta.x !== 0) {
    // Try the same horizontal move one step higher.
    const lifted = tryStep(world, x, y, z, size, delta, stepHeight);
    if (lifted) {
      x = lifted.x;
      y = lifted.y;
      z = lifted.z;
      stepped = true;
      onGround = true;
    }
  }

  // --- X and Z axes ---------------------------------------------------
  const horizontal = { x: delta.x, z: delta.z };

  for (const axis of ['x', 'z'] as const) {
    const amount = horizontal[axis];
    if (amount === 0) continue;
    const next = position[axis] + amount;
    const probeMinX = axis === 'x' ? next - half : x - half;
    const probeMaxX = axis === 'x' ? next + half : x + half;
    const probeMinZ = axis === 'z' ? next - half : z - half;
    const probeMaxZ = axis === 'z' ? next + half : z + half;

    const bx0 = Math.floor(probeMinX);
    const bx1 = Math.floor(probeMaxX);
    const bz0 = Math.floor(probeMinZ);
    const bz1 = Math.floor(probeMaxZ);
    const by0 = Math.floor(y + EPSILON);
    const by1 = Math.floor(y + size.h - EPSILON);

    let blocked = false;
    let resolved = next;

    for (let by = by0; by <= by1 && !blocked; by++) {
      for (let bx = bx0; bx <= bx1 && !blocked; bx++) {
        for (let bz = bz0; bz <= bz1 && !blocked; bz++) {
          const boxes = world.boxesAt(bx, by, bz);
          for (const box of boxes) {
            if (
              overlaps(
                probeMinX, y, probeMinZ, size.w, size.h, size.w,
                bx + box.minX, by + box.minY, bz + box.minZ,
                box.maxX - box.minX, box.maxY - box.minY, box.maxZ - box.minZ,
              )
            ) {
              blocked = true;
              if (axis === 'x') resolved = amount > 0 ? bx - half - EPSILON : bx + 1 + half + EPSILON;
              else resolved = amount > 0 ? bz - half - EPSILON : bz + 1 + half + EPSILON;
              break;
            }
          }
        }
      }
    }

    if (blocked) {
      hitWall = true;
      position[axis] = resolved;
    } else {
      position[axis] = next;
    }
  }

  x = position.x;
  z = position.z;

  return { x, y, z, onGround, hitCeiling, hitWall, stepped };
}

/** Attempt to move while stepping up onto a low block. */
function tryStep(
  world: CollisionWorld,
  x: number,
  y: number,
  z: number,
  size: { w: number; h: number },
  delta: { x: number; y: number; z: number },
  stepHeight: number,
): { x: number; y: number; z: number } | null {
  const half = size.w / 2;
  const targetX = x + delta.x;
  const targetZ = z + delta.z;

  // Is there room at the raised position?
  const raisedY = y + stepHeight;
  const bx0 = Math.floor(targetX - half + EPSILON);
  const bx1 = Math.floor(targetX + half - EPSILON);
  const bz0 = Math.floor(targetZ - half + EPSILON);
  const bz1 = Math.floor(targetZ + half - EPSILON);
  const by0 = Math.floor(raisedY + EPSILON);
  const by1 = Math.floor(raisedY + size.h - EPSILON);

  for (let by = by0; by <= by1; by++) {
    for (let bx = bx0; bx <= bx1; bx++) {
      for (let bz = bz0; bz <= bz1; bz++) {
        for (const box of world.boxesAt(bx, by, bz)) {
          if (
            overlaps(
              targetX - half + EPSILON, raisedY, targetZ - half + EPSILON, size.w, size.h, size.w,
              bx + box.minX, by + box.minY, bz + box.minZ,
              box.maxX - box.minX, box.maxY - box.minY, box.maxZ - box.minZ,
            )
          ) {
            return null;
          }
        }
      }
    }
  }

  // Is the floor under the raised position at most stepHeight higher?
  const groundY = Math.floor(raisedY - EPSILON);
  let highest = -Infinity;
  for (let bx = bx0; bx <= bx1; bx++) {
    for (let bz = bz0; bz <= bz1; bz++) {
      for (const box of world.boxesAt(bx, groundY, bz)) {
        const top = groundY + box.maxY;
        if (top <= y + stepHeight + EPSILON && top > highest) highest = top;
      }
    }
  }
  if (highest === -Infinity) return null;

  return { x: targetX, y: highest, z: targetZ };
}

/** Whether the player is standing on something solid. */
export function isOnGround(world: CollisionWorld, x: number, y: number, z: number, size: { w: number; h: number }): boolean {
  const half = size.w / 2;
  const probeY = y - 0.02;
  const bx0 = Math.floor(x - half + EPSILON);
  const bx1 = Math.floor(x + half - EPSILON);
  const bz0 = Math.floor(z - half + EPSILON);
  const bz1 = Math.floor(z + half - EPSILON);
  const by = Math.floor(probeY);
  for (let bx = bx0; bx <= bx1; bx++) {
    for (let bz = bz0; bz <= bz1; bz++) {
      for (const box of world.boxesAt(bx, by, bz)) {
        if (
          overlaps(
            x - half + EPSILON, probeY, z - half + EPSILON, size.w, 0.02, size.w,
            bx + box.minX, by + box.minY, bz + box.minZ,
            box.maxX - box.minX, box.maxY - box.minY, box.maxZ - box.minZ,
          )
        ) {
          return true;
        }
      }
    }
  }
  return false;
}
