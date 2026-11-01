/**
 * A 16x16x16 section of the world.
 *
 * Sections are the unit of storage, lighting and meshing. They are allocated
 * sparsely — an all-air section costs nothing — which keeps a chunk column
 * cheap even though the world is 384 blocks tall.
 *
 * Palette index 0 is always air, so an air cell costs no palette entry.
 */

import { AIR } from './blocks';
import { SECTION_VOLUME } from '../../core/types';

export class Section {
  /** Unique block ids used in this section. Index 0 is always air. */
  readonly palette: number[] = [AIR];
  /** Palette index per voxel. */
  readonly indices: Uint16Array;
  /** Number of non-air voxels. */
  count = 0;

  private readonly paletteIndex = new Map<number, number>();

  constructor() {
    this.indices = new Uint16Array(SECTION_VOLUME);
  }

  /** Build a section directly from a flat array of block ids. */
  static fromBlocks(blocks: Uint16Array): Section {
    const section = new Section();
    for (let i = 0; i < SECTION_VOLUME; i++) {
      section.setIndex(i, blocks[i]);
    }
    return section;
  }

  private paletteSlot(blockId: number): number {
    let slot = this.paletteIndex.get(blockId);
    if (slot === undefined) {
      slot = this.palette.length;
      this.palette.push(blockId);
      this.paletteIndex.set(blockId, slot);
    }
    return slot;
  }

  setIndex(index: number, blockId: number): void {
    const previous = this.palette[this.indices[index]] ?? AIR;
    if (previous === blockId) return;
    if (previous !== AIR) this.count--;
    if (blockId !== AIR) this.count++;
    this.indices[index] = blockId === AIR ? 0 : this.paletteSlot(blockId);
  }

  /** Voxel index inside a section. */
  static index(x: number, y: number, z: number): number {
    return (x * 16 + z) * 16 + y;
  }

  get(x: number, y: number, z: number): number {
    return this.palette[this.indices[Section.index(x, y, z)]] ?? AIR;
  }

  set(x: number, y: number, z: number, blockId: number): void {
    this.setIndex(Section.index(x, y, z), blockId);
  }

  /** Raw palette-slot access — used by the mesher for speed. */
  slotAt(index: number): number {
    return this.palette[this.indices[index]] ?? AIR;
  }

  /** True when the section holds no blocks at all. */
  get empty(): boolean {
    return this.count === 0;
  }
}
