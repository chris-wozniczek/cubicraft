/**
 * A chunk column: 16 x 16 horizontally, 384 tall, split into 24 sections.
 */

import { Section } from './section';
import {
  CHUNK_X,
  CHUNK_Z,
  SECTION_COUNT,
  SECTION_Y,
  SECTION_VOLUME,
  WORLD_MAX_Y,
  WORLD_MIN_Y,
  type ChunkPos as _ChunkPos,
} from '../../core/types';

export type ChunkState =
  | 'empty'
  | 'generating'
  | 'generated'
  | 'lit'
  | 'meshing'
  | 'ready'
  | 'active'
  | 'unloading';

export class Chunk {
  readonly cx: number;
  readonly cz: number;
  readonly sections: (Section | null)[] = new Array(SECTION_COUNT).fill(null);
  /** Per-voxel light: high nibble = sky light, low nibble = block light. */
  readonly light: (Uint8Array | null)[] = new Array(SECTION_COUNT).fill(null);
  /** Topmost non-air Y per column, -1 when the column is empty. */
  heightMap = new Int16Array(CHUNK_X * CHUNK_Z).fill(-1);
  /** The biome id of each column, in the same x-major order as the height map. */
  biomes: string[] = [];
  state: ChunkState = 'empty';
  /** Monotonic version, bumped on every block change — used for mesh rebuilds. */
  version = 0;
  /** True when the chunk holds player/mob edits and must be persisted. */
  dirty = false;

  constructor(cx: number, cz: number) {
    this.cx = cx;
    this.cz = cz;
  }

  get key(): string {
    return `${this.cx},${this.cz}`;
  }

  sectionIndex(worldY: number): number {
    return Math.floor((worldY - WORLD_MIN_Y) / SECTION_Y);
  }

  /** Get a block id. Returns 0 (air) outside the world. */
  getBlock(x: number, y: number, z: number): number {
    if (y < WORLD_MIN_Y || y >= WORLD_MAX_Y) return 0;
    const sec = this.sections[this.sectionIndex(y)];
    if (!sec) return 0;
    return sec.get(x, y - (WORLD_MIN_Y + this.sectionIndex(y) * SECTION_Y), z);
  }

  /** Set a block id. Returns true when something changed. */
  setBlock(x: number, y: number, z: number, blockId: number): boolean {
    if (y < WORLD_MIN_Y || y >= WORLD_MAX_Y) return false;
    const si = this.sectionIndex(y);
    const localY = y - (WORLD_MIN_Y + si * SECTION_Y);
    let sec = this.sections[si];
    if (!sec) {
      if (blockId === 0) return false;
      sec = new Section();
      this.sections[si] = sec;
    }
    const before = sec.get(x, localY, z);
    if (before === blockId) return false;
    sec.set(x, localY, z, blockId);
    this.version++;
    this.dirty = true;
    this.recomputeHeight(x, z, y, blockId);
    return true;
  }

  private recomputeHeight(x: number, z: number, changedY: number, blockId: number): void {
    const hi = x * CHUNK_Z + z;
    const current = this.heightMap[hi];
    if (blockId !== 0) {
      if (current < changedY) this.heightMap[hi] = changedY;
      return;
    }
    // Removed a block — only lower the height if it was the top one.
    if (current !== changedY) return;
    let h = changedY - 1;
    while (h > WORLD_MIN_Y && this.getBlock(x, h, z) === 0) h--;
    this.heightMap[hi] = h <= WORLD_MIN_Y ? -1 : h;
  }

  /** Recompute the whole height map — used after generation. */
  rebuildHeightMap(): void {
    for (let x = 0; x < CHUNK_X; x++) {
      for (let z = 0; z < CHUNK_Z; z++) {
        let h = WORLD_MAX_Y - 1;
        while (h > WORLD_MIN_Y && this.getBlock(x, h, z) === 0) h--;
        this.heightMap[x * CHUNK_Z + z] = h <= WORLD_MIN_Y ? -1 : h;
      }
    }
  }

  getLight(x: number, y: number, z: number): number {
    if (y < WORLD_MIN_Y || y >= WORLD_MAX_Y) return 0;
    const si = this.sectionIndex(y);
    const arr = this.light[si];
    if (!arr) return 0;
    return arr[Section.index(x, y - (WORLD_MIN_Y + si * SECTION_Y), z)] ?? 0;
  }

  setLight(x: number, y: number, z: number, value: number): void {
    if (y < WORLD_MIN_Y || y >= WORLD_MAX_Y) return;
    const si = this.sectionIndex(y);
    let arr = this.light[si];
    if (!arr) {
      arr = new Uint8Array(SECTION_VOLUME);
      this.light[si] = arr;
    }
    arr[Section.index(x, y - (WORLD_MIN_Y + si * SECTION_Y), z)] = value;
  }

  skyLightAt(x: number, y: number, z: number): number {
    return (this.getLight(x, y, z) >> 4) & 0x0f;
  }

  blockLightAt(x: number, y: number, z: number): number {
    return this.getLight(x, y, z) & 0x0f;
  }

  /** Total non-air voxel count, used for memory accounting. */
  countBlocks(): number {
    let n = 0;
    for (const sec of this.sections) {
      if (!sec || sec.empty) continue;
      for (let i = 0; i < SECTION_VOLUME; i++) {
        if (sec.slotAt(i) !== 0) n++;
      }
    }
    return n;
  }

  /** Flat array of every block id — used when handing the chunk to a worker. */
  toBlockArray(): Uint16Array {
    const out = new Uint16Array(SECTION_VOLUME * SECTION_COUNT);
    for (let si = 0; si < SECTION_COUNT; si++) {
      const sec = this.sections[si];
      if (!sec) continue;
      const base = si * SECTION_VOLUME;
      for (let i = 0; i < SECTION_VOLUME; i++) {
        out[base + i] = sec.slotAt(i);
      }
    }
    return out;
  }

  /** Restore from a flat block array (worker → main thread). */
  fromBlockArray(blocks: Uint16Array, heightMap?: Int16Array): void {
    for (let si = 0; si < SECTION_COUNT; si++) {
      const base = si * SECTION_VOLUME;
      let any = false;
      for (let i = 0; i < SECTION_VOLUME; i++) {
        if (blocks[base + i] !== 0) {
          any = true;
          break;
        }
      }
      if (!any) {
        this.sections[si] = null;
        continue;
      }
      const sec = new Section();
      for (let i = 0; i < SECTION_VOLUME; i++) {
        sec.setIndex(i, blocks[base + i]);
      }
      this.sections[si] = sec;
    }
    // The generator knows where the ground is; trees and plants must not be
    // counted, or the player would spawn on top of a tree.
    if (heightMap) {
      this.heightMap = new Int16Array(heightMap);
    } else {
      this.rebuildHeightMap();
    }
  }
}
