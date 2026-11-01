/**
 * Cubicraft — procedural UI icons.
 *
 * Every icon is a tiny 16x16 pixel-art drawing made of rectangles, so the
 * whole icon set ships as code and needs no image files. Icons are rendered
 * into a {@link PixelBuffer} and uploaded to a canvas when one is available,
 * which keeps them usable from the DOM (data URLs) and from three.js.
 */

import { CanvasTexture, NearestFilter, SRGBColorSpace } from 'three';
import { PixelBuffer } from './skinGenerator';

const ICON_SIZE = 16;

/** x, y, width, height, colour. */
type IconRect = readonly [number, number, number, number, string];

const C = {
  dark: '#2B2B30',
  steel: '#8A8F98',
  light: '#D8DCE2',
  wood: '#A9723C',
  woodDark: '#7A5228',
  gold: '#E4B33C',
  red: '#D93B3B',
  green: '#4CA64C',
  greenDark: '#2F7A2F',
  blue: '#3D7FD9',
  white: '#F6F7F9',
  skin: '#F0C9A4',
  hair: '#3B2A1E',
  meat: '#C98B5E',
} as const;

/** Pixel-art definitions, one entry per icon name. */
const ICON_ART: Record<string, readonly IconRect[]> = {
  pickaxe: [
    [2, 3, 12, 2, C.dark], [1, 4, 2, 1, C.dark], [13, 4, 2, 1, C.dark],
    [7, 5, 2, 10, C.wood], [7, 14, 2, 1, C.woodDark],
  ],
  sword: [
    [7, 1, 2, 9, C.light], [7, 0, 2, 1, C.white],
    [4, 10, 8, 1, C.gold], [7, 11, 2, 3, C.woodDark], [6, 14, 4, 1, C.gold],
  ],
  axe: [
    [7, 2, 2, 13, C.wood],
    [3, 3, 5, 5, C.steel], [2, 4, 1, 3, C.light], [8, 4, 1, 3, C.steel],
  ],
  shovel: [
    [7, 2, 2, 8, C.wood],
    [5, 10, 6, 5, C.steel], [6, 15, 4, 1, C.light],
  ],
  hoe: [
    [7, 2, 2, 12, C.wood],
    [3, 3, 4, 2, C.steel], [2, 4, 1, 1, C.light],
  ],
  apple: [
    [5, 5, 6, 9, C.red], [4, 7, 1, 6, C.red], [11, 7, 1, 6, C.red], [6, 14, 4, 1, C.red],
    [8, 3, 1, 3, C.woodDark], [9, 3, 3, 2, C.green],
  ],
  heart: [
    [4, 4, 8, 2, C.red], [3, 6, 10, 2, C.red], [4, 8, 8, 2, C.red],
    [5, 10, 6, 1, C.red], [6, 11, 4, 1, C.red],
  ],
  hunger: [
    [4, 3, 7, 7, C.meat], [3, 5, 1, 3, C.meat],
    [9, 9, 3, 3, C.white], [11, 12, 2, 2, C.white],
  ],
  star: [
    [7, 2, 2, 4, C.gold], [5, 5, 6, 3, C.gold], [4, 8, 8, 2, C.gold],
    [5, 10, 2, 3, C.gold], [9, 10, 2, 3, C.gold], [3, 10, 2, 2, C.gold], [11, 10, 2, 2, C.gold],
  ],
  backpack: [
    [4, 4, 8, 11, C.wood], [6, 2, 4, 2, C.woodDark], [5, 5, 1, 4, C.woodDark],
    [6, 8, 4, 4, C.woodDark], [7, 9, 2, 2, C.gold],
  ],
  cog: [
    [7, 1, 2, 2, C.steel], [3, 4, 2, 2, C.steel], [11, 4, 2, 2, C.steel],
    [3, 10, 2, 2, C.steel], [11, 10, 2, 2, C.steel], [7, 13, 2, 2, C.steel],
    [4, 3, 8, 10, C.steel], [6, 5, 4, 6, C.dark],
  ],
  camera: [
    [2, 5, 12, 8, C.dark], [5, 3, 4, 2, C.dark], [10, 3, 2, 2, C.gold],
    [6, 7, 4, 4, C.blue], [7, 8, 2, 2, C.light],
  ],
  laser: [
    [2, 6, 9, 3, C.dark], [2, 6, 9, 1, C.steel],
    [11, 7, 3, 1, C.red], [14, 7, 2, 1, C.red],
  ],
  paintbucket: [
    [3, 7, 10, 7, C.steel], [3, 6, 10, 1, C.light],
    [5, 3, 6, 1, C.steel], [5, 4, 1, 2, C.steel], [10, 4, 1, 2, C.steel],
    [4, 6, 3, 1, C.blue], [9, 5, 3, 1, C.red],
  ],
  compass: [
    [4, 2, 8, 1, C.light], [2, 4, 1, 8, C.light], [13, 4, 1, 8, C.light], [4, 13, 8, 1, C.light],
    [7, 4, 2, 6, C.red], [7, 9, 2, 3, C.white],
  ],
  clock: [
    [4, 2, 8, 1, C.light], [2, 4, 1, 8, C.light], [13, 4, 1, 8, C.light], [4, 13, 8, 1, C.light],
    [7, 4, 1, 4, C.dark], [8, 7, 3, 1, C.dark],
  ],
  skull: [
    [3, 3, 10, 8, C.white], [5, 6, 2, 2, C.dark], [9, 6, 2, 2, C.dark],
    [7, 8, 2, 1, C.dark], [6, 11, 1, 2, C.dark], [9, 11, 1, 2, C.dark],
  ],
  chat: [
    [2, 3, 12, 8, C.light], [4, 11, 2, 2, C.light],
    [4, 5, 8, 1, C.dark], [4, 7, 6, 1, C.dark],
  ],
  player: [
    [5, 2, 6, 6, C.skin], [5, 2, 6, 2, C.hair],
    [6, 5, 1, 1, C.dark], [9, 5, 1, 1, C.dark],
    [4, 8, 8, 6, C.blue], [2, 8, 2, 6, C.skin], [12, 8, 2, 6, C.skin],
  ],
  world: [
    [3, 4, 10, 4, C.green], [4, 7, 8, 6, C.wood], [7, 1, 2, 4, C.woodDark], [6, 0, 4, 2, C.greenDark],
  ],
  sun: [
    [7, 1, 2, 3, C.gold], [7, 12, 2, 3, C.gold], [1, 7, 3, 2, C.gold], [12, 7, 3, 2, C.gold],
    [3, 3, 2, 2, C.gold], [11, 3, 2, 2, C.gold], [3, 11, 2, 2, C.gold], [11, 11, 2, 2, C.gold],
    [5, 5, 6, 6, C.gold],
  ],
  moon: [
    [4, 3, 8, 10, C.light], [6, 2, 4, 2, C.light], [6, 12, 4, 2, C.light],
    [8, 4, 5, 8, C.dark],
  ],
};

