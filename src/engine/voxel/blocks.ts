/**
 * Block identity and lookup.
 *
 * Internally the engine stores blocks as numeric ids (uint16). The mapping
 * between names and ids comes from the content registry at boot, so the
 * engine never hard-codes block names outside the world generator.
 */

/** The id reserved for air. Always 0. */
export const AIR = 0;

/** The name of the air block. */
export const AIR_NAME = 'air';

/**
 * Maps between numeric block ids and block names.
 * The content layer implements this via `BLOCK_INDEX`.
 */
export interface BlockLookup {
  /** Numeric id -> block name. */
  name(id: number): string;
  /** Block name -> numeric id. */
  id(name: string): number;
  /** Whether the name exists. */
  has(name: string): boolean;
  /** Total number of block ids. */
  readonly count: number;
}

/**
 * A minimal lookup used before the content registry is available, and by unit
 * tests that do not want to load the whole content set.
 */
export class SimpleBlockLookup implements BlockLookup {
  private readonly ids = new Map<string, number>();
  private readonly names: string[] = [AIR_NAME];

  constructor(names: readonly string[] = []) {
    for (const name of names) {
      if (name === AIR_NAME || this.ids.has(name)) continue;
      this.ids.set(name, this.names.length);
      this.names.push(name);
    }
  }

  name(id: number): string {
    return this.names[id] ?? AIR_NAME;
  }

  id(name: string): number {
    return this.ids.get(name) ?? 0;
  }

  has(name: string): boolean {
    return this.ids.has(name);
  }

  get count(): number {
    return this.names.length;
  }
}
