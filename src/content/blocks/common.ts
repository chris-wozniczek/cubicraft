/**
 * Block definition helpers.
 *
 * `defineBlock` fills in every field of `BlockDef` so family generators only
 * have to state what actually differs between blocks. The mining tags are
 * derived here: a block that needs a pickaxe gets `mineable/pickaxe`, and a
 * block with a mining level gets the matching `needs_*_tool` gate, so the
 * ladder can never drift between families.
 */

import type {
  BlockDef,
  BlockHook,
  BlockShape,
  DropTable,
  MiningLevel,
  RenderGroup,
  ToolKind,
} from '../../core/types';
import { TAGS, needsToolTag, toolTag } from '../tags';

export interface BlockTextures {
  top?: string;
  side?: string;
  bottom?: string;
  front?: string;
}

export interface BlockSpec {
  id: string;
  /** Human readable name shown in the UI. */
  name: string;
  /** Family this block belongs to (drives worldgen and renderer lookups). */
  family: string;
  hardness?: number;
  blastResistance?: number;
  lightEmission?: number;
  tool?: ToolKind;
  /** Mining level required to get a drop. */
  requiresToolTier?: MiningLevel;
  /** Whether only the correct tool drops anything. */
  correctToolDrops?: boolean;
  flammable?: boolean;
  transparent?: boolean;
  liquid?: boolean;
  /** Affected by gravity (sand, gravel). */
  gravity?: boolean;
  /** Half-height block. */
  slabShape?: boolean;
  waterloggable?: boolean;
  axis?: 'y' | 'x' | 'z';
  shape?: BlockShape;
  render?: RenderGroup;
  /** One texture name for every face, or a per-face override. */
  textures: string | BlockTextures;
  drops?: DropTable[];
  tags?: string[];
  hooks?: Partial<Record<BlockHook, string>>;
  /** Can be walked through. */
  passable?: boolean;
  /** Free-form family parameters (colour, wood, stage, ...). */
  params?: Record<string, unknown>;
}

/** Every block starts from these values; only the differences are stated. */
export const BLOCK_DEFAULTS = {
  hardness: 1.5,
  blastResistance: 1,
  lightEmission: 0,
  tool: 'none' as ToolKind,
  requiresToolTier: 0 as MiningLevel,
  correctToolDrops: false,
  flammable: false,
  transparent: false,
  liquid: false,
  gravity: false,
  slabShape: false,
  waterloggable: false,
  axis: 'y' as 'y' | 'x' | 'z',
  shape: 'cube' as BlockShape,
  render: 'opaque' as RenderGroup,
} as const;

/** Build a complete `BlockDef` from a compact spec. */
export function defineBlock(spec: BlockSpec): BlockDef {
  const tags = new Set<string>(spec.tags ?? []);

  const mined = toolTag(spec.tool ?? BLOCK_DEFAULTS.tool);
  if (mined) tags.add(mined);
  if (spec.correctToolDrops) tags.add(TAGS.NEEDS_TOOL);
  const gate = needsToolTag(spec.requiresToolTier ?? BLOCK_DEFAULTS.requiresToolTier);
  if (gate) tags.add(gate);

  const tex =
    typeof spec.textures === 'string'
      ? { top: spec.textures, side: spec.textures, bottom: spec.textures, front: spec.textures }
      : {
          top: spec.textures.top ?? spec.textures.side ?? 'stone',
          side: spec.textures.side ?? spec.textures.top ?? 'stone',
          bottom: spec.textures.bottom ?? spec.textures.side ?? spec.textures.top ?? 'stone',
          front: spec.textures.front ?? spec.textures.side ?? spec.textures.top ?? 'stone',
        };

  return {
    id: spec.id,
    displayName: spec.name,
    family: spec.family,
    params: spec.params ?? {},
    hardness: spec.hardness ?? BLOCK_DEFAULTS.hardness,
    blastResistance: spec.blastResistance ?? BLOCK_DEFAULTS.blastResistance,
    lightEmission: spec.lightEmission ?? BLOCK_DEFAULTS.lightEmission,
    tool: spec.tool ?? BLOCK_DEFAULTS.tool,
    requiresToolTier: spec.requiresToolTier ?? BLOCK_DEFAULTS.requiresToolTier,
    correctToolDrops: spec.correctToolDrops ?? BLOCK_DEFAULTS.correctToolDrops,
    flammable: spec.flammable ?? BLOCK_DEFAULTS.flammable,
    transparent: spec.transparent ?? BLOCK_DEFAULTS.transparent,
    liquid: spec.liquid ?? BLOCK_DEFAULTS.liquid,
    gravity: spec.gravity ?? BLOCK_DEFAULTS.gravity,
    slabShape: spec.slabShape ?? BLOCK_DEFAULTS.slabShape,
    waterloggable: spec.waterloggable ?? BLOCK_DEFAULTS.waterloggable,
    axis: spec.axis ?? BLOCK_DEFAULTS.axis,
    shape: spec.shape ?? BLOCK_DEFAULTS.shape,
    render: spec.render ?? BLOCK_DEFAULTS.render,
    textures: tex,
    drops: spec.drops ?? [{ item: spec.id, min: 1, max: 1 }],
    hooks: spec.hooks ?? {},
    tags: [...tags],
    passable: spec.passable ?? false,
  };
}

/** Tag set for a solid, mineable stone block. */
export function stoneTags(extra: string[] = []): string[] {
  return [TAGS.STONE, ...extra];
}

/** Tag set for a wooden block. */
export function woodTags(extra: string[] = []): string[] {
  return [TAGS.WOODEN, ...extra];
}
