/**
 * Procedural texture atlas.
 *
 * Every block face and item icon references a texture by NAME; the atlas
 * paints one 32x32 tile for each name at runtime. Nothing is downloaded, so
 * the whole game ships as code.
 *
 * The painter works in three layers: an exact table for the named terrain
 * blocks, keyword rules for the families (wood, ore, wool colour, plants),
 * and a muted fallback for anything else so an unrecognised name never
 * produces a garish colour.
 */

import * as THREE from 'three';

export const TILE_SIZE = 32;

type PixelFn = (
  x: number,
  y: number,
  rng: () => number,
  out: [number, number, number, number],
) => void;

/** Stable hash so a texture always looks the same. */
function hash(text: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = l - c / 2;
  let rgb: [number, number, number];
  if (h < 1 / 6) rgb = [c, x, 0];
  else if (h < 2 / 6) rgb = [x, c, 0];
  else if (h < 3 / 6) rgb = [0, c, x];
  else if (h < 4 / 6) rgb = [0, x, c];
  else if (h < 5 / 6) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return [
    Math.round((rgb[0] + m) * 255),
    Math.round((rgb[1] + m) * 255),
    Math.round((rgb[2] + m) * 255),
  ];
}

/** The 16 dye colours. */
const DYE_COLORS: Record<string, string> = {
  white: '#f4f4f4',
  orange: '#f07613',
  magenta: '#bd44b3',
  light_blue: '#3aafd9',
  yellow: '#f8c627',
  lime: '#70b919',
  pink: '#ed8dac',
  gray: '#3e4447',
  light_gray: '#8e8e86',
  cyan: '#158991',
  purple: '#792aac',
  blue: '#35399d',
  brown: '#724728',
  green: '#546d1b',
  red: '#a12722',
  black: '#1d1d21',
};

/** Wood tints, keyed by the wood species in a texture name. */
const WOOD_TINTS: Record<string, string> = {
  oak: '#9c7a4b',
  spruce: '#7a5a36',
  birch: '#c7b189',
  jungle: '#a4783f',
  acacia: '#b05f36',
  dark_oak: '#4a3521',
  mangrove: '#77393a',
  cherry: '#d8a7a0',
  bamboo: '#c3b47a',
  crimson: '#7a2a46',
  warped: '#1d6b6b',
  pale_oak: '#d8cdb0',
  poplar: '#d6cfa8',
};

/** Mineral colours for ore gems. */
const ORE_COLORS: Record<string, string> = {
  coal: '#2a2a2a',
  iron: '#d8af93',
  copper: '#c87f4a',
  gold: '#f7d046',
  redstone: '#c62828',
  lapis: '#2a52b8',
  diamond: '#4ce0d8',
  emerald: '#2fd45c',
  nether_gold: '#e0b23c',
  ancient_debris: '#6b4436',
  quartz: '#e8e4dc',
};

function dyeColor(name: string): string | null {
  // Longest name first so `light_blue` is not matched as `blue`.
  const sorted = Object.keys(DYE_COLORS).sort((a, b) => b.length - a.length);
  for (const key of sorted) {
    if (name.includes(key)) return DYE_COLORS[key];
  }
  return null;
}

function oreColor(name: string): string | null {
  for (const [key, color] of Object.entries(ORE_COLORS)) {
    if (name.includes(key)) return color;
  }
  return null;
}

function woodTint(name: string): string | null {
  for (const [key, tint] of Object.entries(WOOD_TINTS)) {
    if (name.includes(key)) return tint;
  }
  return null;
}

/** A flat noisy texture. */
function noisy(base: string, variance = 18, speckle = 0): PixelFn {
  const [r, g, b] = hexToRgb(base);
  return (x, y, rng, out) => {
    const n = (rng() - 0.5) * variance * 2;
    const s = speckle > 0 && rng() < speckle ? -variance * 1.6 : 0;
    out[0] = Math.max(0, Math.min(255, r + n + s));
    out[1] = Math.max(0, Math.min(255, g + n + s));
    out[2] = Math.max(0, Math.min(255, b + n + s));
    out[3] = 255;
  };
}

