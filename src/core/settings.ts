/**
 * Quality tiers and user settings.
 *
 * The tier is auto-detected from a short benchmark on first run and can be
 * overridden at any time from the Settings screen.
 */

export type QualityTier = 0 | 1 | 2;

export interface QualityProfile {
  renderDistance: number;
  smoothLighting: boolean;
  ambientOcclusion: boolean;
  entityShadows: boolean;
  postProcessing: boolean;
  bloom: boolean;
  animatedWater: boolean;
  weatherParticles: number;
  maxLights: number;
  chunkBuildsPerFrame: number;
}

export const QUALITY_PROFILES: Record<QualityTier, QualityProfile> = {
  0: {
    renderDistance: 5,
    smoothLighting: false,
    ambientOcclusion: false,
    entityShadows: false,
    postProcessing: false,
    bloom: false,
    animatedWater: false,
    weatherParticles: 200,
    maxLights: 4,
    chunkBuildsPerFrame: 1,
  },
  1: {
    renderDistance: 8,
    smoothLighting: true,
    ambientOcclusion: true,
    entityShadows: false,
    postProcessing: true,
    bloom: false,
    animatedWater: true,
    weatherParticles: 800,
    maxLights: 8,
    chunkBuildsPerFrame: 2,
  },
  2: {
    renderDistance: 12,
    smoothLighting: true,
    ambientOcclusion: true,
    entityShadows: true,
    postProcessing: true,
    bloom: true,
    animatedWater: true,
    weatherParticles: 2000,
    maxLights: 16,
    chunkBuildsPerFrame: 3,
  },
};

export interface Settings {
  tier: QualityTier;
  /** Manual override of the render distance (0 = use tier default). */
  renderDistanceOverride: number;
  fov: number;
  mouseSensitivity: number;
  invertY: boolean;
  masterVolume: number;
  musicVolume: number;
  showFps: boolean;
  showCoordinates: boolean;
  smoothCamera: boolean;
  /** Time of day in hours, 0..24. The world starts at 8am. */
  timeOfDay: number;
  dayLengthSeconds: number;
}

const STORAGE_KEY = 'cubicraft.settings.v2';

export const DEFAULT_SETTINGS: Settings = {
  tier: 1,
  renderDistanceOverride: 0,
  fov: 75,
  mouseSensitivity: 0.0022,
  invertY: false,
  masterVolume: 0.8,
  musicVolume: 0.5,
  showFps: true,
  showCoordinates: true,
  smoothCamera: true,
  timeOfDay: 8,
  dayLengthSeconds: 600,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* storage may be unavailable — settings simply do not persist */
  }
}

/**
 * Pick a quality tier from rough device signals and a measured frame time.
 */
export function detectQualityTier(
  rendererString: string,
  sampleFrameMs: number,
  cores: number,
): QualityTier {
  const gl = rendererString.toLowerCase();
  const software = gl.includes('swiftshader') || gl.includes('llvmpipe') || gl.includes('software');
  if (software) return 0;

  const integrated = gl.includes('intel') || gl.includes('apple m1') || gl.includes('adreno');
  const weak = integrated && cores <= 4;
  if (weak) return 0;

  if (sampleFrameMs > 40) return 0;
  if (sampleFrameMs > 22) return 1;
  if (cores >= 8 && !integrated) return 2;
  return 1;
}
