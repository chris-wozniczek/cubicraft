/**
 * Loot helpers shared by block drops and mob drops.
 *
 * Every helper returns plain `DropTable` records so the engine never needs to
 * know which family produced the drop.
 */

import type { DropTable, ToolKind } from '../core/types';

export interface DropOptions {
  /** Only drops when the correct tool is used. */
  requiresTool?: boolean;
  /** Requires silk touch to drop the block itself. */
  silkTouch?: boolean;
  /** Only drops when mined by a tool of this kind. */
  tool?: ToolKind;
  /** Fortune adds this many to the count per level. */
  fortuneMax?: number;
}

/** A drop with an explicit count range. */
export function drop(item: string, min = 1, max = min, options: DropOptions = {}): DropTable {
  const table: DropTable = { item, min, max };
  if (options.requiresTool !== undefined) table.requiresTool = options.requiresTool;
  if (options.silkTouch !== undefined) table.silkTouch = options.silkTouch;
  if (options.tool !== undefined) table.tool = options.tool;
  if (options.fortuneMax !== undefined) table.fortuneMax = options.fortuneMax;
  return table;
}

/** The block drops itself. */
export function selfDrop(id: string, options: DropOptions = {}): DropTable {
  return drop(id, 1, 1, options);
}

/**
 * The block drops itself plus a secondary item (ore -> ingot, crop -> seed).
 * The secondary drop is gated behind the correct tool where that matters.
 */
export function primaryWithExtra(
  id: string,
  extraItem: string,
  min = 1,
  max = min,
  options: DropOptions = {},
): DropTable[] {
  return [selfDrop(id, options), drop(extraItem, min, max, { requiresTool: true })];
}

/**
 * Silk touch keeps the block, otherwise the block breaks into something else.
 * Both variants are listed; the engine picks by harvesting mode.
 */
export function silkOrDrop(blockId: string, brokenItem: string, min = 1, max = min): DropTable[] {
  return [
    drop(blockId, 1, 1, { silkTouch: true }),
    drop(brokenItem, min, max),
  ];
}

/** A mob drop. */
export function mobDrop(item: string, min = 1, max = min): DropTable {
  return drop(item, min, max);
}

/**
 * A conditional mob drop: `min` 0 means "not always".
 * The engine rolls between min and max inclusive, so 0..1 is a coin flip.
 */
export function rareDrop(item: string, chance = 0.5): DropTable {
  return drop(item, 0, 1);
}

/** A fortune-affected drop. */
export function fortuneDrop(item: string, min = 1, max = min, fortuneMax = 0): DropTable {
  return drop(item, min, max, { fortuneMax });
}
