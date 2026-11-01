/**
 * The biome table — 68 biomes across the three dimensions.
 *
 * `surface` and `filler` are block ids the world generator places directly,
 * so they always name a block that exists in the block registry.
 */

import type { RegisteredBiome } from './registries';

export interface BiomeSpec {
  id: string;
  name: string;
  dimension: 'overworld' | 'nether' | 'end';
  temperature: number;
  humidity: number;
  downfall: number;
  /** Block id of the top block of a column. */
  surface: string;
  /** Block id directly under the surface. */
  filler: string;
  /** 0..1 vegetation density. */
  vegetation: number;
  /** Mob spawn weighting. */
  mobs: Record<string, number>;
  sky: 'day' | 'night' | 'dusk';
}

function biome(spec: BiomeSpec): RegisteredBiome {
  return {
    id: spec.id,
    displayName: spec.name,
    dimension: spec.dimension,
    temperature: spec.temperature,
    humidity: spec.humidity,
    downfall: spec.downfall,
    surface: spec.surface,
    filler: spec.filler,
    vegetation: spec.vegetation,
    mobs: spec.mobs,
    sky: spec.sky,
    tags: [spec.dimension, `biome/${spec.id}`],
  };
}

const M = {
  sheep: 1,
  cow: 1,
  pig: 1,
  chicken: 1,
  villager: 0.5,
  spider: 1,
  zombie: 1,
  skeleton: 1,
  creeper: 1,
  slime: 0.5,
} as const;

const OVERWORLD_MOBS: Record<string, number> = {
  sheep: M.sheep,
  cow: M.cow,
  pig: M.pig,
  chicken: M.chicken,
  villager: M.villager,
  spider: M.spider,
  zombie: M.zombie,
  skeleton: M.skeleton,
  creeper: M.creeper,
  slime: M.slime,
};

