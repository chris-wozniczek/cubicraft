/**
 * Cubicraft — procedural 64x64 Minecraft skin generator.
 *
 * The generator paints into a `PixelBuffer` (a plain RGBA byte buffer) and
 * only afterwards uploads it to a real canvas when one exists. That keeps the
 * headless (Node/test) output byte-identical to the browser output and makes
 * the whole thing testable without jsdom.
 *
 * SKIN REGION TABLE (Minecraft Java 1.8+ "modern" 64x64 layout).
 * Source: minotar/skin-spec (https://github.com/minotar/skin-spec), which
 * mirrors Mojang's own template. Coordinates are top-left origins in pixels:
 *
 *   head   top (8,0) 8x8   bottom (16,0) 8x8  right (0,8) 4x8
 *          front (8,8) 8x8 left (16,8) 4x8    back (24,8) 8x8
 *   torso  top (20,16) 8x4 bottom (28,16) 8x4 right (16,20) 4x12
 *          front (20,20) 8x12 left (28,20) 4x12 back (32,20) 8x12
 *   armR   top (44,16) 4x4 bottom (48,16) 4x4 right (40,20) 4x12
 *          front (44,20) 4x12 left (48,20) 4x12 back (52,20) 4x12
 *   armL   top (36,48) 4x4 bottom (40,48) 4x4 right (32,52) 4x12
 *          front (36,52) 4x12 left (40,52) 4x12 back (44,52) 4x12
 *   legR   top (4,16) 4x4 bottom (8,16) 4x4 right (0,20) 4x12
 *          front (4,20) 4x12 left (8,20) 4x12 back (12,20) 4x12
 *   legL   top (20,48) 4x4 bottom (24,48) 4x4 right (16,52) 4x12
 *          front (20,52) 4x12 left (24,52) 4x12 back (28,52) 4x12
 *
 * "right" is always the character's right hand side (-X when the model faces
 * +Z), "left" the character's left (+X).
 *
 * The unused areas of the atlas (the second/overlay layer) are painted with
 * the skin tone so the finished texture is fully opaque, as the game expects.
 */

import { CanvasTexture, NearestFilter, NearestMipmapLinearFilter, SRGBColorSpace } from 'three';
import type { AvatarSpec } from '../core/types';
import { getKit, HAIR_COLORS, HAIR_STYLES, SKIN_TONES } from './kits';
import type { KitDef, PaintOp } from './kits';

// ---------------------------------------------------------------------------
// Geometry of the texture
// ---------------------------------------------------------------------------

/** Edge length of the Minecraft skin texture. */
export const SKIN_SIZE = 64;

/** A rectangle in skin-texture pixels (top-left origin). */
export interface SkinRect { x: number; y: number; w: number; h: number }

/** The six faces of one box part. */
export interface SkinRegionSet {
  top: SkinRect; bottom: SkinRect; right: SkinRect; front: SkinRect; left: SkinRect; back: SkinRect;
}

export const SKIN_REGIONS: {
  head: SkinRegionSet; body: SkinRegionSet;
  armR: SkinRegionSet; armL: SkinRegionSet;
  legR: SkinRegionSet; legL: SkinRegionSet;
} = {
  head: {
    top: { x: 8, y: 0, w: 8, h: 8 },
    bottom: { x: 16, y: 0, w: 8, h: 8 },
    right: { x: 0, y: 8, w: 4, h: 8 },
    front: { x: 8, y: 8, w: 8, h: 8 },
    left: { x: 16, y: 8, w: 4, h: 8 },
    back: { x: 24, y: 8, w: 8, h: 8 },
  },
  body: {
    top: { x: 20, y: 16, w: 8, h: 4 },
    bottom: { x: 28, y: 16, w: 8, h: 4 },
    right: { x: 16, y: 20, w: 4, h: 12 },
    front: { x: 20, y: 20, w: 8, h: 12 },
    left: { x: 28, y: 20, w: 4, h: 12 },
    back: { x: 32, y: 20, w: 8, h: 12 },
  },
  armR: {
    top: { x: 44, y: 16, w: 4, h: 4 },
    bottom: { x: 48, y: 16, w: 4, h: 4 },
    right: { x: 40, y: 20, w: 4, h: 12 },
    front: { x: 44, y: 20, w: 4, h: 12 },
    left: { x: 48, y: 20, w: 4, h: 12 },
    back: { x: 52, y: 20, w: 4, h: 12 },
  },
  armL: {
    top: { x: 36, y: 48, w: 4, h: 4 },
    bottom: { x: 40, y: 48, w: 4, h: 4 },
    right: { x: 32, y: 52, w: 4, h: 12 },
    front: { x: 36, y: 52, w: 4, h: 12 },
    left: { x: 40, y: 52, w: 4, h: 12 },
    back: { x: 44, y: 52, w: 4, h: 12 },
  },
  legR: {
    top: { x: 4, y: 16, w: 4, h: 4 },
    bottom: { x: 8, y: 16, w: 4, h: 4 },
    right: { x: 0, y: 20, w: 4, h: 12 },
    front: { x: 4, y: 20, w: 4, h: 12 },
    left: { x: 8, y: 20, w: 4, h: 12 },
    back: { x: 12, y: 20, w: 4, h: 12 },
  },
  legL: {
    top: { x: 20, y: 48, w: 4, h: 4 },
    bottom: { x: 24, y: 48, w: 4, h: 4 },
    right: { x: 16, y: 52, w: 4, h: 12 },
    front: { x: 20, y: 52, w: 4, h: 12 },
    left: { x: 24, y: 52, w: 4, h: 12 },
    back: { x: 28, y: 52, w: 4, h: 12 },
  },
};

