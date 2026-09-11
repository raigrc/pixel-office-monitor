import * as THREE from 'three';

export interface CameraState {
  azimuth: number;
  polar: number;
  distance: number;
  target: THREE.Vector3;
}

export class ThreeCamera {
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;

  private state: CameraState = {
    azimuth: -Math.PI / 4,
    polar: Math.PI / 3.2,
    distance: 30,
    target: new THREE.Vector3(0, 0, 0),
  };

  private targetState: CameraState = { ...this.state, target: this.state.target.clone() };
  private isDragging = false;
  private dragType: 'pan' | 'orbit' | null = null;
  private lastPointer = new THREE.Vector2();
  private pinnedGround: THREE.Vector3 | null = null;
  private activePointers = new Map<number, THREE.Vector2>();
  private pinchDistance: number | null = null;
  private lastInteractionTime = 0;
  private idleTimer: number | null = null;
  private idleAnimation: number | null = null;
  private reducedMotion = false;
  private userInteracted = false;

  private readonly MIN_DISTANCE = 5;
  private readonly MAX_DISTANCE = 80;
  private readonly MIN_POLAR = 0.15;
  private readonly MAX_POLAR = Math.PI / 2 - 0.05;
  private readonly IDLE_DELAY = 2200;
  private readonly REST_AZIMUTH_STEP = Math.PI / 4;
  private readonly REST_POLAR = Math.PI / 3.2;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.updateCamera();
    this.attachListeners();
  }

  private attachListeners(): void {
    this.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.domElement.addEventListener('pointermove', this.onPointerMove);
    this.domElement.addEventListener('pointerup', this.onPointerUp);
    this.domElement.addEventListener('pointercancel', this.onPointerUp);
    this.domElement.addEventListener('lostpointercapture', this.onPointerUp);
    this.domElement.addEventListener('wheel', this.onWheel, { passive: false });
    this.domElement.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('blur', this.cancelGesture);
  }

  private detachListeners(): void {
    this.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.domElement.removeEventListener('pointermove', this.onPointerMove);
    this.domElement.removeEventListener('pointerup', this.onPointerUp);
    this.domElement.removeEventListener('pointercancel', this.onPointerUp);
    this.domElement.removeEventListener('lostpointercapture', this.onPointerUp);
    this.domElement.removeEventListener('wheel', this.onWheel);
    this.domElement.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('blur', this.cancelGesture);
  }

  private onContextMenu = (event: Event): void => event.preventDefault();

  private onPointerDown = (event: PointerEvent): void => {
    this.userInteracted = true;
    try {
      this.domElement.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic test events may not have capturable pointers.
    }
    this.activePointers.set(event.pointerId, new THREE.Vector2(event.clientX, event.clientY));
    if (this.activePointers.size === 2) {
      const [a, b] = [...this.activePointers.values()];
      this.pinchDistance = a.distanceTo(b);
      this.isDragging = false;
      this.dragType = null;
      this.pinnedGround = null;
      this.resetIdleTimer();
      return;
    }
    if (event.button === 0 && !event.shiftKey && !event.ctrlKey) {
      this.dragType = 'pan';
    } else if (event.button === 2 || event.button === 0 && (event.shiftKey || event.ctrlKey)) {
      this.dragType = 'orbit';
      event.preventDefault();
    } else {
      return;
    }

    this.isDragging = true;
    this.lastPointer.set(event.clientX, event.clientY);
    this.pinnedGround = this.dragType === 'pan'
      ? this.groundPointAt(event.clientX, event.clientY)
      : null;
    this.resetIdleTimer();
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (this.activePointers.has(event.pointerId)) {
      this.activePointers.set(event.pointerId, new THREE.Vector2(event.clientX, event.clientY));
    }
    if (this.activePointers.size === 2) {
      const [a, b] = [...this.activePointers.values()];
      const distance = a.distanceTo(b);
      if (this.pinchDistance && distance > 0) {
        this.zoom(
          this.pinchDistance / distance,
          (a.x + b.x) / 2,
          (a.y + b.y) / 2,
        );
      }
      this.pinchDistance = distance;
      this.resetIdleTimer();
      return;
    }
    if (!this.isDragging) return;

    const dx = event.clientX - this.lastPointer.x;
    const dy = event.clientY - this.lastPointer.y;
    this.lastPointer.set(event.clientX, event.clientY);

    if (this.dragType === 'pan') {
      this.pan(event.clientX, event.clientY);
    } else if (this.dragType === 'orbit') {
      this.orbit(dx, dy);
    }

    this.resetIdleTimer();
  };

  private onPointerUp = (event: PointerEvent): void => {
    this.activePointers.delete(event.pointerId);
    this.pinchDistance = null;
    if (this.activePointers.size === 1) {
      const [point] = this.activePointers.values();
      this.isDragging = true;
      this.dragType = 'pan';
      this.lastPointer.copy(point);
      this.pinnedGround = this.groundPointAt(point.x, point.y);
    } else {
      this.isDragging = false;
      this.dragType = null;
      this.pinnedGround = null;
    }
    try {
      if (this.domElement.hasPointerCapture?.(event.pointerId)) {
        this.domElement.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Pointer already released. Nothing to drop.
    }
    this.resetIdleTimer();
  };

  private onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.userInteracted = true;
    const delta = event.deltaY > 0 ? 1.1 : 1 / 1.1;
    this.zoom(delta, event.clientX, event.clientY);
    this.resetIdleTimer();
  };

  private cancelGesture = (): void => {
    this.isDragging = false;
    this.dragType = null;
    this.pinnedGround = null;
    this.activePointers.clear();
    this.pinchDistance = null;
  };

  private groundPointAt(clientX: number, clientY: number): THREE.Vector3 | null {
    const rect = this.domElement.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return null;
    this.camera.updateMatrixWorld();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    ), this.camera);
    return ray.ray.intersectPlane(
      new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
      new THREE.Vector3(),
    );
  }

  private pan(clientX: number, clientY: number): void {
    if (!this.pinnedGround) return;
    const current = this.groundPointAt(clientX, clientY);
    if (!current) return;
    this.targetState.target.add(this.pinnedGround.clone().sub(current));
    this.targetState.target.y = 0;
  }

  private orbit(dx: number, dy: number): void {
    this.targetState.azimuth -= dx * 0.005;
    this.targetState.polar = THREE.MathUtils.clamp(
      this.targetState.polar + dy * 0.005,
      this.MIN_POLAR,
      this.MAX_POLAR
    );
  }

  private zoom(delta: number, clientX: number, clientY: number): void {
    const intersectPoint = this.groundPointAt(clientX, clientY);

    const newDistance = THREE.MathUtils.clamp(
      this.targetState.distance * delta,
      this.MIN_DISTANCE,
      this.MAX_DISTANCE
    );

    if (intersectPoint) {
      const towardPointer = intersectPoint.clone().sub(this.targetState.target);
      towardPointer.multiplyScalar(1 - newDistance / this.targetState.distance);
      this.targetState.target.add(towardPointer);
      this.targetState.target.y = 0;
    }

    this.targetState.distance = newDistance;
  }

  private resetIdleTimer(): void {
    this.lastInteractionTime = performance.now();
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
    }
    if (this.idleAnimation !== null) {
      cancelAnimationFrame(this.idleAnimation);
      this.idleAnimation = null;
    }
    if (this.reducedMotion) return;
    this.idleTimer = window.setTimeout(() => this.startIdleEase(), this.IDLE_DELAY);
  }

  private startIdleEase(): void {
    this.idleTimer = null;
    const easeToRest = () => {
      const now = performance.now();
      if (now - this.lastInteractionTime < this.IDLE_DELAY) return;

      const azimuthDiff = this.normalizeAngle(this.targetState.azimuth - this.getNearestRestAzimuth());
      const polarDiff = this.targetState.polar - this.REST_POLAR;

      if (Math.abs(azimuthDiff) > 0.001 || Math.abs(polarDiff) > 0.001) {
        this.targetState.azimuth -= azimuthDiff * 0.02;
        this.targetState.polar -= polarDiff * 0.02;
        this.idleAnimation = requestAnimationFrame(easeToRest);
      } else {
        this.targetState.azimuth = this.getNearestRestAzimuth();
        this.targetState.polar = this.REST_POLAR;
        this.idleAnimation = null;
      }
    };
    easeToRest();
  }

  private getNearestRestAzimuth(): number {
    const steps = Math.PI * 2 / this.REST_AZIMUTH_STEP;
    const currentStep = Math.round(this.targetState.azimuth / this.REST_AZIMUTH_STEP);
    return (currentStep % steps) * this.REST_AZIMUTH_STEP;
  }

  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }

  update(dt: number): void {
    if (this.reducedMotion) {
      this.applyTargetImmediately();
      return;
    }
    const lerpFactor = 1 - Math.exp(-dt * 8);

    this.state.azimuth = THREE.MathUtils.lerp(this.state.azimuth, this.targetState.azimuth, lerpFactor);
    this.state.polar = THREE.MathUtils.lerp(this.state.polar, this.targetState.polar, lerpFactor);
    this.state.distance = THREE.MathUtils.lerp(this.state.distance, this.targetState.distance, lerpFactor);
    this.state.target.lerp(this.targetState.target, lerpFactor);

    this.updateCamera();
  }

  private updateCamera(): void {
    const { azimuth, polar, distance, target } = this.state;

    const x = distance * Math.sin(polar) * Math.sin(azimuth);
    const y = distance * Math.cos(polar);
    const z = distance * Math.sin(polar) * Math.cos(azimuth);

    this.camera.position.set(target.x + x, target.y + y, target.z + z);
    this.camera.lookAt(target);
  }

  focus(point: THREE.Vector3, distance?: number): void {
    this.targetState.target.copy(point);
    if (distance !== undefined) {
      this.targetState.distance = THREE.MathUtils.clamp(distance, this.MIN_DISTANCE, this.MAX_DISTANCE);
    }
    if (this.reducedMotion) this.applyTargetImmediately();
    this.resetIdleTimer();
  }

  setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled;
    if (enabled) {
      if (this.idleTimer !== null) clearTimeout(this.idleTimer);
      if (this.idleAnimation !== null) cancelAnimationFrame(this.idleAnimation);
      this.idleTimer = null;
      this.idleAnimation = null;
      this.applyTargetImmediately();
    }
  }

  private applyTargetImmediately(): void {
    this.state.azimuth = this.targetState.azimuth;
    this.state.polar = this.targetState.polar;
    this.state.distance = this.targetState.distance;
    this.state.target.copy(this.targetState.target);
    this.updateCamera();
  }

  getState(): CameraState {
    return { ...this.state, target: this.state.target.clone() };
  }

  setState(state: Partial<CameraState>): void {
    if (state.azimuth !== undefined) this.targetState.azimuth = state.azimuth;
    if (state.polar !== undefined) this.targetState.polar = THREE.MathUtils.clamp(state.polar, this.MIN_POLAR, this.MAX_POLAR);
    if (state.distance !== undefined) this.targetState.distance = THREE.MathUtils.clamp(state.distance, this.MIN_DISTANCE, this.MAX_DISTANCE);
    if (state.target !== undefined) this.targetState.target.copy(state.target);
    if (this.reducedMotion) this.applyTargetImmediately();
    this.resetIdleTimer();
  }

  dispose(): void {
    this.detachListeners();
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
    }
    if (this.idleAnimation !== null) {
      cancelAnimationFrame(this.idleAnimation);
    }
    this.cancelGesture();
  }

  hasUserInteracted(): boolean {
    return this.userInteracted;
  }
}
