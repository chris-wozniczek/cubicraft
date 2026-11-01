/**
 * Content self-check.
 *
 * Diagnostic script: registers the whole content set and prints the counts
 * and every validation issue. It is not imported by the game, so it never
 * runs at boot.
 *
 *   npx vite-node src/content/__selfcheck.ts
 */

import { contentCounts, initContent, validateContent, blocks, biomes } from './index';
import { ALL_BLOCKS } from './blocks/index';
import { ALL_ITEMS } from './items/index';
import { ALL_MOBS } from './mobs/index';
import { PASSIVE_MOBS, NEUTRAL_MOBS, HOSTILE_MOBS, BOSS_MOBS } from './mobs/index';
import { BLOCK_IDS as WORLDGEN_BLOCK_IDS } from '../worldgen/terrain';
import { BIOMES } from '../worldgen/biomes';

function byFamily(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const block of ALL_BLOCKS) {
    counts.set(block.family, (counts.get(block.family) ?? 0) + 1);
  }
  return counts;
}

export function runSelfCheck(): void {
  initContent();
  // Idempotency check: a second call must not throw or change the counts.
  initContent();

  const counts = contentCounts();
  const report = validateContent();

  console.log('--- Cubicraft content self-check ---');
  console.log(`blocks        ${counts.blocks}`);
  console.log(`items         ${counts.items}`);
  console.log(`mobs          ${counts.mobs} (passive ${PASSIVE_MOBS.length}, neutral ${NEUTRAL_MOBS.length}, hostile ${HOSTILE_MOBS.length}, boss ${BOSS_MOBS.length})`);
  console.log(`biomes        ${counts.biomes}`);
  console.log(`enchantments  ${counts.enchantments}`);
  console.log(`recipes       ${counts.recipes}`);
  console.log(`textures      ${counts.textures}`);
  console.log(`mob list      ${ALL_MOBS.length}`);
  console.log(`item list     ${ALL_ITEMS.length}`);
  console.log(`block list    ${ALL_BLOCKS.length}`);

  console.log('--- block families ---');
  for (const [family, count] of [...byFamily()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${family.padEnd(14)} ${count}`);
  }

  console.log(`--- validation (${report.errors.length} errors, ${report.warnings.length} warnings) ---`);
  for (const issue of report.errors) console.log(`[ERROR] ${issue.registry}: ${issue.message}`);
  for (const issue of report.warnings) console.log(`[WARN ] ${issue.registry}: ${issue.message}`);
  if (report.ok) console.log('no errors');

  // Integration check: every block and biome the world generator emits must
  // exist in the content registry.
  const missingBlocks = Object.keys(WORLDGEN_BLOCK_IDS).filter((name) => !blocks.has(name));
  const missingBiomes = BIOMES.map((b) => b.id).filter((id) => !biomes.has(id));
  console.log(`--- worldgen cross-check ---`);
  console.log(`missing generator blocks: ${missingBlocks.length ? missingBlocks.join(', ') : 'none'}`);
  console.log(`missing generator biomes: ${missingBiomes.length ? missingBiomes.join(', ') : 'none'}`);
}

runSelfCheck();
