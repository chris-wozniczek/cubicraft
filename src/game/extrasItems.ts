/**
 * The items that power the mod-style extras.
 *
 * They are registered before the content registry freezes, and only if the
 * full content set does not already define them.
 */

import { items } from '../content';
import type { ItemDef } from '../core/types';

function item(def: ItemDef): ItemDef {
  return def;
}

/** Register the extra items, skipping any the content set already has. */
export function registerExtrasItems(): void {
  if (items.isFrozen()) return;

  const extras: ItemDef[] = [
    item({
      id: 'camera',
      displayName: 'Camera',
      stackSize: 16,
      tags: ['extras'],
      icon: 'camera',
    }),
    item({
      id: 'laser',
      displayName: 'Laser',
      stackSize: 16,
      tags: ['extras'],
      icon: 'laser',
    }),
    item({
      id: 'paint_bucket',
      displayName: 'Paint Bucket',
      stackSize: 16,
      tags: ['extras'],
      icon: 'paint_bucket',
    }),
    item({
      id: 'waypoint_compass',
      displayName: 'Waypoint Compass',
      stackSize: 16,
      tags: ['extras'],
      icon: 'compass',
    }),
    item({
      id: 'time_control',
      displayName: 'Time Control',
      stackSize: 16,
      tags: ['extras'],
      icon: 'sun',
    }),
    item({
      id: 'laser_emitter',
      displayName: 'Laser Emitter',
      stackSize: 16,
      tags: ['extras'],
      icon: 'laser',
    }),
  ];

  for (const def of extras) {
    if (!items.has(def.id)) items.register(def);
  }
}
