/**
 * Content registry bootstrap.
 *
 * This is the single entry point the engine talks to: it registers every
 * block, item, mob, biome, enchantment and recipe, freezes the registries so
 * a typo cannot become a missing block at runtime, and can validate the
 * whole set.
 */

import { Registry, ValidationReport, type ValidationIssue } from './registry';
import type { BlockDef, ItemDef, MobDef } from '../core/types';
import { ALL_REGISTRIES, biomes, blocks, enchantments, items, mobs, recipes } from './registries';
import { ALL_BLOCKS } from './blocks/index';
import { ALL_ITEMS } from './items/index';
import { ALL_MOBS } from './mobs/index';
import { ALL_BIOMES } from './biomes';
import { ALL_ENCHANTMENTS } from './enchantments';
import { ALL_RECIPES } from './crafting/index';
import { ARMOUR_SETS } from './armor/armour';
import { TEXTURE_NAMES, textureLayer } from './textures';

export { blocks, items, mobs, biomes, enchantments, recipes };
export { TEXTURE_NAMES, textureLayer };

/** Canonical ordering of block ids — the numeric id is the index in this list. */
export const BLOCK_IDS: string[] = [];

/** Block name to numeric id. */
export const BLOCK_INDEX = new Map<string, number>();

const initIssues: ValidationIssue[] = [];
let initialised = false;

/**
 * Register a list of definitions.
 *
 * Duplicates are collected instead of thrown so that `validateContent` can
 * report every one of them at once.
 */
function registerAll<T extends { id: string }>(registry: Registry<T>, defs: readonly T[]): void {
  const seen = new Set<string>();
  for (const def of defs) {
    if (seen.has(def.id)) {
      initIssues.push({
        severity: 'error',
        registry: registry.name,
        message: `duplicate id "${def.id}"`,
      });
      continue;
    }
    seen.add(def.id);
    registry.register(def);
  }
}

/** Register everything and freeze the registries. Safe to call more than once. */
export function initContent(): void {
  if (initialised) return;
  initialised = true;

  registerAll(blocks, ALL_BLOCKS);
  registerAll(items, ALL_ITEMS);
  registerAll(mobs, ALL_MOBS);
  registerAll(biomes, ALL_BIOMES);
  registerAll(enchantments, ALL_ENCHANTMENTS);
  registerAll(recipes, ALL_RECIPES);

  BLOCK_IDS.length = 0;
  BLOCK_INDEX.clear();
  for (const block of blocks.all()) {
    BLOCK_INDEX.set(block.id, BLOCK_IDS.length);
    BLOCK_IDS.push(block.id);
  }

  for (const registry of ALL_REGISTRIES) registry.freeze();
}

/** True once `initContent` has run. */
export function isContentInitialised(): boolean {
  return initialised;
}

function knownId(id: string): boolean {
  return blocks.has(id) || items.has(id);
}

/** Split a pattern row into its ingredient tokens. */
function patternTokens(row: string): string[] {
  return row.split(' ').filter((token) => token.length > 0);
}

/**
 * Check that every reference in the content set resolves.
 *
 * Every check reports instead of throwing, so one broken reference does not
 * hide the rest of the set.
 */
