/**
 * Stone, terrain and dimension blocks.
 *
 * `STONE_BLOCKS` are the solid bases that the shape family derives slabs,
 * stairs and walls from. Everything else here is a one-off block.
 */

import type { BlockDef, MiningLevel, ToolKind } from '../../core/types';
import { TAGS } from '../tags';
import { defineBlock } from './common';

interface StoneRow {
  id: string;
  name: string;
  texture: string;
  hardness: number;
  blast?: number;
  tier?: MiningLevel;
  tool?: ToolKind;
  correct?: boolean;
  flammable?: boolean;
  transparent?: boolean;
  gravity?: boolean;
  liquid?: boolean;
  light?: number;
  render?: 'opaque' | 'cutout' | 'translucent' | 'cross' | 'none';
  shape?: 'cube' | 'slab' | 'slabTop' | 'stairs' | 'fence' | 'pane' | 'plant' | 'fluid' | 'empty';
  slabShape?: boolean;
  passable?: boolean;
  axis?: 'y' | 'x' | 'z';
  drops?: BlockDef['drops'];
  tags?: string[];
  params?: Record<string, unknown>;
  top?: string;
  side?: string;
  bottom?: string;
}

/** Air is block id 0 — the engine reserves it. */
export const AIR_BLOCK: BlockDef = defineBlock({
  id: 'air',
  name: 'Air',
  family: 'air',
  hardness: -1,
  blastResistance: 0,
  transparent: true,
  render: 'none',
  shape: 'empty',
  passable: true,
  textures: 'stone',
  drops: [],
  tags: [],
  params: { special: 'air' },
});

function row(spec: StoneRow): BlockDef {
  const textures =
    spec.top || spec.side || spec.bottom
      ? { top: spec.top ?? spec.texture, side: spec.side ?? spec.texture, bottom: spec.bottom ?? spec.texture }
      : spec.texture;
  return defineBlock({
    id: spec.id,
    name: spec.name,
    family: 'stone',
    params: spec.params ?? {},
    hardness: spec.hardness,
    blastResistance: spec.blast,
    lightEmission: spec.light,
    tool: spec.tool ?? 'pickaxe',
    requiresToolTier: spec.tier ?? 0,
    correctToolDrops: spec.correct ?? false,
    flammable: spec.flammable ?? false,
    transparent: spec.transparent ?? false,
    liquid: spec.liquid ?? false,
    gravity: spec.gravity ?? false,
    slabShape: spec.slabShape ?? false,
    render: spec.render ?? 'opaque',
    shape: spec.shape ?? 'cube',
    axis: spec.axis ?? 'y',
    passable: spec.passable ?? false,
    textures,
    drops: spec.drops,
    tags: spec.tags ?? [TAGS.STONE],
  });
}

// ---------------------------------------------------------------------------
// Terrain
// ---------------------------------------------------------------------------

/**
 * Little treasures that hide in the dirt — digging is how kids explore, so a
 * surprise now and then keeps it fun. Every entry is an independent small
 * chance on top of the block itself.
 */
const DIRT_SURPRISES: BlockDef['drops'] = [
  { item: 'wheat_seeds', min: 1, max: 2, chance: 0.05 },
  { item: 'carrot', min: 1, max: 1, chance: 0.03 },
  { item: 'potato', min: 1, max: 1, chance: 0.03 },
  { item: 'beetroot', min: 1, max: 1, chance: 0.03 },
  { item: 'glow_berries', min: 1, max: 2, chance: 0.015 },
  { item: 'bone', min: 1, max: 2, chance: 0.02 },
  { item: 'flint', min: 1, max: 1, chance: 0.02 },
  { item: 'egg', min: 1, max: 1, chance: 0.01 },
  { item: 'slimeball', min: 1, max: 1, chance: 0.01 },
  { item: 'iron_nugget', min: 1, max: 2, chance: 0.01 },
  { item: 'poisonous_potato', min: 1, max: 1, chance: 0.005 },
  { item: 'gold_nugget', min: 1, max: 1, chance: 0.005 },
  { item: 'emerald', min: 1, max: 1, chance: 0.001 },
  { item: 'diamond', min: 1, max: 1, chance: 0.0005 },
];

