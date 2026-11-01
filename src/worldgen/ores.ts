/**
 * Cubicraft — ore veins.
 *
 * Ores are placed in vein clusters rather than as single blocks, which is
 * what makes them recognisable when mining. The vein count, size range and
 * height band follow the classic distribution: coal is common and spread
 * over the whole column, diamond is rare and only near the bottom.
 *
 * Placement is driven by the per-chunk seeded RNG, so a chunk always holds
 * the same veins no matter when it is generated.
 */

import { CHUNK_X, CHUNK_Z, WORLD_MIN_Y } from '../core/types';
import { SeededRng } from '../core/rng';
import { BLOCK_IDS, blockIndex } from './terrain';
import type { BlockName } from './terrain';

/** A single ore type with its generation rules. */
export interface OreDef {
  /** Base ore block name. */
  id: string;
  /** The deepslate variant used below y = 0. */
  deepslateId: string;
  /** Smallest and largest vein. */
  veinSize: [number, number];
  /** Lowest world Y the ore may appear at. */
  yMin: number;
  /** Highest world Y the ore may appear at. */
  yMax: number;
  /** Expected number of veins per chunk. */
  veins: number;
  dimension: 'overworld' | 'nether';
  /** Only generates on mountain terrain (emerald). */
  mountainOnly: boolean;
  /** Minimum terrain height for `mountainOnly` ores. */
  mountainHeight: number;
}

/** The complete ore list. */
export const ORES: OreDef[] = [
  {
    id: 'coal_ore', deepslateId: 'deepslate_coal_ore',
    veinSize: [1, 17], yMin: 0, yMax: 256, veins: 20,
    dimension: 'overworld', mountainOnly: false, mountainHeight: 0,
  },
  {
    id: 'iron_ore', deepslateId: 'deepslate_iron_ore',
    veinSize: [1, 10], yMin: -64, yMax: 320, veins: 14,
    dimension: 'overworld', mountainOnly: false, mountainHeight: 0,
  },
  {
    id: 'copper_ore', deepslateId: 'deepslate_copper_ore',
    veinSize: [4, 8], yMin: -64, yMax: 48, veins: 8,
    dimension: 'overworld', mountainOnly: false, mountainHeight: 0,
  },
  {
    id: 'gold_ore', deepslateId: 'deepslate_gold_ore',
    veinSize: [1, 10], yMin: -64, yMax: 32, veins: 2,
    dimension: 'overworld', mountainOnly: false, mountainHeight: 0,
  },
  {
    id: 'redstone_ore', deepslateId: 'deepslate_redstone_ore',
    veinSize: [1, 17], yMin: -64, yMax: 15, veins: 5,
    dimension: 'overworld', mountainOnly: false, mountainHeight: 0,
  },
  {
    id: 'lapis_ore', deepslateId: 'deepslate_lapis_ore',
    veinSize: [1, 12], yMin: -32, yMax: 64, veins: 1.5,
    dimension: 'overworld', mountainOnly: false, mountainHeight: 0,
  },
  {
    id: 'diamond_ore', deepslateId: 'deepslate_diamond_ore',
    // The band stops one block below y = 16 so a diamond is always *below*
    // that line, never on it.
    veinSize: [1, 8], yMin: -59, yMax: 15, veins: 1.2,
    dimension: 'overworld', mountainOnly: false, mountainHeight: 0,
  },
  {
    id: 'emerald_ore', deepslateId: 'deepslate_emerald_ore',
    veinSize: [1, 3], yMin: 4, yMax: 320, veins: 0.6,
    dimension: 'overworld', mountainOnly: true, mountainHeight: 90,
  },
  {
    id: 'nether_gold_ore', deepslateId: 'deepslate_nether_gold_ore',
    veinSize: [1, 10], yMin: 8, yMax: 96, veins: 10,
    dimension: 'nether', mountainOnly: false, mountainHeight: 0,
  },
  {
    id: 'ancient_debris', deepslateId: 'deepslate_ancient_debris',
    veinSize: [1, 3], yMin: 8, yMax: 22, veins: 2.5,
    dimension: 'nether', mountainOnly: false, mountainHeight: 0,
  },
  {
    id: 'quartz_ore', deepslateId: 'deepslate_quartz_ore',
    veinSize: [1, 20], yMin: 10, yMax: 50, veins: 16,
    dimension: 'nether', mountainOnly: false, mountainHeight: 0,
  },
  {
    id: 'nether_quartz_ore', deepslateId: 'deepslate_nether_quartz_ore',
    veinSize: [1, 6], yMin: 8, yMax: 40, veins: 6,
    dimension: 'nether', mountainOnly: false, mountainHeight: 0,
  },
];

/**
 * Place the ore veins of one chunk.
 *
 * `heights` is the per column top solid block; ores never appear above it.
 */
export function placeOres(
  blocks: Uint8Array,
  cx: number,
  cz: number,
  seed: number,
  heights: Int16Array,
  dimension: 'overworld' | 'nether' | 'end',
): void {
  if (dimension === 'end') return;

  const baseX = cx * CHUNK_X;
  const baseZ = cz * CHUNK_Z;

  for (let o = 0; o < ORES.length; o++) {
    const ore = ORES[o];
    if (ore.dimension !== dimension) continue;

    const rng = SeededRng.forPosition(seed, cx, cz).fork(`ore:${ore.id}`);
    const count = Math.floor(ore.veins) + (rng.chance(ore.veins % 1) ? 1 : 0);

    for (let v = 0; v < count; v++) {
      const size = rng.int(ore.veinSize[0], ore.veinSize[1]);
      let x = baseX + rng.int(0, CHUNK_X - 1);
      let z = baseZ + rng.int(0, CHUNK_Z - 1);
      const yTop = Math.min(300, ore.yMax);
      const yBottom = Math.max(WORLD_MIN_Y + 1, ore.yMin);
      let y = rng.int(yBottom, yTop);
      if (y <= WORLD_MIN_Y + 1) continue;

      // Mountain-only ores need high ground.
      if (ore.mountainOnly) {
        const ci = (x - baseX) * CHUNK_Z + (z - baseZ);
        if (ci < 0 || ci >= heights.length) continue;
        if (heights[ci] < ore.mountainHeight) continue;
      }

      const oreId = BLOCK_IDS[ore.id as BlockName];
      const deepId = BLOCK_IDS[ore.deepslateId as BlockName];

      // A short random walk gives the vein an irregular, natural shape.
      for (let i = 0; i < size; i++) {
        const lx = x - baseX;
        const lz = z - baseZ;
        if (lx >= 0 && lx < CHUNK_X && lz >= 0 && lz < CHUNK_Z) {
          const idx = blockIndex(lx, y, lz);
          const current = blocks[idx];
          if (current === BLOCK_IDS.stone) {
            blocks[idx] = oreId;
          } else if (current === BLOCK_IDS.deepslate) {
            blocks[idx] = deepId;
          }
        }
        const dir = rng.int(0, 5);
        if (dir === 0) x++;
        else if (dir === 1) x--;
        else if (dir === 2) z++;
        else if (dir === 3) z--;
        else if (dir === 4) y++;
        else y--;
        // The vein stays inside the ore's height band — a vein that wandered
        // out of it would put diamond above y = 16.
        if (y <= yBottom || y > yTop) break;
      }
    }
  }
}
