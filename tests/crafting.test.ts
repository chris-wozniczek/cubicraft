import { describe, expect, it } from 'vitest';

import { emptyGrid, findRecipe } from '../src/game/crafting';
import { Inventory } from '../src/game/inventory';
import type { RecipeDef } from '../src/core/types';

const recipes: RecipeDef[] = [
  {
    id: 'stick',
    shape: 'shaped',
    pattern: ['oak_planks', 'oak_planks'],
    result: 'stick',
    count: 4,
  },
  {
    id: 'planks_from_log',
    shape: 'shapeless',
    ingredients: ['oak_log'],
    result: 'oak_planks',
    count: 4,
  },
  {
    id: 'torch',
    shape: 'shaped',
    pattern: ['coal', 'stick'],
    result: 'torch',
    count: 4,
  },
];

const noTags = () => false;

describe('crafting', () => {
  it('matches a shaped recipe', () => {
    const grid = emptyGrid(2, 2);
    grid.cells[0] = 'oak_planks';
    grid.cells[2] = 'oak_planks';
    const recipe = findRecipe(grid, recipes, noTags);
    expect(recipe?.id).toBe('stick');
  });

  it('does not match when the layout is wrong', () => {
    const grid = emptyGrid(2, 2);
    grid.cells[0] = 'oak_planks';
    grid.cells[1] = 'oak_planks';
    expect(findRecipe(grid, recipes, noTags)).toBeNull();
  });

  it('matches a shapeless recipe anywhere in the grid', () => {
    const grid = emptyGrid(3, 3);
    grid.cells[8] = 'oak_log';
    expect(findRecipe(grid, recipes, noTags)?.id).toBe('planks_from_log');
  });

  it('matches a recipe anywhere in the grid', () => {
    const grid = emptyGrid(3, 3);
    grid.cells[4] = 'oak_planks';
    grid.cells[7] = 'oak_planks';
    expect(findRecipe(grid, recipes, noTags)?.id).toBe('stick');
  });

  it('requires every ingredient of a shapeless recipe', () => {
    const grid = emptyGrid(2, 2);
    grid.cells[0] = 'oak_log';
    grid.cells[1] = 'oak_log';
    expect(findRecipe(grid, recipes, noTags)).toBeNull();
  });

  it('matches tag ingredients', () => {
    const tagged: RecipeDef[] = [
      { id: 'planks', shape: 'shapeless', ingredients: ['#logs'], result: 'oak_planks', count: 4 },
    ];
    const grid = emptyGrid(2, 2);
    grid.cells[0] = 'birch_log';
    expect(findRecipe(grid, tagged, (tag) => tag === 'logs')?.id).toBe('planks');
  });
});

describe('inventory', () => {
  it('stacks items up to the maximum', () => {
    const inventory = new Inventory();
    expect(inventory.add('stone', 10)).toBe(0);
    expect(inventory.count('stone')).toBe(10);
    // The overflow spills into the next slot rather than being lost.
    expect(inventory.add('stone', 60)).toBe(0);
    expect(inventory.count('stone')).toBe(70);
    expect(inventory.slots[0]?.count).toBe(64);
    expect(inventory.slots[1]?.count).toBe(6);
  });

  it('reports items that do not fit at all', () => {
    const inventory = new Inventory();
    expect(inventory.add('stone', 64 * 36 + 5)).toBe(5);
  });

  it('spills the overflow into a new slot', () => {
    const inventory = new Inventory();
    inventory.add('stone', 64);
    expect(inventory.add('stone', 10)).toBe(0);
    expect(inventory.slots[0]?.count).toBe(64);
    expect(inventory.slots[1]?.count).toBe(10);
  });

  it('removes items', () => {
    const inventory = new Inventory();
    inventory.add('stone', 10);
    expect(inventory.remove('stone', 4)).toBe(4);
    expect(inventory.count('stone')).toBe(6);
  });

  it('consumes the held stack', () => {
    const inventory = new Inventory();
    inventory.add('torch', 3);
    inventory.setSelected(0);
    expect(inventory.consumeHeld()).toBe(true);
    expect(inventory.count('torch')).toBe(2);
  });

  it('wears tools down and breaks them', () => {
    const inventory = new Inventory();
    inventory.add('pickaxe', 1, 2);
    inventory.setSelected(0);
    expect(inventory.damageHeld(1)).toBe(false);
    expect(inventory.held?.durability).toBe(1);
    expect(inventory.damageHeld(1)).toBe(true);
    expect(inventory.held).toBeNull();
  });

  it('wraps the hotbar selection', () => {
    const inventory = new Inventory();
    inventory.setSelected(-1);
    expect(inventory.selected).toBe(8);
    inventory.setSelected(9);
    expect(inventory.selected).toBe(0);
  });

  it('round-trips through JSON', () => {
    const inventory = new Inventory();
    inventory.add('stone', 12);
    inventory.setSelected(3);
    const data = inventory.toJSON();
    const other = new Inventory();
    other.fromJSON(data);
    expect(other.count('stone')).toBe(12);
    expect(other.selected).toBe(3);
  });
});
