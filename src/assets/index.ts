/**
 * Cubicraft — public asset API.
 *
 * Everything the engine, UI and net layers need for avatars and icons is
 * re-exported from here so they never have to reach into module internals.
 */

// Kit data ------------------------------------------------------------------
export type { PaintOp, KitDef } from './kits';
export {
  KITS, DEFAULT_KIT_ID, getKit,
  SKIN_TONES, HAIR_COLORS, HAIR_STYLES, HAIR_STYLE_NAMES,
} from './kits';

// Skin generation -----------------------------------------------------------
export {
  SKIN_SIZE, SKIN_REGIONS,
  generateSkin, generateSkinCanvas, getSkinPixels, readRegion,
  setSkinAnisotropy, BLOCKY_FONT, measureText,
} from './skinGenerator';
export type { SkinRect, SkinRegionSet, SkinCanvas, RGBA } from './skinGenerator';
export { PixelBuffer, Canvas2DBackend, parseColor } from './skinGenerator';
export type { Surface } from './skinGenerator';

// Avatar model --------------------------------------------------------------
export { AvatarModel, createAvatarModel } from './avatarModel';

// Icons ---------------------------------------------------------------------
export { ICON_NAMES, getIcon, getIconDataUrl } from './icons';
