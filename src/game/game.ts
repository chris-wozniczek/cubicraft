/**
 * The game: the single place where the engine, the content, the renderer and
 * the UI are wired together.
 */

import * as THREE from 'three';

import { FixedLoop, TICK_MS } from '../core/loop';
import { InputManager } from '../core/input';
import { loadSettings, QUALITY_PROFILES, type Settings } from '../core/settings';
import { SeededRng } from '../core/rng';
import { CHUNK_X, CHUNK_Z, MODE_CAPABILITIES, type AvatarSpec, type GameMode } from '../core/types';
import { log } from '../core/log';

import { blocks, items, mobs, recipes, enchantments, TEXTURE_NAMES } from '../content';
import { sfx } from '../audio/sfx';
import { AIR, type BlockLookup } from '../engine/voxel/blocks';
import { BlockProfileTable, EMPTY_PROFILE, type BlockProfile } from '../engine/voxel/profiles';
import { boxesForShape } from '../engine/voxel/shapes';
import { raycastVoxel, directionFromAngles } from '../engine/voxel/raycast';
import { World } from '../engine/world/world';
import { ChunkManager } from '../engine/world/chunkManager';
import { Player } from '../engine/physics/player';
import type { CollisionWorld } from '../engine/physics/collision';

import { buildAtlas, type TextureAtlas } from '../render/atlas';
import { createTerrainMaterial, updateTerrainUniforms } from '../render/materials/terrain';
import { Sky } from '../render/sky';
import { ChunkRenderer } from '../render/chunkRenderer';
import { MobRenderer } from '../render/mobRenderer';

import { Inventory } from './inventory';
import { Survival } from './survival';
import { DayNight } from './dayNight';
import { EntityManager, type Entity } from './entities';
import { findRecipe, emptyGrid, type CraftingGrid } from './crafting';
import { MultiplayerSession, RemotePlayerRenderer } from './multiplayer';
import { CameraSystem, LaserSystem, WaypointSystem, PAINT_COLOURS, nextPaintColour } from './extras';
import { RedstoneSystem } from './redstone';
import { AvatarModel } from '../assets/avatarModel';
import { setSkinAnisotropy } from '../assets/skinGenerator';
import { WorldGenerator } from '../worldgen/generator';

import { Hud } from '../ui/hud';
import { CraftingUi } from '../ui/craftingUi';
import { EnchantUi } from '../ui/enchantUi';
import { FurnaceUi } from '../ui/furnaceUi';
import { ChestUi, CHEST_SLOTS } from '../ui/chestUi';
import type { ItemStack } from './inventory';
import { Furnaces } from './furnace';

export type CameraMode = 'first' | 'third' | 'orbit';

export interface GameOptions {
  container: HTMLElement;
  seed?: number;
  mode?: GameMode;
  name?: string;
  avatar?: AvatarSpec;
}

interface BreakState {
  x: number;
  y: number;
  z: number;
  progress: number;
  total: number;
}

const SEED = 20261101;

export class Game {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly sky = new Sky(this.scene);
  readonly chunkRenderer: ChunkRenderer;
  readonly mobRenderer = new MobRenderer();
  readonly hud: Hud;
  readonly input: InputManager;
  /** The peer-to-peer session, once the player hosts or joins a world. */
  multiplayer: MultiplayerSession | null = null;
  readonly remotePlayers = new RemotePlayerRenderer();
  readonly cameras = new CameraSystem();
  readonly lasers = new LaserSystem();
  readonly waypoints = new WaypointSystem();
  readonly redstone = new RedstoneSystem();
  /** The player's own avatar, shown in third-person view. */
  readonly avatarModel: AvatarModel;
  /** The inventory screen, open while the player is crafting. */
  craftingUi: CraftingUi | null = null;

  settings: Settings = loadSettings();
  readonly loop: FixedLoop;

  /**
   * Numeric id lookup.
   *
   * Air is always id 0, whatever order the content registry was built in —
   * the engine relies on 0 meaning "nothing here".
   */
  readonly lookup: BlockLookup;

  readonly world: World;
  readonly chunkManager: ChunkManager;
  readonly player: Player;
  readonly inventory = new Inventory();
  readonly survival = new Survival();
  readonly dayNight: DayNight;
  readonly entities: EntityManager;

  mode: GameMode;
  playerName: string;
  avatar: AvatarSpec;

  /** True while the pointer is captured and the player is driving. */
  playing = false;
  cameraMode: CameraMode = 'first';
  photoMode = false;

  private atlas: TextureAtlas;
  /** Texture name to layer index, built once. */
  private textureLayers: Map<string, number> | null = null;
  /** Block ids in numeric order; index 0 is always air. */
  private readonly blockIds: string[] = [];
  private readonly blockIndex = new Map<string, number>();
  private solidMaterial: THREE.ShaderMaterial;
  private translucentMaterial: THREE.ShaderMaterial;  private readonly highlight: THREE.LineSegments;
  private readonly breakOverlay: THREE.Mesh;
  private breakState: BreakState | null = null;
  /** The colour the paint bucket will use next. */
  private paintColour = 0;
  /** Set when a photo has been requested and the next frame should capture it. */
  private pendingCapture = false;
  /** True once the player has been dropped onto the terrain. */
  private spawned = false;
  /** Set false to stop the player being moved onto the surface. */
  spawnAtHeight = true;
  private readonly rng = new SeededRng(SEED, 'game');
  private elapsed = 0;
  private disposed = false;
  private digSfxTimer = 0;
  private lastLevel = 0;
  private dimension = 'overworld';
  private portalTimer = 0;
  private readonly furnaces = new Furnaces(recipes.all());
  private enchantUi: EnchantUi | null = null;
  private furnaceUi: FurnaceUi | null = null;
  private chestUi: ChestUi | null = null;
  /** Chest contents keyed by block position. */
  private readonly chests = new Map<string, (ItemStack | null)[]>();

