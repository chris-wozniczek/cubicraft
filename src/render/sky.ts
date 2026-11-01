/**
 * The cinematic sky and the day/night cycle.
 *
 * The sky is a keyframed 24-hour cycle: every keyframe carries its own
 * zenith, horizon, sun, fog and ambient colours. Interpolating between
 * keyframes gives smooth sunrise, noon, dusk and night without ever
 * re-meshing the world — the sky-light multiplier is a shader uniform.
 */

import * as THREE from 'three';

export interface SkyKey {
  /** Hour of the day, 0..24. */
  hour: number;
  zenith: number;
  horizon: number;
  sun: number;
  fog: number;
  water: number;
  sunIntensity: number;
  ambient: number;
  starIntensity: number;
}

/**
 * Keyframes for a full day.
 *
 * The ambient floor is deliberately higher than a literal night: the terrain
 * stays dim but navigable, the way it does in Minecraft where you can still
 * see where you are walking.
 */
export const SKY_KEYS: SkyKey[] = [
  { hour: 0, zenith: 0x060a18, horizon: 0x111a2e, sun: 0x1b2440, fog: 0x0d1424, water: 0x0a1226, sunIntensity: 0.05, ambient: 0.24, starIntensity: 1 },
  { hour: 5, zenith: 0x0d1430, horizon: 0x2a2a4a, sun: 0x3a3358, fog: 0x1b1e35, water: 0x16203c, sunIntensity: 0.1, ambient: 0.26, starIntensity: 0.75 },
  { hour: 6.5, zenith: 0x2a4a86, horizon: 0xe08a52, sun: 0xffb066, fog: 0xd9906a, water: 0x6f86a8, sunIntensity: 0.55, ambient: 0.4, starIntensity: 0.12 },
  { hour: 8, zenith: 0x4f8ad6, horizon: 0xbfd8f2, sun: 0xfff0cf, fog: 0xc3d9ef, water: 0x5f92c9, sunIntensity: 1.05, ambient: 0.56, starIntensity: 0 },
  { hour: 12, zenith: 0x3f86dd, horizon: 0xc9e2f7, sun: 0xffffff, fog: 0xcfe4f5, water: 0x4f8fd0, sunIntensity: 1.25, ambient: 0.68, starIntensity: 0 },
  { hour: 16, zenith: 0x4a83c9, horizon: 0xd3e2f0, sun: 0xfff4d6, fog: 0xcfdfef, water: 0x5389c6, sunIntensity: 1.0, ambient: 0.58, starIntensity: 0 },
  { hour: 18.5, zenith: 0x33487f, horizon: 0xe78a4d, sun: 0xffa457, fog: 0xd08356, water: 0x6b7ea0, sunIntensity: 0.5, ambient: 0.38, starIntensity: 0.1 },
  { hour: 20, zenith: 0x101a38, horizon: 0x4a3a5c, sun: 0x6a4a60, fog: 0x2a2438, water: 0x1c2440, sunIntensity: 0.14, ambient: 0.27, starIntensity: 0.7 },
  { hour: 22, zenith: 0x070c1c, horizon: 0x141d34, sun: 0x212a44, fog: 0x101728, water: 0x0d1428, sunIntensity: 0.06, ambient: 0.25, starIntensity: 1 },
  { hour: 24, zenith: 0x060a18, horizon: 0x111a2e, sun: 0x1b2440, fog: 0x0d1424, water: 0x0a1226, sunIntensity: 0.05, ambient: 0.24, starIntensity: 1 },
];

function lerpColor(a: number, b: number, t: number, out: THREE.Color): THREE.Color {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  out.setRGB(
    (ar + (br - ar) * t) / 255,
    (ag + (bg - ag) * t) / 255,
    (ab + (bb - ab) * t) / 255,
    THREE.SRGBColorSpace,
  );
  return out;
}

/** The interpolated state of the sky at a given hour. */
export interface SkyState {
  zenith: THREE.Color;
  horizon: THREE.Color;
  sun: THREE.Color;
  fog: THREE.Color;
  water: THREE.Color;
  sunIntensity: number;
  ambient: number;
  starIntensity: number;
  /** Direction the sun points, in radians around the X axis. */
  sunAngle: number;
}

