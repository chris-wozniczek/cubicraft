#!/usr/bin/env node
/**
 * The Cubicraft LAN launcher.
 *
 * This is NOT a game server — it holds no world state and runs no
 * simulation. It serves the game's static files so the other laptops on the
 * Wi-Fi can load the game, prints the address they need, and optionally
 * relays the WebRTC pairing handshake so a kid only has to click Join
 * instead of copying a code by hand.
 *
 * Usage:
 *   node tools/launcher.mjs                # serve over HTTP
 *   node tools/launcher.mjs --pair-relay   # also relay pairing codes
 *   node tools/launcher.mjs --https         # serve over HTTPS (needs a cert)
 */

import { createServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DIST = join(ROOT, 'dist');

const args = new Set(process.argv.slice(2));
const USE_PAIR_RELAY = args.has('--pair-relay');
const USE_HTTPS = args.has('--https');
const PORT = Number(process.env.CUBICRAFT_PORT ?? (USE_HTTPS ? 8443 : 8080));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
};

/** The most likely IPv4 address of this machine on the home network. */
function lanAddress() {
  const candidates = [];
  for (const [name, addresses] of Object.entries(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family !== 'IPv4' || address.internal) continue;
      // Prefer the usual home interfaces over virtual ones.
      const score = /^(en0|en1|eth0|wlan0|wi-fi|wi-fi 2)$/i.test(name) ? 0 : /^(awdl|utun|bridge|vbox|docker|vmnet|llw|tun|tap)/i.test(name) ? 2 : 1;
      candidates.push({ address: address.address, score });
    }
  }
  candidates.sort((a, b) => a.score - b.score);
  return candidates[0]?.address ?? '127.0.0.1';
}

/** A tiny in-memory store for the pairing handshake. */
const pairing = {
  offer: null,
  answer: null,
  createdAt: 0,
};

function readBody(req) {
  return new Promise((resolvePromise, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 2_000_000) {
        reject(new Error('payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolvePromise(data));
    req.on('error', reject);
  });
}

async function handlePairRelay(req, res, url) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }

  if (url.pathname === '/pair/offer' && req.method === 'POST') {
    const body = await readBody(req);
    pairing.offer = body;
    pairing.createdAt = Date.now();
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (url.pathname === '/pair/answer' && req.method === 'POST') {
    const body = await readBody(req);
    pairing.answer = body;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (url.pathname === '/pair/poll') {
    const age = Date.now() - pairing.createdAt;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ offer: pairing.offer, answer: pairing.answer, age }));
    return;
  }

  if (url.pathname === '/pair/reset' && req.method === 'POST') {
    pairing.offer = null;
    pairing.answer = null;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.writeHead(404).end();
}

async function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const filePath = join(DIST, normalize(pathname).replace(/^(\.\.[/\\])+/, ''));

  if (!filePath.startsWith(DIST)) {
    res.writeHead(403).end('forbidden');
    return;
  }

  try {
    const info = await stat(filePath);
    if (info.isDirectory()) throw new Error('directory');
    const body = await readFile(filePath);
    res.writeHead(200, {
      'content-type': MIME[extname(filePath)] ?? 'application/octet-stream',
      'cache-control': 'no-cache',
      // Enables SharedArrayBuffer for the optional high-performance path.
      'cross-origin-opener-policy': 'same-origin',
      'cross-origin-embedder-policy': 'require-corp',
    });
    res.end(body);
  } catch {
    // Single page app: fall back to index.html.
    try {
      const body = await readFile(join(DIST, 'index.html'));
      res.writeHead(200, { 'content-type': MIME['.html'] });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  }
}

async function main() {
  if (!existsSync(DIST)) {
    console.error('\n  Cubicraft has not been built yet.');
    console.error('  Run "npm run build" first, then "npm start".\n');
    process.exit(1);
  }

  const ip = lanAddress();
  const scheme = USE_HTTPS ? 'https' : 'http';
  const url = `${scheme}://${ip}:${PORT}`;

  let server;
  if (USE_HTTPS) {
    const certPath = process.env.CUBICRAFT_TLS_CERT ?? join(ROOT, 'tools', 'certs', 'lan.pem');
    const keyPath = process.env.CUBICRAFT_TLS_KEY ?? join(ROOT, 'tools', 'certs', 'lan-key.pem');
    if (!existsSync(certPath) || !existsSync(keyPath)) {
      console.error('\n  HTTPS was requested but no certificate was found.');
      console.error('  Run "bash tools/make-cert.sh" to create one, or start without --https.\n');
      process.exit(1);
    }
    server = createHttpsServer(
      { cert: readFileSync(certPath), key: readFileSync(keyPath) },
      handler,
    );
  } else {
    server = createServer(handler);
  }

  async function handler(req, res) {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    try {
      if (USE_PAIR_RELAY && url.pathname.startsWith('/pair/')) {
        await handlePairRelay(req, res, url);
        return;
      }
      await serveStatic(req, res, url);
    } catch (error) {
      console.error('[launcher]', error);
      res.writeHead(500).end('server error');
    }
  }

  server.listen(PORT, '0.0.0.0', async () => {
    console.log('');
    console.log('  ╭──────────────────────────────────────────────╮');
    console.log('  │            C U B I C R A F T                 │');
    console.log('  ╰──────────────────────────────────────────────╯');
    console.log('');
    console.log(`  Open this on this laptop:   ${url}`);
    console.log(`  Other laptops on the Wi-Fi: ${url}`);
    console.log('');
    console.log(`  Pairing relay: ${USE_PAIR_RELAY ? 'ON (one-click join)' : 'off (use the QR code in the game)'}`);
    console.log(`  Stop with Ctrl+C.`);
    console.log('');

    try {
      const QRCode = (await import('qrcode')).default;
      const terminal = await QRCode.toString(url, { type: 'terminal', small: true });
      console.log(terminal);
    } catch {
      // The QR is a convenience; the printed URL is the fallback.
    }

    if (process.platform === 'darwin') {
      console.log('  Tip: if another laptop cannot connect, macOS may have blocked Node.');
      console.log('  Open System Settings → Network → Firewall → allow incoming connections for Node.');
      console.log('  Tip: keep this laptop awake with "caffeinate -i -m -s" if it sleeps.\n');
    } else if (process.platform === 'win32') {
      console.log('  Tip: if another laptop cannot connect, allow Node through Windows Defender');
      console.log('  Firewall on Private networks only.\n');
    }
  });
}

main().catch((error) => {
  console.error('[launcher]', error);
  process.exit(1);
});
