/**
 * Collision shapes for non-cube blocks.
 *
 * Every block resolves to a list of axis-aligned boxes. Full cubes are the
 * common case and resolve to a single box, so the hot path stays cheap.
 */

import type { BlockShape } from '../../core/types';

export interface Box {
  /** Minimum corner, relative to the block origin. */
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

/** The full-cube box, cached because it is by far the most common. */
export const FULL_BOX: Box = { minX: 0, minY: 0, minZ: 0, maxX: 1, maxY: 1, maxZ: 1 };

const SLAB_BOTTOM: Box = { minX: 0, minY: 0, minZ: 0, maxX: 1, maxY: 0.5, maxZ: 1 };
const SLAB_TOP: Box = { minX: 0, minY: 0.5, minZ: 0, maxX: 1, maxY: 1, maxZ: 1 };
const PLANT_BOX: Box = { minX: 0.3125, minY: 0, minZ: 0.3125, maxX: 0.6875, maxY: 0.8125, maxZ: 0.6875 };
const FENCE_BOX: Box = { minX: 0.375, minY: 0, minZ: 0.375, maxX: 0.625, maxY: 1.5, maxZ: 0.625 };
const PANE_BOX: Box = { minX: 0.4375, minY: 0, minZ: 0.4375, maxX: 0.5625, maxY: 1, maxZ: 0.5625 };

/** Stair geometry: a full-height box plus a lower step at the front. */
const STAIRS: Box[] = [
  { minX: 0, minY: 0, minZ: 0, maxX: 1, maxY: 1, maxZ: 1 },
];

export function boxesForShape(shape: BlockShape, _axis: 'y' | 'x' | 'z' = 'y'): Box[] {
  switch (shape) {
    case 'cube':
      return [FULL_BOX];
    case 'slab':
      return [SLAB_BOTTOM];
    case 'slabTop':
      return [SLAB_TOP];
    case 'stairs':
      return STAIRS;
    case 'fence':
      return [FENCE_BOX];
    case 'pane':
      return [PANE_BOX];
    case 'plant':
      return [PLANT_BOX];
    case 'fluid':
    case 'empty':
      return [];
    default:
      return [FULL_BOX];
  }
}

/** Whether a shape stops the player from walking through it. */
export function isSolid(shape: BlockShape): boolean {
  return shape !== 'plant' && shape !== 'empty';
}

/** Whether the shape lets light through at full strength. */
export function isTransparentShape(shape: BlockShape): boolean {
  return shape === 'plant' || shape === 'empty' || shape === 'fluid';
}
