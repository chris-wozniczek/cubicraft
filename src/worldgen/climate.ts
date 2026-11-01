/**
 * Cubicraft — climate fields.
 *
 * The climate is the input to both the terrain shape and the biome choice.
 * Every field is sampled in WORLD space (absolute block X/Z) so that two
 * chunks meeting at a border agree on the climate of the columns next to the
 * seam — otherwise the border would show a visible discontinuity in height
 * and biome.
 */

import { WORLD_MIN_Y } from '../core/types';
import { biomeById, selectEndBiome, selectLandBiome, selectNetherBiome, selectWaterBiome } from './biomes';
import type { BiomeTableEntry, Dimension } from './biomes';
import { clamp01, smoothstep01 } from './noise';
import type { Noise } from './noise';

/** Sea level. Everything below this is water. */
export const SEA_LEVEL = 64;

/** The sampled climate of a single column. */
export interface ClimatePoint {
  /** 0 = deep ocean, 1 = inland land. */
  continentalness: number;
  /** 0 = mountainous, 1 = flat. */
  erosion: number;
  /** 0..1 — how strongly this column wants to be a mountain. */
  peaks: number;
  /** 0..1 — ridged mountain spines. */
  ridges: number;
  /** 0 = freezing, 1 = scorching. */
  temperature: number;
  /** 0 = arid, 1 = soaking. */
  humidity: number;
  /** 0 = dry, 1 = heavy precipitation. */
  downfall: number;
  /** 0..1 — 1 means "this is a river channel". */
  river: number;
}

/**
 * Frequency of the river field — rivers meander on a ~1700 block scale.
 */
const RIVER_FREQ = 0.0006;
/**
 * How wide the river channel is, measured on the ridged field.
 *
 * The profile is a plain linear ramp (not a smoothstep) on purpose: a
 * smoothstep would concentrate the whole height change of the bank into a
 * couple of blocks and break the one-block-per-column slope rule.
 */
const RIVER_WIDTH = 0.2;
/** The bed level rivers carve down to (just below sea level). */
export const RIVER_BED = 62;

/** Above this height a column is considered alpine. */
const PEAK_HEIGHT = 82;

/**
 * Samples the climate fields for a world seed.
 */
export class ClimateSampler {
  /**
   * Height provider, injected after construction because the terrain height
   * is derived from the climate and the biome choice needs the height. The
   * wiring is: noise → climate → terrain → (height provider) → climate.
   */
  private heightProvider: ((x: number, z: number) => number) | null = null;

  constructor(
    private readonly noise: Noise,
    readonly dimension: Dimension = 'overworld',
  ) {}

  /** Give the sampler access to the terrain height (set by the generator). */
  setHeightProvider(fn: (x: number, z: number) => number): void {
    this.heightProvider = fn;
  }

  /** Sample every climate field at a world position. */
  sample(x: number, z: number): ClimatePoint {
    const n = this.noise;

    // Continentalness is deliberately low-frequency: a continent needs room
    // for a gradual shoreline, otherwise the coast becomes a cliff and the
    // height field stops being gentle enough for neighbouring columns to
    // stay within one block of each other.
    const continentalness = clamp01(0.5 + n.fbm2(x * 0.0007, z * 0.0007, 2) * 1.7);
    const erosion = clamp01(0.5 + n.fbm2(x * 0.0012, z * 0.0012, 2) * 1.7);

    // Peaks are rare: the raw field is thresholded and squared so the
    // mountain onset has no derivative jump (a jump would break the
    // one-block-per-column slope rule).
    const peakRaw = clamp01(0.5 + n.fbm2(x * 0.0016, z * 0.0016, 3) * 1.7);
    const peakMask = smoothstep01((peakRaw - 0.42) / 0.5);
    const peaks = peakMask * peakMask;

    const ridges = n.ridged2(x * 0.0022, z * 0.0022, 2);

    // Temperature and humidity move on a much finer scale than the
    // continents — they decide the biome, not the height, so they are free
    // to vary quickly.
    const temperature = clamp01(0.5 + n.fbm2(x * 0.0035, z * 0.0035, 3) * 1.7);
    const humidity = clamp01(0.5 + n.fbm2(x * 0.0032, z * 0.0032, 3) * 1.7);
    const downfall = clamp01(0.5 + n.fbm2(x * 0.0021, z * 0.0021, 2) * 1.6);

    return {
      continentalness,
      erosion,
      peaks,
      ridges,
      temperature,
      humidity,
      downfall,
      river: this.riverStrength(x, z),
    };
  }

