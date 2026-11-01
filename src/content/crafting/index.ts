/**
 * The recipe registry.
 *
 * The order matters for the crafting matcher: the first recipe that matches
 * the grid wins, so the general recipes come before the special ones.
 */

import type { RegisteredRecipe } from '../registries';
import { PROGRESSION_RECIPES } from './progression';
import { TOOL_RECIPES } from './tools';
import { ARMOUR_RECIPES } from './armour';
import { SMELTING_RECIPES, BLASTING_RECIPES, SMOKING_RECIPES } from './smelting';
import { STONECUTTING_RECIPES } from './stonecutting';
import { NETHERITE_UPGRADE_RECIPES, TRIM_RECIPES } from './smithing';

/** Every recipe in the game. */
export const ALL_RECIPES: RegisteredRecipe[] = [
  ...PROGRESSION_RECIPES,
  ...TOOL_RECIPES,
  ...ARMOUR_RECIPES,
  ...SMELTING_RECIPES,
  ...BLASTING_RECIPES,
  ...SMOKING_RECIPES,
  ...STONECUTTING_RECIPES,
  ...NETHERITE_UPGRADE_RECIPES,
  ...TRIM_RECIPES,
];

export * from './base';
export { PROGRESSION_RECIPES, TOOL_RECIPES, ARMOUR_RECIPES };
export { SMELTING_RECIPES, BLASTING_RECIPES, SMOKING_RECIPES };
export { STONECUTTING_RECIPES, NETHERITE_UPGRADE_RECIPES, TRIM_RECIPES };
