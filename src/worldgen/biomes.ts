/**
 * Cubicraft — biome table and climate → biome mapping.
 *
 * The table is pure data: the generator only ever refers to blocks by NAME so
 * that this package stays independent of the content registry's numeric ids.
 * The engine maps the names to ids after generation.
 *
 * Every biome in the table carries the climate coordinates (temperature /
 * humidity) it "wants". `selectLandBiome` picks the table entry whose wanted
 * climate is closest to the sampled climate, which is what produces a
 * continuous, data-driven biome distribution.
 */

/** Dimensions the generator can produce terrain for. */
export type Dimension = 'overworld' | 'nether' | 'end';

/** Tree species the decorator knows how to grow. */
export type TreeType =
  | 'oak'
  | 'spruce'
  | 'birch'
  | 'jungle'
  | 'acacia'
  | 'dark_oak'
  | 'mangrove'
  | 'cherry'
  | 'pine'
  | 'poplar'
  | 'crimson'
  | 'warped'
  | 'chorus';

/** A single row of the biome table. */
export interface BiomeTableEntry {
  /** Stable biome id, also used as the key in `GeneratedChunk.biomes`. */
  id: string;
  /** 0 = freezing, 1 = scorching. */
  temperature: number;
  /** 0 = arid, 1 = soaking. */
  humidity: number;
  /** 0 = dry, 1 = heavy precipitation (drives snow vs. rain). */
  downfall: number;
  dimension: Dimension;
  /** Block name of the very top block of a column. */
  surface: string;
  /** Block name used directly under the surface block. */
  filler: string;
  /** 0..1 — how much plant life this biome carries. */
  vegetation: number;
  /** Expected number of trees per chunk (0 = treeless). */
  treeDensity: number;
  treeType: TreeType | null;
  /** Relative likelihood; higher wins ties against the climate. */
  weight: number;
  /** True when the biome lies below the snow line. */
  snow: boolean;
  /** True when water in this biome freezes over. */
  frozen: boolean;
  /** True when the biome is an ocean or river. */
  water: boolean;
  /** True for the cave biomes (chosen underground, not by climate). */
  subterranean: boolean;
}

/** Shorthand used while building the table below. */
type Row = Omit<BiomeTableEntry, 'weight' | 'snow' | 'frozen' | 'water' | 'subterranean'> &
  Partial<Pick<BiomeTableEntry, 'weight' | 'snow' | 'frozen' | 'water' | 'subterranean'>>;

function row(r: Row): BiomeTableEntry {
  return {
    weight: 1,
    snow: false,
    frozen: false,
    water: false,
    subterranean: false,
    ...r,
  };
}

// ---------------------------------------------------------------------------
// Overworld — caves and the void
// ---------------------------------------------------------------------------

const OVERWORLD_SPECIAL: BiomeTableEntry[] = [
  row({
    id: 'the_void', temperature: 0.5, humidity: 0.5, downfall: 0.5,
    dimension: 'overworld', surface: 'air', filler: 'air',
    vegetation: 0, treeDensity: 0, treeType: null, weight: 0.1,
  }),
  row({
    id: 'dripstone_caves', temperature: 0.5, humidity: 0.6, downfall: 0.5,
    dimension: 'overworld', surface: 'stone', filler: 'stone',
    vegetation: 0, treeDensity: 0, treeType: null, weight: 0.1, subterranean: true,
  }),
  row({
    id: 'lush_caves', temperature: 0.72, humidity: 0.9, downfall: 0.6,
    dimension: 'overworld', surface: 'moss_block', filler: 'dirt',
    vegetation: 0.05, treeDensity: 0, treeType: null, weight: 0.1, subterranean: true,
  }),
  row({
    id: 'deep_dark', temperature: 0.3, humidity: 0.85, downfall: 0.4,
    dimension: 'overworld', surface: 'stone', filler: 'stone',
    vegetation: 0, treeDensity: 0, treeType: null, weight: 0.1, subterranean: true,
  }),
];

