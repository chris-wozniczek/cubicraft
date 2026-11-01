/**
 * The mesher: flood lighting and greedy meshing.
 *
 * Kept separate from the worker wrapper so it can be unit tested without a
 * browser. The builder holds its own copy of the chunk data, so a mesh job
 * only has to name the chunk it wants and the neighbour data needed for face
 * culling and lighting is already at hand.
 */

import {
  CHUNK_X,
  CHUNK_Y,
  CHUNK_Z,
  SECTION_COUNT,
  SECTION_VOLUME,
  SECTION_Y,
  WORLD_MAX_Y,
  WORLD_MIN_Y,
} from '../core/types';
import type { BlockProfile } from '../engine/voxel/profiles';
import { EMPTY_PROFILE } from '../engine/voxel/profiles';
import type { MeshGroup } from './types';

const AREA = CHUNK_X * CHUNK_Z;
const TOTAL = AREA * CHUNK_Y;

/**
 * The flat index of a voxel inside a chunk column.
 *
 * Chunks are stored section-major: section, then x, then z, then y within
 * the section. Every read and write must use this helper, because the
 * generator's own column-major layout is a different arrangement.
 */
export function voxelIndex(lx: number, y: number, lz: number): number {
  const rel = y - WORLD_MIN_Y;
  const sy = (rel / SECTION_Y) | 0;
  const ly = rel - sy * SECTION_Y;
  return sy * SECTION_VOLUME + (lx * CHUNK_Z + lz) * SECTION_Y + ly;
}

/**
 * A face of a block.
 *
 * The two in-plane axes are the grid axes the face is walked along, chosen
 * so that `a1 × a2 = normal`. That guarantees the corner order
 * (0,0) → (1,0) → (1,1) → (0,1) is counter-clockwise seen from outside,
 * whatever direction the face points.
 */
interface FaceDef {
  normal: [number, number, number];
  /** First in-plane grid axis (0 = x, 1 = y, 2 = z). */
  a1: 0 | 1 | 2;
  /** Second in-plane grid axis. */
  a2: 0 | 1 | 2;
  /** Where the face sits along the normal: 0 = the block's min side, 1 = its max side. */
  normalOffset: 0 | 1;
  /** Texture slot. */
  slot: 'top' | 'side' | 'bottom' | 'front';
  /** Directional brightness. */
  shade: number;
}

const FACES: FaceDef[] = [
  { normal: [1, 0, 0], a1: 1, a2: 2, normalOffset: 1, slot: 'side', shade: 0.72 },
  { normal: [-1, 0, 0], a1: 2, a2: 1, normalOffset: 0, slot: 'side', shade: 0.72 },
  { normal: [0, 1, 0], a1: 2, a2: 0, normalOffset: 1, slot: 'top', shade: 1.0 },
  { normal: [0, -1, 0], a1: 0, a2: 2, normalOffset: 0, slot: 'bottom', shade: 0.55 },
  { normal: [0, 0, 1], a1: 0, a2: 1, normalOffset: 1, slot: 'front', shade: 0.86 },
  { normal: [0, 0, -1], a1: 1, a2: 0, normalOffset: 0, slot: 'side', shade: 0.86 },
];

/** Unit vector along a grid axis. */
const AXIS_VECTORS: [number, number, number][] = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

/** The corner offsets of a face in (a1, a2) grid space. */
const CORNER_OFFSETS: [number, number][] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

const SOLID_GROUP = 'solid';
const TRANSLUCENT_GROUP = 'translucent';

/**
 * The largest quad the greedy mesher will build, in blocks.
 *
 * Without a limit a single wall of the same block merges into one quad
 * hundreds of blocks tall, and the texture smears across it. Sixteen keeps
 * the merging effective while the texture stays readable.
 */
const MAX_MERGE = 16;

interface CachedChunk {
  cx: number;
  cz: number;
  blocks: Uint16Array;
  light: Uint8Array;
  /** The occupied vertical range, so empty slices are skipped entirely. */
  minY: number;
  maxY: number;
}

