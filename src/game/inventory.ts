/**
 * The player inventory and hotbar.
 */

export interface ItemStack {
  item: string;
  count: number;
  /** Remaining durability for tools and armour. */
  durability?: number;
  /** Enchantments applied to the item. */
  enchantments?: Record<string, number>;
}

export const HOTBAR_SIZE = 9;
export const INVENTORY_SIZE = 36;

export class Inventory {
  slots: (ItemStack | null)[] = new Array(INVENTORY_SIZE).fill(null);
  /** Equipped armour: [head, chest, legs, feet]. */
  armor: (ItemStack | null)[] = [null, null, null, null];
  /** The hotbar slot that is currently held, 0..8. */
  selected = 0;

  constructor(readonly maxStackSize: (item: string) => number = () => 64) {}

  get held(): ItemStack | null {
    return this.slots[this.selected];
  }

  /** Add items, returning how many could not fit. */
  add(item: string, count = 1, durability?: number): number {
    const max = this.maxStackSize(item);
    let remaining = count;

    // Top up existing stacks first.
    for (let i = 0; i < this.slots.length && remaining > 0; i++) {
      const stack = this.slots[i];
      if (!stack || stack.item !== item) continue;
      if (durability !== undefined && stack.durability !== durability) continue;
      const space = max - stack.count;
      if (space <= 0) continue;
      const moved = Math.min(space, remaining);
      stack.count += moved;
      remaining -= moved;
    }

    // Then fill empty slots.
    for (let i = 0; i < this.slots.length && remaining > 0; i++) {
      if (this.slots[i]) continue;
      const moved = Math.min(max, remaining);
      this.slots[i] = { item, count: moved, ...(durability !== undefined ? { durability } : {}) };
      remaining -= moved;
    }

    return remaining;
  }

  /** Remove `count` of an item. Returns how many were actually removed. */
  remove(item: string, count = 1): number {
    let remaining = count;
    for (let i = this.slots.length - 1; i >= 0 && remaining > 0; i--) {
      const stack = this.slots[i];
      if (!stack || stack.item !== item) continue;
      const taken = Math.min(stack.count, remaining);
      stack.count -= taken;
      remaining -= taken;
      if (stack.count <= 0) this.slots[i] = null;
    }
    return count - remaining;
  }

  count(item: string): number {
    let total = 0;
    for (const stack of this.slots) {
      if (stack?.item === item) total += stack.count;
    }
    return total;
  }

  has(item: string, count = 1): boolean {
    return this.count(item) >= count;
  }

  /** Consume one of the held item (placing a block, eating). */
  consumeHeld(count = 1): boolean {
    const stack = this.held;
    if (!stack || stack.count < count) return false;
    stack.count -= count;
    if (stack.count <= 0) this.slots[this.selected] = null;
    return true;
  }

  /** Apply tool wear. Returns true when the tool broke. */
  damageHeld(amount = 1): boolean {
    const stack = this.held;
    if (!stack || stack.durability === undefined) return false;
    stack.durability -= amount;
    if (stack.durability <= 0) {
      this.slots[this.selected] = null;
      return true;
    }
    return false;
  }

  setSelected(index: number): void {
    this.selected = ((index % HOTBAR_SIZE) + HOTBAR_SIZE) % HOTBAR_SIZE;
  }

  /** Swap two slots. */
  swap(a: number, b: number): void {
    const temp = this.slots[a];
    this.slots[a] = this.slots[b];
    this.slots[b] = temp;
  }

  /** Serialise for the network or a save file. */
  toJSON(): { slots: (ItemStack | null)[]; armor: (ItemStack | null)[]; selected: number } {
    return {
      slots: this.slots.map((s) => (s ? { ...s } : null)),
      armor: this.armor.map((s) => (s ? { ...s } : null)),
      selected: this.selected,
    };
  }

  fromJSON(data: { slots: (ItemStack | null)[]; armor?: (ItemStack | null)[]; selected: number }): void {
    this.slots = new Array(INVENTORY_SIZE).fill(null);
    data.slots.slice(0, INVENTORY_SIZE).forEach((stack, i) => {
      this.slots[i] = stack ? { ...stack } : null;
    });
    this.armor = [null, null, null, null];
    data.armor?.slice(0, 4).forEach((stack, i) => {
      this.armor[i] = stack ? { ...stack } : null;
    });
    this.selected = data.selected ?? 0;
  }
}
