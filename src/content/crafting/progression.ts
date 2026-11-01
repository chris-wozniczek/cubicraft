/**
 * Core progression recipes: wood, planks, sticks, stations and the blocks
 * that unlock the rest of the game.
 */

import type { RegisteredRecipe } from '../registries';
import { WOOD_SPECS } from '../blocks/woodFamily';
import { shaped, shapeless } from './base';

/** Every log, stem, hyphae and bamboo block that turns into planks. */
function plankRecipes(): RegisteredRecipe[] {
  const out: RegisteredRecipe[] = [];
  for (const wood of WOOD_SPECS) {
    if (wood.kind === 'bamboo') {
      out.push(
        shaped(`planks_from_bamboo_block`, [['bamboo_block']], 'bamboo_planks', 4, ['planks']),
        shaped(`planks_from_stripped_bamboo_block`, [['stripped_bamboo_block']], 'bamboo_planks', 4, ['planks']),
      );
      continue;
    }
    if (wood.kind === 'nether') {
      out.push(
        shaped(`planks_from_${wood.id}_stem`, [[`${wood.id}_stem`]], `${wood.id}_planks`, 4, ['planks']),
        shaped(`planks_from_stripped_${wood.id}_stem`, [[`stripped_${wood.id}_stem`]], `${wood.id}_planks`, 4, ['planks']),
        shaped(`planks_from_${wood.id}_hyphae`, [[`${wood.id}_hyphae`]], `${wood.id}_planks`, 4, ['planks']),
        shaped(`planks_from_stripped_${wood.id}_hyphae`, [[`stripped_${wood.id}_hyphae`]], `${wood.id}_planks`, 4, ['planks']),
      );
      continue;
    }
    out.push(
      shaped(`planks_from_${wood.id}_log`, [[`${wood.id}_log`]], `${wood.id}_planks`, 4, ['planks']),
      shaped(`planks_from_stripped_${wood.id}_log`, [[`stripped_${wood.id}_log`]], `${wood.id}_planks`, 4, ['planks']),
    );
  }
  return out;
}

/** Sticks from planks, for every wood. */
function stickRecipes(): RegisteredRecipe[] {
  return WOOD_SPECS.map((wood) =>
    shaped(
      `sticks_from_${wood.id}_planks`,
      [[`${wood.id}_planks`, `${wood.id}_planks`]],
      'stick',
      4,
      ['sticks'],
    ),
  );
}

/** Boats for every wood. */
function boatRecipes(): RegisteredRecipe[] {
  const out: RegisteredRecipe[] = [];
  for (const wood of WOOD_SPECS) {
    out.push(
      shaped(
        `${wood.id}_boat_recipe`,
        [
          [`${wood.id}_planks`, `${wood.id}_planks`],
          [`${wood.id}_planks`, `${wood.id}_planks`],
          [null, 'stick'],
        ],
        `${wood.id}_boat`,
        1,
        ['boat'],
      ),
      shaped(
        `${wood.id}_chest_boat_recipe`,
        [
          ['chest', null, null],
          [`${wood.id}_planks`, `${wood.id}_planks`],
          [null, 'stick'],
        ],
        `${wood.id}_chest_boat`,
        1,
        ['boat'],
      ),
    );
  }
  return out;
}

