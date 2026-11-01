/**
 * Furnaces — smelt ores and food into their cooked results.
 *
 * Each placed furnace is its own little machine: it keeps working while the
 * player walks away, and reports the finished item back through a callback.
 */

import type { RecipeDef } from '../core/types';

export interface FurnaceJob {
  x: number;
  y: number;
  z: number;
  /** Item id being smelted. */
  input: string;
  /** Item id produced. */
  output: string;
  /** Seconds of smelting done. */
  progress: number;
  /** Seconds a smelt takes. */
  total: number;
}

const SMELT_SECONDS = 6;

export class Furnaces {
  private readonly jobs = new Map<string, FurnaceJob>();
  private readonly smeltable = new Map<string, string>();

  constructor(recipes: readonly RecipeDef[]) {
    for (const recipe of recipes) {
      const smeltFamily = recipe.shape === 'smelting' || recipe.shape === 'blasting' || recipe.shape === 'smoking' || recipe.tags?.includes('smelting');
      if (!smeltFamily) continue;
      const input = recipe.ingredients?.[0] ?? recipe.pattern?.flatMap((row) => row.split(' ')).find((cell) => cell && !cell.startsWith('#'));
      if (input) this.smeltable.set(input, recipe.result);
    }
  }

  /** Result item id for an input, or undefined when it can't be smelted. */
  resultFor(item: string): string | undefined {
    return this.smeltable.get(item);
  }

  /** Anything that burns — one item powers one smelt. */
  isFuel(item: string): boolean {
    return /(_log|_stem|_planks|_wood)$/.test(item) || item === 'coal' || item === 'charcoal' || item === 'coal_block' || item === 'blaze_rod' || item === 'stick' || item === 'bamboo';
  }

  jobAt(x: number, y: number, z: number): FurnaceJob | undefined {
    return this.jobs.get(`${x},${y},${z}`);
  }

  /** Start smelting `input` in the furnace at this position. */
  start(x: number, y: number, z: number, input: string): boolean {
    const key = `${x},${y},${z}`;
    if (this.jobs.has(key)) return false;
    const output = this.smeltable.get(input);
    if (!output) return false;
    this.jobs.set(key, { x, y, z, input, output, progress: 0, total: SMELT_SECONDS });
    return true;
  }

  /**
   * Advance every running furnace. `onDone` receives the finished item id
   * and the furnace position.
   */
  tick(dt: number, onDone: (job: FurnaceJob) => void): void {
    for (const [key, job] of this.jobs) {
      job.progress += dt;
      if (job.progress >= job.total) {
        this.jobs.delete(key);
        onDone(job);
      }
    }
  }
}
