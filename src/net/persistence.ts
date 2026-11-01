/**
 * Cubicraft — world persistence.
 *
 * The host's world lives in memory; this module keeps a durable copy in
 * IndexedDB.  Only the blocks that were actually edited are stored, as a
 * palette + run-length diff per chunk, so a heavily explored world still
 * saves to a few kilobytes.
 *
 * The same serialised form ("World Passport") can be pushed over the peer
 * channel so that any device can take over as host.
 */

import { log } from '../core/log';
import { rleDecode, rleEncode } from './codec';
import type { AvatarSpec, GameMode } from '../core/types';

const DB_NAME = 'cubicraft';
const DB_VERSION = 1;
const WORLD_STORE = 'worlds';
const CHUNK_DIFF_STORE = 'chunkDiffs';
const WORLD_KEY = 'main';

const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder();

/** A player's persisted state. */
export interface PlayerSave {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  health: number;
  hunger: number;
  saturation: number;
  xp: number;
  level: number;
  mode: GameMode;
  dimension: string;
  avatar: AvatarSpec;
}

/**
 * The edits made to one chunk.
 *
 * `pal` is the palette of block ids and `blocks` is the flat run list
 * `[length, paletteIndex, ...]` describing the edited blocks.  `positions`
 * optionally lists the local block indices in the same order, so the diff can
 * be replayed without the engine keeping a side list.
 */
export interface ChunkDiff {
  cx: number;
  cz: number;
  dimension: string;
  blocks: number[];
  pal: number[];
  positions?: number[];
}

/** The complete saved world. */
export interface WorldSave {
  version: number;
  seed: number;
  timeOfDay: number;
  dayLengthSeconds: number;
  weather: number;
  dimension: string;
  players: PlayerSave[];
  diffs: ChunkDiff[];
}

// ---------------------------------------------------------------------------
// IndexedDB helpers
// ---------------------------------------------------------------------------

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('persistence: IndexedDB request failed'));
  });
}

function transactionToPromise(tx: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(tx.error ?? new Error('persistence: IndexedDB transaction failed'));
    tx.onabort = () =>
      reject(tx.error ?? new Error('persistence: IndexedDB transaction aborted'));
  });
}

/** True when this environment can store data. */
export function isPersistenceAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

// ---------------------------------------------------------------------------
// WorldStore
// ---------------------------------------------------------------------------

/** Durable storage for the world and its chunk diffs. */
export class WorldStore {
  private db: IDBDatabase | null = null;
  private opening: Promise<IDBDatabase> | null = null;

  /** Open (and if needed create) the database. */
  async open(): Promise<void> {
    await this.database();
  }

  private async database(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.opening) return this.opening;
    if (!isPersistenceAvailable()) {
      throw new Error('persistence: IndexedDB is not available in this browser');
    }
    this.opening = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(WORLD_STORE)) {
          db.createObjectStore(WORLD_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(CHUNK_DIFF_STORE)) {
          db.createObjectStore(CHUNK_DIFF_STORE, { keyPath: ['cx', 'cz', 'dimension'] });
        }
      };
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      request.onerror = () =>
        reject(request.error ?? new Error('persistence: could not open IndexedDB'));
      request.onblocked = () =>
        reject(new Error('persistence: IndexedDB upgrade blocked by another tab'));
    });
    try {
      return await this.opening;
    } catch (err) {
      this.opening = null;
      throw err;
    }
  }

  /**
   * Load the saved world.
   *
   * When a seed is given and it does not match the stored world, the stored
   * world is ignored (the caller then generates a fresh one).
   */
  async loadWorld(seed?: number): Promise<WorldSave | null> {
    const db = await this.database();
    const tx = db.transaction(WORLD_STORE, 'readonly');
    const record = await requestToPromise(
      tx.objectStore(WORLD_STORE).get(WORLD_KEY) as IDBRequest<
        (WorldSave & { id: string }) | undefined
      >,
    );
    if (!record) return null;
    if (seed !== undefined && record.seed !== seed) return null;
    return {
      version: record.version,
      seed: record.seed,
      timeOfDay: record.timeOfDay,
      dayLengthSeconds: record.dayLengthSeconds,
      weather: record.weather,
      dimension: record.dimension,
      players: record.players ?? [],
      diffs: record.diffs ?? [],
    };
  }

  /** Write the world, replacing any previous copy. */
  async saveWorld(state: WorldSave): Promise<void> {
    const db = await this.database();
    const tx = db.transaction(WORLD_STORE, 'readwrite');
    tx.objectStore(WORLD_STORE).put({ ...state, id: WORLD_KEY });
    await transactionToPromise(tx);
  }

  /**
   * Add (or merge into) the edits of one chunk.
   *
   * Merging keeps the run list valid: the existing and new values are decoded,
   * concatenated and re-encoded against a combined palette.
   */
  async appendChunkDiff(cx: number, cz: number, diff: ChunkDiff): Promise<void> {
    const db = await this.database();
    const tx = db.transaction(CHUNK_DIFF_STORE, 'readwrite');
    const store = tx.objectStore(CHUNK_DIFF_STORE);
    const existing = await requestToPromise(
      store.get([cx, cz, diff.dimension]) as IDBRequest<ChunkDiff | undefined>,
    );

    let merged: ChunkDiff;
    if (!existing) {
      merged = { ...diff, cx, cz };
    } else {
      const existingValues = rleDecode(existing.pal, existing.blocks);
      const newValues = rleDecode(diff.pal, diff.blocks);
      const combined = new Uint16Array(existingValues.length + newValues.length);
      combined.set(existingValues, 0);
      combined.set(newValues, existingValues.length);
      const encoded = rleEncode(combined);
      merged = {
        cx,
        cz,
        dimension: diff.dimension,
        blocks: encoded.runs,
        pal: encoded.palette,
      };
      if (existing.positions || diff.positions) {
        merged.positions = [...(existing.positions ?? []), ...(diff.positions ?? [])];
      }
    }
    store.put(merged);
    await transactionToPromise(tx);
  }

  /** Load the edits of one chunk, or null when the chunk was never edited. */
  async loadChunkDiff(cx: number, cz: number, dimension: string): Promise<ChunkDiff | null> {
    const db = await this.database();
    const tx = db.transaction(CHUNK_DIFF_STORE, 'readonly');
    const record = await requestToPromise(
      tx.objectStore(CHUNK_DIFF_STORE).get([cx, cz, dimension]) as IDBRequest<
        ChunkDiff | undefined
      >,
    );
    return record ?? null;
  }

  /** Delete everything. */
  async clear(): Promise<void> {
    const db = await this.database();
    const tx = db.transaction([WORLD_STORE, CHUNK_DIFF_STORE], 'readwrite');
    tx.objectStore(WORLD_STORE).clear();
    tx.objectStore(CHUNK_DIFF_STORE).clear();
    await transactionToPromise(tx);
  }

  /** Close the database handle. */
  close(): void {
    this.db?.close();
    this.db = null;
    this.opening = null;
  }
}

