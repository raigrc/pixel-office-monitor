import * as THREE from 'three';

export const WALK_SPEED = 2.5;
export const LEAVE_SPEED = 4;
export const ARRIVE_DISTANCE = 0.25;

/**
 * Steps a walker toward its target on the ground plane, easing height
 * toward the target level. Returns true on arrival.
 */
export function stepToward(position: THREE.Vector3, target: THREE.Vector3, speed: number, dt: number): boolean {
  const dx = target.x - position.x;
  const dz = target.z - position.z;
  const dist = Math.hypot(dx, dz);
  position.y += (target.y - position.y) * Math.min(1, dt * 3);
  if (dist < ARRIVE_DISTANCE) {
    position.x = target.x;
    position.z = target.z;
    return true;
  }
  const step = Math.min(speed * dt, dist);
  position.x += (dx / dist) * step;
  position.z += (dz / dist) * step;
  return false;
}
