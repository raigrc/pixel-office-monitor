import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { ThreeCamera, CameraState } from './three-camera';
import { ThreeSky, SkyConfig, SkyPreset } from './three-sky';
import { createTerrainGeometry, createTerrainMaterial, TerrainConfig, PlanetPreset } from './terrain';
import { createScatterMesh, ScatterConfig } from './scatter';
import { createShip, ShipConfig, Ship } from './ship';
import { createBuildingGeometry, createBuildingMaterials } from './buildings';
import { createAstronauts, Astronauts, AstronautState } from './astronauts';
import { createCrewRig } from './crew-rig';
import { createBadges } from './indicators';
import { createParticleSystem } from './particles';
import { HexCell, hexToWorld, allocateCells, HEX_SIZE } from './hex-grid';

export interface ThreeEngineConfig {
  enableBloom?: boolean;
  enableSMAA?: boolean;
  renderScale?: number;
  autoQuality?: boolean;
  sky?: Partial<SkyConfig>;
}

export class ThreeEngine {
  private renderer: THREE.WebGLRenderer | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private scene: THREE.Scene | null = null;
  private container: HTMLElement | null = null;
  private animationId: number | null = null;
  private mounted = false;
  private currentViewMode: '2d' | '3d' = '2d';

  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private smaaPass: SMAAPass | null = null;
  private renderPass: RenderPass | null = null;
  private outputPass: OutputPass | null = null;

  private threeCamera: ThreeCamera | null = null;
  private threeSky: ThreeSky | null = null;

  private terrain: THREE.Mesh | null = null;
  private scatter: THREE.InstancedMesh | null = null;
  private ship: Ship | null = null;
  private buildings: Map<string, THREE.Mesh> = new Map();
  private astronauts: Astronauts | null = null;
  private badges: ReturnType<typeof createBadges> | null = null;
  private particles: ReturnType<typeof createParticleSystem> | null = null;
  private floors: Map<string, HexCell[]> = new Map();
  private agents: Map<string, AstronautState> = new Map();

  private config: Required<ThreeEngineConfig> = {
    enableBloom: true,
    enableSMAA: true,
    renderScale: 1.0,
    autoQuality: true,
    sky: {
      preset: 'terra',
      timeOfDay: 12,
      liveMode: true,
    },
  };

  private lastFps = 60;
  private fpsSamples: number[] = [];
  private slowFrameCount = 0;
  private fastFrameCount = 0;
  private lastQualityAdjustment = 0;
  private readonly QUALITY_COOLDOWN = 30000;
  private lastFrameTime = 0;

  mount(container: HTMLElement, config?: ThreeEngineConfig): void {
    if (this.mounted) return;

    this.container = container;
    this.mounted = true;
    if (config) this.config = { ...this.config, ...config };

    this.renderer = new THREE.WebGLRenderer({
      antialias: this.config.enableSMAA,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(1);
    this.updateRendererSize();
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      200
    );
    this.camera.position.set(0, 15, 25);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    this.threeCamera = new ThreeCamera(this.camera, container);
    this.threeSky = new ThreeSky(this.scene, this.renderer);
    this.threeSky.setConfig(this.config.sky);

    this.populateScene();

    this.initComposer();

    container.appendChild(this.renderer.domElement);

    this.startRenderLoop();
  }

  private initComposer(): void {
    if (!this.renderer || !this.scene || !this.camera || !this.container) return;

    this.composer = new EffectComposer(this.renderer);
    this.composer.setSize(
      this.container.clientWidth * this.config.renderScale,
      this.container.clientHeight * this.config.renderScale
    );

    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(this.container.clientWidth * this.config.renderScale, this.container.clientHeight * this.config.renderScale),
      0.6,
      0.92,
      0.85
    );
    this.bloomPass.enabled = this.config.enableBloom;
    this.composer.addPass(this.bloomPass);

    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);

