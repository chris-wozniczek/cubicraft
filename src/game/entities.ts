/**
 * Entities and mob AI.
 *
 * Mob behaviour resolves to a small number of archetypes, so the 88 mobs in
 * the registry need only a dozen behaviour implementations.
 */

import type { MobDef, MobBehaviour } from '../core/types';
import { SeededRng } from '../core/rng';

export interface Entity {
  id: number;
  type: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  vx: number;
  vy: number;
  vz: number;
  onGround: boolean;
  health: number;
  maxHealth: number;
  /** Seconds until the entity may move again. */
  thinkTimer: number;
  /** Seconds until the entity may hit the player again. */
  attackTimer: number;
  /** Ticks of hurt animation. */
  hurtTimer: number;
  /** Distance walked, used to drive the limb animation. */
  walkPhase: number;
  /** Set while the mob is chasing a player. */
  target: string | null;
  age: number;
}

export interface EntityManagerOptions {
  mobs: { get(id: string): MobDef | undefined; all(): readonly MobDef[] };
  /** Function used to find the surface height at a position. */
  surfaceHeight: (x: number, z: number) => number;
  /** Function used to test whether a block is solid. */
  isSolid: (x: number, y: number, z: number) => boolean;
  /** Called when a mob dies. */
  onDeath?: (entity: Entity, def: MobDef) => void;
  /** Called when a mob takes damage. */
  onDamage?: (entity: Entity, def: MobDef, amount: number) => void;
  /** Called when a mob lands a melee hit on the player. */
  onAttack?: (entity: Entity, def: MobDef) => void;
}

let nextEntityId = 1;

export class EntityManager {
  readonly entities: Entity[] = [];
  private readonly rng: SeededRng;
  private spawnTimer = 0;

  constructor(private readonly options: EntityManagerOptions, seed = 1337) {
    this.rng = new SeededRng(seed, 'entities');
  }

  spawn(def: MobDef, x: number, y: number, z: number): Entity {
    const entity: Entity = {
      id: nextEntityId++,
      type: def.id,
      x,
      y,
      z,
      yaw: this.rng.range(0, Math.PI * 2),
      pitch: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      onGround: false,
      health: def.health,
      maxHealth: def.health,
      thinkTimer: this.rng.range(0, 1),
      attackTimer: this.rng.range(0.5, 1.5),
      hurtTimer: 0,
      walkPhase: this.rng.range(0, Math.PI * 2),
      target: null,
      age: 0,
    };
    this.entities.push(entity);
    return entity;
  }

  remove(id: number): void {
    const index = this.entities.findIndex((e) => e.id === id);
    if (index >= 0) this.entities.splice(index, 1);
  }

  clear(): void {
    this.entities.length = 0;
  }

  /** Damage an entity. Returns true when it died. */
  damage(entity: Entity, amount: number): boolean {
    const def = this.options.mobs.get(entity.type);
    if (!def) return false;
    entity.health -= amount;
    entity.hurtTimer = 0.4;
    this.options.onDamage?.(entity, def, amount);
    if (entity.health <= 0) {
      this.options.onDeath?.(entity, def);
      this.remove(entity.id);
      return true;
    }
    return false;
  }

  /** Advance every entity by one tick. */
  tick(dt: number, playerX: number, playerY: number, playerZ: number): void {
    for (const entity of this.entities) {
      const def = this.options.mobs.get(entity.type);
      if (!def) continue;
      entity.age += dt;
      entity.hurtTimer = Math.max(0, entity.hurtTimer - dt);
      entity.attackTimer = Math.max(0, entity.attackTimer - dt);
      entity.thinkTimer -= dt;

      const behaviour = def.behaviour;
      const distanceToPlayer = Math.hypot(entity.x - playerX, entity.y - playerY, entity.z - playerZ);

      switch (behaviour) {
        case 'chase':
          this.chase(entity, def, playerX, playerY, playerZ, distanceToPlayer, dt);
          break;
        case 'neutral':
          if (distanceToPlayer < 6) this.chase(entity, def, playerX, playerY, playerZ, distanceToPlayer, dt);
          else this.wander(entity, def, dt);
          break;
        case 'flee':
          if (distanceToPlayer < 12) this.flee(entity, def, playerX, playerZ, dt);
          else this.wander(entity, def, dt);
          break;
        case 'flyer':
          this.fly(entity, def, playerX, playerY, playerZ, distanceToPlayer, dt);
          break;
        case 'swimmer':
          this.swim(entity, def, dt);
          break;
        case 'jumper':
          this.jump(entity, def, dt);
          break;
        case 'boss':
          this.chase(entity, def, playerX, playerY, playerZ, distanceToPlayer, dt);
          break;
        case 'ranged':
          if (distanceToPlayer < 18) this.faceAndHold(entity, def, playerX, playerZ);
          else this.wander(entity, def, dt);
          break;
        default:
          this.wander(entity, def, dt);
          break;
      }

      this.applyPhysics(entity, def, dt);
    }
  }

