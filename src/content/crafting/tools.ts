/**
 * Tool recipes — the seven tiers crossed with the five tool kinds.
 */

import type { RegisteredRecipe } from '../registries';
import { TOOL_TIERS } from '../tags';
import { shaped } from './base';

/** The ingredient each tier is made from. */
const TIER_INGREDIENTS: Record<string, string> = {
  wooden: 'oak_planks',
  stone: 'cobblestone',
  copper: 'copper_ingot',
  iron: 'iron_ingot',
  golden: 'gold_ingot',
  diamond: 'diamond',
  netherite: 'netherite_ingot',
};

const TOOL_KINDS = ['sword', 'pickaxe', 'axe', 'shovel', 'hoe'] as const;

/** The shaped layout of every tool kind. */
function toolPattern(kind: (typeof TOOL_KINDS)[number], material: string): (string | null)[][] {
  switch (kind) {
    case 'sword':
      return [[material], [material], ['stick']];
    case 'pickaxe':
      return [[material, material, material], [null, 'stick', null], [null, 'stick', null]];
    case 'axe':
      return [[material, material], [material, 'stick'], [null, 'stick']];
    case 'shovel':
      return [[material], ['stick'], ['stick']];
    case 'hoe':
      return [[material, material], [null, 'stick'], [null, 'stick']];
  }
}

/** Every tool recipe. */
export const TOOL_RECIPES: RegisteredRecipe[] = TOOL_TIERS.flatMap((tier) => {
  const material = TIER_INGREDIENTS[tier.id] ?? 'oak_planks';
  return TOOL_KINDS.map((kind) =>
    shaped(
      `${tier.id}_${kind}_recipe`,
      toolPattern(kind, material),
      `${tier.id}_${kind}`,
      1,
      ['tool'],
    ),
  );
});
