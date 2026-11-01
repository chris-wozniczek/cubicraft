/**
 * Shape family — slab, stairs and wall variants of a solid base block.
 *
 * Every solid block that supports the three construction shapes is described
 * once and gets all three variants from here, so the three shapes always
 * share the base block's mining behaviour.
 */

import type { BlockDef, MiningLevel, ToolKind } from '../../core/types';
import { TAGS } from '../tags';
import { defineBlock } from './common';

export interface ShapeBase {
  /** Id of the base block, e.g. `stone`. */
  id: string;
  /** Display name of the base block, e.g. `Stone`. */
  name: string;
  family: string;
  /** Texture of the base block. */
  texture: string;
  hardness: number;
  blastResistance?: number;
  tool?: ToolKind;
  requiresToolTier?: MiningLevel;
  correctToolDrops?: boolean;
  flammable?: boolean;
  transparent?: boolean;
  /** Extra tags copied onto every variant. */
  tags?: string[];
  waterloggable?: boolean;
}

/** Generate slab, stairs and wall for one base block. */
export function shapeFamily(base: ShapeBase): BlockDef[] {
  const common = {
    family: base.family,
    hardness: base.hardness,
    blastResistance: base.blastResistance,
    tool: base.tool ?? 'pickaxe',
    requiresToolTier: base.requiresToolTier,
    correctToolDrops: base.correctToolDrops,
    flammable: base.flammable,
    waterloggable: base.waterloggable,
    tags: base.tags ?? [],
  };

  return [
    defineBlock({
      ...common,
      id: `${base.id}_slab`,
      name: `${base.name} Slab`,
      textures: base.texture,
      tags: [...common.tags, TAGS.IS_SLAB],
      shape: 'slab',
      slabShape: true,
      params: { base: base.id, form: 'slab' },
    }),
    defineBlock({
      ...common,
      id: `${base.id}_stairs`,
      name: `${base.name} Stairs`,
      textures: base.texture,
      tags: [...common.tags, TAGS.IS_STAIRS],
      shape: 'stairs',
      params: { base: base.id, form: 'stairs' },
    }),
    defineBlock({
      ...common,
      id: `${base.id}_wall`,
      name: `${base.name} Wall`,
      textures: base.texture,
      tags: [...common.tags, TAGS.IS_FENCE],
      shape: 'fence',
      transparent: true,
      render: 'cutout',
      params: { base: base.id, form: 'wall' },
    }),
  ];
}
