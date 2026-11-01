/**
 * Cubicraft — the chunk generator.
 *
 * `generateChunk` is the only entry point the engine needs. It produces a
 * flat array of block *names* (the engine maps the names to registry ids),
 * the biome of every column, a height map and the structures that were
 * placed.
 *
 * PERFORMANCE:
 *   The chunk is filled into a reusable `Uint8Array` scratch buffer that
 *   lives on the generator instance, so repeated generation does not churn
 *   the garbage collector. The scratch buffer is converted into the string
 *   array exactly once at the end of a chunk.
 */

import { CHUNK_X, CHUNK_Y, CHUNK_Z, WORLD_MAX_Y, WORLD_MIN_Y } from '../core/types';
import { ClimateSampler } from './climate';
import type { ClimatePoint } from './climate';
import { TerrainSampler, BLOCK_NAMES, BLOCK_IDS, columnIndex } from './terrain';
import { biomeById } from './biomes';
import type { Dimension } from './biomes';
import { CaveGenerator, fillCaveFluids, generateEndChunk } from './caves';
import { placeOres } from './ores';
import { applyDecoration, collectDecorations } from './decoration';
import type { DecorationSamplers } from './decoration';
import { buildStructure, structuresFor } from './structures';
import type { PlacedStructure } from './structures';
import { Noise } from './noise';

/** A generated chunk of the world. */
export interface GeneratedChunk {
  cx: number;
  cz: number;
  dimension: Dimension;
  /**
   * Block names, length CHUNK_X * CHUNK_Y * CHUNK_Z.
   * Index = (x * CHUNK_Z + z) * CHUNK_Y + (y - WORLD_MIN_Y), where x and z
   * are chunk-local (0..15).
   */
  blocks: string[];
  /** Biome id per column, indexed the same way as the blocks (x major). */
  biomes: string[];
  /**
   * Height of the ground of every column: the top solid block of the
   * terrain.
   *
   * Decorations (a tree canopy, a flower) are deliberately *not* counted —
   * the height map describes the ground, so it stays continuous from one
   * chunk to the next.
   */
  heightMap: Int16Array;
  /** Structures placed in this chunk. */
  structures: PlacedStructure[];
}

/** Per column data of a chunk, cached between calls. */
interface ChunkColumns {
  heights: Int16Array;
  biomes: string[];
}

/** Number of chunks whose column data is kept in memory. */
const COLUMN_CACHE_SIZE = 64;
/** Number of sampled climate points that are kept in memory. */
const CLIMATE_CACHE_SIZE = 8192;

/** Generates the chunks of one world dimension. */
export class WorldGenerator {
  readonly seed: number;
  readonly dimension: Dimension;

  private readonly noise: Noise;
  private readonly climate: ClimateSampler;
  private readonly terrain: TerrainSampler;
  private readonly caves: CaveGenerator;

  /** Reused block buffer — one byte per block of the chunk. */
  private readonly scratch = new Uint8Array(CHUNK_X * CHUNK_Y * CHUNK_Z);
  /** Column data of recently generated chunks. */
  private readonly columnCache = new Map<string, ChunkColumns>();
  /** Sampled climate points of recently visited columns. */
  private readonly climateCache = new Map<string, ClimatePoint>();

  constructor(seed: number, dimension: Dimension = 'overworld') {
    this.seed = seed >>> 0;
    this.dimension = dimension;
    this.noise = new Noise(this.seed);
    this.climate = new ClimateSampler(this.noise, dimension);
    this.terrain = new TerrainSampler(this.noise, this.climate, dimension);
    this.caves = new CaveGenerator(this.noise, dimension);
    this.climate.setHeightProvider((x, z) => this.getHeight(x, z));
  }

  /** The terrain height (top solid block) at a world position. */
  getHeight(x: number, z: number): number {
    const c = this.climateAt(x, z);
    return this.terrain.heightFromClimate(c, x, z);
  }

  /** The biome id at a world position. */
  getBiome(x: number, z: number): string {
    const c = this.climateAt(x, z);
    const h = this.terrain.heightFromClimate(c, x, z);
    return this.climate.biomeFromClimate(c, x, z, h);
  }

  /** The climate at a world position (cached). */
  private climateAt(x: number, z: number): ClimatePoint {
    const key = `${x},${z}`;
    const cached = this.climateCache.get(key);
    if (cached) return cached;
    const point = this.climate.sample(x, z);
    if (this.climateCache.size >= CLIMATE_CACHE_SIZE) this.climateCache.clear();
    this.climateCache.set(key, point);
    return point;
  }

  /** The column data of a chunk (computed once, then cached). */
  private columnsFor(cx: number, cz: number): ChunkColumns {
    const key = `${cx},${cz}`;
    const cached = this.columnCache.get(key);
    if (cached) return cached;

    const heights = new Int16Array(CHUNK_X * CHUNK_Z);
    const biomes: string[] = new Array<string>(CHUNK_X * CHUNK_Z);

    for (let x = 0; x < CHUNK_X; x++) {
      for (let z = 0; z < CHUNK_Z; z++) {
        const wx = cx * CHUNK_X + x;
        const wz = cz * CHUNK_Z + z;
        const ci = columnIndex(x, z);
        const c = this.climateAt(wx, wz);
        const h = this.terrain.heightFromClimate(c, wx, wz);
        heights[ci] = h;
        biomes[ci] = this.climate.biomeFromClimate(c, wx, wz, h);
      }
    }

    const columns: ChunkColumns = { heights, biomes };
    if (this.columnCache.size >= COLUMN_CACHE_SIZE) {
      const oldest = this.columnCache.keys().next();
      if (!oldest.done) this.columnCache.delete(oldest.value);
    }
    this.columnCache.set(key, columns);
    return columns;
  }

