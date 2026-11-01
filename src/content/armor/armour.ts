/**
 * Armour — the material table, the seven full sets, the special pieces and
 * the smithing templates.
 *
 * Durability is `material multiplier * slot multiplier`, which is how the
 * vanilla armour table is built and keeps every piece consistent.
 */

import type { ItemDef } from '../../core/types';
import { TAGS } from '../tags';
import { defineItem } from '../items/common';

export type ArmourSlot = 'head' | 'chest' | 'legs' | 'feet';

export interface ArmourMaterial {
  id: string;
  /** Id prefix of the pieces, e.g. `leather` or `golden`. */
  prefix: string;
  name: string;
  /** Durability multiplier applied to the slot multiplier. */
  durabilityMultiplier: number;
  /** Defence points per slot: head, chest, legs, feet. */
  defence: [number, number, number, number];
  enchantability: number;
  toughness: number;
  knockbackResistance: number;
  /** Slots this material is available for. */
  slots: readonly ArmourSlot[];
}

/** Slot multipliers of the durability table. */
export const SLOT_DURABILITY: Record<ArmourSlot, number> = {
  head: 11,
  chest: 16,
  legs: 15,
  feet: 13,
};

const SLOT_NAMES: Record<ArmourSlot, string> = {
  head: 'Helmet',
  chest: 'Chestplate',
  legs: 'Leggings',
  feet: 'Boots',
};

export const ARMOUR_MATERIALS: readonly ArmourMaterial[] = [
  {
    id: 'leather', prefix: 'leather', name: 'Leather', durabilityMultiplier: 5,
    defence: [1, 3, 2, 1], enchantability: 15, toughness: 0, knockbackResistance: 0,
    slots: ['head', 'chest', 'legs', 'feet'],
  },
  {
    id: 'copper', prefix: 'copper', name: 'Copper', durabilityMultiplier: 11,
    defence: [2, 4, 3, 2], enchantability: 8, toughness: 0, knockbackResistance: 0,
    slots: ['head', 'chest', 'legs', 'feet'],
  },
  {
    id: 'chainmail', prefix: 'chainmail', name: 'Chainmail', durabilityMultiplier: 15,
    defence: [2, 5, 4, 1], enchantability: 12, toughness: 0, knockbackResistance: 0,
    slots: ['head', 'chest', 'legs', 'feet'],
  },
  {
    id: 'iron', prefix: 'iron', name: 'Iron', durabilityMultiplier: 15,
    defence: [2, 6, 5, 2], enchantability: 9, toughness: 0, knockbackResistance: 0,
    slots: ['head', 'chest', 'legs', 'feet'],
  },
  {
    id: 'turtle', prefix: 'turtle', name: 'Turtle', durabilityMultiplier: 25,
    defence: [2, 6, 5, 2], enchantability: 9, toughness: 0, knockbackResistance: 0,
    slots: ['head'],
  },
  {
    id: 'gold', prefix: 'golden', name: 'Golden', durabilityMultiplier: 7,
    defence: [2, 5, 3, 1], enchantability: 25, toughness: 0, knockbackResistance: 0,
    slots: ['head', 'chest', 'legs', 'feet'],
  },
  {
    id: 'diamond', prefix: 'diamond', name: 'Diamond', durabilityMultiplier: 33,
    defence: [3, 8, 6, 3], enchantability: 10, toughness: 2, knockbackResistance: 0,
    slots: ['head', 'chest', 'legs', 'feet'],
  },
  {
    id: 'netherite', prefix: 'netherite', name: 'Netherite', durabilityMultiplier: 37,
    defence: [3, 8, 6, 3], enchantability: 15, toughness: 3, knockbackResistance: 0.1,
    slots: ['head', 'chest', 'legs', 'feet'],
  },
  {
    id: 'armadillo_scute', prefix: 'armadillo', name: 'Armadillo', durabilityMultiplier: 4,
    defence: [3, 8, 6, 3], enchantability: 10, toughness: 0, knockbackResistance: 0,
    slots: ['head'],
  },
];

const ARMOUR_BY_ID = new Map(ARMOUR_MATERIALS.map((material) => [material.id, material]));

/** Build the pieces of one material. */
function pieces(material: ArmourMaterial): ItemDef[] {
  return material.slots.map((slot, index) => {
    const id = `${material.prefix}_${slot === 'chest' ? 'chestplate' : slot === 'legs' ? 'leggings' : slot === 'feet' ? 'boots' : 'helmet'}`;
    return defineItem({
      id,
      name: `${material.name} ${SLOT_NAMES[slot]}`,
      stackSize: 1,
      armorSlot: slot,
      defense: material.defence[index],
      durability: material.durabilityMultiplier * SLOT_DURABILITY[slot],
      tags: [TAGS.ARMOR, `armor/${material.id}`],
      icon: id,
    });
  });
}

