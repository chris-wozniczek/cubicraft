/**
 * Cubicraft — cave carving.
 *
 * Caves are carved from a coarse density grid that is trilinearly
 * interpolated to every block. Sampling the 3D noise per block would need
 * ~100k noise evaluations per chunk; the grid needs a few thousand, which
 * is what keeps `generateChunk` inside its time budget.
 *
 * Two classic shapes are used:
 *   - "cheese"   — a single 3D fBm field above a threshold: big round caverns.
 *   - "spaghetti" — the intersection of two independent 3D fields: long,
 *     narrow tunnels that wander through the rock.
 */

import { CHUNK_X, CHUNK_Z, WORLD_MIN_Y } from '../core/types';
import { BLOCK_IDS, blockIndex, endIslandHeight } from './terrain';
import { Noise } from './noise';

/** Horizontal stride of the cave density grid, in blocks. */
const STRIDE = 4;
/** Node columns/rows of the grid (one extra on each side for interpolation). */
const GRID_N = CHUNK_X / STRIDE + 3;

/** How a cave layer is shaped. */
export type CaveKind = 'cheese' | 'spaghetti';

/** One band of cave carving. */
export interface CaveLayer {
  /** Lowest world Y the layer reaches. */
  yMin: number;
  /** Highest world Y the layer reaches. */
  yMax: number;
  /** Horizontal noise frequency. */
  freq: number;
  /** Vertical noise frequency. */
  vfreq: number;
  kind: CaveKind;
  /** Density above which the rock is removed. */
  threshold: number;
  /** fBm octaves used for the density field. */
  octaves: number;
  /** Offset so two layers never share the same field. */
  offset: number;
}

/** The overworld cave stack: five to seven layers over different depths. */
export const OVERWORLD_CAVE_LAYERS: CaveLayer[] = [
  {
    yMin: -52, yMax: 64, freq: 0.019, vfreq: 0.034,
    kind: 'cheese', threshold: 0.2, octaves: 3, offset: 0,
  },
  {
    yMin: -34, yMax: 44, freq: 0.011, vfreq: 0.021,
    kind: 'cheese', threshold: 0.27, octaves: 2, offset: 91.7,
  },
  {
    yMin: -60, yMax: 24, freq: 0.042, vfreq: 0.058,
    kind: 'spaghetti', threshold: 0.19, octaves: 2, offset: 203.3,
  },
  {
    yMin: 16, yMax: 130, freq: 0.036, vfreq: 0.043,
    kind: 'spaghetti', threshold: 0.23, octaves: 2, offset: 311.9,
  },
  {
    yMin: -64, yMax: 4, freq: 0.029, vfreq: 0.038,
    kind: 'spaghetti', threshold: 0.24, octaves: 2, offset: 457.1,
  },
  {
    yMin: 56, yMax: 210, freq: 0.028, vfreq: 0.033,
    kind: 'cheese', threshold: 0.3, octaves: 2, offset: 613.5,
  },
];

/** The nether is mostly open: a few huge caverns over the lava sea. */
export const NETHER_CAVE_LAYERS: CaveLayer[] = [
  {
    yMin: 32, yMax: 128, freq: 0.013, vfreq: 0.019,
    kind: 'cheese', threshold: 0.16, octaves: 3, offset: 71.3,
  },
  {
    yMin: 40, yMax: 120, freq: 0.028, vfreq: 0.03,
    kind: 'spaghetti', threshold: 0.22, octaves: 2, offset: 149.7,
  },
];

/**
 * Pre-computed interpolation weights for the density grid.
 *
 * The grid nodes sit at world x = -STRIDE + i*STRIDE, so a block at local x
 * always falls between the same two node columns.
 */
const IX0 = new Int32Array(CHUNK_X);
const TX = new Float32Array(CHUNK_X);
const IZ0 = new Int32Array(CHUNK_Z);
const TZ = new Float32Array(CHUNK_Z);

(function initWeights(): void {
  for (let x = 0; x < CHUNK_X; x++) {
    const u = (x + STRIDE) / STRIDE - 1;
    const i0 = Math.floor(u);
    IX0[x] = i0;
    TX[x] = u - i0;
  }
  for (let z = 0; z < CHUNK_Z; z++) {
    const u = (z + STRIDE) / STRIDE - 1;
    const i0 = Math.floor(u);
    IZ0[z] = i0;
    TZ[z] = u - i0;
  }
})();

