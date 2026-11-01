/**
 * Cubicraft — structures.
 *
 * Every structure lives on a coarse grid of "cells" (a cell is a few dozen
 * chunks wide). The origin of a structure inside its cell is derived from a
 * hash of the seed, the structure type and the cell coordinates, so the
 * placement is deterministic and reproducible on every peer without any
 * shared state.
 *
 * A structure never crosses its cell border, so looking up "which structures
 * touch this chunk" only has to inspect the nine cells around it.
 */

import { CHUNK_X, CHUNK_Z, WORLD_MIN_Y } from '../core/types';
import { hashString } from '../core/rng';
import type { Dimension } from './biomes';
import type { BlockName } from './terrain';
import { Noise } from './noise';
import { ClimateSampler } from './climate';
import { TerrainSampler } from './terrain';

/** Every structure the generator can place. */
export type StructureType =
  | 'village'
  | 'dungeon'
  | 'temple'
  | 'mineshaft'
  | 'stronghold'
  | 'witch_hut'
  | 'pillager_outpost'
  | 'bastion_remainder'
  | 'ruined_portal'
  | 'mansion'
  | 'trial_chamber'
  | 'monument'
  | 'end_city';

/** A structure that has been placed in the world. */
export interface PlacedStructure {
  type: StructureType;
  /** World position of the structure's origin. */
  x: number;
  y: number;
  z: number;
  /** The chunk that holds the origin. */
  chunkX: number;
  chunkZ: number;
  dimension: Dimension;
}

/** Placement rules of one structure type. */
interface StructureRule {
  type: StructureType;
  /** Distance between two cells, in chunks. */
  spacing: number;
  dimension: Dimension;
  /** Chance that a cell actually holds the structure. */
  chance: number;
  /** Half width of the footprint in blocks. */
  radius: number;
  /** How the structure's Y is chosen. */
  level: 'surface' | 'fixed' | 'underground' | 'sea' | 'sky';
  /** Fixed Y for `fixed` levels. */
  y?: number;
  /** How deep an `underground` structure sits below the surface. */
  depth?: number;
}

/** The structure table. */
export const STRUCTURE_RULES: StructureRule[] = [
  { type: 'village', spacing: 34, dimension: 'overworld', chance: 0.55, radius: 24, level: 'surface' },
  { type: 'dungeon', spacing: 8, dimension: 'overworld', chance: 0.22, radius: 4, level: 'underground', depth: 22 },
  { type: 'temple', spacing: 24, dimension: 'overworld', chance: 0.2, radius: 9, level: 'surface' },
  { type: 'mineshaft', spacing: 16, dimension: 'overworld', chance: 0.3, radius: 16, level: 'underground', depth: 9 },
  { type: 'stronghold', spacing: 48, dimension: 'overworld', chance: 0.8, radius: 6, level: 'fixed', y: 24 },
  { type: 'witch_hut', spacing: 24, dimension: 'overworld', chance: 0.35, radius: 5, level: 'surface' },
  { type: 'pillager_outpost', spacing: 16, dimension: 'overworld', chance: 0.2, radius: 6, level: 'surface' },
  { type: 'bastion_remainder', spacing: 24, dimension: 'nether', chance: 0.25, radius: 14, level: 'surface' },
  { type: 'ruined_portal', spacing: 12, dimension: 'overworld', chance: 0.35, radius: 4, level: 'surface' },
  { type: 'mansion', spacing: 40, dimension: 'overworld', chance: 0.12, radius: 9, level: 'surface' },
  { type: 'trial_chamber', spacing: 24, dimension: 'overworld', chance: 0.15, radius: 8, level: 'underground', depth: 40 },
  { type: 'monument', spacing: 100, dimension: 'overworld', chance: 0.3, radius: 12, level: 'sea' },
  { type: 'end_city', spacing: 20, dimension: 'end', chance: 0.3, radius: 6, level: 'sky' },
];

