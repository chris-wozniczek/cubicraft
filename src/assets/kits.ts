/**
 * Cubicraft — football kit definitions.
 *
 * A kit is pure data: a palette plus a list of paint operations per skin
 * region. `skinGenerator.ts` interprets the operations onto a 64x64 Minecraft
 * skin, so kits never touch pixels directly and can be added without any
 * renderer knowledge.
 *
 * Colour sources (2025/26 home kits):
 *   Real Madrid  : white base, gold trim, black Adidas three-stripes.
 *   FC Barcelona : Deep Royal Blue / Noble Red stripes with a diagonal purple
 *                  wash and solid navy raglan sleeves.
 */

/**
 * A single drawing instruction, interpreted in *region local* coordinates
 * (0,0 is the top-left of the skin region the op belongs to).
 */
export type PaintOp =
  | { op: 'fill'; color: string }
  | { op: 'stripe'; color: string; width: number; offset?: number; horizontal?: boolean }
  | { op: 'gradient'; from: string; to: string; angle?: number }
  | { op: 'dots'; color: string; spacing: number; radius?: number; half?: 'top' | 'bottom' | 'all' }
  | { op: 'arc'; color: string; width: number; curve: number; y: number }
  | { op: 'band'; color: string; y: number; height: number }
  | { op: 'tri'; color: string; corner: 'tl' | 'tr' | 'bl' | 'br' }
  | { op: 'text'; text: string; color: string; x: number; y: number; scale?: number; blocky?: boolean }
  | { op: 'sprite'; name: string; x: number; y: number; w: number; h: number }
  | { op: 'number'; color: string; x: number; y: number; height: number; front?: boolean };

export interface KitDef {
  id: string;
  name: string;
  club: string;
  palette: { base: string; alt: string; accent: string; trim: string; sponsor: string; maker: string };
  regions: {
    torsoFront: PaintOp[]; torsoBack: PaintOp[];
    armUpper: PaintOp[]; armLower: PaintOp[];
    legUpper: PaintOp[]; legLower: PaintOp[];
  };
  crest: { kind: 'procedural'; style: 'crown' | 'shield'; primary: string; secondary: string };
  number: { front: boolean; back: boolean; color: string };
  tags: string[];
}

/**
 * The club kits. Order matters only for the picker UI: home kits first.
 *
 * Region sizes follow the Minecraft skin layout, so ops are authored against
 * an 8x12 torso, a 4x4 sleeve/shorts block and a 4x8 forearm/sock block.
 */
