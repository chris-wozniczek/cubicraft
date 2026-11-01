/**
 * Food and potions.
 *
 * Hunger and saturation follow the authoritative food table; the saturation
 * value is the amount of saturation the food restores on top of the hunger.
 */

import type { ItemDef } from '../../core/types';
import { TAGS } from '../tags';
import { defineItem } from './common';

export interface FoodSpec {
  id: string;
  name: string;
  hunger: number;
  saturation: number;
  stackSize?: number;
}

const FOOD_SPECS: readonly FoodSpec[] = [
  { id: 'cake', name: 'Cake', hunger: 14, saturation: 2.8, stackSize: 1 },
  { id: 'suspicious_stew', name: 'Suspicious Stew', hunger: 13, saturation: 1.8, stackSize: 1 },
  { id: 'rabbit_stew', name: 'Rabbit Stew', hunger: 10, saturation: 2.4, stackSize: 1 },
  { id: 'cooked_porkchop', name: 'Cooked Porkchop', hunger: 8, saturation: 1.2 },
  { id: 'pumpkin_pie', name: 'Pumpkin Pie', hunger: 8, saturation: 1.2 },
  { id: 'cooked_beef', name: 'Steak', hunger: 8, saturation: 1.2 },
  { id: 'beetroot_soup', name: 'Beetroot Soup', hunger: 6, saturation: 1.2, stackSize: 1 },
  { id: 'cooked_chicken', name: 'Cooked Chicken', hunger: 6, saturation: 1.2 },
  { id: 'cooked_mutton', name: 'Cooked Mutton', hunger: 6, saturation: 1.2 },
  { id: 'cooked_salmon', name: 'Cooked Salmon', hunger: 6, saturation: 1.2 },
  { id: 'golden_carrot', name: 'Golden Carrot', hunger: 6, saturation: 1.2 },
  { id: 'honey_bottle', name: 'Honey Bottle', hunger: 6, saturation: 1.2, stackSize: 16 },
  { id: 'mushroom_stew', name: 'Mushroom Stew', hunger: 6, saturation: 1.2, stackSize: 1 },
  { id: 'baked_potato', name: 'Baked Potato', hunger: 5, saturation: 0.6 },
  { id: 'bread', name: 'Bread', hunger: 5, saturation: 0.6 },
  { id: 'cooked_cod', name: 'Cooked Cod', hunger: 5, saturation: 0.6 },
  { id: 'cooked_rabbit', name: 'Cooked Rabbit', hunger: 5, saturation: 0.6 },
  { id: 'apple', name: 'Apple', hunger: 4, saturation: 0.3 },
  { id: 'chorus_fruit', name: 'Chorus Fruit', hunger: 4, saturation: 0.3 },
  { id: 'golden_apple', name: 'Golden Apple', hunger: 4, saturation: 1.2, stackSize: 16 },
  { id: 'enchanted_golden_apple', name: 'Enchanted Golden Apple', hunger: 4, saturation: 1.2, stackSize: 16 },
  { id: 'rotten_flesh', name: 'Rotten Flesh', hunger: 4, saturation: 0.6 },
  { id: 'carrot', name: 'Carrot', hunger: 3, saturation: 0.3 },
  { id: 'raw_beef', name: 'Raw Beef', hunger: 3, saturation: 0.3 },
  { id: 'raw_porkchop', name: 'Raw Porkchop', hunger: 3, saturation: 0.3 },
  { id: 'raw_rabbit', name: 'Raw Rabbit', hunger: 3, saturation: 0.3 },
  { id: 'cookie', name: 'Cookie', hunger: 2, saturation: 0.1 },
  { id: 'glow_berries', name: 'Glow Berries', hunger: 2, saturation: 0.2 },
  { id: 'melon_slice', name: 'Melon Slice', hunger: 2, saturation: 0.3 },
  { id: 'poisonous_potato', name: 'Poisonous Potato', hunger: 2, saturation: 0.3 },
  { id: 'raw_chicken', name: 'Raw Chicken', hunger: 2, saturation: 0.1 },
  { id: 'raw_cod', name: 'Raw Cod', hunger: 2, saturation: 0.1 },
  { id: 'raw_mutton', name: 'Raw Mutton', hunger: 2, saturation: 0.1 },
  { id: 'raw_salmon', name: 'Raw Salmon', hunger: 2, saturation: 0.1 },
  { id: 'spider_eye', name: 'Spider Eye', hunger: 2, saturation: 0.8 },
  { id: 'sweet_berries', name: 'Sweet Berries', hunger: 2, saturation: 0.2 },
  { id: 'beetroot', name: 'Beetroot', hunger: 1, saturation: 0.6 },
  { id: 'dried_kelp', name: 'Dried Kelp', hunger: 1, saturation: 0.1 },
  { id: 'potato', name: 'Potato', hunger: 1, saturation: 0.3 },
  { id: 'pufferfish', name: 'Pufferfish', hunger: 1, saturation: 0.3 },
  { id: 'tropical_fish', name: 'Tropical Fish', hunger: 1, saturation: 0.3 },
];

export const FOOD_ITEMS: ItemDef[] = FOOD_SPECS.map((food) =>
  defineItem({
    id: food.id,
    name: food.name,
    stackSize: food.stackSize ?? 64,
    food: food.hunger,
    saturation: food.saturation,
    tags: [TAGS.FOOD],
    icon: food.id,
  }),
);

/** The potion effects the game knows about. */
export const POTION_EFFECTS = [
  'healing',
  'harming',
  'swiftness',
  'slowness',
  'strength',
  'weakness',
  'fire_resistance',
  'night_vision',
  'water_breathing',
  'invisibility',
  'oozing',
  'infested',
] as const;

export type PotionEffect = (typeof POTION_EFFECTS)[number];

/** Plain bottles that carry no effect. */
export const BASE_POTIONS: readonly string[] = [
  'water_bottle',
  'awkward_potion',
  'mundane_potion',
  'thick_potion',
];

function potion(id: string, name: string, icon: string, tags: string[]): ItemDef {
  return defineItem({
    id,
    name,
    stackSize: 1,
    tags,
    icon,
  });
}

/** Potions in their three throwable forms. */
export const POTION_ITEMS: ItemDef[] = [
  ...POTION_EFFECTS.map((effect) =>
    potion(`potion_of_${effect}`, `Potion of ${effect.replace('_', ' ')}`, 'potion', [TAGS.POTION, `potion/${effect}`]),
  ),
  ...BASE_POTIONS.map((id) =>
    potion(id, id.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()), 'potion', [TAGS.POTION]),
  ),
  ...POTION_EFFECTS.map((effect) =>
    potion(`splash_potion_of_${effect}`, `Splash Potion of ${effect.replace('_', ' ')}`, 'splash_potion', [TAGS.POTION, `potion/${effect}`]),
  ),
  ...BASE_POTIONS.map((id) =>
    potion(`splash_${id}`, `Splash ${id.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())}`, 'splash_potion', [TAGS.POTION]),
  ),
  ...POTION_EFFECTS.map((effect) =>
    potion(`lingering_potion_of_${effect}`, `Lingering Potion of ${effect.replace('_', ' ')}`, 'lingering_potion', [TAGS.POTION, `potion/${effect}`]),
  ),
  ...BASE_POTIONS.map((id) =>
    potion(`lingering_${id}`, `Lingering ${id.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())}`, 'lingering_potion', [TAGS.POTION]),
  ),
];
