/**
 * Smithing recipes — the netherite upgrade and armour trims.
 *
 * A smithing recipe consumes three ingredients: the template, the base item
 * and the addition. The trim recipes keep the base armour as the result and
 * carry the trim in the template ingredient.
 */

import type { RegisteredRecipe } from '../registries';
import { smithing } from './base';

const UPGRADE_TEMPLATE = 'netherite_upgrade_smithing_template';

const TOOL_KINDS = ['sword', 'pickaxe', 'axe', 'shovel', 'hoe'] as const;

const ARMOUR_SLOTS = ['helmet', 'chestplate', 'leggings', 'boots'] as const;

/** Diamond gear becomes netherite gear on the smithing table. */
export const NETHERITE_UPGRADE_RECIPES: RegisteredRecipe[] = [
  ...TOOL_KINDS.map((kind) =>
    smithing(
      `smith_netherite_${kind}`,
      UPGRADE_TEMPLATE,
      `diamond_${kind}`,
      'netherite_ingot',
      `netherite_${kind}`,
      1,
      ['smithing', 'netherite'],
    ),
  ),
  ...ARMOUR_SLOTS.map((slot) =>
    smithing(
      `smith_netherite_${slot}`,
      UPGRADE_TEMPLATE,
      `diamond_${slot}`,
      'netherite_ingot',
      `netherite_${slot}`,
      1,
      ['smithing', 'netherite'],
    ),
  ),
];

/** The trim templates that can be applied to a piece of armour. */
const TRIM_TEMPLATES = [
  'white_trim_smithing_template',
  'orange_trim_smithing_template',
  'magenta_trim_smithing_template',
  'light_blue_trim_smithing_template',
  'yellow_trim_smithing_template',
  'lime_trim_smithing_template',
  'pink_trim_smithing_template',
  'gray_trim_smithing_template',
  'light_gray_trim_smithing_template',
  'cyan_trim_smithing_template',
  'purple_trim_smithing_template',
  'blue_trim_smithing_template',
  'brown_trim_smithing_template',
  'green_trim_smithing_template',
  'red_trim_smithing_template',
  'black_trim_smithing_template',
  'sentry_trim_smithing_template',
  'vex_trim_smithing_template',
  'snout_trim_smithing_template',
  'tide_trim_smithing_template',
];

/** The armour sets a trim can be applied to. */
const TRIMMATABLE = ['iron'];

/** One trim recipe per armour piece and trim template. */
export const TRIM_RECIPES: RegisteredRecipe[] = TRIMMATABLE.flatMap((prefix) =>
  ARMOUR_SLOTS.flatMap((slot) =>
    TRIM_TEMPLATES.map((template) =>
      smithing(
        `smith_trim_${prefix}_${slot}_${template}`,
        template,
        `${prefix}_${slot}`,
        'iron_ingot',
        `${prefix}_${slot}`,
        1,
        ['smithing', 'trim'],
      ),
    ),
  ),
);
