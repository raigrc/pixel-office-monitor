import * as THREE from 'three';
import { COZY_THEME } from '../cozy-theme';
import {
  DAY_END,
  deriveTimeOfDayFromDate,
  normalizeTimeOfDay,
  stageForTimeOfDay,
  type TimeStage,
} from './lighting-time';

export {
  DAY_END,
  DAY_START,
  DUSK_EVENING_END,
  DUSK_MORNING_START,
  stageForTimeOfDay,
} from './lighting-time';

export type SkyPreset = 'luna' | 'mars' | 'terra';

export interface SkyConfig {
  preset: SkyPreset;
  timeOfDay: number;
  liveMode: boolean;
}

/** Readable lighting stages. Dusk covers both dawn and dusk transitions. */
export type LightingStage = TimeStage;
/**
 * Minimum effective ambient intensity at night, every preset. Flat ambient
 * alone leaves dark-albedo terrain near-black through ACES, so night also
 * carries a cool directional fill (see NIGHT_FILL_INTENSITY): readability
 * beats physical realism for a monitoring UI.
 */
export const NIGHT_AMBIENT_FLOOR = 0.48;
/** Cool directional fill at full night. Zero at full day. */
export const NIGHT_FILL_INTENSITY = 0.65;
export const NIGHT_FILL_HEX = new THREE.Color(COZY_THEME.scene.terraSky.nightFill).getHex();
/** Cool neutral fill used as the night ambient color. */
export const NIGHT_AMBIENT_HEX = new THREE.Color(COZY_THEME.scene.terraSky.nightAmbient).getHex();
const NIGHT_ZENITH_HEX = new THREE.Color(COZY_THEME.scene.terraSky.nightZenith).getHex();
const NIGHT_HORIZON_HEX = new THREE.Color(COZY_THEME.scene.terraSky.nightHorizon).getHex();
const NIGHT_GROUND_HEX = new THREE.Color(COZY_THEME.scene.terraSky.nightGround).getHex();
/** Warm horizon glow blended in during dawn/dusk transitions. */
const DUSK_WARM_HEX = new THREE.Color(COZY_THEME.scene.terraSky.dusk).getHex();

/**
 * Converts epoch millis to fractional hours of day.
 * Input must be Date.now() scale. Boot-clock values (performance.now()
 * scale) land near 1970 and freeze the sky instead of tracking the wall
 * clock, so misuse stays visible as a stuck sky. The engine always passes
 * Date.now() (see three-engine render).
 */
export function deriveTimeOfDayFromEpoch(epochMs: number): number {
  return deriveTimeOfDayFromDate(new Date(epochMs));
}

/**
 * Effective time of day for a sky config. liveMode reads the real local
 * clock from epoch millis; manual mode ignores the clock entirely.
 */