/** Grass: green on top, dirt below, with a ragged edge. */
function grassSide(dirt: string, grass: string): PixelFn {
  const [dr, dg, db] = hexToRgb(dirt);
  const [gr, gg, gb] = hexToRgb(grass);
  return (x, y, rng, out) => {
    const edge = 8 + Math.sin(x * 0.55) * 2.5 + (rng() - 0.5) * 1.5;
    const c = y < edge ? [gr, gg, gb] : [dr, dg, db];
    const n = (rng() - 0.5) * 20;
    out[0] = Math.max(0, Math.min(255, c[0] + n));
    out[1] = Math.max(0, Math.min(255, c[1] + n));
    out[2] = Math.max(0, Math.min(255, c[2] + n));
    out[3] = 255;
  };
}

/** Planks: horizontal boards with grain. */
function planks(tint: string): PixelFn {
  const [r, g, b] = hexToRgb(tint);
  return (x, y, rng, out) => {
    const board = Math.floor(y / 8);
    const seam = y % 8 === 0 ? -28 : 0;
    const grain = Math.sin((x + board * 9) * 0.9) * 6;
    out[0] = r + grain + seam + (rng() - 0.5) * 12;
    out[1] = g + grain + seam + (rng() - 0.5) * 12;
    out[2] = b + grain + seam + (rng() - 0.5) * 12;
    out[3] = 255;
  };
}

/** Bark: vertical streaks. */
function bark(tint: string): PixelFn {
  const [r, g, b] = hexToRgb(tint);
  return (x, y, rng, out) => {
    const streak = Math.sin(x * 1.7) * 13 + (rng() - 0.5) * 14;
    out[0] = r + streak;
    out[1] = g + streak * 0.9;
    out[2] = b + streak * 0.8;
    out[3] = 255;
  };
}

/** A cut-out plant: transparent with a stem and a blossom. */
function plant(petal?: string): PixelFn {
  const petalRgb = petal ? hexToRgb(petal) : undefined;
  return (x, y, rng, out) => {
    out[3] = 0;
    const centre = TILE_SIZE / 2;
    const stemX = Math.floor(centre - 1 + rng() * 2);
    const height = 16 + Math.floor(rng() * 10);
    const top = TILE_SIZE - height;
    if (x >= stemX && x < stemX + 2 && y >= top) {
      out[0] = 84;
      out[1] = 138;
      out[2] = 48;
      out[3] = 255;
    } else if (y >= top - 5 && y < top + 3 && Math.abs(x - stemX) < 6) {
      const c = petalRgb ?? [226, 92, 92];
      out[0] = c[0];
      out[1] = c[1];
      out[2] = c[2];
      out[3] = 255;
    }
  };
}

/** A cut-out tuft of greenery: a few blades, transparent elsewhere. */
function tuft(base = '#4f8a28', tip?: string): PixelFn {
  const [r, g, b] = hexToRgb(base);
  const tipRgb = tip ? hexToRgb(tip) : undefined;
  return (x, y, rng, out) => {
    out[3] = 0;
    const slot = Math.floor((x + 1) / 6);
    const bladeX = slot * 6 + 2;
    const height = 12 + ((slot * 29 + 7) % 16);
    if (x < bladeX || x >= bladeX + 3 || y < TILE_SIZE - height) return;
    const n = (rng() - 0.5) * 30;
    const c = tipRgb && y < TILE_SIZE - height + 4 ? tipRgb : [r, g, b];
    out[0] = c[0] + n;
    out[1] = c[1] + n * 1.25;
    out[2] = c[2] + n * 0.6;
    out[3] = 255;
  };
}

/** A dense plant texture (coral, roots) shared by cubes and cut-out fans. */
function densePlant(base: string): PixelFn {
  const [r, g, b] = hexToRgb(base);
  return (x, y, rng, out) => {
    const n = (rng() - 0.5) * 34;
    out[0] = r + n;
    out[1] = g + n;
    out[2] = b + n;
    out[3] = rng() < 0.15 ? 0 : 255;
  };
}

/** A small mushroom: a pale stem under a domed cap. */
function mushroom(cap: string): PixelFn {
  const [r, g, b] = hexToRgb(cap);
  const centre = TILE_SIZE / 2 - 0.5;
  return (x, y, rng, out) => {
    out[3] = 0;
    const n = (rng() - 0.5) * 22;
    const dx = (x - centre) / 10;
    const dy = (y - (TILE_SIZE - 14)) / 7;
    if (dx * dx + dy * dy < 1) {
      out[0] = r + n;
      out[1] = g + n;
      out[2] = b + n;
      out[3] = 255;
      return;
    }
    if (Math.abs(x - centre) < 3 && y >= TILE_SIZE - 13) {
      out[0] = 214 + n;
      out[1] = 206 + n;
      out[2] = 188 + n;
      out[3] = 255;
    }
  };
}

