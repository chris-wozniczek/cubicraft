/**
 * Cubicraft — avatar kit and skin generator tests.
 *
 * The generator is headless by design: without a DOM it falls back to the
 * software rasteriser, so these tests run in plain Node (no jsdom needed).
 */

import { describe, expect, it } from 'vitest';
import type { AvatarSpec } from '../src/core/types';
import {
  BLOCKY_FONT, SKIN_REGIONS, generateSkinCanvas, getSkinPixels, readRegion,
} from '../src/assets/skinGenerator';
import type { SkinRect } from '../src/assets/skinGenerator';
import { HAIR_STYLES, KITS, SKIN_TONES, getKit } from '../src/assets/kits';
import type { PaintOp } from '../src/assets/kits';
import { AvatarModel, createAvatarModel } from '../src/assets/avatarModel';
import { ICON_NAMES, getIcon } from '../src/assets/icons';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MADRID_GOLD = '#C9A227';
const MADRID_BLACK = '#111111';
const BARCA_BLUE = '#0040A0';
const BARCA_RED = '#A50044';
const BARCA_NAVY = '#002D62';

function spec(overrides: Partial<AvatarSpec> = {}): AvatarSpec {
  return {
    kit: 'rm25',
    skinTone: 2,
    hair: 0,
    hairColor: 1,
    name: 'ALEX',
    number: 7,
    ...overrides,
  };
}

function pixelsOf(s: AvatarSpec): Uint8ClampedArray {
  return getSkinPixels(generateSkinCanvas(s));
}

function regionOf(s: AvatarSpec, rect: SkinRect): Uint8ClampedArray {
  return readRegion(pixelsOf(s), rect);
}

function rgb(hex: string): [number, number, number] {
  const v = hex.replace('#', '');
  return [
    parseInt(v.slice(0, 2), 16),
    parseInt(v.slice(2, 4), 16),
    parseInt(v.slice(4, 6), 16),
  ];
}

/** Count pixels that exactly match `hex` (alpha is ignored). */
function countExact(region: Uint8ClampedArray, hex: string): number {
  const [r, g, b] = rgb(hex);
  let count = 0;
  for (let i = 0; i < region.length; i += 4) {
    if (region[i] === r && region[i + 1] === g && region[i + 2] === b) count++;
  }
  return count;
}

/** Count near-white pixels (the "predominantly white" check). */
function countWhiteish(region: Uint8ClampedArray, threshold = 235): number {
  let count = 0;
  for (let i = 0; i < region.length; i += 4) {
    if (region[i] >= threshold && region[i + 1] >= threshold && region[i + 2] >= threshold) count++;
  }
  return count;
}

function signature(region: Uint8ClampedArray): string {
  let out = '';
  for (let i = 0; i < region.length; i += 4) {
    out += `${region[i]},${region[i + 1]},${region[i + 2]},${region[i + 3]};`;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateSkinCanvas', () => {
  it('produces a 64x64 fully opaque texture', () => {
    const canvas = generateSkinCanvas(spec());
    expect(canvas.width).toBe(64);
    expect(canvas.height).toBe(64);
    const pixels = getSkinPixels(canvas);
    expect(pixels.length).toBe(64 * 64 * 4);
    for (let i = 3; i < pixels.length; i += 4) {
      expect(pixels[i]).toBe(255);
    }
  });

  it('is deterministic for the same spec', () => {
    expect(signature(regionOf(spec(), SKIN_REGIONS.body.front)))
      .toBe(signature(regionOf(spec(), SKIN_REGIONS.body.front)));
  });
});