export function resolveTimeOfDay(config: Pick<SkyConfig, 'timeOfDay' | 'liveMode'>, timeMs?: number): number {
  if (config.liveMode && timeMs !== undefined) {
    return deriveTimeOfDayFromEpoch(timeMs);
  }
  return config.timeOfDay;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function lerpHex(a: number, b: number, t: number): number {
  const mix = (x: number, y: number): number => Math.round(x + (y - x) * t);
  return (
    (mix((a >> 16) & 255, (b >> 16) & 255) << 16) |
    (mix((a >> 8) & 255, (b >> 8) & 255) << 8) |
    mix(a & 255, b & 255)
  );
}

export interface LightingProfile {
  /** Normalized input hour in [0, 24). */
  timeOfDay: number;
  stage: LightingStage;
  /** 0 at full night, 1 at full day. Smooth across every boundary. */
  daylight: number;
  /** Warm-transition glow. Peaks mid dawn/dusk, 0 in day and night. */
  duskWeight: number;
  /** Directional sun multiplier. Exactly 0 through full night. */
  sunIntensity: number;
  /** Cool directional fill. 0 at full day, with profile-tuned dusk relief. */
  fillIntensity: number;
  /** Continuous solar vector. Unbroken across day/dusk/night. */
  sunDirection: { x: number; y: number; z: number };
  /** Effective ambient intensity. Never below NIGHT_AMBIENT_FLOOR. */
  ambientIntensity: number;
  ambientHex: number;
  zenithHex: number;
  horizonHex: number;
  groundHex: number;
}

/**
 * Pure lighting calculation. No WebGL, no scene graph: every output is
 * plain data so stages, floors, colors, and transitions unit-test
 * directly. update() below is the only impure consumer.
 */
export function computeLightingProfile(timeOfDay: number, preset: SkyPreset): LightingProfile {
  const t = normalizeTimeOfDay(timeOfDay);
  const base = SKY_PRESETS[preset];

  const daylight = smoothstep(5, 7, t) * (1 - smoothstep(17, 20, t));
  const dawn = smoothstep(5, 6, t) * (1 - smoothstep(6, 7, t));
  const dusk = smoothstep(17, 18, t) * (1 - smoothstep(18, 20, t));
  const duskWeight = Math.max(dawn, dusk);
  const duskLightWeight = t >= DAY_END ? 4 * daylight * (1 - daylight) : 0;

  const solarAngle = ((t - 6) / 24) * Math.PI * 2;
  const sunElevation = Math.sin(solarAngle) * (Math.PI / 2 - base.tilt);
  const sunAzimuth = solarAngle;
  const sunDirection = {
    x: Math.cos(sunElevation) * Math.sin(sunAzimuth),
    y: Math.sin(sunElevation),
    z: Math.cos(sunElevation) * Math.cos(sunAzimuth),
  };
  const elevationSin = Math.sin(sunElevation);

  // Zero through full night; reduced but nonzero while the sun is up
  // inside a dusk window. Never fakes daylight at midnight.
  const sunIntensity = Math.max(0, elevationSin) * base.sunIntensity * daylight;
  // Moonlight-style relief shading. Flat ambient alone cannot model
  // terrain relief, so night keeps a cool directional component.
  const fillIntensity =
    (1 - daylight) * NIGHT_FILL_INTENSITY + duskLightWeight * base.duskFillBoost;

  // Keep ambient above the UI readability floor at every hour. Directional
  // sun still provides clear day/night contrast.
  const dayAmbient = (0.2 + 0.5 * Math.max(0, elevationSin)) * base.ambientIntensity;
  const ambientIntensity =
    NIGHT_AMBIENT_FLOOR +
    Math.max(0, dayAmbient - NIGHT_AMBIENT_FLOOR) * daylight +
    duskLightWeight * base.duskAmbientBoost;

  const zenithHex = lerpHex(NIGHT_ZENITH_HEX, base.zenith.getHex(), daylight);
  const groundHex = lerpHex(NIGHT_GROUND_HEX, base.ground.getHex(), daylight);
  const dayHorizon = lerpHex(NIGHT_HORIZON_HEX, base.horizon.getHex(), daylight);
  const horizonHex = lerpHex(dayHorizon, DUSK_WARM_HEX, duskWeight * 0.6);
  const ambientHex = lerpHex(NIGHT_AMBIENT_HEX, base.zenith.getHex(), daylight);

  return {
    timeOfDay: t,
    stage: stageForTimeOfDay(t),
    daylight,
    duskWeight,
    sunIntensity,
    fillIntensity,
    sunDirection,
    ambientIntensity,
    ambientHex,
    zenithHex,
    horizonHex,
    groundHex,
  };
}

const SKY_PRESETS: Record<SkyPreset, {
  zenith: THREE.Color;
  horizon: THREE.Color;
  ground: THREE.Color;
  sunColor: THREE.Color;
  sunIntensity: number;
  ambientIntensity: number;
  duskAmbientBoost: number;
  duskFillBoost: number;
  tilt: number;
}> = {
  luna: {
    zenith: new THREE.Color(0x2a2a3e),
    horizon: new THREE.Color(0x3a3a5e),
    ground: new THREE.Color(0x1a1a2e),
    sunColor: new THREE.Color(0xffffff),
    sunIntensity: 1.5,
    ambientIntensity: 0.3,
    duskAmbientBoost: 0,
    duskFillBoost: 0,
    tilt: 0.4,
  },
  mars: {
    zenith: new THREE.Color(0x3d1a10),
    horizon: new THREE.Color(0x8b4513),
    ground: new THREE.Color(0x5c2a1a),
    sunColor: new THREE.Color(0xffcc88),
    sunIntensity: 1.2,
    ambientIntensity: 0.4,
    duskAmbientBoost: 0,
    duskFillBoost: 0,
    tilt: 0.35,
  },
  terra: {
    zenith: new THREE.Color(COZY_THEME.scene.terraSky.dayZenith),
    horizon: new THREE.Color(COZY_THEME.scene.terraSky.dayHorizon),
    ground: new THREE.Color(COZY_THEME.scene.terraSky.dayGround),
    sunColor: new THREE.Color(COZY_THEME.ui.text),
    sunIntensity: 1.65,
    ambientIntensity: 0.62,
    duskAmbientBoost: 0.44,
    duskFillBoost: 0.32,
    tilt: 0.4,
  },
};

const SKY_VERTEX_SHADER = `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const SKY_FRAGMENT_SHADER = `
  uniform vec3 zenith;
  uniform vec3 horizon;
  uniform vec3 ground;
  uniform vec3 sunDirection;
  uniform float sunIntensity;
  uniform float sunSize;
  varying vec3 vWorldPosition;
  void main() {
    vec3 ray = normalize(vWorldPosition - cameraPosition);
    float h = ray.y;
    vec3 skyColor = mix(horizon, zenith, smoothstep(-0.1, 0.5, h));
    skyColor = mix(ground, skyColor, smoothstep(-0.05, 0.1, h));
    float sunDot = max(dot(ray, sunDirection), 0.0);
    float sunDisk = pow(sunDot, 1.0 / sunSize);
    skyColor += vec3(1.0, 0.9, 0.7) * sunDisk * sunIntensity * 0.15;
    gl_FragColor = vec4(skyColor, 1.0);
  }
`;

export class ThreeSky {
  private scene: THREE.Scene;
  private pmremGenerator: THREE.PMREMGenerator;
  private skyMesh: THREE.Mesh | null = null;
  private skyMaterial: THREE.ShaderMaterial | null = null;
  private sunLight: THREE.DirectionalLight | null = null;
  private ambientLight: THREE.AmbientLight | null = null;
  /** Cool night fill. Renders terrain relief readable without faking sun. */
  private fillLight: THREE.DirectionalLight | null = null;

  private config: SkyConfig = {
    preset: 'terra',
    timeOfDay: 12,
    liveMode: true,
  };

  private lastPmremUpdate = 0;
  private readonly PMREM_THROTTLE = 333;
  /** Retained environment target. Disposed only after a replacement lands. */
  private envRenderTarget: THREE.WebGLRenderTarget | null = null;

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.scene = scene;
    this.pmremGenerator = new THREE.PMREMGenerator(renderer);
    this.pmremGenerator.compileEquirectangularShader();

    this.createSky();
    this.createLights();
    this.update();
  }

  private createSky(): void {
    // Radius stays inside the engine camera far plane (200).
    const geometry = new THREE.SphereGeometry(150, 32, 16);
    geometry.scale(-1, 1, 1);

    this.skyMaterial = new THREE.ShaderMaterial({
      vertexShader: SKY_VERTEX_SHADER,
      fragmentShader: SKY_FRAGMENT_SHADER,
      uniforms: {
        zenith: { value: new THREE.Color() },
        horizon: { value: new THREE.Color() },
        ground: { value: new THREE.Color() },
        sunDirection: { value: new THREE.Vector3() },
        sunIntensity: { value: 1.0 },
        sunSize: { value: 0.04 },
      },
      side: THREE.BackSide,
      depthWrite: false,
    });

    this.skyMesh = new THREE.Mesh(geometry, this.skyMaterial);
    this.skyMesh.renderOrder = -1000;
    this.scene.add(this.skyMesh);
  }

  private createLights(): void {
    this.sunLight = new THREE.DirectionalLight(0xffffff, 1);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 100;
    this.sunLight.shadow.camera.left = -50;
    this.sunLight.shadow.camera.right = 50;
    this.sunLight.shadow.camera.top = 50;
    this.sunLight.shadow.camera.bottom = -50;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);

    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(this.ambientLight);

    this.fillLight = new THREE.DirectionalLight(NIGHT_FILL_HEX, 0);
    this.fillLight.position.set(-40, 60, -20);
    this.fillLight.castShadow = false;
    this.scene.add(this.fillLight);
  }

  setConfig(config: Partial<SkyConfig>): void {
    this.config = { ...this.config, ...config };
    this.update();
  }

  getConfig(): SkyConfig {
    return { ...this.config };
  }

  update(timeMs?: number): void {
    if (!this.skyMaterial || !this.sunLight || !this.ambientLight || !this.fillLight) return;

    const timeOfDay = resolveTimeOfDay(this.config, timeMs);
    if (this.config.liveMode && timeMs !== undefined) {
      this.config.timeOfDay = timeOfDay;
    }

    const preset = SKY_PRESETS[this.config.preset];
    const profile = computeLightingProfile(timeOfDay, this.config.preset);

    const sunDir = new THREE.Vector3(
      profile.sunDirection.x,
      profile.sunDirection.y,
      profile.sunDirection.z,
    ).normalize();

    this.sunLight.position.copy(sunDir.clone().multiplyScalar(100));
    this.sunLight.target.position.set(0, 0, 0);
    this.sunLight.color.copy(preset.sunColor);
    this.sunLight.intensity = profile.sunIntensity;

    this.ambientLight.color.setHex(profile.ambientHex);
    this.ambientLight.intensity = profile.ambientIntensity;

    this.fillLight.color.setHex(NIGHT_FILL_HEX);
    this.fillLight.intensity = profile.fillIntensity;

    this.skyMaterial.uniforms.zenith.value.setHex(profile.zenithHex);
    this.skyMaterial.uniforms.horizon.value.setHex(profile.horizonHex);
    this.skyMaterial.uniforms.ground.value.setHex(profile.groundHex);
    this.skyMaterial.uniforms.sunDirection.value.copy(sunDir);
    this.skyMaterial.uniforms.sunIntensity.value = profile.sunIntensity;

    this.scene.background = new THREE.Color(profile.horizonHex).lerp(
      new THREE.Color(profile.zenithHex),
      0.3,
    );

    const now = performance.now();
    if (now - this.lastPmremUpdate > this.PMREM_THROTTLE) {
      this.updateEnvironment();
      this.lastPmremUpdate = now;
    }
  }

  private updateEnvironment(): void {
    if (!this.skyMesh || !this.skyMaterial) return;

    // Install the replacement first: scene.environment references the
    // target's texture, so disposing before assignment would pull live
    // lighting out from under the renderer.
    const next = this.pmremGenerator.fromScene(this.scene, 0.01);
    const prev = this.envRenderTarget;
    this.scene.environment = next.texture;
    this.envRenderTarget = next;
    prev?.dispose();
  }

  getSunLight(): THREE.DirectionalLight | null {
    return this.sunLight;
  }

  getAmbientLight(): THREE.AmbientLight | null {
    return this.ambientLight;
  }

  getFillLight(): THREE.DirectionalLight | null {
    return this.fillLight;
  }

  dispose(): void {
    if (this.skyMesh) {
      this.scene.remove(this.skyMesh);
      this.skyMesh.geometry.dispose();
      this.skyMaterial?.dispose();
      this.skyMesh = null;
      this.skyMaterial = null;
    }
    if (this.sunLight) {
      this.scene.remove(this.sunLight);
      this.sunLight.shadow.map?.dispose();
      this.sunLight.dispose();
      this.sunLight = null;
    }
    if (this.ambientLight) {
      this.scene.remove(this.ambientLight);
      this.ambientLight.dispose();
      this.ambientLight = null;
    }
    if (this.fillLight) {
      this.scene.remove(this.fillLight);
      this.fillLight.dispose();
      this.fillLight = null;
    }
    this.envRenderTarget?.dispose();
    this.envRenderTarget = null;
    this.pmremGenerator.dispose();
  }
}
