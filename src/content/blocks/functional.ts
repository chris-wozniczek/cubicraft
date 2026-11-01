/**
 * Functional blocks — machines, containers, redstone and the rest of the
 * interactive furniture of the world.
 */

import type { BlockDef } from '../../core/types';
import { TAGS } from '../tags';
import { defineBlock } from './common';

interface FuncRow {
  id: string;
  name: string;
  texture: string | { top?: string; side?: string; bottom?: string; front?: string };
  hardness: number;
  blast?: number;
  tool?: 'none' | 'axe' | 'pickaxe' | 'shovel' | 'shears' | 'hoe';
  tier?: 0 | 1 | 2 | 3 | 4;
  correct?: boolean;
  flammable?: boolean;
  transparent?: boolean;
  light?: number;
  render?: 'opaque' | 'cutout' | 'translucent' | 'cross' | 'none';
  shape?: 'cube' | 'slab' | 'slabTop' | 'stairs' | 'fence' | 'pane' | 'plant' | 'fluid' | 'empty';
  axis?: 'y' | 'x' | 'z';
  slabShape?: boolean;
  passable?: boolean;
  waterloggable?: boolean;
  tags?: string[];
  drops?: BlockDef['drops'];
  params?: Record<string, unknown>;
}

function func(spec: FuncRow): BlockDef {
  return defineBlock({
    id: spec.id,
    name: spec.name,
    family: 'functional',
    params: spec.params ?? {},
    hardness: spec.hardness,
    blastResistance: spec.blast,
    lightEmission: spec.light ?? 0,
    tool: spec.tool ?? 'pickaxe',
    requiresToolTier: spec.tier ?? 0,
    correctToolDrops: spec.correct ?? false,
    flammable: spec.flammable ?? false,
    transparent: spec.transparent ?? false,
    render: spec.render ?? 'opaque',
    shape: spec.shape ?? 'cube',
    axis: spec.axis ?? 'y',
    slabShape: spec.slabShape ?? false,
    passable: spec.passable ?? false,
    waterloggable: spec.waterloggable ?? false,
    textures: spec.texture,
    drops: spec.drops,
    tags: spec.tags ?? [],
  });
}

