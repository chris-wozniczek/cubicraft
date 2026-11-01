/**
 * Canonical texture catalogue.
 *
 * Blocks and items reference textures by NAME only. The atlas builder walks
 * `TEXTURE_NAMES` and renders each name procedurally, so the index of a name
 * is a rendering detail that content must never hard-code.
 *
 * The block side of the list is curated by hand: a typo in a block definition
 * shows up as a validation error instead of a silently missing atlas layer.
 * The item side is derived from the item table so an item icon can never
 * drift out of the catalogue.
 */

import { ALL_ITEMS } from './items/index';
import { DYE_COLORS, WOOD_TYPES, type DyeColor, type WoodType } from './tags';

// ---------------------------------------------------------------------------
// Hand-curated block textures
// ---------------------------------------------------------------------------

const TERRAIN_TEXTURES = [
  'dirt', 'dirt_path', 'coarse_dirt', 'rooted_dirt', 'farmland', 'grass_block', 'grass_block_side',
  'podzol', 'mycelium', 'snowy_grass', 'mud', 'mangrove_roots', 'muddy_mangrove_roots', 'clay',
  'sand', 'red_sand', 'gravel', 'snow', 'snow_block', 'ice', 'packed_ice', 'blue_ice',
  'water', 'lava', 'glass', 'glass_pane', 'sponge', 'wet_sponge', 'honey_block', 'slime_block',
  'hay_block', 'pumpkin', 'melon', 'carved_pumpkin', 'moss_block', 'podzol_top',
  'glass', 'tinted_glass', 'terracotta', 'sea_lantern', 'dried_kelp_block', 'crafter',
  'grindstone', 'flower_pot', 'beacon', 'conduit', 'lodestone', 'respawn_anchor',
  'turtle_egg', 'budding_amethyst',
];

const STONE_TEXTURES = [
  'stone', 'smooth_stone', 'cobblestone', 'mossy_cobblestone', 'stone_bricks', 'mossy_stone_bricks',
  'cracked_stone_bricks', 'chiseled_stone_bricks', 'bricks', 'nether_bricks', 'red_nether_bricks',
  'end_stone_bricks', 'granite', 'polished_granite', 'diorite', 'polished_diorite', 'andesite',
  'polished_andesite', 'tuff', 'calcite', 'dripstone', 'deepslate', 'cobbled_deepslate',
  'polished_deepslate', 'deepslate_bricks', 'cracked_deepslate_bricks', 'chiseled_deepslate_bricks',
  'deepslate_tiles', 'cracked_deepslate_tiles', 'chiseled_deepslate_tiles', 'sandstone',
  'chiseled_sandstone', 'cut_sandstone', 'smooth_sandstone', 'red_sandstone', 'chiseled_red_sandstone',
  'cut_red_sandstone', 'smooth_red_sandstone', 'prismarine', 'prismarine_bricks', 'dark_prismarine',
  'quartz', 'smooth_quartz', 'packed_mud', 'mud_bricks', 'obsidian', 'crying_obsidian', 'bedrock',
  'netherrack', 'basalt', 'polished_basalt', 'smooth_basalt', 'blackstone', 'polished_blackstone',
  'polished_blackstone_bricks', 'chiseled_polished_blackstone', 'gilded_blackstone', 'magma',
  'soul_soil', 'soul_sand', 'end_stone', 'purpur', 'chorus', 'glowstone', 'shroomlight', 'sculk',
  'sculk_sensor', 'sculk_catalyst', 'sculk_shrieker', 'sculk_vein', 'resin', 'resin_bricks',
  'chiseled_resin_bricks', 'sulfur', 'cinnabar', 'warped_wart', 'crimson_nylium',
  'warped_nylium',
];