export const TERRAIN_BLOCKS: BlockDef[] = [
  row({
    id: 'dirt', name: 'Dirt', texture: 'dirt', hardness: 0.5, tool: 'shovel', tags: [TAGS.DIRT],
    drops: [{ item: 'dirt', min: 1, max: 1 }, ...DIRT_SURPRISES],
  }),
  row({
    id: 'dirt_path', name: 'Dirt Path', texture: 'dirt_path', hardness: 0.5, tool: 'shovel',
    top: 'dirt_path', side: 'dirt_path', bottom: 'dirt', tags: [TAGS.DIRT],
    drops: [{ item: 'dirt', min: 1, max: 1 }, ...DIRT_SURPRISES],
  }),
  row({
    id: 'coarse_dirt', name: 'Coarse Dirt', texture: 'coarse_dirt', hardness: 0.5, tool: 'shovel', tags: [TAGS.DIRT],
    drops: [{ item: 'coarse_dirt', min: 1, max: 1 }, ...DIRT_SURPRISES],
  }),
  row({
    id: 'rooted_dirt', name: 'Rooted Dirt', texture: 'rooted_dirt', hardness: 0.5, tool: 'shovel', tags: [TAGS.DIRT],
    drops: [{ item: 'rooted_dirt', min: 1, max: 1 }, ...DIRT_SURPRISES],
  }),
  row({
    id: 'farmland', name: 'Farmland', texture: 'farmland', hardness: 0.6, tool: 'shovel',
    top: 'farmland', side: 'dirt', bottom: 'dirt', tags: [TAGS.DIRT],
    drops: [{ item: 'dirt', min: 1, max: 1 }, ...DIRT_SURPRISES],
  }),
  row({
    id: 'grass_block', name: 'Grass Block', texture: 'grass_block', hardness: 0.6, tool: 'shovel',
    top: 'grass_block', side: 'grass_block_side', bottom: 'dirt', tags: [TAGS.DIRT],
    drops: [{ item: 'dirt', min: 1, max: 1 }, ...DIRT_SURPRISES],
  }),
  row({
    id: 'podzol', name: 'Podzol', texture: 'podzol', hardness: 0.5, tool: 'shovel',
    top: 'podzol_top', side: 'podzol', bottom: 'dirt', tags: [TAGS.DIRT],
    drops: [{ item: 'dirt', min: 1, max: 1 }, ...DIRT_SURPRISES],
  }),
  row({
    id: 'mycelium', name: 'Mycelium', texture: 'mycelium', hardness: 0.6, tool: 'shovel',
    top: 'mycelium', side: 'mycelium', bottom: 'dirt', tags: [TAGS.DIRT],
    drops: [{ item: 'dirt', min: 1, max: 1 }, ...DIRT_SURPRISES],
  }),
  row({
    id: 'snowy_grass', name: 'Snowy Grass Block', texture: 'snow', hardness: 0.6, tool: 'shovel',
    top: 'snow', side: 'grass_block_side', bottom: 'dirt', tags: [TAGS.DIRT],
    drops: [{ item: 'dirt', min: 1, max: 1 }, ...DIRT_SURPRISES],
  }),
  row({
    id: 'mud', name: 'Mud', texture: 'mud', hardness: 0.5, tool: 'shovel', tags: [TAGS.DIRT],
    drops: [{ item: 'mud', min: 1, max: 1 }, ...DIRT_SURPRISES],
  }),
  row({
    id: 'mangrove_roots', name: 'Mangrove Roots', texture: 'mangrove_roots', hardness: 0.5, tool: 'shovel', tags: [TAGS.DIRT],
  }),
  row({
    id: 'muddy_mangrove_roots', name: 'Muddy Mangrove Roots', texture: 'muddy_mangrove_roots', hardness: 0.5, tool: 'shovel', tags: [TAGS.DIRT],
  }),
  row({
    id: 'sand', name: 'Sand', texture: 'sand', hardness: 0.5, tool: 'shovel', gravity: true, tags: [TAGS.SAND, TAGS.DIRT],
  }),
  row({
    id: 'red_sand', name: 'Red Sand', texture: 'red_sand', hardness: 0.5, tool: 'shovel', gravity: true, tags: [TAGS.SAND, TAGS.DIRT],
  }),
  row({
    id: 'gravel', name: 'Gravel', texture: 'gravel', hardness: 0.6, tool: 'shovel', gravity: true, tags: [TAGS.DIRT],
  }),
  row({
    id: 'clay', name: 'Clay', texture: 'clay', hardness: 0.6, tool: 'shovel', tags: [TAGS.DIRT],
  }),
  row({
    id: 'snow', name: 'Snow', texture: 'snow', hardness: 0.1, tool: 'shovel', transparent: true,
    render: 'cutout', shape: 'slab', slabShape: true, passable: true, tags: [TAGS.DIRT],
  }),
  row({
    id: 'snow_block', name: 'Snow Block', texture: 'snow_block', hardness: 0.2, tool: 'shovel', tags: [TAGS.DIRT],
  }),
  row({
    id: 'ice', name: 'Ice', texture: 'ice', hardness: 0.5, transparent: true, render: 'translucent', tags: [TAGS.STONE],
  }),
  row({
    id: 'packed_ice', name: 'Packed Ice', texture: 'packed_ice', hardness: 0.5, transparent: true, render: 'translucent', tags: [TAGS.STONE],
  }),
  row({
    id: 'blue_ice', name: 'Blue Ice', texture: 'blue_ice', hardness: 0.5, transparent: true, render: 'translucent', tags: [TAGS.STONE],
  }),
  row({
    id: 'water', name: 'Water', texture: 'water', hardness: -1, liquid: true, transparent: true, tool: 'none',
    render: 'translucent', shape: 'fluid', passable: true, drops: [], tags: [TAGS.IS_FLUID],
  }),
  row({
    id: 'lava', name: 'Lava', texture: 'lava', hardness: -1, liquid: true, transparent: true, light: 15, tool: 'none',
    render: 'translucent', shape: 'fluid', passable: true, drops: [], tags: [TAGS.IS_FLUID],
  }),
];

