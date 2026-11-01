/**
 * The mod-style extras: cameras, lasers, the paint bucket, the waypoint
 * compass and the time control.
 *
 * They are built on systems that already exist for the vanilla features, so
 * they cost little relative to how much they add to the game.
 */

import * as THREE from 'three';

import { raycastVoxel, directionFromAngles } from '../engine/voxel/raycast';
import { CHUNK_X, CHUNK_Z } from '../core/types';
import { log } from '../core/log';

export interface PlacedCamera {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
}

/** A camera the player can place and then look through. */
export class CameraSystem {
  readonly group = new THREE.Group();
  readonly cameras: PlacedCamera[] = [];
  /** The camera currently being viewed, or null for the player's own view. */
  activeIndex = -1;

  private readonly lens: THREE.Mesh;
  private readonly body: THREE.Mesh;

  constructor() {
    this.group.name = 'cameras';

    const material = new THREE.MeshLambertMaterial({ color: 0x2b3038 });
    this.body = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 0.5), material);
    this.body.position.set(0, 0.2, 0);
    this.group.add(this.body);

    this.lens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.12, 0.14, 12),
      new THREE.MeshLambertMaterial({ color: 0x101318, emissive: 0x1b3a4a }),
    );
    this.lens.rotation.x = Math.PI / 2;
    this.lens.position.set(0, 0.2, 0.3);
    this.group.add(this.lens);
  }

  add(x: number, y: number, z: number, yaw: number, pitch: number): PlacedCamera {
    const camera: PlacedCamera = { x, y, z, yaw, pitch };
    this.cameras.push(camera);
    return camera;
  }

  removeAt(x: number, y: number, z: number): boolean {
    const index = this.cameras.findIndex((c) =>
      Math.floor(c.x) === x && Math.floor(c.y) === y && Math.floor(c.z) === z,
    );
    if (index < 0) return false;
    this.cameras.splice(index, 1);
    if (this.activeIndex >= this.cameras.length) this.activeIndex = -1;
    return true;
  }

  /** Position and orientation of the active camera, or null. */
  active(): PlacedCamera | null {
    if (this.activeIndex < 0 || this.activeIndex >= this.cameras.length) return null;
    return this.cameras[this.activeIndex];
  }

  /** Show a small model of every placed camera in the world. */
  update(): void {
    while (this.group.children.length > this.cameras.length) {
      const child = this.group.children[0];
      this.group.remove(child);
    }
    while (this.group.children.length < this.cameras.length) {
      const clone = this.body.clone();
      const lens = this.lens.clone();
      clone.add(lens);
      this.group.add(clone);
    }
    this.cameras.forEach((camera, index) => {
      const child = this.group.children[index];
      child.position.set(camera.x + 0.5, camera.y + 0.5, camera.z + 0.5);
      child.rotation.y = camera.yaw;
      child.rotation.x = camera.pitch;
    });
  }
}

/**
 * The laser.
 *
 * A handheld laser fires a beam that damages creatures in its path. A
 * placeable emitter does the same from a fixed position and can be toggled
 * with a right click.
 */
export class LaserSystem {
  readonly group = new THREE.Group();

  /** Emitters placed in the world, keyed by their block position. */
  readonly emitters = new Map<string, { x: number; y: number; z: number; yaw: number; on: boolean }>();

  private readonly beam: THREE.Mesh;
  private readonly beamMaterial: THREE.MeshBasicMaterial;
  private beamLife = 0;

  constructor() {
    this.group.name = 'lasers';
    this.beamMaterial = new THREE.MeshBasicMaterial({
      color: 0xff5a7a,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 6), this.beamMaterial);
    this.beam.visible = false;
    this.group.add(this.beam);
  }

  /** Fire the beam from a point in a direction. Returns the end point. */
  fire(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number,
    isSolid: (x: number, y: number, z: number) => boolean,
  ): THREE.Vector3 {
    const hit = raycastVoxel(origin.x, origin.y, origin.z, direction.x, direction.y, direction.z, {
      maxDistance,
      test: isSolid,
    });
    const end = hit
      ? new THREE.Vector3(hit.x + 0.5 + hit.nx * 0.5, hit.y + 0.5 + hit.ny * 0.5, hit.z + 0.5 + hit.nz * 0.5)
      : origin.clone().addScaledVector(direction, maxDistance);

    const length = origin.distanceTo(end);
    this.beam.position.copy(origin).lerp(end, 0.5);
    this.beam.scale.set(1, length, 1);
    this.beam.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      end.clone().sub(origin).normalize(),
    );
    this.beam.visible = true;
    this.beamLife = 0.12;
    return end;
  }

  /** Toggle a placed emitter. */
  toggleEmitter(x: number, y: number, z: number, yaw: number): boolean {
    const key = `${x},${y},${z}`;
    const existing = this.emitters.get(key);
    if (existing) {
      existing.on = !existing.on;
      return existing.on;
    }
    this.emitters.set(key, { x, y, z, yaw, on: true });
    return true;
  }

  update(dt: number): void {
    if (this.beamLife > 0) {
      this.beamLife -= dt;
      if (this.beamLife <= 0) this.beam.visible = false;
    }
  }
}

