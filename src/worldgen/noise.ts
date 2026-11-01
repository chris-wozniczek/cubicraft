/**
 * Cubicraft — in-house noise primitives.
 *
 * The world must be identical on every peer, so the noise cannot come from a
 * third-party library: the permutation table, the gradient set and the fBm
 * accumulation order are all fixed here and never change.
 *
 * CONTINUITY RULE (critical):
 *   Terrain noise MUST be sampled in WORLD space — absolute block X/Z, never
 *   chunk-local coordinates. A per-chunk sample would give chunk (0,0) and
 *   chunk (1,0) unrelated values at the shared border and the terrain would
 *   show a seam. Per-chunk seeded PRNGs (`SeededRng.forPosition`) are used
 *   only for *decoration placement*, which is a discrete, per-column decision.
 */

import { mulberry32 } from '../core/rng';

/** 2D simplex skew/unskew constants. */
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
/** 3D simplex skew/unskew constants. */
const F3 = 1 / 3;
const G3 = 1 / 6;

/**
 * The 12 edge gradients of a cube, used by both the simplex and the
 * perlin-style implementations. Kept as a flat table so the hot loops only
 * do a single array read per component.
 */
const GRAD3 = new Float32Array([
  1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0,
  1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1,
  0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1,
]);

/** Normalisation factor that maps the raw simplex sum into roughly -1..1. */
const SIMPLEX2_SCALE = 70;
const SIMPLEX3_SCALE = 32;

/** Result of a domain warp: displaced sample coordinates. */
export interface Warp2 {
  x: number;
  y: number;
}

/**
 * Deterministic noise field.
 *
 * All methods are pure functions of the coordinates handed in, so the same
 * world-space sample always yields the same value no matter which chunk
 * asks for it. That is what keeps chunk borders seamless.
 */
export class Noise {
  /** Doubled permutation table (indexed with `& 255` to avoid a modulo). */
  private readonly perm = new Uint8Array(512);
  /** `perm[i] % 12` — the gradient index, precomputed for the hot loop. */
  private readonly gradIndex = new Uint8Array(512);

  constructor(seed: number) {
    const base = new Uint8Array(256);
    for (let i = 0; i < 256; i++) base[i] = i;

    // Fisher-Yates with a seeded stream: the table is the only thing that
    // ties a noise field to a world seed.
    const rnd = mulberry32(seed >>> 0);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const tmp = base[i];
      base[i] = base[j];
      base[j] = tmp;
    }

