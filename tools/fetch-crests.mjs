#!/usr/bin/env node
/**
 * Optional club crest downloader.
 *
 * The game ships with original, procedurally drawn crest-style artwork so it
 * stays shareable. If the family would rather see the real badges, run this
 * once and it fetches freely-licensed images into public/assets/crests with
 * an attribution file.
 *
 * Club crests are trademarks: this is intended for private family use.
 *
 *   node tools/fetch-crests.mjs
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT = join(ROOT, 'public', 'assets', 'crests');

/**
 * Freely-licensed crest images from Wikimedia Commons.
 * Update these URLs if a file moves.
 */
const CRESTS = [
  {
    id: 'rm',
    name: 'Real Madrid',
    url: 'https://upload.wikimedia.org/wikipedia/en/thumb/5/56/Real_Madrid_CF.svg/240px-Real_Madrid_CF.svg.png',
    licence: 'Wikimedia Commons — non-free logo, for private family use only',
  },
  {
    id: 'fcb',
    name: 'FC Barcelona',
    url: 'https://upload.wikimedia.org/wikipedia/en/thumb/4/49/FC_Barcelona_crest.svg/240px-FC_Barcelona_crest.svg.png',
    licence: 'Wikimedia Commons — non-free logo, for private family use only',
  },
];

async function main() {
  await mkdir(OUT, { recursive: true });
  const credits = ['# Crest image credits', '', 'These images are club trademarks.', 'They are included for private family use only.', ''];

  for (const crest of CRESTS) {
    process.stdout.write(`  fetching ${crest.name}… `);
    try {
      const response = await fetch(crest.url, {
        headers: { 'user-agent': 'Cubicraft/1.0 (family game)' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      await writeFile(join(OUT, `${crest.id}.png`), buffer);
      console.log(`saved ${crest.id}.png (${buffer.length} bytes)`);
      credits.push(`- **${crest.name}** (\`${crest.id}.png\`) — ${crest.licence}`);
      credits.push(`  Source: ${crest.url}`);
    } catch (error) {
      console.log(`skipped (${error.message})`);
      credits.push(`- **${crest.name}** — could not be fetched (${error.message}); the game uses its own crest artwork.`);
    }
  }

  await writeFile(join(OUT, 'CREDITS.md'), credits.join('\n') + '\n');
  console.log(`\nWrote ${join(OUT, 'CREDITS.md')}`);
}

main().catch((error) => {
  console.error('[fetch-crests]', error);
  process.exit(1);
});
