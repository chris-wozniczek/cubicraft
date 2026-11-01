/**
 * Mob rendering.
 *
 * Every mob is a boxy rig. Rather than one mesh per mob, each mob type owns
 * a handful of `InstancedMesh` parts, so forty sheep cost six draw calls
 * instead of two hundred and forty.
 */

import * as THREE from 'three';
import type { MobDef } from '../core/types';
import type { Entity } from '../game/entities';

interface MobTypeRender {
  def: MobDef;
  parts: {
    head: THREE.InstancedMesh;
    body: THREE.InstancedMesh;
    armL: THREE.InstancedMesh;
    armR: THREE.InstancedMesh;
    legL: THREE.InstancedMesh;
    legR: THREE.InstancedMesh;
  };
  count: number;
}

/** A simple procedural texture for a mob: a face on a flat body colour. */
function mobTexture(def: MobDef): THREE.Texture {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const seed = def.id.split('').reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 7);
  const hue = (seed % 360) / 360;
  const base = `hsl(${Math.round(hue * 360)}, 45%, 62%)`;
  const dark = `hsl(${Math.round(hue * 360)}, 45%, 38%)`;

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  // Subtle fur texture.
  for (let i = 0; i < 120; i++) {
    const x = (seed + i * 37) % size;
    const y = (seed * 3 + i * 53) % size;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)';
    ctx.fillRect(x, y, 2, 2);
  }
  // Eyes.
  ctx.fillStyle = '#161616';
  ctx.fillRect(6, 12, 3, 4);
  ctx.fillRect(23, 12, 3, 4);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(6, 12, 1, 1);
  ctx.fillRect(23, 12, 1, 1);
  // A darker band along the bottom.
  ctx.fillStyle = dark;
  ctx.fillRect(0, 26, size, 6);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class MobRenderer {
  readonly group = new THREE.Group();
  private readonly types = new Map<string, MobTypeRender>();
  private readonly matrix = new THREE.Matrix4();
  private readonly quaternion = new THREE.Quaternion();
  private readonly position = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();
  private readonly euler = new THREE.Euler();

  constructor(private readonly maxPerType = 64) {
    this.group.name = 'mobs';
    this.group.matrixAutoUpdate = false;
  }

  private ensureType(def: MobDef): MobTypeRender {
    let render = this.types.get(def.id);
    if (render) return render;

    const texture = mobTexture(def);
    const material = new THREE.MeshLambertMaterial({ map: texture, transparent: false });
    const w = def.size.w;
    const h = def.size.h;
    const headSize = Math.min(w * 0.85, 0.85);
    const bodyWidth = w;
    const bodyHeight = h * 0.55;
    const legHeight = h * 0.45;

    const make = (sx: number, sy: number, sz: number): THREE.InstancedMesh => {
      const geometry = new THREE.BoxGeometry(sx, sy, sz);
      const mesh = new THREE.InstancedMesh(geometry, material, this.maxPerType);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.group.add(mesh);
      return mesh;
    };

    render = {
      def,
      parts: {
        head: make(headSize, headSize, headSize),
        body: make(bodyWidth, bodyHeight, bodyWidth * 0.6),
        armL: make(w * 0.25, bodyHeight * 0.9, w * 0.25),
        armR: make(w * 0.25, bodyHeight * 0.9, w * 0.25),
        legL: make(w * 0.28, legHeight, w * 0.28),
        legR: make(w * 0.28, legHeight, w * 0.28),
      },
      count: 0,
    };
    this.types.set(def.id, render);
    return render;
  }

  /** Rebuild the instance buffers for the given entities. */
  update(entities: readonly Entity[], defs: { get(id: string): MobDef | undefined }): void {
    const counts = new Map<string, number>();
    for (const entity of entities) counts.set(entity.type, (counts.get(entity.type) ?? 0) + 1);

    for (const [type, render] of this.types) {
      const needed = Math.min(counts.get(type) ?? 0, this.maxPerType);
      render.count = needed;
      render.parts.head.count = needed;
      render.parts.body.count = needed;
      render.parts.armL.count = needed;
      render.parts.armR.count = needed;
      render.parts.legL.count = needed;
      render.parts.legR.count = needed;
    }

    const indices = new Map<string, number>();
    for (const entity of entities) {
      const def = defs.get(entity.type);
      if (!def) continue;
      const render = this.ensureType(def);
      const index = indices.get(entity.type) ?? 0;
      if (index >= this.maxPerType) continue;
      indices.set(entity.type, index + 1);

      const w = def.size.w;
      const h = def.size.h;
      const headSize = Math.min(w * 0.85, 0.85);
      const bodyHeight = h * 0.55;
      const legHeight = h * 0.45;
      const swing = Math.sin(entity.walkPhase) * 0.6;
      const hurt = entity.hurtTimer > 0 ? Math.sin(entity.hurtTimer * 40) * 0.25 : 0;

      this.euler.set(entity.pitch, entity.yaw, hurt);
      this.quaternion.setFromEuler(this.euler);

      const set = (
        mesh: THREE.InstancedMesh,
        ox: number,
        oy: number,
        oz: number,
        sx: number,
        sy: number,
        sz: number,
      ): void => {
        this.position.set(entity.x + ox, entity.y + oy, entity.z + oz);
        this.scale.set(sx, sy, sz);
        this.matrix.compose(this.position, this.quaternion, this.scale);
        mesh.setMatrixAt(index, this.matrix);
      };

      set(render.parts.body, 0, legHeight + bodyHeight / 2, 0, 1, 1, 1);
      set(render.parts.head, 0, legHeight + bodyHeight + headSize / 2, 0, 1, 1, 1);
      set(render.parts.armL, -w * 0.6, legHeight + bodyHeight * 0.55, 0, 1, 1, 1);
      set(render.parts.armR, w * 0.6, legHeight + bodyHeight * 0.55, 0, 1, 1, 1);
      set(render.parts.legL, -w * 0.22, legHeight / 2, 0, 1, 1, 1);
      set(render.parts.legR, w * 0.22, legHeight / 2, 0, 1, 1, 1);

      // Limb swing by tilting the arms and legs.
      this.euler.set(swing, entity.yaw, 0);
      this.quaternion.setFromEuler(this.euler);
      set(render.parts.armL, -w * 0.6, legHeight + bodyHeight * 0.55, 0, 1, 1, 1);
      set(render.parts.armR, w * 0.6, legHeight + bodyHeight * 0.55, 0, 1, 1, 1);
      this.euler.set(-swing, entity.yaw, 0);
      this.quaternion.setFromEuler(this.euler);
      set(render.parts.legL, -w * 0.22, legHeight / 2, 0, 1, 1, 1);
      set(render.parts.legR, w * 0.22, legHeight / 2, 0, 1, 1, 1);
    }

    for (const render of this.types.values()) {
      render.parts.head.instanceMatrix.needsUpdate = true;
      render.parts.body.instanceMatrix.needsUpdate = true;
      render.parts.armL.instanceMatrix.needsUpdate = true;
      render.parts.armR.instanceMatrix.needsUpdate = true;
      render.parts.legL.instanceMatrix.needsUpdate = true;
      render.parts.legR.instanceMatrix.needsUpdate = true;
    }
  }

  dispose(): void {
    for (const render of this.types.values()) {
      for (const mesh of Object.values(render.parts)) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
    }
    this.types.clear();
    this.group.clear();
  }
}
