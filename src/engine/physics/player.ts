/**
 * The player controller.
 *
 * Movement is modelled in Minecraft's own units — velocity in blocks per tick
 * at a fixed 20 Hz — because that is what produces the familiar feel: the
 * same acceleration, friction, drag and jump arc as the original.
 */

import { moveWithCollision, type CollisionWorld } from './collision';

export const PLAYER_WIDTH = 0.6;
export const PLAYER_HEIGHT = 1.8;
export const EYE_HEIGHT = 1.62;

const GRAVITY = 0.08; // blocks per tick squared
const JUMP_VELOCITY = 0.42; // blocks per tick
const GROUND_FRICTION = 0.91 * 0.6;
const AIR_FRICTION = 0.91;
const VERTICAL_DRAG = 0.98;

const WALK_ACCEL = 0.1;
const SPRINT_ACCEL = 0.13;
const SNEAK_ACCEL = 0.03;
const AIR_ACCEL = 0.02;

const WATER_ACCEL = 0.05;
const WATER_FRICTION = 0.8;
const SWIM_SPEED = 0.1; // blocks per tick -> 2 blocks per second
const CLIMB_SPEED = 0.075;
const TERMINAL_FALL = 3.9; // blocks per tick

export interface PlayerInput {
  forward: number;
  strafe: number;
  jump: boolean;
  sneak: boolean;
  sprint: boolean;
}

export interface PlayerPhysicsOptions {
  world: CollisionWorld;
  mode: { canFly: boolean };
}

export class Player {
  x = 0;
  y = 80;
  z = 0;
  /** Velocity in blocks per tick. */
  vx = 0;
  vy = 0;
  vz = 0;
  yaw = 0;
  pitch = 0;

  onGround = false;
  inWater = false;
  onLadder = false;
  sneaking = false;
  sprinting = false;
  flying = false;
  /** Set when the player lands after a fall; carries the fall distance. */
  fallDistance = 0;

  private readonly options: PlayerPhysicsOptions;

  constructor(options: PlayerPhysicsOptions) {
    this.options = options;
  }

  /** Swap the capability set when the game mode changes. */
  setMode(mode: { canFly: boolean }): void {
    this.options.mode = mode;
    if (!mode.canFly) this.flying = false;
  }

  get eyeY(): number {
    return this.y + (this.sneaking ? EYE_HEIGHT - 0.22 : EYE_HEIGHT);
  }

  get speed(): number {
    return Math.hypot(this.vx, this.vz);
  }

  /** Advance the simulation by one fixed tick. */
  tick(input: PlayerInput): void {
    const { world } = this.options;

    this.sneaking = input.sneak && this.onGround;
    this.sprinting = input.sprint && input.forward > 0 && !this.sneaking;

    this.inWater = world.isLiquidAt(Math.floor(this.x), Math.floor(this.y + 0.4), Math.floor(this.z));
    this.onLadder = world.isClimbableAt(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z));

    if (this.flying) {
      this.tickFlying(input);
      return;
    }

    // --- Horizontal acceleration --------------------------------------
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    // Forward is -Z in Minecraft's yaw convention.
    let wishX = input.strafe * cos - input.forward * sin;
    let wishZ = input.strafe * sin + input.forward * cos;
    const wishLen = Math.hypot(wishX, wishZ);
    if (wishLen > 1) {
      wishX /= wishLen;
      wishZ /= wishLen;
    }

    let accel: number;
    let friction: number;
    if (this.inWater) {
      accel = WATER_ACCEL;
      friction = WATER_FRICTION;
    } else if (this.onGround) {
      accel = this.sneaking ? SNEAK_ACCEL : this.sprinting ? SPRINT_ACCEL : WALK_ACCEL;
      friction = GROUND_FRICTION;
    } else {
      accel = AIR_ACCEL;
      friction = AIR_FRICTION;
    }

    this.vx += wishX * accel;
    this.vz += wishZ * accel;
    this.vx *= friction;
    this.vz *= friction;

