import { describe, expect, it } from 'vitest';

import {
  blocks,
  biomes,
  enchantments,
  initContent,
  items,
  mobs,
  recipes,
  validateContent,
  BLOCK_IDS,
  BLOCK_INDEX,
} from '../src/content';
import { TEXTURE_NAMES, textureLayer } from '../src/content/textures';

initContent();

describe('content registry', () => {
  it('registers the block set with unique numeric ids', () => {
    expect(blocks.size).toBeGreaterThan(200);
    expect(BLOCK_IDS.length).toBe(blocks.size);
    expect(new Set(BLOCK_IDS).size).toBe(BLOCK_IDS.length);
    for (let i = 0; i < BLOCK_IDS.length; i++) {
      expect(BLOCK_INDEX.get(BLOCK_IDS[i])).toBe(i);
    }
  });

  it('covers the 16 dye colours in a colour family', () => {
    const wools = blocks.byTag('wool');
    expect(wools.length).toBeGreaterThanOrEqual(16);
    const colours = new Set(wools.map((b) => b.params.color));
    expect(colours.size).toBeGreaterThanOrEqual(16);
  });

  it('defines every tool tier', () => {
    // Seven tiers exist, but they share five mining levels (wood and gold
    // are both level 0, stone and copper are both level 1).
    const tierIds = new Set(
      items
        .all()
        .filter((item) => item.tool)
        .map((item) => item.id.replace(/_(sword|pickaxe|axe|shovel|hoe|mace|spear)$/, '')),
    );
    expect(tierIds.size).toBeGreaterThanOrEqual(7);
    for (const tier of ['wooden', 'stone', 'copper', 'iron', 'diamond', 'netherite', 'golden']) {
      expect(tierIds.has(tier)).toBe(true);
    }
  });

  it('defines armour for every slot', () => {
    const armour = items.all().filter((item) => item.armorSlot);
    const slots = new Set(armour.map((item) => item.armorSlot));
    expect(slots.size).toBeGreaterThanOrEqual(4);
    expect(armour.length).toBeGreaterThanOrEqual(20);
  });

  it('defines biomes for all three dimensions', () => {
    expect(biomes.size).toBeGreaterThanOrEqual(60);
    const dimensions = new Set(biomes.all().map((b) => b.dimension));
    expect(dimensions.has('overworld')).toBe(true);
    expect(dimensions.has('nether')).toBe(true);
    expect(dimensions.has('end')).toBe(true);
  });

  it('defines mobs in every category', () => {
    expect(mobs.size).toBeGreaterThanOrEqual(40);
    const categories = new Set(mobs.all().map((m) => m.category));
    for (const category of ['passive', 'neutral', 'hostile', 'boss']) {
      expect(categories.has(category as never)).toBe(true);
    }
  });

  it('defines enchantments with levels', () => {
    expect(enchantments.size).toBeGreaterThanOrEqual(30);
    for (const enchantment of enchantments.all()) {
      expect(enchantment.maxLevel).toBeGreaterThan(0);
    }
  });

  it('defines crafting recipes that produce real items', () => {
    expect(recipes.size).toBeGreaterThan(20);
    for (const recipe of recipes.all()) {
      expect(blocks.has(recipe.result) || items.has(recipe.result)).toBe(true);
    }
  });

  it('passes its own validation', () => {
    const report = validateContent();
    if (!report.ok) {
      console.error(report.format());
    }
    expect(report.errors).toEqual([]);
  });

  it('resolves every texture name to a layer', () => {
    expect(TEXTURE_NAMES.length).toBeGreaterThan(20);
    for (const name of TEXTURE_NAMES) {
      expect(textureLayer(name)).toBeGreaterThanOrEqual(0);
    }
    // Every block face must point at a texture that exists.
    for (const block of blocks.all()) {
      for (const name of Object.values(block.textures)) {
        expect(TEXTURE_NAMES).toContain(name);
      }
    }
  });
});
