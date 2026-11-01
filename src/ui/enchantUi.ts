/**
 * The enchanting table screen.
 *
 * Shows every table enchantment that fits the held item. Each click spends
 * experience levels and one lapis lazuli to raise the enchantment by a
 * level, exactly like the kids expect from Minecraft.
 */

import type { Inventory } from '../game/inventory';
import type { EnchantmentDef, ItemDef } from '../core/types';
import type { Survival } from '../game/survival';
import { sfx } from '../audio/sfx';

export interface EnchantUiOptions {
  inventory: Inventory;
  survival: Survival;
  enchantments: readonly EnchantmentDef[];
  lookupItem: (id: string) => ItemDef | undefined;
  onClose: () => void;
}

export class EnchantUi {
  readonly root: HTMLDivElement;
  private readonly listElement = document.createElement('div');
  private readonly infoElement = document.createElement('p');

  constructor(private readonly options: EnchantUiOptions) {
    this.root = document.createElement('div');
    this.root.className = 'screen visible';
    this.root.id = 'enchant-menu';

    const panel = document.createElement('div');
    panel.className = 'panel glass';
    panel.style.width = 'min(520px, 94vw)';

    const title = document.createElement('h1');
    title.textContent = 'Enchanting Table';
    panel.appendChild(title);

    this.infoElement.className = 'sub';
    panel.appendChild(this.infoElement);

    this.listElement.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin:14px 0';
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
  }

  /** Applicable enchantments for the held item, honouring conflicts. */
  private applicable(): EnchantmentDef[] {
    const held = this.options.inventory.held;
    if (!held) return [];
    const def = this.options.lookupItem(held.item);
    if (!def) return [];
    const applied = Object.keys(held.enchantments ?? {});
    return this.options.enchantments.filter((e) => {
      if (e.fromTable === false) return false;
      if (!e.appliesTo.some((tag) => def.tags.includes(tag))) return false;
      if (applied.includes(e.id) && (held.enchantments?.[e.id] ?? 0) >= e.maxLevel) return false;
      return !e.conflicts.some((c) => applied.includes(c));
    });
  }

  refresh(): void {
    const { inventory, survival } = this.options;
    const held = inventory.held;
    this.listElement.innerHTML = '';

    if (!held) {
      this.infoElement.textContent = 'Hold a tool, weapon or armour piece, then pick an enchantment.';
      return;
    }
    const lapis = inventory.count('lapis_lazuli');
    this.infoElement.textContent = `${held.item.replace(/_/g, ' ')} — level ${survival.level}, ${lapis} lapis`;

    const options = this.applicable();
    if (options.length === 0) {
      this.infoElement.textContent += ' — nothing here can enchant this item';
      return;
    }

    for (const ench of options) {
      const current = held.enchantments?.[ench.id] ?? 0;
      const cost = current + 1;
      const button = document.createElement('button');
      button.className = 'btn';
      button.style.cssText = 'display:flex;justify-content:space-between;align-items:center';
      const name = document.createElement('span');
      name.textContent = `${ench.displayName} → level ${current + 1}`;
      const price = document.createElement('span');
      price.textContent = `${cost} levels + 1 lapis`;
      price.style.color = 'var(--muted)';
      button.append(name, price);
      const afford = survival.level >= cost && lapis >= 1;
      button.disabled = !afford;
      if (!afford) button.style.opacity = '0.45';
      button.addEventListener('click', () => this.apply(ench, cost));
      this.listElement.appendChild(button);
    }
  }

  private apply(ench: EnchantmentDef, cost: number): void {
    const { inventory, survival } = this.options;
    const held = inventory.held;
    if (!held) return;
    if (survival.level < cost || inventory.count('lapis_lazuli') < 1) return;
    survival.level -= cost;
    survival.xpToNext = Math.floor(7 + survival.level * 2);
    inventory.remove('lapis_lazuli', 1);
    held.enchantments = { ...(held.enchantments ?? {}), [ench.id]: (held.enchantments?.[ench.id] ?? 0) + 1 };
    sfx.play('levelup');
    this.refresh();
  }

  close(): void {
    this.root.remove();
  }

  get visible(): boolean {
    return this.root.classList.contains('visible');
  }
}
