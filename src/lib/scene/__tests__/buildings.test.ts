import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  SessionWorksites,
  SUPPORTED_WORKSITE_ARCHETYPES,
  WORKSITE_FOOTPRINT_RADIUS,
  WORKSITE_MAX_VISUAL_RADIUS,
  assignWorksiteArchetype,
  createWorksiteGeometry,
  createWorksiteMaterials,
  worksiteIdentityKey,
  type WorksiteIdentity,
} from '../buildings';
import {
  AGENT_RADIUS,
  createNavGrid,
  findPath,
  isNavWalkable,
  rasterizeBuilding,
  worldToGrid,
} from '../navigation';
import { createSessionDeckMaterials, worksiteNavigationKey } from '../three-engine';
import { COZY_THEME } from '../../cozy-theme';
import { resolveSessionAccent } from '../../session-visual-identity';

const accent = new THREE.Color(0x4f8fcf);

function identity(overrides: Partial<WorksiteIdentity> = {}): WorksiteIdentity {
  return {
    id: 'session-1',
    projectId: 'pixel-office',
    rootSessionId: 'root-1',
    ...overrides,
  };
}

describe('session worksites', () => {
  it('keeps deck surfaces neutral and limits deterministic session identity to trim', () => {
    const sessionAccent = new THREE.Color(resolveSessionAccent('session-1'));
    const materials = createSessionDeckMaterials(sessionAccent);

    expect(materials).toHaveLength(3);
    expect(materials[1].color.getHex()).toBe(new THREE.Color(COZY_THEME.scene.terrainBands[3]).getHex());
    expect(materials[2].color.getHex()).toBe(new THREE.Color(COZY_THEME.scene.terrainBands[1]).getHex());
    expect(materials[0].color.equals(sessionAccent)).toBe(false);
    expect(materials[0].color.getHex()).not.toBe(materials[1].color.getHex());
    materials.forEach((material) => material.dispose());
  });

  it('supports exactly four named archetypes', () => {
    expect(SUPPORTED_WORKSITE_ARCHETYPES).toEqual([
      'command-hub',
      'engineering-workshop',
      'research-lab',
      'operations-node',
    ]);
  });

  it('keeps versioned assignments fixed', () => {
    expect(assignWorksiteArchetype(identity({ projectId: 'fixture-0', rootSessionId: 'root-0' }))).toBe('operations-node');
    expect(assignWorksiteArchetype(identity({ projectId: 'fixture-0', rootSessionId: 'root-1' }))).toBe('command-hub');
    expect(assignWorksiteArchetype(identity({ projectId: 'fixture-0', rootSessionId: 'root-2' }))).toBe('engineering-workshop');
    expect(assignWorksiteArchetype(identity({ projectId: 'fixture-0', rootSessionId: 'root-3' }))).toBe('research-lab');
  });

  it('normalizes stable identity and ignores snapshot display fields', () => {
    const first = {
      ...identity(),
      title: 'Initial title',
      createdAt: 1,
      status: 'working',
      actors: ['one'],
      order: 0,
    };
    const next = {
      ...first,
      projectId: '  PIXEL-OFFICE ',
      rootSessionId: ' ROOT-1 ',
      title: 'Changed title',
      createdAt: 999,
      status: 'error',
      actors: ['two', 'one'],
      order: 8,
    };

    expect(worksiteIdentityKey(next)).toBe(worksiteIdentityKey(first));
    expect(assignWorksiteArchetype(next)).toBe(assignWorksiteArchetype(first));
    expect(assignWorksiteArchetype({ ...next, id: 'child-session' })).toBe(
      assignWorksiteArchetype(first),
    );
  });

  it('falls back to session id for missing stable fields and uses a fixed all-blank fallback', () => {
    const missingProject = identity({ id: 'fallback', projectId: '', rootSessionId: 'root' });
    const explicitProject = identity({ id: 'fallback', projectId: 'fallback', rootSessionId: 'root' });
    const missingRoot = identity({ id: 'fallback', projectId: 'project', rootSessionId: '' });
    const explicitRoot = identity({ id: 'fallback', projectId: 'project', rootSessionId: 'fallback' });

    expect(worksiteIdentityKey(missingProject)).toBe(worksiteIdentityKey(explicitProject));
    expect(worksiteIdentityKey(missingRoot)).toBe(worksiteIdentityKey(explicitRoot));
    expect(assignWorksiteArchetype({ id: '', projectId: '', rootSessionId: '' })).toBe('command-hub');
  });

  it('builds each archetype in final world units with exactly three material groups', () => {
    const silhouetteSignatures = new Set<string>();
    for (const archetype of SUPPORTED_WORKSITE_ARCHETYPES) {
      const geometry = createWorksiteGeometry(archetype);
      const positions = geometry.getAttribute('position');
      geometry.computeBoundingBox();
      const bounds = geometry.boundingBox;

      expect(bounds).not.toBeNull();
      expect(bounds?.min.y).toBeGreaterThanOrEqual(-1e-6);
      expect(bounds?.max.y).toBeLessThanOrEqual(4.5);
      expect(geometry.groups).toHaveLength(3);
      expect(geometry.groups.map((group) => group.materialIndex)).toEqual([0, 1, 2]);
      expect(geometry.groups.every((group) => group.count > 0)).toBe(true);

      let maxHorizontalRadius = 0;
      for (let index = 0; index < positions.count; index++) {
        maxHorizontalRadius = Math.max(
          maxHorizontalRadius,
          Math.hypot(positions.getX(index), positions.getZ(index)),
        );
      }
      expect(maxHorizontalRadius).toBeLessThanOrEqual(WORKSITE_MAX_VISUAL_RADIUS);
      const width = (bounds?.max.x ?? 0) - (bounds?.min.x ?? 0);
      const depth = (bounds?.max.z ?? 0) - (bounds?.min.z ?? 0);
      const height = (bounds?.max.y ?? 0) - (bounds?.min.y ?? 0);
      silhouetteSignatures.add(`${Math.round(width * 2)}:${Math.round(depth * 2)}:${Math.round(height * 2)}`);
      geometry.dispose();
    }
    expect(silhouetteSignatures.size).toBe(SUPPORTED_WORKSITE_ARCHETYPES.length);
  });

  it('uses three opaque standard materials with neutral structure dominant', () => {
    const materials = createWorksiteMaterials(accent);

    expect(materials).toHaveLength(3);
    expect(materials.every((material) => material instanceof THREE.MeshStandardMaterial)).toBe(true);
    expect(materials.every((material) => material.transparent === false)).toBe(true);
    expect(materials[0].color.getHex()).toBe(new THREE.Color(COZY_THEME.environment.floor).getHex());
    expect(materials[1].color.equals(accent)).toBe(false);
    expect(materials[1].roughness).toBe(COZY_THEME.materials.wood.roughness);
    expect(materials[2].color.getHex()).toBe(new THREE.Color(COZY_THEME.environment.lamp).getHex());
    expect(materials[2].emissiveIntensity).toBe(COZY_THEME.materials.softGlow.emissiveIntensity);

    materials.forEach((material) => material.dispose());
  });

  it('keeps shared footprint and existing navigation envelope compatible for every archetype', () => {
    expect(WORKSITE_FOOTPRINT_RADIUS).toBe(1.5);
    expect(WORKSITE_FOOTPRINT_RADIUS * 0.8 + AGENT_RADIUS).toBeCloseTo(1.75);
    expect(WORKSITE_MAX_VISUAL_RADIUS + AGENT_RADIUS).toBeLessThanOrEqual(
      WORKSITE_FOOTPRINT_RADIUS * 0.8 + AGENT_RADIUS,
    );

    for (const archetype of SUPPORTED_WORKSITE_ARCHETYPES) {
      const geometry = createWorksiteGeometry(archetype);
      const grid = createNavGrid();
      rasterizeBuilding(grid, new THREE.Vector3(), WORKSITE_FOOTPRINT_RADIUS);
      const result = findPath(
        grid,
        new THREE.Vector3(-4, 0, 0),
        new THREE.Vector3(4, 0, 0),
      );

      expect(result.blocked, archetype).toBe(false);
      expect(result.waypoints.length, archetype).toBeGreaterThan(2);
      for (const waypoint of result.waypoints) {
        const cell = worldToGrid(waypoint.x, waypoint.z);
        expect(isNavWalkable(grid, cell.gx, cell.gz), archetype).toBe(true);
      }
      geometry.dispose();
    }
  });

  it('adds, reuses, replaces, and removes only session worksite meshes', () => {
    const scene = new THREE.Scene();
    const deck = new THREE.Mesh(new THREE.CircleGeometry(3.6), new THREE.MeshBasicMaterial());
    scene.add(deck);
    const worksites = new SessionWorksites();
    const positionFor = () => new THREE.Vector3(3, 0.2, 4);
    const accentFor = () => accent;
    const first = { ...identity(), title: 'one', createdAt: 1 };

    worksites.sync(scene, [first], positionFor, accentFor);
    const original = worksites.get(first.id);
    const originalMaterial = original?.material;
    let originalGeometryDisposed = false;
    original?.geometry.addEventListener('dispose', () => {
      originalGeometryDisposed = true;
    });
    worksites.sync(scene, [{ ...first, title: 'two', createdAt: 2 }], positionFor, accentFor);

    expect(worksites.get(first.id)).toBe(original);
    expect(worksites.get(first.id)?.material).toBe(originalMaterial);

    const second = identity({ id: 'session-2', rootSessionId: 'root-2' });
    worksites.sync(scene, [{ ...first, status: 'quiet' }, second], positionFor, accentFor);
    expect(worksites.get(first.id)).toBe(original);
    expect(worksites.get(second.id)).toBeDefined();

    worksites.sync(
      scene,
      [{ ...first, projectId: 'different-project' }],
      positionFor,
      accentFor,
    );
    const replacement = worksites.get(first.id);
    expect(replacement).not.toBe(original);
    expect(originalGeometryDisposed).toBe(false);
    expect(scene.children).toContain(deck);

    worksites.sync(scene, [], positionFor, accentFor);
    expect(worksites.get(first.id)).toBeUndefined();
    expect(scene.children).toEqual([deck]);

    worksites.dispose();
    expect(originalGeometryDisposed).toBe(true);

    deck.geometry.dispose();
    (deck.material as THREE.Material).dispose();
  });

  it('shares archetype geometry and disposes it once after all instances leave', () => {
    const scene = new THREE.Scene();
    const worksites = new SessionWorksites();
    const first = identity({ id: 'shared-1', projectId: 'fixture-0', rootSessionId: 'root-1' });
    const second = identity({ id: 'shared-2', projectId: 'fixture-0', rootSessionId: 'root-1' });
    const positionFor = (sessionId: string) => new THREE.Vector3(sessionId === first.id ? -3 : 3, 0.6, 0);

    worksites.sync(scene, [first, second], positionFor, () => accent);
    const firstGeometry = worksites.get(first.id)?.geometry;
    const secondGeometry = worksites.get(second.id)?.geometry;
    expect(firstGeometry).toBe(secondGeometry);
    if (!firstGeometry) throw new Error('Expected shared worksite geometry');
    const dispose = vi.spyOn(firstGeometry, 'dispose');

    worksites.sync(scene, [], positionFor, () => accent);
    expect(dispose).not.toHaveBeenCalled();
    worksites.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
    worksites.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('keeps navigation revision key stable until session ids or positions change', () => {
    const positions = new Map([
      ['session-1', new THREE.Vector3(2, 0.6, 3)],
      ['session-2', new THREE.Vector3(-4, 0.6, 5)],
    ]);
    const positionFor = (sessionId: string) => positions.get(sessionId);
    const original = worksiteNavigationKey(['session-1'], positionFor);

    expect(worksiteNavigationKey(['session-1'], positionFor)).toBe(original);
    expect(worksiteNavigationKey(['session-2', 'session-1'], positionFor)).not.toBe(original);

    positions.set('session-1', new THREE.Vector3(3, 0.6, 3));
    expect(worksiteNavigationKey(['session-1'], positionFor)).not.toBe(original);
  });
});
