/**
 * The enchantment table.
 *
 * `appliesTo` lists item tags the enchantment can be put on; `conflicts`
 * lists enchantment ids that cannot be combined with it. The conflict graph
 * is symmetric, so the validator can check it in one direction only.
 */

import type { EnchantmentDef } from '../core/types';

export interface EnchantmentSpec {
  id: string;
  name: string;
  maxLevel: number;
  appliesTo: string[];
  conflicts?: string[];
  weight: number;
  fromTable?: boolean;
}

const ARMOUR = ['armor'];
const SWORD = ['mineable/sword'];
const AXE = ['mineable/axe'];
const PICKAXE = ['mineable/pickaxe'];
const SHOVEL = ['mineable/shovel'];
const HOE = ['mineable/hoe'];
const BOW = ['weapon'];

const SPECS: readonly EnchantmentSpec[] = [
  // Protection
  { id: 'protection', name: 'Protection', maxLevel: 4, appliesTo: ARMOUR, conflicts: ['fire_protection', 'blast_protection', 'projectile_protection'], weight: 10 },
  { id: 'fire_protection', name: 'Fire Protection', maxLevel: 4, appliesTo: ARMOUR, conflicts: ['protection'], weight: 5 },
  { id: 'blast_protection', name: 'Blast Protection', maxLevel: 4, appliesTo: ARMOUR, conflicts: ['protection'], weight: 2 },
  { id: 'projectile_protection', name: 'Projectile Protection', maxLevel: 4, appliesTo: ARMOUR, conflicts: ['protection'], weight: 5 },
  { id: 'thorns', name: 'Thorns', maxLevel: 3, appliesTo: ARMOUR, weight: 1 },
  { id: 'respiration', name: 'Respiration', maxLevel: 3, appliesTo: ['armor'], weight: 2 },
  { id: 'aqua_affinity', name: 'Aqua Affinity', maxLevel: 1, appliesTo: ['armor'], weight: 2 },
  { id: 'depth_strider', name: 'Depth Strider', maxLevel: 3, appliesTo: ['armor'], weight: 2 },
  { id: 'feather_falling', name: 'Feather Falling', maxLevel: 4, appliesTo: ['armor'], weight: 2 },
  { id: 'frost_walker', name: 'Frost Walker', maxLevel: 2, appliesTo: ['armor'], weight: 2 },
  { id: 'soul_speed', name: 'Soul Speed', maxLevel: 3, appliesTo: ['armor'], weight: 2 },

  // Utility
  { id: 'mending', name: 'Mending', maxLevel: 1, appliesTo: ['tool', 'armor'], conflicts: ['infinity'], weight: 2 },
  { id: 'binding_curse', name: 'Curse of Binding', maxLevel: 1, appliesTo: ['armor'], weight: 1 },
  { id: 'vanishing_curse', name: 'Curse of Vanishing', maxLevel: 1, appliesTo: ['tool', 'armor'], weight: 1 },

  // Combat
  { id: 'sharpness', name: 'Sharpness', maxLevel: 5, appliesTo: SWORD, conflicts: ['smite', 'bane_of_arthropods', 'breach', 'density'], weight: 10 },
  { id: 'smite', name: 'Smite', maxLevel: 5, appliesTo: SWORD, conflicts: ['sharpness', 'bane_of_arthropods', 'breach', 'density'], weight: 5 },
  { id: 'bane_of_arthropods', name: 'Bane of Arthropods', maxLevel: 5, appliesTo: SWORD, conflicts: ['sharpness', 'smite', 'breach', 'density'], weight: 5 },
  { id: 'knockback', name: 'Knockback', maxLevel: 2, appliesTo: SWORD, weight: 5 },
  { id: 'fire_aspect', name: 'Fire Aspect', maxLevel: 2, appliesTo: SWORD, weight: 2 },
  { id: 'looting', name: 'Looting', maxLevel: 3, appliesTo: SWORD, weight: 2 },
  { id: 'sweeping_edge', name: 'Sweeping Edge', maxLevel: 3, appliesTo: SWORD, weight: 2 },

  // Mining
  { id: 'efficiency', name: 'Efficiency', maxLevel: 5, appliesTo: [...PICKAXE, ...AXE, ...SHOVEL, ...HOE], weight: 10 },
  { id: 'silk_touch', name: 'Silk Touch', maxLevel: 1, appliesTo: [...PICKAXE, ...AXE, ...SHOVEL, ...HOE], conflicts: ['fortune'], weight: 1 },
  { id: 'fortune', name: 'Fortune', maxLevel: 3, appliesTo: [...PICKAXE, ...AXE, ...SHOVEL], conflicts: ['silk_touch'], weight: 2 },

  // Bow
  { id: 'power', name: 'Power', maxLevel: 5, appliesTo: BOW, weight: 10 },
  { id: 'punch', name: 'Punch', maxLevel: 2, appliesTo: BOW, weight: 2 },
  { id: 'flame', name: 'Flame', maxLevel: 1, appliesTo: BOW, weight: 2 },
  { id: 'infinity', name: 'Infinity', maxLevel: 1, appliesTo: BOW, conflicts: ['mending'], weight: 1 },
  { id: 'luck_of_the_sea', name: 'Luck of the Sea', maxLevel: 3, appliesTo: ['fishing_rod'], weight: 2, fromTable: false },
  { id: 'lure', name: 'Lure', maxLevel: 3, appliesTo: ['fishing_rod'], weight: 2, fromTable: false },
  { id: 'conduit_power', name: 'Conduit Power', maxLevel: 3, appliesTo: ['armor'], weight: 1 },

  // Crossbow
  { id: 'multishot', name: 'Multishot', maxLevel: 3, appliesTo: ['weapon'], weight: 5 },
  { id: 'piercing', name: 'Piercing', maxLevel: 3, appliesTo: ['weapon'], weight: 2 },
  { id: 'quick_charge', name: 'Quick Charge', maxLevel: 3, appliesTo: ['weapon'], weight: 2 },

  // Trident and charged weapons
  { id: 'sound_of_thunder', name: 'Sound of Thunder', maxLevel: 3, appliesTo: ['weapon'], weight: 2 },
  { id: 'wind_charged', name: 'Wind Charged', maxLevel: 1, appliesTo: ['weapon'], weight: 1 },
  { id: 'impaling', name: 'Impaling', maxLevel: 5, appliesTo: ['weapon'], weight: 2 },
  { id: 'loyalty', name: 'Loyalty', maxLevel: 3, appliesTo: ['weapon'], weight: 2 },
  { id: 'riptide', name: 'Riptide', maxLevel: 3, appliesTo: ['weapon'], weight: 2 },
  { id: 'channeling', name: 'Channeling', maxLevel: 1, appliesTo: ['weapon'], weight: 1 },

  // Mace and spear
  { id: 'breach', name: 'Breach', maxLevel: 4, appliesTo: ['mace'], conflicts: ['sharpness', 'smite', 'bane_of_arthropods', 'density'], weight: 10 },
  { id: 'density', name: 'Density', maxLevel: 5, appliesTo: ['mace'], conflicts: ['sharpness', 'smite', 'bane_of_arthropods', 'breach'], weight: 10 },
  { id: 'lunge', name: 'Lunge', maxLevel: 3, appliesTo: ['spear'], weight: 5 },
];

/** The canonical enchantment list. */
export const ALL_ENCHANTMENTS: EnchantmentDef[] = SPECS.map((spec) => ({
  id: spec.id,
  displayName: spec.name,
  maxLevel: spec.maxLevel,
  appliesTo: spec.appliesTo,
  conflicts: spec.conflicts ?? [],
  weight: spec.weight,
  fromTable: spec.fromTable ?? true,
}));
