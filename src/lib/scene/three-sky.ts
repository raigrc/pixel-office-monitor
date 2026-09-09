import * as THREE from 'three';

export type SkyPreset = 'luna' | 'mars' | 'terra';

export interface SkyConfig {
  preset: SkyPreset;
  timeOfDay: number;
  liveMode: boolean;
}

const SKY_PRESETS: Record<SkyPreset, {
  zenith: THREE.Color;
  horizon: THREE.Color;
  ground: THREE.Color;
  sunColor: THREE.Color;
  sunIntensity: number;
  ambientIntensity: number;
  tilt: number;
}> = {
  luna: {
    zenith: new THREE.Color(0x2a2a3e),
    horizon: new THREE.Color(0x3a3a5e),
    ground: new THREE.Color(0x1a1a2e),
    sunColor: new THREE.Color(0xffffff),
    sunIntensity: 1.5,
    ambientIntensity: 0.3,
    tilt: 0.4,
  },
  mars: {
    zenith: new THREE.Color(0x3d1a10),
    horizon: new THREE.Color(0x8b4513),
    ground: new THREE.Color(0x5c2a1a),
    sunColor: new THREE.Color(0xffcc88),
    sunIntensity: 1.2,
    ambientIntensity: 0.4,
    tilt: 0.35,
  },
  terra: {
    zenith: new THREE.Color(0x004488),
    horizon: new THREE.Color(0x88ccee),
    ground: new THREE.Color(0x2d5a27),
    sunColor: new THREE.Color(0xffffee),
    sunIntensity: 1.8,
    ambientIntensity: 0.5,
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

  private config: SkyConfig = {
    preset: 'terra',
    timeOfDay: 12,
    liveMode: true,
  };

  private lastPmremUpdate = 0;
  private readonly PMREM_THROTTLE = 333;

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.scene = scene;
    this.pmremGenerator = new THREE.PMREMGenerator(renderer);
    this.pmremGenerator.compileEquirectangularShader();

    this.createSky();
    this.createLights();
    this.update();
  }

  private createSky(): void {
    const geometry = new THREE.SphereGeometry(500, 32, 16);
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
  }

  setConfig(config: Partial<SkyConfig>): void {
    this.config = { ...this.config, ...config };
    this.update();
  }

  getConfig(): SkyConfig {
    return { ...this.config };
  }

  update(timeMs?: number): void {
    if (!this.skyMaterial || !this.sunLight || !this.ambientLight) return;

    let timeOfDay = this.config.timeOfDay;
    if (this.config.liveMode && timeMs !== undefined) {
      const date = new Date(timeMs);
      timeOfDay = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
      this.config.timeOfDay = timeOfDay;
    }

    const preset = SKY_PRESETS[this.config.preset];

    const solarAngle = ((timeOfDay - 6) / 24) * Math.PI * 2;
    const sunElevation = Math.sin(solarAngle) * (Math.PI / 2 - preset.tilt);
    const sunAzimuth = solarAngle;

    const sunDir = new THREE.Vector3(
      Math.cos(sunElevation) * Math.sin(sunAzimuth),
      Math.sin(sunElevation),
      Math.cos(sunElevation) * Math.cos(sunAzimuth)
    ).normalize();

    this.sunLight.position.copy(sunDir.clone().multiplyScalar(100));
    this.sunLight.target.position.set(0, 0, 0);
    this.sunLight.color.copy(preset.sunColor);
    this.sunLight.intensity = Math.max(0, Math.sin(sunElevation)) * preset.sunIntensity;

    this.ambientLight.color.copy(preset.zenith);
    this.ambientLight.intensity = Math.max(0.1, Math.sin(sunElevation) * 0.5 + 0.2) * preset.ambientIntensity;

    this.skyMaterial.uniforms.zenith.value.copy(preset.zenith);
    this.skyMaterial.uniforms.horizon.value.copy(preset.horizon);
    this.skyMaterial.uniforms.ground.value.copy(preset.ground);
    this.skyMaterial.uniforms.sunDirection.value.copy(sunDir);
    this.skyMaterial.uniforms.sunIntensity.value = Math.max(0, Math.sin(sunElevation)) * preset.sunIntensity;

    this.scene.background = new THREE.Color().copy(preset.horizon).lerp(preset.zenith, 0.3);

    const now = performance.now();
    if (now - this.lastPmremUpdate > this.PMREM_THROTTLE) {
      this.updateEnvironment();
      this.lastPmremUpdate = now;
    }
  }

  private updateEnvironment(): void {
    if (!this.skyMesh || !this.skyMaterial) return;

    const renderTarget = this.pmremGenerator.fromScene(this.scene, 0.01);
    this.scene.environment = renderTarget.texture;
    renderTarget.dispose();
  }

  getSunLight(): THREE.DirectionalLight | null {
    return this.sunLight;
  }

  getAmbientLight(): THREE.AmbientLight | null {
    return this.ambientLight;
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
    this.pmremGenerator.dispose();
  }
}