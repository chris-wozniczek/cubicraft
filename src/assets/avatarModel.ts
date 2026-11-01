/**
 * Cubicraft — the boxy Minecraft-style player model.
 *
 * Proportions are Minecraft's, in blocks (1 block = 1 unit):
 *
 *   head   0.5 cube        y 1.50 .. 2.00
 *   torso  0.50 x 0.75 x 0.25   y 0.75 .. 1.50
 *   arms   0.25 x 0.75 x 0.25   x +/-0.375, shoulder at y 1.50
 *   legs   0.25 x 0.75 x 0.25   x +/-0.125, hip at y 0.75
 *
 * The model faces +Z (the direction `Object3D.lookAt` points at) and the
 * character's right hand side is -X, matching the skin texture's "right"
 * regions.
 *
 * Limb meshes are built with their pivot at the top, so rotating `armL`,
 * `legR`, ... rotates them around the shoulder or hip, not around their
 * centre.
 */

import { BufferAttribute, BufferGeometry, CanvasTexture, Group, Mesh, MeshLambertMaterial } from 'three';
import type { AvatarSpec } from '../core/types';
import { generateSkin, SKIN_REGIONS } from './skinGenerator';
import type { SkinRect } from './skinGenerator';

/** Which skin rectangle is used for each face of a box. */
interface FaceRects {
  px: SkinRect; nx: SkinRect; py: SkinRect; ny: SkinRect; pz: SkinRect; nz: SkinRect;
}

const TEX = 64;

/** Convert a skin rectangle into normalised texture coordinates. */
function uvRect(rect: SkinRect): { u0: number; u1: number; v0: number; v1: number } {
  return {
    u0: rect.x / TEX,
    u1: (rect.x + rect.w) / TEX,
    // Canvas rows run downwards, three.js UVs run upwards.
    v0: 1 - (rect.y + rect.h) / TEX,
    v1: 1 - rect.y / TEX,
  };
}

/**
 * Build a box with explicit per-face UVs.
 *
 * `pivot` 'top' shifts the geometry so its top face sits at local y = 0,
 * which turns the mesh into a limb that rotates around its joint.
 */