/** Rows of an arm covered by the sleeve (Minecraft convention). */
const SLEEVE_ROWS = 4;
/** Rows of a leg covered by the shorts. */
const SHORTS_ROWS = 4;
/** Rows of a leg covered by the socks. */
const SOCK_ROWS = 8;

// ---------------------------------------------------------------------------
// Colour handling
// ---------------------------------------------------------------------------

export interface RGBA { r: number; g: number; b: number; a: number }

/** Parse `#RGB`, `#RRGGBB` or `#RRGGBBAA`. */
export function parseColor(hex: string): RGBA {
  let s = hex.trim().replace(/^#/, '');
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  if (s.length !== 6 && s.length !== 8) throw new Error(`Invalid colour: ${hex}`);
  const r = parseInt(s.slice(0, 2), 16);
  const g = parseInt(s.slice(2, 4), 16);
  const b = parseInt(s.slice(4, 6), 16);
  const a = s.length === 8 ? parseInt(s.slice(6, 8), 16) : 255;
  return { r, g, b, a };
}

function mixColor(a: RGBA, b: RGBA, t: number): RGBA {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
    a: Math.round(a.a + (b.a - a.a) * t),
  };
}

// ---------------------------------------------------------------------------
// Software rasteriser
// ---------------------------------------------------------------------------

/**
 * A plain RGBA pixel buffer with a `fillRect`-like API. This is the fallback
 * used when no DOM canvas is available (Node, unit tests).
 */
export class PixelBuffer {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;

  constructor(width: number, height: number, fill?: RGBA) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
    if (fill) this.fill(fill);
  }

  /** Fill the whole buffer with one colour. */
  fill(rgba: RGBA): void {
    for (let i = 0; i < this.data.length; i += 4) {
      this.data[i] = rgba.r;
      this.data[i + 1] = rgba.g;
      this.data[i + 2] = rgba.b;
      this.data[i + 3] = rgba.a;
    }
  }

  /** Source-over blend of one pixel. */
  setPixel(x: number, y: number, rgba: RGBA): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    if (rgba.a >= 255) {
      this.data[i] = rgba.r;
      this.data[i + 1] = rgba.g;
      this.data[i + 2] = rgba.b;
      this.data[i + 3] = 255;
      return;
    }
    if (rgba.a <= 0) return;
    const sa = rgba.a / 255;
    const da = this.data[i + 3] / 255;
    const outA = sa + da * (1 - sa);
    if (outA <= 0) {
      this.data[i] = 0; this.data[i + 1] = 0; this.data[i + 2] = 0; this.data[i + 3] = 0;
      return;
    }
    this.data[i] = Math.round((rgba.r * sa + this.data[i] * da * (1 - sa)) / outA);
    this.data[i + 1] = Math.round((rgba.g * sa + this.data[i + 1] * da * (1 - sa)) / outA);
    this.data[i + 2] = Math.round((rgba.b * sa + this.data[i + 2] * da * (1 - sa)) / outA);
    this.data[i + 3] = Math.round(outA * 255);
  }

  /** Read one pixel; out of bounds reads are transparent black. */
  getPixel(x: number, y: number): RGBA {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return { r: 0, g: 0, b: 0, a: 0 };
    const i = (y * this.width + x) * 4;
    return { r: this.data[i], g: this.data[i + 1], b: this.data[i + 2], a: this.data[i + 3] };
  }

  /** Blended fill of a rectangle. */
  fillRect(x: number, y: number, w: number, h: number, rgba: RGBA): void {
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) this.setPixel(px, py, rgba);
    }
  }
}

/** The tiny drawing API the paint-op interpreter talks to. */
export interface Surface {
  fillRect(x: number, y: number, w: number, h: number, rgba: RGBA): void;
  setPixel(x: number, y: number, rgba: RGBA): void;
  getPixel(x: number, y: number): RGBA;
}

type AnyCtx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/**
 * Backend that wraps either a real canvas 2D context or a `PixelBuffer`.
 *
 * All drawing is rasterised into the buffer first and then uploaded with a
 * single `putImageData`, so the headless and the browser produce exactly the
 * same pixels.
 */
export class Canvas2DBackend implements Surface {
  readonly buffer: PixelBuffer;
  private readonly ctx: AnyCtx2D | null;

  constructor(target: PixelBuffer | AnyCtx2D, width = SKIN_SIZE, height = SKIN_SIZE) {
    if (target instanceof PixelBuffer) {
      this.buffer = target;
      this.ctx = null;
    } else {
      this.buffer = new PixelBuffer(width, height);
      this.ctx = target;
    }
  }

