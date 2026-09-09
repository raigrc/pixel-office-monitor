import * as THREE from 'three';

export class ThreeEngine {
  private renderer: THREE.WebGLRenderer | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private scene: THREE.Scene | null = null;
  private container: HTMLElement | null = null;
  private animationId: number | null = null;
  private mounted = false;
  private currentViewMode: '2d' | '3d' = '2d';

  mount(container: HTMLElement): void {
    if (this.mounted) return;

    this.container = container;
    this.mounted = true;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      200
    );
    this.camera.position.set(0, 15, 25);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    container.appendChild(this.renderer.domElement);

    this.startRenderLoop();
  }

  unmount(): void {
    if (!this.mounted) return;

    this.stopRenderLoop();

    if (this.renderer && this.container) {
      this.container.removeChild(this.renderer.domElement);
    }

    this.dispose();

    this.renderer = null;
    this.camera = null;
    this.scene = null;
    this.container = null;
    this.mounted = false;
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
    if (!this.renderer || !this.scene || !this.camera) return;
    this.renderer.render(this.scene, this.camera);
  }

  resize(): void {
    if (!this.renderer || !this.camera || !this.container) return;

    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
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

  private dispose(): void {
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