    // Swimming is slower than walking.
    if (this.inWater) {
      const horizontal = Math.hypot(this.vx, this.vz);
      if (horizontal > SWIM_SPEED) {
        this.vx = (this.vx / horizontal) * SWIM_SPEED;
        this.vz = (this.vz / horizontal) * SWIM_SPEED;
      }
    }

    // --- Vertical ------------------------------------------------------
    if (this.onLadder) {
      this.vy = 0;
      if (input.forward !== 0) this.vy = -CLIMB_SPEED * input.forward * 4;
      if (input.jump) this.vy = CLIMB_SPEED;
      if (input.sneak) this.vy = CLIMB_SPEED;
    } else if (this.inWater) {
      this.vy -= GRAVITY * 0.25;
      this.vy *= 0.92;
      if (input.jump) this.vy = 0.06;
      if (this.vy < -0.2) this.vy = -0.2;
    } else {
      this.vy -= GRAVITY;
      if (this.vy < -TERMINAL_FALL) this.vy = -TERMINAL_FALL;
      if (input.jump && this.onGround) {
        this.vy = JUMP_VELOCITY;
        this.onGround = false;
      }
    }

    // --- Integrate ------------------------------------------------------
    const beforeY = this.y;
    const delta = { x: this.vx, y: this.vy, z: this.vz };
    const result = moveWithCollision(
      world,
      { x: this.x, y: this.y, z: this.z },
      { w: PLAYER_WIDTH, h: PLAYER_HEIGHT },
      delta,
      0.6,
    );

    this.x = result.x;
    this.y = result.y;
    this.z = result.z;

    if (result.hitWall) {
      this.vx = 0;
      this.vz = 0;
    }
    if (result.hitCeiling) this.vy = 0;

    const wasOnGround = this.onGround;
    this.onGround = result.onGround;

    // --- Fall damage bookkeeping ----------------------------------------
    if (!this.onGround && !this.inWater && !this.onLadder) {
      this.fallDistance += Math.abs(this.vy);
    } else if (this.onGround && !wasOnGround) {
      // Landed.
      this.fallDistance = 0;
    } else {
      this.fallDistance = 0;
    }

    // Vertical drag keeps the jump arc close to Minecraft's.
    this.vy *= VERTICAL_DRAG;
    if (Math.abs(this.vy) < 0.003) this.vy = 0;
    if (Math.abs(this.vx) < 0.003) this.vx = 0;
    if (Math.abs(this.vz) < 0.003) this.vz = 0;

    void beforeY;
  }

  private tickFlying(input: PlayerInput): void {
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    let wishX = input.strafe * cos - input.forward * sin;
    let wishZ = input.strafe * sin + input.forward * cos;
    const wishLen = Math.hypot(wishX, wishZ);
    if (wishLen > 1) {
      wishX /= wishLen;
      wishZ /= wishLen;
    }
    const speed = input.sprint ? 0.6 : 0.28;
    this.vx = (this.vx + wishX * speed) * 0.9;
    this.vz = (this.vz + wishZ * speed) * 0.9;

    let vertical = 0;
    if (input.jump) vertical += 1;
    if (input.sneak) vertical -= 1;
    this.vy = (this.vy + vertical * speed * 0.6) * 0.9;

    const result = moveWithCollision(
      this.options.world,
      { x: this.x, y: this.y, z: this.z },
      { w: PLAYER_WIDTH, h: PLAYER_HEIGHT },
      { x: this.vx, y: this.vy, z: this.vz },
      0.6,
    );
    this.x = result.x;
    this.y = result.y;
    this.z = result.z;
    if (result.hitWall) {
      this.vx = 0;
      this.vz = 0;
    }
    if (result.hitCeiling) this.vy = 0;
    this.onGround = result.onGround;
    this.fallDistance = 0;
  }

  /** Teleport the player to a position. */
  setPosition(x: number, y: number, z: number): void {
    this.x = x;
    this.y = y;
    this.z = z;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
  }

  /** Whether the player has fallen far enough to take damage. */
  get fallDamage(): number {
    if (this.fallDistance <= 3) return 0;
    return Math.floor(this.fallDistance - 3);
  }
}
