import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { MIN_CAMERA_DISTANCE, THREE_CAMERA_NEAR, ThreeCamera } from '../three-camera';
import { framingDistance } from '../three-engine';

class CameraElement extends EventTarget {
  private captures = new Set<number>();

  getBoundingClientRect(): DOMRect {
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      toJSON: () => ({}),
    };
  }

  setPointerCapture(id: number): void {
    this.captures.add(id);
  }

  hasPointerCapture(id: number): boolean {
    return this.captures.has(id);
  }

  releasePointerCapture(id: number): void {
    this.captures.delete(id);
  }
}

function pointer(type: string, values: Partial<PointerEvent>): Event {
  const event = new Event(type, { cancelable: true });
  for (const [key, value] of Object.entries(values)) {
    Object.defineProperty(event, key, { value });
  }
  return event;
}

describe('ThreeCamera Phase 2 interactions', () => {
  let host: EventTarget;

  beforeEach(() => {
    host = new EventTarget();
    Object.assign(host, { setTimeout, clearTimeout });
    vi.stubGlobal('window', host);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(performance.now()), 16));
    vi.stubGlobal('cancelAnimationFrame', (id: ReturnType<typeof setTimeout>) => clearTimeout(id));
  });

  afterEach(() => vi.unstubAllGlobals());

  it('smooths focus without mutating current target immediately', () => {
    const camera = new THREE.PerspectiveCamera(50, 4 / 3, 0.1, 200);
    const controller = new ThreeCamera(camera, new CameraElement() as HTMLElement);

    controller.focus(new THREE.Vector3(8, 0, 4), 20);
    expect(controller.getState().target.length()).toBe(0);
    controller.update(0.1);
    expect(controller.getState().target.length()).toBeGreaterThan(0);
    expect(controller.getState().target.distanceTo(new THREE.Vector3(8, 0, 4))).toBeGreaterThan(0);
    controller.dispose();
  });

  it('accumulates orbit movement across pointer events', () => {
    const camera = new THREE.PerspectiveCamera(50, 4 / 3, 0.1, 200);
    const element = new CameraElement();
    const controller = new ThreeCamera(camera, element as HTMLElement);
    const initial = controller.getState().azimuth;

    element.dispatchEvent(pointer('pointerdown', { pointerId: 1, button: 2, clientX: 0, clientY: 0 }));
    element.dispatchEvent(pointer('pointermove', { pointerId: 1, clientX: 10, clientY: 0 }));
    element.dispatchEvent(pointer('pointermove', { pointerId: 1, clientX: 20, clientY: 0 }));
    controller.update(1);

    expect(controller.getState().azimuth).toBeCloseTo(initial - 0.1, 3);
    expect(controller.hasUserInteracted()).toBe(true);
    controller.dispose();
  });

  it('snaps focus and disables idle easing under reduced motion', () => {
    const camera = new THREE.PerspectiveCamera(50, 4 / 3, 0.1, 200);
    const controller = new ThreeCamera(camera, new CameraElement() as HTMLElement);
    controller.setReducedMotion(true);

    controller.focus(new THREE.Vector3(3, 0, -2), 12);

    expect(controller.getState().target).toEqual(new THREE.Vector3(3, 0, -2));
    expect(controller.getState().distance).toBe(12);

    const beforeOrbit = controller.getState().azimuth;
    const element = new CameraElement();
    controller.dispose();
    const gestureController = new ThreeCamera(camera, element as HTMLElement);
    gestureController.setReducedMotion(true);
    element.dispatchEvent(pointer('pointerdown', { pointerId: 1, button: 2, clientX: 0, clientY: 0 }));
    element.dispatchEvent(pointer('pointermove', { pointerId: 1, clientX: 20, clientY: 0 }));
    gestureController.update(1 / 60);
    expect(gestureController.getState().azimuth).toBeCloseTo(beforeOrbit - 0.1, 5);
    gestureController.dispose();
  });

  it('hands a pinch back to one-finger pan', () => {
    const camera = new THREE.PerspectiveCamera(50, 4 / 3, 0.1, 200);
    const element = new CameraElement();
    const controller = new ThreeCamera(camera, element as HTMLElement);

    element.dispatchEvent(pointer('pointerdown', { pointerId: 1, button: 0, clientX: 300, clientY: 300 }));
    element.dispatchEvent(pointer('pointerdown', { pointerId: 2, button: 0, clientX: 500, clientY: 300 }));
    element.dispatchEvent(pointer('pointerup', { pointerId: 2, button: 0, clientX: 500, clientY: 300 }));
    element.dispatchEvent(pointer('pointermove', { pointerId: 1, clientX: 340, clientY: 300 }));
    controller.update(1);

    expect(controller.getState().target.length()).toBeGreaterThan(0);
    controller.dispose();
  });

  it('ignores controls while paused and resumes without resetting camera state', () => {
    const camera = new THREE.PerspectiveCamera(50, 4 / 3, 0.1, 200);
    const element = new CameraElement();
    const controller = new ThreeCamera(camera, element as HTMLElement);
    const initial = controller.getState();

    controller.setPaused(true);
    element.dispatchEvent(pointer('pointerdown', { pointerId: 1, button: 2, clientX: 0, clientY: 0 }));
    element.dispatchEvent(pointer('pointermove', { pointerId: 1, clientX: 40, clientY: 0 }));
    element.dispatchEvent(pointer('wheel', { deltaY: -1, clientX: 400, clientY: 300 }));
    controller.update(1);
    expect(controller.getState()).toEqual(initial);

    controller.setPaused(false);
    element.dispatchEvent(pointer('pointerdown', { pointerId: 2, button: 2, clientX: 0, clientY: 0 }));
    element.dispatchEvent(pointer('pointermove', { pointerId: 2, clientX: 20, clientY: 0 }));
    controller.update(1);
    expect(controller.getState().azimuth).toBeCloseTo(initial.azimuth - 0.1, 3);
    controller.dispose();
  });

  it('backs up farther for a narrow portrait viewport', () => {
    const landscape = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 200);
    const portrait = new THREE.PerspectiveCamera(50, 390 / 844, 0.1, 200);

    expect(framingDistance(3.6, portrait)).toBeGreaterThan(framingDistance(3.6, landscape));
  });

  it('uses the same safe minimum distance for wheel and pinch zoom', () => {
    expect(THREE_CAMERA_NEAR).toBe(0.1);
    const wheelElement = new CameraElement();
    const wheelController = new ThreeCamera(
      new THREE.PerspectiveCamera(50, 4 / 3, THREE_CAMERA_NEAR, 200),
      wheelElement as HTMLElement,
    );
    wheelController.setReducedMotion(true);
    for (let index = 0; index < 30; index++) {
      wheelElement.dispatchEvent(pointer('wheel', { deltaY: -1, clientX: 400, clientY: 300 }));
    }
    wheelController.update(0);

    const pinchElement = new CameraElement();
    const pinchController = new ThreeCamera(
      new THREE.PerspectiveCamera(50, 4 / 3, THREE_CAMERA_NEAR, 200),
      pinchElement as HTMLElement,
    );
    pinchController.setReducedMotion(true);
    pinchElement.dispatchEvent(pointer('pointerdown', { pointerId: 1, button: 0, clientX: 300, clientY: 300 }));
    pinchElement.dispatchEvent(pointer('pointerdown', { pointerId: 2, button: 0, clientX: 500, clientY: 300 }));
    pinchElement.dispatchEvent(pointer('pointermove', { pointerId: 2, clientX: 5000, clientY: 300 }));
    pinchController.update(0);

    expect(wheelController.getState().distance).toBe(MIN_CAMERA_DISTANCE);
    expect(pinchController.getState().distance).toBe(MIN_CAMERA_DISTANCE);
    wheelController.dispose();
    pinchController.dispose();
  });

  it('keeps camera outside the inspected target at minimum zoom', () => {
    const camera = new THREE.PerspectiveCamera(50, 4 / 3, THREE_CAMERA_NEAR, 200);
    const controller = new ThreeCamera(camera, new CameraElement() as HTMLElement);
    controller.setReducedMotion(true);
    controller.focus(new THREE.Vector3(3, 0.45, -2), 0);

    const state = controller.getState();
    expect(state.distance).toBe(MIN_CAMERA_DISTANCE);
    expect(camera.position.distanceTo(state.target)).toBeCloseTo(MIN_CAMERA_DISTANCE, 5);
    controller.dispose();
  });
});