export function validateContent(): ValidationReport {
  const report = new ValidationReport();

  for (const issue of initIssues) {
    if (issue.severity === 'error') report.error(issue.registry, issue.message);
    else report.warn(issue.registry, issue.message);
  }

  if (!initialised) {
    // Nothing is registered yet, so every reference check would fail. Report
    // the ordering mistake instead of a wall of false errors.
    report.warn('content', 'validateContent() ran before initContent(); the registries are empty');
    return report;
  }

  const textureSet = new Set(TEXTURE_NAMES);

  // Blocks: drops, textures and tags.
  for (const block of blocks.all()) {
    for (const drop of block.drops) {
      if (!knownId(drop.item)) {
        report.error('blocks', `${block.id} drops unknown item "${drop.item}"`);
      }
    }
    for (const face of ['top', 'side', 'bottom', 'front'] as const) {
      const name = block.textures[face];
      if (!textureSet.has(name)) {
        report.error('blocks', `${block.id} uses unknown texture "${name}" (${face})`);
      }
    }
  }

  // Items: placed block and icon texture.
  for (const item of items.all()) {
    if (item.places && !blocks.has(item.places)) {
      report.error('items', `${item.id} places unknown block "${item.places}"`);
    }
    if (!textureSet.has(item.icon)) {
      report.error('items', `${item.id} uses unknown icon texture "${item.icon}"`);
    }
    if (blocks.has(item.id) && !item.tags.includes('food') && !item.tags.includes('block_item')) {
      report.warn('items', `${item.id} is registered as both a block and an item`);
    }
  }

  // Biomes: surface and filler must be real blocks, spawn tables real mobs.
  for (const biome of biomes.all()) {
    if (!blocks.has(biome.surface)) {
      report.error('biomes', `${biome.id} uses unknown surface block "${biome.surface}"`);
    }
    if (!blocks.has(biome.filler)) {
      report.error('biomes', `${biome.id} uses unknown filler block "${biome.filler}"`);
    }
    for (const mobId of Object.keys(biome.mobs)) {
      if (!mobs.has(mobId)) {
        report.warn('biomes', `${biome.id} spawns unknown mob "${mobId}"`);
      }
    }
  }

  // Mobs: spawn biomes and drops.
  for (const mob of mobs.all()) {
    for (const biomeId of mob.spawn.biomes) {
      if (!biomes.has(biomeId)) {
        report.error('mobs', `${mob.id} spawns in unknown biome "${biomeId}"`);
      }
    }
    for (const drop of mob.drops) {
      if (!knownId(drop.item)) {
        report.error('mobs', `${mob.id} drops unknown item "${drop.item}"`);
      }
    }
  }

  // Recipes: result, ingredients and pattern tokens.
  for (const recipe of recipes.all()) {
    if (!knownId(recipe.result)) {
      report.error('recipes', `${recipe.id} produces unknown item "${recipe.result}"`);
    }
    for (const ingredient of recipe.ingredients ?? []) {
      if (ingredient.startsWith('#')) {
        const tag = ingredient.slice(1);
        if (!items.hasTag(tag) && !blocks.hasTag(tag)) {
          report.error('recipes', `${recipe.id} needs unknown tag "${ingredient}"`);
        }
        continue;
      }
      if (!knownId(ingredient)) {
        report.error('recipes', `${recipe.id} needs unknown ingredient "${ingredient}"`);
      }
    }
    for (const row of recipe.pattern ?? []) {
      for (const token of patternTokens(row)) {
        if (token.startsWith('#')) {
          const tag = token.slice(1);
          if (!items.hasTag(tag) && !blocks.hasTag(tag)) {
            report.error('recipes', `${recipe.id} uses unknown tag "${token}"`);
          }
          continue;
        }
        if (!knownId(token)) {
          report.error('recipes', `${recipe.id} uses unknown ingredient "${token}"`);
        }
      }
    }
  }

  // Enchantments: conflicts must name real enchantments.
  for (const enchantment of enchantments.all()) {
    if (enchantment.id === 'cleaving') {
      report.error('enchantments', '"cleaving" is not a Java Edition enchantment');
    }
    for (const conflict of enchantment.conflicts) {
      if (!enchantments.has(conflict)) {
        report.error('enchantments', `${enchantment.id} conflicts with unknown enchantment "${conflict}"`);
      }
    }
    for (const tag of enchantment.appliesTo) {
      if (!items.hasTag(tag) && !blocks.hasTag(tag)) {
        report.warn('enchantments', `${enchantment.id} applies to unused tag "${tag}"`);
      }
    }
  }

  // Armour: every set needs all four pieces.
  for (const [set, pieces] of Object.entries(ARMOUR_SETS)) {
    if (pieces.length !== 4) {
      report.error('armour', `armour set "${set}" has ${pieces.length} pieces, expected 4`);
    }
    for (const piece of pieces) {
      if (!items.has(piece)) {
        report.error('armour', `armour set "${set}" is missing piece "${piece}"`);
      }
    }
  }

  return report;
}

/** Counts of the registered content, handy for the boot screen and tests. */
export interface ContentCounts {
  blocks: number;
  items: number;
  mobs: number;
  biomes: number;
  enchantments: number;
  recipes: number;
  textures: number;
}

export function contentCounts(): ContentCounts {
  return {
    blocks: blocks.size,
    items: items.size,
    mobs: mobs.size,
    biomes: biomes.size,
    enchantments: enchantments.size,
    recipes: recipes.size,
    textures: TEXTURE_NAMES.length,
  };
}

export type { BlockDef, ItemDef, MobDef };
