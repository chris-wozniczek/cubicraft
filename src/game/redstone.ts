/**
 * Redstone.
 *
 * A compact implementation of the redstone component set: levers, buttons,
 * pressure plates and torches generate power; wire carries it; lamps, doors,
 * lamps and observers react to it.
 *
 * Power propagates one level per block through wire, exactly like Minecraft,
 * so a signal travels sixteen blocks from a source.
 */

export const MAX_POWER = 15;

/** The block names the system knows about. */
const SOURCES = new Set(['lever', 'stone_button', 'polished_blackstone_button', 'oak_pressure_plate', 'stone_pressure_plate']);
const TORCHES = new Set(['redstone_torch', 'redstone_wall_torch']);
const WIRES = new Set(['redstone_wire']);
const LAMPS = new Set(['redstone_lamp']);
const LIT_LAMP = 'lit_redstone_lamp';
const DOORS = new Set(['oak_door', 'iron_door', 'spruce_door', 'birch_door', 'jungle_door', 'acacia_door', 'dark_oak_door']);
const OBSERVERS = new Set(['observer']);

export interface RedstoneState {
  /** Positions that currently carry power. */
  powered: Set<string>;
  /** Positions of lamps that are lit. */
  lit: Set<string>;
  /** Positions of doors that are open. */
  openDoors: Set<string>;
}

export class RedstoneSystem {
  /** Blocks that have been manually switched on (levers, buttons). */
  readonly active = new Set<string>();
  readonly state: RedstoneState = {
    powered: new Set(),
    lit: new Set(),
    openDoors: new Set(),
  };

  /** Called when a lamp or door changes state. */
  onStateChange: (x: number, y: number, z: number, lit: boolean) => void = () => {};

  /**
   * Recompute the power network around a position.
   * `blockAt` returns the block name at a world position.
   */
  update(
    x: number,
    y: number,
    z: number,
    blockAt: (x: number, y: number, z: number) => string,
  ): void {
    const powered = new Set<string>();
    const queue: { x: number; y: number; z: number; power: number }[] = [];

    const push = (px: number, py: number, pz: number, power: number): void => {
      const k = blockKey(px, py, pz);
      if (powered.has(k)) return;
      powered.add(k);
      queue.push({ x: px, y: py, z: pz, power });
    };

    // Seed from every source within reach of the change.
    const reach = 18;
    for (let dx = -reach; dx <= reach; dx++) {
      for (let dy = -reach; dy <= reach; dy++) {
        for (let dz = -reach; dz <= reach; dz++) {
          const name = blockAt(x + dx, y + dy, z + dz);
          if (!name) continue;
          if (SOURCES.has(name) && this.active.has(blockKey(x + dx, y + dy, z + dz))) {
            push(x + dx, y + dy, z + dz, MAX_POWER);
          }
        }
      }
    }

    // Propagate through wire and into receivers.
    while (queue.length > 0) {
      const current = queue.shift()!;
      const nextPower = current.power - 1;
      if (nextPower <= 0) continue;

      for (const [dx, dy, dz] of NEIGHBOURS) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        const nz = current.z + dz;
        const name = blockAt(nx, ny, nz);
        if (!name) continue;

        if (WIRES.has(name)) {
          const k = blockKey(nx, ny, nz);
          if (!powered.has(k)) push(nx, ny, nz, nextPower);
        } else if (LAMPS.has(name) || DOORS.has(name) || OBSERVERS.has(name)) {
          // Receivers switch on when a powered neighbour feeds them.
          if (nextPower > 0) powered.add(blockKey(nx, ny, nz));
        } else if (TORCHES.has(name)) {
          // A torch is powered when the block below it is powered.
          if (dy === -1 && powered.has(blockKey(nx, ny + 1, nz))) {
            powered.add(blockKey(nx, ny, nz));
          }
        }
      }
    }

    // A block is powered when an adjacent source or powered wire feeds it.
    const lit = new Set<string>();
    const openDoors = new Set<string>();
    for (const [px, py, pz] of keys(powered)) {
      const name = blockAt(px, py, pz);
      if (LAMPS.has(name)) lit.add(blockKey(px, py, pz));
    }

    // Receivers next to powered wire or a source switch on.
    for (const [px, py, pz] of keys(powered)) {
      for (const [dx, dy, dz] of NEIGHBOURS) {
        const nx = px + dx;
        const ny = py + dy;
        const nz = pz + dz;
        const name = blockAt(nx, ny, nz);
        if (!name) continue;
        if (DOORS.has(name)) openDoors.add(blockKey(nx, ny, nz));
      }
    }

    // Report the lamps whose state changed.
    for (const k of lit) {
      if (!this.state.lit.has(k)) {
        const [lx, ly, lz] = k.split(',').map(Number);
        this.onStateChange(lx, ly, lz, true);
      }
    }
    for (const k of this.state.lit) {
      if (!lit.has(k)) {
        const [lx, ly, lz] = k.split(',').map(Number);
        this.onStateChange(lx, ly, lz, false);
      }
    }

    this.state.powered = powered;
    this.state.lit = lit;
    this.state.openDoors = openDoors;
  }

  /** Flip a lever or press a button. */
  toggle(x: number, y: number, z: number): boolean {
    const k = blockKey(x, y, z);
    if (this.active.has(k)) {
      this.active.delete(k);
      return false;
    }
    this.active.add(k);
    return true;
  }

  /** The lit block name for a lamp position, or the unlit one. */
  lampName(lit: boolean): string {
    return lit ? LIT_LAMP : 'redstone_lamp';
  }
}

const NEIGHBOURS: [number, number, number][] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

function blockKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

function* keys(set: Set<string>): Generator<[number, number, number]> {
  for (const k of set) {
    const [x, y, z] = k.split(',').map(Number);
    yield [x, y, z];
  }
}
