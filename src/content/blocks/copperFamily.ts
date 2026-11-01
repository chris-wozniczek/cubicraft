/**
 * Copper family — the four oxidation stages and their waxed twins.
 *
 * Every stage contributes the same set of forms (block, cut block, three
 * shapes for each, grate, door, trapdoor, bulb, chiselled block), so a new
 * stage is one entry in `COPPER_STAGES`.
 */

import type { BlockDef } from '../../core/types';
import { TAGS } from '../tags';
import { defineBlock } from './common';

export type CopperStage = 'copper' | 'exposed' | 'weathered' | 'oxidized';

export interface CopperStageSpec {
  stage: CopperStage;
  /** Display name, e.g. `Exposed Copper`. */
  name: string;
  /** Id of the solid block, e.g. `exposed_copper`. */
  blockId: string;
  /** Id of the cut block, e.g. `exposed_cut_copper`. */
  cutId: string;
  /** Id prefix for grate/door/trapdoor/bulb, e.g. `exposed_copper`. */
  prefix: string;
  blockTexture: string;
  cutTexture: string;
  hardness: number;
}

export const COPPER_STAGES: readonly CopperStageSpec[] = [
  {
    stage: 'copper',
    name: 'Copper',
    blockId: 'copper_block',
    cutId: 'cut_copper',
    prefix: 'copper',
    blockTexture: 'copper_block',
    cutTexture: 'cut_copper',
    hardness: 3,
  },
  {
    stage: 'exposed',
    name: 'Exposed Copper',
    blockId: 'exposed_copper',
    cutId: 'exposed_cut_copper',
    prefix: 'exposed_copper',
    blockTexture: 'exposed_copper',
    cutTexture: 'exposed_cut_copper',
    hardness: 3,
  },
  {
    stage: 'weathered',
    name: 'Weathered Copper',
    blockId: 'weathered_copper',
    cutId: 'weathered_cut_copper',
    prefix: 'weathered_copper',
    blockTexture: 'weathered_copper',
    cutTexture: 'weathered_cut_copper',
    hardness: 3,
  },
  {
    stage: 'oxidized',
    name: 'Oxidized Copper',
    blockId: 'oxidized_copper',
    cutId: 'oxidized_cut_copper',
    prefix: 'oxidized_copper',
    blockTexture: 'oxidized_copper',
    cutTexture: 'oxidized_cut_copper',
    hardness: 3,
  },
];

