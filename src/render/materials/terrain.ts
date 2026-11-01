/**
 * The terrain material.
 *
 * One custom shader draws every solid block in the world. It samples the
 * texture array (so greedy-merged quads can tile their UVs), combines the
 * baked sky/block light with the ambient occlusion computed by the mesh
 * worker, and applies the day/night sky-light multiplier as a uniform so the
 * time of day never requires re-meshing.
 */

import * as THREE from 'three';

export interface TerrainMaterialOptions {
  atlas: THREE.DataArrayTexture;
  /** Alpha-tested (cutout) blocks. */
  alphaTest?: boolean;
  /** Translucent blocks such as water and ice. */
  transparent?: boolean;
  fogColor?: THREE.Color;
  fogNear?: number;
  fogFar?: number;
}

const vertexShader = /* glsl */ `
  in vec4 aData;
  in float aLayer;

  out vec4 vData;
  out float vLayer;
  out vec3 vWorldPos;
  out vec2 vUv;

  void main() {
    vData = aData;
    vLayer = aLayer;
    vUv = uv;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp sampler2DArray;

  // With GLSL 3 three.js does not define gl_FragColor, so the shader
  // declares its own output.
  layout(location = 0) out vec4 fragColor;

  uniform sampler2DArray uAtlas;
  uniform float uSkyLight;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uAmbient;
  uniform vec3 uCameraPos;
  uniform float uTime;
  uniform float uAlphaTest;
  uniform float uOpacity;

  in vec4 vData;
  in float vLayer;
  in vec3 vWorldPos;
  in vec2 vUv;

  void main() {
    vec4 texel = texture(uAtlas, vec3(vUv, vLayer));
    if (uAlphaTest > 0.5 && texel.a < 0.5) discard;
    float blockLight = vData.r;
    float skyLight = vData.g * uSkyLight;
    float ao = vData.b;
    float faceShade = vData.a;

    // Minecraft-style light curve: dim light falls off quickly.
    float light = max(skyLight, blockLight);
    float brightness = mix(0.055, 1.0, pow(light, 1.45));
    brightness = mix(uAmbient, 1.0, brightness);

    vec3 color = texel.rgb * brightness * ao * faceShade;

    // A whisper of specular on water-like surfaces.
    vec3 toCamera = uCameraPos - vWorldPos;
    float dist = length(toCamera);
    if (dist > 0.0001) {
      vec3 viewDir = toCamera / dist;
      float sheen = pow(1.0 - abs(viewDir.y), 4.0) * 0.06 * skyLight;
      color += vec3(sheen);
    }

    float fogFactor = smoothstep(uFogNear, uFogFar, dist);
    color = mix(color, uFogColor, fogFactor);

    fragColor = vec4(color, texel.a * uOpacity);
  }
`;

export function createTerrainMaterial(options: TerrainMaterialOptions): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      uAtlas: { value: options.atlas },
      uSkyLight: { value: 1 },
      uFogColor: { value: options.fogColor ?? new THREE.Color(0x9fc4e8) },
      uFogNear: { value: options.fogNear ?? 40 },
      uFogFar: { value: options.fogFar ?? 140 },
      uAmbient: { value: 0 },
      uCameraPos: { value: new THREE.Vector3() },
      uTime: { value: 0 },
      uAlphaTest: { value: options.alphaTest ? 1 : 0 },
      uOpacity: { value: options.transparent ? 0.72 : 1 },
    },
    vertexShader,
    fragmentShader,
    transparent: options.transparent ?? false,
    depthWrite: options.transparent ? false : true,
    side: THREE.FrontSide,
  });
  return material;
}

/** Apply the shared per-frame uniforms to every terrain material. */
export function updateTerrainUniforms(
  materials: THREE.ShaderMaterial[],
  state: {
    skyLight: number;
    ambient: number;
    fogColor: THREE.Color;
    fogNear: number;
    fogFar: number;
    cameraPosition: THREE.Vector3;
    time: number;
  },
): void {
  for (const material of materials) {
    // A debug material (plain colour) has no uniforms to drive.
    if (!material.uniforms) continue;
    material.uniforms.uSkyLight.value = state.skyLight;
    material.uniforms.uAmbient.value = state.ambient;
    material.uniforms.uFogColor.value.copy(state.fogColor);
    material.uniforms.uFogNear.value = state.fogNear;
    material.uniforms.uFogFar.value = state.fogFar;
    material.uniforms.uCameraPos.value.copy(state.cameraPosition);
    material.uniforms.uTime.value = state.time;
  }
}
