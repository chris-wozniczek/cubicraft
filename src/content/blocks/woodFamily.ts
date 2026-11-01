/**
 * Wood family — every block a wood type contributes.
 *
 * A wood type is one entry in `WOOD_SPECS`. The generator derives the log,
 * plank, leaf, sapling, slab, stair, wall, bookshelf and sign/door forms from
 * it, so adding a species is a data change rather than a code change.
 *
 * Boats and chest boats are rideable items rather than blocks, so they are
 * produced by the item table from the same `WOOD_SPECS` list.
 */

import type { BlockDef } from '../../core/types';
import { TAGS, type WoodType } from '../tags';
import { defineBlock } from './common';
import { doorFamily, type DoorBase } from './doorFamily';
import { signFamily, type SignBase } from './signFamily';

export type WoodKind = 'overworld' | 'nether' | 'bamboo';

export interface WoodSpec {
  id: WoodType;
  name: string;
  kind: WoodKind;
}

export const WOOD_SPECS: readonly WoodSpec[] = [
  { id: 'oak', name: 'Oak', kind: 'overworld' },
  { id: 'spruce', name: 'Spruce', kind: 'overworld' },
  { id: 'birch', name: 'Birch', kind: 'overworld' },
  { id: 'jungle', name: 'Jungle', kind: 'overworld' },
  { id: 'acacia', name: 'Acacia', kind: 'overworld' },
  { id: 'dark_oak', name: 'Dark Oak', kind: 'overworld' },
  { id: 'mangrove', name: 'Mangrove', kind: 'overworld' },
  { id: 'cherry', name: 'Cherry', kind: 'overworld' },
  { id: 'bamboo', name: 'Bamboo', kind: 'bamboo' },
  { id: 'crimson', name: 'Crimson', kind: 'nether' },
  { id: 'warped', name: 'Warped', kind: 'nether' },
  { id: 'pale_oak', name: 'Pale Oak', kind: 'overworld' },
  { id: 'poplar', name: 'Poplar', kind: 'overworld' },
];

/** Texture names a wood type uses, resolved by kind. */
export interface WoodTextures {
  log: string;
  logTop: string;
  planks: string;
  leaves: string;
  sapling: string;
}

export function woodTextures(spec: WoodSpec): WoodTextures {
  if (spec.kind === 'bamboo') {
    return {
      log: 'bamboo_block',
      logTop: 'bamboo_block',
      planks: 'bamboo_planks',
      leaves: 'bamboo_leaves',
      sapling: 'bamboo_leaves',
    };
  }
  if (spec.kind === 'nether') {
    return {
      log: `${spec.id}_stem`,
      logTop: `${spec.id}_stem_top`,
      planks: `${spec.id}_planks`,
      leaves: `${spec.id}_leaves`,
      sapling: `${spec.id}_nether_sprouts`,
    };
  }
  return {
    log: `${spec.id}_log`,
    logTop: `${spec.id}_log_top`,
    planks: `${spec.id}_planks`,
    leaves: `${spec.id}_leaves`,
    sapling: `${spec.id}_sapling`,
  };
}

/** The door/fence/button forms this wood contributes. */
function doorBaseFor(spec: WoodSpec, tex: WoodTextures): DoorBase {
  return {
    id: spec.id,
    name: spec.name,
    family: 'wood',
    texture: tex.planks,
    hardness: 2,
    tool: 'axe',
    flammable: true,
    tags: [TAGS.WOODEN],
  };
}

/** The sign forms this wood contributes. */
function signBaseFor(spec: WoodSpec, tex: WoodTextures): SignBase {
  return {
    id: spec.id,
    name: spec.name,
    family: 'wood',
    texture: tex.planks,
    hardness: 2,
    flammable: true,
  };
}

/**
 * Every block of one wood type.
 *
 * The door and sign forms come from the shared generators so that an iron
 * door and an oak door behave identically apart from their material.
 */
