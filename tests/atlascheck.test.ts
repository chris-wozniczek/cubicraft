import { describe, expect, it } from 'vitest';
import { TEXTURE_NAMES } from '../src/content/textures';
import { buildAtlas } from '../src/render/atlas';
import { blocks } from '../src/content';
import { initContent } from '../src/content';

initContent();

describe('atlas', () => {
  it('has unique texture names', () => {
    expect(new Set(TEXTURE_NAMES).size).toBe(TEXTURE_NAMES.length);
  });

  it('resolves every block texture to a distinct layer', () => {
    const atlas = buildAtlas(TEXTURE_NAMES);
    expect(atlas.names.length).toBe(TEXTURE_NAMES.length);
    const missing: string[] = [];
    for (const block of blocks.all()) {
      for (const name of Object.values(block.textures)) {
        if (!TEXTURE_NAMES.includes(name)) missing.push(`${block.id}:${name}`);
        else if (atlas.layer(name) !== TEXTURE_NAMES.indexOf(name)) missing.push(`${block.id}:${name}(layer)`);
      }
    }
    console.log('missing/mismatched:', missing.length, missing.slice(0, 10).join(' '));
    expect(missing).toEqual([]);
  });

  it('paints opaque pixels for solid block textures', () => {
    const atlas = buildAtlas(TEXTURE_NAMES);
    const data = atlas.texture.image.data as Uint8Array;
    const size = 32;
    const opaque = (name: string) => {
      const layer = atlas.layer(name);
      const base = layer * size * size * 4;
      let count = 0;
      for (let i = 0; i < size * size; i++) if (data[base + i * 4 + 3] > 128) count++;
      return count / (size * size);
    };
    for (const name of ['grass_block', 'grass_block_side', 'stone', 'dirt', 'sand']) {
      console.log(`opaque(${name}) = ${(opaque(name) * 100).toFixed(0)}%`);
      expect(opaque(name)).toBeGreaterThan(0.9);
    }
  });
});