// ---------------------------------------------------------------------------
// AutoSaver
// ---------------------------------------------------------------------------

/**
 * Periodically writes the world, and flushes when the tab is hidden or
 * closed so a browser that kills a background tab does not lose progress.
 */
export class AutoSaver {
  private timer: ReturnType<typeof setInterval> | null = null;
  private saving = false;

  private readonly onVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      void this.flush();
    }
  };

  private readonly onPageHide = () => {
    void this.flush();
  };

  constructor(
    private readonly store: WorldStore,
    private readonly getState: () => WorldSave | null,
    private readonly intervalMs = 30_000,
  ) {}

  /** Begin saving on an interval. */
  start(): void {
    if (this.timer !== null) return;
    this.timer = setInterval(() => {
      void this.flush();
    }, this.intervalMs);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', this.onPageHide);
    }
  }

  /** Stop saving and detach the listeners. */
  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', this.onPageHide);
    }
  }

  /** Save now. */
  async flush(): Promise<void> {
    if (this.saving) return;
    const state = this.getState();
    if (!state) return;
    this.saving = true;
    try {
      await this.store.saveWorld(state);
    } catch (err) {
      log.warn('persistence: autosave failed', err);
    } finally {
      this.saving = false;
    }
  }
}

// ---------------------------------------------------------------------------
// World Passport
// ---------------------------------------------------------------------------

const PASSPORT_DEFLATE = 1;
const PASSPORT_PLAIN = 0;

async function deflate(data: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const stream = new Blob([data as BlobPart])
      .stream()
      .pipeThrough(new CompressionStream('deflate-raw'));
    const buffer = await new Response(stream).arrayBuffer();
    return new Uint8Array(buffer);
  } catch (err) {
    log.warn('persistence: could not compress the world passport', err);
    return null;
  }
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('persistence: this browser cannot decompress a world passport');
  }
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Serialise a world into a compact "passport" that can be sent to another
 * device, which then becomes the new host.
 */
export async function exportWorldPassport(save: WorldSave): Promise<Uint8Array> {
  const bytes = UTF8_ENCODER.encode(JSON.stringify(save));
  const compressed = await deflate(bytes);
  if (compressed && compressed.length < bytes.length) {
    const out = new Uint8Array(1 + compressed.length);
    out[0] = PASSPORT_DEFLATE;
    out.set(compressed, 1);
    return out;
  }
  const out = new Uint8Array(1 + bytes.length);
  out[0] = PASSPORT_PLAIN;
  out.set(bytes, 1);
  return out;
}

/** Read a world passport produced by `exportWorldPassport`. */
export async function importWorldPassport(bytes: Uint8Array): Promise<WorldSave> {
  if (!bytes.length) throw new Error('persistence: the world passport is empty');
  const magic = bytes[0];
  const body = bytes.subarray(1);
  const json =
    magic === PASSPORT_DEFLATE
      ? UTF8_DECODER.decode(await inflate(body))
      : UTF8_DECODER.decode(body);
  const parsed = JSON.parse(json) as WorldSave;
  if (typeof parsed.seed !== 'number') {
    throw new Error('persistence: the world passport is malformed');
  }
  return parsed;
}
