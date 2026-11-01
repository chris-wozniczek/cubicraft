/**
 * Door family — the six "interactive wood/metal" forms a material can take.
 *
 * Everything here is a parameter of the base material, so a new material only
 * needs one `DoorBase` entry to get a door, trapdoor, fence, fence gate,
 * button and pressure plate.
 */

import type { BlockDef, MiningLevel, ToolKind } from '../../core/types';
import { TAGS } from '../tags';
import { defineBlock } from './common';

export type DoorForm = 'door' | 'trapdoor' | 'fence' | 'fence_gate' | 'button' | 'pressure_plate';

export const ALL_DOOR_FORMS: readonly DoorForm[] = [
  'door',
  'trapdoor',
  'fence',
  'fence_gate',
  'button',
  'pressure_plate',
];

export interface DoorBase {
  /** Id prefix, e.g. `oak` or `iron`. */
  id: string;
  /** Display prefix, e.g. `Oak`. */
  name: string;
  family: string;
  /** Texture used by every form. */
  texture: string;
  hardness: number;
  blastResistance?: number;
  tool: ToolKind;
  requiresToolTier?: MiningLevel;
  correctToolDrops?: boolean;
  flammable?: boolean;
  /** Extra tags copied onto every form. */
  tags?: string[];
  /** Restrict the generated forms (gold has no fence, stone has no door). */
  forms?: readonly DoorForm[];
}

const FORM_NAMES: Record<DoorForm, string> = {
  door: 'Door',
  trapdoor: 'Trapdoor',
  fence: 'Fence',
  fence_gate: 'Fence Gate',
  button: 'Button',
  pressure_plate: 'Pressure Plate',
};

const FORM_TAGS: Record<DoorForm, string> = {
  door: TAGS.IS_DOOR,
  trapdoor: TAGS.IS_TRAPDOOR,
  fence: TAGS.IS_FENCE,
  fence_gate: TAGS.IS_FENCE,
  button: TAGS.IS_BUTTON,
  pressure_plate: TAGS.IS_PRESSURE_PLATE,
};

/** Generate every requested form of one material. */
export function doorFamily(base: DoorBase): BlockDef[] {
  const forms = base.forms ?? ALL_DOOR_FORMS;
  return forms.map((form) => {
    const thin = form === 'fence' || form === 'fence_gate';
    const flat = form === 'trapdoor' || form === 'pressure_plate';
    return defineBlock({
      id: `${base.id}_${form}`,
      name: `${base.name} ${FORM_NAMES[form]}`,
      family: base.family,
      hardness: base.hardness,
      blastResistance: base.blastResistance,
      tool: base.tool,
      requiresToolTier: base.requiresToolTier,
      correctToolDrops: base.correctToolDrops,
      flammable: base.flammable,
      textures: base.texture,
      tags: [FORM_TAGS[form], ...(base.tags ?? [])],
      shape: thin ? 'fence' : flat ? 'slab' : form === 'button' ? 'plant' : 'cube',
      slabShape: flat,
      transparent: thin,
      render: 'cutout',
      passable: form === 'button',
      params: { form, material: base.id },
    });
  });
}