/** Petal colours for flowers whose names carry no dye keyword. */
const FLOWER_PETALS: Record<string, string> = {
  wither_rose: '#4a3f3a',
  dandelion: '#e3cd3a',
  poppy: '#cf3529',
  orchid: '#6a9fd8',
  allium: '#a26dc0',
  bluet: '#dce8f0',
  oxeye_daisy: '#e8e4d4',
  cornflower: '#4a6fd4',
  lily_of_the_valley: '#e8ecdf',
  torchflower: '#e0782a',
  sunflower: '#e8c93a',
  lilac: '#c09ad8',
  peony: '#e590b8',
  wildflowers: '#e8e4d4',
  azalea: '#e08ac0',
  rose: '#cf3529',
  petals: '#e8a8c0',
};

function flowerPetal(name: string): string {
  const dye = dyeColor(name);
  if (dye) return dye;
  const keys = Object.keys(FLOWER_PETALS).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (name.includes(key)) return FLOWER_PETALS[key];
  }
  return '#d84a5a';
}

const MUSHROOM_CAPS: Record<string, string> = {
  crimson_fungus: '#a82a50',
  warped_fungus: '#2a9a8a',
  brown_mushroom: '#8a6a4a',
  blue_mushroom: '#3a6ab0',
  red_mushroom: '#c03a30',
};

/** Opaque colours for plant-family textures used on solid cubes. */
const SOLID_PLANTS: Record<string, string> = {
  nether_wart: '#6a1a24',
  cocoa: '#7a4a22',
  moss_block: '#5d8a34',
  pale_moss: '#a8b09a',
  big_dripleaf: '#4a8a30',
  frogspawn: '#3a3428',
  chorus_flower: '#8a6aa8',
  pitcher_plant: '#7a4a9a',
  amethyst_cluster: '#9a6bc4',
  bee_nest: '#b8934a',
};

function tuftBase(name: string): string {
  if (/brain_coral/.test(name)) return '#d4689a';
  if (/bubble_coral/.test(name)) return '#a86bc4';
  if (/fire_coral/.test(name)) return '#d4483a';
  if (/horn_coral/.test(name)) return '#d8c03a';
  if (/tube_coral/.test(name)) return '#3a6ad4';
  if (/crimson/.test(name)) return '#8a2a42';
  if (/warped/.test(name)) return '#2a8a7a';
  if (/nether_sprouts/.test(name)) return '#58a89f';
  if (/dead_bush|leaf_litter/.test(name)) return '#8a6a3a';
  if (/dry_grass/.test(name)) return '#a89444';
  if (/sugar_cane/.test(name)) return '#8aba5a';
  if (/kelp|seagrass/.test(name)) return '#3f6a2e';
  if (/wheat/.test(name)) return '#a89a3a';
  if (/lily_pad|mangrove|dripleaf/.test(name)) return '#3f7a28';
  if (/sea_pickle/.test(name)) return '#5a7a3a';
  if (/pale|lichen/.test(name)) return '#8a9a78';
  if (/firefly/.test(name)) return '#3f6a28';
  return '#4f8a28';
}

function tuftTip(name: string): string | undefined {
  if (/firefly/.test(name)) return '#e8d84a';
  if (/glow_berries/.test(name)) return '#e8a83a';
  return undefined;
}

/** A glass pane: transparent with a bright border. */
function glass(tinted = false): PixelFn {
  return (x, y, _rng, out) => {
    const edge = x === 0 || y === 0 || x === TILE_SIZE - 1 || y === TILE_SIZE - 1;
    out[0] = tinted ? 90 : 205;
    out[1] = tinted ? 95 : 235;
    out[2] = tinted ? 105 : 240;
    out[3] = edge ? 120 : 34;
  };
}

