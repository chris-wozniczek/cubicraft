/**
 * Cubicraft — decoration: trees, plants and cave flora.
 *
 * Placement is driven by the per-chunk seeded RNG (`SeededRng.forPosition`),
 * which is the only place a per-chunk stream is allowed: a tree always grows
 * in the chunk that owns its trunk, so two peers that generate the same chunk
 * place the same trees.
 *
 * A canopy may reach over the chunk border. To avoid a half tree at the edge,
 * `collectDecorations` gathers the trees of the neighbouring chunks as well;
 * the caller keeps only the blocks that land inside the chunk it renders.
 */

import { CHUNK_X, CHUNK_Z, WORLD_MAX_Y, WORLD_MIN_Y } from '../core/types';
import { SeededRng } from '../core/rng';
import { biomeById } from './biomes';
import type { TreeType } from './biomes';
import { SEA_LEVEL } from './climate';
import { BLOCK_IDS, blockIndex } from './terrain';
import type { BlockName } from './terrain';
import { ClimateSampler } from './climate';
import { TerrainSampler } from './terrain';
import { Noise } from './noise';

/** A decoration that has been decided but not yet written into a chunk. */
export interface Decoration {
  kind: 'tree' | 'plant';
  /** Tree species (for trees) or the block name (for plants). */
  id: string;
  /** World position of the trunk base / of the plant. */
  x: number;
  y: number;
  z: number;
}

/** The samplers a decoration pass needs to know about the world. */
export interface DecorationSamplers {
  /** Top solid block of a column. */
  heightAt(x: number, z: number): number;
  /** Biome id at a world position. */
  biomeAt(x: number, z: number, y: number): string;
  /** Block name at a world position, when the caller has a chunk loaded. */
  blockAt?(x: number, y: number, z: number): string | undefined;
}

/** Per-species shape parameters. */
interface TreeSpec {
  log: BlockName;
  leaves: BlockName;
  minHeight: number;
  maxHeight: number;
  /** Canopy algorithm. */
  shape: 'blob' | 'conical' | 'flat' | 'column' | 'stalk';
  /** Canopy radius. */
  radius: number;
  /** Radius of the trunk (2 makes a two by two trunk). */
  trunkRadius: number;
}

const TREE_SPECS: Record<TreeType, TreeSpec> = {
  oak: { log: 'oak_log', leaves: 'oak_leaves', minHeight: 4, maxHeight: 6, shape: 'blob', radius: 2, trunkRadius: 1 },
  birch: { log: 'birch_log', leaves: 'birch_leaves', minHeight: 5, maxHeight: 7, shape: 'blob', radius: 2, trunkRadius: 1 },
  spruce: { log: 'spruce_log', leaves: 'spruce_leaves', minHeight: 6, maxHeight: 11, shape: 'conical', radius: 2, trunkRadius: 1 },
  pine: { log: 'pine_log', leaves: 'pine_leaves', minHeight: 8, maxHeight: 14, shape: 'conical', radius: 2, trunkRadius: 1 },
  jungle: { log: 'jungle_log', leaves: 'jungle_leaves', minHeight: 10, maxHeight: 20, shape: 'blob', radius: 3, trunkRadius: 1 },
  acacia: { log: 'acacia_log', leaves: 'acacia_leaves', minHeight: 4, maxHeight: 6, shape: 'flat', radius: 3, trunkRadius: 1 },
  dark_oak: { log: 'dark_oak_log', leaves: 'dark_oak_leaves', minHeight: 6, maxHeight: 9, shape: 'blob', radius: 3, trunkRadius: 2 },
  mangrove: { log: 'mangrove_log', leaves: 'mangrove_leaves', minHeight: 7, maxHeight: 9, shape: 'flat', radius: 3, trunkRadius: 1 },
  cherry: { log: 'cherry_log', leaves: 'cherry_leaves', minHeight: 4, maxHeight: 6, shape: 'blob', radius: 3, trunkRadius: 1 },
  poplar: { log: 'poplar_log', leaves: 'poplar_leaves', minHeight: 6, maxHeight: 12, shape: 'column', radius: 1, trunkRadius: 1 },
  crimson: { log: 'crimson_stem', leaves: 'crimson_roots', minHeight: 4, maxHeight: 8, shape: 'blob', radius: 2, trunkRadius: 1 },
  warped: { log: 'warped_stem', leaves: 'warped_roots', minHeight: 4, maxHeight: 8, shape: 'blob', radius: 2, trunkRadius: 1 },
  chorus: { log: 'chorus_plant', leaves: 'chorus_plant', minHeight: 2, maxHeight: 5, shape: 'stalk', radius: 1, trunkRadius: 1 },
};

