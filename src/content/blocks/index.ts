/**
 * The block catalogue.
 *
 * Every family generator contributes to one ordered list. The order is the
 * canonical block id order, so ids stay stable as long as the families keep
 * their order.
 */

import type { BlockDef } from '../../core/types';
import { TAGS } from '../tags';
import { AIR_BLOCK, DIMENSION_BLOCKS, SCULK_BLOCKS, STONE_BLOCKS, TERRAIN_BLOCKS } from './stoneBlocks';
import { WOOD_SPECS, woodAliases, woodFamily } from './woodFamily';
import { COLORS, colorFamily, defaultShulkerBox } from './colorFamily';
import { shapeFamily, type ShapeBase } from './shapeFamily';
import { doorFamily } from './doorFamily';
import { signFamily } from './signFamily';
import { oreFamily, type OreKind } from './oreFamily';
import { COPPER_STAGES, copperFamily } from './copperFamily';
import { stoneVariantFamily, type StoneVariantName } from './stoneVariantFamily';
import { CORAL_SPECS, coralFamily } from './coralFamily';
import { BEE_BLOCKS, PLANT_BLOCKS } from './plants';
import { FUNCTIONAL_BLOCKS, INFESTED_STONE_BLOCKS, STAINED_GLASS_PANES } from './functional';

/** Ores the world can generate. */
const ORE_KINDS: readonly OreKind[] = [
  'coal', 'iron', 'copper', 'gold', 'redstone', 'lapis', 'diamond', 'emerald',
  'nether_gold', 'ancient_debris', 'quartz', 'nether_quartz',
];

/** Mineral stone sets. */
const STONE_VARIANTS: readonly StoneVariantName[] = ['sulfur', 'cinnabar'];

/**
 * Solid blocks that also support slab, stair and wall shapes.
 *
 * These are the terrain blocks a voxel world wants to build with even though
 * the base game does not ship every shape for them.
 */
const EXTRA_SHAPE_BASES: readonly ShapeBase[] = [
  { id: 'snow_block', name: 'Snow Block', family: 'stone', texture: 'snow_block', hardness: 0.2, tool: 'shovel', tags: [TAGS.DIRT] },
  { id: 'packed_ice', name: 'Packed Ice', family: 'stone', texture: 'packed_ice', hardness: 0.5, tags: [TAGS.STONE] },
  { id: 'glowstone', name: 'Glowstone', family: 'stone', texture: 'glowstone', hardness: 0.3, tags: [TAGS.STONE] },
  { id: 'shroomlight', name: 'Shroomlight', family: 'stone', texture: 'shroomlight', hardness: 0.2, tags: [TAGS.STONE] },
  { id: 'sea_lantern', name: 'Sea Lantern', family: 'stone', texture: 'sea_lantern', hardness: 0.3, tags: [TAGS.STONE] },
  { id: 'magma', name: 'Magma Block', family: 'stone', texture: 'magma', hardness: 0.5, tags: [TAGS.STONE] },
  { id: 'soul_soil', name: 'Soul Soil', family: 'stone', texture: 'soul_soil', hardness: 0.5, tool: 'shovel', tags: [TAGS.DIRT] },
  { id: 'soul_sand', name: 'Soul Sand', family: 'stone', texture: 'soul_sand', hardness: 0.5, tool: 'shovel', tags: [TAGS.SAND] },
  { id: 'crimson_nylium', name: 'Crimson Nylium', family: 'stone', texture: 'crimson_nylium', hardness: 0.5, tool: 'shovel', tags: [TAGS.DIRT] },
  { id: 'warped_nylium', name: 'Warped Nylium', family: 'stone', texture: 'warped_nylium', hardness: 0.5, tool: 'shovel', tags: [TAGS.DIRT] },
];