    for (let i = 0; i < 512; i++) {
      this.perm[i] = base[i & 255];
      this.gradIndex[i] = this.perm[i] % 12;
    }
  }

  /** 2D simplex noise in roughly -1..1. */
  noise2(xin: number, yin: number): number {
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);

    let i1: number;
    let j1: number;
    if (x0 > y0) {
      i1 = 1;
      j1 = 0;
    } else {
      i1 = 0;
      j1 = 1;
    }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;

    const ii = i & 255;
    const jj = j & 255;

    let n0 = 0;
    let n1 = 0;
    let n2 = 0;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) {
      t0 *= t0;
      const g = this.gradIndex[ii + this.perm[jj]] * 3;
      n0 = t0 * t0 * (GRAD3[g] * x0 + GRAD3[g + 1] * y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) {
      t1 *= t1;
      const g = this.gradIndex[ii + i1 + this.perm[jj + j1]] * 3;
      n1 = t1 * t1 * (GRAD3[g] * x1 + GRAD3[g + 1] * y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) {
      t2 *= t2;
      const g = this.gradIndex[ii + 1 + this.perm[jj + 1]] * 3;
      n2 = t2 * t2 * (GRAD3[g] * x2 + GRAD3[g + 1] * y2);
    }

    return SIMPLEX2_SCALE * (n0 + n1 + n2);
  }

  /** 3D simplex noise in roughly -1..1. */
  noise3(xin: number, yin: number, zin: number): number {
    const s = (xin + yin + zin) * F3;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const k = Math.floor(zin + s);
    const t = (i + j + k) * G3;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);
    const z0 = zin - (k - t);

    let i1: number;
    let j1: number;
    let k1: number;
    let i2: number;
    let j2: number;
    let k2: number;

    if (x0 >= y0) {
      if (y0 >= z0) {
        i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0;
      } else if (x0 >= z0) {
        i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1;
      } else {
        i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1;
      }
    } else {
      if (y0 < z0) {
        i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1;
      } else if (x0 < z0) {
        i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1;
      } else {
        i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0;
      }
    }

    const x1 = x0 - i1 + G3;
    const y1 = y0 - j1 + G3;
    const z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3;
    const y2 = y0 - j2 + 2 * G3;
    const z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3;
    const y3 = y0 - 1 + 3 * G3;
    const z3 = z0 - 1 + 3 * G3;

    const ii = i & 255;
    const jj = j & 255;
    const kk = k & 255;

    let n0 = 0;
    let n1 = 0;
    let n2 = 0;
    let n3 = 0;

    let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    if (t0 > 0) {
      t0 *= t0;
      const g = this.gradIndex[ii + this.perm[jj + this.perm[kk]]] * 3;
      n0 = t0 * t0 * (GRAD3[g] * x0 + GRAD3[g + 1] * y0 + GRAD3[g + 2] * z0);
    }

    let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (t1 > 0) {
      t1 *= t1;
      const g = this.gradIndex[ii + i1 + this.perm[jj + j1 + this.perm[kk + k1]]] * 3;
      n1 = t1 * t1 * (GRAD3[g] * x1 + GRAD3[g + 1] * y1 + GRAD3[g + 2] * z1);
    }

    let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (t2 > 0) {
      t2 *= t2;
      const g = this.gradIndex[ii + i2 + this.perm[jj + j2 + this.perm[kk + k2]]] * 3;
      n2 = t2 * t2 * (GRAD3[g] * x2 + GRAD3[g + 1] * y2 + GRAD3[g + 2] * z2);
    }

    let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (t3 > 0) {
      t3 *= t3;
      const g = this.gradIndex[ii + 1 + this.perm[jj + 1 + this.perm[kk + 1]]] * 3;
      n3 = t3 * t3 * (GRAD3[g] * x3 + GRAD3[g + 1] * y3 + GRAD3[g + 2] * z3);
    }

    return SIMPLEX3_SCALE * (n0 + n1 + n2 + n3);
  }

  /** Classic perlin-style gradient noise, 2D, roughly -1..1. */
  perlin2(x: number, y: number): number {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
    const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);

    const ii = xi & 255;
    const jj = yi & 255;

    const g00 = this.gradIndex[ii + this.perm[jj]] * 3;
    const g10 = this.gradIndex[ii + 1 + this.perm[jj]] * 3;
    const g01 = this.gradIndex[ii + this.perm[jj + 1]] * 3;
    const g11 = this.gradIndex[ii + 1 + this.perm[jj + 1]] * 3;

    const n00 = GRAD3[g00] * xf + GRAD3[g00 + 1] * yf;
    const n10 = GRAD3[g10] * (xf - 1) + GRAD3[g10 + 1] * yf;
    const n01 = GRAD3[g01] * xf + GRAD3[g01 + 1] * (yf - 1);
    const n11 = GRAD3[g11] * (xf - 1) + GRAD3[g11 + 1] * (yf - 1);

    const nx0 = n00 + u * (n10 - n00);
    const nx1 = n01 + u * (n11 - n01);
    return (nx0 + v * (nx1 - nx0)) * 1.4;
  }

  /** Classic perlin-style gradient noise, 3D, roughly -1..1. */
  perlin3(x: number, y: number, z: number): number {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const zi = Math.floor(z);
    const xf = x - xi;
    const yf = y - yi;
    const zf = z - zi;
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
    const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
    const w = zf * zf * zf * (zf * (zf * 6 - 15) + 10);

    const ii = xi & 255;
    const jj = yi & 255;
    const kk = zi & 255;

    const a = this.gradIndex[ii + this.perm[jj + this.perm[kk]]] * 3;
    const b = this.gradIndex[ii + 1 + this.perm[jj + this.perm[kk]]] * 3;
    const c = this.gradIndex[ii + this.perm[jj + 1 + this.perm[kk]]] * 3;
    const d = this.gradIndex[ii + 1 + this.perm[jj + 1 + this.perm[kk]]] * 3;
    const e = this.gradIndex[ii + this.perm[jj + this.perm[kk + 1]]] * 3;
    const f = this.gradIndex[ii + 1 + this.perm[jj + this.perm[kk + 1]]] * 3;
    const g = this.gradIndex[ii + this.perm[jj + 1 + this.perm[kk + 1]]] * 3;
    const h = this.gradIndex[ii + 1 + this.perm[jj + 1 + this.perm[kk + 1]]] * 3;

    const n000 = GRAD3[a] * xf + GRAD3[a + 1] * yf + GRAD3[a + 2] * zf;
    const n100 = GRAD3[b] * (xf - 1) + GRAD3[b + 1] * yf + GRAD3[b + 2] * zf;
    const n010 = GRAD3[c] * xf + GRAD3[c + 1] * (yf - 1) + GRAD3[c + 2] * zf;
    const n110 = GRAD3[d] * (xf - 1) + GRAD3[d + 1] * (yf - 1) + GRAD3[d + 2] * zf;
    const n001 = GRAD3[e] * xf + GRAD3[e + 1] * yf + GRAD3[e + 2] * (zf - 1);
    const n101 = GRAD3[f] * (xf - 1) + GRAD3[f + 1] * yf + GRAD3[f + 2] * (zf - 1);
    const n011 = GRAD3[g] * xf + GRAD3[g + 1] * (yf - 1) + GRAD3[g + 2] * (zf - 1);
    const n111 = GRAD3[h] * (xf - 1) + GRAD3[h + 1] * (yf - 1) + GRAD3[h + 2] * (zf - 1);

    const x00 = n000 + u * (n100 - n000);
    const x10 = n010 + u * (n110 - n010);
    const x01 = n001 + u * (n101 - n001);
    const x11 = n011 + u * (n111 - n011);
    const y0 = x00 + v * (x10 - x00);
    const y1 = x01 + v * (x11 - x01);
    return (y0 + w * (y1 - y0)) * 1.1;
  }

  /**
   * Fractal Brownian motion, 2D.
   *
   * The sum is normalised by the total amplitude so the result stays in
   * roughly -1..1 regardless of the octave count.
   */
  fbm2(x: number, y: number, octaves: number, lacunarity = 2, gain = 0.5): number {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * this.noise2(x * freq, y * freq);
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return norm > 0 ? sum / norm : 0;
  }

  /** Fractal Brownian motion, 3D. */
  fbm3(x: number, y: number, z: number, octaves: number, lacunarity = 2, gain = 0.5): number {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * this.noise3(x * freq, y * freq, z * freq);
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return norm > 0 ? sum / norm : 0;
  }

  /**
   * Ridged multifractal, 2D — returns 0..1 where 1 marks a ridge line.
   *
   * Used for river channels (narrow, connected waterways) and for the
   * ridged mountain spines.
   */
  ridged2(x: number, y: number, octaves: number, lacunarity = 2, gain = 0.5): number {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      const n = 1 - Math.abs(this.noise2(x * freq, y * freq));
      sum += amp * n * n;
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return norm > 0 ? sum / norm : 0;
  }

  /** Ridged multifractal, 3D — 0..1 where 1 marks a tube/ridge. */
  ridged3(x: number, y: number, z: number, octaves: number, lacunarity = 2, gain = 0.5): number {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      const n = 1 - Math.abs(this.noise3(x * freq, y * freq, z * freq));
      sum += amp * n * n;
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return norm > 0 ? sum / norm : 0;
  }

  /**
   * Domain warp: offsets the sample point by another noise field.
   *
   * Warping breaks up the "grid" look of plain fBm and gives coastlines and
   * cave tunnels their organic drift. The warp source is the same field, so
   * the result stays a pure function of the input coordinates.
   */
  warp2(x: number, y: number, strength: number, scale: number): Warp2 {
    const wx = this.noise2(x * scale + 11.3, y * scale - 7.7);
    const wy = this.noise2(x * scale - 5.1, y * scale + 19.4);
    return { x: x + wx * strength, y: y + wy * strength };
  }

  /** 3D domain warp. */
  warp3(x: number, y: number, z: number, strength: number, scale: number): [number, number, number] {
    const wx = this.noise3(x * scale + 11.3, y * scale - 7.7, z * scale + 3.1);
    const wy = this.noise3(x * scale - 5.1, y * scale + 19.4, z * scale - 8.8);
    const wz = this.noise3(x * scale + 2.7, y * scale + 4.4, z * scale + 13.6);
    return [x + wx * strength, y + wy * strength, z + wz * strength];
  }
}

/**
 * Piecewise-linear curve evaluated with smoothstep blending between knots.
 *
 * Smoothstep blending matters for terrain: it forces the derivative to zero
 * at every knot, which bounds the horizontal slope of the resulting height
 * field and therefore keeps neighbouring columns within one block of each
 * other.
 */
export function spline(points: readonly (readonly [number, number])[], x: number): number {
  const n = points.length;
  if (n === 0) return 0;
  if (x <= points[0][0]) return points[0][1];
  if (x >= points[n - 1][0]) return points[n - 1][1];

  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (x <= x1) {
      const span = x1 - x0;
      if (span <= 0) return y1;
      const t = (x - x0) / span;
      const s = t * t * (3 - 2 * t);
      return y0 + (y1 - y0) * s;
    }
  }
  return points[n - 1][1];
}

/** Clamp helper (kept local so the package has no core dependency here). */
export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Hermite smoothstep on [0,1]. */
export function smoothstep01(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t * t * (3 - 2 * t);
}