// ---------------------------------------------------------------------------
// Solid stone bases (the shape family derives from these)
// ---------------------------------------------------------------------------

export const STONE_BLOCKS: BlockDef[] = [
  row({ id: 'stone', name: 'Stone', texture: 'stone', hardness: 1.5, blast: 6, tier: 1, correct: true }),
  row({ id: 'smooth_stone', name: 'Smooth Stone', texture: 'smooth_stone', hardness: 2, blast: 6, tier: 1, correct: true }),
  row({ id: 'cobblestone', name: 'Cobblestone', texture: 'cobblestone', hardness: 2, blast: 6, tier: 1, correct: true }),
  row({ id: 'mossy_cobblestone', name: 'Mossy Cobblestone', texture: 'mossy_cobblestone', hardness: 2, blast: 6, tier: 1, correct: true }),
  row({ id: 'stone_bricks', name: 'Stone Bricks', texture: 'stone_bricks', hardness: 1.5, blast: 6, tier: 1, correct: true }),
  row({ id: 'mossy_stone_bricks', name: 'Mossy Stone Bricks', texture: 'mossy_stone_bricks', hardness: 1.5, blast: 6, tier: 1, correct: true }),
  row({ id: 'cracked_stone_bricks', name: 'Cracked Stone Bricks', texture: 'cracked_stone_bricks', hardness: 1.5, blast: 6, tier: 1, correct: true }),
  row({ id: 'chiseled_stone_bricks', name: 'Chiseled Stone Bricks', texture: 'chiseled_stone_bricks', hardness: 1.5, blast: 6, tier: 1, correct: true }),
  row({ id: 'granite', name: 'Granite', texture: 'granite', hardness: 1.5, blast: 6, tier: 1, correct: true }),
  row({ id: 'polished_granite', name: 'Polished Granite', texture: 'polished_granite', hardness: 1.5, blast: 6, tier: 1, correct: true }),
  row({ id: 'diorite', name: 'Diorite', texture: 'diorite', hardness: 1.5, blast: 6, tier: 1, correct: true }),
  row({ id: 'polished_diorite', name: 'Polished Diorite', texture: 'polished_diorite', hardness: 1.5, blast: 6, tier: 1, correct: true }),
  row({ id: 'andesite', name: 'Andesite', texture: 'andesite', hardness: 1.5, blast: 6, tier: 1, correct: true }),
  row({ id: 'polished_andesite', name: 'Polished Andesite', texture: 'polished_andesite', hardness: 1.5, blast: 6, tier: 1, correct: true }),
  row({ id: 'tuff', name: 'Tuff', texture: 'tuff', hardness: 1.5, blast: 3, tier: 1, correct: true }),
  row({ id: 'calcite', name: 'Calcite', texture: 'calcite', hardness: 0.75, blast: 3, tier: 1, correct: true }),
  row({ id: 'dripstone_block', name: 'Dripstone Block', texture: 'dripstone', hardness: 1.5, blast: 3, tier: 1, correct: true }),
  row({ id: 'sandstone', name: 'Sandstone', texture: 'sandstone', hardness: 0.8, tier: 1, correct: true }),
  row({ id: 'chiseled_sandstone', name: 'Chiseled Sandstone', texture: 'chiseled_sandstone', hardness: 0.8, tier: 1, correct: true }),
  row({ id: 'cut_sandstone', name: 'Cut Sandstone', texture: 'cut_sandstone', hardness: 0.8, tier: 1, correct: true }),
  row({ id: 'smooth_sandstone', name: 'Smooth Sandstone', texture: 'smooth_sandstone', hardness: 2, tier: 1, correct: true }),
  row({ id: 'red_sandstone', name: 'Red Sandstone', texture: 'red_sandstone', hardness: 0.8, tier: 1, correct: true }),
  row({ id: 'chiseled_red_sandstone', name: 'Chiseled Red Sandstone', texture: 'chiseled_red_sandstone', hardness: 0.8, tier: 1, correct: true }),
  row({ id: 'cut_red_sandstone', name: 'Cut Red Sandstone', texture: 'cut_red_sandstone', hardness: 0.8, tier: 1, correct: true }),
  row({ id: 'smooth_red_sandstone', name: 'Smooth Red Sandstone', texture: 'smooth_red_sandstone', hardness: 2, tier: 1, correct: true }),
  row({ id: 'prismarine', name: 'Prismarine', texture: 'prismarine', hardness: 1.5, blast: 6, tier: 1, correct: true }),
  row({ id: 'prismarine_bricks', name: 'Prismarine Bricks', texture: 'prismarine_bricks', hardness: 1.5, blast: 6, tier: 1, correct: true }),
  row({ id: 'dark_prismarine', name: 'Dark Prismarine', texture: 'dark_prismarine', hardness: 1.5, blast: 6, tier: 1, correct: true }),
  row({ id: 'quartz_block', name: 'Block of Quartz', texture: 'quartz_block', hardness: 0.9, tier: 1, correct: true }),
  row({ id: 'smooth_quartz', name: 'Smooth Quartz', texture: 'smooth_quartz', hardness: 0.9, tier: 1, correct: true }),
  row({ id: 'packed_mud', name: 'Packed Mud', texture: 'packed_mud', hardness: 1, tier: 1, correct: true }),
  row({ id: 'mud_bricks', name: 'Mud Bricks', texture: 'mud_bricks', hardness: 1.5, tier: 1, correct: true }),
  row({ id: 'bricks', name: 'Bricks', texture: 'bricks', hardness: 2, blast: 6, tier: 1, correct: true }),
  row({ id: 'nether_bricks', name: 'Nether Bricks', texture: 'nether_bricks', hardness: 2, blast: 6, tier: 1, correct: true }),
  row({ id: 'red_nether_bricks', name: 'Red Nether Bricks', texture: 'red_nether_bricks', hardness: 2, blast: 6, tier: 1, correct: true }),
  row({ id: 'end_stone_bricks', name: 'End Stone Bricks', texture: 'end_stone_bricks', hardness: 1.5, blast: 6, tier: 1, correct: true }),
  row({ id: 'deepslate', name: 'Deepslate', texture: 'deepslate', hardness: 3, blast: 12, tier: 2, correct: true }),
  row({ id: 'cobbled_deepslate', name: 'Cobbled Deepslate', texture: 'cobbled_deepslate', hardness: 3.5, blast: 12, tier: 2, correct: true }),
  row({ id: 'polished_deepslate', name: 'Polished Deepslate', texture: 'polished_deepslate', hardness: 3.5, blast: 12, tier: 2, correct: true }),
  row({ id: 'deepslate_bricks', name: 'Deepslate Bricks', texture: 'deepslate_bricks', hardness: 3.5, blast: 12, tier: 2, correct: true }),
  row({ id: 'cracked_deepslate_bricks', name: 'Cracked Deepslate Bricks', texture: 'cracked_deepslate_bricks', hardness: 3.5, blast: 12, tier: 2, correct: true }),
  row({ id: 'chiseled_deepslate_bricks', name: 'Chiseled Deepslate Bricks', texture: 'chiseled_deepslate_bricks', hardness: 3.5, blast: 12, tier: 2, correct: true }),
  row({ id: 'deepslate_tiles', name: 'Deepslate Tiles', texture: 'deepslate_tiles', hardness: 3.5, blast: 12, tier: 2, correct: true }),
  row({ id: 'cracked_deepslate_tiles', name: 'Cracked Deepslate Tiles', texture: 'cracked_deepslate_tiles', hardness: 3.5, blast: 12, tier: 2, correct: true }),
  row({ id: 'chiseled_deepslate_tiles', name: 'Chiseled Deepslate Tiles', texture: 'chiseled_deepslate_tiles', hardness: 3.5, blast: 12, tier: 2, correct: true }),
  row({ id: 'obsidian', name: 'Obsidian', texture: 'obsidian', hardness: 50, blast: 1200, tier: 4, correct: true }),
  row({ id: 'crying_obsidian', name: 'Crying Obsidian', texture: 'crying_obsidian', hardness: 50, blast: 1200, tier: 4, correct: true }),
  row({ id: 'netherrack', name: 'Netherrack', texture: 'netherrack', hardness: 0.4, blast: 2, tier: 1, correct: true }),
  row({ id: 'basalt', name: 'Basalt', texture: 'basalt', hardness: 1.25, blast: 6, tier: 1, correct: true }),
  row({ id: 'polished_basalt', name: 'Polished Basalt', texture: 'polished_basalt', hardness: 1.25, blast: 6, tier: 1, correct: true }),
  row({ id: 'smooth_basalt', name: 'Smooth Basalt', texture: 'smooth_basalt', hardness: 1.25, blast: 6, tier: 1, correct: true }),
  row({ id: 'blackstone', name: 'Blackstone', texture: 'blackstone', hardness: 1.5, blast: 6, tier: 1, correct: true }),
  row({ id: 'polished_blackstone', name: 'Polished Blackstone', texture: 'polished_blackstone', hardness: 1.5, blast: 6, tier: 1, correct: true }),
  row({ id: 'polished_blackstone_bricks', name: 'Polished Blackstone Bricks', texture: 'polished_blackstone_bricks', hardness: 1.5, blast: 6, tier: 1, correct: true }),
  row({ id: 'chiseled_polished_blackstone', name: 'Chiseled Polished Blackstone', texture: 'chiseled_polished_blackstone', hardness: 1.5, blast: 6, tier: 1, correct: true }),
  row({ id: 'gilded_blackstone', name: 'Gilded Blackstone', texture: 'gilded_blackstone', hardness: 1.5, blast: 6, tier: 1, correct: true }),
  row({ id: 'end_stone', name: 'End Stone', texture: 'end_stone', hardness: 3, blast: 9, tier: 1, correct: true }),
  row({ id: 'purpur_block', name: 'Purpur Block', texture: 'purpur', hardness: 1.5, blast: 6, tier: 1, correct: true }),
  row({ id: 'purpur_pillar', name: 'Purpur Pillar', texture: 'purpur', hardness: 1.5, blast: 6, tier: 1, correct: true, axis: 'y' }),
  row({ id: 'iron_block', name: 'Block of Iron', texture: 'iron_block', hardness: 5, blast: 6, tier: 2, correct: true }),
  row({ id: 'gold_block', name: 'Block of Gold', texture: 'gold_block', hardness: 3, blast: 6, tier: 3, correct: true }),
  row({ id: 'diamond_block', name: 'Block of Diamond', texture: 'diamond_block', hardness: 5, blast: 6, tier: 3, correct: true }),
  row({ id: 'emerald_block', name: 'Block of Emerald', texture: 'emerald_block', hardness: 5, blast: 6, tier: 3, correct: true }),
  row({ id: 'coal_block', name: 'Block of Coal', texture: 'coal_block', hardness: 5, blast: 6, tier: 1, correct: true }),
  row({ id: 'netherite_block', name: 'Block of Netherite', texture: 'netherite_block', hardness: 50, blast: 1200, tier: 4, correct: true }),
  row({ id: 'lapis_block', name: 'Block of Lapis Lazuli', texture: 'lapis_block', hardness: 3, blast: 3, tier: 2, correct: true }),
  row({ id: 'amethyst_block', name: 'Block of Amethyst', texture: 'amethyst_block', hardness: 1.5, blast: 3, tier: 1, correct: true }),
  row({ id: 'terracotta', name: 'Terracotta', texture: 'terracotta', hardness: 1.25, blast: 1.3, tier: 1, correct: true }),
  row({
    id: 'glass', name: 'Glass', texture: 'glass', hardness: 0.3, tool: 'pickaxe',
    transparent: true, render: 'translucent',
  }),
  row({
    id: 'tinted_glass', name: 'Tinted Glass', texture: 'tinted_glass', hardness: 0.3, tool: 'pickaxe',
    transparent: true, render: 'translucent',
  }),
  row({ id: 'resin_block', name: 'Block of Resin', texture: 'resin', hardness: 1.5, blast: 3, tier: 1, correct: true }),
  row({ id: 'resin_bricks', name: 'Resin Bricks', texture: 'resin_bricks', hardness: 1.5, blast: 3, tier: 1, correct: true }),
  row({ id: 'chiseled_resin_bricks', name: 'Chiseled Resin Bricks', texture: 'chiseled_resin_bricks', hardness: 1.5, blast: 3, tier: 1, correct: true }),
];