const ORE_TEXTURES = [
  'coal_ore', 'deepslate_coal_ore', 'iron_ore', 'deepslate_iron_ore', 'copper_ore',
  'deepslate_copper_ore', 'gold_ore', 'deepslate_gold_ore', 'redstone_ore', 'lit_redstone_ore',
  'deepslate_redstone_ore', 'deepslate_lit_redstone_ore', 'lapis_ore', 'deepslate_lapis_ore',
  'diamond_ore', 'deepslate_diamond_ore', 'emerald_ore', 'deepslate_emerald_ore', 'nether_gold_ore',
  'ancient_debris', 'ancient_debris_ore', 'quartz_ore', 'nether_quartz_ore',
  'deepslate_ancient_debris', 'deepslate_nether_gold_ore', 'deepslate_quartz_ore',
  'deepslate_nether_quartz_ore',
];

const COPPER_TEXTURES = [
  'copper_block', 'exposed_copper', 'weathered_copper', 'oxidized_copper', 'waxed_copper_block',
  'waxed_exposed_copper', 'waxed_weathered_copper', 'waxed_oxidized_copper', 'cut_copper',
  'exposed_cut_copper', 'weathered_cut_copper', 'oxidized_cut_copper', 'waxed_cut_copper',
  'waxed_exposed_cut_copper', 'waxed_weathered_cut_copper', 'waxed_oxidized_cut_copper',
  'copper_grate', 'copper_door', 'copper_trapdoor', 'copper_bulb',
];

const PLANT_TEXTURES = [
  'dandelion', 'poppy', 'blue_orchid', 'allium', 'azure_bluet', 'red_tulip', 'orange_tulip',
  'white_tulip', 'pink_tulip', 'oxeye_daisy', 'cornflower', 'lily_of_the_valley', 'wither_rose',
  'torchflower', 'torchflower_crop', 'pitcher_plant', 'cactus_flower', 'sunflower', 'lilac',
  'rose_bush', 'peony', 'brown_mushroom', 'red_mushroom', 'crimson_fungus', 'warped_fungus',
  'nether_wart', 'wheat', 'carrots', 'potatoes', 'beetroot', 'sugar_cane', 'kelp', 'lily_pad',
  'seagrass', 'vine', 'glow_berries', 'sweet_berry_bush', 'dead_bush', 'firefly_bush', 'leaf_litter',
  'azalea', 'flowering_azalea', 'sea_pickle', 'chorus_flower', 'cactus', 'pumpkin_stem',
  'melon_stem', 'cocoa', 'big_dripleaf', 'hanging_roots', 'pointed_dripstone', 'cave_vines',
  'tube_coral', 'brain_coral', 'bubble_coral', 'horn_coral', 'fire_coral',
  'dead_tube_coral', 'dead_brain_coral', 'dead_bubble_coral', 'dead_horn_coral',
  'dead_fire_coral', 'blue_mushroom', 'bush', 'dry_grass', 'fern', 'frogspawn',
  'glow_lichen', 'grass', 'tall_grass', 'pale_moss', 'pink_petals', 'vines',
  'wildflowers', 'crimson_roots', 'warped_roots', 'nether_sprouts',
];

