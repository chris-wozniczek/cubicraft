/**
 * Shared content constants: tag names, tool tiers, wood types and dye colours.
 *
 * Tags are plain strings so the engine can resolve them with
 * `Registry.byTag()` / `Registry.resolve('#tag')` without importing this file.
 */

import type { MiningLevel, ToolKind } from '../core/types';

/** Canonical tag names used by blocks and items. */
export const TAGS = {
  // Material families
  PLANKS: 'planks',
  LOGS: 'logs',
  LEAVES: 'leaves',
  WOOL: 'wool',
  ORES: 'ores',
  DIRT: 'dirt',
  STONE: 'stone',
  SAND: 'sand',
  WOODEN: 'wooden',
  CLOTH: 'cloth',
  DYEABLE: 'dyeable',
  REPLACEABLE: 'replaceable',

  // Tool tags
  MINEABLE_PICKAXE: 'mineable/pickaxe',
  MINEABLE_AXE: 'mineable/axe',
  MINEABLE_SHOVEL: 'mineable/shovel',
  MINEABLE_HOE: 'mineable/hoe',
  MINEABLE_SWORD: 'mineable/sword',
  NEEDS_TOOL: 'needs_tool',

  // Mining-level gates
  NEEDS_STONE_TOOL: 'needs_stone_tool',
  NEEDS_IRON_TOOL: 'needs_iron_tool',
  NEEDS_DIAMOND_TOOL: 'needs_diamond_tool',

  // Functional tags
  IS_FLUID: 'is_fluid',
  IS_PLANT: 'is_plant',
  IS_REDSTONE: 'is_redstone',
  IS_WORKBENCH: 'is_workbench',
  IS_FURNACE: 'is_furnace',
  IS_CHEST: 'is_chest',
  IS_SLAB: 'is_slab',
  IS_STAIRS: 'is_stairs',
  IS_FENCE: 'is_fence',
  IS_DOOR: 'is_door',
  IS_TRAPDOOR: 'is_trapdoor',
  IS_BUTTON: 'is_button',
  IS_PRESSURE_PLATE: 'is_pressure_plate',
  IS_SIGN: 'is_sign',
  IS_BANNER: 'is_banner',
  IS_BED: 'is_bed',
  IS_CANDLE: 'is_candle',
  IS_WAXED: 'is_waxed',
  IS_COPPER: 'is_copper',
  IS_BEE: 'is_bee',
  IS_SPAWNER: 'is_spawner',
  IS_COMMAND_BLOCK: 'is_command_block',

  // Item tags
  TOOL: 'tool',
  ARMOR: 'armor',
  FOOD: 'food',
  MUSIC_DISC: 'music_disc',
  POTION: 'potion',
  SMITHING_TEMPLATE: 'smithing_template',
  ARROW: 'arrow',
  SPAWN_EGG: 'spawn_egg',
} as const;

/** The 13 wood types the content set supports. */
export const WOOD_TYPES = [
  'oak',
  'spruce',
  'birch',
  'jungle',
  'acacia',
  'dark_oak',
  'mangrove',
  'cherry',
  'bamboo',
  'crimson',
  'warped',
  'pale_oak',
  'poplar',
] as const;

export type WoodType = (typeof WOOD_TYPES)[number];

/** Woods whose stem is a hyphae (nether dimension). */
export const NETHER_WOODS: readonly WoodType[] = ['crimson', 'warped'];

/** The 16 dye colours. */
export const DYE_COLORS = [
  'white',
  'orange',
  'magenta',
  'light_blue',
  'yellow',
  'lime',
  'pink',
  'gray',
  'light_gray',
  'cyan',
  'purple',
  'blue',
  'brown',
  'green',
  'red',
  'black',
] as const;

export type DyeColor = (typeof DYE_COLORS)[number];

/** The 7 tool tiers: durability and mining speed multipliers. */
export interface ToolTier {
  id: string;
  /** Mining level (0 wood .. 4 netherite). */
  level: MiningLevel;
  durability: number;
  /** Mining speed multiplier applied to break speed. */
  speed: number;
  /** Damage bonus applied to sword/axe attacks. */
  attackBonus: number;
  /** Enchantability of tools made from this tier. */
  enchantability: number;
}

export const TOOL_TIERS: readonly ToolTier[] = [
  { id: 'wooden', level: 0, durability: 59, speed: 2, attackBonus: 0, enchantability: 15 },
  { id: 'stone', level: 1, durability: 131, speed: 4, attackBonus: 1, enchantability: 5 },
  { id: 'copper', level: 1, durability: 190, speed: 5, attackBonus: 1, enchantability: 14 },
  { id: 'iron', level: 2, durability: 250, speed: 6, attackBonus: 2, enchantability: 14 },
  { id: 'diamond', level: 3, durability: 1561, speed: 8, attackBonus: 3, enchantability: 10 },
  { id: 'netherite', level: 4, durability: 2031, speed: 9, attackBonus: 4, enchantability: 15 },
  { id: 'golden', level: 0, durability: 32, speed: 12, attackBonus: 0, enchantability: 22 },
] as const;

/** Tag for the tool class a block is mined with. */
export function toolTag(kind: ToolKind): string | null {
  switch (kind) {
    case 'pickaxe':
      return TAGS.MINEABLE_PICKAXE;
    case 'axe':
      return TAGS.MINEABLE_AXE;
    case 'shovel':
      return TAGS.MINEABLE_SHOVEL;
    case 'hoe':
      return TAGS.MINEABLE_HOE;
    case 'sword':
      return TAGS.MINEABLE_SWORD;
    default:
      return null;
  }
}

/**
 * Mining-level gate tag. Netherite level still requires a diamond tool,
 * which is how the ladder is expressed in the vanilla tag set.
 */
export function needsToolTag(level: MiningLevel): string | null {
  switch (level) {
    case 1:
      return TAGS.NEEDS_STONE_TOOL;
    case 2:
      return TAGS.NEEDS_IRON_TOOL;
    case 3:
    case 4:
      return TAGS.NEEDS_DIAMOND_TOOL;
    default:
      return null;
  }
}
