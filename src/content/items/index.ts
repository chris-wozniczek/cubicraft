/**
 * The item catalogue.
 *
 * Block items are implicit: a block id doubles as the id of the item that
 * places it, so this table only holds the items that are not placeable.
 */

import type { ItemDef } from '../../core/types';
import { ALL_TOOL_ITEMS } from './tools';
import { FOOD_ITEMS, POTION_ITEMS } from './food';
import { DYE_ITEMS, MATERIAL_ITEMS } from './materials';
import { MISC_ITEMS } from './misc';
import { ALL_ARMOUR_ITEMS } from '../armor/armour';

/** Every non-block item, in canonical order. */
export const ALL_ITEMS: ItemDef[] = [
  ...ALL_TOOL_ITEMS,
  ...ALL_ARMOUR_ITEMS,
  ...FOOD_ITEMS,
  ...POTION_ITEMS,
  ...MATERIAL_ITEMS,
  ...DYE_ITEMS,
  ...MISC_ITEMS,
];

export * from './common';
export { ALL_TOOL_ITEMS, TOOL_ITEMS, MACE_ITEM, SPEAR_ITEM } from './tools';
export { FOOD_ITEMS, POTION_ITEMS, POTION_EFFECTS } from './food';
export { MATERIAL_ITEMS, DYE_ITEMS } from './materials';
export {
  MUSIC_DISC_ITEMS,
  BUCKET_ITEMS,
  UTILITY_ITEMS,
  WEAPON_ITEMS,
  FIREWORK_ITEMS,
  BOOK_ITEMS,
  BOAT_ITEMS,
  SPAWN_EGG_ITEMS,
  TEMPLATE_ITEMS,
  MISC_ITEMS,
} from './misc';
