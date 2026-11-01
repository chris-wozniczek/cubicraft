/**
 * DDA voxel raycasting.
 *
 * Steps through the voxel grid along a ray, testing each voxel it enters.
 * This is O(steps) and exact — far cheaper and more precise than testing
 * against rendered geometry, which is essential for a voxel world where the
 * player must be able to pick a single block precisely.
 */

export interface RayHit {
  /** Block coordinates of the hit voxel. */
  x: number;
  y: number;
  z: number;
  /** Face normal of the hit surface. */
  nx: number;
  ny: number;
  nz: number;
  /** Distance along the ray. */
  distance: number;
  /** The previous (unhit) voxel. */
  px: number;
  py: number;
  pz: number;
}

export interface RayOptions {
  /** Maximum distance to travel. */
  maxDistance?: number;
  /** Called for each voxel; return false to stop the ray. */
  test?: (x: number, y: number, z: number) => boolean;
}

/**
 * Amanatides & Woo voxel traversal.
 */
export function raycastVoxel(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  options: RayOptions = {},
): RayHit | null {
  const maxDistance = options.maxDistance ?? 5;
  const test = options.test ?? (() => true);

  let x = Math.floor(ox);
  let y = Math.floor(oy);
  let z = Math.floor(oz);

  const stepX = dx > 0 ? 1 : -1;
  const stepY = dy > 0 ? 1 : -1;
  const stepZ = dz > 0 ? 1 : -1;

  const tDeltaX = dx === 0 ? Infinity : Math.abs(1 / dx);
  const tDeltaY = dy === 0 ? Infinity : Math.abs(1 / dy);
  const tDeltaZ = dz === 0 ? Infinity : Math.abs(1 / dz);

  const boundary = (o: number, i: number, step: number): number =>
    step > 0 ? i + 1 - o : o - i;

  let tMaxX = dx === 0 ? Infinity : boundary(ox, x, stepX) * tDeltaX;
  let tMaxY = dy === 0 ? Infinity : boundary(oy, y, stepY) * tDeltaY;
  let tMaxZ = dz === 0 ? Infinity : boundary(oz, z, stepZ) * tDeltaZ;

  let nx = 0;
  let ny = 0;
  let nz = 0;
  let t = 0;

  // The starting voxel can already be a hit.
  if (test(x, y, z)) {
    return { x, y, z, nx: 0, ny: 1, nz: 0, distance: 0, px: x, py: y, pz: z };
  }

  // Guard against a pathological ray.
  for (let i = 0; i < 512; i++) {
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      if (tMaxX > maxDistance) return null;
      x += stepX;
      t = tMaxX;
      tMaxX += tDeltaX;
      nx = -stepX;
      ny = 0;
      nz = 0;
    } else if (tMaxY < tMaxZ) {
      if (tMaxY > maxDistance) return null;
      y += stepY;
      t = tMaxY;
      tMaxY += tDeltaY;
      nx = 0;
      ny = -stepY;
      nz = 0;
    } else {
      if (tMaxZ > maxDistance) return null;
      z += stepZ;
      t = tMaxZ;
      tMaxZ += tDeltaZ;
      nx = 0;
      ny = 0;
      nz = -stepZ;
    }

    if (t > maxDistance) return null;
    if (test(x, y, z)) {
      // The face normal points back towards the ray origin, so the voxel we
      // came from is one step along the normal.
      return { x, y, z, nx, ny, nz, distance: t, px: x + nx, py: y + ny, pz: z + nz };
    }
  }
  return null;
}

/** Normalise a direction vector. */
export function normalizeDir(dx: number, dy: number, dz: number): [number, number, number] {
  const len = Math.hypot(dx, dy, dz);
  if (len === 0) return [0, 0, 0];
  return [dx / len, dy / len, dz / len];
}

/** Build a unit direction from yaw/pitch in radians. */
export function directionFromAngles(yaw: number, pitch: number): [number, number, number] {
  const cp = Math.cos(pitch);
  return [-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp];
}