/** The seven full armour sets plus the two single-piece materials. */
export const ARMOUR_SET_ITEMS: ItemDef[] = ARMOUR_MATERIALS.flatMap(pieces);

/** Armour that is not part of a material set. */
export const SPECIAL_ARMOUR_ITEMS: ItemDef[] = [
  defineItem({
    id: 'wolf_armor',
    name: 'Wolf Armor',
    stackSize: 1,
    armorSlot: 'body',
    defense: 0,
    durability: 0,
    tags: [TAGS.ARMOR, 'armor/wolf'],
    icon: 'wolf_armor',
  }),
  defineItem({
    id: 'elytra',
    name: 'Elytra',
    stackSize: 1,
    armorSlot: 'body',
    defense: 0,
    durability: 432,
    tags: [TAGS.ARMOR, 'armor/elytra'],
    icon: 'elytra',
  }),
  defineItem({
    id: 'carved_pumpkin',
    name: 'Carved Pumpkin',
    stackSize: 64,
    armorSlot: 'head',
    defense: 0,
    durability: 0,
    tags: [TAGS.ARMOR, 'armor/carved_pumpkin'],
    icon: 'carved_pumpkin',
  }),
  defineItem({
    id: 'player_head',
    name: 'Player Head',
    stackSize: 64,
    armorSlot: 'head',
    defense: 0,
    durability: 0,
    tags: [TAGS.ARMOR, 'armor/player_head'],
    icon: 'player_head',
  }),
  defineItem({
    id: 'nautilus_shell',
    name: 'Nautilus Shell',
    stackSize: 64,
    tags: [TAGS.ARMOR, 'armor/nautilus'],
    icon: 'nautilus_shell',
  }),
];

/**
 * The nautilus set — a lighter shell set with the same four slots.
 * Durability follows the chainmail multiplier.
 */
export const NAUTILUS_ARMOUR_ITEMS: ItemDef[] = (['head', 'chest', 'legs', 'feet'] as const).map(
  (slot, index) => {
    const suffix = slot === 'chest' ? 'chestplate' : slot === 'legs' ? 'leggings' : slot === 'feet' ? 'boots' : 'helmet';
    const id = `nautilus_${suffix}`;
    const material = ARMOUR_BY_ID.get('chainmail') as ArmourMaterial;
    return defineItem({
      id,
      name: `Nautilus ${SLOT_NAMES[slot]}`,
      stackSize: 1,
      armorSlot: slot,
      defense: material.defence[index],
      durability: material.durabilityMultiplier * SLOT_DURABILITY[slot],
      tags: [TAGS.ARMOR, 'armor/nautilus'],
      icon: id,
    });
  },
);

/** Horse armour — worn by horses, not by the player. */
export const HORSE_ARMOUR_ITEMS: ItemDef[] = [
  ['leather', 'Leather'],
  ['iron', 'Iron'],
  ['gold', 'Golden'],
  ['diamond', 'Diamond'],
  ['copper', 'Copper'],
  ['netherite', 'Netherite'],
].map(([id, name]) =>
  defineItem({
    id: `horse_armor_${id}`,
    name: `${name} Horse Armor`,
    stackSize: 64,
    durability: id === 'leather' ? 100 : undefined,
    tags: [TAGS.ARMOR, 'armor/horse'],
    icon: `horse_armor_${id}`,
  }),
);

/** The 20 smithing templates used to apply armour trims. */
export const TRIM_ITEMS: ItemDef[] = [
  ...[
    'white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray',
    'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black',
  ].map((color) => `${color}_trim_smithing_template`),
  'sentry_trim_smithing_template',
  'vex_trim_smithing_template',
  'snout_trim_smithing_template',
  'tide_trim_smithing_template',
].map((id) =>
  defineItem({
    id,
    name: `${id.replace('_trim_smithing_template', '').replace('_', ' ')} Trim Smithing Template`,
    stackSize: 64,
    tags: [TAGS.SMITHING_TEMPLATE, 'trim'],
    icon: 'trim_smithing_template',
  }),
);

/** Every armour related item. */
export const ALL_ARMOUR_ITEMS: ItemDef[] = [
  ...ARMOUR_SET_ITEMS,
  ...NAUTILUS_ARMOUR_ITEMS,
  ...SPECIAL_ARMOUR_ITEMS,
  ...HORSE_ARMOUR_ITEMS,
  ...TRIM_ITEMS,
];

/**
 * The armour sets the validator checks: every set must have four pieces.
 * The map holds the piece ids of each set.
 */
export const ARMOUR_SETS: Record<string, string[]> = Object.fromEntries(
  ARMOUR_MATERIALS.filter((material) => material.slots.length === 4).map((material) => [
    material.id,
    pieces(material).map((item) => item.id),
  ]),
);
