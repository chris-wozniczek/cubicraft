/**
 * Item definition helper.
 *
 * Items are the non-placeable half of the content set: block items are
 * implicit in the block registry (a block id doubles as its item id), so this
 * table only holds what cannot be placed in the world.
 */

import type { ItemDef, MiningLevel, ToolKind } from '../../core/types';

export interface ItemSpec {
  id: string;
  name: string;
  stackSize?: number;
  tool?: ToolKind;
  tier?: MiningLevel;
  durability?: number;
  damage?: number;
  armorSlot?: 'head' | 'chest' | 'legs' | 'feet' | 'body';
  defense?: number;
  food?: number;
  saturation?: number;
  /** Block this item places, if any. */
  places?: string;
  tags?: string[];
  /** Texture name used for the inventory icon. */
  icon: string;
}

export const ITEM_DEFAULTS = {
  stackSize: 64,
} as const;

export function defineItem(spec: ItemSpec): ItemDef {
  const item: ItemDef = {
    id: spec.id,
    displayName: spec.name,
    stackSize: spec.stackSize ?? ITEM_DEFAULTS.stackSize,
    tags: spec.tags ?? [],
    icon: spec.icon,
  };
  if (spec.tool !== undefined) item.tool = spec.tool;
  if (spec.tier !== undefined) item.tier = spec.tier;
  if (spec.durability !== undefined) item.durability = spec.durability;
  if (spec.damage !== undefined) item.damage = spec.damage;
  if (spec.armorSlot !== undefined) item.armorSlot = spec.armorSlot;
  if (spec.defense !== undefined) item.defense = spec.defense;
  if (spec.food !== undefined) item.food = spec.food;
  if (spec.saturation !== undefined) item.saturation = spec.saturation;
  if (spec.places !== undefined) item.places = spec.places;
  return item;
}
