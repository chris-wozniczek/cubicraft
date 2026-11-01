/**
 * Tools — the seven tiers crossed with the five tool kinds, plus the mace
 * and the spear.
 *
 * Damage and durability come from the authoritative tier table in `tags.ts`;
 * the per-kind damage table below is the one the brief pins down.
 */

import type { ItemDef, ToolKind } from '../../core/types';
import { TAGS, TOOL_TIERS } from '../tags';
import { defineItem } from './common';

export type ToolKindId = 'sword' | 'pickaxe' | 'axe' | 'shovel' | 'hoe';

const TOOL_KINDS: readonly ToolKindId[] = ['sword', 'pickaxe', 'axe', 'shovel', 'hoe'];

const TOOL_NAMES: Record<ToolKindId, string> = {
  sword: 'Sword',
  pickaxe: 'Pickaxe',
  axe: 'Axe',
  shovel: 'Shovel',
  hoe: 'Hoe',
};

/** Attack damage per tier and tool kind. */
const TOOL_DAMAGE: Record<ToolKindId, Record<string, number>> = {
  sword: { wooden: 4, stone: 5, copper: 5, iron: 6, golden: 4, diamond: 7, netherite: 8 },
  pickaxe: { wooden: 2, stone: 3, copper: 3, iron: 4, golden: 2, diamond: 5, netherite: 6 },
  axe: { wooden: 7, stone: 9, copper: 9, iron: 9, golden: 7, diamond: 9, netherite: 9 },
  shovel: { wooden: 2.5, stone: 3.5, copper: 3.5, iron: 4.5, golden: 2.5, diamond: 5.5, netherite: 6.5 },
  hoe: { wooden: 1, stone: 1, copper: 1, iron: 1, golden: 1, diamond: 1, netherite: 1 },
};

const TIER_NAMES: Record<string, string> = {
  wooden: 'Wooden',
  stone: 'Stone',
  copper: 'Copper',
  iron: 'Iron',
  golden: 'Golden',
  diamond: 'Diamond',
  netherite: 'Netherite',
};

/** Every tool of every tier. */
export const TOOL_ITEMS: ItemDef[] = TOOL_TIERS.flatMap((tier) =>
  TOOL_KINDS.map((kind) =>
    defineItem({
      id: `${tier.id}_${kind}`,
      name: `${TIER_NAMES[tier.id] ?? tier.id} ${TOOL_NAMES[kind]}`,
      stackSize: 1,
      tool: kind as ToolKind,
      tier: tier.level,
      durability: tier.durability,
      damage: TOOL_DAMAGE[kind][tier.id] ?? 1,
      tags: [TAGS.TOOL, `mineable/${kind}`],
      icon: `${tier.id}_${kind}`,
    }),
  ),
);

/** The mace — smashes blocks and mobs, damage scales with the charge. */
export const MACE_ITEM: ItemDef = defineItem({
  id: 'mace',
  name: 'Mace',
  stackSize: 1,
  tool: 'mace',
  tier: 2,
  durability: 500,
  damage: 6,
  tags: [TAGS.TOOL, 'mace'],
  icon: 'mace',
});

/** The spear — a two handed reach weapon. */
export const SPEAR_ITEM: ItemDef = defineItem({
  id: 'spear',
  name: 'Spear',
  stackSize: 1,
  tool: 'spear',
  tier: 2,
  durability: 250,
  damage: 8,
  tags: [TAGS.TOOL, 'spear'],
  icon: 'spear',
});

export const ALL_TOOL_ITEMS: ItemDef[] = [...TOOL_ITEMS, MACE_ITEM, SPEAR_ITEM];
