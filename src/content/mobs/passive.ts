/**
 * Passive mobs — the 36 creatures that never attack the player.
 */

import type { MobDef } from '../../core/types';
import { mobDrop, rareDrop } from '../loot';
import { BIOME_GROUPS, defineMob, mobTags } from './common';

export const PASSIVE_MOBS: MobDef[] = [
  defineMob({
    id: 'allay', name: 'Allay', category: 'passive', behaviour: 'wander',
    health: 20, damage: 0, size: [0.6, 0.9],
    biomes: ['cherry_grove'], light: [9, 15], ground: 'any', group: [1, 3],
    drops: [], tags: mobTags('passive', ['flying']),
  }),
  defineMob({
    id: 'armadillo', name: 'Armadillo', category: 'passive', behaviour: 'wander',
    health: 12, damage: 0, size: [0.65, 0.65],
    biomes: ['savanna', 'savanna_plateau', 'windswept_savanna', 'shattered_savanna', 'desert', 'badlands'],
    light: [7, 15], group: [1, 3],
    drops: [rareDrop('armadillo_scute')], tags: mobTags('passive'),
  }),
  defineMob({
    id: 'axolotl', name: 'Axolotl', category: 'passive', behaviour: 'swimmer',
    health: 14, damage: 0, size: [0.75, 0.75],
    biomes: ['lush_caves', 'dripstone_caves'], light: [0, 8], ground: 'any', group: [1, 4],
    drops: [rareDrop('axolotl_bucket')], tags: mobTags('passive', ['aquatic']),
  }),
  defineMob({
    id: 'bat', name: 'Bat', category: 'passive', behaviour: 'flyer',
    health: 6, damage: 0, size: [0.5, 0.9],
    biomes: ['dripstone_caves', 'lush_caves', 'deep_dark'], light: [0, 7], group: [1, 8],
    drops: [], tags: mobTags('passive', ['flying']),
  }),
  defineMob({
    id: 'camel', name: 'Camel', category: 'passive', behaviour: 'wander',
    health: 32, damage: 0, size: [1.7, 2.375],
    biomes: ['desert', 'desert_lakes'], light: [7, 15], group: [1, 2], rideable: true,
    drops: [mobDrop('leather', 0, 2)], tags: mobTags('passive', ['rideable']),
  }),

  // The eleven cat variants share one stat line.
  ...(
    [
      ['cat_tabby', 'Tabby Cat'],
      ['cat_black', 'Black Cat'],
      ['cat_red', 'Red Cat'],
      ['cat_siamese', 'Siamese Cat'],
      ['cat_british_shorthair', 'British Shorthair Cat'],
      ['cat_calico', 'Calico Cat'],
      ['cat_persian', 'Persian Cat'],
      ['cat_ragdoll', 'Ragdoll Cat'],
      ['cat_white', 'White Cat'],
      ['cat_jellie', 'Jellie Cat'],
      ['cat_all_black', 'All Black Cat'],
    ] as const
  ).map(([id, name]) =>
    defineMob({
      id, name, category: 'passive', behaviour: 'wander',
      health: 10, damage: 0, size: [0.6, 0.7],
      biomes: BIOME_GROUPS.village,
      light: [9, 15], group: [1, 4],
      drops: [rareDrop('string')], tags: mobTags('passive', ['cat']),
    }),
  ),

  defineMob({
    id: 'chicken', name: 'Chicken', category: 'passive', behaviour: 'wander',
    health: 4, damage: 0, size: [0.4, 0.7],
    biomes: BIOME_GROUPS.openLand, light: [7, 15], group: [1, 4],
    drops: [mobDrop('feather', 0, 2), mobDrop('egg', 0, 1)],
    tags: mobTags('passive'),
  }),
  defineMob({
    id: 'cow', name: 'Cow', category: 'passive', behaviour: 'wander',
    health: 10, damage: 0, size: [0.9, 1.4],
    biomes: BIOME_GROUPS.openLand, light: [7, 15], group: [2, 4],
    drops: [mobDrop('leather', 0, 2), mobDrop('raw_beef', 1, 3)],
    tags: mobTags('passive'),
  }),
  defineMob({
    id: 'donkey', name: 'Donkey', category: 'passive', behaviour: 'wander',
    health: 20, damage: 0, size: [0.9, 1.4],
    biomes: BIOME_GROUPS.openLand, light: [7, 15], group: [1, 2], rideable: true,
    drops: [mobDrop('leather', 0, 2)], tags: mobTags('passive', ['rideable']),
  }),
  defineMob({
    id: 'fox', name: 'Fox', category: 'passive', behaviour: 'wander',
    health: 10, damage: 0, size: [0.6, 0.7],
    biomes: ['taiga', 'old_growth_taiga', 'snowy_taiga', 'old_growth_spruce_forest', 'grove'],
    light: [7, 15], group: [2, 4],
    drops: [rareDrop('egg')], tags: mobTags('passive', ['flee']),
  }),
  defineMob({
    id: 'frog', name: 'Frog', category: 'passive', behaviour: 'jumper',
    health: 10, damage: 0, size: [0.55, 0.55],
    biomes: ['swamp', 'mangrove_swamp'], light: [7, 15], group: [2, 5],
    drops: [rareDrop('slimeball')], tags: mobTags('passive'),
  }),
  defineMob({
    id: 'horse', name: 'Horse', category: 'passive', behaviour: 'wander',
    health: 30, damage: 0, size: [1.4, 1.6],
    biomes: BIOME_GROUPS.openLand, light: [7, 15], group: [2, 4], rideable: true,
    drops: [mobDrop('leather', 0, 2)], tags: mobTags('passive', ['rideable']),
  }),
  defineMob({
    id: 'mule', name: 'Mule', category: 'passive', behaviour: 'wander',
    health: 30, damage: 0, size: [0.9, 1.4],
    biomes: BIOME_GROUPS.openLand, light: [7, 15], group: [1, 2], rideable: true,
    drops: [mobDrop('leather', 0, 2)], tags: mobTags('passive', ['rideable']),
  }),
  defineMob({
    id: 'pig', name: 'Pig', category: 'passive', behaviour: 'wander',
    health: 10, damage: 0, size: [0.9, 0.9],
    biomes: BIOME_GROUPS.openLand, light: [7, 15], group: [1, 4], rideable: true,
    drops: [mobDrop('raw_porkchop', 1, 3)], tags: mobTags('passive', ['rideable']),
  }),
  defineMob({
    id: 'rabbit', name: 'Rabbit', category: 'passive', behaviour: 'wander',
    health: 3, damage: 0, size: [0.4, 0.5],
    biomes: ['desert', 'snowy_plains', 'snowy_taiga', 'meadow', 'plains', 'swamp'], light: [7, 15], group: [1, 4],
    drops: [mobDrop('rabbit_hide', 0, 1), mobDrop('raw_rabbit', 0, 1)],
    tags: mobTags('passive'),
  }),
  defineMob({
    id: 'sheep', name: 'Sheep', category: 'passive', behaviour: 'wander',
    health: 8, damage: 0, size: [0.9, 1.3],
    biomes: BIOME_GROUPS.openLand, light: [7, 15], group: [2, 4],
    drops: [mobDrop('raw_mutton', 1, 2), mobDrop('white_wool', 1, 1)],
    tags: mobTags('passive'),
  }),
  defineMob({
    id: 'sniffer', name: 'Sniffer', category: 'passive', behaviour: 'wander',
    health: 14, damage: 0, size: [1.9, 1.75],
    biomes: ['taiga', 'old_growth_taiga', 'snowy_taiga'],
    light: [7, 15], group: [1, 1],
    drops: [mobDrop('sniffer_egg', 0, 2)], tags: mobTags('passive'),
  }),
  defineMob({
    id: 'sniffer_sniffling', name: 'Sniffling Sniffer', category: 'passive', behaviour: 'digger',
    health: 14, damage: 0, size: [1.9, 1.75],
    biomes: ['old_growth_taiga', 'old_growth_spruce_forest', 'taiga'], light: [7, 15], group: [1, 1],
    drops: [mobDrop('sniffer_egg', 0, 2)], tags: mobTags('passive', ['variant']),
  }),
  defineMob({
    id: 'squid', name: 'Squid', category: 'passive', behaviour: 'swimmer',
    health: 10, damage: 0, size: [0.8, 0.8],
    biomes: BIOME_GROUPS.ocean, light: [0, 15], ground: 'any', group: [1, 4],
    drops: [mobDrop('ink_sac', 1, 3)], tags: mobTags('passive', ['aquatic']),
  }),
  defineMob({
    id: 'tadpole', name: 'Tadpole', category: 'passive', behaviour: 'swimmer',
    health: 1, damage: 0, size: [0.4, 0.4],
    biomes: ['swamp', 'mangrove_swamp'], light: [7, 15], group: [2, 6],
    drops: [rareDrop('tadpole_bucket')], tags: mobTags('passive', ['aquatic']),
  }),
  defineMob({
    id: 'turtle', name: 'Turtle', category: 'passive', behaviour: 'swimmer',
    health: 30, damage: 0, size: [1.2, 0.4],
    biomes: ['beach', 'lush_caves', 'ocean'], light: [7, 15], group: [1, 4],
    drops: [rareDrop('turtle_scute'), rareDrop('turtle_egg')], tags: mobTags('passive', ['aquatic']),
  }),
  defineMob({
    id: 'mooshroom', name: 'Mooshroom', category: 'passive', behaviour: 'wander',
    health: 10, damage: 0, size: [0.9, 1.4],
    biomes: ['mushroom_field', 'swamp', 'plains'], light: [7, 15], group: [2, 4],
    drops: [mobDrop('raw_beef', 1, 3), rareDrop('milk_bucket')], tags: mobTags('passive'),
  }),
  defineMob({
    id: 'ocelot', name: 'Ocelot', category: 'passive', behaviour: 'wander',
    health: 10, damage: 0, size: [0.6, 0.7],
    biomes: ['bamboo_jungle', 'sparse_jungle', 'modified_jungle_edge'], light: [7, 15], group: [1, 2],
    drops: [rareDrop('raw_cod')], tags: mobTags('passive'),
  }),
  defineMob({
    id: 'parrot', name: 'Parrot', category: 'passive', behaviour: 'flyer',
    health: 6, damage: 0, size: [0.5, 0.9],
    biomes: ['bamboo_jungle', 'sparse_jungle'], light: [7, 15], group: [1, 2],
    drops: [rareDrop('feather')], tags: mobTags('passive', ['flying']),
  }),
  defineMob({
    id: 'glow_squid', name: 'Glow Squid', category: 'passive', behaviour: 'swimmer',
    health: 10, damage: 0, size: [0.8, 0.8],
    biomes: ['lush_caves', 'dripstone_caves'], light: [0, 7], group: [1, 4],
    drops: [mobDrop('glowstone_dust', 0, 2), mobDrop('ink_sac', 0, 2)],
    tags: mobTags('passive', ['aquatic']),
  }),
  defineMob({
    id: 'villager', name: 'Villager', category: 'passive', behaviour: 'villager',
    health: 20, damage: 0, size: [0.6, 1.95],
    biomes: BIOME_GROUPS.village, light: [7, 15], group: [1, 1],
    drops: [rareDrop('bread')], tags: mobTags('passive', [
      'villager/profession_armorer', 'villager/profession_butcher', 'villager/profession_cartographer',
      'villager/profession_cleric', 'villager/profession_farmer', 'villager/profession_fisherman',
      'villager/profession_fletcher', 'villager/profession_leatherworker', 'villager/profession_librarian',
      'villager/profession_mason', 'villager/profession_shepherd', 'villager/profession_toolsmith',
      'villager/profession_weaponsmith', 'villager/profession_unemployed', 'villager/profession_nitwit',
    ]),
  }),
];
