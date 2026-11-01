import { describe, expect, it } from 'vitest';
import {
  decodeMessage,
  dequantizeAngle,
  dequantizePos,
  encodeMessage,
  encodePayload,
  decodePayload,
  isFastOp,
  Op,
  quantizeAngle,
  quantizePos,
  type NetMessage,
} from '../src/net/protocol';
import { PROTOCOL_VERSION, type AvatarSpec, type PlayerAppearance } from '../src/core/types';

const avatar: AvatarSpec = {
  kit: 'default',
  skinTone: 3,
  hair: 1,
  hairColor: 0x336699,
  name: 'Steve',
  number: 7,
};

const appearance: PlayerAppearance = { id: 'p1', name: 'Alex', avatar };

/** One sample message per opcode in the catalogue. */
const SAMPLES: NetMessage[] = [
  { op: Op.HELLO, protocolVersion: PROTOCOL_VERSION, name: 'Alex', avatar },
  {
    op: Op.WELCOME,
    playerId: 'p1',
    seed: 20261101,
    timeOfDay: 0.25,
    dayLengthSeconds: 600,
    mode: 'survival',
    players: [appearance],
    chunkData: new Uint8Array([1, 2, 3, 4, 5]),
  },
  { op: Op.MOVE, x: quantizePos(-12.5), y: quantizePos(64), z: quantizePos(3.25), yaw: 128, pitch: 64, flags: 0b101 },
  { op: Op.BLOCK_BREAK, x: -10, y: 63, z: 240 },
  { op: Op.BLOCK_PLACE, x: 10, y: -64, z: -240, blockId: 42, state: 3 },
  { op: Op.CHUNK_REQUEST, cx: -3, cz: 7, dimension: 'overworld' },
  { op: Op.CHAT, from: 'Alex', text: 'hello world!' },
  { op: Op.INVENTORY_ACTION, slot: 9, action: 2, itemId: 'cobblestone', count: 64 },
  { op: Op.PING, id: 17, time: 1234.5 },
  { op: Op.INPUT_ACTION, action: 4, value: 0.5 },
  { op: Op.RESPAWN },
  { op: Op.WORLD_SAVE_REQUEST },
  { op: Op.HOST_TRANSFER, toPlayerId: 'p2' },
  { op: Op.BEACON_JOIN, playerId: 'p3', name: 'Alex', avatar },
  { op: Op.PLAYER_JOIN, player: appearance, dimension: 'overworld', x: 1.5, y: 64, z: -2.5 },
  { op: Op.PLAYER_LEAVE, playerId: 'p2' },
  { op: Op.CHUNK_DATA, cx: 1, cz: -1, dimension: 'nether', payload: new Uint8Array([9, 8, 7]) },
  { op: Op.BLOCK_CHANGE, x: 1, y: 2, z: 3, blockId: 5, state: 0 },
  {
    op: Op.BULK_BLOCK_CHANGE,
    changes: [
      { x: 1, y: 2, z: 3, blockId: 5, state: 0 },
      { x: -4, y: -5, z: 6, blockId: 7, state: 1 },
    ],
  },
  { op: Op.ENTITY_SPAWN, id: 900, type: 'zombie', x: 1.25, y: 64.5, z: -3.75, yaw: 0.5, pitch: -0.25 },
  { op: Op.ENTITY_DESPAWN, id: 900 },
  { op: Op.ENTITY_STATE, id: 900, state: 6, health: 13.5 },
  { op: Op.ENTITY_MOVES, id: 900, dx: 0.1, dy: -0.2, dz: 0.3, yaw: 1.5, pitch: 0.25 },
  {
    op: Op.INVENTORY_SYNC,
    playerId: 'p1',
    slots: [{ slot: 0, itemId: 'stone', count: 12, durability: 40 }],
  },
  { op: Op.ITEM_PICKUP, itemId: 'dirt', count: 3 },
  { op: Op.DAMAGE, amount: 4.5, health: 15.5, source: 'zombie' },
  { op: Op.MOB_AI, id: 900, goal: 'chase', targetId: 901 },
  { op: Op.TIME_WEATHER, timeOfDay: 0.75, dayLengthSeconds: 600, weather: 2 },
  { op: Op.WORLD_SAVE, bytes: new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]) },
  { op: Op.PONG, id: 17, time: 1234.5 },
  { op: Op.CHUNK_UNLOAD, cx: -3, cz: 7, dimension: 'overworld' },
  { op: Op.CORRECTION, x: 1.5, y: 64.25, z: -2.5, yaw: 0.5, pitch: -0.125 },
  {
    op: Op.HOST_TRANSFERRED,
    newHostId: 'p2',
    seed: 20261101,
    timeOfDay: 0.5,
    dayLengthSeconds: 600,
    mode: 'creative',
    players: [appearance],
    worldSave: new Uint8Array([10, 20, 30]),
  },
  { op: Op.ERROR, code: 1, message: 'protocol mismatch' },
];

/**
 * Compare two messages.
 *
 * Positions and angles are stored as float32 on the wire, so they survive the
 * round-trip to within float32 precision rather than exactly.
 */
