/**
 * The world: block access across chunk boundaries plus lighting queries.
 */

import { ChunkStore } from '../voxel/chunkStore';
import { AIR, type BlockLookup } from '../voxel/blocks';
import { EMPTY_PROFILE, type BlockProfileTable } from '../voxel/profiles';
import { WORLD_MAX_Y, WORLD_MIN_Y } from '../../core/types';

export class World {
  readonly chunks = new ChunkStore();

  constructor(
    readonly profiles: BlockProfileTable,
    readonly lookup: BlockLookup,
  ) {}

  /** Block id at a world position. Air outside the world and outside loaded chunks. */
  getBlock(x: number, y: number, z: number): number {
    if (y < WORLD_MIN_Y || y >= WORLD_MAX_Y) return AIR;
    const cx = x >> 4;
    const cz = z >> 4;
    const chunk = this.chunks.get(cx, cz);
    if (!chunk) return AIR;
    return chunk.getBlock(x - (cx << 4), y, z - (cz << 4));
  }

  /** Set a block and mark the chunk dirty. */
  setBlock(x: number, y: number, z: number, blockId: number): boolean {
    if (y < WORLD_MIN_Y || y >= WORLD_MAX_Y) return false;
    void y;
    const cx = x >> 4;
    const cz = z >> 4;
    const chunk = this.chunks.get(cx, cz);
    if (!chunk) return false;
    const changed = chunk.setBlock(x - (cx << 4), y, z - (cz << 4), blockId);
    if (changed) chunk.version++;
    return changed;
  }

  /** Whether the given block id is loaded at this position. */
  isLoaded(x: number, y: number, z: number): boolean {
    return this.chunks.has(x >> 4, z >> 4);
  }

  isOpaque(x: number, y: number, z: number): boolean {
    return this.profiles.get(this.getBlock(x, y, z)).opaque;
  }

  isTransparent(x: number, y: number, z: number): boolean {
    return this.profiles.get(this.getBlock(x, y, z)).transparent;
  }

  emissionAt(x: number, y: number, z: number): number {
    return this.profiles.get(this.getBlock(x, y, z)).emission;
  }

  /** Combined light byte (sky << 4 | block) at a position. */
  lightAt(x: number, y: number, z: number): number {
    if (y < WORLD_MIN_Y || y >= WORLD_MAX_Y) return 0;
    const cx = x >> 4;
    const cz = z >> 4;
    const chunk = this.chunks.get(cx, cz);
    if (!chunk) return 0;
    return chunk.getLight(x - (cx << 4), y, z - (cz << 4));
  }

  profileOf(x: number, y: number, z: number) {
    return this.profiles.get(this.getBlock(x, y, z));
  }

  get airProfile() {
    return EMPTY_PROFILE;
  }
}
