/**
 * Ore family — one entry per ore kind.
 *
 * The generator decides which variants exist (deepslate twin, lit twin) and
 * what the ore drops, so a new ore is a single record.
 */

import type { BlockDef, MiningLevel } from '../../core/types';
import { TAGS } from '../tags';
import { silkOrDrop } from '../loot';
import { defineBlock } from './common';

export type OreKind =
  | 'coal'
  | 'iron'
  | 'copper'
  | 'gold'
  | 'redstone'
  | 'lapis'
  | 'diamond'
  | 'emerald'
  | 'nether_gold'
  | 'ancient_debris'
  | 'quartz'
  | 'nether_quartz';

export interface OreSpec {
  kind: OreKind;
  name: string;
  /** Id of the block; defaults to `<kind>_ore`. */
  id?: string;
  /** Texture of the block; defaults to the block id. */
  texture?: string;
  /** Mining level required for a drop. */
  tier: MiningLevel;
  /** Item the ore breaks into. */
  drop: string;
  min: number;
  max: number;
  /** Also exists in the deepslate variant. */
  deepslate?: boolean;
  /** Exists in a lit variant (redstone). */
  lit?: boolean;
  dimension: 'overworld' | 'nether';
}

const ORE_SPECS: readonly OreSpec[] = [
  { kind: 'coal', name: 'Coal Ore', tier: 0, drop: 'coal', min: 1, max: 1, deepslate: true, dimension: 'overworld' },
  { kind: 'iron', name: 'Iron Ore', tier: 1, drop: 'raw_iron', min: 1, max: 1, deepslate: true, dimension: 'overworld' },
  { kind: 'copper', name: 'Copper Ore', tier: 1, drop: 'raw_copper', min: 2, max: 3, deepslate: true, dimension: 'overworld' },
  { kind: 'gold', name: 'Gold Ore', tier: 2, drop: 'raw_gold', min: 1, max: 1, deepslate: true, dimension: 'overworld' },
  { kind: 'redstone', name: 'Redstone Ore', tier: 2, drop: 'redstone', min: 4, max: 5, deepslate: true, lit: true, dimension: 'overworld' },
  { kind: 'lapis', name: 'Lapis Lazuli Ore', tier: 1, drop: 'lapis_lazuli', min: 4, max: 9, deepslate: true, dimension: 'overworld' },
  { kind: 'diamond', name: 'Diamond Ore', tier: 2, drop: 'diamond', min: 1, max: 1, deepslate: true, dimension: 'overworld' },
  { kind: 'emerald', name: 'Emerald Ore', tier: 2, drop: 'emerald', min: 1, max: 1, deepslate: true, dimension: 'overworld' },
  { kind: 'nether_gold', name: 'Nether Gold Ore', tier: 1, drop: 'netherite_scrap', min: 0, max: 1, deepslate: true, dimension: 'nether' },
  { kind: 'ancient_debris', name: 'Ancient Debris', id: 'ancient_debris', tier: 3, drop: 'netherite_scrap', min: 0, max: 1, deepslate: true, dimension: 'nether' },
  { kind: 'quartz', name: 'Nether Quartz Ore', tier: 1, drop: 'nether_quartz', min: 1, max: 1, deepslate: true, dimension: 'nether' },
  { kind: 'nether_quartz', name: 'Nether Quartz Ore', id: 'nether_quartz_ore', tier: 1, drop: 'nether_quartz', min: 1, max: 1, deepslate: true, dimension: 'nether' },
];

const ORE_SPEC_BY_KIND = new Map(ORE_SPECS.map((spec) => [spec.kind, spec]));

/** Generate the block(s) of one ore kind. */
export function oreFamily(kind: OreKind): BlockDef[] {
  const spec = ORE_SPEC_BY_KIND.get(kind);
  if (!spec) return [];
  const blocks: BlockDef[] = [];

  const id = spec.id ?? `${spec.kind}_ore`;
  const texture = spec.texture ?? id;

  const oreBlock = (blockId: string, name: string, blockTexture: string, deepslate: boolean) =>
    defineBlock({
      id: blockId,
      name,
      family: 'ore',
      hardness: 3,
      blastResistance: 3,
      tool: 'pickaxe',
      requiresToolTier: spec.tier,
      correctToolDrops: true,
      textures: blockTexture,
      tags: [TAGS.ORES, TAGS.STONE],
      drops: silkOrDrop(blockId, spec.drop, spec.min, spec.max),
      params: { ore: spec.kind, deepslate },
    });

  if (spec.lit) {
    const litTexture = texture.replace('redstone_ore', 'lit_redstone_ore');
    blocks.push(
      defineBlock({
        id: 'redstone_ore',
        name: 'Redstone Ore',
        family: 'ore',
        hardness: 3,
        blastResistance: 3,
        tool: 'pickaxe',
        requiresToolTier: spec.tier,
        correctToolDrops: true,
        textures: texture,
        tags: [TAGS.ORES, TAGS.STONE],
        drops: silkOrDrop('redstone_ore', spec.drop, spec.min, spec.max),
        params: { ore: 'redstone', lit: false },
      }),
      defineBlock({
        id: 'lit_redstone_ore',
        name: 'Redstone Ore',
        family: 'ore',
        hardness: 3,
        blastResistance: 3,
        lightEmission: 7,
        tool: 'pickaxe',
        requiresToolTier: spec.tier,
        correctToolDrops: true,
        textures: litTexture,
        tags: [TAGS.ORES, TAGS.STONE],
        drops: silkOrDrop('lit_redstone_ore', spec.drop, spec.min, spec.max),
        params: { ore: 'redstone', lit: true },
      }),
      defineBlock({
        id: 'deepslate_redstone_ore',
        name: 'Deepslate Redstone Ore',
        family: 'ore',
        hardness: 4.5,
        blastResistance: 4.5,
        tool: 'pickaxe',
        requiresToolTier: spec.tier,
        correctToolDrops: true,
        textures: 'deepslate_redstone_ore',
        tags: [TAGS.ORES, TAGS.STONE],
        drops: silkOrDrop('deepslate_redstone_ore', spec.drop, spec.min, spec.max),
        params: { ore: 'redstone', deepslate: true, lit: false },
      }),
      defineBlock({
        id: 'deepslate_lit_redstone_ore',
        name: 'Deepslate Redstone Ore',
        family: 'ore',
        hardness: 4.5,
        blastResistance: 4.5,
        lightEmission: 7,
        tool: 'pickaxe',
        requiresToolTier: spec.tier,
        correctToolDrops: true,
        textures: 'deepslate_lit_redstone_ore',
        tags: [TAGS.ORES, TAGS.STONE],
        drops: silkOrDrop('deepslate_lit_redstone_ore', spec.drop, spec.min, spec.max),
        params: { ore: 'redstone', deepslate: true, lit: true },
      }),
    );
    return blocks;
  }

  blocks.push(oreBlock(id, spec.name, texture, false));

  if (spec.deepslate) {
    blocks.push(
      oreBlock(
        `deepslate_${id}`,
        `Deepslate ${spec.name}`,
        `deepslate_${texture}`,
        true,
      ),
    );
  }

  return blocks;
}