const biomeDefs: RegisteredBiome[] = [
  // -----------------------------------------------------------------------
  // Overworld — special and caves
  // -----------------------------------------------------------------------
  biome({
    id: 'the_void', name: 'The Void', dimension: 'overworld',
    temperature: 0.5, humidity: 0.5, downfall: 0.5,
    surface: 'air', filler: 'air', vegetation: 0, mobs: {}, sky: 'night',
  }),
  biome({
    id: 'dripstone_caves', name: 'Dripstone Caves', dimension: 'overworld',
    temperature: 0.5, humidity: 0.6, downfall: 0.5,
    surface: 'stone', filler: 'stone', vegetation: 0,
    mobs: { zombie: 1, skeleton: 1, creeper: 0.5, spider: 1, axolotl: 0.3, bat: 0.5 },
    sky: 'night',
  }),
  biome({
    id: 'lush_caves', name: 'Lush Caves', dimension: 'overworld',
    temperature: 0.72, humidity: 0.9, downfall: 0.6,
    surface: 'moss_block', filler: 'dirt', vegetation: 0.05,
    mobs: { axolotl: 0.5, goat: 0.3, bat: 0.5 }, sky: 'night',
  }),
  biome({
    id: 'deep_dark', name: 'Deep Dark', dimension: 'overworld',
    temperature: 0.3, humidity: 0.85, downfall: 0.4,
    surface: 'stone', filler: 'stone', vegetation: 0,
    mobs: { skeleton: 1, zombie: 1, creeper: 0.5, silverfish: 1, bat: 0.5 },
    sky: 'night',
  }),

  // -----------------------------------------------------------------------
  // Overworld — water
  // -----------------------------------------------------------------------
  biome({
    id: 'ocean', name: 'Ocean', dimension: 'overworld',
    temperature: 0.55, humidity: 0.5, downfall: 0.5,
    surface: 'sand', filler: 'dirt', vegetation: 0,
    mobs: { squid: 1, dolphin: 0.2, turtle: 0.1 }, sky: 'day',
  }),
  biome({
    id: 'deep_ocean', name: 'Deep Ocean', dimension: 'overworld',
    temperature: 0.5, humidity: 0.5, downfall: 0.5,
    surface: 'gravel', filler: 'dirt', vegetation: 0,
    mobs: { squid: 1, guardian: 0.1, dolphin: 0.2 }, sky: 'day',
  }),
  biome({
    id: 'frozen_ocean', name: 'Frozen Ocean', dimension: 'overworld',
    temperature: 0.1, humidity: 0.5, downfall: 0.5,
    surface: 'sand', filler: 'dirt', vegetation: 0,
    mobs: { squid: 0.5, polar_bear: 0.05 }, sky: 'day',
  }),
  biome({
    id: 'deep_frozen_ocean', name: 'Deep Frozen Ocean', dimension: 'overworld',
    temperature: 0.05, humidity: 0.5, downfall: 0.5,
    surface: 'gravel', filler: 'dirt', vegetation: 0,
    mobs: { squid: 0.5 }, sky: 'day',
  }),
  biome({
    id: 'lukewarm_ocean', name: 'Lukewarm Ocean', dimension: 'overworld',
    temperature: 0.85, humidity: 0.5, downfall: 0.5,
    surface: 'sand', filler: 'dirt', vegetation: 0,
    mobs: { squid: 1, dolphin: 0.3 }, sky: 'day',
  }),
  biome({
    id: 'deep_lukewarm_ocean', name: 'Deep Lukewarm Ocean', dimension: 'overworld',
    temperature: 0.8, humidity: 0.5, downfall: 0.5,
    surface: 'sand', filler: 'dirt', vegetation: 0,
    mobs: { squid: 1, guardian: 0.1 }, sky: 'day',
  }),
  biome({
    id: 'cold_ocean', name: 'Cold Ocean', dimension: 'overworld',
    temperature: 0.25, humidity: 0.5, downfall: 0.5,
    surface: 'sand', filler: 'dirt', vegetation: 0,
    mobs: { squid: 1 }, sky: 'day',
  }),
  biome({
    id: 'deep_cold_ocean', name: 'Deep Cold Ocean', dimension: 'overworld',
    temperature: 0.2, humidity: 0.5, downfall: 0.5,
    surface: 'sand', filler: 'dirt', vegetation: 0,
    mobs: { squid: 1, guardian: 0.1 }, sky: 'day',
  }),
  biome({
    id: 'river', name: 'River', dimension: 'overworld',
    temperature: 0.55, humidity: 0.6, downfall: 0.6,
    surface: 'sand', filler: 'dirt', vegetation: 0.1,
    mobs: { squid: 0.5 }, sky: 'day',
  }),
  biome({
    id: 'frozen_river', name: 'Frozen River', dimension: 'overworld',
    temperature: 0.12, humidity: 0.6, downfall: 0.5,
    surface: 'sand', filler: 'dirt', vegetation: 0,
    mobs: { squid: 0.2 }, sky: 'day',
  }),

  // -----------------------------------------------------------------------
  // Overworld — beaches
  // -----------------------------------------------------------------------
  biome({
    id: 'beach', name: 'Beach', dimension: 'overworld',
    temperature: 0.72, humidity: 0.55, downfall: 0.6,
    surface: 'sand', filler: 'sandstone', vegetation: 0.02,
    mobs: { turtle: 0.1 }, sky: 'day',
  }),
  biome({
    id: 'snowy_beach', name: 'Snowy Beach', dimension: 'overworld',
    temperature: 0.12, humidity: 0.55, downfall: 0.5,
    surface: 'snow_block', filler: 'stone', vegetation: 0,
    mobs: { rabbit: 0.2 }, sky: 'day',
  }),
  biome({
    id: 'stony_shore', name: 'Stony Shore', dimension: 'overworld',
    temperature: 0.4, humidity: 0.45, downfall: 0.5,
    surface: 'stone', filler: 'gravel', vegetation: 0,
    mobs: { squid: 0.2 }, sky: 'day',
  }),

  // -----------------------------------------------------------------------
  // Overworld — land
  // -----------------------------------------------------------------------
  biome({
    id: 'plains', name: 'Plains', dimension: 'overworld',
    temperature: 0.52, humidity: 0.42, downfall: 0.5,
    surface: 'grass_block', filler: 'dirt', vegetation: 0.4,
    mobs: OVERWORLD_MOBS, sky: 'day',
  }),
  biome({
    id: 'sunflower_plains', name: 'Sunflower Plains', dimension: 'overworld',
    temperature: 0.56, humidity: 0.5, downfall: 0.55,
    surface: 'grass_block', filler: 'dirt', vegetation: 0.6,
    mobs: OVERWORLD_MOBS, sky: 'day',
  }),
  biome({
    id: 'snowy_plains', name: 'Snowy Plains', dimension: 'overworld',
    temperature: 0.14, humidity: 0.48, downfall: 0.5,
    surface: 'snow_block', filler: 'stone', vegetation: 0.05,
    mobs: { rabbit: 1, polar_bear: 0.1, fox: 0.2, goat: 0.2 }, sky: 'day',
  }),
  biome({
    id: 'ice_spikes', name: 'Ice Spikes', dimension: 'overworld',
    temperature: 0.06, humidity: 0.56, downfall: 0.5,
    surface: 'snow_block', filler: 'stone', vegetation: 0,
    mobs: { polar_bear: 0.2 }, sky: 'day',
  }),
  biome({
    id: 'desert', name: 'Desert', dimension: 'overworld',
    temperature: 0.9, humidity: 0.1, downfall: 0,
    surface: 'sand', filler: 'sandstone', vegetation: 0,
    mobs: { rabbit: 0.4, camel: 0.3, husk: 0.5 }, sky: 'day',
  }),
  biome({
    id: 'desert_lakes', name: 'Desert Lakes', dimension: 'overworld',
    temperature: 0.86, humidity: 0.16, downfall: 0,
    surface: 'sand', filler: 'sandstone', vegetation: 0,
    mobs: { rabbit: 0.3, camel: 0.2, husk: 0.4 }, sky: 'day',
  }),
  biome({
    id: 'swamp', name: 'Swamp', dimension: 'overworld',
    temperature: 0.78, humidity: 0.82, downfall: 0.9,
    surface: 'grass_block', filler: 'dirt', vegetation: 0.4,
    mobs: { slime: 1, witch: 0.3, frog: 0.5, goat: 0.2 }, sky: 'dusk',
  }),
  biome({
    id: 'swamp_hills', name: 'Swamp Hills', dimension: 'overworld',
    temperature: 0.72, humidity: 0.74, downfall: 0.9,
    surface: 'grass_block', filler: 'dirt', vegetation: 0.35,
    mobs: { slime: 1, witch: 0.3, frog: 0.5 }, sky: 'dusk',
  }),
  biome({
    id: 'mangrove_swamp', name: 'Mangrove Swamp', dimension: 'overworld',
    temperature: 0.86, humidity: 0.92, downfall: 0.95,
    surface: 'grass_block', filler: 'dirt', vegetation: 0.45,
    mobs: { slime: 0.8, frog: 0.8, goat: 0.3 }, sky: 'dusk',
  }),
  biome({
    id: 'forest', name: 'Forest', dimension: 'overworld',
    temperature: 0.6, humidity: 0.66, downfall: 0.8,
    surface: 'grass_block', filler: 'dirt', vegetation: 0.5,
    mobs: { ...OVERWORLD_MOBS, wolf: 0.5, fox: 0.3 }, sky: 'day',
  }),
  biome({
    id: 'flower_forest', name: 'Flower Forest', dimension: 'overworld',
    temperature: 0.58, humidity: 0.76, downfall: 0.85,
    surface: 'grass_block', filler: 'dirt', vegetation: 0.7,
    mobs: OVERWORLD_MOBS, sky: 'day',
  }),
  biome({
    id: 'birch_forest', name: 'Birch Forest', dimension: 'overworld',
    temperature: 0.5, humidity: 0.58, downfall: 0.65,
    surface: 'grass_block', filler: 'dirt', vegetation: 0.45,
    mobs: OVERWORLD_MOBS, sky: 'day',
  }),
  biome({
    id: 'old_growth_birch_forest', name: 'Old Growth Birch Forest', dimension: 'overworld',
    temperature: 0.44, humidity: 0.54, downfall: 0.65,
    surface: 'grass_block', filler: 'dirt', vegetation: 0.55,
    mobs: OVERWORLD_MOBS, sky: 'day',
  }),
  biome({
    id: 'dark_forest', name: 'Dark Forest', dimension: 'overworld',
    temperature: 0.68, humidity: 0.86, downfall: 0.8,
    surface: 'grass_block', filler: 'dirt', vegetation: 0.4,
    mobs: { ...OVERWORLD_MOBS, witch: 0.5, spider: 1 }, sky: 'night',
  }),
  biome({
    id: 'pale_garden', name: 'Pale Garden', dimension: 'overworld',
    temperature: 0.46, humidity: 0.92, downfall: 0.7,
    surface: 'grass_block', filler: 'dirt', vegetation: 0.25,
    mobs: { creaking: 0.6, wolf: 0.4 }, sky: 'night',
  }),
  biome({
    id: 'taiga', name: 'Taiga', dimension: 'overworld',
    temperature: 0.3, humidity: 0.52, downfall: 0.7,
    surface: 'grass_block', filler: 'dirt', vegetation: 0.4,
    mobs: { ...OVERWORLD_MOBS, wolf: 0.6, fox: 0.5, goat: 0.3 }, sky: 'day',
  }),
  biome({
    id: 'snowy_taiga', name: 'Snowy Taiga', dimension: 'overworld',
    temperature: 0.13, humidity: 0.64, downfall: 0.7,
    surface: 'snow_block', filler: 'stone', vegetation: 0.15,
    mobs: { wolf: 0.5, fox: 0.5, goat: 0.3, rabbit: 0.3 }, sky: 'day',
  }),
  biome({
    id: 'old_growth_taiga', name: 'Old Growth Taiga', dimension: 'overworld',
    temperature: 0.22, humidity: 0.44, downfall: 0.7,
    surface: 'grass_block', filler: 'dirt', vegetation: 0.5,
    mobs: { wolf: 0.7, fox: 0.6, goat: 0.4 }, sky: 'day',
  }),
  biome({
    id: 'old_growth_spruce_forest', name: 'Old Growth Spruce Forest', dimension: 'overworld',
    temperature: 0.26, humidity: 0.7, downfall: 0.75,
    surface: 'grass_block', filler: 'dirt', vegetation: 0.45,
    mobs: { wolf: 0.6, fox: 0.5, goat: 0.3 }, sky: 'day',
  }),
  biome({
    id: 'snowy_slopes', name: 'Snowy Slopes', dimension: 'overworld',
    temperature: 0.16, humidity: 0.36, downfall: 0.6,
    surface: 'snow_block', filler: 'stone', vegetation: 0.05,
    mobs: { goat: 0.5, rabbit: 0.3 }, sky: 'day',
  }),
  biome({
    id: 'frozen_peaks', name: 'Frozen Peaks', dimension: 'overworld',
    temperature: 0.04, humidity: 0.46, downfall: 0.6,
    surface: 'snow_block', filler: 'stone', vegetation: 0,
    mobs: { goat: 0.2, polar_bear: 0.1 }, sky: 'day',
  }),
  biome({
    id: 'jagged_peaks', name: 'Jagged Peaks', dimension: 'overworld',
    temperature: 0.18, humidity: 0.3, downfall: 0.6,
    surface: 'snow_block', filler: 'stone', vegetation: 0.05,
    mobs: { goat: 0.4 }, sky: 'day',
  }),
  biome({
    id: 'stony_peaks', name: 'Stony Peaks', dimension: 'overworld',
    temperature: 0.34, humidity: 0.26, downfall: 0.6,
    surface: 'stone', filler: 'stone', vegetation: 0.05,
    mobs: { goat: 0.4, sheep: 0.3 }, sky: 'day',
  }),
  biome({
    id: 'meadow', name: 'Meadow', dimension: 'overworld',
    temperature: 0.4, humidity: 0.34, downfall: 0.55,
    surface: 'grass_block', filler: 'dirt', vegetation: 0.6,
    mobs: { ...OVERWORLD_MOBS, bee: 0.5, cow: 0.8, sheep: 0.8 }, sky: 'day',
  }),
  biome({
    id: 'cherry_grove', name: 'Cherry Grove', dimension: 'overworld',
    temperature: 0.42, humidity: 0.7, downfall: 0.6,
    surface: 'grass_block', filler: 'dirt', vegetation: 0.5,
    mobs: { ...OVERWORLD_MOBS, allay: 0.3, bee: 0.4 }, sky: 'dusk',
  }),
  biome({
    id: 'grove', name: 'Grove', dimension: 'overworld',
    temperature: 0.28, humidity: 0.62, downfall: 0.7,
    surface: 'snow_block', filler: 'dirt', vegetation: 0.3,
    mobs: { wolf: 0.5, goat: 0.3, fox: 0.3, panda: 0.05 }, sky: 'day',
  }),
  biome({
    id: 'bamboo_jungle', name: 'Bamboo Jungle', dimension: 'overworld',
    temperature: 0.88, humidity: 0.74, downfall: 0.9,
    surface: 'grass_block', filler: 'dirt', vegetation: 0.6,
    mobs: { ...OVERWORLD_MOBS, panda: 0.4 }, sky: 'day',
  }),
  biome({
    id: 'sparse_jungle', name: 'Sparse Jungle', dimension: 'overworld',
    temperature: 0.8, humidity: 0.66, downfall: 0.9,
    surface: 'grass_block', filler: 'dirt', vegetation: 0.5,
    mobs: OVERWORLD_MOBS, sky: 'day',
  }),
  biome({
    id: 'mushroom_field', name: 'Mushroom Fields', dimension: 'overworld',
    temperature: 0.62, humidity: 0.95, downfall: 0.9,
    surface: 'mycelium', filler: 'dirt', vegetation: 0.2,
    mobs: { cow: 0.5, sheep: 0.3, chicken: 0.3 }, sky: 'day',
  }),
  biome({
    id: 'windswept_hills', name: 'Windswept Hills', dimension: 'overworld',
    temperature: 0.26, humidity: 0.4, downfall: 0.5,
    surface: 'grass_block', filler: 'dirt', vegetation: 0.2,
    mobs: { ...OVERWORLD_MOBS, goat: 0.5, llama: 0.2 }, sky: 'day',
  }),
  biome({
    id: 'windswept_gravelly_hills', name: 'Windswept Gravelly Hills', dimension: 'overworld',
    temperature: 0.32, humidity: 0.32, downfall: 0.5,
    surface: 'grass_block', filler: 'dirt', vegetation: 0.15,
    mobs: { ...OVERWORLD_MOBS, goat: 0.5, llama: 0.2 }, sky: 'day',
  }),
  biome({
    id: 'windswept_forest', name: 'Windswept Forest', dimension: 'overworld',
    temperature: 0.2, humidity: 0.5, downfall: 0.6,
    surface: 'grass_block', filler: 'dirt', vegetation: 0.3,
    mobs: { ...OVERWORLD_MOBS, wolf: 0.4, goat: 0.3 }, sky: 'day',
  }),
  biome({
    id: 'windswept_savanna', name: 'Windswept Savanna', dimension: 'overworld',
    temperature: 0.7, humidity: 0.3, downfall: 0.4,
    surface: 'grass_block', filler: 'dirt', vegetation: 0.15,
    mobs: { ...OVERWORLD_MOBS, camel: 0.2, llama: 0.2 }, sky: 'day',
  }),
  biome({
    id: 'shattered_savanna', name: 'Shattered Savanna', dimension: 'overworld',
    temperature: 0.66, humidity: 0.22, downfall: 0.35,
    surface: 'grass_block', filler: 'dirt', vegetation: 0.1,
    mobs: { ...OVERWORLD_MOBS, camel: 0.3 }, sky: 'day',
  }),
  biome({
    id: 'savanna', name: 'Savanna', dimension: 'overworld',
    temperature: 0.76, humidity: 0.36, downfall: 0.4,
    surface: 'grass_block', filler: 'dirt', vegetation: 0.35,
    mobs: { ...OVERWORLD_MOBS, cow: 0.6, sheep: 0.5, llama: 0.2 }, sky: 'day',
  }),
  biome({
    id: 'savanna_plateau', name: 'Savanna Plateau', dimension: 'overworld',
    temperature: 0.72, humidity: 0.26, downfall: 0.4,
    surface: 'grass_block', filler: 'dirt', vegetation: 0.25,
    mobs: { ...OVERWORLD_MOBS, cow: 0.4, sheep: 0.4 }, sky: 'day',
  }),
  biome({
    id: 'badlands', name: 'Badlands', dimension: 'overworld',
    temperature: 0.98, humidity: 0.26, downfall: 0,
    surface: 'terracotta', filler: 'terracotta', vegetation: 0,
    mobs: { rabbit: 0.4, camel: 0.2, husk: 0.3 }, sky: 'day',
  }),
  biome({
    id: 'eroded_badlands', name: 'Eroded Badlands', dimension: 'overworld',
    temperature: 0.84, humidity: 0.34, downfall: 0,
    surface: 'terracotta', filler: 'terracotta', vegetation: 0,
    mobs: { rabbit: 0.3, husk: 0.3 }, sky: 'day',
  }),
  biome({
    id: 'wooded_badlands', name: 'Wooded Badlands', dimension: 'overworld',
    temperature: 0.8, humidity: 0.44, downfall: 0.15,
    surface: 'grass_block', filler: 'dirt', vegetation: 0.25,
    mobs: { ...OVERWORLD_MOBS, evoker: 0.2, vindicator: 0.2 }, sky: 'day',
  }),
  biome({
    id: 'modified_badlands_plateau', name: 'Modified Badlands Plateau', dimension: 'overworld',
    temperature: 0.78, humidity: 0.18, downfall: 0,
    surface: 'terracotta', filler: 'terracotta', vegetation: 0,
    mobs: { evoker: 0.2, vindicator: 0.2 }, sky: 'day',
  }),
  biome({
    id: 'modified_jungle_edge', name: 'Modified Jungle Edge', dimension: 'overworld',
    temperature: 0.82, humidity: 0.58, downfall: 0.85,
    surface: 'grass_block', filler: 'dirt', vegetation: 0.45,
    mobs: OVERWORLD_MOBS, sky: 'day',
  }),

  // -----------------------------------------------------------------------
  // Nether
  // -----------------------------------------------------------------------
  biome({
    id: 'nether_wastes', name: 'Nether Wastes', dimension: 'nether',
    temperature: 2, humidity: 0, downfall: 0,
    surface: 'netherrack', filler: 'netherrack', vegetation: 0.1,
    mobs: { zombified_piglin: 1, piglin: 1, ghast: 0.3, magma_cube: 0.3, hoglin: 0.2 },
    sky: 'night',
  }),
  biome({
    id: 'crimson_forest', name: 'Crimson Forest', dimension: 'nether',
    temperature: 2, humidity: 0.4, downfall: 0,
    surface: 'crimson_nylium', filler: 'netherrack', vegetation: 0.3,
    mobs: { piglin: 1, hoglin: 0.6, zoglin: 0.4, happy_ghast: 0.1 },
    sky: 'night',
  }),
  biome({
    id: 'warped_forest', name: 'Warped Forest', dimension: 'nether',
    temperature: 2, humidity: 0.4, downfall: 0,
    surface: 'warped_nylium', filler: 'netherrack', vegetation: 0.3,
    mobs: { piglin: 1, zoglin: 0.4, happy_ghast: 0.1 }, sky: 'night',
  }),
  biome({
    id: 'soul_sand_valley', name: 'Soul Sand Valley', dimension: 'nether',
    temperature: 2, humidity: 0.2, downfall: 0,
    surface: 'soul_sand', filler: 'netherrack', vegetation: 0.05,
    mobs: { skeleton: 1, wither_skeleton: 0.4, wet_ghast: 0.2 }, sky: 'night',
  }),
  biome({
    id: 'basalt_deltas', name: 'Basalt Deltas', dimension: 'nether',
    temperature: 2, humidity: 0.1, downfall: 0,
    surface: 'basalt', filler: 'basalt', vegetation: 0.05,
    mobs: { magma_cube: 1, piglin: 0.5, wet_ghast: 0.2, strider: 0.3 }, sky: 'night',
  }),

  // -----------------------------------------------------------------------
  // End
  // -----------------------------------------------------------------------
  biome({
    id: 'the_end', name: 'The End', dimension: 'end',
    temperature: 0.5, humidity: 0.5, downfall: 0.5,
    surface: 'end_stone', filler: 'end_stone', vegetation: 0,
    mobs: { enderman: 1 }, sky: 'night',
  }),
  biome({
    id: 'end_highlands', name: 'End Highlands', dimension: 'end',
    temperature: 0.5, humidity: 0.5, downfall: 0.5,
    surface: 'end_stone', filler: 'end_stone', vegetation: 0,
    mobs: { enderman: 1 }, sky: 'night',
  }),
  biome({
    id: 'end_midlands', name: 'End Midlands', dimension: 'end',
    temperature: 0.5, humidity: 0.5, downfall: 0.5,
    surface: 'end_stone', filler: 'end_stone', vegetation: 0,
    mobs: { enderman: 1 }, sky: 'night',
  }),
  biome({
    id: 'small_end_islands', name: 'Small End Islands', dimension: 'end',
    temperature: 0.5, humidity: 0.5, downfall: 0.5,
    surface: 'end_stone', filler: 'end_stone', vegetation: 0,
    mobs: { enderman: 0.5 }, sky: 'night',
  }),
  biome({
    id: 'end_barrens', name: 'End Barrens', dimension: 'end',
    temperature: 0.5, humidity: 0.5, downfall: 0.5,
    surface: 'end_stone', filler: 'end_stone', vegetation: 0,
    mobs: { enderman: 0.5, shulker: 0.2 }, sky: 'night',
  }),
];

/** Every biome, in canonical order. */
export const ALL_BIOMES: RegisteredBiome[] = biomeDefs;

/** Biome ids by dimension. */
export function biomeIds(dimension: 'overworld' | 'nether' | 'end'): string[] {
  return ALL_BIOMES.filter((b) => b.dimension === dimension).map((b) => b.id);
}