// ---------------------------------------------------------------------------
// Overworld — water
// ---------------------------------------------------------------------------

const OVERWORLD_WATER: BiomeTableEntry[] = [
  row({
    id: 'ocean', temperature: 0.55, humidity: 0.5, downfall: 0.5,
    dimension: 'overworld', surface: 'sand', filler: 'dirt',
    vegetation: 0, treeDensity: 0, treeType: null, water: true,
  }),
  row({
    id: 'deep_ocean', temperature: 0.5, humidity: 0.5, downfall: 0.5,
    dimension: 'overworld', surface: 'gravel', filler: 'dirt',
    vegetation: 0, treeDensity: 0, treeType: null, water: true,
  }),
  row({
    id: 'frozen_ocean', temperature: 0.1, humidity: 0.5, downfall: 0.5,
    dimension: 'overworld', surface: 'gravel', filler: 'dirt',
    vegetation: 0, treeDensity: 0, treeType: null, water: true, frozen: true, snow: true,
  }),
  row({
    id: 'deep_frozen_ocean', temperature: 0.05, humidity: 0.5, downfall: 0.5,
    dimension: 'overworld', surface: 'gravel', filler: 'dirt',
    vegetation: 0, treeDensity: 0, treeType: null, water: true, frozen: true, snow: true,
  }),
  row({
    id: 'lukewarm_ocean', temperature: 0.85, humidity: 0.5, downfall: 0.5,
    dimension: 'overworld', surface: 'sand', filler: 'dirt',
    vegetation: 0, treeDensity: 0, treeType: null, water: true,
  }),
  row({
    id: 'deep_lukewarm_ocean', temperature: 0.8, humidity: 0.5, downfall: 0.5,
    dimension: 'overworld', surface: 'sand', filler: 'dirt',
    vegetation: 0, treeDensity: 0, treeType: null, water: true,
  }),
  row({
    id: 'cold_ocean', temperature: 0.25, humidity: 0.5, downfall: 0.5,
    dimension: 'overworld', surface: 'gravel', filler: 'dirt',
    vegetation: 0, treeDensity: 0, treeType: null, water: true,
  }),
  row({
    id: 'deep_cold_ocean', temperature: 0.2, humidity: 0.5, downfall: 0.5,
    dimension: 'overworld', surface: 'gravel', filler: 'dirt',
    vegetation: 0, treeDensity: 0, treeType: null, water: true,
  }),
  row({
    id: 'river', temperature: 0.55, humidity: 0.6, downfall: 0.6,
    dimension: 'overworld', surface: 'sand', filler: 'dirt',
    vegetation: 0.02, treeDensity: 0, treeType: null, water: true,
  }),
  row({
    id: 'frozen_river', temperature: 0.12, humidity: 0.6, downfall: 0.5,
    dimension: 'overworld', surface: 'sand', filler: 'dirt',
    vegetation: 0.02, treeDensity: 0, treeType: null, water: true, frozen: true, snow: true,
  }),
];

// ---------------------------------------------------------------------------
// Overworld — shores
// ---------------------------------------------------------------------------

const OVERWORLD_SHORE: BiomeTableEntry[] = [
  row({
    id: 'beach', temperature: 0.72, humidity: 0.55, downfall: 0.6,
    dimension: 'overworld', surface: 'sand', filler: 'sandstone',
    vegetation: 0.02, treeDensity: 0, treeType: null,
  }),
  row({
    id: 'snowy_beach', temperature: 0.12, humidity: 0.55, downfall: 0.5,
    dimension: 'overworld', surface: 'sand', filler: 'sandstone',
    vegetation: 0.01, treeDensity: 0, treeType: null, snow: true, frozen: true,
  }),
  row({
    id: 'stony_shore', temperature: 0.4, humidity: 0.45, downfall: 0.5,
    dimension: 'overworld', surface: 'stone', filler: 'gravel',
    vegetation: 0.02, treeDensity: 0, treeType: null,
  }),
];