export function sampleSky(hour: number, out?: SkyState): SkyState {
  const state: SkyState =
    out ??
    ({
      zenith: new THREE.Color(),
      horizon: new THREE.Color(),
      sun: new THREE.Color(),
      fog: new THREE.Color(),
      water: new THREE.Color(),
      sunIntensity: 0,
      ambient: 0,
      starIntensity: 0,
      sunAngle: 0,
    } as SkyState);

  const h = ((hour % 24) + 24) % 24;
  let a = SKY_KEYS[0];
  let b = SKY_KEYS[SKY_KEYS.length - 1];
  for (let i = 0; i < SKY_KEYS.length - 1; i++) {
    if (h >= SKY_KEYS[i].hour && h <= SKY_KEYS[i + 1].hour) {
      a = SKY_KEYS[i];
      b = SKY_KEYS[i + 1];
      break;
    }
  }
  const span = Math.max(0.0001, b.hour - a.hour);
  const t = (h - a.hour) / span;

  lerpColor(a.zenith, b.zenith, t, state.zenith);
  lerpColor(a.horizon, b.horizon, t, state.horizon);
  lerpColor(a.sun, b.sun, t, state.sun);
  lerpColor(a.fog, b.fog, t, state.fog);
  lerpColor(a.water, b.water, t, state.water);
  state.sunIntensity = a.sunIntensity + (b.sunIntensity - a.sunIntensity) * t;
  state.ambient = a.ambient + (b.ambient - a.ambient) * t;
  state.starIntensity = a.starIntensity + (b.starIntensity - a.starIntensity) * t;
  state.sunAngle = ((h - 6) / 24) * Math.PI * 2;
  return state;
}

const skyVertexShader = /* glsl */ `
  varying vec3 vWorldDir;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldDir = normalize(worldPosition.xyz - cameraPosition);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const skyFragmentShader = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uSunColor;
  uniform vec3 uSunDir;
  uniform float uSunIntensity;
  uniform float uStarIntensity;
  uniform float uTime;
  varying vec3 vWorldDir;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  void main() {
    vec3 dir = normalize(vWorldDir);
    float h = clamp(dir.y, -1.0, 1.0);
    // Gradient from the horizon to the zenith.
    float t = pow(clamp(h * 0.5 + 0.5, 0.0, 1.0), 0.75);
    vec3 color = mix(uHorizon, uZenith, smoothstep(0.42, 1.0, t));

    // Sun disc and its glow.
    float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
    float disc = smoothstep(0.9985, 0.9995, sunDot);
    float glow = pow(sunDot, 180.0) * 0.55 + pow(sunDot, 14.0) * 0.16;
    color += uSunColor * (disc * 2.4 + glow) * uSunIntensity;

    // A soft horizon haze.
    color = mix(color, uHorizon, pow(1.0 - abs(h), 8.0) * 0.55);

    // Stars, faded in at night.
    if (uStarIntensity > 0.01 && h > -0.05) {
      vec2 cell = floor(dir.xz * 260.0 / max(0.15, abs(h) + 0.35));
      float star = hash21(cell);
      float bright = smoothstep(0.9975, 1.0, star);
      float twinkle = 0.65 + 0.35 * sin(uTime * 2.2 + star * 90.0);
      color += vec3(bright * twinkle * uStarIntensity * smoothstep(-0.05, 0.35, h));
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

export class Sky {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;
  readonly sunDirection = new THREE.Vector3();
  readonly state: SkyState = {
    zenith: new THREE.Color(),
    horizon: new THREE.Color(),
    sun: new THREE.Color(),
    fog: new THREE.Color(),
    water: new THREE.Color(),
    sunIntensity: 1,
    ambient: 0.5,
    starIntensity: 0,
    sunAngle: 0,
  };

  constructor(scene: THREE.Scene) {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uZenith: { value: new THREE.Color(0x3f86dd) },
        uHorizon: { value: new THREE.Color(0xc9e2f7) },
        uSunColor: { value: new THREE.Color(0xffffff) },
        uSunDir: { value: new THREE.Vector3(0.3, 0.8, 0.2) },
        uSunIntensity: { value: 1 },
        uStarIntensity: { value: 0 },
        uTime: { value: 0 },
      },
      vertexShader: skyVertexShader,
      fragmentShader: skyFragmentShader,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });

    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    scene.add(this.mesh);
  }

  /** Update the sky for a given hour of the day. */
  update(hour: number, elapsed: number): SkyState {
    const state = sampleSky(hour, this.state);
    const angle = state.sunAngle;
    this.sunDirection.set(Math.cos(angle) * 0.35, Math.sin(angle), Math.cos(angle) * 0.9).normalize();

    this.material.uniforms.uZenith.value.copy(state.zenith);
    this.material.uniforms.uHorizon.value.copy(state.horizon);
    this.material.uniforms.uSunColor.value.copy(state.sun);
    this.material.uniforms.uSunDir.value.copy(this.sunDirection);
    this.material.uniforms.uSunIntensity.value = state.sunIntensity;
    this.material.uniforms.uStarIntensity.value = state.starIntensity;
    this.material.uniforms.uTime.value = elapsed;
    return state;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
