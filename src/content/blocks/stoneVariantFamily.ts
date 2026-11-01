/**
 * Stone variant family — the mineral stone sets.
 *
 * `stoneVariantFamily('sulfur')` produces the whole sulfur set, the same way
 * `stoneVariantFamily('cinnabar')` produces the cinnabar set. Each set is a
 * block, its three construction shapes, a brick set and a chiselled block.
 */

import type { BlockDef } from '../../core/types';
import { TAGS } from '../tags';
import { defineBlock } from './common';

export type StoneVariantName = 'sulfur' | 'cinnabar';

export interface StoneVariantSpec {
  name: StoneVariantName;
  displayName: string;
  texture: string;
  hardness: number;
  blastResistance: number;
  brickDisplayName: string;
}

const SPECS: Record<StoneVariantName, StoneVariantSpec> = {
  sulfur: {
    name: 'sulfur',
    displayName: 'Sulfur',
    texture: 'sulfur',
    hardness: 1.5,
    blastResistance: 3,
    brickDisplayName: 'Sulfur Bricks',
  },
  cinnabar: {
    name: 'cinnabar',
    displayName: 'Cinnabar',
    texture: 'cinnabar',
    hardness: 1.8,
    blastResistance: 3.5,
    brickDisplayName: 'Cinnabar Bricks',
  },
};

/** Generate the whole block set of one mineral stone. */
export function stoneVariantFamily(name: StoneVariantName): BlockDef[] {
  const spec = SPECS[name];
  if (!spec) return [];

  const base = {
    family: 'stone_variant',
    hardness: spec.hardness,
    blastResistance: spec.blastResistance,
    tool: 'pickaxe' as const,
    requiresToolTier: 1 as const,
    correctToolDrops: true,
    textures: spec.texture,
    tags: [TAGS.STONE],
  };

  return [
    defineBlock({
      ...base,
      id: `${spec.name}_block`,
      name: `${spec.displayName} Block`,
      params: { variant: spec.name, part: 'block' },
    }),
    defineBlock({
      ...base,
      id: `${spec.name}_slab`,
      name: `${spec.displayName} Slab`,
      tags: [TAGS.STONE, TAGS.IS_SLAB],
      shape: 'slab',
      slabShape: true,
      params: { variant: spec.name, form: 'slab' },
    }),
    defineBlock({
      ...base,
      id: `${spec.name}_stairs`,
      name: `${spec.displayName} Stairs`,
      tags: [TAGS.STONE, TAGS.IS_STAIRS],
      shape: 'stairs',
      params: { variant: spec.name, form: 'stairs' },
    }),
    defineBlock({
      ...base,
      id: `${spec.name}_wall`,
      name: `${spec.displayName} Wall`,
      tags: [TAGS.STONE, TAGS.IS_FENCE],
      shape: 'fence',
      transparent: true,
      render: 'cutout',
      params: { variant: spec.name, form: 'wall' },
    }),
    defineBlock({
      ...base,
      id: `${spec.name}_bricks`,
      name: spec.brickDisplayName,
      hardness: spec.hardness + 0.5,
      params: { variant: spec.name, part: 'bricks' },
    }),
    defineBlock({
      ...base,
      id: `${spec.name}_brick_slab`,
      name: `${spec.brickDisplayName} Slab`,
      tags: [TAGS.STONE, TAGS.IS_SLAB],
      shape: 'slab',
      slabShape: true,
      params: { variant: spec.name, form: 'brick_slab' },
    }),
    defineBlock({
      ...base,
      id: `${spec.name}_brick_stairs`,
      name: `${spec.brickDisplayName} Stairs`,
      tags: [TAGS.STONE, TAGS.IS_STAIRS],
      shape: 'stairs',
      params: { variant: spec.name, form: 'brick_stairs' },
    }),
    defineBlock({
      ...base,
      id: `${spec.name}_brick_wall`,
      name: `${spec.brickDisplayName} Wall`,
      tags: [TAGS.STONE, TAGS.IS_FENCE],
      shape: 'fence',
      transparent: true,
      render: 'cutout',
      params: { variant: spec.name, form: 'brick_wall' },
    }),
    defineBlock({
      ...base,
      id: `chiseled_${spec.name}_bricks`,
      name: `Chiselled ${spec.brickDisplayName}`,
      hardness: spec.hardness + 0.5,
      params: { variant: spec.name, part: 'chiseled_bricks' },
    }),
  ];
}
