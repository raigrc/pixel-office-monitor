import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { ThreeCamera, CameraState } from './three-camera';
import { ThreeSky, SkyConfig, SkyPreset } from './three-sky';
import { createTerrainGeometry, createTerrainMaterial, TerrainConfig, PlanetPreset } from './terrain';
import { createScatterMesh, getScatterObstacles, rebuildScatter, ScatterConfig } from './scatter';
import { createShip, ShipConfig, Ship } from './ship';
import { createBuildingGeometry } from './buildings';
import { createAstronauts, Astronauts, AstronautState } from './astronauts';
import { createCrewRig } from './crew-rig';
import { createBadges } from './indicators';
import type { BadgeType } from './indicators';
import { createParticleSystem } from './particles';
import {
  AgentMotionController,
  workSiteForAgent,
  type MotionAgentView,
  type MotionDelta,
  type MotionEnvironment,
} from './walkers';
import { clearGrid, createNavGrid, rasterizeBuilding, rasterizeCircle, rasterizeShip, type NavGrid } from './navigation';
import { HexCell, hexToKey, getNeighbors, DECK_TOP } from './hex-grid';
import { Colony } from './colony';
import { suitColorFor } from './actor-3d-map';
import { getAgentVisualIdentity } from '../agent-visual-identity';
import { AgentSelectionMarker } from './selection-marker';
import type { WorldAgent, WorldState } from '../world/world-types';
import type { ActivityModel } from '../activity/activity-model';
import { Delegations3D } from './delegations-3d';

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

/** Session plot deck radius. Holds the worksite plus the agent ring. */
const SESSION_DECK_RADIUS = 3.6;
/** Scatter density after the Phase 1 declutter (was 0.12). */
const SCATTER_DENSITY = 0.03;
/** Distance needed to fit a ground radius in current vertical/horizontal FOV. */
export function framingDistance(radius: number, camera: THREE.PerspectiveCamera): number {
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
  const limitingFov = Math.min(verticalFov, horizontalFov);
  return THREE.MathUtils.clamp(radius / Math.sin(limitingFov / 2), 12, 70);
}

export class ThreeEngine {
  private renderer: THREE.WebGLRenderer | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private scene: THREE.Scene | null = null;
  private container: HTMLElement | null = null;
  private animationId: number | null = null;
  private mounted = false;

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
  private buildingFootprints = new Map<string, number>();
  private decks: Map<string, THREE.Mesh> = new Map();
  private astronauts: Astronauts | null = null;
  private badges: ReturnType<typeof createBadges> | null = null;
  private particles: ReturnType<typeof createParticleSystem> | null = null;
  private delegations: Delegations3D | null = null;
  private selectionMarker: AgentSelectionMarker | null = null;
  private agents: Map<string, AstronautState> = new Map();
  private orchestratorRings: Map<string, THREE.Mesh> = new Map();
  private ringGeometry: THREE.TorusGeometry | null = null;
  private ringMaterial: THREE.MeshBasicMaterial | null = null;
  private lastFramedSessionsKey = '';
  private populated = false;
  private colony = new Colony();
  private motion = new AgentMotionController();
  private navGrid: NavGrid = createNavGrid();
  private motionEnvironment: MotionEnvironment | null = null;
  private motionEnvironmentKey = '';
  private motionEnvironmentRevision = 0;
  private reducedMotion = false;
  private activity: ActivityModel | null = null;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private lastScatterKeys = new Set<string>();
  private prevBadges = new Map<string, string>();
  private emitTimers = new Map<string, number>();

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

    // disposeComposer() frees passes plus the composer's own render
    // targets before a fresh composer is built. Disposing passes alone
    // would orphan the old targets on every bloom/SMAA toggle.
    this.disposeComposer();
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
    // Sky wants epoch millis. performance.now() would freeze it near 1970.
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