/** Deterministic hash of a structure cell. */
function cellHash(seed: number, type: string, cx: number, cz: number): number {
  let h = Math.imul(seed | 0, 0x27d4eb2f) ^ hashString(type);
  h = Math.imul(h ^ Math.imul(cx | 0, 0x9e3779b1), 0x85ebca6b);
  h = Math.imul(h ^ Math.imul(cz | 0, 0x9e3779b1), 0xc2b2ae35);
  h ^= h >>> 15;
  return h >>> 0;
}

/** The world position of a structure inside its cell, or null when the cell is empty. */
function structureInCell(
  seed: number,
  rule: StructureRule,
  cellX: number,
  cellZ: number,
  heightAt: (x: number, z: number) => number,
): PlacedStructure | null {
  const hash = cellHash(seed, rule.type, cellX, cellZ);
  if ((hash % 1000) / 1000 > rule.chance) return null;

  const cellSize = rule.spacing * CHUNK_X;
  // Keep the footprint inside the cell so the lookup never misses it.
  const span = Math.max(1, cellSize - rule.radius * 2 - 2);
  const jx = rule.radius + (hash >>> 10) % span;
  const jz = rule.radius + (hash >>> 20) % span;

  const x = cellX * cellSize + jx;
  const z = cellZ * cellSize + jz;

  let y = rule.y ?? 0;
  if (rule.level === 'surface') y = heightAt(x, z);
  else if (rule.level === 'underground') y = Math.max(WORLD_MIN_Y + 6, heightAt(x, z) - (rule.depth ?? 16));
  else if (rule.level === 'sea') y = 40;
  else if (rule.level === 'sky') y = 96;

  return {
    type: rule.type,
    x,
    y,
    z,
    chunkX: Math.floor(x / CHUNK_X),
    chunkZ: Math.floor(z / CHUNK_Z),
    dimension: rule.dimension,
  };
}

/**
 * All structures whose footprint touches the given chunk.
 *
 * `heightAt` is optional; without it the structures fall back to a default
 * terrain sampler (the engine normally passes its own so the height matches
 * the generated terrain exactly).
 */
export function structuresFor(
  seed: number,
  cx: number,
  cz: number,
  dimension: Dimension = 'overworld',
  heightAt?: (x: number, z: number) => number,
): PlacedStructure[] {
  const out: PlacedStructure[] = [];
  const height = heightAt ?? defaultHeight(seed);

  for (let i = 0; i < STRUCTURE_RULES.length; i++) {
    const rule = STRUCTURE_RULES[i];
    if (rule.dimension !== dimension) continue;

    const baseCellX = Math.floor(cx / rule.spacing);
    const baseCellZ = Math.floor(cz / rule.spacing);

    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const placed = structureInCell(seed, rule, baseCellX + dx, baseCellZ + dz, height);
        if (!placed) continue;
        if (!touchesChunk(placed, rule, cx, cz)) continue;
        out.push(placed);
      }
    }
  }
  return out;
}

/** Short alias for the lookup used by the generator. */
export function structureFor(
  seed: number,
  cx: number,
  cz: number,
  dimension: Dimension = 'overworld',
  heightAt?: (x: number, z: number) => number,
): PlacedStructure[] {
  return structuresFor(seed, cx, cz, dimension, heightAt);
}

/** Does the structure's footprint reach into the chunk? */
function touchesChunk(placed: PlacedStructure, rule: StructureRule, cx: number, cz: number): boolean {
  const minX = placed.x - rule.radius;
  const maxX = placed.x + rule.radius;
  const minZ = placed.z - rule.radius;
  const maxZ = placed.z + rule.radius;
  const chunkMinX = cx * CHUNK_X;
  const chunkMaxX = chunkMinX + CHUNK_X - 1;
  const chunkMinZ = cz * CHUNK_Z;
  const chunkMaxZ = chunkMinZ + CHUNK_Z - 1;
  return minX <= chunkMaxX && maxX >= chunkMinX && minZ <= chunkMaxZ && maxZ >= chunkMinZ;
}

