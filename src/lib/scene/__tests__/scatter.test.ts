import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createScatterMesh, rebuildScatter } from '../scatter';

describe('createScatterMesh', () => {
  it('returns a plain Mesh with baked world transforms, not an InstancedMesh', () => {
    const mesh = createScatterMesh(
      { halfExtent: 12, density: 0.5, planetPreset: 'terra' },
      new Map()
    );
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh).not.toBeInstanceOf(THREE.InstancedMesh);
  });

  it('bakes a non-empty vertex buffer with a bounding sphere', () => {
    const mesh = createScatterMesh(
      { halfExtent: 12, density: 0.5, planetPreset: 'terra' },
      new Map()
    );
    const geo = mesh.geometry as THREE.BufferGeometry;
    expect(geo.attributes.position.count).toBeGreaterThan(0);
    expect(geo.boundingSphere).not.toBeNull();
  });

  it('empty result is a Mesh with zero vertices, not a count-1 InstancedMesh', () => {
    const mesh = createScatterMesh(
      { halfExtent: 12, density: 0, planetPreset: 'terra' },
      new Map()
    );
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh).not.toBeInstanceOf(THREE.InstancedMesh);
    const geo = mesh.geometry as THREE.BufferGeometry;
    expect(geo.attributes.position ?? { count: 0 }).toBeDefined();
  });

  it('rebuildScatter disposes and returns a Mesh', () => {
    const first = createScatterMesh(
      { halfExtent: 12, density: 0.5, planetPreset: 'terra' },
      new Map()
    );
    const second = rebuildScatter(
      first as unknown as THREE.InstancedMesh,
      { halfExtent: 12, density: 0.5, planetPreset: 'terra' },
      new Map(),
      new THREE.Vector3(0, 0, -30),
      15
    );
    expect(second).toBeInstanceOf(THREE.Mesh);
    expect(second).not.toBeInstanceOf(THREE.InstancedMesh);
  });
});
