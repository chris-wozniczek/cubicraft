/**
 * Armour recipes — the seven full sets.
 */

import type { RegisteredRecipe } from '../registries';
import { shaped } from './base';

interface ArmourSet {
  id: string;
  material: string;
}

const SETS: readonly ArmourSet[] = [
  { id: 'leather', material: 'leather' },
  { id: 'copper', material: 'copper_ingot' },
  { id: 'chainmail', material: 'iron_ingot' },
  { id: 'iron', material: 'iron_ingot' },
  { id: 'gold', material: 'gold_ingot' },
  { id: 'diamond', material: 'diamond' },
  { id: 'netherite', material: 'netherite_ingot' },
];

/** The prefix of the pieces of a set (gold pieces are `golden_*`). */
function prefix(set: ArmourSet): string {
  return set.id === 'gold' ? 'golden' : set.id;
}

/** Every armour recipe. */
export const ARMOUR_RECIPES: RegisteredRecipe[] = SETS.flatMap((set) => {
  const m = set.material;
  const p = prefix(set);
  return [
    shaped(
      `${p}_helmet_recipe`,
      [[m, m, m], [m, null, m]],
      `${p}_helmet`,
      1,
      ['armor'],
    ),
    shaped(
      `${p}_chestplate_recipe`,
      [[m, null, m], [m, m, m], [m, m, m]],
      `${p}_chestplate`,
      1,
      ['armor'],
    ),
    shaped(
      `${p}_leggings_recipe`,
      [[m, m, m], [m, null, m], [m, null, m]],
      `${p}_leggings`,
      1,
      ['armor'],
    ),
    shaped(
      `${p}_boots_recipe`,
      [[m, null, m], [m, null, m]],
      `${p}_boots`,
      1,
      ['armor'],
    ),
  ];
});
