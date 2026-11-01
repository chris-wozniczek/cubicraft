/**
 * Recipe helpers.
 *
 * Pattern encoding: a shaped recipe is a list of rows, and each row is a
 * space separated list of ingredient ids (or `#tag` references). An empty
 * cell is written as an empty string, which means two consecutive spaces
 * between two ingredients.
 *
 *   ['# #', ' # ']  ->  one ingredient in the top left and bottom right
 */

import type { RecipeShape } from '../../core/types';
import type { RegisteredRecipe } from '../registries';

/** One cell of a shaped pattern: an ingredient id, a `#tag`, or null. */
export type Cell = string | null;

export interface RecipeTags {
  tags?: string[];
}

/** A shaped recipe from a grid of cells. */
export function shaped(
  id: string,
  rows: Cell[][],
  result: string,
  count = 1,
  tags: string[] = [],
): RegisteredRecipe {
  return {
    id,
    shape: 'shaped',
    pattern: rows.map((row) => row.map((cell) => cell ?? '').join(' ')),
    result,
    count,
    tags,
  };
}

/** A shapeless recipe from a list of ingredients. */
export function shapeless(
  id: string,
  ingredients: string[],
  result: string,
  count = 1,
  tags: string[] = [],
): RegisteredRecipe {
  return { id, shape: 'shapeless', ingredients, result, count, tags };
}

/** A furnace recipe. */
export function smelting(
  id: string,
  ingredient: string,
  result: string,
  count = 1,
  cookTime = 200,
  tags: string[] = [],
): RegisteredRecipe {
  return { id, shape: 'smelting', ingredients: [ingredient], result, count, cookTime, tags };
}

/** A blast furnace recipe. */
export function blasting(
  id: string,
  ingredient: string,
  result: string,
  count = 1,
  cookTime = 100,
  tags: string[] = [],
): RegisteredRecipe {
  return { id, shape: 'blasting', ingredients: [ingredient], result, count, cookTime, tags };
}

/** A smoker recipe. */
export function smoking(
  id: string,
  ingredient: string,
  result: string,
  count = 1,
  cookTime = 100,
  tags: string[] = [],
): RegisteredRecipe {
  return { id, shape: 'smoking', ingredients: [ingredient], result, count, cookTime, tags };
}

/** A stonecutter recipe. */
export function stonecutting(
  id: string,
  ingredient: string,
  result: string,
  count = 1,
  tags: string[] = [],
): RegisteredRecipe {
  return { id, shape: 'stonecutting', ingredients: [ingredient], result, count, tags };
}

/** A smithing recipe. */
export function smithing(
  id: string,
  template: string,
  base: string,
  addition: string,
  result: string,
  count = 1,
  tags: string[] = [],
): RegisteredRecipe {
  return {
    id,
    shape: 'smithing',
    ingredients: [template, base, addition],
    result,
    count,
    tags,
  };
}

/** Build a recipe with an explicit shape. */
export function recipe(
  id: string,
  shape: RecipeShape,
  result: string,
  count: number,
  pattern?: string[],
  ingredients?: string[],
  tags: string[] = [],
): RegisteredRecipe {
  const out: RegisteredRecipe = { id, shape, result, count, tags };
  if (pattern) out.pattern = pattern;
  if (ingredients) out.ingredients = ingredients;
  return out;
}
