/**
 * Shared message contracts for the engine workers.
 */

import type { BlockProfile } from '../engine/voxel/profiles';
import type { RenderGroup } from '../core/types';

// ---------------------------------------------------------------------------
// Mesh worker
// ---------------------------------------------------------------------------

export interface MeshWorkerInit {
  type: 'init';
  profiles: BlockProfile[];
}

export interface MeshWorkerChunk {
  type: 'chunk';
  cx: number;
  cz: number;
  dimension: string;
  /** Flat block ids for the whole column: SECTION_COUNT * 4096 entries. */
  blocks: Uint16Array;
}

export interface MeshWorkerRequest {
  type: 'mesh';
  jobId: number;
  cx: number;
  cz: number;
  dimension: string;
  smoothLighting: boolean;
  ambientOcclusion: boolean;
}

export interface MeshWorkerUnload {
  type: 'unload';
  cx: number;
  cz: number;
}

export type MeshWorkerCommand = MeshWorkerInit | MeshWorkerChunk | MeshWorkerRequest | MeshWorkerUnload;

/** One rendered group (one draw call). */
export interface MeshGroup {
  /**
   * 'solid' covers opaque and cut-out blocks (they share one alpha-tested
   * material); 'translucent' covers water and ice.
   */
  group: RenderGroup | 'solid';
  positions: Float32Array;
  normals: Int8Array;
  uvs: Float32Array;
  /** blockLight, skyLight, ao, faceShade — all normalised bytes. */
  data: Uint8Array;
  /** Texture-array layer per vertex. */
  layers: Uint16Array;
  indices: Uint32Array;
}

export interface MeshWorkerResult {
  type: 'meshResult';
  jobId: number;
  cx: number;
  cz: number;
  dimension: string;
  groups: MeshGroup[];
  /** Wall-clock milliseconds spent building the mesh. */
  buildMs: number;
}

export interface MeshWorkerError {
  type: 'error';
  jobId: number;
  message: string;
}

export type MeshWorkerMessage = MeshWorkerResult | MeshWorkerError;

// ---------------------------------------------------------------------------
// Generation worker
// ---------------------------------------------------------------------------

export interface GenWorkerRequest {
  type: 'generate';
  jobId: number;
  seed: number;
  cx: number;
  cz: number;
  dimension: 'overworld' | 'nether' | 'end';
}

export interface GenWorkerResult {
  type: 'generated';
  jobId: number;
  cx: number;
  cz: number;
  dimension: string;
  /** Block names, index = (x * CHUNK_Z + z) * CHUNK_Y + (y - WORLD_MIN_Y). */
  blocks: string[];
  biomes: string[];
  heightMap: Int16Array;
  structures: { type: string; x: number; y: number; z: number }[];
  genMs: number;
}

export interface GenWorkerError {
  type: 'error';
  jobId: number;
  message: string;
}

export type GenWorkerMessage = GenWorkerResult | GenWorkerError;
