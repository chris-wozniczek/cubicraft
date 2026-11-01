/**
 * Multiplayer: the host's browser owns the world, guests connect straight to
 * it over a WebRTC data channel. There is no game server anywhere.
 */

import * as THREE from 'three';

import {
  PeerConnection,
  Op,
  decodeChunk,
  encodeChunk,
  quantizeAngle,
  quantizePos,
  dequantizePos,
  dequantizeAngle,
  type ChunkPayload,
  type NetMessage,
} from '../net';
import { CHUNK_X, CHUNK_Y, CHUNK_Z, SECTION_COUNT, SECTION_VOLUME, WORLD_MIN_Y } from '../core/types';
import { AvatarModel } from '../assets/avatarModel';
import type { AvatarSpec, GameMode } from '../core/types';
import { log } from '../core/log';
import type { Game } from './game';

export interface RemotePlayer {
  id: string;
  name: string;
  avatar: AvatarSpec;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  /** Target position used for smooth interpolation. */
  tx: number;
  ty: number;
  tz: number;
  walkPhase: number;
}

/**
 * Bridges the network layer to the game.
 */
export class MultiplayerSession {
  readonly peer: PeerConnection;
  readonly remotePlayers = new Map<string, RemotePlayer>();
  /** The player's own id, assigned by the host. */
  playerId = '';
  isHost: boolean;
  /** Set when the connection fails, so the UI can explain what to do. */
  error: string | null = null;

  private moveTimer = 0;
  private chunkRequests = new Set<string>();
  private lastChunk = '';

  constructor(
    private readonly game: Game,
    isHost: boolean,
    onStateChange?: (state: string) => void,
  ) {
    this.isHost = isHost;
    this.peer = new PeerConnection({
      isHost,
      onMessage: (message) => this.handleMessage(message),
      onStateChange: (state) => {
        if (state === 'failed' || state === 'closed' || state === 'disconnected') {
          this.error =
            state === 'failed'
              ? 'The connection could not be made. If you are on Wi-Fi, your router may be blocking device-to-device traffic — try both laptops on the same network, or play with two tabs on one machine.'
              : 'The connection was closed.';
        }
        onStateChange?.(state);
      },
      onOpen: () => {
        if (this.isHost) {
          this.send({
            op: Op.HELLO,
            protocolVersion: 3,
            name: this.game.playerName,
            avatar: this.game.avatar,
          });
        }
      },
    });
  }

  /** Host: create the join pack the guests paste or scan. */
  async createJoinPack(): Promise<string> {
    return this.peer.createHostJoinPack();
  }

  /** Guest: turn the host's pack into an answer pack. */
  async join(pack: string): Promise<string> {
    return this.peer.createGuestJoinPack(pack);
  }

  /** Host: accept the answer pack from a guest. */
  async acceptAnswer(pack: string): Promise<void> {
    await this.peer.acceptAnswer(pack);
  }

  send(message: NetMessage): void {
    this.peer.send(message);
  }

  // -----------------------------------------------------------------------

  private handleMessage(message: NetMessage): void {
    switch (message.op) {
      case Op.HELLO: {
        // A guest said hello.
        this.playerId = message.name;
        this.send({
          op: Op.WELCOME,
          playerId: this.playerId,
          seed: 20261101,
          timeOfDay: this.game.dayNight.hour,
          dayLengthSeconds: this.game.dayNight.dayLength,
          mode: this.game.mode as GameMode,
          players: [],
          chunkData:
            this.encodeChunkAt(
              Math.floor(this.game.player.x / CHUNK_X),
              Math.floor(this.game.player.z / CHUNK_Z),
            ) ?? new Uint8Array(0),
        });
        break;
      }

      case Op.WELCOME: {
        this.playerId = message.playerId;
        this.game.dayNight.hour = message.timeOfDay;
        this.game.dayNight.dayLength = message.dayLengthSeconds;
        this.game.hud.showToast('Joined the world');
        break;
      }

      case Op.MOVE: {
        const player = this.remotePlayers.get('remote');
        if (!player) break;
        player.tx = dequantizePos(message.x);
        player.ty = dequantizePos(message.y);
        player.tz = dequantizePos(message.z);
        player.yaw = dequantizeAngle(message.yaw);
        player.pitch = dequantizeAngle(message.pitch);
        break;
      }

      case Op.PLAYER_JOIN: {
        this.remotePlayers.set(message.player.id, {
          id: message.player.id,
          name: message.player.name,
          avatar: message.player.avatar,
          x: message.x,
          y: message.y,
          z: message.z,
          tx: message.x,
          ty: message.y,
          tz: message.z,
          yaw: 0,
          pitch: 0,
          walkPhase: 0,
        });
        this.game.hud.showToast(`${message.player.name} joined`);
        break;
      }

      case Op.PLAYER_LEAVE: {
        this.remotePlayers.delete(message.playerId);
        break;
      }

      case Op.BLOCK_CHANGE: {
        this.game.chunkManager.setBlock(message.x, message.y, message.z, message.blockId);
        break;
      }

      case Op.CHUNK_REQUEST: {
        const payload = this.encodeChunkAt(message.cx, message.cz);
        if (payload) {
          this.send({
            op: Op.CHUNK_DATA,
            cx: message.cx,
            cz: message.cz,
            dimension: message.dimension,
            payload,
          });
        }
        break;
      }

      case Op.CHUNK_DATA: {
        try {
          const payload = decodeChunk(message.payload);
          this.applyChunk(payload);
        } catch (error) {
          log.warn('[net] chunk desync, asking again', error);
          this.requestChunk(message.cx, message.cz);
        }
        break;
      }

      case Op.CHAT: {
        this.game.hud.addChat(message.from, message.text);
        break;
      }

      case Op.ERROR: {
        this.error = message.message;
        break;
      }

      default:
        break;
    }
  }