/** An item icon: a small shape on a transparent background. */
function itemShape(colour: string, shape: 'tool' | 'round' | 'square' | 'gem' = 'square'): PixelFn {
  const [r, g, b] = hexToRgb(colour);
  return (x, y, rng, out) => {
    out[3] = 0;
    const cx = TILE_SIZE / 2 - 0.5;
    const cy = TILE_SIZE / 2 - 0.5;
    const dx = x - cx;
    const dy = y - cy;
    let inside = false;
    if (shape === 'round') inside = dx * dx + dy * dy < 100;
    else if (shape === 'gem') inside = Math.abs(dx) + Math.abs(dy) < 9;
    else if (shape === 'tool') inside = Math.abs(dx - dy * 0.6) < 3.5 && Math.abs(dx + dy * 0.6) < 10;
    else inside = Math.abs(dx) < 9 && Math.abs(dy) < 9;
    if (inside) {
      const n = (rng() - 0.5) * 18;
      out[0] = r + n;
      out[1] = g + n;
      out[2] = b + n;
      out[3] = 255;
    }
  };
}

/**
 * Exact matches for the named blocks.
 */
const EXACT: Record<string, PixelFn> = {
  dirt: noisy('#866043', 20, 0.08),
  dirt_path: noisy('#8a6647', 18, 0.08),
  coarse_dirt: noisy('#7d5a3f', 24, 0.14),
  rooted_dirt: noisy('#6d4e36', 18, 0.1),
  farmland: noisy('#6a452b', 16, 0.06),
  grass_block: noisy('#6aa33c', 16, 0.05),
  grass_block_side: grassSide('#866043', '#6aa33c'),
  podzol: noisy('#5a3b23', 18, 0.12),
  podzol_top: noisy('#6b4527', 18, 0.12),
  mycelium: noisy('#6f6266', 16, 0.08),
  snowy_grass: grassSide('#8b8f96', '#f2f6f8'),
  mud: noisy('#4a3b32', 16, 0.08),
  mangrove_roots: bark('#5b3a2c'),
  muddy_mangrove_roots: bark('#4d3226'),
  clay: noisy('#a4a8b8', 14, 0),
  sand: noisy('#e0d6a2', 14, 0.05),
  red_sand: noisy('#c98f52', 14, 0.05),
  gravel: noisy('#847d78', 26, 0.18),
  snow: noisy('#f5f7f8', 8, 0),
  snow_block: noisy('#eef3f6', 10, 0),
  ice: (x, y, rng, out) => {
    out[0] = 150 + (rng() - 0.5) * 20;
    out[1] = 190 + (rng() - 0.5) * 20;
    out[2] = 240 + (rng() - 0.5) * 15;
    out[3] = 200;
  },
  packed_ice: (x, y, rng, out) => {
    out[0] = 140 + (rng() - 0.5) * 18;
    out[1] = 180 + (rng() - 0.5) * 18;
    out[2] = 232 + (rng() - 0.5) * 14;
    out[3] = 230;
  },
  blue_ice: (x, y, rng, out) => {
    out[0] = 120 + (rng() - 0.5) * 18;
    out[1] = 160 + (rng() - 0.5) * 18;
    out[2] = 225 + (rng() - 0.5) * 14;
    out[3] = 235;
  },
  water: (x, y, rng, out) => {
    const wave = Math.sin((x + y) * 0.55) * 8 + (rng() - 0.5) * 10;
    out[0] = 40 + wave;
    out[1] = 110 + wave * 1.4;
    out[2] = 210 + wave * 1.2;
    out[3] = 170;
  },
  lava: (x, y, rng, out) => {
    const heat = Math.sin(x * 0.4) * Math.cos(y * 0.33) * 40;
    out[0] = 210 + heat * 0.6;
    out[1] = 90 + heat;
    out[2] = 24;
    out[3] = 255;
  },
  glass: glass(false),
  tinted_glass: glass(true),
  glass_pane: glass(false),
  sponge: noisy('#c8bd52', 16, 0.1),
  wet_sponge: noisy('#9c8f3c', 16, 0.1),
  honey_block: noisy('#e0a326', 14, 0.06),
  slime_block: (x, y, rng, out) => {
    out[0] = 110 + (rng() - 0.5) * 18;
    out[1] = 170 + (rng() - 0.5) * 18;
    out[2] = 90 + (rng() - 0.5) * 14;
    out[3] = 220;
  },
  hay_block: (x, y, rng, out) => {
    const streak = Math.sin(x * 2.2) * 16;
    out[0] = 200 + streak + (rng() - 0.5) * 12;
    out[1] = 165 + streak + (rng() - 0.5) * 12;
    out[2] = 55 + (rng() - 0.5) * 12;
    out[3] = 255;
  },
  pumpkin: noisy('#c07615', 14, 0.06),
  carved_pumpkin: noisy('#c07615', 14, 0.06),
  melon: noisy('#6f9c31', 14, 0.08),
  moss_block: noisy('#3f6b2c', 18, 0.12),
  terracotta: noisy('#985e43', 16, 0),
  sea_lantern: (x, y, rng, out) => {
    out[0] = 185 + (rng() - 0.5) * 20;
    out[1] = 220 + (rng() - 0.5) * 20;
    out[2] = 225 + (rng() - 0.5) * 20;
    out[3] = 255;
  },
  dried_kelp_block: noisy('#3c4a2e', 16, 0.1),
  crafter: planks('#9c7a4b'),
  grindstone: noisy('#6d6d70', 20, 0.12),
  flower_pot: noisy('#9c6a44', 16, 0.08),
  beacon: (x, y, rng, out) => {
    out[0] = 120 + (rng() - 0.5) * 18;
    out[1] = 210 + (rng() - 0.5) * 20;
    out[2] = 225 + (rng() - 0.5) * 20;
    out[3] = 255;
  },
  conduit: noisy('#7a6a54', 16, 0.08),
  lodestone: noisy('#8a8f96', 14, 0.08),
  respawn_anchor: noisy('#4a3f52', 16, 0.08),
  turtle_egg: noisy('#d8c98a', 12, 0.04),
  budding_amethyst: noisy('#9a6bc4', 18, 0.12),
};