  /** Generate one chunk of the world. */
  generateChunk(cx: number, cz: number): GeneratedChunk {
    const blocks = this.scratch;
    blocks.fill(BLOCK_IDS.air);

    const columns = this.columnsFor(cx, cz);
    // The chunk owns its own height map so that the cached column data
    // stays untouched for the next chunk that asks for it.
    const heights = new Int16Array(columns.heights);
    const biomes = columns.biomes;

    if (this.dimension === 'end') {
      this.fillEnd(blocks, cx, cz, heights);
    } else {
      this.fillOverworld(blocks, cx, cz, heights, biomes);
    }

    const structures = structuresFor(this.seed, cx, cz, this.dimension, (x, z) => this.getHeight(x, z));
    this.placeStructures(blocks, cx, cz, structures);
    this.decorate(blocks, cx, cz);

    // Convert the scratch buffer into the block name array.
    const names = new Array<string>(blocks.length);
    for (let i = 0; i < blocks.length; i++) names[i] = BLOCK_NAMES[blocks[i]];

    return { cx, cz, dimension: this.dimension, blocks: names, biomes, heightMap: heights, structures };
  }

  /** Fill the stone, surface and water of an overworld or nether chunk. */
  private fillOverworld(
    blocks: Uint8Array,
    cx: number,
    cz: number,
    heights: Int16Array,
    biomes: string[],
  ): void {
    const baseX = cx * CHUNK_X;
    const baseZ = cz * CHUNK_Z;

    for (let x = 0; x < CHUNK_X; x++) {
      for (let z = 0; z < CHUNK_Z; z++) {
        const ci = columnIndex(x, z);
        const biome = biomes[ci];
        if (!biome) continue;
        const def = biomeById(biome);
        this.terrain.fillColumn(
          blocks,
          x,
          z,
          heights[ci],
          def,
          baseX + x,
          baseZ + z,
        );
      }
    }

    // Caves.
    this.caves.carve(blocks, cx, cz, heights);
    fillCaveFluids(blocks, cx, cz, heights, this.noise, this.dimension);

    // Ores.
    placeOres(blocks, cx, cz, this.seed, heights, this.dimension);
  }

  /** Fill an end chunk: the central island and the floating islands. */
  private fillEnd(blocks: Uint8Array, cx: number, cz: number, heights: Int16Array): void {
    generateEndChunk(this.seed, cx, cz, blocks, heights);
  }

  /** Draw the structures that touch this chunk. */
  private placeStructures(
    blocks: Uint8Array,
    cx: number,
    cz: number,
    placed: PlacedStructure[],
  ): void {
    if (placed.length === 0) return;

    for (const structure of placed) {
      buildStructure(structure, {
        set: (x, y, z, block) => {
          const lx = x - cx * CHUNK_X;
          const lz = z - cz * CHUNK_Z;
          if (lx < 0 || lx >= CHUNK_X || lz < 0 || lz >= CHUNK_Z) return;
          if (y < WORLD_MIN_Y || y >= WORLD_MAX_Y) return;
          const id = BLOCK_IDS[block];
          if (id === undefined) return;
          blocks[(lx * CHUNK_Z + lz) * CHUNK_Y + (y - WORLD_MIN_Y)] = id;
        },
        heightAt: (x, z) => this.getHeight(x, z),
        biomeAt: (x, z) => this.getBiome(x, z),
      });
    }
  }

  /** Apply the trees and plants of this chunk and of its neighbours. */
  private decorate(blocks: Uint8Array, cx: number, cz: number): void {
    const samplers: DecorationSamplers = {
      heightAt: (x, z) => this.getHeight(x, z),
      biomeAt: (x, z, y) => this.getBiome(x, z),
      blockAt: (x, y, z) => {
        const lx = x - cx * CHUNK_X;
        const lz = z - cz * CHUNK_Z;
        if (lx < 0 || lx >= CHUNK_X || lz < 0 || lz >= CHUNK_Z) return undefined;
        if (y < WORLD_MIN_Y || y >= WORLD_MAX_Y) return undefined;
        return BLOCK_NAMES[blocks[(lx * CHUNK_Z + lz) * CHUNK_Y + (y - WORLD_MIN_Y)]];
      },
    };

    // Radius 1 covers every canopy: the widest one reaches four blocks
    // into the neighbouring chunk.
    const decorations = collectDecorations(this.seed, cx, cz, 1, samplers);
    for (let i = 0; i < decorations.length; i++) {
      applyDecoration(blocks, cx, cz, decorations[i], this.seed);
    }
  }
}

/**
 * Generate a single chunk without keeping a generator around.
 *
 * Convenience for tools and tests; the engine should keep one
 * `WorldGenerator` per dimension so the scratch buffers are reused.
 */
export function generateChunk(
  seed: number,
  cx: number,
  cz: number,
  dimension: Dimension = 'overworld',
): GeneratedChunk {
  return new WorldGenerator(seed, dimension).generateChunk(cx, cz);
}