/** A plant that can spawn on a biome's surface. */
interface PlantSpec {
  name: BlockName;
  chance: number;
  /** Required surface block; `undefined` means "any solid ground". */
  surface?: BlockName;
  /** Only spawns directly next to water. */
  needsWater?: boolean;
  /** Only spawns underwater. */
  underwater?: boolean;
}

/** Shorthand for the common grass/flower mix. */
const FLOWERS: PlantSpec[] = [
  { name: 'grass', chance: 0.5 },
  { name: 'tall_grass', chance: 0.2 },
  { name: 'dandelion', chance: 0.06 },
  { name: 'poppy', chance: 0.06 },
  { name: 'cornflower', chance: 0.03 },
  { name: 'allium', chance: 0.03 },
  { name: 'oxeye_daisy', chance: 0.03 },
  { name: 'azure_bluet', chance: 0.03 },
  { name: 'red_tulip', chance: 0.02 },
  { name: 'white_tulip', chance: 0.02 },
  { name: 'orange_tulip', chance: 0.02 },
  { name: 'pink_tulip', chance: 0.02 },
];

/** Per biome plant tables. */
const PLANTS: Record<string, PlantSpec[]> = {
  plains: [...FLOWERS, { name: 'pumpkin', chance: 0.004 }],
  sunflower_plains: [...FLOWERS, { name: 'sunflower', chance: 0.08 }, { name: 'pumpkin', chance: 0.004 }],
  snowy_plains: [{ name: 'grass', chance: 0.12 }, { name: 'snow', chance: 0.5 }],
  ice_spikes: [{ name: 'snow', chance: 0.7 }],
  desert: [{ name: 'dead_bush', chance: 0.05 }, { name: 'cactus', chance: 0.012 }],
  desert_lakes: [{ name: 'dead_bush', chance: 0.04 }, { name: 'cactus', chance: 0.01 }],
  swamp: [
    { name: 'tall_grass', chance: 0.35 },
    { name: 'blue_mushroom', chance: 0.02 },
    { name: 'sugar_cane', chance: 0.05, needsWater: true },
    { name: 'brown_mushroom', chance: 0.02 },
  ],
  swamp_hills: [
    { name: 'tall_grass', chance: 0.3 },
    { name: 'blue_mushroom', chance: 0.015 },
    { name: 'brown_mushroom', chance: 0.015 },
  ],
  mangrove_swamp: [
    { name: 'tall_grass', chance: 0.3 },
    { name: 'blue_mushroom', chance: 0.02 },
    { name: 'sugar_cane', chance: 0.06, needsWater: true },
    { name: 'mangrove_propagule', chance: 0.02 },
  ],
  forest: [
    { name: 'grass', chance: 0.45 },
    { name: 'fern', chance: 0.12 },
    { name: 'red_mushroom', chance: 0.02 },
    { name: 'brown_mushroom', chance: 0.02 },
  ],
  flower_forest: [...FLOWERS, { name: 'red_mushroom', chance: 0.02 }],
  birch_forest: [{ name: 'grass', chance: 0.45 }, { name: 'fern', chance: 0.08 }],
  old_growth_birch_forest: [{ name: 'grass', chance: 0.45 }, { name: 'fern', chance: 0.08 }],
  dark_forest: [
    { name: 'grass', chance: 0.4 },
    { name: 'tall_grass', chance: 0.1 },
    { name: 'red_mushroom', chance: 0.05 },
    { name: 'brown_mushroom', chance: 0.05 },
  ],
  pale_garden: [{ name: 'grass', chance: 0.2 }, { name: 'oxeye_daisy', chance: 0.02 }, { name: 'azure_bluet', chance: 0.02 }],
  taiga: [
    { name: 'grass', chance: 0.3 },
    { name: 'fern', chance: 0.2 },
    { name: 'red_mushroom', chance: 0.03 },
    { name: 'brown_mushroom', chance: 0.03 },
  ],
  snowy_taiga: [{ name: 'fern', chance: 0.12 }, { name: 'red_mushroom', chance: 0.02 }, { name: 'snow', chance: 0.4 }],
  old_growth_taiga: [{ name: 'fern', chance: 0.25 }, { name: 'brown_mushroom', chance: 0.03 }, { name: 'grass', chance: 0.2 }],
  old_growth_spruce_forest: [{ name: 'fern', chance: 0.22 }, { name: 'red_mushroom', chance: 0.03 }],
  snowy_slopes: [{ name: 'snow', chance: 0.6 }, { name: 'grass', chance: 0.08 }],
  frozen_peaks: [{ name: 'snow', chance: 0.8 }],
  jagged_peaks: [{ name: 'snow', chance: 0.8 }],
  stony_peaks: [],
  meadow: [...FLOWERS, { name: 'oxeye_daisy', chance: 0.06 }],
  cherry_grove: [{ name: 'pink_petals', chance: 0.3 }, { name: 'grass', chance: 0.3 }, { name: 'cherry_sapling', chance: 0.02 }],
  grove: [{ name: 'fern', chance: 0.12 }, { name: 'grass', chance: 0.25 }, { name: 'snow', chance: 0.35 }],
  bamboo_jungle: [{ name: 'tall_grass', chance: 0.4 }, { name: 'fern', chance: 0.15 }, { name: 'melon', chance: 0.006 }],
  sparse_jungle: [{ name: 'tall_grass', chance: 0.3 }, { name: 'fern', chance: 0.1 }, { name: 'melon', chance: 0.004 }],
  mushroom_field: [{ name: 'red_mushroom', chance: 0.2 }, { name: 'brown_mushroom', chance: 0.2 }],
  windswept_hills: [{ name: 'grass', chance: 0.15 }, { name: 'dead_bush', chance: 0.01 }],
  windswept_gravelly_hills: [{ name: 'grass', chance: 0.1 }],
  windswept_forest: [{ name: 'grass', chance: 0.2 }, { name: 'fern', chance: 0.06 }],
  windswept_savanna: [{ name: 'grass', chance: 0.2 }, { name: 'tall_grass', chance: 0.08 }],
  shattered_savanna: [{ name: 'grass', chance: 0.18 }, { name: 'tall_grass', chance: 0.08 }],
  savanna: [{ name: 'grass', chance: 0.3 }, { name: 'tall_grass', chance: 0.12 }],
  savanna_plateau: [{ name: 'grass', chance: 0.15 }],
  badlands: [{ name: 'dead_bush', chance: 0.04 }, { name: 'grass', chance: 0.05 }],
  eroded_badlands: [{ name: 'dead_bush', chance: 0.03 }],
  wooded_badlands: [{ name: 'grass', chance: 0.3 }, { name: 'tall_grass', chance: 0.1 }],
  modified_badlands_plateau: [{ name: 'dead_bush', chance: 0.03 }],
  modified_jungle_edge: [{ name: 'tall_grass', chance: 0.3 }, { name: 'fern', chance: 0.08 }],
  beach: [{ name: 'sugar_cane', chance: 0.05, needsWater: true }, { name: 'grass', chance: 0.05 }],
  snowy_beach: [{ name: 'snow', chance: 0.5 }],
  stony_shore: [],
  dripstone_caves: [],
  lush_caves: [{ name: 'glow_berries', chance: 0.05 }, { name: 'moss_block', chance: 0.06 }, { name: 'vines', chance: 0.05 }],
  deep_dark: [],
  nether_wastes: [{ name: 'nether_sprouts', chance: 0.08 }, { name: 'crimson_roots', chance: 0.04 }],
  crimson_forest: [{ name: 'crimson_roots', chance: 0.2 }, { name: 'nether_sprouts', chance: 0.15 }],
  warped_forest: [{ name: 'warped_roots', chance: 0.2 }, { name: 'nether_sprouts', chance: 0.15 }],
  soul_sand_valley: [],
  basalt_deltas: [],
  the_end: [{ name: 'chorus_plant', chance: 0.1 }],
  end_highlands: [{ name: 'chorus_plant', chance: 0.12 }],
  end_midlands: [{ name: 'chorus_plant', chance: 0.1 }],
  small_end_islands: [{ name: 'chorus_plant', chance: 0.05 }],
  end_barrens: [{ name: 'chorus_plant', chance: 0.06 }],
};

