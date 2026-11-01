/**
 * Mob definition helper.
 *
 * Mobs are grouped into the four spawn categories. Every mob carries its own
 * spawn rules, drops and the one AI archetype that drives it.
 */

import type { DropTable, MobBehaviour, MobCategory, MobDef } from '../../core/types';
import { TAGS } from '../tags';

export interface MobSpec {
  id: string;
  name: string;
  category: MobCategory;
  behaviour: MobBehaviour;
  health: number;
  damage: number;
  armour?: number;
  knockbackResistance?: number;
  /** Width and height in blocks. */
  size: [number, number];
  burnsInDaylight?: boolean;
  rideable?: boolean;
  /** Biome ids the mob spawns in. */
  biomes: string[];
  /** Minimum and maximum light level. */
  light: [number, number];
  /** Required ground family, or `any`. */
  ground?: string;
  /** Spawn group size. */
  group?: [number, number];
  dimension?: 'overworld' | 'nether' | 'end';
  drops: DropTable[];
  tags?: string[];
}

/**
 * Stable small index the renderer can use to pick a body colour.
 *
 * The mob renderer builds its own procedural texture, so this is only a
 * palette hint — it must never be an atlas index.
 */
export function mobTextureIndex(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) & 0xffff;
  }
  return hash % 16;
}

export function defineMob(spec: MobSpec): MobDef {
  const mob: MobDef = {
    id: spec.id,
    displayName: spec.name,
    category: spec.category,
    behaviour: spec.behaviour,
    health: spec.health,
    damage: spec.damage,
    armour: spec.armour ?? 0,
    knockbackResistance: spec.knockbackResistance ?? 0,
    size: { w: spec.size[0], h: spec.size[1] },
    burnsInDaylight: spec.burnsInDaylight ?? false,
    spawn: {
      biomes: spec.biomes,
      lightLevel: spec.light,
      ground: spec.ground ?? 'any',
      group: spec.group ?? [1, 1],
      dimension: spec.dimension ?? 'overworld',
    },
    drops: spec.drops,
    tags: spec.tags ?? [spec.category],
    texture: mobTextureIndex(spec.id),
  };
  if (spec.rideable) mob.rideable = true;
  return mob;
}

/** Biome groups reused by several mobs. */
export const BIOME_GROUPS: Record<string, string[]> = {
  village: ['plains', 'desert', 'savanna', 'taiga', 'snowy_plains', 'swamp'],
  openLand: ['plains', 'sunflower_plains', 'meadow', 'savanna', 'forest', 'grove'],
  forest: ['forest', 'flower_forest', 'birch_forest', 'old_growth_birch_forest', 'taiga', 'grove'],
  cave: ['dripstone_caves', 'lush_caves', 'deep_dark'],
  cold: ['snowy_plains', 'ice_spikes', 'snowy_taiga', 'snowy_slopes', 'frozen_peaks', 'jagged_peaks', 'stony_peaks'],
  ocean: ['ocean', 'deep_ocean', 'lukewarm_ocean', 'cold_ocean', 'frozen_ocean', 'river'],
  desert: ['desert', 'desert_lakes', 'badlands', 'eroded_badlands', 'savanna', 'savanna_plateau'],
  jungle: ['bamboo_jungle', 'sparse_jungle', 'modified_jungle_edge'],
  nether: ['nether_wastes', 'crimson_forest', 'warped_forest', 'soul_sand_valley', 'basalt_deltas'],
  end: ['the_end', 'end_highlands', 'end_midlands', 'small_end_islands', 'end_barrens'],
};

/** A tag set for a vanilla-ish mob family. */
export function mobTags(category: MobCategory, extra: string[] = []): string[] {
  return [category, ...extra];
}

export const MOB_TAGS = TAGS;