/**
 * Build the pixel function for a texture name.
 */
function painterFor(name: string): PixelFn {
  const exact = EXACT[name];
  if (exact) return exact;

  // Fungi get a domed cap rather than a blossom.
  if (/mushroom|fungus/.test(name)) {
    let cap = '#a84838';
    for (const key of Object.keys(MUSHROOM_CAPS)) {
      if (name.includes(key)) cap = MUSHROOM_CAPS[key];
    }
    return mushroom(cap);
  }

  // Plant-family textures used on solid cubes must cover the whole quad.
  const solidPlant = SOLID_PLANTS[name];
  if (solidPlant) return noisy(solidPlant, 16, 0.08);
  if (/^cactus(_flower)?$/.test(name)) {
    return (x, y, rng, out) => {
      const rib = x % 8 < 2 ? -26 : 0;
      const n = (rng() - 0.5) * 16;
      out[0] = 63 + rib + n;
      out[1] = 122 + rib + n;
      out[2] = 40 + rib + n;
      out[3] = 255;
    };
  }
  if (name === 'pumpkin') {
    return (x, y, rng, out) => {
      const ridge = Math.sin(x * 0.78) * 16;
      const n = (rng() - 0.5) * 16;
      out[0] = 200 + ridge + n;
      out[1] = 128 + ridge + n;
      out[2] = 30 + ridge * 0.4 + n;
      out[3] = 255;
    };
  }
  if (name === 'melon') {
    return (x, y, rng, out) => {
      const stripe = x % 8 < 4 ? 0 : -32;
      const n = (rng() - 0.5) * 16;
      out[0] = 90 + stripe + n;
      out[1] = 140 + stripe + n;
      out[2] = 46 + stripe + n;
      out[3] = 255;
    };
  }
  if (name === 'sweet_berry_bush') {
    return (x, y, rng, out) => {
      const n = (rng() - 0.5) * 34;
      const berry = rng() < 0.06;
      out[0] = berry ? 192 : 74 + n;
      out[1] = berry ? 48 : 122 + n;
      out[2] = berry ? 44 : 42 + n;
      out[3] = 255;
    };
  }
  if (/^dead_\w*coral/.test(name)) return noisy('#7a6a5a', 14, 0.08);
  // Coral and mangrove-root textures are shared by cubes and cut-out fans.
  if (/coral|mangrove_roots/.test(name)) return densePlant(tuftBase(name));

  // Actual flowers get a stem and a blossom in their real colour.
  if (/flower|dandelion|poppy|orchid|allium|bluet|tulip|oxeye_daisy|cornflower|lily_of|rose|sunflower|lilac|peony|wildflowers|petals/.test(name)) {
    return plant(flowerPetal(name));
  }

  // Other cut-out plants are greenery, not blossoms.
  if (/grass|fern|dead_bush|leaf_litter|bush|azalea|roots|sprouts|vine|glow_berries|sugar_cane|sea_pickle|kelp|hanging|lichen|sapling|crops|wheat|carrots|potatoes|beetroot|dripleaf/.test(name)) {
    return tuft(tuftBase(name), tuftTip(name));
  }

  // Ores: grey stone with coloured gems.
  const ore = oreColor(name);
  if (ore) {
    const [or_, og, ob] = hexToRgb(ore);
    return (x, y, rng, out) => {
      const base = 118 + (rng() - 0.5) * 30;
      const gem = rng() < 0.14;
      out[0] = gem ? or_ : base;
      out[1] = gem ? og : base;
      out[2] = gem ? ob : base;
      out[3] = 255;
    };
  }

  // Wood families.
  if (/planks/.test(name)) {
    const tint = woodTint(name);
    return planks(tint ?? '#9c7a4b');
  }
  if (/log|wood|bark|stem|hyphae/.test(name)) {
    const tint = woodTint(name);
    return bark(tint ?? '#9c7a4b');
  }
  if (/leaves|leaves_/.test(name)) {
    const tint = dyeColor(name) ?? '#4a7a2a';
    const [r, g, b] = hexToRgb(tint);
    return (x, y, rng, out) => {
      const hole = rng() < 0.22;
      out[0] = r + (rng() - 0.5) * 40;
      out[1] = g + (rng() - 0.5) * 40;
      out[2] = b + (rng() - 0.5) * 30;
      out[3] = hole ? 0 : 255;
    };
  }

  // Coloured blocks.
  const dye = dyeColor(name);
  if (dye) {
    const [r, g, b] = hexToRgb(dye);
    return (x, y, rng, out) => {
      const n = (rng() - 0.5) * 22;
      out[0] = r + n;
      out[1] = g + n;
      out[2] = b + n;
      out[3] = 255;
    };
  }

  // Stone families.
  if (/deepslate/.test(name)) return noisy('#4c4c52', 18, 0.1);
  if (/netherrack/.test(name)) return noisy('#6f3030', 18, 0.1);
  if (/blackstone/.test(name)) return noisy('#2e2a30', 14, 0.08);
  if (/basalt/.test(name)) return noisy('#3c3a42', 12, 0.06);
  if (/magma/.test(name)) return noisy('#8c3a17', 22, 0.14);
  if (/soul_sand|soul_soil/.test(name)) return noisy('#54423a', 14, 0.08);
  if (/end_stone/.test(name)) return noisy('#dfe0a3', 12, 0.06);
  if (/purpur/.test(name)) return noisy('#a97fb0', 14, 0.07);
  if (/sculk/.test(name)) return noisy('#0f1f24', 8, 0.05);
  if (/prismarine/.test(name)) return noisy('#5d8b7a', 14, 0.08);
  if (/coral/.test(name)) return noisy('#d1675a', 18, 0.1);
  if (/copper/.test(name)) return noisy('#b5714a', 16, 0.1);
  if (/gold/.test(name)) return noisy('#e8c451', 12, 0.06);
  if (/iron/.test(name)) return noisy('#d6d6d6', 10, 0.05);
  if (/diamond/.test(name)) return noisy('#5ce0d6', 12, 0.07);
  if (/emerald/.test(name)) return noisy('#3fd268', 12, 0.07);
  if (/lapis/.test(name)) return noisy('#2f57b5', 14, 0.08);
  if (/redstone/.test(name)) return noisy('#b52b2b', 14, 0.08);
  if (/quartz/.test(name)) return noisy('#e9e5dd', 8, 0.03);
  if (/obsidian/.test(name)) return noisy('#16121f', 10, 0.06);
  if (/brick/.test(name)) {
    return (x, y, rng, out) => {
      const row = Math.floor(y / 8);
      const offset = row % 2 === 0 ? 0 : 8;
      const isMortar = y % 8 === 0 || (x + offset) % 16 === 0;
      const n = (rng() - 0.5) * 16;
      if (isMortar) {
        out[0] = 160 + n;
        out[1] = 155 + n;
        out[2] = 150 + n;
      } else {
        out[0] = 150 + n;
        out[1] = 78 + n;
        out[2] = 62 + n;
      }
      out[3] = 255;
    };
  }
  if (/bookshelf/.test(name)) {
    return (x, y, rng, out) => {
      const shelf = y % 8 < 6;
      const n = (rng() - 0.5) * 18;
      if (shelf) {
        const colors = ['#a03b3b', '#3b6ea0', '#3ba05a', '#a08a3b', '#7a3ba0'];
        const [r, g, b] = hexToRgb(colors[(x * 37 + y * 11) % 5]);
        out[0] = r + n;
        out[1] = g + n;
        out[2] = b + n;
      } else {
        out[0] = 150 + n;
        out[1] = 115 + n;
        out[2] = 72 + n;
      }
      out[3] = 255;
    };
  }
  if (/stone|granite|diorite|andesite|tuff|calcite|cobble|bedrock/.test(name)) {
    return noisy('#8a8a8a', 16, 0.1);
  }

  // Items: a small icon shape in a sensible colour.
  if (/sword|axe|pickaxe|shovel|hoe|mace|spear/.test(name)) return itemShape('#9aa0a6', 'tool');
  if (/helmet|chestplate|leggings|boots|_armor/.test(name)) return itemShape('#8d939b', 'square');
  if (/ingot|nugget|gem|diamond|emerald|lapis|redstone|quartz/.test(name)) return itemShape('#cfd4da', 'gem');
  if (/apple|carrot|potato|beetroot|melon|pumpkin|bread|steak|chicken|mutton|beef|pork|fish|salmon|cod|cookie/.test(name)) {
    return itemShape('#c85c3c', 'round');
  }
  if (/torch/.test(name)) return itemShape('#e0b050', 'tool');
  if (/bucket|barrel|chest|furnace|crafting/.test(name)) return itemShape('#9c7a4b', 'square');
  if (/stick|arrow|bone|feather|leather|gunpowder|string/.test(name)) return itemShape('#b08a55', 'tool');

  // A muted fallback so an unknown name never looks garish.
  const hue = hash(name);
  const [r, g, b] = hslToRgb(hue, 0.18, 0.46);
  return (x, y, rng, out) => {
    const n = (rng() - 0.5) * 18;
    out[0] = r + n;
    out[1] = g + n;
    out[2] = b + n;
    out[3] = 255;
  };
}

