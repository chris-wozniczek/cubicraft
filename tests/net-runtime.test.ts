import { describe, expect, it } from 'vitest';
import {
  decodeJoinPack,
  encodeJoinPack,
  formatJoinCode,
  isJoinCode,
  makeQrPayload,
  parseJoinCode,
} from '../src/net/pairing';
import { exportWorldPassport, importWorldPassport, type WorldSave } from '../src/net/persistence';
import { InterestManager } from '../src/net/interest';
import { IceDiagnostics } from '../src/net/diagnostics';
import { validateBlockEdit } from '../src/net/hostAuthority';
import { reconcileAction } from '../src/net/guestClient';
import { encodeChunk, rleEncode, type ChunkPayload, type SectionPayload } from '../src/net/codec';
import { encodeMessage, Op, quantizePos } from '../src/net/protocol';
import { SECTION_COUNT, type PlayerState } from '../src/core/types';
import { SeededRng } from '../src/core/rng';
import { log } from '../src/core/log';

const player: PlayerState = {
  id: 'p1', name: 'Alex', x: 0, y: 64, z: 0, yaw: 0, pitch: 0,
  health: 20, hunger: 20, saturation: 5, xp: 0, level: 0, onGround: true,
  flying: false, sneaking: false, sprinting: false, mode: 'survival',
  avatar: { kit: 'default', skinTone: 1, hair: 1, hairColor: 0, name: 'Alex', number: 1 },
  dimension: 'overworld',
};

