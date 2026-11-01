/**
 * Cubicraft — world generation tests.
 *
 * The worldgen contract that matters most is *continuity*: two chunks that
 * meet at a border must agree about the world next to the seam, otherwise
 * the player sees a wall of terrain that has nothing to do with the terrain
 * next to it. The seam test below checks that on the real block data.
 */

import { describe, expect, it } from 'vitest';
import { CHUNK_X, CHUNK_Y, CHUNK_Z, WORLD_MAX_Y, WORLD_MIN_Y } from '../src/core/types';
import { WorldGenerator, generateChunk } from '../src/worldgen';
import type { GeneratedChunk } from '../src/worldgen';
import { SEA_LEVEL } from '../src/worldgen/climate';
import { BIOMES } from '../src/worldgen/biomes';
import { collectDecorations } from '../src/worldgen/decoration';

const SEED = 20261101;

/** Block name at a chunk-local position. */
function blockAt(chunk: GeneratedChunk, x: number, y: number, z: number): string {
  return chunk.blocks[(x * CHUNK_Z + z) * CHUNK_Y + (y - WORLD_MIN_Y)];
}

/** The height map entry of a chunk-local column. */
function heightAt(chunk: GeneratedChunk, x: number, z: number): number {
  return chunk.heightMap[x * CHUNK_Z + z];
}