/** A marker that shows where a waypoint is. */
export interface Waypoint {
  name: string;
  x: number;
  y: number;
  z: number;
}

/** A column of light that marks a waypoint. */
export class WaypointSystem {
  readonly waypoints: Waypoint[] = [];
  readonly group = new THREE.Group();
  private readonly markers: THREE.Mesh[] = [];

  constructor() {
    this.group.name = 'waypoints';
  }

  add(name: string, x: number, y: number, z: number): Waypoint {
    const waypoint: Waypoint = { name, x, y, z };
    this.waypoints.push(waypoint);

    const marker = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 40, 8, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x6fd0ff,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    marker.position.set(x, y + 20, z);
    this.group.add(marker);
    this.markers.push(marker);
    return waypoint;
  }

  /** The waypoint nearest to a position. */
  nearest(x: number, y: number, z: number): Waypoint | null {
    let best: Waypoint | null = null;
    let bestDistance = Infinity;
    for (const waypoint of this.waypoints) {
      const distance = Math.hypot(waypoint.x - x, waypoint.y - y, waypoint.z - z);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = waypoint;
      }
    }
    return best;
  }

  update(elapsed: number): void {
    this.markers.forEach((marker, index) => {
      const waypoint = this.waypoints[index];
      if (!waypoint) return;
      marker.rotation.y = elapsed * 0.6;
      const material = marker.material as THREE.MeshBasicMaterial;
      material.opacity = 0.2 + Math.sin(elapsed * 2 + index) * 0.08;
    });
  }
}

/**
 * The paint bucket recolours a block by swapping it for the matching dyed
 * block, which keeps the change inside the ordinary block system.
 */
export const PAINT_COLOURS: { id: string; wool: string; terracotta: string; label: string }[] = [
  { id: 'white', wool: 'white_wool', terracotta: 'white_terracotta', label: 'White' },
  { id: 'red', wool: 'red_wool', terracotta: 'red_terracotta', label: 'Red' },
  { id: 'orange', wool: 'orange_wool', terracotta: 'orange_terracotta', label: 'Orange' },
  { id: 'yellow', wool: 'yellow_wool', terracotta: 'yellow_terracotta', label: 'Yellow' },
  { id: 'lime', wool: 'lime_wool', terracotta: 'lime_terracotta', label: 'Lime' },
  { id: 'green', wool: 'green_wool', terracotta: 'green_terracotta', label: 'Green' },
  { id: 'cyan', wool: 'cyan_wool', terracotta: 'cyan_terracotta', label: 'Cyan' },
  { id: 'light_blue', wool: 'light_blue_wool', terracotta: 'light_blue_terracotta', label: 'Light Blue' },
  { id: 'blue', wool: 'blue_wool', terracotta: 'blue_terracotta', label: 'Blue' },
  { id: 'purple', wool: 'purple_wool', terracotta: 'purple_terracotta', label: 'Purple' },
  { id: 'magenta', wool: 'magenta_wool', terracotta: 'magenta_terracotta', label: 'Magenta' },
  { id: 'pink', wool: 'pink_wool', terracotta: 'pink_terracotta', label: 'Pink' },
  { id: 'gray', wool: 'gray_wool', terracotta: 'gray_terracotta', label: 'Grey' },
  { id: 'light_gray', wool: 'light_gray_wool', terracotta: 'light_gray_terracotta', label: 'Light Grey' },
  { id: 'brown', wool: 'brown_wool', terracotta: 'brown_terracotta', label: 'Brown' },
  { id: 'black', wool: 'black_wool', terracotta: 'black_terracotta', label: 'Black' },
];

/** Pick the next colour in the palette. */
export function nextPaintColour(current: number): number {
  return (current + 1) % PAINT_COLOURS.length;
}

void CHUNK_X;
void CHUNK_Z;
void directionFromAngles;
void log;