describe('Real Madrid 2025/26 home kit', () => {
  const front = regionOf(spec({ kit: 'rm25' }), SKIN_REGIONS.body.front);

  it('is predominantly white', () => {
    const white = countWhiteish(front);
    expect(white / (front.length / 4)).toBeGreaterThan(0.5);
  });

  it('has gold trim pixels', () => {
    expect(countExact(front, MADRID_GOLD)).toBeGreaterThan(0);
  });

  it('has black sponsor/stripe pixels', () => {
    expect(countExact(front, MADRID_BLACK)).toBeGreaterThan(0);
  });

  it('puts the black three-stripes on the sleeve', () => {
    const sleeve = regionOf(spec({ kit: 'rm25' }), SKIN_REGIONS.armR.front);
    expect(countExact(sleeve, MADRID_BLACK)).toBeGreaterThan(0);
  });
});

describe('FC Barcelona 2025/26 home kit', () => {
  const front = regionOf(spec({ kit: 'fcb25' }), SKIN_REGIONS.body.front);

  it('has Deep Royal Blue pixels', () => {
    expect(countExact(front, BARCA_BLUE)).toBeGreaterThan(0);
  });

  it('has Noble Red pixels', () => {
    expect(countExact(front, BARCA_RED)).toBeGreaterThan(0);
  });

  it('has navy raglan pixels', () => {
    expect(countExact(front, BARCA_NAVY)).toBeGreaterThan(0);
  });

  it('has navy raglan sleeves', () => {
    const sleeve = regionOf(spec({ kit: 'fcb25' }), SKIN_REGIONS.armR.front);
    expect(countExact(sleeve, BARCA_NAVY)).toBeGreaterThan(0);
  });
});

describe('shirt number', () => {
  it('is drawn on the torso back in the kit number colour', () => {
    const kit = getKit('fcb25');
    const back = regionOf(spec({ kit: 'fcb25', number: 7 }), SKIN_REGIONS.body.back);
    expect(countExact(back, kit.number.color)).toBeGreaterThan(0);

    // The number sits below the name, so the lower half of the back must
    // contain number-coloured pixels.
    const rows = SKIN_REGIONS.body.back.h;
    let lower = 0;
    for (let y = 4; y < rows; y++) {
      for (let x = 0; x < SKIN_REGIONS.body.back.w; x++) {
        const i = (y * SKIN_REGIONS.body.back.w + x) * 4;
        const [r, g, b] = rgb(kit.number.color);
        if (back[i] === r && back[i + 1] === g && back[i + 2] === b) lower++;
      }
    }
    expect(lower).toBeGreaterThan(0);
  });

  it('follows the player number', () => {
    const seven = signature(regionOf(spec({ kit: 'fcb25', number: 7 }), SKIN_REGIONS.body.back));
    const nine = signature(regionOf(spec({ kit: 'fcb25', number: 9 }), SKIN_REGIONS.body.back));
    expect(seven).not.toBe(nine);
  });
});

describe('hair', () => {
  it('changes the head top pixels when the style changes', () => {
    const short = signature(regionOf(spec({ hair: 0 }), SKIN_REGIONS.head.top));
    const bald = signature(regionOf(spec({ hair: 3 }), SKIN_REGIONS.head.top));
    expect(short).not.toBe(bald);
  });

  it('gives every hair style its own head top', () => {
    const signatures = new Set(
      HAIR_STYLES.map((hair) => signature(regionOf(spec({ hair }), SKIN_REGIONS.head.top))),
    );
    expect(signatures.size).toBe(HAIR_STYLES.length);
  });

  it('uses the chosen hair colour', () => {
    const dark = regionOf(spec({ hair: 0, hairColor: 0 }), SKIN_REGIONS.head.top);
    const blonde = regionOf(spec({ hair: 0, hairColor: 4 }), SKIN_REGIONS.head.top);
    expect(signature(dark)).not.toBe(signature(blonde));
  });
});