/** Lazily built default height sampler, used when the caller supplies none. */
const DEFAULT_HEIGHT_CACHE = new Map<number, (x: number, z: number) => number>();

function defaultHeight(seed: number): (x: number, z: number) => number {
  const cached = DEFAULT_HEIGHT_CACHE.get(seed);
  if (cached) return cached;
  const noise = new Noise(seed);
  const climate = new ClimateSampler(noise, 'overworld');
  const terrain = new TerrainSampler(noise, climate, 'overworld');
  climate.setHeightProvider((x, z) => terrain.heightAt(x, z));
  const fn = (x: number, z: number) => terrain.heightAt(x, z);
  DEFAULT_HEIGHT_CACHE.set(seed, fn);
  return fn;
}

// ---------------------------------------------------------------------------
// Footprints
// ---------------------------------------------------------------------------

/** What a structure builder is given to draw with. */
export interface StructureContext {
  /** Set a block at a world position; positions outside the chunk are ignored. */
  set(x: number, y: number, z: number, block: BlockName): void;
  /** The ground height at a world position. */
  heightAt(x: number, z: number): number;
  /** The biome id at a world position. */
  biomeAt(x: number, z: number): string;
}

/** Draw the footprint of a placed structure into a chunk. */
export function buildStructure(structure: PlacedStructure, ctx: StructureContext): void {
  switch (structure.type) {
    case 'village': buildVillage(structure, ctx); break;
    case 'dungeon': buildDungeon(structure, ctx); break;
    case 'temple': buildTemple(structure, ctx); break;
    case 'mineshaft': buildMineshaft(structure, ctx); break;
    case 'stronghold': buildStronghold(structure, ctx); break;
    case 'witch_hut': buildWitchHut(structure, ctx); break;
    case 'pillager_outpost': buildOutpost(structure, ctx); break;
    case 'bastion_remainder': buildBastion(structure, ctx); break;
    case 'ruined_portal': buildRuinedPortal(structure, ctx); break;
    case 'mansion': buildMansion(structure, ctx); break;
    case 'trial_chamber': buildTrialChamber(structure, ctx); break;
    case 'monument': buildMonument(structure, ctx); break;
    case 'end_city': buildEndCity(structure, ctx); break;
  }
}

/** A simple house with walls, a roof and a doorway. */
function house(ctx: StructureContext, x: number, y: number, z: number, plank: BlockName, size: number): void {
  for (let dx = 0; dx < size; dx++) {
    for (let dz = 0; dz < size; dz++) {
      ctx.set(x + dx, y, z + dz, plank);
      // Walls, with a gap for the door on the south side.
      const edge = dx === 0 || dz === 0 || dx === size - 1 || dz === size - 1;
      if (edge && !(dz === size - 1 && dx === 1)) {
        ctx.set(x + dx, y + 1, z + dz, plank);
        ctx.set(x + dx, y + 2, z + dz, plank);
      }
      ctx.set(x + dx, y + 3, z + dz, plank);
    }
  }
  // A window on the west wall.
  ctx.set(x, y + 2, z + 1, 'glass');
}

/** A village: four houses around a well. */
function buildVillage(s: PlacedStructure, ctx: StructureContext): void {
  const base = ctx.heightAt(s.x, s.z);
  const offsets: [number, number][] = [
    [-14, -14],
    [8, -14],
    [-14, 8],
    [8, 8],
  ];
  for (const [dx, dz] of offsets) {
    const h = ctx.heightAt(s.x + dx, s.z + dz);
    house(ctx, s.x + dx, h, s.z + dz, 'oak_planks', 5);
  }

  // The well in the middle.
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      ctx.set(s.x + dx, base, s.z + dz, 'cobblestone');
      if (dx !== 0 || dz !== 0) ctx.set(s.x + dx, base + 1, s.z + dz, 'cobblestone');
    }
  }
  ctx.set(s.x, base, s.z, 'water');
  ctx.set(s.x, base + 1, s.z, 'lantern');
}