interface CellInfo {
  id: number;
  light: number;
  ao: [number, number, number, number];
  visible: boolean;
}

class GroupBuilder {
  positions: number[] = [];
  normals: number[] = [];
  uvs: number[] = [];
  data: number[] = [];
  layers: number[] = [];
  indices: number[] = [];

  get vertexCount(): number {
    return this.positions.length / 3;
  }

  pushQuad(p: number[], n: [number, number, number], uv: number[], d: number[], layer: number): void {
    const base = this.vertexCount;
    for (let i = 0; i < 4; i++) {
      this.positions.push(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
      this.normals.push(n[0], n[1], n[2]);
      this.uvs.push(uv[i * 2], uv[i * 2 + 1]);
      this.data.push(d[i * 4], d[i * 4 + 1], d[i * 4 + 2], d[i * 4 + 3]);
      this.layers.push(layer);
    }
    // Flip the triangulation when the AO gradient would otherwise look lumpy.
    if (d[2] + d[10] > d[6] + d[14]) {
      this.indices.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
    } else {
      this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  toGroup(group: string): MeshGroup | null {
    if (this.indices.length === 0) return null;
    return {
      group: group as MeshGroup['group'],
      positions: new Float32Array(this.positions),
      normals: new Int8Array(this.normals),
      uvs: new Float32Array(this.uvs),
      data: new Uint8Array(this.data),
      layers: new Uint16Array(this.layers),
      indices: new Uint32Array(this.indices),
    };
  }
}

/** Ambient occlusion for one face corner. */
function cornerAO(side1: boolean, side2: boolean, corner: boolean): number {
  if (side1 && side2) return 0;
  return 3 - (side1 ? 1 : 0) - (side2 ? 1 : 0) - (corner ? 1 : 0);
}

export class MeshBuilder {
  private profiles: BlockProfile[] = [EMPTY_PROFILE];
  private readonly chunkCache = new Map<string, CachedChunk>();
  private lastChunkKey = '';
  private lastChunk: CachedChunk | undefined;

  constructor(profiles: readonly BlockProfile[] = []) {
    this.setProfiles(profiles);
  }

  setProfiles(profiles: readonly BlockProfile[]): void {
    this.profiles = profiles.length ? [...profiles] : [EMPTY_PROFILE];
    this.chunkCache.clear();
    this.lastChunkKey = '';
    this.lastChunk = undefined;
  }

  /** Store a chunk's block data. */
  setChunk(cx: number, cz: number, blocks: Uint16Array): void {
    const existing = this.chunkAt(cx, cz);
    const chunk: CachedChunk = {
      cx,
      cz,
      blocks,
      light: existing?.light ?? new Uint8Array(TOTAL),
      minY: WORLD_MAX_Y,
      maxY: WORLD_MIN_Y - 1,
    };
    this.chunkCache.set(key(cx, cz), chunk);
    this.lastChunkKey = '';
    this.lastChunk = undefined;

    for (let si = 0; si < SECTION_COUNT; si++) {
      const base = si * SECTION_VOLUME;
      let any = false;
      for (let i = 0; i < SECTION_VOLUME; i++) {
        if (blocks[base + i] !== 0) {
          any = true;
          break;
        }
      }
      if (!any) continue;
      chunk.minY = Math.min(chunk.minY, WORLD_MIN_Y + si * SECTION_Y);
      chunk.maxY = Math.max(chunk.maxY, WORLD_MIN_Y + si * SECTION_Y + SECTION_Y - 1);
    }
  }

  removeChunk(cx: number, cz: number): void {
    this.chunkCache.delete(key(cx, cz));
    this.lastChunkKey = '';
    this.lastChunk = undefined;
  }

  hasChunk(cx: number, cz: number): boolean {
    return this.chunkCache.has(key(cx, cz));
  }

  private chunkAt(cx: number, cz: number): CachedChunk | undefined {
    const k = key(cx, cz);
    if (k === this.lastChunkKey) return this.lastChunk;
    this.lastChunkKey = k;
    this.lastChunk = this.chunkCache.get(k);
    return this.lastChunk;
  }

  private profile(id: number): BlockProfile {
    return this.profiles[id] ?? EMPTY_PROFILE;
  }

  /** Read a block in global coordinates. -1 when the chunk is unknown. */
  private readGlobal(x: number, y: number, z: number): number {
    if (y < WORLD_MIN_Y || y >= WORLD_MAX_Y) return 0;
    const cx = x >> 4;
    const cz = z >> 4;
    const chunk = this.chunkAt(cx, cz);
    if (!chunk) return -1;
    const lx = x - (cx << 4);
    const lz = z - (cz << 4);
    return chunk.blocks[voxelIndex(lx, y, lz)];
  }

  private isOpaqueAt(x: number, y: number, z: number): boolean {
    const id = this.readGlobal(x, y, z);
    if (id === -1) return true;
    return this.profile(id).opaque;
  }

  private isTransparentAt(x: number, y: number, z: number): boolean {
    const id = this.readGlobal(x, y, z);
    if (id === -1) return false;
    return this.profile(id).transparent;
  }

  /**
   * The light at a world position, read from whichever chunk holds it.
   *
   * A face on a chunk border is lit by the air in the *neighbouring* chunk,
   * so the light has to be read across the border too — otherwise every
   * border face comes out black.
   */
  private lightAt(x: number, y: number, z: number): number {
    if (y < WORLD_MIN_Y || y >= WORLD_MAX_Y) return 0;
    const chunk = this.chunkAt(x >> 4, z >> 4);
    if (!chunk) return 0;
    const lx = x - ((x >> 4) << 4);
    const lz = z - ((z >> 4) << 4);
    return chunk.light[voxelIndex(lx, y, lz)];
  }

  /** Build the meshes for a chunk. */
  build(cx: number, cz: number, smoothLighting: boolean, ambientOcclusion: boolean): MeshGroup[] {
    const chunk = this.chunkAt(cx, cz);
    if (!chunk) return [];
    this.computeLight(chunk);
    return this.buildMesh(chunk, smoothLighting, ambientOcclusion);
  }

  // -------------------------------------------------------------------------
  // Lighting
  // -------------------------------------------------------------------------

  /** The highest opaque Y in a column, or WORLD_MIN_Y - 1 when it is open. */
  private skyColumnTop(blocks: Uint16Array, lx: number, lz: number): number {
    for (let y = WORLD_MAX_Y - 1; y >= WORLD_MIN_Y; y--) {
      const id = blocks[voxelIndex(lx, y, lz)];
      if (id !== 0 && this.profile(id).opaque) return y;
    }
    return WORLD_MIN_Y - 1;
  }

  /**
   * Compute sky and block light for one chunk column.
   *
   * Sky light is seeded from the sunlit columns of this chunk and of the four
   * neighbouring chunks, then propagated with a breadth-first flood that keeps
   * full strength downwards and loses one level per horizontal step.
   */
  private computeLight(self: CachedChunk): void {
    const light = self.light;
    light.fill(0);

    const queueSky: number[] = [];
    const queueBlock: number[] = [];

    const setSky = (x: number, y: number, z: number, value: number): void => {
      if (y < WORLD_MIN_Y || y >= WORLD_MAX_Y) return;
      const lx = x - (self.cx << 4);
      const lz = z - (self.cz << 4);
      if (lx < 0 || lx >= CHUNK_X || lz < 0 || lz >= CHUNK_Z) return;
      const idx = voxelIndex(lx, y, lz);
      const current = (light[idx] >> 4) & 0x0f;
      if (value > current) {
        light[idx] = (light[idx] & 0x0f) | (value << 4);
        queueSky.push(x, y, z);
      }
    };

    const setBlockLight = (x: number, y: number, z: number, value: number): void => {
      if (y < WORLD_MIN_Y || y >= WORLD_MAX_Y) return;
      const lx = x - (self.cx << 4);
      const lz = z - (self.cz << 4);
      if (lx < 0 || lx >= CHUNK_X || lz < 0 || lz >= CHUNK_Z) return;
      const idx = voxelIndex(lx, y, lz);
      const current = light[idx] & 0x0f;
      if (value > current) {
        light[idx] = (light[idx] & 0xf0) | value;
        queueBlock.push(x, y, z);
      }
    };

    // Seed sky light from this chunk's own sunlit columns.
    for (let lx = 0; lx < CHUNK_X; lx++) {
      for (let lz = 0; lz < CHUNK_Z; lz++) {
        const top = this.skyColumnTop(self.blocks, lx, lz);
        const x = (self.cx << 4) + lx;
        const z = (self.cz << 4) + lz;
        for (let y = top + 1; y < WORLD_MAX_Y; y++) setSky(x, y, z, 15);
      }
    }

    // Seed from the neighbours' edge columns so light bleeds across borders.
    const neighbourEdges: { x: number; z: number }[] = [];
    for (let i = 0; i < CHUNK_X; i++) {
      neighbourEdges.push({ x: (self.cx - 1) * CHUNK_X + CHUNK_X - 1, z: (self.cz << 4) + i });
      neighbourEdges.push({ x: (self.cx + 1) * CHUNK_X, z: (self.cz << 4) + i });
      neighbourEdges.push({ x: (self.cx << 4) + i, z: (self.cz - 1) * CHUNK_Z + CHUNK_Z - 1 });
      neighbourEdges.push({ x: (self.cx << 4) + i, z: (self.cz + 1) * CHUNK_Z });
    }
    for (const edge of neighbourEdges) {
      const neighbour = this.chunkAt(edge.x >> 4, edge.z >> 4);
      if (!neighbour) continue;
      const lx = edge.x - (edge.x >> 4) * CHUNK_X;
      const lz = edge.z - (edge.z >> 4) * CHUNK_Z;
      const top = this.skyColumnTop(neighbour.blocks, lx, lz);
      for (let y = top + 1; y < WORLD_MAX_Y; y++) {
        if (this.isTransparentAt(edge.x, y, edge.z)) setSky(edge.x, y, edge.z, 15);
      }
    }

    // Flood sky light.
    let head = 0;
    while (head < queueSky.length) {
      const x = queueSky[head++];
      const y = queueSky[head++];
      const z = queueSky[head++];
      const lx = x - (self.cx << 4);
      const lz = z - (self.cz << 4);
      if (lx < 0 || lx >= CHUNK_X || lz < 0 || lz >= CHUNK_Z) continue;
      const level = (light[voxelIndex(lx, y, lz)] >> 4) & 0x0f;
      if (level <= 0) continue;

      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx;
        const nz = z + dz;
        if (!this.isTransparentAt(nx, y, nz)) continue;
        setSky(nx, y, nz, level - 1);
      }
      if (this.isTransparentAt(x, y - 1, z)) setSky(x, y - 1, z, level);
      if (this.isTransparentAt(x, y + 1, z)) setSky(x, y + 1, z, level);
    }

    // Seed and flood block light from emitters.
    for (let lx = 0; lx < CHUNK_X; lx++) {
      for (let lz = 0; lz < CHUNK_Z; lz++) {
        const x = (self.cx << 4) + lx;
        const z = (self.cz << 4) + lz;
        for (let y = WORLD_MIN_Y; y < WORLD_MAX_Y; y++) {
          const id = self.blocks[voxelIndex(lx, y, lz)];
          if (id === 0) continue;
          const emission = this.profile(id).emission;
          if (emission > 0) setBlockLight(x, y, z, emission);
        }
      }
    }

    head = 0;
    while (head < queueBlock.length) {
      const x = queueBlock[head++];
      const y = queueBlock[head++];
      const z = queueBlock[head++];
      const lx = x - (self.cx << 4);
      const lz = z - (self.cz << 4);
      if (lx < 0 || lx >= CHUNK_X || lz < 0 || lz >= CHUNK_Z) continue;
      const level = light[voxelIndex(lx, y, lz)] & 0x0f;
      if (level <= 1) continue;
      for (const [dx, dy, dz] of FACES.map((f) => f.normal) as [number, number, number][]) {
        const nx = x + dx;
        const ny = y + dy;
        const nz = z + dz;
        if (!this.isTransparentAt(nx, ny, nz)) continue;
        setBlockLight(nx, ny, nz, level - 1);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Meshing
  // -------------------------------------------------------------------------

  /** The four AO values of a face, in the face's own corner order. */
  private faceAO(x: number, y: number, z: number, face: FaceDef): [number, number, number, number] {
    const n = AXIS_VECTORS[face.normal[0] !== 0 ? 0 : face.normal[1] !== 0 ? 1 : 2];
    const a1 = AXIS_VECTORS[face.a1];
    const a2 = AXIS_VECTORS[face.a2];
    const signs: [number, number][] = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];

    const out: [number, number, number, number] = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
      const [s1, s2] = signs[i];
      const side1 = this.isOpaqueAt(x + n[0] + a1[0] * s1, y + n[1] + a1[1] * s1, z + n[2] + a1[2] * s1);
      const side2 = this.isOpaqueAt(x + n[0] + a2[0] * s2, y + n[1] + a2[1] * s2, z + n[2] + a2[2] * s2);
      const corner = this.isOpaqueAt(
        x + n[0] + a1[0] * s1 + a2[0] * s2,
        y + n[1] + a1[1] * s1 + a2[1] * s2,
        z + n[2] + a1[2] * s1 + a2[2] * s2,
      );
      out[i] = cornerAO(side1, side2, corner);
    }
    return out;
  }

  /**
   * Resolve the world coordinates of a cell from the face's grid axes.
   *
   * The face is walked along the two in-plane grid axes, always in the
   * positive direction, so a cell never leaves its own chunk.
   */
  private makeCoordMapper(face: FaceDef, sliceAxis: number, sliceValue: number, baseX: number, baseZ: number) {
    const worldStart = (axis: number): number =>
      axis === 1 ? WORLD_MIN_Y : axis === 0 ? baseX : baseZ;
    const worldSize = (axis: number): number =>
      axis === 1 ? CHUNK_Y : axis === 0 ? CHUNK_X : CHUNK_Z;

    const start1 = worldStart(face.a1);
    const size1 = worldSize(face.a1);
    const start2 = worldStart(face.a2);
    const size2 = worldSize(face.a2);

    const coordOf = (u: number, v: number): [number, number, number] => {
      const coords = [0, 0, 0];
      coords[sliceAxis] = sliceValue;
      coords[face.a1] = start1 + u;
      coords[face.a2] = start2 + v;
      return coords as [number, number, number];
    };

    return { coordOf, size1, size2 };
  }

  /**
   * The world-space corner of a face's vertex, relative to the block origin.
   *
   * `w`/`h` are the merged quad's extents along the a1/a2 grid axes — the
   * unit corner offsets scale by them so a merged quad actually covers the
   * cells it consumed.
   */
  private faceCorner(face: FaceDef, index: number, w: number, h: number): [number, number, number] {
    const [o1, o2] = CORNER_OFFSETS[index];
    const a1 = AXIS_VECTORS[face.a1];
    const a2 = AXIS_VECTORS[face.a2];
    const n = AXIS_VECTORS[face.normal[0] !== 0 ? 0 : face.normal[1] !== 0 ? 1 : 2];
    return [
      n[0] * face.normalOffset + a1[0] * o1 * w + a2[0] * o2 * h,
      n[1] * face.normalOffset + a1[1] * o1 * w + a2[1] * o2 * h,
      n[2] * face.normalOffset + a1[2] * o1 * w + a2[2] * o2 * h,
    ];
  }

  private shouldDrawFace(id: number, neighbourId: number): boolean {
    if (neighbourId === -1) return true;
    if (id === neighbourId) return false;
    return !this.profile(neighbourId).opaque;
  }

  /** Greedy meshing of one slice of a chunk. */
  private meshSlice(
    self: CachedChunk,
    face: FaceDef,
    sliceAxis: number,
    sliceValue: number,
    builders: Map<string, GroupBuilder>,
    smoothLighting: boolean,
    ambientOcclusion: boolean,
  ): void {
    const baseX = self.cx * CHUNK_X;
    const baseZ = self.cz * CHUNK_Z;
    const { coordOf, size1, size2 } = this.makeCoordMapper(face, sliceAxis, sliceValue, baseX, baseZ);

    const cells: CellInfo[][] = [];
    for (let v = 0; v < size2; v++) {
      const row: CellInfo[] = [];
      for (let u = 0; u < size1; u++) {
        const [wx, wy, wz] = coordOf(u, v);
        const id = this.readGlobal(wx, wy, wz);
        if (id === 0 || id === -1) {
          row.push({ id: 0, light: 0, ao: [0, 0, 0, 0], visible: false });
          continue;
        }
        const profile = this.profile(id);
        if (profile.render === 'none') {
          row.push({ id: 0, light: 0, ao: [0, 0, 0, 0], visible: false });
          continue;
        }
        const neighbour = this.readGlobal(wx + face.normal[0], wy + face.normal[1], wz + face.normal[2]);
        const visible = this.shouldDrawFace(id, neighbour);
        // Ambient occlusion is only worth computing for a face that is drawn.
        const ao: [number, number, number, number] =
          visible && ambientOcclusion ? this.faceAO(wx, wy, wz, face) : [3, 3, 3, 3];

        // A face is lit by the air beside it, not by the block itself.
        const airX = wx + face.normal[0];
        const airY = wy + face.normal[1];
        const airZ = wz + face.normal[2];
        const lightByte = this.lightAt(airX, airY, airZ);

        row.push({ id, light: lightByte, ao, visible });
      }
      cells.push(row);
    }

    for (let v = 0; v < size2; v++) {
      for (let u = 0; u < size1; u++) {
        const cell = cells[v][u];
        if (!cell.visible || cell.id === 0) continue;

        const profile = this.profile(cell.id);
        const groupKey = profile.render === 'translucent' ? TRANSLUCENT_GROUP : SOLID_GROUP;
        let builder = builders.get(groupKey);
        if (!builder) {
          builder = new GroupBuilder();
          builders.set(groupKey, builder);
        }

        if (profile.render === 'cross') {
          const [wx, wy, wz] = coordOf(u, v);
          this.emitCross(builder, wx, wy, wz, cell);
          cells[v][u].visible = false;
          continue;
        }

        // Extend along u.
        let w = 1;
        while (u + w < size1 && w < MAX_MERGE) {
          const next = cells[v][u + w];
          if (!next.visible || next.id !== cell.id || next.light !== cell.light) break;
          const prev = cells[v][u + w - 1];
          // The ambient occlusion on the shared edge must match exactly, or
          // the merged quad would have a gradient it cannot represent.
          if (next.ao[0] !== prev.ao[1] || next.ao[3] !== prev.ao[2]) break;
          w++;
        }

        // Extend along v.
        let h = 1;
        outer: while (v + h < size2 && h < MAX_MERGE) {
          for (let i = 0; i < w; i++) {
            const above = cells[v + h][u + i];
            const current = cells[v + h - 1][u + i];
            if (!above.visible || above.id !== cell.id || above.light !== cell.light) break outer;
            if (above.ao[0] !== current.ao[3] || above.ao[1] !== current.ao[2]) break outer;
          }
          h++;
        }

        for (let dv = 0; dv < h; dv++) {
          for (let du = 0; du < w; du++) cells[v + dv][u + du].visible = false;
        }

        const [wx, wy, wz] = coordOf(u, v);
        const layer =
          face.slot === 'top'
            ? profile.layer.top
            : face.slot === 'bottom'
              ? profile.layer.bottom
              : face.slot === 'front'
                ? profile.layer.front
                : profile.layer.side;

        const corners = [
          this.faceCorner(face, 0, w, h),
          this.faceCorner(face, 1, w, h),
          this.faceCorner(face, 2, w, h),
          this.faceCorner(face, 3, w, h),
        ];
        const positions: number[] = [];
        const uvs: number[] = [];
        const data: number[] = [];

        const ao0 = cells[v][u].ao[0];
        const ao1 = cells[v][u + w - 1].ao[1];
        const ao2 = cells[v + h - 1][u + w - 1].ao[2];
        const ao3 = cells[v + h - 1][u].ao[3];

        const blockLight = cell.light & 0x0f;
        const skyLight = (cell.light >> 4) & 0x0f;

        for (let i = 0; i < 4; i++) {
          positions.push(wx + corners[i][0], wy + corners[i][1], wz + corners[i][2]);
        }
        uvs.push(0, 0, w, 0, w, h, 0, h);

        const aoList = [ao0, ao1, ao2, ao3];
        for (let i = 0; i < 4; i++) {
          const ao = smoothLighting ? aoList[i] : 3;
          data.push(
            blockLight * 17,
            skyLight * 17,
            Math.round((ao / 3) * 255),
            Math.round(face.shade * 255),
          );
        }

        builder.pushQuad(positions, face.normal, uvs, data, layer);
      }
    }
  }

  /** Emit the two crossed quads of a plant block. */
  private emitCross(builder: GroupBuilder, x: number, y: number, z: number, cell: CellInfo): void {
    const profile = this.profile(cell.id);
    const layer = profile.layer.side;
    const blockLight = cell.light & 0x0f;
    const skyLight = (cell.light >> 4) & 0x0f;
    const shade = Math.round(0.95 * 255);
    const data = [
      blockLight * 17, skyLight * 17, 255, shade,
      blockLight * 17, skyLight * 17, 255, shade,
      blockLight * 17, skyLight * 17, 255, shade,
      blockLight * 17, skyLight * 17, 255, shade,
    ];
    const uv = [0, 0, 1, 0, 1, 1, 0, 1];

    const p1 = [x, y, z, x + 1, y, z + 1, x + 1, y + 1, z + 1, x, y + 1, z];
    const p2 = [x + 1, y, z, x, y, z + 1, x, y + 1, z + 1, x + 1, y + 1, z];
    const n: [number, number, number] = [0, 1, 0];

    builder.pushQuad(p1, n, uv, data, layer);
    builder.pushQuad(p2, n, uv, data, layer);
    // Back faces, so the material can stay single sided.
    builder.pushQuad(p2, [0, -1, 0], uv, data, layer);
    builder.pushQuad(p1, [0, -1, 0], uv, data, layer);
  }

  private buildMesh(self: CachedChunk, smoothLighting: boolean, ambientOcclusion: boolean): MeshGroup[] {
    const builders = new Map<string, GroupBuilder>();
    const baseX = self.cx * CHUNK_X;
    const baseZ = self.cz * CHUNK_Z;

    for (let y = self.minY; y <= self.maxY; y++) {
      this.meshSlice(self, FACES[2], 1, y, builders, smoothLighting, ambientOcclusion);
      this.meshSlice(self, FACES[3], 1, y, builders, smoothLighting, ambientOcclusion);
    }
    for (let x = 0; x < CHUNK_X; x++) {
      this.meshSlice(self, FACES[0], 0, baseX + x, builders, smoothLighting, ambientOcclusion);
      this.meshSlice(self, FACES[1], 0, baseX + x, builders, smoothLighting, ambientOcclusion);
    }
    for (let z = 0; z < CHUNK_Z; z++) {
      this.meshSlice(self, FACES[4], 2, baseZ + z, builders, smoothLighting, ambientOcclusion);
      this.meshSlice(self, FACES[5], 2, baseZ + z, builders, smoothLighting, ambientOcclusion);
    }

    const out: MeshGroup[] = [];
    for (const [groupKey, builder] of builders) {
      const group = builder.toGroup(groupKey);
      if (group) out.push(group);
    }
    return out;
  }
}

function key(cx: number, cz: number): string {
  return `${cx},${cz}`;
}
