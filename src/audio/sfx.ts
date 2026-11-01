/**
 * Procedural sound effects — a Minecraft-ish soundscape built from
 * oscillators and filtered noise, so no audio files are needed.
 *
 * The context is created lazily on the first user-gesture sound so browsers
 * never complain about autoplay.
 */

export type SfxName =
  | 'dig'
  | 'break'
  | 'place'
  | 'step'
  | 'hurt'
  | 'mobHurt'
  | 'eat'
  | 'craft'
  | 'pickup'
  | 'splash'
  | 'levelup'
  | 'death'
  | 'click';

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private stepTimer = 0;

  private context(): AudioContext | null {
    if (typeof AudioContext === 'undefined') return null;
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private noise(ctx: AudioContext): AudioBuffer {
    if (!this.noiseBuffer) {
      this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    return this.noiseBuffer;
  }

  /** A filtered burst of noise — used for digs, breaks and footsteps. */
  private burst(freq: number, duration: number, gain = 1, type: BiquadFilterType = 'lowpass'): void {
    const ctx = this.context();
    if (!ctx || !this.master) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const amp = ctx.createGain();
    const t = ctx.currentTime;
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(filter).connect(amp).connect(this.master);
    src.start(t);
    src.stop(t + duration);
  }

  /** A short oscillator ping — used for pickups, crafting and UI. */
  private tone(freq: number, duration: number, type: OscillatorType = 'sine', gain = 0.4, slide = 0): void {
    const ctx = this.context();
    if (!ctx || !this.master) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), ctx.currentTime + duration);
    const amp = ctx.createGain();
    const t = ctx.currentTime;
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(amp).connect(this.master);
    osc.start(t);
    osc.stop(t + duration);
  }

  play(name: SfxName): void {
    switch (name) {
      case 'dig': this.burst(700, 0.07, 0.5); break;
      case 'break': this.burst(500, 0.18, 0.9); this.tone(160, 0.12, 'triangle', 0.25, -60); break;
      case 'place': this.burst(1400, 0.05, 0.5); this.tone(220, 0.08, 'square', 0.12); break;
      case 'step': this.burst(900, 0.045, 0.22); break;
      case 'hurt': this.tone(120, 0.25, 'sawtooth', 0.4, -60); this.burst(300, 0.15, 0.5); break;
      case 'mobHurt': this.tone(200, 0.15, 'square', 0.25, -80); break;
      case 'eat': this.burst(1200, 0.09, 0.5); this.burst(800, 0.12, 0.4); break;
      case 'craft': this.tone(520, 0.1, 'triangle', 0.3); this.tone(780, 0.14, 'triangle', 0.3); break;
      case 'pickup': this.tone(660, 0.07, 'sine', 0.3, 200); break;
      case 'splash': this.burst(1800, 0.3, 0.6, 'bandpass'); break;
      case 'levelup': this.tone(440, 0.1, 'triangle', 0.3); setTimeout(() => this.tone(660, 0.1, 'triangle', 0.3), 90); setTimeout(() => this.tone(880, 0.2, 'triangle', 0.35), 180); break;
      case 'death': this.tone(220, 0.5, 'sawtooth', 0.35, -160); break;
      case 'click': this.tone(880, 0.05, 'sine', 0.2); break;
    }
  }

  /** Footsteps at most every ~0.3 s while moving. */
  step(dt: number, moving: boolean, onGround: boolean): void {
    this.stepTimer = Math.max(0, this.stepTimer - dt);
    if (moving && onGround && this.stepTimer === 0) {
      this.stepTimer = 0.32;
      this.play('step');
    }
  }
}

export const sfx = new Sfx();