describe('pairing', () => {
  it('round-trips a join pack', async () => {
    const pack = await encodeJoinPack({ sdp: 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\n', type: 'offer' });
    const decoded = await decodeJoinPack(pack);
    expect(decoded.type).toBe('offer');
    expect(decoded.sdp).toContain('v=0');
  });

  it('round-trips a join code', async () => {
    const pack = await encodeJoinPack({ sdp: 'x'.repeat(500), type: 'answer' });
    const code = formatJoinCode(pack);
    expect(code).toMatch(/^[0-9A-Z-]+$/);
    expect(isJoinCode(code)).toBe(true);
    expect(parseJoinCode(code)).toBe(pack);
  });

  it('detects a mistyped join code', async () => {
    const pack = await encodeJoinPack({ sdp: 'y'.repeat(120), type: 'offer' });
    const code = formatJoinCode(pack);
    const broken = code.slice(0, -3) + 'ZZZ';
    expect(() => parseJoinCode(broken)).toThrow(/checksum/);
  });

  it('passes a raw pack through unchanged', () => {
    const raw = 'PeyJ0eXBlIjoib2ZmZXIifQ';
    expect(parseJoinCode(raw)).toBe(raw);
  });

  it('builds a QR payload', () => {
    expect(makeQrPayload('http://192.168.1.5:5173')).toContain('cubicraft://join');
  });
});

describe('persistence', () => {
  it('round-trips a world passport', async () => {
    const save: WorldSave = {
      version: 1, seed: 42, timeOfDay: 0.5, dayLengthSeconds: 600, weather: 0,
      dimension: 'overworld', players: [], diffs: [
        { cx: 1, cz: -2, dimension: 'overworld', blocks: [3, 0], pal: [5] },
      ],
    };
    const bytes = await exportWorldPassport(save);
    const back = await importWorldPassport(bytes);
    expect(back.seed).toBe(42);
    expect(back.diffs[0].cx).toBe(1);
    expect(back.diffs[0].blocks).toEqual([3, 0]);
  });
});

describe('interest', () => {
  it('paces position updates by distance', () => {
    const manager = new InterestManager();
    manager.registerPeer('p1', 0, 0, 0);
    expect(manager.positionIntervalFor(8)).toBe(50);
    expect(manager.positionIntervalFor(40)).toBe(200);
    expect(manager.positionIntervalFor(100)).toBe(0);
    expect(manager.canSendPosition('p1', 1000)).toBe(true);
    manager.notePositionSent('p1', 1000);
    expect(manager.canSendPosition('p1', 1010)).toBe(false);
    expect(manager.canSendPosition('p1', 1100)).toBe(true);
  });

  it('throttles chunk sends and sorts by distance', () => {
    const manager = new InterestManager(2);
    manager.registerPeer('p1', 0, 0, 0);
    const chunks = [{ cx: 5, cz: 0 }, { cx: 0, cz: 0 }, { cx: 1, cz: 0 }];
    const selected = manager.selectChunksToSend('p1', 1000, chunks);
    expect(selected.length).toBe(2);
    expect(selected[0]).toEqual({ cx: 0, cz: 0 });
  });
});

describe('diagnostics', () => {
  it('diagnoses a failed connection', () => {
    const diagnostics = new IceDiagnostics();
    diagnostics.recordCandidate({ type: 'host', protocol: 'udp' });
    diagnostics.recordState('failed');
    expect(diagnostics.summary()).toContain('router');
  });

  it('diagnoses a working connection', () => {
    const diagnostics = new IceDiagnostics();
    diagnostics.recordState('connected');
    expect(diagnostics.summary()).toContain('working');
  });
});

describe('host authority validation', () => {
  it('rejects edits that are out of reach', () => {
    const result = validateBlockEdit(player, { x: 30, y: 64, z: 0 }, 'break');
    expect(result.ok).toBe(false);
  });

  it('accepts edits that are close enough', () => {
    const result = validateBlockEdit(player, { x: 2, y: 64, z: 0 }, 'break');
    expect(result.ok).toBe(true);
  });

  it('rejects edits outside the world', () => {
    expect(validateBlockEdit(player, { x: 0, y: -100, z: 0 }, 'break').ok).toBe(false);
  });

  it('rejects breaking in spectator mode', () => {
    const spectator = { ...player, mode: 'spectator' as const };
    expect(validateBlockEdit(spectator, { x: 0, y: 64, z: 0 }, 'break').ok).toBe(false);
  });
});

describe('reconciliation', () => {
  it('chooses the right action per distance', () => {
    expect(reconcileAction(0.05)).toBe('none');
    expect(reconcileAction(1)).toBe('lerp');
    expect(reconcileAction(5)).toBe('snap');
  });
});

describe('public API', () => {
  it('exposes the whole networking layer through the barrel', async () => {
    const net = await import('../src/net/index');
    const expected = [
      'ByteReader', 'ByteWriter', 'crc32', 'rleDecode', 'rleEncode', 'encodeChunk',
      'decodeChunk', 'encodeSection', 'decodeSection', 'encodeVarintNumber',
      'decodeVarintNumber', 'writeVarint', 'readVarint', 'writeZigZag', 'readZigZag',
      'Op', 'encodeMessage', 'decodeMessage', 'quantizePos', 'dequantizePos',
      'quantizeAngle', 'dequantizeAngle', 'PeerConnection', 'GuestClient',
      'HostAuthority', 'validateBlockEdit', 'InterestManager', 'IceDiagnostics',
      'WorldStore', 'AutoSaver', 'exportWorldPassport', 'importWorldPassport',
      'encodeJoinPack', 'decodeJoinPack', 'formatJoinCode', 'parseJoinCode',
      'makeQrPayload',
    ];
    for (const name of expected) {
      expect(net, `missing export: ${name}`).toHaveProperty(name);
    }
  });
});

describe('wire size budget', () => {
  /** A typical surface chunk column: solid below y=64, air above, a few ores. */
  function representativeChunk(): ChunkPayload {
    const rng = new SeededRng('size-budget');
    const sections: SectionPayload[] = [];
    for (let sy = 0; sy < SECTION_COUNT; sy++) {
      const values = new Uint16Array(4096);
      const baseY = sy * 16;
      for (let i = 0; i < values.length; i++) {
        if (baseY < 60) values[i] = rng.chance(0.02) ? 7 : 1; // stone + ore
        else if (baseY < 64) values[i] = 2; // dirt
        else if (rng.chance(0.01)) values[i] = 5; // the odd plant
      }
      const { palette, runs } = rleEncode(values);
      sections.push({ sy, palette, runs });
    }
    return { cx: 0, cz: 0, dimension: 'overworld', sections };
  }

  it('keeps a representative chunk small enough for a home Wi-Fi link', () => {
    const bytes = encodeChunk(representativeChunk());
    // A chunk is sent once when it enters a player's view; keeping it small
    // matters more than keeping it tiny.
    expect(bytes.length).toBeLessThan(16 * 1024);
    log.info(`net: representative chunk = ${bytes.length} bytes`);
  });

  it('keeps a position update tiny', () => {
    const frame = encodeMessage({
      op: Op.MOVE,
      x: quantizePos(-12.5),
      y: quantizePos(64),
      z: quantizePos(3.25),
      yaw: 128,
      pitch: 64,
      flags: 0b101,
    });
    expect(frame.length).toBeLessThanOrEqual(12);
    log.info(`net: MOVE frame = ${frame.length} bytes`);
  });
});