  fillRect(x: number, y: number, w: number, h: number, rgba: RGBA): void {
    this.buffer.fillRect(x, y, w, h, rgba);
  }

  setPixel(x: number, y: number, rgba: RGBA): void {
    this.buffer.setPixel(x, y, rgba);
  }

  getPixel(x: number, y: number): RGBA {
    return this.buffer.getPixel(x, y);
  }

  /** Push the rasterised pixels into the wrapped canvas context. */
  flush(): void {
    if (!this.ctx) return;
    const image = new ImageData(
      new Uint8ClampedArray(this.buffer.data),
      this.buffer.width,
      this.buffer.height,
    );
    this.ctx.putImageData(image, 0, 0);
  }
}

// ---------------------------------------------------------------------------
// Blocky 5x7 font
// ---------------------------------------------------------------------------

/**
 * 5x7 bitmap font: one entry per character, seven rows, five bits per row
 * (bit 4 = leftmost pixel).
 */
export const BLOCKY_FONT: Record<string, number[]> = {
  '0': [14, 17, 19, 21, 25, 17, 14],
  '1': [4, 12, 4, 4, 4, 4, 14],
  '2': [14, 17, 1, 2, 4, 8, 31],
  '3': [31, 2, 4, 2, 1, 17, 14],
  '4': [2, 6, 10, 18, 31, 2, 2],
  '5': [31, 16, 30, 1, 1, 17, 14],
  '6': [6, 8, 16, 30, 17, 17, 14],
  '7': [31, 1, 2, 4, 8, 8, 8],
  '8': [14, 17, 17, 14, 17, 17, 14],
  '9': [14, 17, 17, 15, 1, 2, 12],
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14],
  D: [28, 18, 17, 17, 17, 18, 28],
  E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 17, 25, 21, 19, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 27, 17],
  X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4],
  Z: [31, 1, 2, 4, 8, 16, 31],
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '-': [0, 0, 0, 31, 0, 0, 0],
  '.': [0, 0, 0, 0, 0, 12, 12],
};

const GLYPH_W = 5;
const GLYPH_H = 7;
/** Glyph width plus one blank column. */
const GLYPH_ADVANCE = 6;

/** Width in pixels of `text` rendered at `scale`. */
export function measureText(text: string, scale: number): number {
  return Math.max(0, text.length * GLYPH_ADVANCE * scale - scale);
}

/**
 * Draw text with the blocky font. The text is shrunk (never grown) so it fits
 * `maxWidth`; that is what makes an 8 pixel wide sponsor wordmark possible.
 */
