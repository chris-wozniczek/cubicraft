/**
 * Everything else: discs, buckets, bows, books, boats, spawn eggs and the
 * odds and ends that do not fit the other item tables.
 */

import type { ItemDef } from '../../core/types';
import { TAGS } from '../tags';
import { WOOD_SPECS } from '../blocks/woodFamily';
import { ALL_MOBS } from '../mobs/index';
import { defineItem } from './common';

// ---------------------------------------------------------------------------
// Music discs
// ---------------------------------------------------------------------------

export const MUSIC_DISC_ITEMS: ItemDef[] = Array.from({ length: 22 }, (_, index) =>
  defineItem({
    id: `music_disc_${index}`,
    name: `Music Disc ${index}`,
    stackSize: 1,
    tags: [TAGS.MUSIC_DISC],
    icon: 'music_disc',
  }),
);

// ---------------------------------------------------------------------------
// Buckets
// ---------------------------------------------------------------------------

const BUCKET_SPECS: readonly [string, string, number][] = [
  ['bucket', 'Bucket', 16],
  ['water_bucket', 'Water Bucket', 1],
  ['lava_bucket', 'Lava Bucket', 1],
  ['milk_bucket', 'Milk Bucket', 1],
  ['powder_snow_bucket', 'Powder Snow Bucket', 1],
  ['cod_bucket', 'Bucket of Cod', 1],
  ['salmon_bucket', 'Bucket of Salmon', 1],
  ['tropical_fish_bucket', 'Bucket of Tropical Fish', 1],
  ['pufferfish_bucket', 'Bucket of Pufferfish', 1],
  ['axolotl_bucket', 'Bucket of Axolotl', 1],
  ['tadpole_bucket', 'Bucket of Tadpole', 1],
];

export const BUCKET_ITEMS: ItemDef[] = BUCKET_SPECS.map(([id, name, stackSize]) =>
  defineItem({
    id,
    name,
    stackSize,
    tags: ['bucket'],
    icon: 'bucket',
  }),
);

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

const UTILITY_SPECS: readonly [string, string, number][] = [
  ['shears', 'Shears', 1],
  ['fishing_rod', 'Fishing Rod', 1],
  ['flint_and_steel', 'Flint and Steel', 1],
  ['compass', 'Compass', 64],
  ['clock', 'Clock', 64],
  ['map', 'Map', 64],
  ['filled_map', 'Filled Map', 64],
  ['empty_map', 'Empty Map', 64],
  ['spyglass', 'Spyglass', 1],
  ['recovery_compass', 'Recovery Compass', 64],
  ['brush', 'Brush', 1],
  ['bundle', 'Bundle', 64],
  ['fire_charge', 'Fire Charge', 64],
  ['shield', 'Shield', 1],
  ['totem_of_undying', 'Totem of Undying', 1],
];

export const UTILITY_ITEMS: ItemDef[] = UTILITY_SPECS.map(([id, name, stackSize]) =>
  defineItem({
    id,
    name,
    stackSize,
    tags: id === 'fishing_rod' ? ['utility', 'fishing_rod'] : ['utility'],
    icon: id,
  }),
);

// ---------------------------------------------------------------------------
// Ranged weapons and ammunition
// ---------------------------------------------------------------------------

const WEAPON_SPECS: readonly [string, string, number, number][] = [
  ['bow', 'Bow', 1, 0],
  ['crossbow', 'Crossbow', 1, 0],
  ['arrow', 'Arrow', 64, 0],
  ['spectral_arrow', 'Spectral Arrow', 64, 0],
  ['tipped_arrow', 'Tipped Arrow', 64, 0],
  ['trident', 'Trident', 1, 9],
];

export const WEAPON_ITEMS: ItemDef[] = WEAPON_SPECS.map(([id, name, stackSize, damage]) =>
  defineItem({
    id,
    name,
    stackSize,
    damage: damage > 0 ? damage : undefined,
    tags: id.includes('arrow') ? [TAGS.ARROW] : ['weapon'],
    icon: id,
  }),
);

