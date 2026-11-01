/**
 * Raw materials, dyes and mob drops.
 *
 * These are the items that have no behaviour of their own: they are crafted
 * into tools, fed to the player, or dropped by mobs.
 */

import type { ItemDef } from '../../core/types';
import { DYE_COLORS, TAGS, type DyeColor } from '../tags';
import { defineItem } from './common';

export interface MaterialSpec {
  id: string;
  name: string;
  stackSize?: number;
  tags?: string[];
}

const MATERIAL_SPECS: readonly MaterialSpec[] = [
  // Ingots and raw metals
  { id: 'iron_ingot', name: 'Iron Ingot' },
  { id: 'gold_ingot', name: 'Gold Ingot' },
  { id: 'copper_ingot', name: 'Copper Ingot' },
  { id: 'netherite_ingot', name: 'Netherite Ingot' },
  { id: 'netherite_scrap', name: 'Netherite Scrap' },
  { id: 'raw_iron', name: 'Raw Iron' },
  { id: 'raw_gold', name: 'Raw Gold' },
  { id: 'raw_copper', name: 'Raw Copper' },
  { id: 'iron_nugget', name: 'Iron Nugget' },
  { id: 'gold_nugget', name: 'Gold Nugget' },
  { id: 'coal', name: 'Coal' },
  { id: 'charcoal', name: 'Charcoal' },

  // Dusts and powders
  { id: 'redstone', name: 'Redstone Dust' },
  { id: 'glowstone_dust', name: 'Glowstone Dust' },
  { id: 'gunpowder', name: 'Gunpowder' },
  { id: 'sugar', name: 'Sugar' },
  { id: 'paper', name: 'Paper' },
  { id: 'bone_meal', name: 'Bone Meal' },
  { id: 'blaze_powder', name: 'Blaze Powder' },

  // Mob drops
  { id: 'bone', name: 'Bone' },
  { id: 'string', name: 'String' },
  { id: 'feather', name: 'Feather' },
  { id: 'leather', name: 'Leather' },
  { id: 'rabbit_hide', name: 'Rabbit Hide' },
  { id: 'rabbit_foot', name: 'Rabbit Foot' },
  { id: 'slimeball', name: 'Slimeball' },
  { id: 'magma_cream', name: 'Magma Cream' },
  { id: 'blaze_rod', name: 'Blaze Rod' },
  { id: 'ghast_tear', name: 'Ghast Tear' },
  { id: 'ender_pearl', name: 'Ender Pearl' },
  { id: 'ender_eye', name: 'Eye of Ender' },
  { id: 'nether_star', name: 'Nether Star' },
  { id: 'prismarine_shard', name: 'Prismarine Shard' },
  { id: 'prismarine_crystals', name: 'Prismarine Crystals' },
  { id: 'heart_of_the_sea', name: 'Heart of the Sea' },
  { id: 'turtle_scute', name: 'Turtle Scute' },
  { id: 'phantom_membrane', name: 'Phantom Membrane' },
  { id: 'honeycomb', name: 'Honeycomb' },
  { id: 'ink_sac', name: 'Ink Sac' },
  { id: 'glow_ink_sac', name: 'Glow Ink Sac' },
  { id: 'dragon_breath', name: 'Dragon Breath' },
  { id: 'echo_shard', name: 'Echo Shard' },
  { id: 'breeze_rod', name: 'Breeze Rod' },
  { id: 'armadillo_scute', name: 'Armadillo Scute' },
  { id: 'goat_horn', name: 'Goat Horn' },
  { id: 'wind_charge', name: 'Wind Charge' },
  { id: 'resin', name: 'Resin' },
  { id: 'sulfur', name: 'Sulfur' },

  // Farming
  { id: 'wheat', name: 'Wheat' },
  { id: 'wheat_seeds', name: 'Wheat Seeds' },
  { id: 'beetroot_seeds', name: 'Beetroot Seeds' },
  { id: 'torchflower_seeds', name: 'Torchflower Seeds' },
  { id: 'pitcher_pod', name: 'Pitcher Pod' },
  { id: 'firefly_bush_seeds', name: 'Firefly Bush Seeds' },
  { id: 'nether_quartz', name: 'Nether Quartz' },
  { id: 'quartz', name: 'Nether Quartz' },
  { id: 'popped_chorus_fruit', name: 'Popped Chorus Fruit' },
  { id: 'lapis_lazuli', name: 'Lapis Lazuli' },
  { id: 'diamond', name: 'Diamond' },
  { id: 'emerald', name: 'Emerald' },
  { id: 'amethyst_shard', name: 'Amethyst Shard' },

  // Crafting ingredients
  { id: 'stick', name: 'Stick' },
  { id: 'glass_bottle', name: 'Glass Bottle' },
  { id: 'brick', name: 'Brick' },
  { id: 'nether_brick', name: 'Nether Brick' },
  { id: 'clay_ball', name: 'Clay Ball' },
  { id: 'flint', name: 'Flint' },
  { id: 'egg', name: 'Egg' },
  { id: 'bowl', name: 'Bowl' },
  { id: 'fermented_spider_eye', name: 'Fermented Spider Eye' },
  { id: 'snowball', name: 'Snowball' },
  { id: 'glistering_melon_slice', name: 'Glistering Melon Slice' },

  // Equipment and misc
  { id: 'tripwire_hook', name: 'Tripwire Hook', tags: ['block_item'] },
  { id: 'saddle', name: 'Saddle' },
  { id: 'lead', name: 'Lead' },
  { id: 'name_tag', name: 'Name Tag' },
  { id: 'ominous_bottle', name: 'Ominous Bottle' },
  { id: 'disc_fragment_5', name: 'Disc Fragment' },
];

export const MATERIAL_ITEMS: ItemDef[] = MATERIAL_SPECS.map((spec) =>
  defineItem({
    id: spec.id,
    name: spec.name,
    stackSize: spec.stackSize ?? 64,
    tags: spec.tags ?? [],
    icon: spec.id,
  }),
);

const DYE_NAMES: Record<DyeColor, string> = {
  white: 'White',
  orange: 'Orange',
  magenta: 'Magenta',
  light_blue: 'Light Blue',
  yellow: 'Yellow',
  lime: 'Lime',
  pink: 'Pink',
  gray: 'Gray',
  light_gray: 'Light Gray',
  cyan: 'Cyan',
  purple: 'Purple',
  blue: 'Blue',
  brown: 'Brown',
  green: 'Green',
  red: 'Red',
  black: 'Black',
};

/** The 16 dyes. */
export const DYE_ITEMS: ItemDef[] = DYE_COLORS.map((color) =>
  defineItem({
    id: `${color}_dye`,
    name: `${DYE_NAMES[color]} Dye`,
    stackSize: 64,
    tags: [TAGS.DYEABLE, 'dye'],
    icon: `${color}_dye`,
  }),
);
