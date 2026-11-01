/**
 * Chunk streaming.
 *
 * Chunks are requested in order of distance from the player, generated in a
 * worker, then meshed in a second worker. The main thread never blocks on
 * either: it only ever handles the results.
 */

import { Chunk } from '../voxel/chunk';
import type { BlockLookup } from '../voxel/blocks';
import { ChunkRenderer } from '../../render/chunkRenderer';
import { CHUNK_X, CHUNK_Y, CHUNK_Z, WORLD_MIN_Y, SECTION_COUNT, SECTION_VOLUME, SECTION_Y } from '../../core/types';
import type { GenWorkerMessage, GenWorkerRequest, MeshWorkerCommand, MeshWorkerMessage } from '../../workers/types';
import type { BlockProfile } from '../voxel/profiles';
import { log } from '../../core/log';

interface PendingJob {
  cx: number;
  cz: number;
  dimension: string;
}

/**
 * Convert a generated chunk into the engine's block layout.
 *
 * The generator lays a chunk out column-major:
 *   (x * CHUNK_Z + z) * CHUNK_Y + (y - WORLD_MIN_Y)
 * The engine stores it section-major:
 *   section * 4096 + (x * 16 + z) * 16 + (y within the section)
 * The two layouts must be reconciled here or the world comes out scrambled.
 */
export function convertGeneratedChunk(
  names: readonly string[],
  lookup: { id: (name: string) => number },
): Uint16Array {
  const blocks = new Uint16Array(SECTION_COUNT * SECTION_VOLUME);
  for (let lx = 0; lx < CHUNK_X; lx++) {
    for (let lz = 0; lz < CHUNK_Z; lz++) {
      const columnBase = (lx * CHUNK_Z + lz) * CHUNK_Y;
      const columnOut = (lx * CHUNK_X + lz) * SECTION_Y;
      for (let y = WORLD_MIN_Y; y < WORLD_MIN_Y + CHUNK_Y; y++) {
        const rel = y - WORLD_MIN_Y;
        const sy = (rel / SECTION_Y) | 0;
        const ly = rel - sy * SECTION_Y;
        blocks[sy * SECTION_VOLUME + columnOut + ly] = lookup.id(names[columnBase + rel]);
      }
    }
  }
  return blocks;
}

export interface ChunkManagerOptions {
  seed: number;
  lookup: BlockLookup;
  renderDistance: number;
  dimension: string;
  onChunkReady?: (chunk: Chunk) => void;
}

export class ChunkManager {
  private readonly genWorker: Worker;
  private readonly meshWorker: Worker;
  private readonly lookup: BlockLookup;
  private renderDistance: number;

  /** Chunks that have been generated and are resident. */
  readonly chunks = new Map<string, Chunk>();

  private readonly queue: PendingJob[] = [];
  private readonly queued = new Set<string>();
  private readonly generating = new Set<string>();
  private readonly meshing = new Set<string>();
  /**
   * Chunks whose neighbours arrived after they were meshed.
   *
   * A chunk is meshed against whatever neighbours exist at the time, so a
   * chunk on the edge of the loaded area grows faces that its neighbour
   * will later cover. Those chunks are re-meshed once the neighbour lands.
   */
  private readonly needsRemesh = new Set<string>();
  private readonly pendingMesh = new Map<number, PendingJob>();
  private jobId = 1;
  private dimension: string;
  private seed: number;
  private readonly onChunkReady?: (chunk: Chunk) => void;

  /** Stats for the debug overlay. */
  stats = { generated: 0, meshed: 0, remeshed: 0, pending: 0, lastGenMs: 0, lastMeshMs: 0 };

  constructor(options: ChunkManagerOptions, renderer: ChunkRenderer) {
    this.lookup = options.lookup;
    this.renderDistance = options.renderDistance;
    this.dimension = options.dimension;
    this.seed = options.seed;
    this.renderer = renderer;
    this.onChunkReady = options.onChunkReady;

    this.genWorker = new Worker(new URL('../../workers/genWorker.ts', import.meta.url), { type: 'module' });
    this.meshWorker = new Worker(new URL('../../workers/meshWorker.ts', import.meta.url), { type: 'module' });

    this.genWorker.onmessage = (event: MessageEvent<GenWorkerMessage>) => this.onGenerated(event.data);
    this.meshWorker.onmessage = (event: MessageEvent<MeshWorkerMessage>) => this.onMeshed(event.data);
  }