/** A dungeon: a small stone room with a spawner. */
function buildDungeon(s: PlacedStructure, ctx: StructureContext): void {
  const y = s.y;
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      for (let dy = 0; dy < 3; dy++) {
        const edge = dx === -2 || dx === 2 || dz === -2 || dz === 2 || dy === 0 || dy === 2;
        ctx.set(s.x + dx, y + dy, s.z + dz, edge ? 'cobblestone' : 'air');
      }
    }
  }
  ctx.set(s.x, y, s.z, 'spawner');
  ctx.set(s.x + 1, y, s.z + 1, 'chest');
  ctx.set(s.x - 1, y, s.z - 1, 'chest');
  ctx.set(s.x + 2, y + 1, s.z, 'torch');
}

/** The desert pyramid: stepped sandstone walls around a buried room. */
function buildTemple(s: PlacedStructure, ctx: StructureContext): void {
  const base = s.y;
  const layers = 5;
  for (let layer = 0; layer < layers; layer++) {
    const half = 7 - layer;
    for (let dx = -half; dx <= half; dx++) {
      for (let dz = -half; dz <= half; dz++) {
        const edge = dx === -half || dx === half || dz === -half || dz === half;
        if (!edge) continue;
        ctx.set(s.x + dx, base + layer, s.z + dz, 'sandstone');
        ctx.set(s.x + dx, base + layer + 1, s.z + dz, 'smooth_sandstone');
      }
    }
  }
  // The entrance and the treasure chamber.
  ctx.set(s.x, base, s.z + 7, 'air');
  ctx.set(s.x, base - 1, s.z + 7, 'air');
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      ctx.set(s.x + dx, base - 3, s.z + dz, 'cut_sandstone');
    }
  }
  ctx.set(s.x, base - 3, s.z, 'chest');
  ctx.set(s.x - 1, base - 3, s.z + 1, 'chest');
}

/** A mineshaft: wooden corridors on posts. */
function buildMineshaft(s: PlacedStructure, ctx: StructureContext): void {
  const y = s.y;
  for (let i = -14; i <= 14; i++) {
    for (let w = -1; w <= 1; w++) {
      ctx.set(s.x + i, y, s.z + w, 'air');
      ctx.set(s.x + i, y - 1, s.z + w, 'oak_planks');
      if (i % 4 === 0) {
        ctx.set(s.x + i, y + 1, s.z + w, 'oak_fence');
        ctx.set(s.x + i, y + 2, s.z + w, 'oak_fence');
      }
    }
    ctx.set(s.x + i, y - 1, s.z, 'rail');
  }
  for (let i = -8; i <= 8; i++) {
    for (let w = -1; w <= 1; w++) {
      ctx.set(s.x + w, y, s.z + i, 'air');
      ctx.set(s.x + w, y - 1, s.z + i, 'oak_planks');
    }
  }
  ctx.set(s.x, y, s.z, 'chest');
  ctx.set(s.x, y + 1, s.z, 'torch');
}

/** The stronghold: a stone room with a portal frame. */
function buildStronghold(s: PlacedStructure, ctx: StructureContext): void {
  const y = s.y;
  for (let dx = -4; dx <= 4; dx++) {
    for (let dz = -4; dz <= 4; dz++) {
      for (let dy = 0; dy < 5; dy++) {
        const edge = dx === -4 || dx === 4 || dz === -4 || dz === 4 || dy === 0 || dy === 4;
        ctx.set(s.x + dx, y + dy, s.z + dz, edge ? 'stone_bricks' : 'air');
      }
    }
  }
  // The portal frame.
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = 0; dy <= 3; dy++) {
      ctx.set(s.x + dx, y + dy, s.z - 2, 'obsidian');
      ctx.set(s.x + dx, y + dy, s.z + 2, 'obsidian');
    }
  }
  ctx.set(s.x, y + 4, s.z, 'obsidian');
  ctx.set(s.x - 2, y + 1, s.z - 2, 'chest');
  ctx.set(s.x + 2, y + 1, s.z + 2, 'chest');
  ctx.set(s.x + 3, y + 2, s.z + 3, 'torch');
}

