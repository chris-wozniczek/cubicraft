/**
 * The mob catalogue.
 *
 * `ALL_MOBS` is ordered by category so the spawn table reads top to bottom:
 * passive, neutral, hostile, boss.
 */

import type { MobDef } from '../../core/types';
import { PASSIVE_MOBS } from './passive';
import { NEUTRAL_MOBS } from './neutral';
import { HOSTILE_MOBS } from './hostile';
import { BOSS_MOBS } from './boss';

export const ALL_MOBS: MobDef[] = [
  ...PASSIVE_MOBS,
  ...NEUTRAL_MOBS,
  ...HOSTILE_MOBS,
  ...BOSS_MOBS,
];

export { PASSIVE_MOBS, NEUTRAL_MOBS, HOSTILE_MOBS, BOSS_MOBS };
export * from './common';