/** Base blocks that get slab, stair and wall variants. */
export const SHAPE_BASE_IDS: readonly string[] = STONE_BLOCKS.map((block) => block.id);

// ---------------------------------------------------------------------------
// Nether, End and dimension blocks
// ---------------------------------------------------------------------------

export const DIMENSION_BLOCKS: BlockDef[] = [
  row({ id: 'bedrock', name: 'Bedrock', texture: 'bedrock', hardness: -1, blast: 3600, drops: [] }),
  row({ id: 'magma', name: 'Magma Block', texture: 'magma', hardness: 0.5, blast: 3, light: 3, tier: 0 }),
  row({ id: 'soul_soil', name: 'Soul Soil', texture: 'soul_soil', hardness: 0.5, tool: 'shovel', tags: [TAGS.DIRT] }),
  row({ id: 'soul_sand', name: 'Soul Sand', texture: 'soul_sand', hardness: 0.5, tool: 'shovel', gravity: true, tags: [TAGS.SAND, TAGS.DIRT] }),
  row({ id: 'glowstone', name: 'Glowstone', texture: 'glowstone', hardness: 0.3, light: 15 }),
  row({ id: 'shroomlight', name: 'Shroomlight', texture: 'shroomlight', hardness: 0.2, light: 15 }),
  row({ id: 'sea_lantern', name: 'Sea Lantern', texture: 'sea_lantern', hardness: 0.3, light: 15 }),
  row({
    id: 'soul_fire', name: 'Soul Fire', texture: 'soul_fire', hardness: 0, light: 10, tool: 'none',
    transparent: true, render: 'cutout', shape: 'plant', passable: true, drops: [], tags: [],
  }),
  row({
    id: 'fire', name: 'Fire', texture: 'fire', hardness: 0, light: 15, tool: 'none',
    transparent: true, render: 'cross', shape: 'plant', passable: true, drops: [],
  }),
  row({ id: 'chorus_flower', name: 'Chorus Flower', texture: 'chorus_flower', hardness: 0.4, light: 0 }),
  row({ id: 'chorus_plant', name: 'Chorus Plant', texture: 'chorus', hardness: 0.4 }),
  row({ id: 'nether_wart_block', name: 'Block of Nether Wart', texture: 'nether_wart', hardness: 1, tier: 0 }),
  row({ id: 'warped_wart_block', name: 'Block of Warped Wart', texture: 'warped_wart', hardness: 1, tier: 0 }),
  row({ id: 'crimson_nylium', name: 'Crimson Nylium', texture: 'crimson_nylium', hardness: 0.5, tool: 'shovel', tags: [TAGS.DIRT] }),
  row({ id: 'warped_nylium', name: 'Warped Nylium', texture: 'warped_nylium', hardness: 0.5, tool: 'shovel', tags: [TAGS.DIRT] }),
  row({ id: 'respawn_anchor', name: 'Respawn Anchor', texture: 'respawn_anchor', hardness: 50, blast: 1200, tier: 4, correct: true }),
  row({ id: 'lodestone', name: 'Lodestone', texture: 'lodestone', hardness: 3.5, tier: 2, correct: true }),
  row({ id: 'beacon', name: 'Beacon', texture: 'beacon', hardness: 3, blast: 6, tier: 3, correct: true }),
  row({ id: 'conduit', name: 'Conduit', texture: 'conduit', hardness: 3, blast: 6, tier: 3, correct: true }),
  row({ id: 'end_portal_frame', name: 'End Portal Frame', texture: 'end_portal_frame', hardness: -1, drops: [] }),
  row({ id: 'end_portal', name: 'End Portal', texture: 'end_portal', hardness: -1, transparent: true, render: 'cutout', shape: 'plant', passable: true, drops: [] }),
  row({ id: 'nether_portal', name: 'Nether Portal', texture: 'nether_portal', hardness: -1, transparent: true, render: 'cutout', shape: 'plant', passable: true, drops: [] }),
  row({
    id: 'end_rod', name: 'End Rod', texture: 'end_rod', hardness: 0, light: 14, tool: 'none',
    transparent: true, render: 'cutout', shape: 'plant', passable: true, tags: [],
  }),
  row({ id: 'dragon_egg', name: 'Dragon Egg', texture: 'dragon_egg', hardness: 3, blast: 6, tier: 3, correct: true }),
  row({ id: 'end_crystal', name: 'End Crystal', texture: 'amethyst_cluster', hardness: 3, light: 1, tier: 3 }),
];

// ---------------------------------------------------------------------------
// Sculk
// ---------------------------------------------------------------------------

export const SCULK_BLOCKS: BlockDef[] = [
  row({ id: 'sculk', name: 'Sculk', texture: 'sculk', hardness: 0.2, tool: 'shovel', tags: [TAGS.DIRT] }),
  row({ id: 'sculk_sensor', name: 'Sculk Sensor', texture: 'sculk_sensor', hardness: 0.6, blast: 3, tier: 1, light: 10, correct: true }),
  row({ id: 'sculk_catalyst', name: 'Sculk Catalyst', texture: 'sculk_catalyst', hardness: 0.3, blast: 3, tier: 1, light: 10, correct: true }),
  row({ id: 'sculk_shrieker', name: 'Sculk Shrieker', texture: 'sculk_shrieker', hardness: 0.3, blast: 3, tier: 1, light: 0, correct: true }),
  row({ id: 'sculk_vein', name: 'Sculk Vein', texture: 'sculk_vein', hardness: 0.3, tool: 'shovel', tags: [TAGS.DIRT] }),
];