/** Highest tree density of any biome, used as a cheap pre-filter. */
const MAX_TREE_CHANCE = 0.02;

/** Build the default samplers for a seed (used when no context is supplied). */
export function defaultSamplers(seed: number): DecorationSamplers {
  const noise = new Noise(seed);
  const climate = new ClimateSampler(noise, 'overworld');
  const terrain = new TerrainSampler(noise, climate, 'overworld');
  climate.setHeightProvider((x, z) => terrain.heightAt(x, z));
  return {
    heightAt: (x, z) => terrain.heightAt(x, z),
    biomeAt: (x, z, y) => climate.biomeAt(x, z, y),
  };
}

/**
 * Gather the decorations of a chunk and of the chunks around it.
 *
 * `radius` is how many chunks in every direction are searched for trees.
 * Radius 1 is enough for every canopy in the game: the widest canopy
 * (jungle, radius 3 plus a trunk of up to 20) never reaches further than
 * four blocks into the neighbouring chunk.
 */
export function collectDecorations(
  seed: number,
  cx: number,
  cz: number,
  radius: number,
  samplers?: DecorationSamplers,
): Decoration[] {
  const s = samplers ?? defaultSamplers(seed);
  const out: Decoration[] = [];

  for (let dz = -radius; dz <= radius; dz++) {
    for (let dx = -radius; dx <= radius; dx++) {
      collectChunkTrees(seed, cx + dx, cz + dz, s, out);
    }
  }

  collectChunkPlants(seed, cx, cz, s, out);
  return out;
}