  private renderer: ChunkRenderer;

  /** Send the block profile table to the mesh worker. */
  initMeshWorker(profiles: BlockProfile[]): void {
    const command: MeshWorkerCommand = { type: 'init', profiles };
    this.meshWorker.postMessage(command);
  }

  setSeed(seed: number): void {
    this.seed = seed;
  }

  setDimension(dimension: string): void {
    if (dimension === this.dimension) return;
    this.dimension = dimension;
    this.clear();
  }

  /** Drop every loaded chunk and queued job without touching the workers. */
  clear(): void {
    this.queue.length = 0;
    this.queued.clear();
    this.generating.clear();
    this.meshing.clear();
    this.needsRemesh.clear();
    this.pendingMesh.clear();
    for (const chunk of this.chunks.values()) {
      this.renderer.removeChunk(chunk.cx, chunk.cz);
    }
    this.chunks.clear();
  }

  setRenderDistance(distance: number): void {
    this.renderDistance = distance;
  }

  /** Queue the chunks around a position and drop the ones that fell out of range. */
  update(playerX: number, playerZ: number, smoothLighting: boolean, ambientOcclusion: boolean): void {
    const pcx = Math.floor(playerX / CHUNK_X);
    const pcz = Math.floor(playerZ / CHUNK_Z);
    const radius = this.renderDistance;

    this.queue.length = 0;
    this.queued.clear();

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const dist = Math.hypot(dx, dz);
        if (dist > radius + 0.5) continue;
        const cx = pcx + dx;
        const cz = pcz + dz;
        const key = `${cx},${cz}`;
        if (this.chunks.has(key)) continue;
        this.queue.push({ cx, cz, dimension: this.dimension });
        this.queued.add(key);
      }
    }
    this.queue.sort((a, b) => {
      const da = (a.cx - pcx) ** 2 + (a.cz - pcz) ** 2;
      const db = (b.cx - pcx) ** 2 + (b.cz - pcz) ** 2;
      return da - db;
    });

    // Unload chunks that are now out of range.
    const keep = radius + 2;
    for (const [key, chunk] of this.chunks) {
      if (Math.abs(chunk.cx - pcx) > keep || Math.abs(chunk.cz - pcz) > keep) {
        this.chunks.delete(key);
        this.renderer.removeChunk(chunk.cx, chunk.cz);
        this.meshWorker.postMessage({
          type: 'unload',
          cx: chunk.cx,
          cz: chunk.cz,
        } satisfies MeshWorkerCommand);
      }
    }

    // Keep a couple of generation jobs in flight.
    while (this.generating.size < 2 && this.queue.length > 0) {
      const job = this.queue.shift()!;
      const key = `${job.cx},${job.cz}`;
      if (this.generating.has(key)) continue;
      this.generating.add(key);
      const request: GenWorkerRequest = {
        type: 'generate',
        jobId: this.jobId++,
        seed: this.seed,
        cx: job.cx,
        cz: job.cz,
        dimension: job.dimension as GenWorkerRequest['dimension'],
      };
      this.genWorker.postMessage(request);
    }

    // Mesh chunks that have data but no geometry yet, plus any chunk whose
    // neighbours have arrived since it was last meshed.
    for (const chunk of this.chunks.values()) {
      const key = `${chunk.cx},${chunk.cz}`;
      if (this.meshing.has(key)) continue;
      const hasGeometry = this.renderer.has(chunk.cx, chunk.cz);
      if (hasGeometry && !this.needsRemesh.has(key)) continue;
      if (hasGeometry) this.stats.remeshed++;
      this.needsRemesh.delete(key);
      this.meshing.add(key);
      this.needsRemesh.delete(key);
      const id = this.jobId++;
      this.pendingMesh.set(id, { cx: chunk.cx, cz: chunk.cz, dimension: this.dimension });
      this.meshWorker.postMessage({
        type: 'mesh',
        jobId: id,
        cx: chunk.cx,
        cz: chunk.cz,
        dimension: this.dimension,
        smoothLighting,
        ambientOcclusion,
      } satisfies MeshWorkerCommand);
    }

    this.stats.pending = this.queue.length;
  }

  private onGenerated(message: GenWorkerMessage): void {
    if (message.type === 'error') {
      log.warn('[chunks] generation failed', message.message);
      return;
    }
    const key = `${message.cx},${message.cz}`;
    this.generating.delete(key);
    // A job that finished after a dimension switch is stale — drop it.
    if (message.dimension !== this.dimension) return;
    this.stats.generated++;
    this.stats.lastGenMs = message.genMs;

    const chunk = new Chunk(message.cx, message.cz);
    const blocks = convertGeneratedChunk(message.blocks, this.lookup);

    chunk.fromBlockArray(blocks, message.heightMap);
    chunk.biomes = message.biomes;
    chunk.state = 'generated';
    this.chunks.set(key, chunk);

    // The neighbours were meshed without this chunk, so their border faces
    // are now wrong and they must be rebuilt.
    for (const [dx, dz] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const) {
      this.needsRemesh.add(`${message.cx + dx},${message.cz + dz}`);
    }

    this.meshWorker.postMessage(
      {
        type: 'chunk',
        cx: message.cx,
        cz: message.cz,
        dimension: message.dimension,
        blocks,
      } satisfies MeshWorkerCommand,
      [blocks.buffer],
    );
  }

  private onMeshed(message: MeshWorkerMessage): void {
    if (message.type === 'error') {
      log.warn('[chunks] mesh failed', message.message);
      return;
    }
    this.meshing.delete(`${message.cx},${message.cz}`);
    if (message.dimension !== this.dimension) return;
    this.stats.meshed++;
    this.stats.lastMeshMs = message.buildMs;
    this.renderer.setChunk(message.cx, message.cz, message.groups, CHUNK_Y);
    const chunk = this.chunks.get(`${message.cx},${message.cz}`);
    if (chunk) {
      chunk.state = 'active';
      this.onChunkReady?.(chunk);
    }

    // This chunk's light is now available, so its neighbours have to be
    // rebuilt — their border faces are lit by the air on this side.
    for (const [dx, dz] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const) {
      this.needsRemesh.add(`${message.cx + dx},${message.cz + dz}`);
    }
  }

  /** Apply a block change locally and schedule a re-mesh of the affected chunk. */
  setBlock(x: number, y: number, z: number, blockId: number): boolean {
    const cx = x >> 4;
    const cz = z >> 4;
    const chunk = this.chunks.get(`${cx},${cz}`);
    if (!chunk) return false;
    const changed = chunk.setBlock(x - (cx << 4), y, z - (cz << 4), blockId);
    if (!changed) return false;

    const blocks = chunk.toBlockArray();
    this.meshWorker.postMessage(
      {
        type: 'chunk',
        cx,
        cz,
        dimension: this.dimension,
        blocks,
      } satisfies MeshWorkerCommand,
      [blocks.buffer],
    );

    // A neighbouring chunk may need re-meshing because the face changed.
    const lx = x - (cx << 4);
    const lz = z - (cz << 4);
    const neighbours: [number, number][] = [];
    if (lx === 0) neighbours.push([cx - 1, cz]);
    if (lx === CHUNK_X - 1) neighbours.push([cx + 1, cz]);
    if (lz === 0) neighbours.push([cx, cz - 1]);
    if (lz === CHUNK_Z - 1) neighbours.push([cx, cz + 1]);
    for (const [nx, nz] of neighbours) {
      const neighbour = this.chunks.get(`${nx},${nz}`);
      if (!neighbour) continue;
      const nBlocks = neighbour.toBlockArray();
      this.meshWorker.postMessage(
        {
          type: 'chunk',
          cx: nx,
          cz: nz,
          dimension: this.dimension,
          blocks: nBlocks,
        } satisfies MeshWorkerCommand,
        [nBlocks.buffer],
      );
      this.meshing.delete(`${nx},${nz}`);
    }

    this.meshing.delete(`${cx},${cz}`);
    return true;
  }

  getBlock(x: number, y: number, z: number): number {
    const chunk = this.chunks.get(`${x >> 4},${z >> 4}`);
    if (!chunk) return 0;
    return chunk.getBlock(x - ((x >> 4) << 4), y, z - ((z >> 4) << 4));
  }

  dispose(): void {
    this.genWorker.terminate();
    this.meshWorker.terminate();
    this.chunks.clear();
    this.renderer.clear();
  }
}

void WORLD_MIN_Y;