function expectMessagesEqual(actual: unknown, expected: unknown, path = ''): void {
  if (typeof expected === 'number' && typeof actual === 'number') {
    const tolerance = Math.max(1e-6, Math.abs(expected) * 1e-6);
    expect(Math.abs(actual - expected), `at ${path}`).toBeLessThanOrEqual(tolerance);
    return;
  }
  if (expected instanceof Uint8Array) {
    expect(actual, `at ${path}`).toBeInstanceOf(Uint8Array);
    expect(Array.from(actual as Uint8Array), `at ${path}`).toEqual(Array.from(expected));
    return;
  }
  if (Array.isArray(expected)) {
    expect(Array.isArray(actual), `at ${path}`).toBe(true);
    const actualArray = actual as unknown[];
    expect(actualArray.length, `at ${path}`).toBe(expected.length);
    expected.forEach((item, index) => {
      expectMessagesEqual(actualArray[index], item, `${path}[${index}]`);
    });
    return;
  }
  if (expected && typeof expected === 'object') {
    expect(actual, `at ${path}`).toBeTypeOf('object');
    const actualObject = actual as Record<string, unknown>;
    for (const key of Object.keys(expected as Record<string, unknown>)) {
      expectMessagesEqual(actualObject[key], (expected as Record<string, unknown>)[key], `${path}.${key}`);
    }
    return;
  }
  expect(actual, `at ${path}`).toEqual(expected);
}

describe('message catalogue', () => {
  it('covers every opcode in the catalogue exactly once', () => {
    const opcodes = SAMPLES.map((msg) => msg.op);
    const expected = [
      Op.HELLO, Op.MOVE, Op.BLOCK_BREAK, Op.BLOCK_PLACE, Op.CHUNK_REQUEST, Op.CHAT,
      Op.INVENTORY_ACTION, Op.PING, Op.INPUT_ACTION, Op.RESPAWN, Op.WORLD_SAVE_REQUEST,
      Op.HOST_TRANSFER, Op.BEACON_JOIN, Op.WELCOME, Op.PLAYER_JOIN, Op.PLAYER_LEAVE,
      Op.CHUNK_DATA, Op.BLOCK_CHANGE, Op.BULK_BLOCK_CHANGE, Op.ENTITY_SPAWN,
      Op.ENTITY_DESPAWN, Op.ENTITY_STATE, Op.ENTITY_MOVES, Op.INVENTORY_SYNC,
      Op.ITEM_PICKUP, Op.DAMAGE, Op.MOB_AI, Op.TIME_WEATHER, Op.WORLD_SAVE, Op.PONG,
      Op.CHUNK_UNLOAD, Op.CORRECTION, Op.HOST_TRANSFERRED, Op.ERROR,
    ];
    expect(new Set(opcodes).size).toBe(opcodes.length);
    for (const op of expected) {
      expect(opcodes).toContain(op);
    }
    expect(opcodes.length).toBe(expected.length);
  });

  it('round-trips every opcode through encodeMessage/decodeMessage', () => {
    for (const sample of SAMPLES) {
      const frame = encodeMessage(sample);
      const decoded = decodeMessage(frame);
      expectMessagesEqual(decoded, sample, `op ${sample.op}`);
    }
  });

  it('round-trips every opcode through the payload helpers', () => {
    for (const sample of SAMPLES) {
      const payload = encodePayload(sample);
      expectMessagesEqual(decodePayload(sample.op, payload), sample, `op ${sample.op}`);
    }
  });

  it('frames messages with a length prefix and an opcode byte', () => {
    const frame = encodeMessage({ op: Op.RESPAWN });
    // length (1 byte) + opcode (1 byte) + no payload
    expect(frame.length).toBe(2);
    expect(frame[1]).toBe(Op.RESPAWN);
  });

  it('rejects a truncated frame', () => {
    const frame = encodeMessage({ op: Op.CHAT, from: 'Alex', text: 'hello' });
    expect(() => decodeMessage(frame.subarray(0, frame.length - 2))).toThrow();
  });

  it('routes position traffic to the fast channel', () => {
    expect(isFastOp(Op.MOVE)).toBe(true);
    expect(isFastOp(Op.ENTITY_MOVES)).toBe(true);
    expect(isFastOp(Op.CHUNK_DATA)).toBe(false);
    expect(isFastOp(Op.BLOCK_CHANGE)).toBe(false);
  });
});

describe('quantisation', () => {
  it('round-trips positions within a thirty-second of a block', () => {
    const values = [0, 1, -1, 0.5, -0.5, 12.25, -300.75, 4096.125];
    for (const value of values) {
      const back = dequantizePos(quantizePos(value));
      expect(Math.abs(back - value)).toBeLessThanOrEqual(1 / 32);
    }
  });

  it('round-trips angles within one 256th of a turn', () => {
    // Angles are stored wrapped into 0..255, so the comparison is modulo a
    // full turn: only the shortest angular distance matters.
    const shortestDifference = (a: number, b: number): number => {
      const turn = 2 * Math.PI;
      const diff = ((a - b) % turn + turn + Math.PI) % turn - Math.PI;
      return Math.abs(diff);
    };
    const values = [0, Math.PI / 2, Math.PI, -Math.PI / 2, 3.5, -3.5];
    for (const value of values) {
      const back = dequantizeAngle(quantizeAngle(value));
      expect(shortestDifference(back, value)).toBeLessThanOrEqual((2 * Math.PI) / 256);
    }
  });

  it('wraps angles into 0..255', () => {
    for (const value of [0, 1, 10, -1, -10, 1000, -1000]) {
      const q = quantizeAngle(value);
      expect(q).toBeGreaterThanOrEqual(0);
      expect(q).toBeLessThanOrEqual(255);
      expect(Number.isInteger(q)).toBe(true);
    }
  });
});
