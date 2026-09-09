import * as THREE from 'three';

export const BUILDING_VERTEX_SHADER = `
  attribute float materialIndex;
  attribute float aEmissive;
  attribute float aRotor;

  varying float vMaterialIndex;
  varying float vEmissive;
  varying float vRotor;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;

  uniform float uProgress;
  uniform float uTime;
  uniform float uRotorSpeed;
  uniform vec3 uDeckPosition;

  void main() {
    vMaterialIndex = materialIndex;
    vEmissive = aEmissive;
    vRotor = aRotor;

    vec3 pos = position;

    if (vRotor > 0.5) {
      float angle = uTime * uRotorSpeed;
      float c = cos(angle);
      float s = sin(angle);
      float x = pos.x * c - pos.z * s;
      float z = pos.x * s + pos.z * c;
      pos.x = x;
      pos.z = z;
    }

    pos.y = mix(-10.0, pos.y, uProgress);

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPos.xyz;

    vec3 objectNormal = normal;
    if (vRotor > 0.5) {
      float angle = uTime * uRotorSpeed;
      float c = cos(angle);
      float s = sin(angle);
      float nx = objectNormal.x * c - objectNormal.z * s;
      float nz = objectNormal.x * s + objectNormal.z * c;
      objectNormal.x = nx;
      objectNormal.z = nz;
    }
    vNormal = normalize(normalMatrix * objectNormal);

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const BUILDING_FRAGMENT_SHADER = `
  varying float vMaterialIndex;
  varying float vEmissive;
  varying float vRotor;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;

  uniform vec3 uAccentColor;
  uniform float uProgress;
  uniform float uTime;
  uniform vec3 uSunDirection;
  uniform vec3 uSunColor;
  uniform float uSunIntensity;
  uniform vec3 uAmbientColor;
  uniform float uAmbientIntensity;
  uniform float uDeckTop;

  vec3 materials[10];

  void main() {
    materials[0] = uAccentColor * vec3(0.4);  // habitat walls
    materials[1] = uAccentColor * vec3(0.25); // roof
    materials[2] = vec3(1.0);                 // window frames (emissive)
    materials[3] = uAccentColor * vec3(0.33); // solar base
    materials[4] = vec3(0.13);                // solar panels
    materials[5] = uAccentColor * vec3(0.45); // metal structure
    materials[6] = vec3(1.0);                 // glowing parts
    materials[7] = vec3(0.53, 0.8, 0.53);     // greenhouse glass
    materials[8] = vec3(0.67, 1.0, 0.67);     // greenhouse inner
    materials[9] = uAccentColor * vec3(0.33, 0.33, 0.47); // lab

    vec3 baseColor = materials[int(vMaterialIndex)];
    float deckFactor = smoothstep(uDeckTop - 0.5, uDeckTop + 0.5, vWorldPosition.y);

    vec3 N = normalize(vNormal);
    vec3 L = normalize(uSunDirection);
    float NdotL = max(dot(N, L), 0.0);

    vec3 diffuse = baseColor * uSunColor * NdotL * uSunIntensity * deckFactor;
    vec3 ambient = baseColor * uAmbientColor * uAmbientIntensity * deckFactor;

    float emissiveIntensity = vEmissive * smoothstep(uDeckTop, uDeckTop + 2.0, vWorldPosition.y);
    vec3 emissive = baseColor * emissiveIntensity * (0.5 + 0.5 * sin(uTime * 2.0));

    vec3 color = ambient + diffuse + emissive;

    if (vWorldPosition.y < uDeckTop) {
      discard;
    }

    float progressAlpha = smoothstep(0.0, 0.1, uProgress);
    color *= progressAlpha;

    gl_FragColor = vec4(color, progressAlpha);
  }
`;

export const BUILDING_UNIFORMS = {
  uProgress: { value: 0 },
  uTime: { value: 0 },
  uRotorSpeed: { value: 0.5 },
  uDeckPosition: { value: { x: 0, y: 0.45, z: 0 } },
  uAccentColor: { value: { r: 1, g: 1, b: 1 } },
  uSunDirection: { value: { x: 0, y: 1, z: 0 } },
  uSunColor: { value: { r: 1, g: 0.9, b: 0.7 } },
  uSunIntensity: { value: 1 },
  uAmbientColor: { value: { r: 0.3, g: 0.3, b: 0.4 } },
  uAmbientIntensity: { value: 0.5 },
  uDeckTop: { value: 0.45 },
};

export function createBuildingShaderMaterial(uniforms: typeof BUILDING_UNIFORMS): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: BUILDING_VERTEX_SHADER,
    fragmentShader: BUILDING_FRAGMENT_SHADER,
    uniforms: {
      uProgress: { value: uniforms.uProgress.value },
      uTime: { value: uniforms.uTime.value },
      uRotorSpeed: { value: uniforms.uRotorSpeed.value },
      uDeckPosition: { value: uniforms.uDeckPosition.value },
      uAccentColor: { value: uniforms.uAccentColor.value },
      uSunDirection: { value: uniforms.uSunDirection.value },
      uSunColor: { value: uniforms.uSunColor.value },
      uSunIntensity: { value: uniforms.uSunIntensity.value },
      uAmbientColor: { value: uniforms.uAmbientColor.value },
      uAmbientIntensity: { value: uniforms.uAmbientIntensity.value },
      uDeckTop: { value: uniforms.uDeckTop.value },
    },
    transparent: true,
    depthWrite: true,
  });
}