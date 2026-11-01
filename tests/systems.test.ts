import { describe, expect, it } from 'vitest';

import { RedstoneSystem } from '../src/game/redstone';
import { Survival } from '../src/game/survival';
import { DayNight } from '../src/game/dayNight';

/** A world with a lever at (0,0,0) and wire running along +X. */
function makeWorld(): { blocks: Map<string, string>; at: (x: number, y: number, z: number) => string } {
  const blocks = new Map<string, string>();
  blocks.set('0,0,0', 'lever');
  for (let x = 1; x <= 5; x++) blocks.set(`${x},0,0`, 'redstone_wire');
  blocks.set('6,0,0', 'redstone_lamp');
  return {
    blocks,
    at: (x, y, z) => blocks.get(`${x},${y},${z}`) ?? '',
  };
}

describe('redstone', () => {
  it('lights a lamp when the lever is on', () => {
    const world = makeWorld();
    const system = new RedstoneSystem();
    system.toggle(0, 0, 0);
    system.update(0, 0, 0, world.at);
    expect(system.state.lit.has('6,0,0')).toBe(true);
  });

  it('turns the lamp off again', () => {
    const world = makeWorld();
    const system = new RedstoneSystem();
    system.toggle(0, 0, 0);
    system.update(0, 0, 0, world.at);
    system.toggle(0, 0, 0);
    system.update(0, 0, 0, world.at);
    expect(system.state.lit.has('6,0,0')).toBe(false);
  });

  it('does not light the lamp while the lever is off', () => {
    const world = makeWorld();
    const system = new RedstoneSystem();
    system.update(0, 0, 0, world.at);
    expect(system.state.lit.size).toBe(0);
  });

  it('carries power along the wire', () => {
    const world = makeWorld();
    const system = new RedstoneSystem();
    system.toggle(0, 0, 0);
    system.update(0, 0, 0, world.at);
    // The wire five blocks away is still powered.
    expect(system.state.powered.has('5,0,0')).toBe(true);
  });
});

describe('survival', () => {
  it('takes damage and dies', () => {
    const survival = new Survival();
    expect(survival.damage(5)).toBe(false);
    expect(survival.health).toBe(15);
    expect(survival.damage(20)).toBe(true);
    expect(survival.dead).toBe(true);
  });

  it('eats food only when hungry', () => {
    const survival = new Survival();
    survival.hunger = 10;
    expect(survival.eat(6, 3)).toBe(true);
    expect(survival.hunger).toBe(16);
    survival.hunger = 20;
    expect(survival.eat(6, 3)).toBe(false);
  });

  it('regenerates health when well fed', () => {
    const survival = new Survival();
    survival.health = 10;
    survival.hunger = 20;
    for (let i = 0; i < 100; i++) survival.tick(0.05, true);
    expect(survival.health).toBeGreaterThan(10);
  });

  it('takes starvation damage when empty', () => {
    const survival = new Survival();
    survival.hunger = 0;
    survival.saturation = 0;
    for (let i = 0; i < 200; i++) survival.tick(0.05, true);
    expect(survival.health).toBeLessThan(20);
  });

  it('levels up with experience', () => {
    const survival = new Survival();
    survival.addXp(100);
    expect(survival.level).toBeGreaterThan(0);
  });

  it('respawns with full health', () => {
    const survival = new Survival();
    survival.damage(20);
    survival.respawn();
    expect(survival.health).toBe(20);
    expect(survival.dead).toBe(false);
  });
});

describe('day and night', () => {
  it('advances the clock', () => {
    const clock = new DayNight(6, 100);
    clock.tick(25);
    expect(clock.hour).toBeGreaterThan(6);
  });

  it('wraps around the day', () => {
    const clock = new DayNight(23, 10);
    clock.tick(20);
    expect(clock.hour).toBeGreaterThanOrEqual(0);
    expect(clock.hour).toBeLessThan(24);
  });

  it('is bright at noon and dark at night', () => {
    const clock = new DayNight(12, 600);
    expect(clock.skyLightFactor).toBe(1);
    clock.setHour(0);
    expect(clock.skyLightFactor).toBeLessThan(0.2);
    expect(clock.isNight).toBe(true);
  });

  it('cycles the weather', () => {
    const clock = new DayNight(12, 600);
    clock.setWeather('rain', 1);
    clock.tick(2);
    expect(clock.weather).toBe('clear');
  });
});