const FUNCTIONAL_TEXTURES = [
  'furnace', 'furnace_front', 'furnace_front_lit', 'blast_furnace', 'blast_furnace_front', 'smoker',
  'smoker_front', 'crafting_table', 'crafting_table_front', 'chest', 'trapped_chest', 'ender_chest',
  'shulker_box', 'hopper', 'dispenser', 'dropper', 'observer', 'piston', 'piston_front',
  'sticky_piston', 'tnt', 'tnt_side', 'note_block', 'jukebox', 'lectern', 'enchanting_table',
  'enchanting_table_top', 'anvil', 'chipped_anvil', 'damaged_anvil', 'brewing_stand', 'cauldron',
  'cauldron_full', 'smithing_table', 'stonecutter', 'cartography_table', 'fletching_table', 'loom',
  'barrel', 'composter', 'bee_nest', 'bell', 'lantern', 'soul_lantern', 'campfire', 'soul_campfire',
  'candle', 'scaffolding', 'ladder', 'rail', 'powered_rail', 'detector_rail', 'activator_rail',
  'minecart', 'minecart_furnace', 'minecart_chest', 'minecart_tnt', 'minecart_hopper', 'boat',
  'chest_boat', 'armor_stand', 'item_frame', 'painting', 'banner', 'bed', 'redstone_wire',
  'redstone_torch', 'redstone_torch_off', 'redstone_lamp', 'target', 'repeater', 'comparator',
  'tripwire', 'tripwire_hook', 'lever', 'stone_button', 'stone_pressure_plate',
  'light_weighted_pressure_plate', 'heavy_weighted_pressure_plate', 'daylight_detector',
  'lightning_rod', 'spawner', 'structure_block', 'command_block', 'barrier', 'iron_bars', 'chain',
  'cobweb', 'torch', 'soul_torch', 'soul_fire', 'fire', 'nether_portal', 'end_portal',
  'end_portal_frame', 'end_rod', 'dragon_egg', 'iron_block', 'gold_block', 'diamond_block',
  'emerald_block', 'coal_block', 'netherite_block', 'redstone_block', 'lapis_block', 'quartz_block',
  'amethyst_block', 'amethyst_cluster', 'ominous_banner', 'ominous_banner_base', 'structure_void',
];

/** Per-wood texture names. Nether woods trade `log` for `stem`/`hyphae`. */
function woodTextures(wood: WoodType): string[] {
  if (wood === 'bamboo') {
    return ['bamboo_block', 'bamboo_planks', 'bamboo_leaves', 'bamboo_mosaic'];
  }
  if (wood === 'crimson' || wood === 'warped') {
    return [
      `${wood}_stem`, `${wood}_stem_top`, `${wood}_hyphae`, `${wood}_hyphae_top`,
      `${wood}_planks`, `${wood}_leaves`, `${wood}_nether_sprouts`,
    ];
  }
  return [`${wood}_log`, `${wood}_log_top`, `${wood}_planks`, `${wood}_leaves`, `${wood}_sapling`];
}

/** Per-colour texture names. One texture serves every dyed variant of it. */
function colorTextures(color: DyeColor): string[] {
  return [`${color}_wool`, `${color}_concrete`, `${color}_terracotta`, `${color}_stained_glass`];
}

const BLOCK_TEXTURE_NAMES: string[] = [
  ...TERRAIN_TEXTURES,
  ...STONE_TEXTURES,
  ...ORE_TEXTURES,
  ...COPPER_TEXTURES,
  ...PLANT_TEXTURES,
  ...FUNCTIONAL_TEXTURES,
  ...WOOD_TYPES.flatMap(woodTextures),
  ...DYE_COLORS.flatMap(colorTextures),
];

// ---------------------------------------------------------------------------
// Item icons
// ---------------------------------------------------------------------------

/** Item icons are whatever the item table declares; collected, never typed twice. */
const ITEM_TEXTURE_NAMES: string[] = ALL_ITEMS.map((item) => item.icon);

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

function unique(names: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

/**
 * Textures for the mod-style extras (cameras, lasers, the paint bucket and
 * the time control). They live with the block textures so the atlas picks
 * them up automatically.
 */
const EXTRA_TEXTURES = ['camera', 'laser', 'paint_bucket', 'sun', 'compass'];

/** Canonical, ordered, unique list of every texture name in the game. */
export const TEXTURE_NAMES: string[] = unique([
  ...BLOCK_TEXTURE_NAMES,
  ...EXTRA_TEXTURES,
  ...ITEM_TEXTURE_NAMES,
]);

const LAYER_INDEX = new Map<string, number>();
for (let i = 0; i < TEXTURE_NAMES.length; i++) {
  LAYER_INDEX.set(TEXTURE_NAMES[i], i);
}

/** Atlas layer index for a texture name, or -1 when the name is unknown. */
export function textureLayer(name: string): number {
  const layer = LAYER_INDEX.get(name);
  return layer === undefined ? -1 : layer;
}

/** True when the name is part of the canonical catalogue. */
export function hasTexture(name: string): boolean {
  return LAYER_INDEX.has(name);
}