export const KITS: KitDef[] = [
  {
    id: 'rm25',
    name: 'Real Madrid 2025/26 Home',
    club: 'Real Madrid',
    palette: {
      base: '#FFFFFF', alt: '#EDEDF2', accent: '#C9A227',
      trim: '#C9A227', sponsor: '#111111', maker: '#111111',
    },
    regions: {
      torsoFront: [
        // Background is a touch grey at the top and fades to pure white below.
        { op: 'gradient', from: '#EDEDF2', to: '#FFFFFF', angle: 90 },
        // Dotted motif: white dots high on the chest, grey dots low down.
        { op: 'dots', color: '#FFFFFF', spacing: 2, radius: 0.5, half: 'top' },
        { op: 'dots', color: '#D6D6DC', spacing: 2, radius: 0.5, half: 'bottom' },
        // Gold Teamgeist sweep across the chest.
        { op: 'arc', color: '#C9A227', width: 1, curve: 2, y: 7 },
        // Gold collar trim.
        { op: 'band', color: '#C9A227', y: 0, height: 1 },
        // Black sponsor wordmark (sits below the crest).
        { op: 'text', text: 'EMIRATES', color: '#111111', x: 0, y: 9, scale: 1, blocky: true },
      ],
      torsoBack: [
        { op: 'gradient', from: '#F2F2F6', to: '#FFFFFF', angle: 90 },
        { op: 'dots', color: '#FFFFFF', spacing: 2, radius: 0.5, half: 'top' },
        { op: 'dots', color: '#D6D6DC', spacing: 2, radius: 0.5, half: 'bottom' },
        { op: 'band', color: '#C9A227', y: 0, height: 1 },
        { op: 'number', color: '#C9A227', x: 1, y: 5, height: 5, front: false },
      ],
      armUpper: [
        { op: 'fill', color: '#FFFFFF' },
        // Black Adidas three-stripes over the shoulder.
        { op: 'sprite', name: 'three_stripes', x: 0, y: 0, w: 4, h: 4 },
        // Gold cuff trim.
        { op: 'band', color: '#C9A227', y: 3, height: 1 },
      ],
      armLower: [
        // Grey band just below the sleeve.
        { op: 'band', color: '#B6B6BE', y: 0, height: 1 },
      ],
      legUpper: [
        { op: 'fill', color: '#FFFFFF' },
        { op: 'band', color: '#C9A227', y: 0, height: 1 },
      ],
      legLower: [
        { op: 'fill', color: '#FFFFFF' },
        // Gold band on the socks.
        { op: 'band', color: '#C9A227', y: 0, height: 2 },
      ],
    },
    crest: { kind: 'procedural', style: 'crown', primary: '#FFFFFF', secondary: '#C9A227' },
    number: { front: false, back: true, color: '#C9A227' },
    tags: ['home', 'real-madrid', 'white', 'adidas', 'gold-trim'],
  },
  {
    id: 'fcb25',
    name: 'FC Barcelona 2025/26 Home',
    club: 'FC Barcelona',
    palette: {
      base: '#0040A0', alt: '#A50044', accent: '#C8A24A',
      trim: '#002D62', sponsor: '#FFFFFF', maker: '#FFFFFF',
    },
    regions: {
      torsoFront: [
        { op: 'fill', color: '#0040A0' },
        // Blaugrana: Deep Royal Blue base with Noble Red stripes.
        { op: 'stripe', color: '#A50044', width: 2, offset: 2 },
        // Purplish hue crossing the stripes diagonally.
        { op: 'gradient', from: '#6B3FA000', to: '#6B3FA0CC', angle: 45 },
        // Navy collar.
        { op: 'band', color: '#002D62', y: 0, height: 1 },
        // White sponsor wordmark.
        { op: 'text', text: 'SPOTIFY', color: '#FFFFFF', x: 0, y: 7, scale: 1, blocky: true },
      ],
      torsoBack: [
        { op: 'fill', color: '#0040A0' },
        { op: 'stripe', color: '#A50044', width: 2, offset: 2 },
        { op: 'gradient', from: '#6B3FA0CC', to: '#6B3FA000', angle: 45 },
        // Catalan Senyera below the back neckline.
        { op: 'sprite', name: 'senyera', x: 1, y: 0, w: 6, h: 2 },
        { op: 'number', color: '#FFFFFF', x: 1, y: 4, height: 6, front: false },
      ],
      armUpper: [
        // Solid navy raglan sleeve.
        { op: 'fill', color: '#002D62' },
        { op: 'tri', color: '#0040A0', corner: 'tl' },
        // Nike maker's mark.
        { op: 'sprite', name: 'swoosh', x: 0, y: 0, w: 4, h: 4 },
        { op: 'band', color: '#C8A24A', y: 3, height: 1 },
      ],
      armLower: [
        { op: 'band', color: '#002D62', y: 0, height: 1 },
      ],
      legUpper: [
        { op: 'fill', color: '#0040A0' },
        // Vertical garnet lines down the leg, gold trim at the edges.
        { op: 'stripe', color: '#A50044', width: 1, offset: 1 },
        { op: 'band', color: '#C8A24A', y: 0, height: 1 },
        { op: 'band', color: '#C8A24A', y: 3, height: 1 },
      ],
      legLower: [
        { op: 'fill', color: '#0040A0' },
        // Garnet band on the socks.
        { op: 'band', color: '#A50044', y: 0, height: 2 },
      ],
    },
    crest: { kind: 'procedural', style: 'shield', primary: '#0040A0', secondary: '#A50044' },
    number: { front: false, back: true, color: '#FFFFFF' },
    tags: ['home', 'barcelona', 'blaugrana', 'nike', 'stripes', 'raglan'],
  },
  {
    id: 'rm25_away',
    name: 'Real Madrid 2025/26 Away',
    club: 'Real Madrid',
    palette: {
      base: '#2B2B30', alt: '#202026', accent: '#E4B33C',
      trim: '#E4B33C', sponsor: '#E4B33C', maker: '#E4B33C',
    },
    regions: {
      torsoFront: [
        { op: 'fill', color: '#2B2B30' },
        // Subtle tonal banding.
        { op: 'stripe', color: '#242429', width: 1, horizontal: true },
        { op: 'band', color: '#E4B33C', y: 0, height: 1 },
        { op: 'arc', color: '#E4B33C', width: 1, curve: 2, y: 7 },
        { op: 'text', text: 'EMIRATES', color: '#E4B33C', x: 0, y: 9, scale: 1, blocky: true },
      ],
      torsoBack: [
        { op: 'fill', color: '#2B2B30' },
        { op: 'stripe', color: '#242429', width: 1, horizontal: true },
        { op: 'band', color: '#E4B33C', y: 0, height: 1 },
        { op: 'number', color: '#E4B33C', x: 1, y: 5, height: 5, front: false },
      ],
      armUpper: [
        { op: 'fill', color: '#2B2B30' },
        { op: 'sprite', name: 'three_stripes', x: 0, y: 0, w: 4, h: 4 },
        { op: 'band', color: '#E4B33C', y: 3, height: 1 },
      ],
      armLower: [
        { op: 'band', color: '#3A3A42', y: 0, height: 1 },
      ],
      legUpper: [
        { op: 'fill', color: '#2B2B30' },
        { op: 'band', color: '#E4B33C', y: 0, height: 1 },
      ],
      legLower: [
        { op: 'fill', color: '#2B2B30' },
        { op: 'band', color: '#E4B33C', y: 0, height: 2 },
      ],
    },
    crest: { kind: 'procedural', style: 'crown', primary: '#4A4A52', secondary: '#E4B33C' },
    number: { front: false, back: true, color: '#E4B33C' },
    tags: ['away', 'real-madrid', 'charcoal', 'adidas', 'gold-trim'],
  },
  {
    id: 'fcb25_away',
    name: 'FC Barcelona 2025/26 Away',
    club: 'FC Barcelona',
    palette: {
      base: '#E5B13C', alt: '#C9922B', accent: '#0040A0',
      trim: '#0040A0', sponsor: '#0040A0', maker: '#0040A0',
    },
    regions: {
      torsoFront: [
        { op: 'fill', color: '#E5B13C' },
        { op: 'stripe', color: '#C9922B', width: 1, horizontal: true },
        { op: 'band', color: '#0040A0', y: 0, height: 1 },
        { op: 'text', text: 'SPOTIFY', color: '#0040A0', x: 0, y: 7, scale: 1, blocky: true },
        { op: 'band', color: '#0040A0', y: 9, height: 1 },
      ],
      torsoBack: [
        { op: 'fill', color: '#E5B13C' },
        { op: 'stripe', color: '#C9922B', width: 1, horizontal: true },
        { op: 'band', color: '#0040A0', y: 0, height: 1 },
        { op: 'number', color: '#0040A0', x: 1, y: 5, height: 5, front: false },
      ],
      armUpper: [
        { op: 'fill', color: '#E5B13C' },
        { op: 'sprite', name: 'swoosh', x: 0, y: 0, w: 4, h: 4 },
        { op: 'band', color: '#0040A0', y: 3, height: 1 },
      ],
      armLower: [
        { op: 'band', color: '#0040A0', y: 0, height: 1 },
      ],
      legUpper: [
        { op: 'fill', color: '#E5B13C' },
        { op: 'band', color: '#0040A0', y: 0, height: 1 },
      ],
      legLower: [
        { op: 'fill', color: '#E5B13C' },
        { op: 'band', color: '#0040A0', y: 0, height: 2 },
      ],
    },
    crest: { kind: 'procedural', style: 'shield', primary: '#C9922B', secondary: '#0040A0' },
    number: { front: false, back: true, color: '#0040A0' },
    tags: ['away', 'barcelona', 'gold', 'nike'],
  },
  {
    id: 'plain',
    name: 'Plain Tee',
    club: 'Cubicraft',
    palette: {
      base: '#FFFFFF', alt: '#F2F2F4', accent: '#DCDCE2',
      trim: '#DCDCE2', sponsor: '#8A8A94', maker: '#8A8A94',
    },
    regions: {
      torsoFront: [
        { op: 'fill', color: '#FFFFFF' },
        { op: 'band', color: '#E4E4EA', y: 0, height: 1 },
        { op: 'text', text: 'CUBICRAFT', color: '#8A8A94', x: 0, y: 7, scale: 1, blocky: true },
      ],
      torsoBack: [
        { op: 'fill', color: '#FFFFFF' },
        { op: 'band', color: '#E4E4EA', y: 0, height: 1 },
        { op: 'number', color: '#8A8A94', x: 1, y: 6, height: 4, front: false },
      ],
      armUpper: [
        { op: 'fill', color: '#FFFFFF' },
        { op: 'band', color: '#E4E4EA', y: 3, height: 1 },
      ],
      armLower: [],
      legUpper: [
        { op: 'fill', color: '#DCDCE4' },
        { op: 'band', color: '#D4D4DC', y: 0, height: 1 },
      ],
      legLower: [],
    },
    crest: { kind: 'procedural', style: 'shield', primary: '#E8E8EE', secondary: '#9AA0AC' },
    number: { front: true, back: true, color: '#8A8A94' },
    tags: ['plain', 'casual', 'no-kit'],
  },
];

