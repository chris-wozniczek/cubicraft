/**
 * Generic data registry with tag support and startup validation.
 *
 * Content is data, not code. Every block, item, mob, biome and enchantment is
 * registered here at boot; the registry freezes afterwards so that a typo in
 * one content file cannot silently become a missing block at runtime.
 */

export interface Tagged {
  id: string;
  tags?: string[];
}

export class Registry<T extends { id: string }> {
  private readonly items = new Map<string, T>();
  private readonly tagIndex = new Map<string, Set<string>>();
  private frozen = false;

  constructor(readonly name: string) {}

  register(def: T): T {
    if (this.frozen) {
      throw new Error(`[registry:${this.name}] "${def.id}" registered after freeze()`);
    }
    if (this.items.has(def.id)) {
      throw new Error(`[registry:${this.name}] duplicate id "${def.id}"`);
    }
    this.items.set(def.id, def);
    const tags = (def as Tagged).tags ?? [];
    for (const tag of tags) {
      let set = this.tagIndex.get(tag);
      if (!set) {
        set = new Set();
        this.tagIndex.set(tag, set);
      }
      set.add(def.id);
    }
    return def;
  }

  registerAll(defs: readonly T[]): void {
    for (const def of defs) this.register(def);
  }

  get(id: string): T | undefined {
    return this.items.get(id);
  }

  /** Get or throw — used where a missing id is a programming error. */
  require(id: string): T {
    const def = this.items.get(id);
    if (!def) throw new Error(`[registry:${this.name}] missing "${id}"`);
    return def;
  }

  has(id: string): boolean {
    return this.items.has(id);
  }

  get size(): number {
    return this.items.size;
  }

  all(): readonly T[] {
    return [...this.items.values()];
  }

  ids(): string[] {
    return [...this.items.keys()];
  }

  byTag(tag: string): T[] {
    const set = this.tagIndex.get(tag);
    if (!set) return [];
    const out: T[] = [];
    for (const id of set) {
      const def = this.items.get(id);
      if (def) out.push(def);
    }
    return out;
  }

  hasTag(tag: string): boolean {
    return this.tagIndex.has(tag);
  }

  /** True when the id exists or any of its tags match. */
  matches(idOrTag: string): boolean {
    if (this.items.has(idOrTag)) return true;
    return this.tagIndex.has(idOrTag);
  }

  /** Resolve an id or `#tag` to a list of definitions. */
  resolve(idOrTag: string): T[] {
    if (idOrTag.startsWith('#')) return this.byTag(idOrTag.slice(1));
    const def = this.items.get(idOrTag);
    return def ? [def] : [];
  }

  freeze(): void {
    this.frozen = true;
  }

  isFrozen(): boolean {
    return this.frozen;
  }
}

export interface ValidationIssue {
  severity: 'error' | 'warning';
  registry: string;
  message: string;
}

/** Collects validation issues so the boot sequence can report them all at once. */
export class ValidationReport {
  readonly issues: ValidationIssue[] = [];

  error(registry: string, message: string): void {
    this.issues.push({ severity: 'error', registry, message });
  }

  warn(registry: string, message: string): void {
    this.issues.push({ severity: 'warning', registry, message });
  }

  get errors(): ValidationIssue[] {
    return this.issues.filter((i) => i.severity === 'error');
  }

  get warnings(): ValidationIssue[] {
    return this.issues.filter((i) => i.severity === 'warning');
  }

  get ok(): boolean {
    return this.errors.length === 0;
  }

  format(): string {
    return this.issues
      .map((i) => `[${i.severity.toUpperCase()}] ${i.registry}: ${i.message}`)
      .join('\n');
  }
}
