/**
 * Survival stats: health, hunger, saturation, experience and death.
 */

export const MAX_HEALTH = 20;
export const MAX_HUNGER = 20;
export const MAX_LEVEL = 60;

export interface StatusEffect {
  id: string;
  /** Remaining duration in seconds. */
  duration: number;
  amplifier: number;
}

export class Survival {
  health = MAX_HEALTH;
  hunger = MAX_HUNGER;
  saturation = 5;
  /** Accumulated exhaustion; regenerates hunger when it crosses 4. */
  exhaustion = 0;
  xp = 0;
  level = 0;
  xpToNext = 7;
  dead = false;
  readonly effects: StatusEffect[] = [];

  /** Damage taken since the last tick, used for the hurt flash. */
  recentDamage = 0;

  private regenTimer = 0;
  private starveTimer = 0;

  /**
   * Apply damage, respecting armour. Each defence point absorbs 4% of the
   * hit, up to 80% — like Minecraft's armour bar. Returns true on death.
   */
  damage(amount: number, defense = 0): boolean {
    if (this.dead || amount <= 0) return false;
    const effective = amount * (1 - Math.min(Math.max(defense, 0), 20) * 0.04);
    this.health = Math.max(0, this.health - effective);
    this.recentDamage = Math.min(1, this.recentDamage + amount / 10);
    if (this.health <= 0) {
      this.dead = true;
      return true;
    }
    return false;
  }

  heal(amount: number): void {
    this.health = Math.min(MAX_HEALTH, this.health + amount);
  }

  /** Eat food. Returns false when the player is not hungry enough. */
  eat(hunger: number, saturation: number): boolean {
    if (this.hunger >= MAX_HUNGER) return false;
    this.hunger = Math.min(MAX_HUNGER, this.hunger + hunger);
    this.saturation = Math.min(this.hunger, this.saturation + saturation);
    return true;
  }

  /** Add exhaustion. */
  addExhaustion(amount: number): void {
    this.exhaustion += amount;
    if (this.exhaustion >= 4) {
      this.exhaustion -= 4;
      if (this.saturation > 0) this.saturation = Math.max(0, this.saturation - 1);
      else this.hunger = Math.max(0, this.hunger - 1);
    }
  }

  /** Advance survival by one tick (50 ms). */
  tick(dt: number, canRegenerate: boolean): void {
    this.recentDamage = Math.max(0, this.recentDamage - dt * 2);

    for (let i = this.effects.length - 1; i >= 0; i--) {
      this.effects[i].duration -= dt;
      if (this.effects[i].duration <= 0) this.effects.splice(i, 1);
    }

    if (!canRegenerate || this.dead) return;

    // Natural regeneration needs food.
    if (this.hunger >= 18 && this.health < MAX_HEALTH) {
      this.regenTimer += dt;
      if (this.regenTimer >= 3.5) {
        this.regenTimer = 0;
        this.heal(1);
        this.addExhaustion(6);
      }
    } else {
      this.regenTimer = 0;
    }

    // Starvation.
    if (this.hunger <= 0) {
      this.starveTimer += dt;
      if (this.starveTimer >= 4) {
        this.starveTimer = 0;
        this.damage(1);
      }
    } else {
      this.starveTimer = 0;
    }
  }

  /** Award experience and level up. */
  addXp(amount: number): void {
    this.xp += amount;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      this.xpToNext = Math.floor(7 + this.level * 2);
    }
  }

  respawn(): void {
    this.health = MAX_HEALTH;
    this.hunger = MAX_HUNGER;
    this.saturation = 5;
    this.exhaustion = 0;
    this.dead = false;
    this.effects.length = 0;
    this.regenTimer = 0;
    this.starveTimer = 0;
  }

  addEffect(id: string, duration: number, amplifier = 0): void {
    const existing = this.effects.find((e) => e.id === id);
    if (existing) {
      existing.duration = Math.max(existing.duration, duration);
      existing.amplifier = Math.max(existing.amplifier, amplifier);
    } else {
      this.effects.push({ id, duration, amplifier });
    }
  }

  hasEffect(id: string): boolean {
    return this.effects.some((e) => e.id === id);
  }
}
