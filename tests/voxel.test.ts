import { describe, expect, it } from 'vitest';

import { Section } from '../src/engine/voxel/section';
import { Chunk } from '../src/engine/voxel/chunk';
import { ChunkStore } from '../src/engine/voxel/chunkStore';
import { SECTION_COUNT, SECTION_VOLUME, WORLD_MIN_Y } from '../src/core/types';

describe('Section storage', () => {
  it('starts empty and reports air', () => {
    const section = new Section();
    expect(section.empty).toBe(true);
    expect(section.get(0, 0, 0)).toBe(0);
  });

  it('stores and reads blocks', () => {
    const section = new Section();
    section.set(3, 5, 7, 42);
    expect(section.get(3, 5, 7)).toBe(42);
    expect(section.get(3, 5, 8)).toBe(0);
    expect(section.empty).toBe(false);
  });

  it('uses a palette so repeated blocks share one entry', () => {
    const section = new Section();
    for (let i = 0; i < SECTION_VOLUME; i++) section.set(i % 16, Math.floor(i / 16) % 16, Math.floor(i / 256), 7);
    expect(section.palette).toEqual([0, 7]);
  });

  it('round-trips through a flat block array', () => {
    const section = new Section();
    section.set(1, 2, 3, 9);
    section.set(4, 5, 6, 11);
    const flat = new Uint16Array(SECTION_VOLUME);
    for (let i = 0; i < SECTION_VOLUME; i++) flat[i] = section.slotAt(i);
    const restored = Section.fromBlocks(flat);
    expect(restored.get(1, 2, 3)).toBe(9);
    expect(restored.get(4, 5, 6)).toBe(11);
  });
});

describe('Chunk storage', () => {
  it('stores blocks across section boundaries', () => {
    const chunk = new Chunk(0, 0);
    expect(chunk.setBlock(0, WORLD_MIN_Y, 0, 5)).toBe(true);
    expect(chunk.setBlock(0, WORLD_MIN_Y + 16, 0, 6)).toBe(true);
    expect(chunk.getBlock(0, WORLD_MIN_Y, 0)).toBe(5);
    expect(chunk.getBlock(0, WORLD_MIN_Y + 16, 0)).toBe(6);
    expect(chunk.sectionIndex(WORLD_MIN_Y + 16)).toBe(1);
  });

  it('tracks the height map', () => {
    const chunk = new Chunk(0, 0);
    chunk.setBlock(2, 70, 3, 1);
    expect(chunk.heightMap[2 * 16 + 3]).toBe(70);
    chunk.setBlock(2, 70, 3, 0);
    expect(chunk.heightMap[2 * 16 + 3]).toBeLessThan(70);
  });

  it('round-trips through a flat block array', () => {
    const chunk = new Chunk(1, -2);
    chunk.setBlock(5, 64, 5, 12);
    const flat = chunk.toBlockArray();
    expect(flat.length).toBe(SECTION_COUNT * SECTION_VOLUME);
    const other = new Chunk(1, -2);
    other.fromBlockArray(flat);
    expect(other.getBlock(5, 64, 5)).toBe(12);
  });

  it('ignores writes outside the world', () => {
    const chunk = new Chunk(0, 0);
    expect(chunk.setBlock(0, WORLD_MIN_Y - 1, 0, 1)).toBe(false);
    expect(chunk.setBlock(0, WORLD_MIN_Y + 384, 0, 1)).toBe(false);
  });
});

describe('ChunkStore', () => {
  it('stores, finds and removes chunks', () => {
    const store = new ChunkStore();
    store.getOrCreate(3, -4);
    expect(store.has(3, -4)).toBe(true);
    expect(store.get(3, -4)?.cx).toBe(3);
    expect(store.size).toBe(1);
    store.delete(3, -4);
    expect(store.has(3, -4)).toBe(false);
  });

  it('accounts for memory', () => {
    const store = new ChunkStore();
    const chunk = store.getOrCreate(0, 0);
    chunk.setBlock(0, 64, 0, 1);
    expect(store.memoryUsage()).toBeGreaterThan(0);
  });
});
