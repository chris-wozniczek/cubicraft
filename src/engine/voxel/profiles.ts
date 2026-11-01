/**
 * Compact per-block data used by the engine and the mesh worker.
 *
 * The content registry holds rich definitions (drops, hooks, tags). The hot
 * paths — meshing, collision, lighting — only need a small subset, so it is
 * flattened into a table indexed by block id and shipped to workers once.
 */

import type { BlockShape, MiningLevel, RenderGroup, ToolKind } from '../../core/types';

export interface BlockProfile {
  id: number;
  name: string;
  /** How the block renders. */
  render: RenderGroup;
  shape: BlockShape;
  /** Light emitted by this block, 0..15. */
  emission: number;
  /** Light passes through at full strength (air, glass, plants). */
  transparent: boolean;
  /** Blocks light completely (solid opaque cubes). */
  opaque: boolean;
  liquid: boolean;
  slab: boolean;
  axis: 'y' | 'x' | 'z';
  /** Texture-array layer indices. */
  layer: { top: number; side: number; bottom: number; front: number };
  hardness: number;
  tool: ToolKind;
  tier: MiningLevel;
  flammable: boolean;
  /** Whether the block only drops when mined with the right tool. */
  correctToolDrops: boolean;
  /** Tags carried over from the content definition. */
  tags: string[];
}

export const EMPTY_PROFILE: BlockProfile = {
  id: 0,
  name: 'air',
  render: 'none',
  shape: 'empty',
  emission: 0,
  transparent: true,
  opaque: false,
  liquid: false,
  slab: false,
  axis: 'y',
  layer: { top: 0, side: 0, bottom: 0, front: 0 },
  hardness: 0,
  tool: 'none',
  tier: 0,
  flammable: false,
  correctToolDrops: false,
  tags: [],
};

/** A table of block profiles indexed by block id. */
export class BlockProfileTable {
  readonly profiles: BlockProfile[] = [EMPTY_PROFILE];

  constructor(profiles: readonly BlockProfile[] = []) {
    for (const p of profiles) {
      this.profiles[p.id] = p;
    }
  }

  get(id: number): BlockProfile {
    return this.profiles[id] ?? EMPTY_PROFILE;
  }

  get length(): number {
    return this.profiles.length;
  }

  /** Plain data copy suitable for postMessage to a worker. */
  toTransferable(): BlockProfile[] {
    return this.profiles.map((p) => ({ ...p, layer: { ...p.layer } }));
  }
}
