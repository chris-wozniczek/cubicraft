/**
 * Plants — flowers, crops, fungi and other living blocks.
 *
 * Almost every plant is a cross-rendered, passable block; the few that are
 * solid (cactus, melon, pumpkin) are marked explicitly.
 */

import type { BlockDef } from '../../core/types';
import { TAGS } from '../tags';
import { defineBlock } from './common';

interface PlantRow {
  id: string;
  name: string;
  texture: string;
  /** Render as a cross-shaped plant. */
  cross?: boolean;
  /** Solid full block. */
  solid?: boolean;
  hardness?: number;
  tool?: 'none' | 'axe' | 'shovel' | 'shears' | 'hoe';
  flammable?: boolean;
  /** Grows underwater. */
  waterloggable?: boolean;
  light?: number;
  liquid?: boolean;
  tags?: string[];
}

function plant(spec: PlantRow): BlockDef {
  const cross = spec.cross ?? !spec.solid;
  return defineBlock({
    id: spec.id,
    name: spec.name,
    family: 'plant',
    hardness: spec.hardness ?? 0,
    tool: spec.tool ?? 'none',
    flammable: spec.flammable ?? true,
    transparent: cross,
    render: cross ? 'cross' : 'opaque',
    shape: cross ? 'plant' : 'cube',
    passable: cross,
    lightEmission: spec.light ?? 0,
    liquid: spec.liquid ?? false,
    waterloggable: spec.waterloggable ?? false,
    textures: spec.texture,
    tags: spec.tags ?? [TAGS.IS_PLANT],
    params: { plant: spec.id },
  });
}

