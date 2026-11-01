/**
 * Coral family — the five coral species in both live and dead states.
 *
 * `coralFamily('tube', false)` produces the living tube coral forms,
 * `coralFamily('tube', true)` the dead ones. Dead corals lose their water
 * dependency and become plain blocks.
 */

import type { BlockDef } from '../../core/types';
import { TAGS } from '../tags';
import { defineBlock } from './common';

export type CoralType = 'tube' | 'brain' | 'bubble' | 'horn' | 'fire';

export interface CoralSpec {
  type: CoralType;
  name: string;
  texture: string;
}

export const CORAL_SPECS: readonly CoralSpec[] = [
  { type: 'tube', name: 'Tube Coral', texture: 'tube_coral' },
  { type: 'brain', name: 'Brain Coral', texture: 'brain_coral' },
  { type: 'bubble', name: 'Bubble Coral', texture: 'bubble_coral' },
  { type: 'horn', name: 'Horn Coral', texture: 'horn_coral' },
  { type: 'fire', name: 'Fire Coral', texture: 'fire_coral' },
];

/** Generate the five forms of one coral species in one state. */
export function coralFamily(type: CoralType, dead: boolean): BlockDef[] {
  const spec = CORAL_SPECS.find((c) => c.type === type);
  if (!spec) return [];

  const prefix = dead ? `dead_${type}` : type;
  const display = dead ? `Dead ${spec.name}` : spec.name;
  const texture = dead ? `dead_${spec.texture}` : spec.texture;

  const base = {
    family: 'coral',
    hardness: dead ? 0.3 : 0,
    tool: 'none' as const,
    transparent: !dead,
    render: (dead ? 'opaque' : 'cross') as 'opaque' | 'cross',
    tags: [TAGS.IS_PLANT],
    params: { coral: type, dead },
  };

  return [
    defineBlock({
      ...base,
      id: `${prefix}_coral`,
      name: display,
      textures: texture,
      shape: 'plant',
      passable: true,
      params: { coral: type, dead, part: 'plant' },
    }),
    defineBlock({
      ...base,
      id: `${prefix}_coral_block`,
      name: `${display} Block`,
      textures: texture,
      params: { coral: type, dead, part: 'block' },
    }),
    defineBlock({
      ...base,
      id: `${prefix}_coral_fan`,
      name: `${display} Fan`,
      textures: texture,
      shape: 'plant',
      passable: true,
      params: { coral: type, dead, part: 'fan' },
    }),
    defineBlock({
      ...base,
      id: `${prefix}_coral_fan_hanging`,
      name: `${display} Fan Hanging`,
      textures: texture,
      shape: 'plant',
      passable: true,
      params: { coral: type, dead, part: 'fan_hanging' },
    }),
    defineBlock({
      ...base,
      id: `${prefix}_wall_coral_fan`,
      name: `${display} Wall Fan`,
      textures: texture,
      shape: 'plant',
      passable: true,
      params: { coral: type, dead, part: 'wall_fan' },
    }),
  ];
}