  isMounted(): boolean {
    return this.mounted && this.scene !== null;
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
    this.delegations = new Delegations3D(this.scene);
    this.delegations.setReducedMotion(this.reducedMotion);
    if (this.activity) this.delegations.reconcile(this.activity.directDelegations);
    this.selectionMarker = new AgentSelectionMarker();
    this.scene.add(this.selectionMarker.getMesh());
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
      density: SCATTER_DENSITY,
      planetPreset: 'terra',
    };
    const occupiedCells = new Map<string, HexCell>();
    this.scatter = createScatterMesh(config, occupiedCells, this.shipPosition(), this.shipRadius());
    this.scene.add(this.scatter);
    this.lastScatterKeys = new Set();
  }

  /**
   * One atomic world sync. Static terrain, ship, and rigs stay mounted.
   * Active session plots, worksites, agents, and orchestrator markers
   * reconcile by stable id. Missing ids leave and dispose.
   */
  syncWorld(world: WorldState): void {
    if (!this.scene) return;
    const sessionIds = world.sessions.map((s) => s.id);
    this.syncPlots(sessionIds);
    const environment = this.buildMotionEnvironment(world.agents);
    this.applyMotionDelta(this.motion.reconcile(world.agents, environment, {
      activeWorldIds: new Set(sessionIds),
    }));
    this.syncOrchestratorMarkers(this.motion.snapshot());
    this.frameSessions(sessionIds);
  }

  syncActivity(activity: ActivityModel): void {
    this.activity = activity;
    this.delegations?.reconcile(activity.directDelegations);
  }

  setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled;
    this.threeCamera?.setReducedMotion(enabled);
    this.delegations?.setReducedMotion(enabled);
    if (enabled) this.particles?.clear();
    this.applyMotionDelta(this.motion.setReducedMotion(enabled));
  }

  setSelectedAgent(agentId: string | null): void {
    this.selectionMarker?.setSelectedAgent(agentId);
    this.selectionMarker?.update(this.agents);
  }

  /** Focus one session plot. Keeps the worksite prominent. */
  focusSession(sessionId: string, distance?: number): void {
    const pos = this.colony.positionOf(sessionId);
    if (pos) {
      this.focusCamera(pos, distance ?? (this.camera ? framingDistance(SESSION_DECK_RADIUS, this.camera) : 14));
    }
  }

  /** Frame every active plot. Used when more than one session is live. */
  frameWorld(): void {
    const positions: THREE.Vector3[] = [];
    for (const id of this.colony.activeIds()) {
      const pos = this.colony.positionOf(id);
      if (pos) positions.push(pos);
    }
    if (positions.length === 0) {
      this.focusCamera(new THREE.Vector3(0, 0, 0), 30);
      return;
    }
    const centroid = positions
      .reduce((acc, p) => acc.add(p.clone()), new THREE.Vector3())
      .multiplyScalar(1 / positions.length);
    let spread = 0;
    for (const p of positions) spread = Math.max(spread, p.distanceTo(centroid));
    const radius = spread + SESSION_DECK_RADIUS;
    this.focusCamera(
      centroid,
      this.camera ? framingDistance(radius, this.camera) : THREE.MathUtils.clamp(12 + spread * 1.2, 16, 60),
    );
  }

  /** Frame only when the session set changes. Agent updates never steal the camera. */
  private frameSessions(sessionIds: string[]): void {
    const key = [...sessionIds].sort().join(',');
    if (key === this.lastFramedSessionsKey) return;
    const hadWorld = this.lastFramedSessionsKey !== '';
    this.lastFramedSessionsKey = key;
    if (hadWorld && this.threeCamera?.hasUserInteracted()) return;
    if (sessionIds.length === 0) {
      this.focusCamera(new THREE.Vector3(0, 0, 0), 30);
    } else if (sessionIds.length === 1) {
      this.focusSession(sessionIds[0]);
    } else {
      this.frameWorld();
    }
  }

  private clipBadgeFor(status: WorldAgent['status']): { clip: string; badge: string; working: boolean } {
    switch (status) {
      case 'working':
        return { clip: 'work', badge: 'working', working: true };
      case 'waiting':
        return { clip: 'sitIdle', badge: 'waiting', working: false };
      case 'success':
        return { clip: 'cheer', badge: 'celebrating', working: false };
      case 'error':
        return { clip: 'sitIdle', badge: 'blocked', working: false };
      case 'idle':
        return { clip: 'sitIdle', badge: 'none', working: false };
    }
  }

  /** Rebuild scatter when the active plot footprint changes so rocks miss decks. */
  private syncScatterFootprint(activeIds: Set<string>): void {
    if (!this.scene || !this.scatter) return;
    const cells = new Map<string, HexCell>();
    for (const plot of this.colony.plotsList()) {
      if (!activeIds.has(plot.floorId)) continue;
      for (const cell of plot.cells) {
        cells.set(hexToKey(cell.q, cell.r), cell);
        for (const neighbor of getNeighbors(cell)) {
          const key = hexToKey(neighbor.q, neighbor.r);
          if (!cells.has(key)) cells.set(key, { q: neighbor.q, r: neighbor.r });
        }
      }
    }
    const keys = new Set(cells.keys());
    if (sameKeys(keys, this.lastScatterKeys)) return;
    this.lastScatterKeys = keys;
    this.scene.remove(this.scatter);
    this.scatter = rebuildScatter(
      this.scatter,
      { halfExtent: 56, density: SCATTER_DENSITY, planetPreset: 'terra' },
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

  /** Active plots only. Fallow Colony records keep their ground for return visits. */
  private syncPlots(sessionIds: string[]): void {
    if (!this.scene) return;

    this.colony.reconcile(sessionIds);
    const active = new Set(this.colony.activeIds());

    for (const floorId of active) {
      const pos = this.colony.positionOf(floorId);
      if (!pos) continue;
      const accent = accentFor(floorId);

      let deck = this.decks.get(floorId);
      if (!deck) {
        const deckGeo = new THREE.CylinderGeometry(SESSION_DECK_RADIUS, SESSION_DECK_RADIUS, DECK_TOP, 6);
        // Base at y=0, top face exactly at DECK_TOP.
        deckGeo.translate(0, DECK_TOP / 2, 0);
        const deckMat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.15 });
        deck = new THREE.Mesh(deckGeo, deckMat);
        deck.receiveShadow = true;
        this.scene.add(deck);
        this.decks.set(floorId, deck);
      }
      deck.position.set(pos.x, 0, pos.z);
      (deck.material as THREE.MeshStandardMaterial).color.copy(accent).multiplyScalar(0.35);

      const existing = this.buildings.get(floorId);
      if (existing) {
        existing.position.set(pos.x, DECK_TOP, pos.z);
        (existing.material as THREE.MeshStandardMaterial).color.copy(accent);
        continue;
      }

      const { geometry, recipe } = createBuildingGeometry(floorId);
      const material = new THREE.MeshStandardMaterial({ color: accent.clone() });
      const mesh = new THREE.Mesh(geometry, material);
      // Footprints run larger than plots. A uniform 0.6 keeps roofs on decks.
      mesh.scale.setScalar(0.6);
      mesh.position.set(pos.x, DECK_TOP, pos.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.buildings.set(floorId, mesh);
      this.buildingFootprints.set(floorId, recipe.footprintRadius * 0.6);
    }

    for (const [id, mesh] of this.buildings) {
      if (!active.has(id)) {
        this.scene?.remove(mesh);
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material.dispose();
        }
        this.buildings.delete(id);
        this.buildingFootprints.delete(id);
      }
    }

    for (const [id, deck] of this.decks) {
      if (!active.has(id)) {
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

    this.syncScatterFootprint(active);
  }

  private buildMotionEnvironment(worldAgents: readonly WorldAgent[]): MotionEnvironment {
    if (!this.ship) throw new Error('Ship must exist before world sync');
    const activeIds = this.colony.activeIds().sort();
    const key = activeIds.map((id) => {
      const position = this.colony.positionOf(id);
      return `${id}:${position?.x ?? 0}:${position?.z ?? 0}:${this.buildingFootprints.get(id) ?? 0}`;
    }).join('|');
    if (key !== this.motionEnvironmentKey) {
      this.motionEnvironmentKey = key;
      this.motionEnvironmentRevision++;
      clearGrid(this.navGrid);
      for (const id of activeIds) {
        const position = this.colony.positionOf(id);
        if (!position) continue;
        rasterizeBuilding(this.navGrid, position, this.buildingFootprints.get(id) ?? 1.5);
      }
      for (const obstacle of getScatterObstacles(this.scatter)) {
        rasterizeCircle(this.navGrid, obstacle.position.x, obstacle.position.z, obstacle.radius);
      }
      rasterizeShip(this.navGrid, this.shipPosition(), 4.5);
    }

    const sites = new Map<string, THREE.Vector3>();
    for (const agent of worldAgents) {
      const home = this.colony.positionOf(agent.worldId);
      if (!home) continue;
      home.y = DECK_TOP;
      sites.set(
        agent.id,
        workSiteForAgent(home, agent, this.buildingFootprints.get(agent.worldId) ?? 1.5),
      );
    }
    this.motionEnvironment = {
      revision: this.motionEnvironmentRevision,
      grid: this.navGrid,
      sites,
      ship: this.ship.getTransit(),
    };
    return this.motionEnvironment;
  }

  private applyMotionDelta(delta: MotionDelta): void {
    if (!this.astronauts) return;
    for (const view of delta.upserted) {
      const semantic = this.clipBadgeFor(view.agent.status);
      const identity = getAgentVisualIdentity(view.agent.agentKey);
      const moving = view.phase !== 'onsite';
      const clip = moving ? 'walk' : semantic.clip;
      const badge = view.phase === 'entering' ? 'spawn' : view.phase === 'leaving' ? 'leave' : semantic.badge;
      const live = this.agents.get(view.agent.id);
      if (!live) {
        const state: AstronautState = {
          id: view.agent.id,
          position: view.position.clone(),
          target: view.target.clone(),
          clip,
          clipTime: 0,
          frame: 0,
          suitColor: suitColorFor(view.agent.agentKey),
          detailColor: new THREE.Color(identity.detail),
          accessory: identity.accessory,
          faceIndex: Math.abs(view.agent.seatIndex) % 16,
          badge,
          working: !moving && semantic.working,
        };
        if (!this.astronauts.addAgent(state)) continue;
        this.agents.set(view.agent.id, state);
      } else {
        live.target.copy(view.target);
        live.position.copy(view.position);
        live.clip = clip;
        live.badge = badge;
        live.working = !moving && semantic.working;
        live.suitColor.copy(suitColorFor(view.agent.agentKey));
        live.detailColor.set(identity.detail);
        live.accessory = identity.accessory;
        live.faceIndex = Math.abs(view.agent.seatIndex) % 16;
        this.astronauts.updateAgent(view.agent.id, live);
      }
    }

    for (const id of delta.removedIds) {
      this.astronauts.removeAgent(id);
      this.badges?.clearBadge(id);
      this.agents.delete(id);
      this.prevBadges.delete(id);
      this.emitTimers.delete(id);
    }

    if (!this.reducedMotion) {
      for (const event of delta.events) {
        const position = this.agents.get(event.agentId)?.position;
        if (!position) continue;
        if (event.type === 'spawned' || event.type === 'arrived') {
          this.particles?.emit('dust', position, 6);
        }
      }
    }
  }

  private ringAssets(): { geometry: THREE.TorusGeometry; material: THREE.MeshBasicMaterial } {
    if (!this.ringGeometry) this.ringGeometry = new THREE.TorusGeometry(0.55, 0.06, 8, 32);
    if (!this.ringMaterial) this.ringMaterial = new THREE.MeshBasicMaterial({ color: 0xffc86a });
    return { geometry: this.ringGeometry, material: this.ringMaterial };
  }

  /** One subtle floating ring per orchestrator. Same size as every agent. */
  private syncOrchestratorMarkers(runtimeAgents: readonly MotionAgentView[]): void {
    if (!this.scene) return;
    const seen = new Set<string>();
    for (const runtime of runtimeAgents) {
      const agent = runtime.agent;
      if (!agent.isOrchestrator) continue;
      const anchor = runtime.position;
      seen.add(agent.id);
      let ring = this.orchestratorRings.get(agent.id);
      if (!ring) {
        const { geometry, material } = this.ringAssets();
        ring = new THREE.Mesh(geometry, material);
        ring.rotation.x = -Math.PI / 2;
        this.scene.add(ring);
        this.orchestratorRings.set(agent.id, ring);
      }
      ring.position.set(anchor.x, anchor.y + 2.6, anchor.z);
    }
    for (const [id, ring] of this.orchestratorRings) {
      if (!seen.has(id)) {
        this.scene.remove(ring);
        this.orchestratorRings.delete(id);
      }
    }
  }

  update(time: number, dt: number): void {
    if (!this.mounted) return;

    const motionDelta = this.motion.advance(dt);
    this.applyMotionDelta(motionDelta);
    this.syncOrchestratorMarkers(motionDelta.upserted);
    this.delegations?.update(time, this.agents);
    this.selectionMarker?.update(this.agents);
    this.astronauts?.update(time, dt);
    if (!this.reducedMotion) this.particles?.update(dt);
    this.syncBadgesAndParticles(dt);

    this.astronauts?.setUniforms({
      uTime: time * 0.001,
      uSunDirection: this.threeSky?.getSunLight()?.position.clone().normalize() ?? new THREE.Vector3(0, 1, 0),
      uSunColor: this.threeSky?.getSunLight()?.color ?? new THREE.Color(0xffffee),
      uSunIntensity: this.threeSky?.getSunLight()?.intensity ?? 1,
      uAmbientColor: this.threeSky?.getAmbientLight()?.color ?? new THREE.Color(0x333344),
      uAmbientIntensity: this.threeSky?.getAmbientLight()?.intensity ?? 0.5,
      uFillDirection: this.threeSky?.getFillLight()?.position.clone().normalize() ?? new THREE.Vector3(-0.5, 0.75, -0.25).normalize(),
      uFillColor: this.threeSky?.getFillLight()?.color ?? new THREE.Color(0x9db8e8),
      uFillIntensity: this.threeSky?.getFillLight()?.intensity ?? 0,
    });
  }

  pickAgent(clientX: number, clientY: number): string | null {
    if (!this.container || !this.camera || !this.astronauts) return null;
    const rect = this.container.getBoundingClientRect();
    this.pointer.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.astronauts.getPickMeshes(), false)
      .find((intersection) => intersection.instanceId !== undefined);
    if (hit?.instanceId === undefined) return null;
    return this.astronauts.getAllAgents()[hit.instanceId]?.id ?? null;
  }

  private toBadgeType(value: string): BadgeType {
    switch (value) {
      case 'blocked':
      case 'working':
      case 'waiting':
      case 'celebrating':
      case 'spawn':
      case 'leave':
        return value;
      default:
        return 'none';
    }
  }

  /** Badges mirror poses. Particles fire on work beats, cheer entries, sleep. */
  private syncBadgesAndParticles(dt: number): void {
    if (!this.astronauts) return;
    for (const [id, agent] of this.agents) {
      const badge = agent.badge;
      const head = agent.position.clone();
      head.y += 2.2;
      this.badges?.setBadge(id, this.toBadgeType(badge), agent.position, agent.suitColor);

      const prev = this.prevBadges.get(id);
      if (!this.reducedMotion && prev !== 'celebrating' && badge === 'celebrating') {
        this.particles?.emit('confetti', head, 12);
      }
      this.prevBadges.set(id, badge);

      const timer = (this.emitTimers.get(id) ?? 0) + dt;
      if (!this.reducedMotion && badge === 'working' && timer > 0.8) {
        this.particles?.emit('spark', head, 3);
        this.emitTimers.set(id, 0);
      } else if (!this.reducedMotion && badge === 'none' && timer > 2) {
        this.particles?.emit('z', head, 1);
        this.emitTimers.set(id, 0);
      } else {
        this.emitTimers.set(id, timer);
      }
    }
    if (this.camera) {
      this.badges?.updateView(this.camera.quaternion);
    }
  }

  private dispose(): void {
    this.threeCamera?.dispose();
    this.threeSky?.dispose();
    this.threeCamera = null;
    this.threeSky = null;

    this.badges?.dispose();
    this.particles?.dispose();
    this.astronauts?.dispose();
    this.delegations?.dispose();
    if (this.selectionMarker) {
      this.scene?.remove(this.selectionMarker.getMesh());
      this.selectionMarker.dispose();
    }
    this.ship?.dispose();

    for (const ring of this.orchestratorRings.values()) {
      this.scene?.remove(ring);
    }
    this.orchestratorRings.clear();
    this.ringGeometry?.dispose();
    this.ringMaterial?.dispose();
    this.ringGeometry = null;
    this.ringMaterial = null;

    for (const mesh of this.buildings.values()) {
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      } else {
        mesh.material.dispose();
      }
    }
    this.buildings.clear();
    this.buildingFootprints.clear();

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

    this.renderer?.dispose();

    // Drop every runtime registry so the next mount starts clean.
    // Stale agent ids on a fresh Astronauts registry render invisible agents.
    this.badges = null;
    this.particles = null;
    this.astronauts = null;
    this.delegations = null;
    this.selectionMarker = null;
    this.ship = null;
    this.terrain = null;
    this.scatter = null;
    this.lastFramedSessionsKey = '';
    this.buildings.clear();
    this.decks.clear();
    this.lastScatterKeys = new Set();
    this.agents.clear();
    this.activity = null;
    this.motion.reset();
    this.navGrid = createNavGrid();
    this.motionEnvironment = null;
    this.motionEnvironmentKey = '';
    this.motionEnvironmentRevision = 0;
    this.prevBadges.clear();
    this.emitTimers.clear();
    this.populated = false;
  }
}

export const threeEngine = new ThreeEngine();
