import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { ThreeCamera, CameraState } from './three-camera';
import { ThreeSky, SkyConfig, SkyPreset } from './three-sky';
import { createTerrainGeometry, createTerrainMaterial, TerrainConfig, PlanetPreset } from './terrain';
import { createScatterMesh, rebuildScatter, ScatterConfig } from './scatter';
import { createShip, ShipConfig, Ship } from './ship';
import { createBuildingGeometry } from './buildings';
import { createAstronauts, Astronauts, AstronautState } from './astronauts';
import { createCrewRig } from './crew-rig';
import { createBadges } from './indicators';
import { createParticleSystem } from './particles';
import { HexCell, hexToKey, HEX_SIZE, DECK_TOP } from './hex-grid';
import { Colony } from './colony';

export interface ThreeEngineConfig {
  enableBloom?: boolean;
  enableSMAA?: boolean;
  renderScale?: number;
  autoQuality?: boolean;
  sky?: Partial<SkyConfig>;
}

/** Deterministic accent color per floor id. Stable across snapshots. */
function accentFor(id: string): THREE.Color {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return new THREE.Color().setHSL((hash % 360) / 360, 0.75, 0.55);
}

function sameKeys(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const key of a) if (!b.has(key)) return false;
  return true;
}

/** Aspect falls back to 16:9 when the container has no size yet. */
function safeAspect(w: number, h: number): number {
  if (w < 1 || h < 1) return 16 / 9;
  return w / h;
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
  private scatter: THREE.Mesh | null = null;
  private ship: Ship | null = null;
  private buildings: Map<string, THREE.Mesh> = new Map();
  private decks: Map<string, THREE.Mesh> = new Map();
  private astronauts: Astronauts | null = null;
  private badges: ReturnType<typeof createBadges> | null = null;
  private particles: ReturnType<typeof createParticleSystem> | null = null;
  private agents: Map<string, AstronautState> = new Map();
  private populated = false;
  private colony = new Colony();
  private lastScatterKeys = new Set<string>();

  private shipPosition(): THREE.Vector3 {
    return new THREE.Vector3(0, 0, -44);
  }

  private shipRadius(): number {
    return 15;
  }

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
    this.colony.load();

    this.renderer = new THREE.WebGLRenderer({
      antialias: this.config.enableSMAA,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(1);
    // Backing store follows renderScale. CSS stays pinned so the canvas
    // always fills its container instead of shrinking with the buffer.
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';
    this.updateRendererSize();
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.camera = new THREE.PerspectiveCamera(
      50,
      safeAspect(container.clientWidth, container.clientHeight),
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
      0.92
    );
    this.bloomPass.enabled = this.config.enableBloom;
    this.composer.addPass(this.bloomPass);

    // SMAA works in linear space, so it runs before OutputPass tonemapping.
    this.smaaPass = new SMAAPass();
    this.smaaPass.enabled = this.config.enableSMAA;
    this.composer.addPass(this.smaaPass);

    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);
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
    // Sky wants epoch millis. performance.now() reads as 1970 night.
    this.threeSky.update(Date.now());
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
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w < 1 || h < 1) return;

    this.camera.aspect = w / h;
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

  isMounted(): boolean {
    return this.mounted && this.scene !== null;
  }

  /** World position of each known plot, active and fallow. */
  getFloorPositions(): Map<string, THREE.Vector3> {
    return this.colony.positions();
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
    if (!this.scene || this.populated) return;
    this.populated = true;

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
      density: 0.12,
      planetPreset: 'terra',
    };
    const occupiedCells = new Map<string, HexCell>();
    this.scatter = createScatterMesh(config, occupiedCells, this.shipPosition(), this.shipRadius());
    this.scene.add(this.scatter);
    this.lastScatterKeys = new Set();
  }

  /** Rebuild scatter when the plot footprint changes so rocks miss decks. */
  private syncScatterFootprint(): void {
    if (!this.scene || !this.scatter) return;
    const keys = this.colony.occupiedKeys();
    if (sameKeys(keys, this.lastScatterKeys)) return;
    this.lastScatterKeys = keys;
    const cells = new Map<string, HexCell>();
    for (const plot of this.colony.plotsList()) {
      for (const cell of plot.cells) cells.set(hexToKey(cell.q, cell.r), cell);
    }
    this.scene.remove(this.scatter);
    this.scatter = rebuildScatter(
      this.scatter,
      { halfExtent: 56, density: 0.12, planetPreset: 'terra' },
      cells,
      this.shipPosition(),
      this.shipRadius()
    );
    this.scene.add(this.scatter);
  }

  private createShip(): void {
    // Landmark scale. Hull reads against 1.7-tall agents, not above them.
    this.ship = createShip({
      position: this.shipPosition(),
      scale: 0.45,
    });
    this.scene?.add(this.ship.getGroup());
  }

  setFloors(floorIds: string[]): void {
    if (!this.scene) return;

    this.colony.reconcile(floorIds);
    const plots = new Map(this.colony.plotsList().map((p) => [p.floorId, p]));

    for (const plot of plots.values()) {
      const pos = this.colony.positionOf(plot.floorId);
      if (!pos) continue;
      const accent = accentFor(plot.floorId);
      // Fallow plots keep their ground, dimmed.
      const tone = plot.status === 'fallow' ? 0.4 : 1;

      let deck = this.decks.get(plot.floorId);
      if (!deck) {
        const deckGeo = new THREE.CylinderGeometry(HEX_SIZE * 1.12, HEX_SIZE * 1.12, DECK_TOP, 6);
        const deckMat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.15 });
        deck = new THREE.Mesh(deckGeo, deckMat);
        deck.receiveShadow = true;
        this.scene.add(deck);
        this.decks.set(plot.floorId, deck);
      }
      deck.position.set(pos.x, 0, pos.z);
      (deck.material as THREE.MeshStandardMaterial).color.copy(accent).multiplyScalar(0.35 * tone);

      const existing = this.buildings.get(plot.floorId);
      if (existing) {
        existing.position.set(pos.x, DECK_TOP, pos.z);
        (existing.material as THREE.MeshStandardMaterial).color.copy(accent).multiplyScalar(tone);
        continue;
      }

      const { geometry } = createBuildingGeometry(plot.floorId);
      const material = new THREE.MeshStandardMaterial({ color: accent.clone().multiplyScalar(tone) });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(pos.x, DECK_TOP, pos.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.buildings.set(plot.floorId, mesh);
    }

    for (const [id, mesh] of this.buildings) {
      if (!plots.has(id)) {
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

    for (const [id, deck] of this.decks) {
      if (!plots.has(id)) {
        this.scene?.remove(deck);
        deck.geometry.dispose();
        if (Array.isArray(deck.material)) {
          deck.material.forEach((m) => m.dispose());
        } else {
          deck.material.dispose();
        }
        this.decks.delete(id);
      }
    }

    this.syncScatterFootprint();
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

    this.astronauts?.setUniforms({
      uTime: time * 0.001,
      uSunDirection: this.threeSky?.getSunLight()?.position.clone().normalize() ?? new THREE.Vector3(0, 1, 0),
      uSunColor: this.threeSky?.getSunLight()?.color ?? new THREE.Color(0xffffee),
      uSunIntensity: this.threeSky?.getSunLight()?.intensity ?? 1,
      uAmbientColor: this.threeSky?.getAmbientLight()?.color ?? new THREE.Color(0x333344),
      uAmbientIntensity: this.threeSky?.getAmbientLight()?.intensity ?? 0.5,
    });
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

    for (const deck of this.decks.values()) {
      deck.geometry.dispose();
      if (Array.isArray(deck.material)) {
        deck.material.forEach((m) => m.dispose());
      } else {
        deck.material.dispose();
      }
    }
    this.decks.clear();

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

    // Drop every runtime registry so the next mount starts clean.
    // Stale agent ids on a fresh Astronauts registry render invisible agents.
    this.badges = null;
    this.particles = null;
    this.astronauts = null;
    this.ship = null;
    this.terrain = null;
    this.scatter = null;
    this.buildings.clear();
    this.decks.clear();
    this.lastScatterKeys = new Set();
    this.agents.clear();
    this.populated = false;
  }
}

export const threeEngine = new ThreeEngine();