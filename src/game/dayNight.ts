/**
 * Time of day and weather.
 *
 * The day length is configurable — a full Minecraft day takes 20 minutes, but
 * the kids can shorten it. Weather is a simple clear / rain / thunder state
 * that drives the sky tint, the fog and the particle system.
 */

export type Weather = 'clear' | 'rain' | 'thunder';

export class DayNight {
  /** Time of day in hours, 0..24. */
  hour: number;
  /** Length of a full day in seconds. */
  dayLength: number;
  weather: Weather = 'clear';
  /** Remaining seconds of the current weather. */
  weatherTimer = 0;

  private readonly onChange: (hour: number, weather: Weather) => void;

  constructor(hour = 6, dayLength = 600, onChange?: (hour: number, weather: Weather) => void) {
    this.hour = hour;
    this.dayLength = dayLength;
    this.onChange = onChange ?? (() => {});
  }

  /** Advance the clock by `dt` seconds. */
  tick(dt: number): void {
    const before = this.hour;
    this.hour = (this.hour + (dt / this.dayLength) * 24) % 24;

    if (this.weatherTimer > 0) {
      this.weatherTimer -= dt;
      if (this.weatherTimer <= 0) {
        this.weather = this.weather === 'clear' ? 'rain' : 'clear';
        this.weatherTimer = this.weather === 'rain' ? 120 + Math.random() * 180 : 90 + Math.random() * 150;
      }
    }

    if (before !== this.hour) this.onChange(this.hour, this.weather);
  }

  setHour(hour: number): void {
    this.hour = ((hour % 24) + 24) % 24;
    this.onChange(this.hour, this.weather);
  }

  setWeather(weather: Weather, duration = 300): void {
    this.weather = weather;
    this.weatherTimer = duration;
    this.onChange(this.hour, this.weather);
  }

  /** The sun and sky light level, 0 at night and 1 at noon. */
  get skyLightFactor(): number {
    // Daylight between 6:00 and 18:00 with soft edges.
    const h = this.hour;
    if (h < 5 || h > 19) return 0.06;
    if (h < 7) return 0.06 + ((h - 5) / 2) * 0.94;
    if (h > 17) return 1 - ((h - 17) / 2) * 0.94;
    return 1;
  }

  get isNight(): boolean {
    return this.hour < 6 || this.hour > 18;
  }
}
