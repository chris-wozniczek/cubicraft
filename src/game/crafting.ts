/**
 * Crafting.
 *
 * Recipes come from the content registry. Shaped recipes match a grid by
 * pattern (ignoring empty cells, and mirrored when the player toggles the
 * mirror flag); shapeless recipes match by ingredient count.
 *
 * Pattern rows are whitespace-separated tokens, so an ingredient id of any
 * length works:
 *
 *     ['oak_planks oak_planks']
 *     ['#planks  #planks']
 */

import type { RecipeDef } from '../core/types';

export interface CraftingGrid {
  /** Grid of item ids, or null for an empty cell. */
  cells: (string | null)[];
  width: number;
  height: number;
}

export function emptyGrid(width = 3, height = 3): CraftingGrid {
  return { cells: new Array(width * height).fill(null), width, height };
}

/**
 * Split a pattern row into tokens; runs of whitespace mark empty cells.
 *
 * A single space separates cells, so two spaces in a row is an empty cell
 * between two ingredients.
 */
function tokenise(row: string): (string | null)[] {
  const trimmed = row.trim();
  if (trimmed === '') return [];
  return trimmed.split(' ').map((token) => (token === '' ? null : token));
}

function matchesIngredient(ingredient: string, item: string | null, tags: (tag: string) => boolean): boolean {
  if (item === null) return false;
  if (ingredient.startsWith('#')) return tags(ingredient.slice(1));
  return ingredient === item;
}

interface PatternGrid {
  rows: (string | null)[][];
  width: number;
  height: number;
}

function toPatternGrid(recipe: RecipeDef): PatternGrid {
  const rows = (recipe.pattern ?? []).map(tokenise);
  return {
    rows,
    width: Math.max(1, ...rows.map((r) => r.length)),
    height: rows.length,
  };
}

/**
 * Try every recipe against the grid.
 * Returns the recipe that matches, or null.
 */
export function findRecipe(
  grid: CraftingGrid,
  recipes: readonly RecipeDef[],
  tags: (tag: string) => boolean,
  mirrored = false,
): RecipeDef | null {
  for (const recipe of recipes) {
    if (recipe.shape === 'shaped') {
      if (matchShaped(recipe, grid, tags, mirrored)) return recipe;
    } else if (recipe.shape === 'shapeless') {
      if (matchShapeless(recipe, grid, tags)) return recipe;
    }
  }
  return null;
}

function matchShaped(
  recipe: RecipeDef,
  grid: CraftingGrid,
  tags: (tag: string) => boolean,
  mirrored: boolean,
): boolean {
  const pattern = toPatternGrid(recipe);
  if (pattern.height === 0) return false;

  const flips = mirrored ? [false, true] : [false];
  for (const flip of flips) {
    for (let offsetY = 0; offsetY <= grid.height - pattern.height; offsetY++) {
      for (let offsetX = 0; offsetX <= grid.width - pattern.width; offsetX++) {
        if (matchesAt(pattern, grid, tags, offsetX, offsetY, flip)) return true;
      }
    }
  }
  return false;
}

function matchesAt(
  pattern: PatternGrid,
  grid: CraftingGrid,
  tags: (tag: string) => boolean,
  offsetX: number,
  offsetY: number,
  flip: boolean,
): boolean {
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const cell = grid.cells[y * grid.width + x];
      const px = x - offsetX;
      const py = y - offsetY;
      if (px < 0 || px >= pattern.width || py < 0 || py >= pattern.height) {
        // Outside the pattern — the grid cell must be empty.
        if (cell !== null) return false;
        continue;
      }
      const row = pattern.rows[py];
      const token = flip ? row[pattern.width - 1 - px] : row[px];
      if (token === undefined || token === null) {
        if (cell !== null) return false;
        continue;
      }
      if (!matchesIngredient(token, cell, tags)) return false;
    }
  }
  return true;
}

function matchShapeless(
  recipe: RecipeDef,
  grid: CraftingGrid,
  tags: (tag: string) => boolean,
): boolean {
  const ingredients = recipe.ingredients ?? [];
  const cells = grid.cells.filter((c): c is string => c !== null);
  if (cells.length !== ingredients.length) return false;

  const used = new Set<number>();
  for (const ingredient of ingredients) {
    const index = cells.findIndex(
      (cell, i) => !used.has(i) && matchesIngredient(ingredient, cell, tags),
    );
    if (index === -1) return false;
    used.add(index);
  }
  return true;
}

/** Remove one of each ingredient from the grid after a craft. */
export function consumeIngredients(grid: CraftingGrid, recipe: RecipeDef): void {
  if (recipe.shape !== 'shaped') {
    for (const ingredient of recipe.ingredients ?? []) {
      const index = grid.cells.findIndex(
        (cell) => cell !== null && matchesIngredient(ingredient, cell, () => true),
      );
      if (index >= 0) grid.cells[index] = null;
    }
    return;
  }

  const pattern = toPatternGrid(recipe);
  for (let offsetY = 0; offsetY <= grid.height - pattern.height; offsetY++) {
    for (let offsetX = 0; offsetX <= grid.width - pattern.width; offsetX++) {
      let matched = true;
      for (let y = 0; y < grid.height && matched; y++) {
        for (let x = 0; x < grid.width && matched; x++) {
          const px = x - offsetX;
          const py = y - offsetY;
          if (px < 0 || px >= pattern.width || py < 0 || py >= pattern.height) {
            if (grid.cells[y * grid.width + x] !== null) matched = false;
            continue;
          }
          const token = pattern.rows[py][px];
          if (!token && grid.cells[y * grid.width + x] !== null) matched = false;
        }
      }
      if (!matched) continue;

      for (let y = 0; y < grid.height; y++) {
        for (let x = 0; x < grid.width; x++) {
          const px = x - offsetX;
          const py = y - offsetY;
          if (px < 0 || px >= pattern.width || py < 0 || py >= pattern.height) continue;
          if (pattern.rows[py][px]) grid.cells[y * grid.width + x] = null;
        }
      }
      return;
    }
  }
}