describe('skin tone', () => {
  it('changes the bare forearm pixels', () => {
    const arm = SKIN_REGIONS.armR.front;
    const forearm: SkinRect = { x: arm.x, y: arm.y + 4, w: arm.w, h: 8 };
    const light = regionOf(spec({ kit: 'plain', skinTone: 0 }), forearm);
    const dark = regionOf(spec({ kit: 'plain', skinTone: 6 }), forearm);

    expect(countExact(light, SKIN_TONES[0])).toBeGreaterThan(0);
    expect(countExact(dark, SKIN_TONES[6])).toBeGreaterThan(0);
    expect(signature(light)).not.toBe(signature(dark));
  });
});

describe('kit lookup', () => {
  it('finds the club kits', () => {
    expect(getKit('rm25').id).toBe('rm25');
    expect(getKit('fcb25').id).toBe('fcb25');
    expect(getKit('rm25').club).toBe('Real Madrid');
    expect(getKit('fcb25').club).toBe('FC Barcelona');
  });

  it('falls back to the plain kit', () => {
    expect(getKit('nonexistent').id).toBe('plain');
    expect(getKit('').id).toBe('plain');
  });
});

describe('paint op coverage', () => {
  it('exercises every paint op variant in at least one kit', () => {
    const used = new Set<string>();
    for (const kit of KITS) {
      for (const list of Object.values(kit.regions)) {
        for (const op of list as PaintOp[]) used.add(op.op);
      }
    }
    const expected = [
      'fill', 'stripe', 'gradient', 'dots', 'arc', 'band',
      'tri', 'text', 'sprite', 'number',
    ];
    for (const op of expected) {
      expect(used.has(op)).toBe(true);
    }
  });
});

describe('blocky font', () => {
  it('has 5x7 glyphs for digits and letters', () => {
    for (const ch of '0123456789') {
      expect(BLOCKY_FONT[ch]).toHaveLength(7);
      for (const row of BLOCKY_FONT[ch]) {
        expect(row).toBeLessThanOrEqual(31);
        expect(row).toBeGreaterThanOrEqual(0);
      }
    }
    for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
      expect(BLOCKY_FONT[ch]).toHaveLength(7);
    }
  });
});

describe('avatar model', () => {
  it('exposes the named parts with Minecraft proportions', () => {
    const model = createAvatarModel(spec());
    const names = model.group.children.map((child) => child.name);
    expect(names).toEqual(['head', 'body', 'armR', 'armL', 'legR', 'legL']);

    const head = model.group.getObjectByName('head');
    expect(head?.position.y).toBeCloseTo(1.75);

    const body = model.group.getObjectByName('body');
    expect(body?.position.y).toBeCloseTo(1.125);

    const armR = model.group.getObjectByName('armR');
    expect(armR?.position.x).toBeCloseTo(-0.375);
    expect(armR?.position.y).toBeCloseTo(1.5);

    const legR = model.group.getObjectByName('legR');
    expect(legR?.position.x).toBeCloseTo(-0.125);
    expect(legR?.position.y).toBeCloseTo(0.75);

    model.dispose();
  });

  it('re-skins in place and poses the limbs', () => {
    const model = new AvatarModel(spec({ kit: 'fcb25' }));
    const before = model.skinTexture;
    model.setSpec(spec({ kit: 'rm25' }));
    expect(model.skinTexture).not.toBe(before);

    model.setLimbPose(Math.PI / 2, 1);
    const legL = model.group.getObjectByName('legL');
    const legR = model.group.getObjectByName('legR');
    expect(legL?.rotation.x).toBeGreaterThan(0.9);
    expect(legR?.rotation.x).toBeLessThan(-0.9);

    model.dispose();
  });
});

describe('icons', () => {
  it('exposes the expected icon names', () => {
    for (const name of ['pickaxe', 'sword', 'apple', 'heart', 'cog', 'player', 'sun', 'moon']) {
      expect(ICON_NAMES).toContain(name);
    }
  });

  it('memoises textures and falls back for unknown icons', () => {
    const apple = getIcon('apple');
    expect(getIcon('apple')).toBe(apple);
    expect(getIcon('nonsense')).toBe(getIcon('star'));
  });
});
