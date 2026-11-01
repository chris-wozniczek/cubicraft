/**
 * Cooking recipes — furnaces, blast furnaces and smokers.
 */

import type { RegisteredRecipe } from '../registries';
import { WOOD_SPECS } from '../blocks/woodFamily';
import { blasting, shaped, smoking } from './base';

const ORES: readonly [string, string][] = [
  ['iron_ore', 'iron_ingot'],
  ['raw_iron', 'iron_ingot'],
  ['gold_ore', 'gold_ingot'],
  ['raw_gold', 'gold_ingot'],
  ['copper_ore', 'copper_ingot'],
  ['raw_copper', 'copper_ingot'],
];

const FOODS: readonly [string, string][] = [
  ['raw_porkchop', 'cooked_porkchop'],
  ['raw_beef', 'cooked_beef'],
  ['raw_chicken', 'cooked_chicken'],
  ['raw_mutton', 'cooked_mutton'],
  ['raw_cod', 'cooked_cod'],
  ['raw_salmon', 'cooked_salmon'],
  ['raw_rabbit', 'cooked_rabbit'],
];

export const SMELTING_RECIPES: RegisteredRecipe[] = [
  ...ORES.map(([from, to]) => shaped(`smelt_${from}`, [[from]], to, 1, ['smelting'])),
  ...FOODS.map(([from, to]) => shaped(`smelt_${from}`, [[from]], to, 1, ['smelting'])),
  shaped('smelt_sand', [['sand']], 'glass', 1, ['smelting']),
  shaped('smelt_red_sand', [['red_sand']], 'glass', 1, ['smelting']),
  shaped('smelt_cobblestone', [['cobblestone']], 'stone', 1, ['smelting']),
  shaped('smelt_stone', [['stone']], 'smooth_stone', 1, ['smelting']),
  shaped('smelt_clay_ball', [['clay_ball']], 'brick', 1, ['smelting']),
  shaped('smelt_netherrack', [['netherrack']], 'nether_brick', 1, ['smelting']),
  shaped('smelt_potato', [['potato']], 'baked_potato', 1, ['smelting']),
  shaped('smelt_cactus', [['cactus']], 'green_dye', 1, ['smelting']),
  shaped('smelt_kelp', [['kelp']], 'dried_kelp', 1, ['smelting']),
  shaped('smelt_wet_sponge', [['wet_sponge']], 'sponge', 1, ['smelting']),
  ...WOOD_SPECS.filter((wood) => wood.kind === 'overworld').map((wood) =>
    shaped(`smelt_${wood.id}_log`, [[`${wood.id}_log`]], 'charcoal', 1, ['smelting']),
  ),
];

export const BLASTING_RECIPES: RegisteredRecipe[] = ORES.map(([from, to]) =>
  blasting(`blast_${from}`, from, to, 1, 100, ['blasting']),
);

export const SMOKING_RECIPES: RegisteredRecipe[] = FOODS.map(([from, to]) =>
  smoking(`smoke_${from}`, from, to, 1, 100, ['smoking']),
);