    this.smaaPass = new SMAAPass();
    this.smaaPass.enabled = this.config.enableSMAA;
    this.composer.addPass(this.smaaPass);
  }

  private updateRendererSize(): void {
    if (!this.renderer || !this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const scale = this.config.renderScale;
    this.renderer.setSize(w * scale, h * scale, false);
  }

  private updateComposerSize(): void {
    if (!this.composer || !this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const scale = this.config.renderScale;
    this.composer.setSize(w * scale, h * scale);
    if (this.bloomPass) {
      this.bloomPass.resolution.set(w * scale, h * scale);
    }
  }

  setConfig(config: Partial<ThreeEngineConfig>): void {
    const oldScale = this.config.renderScale;
    const oldBloom = this.config.enableBloom;
    const oldSMAA = this.config.enableSMAA;

    this.config = { ...this.config, ...config };

    if (this.config.renderScale !== oldScale) {
      this.updateRendererSize();
      this.updateComposerSize();
    }

    if (this.bloomPass) {
      this.bloomPass.enabled = this.config.enableBloom;
    }
    if (this.smaaPass) {
      this.smaaPass.enabled = this.config.enableSMAA;
    }

    if (this.threeSky && config.sky) {
      this.threeSky.setConfig(config.sky);
    }

    if ((this.config.enableBloom !== oldBloom || this.config.enableSMAA !== oldSMAA) && this.composer) {
      this.rebuildComposer();
    }
  }

  private rebuildComposer(): void {
    if (!this.renderer || !this.scene || !this.camera || !this.container || !this.composer) return;

    this.composer.passes.forEach((pass) => {
      if (pass.dispose) pass.dispose();
    });

    this.initComposer();
  }

  unmount(): void {
    if (!this.mounted) return;

    this.stopRenderLoop();

    if (this.renderer && this.container && this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }

    this.disposeComposer();
    this.dispose();

    this.renderer = null;
    this.camera = null;
    this.scene = null;
    this.container = null;
    this.mounted = false;
  }

  private disposeComposer(): void {
    if (this.composer) {
      this.composer.passes.forEach((pass) => {
        if (pass.dispose) pass.dispose();
      });
      this.composer.dispose();
      this.composer = null;
    }
    this.bloomPass = null;
    this.smaaPass = null;
    this.renderPass = null;
    this.outputPass = null;
  }

  private startRenderLoop(): void {
    const animate = () => {
      if (!this.mounted) return;
      this.animationId = requestAnimationFrame(animate);
      this.render();
    };
    animate();
  }

  private stopRenderLoop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  private render(): void {
    if (!this.renderer || !this.scene || !this.camera || !this.threeCamera || !this.threeSky) return;

    const now = performance.now();
    const dt = Math.min((now - this.lastFrameTime) / 1000, 0.1);
    this.lastFrameTime = now;

    this.updateFPS(now);

    if (this.config.autoQuality) {
      this.governQuality(now);
    }

    this.threeCamera.update(dt);
    this.threeSky.update(now);
    this.update(now, dt);

    if (this.composer && (this.config.enableBloom || this.config.enableSMAA)) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private updateFPS(now: number): void {
    this.fpsSamples.push(now);
    while (this.fpsSamples.length > 0 && this.fpsSamples[0] < now - 1000) {
      this.fpsSamples.shift();
    }
    this.lastFps = this.fpsSamples.length;
  }

  private governQuality(now: number): void {
    const targetFps = 55;
    const dpr = Math.min(window.devicePixelRatio, 2);
    const floorScale = 0.35 * dpr;

    if (this.lastFps < targetFps) {
      this.slowFrameCount++;
      this.fastFrameCount = 0;
      if (this.slowFrameCount >= 3) {
        const newScale = Math.max(floorScale, this.config.renderScale - 0.15 * dpr);
        if (newScale !== this.config.renderScale) {
          this.setConfig({ renderScale: newScale });
        }
        this.slowFrameCount = 0;
      }
    } else {
      this.fastFrameCount++;
      this.slowFrameCount = 0;
      if (this.fastFrameCount >= 8 && now - this.lastQualityAdjustment > this.QUALITY_COOLDOWN) {
        const newScale = Math.min(2.0, this.config.renderScale + 0.1 * dpr);
        if (newScale !== this.config.renderScale) {
          this.setConfig({ renderScale: newScale });
          this.lastQualityAdjustment = now;
        }
        this.fastFrameCount = 0;
      }
    }
  }

  resize(): void {
    if (!this.renderer || !this.camera || !this.container) return;

    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.updateRendererSize();
    this.updateComposerSize();
  }

  setViewMode(mode: '2d' | '3d'): void {
    this.currentViewMode = mode;
  }

  getViewMode(): '2d' | '3d' {
    return this.currentViewMode;
  }

  getScene(): THREE.Scene | null {
    return this.scene;
  }

  getCamera(): THREE.PerspectiveCamera | null {
    return this.camera;
  }

  getRenderer(): THREE.WebGLRenderer | null {
    return this.renderer;
  }

  getConfig(): Required<ThreeEngineConfig> {
    return { ...this.config };
  }

  getFPS(): number {
    return this.lastFps;
  }

  getRenderScale(): number {
    return this.config.renderScale;
  }

  getCameraState(): CameraState | null {
    return this.threeCamera?.getState() ?? null;
  }

  setCameraState(state: Partial<CameraState>): void {
    this.threeCamera?.setState(state);
  }

  focusCamera(point: THREE.Vector3, distance?: number): void {
    this.threeCamera?.focus(point, distance);
  }

  getSkyConfig(): SkyConfig {
    return this.threeSky?.getConfig() ?? { preset: 'terra', timeOfDay: 12, liveMode: true };
  }

  setSkyPreset(preset: SkyPreset): void {
    this.threeSky?.setConfig({ preset });
  }

  populateScene(): void {
    if (!this.scene) return;

    this.createTerrain();
    this.createScatter();
    this.createShip();
    this.badges = createBadges(320);
    this.scene.add(this.badges.getMesh());
    this.particles = createParticleSystem(10000);
    this.scene.add(this.particles.getMesh());
    this.astronauts = createAstronauts({ maxAgents: 64, rig: createCrewRig() });
    for (const mesh of this.astronauts.getMeshes()) {
      this.scene.add(mesh);
    }
  }

  private createTerrain(): void {
    const terrainConfig: TerrainConfig = {
      preset: 'terra',
      halfExtent: 56,
      resolution: 112,
    };
    const geometry = createTerrainGeometry(terrainConfig);
    const material = createTerrainMaterial();
    this.terrain = new THREE.Mesh(geometry, material);
    this.terrain.receiveShadow = true;
    this.scene?.add(this.terrain);
  }

  private createScatter(): void {
    if (!this.scene) return;
    const config: ScatterConfig = {
      halfExtent: 56,
      density: 0.3,
      planetPreset: 'terra',
    };
    const occupiedCells = new Map<string, HexCell>();
    this.scatter = createScatterMesh(config, occupiedCells);
    this.scene.add(this.scatter);
  }

  private createShip(): void {
    this.ship = createShip({
      position: new THREE.Vector3(0, 0, -30),
      scale: 1,
    });
    this.scene?.add(this.ship.getGroup());
  }

  setFloors(floorIds: string[]): void {
    if (!this.scene) return;

    for (const id of floorIds) {
      if (this.buildings.has(id)) continue;

      const { geometry, recipe } = createBuildingGeometry(id);
      const materials = createBuildingMaterials(new THREE.Color(0xff8800));
      const mesh = new THREE.Mesh(geometry, materials[0]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.buildings.set(id, mesh);
    }

    for (const [id, mesh] of this.buildings) {
      if (!floorIds.includes(id)) {
        this.scene?.remove(mesh);
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material.dispose();
        }
        this.buildings.delete(id);
      }
    }
  }

  setAgents(agentStates: AstronautState[]): void {
    if (!this.astronauts) return;

    const currentIds = new Set(agentStates.map((a) => a.id));
    for (const [id] of this.agents) {
      if (!currentIds.has(id)) {
        this.astronauts.removeAgent(id);
      }
    }

    for (const state of agentStates) {
      if (!this.agents.has(state.id)) {
        this.astronauts.addAgent(state);
      } else {
        this.astronauts.updateAgent(state.id, state);
      }
    }

    this.agents = new Map(agentStates.map((a) => [a.id, a]));
  }

  update(time: number, dt: number): void {
    if (!this.mounted) return;

    this.astronauts?.update(time, dt);
    this.particles?.update(dt);
  }

  private dispose(): void {
    this.threeCamera?.dispose();
    this.threeSky?.dispose();
    this.threeCamera = null;
    this.threeSky = null;

    this.badges?.dispose();
    this.particles?.dispose();
    this.astronauts?.dispose();
    this.ship?.dispose();

    for (const mesh of this.buildings.values()) {
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      } else {
        mesh.material.dispose();
      }
    }
    this.buildings.clear();

    this.terrain?.geometry.dispose();
    if (this.terrain && !Array.isArray(this.terrain.material)) {
      this.terrain.material.dispose();
    }

    this.scatter?.geometry.dispose();
    if (this.scatter && !Array.isArray(this.scatter.material)) {
      this.scatter.material.dispose();
    }

    if (this.scene) {
      this.scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material?.dispose();
          }
        }
      });
    }

    this.renderer?.dispose();
  }
}

export const threeEngine = new ThreeEngine();