export function woodFamily(wood: WoodSpec): BlockDef[] {
  const tex = woodTextures(wood);
  const family = 'wood';
  const blocks: BlockDef[] = [];

  const woodTags = [TAGS.WOODEN];

  if (wood.kind === 'nether') {
    blocks.push(
      defineBlock({
        id: `${wood.id}_stem`,
        name: `${wood.name} Stem`,
        family,
        hardness: 2,
        tool: 'axe',
        flammable: true,
        textures: { top: tex.logTop, side: tex.log, bottom: tex.logTop },
        tags: [...woodTags, TAGS.LOGS],
        params: { wood: wood.id, part: 'stem' },
      }),
      defineBlock({
        id: `stripped_${wood.id}_stem`,
        name: `Stripped ${wood.name} Stem`,
        family,
        hardness: 2,
        tool: 'axe',
        flammable: true,
        textures: { top: tex.logTop, side: tex.log, bottom: tex.logTop },
        tags: [...woodTags, TAGS.LOGS],
        params: { wood: wood.id, part: 'stripped_stem' },
      }),
      defineBlock({
        id: `${wood.id}_hyphae`,
        name: `${wood.name} Hyphae`,
        family,
        hardness: 2,
        tool: 'axe',
        flammable: true,
        textures: { top: tex.logTop, side: tex.log, bottom: tex.logTop },
        tags: [...woodTags, TAGS.LOGS],
        params: { wood: wood.id, part: 'hyphae' },
      }),
      defineBlock({
        id: `stripped_${wood.id}_hyphae`,
        name: `Stripped ${wood.name} Hyphae`,
        family,
        hardness: 2,
        tool: 'axe',
        flammable: true,
        textures: { top: tex.logTop, side: tex.log, bottom: tex.logTop },
        tags: [...woodTags, TAGS.LOGS],
        params: { wood: wood.id, part: 'stripped_hyphae' },
      }),
    );
  } else if (wood.kind === 'bamboo') {
    blocks.push(
      defineBlock({
        id: 'bamboo_block',
        name: 'Block of Bamboo',
        family,
        hardness: 1.5,
        tool: 'axe',
        flammable: true,
        textures: tex.log,
        tags: [...woodTags, TAGS.LOGS],
        params: { wood: wood.id, part: 'block' },
      }),
      defineBlock({
        id: 'stripped_bamboo_block',
        name: 'Stripped Bamboo Block',
        family,
        hardness: 1.5,
        tool: 'axe',
        flammable: true,
        textures: tex.log,
        tags: [...woodTags, TAGS.LOGS],
        params: { wood: wood.id, part: 'stripped_block' },
      }),
    );
  } else {
    blocks.push(
      defineBlock({
        id: `${wood.id}_log`,
        name: `${wood.name} Log`,
        family,
        hardness: 2,
        tool: 'axe',
        flammable: true,
        textures: { top: tex.logTop, side: tex.log, bottom: tex.logTop },
        tags: [...woodTags, TAGS.LOGS],
        params: { wood: wood.id, part: 'log' },
      }),
      defineBlock({
        id: `stripped_${wood.id}_log`,
        name: `Stripped ${wood.name} Log`,
        family,
        hardness: 2,
        tool: 'axe',
        flammable: true,
        textures: { top: tex.logTop, side: tex.log, bottom: tex.logTop },
        tags: [...woodTags, TAGS.LOGS],
        params: { wood: wood.id, part: 'stripped_log' },
      }),
    );
  }

  blocks.push(
    defineBlock({
      id: `${wood.id}_planks`,
      name: `${wood.name} Planks`,
      family,
      hardness: 2,
      tool: 'axe',
      flammable: true,
      textures: tex.planks,
      tags: [...woodTags, TAGS.PLANKS],
      params: { wood: wood.id, part: 'planks' },
    }),
    defineBlock({
      id: `${wood.id}_slab`,
      name: `${wood.name} Slab`,
      family,
      hardness: 2,
      tool: 'axe',
      flammable: true,
      textures: tex.planks,
      tags: [...woodTags, TAGS.PLANKS, TAGS.IS_SLAB],
      shape: 'slab',
      slabShape: true,
      params: { wood: wood.id, part: 'slab' },
    }),
    defineBlock({
      id: `${wood.id}_stairs`,
      name: `${wood.name} Stairs`,
      family,
      hardness: 2,
      tool: 'axe',
      flammable: true,
      textures: tex.planks,
      tags: [...woodTags, TAGS.PLANKS, TAGS.IS_STAIRS],
      shape: 'stairs',
      params: { wood: wood.id, part: 'stairs' },
    }),
    defineBlock({
      id: `${wood.id}_wall`,
      name: `${wood.name} Wall`,
      family,
      hardness: 2,
      tool: 'axe',
      flammable: true,
      textures: tex.planks,
      tags: [...woodTags, TAGS.PLANKS, TAGS.IS_FENCE],
      shape: 'fence',
      transparent: true,
      render: 'cutout',
      params: { wood: wood.id, part: 'wall' },
    }),
    defineBlock({
      id: `${wood.id}_bookshelf`,
      name: `${wood.name} Bookshelf`,
      family,
      hardness: 1.5,
      tool: 'axe',
      flammable: true,
      textures: tex.planks,
      tags: [...woodTags, TAGS.PLANKS],
      params: { wood: wood.id, part: 'bookshelf' },
    }),
    defineBlock({
      id: `${wood.id}_chiseled_bookshelf`,
      name: `Chiseled ${wood.name} Bookshelf`,
      family,
      hardness: 1.5,
      tool: 'axe',
      flammable: true,
      textures: tex.planks,
      tags: [...woodTags, TAGS.PLANKS],
      params: { wood: wood.id, part: 'chiseled_bookshelf' },
    }),
    defineBlock({
      id: `${wood.id}_leaves`,
      name: `${wood.name} Leaves`,
      family,
      hardness: 0.2,
      tool: 'shears',
      flammable: true,
      transparent: true,
      render: 'cutout',
      textures: tex.leaves,
      tags: [...woodTags, TAGS.LEAVES],
      params: { wood: wood.id, part: 'leaves' },
    }),
    defineBlock({
      id: `${wood.id}_sapling`,
      name: `${wood.name} Sapling`,
      family,
      hardness: 0,
      tool: 'none',
      flammable: true,
      transparent: true,
      render: 'cross',
      shape: 'plant',
      passable: true,
      textures: tex.sapling,
      tags: [...woodTags, TAGS.IS_PLANT],
      params: { wood: wood.id, part: 'sapling' },
    }),
  );

  blocks.push(...doorFamily(doorBaseFor(wood, tex)));
  blocks.push(...signFamily(signBaseFor(wood, tex)));

  return blocks;
}