/** The generated atlas. */
export interface TextureAtlas {
  texture: THREE.DataArrayTexture;
  /** Layer index for a texture name. */
  layer(name: string): number;
  names: string[];
}

export function buildAtlas(names: readonly string[]): TextureAtlas {
  const unique = [...new Set(names)];
  const index = new Map<string, number>();
  unique.forEach((name, i) => index.set(name, i));

  const data = new Uint8Array(TILE_SIZE * TILE_SIZE * 4 * unique.length);
  const pixel: [number, number, number, number] = [0, 0, 0, 255];

  for (let layer = 0; layer < unique.length; layer++) {
    const name = unique[layer];
    const paint = painterFor(name);
    const rng = mulberry(Math.floor(hash(name, 17) * 0xffffffff));
    const offset = layer * TILE_SIZE * TILE_SIZE * 4;
    for (let y = 0; y < TILE_SIZE; y++) {
      for (let x = 0; x < TILE_SIZE; x++) {
        pixel[0] = 0;
        pixel[1] = 0;
        pixel[2] = 0;
        pixel[3] = 255;
        paint(x, y, rng, pixel);
        const p = offset + (y * TILE_SIZE + x) * 4;
        data[p] = pixel[0];
        data[p + 1] = pixel[1];
        data[p + 2] = pixel[2];
        data[p + 3] = pixel[3];
      }
    }
  }

  const texture = new THREE.DataArrayTexture(data, TILE_SIZE, TILE_SIZE, unique.length);
  texture.format = THREE.RGBAFormat;
  texture.type = THREE.UnsignedByteType;
  texture.magFilter = THREE.NearestFilter;
  // No mipmaps: a merged quad tiles its texture many times over, and the
  // mip chain would average it into a flat colour.
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  return {
    texture,
    layer: (name: string) => index.get(name) ?? 0,
    names: unique,
  };
}