/** A witch hut on stilts. */
function buildWitchHut(s: PlacedStructure, ctx: StructureContext): void {
  const y = s.y;
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      const edge = dx === -2 || dx === 2 || dz === -2 || dz === 2;
      if (edge) {
        ctx.set(s.x + dx, y, s.z + dz, 'spruce_planks');
        ctx.set(s.x + dx, y + 1, s.z + dz, 'spruce_planks');
        ctx.set(s.x + dx, y + 2, s.z + dz, 'spruce_planks');
      } else {
        ctx.set(s.x + dx, y, s.z + dz, 'spruce_planks');
      }
      ctx.set(s.x + dx, y + 3, s.z + dz, 'spruce_planks');
    }
  }
  // Stilts and the roof.
  for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
    for (let dy = -3; dy < 0; dy++) ctx.set(s.x + dx, y + dy, s.z + dz, 'oak_fence');
  }
  ctx.set(s.x, y + 1, s.z - 2, 'spruce_planks');
  ctx.set(s.x, y + 2, s.z - 2, 'spruce_planks');
  ctx.set(s.x, y + 1, s.z + 2, 'torch');
  ctx.set(s.x, y, s.z, 'cauldron' as BlockName);
}

/** A pillager outpost: a log tower with a cobblestone base. */
function buildOutpost(s: PlacedStructure, ctx: StructureContext): void {
  const base = s.y;
  for (let dx = -3; dx <= 3; dx++) {
    for (let dz = -3; dz <= 3; dz++) {
      ctx.set(s.x + dx, base - 1, s.z + dz, 'cobblestone');
    }
  }
  for (let dy = 0; dy < 6; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      for (let dz = -3; dz <= 3; dz++) {
        const edge = dx === -3 || dx === 3 || dz === -3 || dz === 3;
        if (!edge) continue;
        ctx.set(s.x + dx, base + dy, s.z + dz, 'oak_log');
      }
    }
  }
  for (let dx = -3; dx <= 3; dx++) {
    for (let dz = -3; dz <= 3; dz++) {
      ctx.set(s.x + dx, base + 6, s.z + dz, 'oak_planks');
    }
  }
  ctx.set(s.x, base + 7, s.z, 'lantern');
  ctx.set(s.x + 2, base + 1, s.z + 2, 'chest');
}

/** A bastion ruin in the nether. */
function buildBastion(s: PlacedStructure, ctx: StructureContext): void {
  const base = s.y;
  for (let dx = -12; dx <= 12; dx++) {
    for (let dz = -12; dz <= 12; dz++) {
      const edge = Math.abs(dx) === 12 || Math.abs(dz) === 12;
      if (!edge) continue;
      const h = 3 + ((dx * 7 + dz * 13) % 5 + 5) % 5;
      for (let dy = 0; dy < h; dy++) {
        ctx.set(s.x + dx, base + dy, s.z + dz, (dx + dz) % 3 === 0 ? 'basalt' : 'netherrack');
      }
    }
  }
  ctx.set(s.x, base, s.z, 'netherrack');
  ctx.set(s.x + 2, base + 1, s.z, 'chest');
}

/** A ruined portal: an obsidian frame with lava in the middle. */
function buildRuinedPortal(s: PlacedStructure, ctx: StructureContext): void {
  const base = s.y;
  for (let dy = 0; dy <= 3; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      ctx.set(s.x + dx, base + dy, s.z, (dx + dy) % 3 === 0 ? 'crying_obsidian' : 'obsidian');
    }
  }
  ctx.set(s.x, base + 4, s.z, 'obsidian');
  ctx.set(s.x, base, s.z, 'lava');
}

