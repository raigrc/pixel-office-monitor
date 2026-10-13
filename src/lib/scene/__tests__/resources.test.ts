import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createShip } from '../ship';
import { createScatterMesh, rebuildScatter } from '../scatter';

describe('Ship beacon ownership (1.1F)', () => {
  it('disposes the shared beacon geometry/material exactly once', () => {
    const ship = createShip({ position: new THREE.Vector3(0, 0, -44), scale: 0.45 });
    const lights = ship
      .getGroup()
      .children.filter((c): c is THREE.Mesh => c instanceof THREE.Mesh)
      .filter((m) => m.geometry instanceof THREE.SphereGeometry && m.geometry.parameters.radius === 0.3);
    expect(lights.length).toBe(2);
    expect(lights[0].geometry).toBe(lights[1].geometry);
    expect(lights[0].material).toBe(lights[1].material);

    const geoDispose = vi.spyOn(lights[0].geometry, 'dispose');
    const matDispose = vi.spyOn(lights[0].material as THREE.Material, 'dispose');

    ship.dispose();
    expect(geoDispose).toHaveBeenCalledTimes(1);
    expect(matDispose).toHaveBeenCalledTimes(1);

    // Teardown is idempotent for repeated mount/unmount cycles.
    ship.dispose();
    expect(geoDispose).toHaveBeenCalledTimes(1);
    expect(matDispose).toHaveBeenCalledTimes(1);
  });
});

describe('Scatter rebuild ownership (1.1F)', () => {
  it('disposes the replaced mesh geometry/material exactly once', () => {
    const config = { halfExtent: 6, density: 1, planetPreset: 'terra' as const };
    const mesh = createScatterMesh(config, new Map(), new THREE.Vector3(0, 0, -44), 15);
    const geoDispose = vi.spyOn(mesh.geometry, 'dispose');
    const matDispose = vi.spyOn(mesh.material as THREE.Material, 'dispose');

    const next = rebuildScatter(mesh, config, new Map(), new THREE.Vector3(0, 0, -44), 15);
    expect(geoDispose).toHaveBeenCalledTimes(1);
    expect(matDispose).toHaveBeenCalledTimes(1);

    next.geometry.dispose();
    (next.material as THREE.Material).dispose();
  });
});
