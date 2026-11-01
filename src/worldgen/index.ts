/**
 * Cubicraft — world generation.
 *
 * The engine's entry point is `WorldGenerator`:
 *
 * ```ts
 * const generator = new WorldGenerator(seed, 'overworld');
 * const chunk = generator.generateChunk(cx, cz);
 * // chunk.blocks holds block NAMES, chunk.biomes one id per column,
 * // chunk.heightMap the top solid block per column.
 * ```
 *
 * ASSUMPTIONS THE ENGINE MUST HONOUR:
 *  1. `blocks` contains block *names*, not registry ids. The engine maps
 *     them to ids (and may skip names it does not know).
 *  2. The block index is `(x * CHUNK_Z + z) * CHUNK_Y + (y - WORLD_MIN_Y)`
 *     with chunk-local x/z.
 *  3. `biomes` and `heightMap` use the same x-major column order. The
 *     height map is the height of the *ground*; a tree canopy does not
 *     raise it, which is what keeps neighbouring chunks aligned.
 *  4. Decoration needs a one chunk margin: a tree's canopy may reach into
 *     the neighbouring chunk. `generateChunk` already applies the margin
 *     itself, so the engine only has to do this when it streams decorations
 *     separately (`collectDecorations(seed, cx, cz, 1)`).
 *  5. Sea level is 64; water fills everything up to it.
 *  6. Neighbouring columns never differ by more than one block of height,
 *     so the terrain has no cliffs — a slope is always walkable.
 */

export { Noise, spline, clamp01, smoothstep01 } from './noise';
export type { Warp2 } from './noise';

export { ClimateSampler, SEA_LEVEL, RIVER_BED } from './climate';
export type { ClimatePoint } from './climate';

export {
  BIOMES,
  LAND_BIOMES,
  SHORE_BIOMES,
  WATER_BIOMES,
  biomeById,
  tryBiomeById,
  selectLandBiome,
  selectWaterBiome,
  selectNetherBiome,
  selectEndBiome,
} from './biomes';
export type { BiomeTableEntry, Dimension, TreeType } from './biomes';

export {
  BLOCK_IDS,
  BLOCK_NAMES,
  TerrainSampler,
  blockIndex,
  columnIndex,
  hash3,
  badlandsFactor,
  endIslandHeight,
} from './terrain';
export type { BlockName } from './terrain';

export {
  CaveGenerator,
  OVERWORLD_CAVE_LAYERS,
  NETHER_CAVE_LAYERS,
  fillCaveFluids,
  generateEndChunk,
} from './caves';
export type { CaveKind, CaveLayer } from './caves';

export { ORES, placeOres } from './ores';
export type { OreDef } from './ores';

export { collectDecorations, applyDecoration, defaultSamplers } from './decoration';
export type { Decoration, DecorationSamplers } from './decoration';

export {
  STRUCTURE_RULES,
  structuresFor,
  structureFor,
  buildStructure,
} from './structures';
export type { PlacedStructure, StructureContext, StructureType } from './structures';

export { WorldGenerator, generateChunk } from './generator';
export type { GeneratedChunk } from './generator';