/** A dark oak mansion with a tower. */
function buildMansion(s: PlacedStructure, ctx: StructureContext): void {
  const base = s.y;
  for (let dy = 0; dy < 4; dy++) {
    for (let dx = -5; dx <= 5; dx++) {
      for (let dz = -5; dz <= 5; dz++) {
        const edge = dx === -5 || dx === 5 || dz === -5 || dz === 5;
        if (edge) ctx.set(s.x + dx, base + dy, s.z + dz, 'dark_oak_planks');
        else if (dy === 0) ctx.set(s.x + dx, base + dy, s.z + dz, 'dark_oak_planks');
      }
    }
  }
  for (let dx = -5; dx <= 5; dx++) {
    for (let dz = -5; dz <= 5; dz++) {
      ctx.set(s.x + dx, base + 4, s.z + dz, 'dark_oak_planks');
    }
  }
  for (let dy = 0; dy < 9; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const edge = dx === -1 || dx === 1 || dz === -1 || dz === 1;
        if (edge) ctx.set(s.x + dx, base + 4 + dy, s.z + dz, 'dark_oak_log');
      }
    }
  }
  ctx.set(s.x, base + 13, s.z, 'lantern');
  ctx.set(s.x + 4, base + 1, s.z + 4, 'chest');
}

/** A trial chamber: a stone room with spawners. */
function buildTrialChamber(s: PlacedStructure, ctx: StructureContext): void {
  const y = s.y;
  for (let dx = -4; dx <= 4; dx++) {
    for (let dz = -4; dz <= 4; dz++) {
      for (let dy = 0; dy < 4; dy++) {
        const edge = dx === -4 || dx === 4 || dz === -4 || dz === 4 || dy === 0 || dy === 3;
        ctx.set(s.x + dx, y + dy, s.z + dz, edge ? 'stone_bricks' : 'air');
      }
    }
  }
  ctx.set(s.x - 2, y, s.z - 2, 'spawner');
  ctx.set(s.x + 2, y, s.z + 2, 'spawner');
  ctx.set(s.x, y, s.z, 'chest');
  ctx.set(s.x, y + 2, s.z, 'torch');
}

/** An ocean monument: a prismarine pyramid. */
function buildMonument(s: PlacedStructure, ctx: StructureContext): void {
  const base = s.y;
  for (let layer = 0; layer < 4; layer++) {
    const half = 8 - layer * 2;
    for (let dx = -half; dx <= half; dx++) {
      for (let dz = -half; dz <= half; dz++) {
        const edge = dx === -half || dx === half || dz === -half || dz === half;
        if (edge) ctx.set(s.x + dx, base + layer, s.z + dz, layer === 0 ? 'dark_prismarine' : 'prismarine');
      }
    }
  }
  ctx.set(s.x, base + 4, s.z, 'prismarine');
  ctx.set(s.x - 2, base + 4, s.z, 'chest');
}

/** An end city: a purpur tower with an end crystal on top. */
function buildEndCity(s: PlacedStructure, ctx: StructureContext): void {
  const base = s.y;
  for (let dy = 0; dy < 12; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const edge = dx === -2 || dx === 2 || dz === -2 || dz === 2;
        if (edge) ctx.set(s.x + dx, base + dy, s.z + dz, dy % 4 === 0 ? 'end_stone_bricks' : 'purpur_block');
      }
    }
  }
  for (let dy = 0; dy < 6; dy++) {
    ctx.set(s.x, base + 12 + dy, s.z, 'purpur_pillar');
  }
  ctx.set(s.x, base + 18, s.z, 'end_crystal');
  ctx.set(s.x, base + 12, s.z + 3, 'chest');
}
