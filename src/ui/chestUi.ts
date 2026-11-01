/**
 * The chest screen — move items between your inventory and the chest.
 *
 * Click an item to move it to the other side; stacks merge automatically.
 */

import type { Inventory, ItemStack } from '../game/inventory';

export interface ChestUiOptions {
  inventory: Inventory;
  /** The chest's own slots (persisted by the game). */
  chest: (ItemStack | null)[];
  onClose: () => void;
}

const CHEST_SLOTS = 27;
const MAX_STACK = 64;

export class ChestUi {
  readonly root: HTMLDivElement;
  private readonly chestElement = document.createElement('div');
  private readonly inventoryElement = document.createElement('div');

  constructor(private readonly options: ChestUiOptions) {
    this.root = document.createElement('div');
    this.root.className = 'screen visible';
    this.root.id = 'chest-menu';

    const panel = document.createElement('div');
    panel.className = 'panel glass';
    panel.style.width = 'min(620px, 94vw)';

    const title = document.createElement('h1');
    title.textContent = 'Chest';
    panel.appendChild(title);

    const sub = document.createElement('p');
    sub.className = 'sub';
    sub.textContent = 'Click an item to move it between you and the chest.';
    panel.appendChild(sub);

    this.chestElement.style.cssText = 'display:grid;grid-template-columns:repeat(9,58px);gap:6px;justify-content:center;margin:14px 0 22px';
    panel.appendChild(this.chestElement);

    this.inventoryElement.style.cssText = 'display:grid;grid-template-columns:repeat(9,58px);gap:6px;justify-content:center';
    panel.appendChild(this.inventoryElement);

    const row = document.createElement('div');
    row.className = 'row';
    row.style.marginTop = '18px';
    const close = document.createElement('button');
    close.className = 'btn primary';
    close.textContent = 'Close';
    close.addEventListener('click', () => options.onClose());
    row.appendChild(close);
    panel.appendChild(row);

    this.root.appendChild(panel);
    document.body.appendChild(this.root);
    this.refresh();
  }

  refresh(): void {
    this.renderSide(this.chestElement, this.options.chest, (i) => this.moveToInventory(i));
    this.renderSide(this.inventoryElement, this.options.inventory.slots, (i) => this.moveToChest(i));
  }

  private renderSide(
    el: HTMLDivElement,
    slots: (ItemStack | null)[],
    onClick: (index: number) => void,
  ): void {
    el.innerHTML = '';
    slots.forEach((stack, index) => {
      const cell = document.createElement('div');
      cell.className = 'slot';
      if (stack) {
        const label = document.createElement('span');
        label.className = 'count';
        label.style.cssText = 'position:static;font-size:10px;color:var(--muted)';
        label.textContent = stack.count > 1 ? `${stack.item.replace(/_/g, ' ')} ×${stack.count}` : stack.item.replace(/_/g, ' ');
        cell.appendChild(label);
        cell.addEventListener('click', () => onClick(index));
      }
      el.appendChild(cell);
    });
  }

  /** Move a stack into slots, returning how many did not fit. */
  private insertInto(slots: (ItemStack | null)[], stack: ItemStack): number {
    let remaining = stack.count;
    for (let i = 0; i < slots.length && remaining > 0; i++) {
      const s = slots[i];
      if (!s || s.item !== stack.item) continue;
      const moved = Math.min(MAX_STACK - s.count, remaining);
      if (moved <= 0) continue;
      s.count += moved;
      remaining -= moved;
    }
    for (let i = 0; i < slots.length && remaining > 0; i++) {
      if (slots[i]) continue;
      const moved = Math.min(MAX_STACK, remaining);
      slots[i] = { ...stack, count: moved };
      remaining -= moved;
    }
    return remaining;
  }

  private moveToInventory(index: number): void {
    const stack = this.options.chest[index];
    if (!stack) return;
    const left = this.insertInto(this.options.inventory.slots, stack);
    this.options.chest[index] = left > 0 ? { ...stack, count: left } : null;
    this.refresh();
  }

  private moveToChest(index: number): void {
    const stack = this.options.inventory.slots[index];
    if (!stack) return;
    const left = this.insertInto(this.options.chest, stack);
    this.options.inventory.slots[index] = left > 0 ? { ...stack, count: left } : null;
    this.refresh();
  }

  close(): void {
    this.root.remove();
  }

  get visible(): boolean {
    return this.root.classList.contains('visible');
  }
}

export { CHEST_SLOTS };
