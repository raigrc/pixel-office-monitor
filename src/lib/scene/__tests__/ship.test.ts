import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Ship } from '../ship';

describe('Ship transit anchors', () => {
  it('places airlock and ramp between ship and colony', () => {
    const ship = new Ship({ position: new THREE.Vector3(0, 0, -44), scale: 0.45 });
    const transit = ship.getTransit();

    expect(transit.airlock.z).toBeGreaterThan(-44);
    expect(transit.rampTop.z).toBeGreaterThanOrEqual(transit.airlock.z);
    expect(transit.rampBottom.z).toBeGreaterThan(transit.rampTop.z);
    expect(transit.rampTop.y).toBeGreaterThan(transit.rampBottom.y);
    expect(transit.rampBottom.y).toBeCloseTo(0, 5);
    expect(transit.rampTop.distanceTo(ship.getRampTop())).toBe(0);

    ship.dispose();
  });
});