// ---------------------------------------------------------------------------
// Overworld — land (41 biomes)
// ---------------------------------------------------------------------------

const OVERWORLD_LAND: BiomeTableEntry[] = [
  row({
    id: 'plains', temperature: 0.52, humidity: 0.42, downfall: 0.5,
    dimension: 'overworld', surface: 'grass_block', filler: 'dirt',
    vegetation: 0.9, treeDensity: 0.6, treeType: 'oak', weight: 1.4,
  }),
  row({
    id: 'sunflower_plains', temperature: 0.56, humidity: 0.5, downfall: 0.55,
    dimension: 'overworld', surface: 'grass_block', filler: 'dirt',
    vegetation: 1.0, treeDensity: 0.3, treeType: 'oak', weight: 0.7,
  }),
  row({
    id: 'snowy_plains', temperature: 0.14, humidity: 0.48, downfall: 0.5,
    dimension: 'overworld', surface: 'grass_block', filler: 'dirt',
    vegetation: 0.15, treeDensity: 0, treeType: null, snow: true,
  }),
  row({
    id: 'ice_spikes', temperature: 0.06, humidity: 0.56, downfall: 0.5,
    dimension: 'overworld', surface: 'grass_block', filler: 'dirt',
    vegetation: 0.05, treeDensity: 0, treeType: null, snow: true, frozen: true, weight: 0.35,
  }),
  row({
    id: 'desert', temperature: 0.9, humidity: 0.1, downfall: 0,
    dimension: 'overworld', surface: 'sand', filler: 'sandstone',
    vegetation: 0.03, treeDensity: 0, treeType: null, weight: 1.3,
  }),
  row({
    id: 'desert_lakes', temperature: 0.86, humidity: 0.16, downfall: 0,
    dimension: 'overworld', surface: 'sand', filler: 'sandstone',
    vegetation: 0.03, treeDensity: 0, treeType: null, weight: 0.45,
  }),
  row({
    id: 'swamp', temperature: 0.78, humidity: 0.82, downfall: 0.9,
    dimension: 'overworld', surface: 'mud', filler: 'dirt',
    vegetation: 0.7, treeDensity: 0.8, treeType: 'oak', weight: 1.1,
  }),
  row({
    id: 'swamp_hills', temperature: 0.72, humidity: 0.74, downfall: 0.9,
    dimension: 'overworld', surface: 'mud', filler: 'dirt',
    vegetation: 0.7, treeDensity: 0.7, treeType: 'oak', weight: 0.5,
  }),
  row({
    id: 'mangrove_swamp', temperature: 0.86, humidity: 0.92, downfall: 0.95,
    dimension: 'overworld', surface: 'mud', filler: 'dirt',
    vegetation: 0.6, treeDensity: 1.2, treeType: 'mangrove', weight: 0.55,
  }),
  row({
    id: 'forest', temperature: 0.6, humidity: 0.66, downfall: 0.8,
    dimension: 'overworld', surface: 'grass_block', filler: 'dirt',
    vegetation: 0.9, treeDensity: 3.2, treeType: 'oak', weight: 1.3,
  }),
  row({
    id: 'flower_forest', temperature: 0.58, humidity: 0.76, downfall: 0.85,
    dimension: 'overworld', surface: 'grass_block', filler: 'dirt',
    vegetation: 1.0, treeDensity: 1.6, treeType: 'oak', weight: 0.65,
  }),
  row({
    id: 'birch_forest', temperature: 0.5, humidity: 0.58, downfall: 0.65,
    dimension: 'overworld', surface: 'grass_block', filler: 'dirt',
    vegetation: 0.85, treeDensity: 2.6, treeType: 'birch', weight: 0.95,
  }),
  row({
    id: 'old_growth_birch_forest', temperature: 0.44, humidity: 0.54, downfall: 0.65,
    dimension: 'overworld', surface: 'grass_block', filler: 'dirt',
    vegetation: 0.85, treeDensity: 2.2, treeType: 'birch', weight: 0.65,
  }),
  row({
    id: 'dark_forest', temperature: 0.68, humidity: 0.86, downfall: 0.8,
    dimension: 'overworld', surface: 'grass_block', filler: 'dirt',
    vegetation: 0.6, treeDensity: 3.4, treeType: 'dark_oak', weight: 0.85,
  }),
  row({
    id: 'pale_garden', temperature: 0.46, humidity: 0.92, downfall: 0.7,
    dimension: 'overworld', surface: 'grass_block', filler: 'dirt',
    vegetation: 0.25, treeDensity: 1.4, treeType: 'dark_oak', weight: 0.45,
  }),
  row({
    id: 'taiga', temperature: 0.3, humidity: 0.52, downfall: 0.7,
    dimension: 'overworld', surface: 'podzol', filler: 'dirt',
    vegetation: 0.6, treeDensity: 2.2, treeType: 'spruce', weight: 1.1,
  }),
  row({
    id: 'snowy_taiga', temperature: 0.13, humidity: 0.64, downfall: 0.7,
    dimension: 'overworld', surface: 'podzol', filler: 'dirt',
    vegetation: 0.3, treeDensity: 1.8, treeType: 'spruce', weight: 0.95, snow: true,
  }),
  row({
    id: 'old_growth_taiga', temperature: 0.22, humidity: 0.44, downfall: 0.7,
    dimension: 'overworld', surface: 'podzol', filler: 'dirt',
    vegetation: 0.65, treeDensity: 2.6, treeType: 'spruce', weight: 0.65,
  }),
  row({
    id: 'old_growth_spruce_forest', temperature: 0.26, humidity: 0.7, downfall: 0.75,
    dimension: 'overworld', surface: 'podzol', filler: 'dirt',
    vegetation: 0.6, treeDensity: 3.0, treeType: 'pine', weight: 0.65,
  }),
  row({
    id: 'snowy_slopes', temperature: 0.16, humidity: 0.36, downfall: 0.6,
    dimension: 'overworld', surface: 'grass_block', filler: 'dirt',
    vegetation: 0.2, treeDensity: 0.3, treeType: 'spruce', weight: 0.75, snow: true,
  }),
  row({
    id: 'frozen_peaks', temperature: 0.04, humidity: 0.46, downfall: 0.6,
    dimension: 'overworld', surface: 'snow_block', filler: 'stone',
    vegetation: 0, treeDensity: 0, treeType: null, snow: true, frozen: true, weight: 0.6,
  }),
  row({
    id: 'jagged_peaks', temperature: 0.18, humidity: 0.3, downfall: 0.6,
    dimension: 'overworld', surface: 'snow_block', filler: 'stone',
    vegetation: 0, treeDensity: 0, treeType: null, snow: true, weight: 0.6,
  }),
  row({
    id: 'stony_peaks', temperature: 0.34, humidity: 0.26, downfall: 0.6,
    dimension: 'overworld', surface: 'stone', filler: 'stone',
    vegetation: 0, treeDensity: 0, treeType: null, weight: 0.6,
  }),
  row({
    id: 'meadow', temperature: 0.4, humidity: 0.34, downfall: 0.55,
    dimension: 'overworld', surface: 'grass_block', filler: 'dirt',
    vegetation: 1.0, treeDensity: 0.4, treeType: 'poplar', weight: 0.8,
  }),
  row({
    id: 'cherry_grove', temperature: 0.42, humidity: 0.7, downfall: 0.6,
    dimension: 'overworld', surface: 'grass_block', filler: 'dirt',
    vegetation: 0.9, treeDensity: 1.8, treeType: 'cherry', weight: 0.6,
  }),
  row({
    id: 'grove', temperature: 0.28, humidity: 0.62, downfall: 0.7,
    dimension: 'overworld', surface: 'grass_block', filler: 'dirt',
    vegetation: 0.5, treeDensity: 2.0, treeType: 'spruce', weight: 0.6, snow: true,
  }),
  row({
    id: 'bamboo_jungle', temperature: 0.88, humidity: 0.74, downfall: 0.9,
    dimension: 'overworld', surface: 'grass_block', filler: 'dirt',
    vegetation: 0.9, treeDensity: 2.8, treeType: 'jungle', weight: 0.6,
  }),
  row({
    id: 'sparse_jungle', temperature: 0.8, humidity: 0.66, downfall: 0.9,
    dimension: 'overworld', surface: 'grass_block', filler: 'dirt',
    vegetation: 0.85, treeDensity: 1.6, treeType: 'jungle', weight: 0.6,
  }),
  row({
    id: 'mushroom_field', temperature: 0.62, humidity: 0.95, downfall: 0.9,
    dimension: 'overworld', surface: 'mycelium', filler: 'dirt',
    vegetation: 0.35, treeDensity: 0, treeType: null, weight: 0.45,
  }),
  row({
    id: 'windswept_hills', temperature: 0.26, humidity: 0.4, downfall: 0.5,
    dimension: 'overworld', surface: 'grass_block', filler: 'dirt',
    vegetation: 0.35, treeDensity: 0.4, treeType: 'spruce', weight: 0.85,
  }),
  row({
    id: 'windswept_gravelly_hills', temperature: 0.32, humidity: 0.32, downfall: 0.5,
    dimension: 'overworld', surface: 'gravel', filler: 'dirt',
    vegetation: 0.25, treeDensity: 0.2, treeType: 'spruce', weight: 0.65,
  }),
  row({
    id: 'windswept_forest', temperature: 0.2, humidity: 0.5, downfall: 0.6,
    dimension: 'overworld', surface: 'grass_block', filler: 'dirt',
    vegetation: 0.45, treeDensity: 1.6, treeType: 'spruce', weight: 0.65,
  }),
  row({
    id: 'windswept_savanna', temperature: 0.7, humidity: 0.3, downfall: 0.4,
    dimension: 'overworld', surface: 'grass_block', filler: 'dirt',
    vegetation: 0.2, treeDensity: 0, treeType: null, weight: 0.65,
  }),
  row({
    id: 'shattered_savanna', temperature: 0.66, humidity: 0.22, downfall: 0.35,
    dimension: 'overworld', surface: 'grass_block', filler: 'dirt',
    vegetation: 0.25, treeDensity: 0.1, treeType: 'acacia', weight: 0.45,
  }),
  row({
    id: 'savanna', temperature: 0.76, humidity: 0.36, downfall: 0.4,
    dimension: 'overworld', surface: 'coarse_dirt', filler: 'dirt',
    vegetation: 0.45, treeDensity: 0.5, treeType: 'acacia', weight: 1.05,
  }),
  row({
    id: 'savanna_plateau', temperature: 0.72, humidity: 0.26, downfall: 0.4,
    dimension: 'overworld', surface: 'coarse_dirt', filler: 'dirt',
    vegetation: 0.35, treeDensity: 0.2, treeType: 'acacia', weight: 0.75,
  }),
  row({
    id: 'badlands', temperature: 0.98, humidity: 0.26, downfall: 0,
    dimension: 'overworld', surface: 'terracotta', filler: 'terracotta',
    vegetation: 0.05, treeDensity: 0, treeType: null, weight: 0.85,
  }),
  row({
    id: 'eroded_badlands', temperature: 0.84, humidity: 0.34, downfall: 0,
    dimension: 'overworld', surface: 'terracotta', filler: 'terracotta',
    vegetation: 0.05, treeDensity: 0, treeType: null, weight: 0.65,
  }),
  row({
    id: 'wooded_badlands', temperature: 0.8, humidity: 0.44, downfall: 0.15,
    dimension: 'overworld', surface: 'grass_block', filler: 'terracotta',
    vegetation: 0.4, treeDensity: 0.6, treeType: 'oak', weight: 0.6,
  }),
  row({
    id: 'modified_badlands_plateau', temperature: 0.78, humidity: 0.18, downfall: 0,
    dimension: 'overworld', surface: 'terracotta', filler: 'terracotta',
    vegetation: 0.03, treeDensity: 0, treeType: null, weight: 0.35,
  }),
  row({
    id: 'modified_jungle_edge', temperature: 0.82, humidity: 0.58, downfall: 0.85,
    dimension: 'overworld', surface: 'grass_block', filler: 'dirt',
    vegetation: 0.7, treeDensity: 1.2, treeType: 'jungle', weight: 0.45,
  }),
];

