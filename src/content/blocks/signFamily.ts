/**
 * Sign family — the four sign forms a wood type can take.
 *
 * Signs are one of the few places where the material shows up on the item
 * rather than the block, so every form shares the wood's plank texture.
 */

import type { BlockDef } from '../../core/types';
import { TAGS } from '../tags';
import { defineBlock } from './common';

export interface SignBase {
  /** Id prefix, e.g. `oak`. */
  id: string;
  /** Display prefix, e.g. `Oak`. */
  name: string;
  family: string;
  /** Texture used by every sign form. */
  texture: string;
  hardness: number;
  flammable?: boolean;
  tool?: 'none' | 'axe';
}

export type SignForm = 'sign' | 'hanging_sign' | 'wall_sign' | 'wall_hanging_sign';

const FORM_NAMES: Record<SignForm, string> = {
  sign: 'Sign',
  hanging_sign: 'Hanging Sign',
  wall_sign: 'Wall Sign',
  wall_hanging_sign: 'Wall Hanging Sign',
};

/** Generate the four sign forms of one wood type. */
export function signFamily(base: SignBase): BlockDef[] {
  return (Object.keys(FORM_NAMES) as SignForm[]).map((form) =>
    defineBlock({
      id: `${base.id}_${form}`,
      name: `${base.name} ${FORM_NAMES[form]}`,
      family: base.family,
      hardness: base.hardness,
      flammable: base.flammable,
      tool: base.tool ?? 'axe',
      textures: base.texture,
      tags: [TAGS.IS_SIGN],
      shape: form.includes('hanging') ? 'plant' : 'plant',
      render: 'cutout',
      passable: true,
      params: { form, material: base.id },
    }),
  );
}