/** The stations, containers and utility blocks. */
const STATION_RECIPES: RegisteredRecipe[] = [
  shaped('crafting_table', [['oak_planks', 'oak_planks'], ['oak_planks', 'oak_planks']], 'crafting_table', 1, ['workbench']),
  shaped('chest', [['oak_planks', 'oak_planks', 'oak_planks'], ['oak_planks', null, 'oak_planks'], ['oak_planks', 'oak_planks', 'oak_planks']], 'chest', 1, ['container']),
  shaped('trapped_chest', [['oak_planks', 'oak_planks', 'oak_planks'], ['oak_planks', 'tripwire_hook', 'oak_planks'], ['oak_planks', 'oak_planks', 'oak_planks']], 'trapped_chest', 1, ['container', 'redstone']),
  shaped('ender_chest', [['obsidian', 'obsidian', 'obsidian'], ['obsidian', 'ender_eye', 'obsidian'], ['obsidian', 'obsidian', 'obsidian']], 'ender_chest', 1, ['container']),
  shaped('furnace', [['cobblestone', 'cobblestone', 'cobblestone'], ['cobblestone', null, 'cobblestone'], ['cobblestone', 'cobblestone', 'cobblestone']], 'furnace', 1, ['furnace']),
  shaped('blast_furnace', [['iron_ingot', 'iron_ingot', 'iron_ingot'], ['iron_ingot', 'furnace', 'iron_ingot'], ['smooth_stone', 'smooth_stone', 'smooth_stone']], 'blast_furnace', 1, ['furnace']),
  shaped('smoker', [['smooth_stone', 'smooth_stone', 'smooth_stone'], ['smooth_stone', 'furnace', 'smooth_stone'], ['oak_planks', 'oak_planks', 'oak_planks']], 'smoker', 1, ['furnace']),
  shaped('torch', [['coal', 'stick']], 'torch', 4, ['light']),
  shaped('soul_torch', [['charcoal', 'stick']], 'soul_torch', 4, ['light']),
  shaped('lever', [['stick', 'cobblestone']], 'lever', 1, ['redstone']),
  shaped('torch_from_charcoal', [['charcoal', 'stick']], 'torch', 4, ['light']),
  shaped('bookshelf', [['oak_planks', 'oak_planks', 'oak_planks'], ['book', 'book', 'book'], ['oak_planks', 'oak_planks', 'oak_planks']], 'bookshelf', 1, ['furniture']),
  shaped('book', [['paper', 'paper', 'paper'], ['leather', null, null]], 'book', 1, ['book']),
  shaped('writable_book', [['paper', 'paper', 'paper'], ['leather', null, null]], 'writable_book', 1, ['book']),
  shaped('bread', [['wheat', 'wheat', 'wheat']], 'bread', 1, ['food']),
  shaped('cookie', [['wheat', 'wheat'], ['sugar', 'sugar']], 'cookie', 8, ['food']),
  shaped('cake', [['milk_bucket', 'milk_bucket', 'milk_bucket'], ['sugar', 'egg', 'sugar'], ['wheat', 'wheat', 'wheat']], 'cake', 1, ['food']),
  shapeless('sugar_from_sugar_cane', ['sugar_cane'], 'sugar', 1, ['food']),
  shaped('paper', [['sugar_cane', 'sugar_cane', 'sugar_cane']], 'paper', 3, ['material']),
  shapeless('sugar_from_honey_bottle', ['honey_bottle', 'sugar_cane'], 'sugar', 2, ['food']),
  shaped('loom', [['string', 'string'], ['oak_planks', 'oak_planks']], 'loom', 1, ['workbench']),
  shaped('barrel', [['oak_planks', 'oak_planks', 'oak_planks'], ['oak_slab', 'oak_slab', 'oak_slab'], ['oak_planks', 'oak_planks', 'oak_planks']], 'barrel', 1, ['container']),
  shaped('composter', [['oak_slab', 'oak_slab', 'oak_slab'], ['oak_slab', null, 'oak_slab'], ['oak_slab', 'oak_slab', 'oak_slab']], 'composter', 1, ['utility']),
  shaped('lectern', [['oak_planks', 'oak_planks'], ['oak_planks', 'bookshelf'], [null, 'oak_planks']], 'lectern', 1, ['workbench']),
  shaped('smithing_table', [['oak_planks', 'oak_planks'], ['oak_planks', 'oak_planks'], ['iron_ingot', 'iron_ingot']], 'smithing_table', 1, ['workbench']),
  shaped('cartography_table', [['paper', 'paper'], ['oak_planks', 'oak_planks']], 'cartography_table', 1, ['workbench']),
  shaped('fletching_table', [['flint', 'flint'], ['oak_planks', 'oak_planks']], 'fletching_table', 1, ['workbench']),
  shaped('stonecutter', [['iron_ingot'], ['stone', 'stone', 'stone']], 'stonecutter', 1, ['workbench']),
  shaped('grindstone', [['stick', 'stick'], ['oak_planks', 'stone_slab', 'oak_planks']], 'grindstone', 1, ['workbench']),
  shaped('brewing_stand', [['blaze_rod', null, null], ['nether_wart', null, null]], 'brewing_stand', 1, ['utility']),
  shaped('cauldron', [['iron_ingot', 'iron_ingot', 'iron_ingot'], ['iron_ingot', null, 'iron_ingot'], ['iron_ingot', 'iron_ingot', 'iron_ingot']], 'cauldron', 1, ['utility']),
  shaped('enchanting_table', [['book', null, 'diamond'], ['diamond', 'obsidian', 'diamond'], ['obsidian', 'obsidian', 'obsidian']], 'enchanting_table', 1, ['workbench']),
  // Portals are unbreakable and undroppable, so they have to be crafted.
  shaped('nether_portal', [['obsidian', 'obsidian'], ['obsidian', 'flint']], 'nether_portal', 1, ['portal']),
  shaped('end_portal', [['end_stone', 'end_stone'], ['end_stone', 'ender_pearl']], 'end_portal', 1, ['portal']),
  shaped('anvil', [['iron_block', 'iron_block', 'iron_block'], ['iron_ingot', 'iron_ingot', 'iron_ingot']], 'anvil', 1, ['utility']),
  shaped('hopper', [['iron_ingot', 'iron_ingot', 'iron_ingot'], ['iron_ingot', 'chest', 'iron_ingot'], [null, 'iron_ingot', null]], 'hopper', 1, ['redstone']),
  shaped('dispenser', [['cobblestone', 'cobblestone', 'cobblestone'], ['cobblestone', 'bow', 'cobblestone'], ['cobblestone', 'redstone', 'cobblestone']], 'dispenser', 1, ['redstone']),
  shaped('dropper', [['cobblestone', 'cobblestone', 'cobblestone'], ['cobblestone', 'redstone', 'cobblestone'], ['cobblestone', 'cobblestone', 'cobblestone']], 'dropper', 1, ['redstone']),
  shaped('observer', [['cobblestone', 'cobblestone', 'cobblestone'], ['cobblestone', 'redstone', 'cobblestone'], ['cobblestone', 'cobblestone', 'cobblestone']], 'observer', 1, ['redstone']),
  shaped('piston', [['oak_planks', 'oak_planks', 'oak_planks'], ['cobblestone', 'cobblestone', 'cobblestone'], ['iron_ingot', 'redstone', 'oak_planks']], 'piston', 1, ['redstone']),
  shaped('sticky_piston', [['oak_planks', 'oak_planks', 'oak_planks'], ['cobblestone', 'cobblestone', 'cobblestone'], ['iron_ingot', 'slimeball', 'oak_planks']], 'sticky_piston', 1, ['redstone']),
  shaped('tnt', [['gunpowder', 'gunpowder', 'gunpowder', 'gunpowder', 'gunpowder'], ['sand', 'sand', 'sand', 'sand']], 'tnt', 1, ['utility']),
  shaped('note_block', [['oak_planks', 'oak_planks', 'oak_planks'], ['oak_planks', 'redstone', 'oak_planks'], ['oak_planks', 'oak_planks', 'oak_planks']], 'note_block', 1, ['redstone']),
  shaped('jukebox', [['oak_planks', 'oak_planks', 'oak_planks'], ['oak_planks', 'diamond', 'oak_planks'], ['oak_planks', 'oak_planks', 'oak_planks']], 'jukebox', 1, ['furniture']),
  shaped('ladder', [['stick', 'stick', 'stick'], ['stick', 'stick', 'stick']], 'ladder', 3, ['utility']),
  shaped('scaffolding', [['bamboo_block', 'bamboo_block', 'bamboo_block'], ['bamboo_block', 'stick', 'bamboo_block'], ['bamboo_block', 'bamboo_block', 'bamboo_block']], 'scaffolding', 1, ['utility']),
  shaped('iron_bars', [['iron_ingot', 'iron_ingot', 'iron_ingot'], ['iron_ingot', 'stick', 'iron_ingot']], 'iron_bars', 16, ['utility']),
  shaped('chain', [['iron_ingot', null, 'iron_nugget'], ['iron_nugget', 'iron_ingot', null]], 'chain', 1, ['utility']),
  shaped('candle', [['string', 'honeycomb']], 'candle', 1, ['light']),
  shaped('lantern', [['iron_nugget', 'iron_nugget', 'iron_nugget'], ['iron_nugget', 'torch', 'iron_nugget'], ['iron_nugget', 'iron_nugget', 'iron_nugget']], 'lantern', 1, ['light']),
  shaped('soul_lantern', [['iron_nugget', 'iron_nugget', 'iron_nugget'], ['iron_nugget', 'soul_torch', 'iron_nugget'], ['iron_nugget', 'iron_nugget', 'iron_nugget']], 'soul_lantern', 1, ['light']),
  shaped('campfire', [['stick', 'coal', 'stick'], ['stick', 'oak_planks', 'stick']], 'campfire', 1, ['light']),
  shaped('soul_campfire', [['stick', 'charcoal', 'stick'], ['stick', 'oak_planks', 'stick']], 'soul_campfire', 1, ['light']),
  shaped('bricks', [['clay', 'clay', 'clay', 'clay']], 'bricks', 1, ['building']),
  shaped('nether_bricks', [['nether_brick', 'nether_brick', 'nether_brick', 'nether_brick']], 'nether_bricks', 1, ['building']),
  shaped('clay_block', [['clay_ball', 'clay_ball', 'clay_ball', 'clay_ball']], 'clay', 1, ['building']),
  shaped('quartz_block', [['nether_quartz', 'nether_quartz', 'nether_quartz', 'nether_quartz']], 'quartz_block', 1, ['building']),
  shaped('glowstone', [['glowstone_dust', 'glowstone_dust', 'glowstone_dust', 'glowstone_dust']], 'glowstone', 1, ['light']),
  shaped('sea_lantern', [['prismarine_shard', 'prismarine_shard', 'prismarine_shard', 'prismarine_shard'], ['glowstone_dust', 'glowstone_dust', 'glowstone_dust', 'glowstone_dust']], 'sea_lantern', 1, ['light']),
  shaped('netherite_block', [['netherite_ingot', 'netherite_ingot', 'netherite_ingot', 'netherite_ingot']], 'netherite_block', 1, ['building']),
  shaped('iron_block', [['iron_ingot', 'iron_ingot', 'iron_ingot', 'iron_ingot']], 'iron_block', 1, ['building']),
  shaped('gold_block', [['gold_ingot', 'gold_ingot', 'gold_ingot', 'gold_ingot']], 'gold_block', 1, ['building']),
  shaped('diamond_block', [['diamond', 'diamond', 'diamond', 'diamond']], 'diamond_block', 1, ['building']),
  shaped('emerald_block', [['emerald', 'emerald', 'emerald', 'emerald']], 'emerald_block', 1, ['building']),
  shaped('coal_block', [['coal', 'coal', 'coal', 'coal']], 'coal_block', 1, ['building']),
  shaped('lapis_block', [['lapis_lazuli', 'lapis_lazuli', 'lapis_lazuli', 'lapis_lazuli']], 'lapis_block', 1, ['building']),
  shaped('amethyst_block', [['amethyst_shard', 'amethyst_shard', 'amethyst_shard', 'amethyst_shard']], 'amethyst_block', 1, ['building']),
  shaped('dried_kelp_block', [['dried_kelp', 'dried_kelp', 'dried_kelp', 'dried_kelp']], 'dried_kelp_block', 1, ['building']),
  shaped('slime_block', [['slimeball', 'slimeball', 'slimeball', 'slimeball']], 'slime_block', 1, ['building']),
  shaped('honey_block', [['honey_bottle', 'honey_bottle', 'honey_bottle', 'honey_bottle']], 'honey_block', 1, ['building']),
  shaped('hay_block', [['wheat', 'wheat', 'wheat', 'wheat']], 'hay_block', 1, ['building']),
  shaped('bow', [[null, 'stick', null], ['stick', 'string', 'stick'], [null, 'string', null]], 'bow', 1, ['weapon']),
  shaped('arrow', [['flint', 'stick', 'feather']], 'arrow', 4, ['ammunition']),
  shaped('crossbow', [['stick', 'iron_ingot', 'string'], ['tripwire_hook', 'stick', 'tripwire_hook']], 'crossbow', 1, ['weapon']),
  shaped('shield', [['oak_planks', 'iron_ingot', 'oak_planks']], 'shield', 1, ['equipment']),
  shaped('firework_rocket', [['paper', 'gunpowder']], 'firework_rocket', 3, ['firework']),
  shaped('firework_star', [['gunpowder', 'white_dye']], 'firework_star', 1, ['firework']),
  shapeless('fermented_spider_eye', ['spider_eye', 'spider_eye', 'spider_eye', 'brown_mushroom', 'sugar'], 'fermented_spider_eye', 1, ['potion']),
  shapeless('suspicious_stew', ['brown_mushroom', 'red_mushroom', 'blue_mushroom', 'bowl'], 'suspicious_stew', 1, ['food']),
  shaped('banner', [['white_wool', 'white_wool'], ['stick', 'stick']], 'white_banner', 1, ['banner']),
];

/** The full progression recipe list. */
export const PROGRESSION_RECIPES: RegisteredRecipe[] = [
  ...plankRecipes(),
  ...stickRecipes(),
  ...boatRecipes(),
  ...STATION_RECIPES,
];
