/**
 * The furnace screen.
 *
 * Click something smeltable in your inventory to load it into the furnace —
 * it burns one fuel item and delivers the result a few seconds later, even
 * after the panel is closed.
 */

import type { Inventory } from '../game/inventory';
import type { Furnaces, FurnaceJob } from '../game/furnace';

export interface FurnaceUiOptions {
  inventory: Inventory;
  furnaces: Furnaces;
  x: number;
  y: number;
  z: number;
  onSmelt: (x: number, y: number, z: number, input: string) => boolean;
  onClose: () => void;
}

export class FurnaceUi {
  readonly root: HTMLDivElement;
  private readonly listElement = document.createElement('div');
  private readonly infoElement = document.createElement('p');
  private readonly progressElement = document.createElement('div');
  private readonly timer: number;

  constructor(private readonly options: FurnaceUiOptions) {
    this.root = document.createElement('div');
    this.root.className = 'screen visible';
    this.root.id = 'furnace-menu';

    const panel = document.createElement('div');
    panel.className = 'panel glass';
    panel.style.width = 'min(560px, 94vw)';

    const title = document.createElement('h1');
    title.textContent = 'Furnace';
    panel.appendChild(title);

    this.infoElement.className = 'sub';
    panel.appendChild(this.infoElement);

    this.progressElement.style.cssText = 'height:8px;border-radius:4px;background:var(--stroke);margin:10px 0;overflow:hidden';
    panel.appendChild(this.progressElement);

    this.listElement.style.cssText = 'display:grid;grid-template-columns:repeat(9,58px);gap:6px;justify-content:center;margin:14px 0';
    panel.appendChild(this.listElement);

    const row = document.createElement('div');
    row.className = 'row';
    const close = document.createElement('button');
    close.className = 'btn primary';
    close.textContent = 'Close';
    close.addEventListener('click', () => options.onClose());
    row.appendChild(close);
    panel.appendChild(row);

    this.root.appendChild(panel);
    document.body.appendChild(this.root);
    this.refresh();

    // Keep the progress bar live while the panel is open.
    this.timer = window.setInterval(() => this.refresh(), 250);
  }

  refresh(): void {
    const { inventory, furnaces, x, y, z } = this.options;
    const job = furnaces.jobAt(x, y, z);

    const fuel = inventory.slots.reduce((n, s) => n + (s && furnaces.isFuel(s.item) ? s.count : 0), 0);
    this.infoElement.textContent = job
      ? `Smelting ${job.input.replace(/_/g, ' ')}…`
      : `Click something to smelt it — ${fuel} fuel in your inventory`;

    const inner = document.createElement('div');
    inner.style.cssText = `height:100%;width:${job ? (job.progress / job.total) * 100 : 0}%;background:var(--accent)`;
    this.progressElement.innerHTML = '';
    this.progressElement.appendChild(inner);

    this.listElement.innerHTML = '';
    inventory.slots.forEach((stack, index) => {
      const cell = document.createElement('div');
      cell.className = 'slot';
      if (stack) {
        const smeltable = furnaces.resultFor(stack.item) !== undefined;
        const label = document.createElement('span');
        label.className = 'count';
        label.style.cssText = 'position:static;font-size:10px;color:var(--muted)';
        label.textContent = stack.item.replace(/_/g, ' ');
        cell.appendChild(label);
        cell.title = smeltable ? `Smelt ${stack.item.replace(/_/g, ' ')}` : stack.item.replace(/_/g, ' ');
        if (smeltable) {
          cell.style.borderColor = 'var(--accent)';
          if (!job) cell.addEventListener('click', () => this.smelt(index));
        } else {
          cell.style.opacity = '0.4';
        }
      }
      this.listElement.appendChild(cell);
    });
  }

  private smelt(index: number): void {
    const { inventory } = this.options;
    const stack = inventory.slots[index];
    if (!stack || this.options.furnaces.resultFor(stack.item) === undefined) return;
    // Consume one input and one unit of fuel.
    const fuelIndex = inventory.slots.findIndex((s) => s && this.options.furnaces.isFuel(s.item));
    if (fuelIndex < 0) {
      this.infoElement.textContent = 'No fuel! Coal, logs or planks all burn.';
      return;
    }
    if (this.options.onSmelt(this.options.x, this.options.y, this.options.z, stack.item)) {
      inventory.slots[index]!.count -= 1;
      if (inventory.slots[index]!.count <= 0) inventory.slots[index] = null;
      inventory.slots[fuelIndex]!.count -= 1;
      if (inventory.slots[fuelIndex]!.count <= 0) inventory.slots[fuelIndex] = null;
    }
    this.refresh();
  }

  close(): void {
    window.clearInterval(this.timer);
    this.root.remove();
  }

  get visible(): boolean {
    return this.root.classList.contains('visible');
  }
}

export type { FurnaceJob };
