/**
 * The inventory and crafting screen.
 *
 * Click an item in the inventory to move it into the crafting grid, click a
 * grid cell to take it back, and take the result to craft.
 */

import { escapeHtml } from './hud';
import { emptyGrid, findRecipe, type CraftingGrid } from '../game/crafting';
import type { Inventory, ItemStack } from '../game/inventory';
import type { RecipeDef } from '../core/types';

/** Armour slots render in this order, top to bottom on a person. */
const ARMOR_SLOTS = ['head', 'chest', 'legs', 'feet'] as const;

export interface CraftingUiOptions {
  inventory: Inventory;
  recipes: readonly RecipeDef[];
  /** Whether the player is near a crafting table (3x3) or not (2x2). */
  tableSize: 2 | 3;
  /** Item definition lookup, used for armour-slot info. */
  lookupItem?: (id: string) => { armorSlot?: string } | undefined;
  onCraft: (recipe: RecipeDef) => void;
  onClose: () => void;
}

export class CraftingUi {
  readonly root: HTMLDivElement;
  private readonly panel: HTMLDivElement;
  private readonly gridElement = document.createElement('div');
  private readonly resultElement = document.createElement('div');
  private readonly armorElement = document.createElement('div');
  private readonly inventoryElement = document.createElement('div');
  private readonly titleElement = document.createElement('h1');
  private grid: CraftingGrid;
  private result: RecipeDef | null = null;

  constructor(private readonly options: CraftingUiOptions) {
    this.grid = emptyGrid(options.tableSize, options.tableSize);

    this.root = document.createElement('div');
    this.root.className = 'screen visible';
    this.root.id = 'inventory-menu';

    this.panel = document.createElement('div');
    this.panel.className = 'panel glass';
    this.panel.style.width = 'min(620px, 94vw)';

    this.titleElement.textContent = options.tableSize === 3 ? 'Crafting Table' : 'Inventory';
    this.panel.appendChild(this.titleElement);
    this.panel.appendChild(this.subtitle());

    // Crafting area.
    const area = document.createElement('div');
    area.style.cssText = 'display:flex;gap:18px;align-items:center;justify-content:center;margin:14px 0 20px';

    this.gridElement.style.cssText = `display:grid;grid-template-columns:repeat(${options.tableSize},58px);gap:6px`;
    for (let i = 0; i < options.tableSize * options.tableSize; i++) {
      const cell = document.createElement('div');
      cell.className = 'slot';
      cell.addEventListener('click', () => this.takeFromGrid(i));
      this.gridElement.appendChild(cell);
    }

    const arrow = document.createElement('div');
    arrow.textContent = '→';
    arrow.style.cssText = 'font-size:26px;color:var(--muted)';

    this.resultElement.className = 'slot';
    this.resultElement.style.width = '70px';
    this.resultElement.style.height = '70px';
    this.resultElement.addEventListener('click', () => this.takeResult());

    area.append(this.gridElement, arrow, this.resultElement);
    this.panel.appendChild(area);

    this.armorElement.style.cssText = 'display:flex;gap:6px;justify-content:center;margin-bottom:10px';
    this.panel.appendChild(this.armorElement);

    this.inventoryElement.style.cssText = 'display:grid;grid-template-columns:repeat(9,58px);gap:6px;justify-content:center';
    this.panel.appendChild(this.inventoryElement);

    const row = document.createElement('div');
    row.className = 'row';
    row.style.marginTop = '18px';
    const close = document.createElement('button');
    close.className = 'btn primary';
    close.textContent = 'Close';
    close.addEventListener('click', () => options.onClose());
    row.appendChild(close);
    this.panel.appendChild(row);

    this.root.appendChild(this.panel);
    document.body.appendChild(this.root);
    this.refresh();
  }

  private subtitle(): HTMLElement {
    const p = document.createElement('p');
    p.className = 'sub';
    p.textContent = 'Click an item to put it in the grid, click the result to craft it.';
    return p;
  }

  /** Redraw the grid, the result and the inventory. */
  refresh(): void {
    this.renderGrid();
    this.renderResult();
    this.renderArmor();
    this.renderInventory();
  }

  /** Draw the four armour slots. */
  private renderArmor(): void {
    this.armorElement.innerHTML = '';
    ARMOR_SLOTS.forEach((slot, index) => {
      const cell = document.createElement('div');
      cell.className = 'slot';
      cell.style.width = '48px';
      cell.style.height = '48px';
      const stack = this.options.inventory.armor[index];
      const label = document.createElement('span');
      label.className = 'count';
      label.style.cssText = 'position:static;font-size:10px;color:var(--muted)';
      label.textContent = stack ? stack.item.replace(/_/g, ' ') : slot;
      cell.appendChild(label);
      cell.title = stack ? `Click to unequip ${stack.item.replace(/_/g, ' ')}` : `Armour: ${slot}`;
      if (stack) {
        cell.style.borderColor = 'var(--accent)';
        cell.addEventListener('click', () => this.unequip(index));
      }
      this.armorElement.appendChild(cell);
    });
  }

