/**
 * Cubicraft — shared core types.
 *
 * These contracts are the seam between subsystems. Everything else in the
 * project imports from here so that engine, content, worldgen, net and UI
 * can be developed and changed independently.
 */

// ---------------------------------------------------------------------------
// World geometry
// ---------------------------------------------------------------------------

/** Horizontal chunk footprint. */
export const CHUNK_X = 16;
export const CHUNK_Z = 16;
/** Vertical chunk height in blocks. */
export const CHUNK_Y = 384;
/** Section (sub-chunk) edge length. */
export const SECTION_Y = 16;
/** Section (sub-chunk) edge length on the horizontal axes. */
export const SECTION_Z = 16;
/** Number of sections per chunk column. */
export const SECTION_COUNT = CHUNK_Y / SECTION_Y; // 24
/** Lowest world Y (inclusive). */
export const WORLD_MIN_Y = -64;
/** Highest world Y (exclusive). */
export const WORLD_MAX_Y = WORLD_MIN_Y + CHUNK_Y; // 320
/** Blocks per section. */
export const SECTION_VOLUME = CHUNK_X * SECTION_Y * SECTION_Z; // 4096

// ---------------------------------------------------------------------------
// Positions
// ---------------------------------------------------------------------------

/** Integer block coordinate. */
export interface BlockPos {
  x: number;
  y: number;
  z: number;
}

/** Chunk coordinate (column index). */
export interface ChunkPos {
  cx: number;
  cz: number;
}

/** Floating point world position. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export function blockKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

export function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

/** Tool classes used by the mining ladder. */
export type ToolKind =
  | 'none'
  | 'pickaxe'
  | 'axe'
  | 'shovel'
  | 'hoe'
  | 'sword'
  | 'shears'
  | 'mace'
  | 'spear';

/** Mining levels follow the tool tier ladder: 0 wood .. 4 netherite. */
export type MiningLevel = 0 | 1 | 2 | 3 | 4;

/** How a block behaves when it drops itself. */
export interface DropTable {
  /** Item id dropped when broken. */
  item: string;
  /** Minimum count. */
  min: number;
  /** Maximum count (inclusive). */
  max: number;
  /** Only drops when the correct tool is used. */
  requiresTool?: boolean;
  /** Requires silk touch to drop the block itself. */
  silkTouch?: boolean;
  /** Only drops when the block is mined by a tool of this kind. */
  tool?: ToolKind;
  /** Fortune increases the count by this many per level. */
  fortuneMax?: number;
  /** Probability of this drop happening at all (default 1). */
  chance?: number;
}

/** How a block renders. */
export type RenderGroup = 'opaque' | 'cutout' | 'translucent' | 'cross' | 'none';

/** Axis-aligned collision shape of a block. */
export type BlockShape = 'cube' | 'slab' | 'slabTop' | 'stairs' | 'fence' | 'pane' | 'plant' | 'fluid' | 'empty';

/** Named behaviour hooks resolved by the engine, never raw functions. */
export type BlockHook =
  | 'onPlace'
  | 'onBreak'
  | 'onInteract'
  | 'onNeighborUpdate'
  | 'onTick'
  | 'onRandomTick'
  | 'onEntityStep'
  | 'onLand'
  | 'onPowered'
  | 'onPoweredOff';

/** The canonical block record. */
export interface BlockDef {
  id: string;
  displayName: string;
  family: string;
  params: Record<string, unknown>;
  hardness: number;
  blastResistance: number;
  lightEmission: number;
  tool: ToolKind;
  requiresToolTier: MiningLevel;
  correctToolDrops: boolean;
  flammable: boolean;
  transparent: boolean;
  liquid: boolean;
  gravity: boolean;
  slabShape: boolean;
  waterloggable: boolean;
  axis: 'y' | 'x' | 'z';
  shape: BlockShape;
  render: RenderGroup;
  /**
   * Texture names for [top, side, bottom, front]. The name is resolved to a
   * texture-array layer index by the atlas builder using the canonical
   * `TEXTURE_NAMES` ordering, so content never hard-codes layer numbers.
   */
  textures: { top: string; side: string; bottom: string; front: string };
  drops: DropTable[];
  hooks: Partial<Record<BlockHook, string>>;
  /** Tag membership, e.g. 'planks', 'logs', 'ores', 'mineable/pickaxe'. */
  tags: string[];
  /** Whether the block can be walked through (plants, fluids). */
  passable?: boolean;
}

/** The canonical item record. */
export interface ItemDef {
  id: string;
  displayName: string;
  /** Items that are not placeable blocks. */
  stackSize: number;
  /** Tool kind when equippable. */
  tool?: ToolKind;
  /** Mining level of the tool. */
  tier?: MiningLevel;
  /** Durability for tools/armour. */
  durability?: number;
  /** Attack damage. */
  damage?: number;
  /** Armour slot. */
  armorSlot?: 'head' | 'chest' | 'legs' | 'feet' | 'body';
  /** Defence points per slot. */
  defense?: number;
  /** Hunger restored when eaten. */
  food?: number;
  /** Saturation modifier. */
  saturation?: number;
  /** Item id of the block this item places, if any. */
  places?: string;
  tags: string[];
  /** Renders as a flat sprite in the inventory. */
  icon: string;
}
/** Mob categories drive spawn rules and hostile behaviour. */
export type MobCategory = 'passive' | 'neutral' | 'hostile' | 'boss' | 'utility';

/** AI archetypes — ~12 implementations cover 88 mobs. */
export type MobBehaviour =
  | 'wander'
  | 'flee'
  | 'chase'
  | 'ranged'
  | 'swarm'
  | 'jumper'
  | 'flyer'
  | 'swimmer'
  | 'digger'
  | 'neutral'
  | 'villager'
  | 'boss';

