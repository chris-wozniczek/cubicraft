/**
 * Stonecutter recipes — the shape variants of the cut stone family.
 *
 * The shape ids are derived from the base block id so they always match the
 * blocks the shape family generated.
 */

import type { RegisteredRecipe } from '../registries';
import { shaped } from './base';

interface StoneSource {
  id: string;
  /** The polished variant the stonecutter can produce. */
  polished?: string;
}

const SOURCES: readonly StoneSource[] = [
  { id: 'stone', polished: 'smooth_stone' },
  { id: 'cobblestone' },
  { id: 'stone_bricks' },
  { id: 'mossy_stone_bricks' },
  { id: 'cracked_stone_bricks' },
  { id: 'chiseled_stone_bricks' },
  { id: 'granite', polished: 'polished_granite' },
  { id: 'diorite', polished: 'polished_diorite' },
  { id: 'andesite', polished: 'polished_andesite' },
  { id: 'deepslate', polished: 'polished_deepslate' },
  { id: 'cobbled_deepslate' },
  { id: 'deepslate_bricks' },
  { id: 'cracked_deepslate_bricks' },
  { id: 'deepslate_tiles' },
  { id: 'cracked_deepslate_tiles' },
  { id: 'tuff' },
  { id: 'calcite' },
  { id: 'sandstone', polished: 'smooth_sandstone' },
  { id: 'red_sandstone', polished: 'smooth_red_sandstone' },
  { id: 'prismarine' },
  { id: 'dark_prismarine' },
  { id: 'netherrack' },
  { id: 'blackstone', polished: 'polished_blackstone' },
  { id: 'polished_blackstone' },
  { id: 'basalt', polished: 'polished_basalt' },
  { id: 'quartz_block', polished: 'smooth_quartz' },
  { id: 'purpur_block' },
  { id: 'end_stone_bricks' },
  { id: 'mud_bricks' },
  { id: 'obsidian' },
  { id: 'resin_block' },
  { id: 'bricks' },
  { id: 'nether_bricks' },
  { id: 'iron_block' },
  { id: 'gold_block' },
  { id: 'diamond_block' },
  { id: 'emerald_block' },
  { id: 'coal_block' },
  { id: 'lapis_block' },
  { id: 'amethyst_block' },
  { id: 'netherite_block' },
  { id: 'smooth_stone' },
  { id: 'smooth_sandstone' },
  { id: 'smooth_red_sandstone' },
  { id: 'smooth_quartz' },
  { id: 'polished_granite' },
  { id: 'polished_diorite' },
  { id: 'polished_andesite' },
  { id: 'polished_deepslate' },
  { id: 'polished_basalt' },
];

/** Every stonecutter recipe. */
export const STONECUTTING_RECIPES: RegisteredRecipe[] = SOURCES.flatMap((source) => {
  const out: RegisteredRecipe[] = [
    shaped(`stonecut_${source.id}_slab`, [[source.id]], `${source.id}_slab`, 2, ['stonecutting']),
    shaped(`stonecut_${source.id}_stairs`, [[source.id]], `${source.id}_stairs`, 1, ['stonecutting']),
    shaped(`stonecut_${source.id}_wall`, [[source.id]], `${source.id}_wall`, 1, ['stonecutting']),
  ];
  if (source.polished) {
    out.push(shaped(`stonecut_${source.id}_polished`, [[source.id]], source.polished, 1, ['stonecutting']));
  }
  return out;
});