export const FUNCTIONAL_BLOCKS: BlockDef[] = [
  // -----------------------------------------------------------------------
  // Stations and machines
  // -----------------------------------------------------------------------
  func({
    id: 'furnace', name: 'Furnace', hardness: 3.5, tier: 1, correct: true, tool: 'pickaxe',
    texture: { top: 'furnace', side: 'furnace', bottom: 'furnace', front: 'furnace_front' },
    tags: [TAGS.IS_FURNACE],
  }),
  func({
    id: 'blast_furnace', name: 'Blast Furnace', hardness: 3.5, tier: 1, correct: true, tool: 'pickaxe',
    texture: { top: 'blast_furnace', side: 'blast_furnace', bottom: 'blast_furnace', front: 'blast_furnace_front' },
    tags: [TAGS.IS_FURNACE],
  }),
  func({
    id: 'smoker', name: 'Smoker', hardness: 3.5, tier: 1, correct: true, tool: 'pickaxe',
    texture: { top: 'smoker', side: 'smoker', bottom: 'smoker', front: 'smoker_front' },
    tags: [TAGS.IS_FURNACE],
  }),
  func({
    id: 'crafting_table', name: 'Crafting Table', hardness: 2.5, tool: 'axe', flammable: true,
    texture: { top: 'crafting_table', side: 'crafting_table', bottom: 'crafting_table', front: 'crafting_table_front' },
    tags: [TAGS.IS_WORKBENCH],
  }),
  func({
    id: 'smithing_table', name: 'Smithing Table', hardness: 2.5, tool: 'axe', flammable: true,
    texture: 'smithing_table', tags: [TAGS.IS_WORKBENCH],
  }),
  func({
    id: 'stonecutter', name: 'Stonecutter', hardness: 3.5, tier: 1, correct: true, tool: 'pickaxe',
    texture: 'stonecutter', tags: [TAGS.IS_WORKBENCH],
  }),
  func({
    id: 'cartography_table', name: 'Cartography Table', hardness: 2.5, tool: 'axe', flammable: true,
    texture: 'cartography_table', tags: [TAGS.IS_WORKBENCH],
  }),
  func({
    id: 'fletching_table', name: 'Fletching Table', hardness: 2.5, tool: 'axe', flammable: true,
    texture: 'fletching_table', tags: [TAGS.IS_WORKBENCH],
  }),
  func({
    id: 'loom', name: 'Loom', hardness: 2.5, tool: 'axe', flammable: true,
    texture: 'loom', tags: [TAGS.IS_WORKBENCH],
  }),
  func({
    id: 'grindstone', name: 'Grindstone', hardness: 2, tier: 1, correct: true, tool: 'pickaxe',
    texture: 'grindstone', tags: [TAGS.IS_WORKBENCH],
  }),
  func({
    id: 'anvil', name: 'Anvil', hardness: 5, blast: 1200, tier: 2, correct: true, tool: 'pickaxe',
    texture: 'anvil',
  }),
  func({
    id: 'chipped_anvil', name: 'Chipped Anvil', hardness: 5, blast: 1200, tier: 2, correct: true, tool: 'pickaxe',
    texture: 'chipped_anvil',
  }),
  func({
    id: 'damaged_anvil', name: 'Damaged Anvil', hardness: 5, blast: 1200, tier: 2, correct: true, tool: 'pickaxe',
    texture: 'damaged_anvil',
  }),
  func({
    id: 'enchanting_table', name: 'Enchanting Table', hardness: 5, tier: 2, correct: true, tool: 'pickaxe',
    texture: { top: 'enchanting_table_top', side: 'enchanting_table', bottom: 'enchanting_table_top', front: 'enchanting_table' },
    tags: [TAGS.IS_WORKBENCH],
  }),
  func({
    id: 'brewing_stand', name: 'Brewing Stand', hardness: 0.5, tier: 1, correct: true, tool: 'pickaxe',
    texture: 'brewing_stand',
  }),
  func({
    id: 'cauldron', name: 'Cauldron', hardness: 2, tier: 1, correct: true, tool: 'pickaxe',
    texture: 'cauldron', tags: [TAGS.IS_FURNACE],
  }),
  func({
    id: 'lava_cauldron', name: 'Lava Cauldron', hardness: 2, tier: 1, correct: true, tool: 'pickaxe',
    texture: 'cauldron_full', light: 15, tags: [TAGS.IS_FURNACE],
  }),
  func({
    id: 'powder_snow_cauldron', name: 'Powder Snow Cauldron', hardness: 2, tier: 1, correct: true, tool: 'pickaxe',
    texture: 'cauldron_full', tags: [TAGS.IS_FURNACE],
  }),
  func({
    id: 'composter', name: 'Composter', hardness: 0.6, tool: 'axe', flammable: true,
    texture: 'composter',
  }),
  func({
    id: 'barrel', name: 'Barrel', hardness: 2.5, tool: 'axe', flammable: true,
    texture: 'barrel', tags: [TAGS.IS_CHEST],
  }),
  func({
    id: 'lectern', name: 'Lectern', hardness: 2.5, tool: 'axe', flammable: true,
    texture: 'lectern',
  }),
  func({
    id: 'bell', name: 'Bell', hardness: 5, tier: 2, correct: true, tool: 'pickaxe',
    texture: 'bell',
  }),
  func({
    id: 'jukebox', name: 'Jukebox', hardness: 2, tool: 'axe', flammable: true,
    texture: 'jukebox',
  }),
  func({
    id: 'note_block', name: 'Note Block', hardness: 0.8, tool: 'axe', flammable: true,
    texture: 'note_block', tags: [TAGS.IS_REDSTONE],
  }),

  // -----------------------------------------------------------------------
  // Containers
  // -----------------------------------------------------------------------
  func({
    id: 'chest', name: 'Chest', hardness: 2.5, tool: 'axe', flammable: true,
    texture: 'chest', tags: [TAGS.IS_CHEST],
  }),
  func({
    id: 'trapped_chest', name: 'Trapped Chest', hardness: 2.5, tool: 'axe', flammable: true,
    texture: 'trapped_chest', tags: [TAGS.IS_CHEST, TAGS.IS_REDSTONE],
  }),
  func({
    id: 'ender_chest', name: 'Ender Chest', hardness: 22.5, blast: 600, tier: 2, correct: true, tool: 'pickaxe',
    texture: 'ender_chest', tags: [TAGS.IS_CHEST],
  }),
  func({
    id: 'hopper', name: 'Hopper', hardness: 5, blast: 6, tier: 2, correct: true, tool: 'pickaxe',
    texture: 'hopper', tags: [TAGS.IS_REDSTONE],
  }),
  func({
    id: 'dispenser', name: 'Dispenser', hardness: 3.5, tier: 1, correct: true, tool: 'pickaxe',
    texture: 'dispenser', tags: [TAGS.IS_REDSTONE],
  }),
  func({
    id: 'dropper', name: 'Dropper', hardness: 3.5, tier: 1, correct: true, tool: 'pickaxe',
    texture: 'dropper', tags: [TAGS.IS_REDSTONE],
  }),
  func({
    id: 'observer', name: 'Observer', hardness: 3.5, tier: 1, correct: true, tool: 'pickaxe',
    texture: 'observer', tags: [TAGS.IS_REDSTONE],
  }),
  func({
    id: 'piston', name: 'Piston', hardness: 3.5, tier: 1, correct: true, tool: 'pickaxe',
    texture: { top: 'piston', side: 'piston', bottom: 'piston', front: 'piston_front' },
    tags: [TAGS.IS_REDSTONE],
  }),
  func({
    id: 'sticky_piston', name: 'Sticky Piston', hardness: 3.5, tier: 1, correct: true, tool: 'pickaxe',
    texture: { top: 'piston', side: 'piston', bottom: 'piston', front: 'sticky_piston' },
    tags: [TAGS.IS_REDSTONE],
  }),
  func({
    id: 'tnt', name: 'TNT', hardness: 0, tool: 'none',
    texture: { top: 'tnt', side: 'tnt_side', bottom: 'tnt', front: 'tnt_side' },
    tags: [TAGS.IS_REDSTONE],
  }),

  // -----------------------------------------------------------------------
  // Redstone
  // -----------------------------------------------------------------------
  func({
    id: 'redstone_wire', name: 'Redstone Dust', hardness: 0, tool: 'none',
    texture: 'redstone_wire', render: 'cutout', shape: 'plant', passable: true,
    tags: [TAGS.IS_REDSTONE],
  }),
  func({
    id: 'redstone_torch', name: 'Redstone Torch', hardness: 0, tool: 'none', light: 7,
    texture: 'redstone_torch', render: 'cutout', shape: 'plant', passable: true,
    tags: [TAGS.IS_REDSTONE],
  }),
  func({
    id: 'redstone_lamp', name: 'Redstone Lamp', hardness: 0.3, tool: 'none',
    texture: 'redstone_lamp', tags: [TAGS.IS_REDSTONE],
  }),
  func({
    id: 'redstone_block', name: 'Block of Redstone', hardness: 5, tier: 2, correct: true, tool: 'pickaxe',
    texture: 'redstone_block', tags: [TAGS.IS_REDSTONE],
  }),
  func({
    id: 'target', name: 'Target', hardness: 0.5, tool: 'none',
    texture: 'target', tags: [TAGS.IS_REDSTONE],
  }),
  func({
    id: 'repeater', name: 'Repeater', hardness: 0, tool: 'none',
    texture: 'repeater', render: 'cutout', shape: 'plant', passable: true,
    tags: [TAGS.IS_REDSTONE],
  }),
  func({
    id: 'comparator', name: 'Comparator', hardness: 0, tool: 'none',
    texture: 'comparator', render: 'cutout', shape: 'plant', passable: true,
    tags: [TAGS.IS_REDSTONE],
  }),
  func({
    id: 'lever', name: 'Lever', hardness: 0.5, tool: 'none',
    texture: 'lever', render: 'cutout', shape: 'plant', passable: true,
    tags: [TAGS.IS_REDSTONE],
  }),
  func({
    id: 'tripwire', name: 'Tripwire', hardness: 0, tool: 'none',
    texture: 'tripwire', render: 'cutout', shape: 'plant', passable: true,
    tags: [TAGS.IS_REDSTONE],
  }),
  func({
    id: 'tripwire_hook', name: 'Tripwire Hook', hardness: 0, tool: 'none',
    texture: 'tripwire_hook', render: 'cutout', shape: 'plant', passable: true,
    tags: [TAGS.IS_REDSTONE],
  }),
  func({
    id: 'light_weighted_pressure_plate', name: 'Light Weighted Pressure Plate', hardness: 0.5, tool: 'none',
    texture: 'light_weighted_pressure_plate', render: 'cutout', shape: 'slab', slabShape: true,
    tags: [TAGS.IS_PRESSURE_PLATE, TAGS.IS_REDSTONE],
  }),
  func({
    id: 'heavy_weighted_pressure_plate', name: 'Heavy Weighted Pressure Plate', hardness: 0.5, tool: 'none',
    texture: 'heavy_weighted_pressure_plate', render: 'cutout', shape: 'slab', slabShape: true,
    tags: [TAGS.IS_PRESSURE_PLATE, TAGS.IS_REDSTONE],
  }),
  func({
    id: 'daylight_detector', name: 'Daylight Detector', hardness: 0.5, tool: 'axe', flammable: true,
    texture: 'daylight_detector', tags: [TAGS.IS_REDSTONE],
  }),
  func({
    id: 'lightning_rod', name: 'Lightning Rod', hardness: 3, tier: 1, correct: true, tool: 'pickaxe',
    texture: 'lightning_rod', tags: [TAGS.IS_REDSTONE],
  }),
  func({
    id: 'crafter', name: 'Crafter', hardness: 1.5, tier: 1, correct: true, tool: 'pickaxe',
    texture: 'crafter', tags: [TAGS.IS_REDSTONE],
  }),

  // -----------------------------------------------------------------------
  // Rails and minecarts
  // -----------------------------------------------------------------------
  func({
    id: 'rail', name: 'Rail', hardness: 0.7, tool: 'pickaxe',
    texture: 'rail', render: 'cutout', shape: 'slab', slabShape: true,
  }),
  func({
    id: 'powered_rail', name: 'Powered Rail', hardness: 0.7, tool: 'pickaxe',
    texture: 'powered_rail', render: 'cutout', shape: 'slab', slabShape: true,
  }),
  func({
    id: 'detector_rail', name: 'Detector Rail', hardness: 0.7, tool: 'pickaxe',
    texture: 'detector_rail', render: 'cutout', shape: 'slab', slabShape: true,
    tags: [TAGS.IS_REDSTONE],
  }),
  func({
    id: 'activator_rail', name: 'Activator Rail', hardness: 0.7, tool: 'pickaxe',
    texture: 'activator_rail', render: 'cutout', shape: 'slab', slabShape: true,
    tags: [TAGS.IS_REDSTONE],
  }),
  func({
    id: 'minecart', name: 'Minecart', hardness: 0, tool: 'none',
    texture: 'minecart', render: 'cutout', shape: 'plant', passable: true,
  }),
  func({
    id: 'minecart_with_furnace', name: 'Furnace Minecart', hardness: 0, tool: 'none',
    texture: 'minecart_furnace', render: 'cutout', shape: 'plant', passable: true,
  }),
  func({
    id: 'minecart_with_chest', name: 'Chest Minecart', hardness: 0, tool: 'none',
    texture: 'minecart_chest', render: 'cutout', shape: 'plant', passable: true,
  }),
  func({
    id: 'minecart_with_tnt', name: 'TNT Minecart', hardness: 0, tool: 'none',
    texture: 'minecart_tnt', render: 'cutout', shape: 'plant', passable: true,
  }),
  func({
    id: 'minecart_with_hopper', name: 'Hopper Minecart', hardness: 0, tool: 'none',
    texture: 'minecart_hopper', render: 'cutout', shape: 'plant', passable: true,
  }),

  // -----------------------------------------------------------------------
  // Light and decoration
  // -----------------------------------------------------------------------
  func({
    id: 'torch', name: 'Torch', hardness: 0, tool: 'none', light: 14,
    texture: 'torch', render: 'cross', shape: 'plant', passable: true,
  }),
  func({
    id: 'soul_torch', name: 'Soul Torch', hardness: 0, tool: 'none', light: 10,
    texture: 'soul_torch', render: 'cross', shape: 'plant', passable: true,
  }),
  func({
    id: 'lantern', name: 'Lantern', hardness: 5, tier: 2, correct: true, tool: 'pickaxe', light: 15,
    texture: 'lantern',
  }),
  func({
    id: 'soul_lantern', name: 'Soul Lantern', hardness: 5, tier: 2, correct: true, tool: 'pickaxe', light: 10,
    texture: 'soul_lantern',
  }),
  func({
    id: 'campfire', name: 'Campfire', hardness: 2, tool: 'axe', flammable: true, light: 15,
    texture: 'campfire', render: 'cutout', shape: 'plant', passable: true,
  }),
  func({
    id: 'soul_campfire', name: 'Soul Campfire', hardness: 2, tool: 'axe', flammable: true, light: 10,
    texture: 'soul_campfire', render: 'cutout', shape: 'plant', passable: true,
  }),
  func({
    id: 'candle', name: 'Candle', hardness: 0.1, tool: 'none',
    texture: 'candle', render: 'cutout', shape: 'plant', passable: true,
    tags: [TAGS.IS_CANDLE],
  }),
  func({
    id: 'scaffolding', name: 'Scaffolding', hardness: 0.2, tool: 'axe', flammable: true,
    texture: 'scaffolding', render: 'cutout', transparent: true, passable: true,
  }),
  func({
    id: 'ladder', name: 'Ladder', hardness: 0.4, tool: 'axe', flammable: true,
    texture: 'ladder', render: 'cutout', shape: 'pane', transparent: true, passable: true,
  }),
  func({
    id: 'iron_bars', name: 'Iron Bars', hardness: 5, blast: 6, tier: 2, correct: true, tool: 'pickaxe',
    texture: 'iron_bars', render: 'cutout', shape: 'pane', transparent: true,
  }),
  func({
    id: 'chain', name: 'Chain', hardness: 5, blast: 6, tier: 2, correct: true, tool: 'pickaxe',
    texture: 'chain', render: 'cutout', shape: 'pane', transparent: true,
  }),
  func({
    id: 'cobweb', name: 'Cobweb', hardness: 4, tier: 1, correct: true, tool: 'pickaxe',
    texture: 'cobweb', render: 'cutout', transparent: true, passable: true,
  }),
  func({
    id: 'armor_stand', name: 'Armor Stand', hardness: 0, tool: 'none',
    texture: 'armor_stand', render: 'cutout', shape: 'plant', passable: true,
  }),
  func({
    id: 'item_frame', name: 'Item Frame', hardness: 0, tool: 'none',
    texture: 'item_frame', render: 'cutout', shape: 'pane', transparent: true, passable: true,
  }),
  func({
    id: 'glow_item_frame', name: 'Glow Item Frame', hardness: 0, tool: 'none',
    texture: 'item_frame', render: 'cutout', shape: 'pane', transparent: true, passable: true,
  }),
  func({
    id: 'painting', name: 'Painting', hardness: 0, tool: 'none',
    texture: 'painting', render: 'cutout', shape: 'pane', transparent: true, passable: true,
  }),
  func({
    id: 'flower_pot', name: 'Flower Pot', hardness: 0, tool: 'none',
    texture: 'flower_pot', render: 'cutout', shape: 'plant', passable: true,
  }),
  func({
    id: 'decorated_pot', name: 'Decorated Pot', hardness: 0, tool: 'none',
    texture: 'flower_pot', render: 'cutout', shape: 'plant', passable: true,
  }),
  func({
    id: 'sponge', name: 'Sponge', hardness: 0.6, tool: 'hoe',
    texture: 'sponge',
  }),
  func({
    id: 'wet_sponge', name: 'Wet Sponge', hardness: 0.6, tool: 'hoe',
    texture: 'wet_sponge',
  }),
  func({
    id: 'honey_block', name: 'Honey Block', hardness: 0, tool: 'none',
    texture: 'honey_block', render: 'translucent', transparent: true,
  }),
  func({
    id: 'slime_block', name: 'Slime Block', hardness: 0, tool: 'none',
    texture: 'slime_block', render: 'translucent', transparent: true,
  }),
  func({
    id: 'hay_block', name: 'Hay Bale', hardness: 0.5, tool: 'hoe',
    texture: 'hay_block', axis: 'y',
  }),
  func({
    id: 'dried_kelp_block', name: 'Block of Dried Kelp', hardness: 0.5, tool: 'hoe',
    texture: 'dried_kelp_block',
  }),
  func({
    id: 'bookshelf', name: 'Bookshelf', hardness: 1.5, tool: 'axe', flammable: true,
    texture: 'oak_planks', tags: [TAGS.PLANKS],
  }),

  // -----------------------------------------------------------------------
  // Glass panes
  // -----------------------------------------------------------------------
  func({
    id: 'glass_pane', name: 'Glass Pane', hardness: 0.3, tool: 'none',
    texture: 'glass', render: 'cutout', shape: 'pane', transparent: true,
    drops: [{ item: 'glass', min: 0, max: 0 }],
  }),
  func({
    id: 'tinted_glass_pane', name: 'Tinted Glass Pane', hardness: 0.3, tool: 'none',
    texture: 'tinted_glass', render: 'cutout', shape: 'pane', transparent: true,
    drops: [{ item: 'tinted_glass', min: 0, max: 0 }],
  }),

  // -----------------------------------------------------------------------
  // World and command blocks
  // -----------------------------------------------------------------------
  func({
    id: 'spawner', name: 'Spawner', hardness: 5, tier: 2, correct: true, tool: 'pickaxe',
    texture: 'spawner', tags: [TAGS.IS_SPAWNER],
  }),
  func({
    id: 'trial_spawner', name: 'Trial Spawner', hardness: 5, tier: 2, correct: true, tool: 'pickaxe',
    texture: 'spawner', tags: [TAGS.IS_SPAWNER],
  }),
  func({
    id: 'vault', name: 'Vault', hardness: 5, tier: 2, correct: true, tool: 'pickaxe',
    texture: 'chest', tags: [TAGS.IS_CHEST],
  }),
  func({
    id: 'structure_block', name: 'Structure Block', hardness: 5, tier: 2, correct: true, tool: 'pickaxe',
    texture: 'structure_block',
  }),
  func({
    id: 'structure_void', name: 'Structure Void', hardness: 5, tier: 2, correct: true, tool: 'pickaxe',
    texture: 'structure_void',
  }),
  func({
    id: 'jigsaw', name: 'Jigsaw Block', hardness: 5, tier: 2, correct: true, tool: 'pickaxe',
    texture: 'structure_block',
  }),
  func({
    id: 'command_block', name: 'Command Block', hardness: 5, tier: 2, correct: true, tool: 'pickaxe',
    texture: 'command_block', tags: [TAGS.IS_COMMAND_BLOCK],
  }),
  func({
    id: 'chain_command_block', name: 'Chain Command Block', hardness: 5, tier: 2, correct: true, tool: 'pickaxe',
    texture: 'command_block', tags: [TAGS.IS_COMMAND_BLOCK],
  }),
  func({
    id: 'repeating_command_block', name: 'Repeating Command Block', hardness: 5, tier: 2, correct: true, tool: 'pickaxe',
    texture: 'command_block', tags: [TAGS.IS_COMMAND_BLOCK],
  }),
  func({
    id: 'barrier', name: 'Barrier', hardness: -1, tool: 'none',
    texture: 'barrier', render: 'cutout', transparent: true, drops: [],
  }),
  func({
    id: 'heavy_core', name: 'Heavy Core', hardness: 10, blast: 1200, tier: 3, correct: true, tool: 'pickaxe',
    texture: 'netherite_block',
  }),
  func({
    id: 'creaking_heart', name: 'Creaking Heart', hardness: 0.5, tool: 'axe',
    texture: 'oak_planks',
  }),
  func({
    id: 'ominous_banner', name: 'Ominous Banner', hardness: 1, tool: 'axe', flammable: true,
    texture: 'ominous_banner', shape: 'plant', passable: true,
    tags: [TAGS.IS_BANNER],
  }),
  func({
    id: 'suspicious_sand', name: 'Suspicious Sand', hardness: 0.25, tool: 'shovel',
    texture: 'sand', tags: [TAGS.SAND, TAGS.DIRT],
  }),
  func({
    id: 'suspicious_gravel', name: 'Suspicious Gravel', hardness: 0.25, tool: 'shovel',
    texture: 'gravel', tags: [TAGS.DIRT],
  }),
  func({
    id: 'powder_snow', name: 'Powder Snow', hardness: 0.25, tool: 'shovel',
    texture: 'snow', render: 'cutout', shape: 'slab', slabShape: true, transparent: true,
    tags: [TAGS.DIRT],
  }),
  func({
    id: 'sniffer_egg', name: 'Sniffer Egg', hardness: 0.5, tool: 'none',
    texture: 'turtle_egg', render: 'cutout', shape: 'plant', passable: true,
  }),
  func({
    id: 'turtle_egg', name: 'Turtle Egg', hardness: 0.5, tool: 'none',
    texture: 'turtle_egg', render: 'cutout', shape: 'plant', passable: true,
  }),
  func({
    id: 'turtle_egg_block', name: 'Turtle Egg Block', hardness: 0.5, tool: 'none',
    texture: 'turtle_egg', render: 'cutout', shape: 'plant', passable: true,
  }),
];

