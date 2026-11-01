/**
 * Cubicraft — pairing helpers.
 *
 * The host produces an SDP payload; the guest answers with one.  Both are
 * "join packs": a compressed, URL-safe blob that can travel through a chat
 * message, a QR code or a piece of paper.
 *
 * Two representations are supported:
 * - a *pack* (compressed, machine friendly) — used when the two devices are
 *   talking over a link that can carry a URL;
 * - a *join code* (Crockford base32, grouped in blocks of four, with a
 *   checksum) — used when someone has to read the code out loud.
 */

import { crc32 } from './codec';

/** The payload exchanged during pairing. */
export interface JoinPackPayload {
  sdp: string;
  type: 'offer' | 'answer';
}

/** Marker prefix for a deflate-compressed pack. */
const COMPRESSED_MARKER = 'Z';
/** Marker prefix for an uncompressed (fallback) pack. */
const PLAIN_MARKER = 'P';

/**
 * Crockford base32: no I, L, O or U, so a misread character is usually
 * obvious and `1`/`I`/`L` all decode the same.
 */
const BASE32_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder();

// ---------------------------------------------------------------------------
// base64url
// ---------------------------------------------------------------------------

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(text: string): Uint8Array {
  const normalized = text.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

// ---------------------------------------------------------------------------
// Compression
// ---------------------------------------------------------------------------

/** True when the browser can deflate/inflate natively. */
export function isCompressionAvailable(): boolean {
  return (
    typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined'
  );
}

async function deflateRaw(data: Uint8Array): Promise<Uint8Array | null> {
  if (!isCompressionAvailable()) return null;
  try {
    const stream = new Blob([data as BlobPart])
      .stream()
      .pipeThrough(new CompressionStream('deflate-raw'));
    const buffer = await new Response(stream).arrayBuffer();
    return new Uint8Array(buffer);
  } catch {
    // A corrupted or unsupported stream must not break pairing.
    return null;
  }
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('pairing: this browser cannot decompress join packs');
  }
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

// ---------------------------------------------------------------------------
// Join packs
// ---------------------------------------------------------------------------

/**
 * Turn a pairing payload into a transportable pack.
 *
 * Uses deflate-raw when the browser supports it; otherwise falls back to plain
 * base64url and marks the pack with `P` so the reader knows.
 */
export async function encodeJoinPack(payload: JoinPackPayload | string): Promise<string> {
  const json = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const bytes = UTF8_ENCODER.encode(json);
  const compressed = await deflateRaw(bytes);
  if (compressed && compressed.length < bytes.length) {
    return COMPRESSED_MARKER + bytesToBase64Url(compressed);
  }
  return PLAIN_MARKER + bytesToBase64Url(bytes);
}

/**
 * Read a pack back into its payload.
 *
 * Accepts a compressed pack, a plain pack, or the raw JSON string produced by
 * the peer layer, so callers never have to know which form they hold.
 */
export async function decodeJoinPack(pack: string): Promise<JoinPackPayload> {
  const trimmed = pack.trim();
  if (trimmed.startsWith('{')) {
    return JSON.parse(trimmed) as JoinPackPayload;
  }
  const marker = trimmed.charAt(0);
  const body = trimmed.slice(1);
  const bytes = base64UrlToBytes(body);
  let json: string;
  if (marker === COMPRESSED_MARKER) {
    json = UTF8_DECODER.decode(await inflateRaw(bytes));
  } else {
    json = UTF8_DECODER.decode(bytes);
  }
  const parsed = JSON.parse(json) as JoinPackPayload;
  if (typeof parsed.sdp !== 'string') {
    throw new Error('pairing: join pack is missing its SDP');
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Base32 (Crockford) — used for the human-typed join code
// ---------------------------------------------------------------------------

function base32Encode(bytes: Uint8Array): string {
  let value = 0;
  let bits = 0;
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(text: string): Uint8Array {
  let value = 0;
  let bits = 0;
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    // Crockford aliases: I/L -> 1, O -> 0.
    const normalised = ch === 'I' || ch === 'L' ? '1' : ch === 'O' ? '0' : ch;
    const index = BASE32_ALPHABET.indexOf(normalised);
    if (index < 0) throw new Error(`pairing: invalid base32 character "${ch}"`);
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

/** Two base32 characters of checksum over the code payload. */
function checksumOf(payload: string): string {
  const value = crc32(UTF8_ENCODER.encode(payload)) & 0x3ff;
  return BASE32_ALPHABET[value >>> 5] + BASE32_ALPHABET[value & 31];
}

/**
 * Render a pack as a readable join code: uppercase, grouped in blocks of
 * four, with a two-character checksum so a typo is caught before pairing.
 */
export function formatJoinCode(pack: string): string {
  const payload = base32Encode(UTF8_ENCODER.encode(pack));
  const groups: string[] = payload.match(/.{1,4}/g) ?? [];
  groups.push(checksumOf(payload));
  return groups.join('-');
}

/**
 * Parse a join code back into the original pack.
 *
 * Raw packs (base64url) are returned unchanged apart from whitespace, so a
 * caller can accept either form.
 */
export function parseJoinCode(text: string): string {
  const trimmed = text.trim();
  // base64url is case sensitive, so anything with lower case is a raw pack.
  if (/[a-z]/.test(trimmed)) return trimmed.replace(/\s+/g, '');
  const compact = trimmed.replace(/[\s-]/g, '').toUpperCase();
  if (compact.length < 4 || !/^[0-9A-HJKMNP-TV-Z]+$/.test(compact)) {
    throw new Error('pairing: not a valid join code');
  }
  const payload = compact.slice(0, -2);
  const check = compact.slice(-2);
  if (checksumOf(payload) !== check) {
    throw new Error('pairing: join code checksum does not match (check for typos)');
  }
  return UTF8_DECODER.decode(base32Decode(payload));
}

/** True when the text looks like a join code rather than a raw pack. */
export function isJoinCode(text: string): boolean {
  const compact = text.trim().replace(/[\s-]/g, '').toUpperCase();
  if (compact.length < 4) return false;
  if (!/^[0-9A-HJKMNP-TV-Z]+$/.test(compact)) return false;
  const payload = compact.slice(0, -2);
  return checksumOf(payload) === compact.slice(-2);
}

// ---------------------------------------------------------------------------
// QR
// ---------------------------------------------------------------------------

/**
 * Build the string a launcher should render as a QR code.  The LAN URL is
 * carried inside a custom scheme so a phone camera can offer to open the game.
 */
export function makeQrPayload(url: string): string {
  return `cubicraft://join?u=${encodeURIComponent(url)}`;
}