function buildBox(
  w: number, h: number, d: number, rects: FaceRects, pivot: 'center' | 'top',
): BufferGeometry {
  const hw = w / 2;
  const hh = h / 2;
  const hd = d / 2;
  const yShift = pivot === 'top' ? -hh : 0;

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  type Vertex = [number, number, number];
  type Face = { rect: SkinRect; normal: Vertex; verts: Vertex[] };

  const faces: Face[] = [
    // +X: the character's left side; texture u runs from front to back.
    {
      rect: rects.px,
      normal: [1, 0, 0],
      verts: [[hw, -hh, hd], [hw, -hh, -hd], [hw, hh, -hd], [hw, hh, hd]],
    },
    // -X: the character's right side; texture u runs from back to front.
    {
      rect: rects.nx,
      normal: [-1, 0, 0],
      verts: [[-hw, -hh, -hd], [-hw, -hh, hd], [-hw, hh, hd], [-hw, hh, -hd]],
    },
    // +Y: top, texture top edge points to the back.
    {
      rect: rects.py,
      normal: [0, 1, 0],
      verts: [[-hw, hh, hd], [hw, hh, hd], [hw, hh, -hd], [-hw, hh, -hd]],
    },
    // -Y: bottom.
    {
      rect: rects.ny,
      normal: [0, -1, 0],
      verts: [[-hw, -hh, -hd], [hw, -hh, -hd], [hw, -hh, hd], [-hw, -hh, hd]],
    },
    // +Z: front.
    {
      rect: rects.pz,
      normal: [0, 0, 1],
      verts: [[-hw, -hh, hd], [hw, -hh, hd], [hw, hh, hd], [-hw, hh, hd]],
    },
    // -Z: back.
    {
      rect: rects.nz,
      normal: [0, 0, -1],
      verts: [[hw, -hh, -hd], [-hw, -hh, -hd], [-hw, hh, -hd], [hw, hh, -hd]],
    },
  ];

  for (const face of faces) {
    const base = positions.length / 3;
    const { u0, u1, v0, v1 } = uvRect(face.rect);
    const uvCorners: [number, number][] = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    for (let i = 0; i < 4; i++) {
      const vert = face.verts[i];
      positions.push(vert[0], vert[1] + yShift, vert[2]);
      normals.push(face.normal[0], face.normal[1], face.normal[2]);
      uvs.push(uvCorners[i][0], uvCorners[i][1]);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  return geometry;
}

const HEAD_FACES: FaceRects = {
  px: SKIN_REGIONS.head.left,
  nx: SKIN_REGIONS.head.right,
  py: SKIN_REGIONS.head.top,
  ny: SKIN_REGIONS.head.bottom,
  pz: SKIN_REGIONS.head.front,
  nz: SKIN_REGIONS.head.back,
};

const BODY_FACES: FaceRects = {
  px: SKIN_REGIONS.body.left,
  nx: SKIN_REGIONS.body.right,
  py: SKIN_REGIONS.body.top,
  ny: SKIN_REGIONS.body.bottom,
  pz: SKIN_REGIONS.body.front,
  nz: SKIN_REGIONS.body.back,
};

/** The character's right arm sits at -X, so its outer side is the -X face. */
function armFaces(part: 'armR' | 'armL'): FaceRects {
  const arm = SKIN_REGIONS[part];
  return {
    px: arm.left,
    nx: arm.right,
    py: arm.top,
    ny: arm.bottom,
    pz: arm.front,
    nz: arm.back,
  };
}

/** Same convention for the legs. */
function legFaces(part: 'legR' | 'legL'): FaceRects {
  const leg = SKIN_REGIONS[part];
  return {
    px: leg.left,
    nx: leg.right,
    py: leg.top,
    ny: leg.bottom,
    pz: leg.front,
    nz: leg.back,
  };
}

/**
 * A player avatar: six boxes sharing one generated skin texture.
 *
 * The children of `group` are named `head`, `body`, `armL`, `armR`, `legL`
 * and `legR` so the engine can animate them by name.
 */
export class AvatarModel {
  readonly group: Group;
  private readonly material: MeshLambertMaterial;
  private texture: CanvasTexture;
  readonly head: Mesh;
  readonly body: Mesh;
  readonly armL: Mesh;
  readonly armR: Mesh;
  readonly legL: Mesh;
  readonly legR: Mesh;
  private readonly geometries: BufferGeometry[] = [];

  constructor(spec: AvatarSpec) {
    this.group = new Group();
    this.group.name = 'avatar';

    this.texture = generateSkin(spec);
    this.material = new MeshLambertMaterial({ map: this.texture });

    this.head = this.makePart('head', buildBox(0.5, 0.5, 0.5, HEAD_FACES, 'center'), 0, 1.75, 0);
    this.body = this.makePart('body', buildBox(0.5, 0.75, 0.25, BODY_FACES, 'center'), 0, 1.125, 0);
    this.armR = this.makePart('armR', buildBox(0.25, 0.75, 0.25, armFaces('armR'), 'top'), -0.375, 1.5, 0);
    this.armL = this.makePart('armL', buildBox(0.25, 0.75, 0.25, armFaces('armL'), 'top'), 0.375, 1.5, 0);
    this.legR = this.makePart('legR', buildBox(0.25, 0.75, 0.25, legFaces('legR'), 'top'), -0.125, 0.75, 0);
    this.legL = this.makePart('legL', buildBox(0.25, 0.75, 0.25, legFaces('legL'), 'top'), 0.125, 0.75, 0);
  }

  /** The texture currently shown by the model. */
  get skinTexture(): CanvasTexture {
    return this.texture;
  }

  private makePart(name: string, geometry: BufferGeometry, x: number, y: number, z: number): Mesh {
    this.geometries.push(geometry);
    const mesh = new Mesh(geometry, this.material);
    mesh.name = name;
    mesh.position.set(x, y, z);
    this.group.add(mesh);
    return mesh;
  }

  /** Regenerate the skin in place (new kit, hair, number, ...). */
  setSpec(spec: AvatarSpec): void {
    const next = generateSkin(spec);
    const previous = this.texture;
    this.texture = next;
    this.material.map = next;
    this.material.needsUpdate = true;
    previous.dispose();
  }

  /**
   * Pose the limbs for a walk cycle.
   *
   * @param phase  walk cycle phase in radians
   * @param amount 0 = standing still, 1 = full stride
   */
  setLimbPose(phase: number, amount: number): void {
    const swing = Math.sin(phase) * amount;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing * 0.85;
    this.armR.rotation.x = swing * 0.85;
  }

  /** Release the GPU resources owned by this model. */
  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    this.geometries.length = 0;
    this.material.dispose();
    this.texture.dispose();
    this.group.clear();
  }
}

/** Convenience factory for {@link AvatarModel}. */
export function createAvatarModel(spec: AvatarSpec): AvatarModel {
  return new AvatarModel(spec);
}
