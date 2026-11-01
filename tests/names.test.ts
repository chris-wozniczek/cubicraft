import { describe, expect, it } from 'vitest';

import { BLOCK_NAMES } from '../src/worldgen/terrain';
import { blocks, initContent } from '../src/content';

initContent();

describe('world generation and content agree on block names', () => {
  it('every block name the generator emits exists in the content registry', () => {
    // This is the direction that matters: a name the generator emits that the
    // registry does not know would become air in the world.
    const missing = BLOCK_NAMES.filter((name) => name !== 'air' && !blocks.has(name));
    expect(missing).toEqual([]);
  });

  it('keeps the generator list free of duplicates', () => {
    expect(new Set(BLOCK_NAMES).size).toBe(BLOCK_NAMES.length);
  });
});
