/**
 * Fixed-timestep simulation loop.
 *
 * Gameplay runs at a fixed 20 Hz; rendering runs on requestAnimationFrame and
 * interpolates between the two most recent ticks. The loop is intentionally
 * independent of rAF so it can be driven from a Worker (the host peer runs
 * the authoritative simulation there) as well as from the main thread.
 */

export const TICK_RATE = 20;
export const TICK_MS = 1000 / TICK_RATE;

export interface LoopStats {
  fps: number;
  frameMs: number;
  tickMs: number;
  ticks: number;
  alpha: number;
}

export class FixedLoop {
  private accumulator = 0;
  private lastTime = 0;
  private running = false;
  private rafId = 0;
  private timerId: ReturnType<typeof setInterval> | null = null;

  /** Number of ticks executed since start. */
  ticks = 0;
  /** Measured frames per second. */
  fps = 0;
  /** Last frame duration in ms. */
  frameMs = 0;
  /** Last tick duration in ms. */
  tickMs = 0;

  constructor(
    private readonly onTick: (dt: number) => void,
    private readonly onRender: (alpha: number, dt: number) => void,
  ) {}

  /** Start the loop on requestAnimationFrame (browser main thread). */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    const frame = (now: number) => {
      if (!this.running) return;
      this.rafId = requestAnimationFrame(frame);
      this.step(now);
    };
    this.rafId = requestAnimationFrame(frame);
  }

  /**
   * Start the loop on a timer instead of rAF. Used inside a Worker where
   * requestAnimationFrame does not exist, and preferred for the authoritative
   * host simulation so a backgrounded tab cannot stall the shared world.
   */
  startTimered(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.timerId = setInterval(() => {
      if (!this.running) return;
      this.step(performance.now());
    }, TICK_MS);
  }

  stop(): void {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  get isRunning(): boolean {
    return this.running;
  }

  private step(now: number): void {
    let elapsed = now - this.lastTime;
    this.lastTime = now;
    // Clamp so a long stall (tab hidden, breakpoint) does not spiral.
    if (elapsed > 500) elapsed = 500;
    this.frameMs = elapsed;

    this.accumulator += elapsed;
    let guard = 0;
    while (this.accumulator >= TICK_MS && guard < 8) {
      const t0 = performance.now();
      this.onTick(TICK_MS / 1000);
      this.tickMs = performance.now() - t0;
      this.accumulator -= TICK_MS;
      this.ticks++;
      guard++;
    }
    if (guard >= 8) this.accumulator = 0;

    this.alpha = this.accumulator / TICK_MS;
    this.onRender(this.alpha, elapsed / 1000);

    // Rolling fps estimate.
    if (elapsed > 0) {
      const instant = 1000 / elapsed;
      this.fps = this.fps === 0 ? instant : this.fps * 0.92 + instant * 0.08;
    }
  }

  /** Interpolation factor between the last two ticks. */
  alpha = 0;
}
