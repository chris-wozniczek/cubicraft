/**
 * Cubicraft — terrain shape and column fill.
 *
 * The height field is a pure function of the world position, which is what
 * makes chunk borders seamless: chunk A's column 15 and chunk B's column 0
 * are two adjacent samples of one continuous field.
 *
 * SLOPE RULE:
 *   Neighbouring columns may differ by at most one block of height. The
 *   splines below are evaluated with smoothstep blending (derivative zero at
 *   every knot) and the noise amplitudes are chosen so the horizontal
 *   gradient of the whole height field stays below one block per block. The
 *   result is a landscape without cliffs — every feature is a smooth rise or
 *   a smooth fall, never a step.
 */

import { CHUNK_Y, CHUNK_Z, WORLD_MAX_Y, WORLD_MIN_Y } from '../core/types';
import { SEA_LEVEL, RIVER_BED } from './climate';
import type { ClimatePoint, ClimateSampler } from './climate';
import type { BiomeTableEntry, Dimension } from './biomes';
import { clamp01, spline, smoothstep01 } from './noise';
import type { Noise } from './noise';

// ---------------------------------------------------------------------------
// Block names
// ---------------------------------------------------------------------------

/**
 * Every block the generator can emit, with a dense numeric id.
 *
 * The generator never imports the content registry: it works purely with
 * names and the engine maps them to registry ids afterwards. The ids here are
 * an internal detail of the generator's scratch buffer.
 */
export const BLOCK_IDS = {
  air: 0,
  stone: 1,
  deepslate: 2,
  bedrock: 3,
  dirt: 4,
  grass_block: 5,
  sand: 6,
  sandstone: 7,
  gravel: 8,
  podzol: 9,
  coarse_dirt: 10,
  mud: 11,
  mycelium: 12,
  moss_block: 13,
  snow_block: 14,
  snow: 15,
  ice: 16,
  packed_ice: 17,
  water: 18,
  lava: 19,
  terracotta: 20,
  white_terracotta: 21,
  orange_terracotta: 22,
  yellow_terracotta: 23,
  brown_terracotta: 24,
  red_terracotta: 25,
  light_gray_terracotta: 26,
  netherrack: 28,
  soul_sand: 29,
  basalt: 30,
  crimson_nylium: 31,
  warped_nylium: 32,
  end_stone: 33,
  obsidian: 34,
  crying_obsidian: 35,
  cobblestone: 36,
  mossy_cobblestone: 37,
  stone_bricks: 38,
  chiseled_stone_bricks: 39,
  cracked_stone_bricks: 40,
  smooth_sandstone: 41,
  cut_sandstone: 42,
  oak_planks: 43,
  spruce_planks: 44,
  dark_oak_planks: 45,
  oak_log: 46,
  spruce_log: 47,
  birch_log: 48,
  jungle_log: 49,
  acacia_log: 50,
  dark_oak_log: 51,
  mangrove_log: 52,
  cherry_log: 53,
  pine_log: 54,
  poplar_log: 55,
  crimson_stem: 56,
  warped_stem: 57,
  chorus_plant: 58,
  oak_leaves: 59,
  spruce_leaves: 60,
  birch_leaves: 61,
  jungle_leaves: 62,
  acacia_leaves: 63,
  dark_oak_leaves: 64,
  mangrove_leaves: 65,
  cherry_leaves: 66,
  pine_leaves: 67,
  poplar_leaves: 68,
  crimson_roots: 69,
  warped_roots: 70,
  nether_sprouts: 71,
  grass: 72,
  tall_grass: 73,
  fern: 74,
  dead_bush: 75,
  dandelion: 76,
  poppy: 77,
  cornflower: 78,
  allium: 79,
  oxeye_daisy: 80,
  azure_bluet: 81,
  red_tulip: 82,
  white_tulip: 83,
  orange_tulip: 84,
  pink_tulip: 85,
  brown_mushroom: 86,
  red_mushroom: 87,
  blue_mushroom: 88,
  cactus: 89,
  sugar_cane: 90,
  pumpkin: 91,
  melon: 92,
  lily_pad: 93,
  kelp: 94,
  seagrass: 95,
  glow_berries: 96,
  vines: 97,
  pink_petals: 98,
  torch: 99,
  lantern: 100,
  spawner: 101,
  chest: 102,
  bookshelf: 103,
  rail: 104,
  oak_fence: 105,
  glass: 106,
  prismarine: 107,
  dark_prismarine: 108,
  purpur_block: 109,
  purpur_pillar: 110,
  end_stone_bricks: 111,
  end_crystal: 112,
  clay: 113,
  red_sand: 114,
  red_sandstone: 115,
  coal_ore: 116,
  deepslate_coal_ore: 117,
  iron_ore: 118,
  deepslate_iron_ore: 119,
  copper_ore: 120,
  deepslate_copper_ore: 121,
  gold_ore: 122,
  deepslate_gold_ore: 123,
  redstone_ore: 124,
  deepslate_redstone_ore: 125,
  lapis_ore: 126,
  deepslate_lapis_ore: 127,
  diamond_ore: 128,
  deepslate_diamond_ore: 129,
  emerald_ore: 130,
  deepslate_emerald_ore: 131,
  nether_gold_ore: 132,
  deepslate_nether_gold_ore: 133,
  ancient_debris: 134,
  deepslate_ancient_debris: 135,
  quartz_ore: 136,
  deepslate_quartz_ore: 137,
  nether_quartz_ore: 138,
  deepslate_nether_quartz_ore: 139,
  sunflower: 140,
  mangrove_propagule: 141,
  cherry_sapling: 142,
  cauldron: 143,
} as const;