/** The trees of a single chunk (the chunk that owns the trunks). */
function collectChunkTrees(
  seed: number,
  cx: number,
  cz: number,
  s: DecorationSamplers,
  out: Decoration[],
): void {
  const rng = SeededRng.forPosition(seed, cx, cz).fork('trees');
  const baseX = cx * CHUNK_X;
  const baseZ = cz * CHUNK_Z;

  for (let i = 0; i < CHUNK_X * CHUNK_Z; i++) {
    // One draw decides both "is this column a candidate" and "does the
    // biome want a tree here", so the effective probability is exactly the
    // biome's density.
    const roll = rng.float();
    if (roll > MAX_TREE_CHANCE) continue;

    const x = baseX + rng.int(0, CHUNK_X - 1);
    const z = baseZ + rng.int(0, CHUNK_Z - 1);
    const height = s.heightAt(x, z);
    if (height < SEA_LEVEL) continue;

    const biomeId = s.biomeAt(x, z, height);
    const def = biomeById(biomeId);
    if (!def.treeType) continue;

    const chance = def.treeDensity / (CHUNK_X * CHUNK_Z);
    if (roll > chance) continue;

    out.push({ kind: 'tree', id: def.treeType, x, y: height + 1, z });
  }
}

/** The plants, water plants and cave flora of a single chunk. */
function collectChunkPlants(
  seed: number,
  cx: number,
  cz: number,
  s: DecorationSamplers,
  out: Decoration[],
): void {
  const rng = SeededRng.forPosition(seed, cx, cz).fork('plants');
  const baseX = cx * CHUNK_X;
  const baseZ = cz * CHUNK_Z;

  for (let x = 0; x < CHUNK_X; x++) {
    for (let z = 0; z < CHUNK_Z; z++) {
      const wx = baseX + x;
      const wz = baseZ + z;
      const height = s.heightAt(wx, wz);
      const biomeId = s.biomeAt(wx, wz, height);
      const def = biomeById(biomeId);

      // A plant that lives in the water.
      if (height < SEA_LEVEL) {
        if (rng.chance(0.12)) {
          out.push({
            kind: 'plant',
            id: rng.chance(0.5) ? 'seagrass' : 'kelp',
            x: wx,
            y: Math.max(WORLD_MIN_Y + 1, height + 1),
            z: wz,
          });
        } else if (rng.chance(0.04) && (def.id === 'swamp' || def.id === 'river' || def.id === 'mangrove_swamp')) {
          out.push({ kind: 'plant', id: 'lily_pad', x: wx, y: SEA_LEVEL, z: wz });
        }
        continue;
      }

      const table = PLANTS[def.id];
      if (!table || table.length === 0) continue;

      const surface = s.blockAt ? s.blockAt(wx, height, wz) : def.surface;

      for (let i = 0; i < table.length; i++) {
        const plant = table[i];
        if (plant.surface && surface !== plant.surface) continue;
        if (plant.underwater) continue;
        if (plant.needsWater && !hasWaterNeighbour(s, wx, wz, height)) continue;

        const chance = plant.chance * def.vegetation;
        if (!rng.chance(chance)) continue;

        out.push({ kind: 'plant', id: plant.name, x: wx, y: height + 1, z: wz });
        break;
      }

      // Cave flora: vines and glow berries below the surface.
      if (rng.chance(0.08)) {
        const span = Math.max(1, height - WORLD_MIN_Y - 8);
        const y = WORLD_MIN_Y + 2 + rng.int(0, span);
        if (y < height - 2) {
          const below = s.blockAt ? s.blockAt(wx, y - 1, wz) : undefined;
          if (below === 'stone' || below === 'deepslate' || below === 'netherrack') {
            out.push({
              kind: 'plant',
              id: def.id === 'lush_caves' ? 'glow_berries' : 'vines',
              x: wx,
              y,
              z: wz,
            });
          }
        }
      }
    }
  }
}

