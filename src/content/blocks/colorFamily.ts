/**
 * Colour family — every dyed block a colour can produce.
 *
 * The 16 dye colours plus one list of families means a new colour is a single
 * entry in `DYE_COLORS`, and a new dyed block is one line in `COLOR_FAMILIES`.
 */

import type { BlockDef } from '../../core/types';
import { DYE_COLORS, TAGS, type DyeColor } from '../tags';
import { defineBlock } from './common';

export type ColorFamilyId =
  | 'wool'
  | 'carpet'
  | 'bed'
  | 'banner'
  | 'shulker_box'
  | 'concrete'
  | 'concrete_powder'
  | 'terracotta'
  | 'glazed_terracotta'
  | 'stained_glass'
  | 'tinted_glass'
  | 'candle'
  | 'candle_cake'
  | 'glazed_pottery';

export const COLOR_FAMILIES: readonly ColorFamilyId[] = [
  'wool',
  'carpet',
  'bed',
  'banner',
  'shulker_box',
  'concrete',
  'concrete_powder',
  'terracotta',
  'glazed_terracotta',
  'stained_glass',
  'tinted_glass',
  'candle',
  'candle_cake',
  'glazed_pottery',
];

const DISPLAY_NAMES: Record<ColorFamilyId, string> = {
  wool: 'Wool',
  carpet: 'Carpet',
  bed: 'Bed',
  banner: 'Banner',
  shulker_box: 'Shulker Box',
  concrete: 'Concrete',
  concrete_powder: 'Concrete Powder',
  terracotta: 'Terracotta',
  glazed_terracotta: 'Glazed Terracotta',
  stained_glass: 'Stained Glass',
  tinted_glass: 'Tinted Glass',
  candle: 'Candle',
  candle_cake: 'Candle Cake',
  glazed_pottery: 'Glazed Pottery',
};

const COLOR_DISPLAY: Record<DyeColor, string> = {
  white: 'White',
  orange: 'Orange',
  magenta: 'Magenta',
  light_blue: 'Light Blue',
  yellow: 'Yellow',
  lime: 'Lime',
  pink: 'Pink',
  gray: 'Gray',
  light_gray: 'Light Gray',
  cyan: 'Cyan',
  purple: 'Purple',
  blue: 'Blue',
  brown: 'Brown',
  green: 'Green',
  red: 'Red',
  black: 'Black',
};