  private wander(entity: Entity, def: MobDef, dt: number): void {
    if (entity.thinkTimer > 0) return;
    entity.thinkTimer = this.rng.range(1.5, 5);
    if (this.rng.chance(0.55)) {
      entity.yaw = this.rng.range(0, Math.PI * 2);
      const speed = 0.035 + this.rng.range(0, 0.02);
      entity.vx = Math.sin(entity.yaw) * speed;
      entity.vz = Math.cos(entity.yaw) * speed;
    } else {
      entity.vx = 0;
      entity.vz = 0;
    }
    void dt;
  }

  private chase(
    entity: Entity,
    def: MobDef,
    playerX: number,
    playerY: number,
    playerZ: number,
    distance: number,
    dt: number,
  ): void {
    if (distance > 32) {
      this.wander(entity, def, dt);
      return;
    }
    const dx = playerX - entity.x;
    const dz = playerZ - entity.z;
    const len = Math.hypot(dx, dz) || 1;
    const speed = def.category === 'boss' ? 0.07 : def.category === 'hostile' ? 0.055 : 0.04;
    entity.vx = (dx / len) * speed;
    entity.vz = (dz / len) * speed;
    entity.yaw = Math.atan2(-dx, -dz);

    // Melee contact: swing at the player when in reach.
    const reach = def.size.w / 2 + 1.2;
    if (len <= reach && Math.abs(playerY - entity.y) < def.size.h + 1 && entity.attackTimer <= 0) {
      entity.attackTimer = 1.0;
      this.options.onAttack?.(entity, def);
    }
    void playerY;
  }

  private flee(entity: Entity, def: MobDef, playerX: number, playerZ: number, dt: number): void {
    const dx = entity.x - playerX;
    const dz = entity.z - playerZ;
    const len = Math.hypot(dx, dz) || 1;
    entity.vx = (dx / len) * 0.06;
    entity.vz = (dz / len) * 0.06;
    entity.yaw = Math.atan2(-dx, -dz);
    void dt;
  }

  private faceAndHold(entity: Entity, def: MobDef, playerX: number, playerZ: number): void {
    const dx = playerX - entity.x;
    const dz = playerZ - entity.z;
    entity.yaw = Math.atan2(-dx, -dz);
    entity.vx = 0;
    entity.vz = 0;
  }

  private fly(
    entity: Entity,
    def: MobDef,
    playerX: number,
    playerY: number,
    playerZ: number,
    distance: number,
    dt: number,
  ): void {
    if (distance < 24) {
      const dx = playerX - entity.x;
      const dy = playerY + 1 - entity.y;
      const dz = playerZ - entity.z;
      const len = Math.hypot(dx, dy, dz) || 1;
      entity.vx = (dx / len) * 0.08;
      entity.vy = (dy / len) * 0.08;
      entity.vz = (dz / len) * 0.08;
      entity.yaw = Math.atan2(-dx, -dz);
    } else {
      this.wander(entity, def, dt);
      entity.vy = Math.sin(entity.age * 0.8) * 0.02;
    }
  }

  private swim(entity: Entity, def: MobDef, dt: number): void {
    if (entity.thinkTimer > 0) return;
    entity.thinkTimer = this.rng.range(1, 3);
    entity.yaw = this.rng.range(0, Math.PI * 2);
    entity.vx = Math.sin(entity.yaw) * 0.04;
    entity.vz = Math.cos(entity.yaw) * 0.04;
    entity.vy = 0.01;
    void dt;
  }