  /**
   * How strongly a column sits inside a river channel: 1 at the centre of
   * the channel, 0 outside it.
   *
   * The channel follows the crest of a ridged noise field, which is what
   * gives rivers their long, connected shape. The ramp is linear so that
   * the gradient stays small; the bank of a river is then spread over many
   * blocks instead of a single step.
   */
  riverStrength(x: number, z: number): number {
    const ridge = this.noise.ridged2(x * RIVER_FREQ, z * RIVER_FREQ, 2);
    const t = (ridge - (1 - RIVER_WIDTH)) / RIVER_WIDTH;
    return t <= 0 ? 0 : t >= 1 ? 1 : t;
  }

  /**
   * The biome id at a world position.
   *
   * `y` matters for the underground biomes (dripstone / lush / deep dark);
   * for a surface lookup pass the height of the column.
   */
  biomeAt(x: number, z: number, y: number): string {
    return this.biomeFromClimate(this.sample(x, z), x, z, y);
  }

  /**
   * The biome id for an already sampled climate point.
   *
   * The generator samples the climate once per column and then needs both
   * the height and the biome, so the sampled point is passed in to avoid a
   * second, identical noise evaluation.
   */
  biomeFromClimate(c: ClimatePoint, x: number, z: number, y: number): string {
    if (y < WORLD_MIN_Y) return 'the_void';

    const height = this.heightProvider ? this.heightProvider(x, z) : y;

    if (this.dimension === 'nether') {
      return selectNetherBiome(c.humidity, c.erosion).id;
    }
    if (this.dimension === 'end') {
      const distance = Math.min(1, Math.hypot(x, z) / 2400);
      return selectEndBiome(height, distance).id;
    }

    // Subterranean biomes take over well below the surface.
    if (y < height - 24 && height < SEA_LEVEL + 24) {
      const cave = this.caveBiome(x, z, y);
      if (cave) return cave;
    }

    if (height < SEA_LEVEL) {
      const depth = clamp01((SEA_LEVEL - height) / 34);
      const frozen = c.temperature < 0.2;
      const river = c.river > 0.55;
      return selectWaterBiome(c.temperature, depth, river, frozen).id;
    }

    // Alpine columns override the climate match.
    if (height >= PEAK_HEIGHT) {
      if (c.temperature < 0.16) return 'frozen_peaks';
      if (c.temperature < 0.36) return 'jagged_peaks';
      return 'stony_peaks';
    }

    // Shores: a land column that sits at water level next to water.
    const shore = this.shoreBiome(x, z, height, c);
    if (shore) return shore;

    return selectLandBiome(c.temperature, c.humidity, c.downfall).id;
  }

  /** The cave biome for a deep column, or null when no cave biome applies. */
  private caveBiome(x: number, z: number, y: number): string | null {
    const n = this.noise.fbm3(x * 0.006, y * 0.01, z * 0.006, 2);
    if (n > 0.18) return 'lush_caves';
    if (n < -0.28) return 'deep_dark';
    if (y < 40) return 'dripstone_caves';
    return null;
  }

  /** The shore biome for a column sitting next to water, or null. */
  private shoreBiome(x: number, z: number, height: number, c: ClimatePoint): string | null {
    if (height > SEA_LEVEL + 2) return null;

    // A neighbour below sea level turns this column into a beach.
    let coastal = false;
    for (let i = 0; i < 4; i++) {
      const nx = x + (i === 0 ? 1 : i === 1 ? -1 : 0);
      const nz = z + (i === 2 ? 1 : i === 3 ? -1 : 0);
      const nh = this.heightProvider ? this.heightProvider(nx, nz) : SEA_LEVEL;
      if (nh < SEA_LEVEL) {
        coastal = true;
        break;
      }
    }
    if (!coastal) return null;

    if (c.temperature < 0.2) return 'snowy_beach';
    // Very steep ground next to water turns to bare stone.
    if (height >= SEA_LEVEL + 1) return 'stony_shore';
    return 'beach';
  }

  /** The full biome row for a world position. */
  biomeRowAt(x: number, z: number, y: number): BiomeTableEntry {
    return biomeById(this.biomeAt(x, z, y));
  }
}
