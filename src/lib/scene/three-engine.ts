import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { ThreeCamera, CameraState } from './three-camera';
import { ThreeSky, SkyConfig, SkyPreset } from './three-sky';

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

    if (this.renderer && this.container) {
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
    const dt = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;

    this.updateFPS(now);

    if (this.config.autoQuality) {
      this.governQuality(now);
    }

    this.threeCamera.update(dt);
    this.threeSky.update(now);

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

  private dispose(): void {
    this.threeCamera?.dispose();
    this.threeSky?.dispose();
    this.threeCamera = null;
    this.threeSky = null;

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