  private jump(entity: Entity, def: MobDef, dt: number): void {
    if (entity.onGround && this.rng.chance(0.08)) {
      entity.vy = 0.38;
    }
    void dt;
  }

  private applyPhysics(entity: Entity, def: MobDef, dt: number): void {
    const behaviour: MobBehaviour = def.behaviour;
    const flies = behaviour === 'flyer';
    const swims = behaviour === 'swimmer';

    if (!flies && !swims) {
      entity.vy -= 0.06;
      if (entity.vy < -2.5) entity.vy = -2.5;
    } else if (swims) {
      entity.vy = Math.max(-0.05, Math.min(0.05, entity.vy));
    }

    const height = def.size.h;
    const width = def.size.w;

    // Horizontal movement with a simple step-up.
    const nx = entity.x + entity.vx;
    const nz = entity.z + entity.vz;
    if (!this.blocked(nx, entity.y, entity.z, width, height)) entity.x = nx;
    else entity.vx = 0;
    if (!this.blocked(entity.x, entity.y, nz, width, height)) entity.z = nz;
    else entity.vz = 0;

    const ny = entity.y + entity.vy;
    if (!this.blocked(entity.x, ny, entity.z, width, height)) {
      entity.y = ny;
      entity.onGround = false;
    } else {
      if (entity.vy < 0) entity.onGround = true;
      entity.vy = 0;
    }

    // Keep mobs on the surface.
    const surface = this.options.surfaceHeight(entity.x, entity.z);
    if (entity.y < surface - 4) {
      entity.y = surface + 1;
      entity.vy = 0;
    }

    const speed = Math.hypot(entity.vx, entity.vz);
    entity.walkPhase += speed * dt * 14;
  }

  private blocked(x: number, y: number, z: number, width: number, height: number): boolean {
    const half = width / 2;
    const x0 = Math.floor(x - half);
    const x1 = Math.floor(x + half - 0.001);
    const z0 = Math.floor(z - half);
    const z1 = Math.floor(z + half - 0.001);
    const y0 = Math.floor(y);
    const y1 = Math.floor(y + height - 0.001);
    for (let by = y0; by <= y1; by++) {
      for (let bx = x0; bx <= x1; bx++) {
        for (let bz = z0; bz <= z1; bz++) {
          if (this.options.isSolid(bx, by, bz)) return true;
        }
      }
    }
    return false;
  }

  /**
   * Spawn mobs around the player according to the registry's spawn rules.
   */
  trySpawn(
    playerX: number,
    playerY: number,
    playerZ: number,
    biomeId: string,
    lightLevel: number,
    dimension: string,
    budget = 24,
  ): void {
    if (this.entities.length >= budget) return;
    this.spawnTimer -= 1 / 20;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = 0.5;

    const candidates = this.options.mobs.all().filter((mob) => {
      if (mob.spawn.dimension !== dimension) return false;
      if (mob.spawn.biomes.length > 0 && !mob.spawn.biomes.includes(biomeId)) return false;
      const [min, max] = mob.spawn.lightLevel;
      return lightLevel >= min && lightLevel <= max;
    });
    if (candidates.length === 0) return;

    const def = this.rng.pick(candidates);
    const angle = this.rng.range(0, Math.PI * 2);
    const distance = this.rng.range(24, 56);
    const x = Math.floor(playerX + Math.cos(angle) * distance);
    const z = Math.floor(playerZ + Math.sin(angle) * distance);
    const y = Math.floor(this.options.surfaceHeight(x, z)) + 1;
    if (y < playerY - 24 || y > playerY + 24) return;

    const [groupMin, groupMax] = def.spawn.group;
    const count = this.rng.int(groupMin, groupMax);
    for (let i = 0; i < count; i++) {
      const ox = x + this.rng.int(-2, 2);
      const oz = z + this.rng.int(-2, 2);
      const oy = Math.floor(this.options.surfaceHeight(ox, oz)) + 1;
      this.spawn(def, ox + 0.5, oy, oz + 0.5);
    }
  }
}