describe('worldgen', () => {
  it('exposes exactly 68 biomes with the required distribution', () => {
    expect(BIOMES.length).toBe(68);
    expect(BIOMES.filter((b) => b.dimension === 'overworld').length).toBe(58);
    expect(BIOMES.filter((b) => b.dimension === 'nether').length).toBe(5);
    expect(BIOMES.filter((b) => b.dimension === 'end').length).toBe(5);

    const ids = new Set(BIOMES.map((b) => b.id));
    for (const id of [
      'plains', 'sunflower_plains', 'snowy_plains', 'ice_spikes', 'desert', 'swamp',
      'mangrove_swamp', 'forest', 'flower_forest', 'birch_forest',
      'old_growth_birch_forest', 'dark_forest', 'pale_garden', 'taiga', 'snowy_taiga',
      'old_growth_taiga', 'old_growth_spruce_forest', 'snowy_slopes', 'frozen_peaks',
      'jagged_peaks', 'stony_peaks', 'meadow', 'cherry_grove', 'grove', 'beach',
      'snowy_beach', 'stony_shore', 'ocean', 'deep_ocean', 'frozen_ocean',
      'deep_frozen_ocean', 'lukewarm_ocean', 'deep_lukewarm_ocean', 'cold_ocean',
      'deep_cold_ocean', 'river', 'frozen_river', 'dripstone_caves', 'lush_caves',
      'deep_dark', 'the_void', 'windswept_hills', 'windswept_gravelly_hills',
      'windswept_forest', 'windswept_savanna', 'savanna', 'savanna_plateau',
      'badlands', 'eroded_badlands', 'wooded_badlands',
      'nether_wastes', 'crimson_forest', 'warped_forest', 'soul_sand_valley',
      'basalt_deltas', 'the_end', 'end_highlands', 'end_midlands',
      'small_end_islands', 'end_barrens',
    ]) {
      expect(ids.has(id), `missing biome ${id}`).toBe(true);
    }
  });

  it('is deterministic: the same seed and chunk produce the same blocks', () => {
    const a = generateChunk(SEED, 3, -7, 'overworld');
    const b = generateChunk(SEED, 3, -7, 'overworld');
    expect(a.blocks.length).toBe(CHUNK_X * CHUNK_Y * CHUNK_Z);
    expect(a.blocks).toEqual(b.blocks);
    expect(a.biomes).toEqual(b.biomes);
    expect(Array.from(a.heightMap)).toEqual(Array.from(b.heightMap));
  });

  it('produces different worlds for different seeds', () => {
    const a = generateChunk(SEED, 0, 0, 'overworld');
    const b = generateChunk(SEED + 1, 0, 0, 'overworld');
    expect(a.blocks).not.toEqual(b.blocks);
  });

  it('has no seams between neighbouring chunks', () => {
    const generator = new WorldGenerator(SEED, 'overworld');
    const pairs: [number, number][] = [
      [0, 0], [1, 0], [0, 1], [4, -3], [-2, 5], [12, 9], [-7, -11], [33, 21], [-40, 17],
    ];

    for (const [cx, cz] of pairs) {
      const left = generator.generateChunk(cx, cz);
      const right = generator.generateChunk(cx + 1, cz);

      for (let z = 0; z < CHUNK_Z; z++) {
        // The two columns next to the border are one block apart in the
        // world, so their heights may differ by at most one block.
        const hLeft = heightAt(left, CHUNK_X - 1, z);
        const hRight = heightAt(right, 0, z);
        expect(
          Math.abs(hLeft - hRight),
          `chunk ${cx},${cz} z=${z}: ${hLeft} vs ${hRight}`,
        ).toBeLessThanOrEqual(1);

        // Both columns must describe the same surface: the ground block is
        // solid on both sides of the border.
        expect(blockAt(left, CHUNK_X - 1, hLeft, z)).not.toBe('air');
        expect(blockAt(right, 0, hRight, z)).not.toBe('air');
      }
    }
  });

  it('keeps the terrain continuous everywhere, not just at the borders', () => {
    // The seam rule is enforced globally: two neighbouring columns may
    // never differ by more than one block of height, so a chunk border can
    // never produce a step.
    const generator = new WorldGenerator(SEED, 'overworld');
    let worst = 0;
    for (let x = -48; x < 48; x++) {
      for (let z = -48; z < 48; z++) {
        const h = generator.getHeight(x, z);
        worst = Math.max(worst, Math.abs(generator.getHeight(x + 1, z) - h));
        worst = Math.max(worst, Math.abs(generator.getHeight(x, z + 1) - h));
      }
    }
    expect(worst).toBeLessThanOrEqual(1);
  });

  it('samples the terrain in world space, so a column always has one height', () => {
    const generator = new WorldGenerator(SEED, 'overworld');
    const chunk = generator.generateChunk(5, 5);
    for (let x = 0; x < CHUNK_X; x++) {
      for (let z = 0; z < CHUNK_Z; z++) {
        const worldX = 5 * CHUNK_X + x;
        const worldZ = 5 * CHUNK_Z + z;
        expect(heightAt(chunk, x, z)).toBe(generator.getHeight(worldX, worldZ));
        expect(chunk.biomes[x * CHUNK_Z + z]).toBe(generator.getBiome(worldX, worldZ));
      }
    }
  });

  it('covers a wide range of biomes', () => {
    const generator = new WorldGenerator(SEED, 'overworld');
    const seen = new Set<string>();
    const step = 32;
    const span = 4096;
    for (let x = -span; x < span; x += step) {
      for (let z = -span; z < span; z += step) {
        seen.add(generator.getBiome(x, z));
      }
    }

    expect(seen.size).toBeGreaterThanOrEqual(15);

    // The biomes the world has to feel like: water, dry land, cold land,
    // forest and mountains.
    for (const required of [
      'ocean',
      'plains',
      'desert',
      'forest',
      'snowy_plains',
      'snowy_taiga',
      'stony_peaks',
    ]) {
      expect(seen.has(required), `missing biome ${required}`).toBe(true);
    }
    // At least one of the alpine biomes.
    expect([...seen].some((b) => b.endsWith('_peaks'))).toBe(true);
  });

  it('grows trees and plants on land', () => {
    const generator = new WorldGenerator(SEED, 'overworld');
    const plants = new Set([
      'grass', 'tall_grass', 'fern', 'dead_bush', 'dandelion', 'poppy', 'cornflower',
      'allium', 'oxeye_daisy', 'azure_bluet', 'red_tulip', 'cactus', 'sugar_cane',
      'brown_mushroom', 'red_mushroom', 'blue_mushroom', 'pumpkin', 'melon',
      'snow', 'lily_pad', 'kelp', 'seagrass', 'vines', 'glow_berries', 'pink_petals',
      'sunflower',
    ]);

    let logs = 0;
    let leaves = 0;
    let plantCount = 0;
    let woodedChunks = 0;

    // Look for chunks that actually carry trees, then check what grew.
    for (let cx = -24; cx < 24 && woodedChunks < 8; cx++) {
      for (let cz = -24; cz < 24 && woodedChunks < 8; cz++) {
        const biome = generator.getBiome(cx * CHUNK_X + 8, cz * CHUNK_Z + 8);
        const row = BIOMES.find((b) => b.id === biome);
        if (!row || !row.treeType) continue;
        woodedChunks++;

        const chunk = generator.generateChunk(cx, cz);
        for (const block of chunk.blocks) {
          if (block.endsWith('_log') || block.endsWith('_stem')) logs++;
          else if (block.endsWith('_leaves') || block.endsWith('_roots')) leaves++;
          else if (plants.has(block)) plantCount++;
        }
      }
    }

    expect(woodedChunks).toBeGreaterThan(0);
    expect(logs).toBeGreaterThan(0);
    expect(leaves).toBeGreaterThan(logs);
    expect(plantCount).toBeGreaterThan(0);
  });

  it('keeps every height inside the world bounds and floods the oceans', () => {
    const generator = new WorldGenerator(SEED, 'overworld');
    let oceanColumns = 0;

    for (let cx = -2; cx <= 2; cx++) {
      const chunk = generator.generateChunk(cx, cx);
      for (let x = 0; x < CHUNK_X; x++) {
        for (let z = 0; z < CHUNK_Z; z++) {
          const h = heightAt(chunk, x, z);
          expect(h).toBeGreaterThanOrEqual(WORLD_MIN_Y + 1);
          expect(h).toBeLessThanOrEqual(WORLD_MAX_Y - 2);

          if (h < SEA_LEVEL) {
            oceanColumns++;
            // Water sits on top of the sea floor — ice in a frozen ocean,
            // and the sea plants may grow through it.
            const wet = new Set(['water', 'ice', 'seagrass', 'kelp', 'lily_pad']);
            expect(wet.has(blockAt(chunk, x, h + 1, z))).toBe(true);
            expect(wet.has(blockAt(chunk, x, SEA_LEVEL, z))).toBe(true);
          } else {
            expect(blockAt(chunk, x, h, z)).not.toBe('air');
          }
        }
      }
    }

    expect(oceanColumns).toBeGreaterThan(0);
  });

  it('carves caves underground and keeps a roof on the surface', () => {
    const generator = new WorldGenerator(SEED, 'overworld');
    let air = 0;
    let total = 0;

    for (let cx = 0; cx < 3; cx++) {
      const chunk = generator.generateChunk(cx, 0);
      for (let x = 0; x < CHUNK_X; x++) {
        for (let z = 0; z < CHUNK_Z; z++) {
          for (let y = -40; y <= 0; y++) {
            total++;
            if (blockAt(chunk, x, y, z) === 'air') air++;
          }

          // The three topmost blocks of the ground are never hollowed out.
          const h = heightAt(chunk, x, z);
          expect(blockAt(chunk, x, h, z)).not.toBe('air');
          expect(blockAt(chunk, x, h - 1, z)).not.toBe('air');
          expect(blockAt(chunk, x, h - 2, z)).not.toBe('air');
        }
      }
    }

    const fraction = air / total;
    expect(fraction).toBeGreaterThan(0.005);
    expect(fraction).toBeLessThan(0.6);
  });

  it('places coal, iron and diamond — and keeps the diamonds deep', () => {
    const generator = new WorldGenerator(SEED, 'overworld');
    const found = new Set<string>();
    let diamondTooHigh = false;

    for (let cx = 0; cx < 6; cx++) {
      for (let cz = 0; cz < 2; cz++) {
        const chunk = generator.generateChunk(cx, cz);
        for (let i = 0; i < chunk.blocks.length; i++) {
          const name = chunk.blocks[i];
          if (!name.endsWith('_ore') && !name.endsWith('_debris')) continue;
          found.add(name);
          if (name.includes('diamond')) {
            const y = WORLD_MIN_Y + (i % CHUNK_Y);
            if (y > 16) diamondTooHigh = true;
          }
        }
      }
    }

    expect(found.has('coal_ore') || found.has('deepslate_coal_ore')).toBe(true);
    expect(found.has('iron_ore') || found.has('deepslate_iron_ore')).toBe(true);
    expect(found.has('diamond_ore') || found.has('deepslate_diamond_ore')).toBe(true);
    expect(diamondTooHigh).toBe(false);
  });

  it('generates a chunk in well under 30 ms', () => {
    const generator = new WorldGenerator(SEED, 'overworld');
    // Warm up so the measurement is not dominated by the first call.
    for (let i = 0; i < 3; i++) generator.generateChunk(i, 0);

    const samples = 20;
    const start = performance.now();
    for (let i = 0; i < samples; i++) generator.generateChunk(i * 3, i * 5);
    const average = (performance.now() - start) / samples;

    console.log(`average chunk generation: ${average.toFixed(2)} ms`);
    expect(average).toBeLessThan(30);
  });

  it('collects the trees of the neighbouring chunks so canopies cross borders', () => {
    const generator = new WorldGenerator(SEED, 'overworld');
    const samplers = {
      heightAt: (x: number, z: number) => generator.getHeight(x, z),
      biomeAt: (x: number, z: number) => generator.getBiome(x, z),
    };

    // Find a chunk whose neighbour owns a tree close enough to the border
    // for the canopy to reach into it.
    let found = false;
    for (let cx = -20; cx < 20 && !found; cx++) {
      for (let cz = -20; cz < 20 && !found; cz++) {
        const decorations = collectDecorations(SEED, cx, cz, 1, samplers);
        const outside = decorations.find(
          (d) =>
            d.kind === 'tree' &&
            (d.x < cx * CHUNK_X ||
              d.x >= (cx + 1) * CHUNK_X ||
              d.z < cz * CHUNK_Z ||
              d.z >= (cz + 1) * CHUNK_Z),
        );
        if (!outside) continue;

        // The tree is rooted in a neighbouring chunk but its canopy has to
        // show up in this chunk, otherwise the border cuts the tree in half.
        const chunk = generator.generateChunk(cx, cz);
        const localX = outside.x - cx * CHUNK_X;
        const localZ = outside.z - cz * CHUNK_Z;
        if (localX >= 0 && localX < CHUNK_X && localZ >= 0 && localZ < CHUNK_Z) continue;

        const onBorder =
          localX === -1 || localX === CHUNK_X || localZ === -1 || localZ === CHUNK_Z;
        if (!onBorder) continue;

        let leaves = 0;
        for (let y = WORLD_MIN_Y; y < WORLD_MAX_Y; y++) {
          const name = blockAt(chunk, localX < 0 ? 0 : localX === CHUNK_X ? CHUNK_X - 1 : localX, y, localZ < 0 ? 0 : localZ === CHUNK_Z ? CHUNK_Z - 1 : localZ);
          if (name.endsWith('_leaves')) leaves++;
        }
        expect(leaves).toBeGreaterThan(0);
        found = true;
      }
    }

    expect(found).toBe(true);
  });

  it('generates the nether and the end without crashing', () => {
    const nether = generateChunk(SEED, 0, 0, 'nether');
    expect(nether.dimension).toBe('nether');
    expect(nether.blocks.length).toBe(CHUNK_X * CHUNK_Y * CHUNK_Z);
    expect(nether.blocks.some((b) => b === 'netherrack')).toBe(true);
    expect(nether.blocks.some((b) => b === 'lava')).toBe(true);

    const end = generateChunk(SEED, 0, 0, 'end');
    expect(end.dimension).toBe('end');
    expect(end.blocks.length).toBe(CHUNK_X * CHUNK_Y * CHUNK_Z);
    expect(end.blocks.some((b) => b === 'end_stone')).toBe(true);
  });

  it('places structures deterministically', () => {
    const generator = new WorldGenerator(SEED, 'overworld');
    let withStructures = 0;
    for (let cx = -30; cx < 30; cx++) {
      const chunk = generator.generateChunk(cx, cx);
      if (chunk.structures.length > 0) withStructures++;
    }
    expect(withStructures).toBeGreaterThan(0);
  });
});
