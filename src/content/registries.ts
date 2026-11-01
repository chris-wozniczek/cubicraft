/**
 * The six content registries.
 *
 * They live in their own module so that family generators can reference the
 * registries without importing `index.ts` (which imports them back). That
 * keeps the dependency graph acyclic: `index.ts` -> families -> `registries.ts`.
 *
 * `Registry<T>` requires a `tags` field. `BiomeDef` and `RecipeDef` do not
 * declare one, so the wrapper types below add it rather than weakening the
 * shared `Registry` contract.
 */

import { Registry } from './registry';
import type {
  BiomeDef,
  BlockDef,
  EnchantmentDef,
  ItemDef,
  MobDef,
  RecipeDef,
} from '../core/types';

export interface RegisteredBiome extends BiomeDef {
  tags: string[];
}

export interface RegisteredRecipe extends RecipeDef {
  tags: string[];
}

export const blocks = new Registry<BlockDef>('blocks');
export const items = new Registry<ItemDef>('items');
export const mobs = new Registry<MobDef>('mobs');
export const biomes = new Registry<RegisteredBiome>('biomes');
export const enchantments = new Registry<EnchantmentDef>('enchantments');
export const recipes = new Registry<RegisteredRecipe>('recipes');

/** Every registry, in the order the boot sequence freezes them. */
export const ALL_REGISTRIES = [blocks, items, mobs, biomes, enchantments, recipes] as const;
