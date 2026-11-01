/**
 * The store of loaded chunks, keyed by column position.
 */

import { Chunk } from './chunk';
import { chunkKey } from '../../core/types';

export class ChunkStore {
  private readonly chunks = new Map<string, Chunk>();

  get(cx: number, cz: number): Chunk | undefined {
    return this.chunks.get(chunkKey(cx, cz));
  }

  getOrCreate(cx: number, cz: number): Chunk {
    const key = chunkKey(cx, cz);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = new Chunk(cx, cz);
      this.chunks.set(key, chunk);
    }
    return chunk;
  }

  set(chunk: Chunk): void {
    this.chunks.set(chunk.key, chunk);
  }

  delete(cx: number, cz: number): boolean {
    return this.chunks.delete(chunkKey(cx, cz));
  }

  has(cx: number, cz: number): boolean {
    return this.chunks.has(chunkKey(cx, cz));
  }

  get size(): number {
    return this.chunks.size;
  }

  all(): IterableIterator<Chunk> {
    return this.chunks.values();
  }

  keys(): IterableIterator<string> {
    return this.chunks.keys();
  }

  clear(): void {
    this.chunks.clear();
  }

  /** Approximate heap usage of the voxel data, in bytes. */
  memoryUsage(): number {
    let bytes = 0;
    for (const chunk of this.chunks.values()) {
      for (const sec of chunk.sections) {
        if (sec) bytes += sec.indices.byteLength + sec.palette.length * 4;
      }
      for (const light of chunk.light) {
        if (light) bytes += light.byteLength;
      }
      bytes += chunk.heightMap.byteLength;
    }
    return bytes;
  }
}
