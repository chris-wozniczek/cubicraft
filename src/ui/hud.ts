/**
 * The heads-up display: crosshair, hotbar, vitals, debug readout, chat and
 * toast messages.
 */

import { HOTBAR_SIZE } from '../game/inventory';

export interface HudCallbacks {
  onSelectSlot: (index: number) => void;
  onSelectHeld: () => void;
}

export class Hud {
  readonly root: HTMLDivElement;
  private readonly hotbar: HTMLDivElement;
  private readonly stats: HTMLDivElement;
  private readonly xpbar: HTMLSpanElement;
  private readonly debug: HTMLDivElement;
  private readonly toast: HTMLDivElement;
  private readonly chatlog: HTMLDivElement;
  private readonly hurt: HTMLDivElement;
  private readonly slots: HTMLDivElement[] = [];
  private debugVisible = true;

  constructor(private readonly callbacks: HudCallbacks) {
    this.root = document.createElement('div');
    this.root.id = 'hud';

    const crosshair = document.createElement('div');
    crosshair.id = 'crosshair';

    this.hotbar = document.createElement('div');
    this.hotbar.id = 'hotbar';
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      const index = i;
      slot.addEventListener('click', () => this.callbacks.onSelectSlot(index));
      slot.addEventListener('dblclick', () => this.callbacks.onSelectHeld());
      this.hotbar.appendChild(slot);
      this.slots.push(slot);
    }

    this.stats = document.createElement('div');
    this.stats.id = 'stats';

    const xp = document.createElement('div');
    xp.id = 'xpbar';
    this.xpbar = document.createElement('span');
    xp.appendChild(this.xpbar);

    this.debug = document.createElement('div');
    this.debug.id = 'debug';
    this.debug.className = 'glass';

    this.toast = document.createElement('div');
    this.toast.id = 'toast';

    this.chatlog = document.createElement('div');
    this.chatlog.id = 'chatlog';

    this.hurt = document.createElement('div');
    this.hurt.id = 'hurt';

    this.root.append(crosshair, this.hotbar, this.stats, xp, this.debug, this.toast, this.chatlog);
    document.body.appendChild(this.hurt);
    document.body.appendChild(this.root);
  }

  /** Redraw the hotbar from the inventory contents. */
  updateHotbar(slots: ({ item: string; count: number; durability?: number } | null)[], selected: number): void {
    for (let i = 0; i < this.slots.length; i++) {
      const element = this.slots[i];
      const stack = slots[i];
      element.classList.toggle('selected', i === selected);

      const existingIcon = element.querySelector('canvas, img');
      const existingCount = element.querySelector('.count');
      const existingBar = element.querySelector('.durability');

      if (!stack) {
        existingIcon?.remove();
        existingCount?.remove();
        existingBar?.remove();
        continue;
      }

      if (!existingIcon) {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        canvas.title = stack.item;
        element.prepend(canvas);
      }
      const canvas = element.querySelector('canvas') as HTMLCanvasElement | null;
      if (canvas) {
        this.paintIcon(canvas, stack.item);
        canvas.title = stack.item;
      }

      if (!existingCount) {
        const count = document.createElement('span');
        count.className = 'count';
        element.appendChild(count);
      }
      const countEl = element.querySelector('.count') as HTMLElement;
      countEl.textContent = stack.count > 1 ? String(stack.count) : '';
      countEl.style.display = stack.count > 1 ? 'block' : 'none';

      if (stack.durability !== undefined) {
        if (!existingBar) {
          const bar = document.createElement('div');
          bar.className = 'durability';
          bar.appendChild(document.createElement('span'));
          element.appendChild(bar);
        }
        const fill = element.querySelector('.durability span') as HTMLElement;
        fill.style.width = `${Math.max(0, Math.min(100, (stack.durability ?? 0) * 100))}%`;
      } else {
        existingBar?.remove();
      }
    }
  }

  /** A simple deterministic icon so every item is visually distinct. */
  private paintIcon(canvas: HTMLCanvasElement, item: string): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const seed = item.split('').reduce((acc, c) => (acc * 33 + c.charCodeAt(0)) >>> 0, 5381);
    const hue = seed % 360;
    ctx.clearRect(0, 0, 32, 32);
    ctx.fillStyle = `hsl(${hue}, 42%, 52%)`;
    ctx.fillRect(2, 2, 28, 28);
    ctx.fillStyle = `hsla(${hue}, 42%, 68%, 0.85)`;
    ctx.fillRect(4, 4, 24, 10);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(4, 26, 24, 4);
  }

  /** Update the health, hunger and experience bars. */
  updateVitals(health: number, hunger: number, xp: number, xpToNext: number, level: number): void {
    this.stats.innerHTML = '';

    const hp = document.createElement('div');
    hp.className = 'bar';
    for (let i = 0; i < 10; i++) {
      const pip = document.createElement('span');
      pip.className = 'pip hp';
      if (health <= i) pip.style.background = 'rgba(255,255,255,0.14)';
      hp.appendChild(pip);
    }

    const food = document.createElement('div');
    food.className = 'bar';
    for (let i = 0; i < 10; i++) {
      const pip = document.createElement('span');
      pip.className = 'pip food';
      if (hunger <= i) pip.style.background = 'rgba(255,255,255,0.14)';
      food.appendChild(pip);
    }

    const xpBar = document.createElement('div');
    xpBar.className = 'bar';
    const xpPip = document.createElement('span');
    xpPip.className = 'pip xp';
    xpBar.appendChild(xpPip);

    const levelLabel = document.createElement('span');
    levelLabel.textContent = String(level);
    levelLabel.style.color = 'var(--accent-warm)';

    this.stats.append(hp, food, xpBar, levelLabel);
    this.xpbar.style.width = `${Math.max(0, Math.min(100, (xp / Math.max(1, xpToNext)) * 100))}%`;
  }

  setDebug(text: string): void {
    this.debug.textContent = text;
    this.debug.style.display = this.debugVisible ? 'block' : 'none';
  }

  toggleDebug(): void {
    this.debugVisible = !this.debugVisible;
  }

  showToast(message: string, ms = 2600): void {
    const item = document.createElement('div');
    item.className = 'toast-item glass';
    item.textContent = message;
    this.toast.appendChild(item);
    setTimeout(() => item.remove(), ms);
  }

  addChat(from: string, text: string): void {
    const line = document.createElement('div');
    line.className = 'chat-line';
    line.innerHTML = `<strong>${escapeHtml(from)}</strong> ${escapeHtml(text)}`;
    this.chatlog.appendChild(line);
    while (this.chatlog.childElementCount > 8) this.chatlog.firstElementChild?.remove();
    setTimeout(() => line.remove(), 15000);
  }

  setHurt(amount: number): void {
    this.hurt.style.opacity = String(Math.min(0.85, amount));
  }

  setVisible(visible: boolean): void {
    this.root.style.display = visible ? 'block' : 'none';
    this.hurt.style.display = visible ? 'block' : 'none';
  }

  dispose(): void {
    this.root.remove();
    this.hurt.remove();
  }
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}