/** Canonical icon names. */
export const ICON_NAMES: string[] = Object.keys(ICON_ART);

/** Alternative spellings accepted by {@link getIcon}. */
const ICON_ALIASES: Record<string, string> = {
  'paint bucket': 'paintbucket',
  'paint-bucket': 'paintbucket',
  bucket: 'paintbucket',
  food: 'hunger',
  gear: 'cog',
  settings: 'cog',
  chat: 'chat',
};

const textureCache = new Map<string, CanvasTexture>();
const dataUrlCache = new Map<string, string>();

function resolveName(name: string): string {
  const key = name.trim().toLowerCase();
  const alias = ICON_ALIASES[key];
  if (alias) return alias;
  return key;
}

/** Draw an icon into a fresh pixel buffer. */
function renderIcon(name: string): PixelBuffer {
  const buffer = new PixelBuffer(ICON_SIZE, ICON_SIZE);
  const art = ICON_ART[name];
  if (!art) return buffer;
  for (const [x, y, w, h, color] of art) {
    const hex = color.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    buffer.fillRect(x, y, w, h, { r, g, b, a: 255 });
  }
  return buffer;
}

function createCanvas(width: number, height: number): HTMLCanvasElement | null {
  try {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
    const el = document.createElement('canvas');
    el.width = width;
    el.height = height;
    return el;
  } catch {
    return null;
  }
}

/**
 * Get the texture for an icon. Results are memoised, so the same icon always
 * returns the same texture instance.
 *
 * Unknown names fall back to the `star` icon so a missing asset never breaks
 * the UI.
 */
export function getIcon(name: string): CanvasTexture {
  const key = resolveName(name);
  // Unknown names reuse the fallback art *and* its cache entry.
  const artKey = ICON_ART[key] ? key : 'star';
  const cached = textureCache.get(artKey);
  if (cached) return cached;

  const buffer = renderIcon(artKey);
  const canvas = createCanvas(ICON_SIZE, ICON_SIZE);
  let image: HTMLCanvasElement | PixelBuffer = buffer;
  if (canvas) {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const data = new ImageData(new Uint8ClampedArray(buffer.data), ICON_SIZE, ICON_SIZE);
      ctx.putImageData(data, 0, 0);
      image = canvas;
    }
  }

  const texture = new CanvasTexture(image as unknown as HTMLCanvasElement);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  textureCache.set(artKey, texture);
  return texture;
}

/**
 * A PNG data URL for an icon, for use as a CSS `background-image`.
 * Requires a DOM canvas; throws in headless environments.
 */
export function getIconDataUrl(name: string): string {
  const key = resolveName(name);
  const artKey = ICON_ART[key] ? key : 'star';
  const cached = dataUrlCache.get(artKey);
  if (cached) return cached;

  const buffer = renderIcon(artKey);
  const canvas = createCanvas(ICON_SIZE, ICON_SIZE);
  if (!canvas) throw new Error('getIconDataUrl requires a DOM canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('getIconDataUrl requires a 2D canvas context');
  const data = new ImageData(new Uint8ClampedArray(buffer.data), ICON_SIZE, ICON_SIZE);
  ctx.putImageData(data, 0, 0);
  const url = canvas.toDataURL('image/png');
  dataUrlCache.set(artKey, url);
  return url;
}
