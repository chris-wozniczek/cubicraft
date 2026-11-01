/**
 * Deterministic RNG.
 *
 * Every system that needs randomness takes a seeded stream so that the same
 * world seed always produces the same terrain, the same loot rolls and the
 * same mob decisions on every peer.
 */

export type Rng = () => number;

/** Hash a string into a 32-bit unsigned integer. */
export function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Mix a 32-bit integer — used to derive independent sub-streams. */
export function mix32(x: number): number {
  let z = (x + 0x9e3779b9) >>> 0;
  z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
  z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
  return (z ^ (z >>> 15)) >>> 0;
}

/** Mulberry32 — small, fast, good enough distribution for world generation. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A named random stream derived from a root seed. */
export class SeededRng {
  readonly seed: number;
  private next: Rng;

  constructor(seed: number | string, private readonly label = 'default') {
    this.seed = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
    this.next = mulberry32(mix32(this.seed ^ hashString(this.label)));
  }

  /** Uniform float in [0, 1). */
  float(): number {
    return this.next();
  }

  /** Uniform float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Uniform integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    if (max < min) return min;
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** True with the given probability. */
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /** Pick one element of an array. */
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Fisher–Yates shuffle in place. */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** Derive an independent child stream. */
  fork(label: string): SeededRng {
    return new SeededRng(mix32(this.seed ^ hashString(label)), label);
  }

  /** A stream keyed by integer coordinates — deterministic per position. */
  static forPosition(seed: number, x: number, z: number): SeededRng {
    return new SeededRng(mix32(seed ^ mix32((x & 0xffff) << 16 | (z & 0xffff))), `pos:${x},${z}`);
  }
}

/** The global world seed used by the game. */
export const WORLD_SEED = 20261101;