/** Metal and stone bases for the door family. */
const METAL_DOOR_BASES = [
  {
    base: {
      id: 'iron',
      name: 'Iron',
      family: 'metal',
      texture: 'iron_block',
      hardness: 5,
      blastResistance: 6,
      tool: 'pickaxe' as const,
      requiresToolTier: 2 as const,
      correctToolDrops: true,
    },
  },
  {
    base: {
      id: 'gold',
      name: 'Gold',
      family: 'metal',
      texture: 'gold_block',
      hardness: 3,
      blastResistance: 6,
      tool: 'pickaxe' as const,
      requiresToolTier: 3 as const,
      correctToolDrops: true,
    },
    forms: ['door', 'trapdoor'] as const,
  },
  {
    base: {
      id: 'copper',
      name: 'Copper',
      family: 'metal',
      texture: 'copper_block',
      hardness: 3,
      blastResistance: 6,
      tool: 'pickaxe' as const,
      requiresToolTier: 1 as const,
      correctToolDrops: true,
      tags: [TAGS.IS_COPPER],
    },
    forms: ['fence', 'fence_gate', 'button', 'pressure_plate'] as const,
  },
  {
    base: {
      id: 'stone',
      name: 'Stone',
      family: 'stone',
      texture: 'stone',
      hardness: 1.5,
      blastResistance: 6,
      tool: 'pickaxe' as const,
      requiresToolTier: 1 as const,
      correctToolDrops: true,
      tags: [TAGS.STONE],
    },
    forms: ['button', 'pressure_plate'] as const,
  },
  {
    base: {
      id: 'polished_blackstone',
      name: 'Polished Blackstone',
      family: 'stone',
      texture: 'polished_blackstone',
      hardness: 1.5,
      blastResistance: 6,
      tool: 'pickaxe' as const,
      requiresToolTier: 1 as const,
      correctToolDrops: true,
      tags: [TAGS.STONE],
    },
    forms: ['button', 'pressure_plate'] as const,
  },
];

/** Build the whole block catalogue in canonical order. */
function buildBlocks(): BlockDef[] {
  const list: BlockDef[] = [];

  list.push(AIR_BLOCK);
  list.push(...TERRAIN_BLOCKS);
  list.push(...STONE_BLOCKS);
  list.push(...DIMENSION_BLOCKS);
  list.push(...SCULK_BLOCKS);
  list.push(...INFESTED_STONE_BLOCKS);

  // Shape family: every solid base gets slab, stairs and wall.
  const shapeBases: ShapeBase[] = STONE_BLOCKS.map((block) => ({
    id: block.id,
    name: block.displayName,
    family: block.family,
    texture: block.textures.side,
    hardness: block.hardness,
    blastResistance: block.blastResistance,
    tool: block.tool,
    requiresToolTier: block.requiresToolTier,
    correctToolDrops: block.correctToolDrops,
    flammable: block.flammable,
    transparent: block.transparent,
    tags: block.tags,
  }));
  shapeBases.push(...EXTRA_SHAPE_BASES);
  for (const base of shapeBases) list.push(...shapeFamily(base));

  // Colour family.
  for (const color of COLORS) list.push(...colorFamily(color));
  list.push(defaultShulkerBox());
  list.push(...STAINED_GLASS_PANES);

  // Wood family (including its door and sign forms).
  for (const wood of WOOD_SPECS) list.push(...woodFamily(wood));
  list.push(...woodAliases());

  // Metal and stone door forms.
  for (const entry of METAL_DOOR_BASES) {
    list.push(...doorFamily({ ...entry.base, forms: entry.forms }));
  }

  // Ores.
  for (const kind of ORE_KINDS) list.push(...oreFamily(kind));

  // Copper.
  for (const stage of COPPER_STAGES) list.push(...copperFamily(stage.stage));

  // Mineral stone sets.
  for (const variant of STONE_VARIANTS) list.push(...stoneVariantFamily(variant));

  // Corals.
  for (const coral of CORAL_SPECS) {
    list.push(...coralFamily(coral.type, false));
    list.push(...coralFamily(coral.type, true));
  }

  // Plants.
  list.push(...PLANT_BLOCKS);
  list.push(...BEE_BLOCKS);

  // Functional blocks.
  list.push(...FUNCTIONAL_BLOCKS);

  return list;
}

/** Every block in the game, in canonical id order. */
export const ALL_BLOCKS: BlockDef[] = buildBlocks();

/** Convenience re-exports so other content files can import from one place. */
export { signFamily };