  // -----------------------------------------------------------------------

  /** Encode a chunk from the local world into the wire format. */
  private encodeChunkAt(cx: number, cz: number): Uint8Array | null {
    const chunk = this.game.chunkManager.chunks.get(`${cx},${cz}`);
    if (!chunk) return null;

    const sections = [];
    for (let si = 0; si < SECTION_COUNT; si++) {
      const section = chunk.sections[si];
      if (!section || section.empty) continue;

      const palette: number[] = [];
      const paletteIndex = new Map<number, number>();
      const runs: number[] = [];
      let runLength = 0;
      let runIndex = -1;

      for (let i = 0; i < SECTION_VOLUME; i++) {
        const id = section.slotAt(i);
        let index = paletteIndex.get(id);
        if (index === undefined) {
          index = palette.length;
          palette.push(id);
          paletteIndex.set(id, index);
        }
        if (index === runIndex) {
          runLength++;
        } else {
          if (runIndex >= 0) runs.push(runLength, runIndex);
          runIndex = index;
          runLength = 1;
        }
      }
      if (runIndex >= 0) runs.push(runLength, runIndex);

      sections.push({ sy: si, palette, runs });
    }

    return encodeChunk({ cx, cz, dimension: 'overworld', sections });
  }

  /** Install a chunk received from the host. */
  private applyChunk(payload: ChunkPayload): void {
    const blocks = new Uint16Array(SECTION_COUNT * SECTION_VOLUME);
    for (const section of payload.sections) {
      const base = section.sy * SECTION_VOLUME;
      let cursor = 0;
      for (let i = 0; i < section.runs.length; i += 2) {
        const length = section.runs[i];
        const paletteIndex = section.runs[i + 1];
        const id = section.palette[paletteIndex] ?? 0;
        for (let j = 0; j < length && cursor + j < SECTION_VOLUME; j++) {
          blocks[base + cursor + j] = id;
        }
        cursor += length;
      }
    }

    const chunk = this.game.chunkManager.chunks.get(`${payload.cx},${payload.cz}`);
    if (chunk) {
      chunk.fromBlockArray(blocks);
    }
  }

  requestChunk(cx: number, cz: number): void {
    const key = `${cx},${cz}`;
    if (this.chunkRequests.has(key)) return;
    this.chunkRequests.add(key);
    this.send({ op: Op.CHUNK_REQUEST, cx, cz, dimension: 'overworld' });
  }

  /** Send the local player's movement at 20 Hz. */
  update(dt: number): void {
    if (!this.peer.isOpen) return;

    // Ask the host for the chunk we are standing in.
    const cx = Math.floor(this.game.player.x / CHUNK_X);
    const cz = Math.floor(this.game.player.z / CHUNK_Z);
    const key = `${cx},${cz}`;
    if (key !== this.lastChunk) {
      this.lastChunk = key;
      this.chunkRequests.delete(key);
      this.requestChunk(cx, cz);
    }

    this.moveTimer += dt;
    if (this.moveTimer < 0.05) return;
    this.moveTimer = 0;

    const player = this.game.player;
    this.send({
      op: Op.MOVE,
      x: quantizePos(player.x),
      y: quantizePos(player.y),
      z: quantizePos(player.z),
      yaw: quantizeAngle(player.yaw),
      pitch: quantizeAngle(player.pitch),
      flags: 0,
    });
  }

  /** Broadcast a block change to everyone else. */
  broadcastBlockChange(x: number, y: number, z: number, blockId: number): void {
    this.send({ op: Op.BLOCK_CHANGE, x, y, z, blockId, state: 0 });
  }

  /** Broadcast a chat message. */
  broadcastChat(text: string): void {
    this.send({ op: Op.CHAT, from: this.game.playerName, text });
  }

  close(): void {
    this.peer.close();
  }
}

/**
 * A simple renderer for remote players: one boxy rig per player, wearing the
 * kit they picked.
 */
export class RemotePlayerRenderer {
  readonly group = new THREE.Group();
  private readonly rigs = new Map<string, AvatarModel>();

  constructor() {
    this.group.name = 'remote-players';
    this.group.matrixAutoUpdate = false;
  }

  update(players: Iterable<RemotePlayer>): void {
    const seen = new Set<string>();
    for (const player of players) {
      seen.add(player.id);
      let rig = this.rigs.get(player.id);
      if (!rig) {
        rig = new AvatarModel(player.avatar);
        const label = makeNameTag(player.name);
        label.position.set(0, 2.25, 0);
        rig.group.add(label);
        this.rigs.set(player.id, rig);
        this.group.add(rig.group);
      }
      rig.group.position.set(player.x, player.y, player.z);
      rig.group.rotation.y = player.yaw + Math.PI;
      rig.group.rotation.x = player.pitch;
      rig.setLimbPose(player.walkPhase, 0.6);
    }
    for (const [id, rig] of this.rigs) {
      if (seen.has(id)) continue;
      this.group.remove(rig.group);
      rig.dispose();
      this.rigs.delete(id);
    }
  }
}

/** A tiny canvas name tag that always faces the camera. */
function makeNameTag(name: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(10, 14, 22, 0.55)';
  ctx.fillRect(0, 8, 256, 48);
  ctx.fillStyle = '#eaf1fb';
  ctx.font = 'bold 30px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name.slice(0, 14), 128, 33);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }),
  );
  sprite.scale.set(1.6, 0.4, 1);
  return sprite;
}

void CHUNK_Y;
void CHUNK_Z;
void WORLD_MIN_Y;