// ---------------------------------------------------------------------------
// Nether and End
// ---------------------------------------------------------------------------

const NETHER_BIOMES: BiomeTableEntry[] = [
  row({
    id: 'nether_wastes', temperature: 2.0, humidity: 0.0, downfall: 0,
    dimension: 'nether', surface: 'netherrack', filler: 'netherrack',
    vegetation: 0.1, treeDensity: 0, treeType: null, weight: 1.5,
  }),
  row({
    id: 'crimson_forest', temperature: 2.0, humidity: 0.4, downfall: 0,
    dimension: 'nether', surface: 'crimson_nylium', filler: 'netherrack',
    vegetation: 0.35, treeDensity: 1.4, treeType: 'crimson', weight: 1.0,
  }),
  row({
    id: 'warped_forest', temperature: 2.0, humidity: 0.4, downfall: 0,
    dimension: 'nether', surface: 'warped_nylium', filler: 'netherrack',
    vegetation: 0.35, treeDensity: 1.4, treeType: 'warped', weight: 1.0,
  }),
  row({
    id: 'soul_sand_valley', temperature: 2.0, humidity: 0.2, downfall: 0,
    dimension: 'nether', surface: 'soul_sand', filler: 'netherrack',
    vegetation: 0.05, treeDensity: 0, treeType: null, weight: 1.0,
  }),
  row({
    id: 'basalt_deltas', temperature: 2.0, humidity: 0.1, downfall: 0,
    dimension: 'nether', surface: 'basalt', filler: 'basalt',
    vegetation: 0.03, treeDensity: 0, treeType: null, weight: 1.0,
  }),
];

