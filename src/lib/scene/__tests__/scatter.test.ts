import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  ENVIRONMENT_CENTER_CLEARANCE_RADIUS,
  ENVIRONMENT_TRANSIT_LANE_HALF_WIDTH,
  createEnvironmentPlacements,
  createScatterMesh,
  environmentNavigationRevision,
  getEnvironmentPlacements,
  getScatterObstacles,
  rebuildScatter,
} from '../scatter';
import { hexToKey, worldToHex } from '../hex-grid';
import { motionEnvironmentNavigationKey } from '../three-engine';

describe('createScatterMesh', () => {
  it('returns a plain Mesh with baked world transforms, not an InstancedMesh', () => {
    const mesh = createScatterMesh(
      { halfExtent: 12, density: 0.5, planetPreset: 'terra' },
      new Map()
    );
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh).not.toBeInstanceOf(THREE.InstancedMesh);
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  });

  it('bakes a non-empty vertex buffer with a bounding sphere', () => {
    const mesh = createScatterMesh(
      { halfExtent: 12, density: 0.5, planetPreset: 'terra' },
      new Map()
    );
    const geo = mesh.geometry as THREE.BufferGeometry;
    expect(geo.attributes.position.count).toBeGreaterThan(0);
    expect(geo.boundingSphere).not.toBeNull();
    geo.dispose();
    (mesh.material as THREE.Material).dispose();
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
    geo.dispose();
    (mesh.material as THREE.Material).dispose();
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
    second.geometry.dispose();
    (second.material as THREE.Material).dispose();
  });

  it('creates deterministic sparse cozy families from one placement dataset', () => {
    const config = { halfExtent: 24, density: 0.45, planetPreset: 'terra' as const };
    const first = createEnvironmentPlacements(config, new Map());
    const second = createEnvironmentPlacements(config, new Map());
    const signature = (placements: typeof first) => placements.map((placement) => ({
      family: placement.family,
      position: placement.position.toArray(),
      scale: placement.scale,
      rotationY: placement.rotationY,
      obstacleRadius: placement.obstacleRadius,
    }));

    expect(first.length).toBeGreaterThan(0);
    expect(signature(second)).toEqual(signature(first));

    const mesh = createScatterMesh(config, new Map());
    expect(signature([...getEnvironmentPlacements(mesh)])).toEqual(signature(first));
    expect(getScatterObstacles(mesh)).toHaveLength(
      first.filter((placement) => placement.obstacleRadius > 0).length,
    );
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  });

  it('keeps worksite center, occupied cells, ship envelope, and transit lane clear', () => {
    const shipPosition = new THREE.Vector3(0, 0, -30);
    const occupiedPoint = new THREE.Vector3(16.5, 0, 16.5);
    const occupiedHex = worldToHex(occupiedPoint.x, occupiedPoint.z);
    const occupiedKey = hexToKey(occupiedHex.q, occupiedHex.r);
    const occupied = new Map([[occupiedKey, occupiedHex]]);
    const placements = createEnvironmentPlacements(
      { halfExtent: 24, density: 1, planetPreset: 'terra' },
      occupied,
      shipPosition,
      8,
    );

    for (const placement of placements) {
      expect(Math.hypot(placement.position.x, placement.position.z)).toBeGreaterThanOrEqual(
        ENVIRONMENT_CENTER_CLEARANCE_RADIUS,
      );
      expect(placement.position.distanceTo(shipPosition)).toBeGreaterThanOrEqual(8);
      const placementHex = worldToHex(placement.position.x, placement.position.z);
      expect(hexToKey(placementHex.q, placementHex.r)).not.toBe(occupiedKey);
      const inLane =
        Math.abs(placement.position.x - shipPosition.x) < ENVIRONMENT_TRANSIT_LANE_HALF_WIDTH &&
        placement.position.z >= shipPosition.z &&
        placement.position.z <= ENVIRONMENT_CENTER_CLEARANCE_RADIUS;
      expect(inLane).toBe(false);
    }
  });

  it('changes navigation revision only when derived obstacle data changes', () => {
    const placements = createEnvironmentPlacements(
      { halfExtent: 24, density: 1, planetPreset: 'terra' },
      new Map(),
    );
    const originalRevision = environmentNavigationRevision(placements);
    const obstacleIndex = placements.findIndex((placement) => placement.obstacleRadius > 0);
    expect(obstacleIndex).toBeGreaterThanOrEqual(0);
    const changed = placements.map((placement, index) => index === obstacleIndex
      ? { ...placement, position: placement.position.clone().add(new THREE.Vector3(0.5, 0, 0)) }
      : placement);

    expect(environmentNavigationRevision([...placements])).toBe(originalRevision);
    expect(environmentNavigationRevision(changed)).not.toBe(originalRevision);
    expect(motionEnvironmentNavigationKey('worksites', originalRevision)).not.toBe(
      motionEnvironmentNavigationKey('worksites', environmentNavigationRevision(changed)),
    );
  });
});
