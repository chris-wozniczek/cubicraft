/**
 * Boss mobs — the two encounters that end a world.
 */

import type { MobDef } from '../../core/types';
import { mobDrop, rareDrop } from '../loot';
import { defineMob, mobTags } from './common';

export const BOSS_MOBS: MobDef[] = [
  defineMob({
    id: 'ender_dragon', name: 'Ender Dragon', category: 'boss', behaviour: 'boss',
    health: 200, damage: 10, armour: 6, knockbackResistance: 0.6, size: [4, 4],
    biomes: ['the_end', 'end_highlands', 'end_midlands', 'small_end_islands'],
    light: [0, 15], dimension: 'end', group: [1, 1],
    drops: [mobDrop('dragon_breath', 0, 1), rareDrop('nether_star'), rareDrop('ender_pearl')],
    tags: mobTags('boss', ['flying', 'end_boss']),
  }),
  defineMob({
    id: 'wither', name: 'Wither', category: 'boss', behaviour: 'boss',
    health: 300, damage: 8, armour: 8, knockbackResistance: 0.6, size: [0.9, 3.5],
    biomes: ['the_end', 'end_barrens', 'small_end_islands'],
    light: [0, 15], dimension: 'end', group: [1, 1],
    drops: [rareDrop('nether_star'), mobDrop('bone', 0, 6)],
    tags: mobTags('boss', ['flying']),
  }),
];