const END_BIOMES: BiomeTableEntry[] = [
  row({
    id: 'the_end', temperature: 0.5, humidity: 0.5, downfall: 0.5,
    dimension: 'end', surface: 'end_stone', filler: 'end_stone',
    vegetation: 0.15, treeDensity: 1.0, treeType: 'chorus', weight: 1.5,
  }),
  row({
    id: 'end_highlands', temperature: 0.5, humidity: 0.5, downfall: 0.5,
    dimension: 'end', surface: 'end_stone', filler: 'end_stone',
    vegetation: 0.2, treeDensity: 1.2, treeType: 'chorus', weight: 1.0,
  }),
  row({
    id: 'end_midlands', temperature: 0.5, humidity: 0.5, downfall: 0.5,
    dimension: 'end', surface: 'end_stone', filler: 'end_stone',
    vegetation: 0.18, treeDensity: 1.0, treeType: 'chorus', weight: 1.0,
  }),
  row({
    id: 'small_end_islands', temperature: 0.5, humidity: 0.5, downfall: 0.5,
    dimension: 'end', surface: 'end_stone', filler: 'end_stone',
    vegetation: 0.05, treeDensity: 0.2, treeType: 'chorus', weight: 0.8,
  }),
  row({
    id: 'end_barrens', temperature: 0.5, humidity: 0.5, downfall: 0.5,
    dimension: 'end', surface: 'end_stone', filler: 'end_stone',
    vegetation: 0.08, treeDensity: 0.3, treeType: 'chorus', weight: 0.8,
  }),
];