/** Name of a block known to the generator. */
export type BlockName = keyof typeof BLOCK_IDS;

/** Block names indexed by their internal id. */
export const BLOCK_NAMES: string[] = (() => {
  const names: string[] = new Array(Object.keys(BLOCK_IDS).length);
  for (const key of Object.keys(BLOCK_IDS) as BlockName[]) names[BLOCK_IDS[key]] = key;
  return names;
})();

/** Index of a block inside a chunk's block array. */
export function blockIndex(x: number, y: number, z: number): number {
  return (x * CHUNK_Z + z) * CHUNK_Y + (y - WORLD_MIN_Y);
}

/** Index of a column inside a chunk's per-column arrays (x major). */
export function columnIndex(x: number, z: number): number {
  return x * CHUNK_Z + z;
}

// ---------------------------------------------------------------------------
// Height field
// ---------------------------------------------------------------------------

/**
 * Continentalness → base level.
 *
 * The slope of this curve is the largest single contributor to the terrain
 * gradient, so the ocean floor sits fairly high and the shore transition is
 * spread over a wide part of the curve.
 */
const CONT_BASE: readonly (readonly [number, number])[] = [
  [0.0, 48],
  [0.25, 50],
  [0.5, 54],
  [0.65, 60],
  [0.75, 64],
  [0.85, 66],
  [1.0, 67],
];

/** Erosion → the amplitude of the rolling hills. */
const EROSION_AMP: readonly (readonly [number, number])[] = [
  [0.0, 12],
  [0.4, 9],
  [0.7, 6],
  [1.0, 3.5],
];

/** Frequency and octave count of the hill field. */
const HILL_FREQ = 0.0015;
const HILL_OCTAVES = 3;
/** Overall scale of the rolling hills. */
const HILL_SCALE = 1.0;

/** Peak of the alpine rise above the base level. */
const MOUNTAIN_HEIGHT = 26;
/** Frequency of the field that decides where the mountains are. */
const PEAK_FREQ = 0.0004;
/** Height of the ridged spines on top of the mountains. */
const RIDGE_HEIGHT = 7;
/** The deepest a river may cut into the land. */
const RIVER_DEPTH = 6;

/** The sea floor never rises above this. */
const MIN_HEIGHT = WORLD_MIN_Y + 8;
/** The highest land the generator produces. */
const MAX_HEIGHT = WORLD_MAX_Y - 40;