/** Carves the caves of one dimension into a chunk buffer. */
export class CaveGenerator {
  constructor(
    private readonly noise: Noise,
    private readonly dimension: 'overworld' | 'nether' | 'end' = 'overworld',
  ) {}

  /**
   * Carve the caves of one chunk.
   *
   * `heights` holds the top solid block of every column; carving never
   * touches the top four blocks so the ground always keeps a roof.
   */
  carve(blocks: Uint8Array, cx: number, cz: number, heights: Int16Array): void {
    const layers = this.dimension === 'nether' ? NETHER_CAVE_LAYERS : OVERWORLD_CAVE_LAYERS;
    for (let i = 0; i < layers.length; i++) {
      this.carveLayer(blocks, cx, cz, heights, layers[i]);
    }
  }

  /** Carve a single layer through the chunk. */
  private carveLayer(
    blocks: Uint8Array,
    cx: number,
    cz: number,
    heights: Int16Array,
    layer: CaveLayer,
  ): void {
    const baseX = cx * CHUNK_X;
    const baseZ = cz * CHUNK_Z;

    const yStart = Math.max(WORLD_MIN_Y + 1, layer.yMin);
    const yEnd = Math.min(layer.yMax, 300);
    if (yStart > yEnd) return;

    // The first node row sits on the stride grid.
    const firstNode = Math.floor(yStart / STRIDE) * STRIDE;

    // Two node rows are kept live: the current one and the next.
    let rowA = this.sampleRow(baseX, baseZ, firstNode, layer);
    let rowB = this.sampleRow(baseX, baseZ, firstNode + STRIDE, layer);
    let nodeY = firstNode;

    for (let y = yStart; y <= yEnd; y++) {
      // Advance the node rows when the walk passes the next node.
      while (y > nodeY + STRIDE) {
        nodeY += STRIDE;
        rowA = rowB;
        rowB = this.sampleRow(baseX, baseZ, nodeY + STRIDE, layer);
      }

      const ty = (y - nodeY) / STRIDE;
      const tRowA = rowA;
      const tRowB = rowB;

      for (let x = 0; x < CHUNK_X; x++) {
        const xi = IX0[x];
        const tx = TX[x];
        const c00 = xi * GRID_N;
        const c10 = (xi + 1) * GRID_N;

        for (let z = 0; z < CHUNK_Z; z++) {
          const ci = x * CHUNK_Z + z;
          const limit = heights[ci] - 4;
          if (y > limit) continue;

          const zi = IZ0[z];
          const tz = TZ[z];
          const r0 = zi;
          const r1 = zi + 1;

          const a0 = tRowA[c00 + r0] + (tRowA[c10 + r0] - tRowA[c00 + r0]) * tx;
          const a1 = tRowA[c00 + r1] + (tRowA[c10 + r1] - tRowA[c00 + r1]) * tx;
          const a = a0 + (a1 - a0) * tz;

          const b0 = tRowB[c00 + r0] + (tRowB[c10 + r0] - tRowB[c00 + r0]) * tx;
          const b1 = tRowB[c00 + r1] + (tRowB[c10 + r1] - tRowB[c00 + r1]) * tx;
          const b = b0 + (b1 - b0) * tz;

          const density = a + (b - a) * ty;
          if (density > 0) {
            const idx = blockIndex(x, y, z);
            const current = blocks[idx];
            // Only solid rock is removed — water and lava stay put.
            if (current === BLOCK_IDS.stone || current === BLOCK_IDS.deepslate || current === BLOCK_IDS.netherrack) {
              blocks[idx] = BLOCK_IDS.air;
            }
          }
        }
      }
    }
  }