/** Alias blocks the world generator asks for by a different name. */
export function woodAliases(): BlockDef[] {
  return [
    defineBlock({
      id: 'pine_log',
      name: 'Pine Log',
      family: 'wood',
      hardness: 2,
      tool: 'axe',
      flammable: true,
      textures: { top: 'spruce_log_top', side: 'spruce_log', bottom: 'spruce_log_top' },
      tags: [TAGS.WOODEN, TAGS.LOGS],
      params: { wood: 'spruce', part: 'log', alias: true },
    }),
    defineBlock({
      id: 'pine_planks',
      name: 'Pine Planks',
      family: 'wood',
      hardness: 2,
      tool: 'axe',
      flammable: true,
      textures: 'spruce_planks',
      tags: [TAGS.WOODEN, TAGS.PLANKS],
      params: { wood: 'spruce', part: 'planks', alias: true },
    }),
    defineBlock({
      id: 'pine_leaves',
      name: 'Pine Leaves',
      family: 'wood',
      hardness: 0.2,
      tool: 'shears',
      flammable: true,
      transparent: true,
      render: 'cutout',
      textures: 'spruce_leaves',
      tags: [TAGS.WOODEN, TAGS.LEAVES],
      params: { wood: 'spruce', part: 'leaves', alias: true },
    }),
  ];
}

/** All wood types, in the canonical order used by the block registry. */
export const WOODS_BY_ID: readonly WoodSpec[] = WOOD_SPECS;