/** Stained glass panes share the colour family but are a separate shape. */
export const STAINED_GLASS_PANES: BlockDef[] = [
  'white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray',
  'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black',
].map((color) =>
  defineBlock({
    id: `${color}_stained_glass_pane`,
    name: `${color.replace('_', ' ')} Stained Glass Pane`,
    family: 'color',
    hardness: 0.3,
    tool: 'none',
    transparent: true,
    render: 'cutout',
    shape: 'pane',
    textures: `${color}_stained_glass`,
    tags: [TAGS.DYEABLE],
    drops: [{ item: `${color}_stained_glass`, min: 0, max: 0 }],
    params: { color, colorFamily: 'stained_glass_pane' },
  }),
);

/** Stone blocks that a mob can infest. */
export const INFESTED_STONE_BLOCKS: BlockDef[] = [
  ['stone', 'Stone'],
  ['cobblestone', 'Cobblestone'],
  ['stone_bricks', 'Stone Bricks'],
  ['mossy_stone_bricks', 'Mossy Stone Bricks'],
  ['cracked_stone_bricks', 'Cracked Stone Bricks'],
  ['chiseled_stone_bricks', 'Chiseled Stone Bricks'],
  ['deepslate', 'Deepslate'],
].map(([id, name]) =>
  defineBlock({
    id: `infested_${id}`,
    name: `Infested ${name}`,
    family: 'stone',
    hardness: 2,
    blastResistance: 3,
    tool: 'pickaxe',
    requiresToolTier: 1,
    correctToolDrops: true,
    textures: 'sculk',
    tags: [TAGS.STONE],
    params: { infested: id },
  }),
);