/** Is there water within one block of the given column? */
function hasWaterNeighbour(
  s: DecorationSamplers,
  x: number,
  z: number,
  height: number,
): boolean {
  for (let i = 0; i < 4; i++) {
    const nx = x + (i === 0 ? 1 : i === 1 ? -1 : 0);
    const nz = z + (i === 2 ? 1 : i === 3 ? -1 : 0);
    const nh = s.heightAt(nx, nz);
    if (nh < height && nh < SEA_LEVEL) return true;
  }
  return false;
}

/**
 * Write a decoration into a chunk buffer.
 *
 * Blocks outside the chunk are dropped — that is what makes the margin
 * trick work: the neighbour's tree is drawn by both chunks, each keeping
 * the part that belongs to it.
 */
export function applyDecoration(
  blocks: Uint8Array,
  cx: number,
  cz: number,
  decoration: Decoration,
  seed: number,
): void {
  if (decoration.kind === 'plant') {
    writeBlock(blocks, cx, cz, decoration.x, decoration.y, decoration.z, decoration.id);
    return;
  }

  const spec = TREE_SPECS[decoration.id as TreeType];
  if (!spec) return;

  // The tree's own randomness is keyed on its trunk position, so the shape
  // never depends on which chunk happens to draw it.
  const rng = SeededRng.forPosition(seed ^ 0x7ee5, decoration.x, decoration.z).fork(`tree:${decoration.id}`);
  const height = rng.int(spec.minHeight, spec.maxHeight);
  const baseY = decoration.y;

  // Trunk.
  if (spec.trunkRadius === 2) {
    for (let dy = 0; dy < height; dy++) {
      writeBlock(blocks, cx, cz, decoration.x, baseY + dy, decoration.z, spec.log);
      writeBlock(blocks, cx, cz, decoration.x + 1, baseY + dy, decoration.z, spec.log);
      writeBlock(blocks, cx, cz, decoration.x, baseY + dy, decoration.z + 1, spec.log);
      writeBlock(blocks, cx, cz, decoration.x + 1, baseY + dy, decoration.z + 1, spec.log);
    }
  } else {
    for (let dy = 0; dy < height; dy++) {
      writeBlock(blocks, cx, cz, decoration.x, baseY + dy, decoration.z, spec.log);
    }
  }

  const logId = BLOCK_IDS[spec.log];
  const leafId = BLOCK_IDS[spec.leaves];

  switch (spec.shape) {
    case 'blob': {
      const r = spec.radius;
      for (let level = 0; level <= 4; level++) {
        const dy = height - 3 + level;
        let rad = r;
        if (level === 0) rad = r - 1;
        else if (level === 4) rad = Math.max(1, r - 1);
        else if (level === 3) rad = r - 1;
        writeDisc(blocks, cx, cz, decoration.x, baseY + dy, decoration.z, rad, leafId, logId);
      }
      break;
    }
    case 'conical': {
      for (let level = 0; level <= height + 1; level++) {
        const phase = level % 4;
        const rad = phase === 0 ? 0 : phase === 2 ? spec.radius : 1;
        writeDisc(blocks, cx, cz, decoration.x, baseY + level, decoration.z, rad, leafId, logId);
      }
      break;
    }
    case 'flat': {
      // A wide, flat canopy — acacia and mangrove style.
      writeDisc(blocks, cx, cz, decoration.x, baseY + height, decoration.z, spec.radius, leafId, logId);
      writeDisc(blocks, cx, cz, decoration.x, baseY + height - 1, decoration.z, spec.radius - 1, leafId, logId);
      // A leaning branch, which is what makes an acacia recognisable.
      const dir = rng.int(0, 3);
      const dx = dir === 0 ? 1 : dir === 1 ? -1 : 0;
      const dz = dir === 2 ? 1 : dir === 3 ? -1 : 0;
      for (let i = 1; i <= 3; i++) {
        writeBlock(blocks, cx, cz, decoration.x + dx * i, baseY + height - 1 + (i > 1 ? 1 : 0), decoration.z + dz * i, spec.log);
      }
      break;
    }
    case 'column': {
      for (let dy = 0; dy <= height; dy++) {
        writeDisc(blocks, cx, cz, decoration.x, baseY + dy, decoration.z, 1, leafId, logId);
      }
      break;
    }
    case 'stalk': {
      for (let dy = 0; dy <= height; dy++) {
        writeBlock(blocks, cx, cz, decoration.x, baseY + dy, decoration.z, spec.log);
      }
      break;
    }
  }
}

