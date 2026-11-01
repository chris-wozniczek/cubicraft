/**
 * The mesh worker: a thin wrapper around the mesher that speaks the
 * message protocol.
 */

import { MeshBuilder } from './mesher';
import type { MeshWorkerCommand, MeshWorkerMessage } from './types';

const builder = new MeshBuilder();

self.onmessage = (event: MessageEvent<MeshWorkerCommand>) => {
  const command = event.data;
  try {
    switch (command.type) {
      case 'init': {
        builder.setProfiles(command.profiles);
        break;
      }
      case 'chunk': {
        builder.setChunk(command.cx, command.cz, command.blocks);
        break;
      }
      case 'mesh': {
        const started = performance.now();
        const groups = builder.build(
          command.cx,
          command.cz,
          command.smoothLighting,
          command.ambientOcclusion,
        );
        const buildMs = performance.now() - started;
        const result: MeshWorkerMessage = {
          type: 'meshResult',
          jobId: command.jobId,
          cx: command.cx,
          cz: command.cz,
          dimension: command.dimension,
          groups,
          buildMs,
        };
        const transfer: Transferable[] = [];
        for (const group of groups) {
          transfer.push(
            group.positions.buffer,
            group.normals.buffer,
            group.uvs.buffer,
            group.data.buffer,
            group.layers.buffer,
            group.indices.buffer,
          );
        }
        (self as unknown as Worker).postMessage(result, transfer);
        break;
      }
      case 'unload': {
        builder.removeChunk(command.cx, command.cz);
        break;
      }
    }
  } catch (error) {
    const message: MeshWorkerMessage = {
      type: 'error',
      jobId: -1,
      message: error instanceof Error ? error.message : String(error),
    };
    (self as unknown as Worker).postMessage(message);
  }
};