export interface MobDef {
  id: string;
  displayName: string;
  category: MobCategory;
  behaviour: MobBehaviour;
  health: number;
  damage: number;
  armour: number;
  knockbackResistance: number;
  /** Height and width in blocks. */
  size: { w: number; h: number };
  /** Whether it burns in daylight. */
  burnsInDaylight: boolean;
  /** Whether it can be ridden. */
  rideable?: boolean;
  /** Spawn rules. */
  spawn: {
    biomes: string[];
    lightLevel: [number, number];
    /** Required ground block family, or 'any'. */
    ground: string;
    group: [number, number];
    /** Spawns only underground / in water / in the sky. */
    dimension: 'overworld' | 'nether' | 'end';
  };
  drops: DropTable[];
  tags: string[];
  /** Texture layer indices for the boxy rig parts. */
  texture: number;
}

/** Enchantment record. */
export interface EnchantmentDef {
  id: string;
  displayName: string;
  maxLevel: number;
  /** Item tags this enchantment can be applied to. */
  appliesTo: string[];
  /** Enchantment tag conflicts. */
  conflicts: string[];
  /** Weight used by the enchanting table. */
  weight: number;
  /** Whether the enchanting table can produce it. */
  fromTable: boolean;
  /** Tag membership, e.g. 'armor', 'weapon', 'mining'. */
  tags?: string[];
}

export interface BiomeDef {
  id: string;
  displayName: string;
  dimension: 'overworld' | 'nether' | 'end';
  temperature: number;
  humidity: number;
  downfall: number;
  /** Surface block family used by the generator. */
  surface: string;
  filler: string;
  /** Vegetation density weight. */
  vegetation: number;
  /** Mob spawn weighting. */
  mobs: Record<string, number>;
  /** Ambient sound/colour key. */
  sky: 'day' | 'night' | 'dusk';
  /** Tag membership, e.g. 'overworld', 'forest', 'nether'. */
  tags?: string[];
}

export type RecipeShape = 'shaped' | 'shapeless' | 'smelting' | 'blasting' | 'smoking' | 'smithing' | 'stonecutting';

export interface RecipeDef {
  id: string;
  shape: RecipeShape;
  /** Shaped recipes: rows of ingredient ids (or tags with '#'). */
  pattern?: string[];
  /** Shapeless recipes: ingredient ids. */
  ingredients?: string[];
  /** Result item id. */
  result: string;
  count: number;
  /** Cook time in ticks for smelting-family recipes. */
  cookTime?: number;
  /** Tag membership, e.g. 'shaped', 'tools'. */
  tags?: string[];
}

// ---------------------------------------------------------------------------
// Game modes
// ---------------------------------------------------------------------------

export type GameMode = 'survival' | 'creative' | 'adventure' | 'spectator' | 'hardcore' | 'sandbox';

/** Capability set consulted by every system rather than branching code paths. */
export interface ModeCapabilities {
  canBreak: boolean;
  canPlace: boolean;
  takeDamage: boolean;
  canFly: boolean;
  canCraft: boolean;
  canEat: boolean;
  hasHunger: boolean;
  hasInventory: boolean;
  mobDamage: boolean;
  instantBreak: boolean;
  onDeath: 'respawn' | 'permadeath';
}

export const MODE_CAPABILITIES: Record<GameMode, ModeCapabilities> = {
  survival: {
    canBreak: true, canPlace: true, takeDamage: true, canFly: false, canCraft: true,
    canEat: true, hasHunger: true, hasInventory: true, mobDamage: true, instantBreak: false,
    onDeath: 'respawn',
  },
  hardcore: {
    canBreak: true, canPlace: true, takeDamage: true, canFly: false, canCraft: true,
    canEat: true, hasHunger: true, hasInventory: true, mobDamage: true, instantBreak: false,
    onDeath: 'permadeath',
  },
  creative: {
    canBreak: true, canPlace: true, takeDamage: false, canFly: true, canCraft: true,
    canEat: true, hasHunger: false, hasInventory: true, mobDamage: false, instantBreak: true,
    onDeath: 'respawn',
  },
  adventure: {
    canBreak: true, canPlace: true, takeDamage: true, canFly: true, canCraft: true,
    canEat: true, hasHunger: false, hasInventory: true, mobDamage: true, instantBreak: false,
    onDeath: 'respawn',
  },
  spectator: {
    canBreak: false, canPlace: false, takeDamage: false, canFly: true, canCraft: false,
    canEat: false, hasHunger: false, hasInventory: false, mobDamage: false, instantBreak: false,
    onDeath: 'respawn',
  },
  sandbox: {
    canBreak: true, canPlace: true, takeDamage: false, canFly: true, canCraft: true,
    canEat: true, hasHunger: false, hasInventory: true, mobDamage: false, instantBreak: true,
    onDeath: 'respawn',
  },
};

// ---------------------------------------------------------------------------
// Player / entity state
// ---------------------------------------------------------------------------

export interface PlayerState {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  health: number;
  hunger: number;
  saturation: number;
  xp: number;
  level: number;
  onGround: boolean;
  flying: boolean;
  sneaking: boolean;
  sprinting: boolean;
  mode: GameMode;
  /** Avatar description sent over the wire (small, not a texture). */
  avatar: AvatarSpec;
  /** Dimension the player is in. */
  dimension: string;
}

export interface AvatarSpec {
  kit: string;
  skinTone: number;
  hair: number;
  hairColor: number;
  name: string;
  number: number;
}

// ---------------------------------------------------------------------------
// Networking
// ---------------------------------------------------------------------------

export const PROTOCOL_VERSION = 3;

export interface PlayerAppearance {
  id: string;
  name: string;
  avatar: AvatarSpec;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}
