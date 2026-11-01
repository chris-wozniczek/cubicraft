/**
 * The generation worker.
 *
 * Terrain generation is the most expensive part of the game, so it runs in a
 * worker. The worker produces block *names*; the main thread maps them to
 * numeric ids using the content registry, which keeps the generator
 * independent of the content data.
 */

import { generateChunk } from '../worldgen/generator';
import type { GenWorkerMessage, GenWorkerRequest } from './types';

self.onmessage = (event: MessageEvent<GenWorkerRequest>) => {
  const request = event.data;
  if (request.type !== 'generate') return;

  try {
    const started = performance.now();
    const chunk = generateChunk(request.seed, request.cx, request.cz, request.dimension);
    const message: GenWorkerMessage = {
      type: 'generated',
      jobId: request.jobId,
      cx: request.cx,
      cz: request.cz,
      dimension: request.dimension,
      blocks: chunk.blocks,
      biomes: chunk.biomes,
      heightMap: chunk.heightMap,
      structures: chunk.structures,
      genMs: performance.now() - started,
    };
    (self as unknown as Worker).postMessage(message, [chunk.heightMap.buffer]);
  } catch (error) {
    const message: GenWorkerMessage = {
      type: 'error',
      jobId: request.jobId,
      message: error instanceof Error ? error.message : String(error),
    };
    (self as unknown as Worker).postMessage(message);
  }
};