// ---------------------------------------------------------------------------
// Fireworks and books
// ---------------------------------------------------------------------------

export const FIREWORK_ITEMS: ItemDef[] = [
  defineItem({ id: 'firework_rocket', name: 'Firework Rocket', stackSize: 64, tags: ['firework'], icon: 'firework_rocket' }),
  defineItem({ id: 'firework_star', name: 'Firework Star', stackSize: 64, tags: ['firework'], icon: 'firework_star' }),
  defineItem({ id: 'firework_star_with_bomb', name: 'Firework Star with Bomb', stackSize: 64, tags: ['firework'], icon: 'firework_star' }),
];

export const BOOK_ITEMS: ItemDef[] = [
  defineItem({ id: 'book', name: 'Book', stackSize: 16, tags: ['book'], icon: 'book' }),
  defineItem({ id: 'writable_book', name: 'Book and Quill', stackSize: 1, tags: ['book'], icon: 'writable_book' }),
  defineItem({ id: 'written_book', name: 'Written Book', stackSize: 16, tags: ['book'], icon: 'written_book' }),
  defineItem({ id: 'knowledge_book', name: 'Knowledge Book', stackSize: 1, tags: ['book'], icon: 'knowledge_book' }),
  defineItem({ id: 'enchanted_book', name: 'Enchanted Book', stackSize: 1, tags: ['book', 'enchantable'], icon: 'enchanted_book' }),
];

// ---------------------------------------------------------------------------
// Boats
// ---------------------------------------------------------------------------

/** A boat and a chest boat for every wood type. */
export const BOAT_ITEMS: ItemDef[] = WOOD_SPECS.flatMap((wood) => [
  defineItem({
    id: `${wood.id}_boat`,
    name: `${wood.name} Boat`,
    stackSize: 1,
    tags: ['boat', 'rideable'],
    icon: 'boat',
  }),
  defineItem({
    id: `${wood.id}_chest_boat`,
    name: `${wood.name} Chest Boat`,
    stackSize: 1,
    tags: ['boat', 'rideable', 'is_chest'],
    icon: 'chest_boat',
  }),
]);

// ---------------------------------------------------------------------------
// Spawn eggs
// ---------------------------------------------------------------------------

/** One spawn egg per mob. */
export const SPAWN_EGG_ITEMS: ItemDef[] = ALL_MOBS.map((mob) =>
  defineItem({
    id: `${mob.id}_spawn_egg`,
    name: `${mob.displayName} Spawn Egg`,
    stackSize: 64,
    tags: [TAGS.SPAWN_EGG],
    icon: 'spawn_egg',
  }),
);

// ---------------------------------------------------------------------------
// Smithing templates and keys
// ---------------------------------------------------------------------------

export const TEMPLATE_ITEMS: ItemDef[] = [
  defineItem({
    id: 'netherite_upgrade_smithing_template',
    name: 'Netherite Upgrade Smithing Template',
    stackSize: 64,
    tags: [TAGS.SMITHING_TEMPLATE],
    icon: 'trim_smithing_template',
  }),
  defineItem({ id: 'trial_key', name: 'Trial Key', stackSize: 64, tags: ['key'], icon: 'trial_key' }),
  defineItem({ id: 'ominous_trial_key', name: 'Ominous Trial Key', stackSize: 64, tags: ['key'], icon: 'trial_key' }),
];

/** Every item of this module. */
export const MISC_ITEMS: ItemDef[] = [
  ...MUSIC_DISC_ITEMS,
  ...BUCKET_ITEMS,
  ...UTILITY_ITEMS,
  ...WEAPON_ITEMS,
  ...FIREWORK_ITEMS,
  ...BOOK_ITEMS,
  ...BOAT_ITEMS,
  ...SPAWN_EGG_ITEMS,
  ...TEMPLATE_ITEMS,
];