/** Deterministic 3D hash in [0,1) — used for bedrock jitter and similar. */
export function hash3(x: number, y: number, z: number): number {
  let h = Math.imul(x | 0, 0x8da6b343) ^ Math.imul(y | 0, 0xd8163841) ^ Math.imul(z | 0, 0xcb1ab31f);
  h = Math.imul(h ^ (h >>> 13), 0x27d4eb2f);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/**
 * Steps a height down into a two block band with a one block riser.
 *
 * A larger band would produce a taller step, and a taller step would break
 * the one-block-per-column rule, so the badlands terrace uses the smallest
 * band that still reads as a terrace. The coloured terracotta strata below
 * carry most of the badlands look.
 */
function terrace(height: number): number {
  const band = 2;
  const k = Math.floor(height / band);
  const frac = height - k * band;
  return k * band + Math.min(frac, 1);
}

/** How "badlands-like" a climate is, 0..1. */
export function badlandsFactor(c: ClimatePoint): number {
  const hot = smoothstep01((c.temperature - 0.7) / 0.22);
  const dry = smoothstep01((0.5 - c.humidity) / 0.28);
  return hot * dry;
}

/**
 * The shape of the End's islands.
 *
 * The End is generated by a separate path (see `generateEndChunk`), but the
 * terrain sampler needs to know the same heights so the biome of a column
 * matches the island that stands on it. Both therefore use this function.
 */
export function endIslandHeight(
  noise: Noise,
  x: number,
  z: number,
): { top: number; bottom: number } | null {
  // The central island: a disc that thins towards its rim.
  const dist = Math.hypot(x, z);
  let top = -1;
  let bottom = -1;
  if (dist < 1400) {
    const fall = dist / 1400;
    top = Math.round(66 - fall * 46);
    const thickness = Math.max(2, Math.round(28 - fall * 26));
    bottom = top - thickness;
  }

  // Floating islands: a 3D field above a threshold is an island.
  const island = noise.fbm3(x * 0.0075, 62 * 0.0125, z * 0.0075, 2);
  if (island > 0.19) {
    const iy = Math.round(40 + island * 260);
    const thick = Math.max(2, Math.round((island - 0.19) * 26));
    if (top < 0 || iy > top) {
      top = iy;
      bottom = iy - thick;
    }
  }

  return top < 0 ? null : { top, bottom };
}

/**
 * Builds the height field and fills the chunk columns.
 */
export class TerrainSampler {
  constructor(
    private readonly noise: Noise,
    private readonly climate: ClimateSampler,
    readonly dimension: Dimension = 'overworld',
  ) {}

  /** The terrain height at a world position (top solid block). */
  heightAt(x: number, z: number): number {
    return this.heightFromClimate(this.climate.sample(x, z), x, z);
  }

  /** The terrain height for an already sampled climate point. */
  heightFromClimate(c: ClimatePoint, x: number, z: number): number {
    if (this.dimension === 'nether') return this.netherHeight(c, x, z);
    if (this.dimension === 'end') return this.endHeight(x, z);

    // Large scale trend: ocean floor up to inland plains.
    let h = spline(CONT_BASE, c.continentalness);

    // Rolling hills, scaled by the erosion (flat = low amplitude).
    const amp = spline(EROSION_AMP, c.erosion) * HILL_SCALE;
    const detail = this.noise.fbm2(x * HILL_FREQ, z * HILL_FREQ, HILL_OCTAVES);
    h += detail * amp;

    // Alpine rise. The mask is a wide smoothstep so the mountain has no
    // derivative jump where it starts.
    const peakRaw = clamp01(0.5 + this.noise.fbm2(x * PEAK_FREQ, z * PEAK_FREQ, 2) * 2.2);
    const mask = smoothstep01((peakRaw - 0.06) / 0.88);
    h += mask * MOUNTAIN_HEIGHT;

    // Mountain spines.
    h += mask * c.ridges * RIDGE_HEIGHT;

    // River valleys carve down to just below sea level. The depth is capped
    // so that a river crossing a mountain cannot dig a cliff into it.
    if (c.river > 0) {
      const depth = RIVER_DEPTH * c.river * clamp01((h - RIVER_BED) / RIVER_DEPTH);
      h -= depth;
    }

    // Badlands: a one block staircase over the raw height.
    const bad = badlandsFactor(c);
    if (bad > 0) h += (terrace(h) - h) * bad;

    const rounded = Math.round(h);
    return rounded < MIN_HEIGHT ? MIN_HEIGHT : rounded > MAX_HEIGHT ? MAX_HEIGHT : rounded;
  }

  /** Nether surface height — a low, rolling hell. */
  private netherHeight(c: ClimatePoint, x: number, z: number): number {
    const base = 48;
    const detail = this.noise.fbm2(x * 0.006, z * 0.006, 3);
    const rough = this.noise.ridged2(x * 0.004, z * 0.004, 2);
    const h = base + detail * 16 + (rough - 0.5) * 22 + c.erosion * 8;
    const rounded = Math.round(h);
    return rounded < 34 ? 34 : rounded > 120 ? 120 : rounded;
  }

  /** End islands float, so the "height" is the top of the island above. */
  private endHeight(x: number, z: number): number {
    const island = endIslandHeight(this.noise, x, z);
    return island ? island.top : WORLD_MIN_Y;
  }

  /**
   * Fill one column of the chunk buffer with stone, surface and water.
   *
   * `x`/`z` are chunk-local, `height` is the world height of the top solid
   * block.
   */
  fillColumn(
    blocks: Uint8Array,
    x: number,
    z: number,
    height: number,
    biome: BiomeTableEntry,
    worldX: number,
    worldZ: number,
  ): void {
    const dim = this.dimension;

    if (dim === 'nether') {
      this.fillNetherColumn(blocks, x, z, height, biome, worldX, worldZ);
      return;
    }
    if (dim === 'end') {
      return; // the end is generated by the end-island pass
    }

    const stone = BLOCK_IDS.stone;
    const deepslate = BLOCK_IDS.deepslate;
    const bedrock = BLOCK_IDS.bedrock;

    for (let y = WORLD_MIN_Y; y <= height; y++) {
      let block: number = y < 0 ? deepslate : stone;
      if (y === WORLD_MIN_Y) {
        block = bedrock;
      } else if (y < WORLD_MIN_Y + 4 && hash3(worldX, y, worldZ) < 0.6 - (y - WORLD_MIN_Y) * 0.2) {
        block = bedrock;
      }
      blocks[blockIndex(x, y, z)] = block;
    }

    // Surface block plus a few blocks of filler.
    const surface = BLOCK_IDS[biome.surface as BlockName] ?? BLOCK_IDS.grass_block;
    const filler = BLOCK_IDS[biome.filler as BlockName] ?? BLOCK_IDS.dirt;
    blocks[blockIndex(x, height, z)] = surface;
    for (let i = 1; i <= 3; i++) {
      const y = height - i;
      if (y <= WORLD_MIN_Y) break;
      blocks[blockIndex(x, y, z)] = filler;
    }

    // Badlands get banded terracotta strata instead of a flat filler.
    if (biome.filler === 'terracotta') {
      for (let y = height - 4; y <= height - 3; y++) {
        if (y <= WORLD_MIN_Y) break;
        const band = Math.floor(y / 3) % 4;
        const colour =
          band === 0
            ? BLOCK_IDS.orange_terracotta
            : band === 1
              ? BLOCK_IDS.white_terracotta
              : band === 2
                ? BLOCK_IDS.terracotta
                : BLOCK_IDS.yellow_terracotta;
        blocks[blockIndex(x, y, z)] = colour;
      }
    }

    // Water fills everything up to sea level.
    if (height < SEA_LEVEL) {
      const frozen = biome.frozen;
      for (let y = height + 1; y < SEA_LEVEL; y++) {
        blocks[blockIndex(x, y, z)] = BLOCK_IDS.water;
      }
      blocks[blockIndex(x, SEA_LEVEL, z)] = frozen ? BLOCK_IDS.ice : BLOCK_IDS.water;
    }
  }

  /** Nether column: bedrock, a lava sea and netherrack on top. */
  private fillNetherColumn(
    blocks: Uint8Array,
    x: number,
    z: number,
    height: number,
    biome: BiomeTableEntry,
    worldX: number,
    worldZ: number,
  ): void {
    for (let y = WORLD_MIN_Y; y <= height; y++) {
      let block: number = BLOCK_IDS.netherrack;
      if (y === WORLD_MIN_Y) {
        block = BLOCK_IDS.bedrock;
      } else if (y < WORLD_MIN_Y + 4 && hash3(worldX, y, worldZ) < 0.6) {
        block = BLOCK_IDS.bedrock;
      }
      blocks[blockIndex(x, y, z)] = block;
    }

    // The lava sea fills the bottom of the nether wherever it is open.
    for (let y = WORLD_MIN_Y + 1; y <= 31 && y <= height; y++) {
      blocks[blockIndex(x, y, z)] = BLOCK_IDS.lava;
    }
    if (height > 31) blocks[blockIndex(x, 31, z)] = BLOCK_IDS.lava;

    // Surface material of the nether biome.
    const surface = BLOCK_IDS[biome.surface as BlockName] ?? BLOCK_IDS.netherrack;
    blocks[blockIndex(x, height, z)] = surface;
    for (let i = 1; i <= 3; i++) {
      const y = height - i;
      if (y <= WORLD_MIN_Y || y <= 31) break;
      blocks[blockIndex(x, y, z)] = BLOCK_IDS.netherrack;
    }
  }
}
