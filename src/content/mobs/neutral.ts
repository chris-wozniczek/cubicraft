/**
 * Neutral mobs — they only fight when provoked.
 */

import type { MobDef } from '../../core/types';
import { mobDrop, rareDrop } from '../loot';
import { BIOME_GROUPS, defineMob, mobTags } from './common';

export const NEUTRAL_MOBS: MobDef[] = [
  defineMob({
    id: 'bee', name: 'Bee', category: 'neutral', behaviour: 'neutral',
    health: 10, damage: 2, size: [0.6, 0.55],
    biomes: ['meadow', 'plains', 'sunflower_plains', 'forest', 'flower_forest', 'cherry_grove', 'grove', 'savanna'],
    light: [7, 15], group: [1, 4],
    drops: [mobDrop('honey_bottle', 0, 1)], tags: mobTags('neutral', ['flying']),
  }),
  defineMob({
    id: 'cave_spider', name: 'Cave Spider', category: 'neutral', behaviour: 'neutral',
    health: 12, damage: 2, size: [0.5, 0.5],
    biomes: BIOME_GROUPS.cave, light: [0, 7], group: [1, 3],
    drops: [mobDrop('string', 0, 2)], tags: mobTags('neutral'),
  }),
  defineMob({
    id: 'copper_golem', name: 'Copper Golem', category: 'neutral', behaviour: 'neutral',
    health: 40, damage: 5, armour: 4, size: [1.1, 2.1],
    biomes: ['windswept_hills', 'badlands', 'eroded_badlands', 'desert'], light: [7, 15], group: [1,  1],
    drops: [mobDrop('copper_ingot', 2, 5)], tags: mobTags('neutral', ['golem']),
  }),
  defineMob({
    id: 'dolphin', name: 'Dolphin', category: 'neutral', behaviour: 'swimmer',
    health: 10, damage: 0, size: [0.9, 0.6],
    biomes: BIOME_GROUPS.ocean, light: [0, 15], group: [1, 5],
    drops: [mobDrop('raw_cod', 0, 1), mobDrop('raw_salmon', 0, 1)],
    tags: mobTags('neutral', ['aquatic']),
  }),
  defineMob({
    id: 'enderman', name: 'Enderman', category: 'neutral', behaviour: 'neutral',
    health: 40, damage: 7, knockbackResistance: 0.4, size: [0.6, 2.9],
    biomes: BIOME_GROUPS.openLand.concat(['the_end', 'end_highlands', 'end_midlands']),
    light: [0, 15], group: [1, 3],
    drops: [rareDrop('ender_pearl')], tags: mobTags('neutral', ['teleporting']),
  }),
  defineMob({
    id: 'goat', name: 'Goat', category: 'neutral', behaviour: 'neutral',
    health: 10, damage: 2, size: [0.9, 1.3],
    biomes: ['windswept_hills', 'windswept_gravelly_hills', 'windswept_forest', 'snowy_slopes', 'jagged_peaks', 'frozen_peaks'],
    light: [7, 15], group: [1, 3],
    drops: [mobDrop('goat_horn', 0, 1), mobDrop('raw_mutton', 1, 2)],
    tags: mobTags('neutral'),
  }),
  defineMob({
    id: 'iron_golem', name: 'Iron Golem', category: 'neutral', behaviour: 'neutral',
    health: 100, damage: 15, armour: 7, knockbackResistance: 0.4, size: [1.4, 2.7],
    biomes: BIOME_GROUPS.village.concat(['plains', 'desert']),
    light: [7, 15], group: [1, 1],
    drops: [mobDrop('iron_ingot', 3, 5)], tags: mobTags('neutral', ['golem']),
  }),
  defineMob({
    id: 'llama', name: 'Llama', category: 'neutral', behaviour: 'neutral',
    health: 22, damage: 1, size: [0.9, 1.87],
    biomes: ['windswept_hills', 'windswept_gravelly_hills', 'savanna', 'savanna_plateau', 'badlands'],
    light: [7, 15], group: [1, 4], rideable: true,
    drops: [mobDrop('leather', 0, 2)], tags: mobTags('neutral', ['rideable']),
  }),
  defineMob({
    id: 'panda', name: 'Panda', category: 'neutral', behaviour: 'neutral',
    health: 20, damage: 6, size: [1.3, 1.25],
    biomes: ['bamboo_jungle', 'grove'], light: [7, 15], group: [1, 2],
    drops: [mobDrop('bamboo_block', 0, 1)], tags: mobTags('neutral'),
  }),
  defineMob({
    id: 'piglin', name: 'Piglin', category: 'neutral', behaviour: 'neutral',
    health: 16, damage: 5, size: [0.6, 1.8],
    biomes: BIOME_GROUPS.nether, light: [7, 15], dimension: 'nether', group: [1, 3],
    drops: [mobDrop('gold_ingot', 0, 1)], tags: mobTags('neutral'),
  }),
  defineMob({
    id: 'piglin_brute', name: 'Piglin Brute', category: 'neutral', behaviour: 'neutral',
    health: 50, damage: 7, armour: 2, size: [0.6, 1.8],
    biomes: BIOME_GROUPS.nether, light: [7, 15], dimension: 'nether', group: [1, 1],
    drops: [mobDrop('gold_ingot', 1, 3)], tags: mobTags('neutral'),
  }),
  defineMob({
    id: 'polar_bear', name: 'Polar Bear', category: 'neutral', behaviour: 'neutral',
    health: 30, damage: 6, size: [1.4, 1.4],
    biomes: ['ice_spikes', 'frozen_ocean', 'snowy_plains'], light: [7, 15], group: [1, 2],
    drops: [mobDrop('raw_cod', 0, 2), mobDrop('raw_salmon', 0, 2)],
    tags: mobTags('neutral'),
  }),
  defineMob({
    id: 'snow_golem', name: 'Snow Golem', category: 'neutral', behaviour: 'neutral',
    health: 4, damage: 0, size: [0.7, 1.9],
    biomes: BIOME_GROUPS.cold, light: [7, 15], group: [1, 1],
    drops: [mobDrop('snowball', 0, 15)], tags: mobTags('neutral', ['golem']),
  }),
  defineMob({
    id: 'spider', name: 'Spider', category: 'neutral', behaviour: 'neutral',
    health: 16, damage: 2, size: [1.4, 0.9],
    biomes: ['plains', 'desert', 'forest', 'swamp', 'bamboo_jungle', 'sparse_jungle'],
    light: [7, 15], group: [1, 3],
    drops: [mobDrop('string', 0, 2), mobDrop('spider_eye', 0, 1)],
    tags: mobTags('neutral'),
  }),
  defineMob({
    id: 'strider', name: 'Strider', category: 'neutral', behaviour: 'neutral',
    health: 20, damage: 0, size: [0.9, 1.7],
    biomes: BIOME_GROUPS.nether, light: [7, 15], dimension: 'nether', group: [1, 2], rideable: true,
    drops: [mobDrop('string', 0, 2)], tags: mobTags('neutral', ['rideable']),
  }),
  defineMob({
    id: 'trader_llama', name: 'Trader Llama', category: 'neutral', behaviour: 'neutral',
    health: 22, damage: 1, size: [0.9, 1.87],
    biomes: BIOME_GROUPS.village, light: [7, 15], group: [1, 2], rideable: true,
    drops: [mobDrop('leather', 0, 2)], tags: mobTags('neutral', ['rideable']),
  }),
  defineMob({
    id: 'wolf', name: 'Wolf', category: 'neutral', behaviour: 'neutral',
    health: 8, damage: 4, size: [0.6, 0.85],
    biomes: ['forest', 'taiga', 'snowy_taiga', 'grove', 'old_growth_taiga'], light: [7, 15], group: [1, 4],
    drops: [rareDrop('wolf_armor')], tags: mobTags('neutral'),
  }),
  defineMob({
    id: 'zombified_piglin', name: 'Zombified Piglin', category: 'neutral', behaviour: 'neutral',
    health: 16, damage: 5, size: [0.6, 1.8],
    biomes: BIOME_GROUPS.nether, light: [7, 15], dimension: 'nether', group: [1, 3],
    drops: [mobDrop('rotten_flesh', 0, 1), rareDrop('gold_ingot')], tags: mobTags('neutral'),
  }),
  defineMob({
    id: 'zombified_villager', name: 'Zombified Villager', category: 'neutral', behaviour: 'neutral',
    health: 20, damage: 3, size: [0.6, 1.95],
    biomes: BIOME_GROUPS.village, light: [7, 15], group: [1, 1],
    drops: [mobDrop('rotten_flesh', 0, 1)], tags: mobTags('neutral'),
  }),
];