function drawText(
  surface: Surface, text: string, color: RGBA,
  x: number, y: number, scale: number, blocky: boolean, maxWidth: number,
): void {
  const upper = text.toUpperCase();
  let s = scale;
  const width = measureText(upper, s);
  if (width > maxWidth && width > 0) s = Math.max(0.08, s * (maxWidth / width));
  const glyphs = upper.split('').map((ch) => BLOCKY_FONT[ch] ?? BLOCKY_FONT[' ']);
  const height = GLYPH_H * s;
  const totalWidth = Math.ceil(glyphs.length * GLYPH_ADVANCE * s);

  for (let py = 0; py < Math.ceil(height); py++) {
    for (let px = 0; px < totalWidth; px++) {
      // Source area of this output pixel, in font pixels.
      const tx0 = px / s;
      const tx1 = (px + 1) / s;
      const sy0 = py / s;
      const sy1 = (py + 1) / s;
      let ink = 0;
      let total = 0;
      for (let sy = Math.floor(sy0); sy < Math.ceil(sy1); sy++) {
        for (let col = Math.floor(tx0); col < Math.ceil(tx1); col++) {
          total++;
          if (sy < 0 || sy >= GLYPH_H) continue;
          const gi = Math.floor(col / GLYPH_ADVANCE);
          const lc = col - gi * GLYPH_ADVANCE;
          if (gi >= glyphs.length || lc < 0 || lc >= GLYPH_W) continue;
          const row = glyphs[gi][sy] ?? 0;
          const bit = (row >>> (GLYPH_W - 1 - lc)) & 1;
          if (bit) ink++;
        }
      }
      if (total === 0) continue;
      const coverage = ink / total;
      if (blocky) {
        // Keep the colour exact: a pixel is ink or it is nothing. Glyphs
        // shrunk below their native size need a looser threshold, otherwise
        // thin strokes (the stem of a "7") disappear completely.
        const threshold = s >= 1 ? 0.5 : 0.2;
        if (coverage >= threshold) surface.setPixel(x + px, y + py, color);
      } else {
        surface.setPixel(x + px, y + py, { ...color, a: Math.round(color.a * coverage) });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Paint-op interpreter
// ---------------------------------------------------------------------------

interface OpContext {
  kit: KitDef;
  number: number;
}

function paintOps(surface: Surface, ops: PaintOp[], rect: SkinRect, ctx: OpContext): void {
  for (const op of ops) {
    switch (op.op) {
      case 'fill': {
        surface.fillRect(rect.x, rect.y, rect.w, rect.h, parseColor(op.color));
        break;
      }
      case 'stripe': {
        const rgba = parseColor(op.color);
        const period = op.width * 2;
        const start = ((op.offset ?? 0) % period + period) % period;
        if (op.horizontal) {
          for (let ly = start; ly < rect.h; ly += period) {
            const h = Math.min(op.width, rect.h - ly);
            surface.fillRect(rect.x, rect.y + ly, rect.w, h, rgba);
          }
        } else {
          for (let lx = start; lx < rect.w; lx += period) {
            const w = Math.min(op.width, rect.w - lx);
            surface.fillRect(rect.x + lx, rect.y, w, rect.h, rgba);
          }
        }
        break;
      }
      case 'gradient': {
        const from = parseColor(op.from);
        const to = parseColor(op.to);
        const rad = ((op.angle ?? 90) * Math.PI) / 180;
        const dx = Math.cos(rad);
        const dy = Math.sin(rad);
        const span = (Math.abs(dx) * rect.w + Math.abs(dy) * rect.h) / 2 || 1;
        for (let ly = 0; ly < rect.h; ly++) {
          for (let lx = 0; lx < rect.w; lx++) {
            const t = clamp01(((lx - rect.w / 2) * dx + (ly - rect.h / 2) * dy) / span + 0.5);
            surface.setPixel(rect.x + lx, rect.y + ly, mixColor(from, to, t));
          }
        }
        break;
      }
      case 'dots': {
        const rgba = parseColor(op.color);
        const r = op.radius ?? 0.5;
        const spacing = Math.max(1, op.spacing);
        for (let ly = 0; ly < rect.h; ly++) {
          if (op.half === 'top' && ly >= rect.h / 2) continue;
          if (op.half === 'bottom' && ly < rect.h / 2) continue;
          for (let lx = 0; lx < rect.w; lx++) {
            const cx = Math.floor(lx / spacing) * spacing + spacing / 2;
            const cy = Math.floor(ly / spacing) * spacing + spacing / 2;
            const ddx = lx - cx;
            const ddy = ly - cy;
            if (ddx * ddx + ddy * ddy <= r * r) surface.setPixel(rect.x + lx, rect.y + ly, rgba);
          }
        }
        break;
      }
      case 'arc': {
        const rgba = parseColor(op.color);
        const half = (op.width - 1) / 2;
        for (let lx = 0; lx < rect.w; lx++) {
          const t = rect.w > 1 ? lx / (rect.w - 1) : 0;
          const centre = op.y + Math.sin(t * Math.PI * 2 - Math.PI / 2) * op.curve;
          const top = Math.round(centre - half);
          const bottom = Math.round(centre + half);
          for (let ly = top; ly <= bottom; ly++) {
            if (ly < 0 || ly >= rect.h) continue;
            surface.setPixel(rect.x + lx, rect.y + ly, rgba);
          }
        }
        break;
      }
      case 'band': {
        const rgba = parseColor(op.color);
        const y = Math.max(0, Math.min(rect.h - 1, op.y));
        const h = Math.max(1, Math.min(rect.h - y, op.height));
        surface.fillRect(rect.x, rect.y + y, rect.w, h, rgba);
        break;
      }
      case 'tri': {
        const rgba = parseColor(op.color);
        for (let ly = 0; ly < rect.h; ly++) {
          for (let lx = 0; lx < rect.w; lx++) {
            const fx = lx / rect.w;
            const fy = ly / rect.h;
            let inside = false;
            if (op.corner === 'tl') inside = fx + fy <= 1;
            else if (op.corner === 'tr') inside = (1 - fx) + fy <= 1;
            else if (op.corner === 'bl') inside = fx + (1 - fy) <= 1;
            else inside = (1 - fx) + (1 - fy) <= 1;
            if (inside) surface.setPixel(rect.x + lx, rect.y + ly, rgba);
          }
        }
        break;
      }
      case 'text': {
        const rgba = parseColor(op.color);
        drawText(surface, op.text, rgba, rect.x + op.x, rect.y + op.y,
          op.scale ?? 1, op.blocky ?? true, rect.w - op.x);
        break;
      }
      case 'sprite': {
        drawSprite(surface, op.name, {
          x: rect.x + op.x, y: rect.y + op.y, w: op.w, h: op.h,
        }, ctx.kit);
        break;
      }
      case 'number': {
        const rgba = parseColor(op.color);
        const scale = op.height / GLYPH_H;
        drawText(surface, String(ctx.number), rgba, rect.x + op.x, rect.y + op.y,
          scale, true, rect.w - op.x);
        break;
      }
    }
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// ---------------------------------------------------------------------------
// Sprites, crest and maker's mark
// ---------------------------------------------------------------------------

/**
 * Small procedural marks drawn inside a region.
 * `w`/`h` come from the sprite op and are respected where possible.
 */
function drawSprite(surface: Surface, name: string, rect: SkinRect, kit: KitDef): void {
  switch (name) {
    case 'three_stripes': {
      // Adidas three-stripes: three parallel diagonal bars over the shoulder.
      const c = parseColor(kit.palette.maker);
      const drift = Math.max(0, rect.w - 3);
      for (let stripe = 0; stripe < 3; stripe++) {
        for (let y = 0; y < rect.h; y++) {
          const shift = rect.h > 1 ? Math.round((y * drift) / (rect.h - 1)) : 0;
          const x = stripe + shift;
          if (x < rect.w) surface.setPixel(rect.x + x, rect.y + y, c);
        }
      }
      break;
    }
    case 'swoosh': {
      // Nike maker's mark: a rising tick.
      const c = parseColor(kit.palette.maker);
      const pattern = [
        [0, 3], [1, 3], [1, 2], [2, 2], [2, 1], [3, 1], [3, 0],
      ];
      for (const [dx, dy] of pattern) {
        if (dx < rect.w && dy < rect.h) surface.setPixel(rect.x + dx, rect.y + dy, c);
      }
      break;
    }
    case 'senyera': {
      // Catalan flag: red bars on yellow.
      const red = parseColor('#DA121A');
      const yellow = parseColor('#FCDD09');
      for (let ly = 0; ly < rect.h; ly++) {
        const c = ly % 2 === 0 ? red : yellow;
        surface.fillRect(rect.x, rect.y + ly, rect.w, 1, c);
      }
      break;
    }
    default:
      break;
  }
}

/** 5x6 club crests, drawn from a tiny pixel map. */
const CREST_ART: Record<'crown' | 'shield', readonly string[]> = {
  crown: ['g.g.g', 'ggggg', 'wwwww', 'wgggw', 'wwwww', '.www.'],
  shield: ['wwbbb', 'wwbbb', 'brbrb', 'brbrb', 'brbrb', '.brb.'],
};

function drawCrest(surface: Surface, rect: SkinRect, kit: KitDef): void {
  const art = CREST_ART[kit.crest.style];
  const primary = parseColor(kit.crest.primary);
  const secondary = parseColor(kit.crest.secondary);
  const white = parseColor('#FFFFFF');
  for (let ly = 0; ly < art.length; ly++) {
    const row = art[ly];
    for (let lx = 0; lx < row.length; lx++) {
      const ch = row[lx];
      let colour: RGBA | null = null;
      if (kit.crest.style === 'crown') {
        if (ch === 'g') colour = secondary;
        else if (ch === 'w') colour = primary;
      } else {
        if (ch === 'b') colour = primary;
        else if (ch === 'r') colour = secondary;
        else if (ch === 'w') colour = white;
      }
      if (!colour) continue;
      surface.setPixel(rect.x + lx, rect.y + ly, colour);
    }
  }
}

/** Tiny maker's mark on the right chest. */
function drawMakerMark(surface: Surface, rect: SkinRect, kit: KitDef): void {
  const c = parseColor(kit.palette.maker);
  const x = rect.x + rect.w - 3;
  const y = rect.y + 1;
  if (kit.tags.includes('adidas')) {
    for (let i = 0; i < 3; i++) surface.fillRect(x + i, y, 1, 2, c);
  } else if (kit.tags.includes('nike')) {
    const pattern = [[0, 1], [1, 1], [1, 0], [2, 0]];
    for (const [dx, dy] of pattern) surface.setPixel(x + dx, y + dy, c);
  } else {
    surface.fillRect(x + 1, y, 1, 2, c);
  }
}

// ---------------------------------------------------------------------------
// Skin painting
// ---------------------------------------------------------------------------

function fillRegion(surface: Surface, rect: SkinRect, rgba: RGBA): void {
  surface.fillRect(rect.x, rect.y, rect.w, rect.h, rgba);
}

function fillRegionRows(surface: Surface, rect: SkinRect, fromRow: number, toRow: number, rgba: RGBA): void {
  const top = Math.max(0, fromRow);
  const bottom = Math.min(rect.h, toRow);
  if (bottom <= top) return;
  surface.fillRect(rect.x, rect.y + top, rect.w, bottom - top, rgba);
}

const EYE_COLOUR = parseColor('#2A1B12');
const MOUTH_COLOUR = parseColor('#7A4A3A');

function paintHead(surface: Surface, style: number, skin: RGBA, hair: RGBA): void {
  const head = SKIN_REGIONS.head;
  fillRegion(surface, head.top, skin);
  fillRegion(surface, head.bottom, skin);
  fillRegion(surface, head.right, skin);
  fillRegion(surface, head.left, skin);
  fillRegion(surface, head.front, skin);
  fillRegion(surface, head.back, skin);

  // Face: eyes and a mouth on the front of the head.
  surface.fillRect(head.front.x + 1, head.front.y + 4, 2, 1, EYE_COLOUR);
  surface.fillRect(head.front.x + 5, head.front.y + 4, 2, 1, EYE_COLOUR);
  surface.fillRect(head.front.x + 3, head.front.y + 6, 2, 1, MOUTH_COLOUR);

  const cap = parseColor('#B23A2E');
  switch (style) {
    case 0: // short
      fillRegion(surface, head.top, hair);
      fillRegionRows(surface, head.right, 0, 2, hair);
      fillRegionRows(surface, head.left, 0, 2, hair);
      fillRegionRows(surface, head.front, 0, 2, hair);
      fillRegionRows(surface, head.back, 0, 2, hair);
      break;
    case 1: // spiky
      fillRegion(surface, head.top, hair);
      for (let x = 0; x < head.top.w; x++) {
        if (x % 2 === 0) surface.setPixel(head.top.x + x, head.top.y + 7, skin);
      }
      fillRegionRows(surface, head.right, 0, 3, hair);
      fillRegionRows(surface, head.left, 0, 3, hair);
      fillRegionRows(surface, head.front, 0, 2, hair);
      fillRegionRows(surface, head.back, 0, 3, hair);
      break;
    case 2: // long
      fillRegionRows(surface, head.top, 0, 6, hair);
      // The hair sweeps backwards on the lower rows of the scalp.
      surface.fillRect(head.top.x + 2, head.top.y + 6, 4, 2, hair);
      fillRegionRows(surface, head.right, 0, 6, hair);
      fillRegionRows(surface, head.left, 0, 6, hair);
      fillRegionRows(surface, head.front, 0, 2, hair);
      fillRegionRows(surface, head.back, 0, 7, hair);
      break;
    case 3: // bald
      break;
    case 4: // mohawk
      surface.fillRect(head.top.x + 2, head.top.y, 4, head.top.h, hair);
      surface.fillRect(head.front.x + 3, head.front.y, 2, 4, hair);
      surface.fillRect(head.back.x + 3, head.back.y, 2, 4, hair);
      break;
    case 5: // afro
      fillRegion(surface, head.top, hair);
      surface.setPixel(head.top.x, head.top.y, skin);
      surface.setPixel(head.top.x + head.top.w - 1, head.top.y, skin);
      surface.setPixel(head.top.x, head.top.y + head.top.h - 1, skin);
      surface.setPixel(head.top.x + head.top.w - 1, head.top.y + head.top.h - 1, skin);
      fillRegionRows(surface, head.right, 0, 4, hair);
      fillRegionRows(surface, head.left, 0, 4, hair);
      fillRegionRows(surface, head.front, 0, 3, hair);
      fillRegionRows(surface, head.back, 0, 4, hair);
      break;
    case 6: // ponytail
      fillRegion(surface, head.top, hair);
      surface.fillRect(head.top.x + 2, head.top.y + head.top.h - 1, 4, 1, skin);
      fillRegionRows(surface, head.right, 0, 2, hair);
      fillRegionRows(surface, head.left, 0, 2, hair);
      fillRegionRows(surface, head.front, 0, 2, hair);
      fillRegionRows(surface, head.back, 0, 5, hair);
      surface.fillRect(head.back.x + 3, head.back.y + 5, 2, 3, hair);
      break;
    case 7: // buzz (dithered so it reads differently from "short")
      for (let y = 0; y < head.top.h; y++) {
        for (let x = 0; x < head.top.w; x++) {
          if ((x + y) % 2 === 0) surface.setPixel(head.top.x + x, head.top.y + y, hair);
        }
      }
      fillRegionRows(surface, head.right, 0, 1, hair);
      fillRegionRows(surface, head.left, 0, 1, hair);
      fillRegionRows(surface, head.front, 0, 1, hair);
      fillRegionRows(surface, head.back, 0, 1, hair);
      break;
    case 8: // side part
      fillRegion(surface, head.top, hair);
      surface.fillRect(head.top.x, head.top.y, 2, 2, skin);
      fillRegionRows(surface, head.right, 0, 2, hair);
      fillRegionRows(surface, head.left, 0, 2, hair);
      fillRegionRows(surface, head.front, 0, 2, hair);
      surface.fillRect(head.front.x, head.front.y, 2, 2, skin);
      fillRegionRows(surface, head.back, 0, 2, hair);
      break;
    case 9: // curly
      fillRegion(surface, head.top, hair);
      for (let x = 0; x < head.top.w; x++) {
        if (x % 2 === 1) surface.setPixel(head.top.x + x, head.top.y + 7, skin);
        else surface.setPixel(head.top.x + x, head.top.y + 6, skin);
      }
      fillRegionRows(surface, head.right, 0, 3, hair);
      fillRegionRows(surface, head.left, 0, 3, hair);
      fillRegionRows(surface, head.front, 0, 3, hair);
      fillRegionRows(surface, head.back, 0, 3, hair);
      break;
    case 10: // headband
      fillRegion(surface, head.top, hair);
      fillRegionRows(surface, head.right, 0, 3, hair);
      fillRegionRows(surface, head.left, 0, 3, hair);
      fillRegionRows(surface, head.front, 0, 3, hair);
      fillRegionRows(surface, head.back, 0, 3, hair);
      surface.fillRect(head.front.x, head.front.y + 2, head.front.w, 1, parseColor('#F2F2F2'));
      surface.fillRect(head.right.x, head.right.y + 2, head.right.w, 1, parseColor('#F2F2F2'));
      surface.fillRect(head.left.x, head.left.y + 2, head.left.w, 1, parseColor('#F2F2F2'));
      // The band also runs over the top of the head.
      surface.fillRect(head.top.x, head.top.y + 2, head.top.w, 1, parseColor('#F2F2F2'));
      break;
    case 11: // cap
      fillRegion(surface, head.top, cap);
      fillRegionRows(surface, head.right, 0, 4, cap);
      fillRegionRows(surface, head.left, 0, 4, cap);
      fillRegionRows(surface, head.back, 0, 4, cap);
      fillRegionRows(surface, head.front, 0, 3, cap);
      // Brim.
      surface.fillRect(head.front.x, head.front.y + 3, head.front.w, 1, parseColor('#8E2C22'));
      break;
    default:
      break;
  }
}

function paintTorso(surface: Surface, kit: KitDef, spec: AvatarSpec): void {
  const body = SKIN_REGIONS.body;
  const base = parseColor(kit.palette.base);
  fillRegion(surface, body.top, base);
  fillRegion(surface, body.bottom, base);
  fillRegion(surface, body.right, base);
  fillRegion(surface, body.left, base);

  const ctx: OpContext = { kit, number: spec.number };

  paintOps(surface, kit.regions.torsoFront, body.front, ctx);
  drawCrest(surface, { x: body.front.x, y: body.front.y + 1, w: 5, h: 6 }, kit);
  drawMakerMark(surface, body.front, kit);
  if (kit.number.front) {
    drawText(surface, String(spec.number), parseColor(kit.number.color),
      body.front.x + 1, body.front.y + 9, 3 / GLYPH_H, true, body.front.w - 2);
  }

  paintOps(surface, kit.regions.torsoBack, body.back, ctx);
  // The player name sits above the shirt number.
  const numberOp = kit.regions.torsoBack.find((op) => op.op === 'number');
  const numberY = numberOp ? numberOp.y : 5;
  const numberX = numberOp ? numberOp.x : 1;
  if (spec.name) {
    drawText(surface, spec.name, parseColor(kit.palette.sponsor),
      body.back.x + numberX, body.back.y + Math.max(0, numberY - 2), 2 / GLYPH_H, true, body.back.w - numberX);
  }
  if (!numberOp && kit.number.back) {
    drawText(surface, String(spec.number), parseColor(kit.number.color),
      body.back.x + numberX, body.back.y + numberY, 5 / GLYPH_H, true, body.back.w - numberX);
  }
}

function paintArm(surface: Surface, kit: KitDef, part: 'armR' | 'armL', skin: RGBA): void {
  const arm = SKIN_REGIONS[part];
  const ctx: OpContext = { kit, number: 0 };
  fillRegion(surface, arm.top, skin);
  fillRegion(surface, arm.bottom, skin);
  fillRegion(surface, arm.right, skin);
  fillRegion(surface, arm.left, skin);
  fillRegion(surface, arm.front, skin);
  fillRegion(surface, arm.back, skin);

  const sleeve = {
    right: { x: arm.right.x, y: arm.right.y, w: arm.right.w, h: SLEEVE_ROWS },
    left: { x: arm.left.x, y: arm.left.y, w: arm.left.w, h: SLEEVE_ROWS },
    front: { x: arm.front.x, y: arm.front.y, w: arm.front.w, h: SLEEVE_ROWS },
    back: { x: arm.back.x, y: arm.back.y, w: arm.back.w, h: SLEEVE_ROWS },
  };
  for (const rect of Object.values(sleeve)) paintOps(surface, kit.regions.armUpper, rect, ctx);

  const forearm = {
    right: { x: arm.right.x, y: arm.right.y + SLEEVE_ROWS, w: arm.right.w, h: 12 - SLEEVE_ROWS },
    left: { x: arm.left.x, y: arm.left.y + SLEEVE_ROWS, w: arm.left.w, h: 12 - SLEEVE_ROWS },
    front: { x: arm.front.x, y: arm.front.y + SLEEVE_ROWS, w: arm.front.w, h: 12 - SLEEVE_ROWS },
    back: { x: arm.back.x, y: arm.back.y + SLEEVE_ROWS, w: arm.back.w, h: 12 - SLEEVE_ROWS },
  };
  for (const rect of Object.values(forearm)) paintOps(surface, kit.regions.armLower, rect, ctx);
}

function paintLeg(surface: Surface, kit: KitDef, part: 'legR' | 'legL', skin: RGBA): void {
  const leg = SKIN_REGIONS[part];
  const ctx: OpContext = { kit, number: 0 };
  fillRegion(surface, leg.top, skin);
  fillRegion(surface, leg.bottom, skin);
  fillRegion(surface, leg.right, skin);
  fillRegion(surface, leg.left, skin);
  fillRegion(surface, leg.front, skin);
  fillRegion(surface, leg.back, skin);

  const shorts = {
    right: { x: leg.right.x, y: leg.right.y, w: leg.right.w, h: SHORTS_ROWS },
    left: { x: leg.left.x, y: leg.left.y, w: leg.left.w, h: SHORTS_ROWS },
    front: { x: leg.front.x, y: leg.front.y, w: leg.front.w, h: SHORTS_ROWS },
    back: { x: leg.back.x, y: leg.back.y, w: leg.back.w, h: SHORTS_ROWS },
  };
  for (const rect of Object.values(shorts)) paintOps(surface, kit.regions.legUpper, rect, ctx);

  const socks = {
    right: { x: leg.right.x, y: leg.right.y + SHORTS_ROWS, w: leg.right.w, h: SOCK_ROWS },
    left: { x: leg.left.x, y: leg.left.y + SHORTS_ROWS, w: leg.left.w, h: SOCK_ROWS },
    front: { x: leg.front.x, y: leg.front.y + SHORTS_ROWS, w: leg.front.w, h: SOCK_ROWS },
    back: { x: leg.back.x, y: leg.back.y + SHORTS_ROWS, w: leg.back.w, h: SOCK_ROWS },
  };
  for (const rect of Object.values(socks)) paintOps(surface, kit.regions.legLower, rect, ctx);
}

function paintSkin(buffer: PixelBuffer, spec: AvatarSpec): void {
  const kit = getKit(spec.kit);
  const skin = parseColor(SKIN_TONES[spec.skinTone % SKIN_TONES.length]);
  const hair = parseColor(HAIR_COLORS[spec.hairColor % HAIR_COLORS.length]);
  const style = HAIR_STYLES[spec.hair % HAIR_STYLES.length] ?? 0;

  // Everything starts as skin so the finished texture is fully opaque.
  buffer.fill(skin);
  paintHead(buffer, style, skin, hair);
  paintTorso(buffer, kit, spec);
  paintArm(buffer, kit, 'armR', skin);
  paintArm(buffer, kit, 'armL', skin);
  paintLeg(buffer, kit, 'legR', skin);
  paintLeg(buffer, kit, 'legL', skin);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** The canvas-like result of {@link generateSkinCanvas}. */
export type SkinCanvas = HTMLCanvasElement | OffscreenCanvas | PixelBuffer;

/** Maximum anisotropy used for generated skin textures. */
let maxAnisotropy = 1;

/**
 * Tell the generator how much anisotropy the renderer supports.
 * Call with `renderer.capabilities.getMaxAnisotropy()` once at start-up.
 */
export function setSkinAnisotropy(value: number): void {
  maxAnisotropy = Math.max(1, Math.floor(value));
}

function createCanvas(width: number, height: number): HTMLCanvasElement | OffscreenCanvas | null {
  try {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  } catch {
    // Fall through to the DOM canvas.
  }
  try {
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const el = document.createElement('canvas');
      el.width = width;
      el.height = height;
      return el;
    }
  } catch {
    // No DOM available.
  }
  return null;
}

function get2dContext(canvas: HTMLCanvasElement | OffscreenCanvas): AnyCtx2D | null {
  // Both canvas flavours expose the same 2D API; the union needs a cast.
  const ctx = (canvas as HTMLCanvasElement).getContext('2d') as AnyCtx2D | null;
  return ctx ?? null;
}

/**
 * Render the skin for `spec`.
 *
 * In a browser a real canvas is returned; in Node (tests, tools) the software
 * {@link PixelBuffer} is returned instead. Both hold the same pixels.
 */
export function generateSkinCanvas(spec: AvatarSpec): SkinCanvas {
  const canvas = createCanvas(SKIN_SIZE, SKIN_SIZE);
  const ctx = canvas ? get2dContext(canvas) : null;
  const backend = new Canvas2DBackend(ctx ?? new PixelBuffer(SKIN_SIZE, SKIN_SIZE), SKIN_SIZE, SKIN_SIZE);
  paintSkin(backend.buffer, spec);
  if (ctx && canvas) {
    backend.flush();
    return canvas;
  }
  return backend.buffer;
}

/** RGBA bytes of a rendered skin, whatever kind of canvas it came from. */
export function getSkinPixels(canvas: SkinCanvas): Uint8ClampedArray {
  if (canvas instanceof PixelBuffer) return canvas.data;
  const ctx = get2dContext(canvas);
  if (!ctx) return new Uint8ClampedArray(SKIN_SIZE * SKIN_SIZE * 4);
  return ctx.getImageData(0, 0, SKIN_SIZE, SKIN_SIZE).data;
}

/** Copy one region out of a full-size RGBA buffer. */
export function readRegion(pixels: Uint8ClampedArray, rect: SkinRect): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rect.w * rect.h * 4);
  for (let y = 0; y < rect.h; y++) {
    for (let x = 0; x < rect.w; x++) {
      const src = ((rect.y + y) * SKIN_SIZE + (rect.x + x)) * 4;
      const dst = (y * rect.w + x) * 4;
      out[dst] = pixels[src];
      out[dst + 1] = pixels[src + 1];
      out[dst + 2] = pixels[src + 2];
      out[dst + 3] = pixels[src + 3];
    }
  }
  return out;
}

/**
 * Render the skin for `spec` into a three.js texture ready to be used as the
 * map of a `MeshLambertMaterial`.
 */
export function generateSkin(spec: AvatarSpec, anisotropy?: number): CanvasTexture {
  const canvas = generateSkinCanvas(spec);
  const texture = new CanvasTexture(canvas as unknown as HTMLCanvasElement);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestMipmapLinearFilter;
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = anisotropy ?? maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}