/** Write a disc of leaves, keeping the trunk visible. */
function writeDisc(
  blocks: Uint8Array,
  cx: number,
  cz: number,
  x: number,
  y: number,
  z: number,
  radius: number,
  leafId: number,
  logId: number,
): void {
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      const d2 = dx * dx + dz * dz;
      if (d2 > radius * radius + 1) continue;
      // Cut the four corners so the canopy is round, not square.
      if (Math.abs(dx) === radius && Math.abs(dz) === radius) continue;
      const idx = chunkBlockIndex(blocks, cx, cz, x + dx, y, z + dz);
      if (idx < 0) continue;
      if (blocks[idx] === logId) continue;
      blocks[idx] = leafId;
    }
  }
}

/**
 * Write a single block, clipping to the chunk.
 *
 * The height map is deliberately *not* updated: it describes the ground, and
 * a tree canopy or a flower must not move it (otherwise the height map
 * would jump around with the vegetation and neighbouring chunks would no
 * longer line up at their border).
 */
function writeBlock(
  blocks: Uint8Array,
  cx: number,
  cz: number,
  x: number,
  y: number,
  z: number,
  name: string,
): void {
  const idx = chunkBlockIndex(blocks, cx, cz, x, y, z);
  if (idx < 0) return;
  blocks[idx] = BLOCK_IDS[name as BlockName] ?? BLOCK_IDS.air;
}

/** Index of a world block inside the chunk buffer, or -1 when outside. */
function chunkBlockIndex(
  blocks: Uint8Array,
  cx: number,
  cz: number,
  x: number,
  y: number,
  z: number,
): number {
  const lx = x - cx * CHUNK_X;
  const lz = z - cz * CHUNK_Z;
  if (lx < 0 || lx >= CHUNK_X || lz < 0 || lz >= CHUNK_Z) return -1;
  if (y < WORLD_MIN_Y || y >= WORLD_MAX_Y) return -1;
  return blockIndex(lx, y, lz);
}