/** Every block one colour contributes. */
export function colorFamily(suffix: DyeColor): BlockDef[] {
  const label = COLOR_DISPLAY[suffix];
  const wool = `${suffix}_wool`;
  const concrete = `${suffix}_concrete`;
  const terracotta = `${suffix}_terracotta`;
  const glass = `${suffix}_stained_glass`;

  const blocks: BlockDef[] = [];

  for (const family of COLOR_FAMILIES) {
    const base = {
      id: `${suffix}_${family}`,
      name: `${label} ${DISPLAY_NAMES[family]}`,
      family: 'color',
      params: { color: suffix, colorFamily: family },
    };

    switch (family) {
      case 'wool':
        blocks.push(
          defineBlock({
            ...base,
            hardness: 0.8,
            tool: 'shears',
            flammable: true,
            textures: wool,
            tags: [TAGS.WOOL, TAGS.CLOTH, TAGS.DYEABLE],
          }),
        );
        break;
      case 'carpet':
        blocks.push(
          defineBlock({
            ...base,
            hardness: 0.1,
            tool: 'shears',
            flammable: true,
            textures: wool,
            tags: [TAGS.WOOL, TAGS.CLOTH, TAGS.DYEABLE],
            shape: 'slab',
            slabShape: true,
            passable: true,
          }),
        );
        break;
      case 'bed':
        blocks.push(
          defineBlock({
            ...base,
            hardness: 0.2,
            tool: 'axe',
            flammable: true,
            textures: wool,
            tags: [TAGS.CLOTH, TAGS.IS_BED, TAGS.DYEABLE],
            shape: 'slab',
            slabShape: true,
          }),
        );
        break;
      case 'banner':
        blocks.push(
          defineBlock({
            ...base,
            hardness: 1,
            tool: 'axe',
            flammable: true,
            textures: wool,
            tags: [TAGS.IS_BANNER, TAGS.DYEABLE],
            shape: 'plant',
            passable: true,
          }),
        );
        break;
      case 'shulker_box':
        blocks.push(
          defineBlock({
            ...base,
            hardness: 2,
            tool: 'pickaxe',
            blastResistance: 3,
            textures: wool,
            tags: [TAGS.CLOTH, TAGS.DYEABLE],
          }),
        );
        break;
      case 'concrete':
        blocks.push(
          defineBlock({
            ...base,
            hardness: 1.8,
            blastResistance: 1.3,
            tool: 'pickaxe',
            requiresToolTier: 1,
            correctToolDrops: true,
            textures: concrete,
            tags: [TAGS.STONE, TAGS.DYEABLE],
          }),
        );
        break;
      case 'concrete_powder':
        blocks.push(
          defineBlock({
            ...base,
            hardness: 0.5,
            tool: 'shovel',
            gravity: true,
            textures: concrete,
            tags: [TAGS.DIRT, TAGS.DYEABLE],
          }),
        );
        break;
      case 'terracotta':
        blocks.push(
          defineBlock({
            ...base,
            hardness: 1.25,
            blastResistance: 1.3,
            tool: 'pickaxe',
            requiresToolTier: 1,
            correctToolDrops: true,
            textures: terracotta,
            tags: [TAGS.STONE, TAGS.DYEABLE],
          }),
        );
        break;
      case 'glazed_terracotta':
        blocks.push(
          defineBlock({
            ...base,
            hardness: 1.4,
            blastResistance: 1.3,
            tool: 'pickaxe',
            requiresToolTier: 1,
            correctToolDrops: true,
            textures: terracotta,
            tags: [TAGS.STONE, TAGS.DYEABLE],
          }),
        );
        break;
      case 'stained_glass':
        blocks.push(
          defineBlock({
            ...base,
            hardness: 0.3,
            tool: 'pickaxe',
            transparent: true,
            render: 'translucent',
            textures: glass,
            tags: [TAGS.DYEABLE],
          }),
        );
        break;
      case 'tinted_glass':
        blocks.push(
          defineBlock({
            ...base,
            hardness: 0.3,
            tool: 'pickaxe',
            transparent: true,
            render: 'translucent',
            textures: glass,
            tags: [TAGS.DYEABLE],
          }),
        );
        break;
      case 'candle':
        blocks.push(
          defineBlock({
            ...base,
            hardness: 0.1,
            textures: 'candle',
            tags: [TAGS.IS_CANDLE, TAGS.DYEABLE],
            shape: 'plant',
            passable: true,
          }),
        );
        break;
      case 'candle_cake':
        blocks.push(
          defineBlock({
            ...base,
            hardness: 0.1,
            textures: wool,
            tags: [TAGS.IS_CANDLE, TAGS.DYEABLE],
            shape: 'slab',
            slabShape: true,
          }),
        );
        break;
      case 'glazed_pottery':
        blocks.push(
          defineBlock({
            ...base,
            hardness: 1.4,
            tool: 'pickaxe',
            requiresToolTier: 1,
            correctToolDrops: true,
            textures: terracotta,
            tags: [TAGS.STONE, TAGS.DYEABLE],
          }),
        );
        break;
    }
  }

  return blocks;
}

/** The undyed shulker box, which is not part of any colour family. */
export function defaultShulkerBox(): BlockDef {
  return defineBlock({
    id: 'shulker_box',
    name: 'Shulker Box',
    family: 'color',
    hardness: 2,
    tool: 'pickaxe',
    blastResistance: 3,
    textures: 'shulker_box',
    tags: [TAGS.CLOTH],
    params: { color: 'none', colorFamily: 'shulker_box' },
  });
}

/** Every colour, in the canonical order. */
export const COLORS: readonly DyeColor[] = DYE_COLORS;