/** The complete biome table: 58 overworld + 5 nether + 5 end = 68 rows. */
export const BIOMES: BiomeTableEntry[] = [
  ...OVERWORLD_SPECIAL,
  ...OVERWORLD_WATER,
  ...OVERWORLD_SHORE,
  ...OVERWORLD_LAND,
  ...NETHER_BIOMES,
  ...END_BIOMES,
];

/** Fast id → row lookup. */
const BY_ID = new Map<string, BiomeTableEntry>(BIOMES.map((b) => [b.id, b]));

/** Look a biome row up by id. Throws on a typo — that is a programming error. */
export function biomeById(id: string): BiomeTableEntry {
  const entry = BY_ID.get(id);
  if (!entry) throw new Error(`[worldgen] unknown biome "${id}"`);
  return entry;
}

/** Look a biome row up by id without throwing. */
export function tryBiomeById(id: string): BiomeTableEntry | undefined {
  return BY_ID.get(id);
}

/** Land biomes are matched against the sampled climate. */
export const LAND_BIOMES: readonly BiomeTableEntry[] = OVERWORLD_LAND;
/** Shore biomes are chosen by proximity to water. */
export const SHORE_BIOMES: readonly BiomeTableEntry[] = OVERWORLD_SHORE;
/** Water biomes are chosen by the submerged height. */
export const WATER_BIOMES: readonly BiomeTableEntry[] = OVERWORLD_WATER;