/** Generate every block of one oxidation stage. */
export function copperFamily(stage: CopperStage): BlockDef[] {
  const spec = COPPER_STAGES.find((s) => s.stage === stage);
  if (!spec) return [];
  const blocks: BlockDef[] = [];

  const copperTags = [TAGS.IS_COPPER];
  const waxedTags = [TAGS.IS_COPPER, TAGS.IS_WAXED];

  const solid = (
    id: string,
    name: string,
    texture: string,
    tags: string[],
    params: Record<string, unknown>,
  ): BlockDef =>
    defineBlock({
      id,
      name,
      family: 'copper',
      hardness: spec.hardness,
      blastResistance: 3,
      tool: 'pickaxe',
      requiresToolTier: 1,
      correctToolDrops: true,
      textures: texture,
      tags,
      params,
    });

  const shape = (
    id: string,
    name: string,
    texture: string,
    tags: string[],
    shapeTag: string,
    params: Record<string, unknown>,
  ): BlockDef =>
    defineBlock({
      id,
      name,
      family: 'copper',
      hardness: spec.hardness,
      blastResistance: 3,
      tool: 'pickaxe',
      requiresToolTier: 1,
      correctToolDrops: true,
      textures: texture,
      tags: [...tags, shapeTag],
      shape: 'cube',
      params,
    });

  // Solid block and its waxed twin.
  blocks.push(
    solid(spec.blockId, `${spec.name} Block`, spec.blockTexture, copperTags, {
      copperStage: spec.stage,
      waxed: false,
      part: 'block',
    }),
    solid(`waxed_${spec.blockId}`, `Waxed ${spec.name} Block`, `waxed_${spec.blockTexture}`, waxedTags, {
      copperStage: spec.stage,
      waxed: true,
      part: 'block',
    }),
  );

  // Cut block and its waxed twin.
  blocks.push(
    solid(spec.cutId, `Cut ${spec.name}`, spec.cutTexture, copperTags, {
      copperStage: spec.stage,
      waxed: false,
      part: 'cut',
    }),
    solid(`waxed_${spec.cutId}`, `Waxed Cut ${spec.name}`, `waxed_${spec.cutTexture}`, waxedTags, {
      copperStage: spec.stage,
      waxed: true,
      part: 'cut',
    }),
  );

  // Construction shapes for both the solid and the cut block.
  for (const [baseId, baseName, texture, tags, part] of [
    [spec.blockId, `${spec.name} Block`, spec.blockTexture, copperTags, 'block'] as const,
    [`waxed_${spec.blockId}`, `Waxed ${spec.name} Block`, `waxed_${spec.blockTexture}`, waxedTags, 'block'] as const,
    [spec.cutId, `Cut ${spec.name}`, spec.cutTexture, copperTags, 'cut'] as const,
    [`waxed_${spec.cutId}`, `Waxed Cut ${spec.name}`, `waxed_${spec.cutTexture}`, waxedTags, 'cut'] as const,
  ]) {
    blocks.push(
      shape(`${baseId}_slab`, `${baseName} Slab`, texture, tags, TAGS.IS_SLAB, { copperStage: spec.stage, base: baseId, form: 'slab', part }),
      shape(`${baseId}_stairs`, `${baseName} Stairs`, texture, tags, TAGS.IS_STAIRS, { copperStage: spec.stage, base: baseId, form: 'stairs', part }),
      shape(`${baseId}_wall`, `${baseName} Wall`, texture, tags, TAGS.IS_FENCE, { copperStage: spec.stage, base: baseId, form: 'wall', part }),
    );
  }

  // Grate, door, trapdoor, bulb and chiselled block.
  const grateTexture = 'copper_grate';
  blocks.push(
    solid(`${spec.prefix}_grate`, `${spec.name} Grate`, grateTexture, copperTags, {
      copperStage: spec.stage,
      waxed: false,
      part: 'grate',
    }),
    solid(`waxed_${spec.prefix}_grate`, `Waxed ${spec.name} Grate`, grateTexture, waxedTags, {
      copperStage: spec.stage,
      waxed: true,
      part: 'grate',
    }),
    solid(`${spec.prefix}_door`, `${spec.name} Door`, 'copper_door', copperTags, {
      copperStage: spec.stage,
      waxed: false,
      part: 'door',
    }),
    solid(`waxed_${spec.prefix}_door`, `Waxed ${spec.name} Door`, 'copper_door', waxedTags, {
      copperStage: spec.stage,
      waxed: true,
      part: 'door',
    }),
    solid(`${spec.prefix}_trapdoor`, `${spec.name} Trapdoor`, 'copper_trapdoor', copperTags, {
      copperStage: spec.stage,
      waxed: false,
      part: 'trapdoor',
    }),
    solid(`waxed_${spec.prefix}_trapdoor`, `Waxed ${spec.name} Trapdoor`, 'copper_trapdoor', waxedTags, {
      copperStage: spec.stage,
      waxed: true,
      part: 'trapdoor',
    }),
    solid(`${spec.prefix}_bulb`, `${spec.name} Bulb`, 'copper_bulb', copperTags, {
      copperStage: spec.stage,
      waxed: false,
      part: 'bulb',
    }),
    solid(`waxed_${spec.prefix}_bulb`, `Waxed ${spec.name} Bulb`, 'copper_bulb', waxedTags, {
      copperStage: spec.stage,
      waxed: true,
      part: 'bulb',
    }),
    solid(`chiseled_${spec.prefix}`, `Chiselled ${spec.name}`, spec.cutTexture, copperTags, {
      copperStage: spec.stage,
      waxed: false,
      part: 'chiseled',
    }),
    solid(`waxed_chiseled_${spec.prefix}`, `Waxed Chiselled ${spec.name}`, spec.cutTexture, waxedTags, {
      copperStage: spec.stage,
      waxed: true,
      part: 'chiseled',
    }),
  );

  return blocks;
}