/** The kit used when a player has not chosen one. */
export const DEFAULT_KIT_ID = 'plain';

/** Look up a kit by id; unknown ids fall back to the plain tee. */
export function getKit(id: string): KitDef {
  const found = KITS.find((kit) => kit.id === id);
  return found ?? (KITS.find((kit) => kit.id === DEFAULT_KIT_ID) as KitDef);
}

/** Eight skin tones, light to dark. */
export const SKIN_TONES: string[] = [
  '#F8DCC0', '#F0C9A4', '#E2B088', '#CE9468',
  '#B3784E', '#945C36', '#714524', '#4E2E18',
];

/** Eight hair colours. */
export const HAIR_COLORS: string[] = [
  '#171717', '#3B2A1E', '#6B4423', '#A8722E',
  '#D9B45A', '#EDEDED', '#8E44AD', '#2E6FB7',
];

/** Hair style ids (indices into `HAIR_STYLE_NAMES`). */
export const HAIR_STYLES: number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/** Human readable hair style names, indexed by hair style id. */
export const HAIR_STYLE_NAMES: string[] = [
  'Short', 'Spiky', 'Long', 'Bald', 'Mohawk', 'Afro',
  'Ponytail', 'Buzz', 'Side part', 'Curly', 'Headband', 'Cap',
];
