import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Ship } from '../ship';
import { COZY_THEME } from '../../cozy-theme';

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
    expect(transit.airlock.y).toBeCloseTo(1.125, 5);
    expect(transit.airlock.z).toBeCloseTo(-40.175, 5);
    expect(transit.rampTop.y).toBeCloseTo(1.35, 5);
    expect(transit.rampTop.z).toBeCloseTo(-39.95, 5);
    expect(transit.rampBottom.z).toBeCloseTo(-34.55, 5);

    const group = ship.getGroup();
    expect(group.position).toEqual(new THREE.Vector3(0, 0, -44));
    expect(group.scale).toEqual(new THREE.Vector3(0.45, 0.45, 0.45));

    const hull = group.getObjectByName('utility-shuttle-hull') as THREE.Mesh;
    const trim = group.getObjectByName('utility-shuttle-trim') as THREE.Mesh;
    const windows = group.getObjectByName('utility-shuttle-windows') as THREE.Mesh;
    expect((hull.material as THREE.MeshStandardMaterial).color.getHex()).toBe(
      new THREE.Color(COZY_THEME.environment.floor).getHex(),
    );
    expect((trim.material as THREE.MeshStandardMaterial).color.getHex()).toBe(
      new THREE.Color(COZY_THEME.semantic.success).getHex(),
    );
    expect((windows.material as THREE.MeshStandardMaterial).emissive.getHex()).toBe(
      new THREE.Color(COZY_THEME.environment.lamp).getHex(),
    );
    let dynamicLights = 0;
    group.traverse((object) => {
      if (object instanceof THREE.Light) dynamicLights++;
    });
    expect(dynamicLights).toBe(0);

    ship.dispose();
  });
});
