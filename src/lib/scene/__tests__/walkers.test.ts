import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { stepToward, WALK_SPEED, ARRIVE_DISTANCE } from '../walkers';

describe('stepToward', () => {
  it('moves toward the target at speed times dt', () => {
    const pos = new THREE.Vector3(0, 0, 0);
    const target = new THREE.Vector3(10, 0, 0);
    const arrived = stepToward(pos, target, WALK_SPEED, 1);
    expect(arrived).toBe(false);
    expect(pos.x).toBeCloseTo(2.5, 5);
    expect(pos.z).toBeCloseTo(0, 5);
  });

  it('snaps and reports arrival inside the radius', () => {
    const pos = new THREE.Vector3(9.9, 0, 0);
    const target = new THREE.Vector3(10, 0.6, 0);
    expect(stepToward(pos, target, WALK_SPEED, 1)).toBe(true);
    expect(pos.x).toBeCloseTo(10, 5);
    expect(pos.y).toBeGreaterThan(0);
  });

  it('never overshoots on large dt', () => {
    const pos = new THREE.Vector3(0, 0, 0);
    const target = new THREE.Vector3(1, 0, 0);
    stepToward(pos, target, WALK_SPEED, 10);
    expect(pos.x).toBeLessThanOrEqual(1 + ARRIVE_DISTANCE);
  });
});