  private unequip(index: number): void {
    const stack = this.options.inventory.armor[index];
    if (!stack) return;
    if (this.options.inventory.add(stack.item, stack.count, stack.durability) === 0) {
      this.options.inventory.armor[index] = null;
      this.refresh();
    }
  }

  private equip(index: number, slotIndex: number): void {
    const stack = this.options.inventory.slots[index];
    if (!stack) return;
    const worn = this.options.inventory.armor[slotIndex];
    this.options.inventory.armor[slotIndex] = stack;
    this.options.inventory.slots[index] = worn;
    this.refresh();
  }

  private renderGrid(): void {
    const cells = this.gridElement.children;
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i] as HTMLDivElement;
      cell.innerHTML = '';
      const item = this.grid.cells[i];
      if (item) {
        const label = document.createElement('span');
        label.className = 'count';
        label.style.cssText = 'position:static;font-size:11px;color:var(--muted)';
        label.textContent = item.replace(/_/g, ' ');
        cell.appendChild(label);
        cell.style.background = 'rgba(111, 208, 255, 0.18)';
        cell.style.borderColor = 'var(--accent)';
      } else {
        cell.style.background = 'rgba(10, 14, 22, 0.55)';
        cell.style.borderColor = 'var(--stroke)';
      }
    }
  }

  private renderResult(): void {
    this.resultElement.innerHTML = '';
    this.result = findRecipe(
      this.grid,
      this.options.recipes,
      (tag) => this.hasTag(tag),
    );
    if (!this.result) {
      this.resultElement.style.borderColor = 'var(--stroke)';
      return;
    }
    this.resultElement.style.borderColor = 'var(--accent)';
    this.resultElement.style.boxShadow = '0 0 0 1px var(--accent)';
    const label = document.createElement('span');
    label.className = 'count';
    label.style.cssText = 'position:static;font-size:11px;color:var(--muted)';
    label.textContent = this.result.result.replace(/_/g, ' ');
    this.resultElement.appendChild(label);
  }

  private renderInventory(): void {
    this.inventoryElement.innerHTML = '';
    this.options.inventory.slots.forEach((stack, index) => {
      const cell = document.createElement('div');
      cell.className = `slot${index === this.options.inventory.selected ? ' selected' : ''}`;
      if (stack) {
        const label = document.createElement('span');
        label.className = 'count';
        label.style.cssText = 'position:static;font-size:11px;color:var(--muted)';
        label.textContent = stack.count > 1 ? String(stack.count) : '';
        cell.appendChild(label);
        cell.title = stack.item.replace(/_/g, ' ');
        cell.addEventListener('click', () => this.takeFromInventory(index));
      }
      this.inventoryElement.appendChild(cell);
    });
  }

  private takeFromInventory(index: number): void {
    const stack = this.options.inventory.slots[index] as ItemStack | null;
    if (!stack) return;
    // Armour goes on the player, not into the crafting grid.
    const armorSlot = this.options.lookupItem?.(stack.item)?.armorSlot;
    if (armorSlot) {
      const slotIndex = ARMOR_SLOTS.indexOf(armorSlot as (typeof ARMOR_SLOTS)[number]);
      if (slotIndex >= 0) {
        this.equip(index, slotIndex);
        return;
      }
    }
    const empty = this.grid.cells.findIndex((c) => c === null);
    if (empty < 0) return;
    this.grid.cells[empty] = stack.item;
    this.options.inventory.slots[index] = null;
    this.refresh();
  }

  private takeFromGrid(index: number): void {
    const item = this.grid.cells[index];
    if (!item) return;
    if (this.options.inventory.add(item, 1) === 0) {
      this.grid.cells[index] = null;
      this.refresh();
    }
  }

  private takeResult(): void {
    if (!this.result) return;
    const recipe = this.result;
    const remaining = this.options.inventory.add(recipe.result, recipe.count);
    if (remaining > 0) return;
    for (let i = 0; i < this.grid.cells.length; i++) {
      const item = this.grid.cells[i];
      if (!item) continue;
      this.grid.cells[i] = null;
      this.options.inventory.remove(item, 1);
    }
    this.options.onCraft(recipe);
    this.refresh();
  }

  private hasTag(tag: string): boolean {
    void tag;
    return false;
  }

  close(): void {
    // Return anything left in the grid to the inventory.
    for (let i = 0; i < this.grid.cells.length; i++) {
      const item = this.grid.cells[i];
      if (!item) continue;
      this.options.inventory.add(item, 1);
      this.grid.cells[i] = null;
    }
    this.root.remove();
  }

  get visible(): boolean {
    return this.root.classList.contains('visible');
  }
}

export function itemLabel(stack: ItemStack): string {
  return escapeHtml(stack.item.replace(/_/g, ' '));
}