export const PLANT_BLOCKS: BlockDef[] = [
  // Small flowers
  plant({ id: 'dandelion', name: 'Dandelion', texture: 'dandelion' }),
  plant({ id: 'poppy', name: 'Poppy', texture: 'poppy' }),
  plant({ id: 'blue_orchid', name: 'Blue Orchid', texture: 'blue_orchid' }),
  plant({ id: 'allium', name: 'Allium', texture: 'allium' }),
  plant({ id: 'azure_bluet', name: 'Azure Bluet', texture: 'azure_bluet' }),
  plant({ id: 'red_tulip', name: 'Red Tulip', texture: 'red_tulip' }),
  plant({ id: 'orange_tulip', name: 'Orange Tulip', texture: 'orange_tulip' }),
  plant({ id: 'white_tulip', name: 'White Tulip', texture: 'white_tulip' }),
  plant({ id: 'pink_tulip', name: 'Pink Tulip', texture: 'pink_tulip' }),
  plant({ id: 'oxeye_daisy', name: 'Oxeye Daisy', texture: 'oxeye_daisy' }),
  plant({ id: 'cornflower', name: 'Cornflower', texture: 'cornflower' }),
  plant({ id: 'lily_of_the_valley', name: 'Lily of the Valley', texture: 'lily_of_the_valley' }),
  plant({ id: 'wither_rose', name: 'Wither Rose', texture: 'wither_rose' }),
  plant({ id: 'torchflower', name: 'Torchflower', texture: 'torchflower' }),
  plant({ id: 'cactus_flower', name: 'Cactus Flower', texture: 'cactus_flower', solid: true, hardness: 0.4 }),
  plant({ id: 'pitcher_plant', name: 'Pitcher Plant', texture: 'pitcher_plant', solid: true, hardness: 0.4 }),

  // Tall flowers
  plant({ id: 'sunflower', name: 'Sunflower', texture: 'sunflower' }),
  plant({ id: 'lilac', name: 'Lilac', texture: 'lilac' }),
  plant({ id: 'rose_bush', name: 'Rose Bush', texture: 'rose_bush' }),
  plant({ id: 'peony', name: 'Peony', texture: 'peony' }),
  plant({ id: 'torchflower_crop', name: 'Torchflower Crop', texture: 'torchflower_crop', tool: 'hoe' }),

  // Fungi
  plant({ id: 'brown_mushroom', name: 'Brown Mushroom', texture: 'brown_mushroom' }),
  plant({ id: 'red_mushroom', name: 'Red Mushroom', texture: 'red_mushroom' }),
  plant({ id: 'blue_mushroom', name: 'Blue Mushroom', texture: 'blue_mushroom' }),
  plant({ id: 'crimson_fungus', name: 'Crimson Fungus', texture: 'crimson_fungus' }),
  plant({ id: 'warped_fungus', name: 'Warped Fungus', texture: 'warped_fungus' }),

  // Crops
  plant({ id: 'wheat_crops', name: 'Wheat Crops', texture: 'wheat', tool: 'hoe' }),
  plant({ id: 'carrots', name: 'Carrot Crops', texture: 'carrots', tool: 'hoe' }),
  plant({ id: 'potatoes', name: 'Potato Crops', texture: 'potatoes', tool: 'hoe' }),
  plant({ id: 'beetroot_crops', name: 'Beetroot Crops', texture: 'beetroot', tool: 'hoe' }),
  plant({ id: 'nether_wart', name: 'Nether Wart', texture: 'nether_wart', solid: true, hardness: 0.5 }),

  // Foliage
  plant({ id: 'grass', name: 'Grass', texture: 'grass' }),
  plant({ id: 'tall_grass', name: 'Tall Grass', texture: 'tall_grass' }),
  plant({ id: 'fern', name: 'Fern', texture: 'fern' }),
  plant({ id: 'dead_bush', name: 'Dead Bush', texture: 'dead_bush' }),
  plant({ id: 'dry_grass', name: 'Dry Grass', texture: 'dry_grass' }),
  plant({ id: 'wildflowers', name: 'Wildflowers', texture: 'wildflowers' }),
  plant({ id: 'bush', name: 'Bush', texture: 'bush' }),
  plant({ id: 'firefly_bush', name: 'Firefly Bush', texture: 'firefly_bush', light: 14 }),
  plant({ id: 'leaf_litter', name: 'Leaf Litter', texture: 'leaf_litter' }),
  plant({ id: 'sweet_berry_bush', name: 'Sweet Berry Bush', texture: 'sweet_berry_bush', solid: true, hardness: 0.3 }),
  plant({ id: 'pink_petals', name: 'Pink Petals', texture: 'pink_petals' }),
  plant({ id: 'azalea', name: 'Azalea', texture: 'azalea' }),
  plant({ id: 'flowering_azalea', name: 'Flowering Azalea', texture: 'flowering_azalea' }),
  plant({ id: 'glow_lichen', name: 'Glow Lichen', texture: 'glow_lichen', light: 7 }),
  plant({ id: 'moss_block', name: 'Moss Block', texture: 'moss_block', solid: true, hardness: 0.1, tool: 'shovel' }),
  plant({ id: 'moss_carpet', name: 'Moss Carpet', texture: 'moss_block', hardness: 0.1, tool: 'shovel' }),
  plant({ id: 'pale_moss', name: 'Pale Moss', texture: 'pale_moss', solid: true, hardness: 0.1, tool: 'shovel' }),
  plant({ id: 'pale_hanging_moss', name: 'Pale Hanging Moss', texture: 'pale_moss' }),
  plant({ id: 'pale_moss_carpet', name: 'Pale Moss Carpet', texture: 'pale_moss', hardness: 0.1, tool: 'shovel' }),
  plant({ id: 'big_dripleaf', name: 'Big Dripleaf', texture: 'big_dripleaf', solid: true, hardness: 0.1 }),
  plant({ id: 'hanging_roots', name: 'Hanging Roots', texture: 'hanging_roots' }),
  plant({ id: 'spore_blossom', name: 'Spore Blossom', texture: 'chorus_flower', solid: true, hardness: 0.1 }),
  plant({ id: 'cave_vines', name: 'Cave Vines', texture: 'cave_vines' }),
  plant({ id: 'vines', name: 'Vines', texture: 'vines' }),
  plant({ id: 'glow_berries', name: 'Glow Berries', texture: 'glow_berries', light: 14 }),
  plant({ id: 'sugar_cane', name: 'Sugar Cane', texture: 'sugar_cane' }),
  plant({ id: 'cactus', name: 'Cactus', texture: 'cactus', solid: true, hardness: 0.4 }),
  plant({ id: 'cocoa', name: 'Cocoa', texture: 'cocoa', solid: true, hardness: 0.2 }),
  plant({ id: 'pumpkin', name: 'Pumpkin', texture: 'pumpkin', solid: true, hardness: 1 }),
  plant({ id: 'melon', name: 'Melon', texture: 'melon', solid: true, hardness: 1 }),
  plant({ id: 'sea_pickle', name: 'Sea Pickle', texture: 'sea_pickle', light: 1 }),

  // Mangrove growth
  plant({ id: 'mangrove_propagule', name: 'Mangrove Propagule', texture: 'mangrove_roots' }),

  // Nether and End growth
  plant({ id: 'crimson_roots', name: 'Crimson Roots', texture: 'crimson_roots' }),
  plant({ id: 'warped_roots', name: 'Warped Roots', texture: 'warped_roots' }),
  plant({ id: 'nether_sprouts', name: 'Nether Sprouts', texture: 'nether_sprouts' }),

  // Aquatic
  plant({ id: 'kelp', name: 'Kelp', texture: 'kelp', waterloggable: true }),
  plant({ id: 'seagrass', name: 'Seagrass', texture: 'seagrass', waterloggable: true }),
  plant({ id: 'lily_pad', name: 'Lily Pad', texture: 'lily_pad', waterloggable: true }),

  // Amethyst
  plant({ id: 'budding_amethyst', name: 'Budding Amethyst', texture: 'budding_amethyst', solid: true, hardness: 1.5 }),
  plant({ id: 'amethyst_cluster', name: 'Amethyst Cluster', texture: 'amethyst_cluster', solid: true, hardness: 1.5 }),
  plant({ id: 'small_amethyst_bud', name: 'Small Amethyst Bud', texture: 'amethyst_cluster', solid: true, hardness: 1.5 }),
  plant({ id: 'medium_amethyst_bud', name: 'Medium Amethyst Bud', texture: 'amethyst_cluster', solid: true, hardness: 1.5 }),
  plant({ id: 'large_amethyst_bud', name: 'Large Amethyst Bud', texture: 'amethyst_cluster', solid: true, hardness: 1.5 }),

  // Misc growth
  plant({ id: 'frogspawn', name: 'Frogspawn', texture: 'frogspawn', solid: true, hardness: 0.3 }),
];

/** Blocks that host a nest or hive. */
export const BEE_BLOCKS: BlockDef[] = [
  defineBlock({
    id: 'bee_nest',
    name: 'Bee Nest',
    family: 'functional',
    hardness: 0.3,
    tool: 'axe',
    textures: 'bee_nest',
    tags: [TAGS.IS_BEE],
    params: { bees: true },
  }),
  defineBlock({
    id: 'beehive',
    name: 'Beehive',
    family: 'functional',
    hardness: 0.3,
    tool: 'axe',
    textures: 'bee_nest',
    tags: [TAGS.IS_BEE],
    params: { bees: true },
  }),
];