/**
 * Pick the land biome whose wanted climate is closest to the sampled climate.
 *
 * Humidity is weighted heavier than temperature because Minecraft-style
 * biomes cluster along the humidity axis. `weight` biases the result towards
 * common biomes without removing the rarer variants entirely.
 */
export function selectLandBiome(
  temperature: number,
  humidity: number,
  downfall: number,
): BiomeTableEntry {
  let best = OVERWORLD_LAND[0];
  let bestScore = Number.POSITIVE_INFINITY;

  for (let i = 0; i < OVERWORLD_LAND.length; i++) {
    const b = OVERWORLD_LAND[i];
    const dt = temperature - b.temperature;
    const dh = humidity - b.humidity;
    const dd = downfall - b.downfall;
    // Snow line: a very cold but wet climate drifts towards the snowy
    // variants, a very cold and dry one towards the frozen peaks.
    let score = dt * dt * 1.0 + dh * dh * 1.6 + dd * dd * 0.25;
    score /= b.weight;
    if (score < bestScore) {
      bestScore = score;
      best = b;
    }
  }
  return best;
}

/** Ocean / river biome for a submerged column. */
export function selectWaterBiome(
  temperature: number,
  depth: number,
  river: boolean,
  frozen: boolean,
): BiomeTableEntry {
  if (river) {
    return frozen ? biomeById('frozen_river') : biomeById('river');
  }
  const deep = depth > 0.5;
  if (temperature < 0.18) return deep ? biomeById('deep_frozen_ocean') : biomeById('frozen_ocean');
  if (temperature < 0.36) return deep ? biomeById('deep_cold_ocean') : biomeById('cold_ocean');
  if (temperature > 0.78) return deep ? biomeById('deep_lukewarm_ocean') : biomeById('lukewarm_ocean');
  return deep ? biomeById('deep_ocean') : biomeById('ocean');
}

/** The nether biome for a column. */
export function selectNetherBiome(humidity: number, erosion: number): BiomeTableEntry {
  if (erosion > 0.62) return biomeById('basalt_deltas');
  if (humidity > 0.62) return biomeById('crimson_forest');
  if (humidity < 0.38) return biomeById('soul_sand_valley');
  if (humidity > 0.5) return biomeById('warped_forest');
  return biomeById('nether_wastes');
}

/** The end biome for a column. */
export function selectEndBiome(height: number, distance: number): BiomeTableEntry {
  if (height < 40 && distance > 0.6) return biomeById('small_end_islands');
  if (height > 110) return biomeById('end_highlands');
  if (height > 70) return biomeById('end_midlands');
  if (distance > 0.75) return biomeById('end_barrens');
  return biomeById('the_end');
}
