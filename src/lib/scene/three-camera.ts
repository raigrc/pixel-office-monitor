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

  private targetState: CameraState = { ...this.state };
  private isDragging = false;
  private dragType: 'pan' | 'orbit' | null = null;
  private lastPointer = new THREE.Vector2();
  private dragStartState: CameraState | null = null;
  private lastInteractionTime = 0;
  private idleTimer: number | null = null;

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
    this.domElement.addEventListener('wheel', this.onWheel, { passive: false });
    this.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);

    this.handleTouch = this.handleTouch.bind(this);
    this.domElement.addEventListener('touchstart', this.handleTouch, { passive: false });
    this.domElement.addEventListener('touchmove', this.handleTouch, { passive: false });
    this.domElement.addEventListener('touchend', this.handleTouch);
  }

  private detachListeners(): void {
    this.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.domElement.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.domElement.removeEventListener('touchstart', this.handleTouch);
    this.domElement.removeEventListener('touchmove', this.handleTouch);
    this.domElement.removeEventListener('touchend', this.handleTouch);
  }

  private onPointerDown = (event: PointerEvent): void => {
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
    this.dragStartState = { ...this.state, target: this.state.target.clone() };
    this.resetIdleTimer();
    this.domElement.setPointerCapture(event.pointerId);
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.isDragging || !this.dragStartState) return;

    const dx = event.clientX - this.lastPointer.x;
    const dy = event.clientY - this.lastPointer.y;
    this.lastPointer.set(event.clientX, event.clientY);

    if (this.dragType === 'pan') {
      this.pan(dx, dy);
    } else if (this.dragType === 'orbit') {
      this.orbit(dx, dy);
    }

    this.resetIdleTimer();
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.dragType = null;
    this.dragStartState = null;
    this.domElement.releasePointerCapture(event.pointerId);
    this.resetIdleTimer();
  };

  private onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? 1.1 : 1 / 1.1;
    this.zoom(delta, event.clientX, event.clientY);
    this.resetIdleTimer();
  };

  private handleTouch(event: TouchEvent): void {
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      const simulatedEvent = new PointerEvent('pointermove', {
        clientX: touch.clientX,
        clientY: touch.clientY,
      });
      if (event.type === 'touchstart') {
        this.onPointerDown(new PointerEvent('pointerdown', {
          clientX: touch.clientX,
          clientY: touch.clientY,
          button: 0,
        }));
      } else if (event.type === 'touchmove') {
        this.onPointerMove(simulatedEvent);
      } else {
        this.onPointerUp(new PointerEvent('pointerup', {
          clientX: touch.clientX,
          clientY: touch.clientY,
        }));
      }
    } else if (event.touches.length === 2) {
      event.preventDefault();
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      const dist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
      if (this.lastTouchDist !== null) {
        const delta = dist / this.lastTouchDist;
        this.zoom(1 / delta, (touch1.clientX + touch2.clientX) / 2, (touch1.clientY + touch2.clientY) / 2);
      }
      this.lastTouchDist = dist;
      this.resetIdleTimer();
    } else {
      this.lastTouchDist = null;
    }
  }

  private lastTouchDist: number | null = null;

  private pan(dx: number, dy: number): void {
    if (!this.dragStartState) return;

    const distance = this.state.distance;
    const panSpeed = distance * 0.0015;

    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    const up = new THREE.Vector3(0, 1, 0);

    this.targetState.target.addScaledVector(right, -dx * panSpeed);
    this.targetState.target.addScaledVector(up, dy * panSpeed);
    this.targetState.target.addScaledVector(forward, -dy * panSpeed * 0.3);
  }

  private orbit(dx: number, dy: number): void {
    if (!this.dragStartState) return;

    this.targetState.azimuth = this.dragStartState.azimuth - dx * 0.005;
    this.targetState.polar = THREE.MathUtils.clamp(
      this.dragStartState.polar + dy * 0.005,
      this.MIN_POLAR,
      this.MAX_POLAR
    );
  }

  private zoom(delta: number, clientX: number, clientY: number): void {
    const rect = this.domElement.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;

    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);

    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersectPoint = new THREE.Vector3();
    ray.ray.intersectPlane(groundPlane, intersectPoint);

    const newDistance = THREE.MathUtils.clamp(
      this.state.distance * delta,
      this.MIN_DISTANCE,
      this.MAX_DISTANCE
    );

    if (intersectPoint.x !== 0 || intersectPoint.z !== 0) {
      const toTarget = new THREE.Vector3().subVectors(this.state.target, intersectPoint);
      const currentDist = this.state.distance;
      toTarget.multiplyScalar(1 - newDistance / currentDist);
      this.targetState.target.add(toTarget);
    }

    this.targetState.distance = newDistance;
  }

  private resetIdleTimer(): void {
    this.lastInteractionTime = performance.now();
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
    }
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
        requestAnimationFrame(easeToRest);
      } else {
        this.targetState.azimuth = this.getNearestRestAzimuth();
        this.targetState.polar = this.REST_POLAR;
      }
    };
    easeToRest();
  }

  private getNearestRestAzimuth(): number {
    const steps = Math.PI * 2 / this.REST_AZIMUTH_STEP;
    const currentStep = Math.round(this.state.azimuth / this.REST_AZIMUTH_STEP);
    return (currentStep % steps) * this.REST_AZIMUTH_STEP;
  }

  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }

  update(dt: number): void {
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
    this.resetIdleTimer();
  }

  getState(): CameraState {
    return { ...this.state, target: this.state.target.clone() };
  }

  setState(state: Partial<CameraState>): void {
    if (state.azimuth !== undefined) this.targetState.azimuth = state.azimuth;
    if (state.polar !== undefined) this.targetState.polar = THREE.MathUtils.clamp(state.polar, this.MIN_POLAR, this.MAX_POLAR);
    if (state.distance !== undefined) this.targetState.distance = THREE.MathUtils.clamp(state.distance, this.MIN_DISTANCE, this.MAX_DISTANCE);
    if (state.target !== undefined) this.targetState.target.copy(state.target);
    this.resetIdleTimer();
  }

  dispose(): void {
    this.detachListeners();
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
    }
  }
}