  constructor(private readonly options: GameOptions) {
    this.mode = options.mode ?? 'survival';
    this.playerName = options.name ?? 'Player';
    this.dayNight = new DayNight(this.settings.timeOfDay, this.settings.dayLengthSeconds);
    this.avatar = options.avatar ?? {
      kit: 'rm25',
      skinTone: 2,
      hair: 0,
      hairColor: 0,
      name: options.name ?? 'Player',
      number: 10,
    };

    // --- Renderer ------------------------------------------------------
    this.renderer = new THREE.WebGLRenderer({
      antialias: this.settings.tier > 0,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.options.container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(this.settings.fov, window.innerWidth / window.innerHeight, 0.08, 1200);
    this.camera.position.set(0, 90, 0);

    // --- Content -------------------------------------------------------
    // Air first, so block id 0 always means "empty".
    this.blockIds = ['air'];
    for (const block of blocks.all()) {
      if (block.id !== 'air') this.blockIds.push(block.id);
    }
    this.blockIndex = new Map(this.blockIds.map((id, i) => [id, i]));
    const blockIds = this.blockIds;
    const blockIndex = this.blockIndex;
    this.lookup = {
      name: (id: number) => blockIds[id] ?? 'air',
      id: (name: string) => blockIndex.get(name) ?? 0,
      has: (name: string) => blockIndex.has(name),
      get count() {
        return blockIds.length;
      },
    };

    const profiles = this.buildProfiles();
    this.world = new World(profiles, this.lookup);
    this.atlas = buildAtlas(TEXTURE_NAMES);

    // The texture array needs one layer per texture. Report the limit so a
    // mismatch is obvious rather than a silently black world.
    const gl = this.renderer.getContext();
    const maxLayers = (gl as WebGL2RenderingContext).getParameter(0x88ff) as number;
    log.info(
      `[atlas] ${TEXTURE_NAMES.length} textures, ${this.atlas.names.length} layers, GPU allows ${maxLayers}`,
    );
    if (this.atlas.names.length > maxLayers) {
      log.warn(`[atlas] texture count exceeds the GPU limit of ${maxLayers}`);
    }

    this.solidMaterial = createTerrainMaterial({ atlas: this.atlas.texture, alphaTest: true });
    this.translucentMaterial = createTerrainMaterial({
      atlas: this.atlas.texture,
      transparent: true,
      alphaTest: false,
    });

    // `?basic=1` swaps the terrain shader for a flat colour, which makes it
    // easy to tell a geometry problem from a shading problem.
    if (new URLSearchParams(window.location.search).has('basic')) {
      (this.solidMaterial as THREE.Material).dispose();
      this.solidMaterial = new THREE.MeshBasicMaterial({ color: 0xff3355 }) as unknown as THREE.ShaderMaterial;
    }

    this.chunkRenderer = new ChunkRenderer(this.solidMaterial, this.translucentMaterial);
    this.scene.add(this.chunkRenderer.group);
    this.scene.add(this.mobRenderer.group);
    this.scene.add(this.remotePlayers.group);
    this.scene.add(this.cameras.group);
    this.scene.add(this.lasers.group);
    this.scene.add(this.waypoints.group);

    // The player's own avatar, wearing the kit they picked.
    setSkinAnisotropy(this.renderer.capabilities.getMaxAnisotropy());
    this.avatarModel = new AvatarModel(this.avatar);
    this.scene.add(this.avatarModel.group);

    // Lighting for entities (the terrain uses baked light).
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(80, 120, 40);
    this.scene.add(sun);
    this.scene.add(new THREE.HemisphereLight(0xbdd7ff, 0x4a3f2f, 0.55));

    // --- Highlight and break overlay -----------------------------------
    const highlightGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002));
    this.highlight = new THREE.LineSegments(
      highlightGeometry,
      new THREE.LineBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0.55, depthTest: true }),
    );
    this.highlight.visible = false;
    this.scene.add(this.highlight);

    const overlayMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    this.breakOverlay = new THREE.Mesh(new THREE.BoxGeometry(1.01, 1.01, 1.01), overlayMaterial);
    this.breakOverlay.visible = false;
    this.scene.add(this.breakOverlay);

    // --- World streaming ------------------------------------------------
    this.chunkManager = new ChunkManager(
      {
        seed: options.seed ?? SEED,
        lookup: this.lookup,
        renderDistance: this.settings.renderDistanceOverride || QUALITY_PROFILES[this.settings.tier].renderDistance,
        dimension: 'overworld',
      },
      this.chunkRenderer,
    );
    this.chunkManager.initMeshWorker(profiles.toTransferable());

    // --- Player ----------------------------------------------------------
    const collisionWorld: CollisionWorld = {
      boxesAt: (x, y, z) => {
        const id = this.chunkManager.getBlock(x, y, z);
        if (id === 0) return [];
        const profile = this.world.profiles.get(id);
        return boxesForShape(profile.shape, profile.axis);
      },
      isLiquidAt: (x, y, z) => {
        const id = this.chunkManager.getBlock(x, y, z);
        return id !== 0 && this.world.profiles.get(id).liquid;
      },
      isClimbableAt: (x, y, z) => {
        const id = this.chunkManager.getBlock(x, y, z);
        return id !== 0 && this.world.profiles.get(id).tags.includes('ladder');
      },
    };
    this.player = new Player({ world: collisionWorld, mode: MODE_CAPABILITIES[this.mode] });

    this.entities = new EntityManager({
      mobs: { get: (id) => mobs.get(id), all: () => mobs.all() },
      surfaceHeight: (x, z) => this.surfaceHeight(x, z),
      isSolid: (x, y, z) => {
        const id = this.chunkManager.getBlock(x, y, z);
        return id !== 0 && this.world.profiles.get(id).opaque;
      },
      onDeath: (entity) => {
        const def = mobs.get(entity.type);
        if (!def) return;
        for (const drop of def.drops) {
          if (drop.chance !== undefined && !this.rng.chance(drop.chance)) continue;
          const count = this.rng.int(drop.min, drop.max);
          if (count > 0) this.inventory.add(drop.item, count);
        }
        this.hud.showToast(`A ${def.displayName} was defeated`);
      },
      onAttack: (_entity, def) => {
        if (!MODE_CAPABILITIES[this.mode].takeDamage) return;
        const died = this.survival.damage(def.damage, this.armorDefense());
        sfx.play(died ? 'death' : 'hurt');
        if (died) this.handleDeath();
      },
      onDamage: () => sfx.play('mobHurt'),
    });

    // --- Input and UI ----------------------------------------------------
    this.input = new InputManager(this.renderer.domElement);
    this.input.onHotbar = (slot) => this.inventory.setSelected(slot);
    this.input.onKey = (code, event) => this.onKey(code, event);

    this.hud = new Hud({
      onSelectSlot: (index) => {
        this.inventory.setSelected(index);
      },
      onSelectHeld: () => {
        this.useHeld();
      },
    });

    this.loop = new FixedLoop(
      (dt) => this.tick(dt),
      (alpha) => this.render(alpha),
    );

    window.addEventListener('resize', this.onResize);
    this.renderer.domElement.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);

    // Give the player a starting kit so the game is playable immediately.
    this.inventory.add('oak_planks', 16);
    this.inventory.add('torch', 8);
    this.inventory.add('stone', 8);

    // Start on dry land rather than in the middle of an ocean.
    const spawn = this.findSpawn(options.seed ?? SEED);
    this.player.setPosition(spawn.x, spawn.y + 1.5, spawn.z);
  }

  // -----------------------------------------------------------------------

  private buildProfiles(): BlockProfileTable {
    const list: BlockProfile[] = [EMPTY_PROFILE];
    for (const block of blocks.all()) {
      const id = this.blockIndex.get(block.id) ?? 0;
      const isAir = block.id === 'air';
      list[id] = {
        id,
        name: block.id,
        // Air is always empty: it never blocks a face, never stops the sky
        // light and is never drawn.
        render: isAir ? 'none' : block.render,
        shape: isAir ? 'empty' : block.shape,
        emission: block.lightEmission,
        transparent: isAir ? true : block.transparent,
        opaque: isAir ? false : !block.transparent && !block.liquid && block.shape === 'cube',
        liquid: block.liquid,
        slab: block.slabShape,
        axis: block.axis,
        layer: {
          top: this.layerFor(block.textures.top),
          side: this.layerFor(block.textures.side),
          bottom: this.layerFor(block.textures.bottom),
          front: this.layerFor(block.textures.front),
        },
        hardness: block.hardness,
        tool: block.tool,
        tier: block.requiresToolTier,
        flammable: block.flammable,
        correctToolDrops: block.correctToolDrops,
        tags: block.tags,
      };
    }
    return new BlockProfileTable(list);
  }

  private layerFor(name: string): number {
    if (!this.textureLayers) {
      this.textureLayers = new Map(TEXTURE_NAMES.map((n, i) => [n, i]));
    }
    return this.textureLayers.get(name) ?? 0;
  }

  // -----------------------------------------------------------------------

  start(): void {
    this.loop.start();
    this.hud.showToast('Welcome to Cubicraft!');
  }

  stop(): void {
    this.loop.stop();
  }

  /** Switch the game mode — survival, creative, and friends. */
  setMode(mode: GameMode): void {
    this.mode = mode;
    this.player.setMode(MODE_CAPABILITIES[mode]);
    this.hud.showToast(`Mode: ${mode}`);
  }

  private onResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  private onMouseDown = (event: MouseEvent): void => {
    if (!this.playing) return;
    if (event.button === 0) this.startBreaking();
    if (event.button === 2) this.placeBlock();
  };

  private onMouseUp = (): void => {
    this.breakState = null;
    this.breakOverlay.visible = false;
  };

  private onKey = (code: string, event: KeyboardEvent): void => {
    if (code === 'F3') {
      this.hud.toggleDebug();
      event.preventDefault();
    }
    if (code === 'F5') {
      this.cameraMode = this.cameraMode === 'first' ? 'third' : this.cameraMode === 'third' ? 'orbit' : 'first';
      this.hud.showToast(`Camera: ${this.cameraMode}`);
      event.preventDefault();
    }
    if (code === 'KeyE') {
      this.openInventory();
      event.preventDefault();
    }
    if (code === 'KeyF') {
      this.useHeld();
    }
    if (code === 'KeyP') {
      this.photoMode = !this.photoMode;
      this.pendingCapture = true;
      this.hud.showToast(this.photoMode ? 'Photo mode on — press P to save a picture' : 'Photo mode off');
    }
  };

  /** Enter or leave gameplay (pointer lock). */
  setPlaying(playing: boolean): void {
    this.playing = playing;
    this.input.suspended = !playing;
    this.hud.setVisible(playing || this.photoMode);
    if (playing) {
      this.input.requestPointerLock();
      // Pointer lock can fail silently (iframes, remote sessions). Nudge the
      // player once so they know clicking again captures the mouse.
      window.setTimeout(() => {
        if (this.playing && !this.input.pointerLocked) {
          this.hud.showToast('Click the world to capture the mouse — drag to look around');
        }
      }, 600);
    } else this.input.exitPointerLock();
  }

  // -----------------------------------------------------------------------

  private readInput() {
    const forward = (this.input.isDown('KeyW') ? 1 : 0) - (this.input.isDown('KeyS') ? 1 : 0);
    const strafe = (this.input.isDown('KeyD') ? 1 : 0) - (this.input.isDown('KeyA') ? 1 : 0);
    return {
      forward,
      strafe,
      jump: this.input.isDown('Space'),
      sneak: this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight'),
      sprint: this.input.isDown('ControlLeft') || this.input.isDown('ControlRight'),
    };
  }

  private tick(dt: number): void {
    this.elapsed += dt;

    if (this.playing) {
      // Mouse look.
      const sensitivity = this.settings.mouseSensitivity;
      this.player.yaw -= this.input.pointer.dx * sensitivity;
      this.player.pitch -= this.input.pointer.dy * sensitivity * (this.settings.invertY ? -1 : 1);
      this.player.pitch = Math.max(-Math.PI / 2 + 0.001, Math.min(Math.PI / 2 - 0.001, this.player.pitch));
    }

    const input = this.readInput();
    this.player.tick(input);

    this.dayNight.tick(dt);
    this.survival.tick(dt, MODE_CAPABILITIES[this.mode].hasHunger);

    // Streaming.
    const profile = QUALITY_PROFILES[this.settings.tier];
    this.chunkManager.update(
      this.player.x,
      this.player.z,
      profile.smoothLighting,
      profile.ambientOcclusion,
    );
    this.placePlayerOnSurface();

    // Mobs.
    const biomeId = this.biomeAt(this.player.x, this.player.z);
    const light = this.chunkManager.getBlock(Math.floor(this.player.x), Math.floor(this.player.y + 2), Math.floor(this.player.z));
    const sky = this.dayNight.skyLightFactor;
    const lightLevel = Math.max(sky * 15, light !== 0 ? 0 : 0);
    this.entities.tick(dt, this.player.x, this.player.y, this.player.z);
    if (MODE_CAPABILITIES[this.mode].mobDamage) {
      this.entities.trySpawn(
        this.player.x,
        this.player.y,
        this.player.z,
        biomeId,
        lightLevel,
        this.dimension,
        24,
      );
    }

    this.furnaces.tick(dt, (job) => {
      this.inventory.add(job.output, 1);
      this.hud.showToast(`Smelted ${job.output.replace(/_/g, ' ')}`);
      sfx.play('craft');
      this.furnaceUi?.refresh();
    });
    this.updateBreak(dt);
    this.portalTravel(dt);
    sfx.step(dt, this.playing && this.player.speed > 0.05, this.player.onGround);
    if (this.survival.level > this.lastLevel) sfx.play('levelup');
    this.lastLevel = this.survival.level;
    this.multiplayer?.update(dt);
    this.cameras.update();
    this.lasers.update(dt);
    this.waypoints.update(this.elapsed);
    this.input.endFrame();
  }

  private render(alpha: number): void {
    const profile = QUALITY_PROFILES[this.settings.tier];

    // Camera.
    const yaw = this.player.yaw;
    const pitch = this.player.pitch;
    const eye = this.player.eyeY;

    const activeCamera = this.cameras.active();
    if (activeCamera) {
      this.camera.position.set(activeCamera.x, activeCamera.y, activeCamera.z);
      this.camera.rotation.set(activeCamera.pitch, activeCamera.yaw, 0, 'YXZ');
      this.avatarModel.group.visible = false;
    } else if (this.cameraMode === 'first' && !this.photoMode) {
      this.camera.position.set(this.player.x, eye, this.player.z);
      this.camera.rotation.set(pitch, yaw, 0, 'YXZ');
      this.avatarModel.group.visible = false;
    } else {
      this.avatarModel.group.visible = !this.photoMode;
      this.avatarModel.group.position.set(this.player.x, this.player.y, this.player.z);
      // The avatar model faces +Z, the camera looks down -Z, so it is turned
      // by half a turn to face the way the player is looking.
      this.avatarModel.group.rotation.y = yaw + Math.PI;
      this.avatarModel.group.rotation.x = pitch;
      this.avatarModel.setLimbPose(this.elapsed * 8, Math.min(1, this.player.speed * 4));
      const distance = this.cameraMode === 'orbit' ? 6 : 4.5;
      const dir = directionFromAngles(yaw, pitch);
      const target = new THREE.Vector3(this.player.x, eye, this.player.z);
      this.camera.position.set(
        target.x - dir[0] * distance,
        target.y - dir[1] * distance + (this.cameraMode === 'orbit' ? 1.6 : 0),
        target.z - dir[2] * distance,
      );
      this.camera.lookAt(target);
    }

    // Sky and lighting — the nether and end get their own gloom.
    const skyState = this.sky.update(this.dayNight.hour, this.elapsed);
    this.sky.mesh.position.copy(this.camera.position);
    this.sky.mesh.scale.setScalar(900);
    this.sky.mesh.visible = this.dimension === 'overworld';
    let fog = skyState.fog;
    let ambient = skyState.ambient;
    if (this.dimension === 'nether') {
      fog = new THREE.Color(0x380f08);
      ambient = 0.34;
    } else if (this.dimension === 'end') {
      fog = new THREE.Color(0x090712);
      ambient = 0.24;
    }

    const fogFar = profile.renderDistance * 16;
    updateTerrainUniforms([this.solidMaterial, this.translucentMaterial], {
      skyLight: ambient * 1.4,
      ambient,
      fogColor: fog,
      fogNear: fogFar * 0.6,
      fogFar: fogFar * 0.98,
      cameraPosition: this.camera.position,
      time: this.elapsed,
    });

    this.scene.fog = new THREE.Fog(fog.getHex(), fogFar * 0.6, fogFar * 0.98);

    // Culling and entities.
    const frustum = new THREE.Frustum();
    frustum.setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse),
    );
    this.chunkRenderer.applyFrustumCulling(frustum);
    this.mobRenderer.update(this.entities.entities, { get: (id) => mobs.get(id) });
    if (this.multiplayer) {
      this.remotePlayers.update(this.multiplayer.remotePlayers.values());
    }

    this.updateHighlight();

    // HUD.
    this.hud.updateHotbar(this.inventory.slots, this.inventory.selected);
    this.hud.updateVitals(
      this.survival.health,
      this.survival.hunger,
      this.survival.xp,
      this.survival.xpToNext,
      this.survival.level,
    );
    this.hud.setHurt(this.survival.recentDamage * 0.8);
    this.updateDebug();

    this.renderer.render(this.scene, this.camera);

    if (this.pendingCapture) {
      this.pendingCapture = false;
      this.capturePhoto();
    }
    void alpha;
  }

  /** Save the current view as a picture the kids can look at later. */
  private capturePhoto(): void {
    try {
      const url = this.renderer.domElement.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = url;
      link.download = `cubicraft-${Date.now()}.png`;
      link.click();
      this.hud.showToast('Photo saved');
    } catch (error) {
      this.hud.showToast('Could not save the photo');
      log.warn('[photo]', error);
    }
  }

  // -----------------------------------------------------------------------

  private updateDebug(): void {
    if (!this.settings.showFps) {
      this.hud.setDebug('');
      return;
    }
    const biome = this.biomeAt(this.player.x, this.player.z);
    const lines = [
      `Cubicraft  ${this.loop.fps.toFixed(0)} fps  (${this.loop.frameMs.toFixed(1)} ms)`,
      `xyz ${this.player.x.toFixed(1)} / ${this.player.y.toFixed(1)} / ${this.player.z.toFixed(1)}`,
      `biome ${biome}`,
      `chunk ${Math.floor(this.player.x / 16)}, ${Math.floor(this.player.z / 16)}`,
      `chunks ${this.chunkRenderer.chunkCount} loaded, ${this.chunkRenderer.drawCalls} draws`,
      `tris ${(this.chunkRenderer.triangleCount / 1000).toFixed(0)}k`,
      `mobs ${this.entities.entities.length}`,
      `mode ${this.mode}  dim ${this.dimension}  time ${this.dayNight.hour.toFixed(1)}h  ${this.dayNight.weather}`,
      `gen ${this.chunkManager.stats.lastGenMs.toFixed(1)}ms  mesh ${this.chunkManager.stats.lastMeshMs.toFixed(1)}ms` +
        `  remesh ${this.chunkManager.stats.remeshed}`,
    ];
    this.hud.setDebug(lines.join('\n'));
  }

  // -----------------------------------------------------------------------

  /** The block the player is looking at. */
  private pickBlock(): { x: number; y: number; z: number; nx: number; ny: number; nz: number } | null {
    const dir = directionFromAngles(this.player.yaw, this.player.pitch);
    const reach = MODE_CAPABILITIES[this.mode].canFly ? 8 : 5;
    return raycastVoxel(this.player.x, this.player.eyeY, this.player.z, dir[0], dir[1], dir[2], {
      maxDistance: reach,
      test: (x, y, z) => this.chunkManager.getBlock(x, y, z) !== AIR,
    });
  }

  private updateHighlight(): void {
    if (!this.playing) {
      this.highlight.visible = false;
      return;
    }
    const hit = this.pickBlock();
    if (!hit) {
      this.highlight.visible = false;
      return;
    }
    this.highlight.visible = true;
    this.highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
  }

  /** Left-click an entity in reach to hit it. Returns true when a mob was hit. */
  private attackEntity(): boolean {
    const dir = directionFromAngles(this.player.yaw, this.player.pitch);
    let best: { entity: Entity; along: number } | null = null;
    for (const entity of this.entities.entities) {
      const def = mobs.get(entity.type);
      if (!def) continue;
      const cx = entity.x - this.player.x;
      const cy = entity.y + def.size.h / 2 - this.player.eyeY;
      const cz = entity.z - this.player.z;
      const along = cx * dir[0] + cy * dir[1] + cz * dir[2];
      if (along < 0 || along > 4) continue;
      const px = cx - dir[0] * along;
      const py = cy - dir[1] * along;
      const pz = cz - dir[2] * along;
      const perp = Math.hypot(px, py, pz);
      const radius = Math.max(0.5, def.size.w * 0.9);
      if (perp < radius && (!best || along < best.along)) best = { entity, along };
    }
    if (!best) return false;

    const held = this.inventory.held;
    const heldDef = held ? items.get(held.item) : undefined;
    let damage = heldDef?.damage ?? 1;
    damage += (held?.enchantments?.sharpness ?? 0) * 0.5;
    damage += (held?.enchantments?.smite ?? 0) * 0.5;
    damage += (held?.enchantments?.bane_of_arthropods ?? 0) * 0.5;
    this.entities.damage(best.entity, damage);
    // Knockback sends the mob away from the player.
    best.entity.vx += dir[0] * 0.35;
    best.entity.vz += dir[2] * 0.35;
    best.entity.vy += 0.25;
    const unbreaking = held?.enchantments?.unbreaking ?? 0;
    if (heldDef?.durability !== undefined && this.rng.chance(1 / (unbreaking + 1))) {
      this.inventory.damageHeld(1);
    }
    return true;
  }

  private startBreaking(): void {
    const capabilities = MODE_CAPABILITIES[this.mode];
    if (!capabilities.canBreak) return;
    if (this.attackEntity()) return;
    const hit = this.pickBlock();
    if (!hit) return;

    const id = this.chunkManager.getBlock(hit.x, hit.y, hit.z);
    const profile = this.world.profiles.get(id);
    if (profile.hardness < 0) return;

    const held = this.inventory.held;
    const heldItem = held ? items.get(held.item) : undefined;
    const correctTool = profile.tool !== 'none' && heldItem?.tool === profile.tool;
    const canHarvest = !profile.correctToolDrops || (correctTool && (heldItem?.tier ?? 0) >= profile.tier);

    // Minecraft's rule of thumb: the right tool at the right tier breaks a
    // block in 1.5 seconds, anything else takes five times as long.
    const base = Math.max(0.05, profile.hardness);
    const efficiency = 1 + (held?.enchantments?.efficiency ?? 0) * 0.35;
    const total = capabilities.instantBreak ? 0 : (correctTool ? base * 1.5 : base * 5) / efficiency;

    this.breakState = { x: hit.x, y: hit.y, z: hit.z, progress: 0, total };
    if (capabilities.instantBreak) this.breakBlock(hit.x, hit.y, hit.z, canHarvest);
  }

  private updateBreak(dt: number): void {
    if (!this.breakState) return;
    if (!this.input.isMouseDown(0)) {
      this.breakState = null;
      this.breakOverlay.visible = false;
      return;
    }

    const hit = this.pickBlock();
    if (!hit || hit.x !== this.breakState.x || hit.y !== this.breakState.y || hit.z !== this.breakState.z) {
      this.breakState = null;
      this.breakOverlay.visible = false;
      return;
    }

    this.breakState.progress += dt;
    this.digSfxTimer = Math.max(0, this.digSfxTimer - dt);
    if (this.digSfxTimer === 0) {
      this.digSfxTimer = 0.35;
      sfx.play('dig');
    }
    const fraction = Math.min(1, this.breakState.progress / Math.max(0.001, this.breakState.total));
    this.breakOverlay.visible = true;
    this.breakOverlay.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    (this.breakOverlay.material as THREE.MeshBasicMaterial).opacity = 0.15 + fraction * 0.5;

    if (fraction >= 1) {
      const id = this.chunkManager.getBlock(hit.x, hit.y, hit.z);
      const profile = this.world.profiles.get(id);
      const held = this.inventory.held;
      const heldItem = held ? items.get(held.item) : undefined;
      const correctTool = profile.tool !== 'none' && heldItem?.tool === profile.tool;
      const canHarvest = !profile.correctToolDrops || (correctTool && (heldItem?.tier ?? 0) >= profile.tier);
      this.breakBlock(hit.x, hit.y, hit.z, canHarvest);
      this.breakState = null;
      this.breakOverlay.visible = false;
    }
  }

  private breakBlock(x: number, y: number, z: number, canHarvest: boolean): void {
    const id = this.chunkManager.getBlock(x, y, z);
    if (id === AIR) return;
    const def = blocks.get(this.blockIds[id]);
    if (!def) return;

    if (canHarvest) {
      let gotDrop = false;
      const fortune = this.inventory.held?.enchantments?.fortune ?? 0;
      for (const drop of def.drops) {
        if (drop.chance !== undefined && !this.rng.chance(drop.chance)) continue;
        const count = this.rng.int(drop.min, drop.max) + (fortune > 0 && drop.max > 1 ? this.rng.int(0, fortune) : 0);
        if (count > 0) {
          this.inventory.add(drop.item, count);
          gotDrop = true;
        }
      }
      if (gotDrop) sfx.play('pickup');
    }
    sfx.play('break');

    this.chunkManager.setBlock(x, y, z, AIR);
    this.multiplayer?.broadcastBlockChange(x, y, z, AIR);
    this.refreshRedstone(x, y, z);
    this.survival.addExhaustion(0.005);

    const held = this.inventory.held;
    const heldItem = held ? items.get(held.item) : undefined;
    const unbreaking = held?.enchantments?.unbreaking ?? 0;
    if (heldItem?.durability !== undefined && this.rng.chance(1 / (unbreaking + 1))) {
      this.inventory.damageHeld(1);
    }
  }

  private placeBlock(): void {
    const capabilities = MODE_CAPABILITIES[this.mode];
    if (!capabilities.canPlace) return;
    const held = this.inventory.held;
    if (!held) return;

    // Right-clicking a camera looks through it.
    const targeted = this.pickBlock();
    if (targeted) {
      const cameraIndex = this.cameras.cameras.findIndex(
        (camera) =>
          Math.floor(camera.x) === targeted.x &&
          Math.floor(camera.y) === targeted.y &&
          Math.floor(camera.z) === targeted.z,
      );
      if (cameraIndex >= 0) {
        this.cameras.activeIndex = this.cameras.activeIndex === cameraIndex ? -1 : cameraIndex;
        this.hud.showToast(this.cameras.activeIndex >= 0 ? 'Looking through the camera' : 'Back to your own eyes');
        return;
      }

      // Right-clicking a crafting table opens the full 3x3 grid.
      const targetName = this.blockNameAt(targeted.x, targeted.y, targeted.z);
      if (targetName === 'crafting_table') {
        this.openInventory(3);
        return;
      }
      if (targetName === 'enchanting_table') {
        this.openEnchanting();
        return;
      }
      if (targetName === 'furnace' || targetName === 'blast_furnace' || targetName === 'smoker') {
        this.openFurnace(targeted.x, targeted.y, targeted.z, targetName);
        return;
      }
      if (targetName === 'chest' || targetName === 'ender_chest' || targetName === 'barrel') {
        this.openChest(targeted.x, targeted.y, targeted.z);
        return;
      }

      // Right-clicking a lever or button switches it.
      if (targetName === 'lever' || targetName === 'stone_button' || targetName.endsWith('_pressure_plate')) {
        const on = this.redstone.toggle(targeted.x, targeted.y, targeted.z);
        this.refreshRedstone(targeted.x, targeted.y, targeted.z);
        this.hud.showToast(on ? 'On' : 'Off');
        return;
      }
    }

    // The mod extras take priority over plain block placement.
    if (this.handleExtraItem(held.item)) {
      if (held.item === 'paint_bucket') this.paintBlock();
      return;
    }

    const heldItem = items.get(held.item);
    const blockName = heldItem?.places ?? (blocks.has(held.item) ? held.item : null);
    if (!blockName || !blocks.has(blockName)) return;

    const hit = this.pickBlock();
    if (!hit) return;

    const x = hit.x + hit.nx;
    const y = hit.y + hit.ny;
    const z = hit.z + hit.nz;

    // Do not place inside the player.
    const playerBox = { x: this.player.x, y: this.player.y, z: this.player.z };
    if (
      playerBox.x + 0.3 > x &&
      playerBox.x - 0.3 < x + 1 &&
      playerBox.y + 1.8 > y &&
      playerBox.y < y + 1 &&
      playerBox.z + 0.3 > z &&
      playerBox.z - 0.3 < z + 1
    ) {
      return;
    }

    const target = this.chunkManager.getBlock(x, y, z);
    if (target !== AIR) return;

    const id = this.lookup.id(blockName);
    if (id !== AIR && this.chunkManager.setBlock(x, y, z, id)) {
      this.inventory.consumeHeld(1);
      this.multiplayer?.broadcastBlockChange(x, y, z, id);
      this.refreshRedstone(x, y, z);
      sfx.play('place');
    }
  }

  private useHeld(): void {
    const held = this.inventory.held;
    if (!held) return;
    const def = items.get(held.item);
    if (def?.food) {
      if (this.survival.eat(def.food, def.saturation ?? def.food * 0.5)) {
        this.inventory.consumeHeld(1);
        this.hud.showToast(`Ate ${def.displayName}`);
        sfx.play('eat');
      }
      return;
    }
    if (this.handleExtraItem(held.item)) return;
    if (def?.places) {
      this.placeBlock();
    }
  }

  /** The mod-style extras: camera, laser, paint bucket, compass and time control. */
  private handleExtraItem(itemId: string): boolean {
    switch (itemId) {
      case 'camera': {
        const hit = this.pickBlock();
        if (!hit) return true;
        const x = hit.x + hit.nx;
        const y = hit.y + hit.ny;
        const z = hit.z + hit.nz;
        this.cameras.add(x + 0.5, y + 0.5, z + 0.5, this.player.yaw, this.player.pitch);
        this.inventory.consumeHeld(1);
        this.hud.showToast('Camera placed — right-click it to look through');
        return true;
      }
      case 'laser': {
        this.fireLaser();
        return true;
      }
      case 'paint_bucket': {
        this.paintColour = nextPaintColour(this.paintColour);
        this.hud.showToast(`Paint: ${PAINT_COLOURS[this.paintColour].label}`);
        return true;
      }
      case 'waypoint_compass': {
        const hit = this.pickBlock();
        if (!hit) return true;
        const waypoint = this.waypoints.add(
          `Waypoint ${this.waypoints.waypoints.length + 1}`,
          hit.x + 0.5,
          hit.y + 1,
          hit.z + 0.5,
        );
        this.inventory.consumeHeld(1);
        this.hud.showToast(`${waypoint.name} dropped`);
        return true;
      }
      case 'time_control': {
        const isNight = this.dayNight.hour < 6 || this.dayNight.hour > 18;
        this.dayNight.setHour(isNight ? 12 : 22);
        this.hud.showToast(isNight ? 'It is midday' : 'Night falls');
        return true;
      }
      default:
        return false;
    }
  }

  /** Fire the handheld laser along the line of sight. */
  private fireLaser(): void {
    const dir = directionFromAngles(this.player.yaw, this.player.pitch);
    const origin = new THREE.Vector3(this.player.x, this.player.eyeY, this.player.z);
    const end = this.lasers.fire(
      origin,
      new THREE.Vector3(dir[0], dir[1], dir[2]),
      32,
      (x, y, z) => this.chunkManager.getBlock(x, y, z) !== AIR,
    );

    // Anything close to the beam takes damage.
    for (const entity of this.entities.entities) {
      const dx = entity.x - origin.x;
      const dy = entity.y + 0.5 - origin.y;
      const dz = entity.z - origin.z;
      const along = dx * dir[0] + dy * dir[1] + dz * dir[2];
      if (along < 0 || along > origin.distanceTo(end)) continue;
      const perpendicular = Math.hypot(dx - dir[0] * along, dy - dir[1] * along, dz - dir[2] * along);
      if (perpendicular < 0.9) {
        this.entities.damage(entity, 4);
      }
    }
  }

  /** Repaint the targeted block. */
  private paintBlock(): void {
    const hit = this.pickBlock();
    if (!hit) return;
    const colour = PAINT_COLOURS[this.paintColour];
    const target = this.lookup.id(colour.wool);
    if (target === AIR) return;
    if (this.chunkManager.setBlock(hit.x, hit.y, hit.z, target)) {
      this.multiplayer?.broadcastBlockChange(hit.x, hit.y, hit.z, target);
    }
  }

  /** Close every open panel and resume play. */
  private closeOverlays(): boolean {
    let had = false;
    if (this.craftingUi) { this.craftingUi.close(); this.craftingUi = null; had = true; }
    if (this.enchantUi) { this.enchantUi.close(); this.enchantUi = null; had = true; }
    if (this.furnaceUi) { this.furnaceUi.close(); this.furnaceUi = null; had = true; }
    if (this.chestUi) { this.chestUi.close(); this.chestUi = null; had = true; }
    if (had) this.setPlaying(true);
    return had;
  }

  private openInventory(tableSize: 2 | 3 = 2): void {
    if (this.closeOverlays()) return;
    this.setPlaying(false);
    this.craftingUi = new CraftingUi({
      inventory: this.inventory,
      recipes: recipes.all(),
      lookupItem: (id) => items.get(id),
      tableSize,
      onCraft: (recipe) => {
        this.hud.showToast(`Crafted ${recipe.result.replace(/_/g, ' ')}`);
        this.survival.addXp(1);
        sfx.play('craft');
      },
      onClose: () => {
        this.craftingUi?.close();
        this.craftingUi = null;
        this.setPlaying(true);
      },
    });
  }

  private openEnchanting(): void {
    if (this.closeOverlays()) return;
    this.setPlaying(false);
    this.enchantUi = new EnchantUi({
      inventory: this.inventory,
      survival: this.survival,
      enchantments: enchantments.all(),
      lookupItem: (id) => items.get(id),
      onClose: () => {
        this.enchantUi?.close();
        this.enchantUi = null;
        this.setPlaying(true);
      },
    });
  }

  private openFurnace(x: number, y: number, z: number, _name: string): void {
    if (this.closeOverlays()) return;
    this.setPlaying(false);
    this.furnaceUi = new FurnaceUi({
      inventory: this.inventory,
      furnaces: this.furnaces,
      x, y, z,
      onSmelt: (fx, fy, fz, input) => this.furnaces.start(fx, fy, fz, input),
      onClose: () => {
        this.furnaceUi?.close();
        this.furnaceUi = null;
        this.setPlaying(true);
      },
    });
  }

  private openChest(x: number, y: number, z: number): void {
    if (this.closeOverlays()) return;
    this.setPlaying(false);
    const key = `${x},${y},${z}`;
    let chest = this.chests.get(key);
    if (!chest) {
      chest = new Array<ItemStack | null>(CHEST_SLOTS).fill(null);
      this.chests.set(key, chest);
    }
    this.chestUi = new ChestUi({
      inventory: this.inventory,
      chest,
      onClose: () => {
        this.chestUi?.close();
        this.chestUi = null;
        this.setPlaying(true);
      },
    });
  }

  // -----------------------------------------------------------------------

  /** The block name at a world position. */
  private blockNameAt(x: number, y: number, z: number): string {
    const id = this.chunkManager.getBlock(x, y, z);
    return id === AIR ? '' : this.blockIds[id] ?? '';
  }

  /** Stand inside a portal block for a moment to change dimensions. */
  private portalTravel(dt: number): void {
    const px = Math.floor(this.player.x);
    const py = Math.floor(this.player.y);
    const pz = Math.floor(this.player.z);
    const feet = this.blockNameAt(px, py, pz);
    const head = this.blockNameAt(px, py + 1, pz);
    const portal =
      feet === 'nether_portal' || head === 'nether_portal' ? 'nether'
      : feet === 'end_portal' || head === 'end_portal' ? 'end'
      : null;
    if (!portal) {
      this.portalTimer = 0;
      return;
    }
    this.portalTimer += dt;
    if (this.portalTimer < 1.2) return;
    this.portalTimer = 0;
    this.travelTo(this.dimension === 'overworld' ? portal : 'overworld');
  }

  /** Move the player to another dimension and restream the world. */
  private travelTo(target: string): void {
    this.dimension = target;
    this.chunkManager.setDimension(target);
    this.entities.clear();
    this.spawned = false;
    this.spawnAtHeight = true;
    try {
      const gen = new WorldGenerator(this.options.seed ?? SEED, target as 'overworld' | 'nether' | 'end');
      const h = gen.getHeight(Math.floor(this.player.x), Math.floor(this.player.z));
      this.player.setPosition(this.player.x, h + 2.5, this.player.z);
    } catch {
      this.player.setPosition(this.player.x, 100, this.player.z);
    }
    this.hud.showToast(target === 'overworld' ? 'Back to the Overworld' : `Welcome to the ${target[0].toUpperCase() + target.slice(1)}!`);
    sfx.play('levelup');
  }

  /** Total defence points from equipped armour, including enchantments. */
  private armorDefense(): number {
    let total = 0;
    for (const stack of this.inventory.armor) {
      if (!stack) continue;
      total += items.get(stack.item)?.defense ?? 0;
      const ench = stack.enchantments ?? {};
      total += (ench.protection ?? 0) * 1.5 + (ench.fire_protection ?? 0) + (ench.blast_protection ?? 0) + (ench.projectile_protection ?? 0);
    }
    return total;
  }

  /** Handle player death according to the mode's death rule. */
  private handleDeath(): void {
    if (MODE_CAPABILITIES[this.mode].onDeath === 'permadeath') {
      this.setMode('spectator');
      this.hud.showToast('Hardcore world over — now spectating');
      return;
    }
    this.survival.respawn();
    const spawn = this.findSpawn(this.options.seed ?? SEED);
    this.player.setPosition(spawn.x, spawn.y + 1.5, spawn.z);
    this.hud.showToast('You died! Respawned at the world spawn');
  }

  /**
   * Drop the player onto the ground once the terrain under them exists, so
   * they never have to fall out of the sky.
   */
  private placePlayerOnSurface(): void {
    if (this.spawned || !this.spawnAtHeight) return;
    const cx = Math.floor(this.player.x / CHUNK_X);
    const cz = Math.floor(this.player.z / CHUNK_Z);
    const chunk = this.chunkManager.chunks.get(`${cx},${cz}`);
    if (!chunk) return;
    const lx = Math.floor(this.player.x) - cx * CHUNK_X;
    const lz = Math.floor(this.player.z) - cz * CHUNK_Z;
    const height = chunk.heightMap[lx * CHUNK_Z + lz];
    if (height <= 0) return;
    this.player.setPosition(this.player.x, height + 1.2, this.player.z);
    this.spawned = true;
  }

  /**
   * Find a dry, grassy place to start.
   *
   * Spawning in the middle of an ocean is a rotten first impression, so the
   * world is searched outwards from the origin for the first land column.
   */
  findSpawn(seed: number): { x: number; y: number; z: number } {
    try {
      const generator = new WorldGenerator(seed, 'overworld');
      for (let radius = 0; radius < 900; radius += 16) {
        for (let step = -radius; step <= radius; step += 16) {
          const candidates: [number, number][] = [
            [radius, step],
            [-radius, step],
            [step, radius],
            [step, -radius],
          ];
          for (const [cx, cz] of candidates) {
            if (Math.hypot(cx, cz) !== radius) continue;
            const height = generator.getHeight(cx, cz);
            const biome = generator.getBiome(cx, cz);
            if (height <= 66) continue;
            if (/ocean|river|frozen|deep/.test(biome)) continue;
            return { x: cx + 0.5, y: height, z: cz + 0.5 };
          }
        }
      }
    } catch (error) {
      log.warn('[spawn] could not find land, starting at the origin', error);
    }
    return { x: 0.5, y: 80, z: 0.5 };
  }

  /** Recompute the redstone network around a change. */
  private refreshRedstone(x: number, y: number, z: number): void {
    this.redstone.update(x, y, z, (bx, by, bz) => this.blockNameAt(bx, by, bz));
  }

  private surfaceHeight(x: number, z: number): number {
    const chunk = this.chunkManager.chunks.get(`${x >> 4},${z >> 4}`);
    if (!chunk) return 0;
    const height = chunk.heightMap[(x - ((x >> 4) << 4)) * 16 + (z - ((z >> 4) << 4))];
    return height < 0 ? 0 : height;
  }

  private biomeAt(x: number, z: number): string {
    const chunk = this.chunkManager.chunks.get(`${x >> 4},${z >> 4}`);
    if (!chunk || chunk.biomes.length === 0) return 'plains';
    const lx = x - ((x >> 4) << 4);
    const lz = z - ((z >> 4) << 4);
    return chunk.biomes[lx * CHUNK_Z + lz] ?? 'plains';
  }

  /** Craft from a 2x2 grid using the recipe registry. */
  craft(grid: CraftingGrid): boolean {
    const recipe = findRecipe(grid, recipes.all(), (tag) => items.byTag(tag).length > 0);
    if (!recipe) return false;
    this.inventory.add(recipe.result, recipe.count);
    for (const cell of grid.cells) {
      if (cell) this.inventory.remove(cell, 1);
    }
    return true;
  }

  makeCraftingGrid(width = 2, height = 2): CraftingGrid {
    return emptyGrid(width, height);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.loop.stop();
    window.removeEventListener('resize', this.onResize);
    this.renderer.domElement.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.chunkManager.dispose();
    this.mobRenderer.dispose();
    this.hud.dispose();
    this.renderer.dispose();
  }
}

export { TICK_MS };