  /** Sample one horizontal row of the density grid at a given world Y. */
  private sampleRow(baseX: number, baseZ: number, worldY: number, layer: CaveLayer): Float32Array {
    const row = new Float32Array(GRID_N * GRID_N);
    const noise = this.noise;
    const isSpaghetti = layer.kind === 'spaghetti';

    for (let gx = 0; gx < GRID_N; gx++) {
      const wx = baseX - STRIDE + gx * STRIDE;
      for (let gz = 0; gz < GRID_N; gz++) {
        const wz = baseZ - STRIDE + gz * STRIDE;
        let density: number;

        if (isSpaghetti) {
          // The intersection of two independent fields: a tunnel is only
          // carved where both fields are above their threshold.
          const a = noise.fbm3(wx * layer.freq, worldY * layer.vfreq, wz * layer.freq, layer.octaves);
          const b = noise.fbm3(
            wz * layer.freq + layer.offset,
            worldY * layer.vfreq + layer.offset,
            wx * layer.freq + layer.offset,
            layer.octaves,
          );
          density = Math.min(a, b) - layer.threshold;
        } else {
          density =
            noise.fbm3(
              wx * layer.freq + layer.offset,
              worldY * layer.vfreq + layer.offset,
              wz * layer.freq - layer.offset,
              layer.octaves,
            ) - layer.threshold;
        }
        row[gx * GRID_N + gz] = density;
      }
    }
    return row;
  }
}

/**
 * Fills the deep caverns of the overworld with lava (aquifers) and the
 * carved nether caverns with lava.
 */
export function fillCaveFluids(
  blocks: Uint8Array,
  cx: number,
  cz: number,
  heights: Int16Array,
  noise: Noise,
  dimension: 'overworld' | 'nether' | 'end',
): void {
  if (dimension === 'end') return;

  const baseX = cx * CHUNK_X;
  const baseZ = cz * CHUNK_Z;
  // Below this level the overworld is hot enough to hold lava lakes; the
  // nether is one big lava sea.
  const lavaLevel = dimension === 'nether' ? 31 : 10;

  for (let x = 0; x < CHUNK_X; x++) {
    for (let z = 0; z < CHUNK_Z; z++) {
      const ci = x * CHUNK_Z + z;
      const limit = Math.min(heights[ci] - 4, lavaLevel);
      if (limit <= WORLD_MIN_Y + 1) continue;

      // Aquifers are large regions; inside them the caves flood with lava,
      // outside them the caves stay dry and airy.
      const aquifer =
        dimension === 'nether' ||
        noise.fbm2((baseX + x) * 0.006, (baseZ + z) * 0.006, 2) > 0;

      for (let y = WORLD_MIN_Y + 1; y <= limit; y++) {
        const idx = blockIndex(x, y, z);
        if (blocks[idx] !== BLOCK_IDS.air) continue;
        if (aquifer) blocks[idx] = BLOCK_IDS.lava;
      }
    }
  }
}

/**
 * The End dimension: one large central island plus scattered floating
 * islands over the void.
 *
 * The End has no caves, so it gets its own generator path instead of
 * running through the overworld carve.
 */
export function generateEndChunk(
  seed: number,
  cx: number,
  cz: number,
  blocks: Uint8Array,
  heights: Int16Array,
): void {
  const noise = endNoise(seed);
  const baseX = cx * CHUNK_X;
  const baseZ = cz * CHUNK_Z;

  for (let x = 0; x < CHUNK_X; x++) {
    for (let z = 0; z < CHUNK_Z; z++) {
      const wx = baseX + x;
      const wz = baseZ + z;
      const ci = x * CHUNK_Z + z;

      const island = endIslandHeight(noise, wx, wz);
      if (!island) {
        heights[ci] = WORLD_MIN_Y;
        continue;
      }

      heights[ci] = island.top;
      for (let y = Math.max(WORLD_MIN_Y, island.bottom); y <= island.top; y++) {
        blocks[blockIndex(x, y, z)] = BLOCK_IDS.end_stone;
      }
    }
  }
}

/**
 * The noise field of the End islands.
 *
 * It is created from the plain world seed (not a derived one) so that the
 * terrain sampler and the island builder agree on where the islands are.
 */
const END_NOISE = new Map<number, Noise>();

function endNoise(seed: number): Noise {
  const cached = END_NOISE.get(seed);
  if (cached) return cached;
  const noise = new Noise(seed);
  END_NOISE.set(seed, noise);
  return noise;
}
