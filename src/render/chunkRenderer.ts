/**
 * Renders chunk meshes.
 *
 * Each chunk owns at most two meshes: a solid one (everything alpha tested)
 * and a translucent one (water and ice). Chunks outside the view frustum are
 * skipped, which is what keeps the draw-call count inside the budget.
 */

import * as THREE from 'three';
import type { MeshGroup } from '../workers/types';

export interface ChunkMeshEntry {
  key: string;
  cx: number;
  cz: number;
  solid: THREE.Mesh | null;
  translucent: THREE.Mesh | null;
  /** Bounding sphere used for frustum culling. */
  bounds: THREE.Sphere;
  triangleCount: number;
}

export class ChunkRenderer {
  readonly group = new THREE.Group();
  private readonly entries = new Map<string, ChunkMeshEntry>();
  /** Set once the first chunk has been reported to the console. */
  private static reported = false;
  /** Chunk diagnostics are printed when the page is opened with ?debug=1. */
  private static debug =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug');

  constructor(
    private readonly solidMaterial: THREE.Material,
    private readonly translucentMaterial: THREE.Material,
  ) {
    this.group.name = 'chunks';
    this.group.matrixAutoUpdate = false;
  }

  /** Replace the meshes for a chunk. */
  setChunk(cx: number, cz: number, groups: MeshGroup[], worldHeight: number): void {
    const key = `${cx},${cz}`;
    this.removeChunk(cx, cz);

    if (ChunkRenderer.debug && !ChunkRenderer.reported && groups.length > 0) {
      ChunkRenderer.reported = true;
      const first = groups[0];
      let minY = Infinity;
      let maxY = -Infinity;
      let minX = Infinity;
      let maxX = -Infinity;
      for (let i = 0; i < first.positions.length; i += 3) {
        minX = Math.min(minX, first.positions[i]);
        maxX = Math.max(maxX, first.positions[i]);
        minY = Math.min(minY, first.positions[i + 1]);
        maxY = Math.max(maxY, first.positions[i + 1]);
      }
      console.info(
        `[chunk ${cx},${cz}] groups=${groups.length} verts=${first.positions.length / 3} ` +
          `x[${minX.toFixed(1)}..${maxX.toFixed(1)}] y[${minY.toFixed(1)}..${maxY.toFixed(1)}] ` +
          `layers[${first.layers[0]}..${first.layers[first.layers.length - 1]}] ` +
          `data[${first.data[0]},${first.data[1]},${first.data[2]},${first.data[3]}]`,
      );

      let lit = 0;
      let dark = 0;
      const layerCounts = new Map<number, number>();
      for (let i = 1; i < first.data.length; i += 4) {
        if (first.data[i] > 0) lit++;
        else dark++;
      }
      for (let i = 0; i < first.layers.length; i++) {
        const layer = first.layers[i];
        layerCounts.set(layer, (layerCounts.get(layer) ?? 0) + 1);
      }
      const topLayers = [...layerCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
      console.info(
        `[chunk ${cx},${cz}] lit=${lit} dark=${dark} quads=${first.indices.length / 6} ` +
          `topLayers=${topLayers.map(([l, c]) => `${l}:${c}`).join(' ')}`,
      );
    }

    let solid: THREE.Mesh | null = null;
    let translucent: THREE.Mesh | null = null;
    let triangles = 0;

    for (const meshGroup of groups) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(meshGroup.positions, 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(meshGroup.normals, 3, true));
      geometry.setAttribute('uv', new THREE.BufferAttribute(meshGroup.uvs, 2));
      geometry.setAttribute('aData', new THREE.BufferAttribute(meshGroup.data, 4, true));
      geometry.setAttribute('aLayer', new THREE.BufferAttribute(meshGroup.layers, 1));
      geometry.setIndex(new THREE.BufferAttribute(meshGroup.indices, 1));
      geometry.computeBoundingSphere();
      geometry.computeBoundingBox();

      const mesh = new THREE.Mesh(
        geometry,
        meshGroup.group === 'translucent' ? this.translucentMaterial : this.solidMaterial,
      );
      mesh.matrixAutoUpdate = false;
      mesh.renderOrder = meshGroup.group === 'translucent' ? 10 : 0;
      mesh.frustumCulled = false; // we cull per chunk ourselves

      if (meshGroup.group === 'translucent') translucent = mesh;
      else solid = mesh;

      triangles += meshGroup.indices.length / 3;
    }

    if (solid) this.group.add(solid);
    if (translucent) this.group.add(translucent);

    const bounds = new THREE.Sphere(
      new THREE.Vector3(cx * 16 + 8, worldHeight / 2, cz * 16 + 8),
      Math.sqrt(8 * 8 + (worldHeight / 2) * (worldHeight / 2) + 8 * 8),
    );

    this.entries.set(key, { key, cx, cz, solid, translucent, bounds, triangleCount: triangles });
  }

  removeChunk(cx: number, cz: number): void {
    const key = `${cx},${cz}`;
    const entry = this.entries.get(key);
    if (!entry) return;
    if (entry.solid) {
      this.group.remove(entry.solid);
      entry.solid.geometry.dispose();
    }
    if (entry.translucent) {
      this.group.remove(entry.translucent);
      entry.translucent.geometry.dispose();
    }
    this.entries.delete(key);
  }

  has(cx: number, cz: number): boolean {
    return this.entries.has(`${cx},${cz}`);
  }

  clear(): void {
    for (const entry of this.entries.values()) {
      if (entry.solid) {
        this.group.remove(entry.solid);
        entry.solid.geometry.dispose();
      }
      if (entry.translucent) {
        this.group.remove(entry.translucent);
        entry.translucent.geometry.dispose();
      }
    }
    this.entries.clear();
  }

  /**
   * Hide chunks outside the view frustum.
   * Returns the number of chunks that stayed visible.
   */
  applyFrustumCulling(frustum: THREE.Frustum): number {
    let visible = 0;
    for (const entry of this.entries.values()) {
      const inView = frustum.intersectsSphere(entry.bounds);
      if (entry.solid) entry.solid.visible = inView;
      if (entry.translucent) entry.translucent.visible = inView;
      if (inView) visible++;
    }
    return visible;
  }

  get chunkCount(): number {
    return this.entries.size;
  }

  get triangleCount(): number {
    let total = 0;
    for (const entry of this.entries.values()) total += entry.triangleCount;
    return total;
  }

  get drawCalls(): number {
    let total = 0;
    for (const entry of this.entries.values()) {
      if (entry.solid?.visible) total++;
      if (entry.translucent?.visible) total++;
    }
    return total;
  }
}
