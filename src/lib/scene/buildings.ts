import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { WorldSession } from '../world/world-types';
import { COZY_THEME } from '../cozy-theme';
import { createCozyMaterial } from './cozy-materials';

export const SUPPORTED_WORKSITE_ARCHETYPES = [
  'command-hub',
  'engineering-workshop',
  'research-lab',
  'operations-node',
] as const;

export type WorksiteArchetype = (typeof SUPPORTED_WORKSITE_ARCHETYPES)[number];

export type WorksiteIdentity = Pick<WorldSession, 'id' | 'projectId' | 'rootSessionId'>;

export const WORKSITE_FOOTPRINT_RADIUS = 1.5;
export const WORKSITE_MAX_VISUAL_RADIUS = 1.2;

const ASSIGNMENT_VERSION = 'worksite:v1';
const FIXED_FALLBACK_ARCHETYPE: WorksiteArchetype = 'command-hub';

type MaterialIndex = 0 | 1 | 2;

interface WorksitePart {
  geometry: THREE.BufferGeometry;
  materialIndex: MaterialIndex;
  position: readonly [x: number, y: number, z: number];
  rotation?: readonly [x: number, y: number, z: number];
  scale?: readonly [x: number, y: number, z: number];
}

function normalizeIdentityPart(value: string | null | undefined): string {
  return value?.normalize('NFKC').trim().toLocaleLowerCase('en-US') ?? '';
}

export function worksiteIdentityKey(identity: WorksiteIdentity): string {
  const sessionId = normalizeIdentityPart(identity.id);
  const projectId = normalizeIdentityPart(identity.projectId);
  const rootSessionId = normalizeIdentityPart(identity.rootSessionId);
  if (!sessionId && !projectId && !rootSessionId) return `${ASSIGNMENT_VERSION}\u0000blank`;
  return `${ASSIGNMENT_VERSION}\u0000${projectId || sessionId}\u0000${rootSessionId || sessionId}`;
}

/** FNV-1a over normalized UTF-16 code units, kept explicit and versioned. */
function stableHash32(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function assignWorksiteArchetype(identity: WorksiteIdentity): WorksiteArchetype {
  const key = worksiteIdentityKey(identity);
  if (key === `${ASSIGNMENT_VERSION}\u0000blank`) return FIXED_FALLBACK_ARCHETYPE;
  return SUPPORTED_WORKSITE_ARCHETYPES[stableHash32(key) % SUPPORTED_WORKSITE_ARCHETYPES.length];
}

function box(width: number, height: number, depth: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(width, height, depth);
}

function cylinder(radiusTop: number, radiusBottom: number, height: number, segments = 8): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments);
}

function sphere(radius: number, segments = 8): THREE.BufferGeometry {
  return new THREE.SphereGeometry(radius, segments, Math.max(4, segments / 2));
}

function cone(radius: number, height: number, segments = 8): THREE.BufferGeometry {
  return new THREE.ConeGeometry(radius, height, segments);
}

function commandHubParts(): WorksitePart[] {
  return [
    { geometry: cylinder(0.94, 1.02, 1.3, 10), materialIndex: 0, position: [0, 0.65, 0] },
    { geometry: box(1.28, 0.48, 1.18), materialIndex: 0, position: [0, 1.52, 0] },
    { geometry: cone(1.08, 0.52, 10), materialIndex: 1, position: [0, 2.02, 0] },
    { geometry: cylinder(0.055, 0.07, 0.58, 6), materialIndex: 1, position: [0, 2.5, 0] },
    { geometry: box(0.72, 0.22, 0.08), materialIndex: 1, position: [0, 1.42, 0.99] },
    { geometry: box(0.52, 0.3, 0.06), materialIndex: 2, position: [0, 1.7, 0.63] },
    { geometry: box(0.3, 0.28, 0.06), materialIndex: 2, position: [0.72, 0.92, 0.57], rotation: [0, Math.PI / 4.8, 0] },
    { geometry: sphere(0.1, 6), materialIndex: 2, position: [0, 2.8, 0] },
  ];
}

function engineeringWorkshopParts(): WorksitePart[] {
  return [
    { geometry: box(1.75, 1.25, 1.22), materialIndex: 0, position: [0, 0.625, 0] },
    { geometry: box(0.98, 0.1, 1.34), materialIndex: 1, position: [-0.42, 1.52, 0], rotation: [0, 0, -0.42] },
    { geometry: box(0.98, 0.1, 1.34), materialIndex: 1, position: [0.42, 1.52, 0], rotation: [0, 0, 0.42] },
    { geometry: box(1.08, 0.5, 0.1), materialIndex: 1, position: [0, 0.55, 0.66] },
    { geometry: box(0.62, 0.2, 0.07), materialIndex: 1, position: [-0.45, 1.08, 0.67] },
    { geometry: box(0.2, 0.55, 0.2), materialIndex: 0, position: [0.65, 1.52, -0.32] },
    { geometry: box(0.22, 0.22, 0.06), materialIndex: 2, position: [-0.48, 0.88, 0.69] },
    { geometry: box(0.22, 0.22, 0.06), materialIndex: 2, position: [0, 0.88, 0.69] },
    { geometry: box(0.22, 0.22, 0.06), materialIndex: 2, position: [0.48, 0.88, 0.69] },
  ];
}

function researchLabParts(): WorksitePart[] {
  return [
    { geometry: cylinder(0.98, 1.06, 0.92, 12), materialIndex: 0, position: [0, 0.46, 0] },
    { geometry: sphere(0.96, 12), materialIndex: 0, position: [0, 1.18, 0], scale: [1, 0.68, 1] },
    { geometry: cylinder(1.08, 1.08, 0.1, 12), materialIndex: 1, position: [0, 0.91, 0] },
    { geometry: box(0.34, 0.5, 0.5), materialIndex: 1, position: [0.78, 0.78, -0.05] },
    { geometry: cylinder(0.2, 0.24, 0.18, 8), materialIndex: 1, position: [0, 1.89, 0] },
    { geometry: box(0.58, 0.16, 0.07), materialIndex: 1, position: [0, 1.12, 0.94] },
    { geometry: box(0.46, 0.24, 0.055), materialIndex: 2, position: [0, 1.38, 0.82] },
    { geometry: sphere(0.15, 8), materialIndex: 2, position: [0, 1.98, 0] },
  ];
}

function operationsNodeParts(): WorksitePart[] {
  return [
    { geometry: box(1.45, 1.18, 1.18), materialIndex: 0, position: [-0.1, 0.59, 0] },
    { geometry: box(0.9, 0.78, 0.86), materialIndex: 0, position: [0.18, 1.54, -0.08] },
    { geometry: cone(0.68, 0.45, 4), materialIndex: 1, position: [0.18, 2.16, -0.08], rotation: [0, Math.PI / 4, 0] },
    { geometry: box(0.18, 0.72, 0.64), materialIndex: 1, position: [0.76, 0.72, 0] },
    { geometry: box(0.58, 0.18, 0.07), materialIndex: 1, position: [-0.34, 1.05, 0.63] },
    { geometry: box(0.1, 0.56, 0.1), materialIndex: 1, position: [-0.48, 2.04, -0.08] },
    { geometry: box(0.3, 0.32, 0.06), materialIndex: 2, position: [-0.5, 0.74, 0.63] },
    { geometry: box(0.16, 0.16, 0.06), materialIndex: 2, position: [0.05, 0.82, 0.63] },
    { geometry: sphere(0.09, 6), materialIndex: 2, position: [-0.48, 2.36, -0.08] },
  ];
}

function partsFor(archetype: WorksiteArchetype): WorksitePart[] {
  switch (archetype) {
    case 'command-hub':
      return commandHubParts();
    case 'engineering-workshop':
      return engineeringWorkshopParts();
    case 'research-lab':
      return researchLabParts();
    case 'operations-node':
      return operationsNodeParts();
  }
}

export function createWorksiteGeometry(archetype: WorksiteArchetype): THREE.BufferGeometry {
  const transformed = partsFor(archetype).map((part) => {
    const geometry = part.geometry;
    if (part.scale) geometry.scale(...part.scale);
    if (part.rotation) {
      geometry.rotateX(part.rotation[0]);
      geometry.rotateY(part.rotation[1]);
      geometry.rotateZ(part.rotation[2]);
    }
    geometry.translate(...part.position);
    return { geometry, materialIndex: part.materialIndex };
  });

  const materialGeometries = ([0, 1, 2] satisfies MaterialIndex[]).map((materialIndex) => {
    const sources = transformed
      .filter((part) => part.materialIndex === materialIndex)
      .map((part) => part.geometry);
    const merged = mergeGeometries(sources, false);
    if (!merged) throw new Error(`Failed to merge ${archetype} material ${materialIndex}`);
    return merged;
  });
  const geometry = mergeGeometries(materialGeometries, true);
  transformed.forEach((part) => part.geometry.dispose());
  materialGeometries.forEach((part) => part.dispose());
  if (!geometry) throw new Error(`Failed to merge ${archetype} worksite`);
  return geometry;
}

export function createWorksiteMaterials(accent: THREE.Color): THREE.MeshStandardMaterial[] {
  const restrainedAccent = new THREE.Color(COZY_THEME.environment.wood).lerp(accent, 0.28);
  return [
    createCozyMaterial({ recipe: 'paintedMetal', color: COZY_THEME.environment.floor }),
    createCozyMaterial({ recipe: 'wood', color: restrainedAccent }),
    createCozyMaterial({
      recipe: 'softGlow',
      color: COZY_THEME.environment.lamp,
      emissive: COZY_THEME.environment.lamp,
    }),
  ];
}

function disposeWorksiteInstance(mesh: THREE.Mesh): void {
  mesh.removeFromParent();
  if (Array.isArray(mesh.material)) mesh.material.forEach((material) => material.dispose());
  else mesh.material.dispose();
}

export class WorksiteGeometryLibrary {
  private readonly geometries = new Map<WorksiteArchetype, THREE.BufferGeometry>();

  get(archetype: WorksiteArchetype): THREE.BufferGeometry {
    const cached = this.geometries.get(archetype);
    if (cached) return cached;
    const geometry = createWorksiteGeometry(archetype);
    this.geometries.set(archetype, geometry);
    return geometry;
  }

  dispose(): void {
    for (const geometry of this.geometries.values()) geometry.dispose();
    this.geometries.clear();
  }
}

export function disposeMesh(mesh: THREE.Mesh): void {
  mesh.removeFromParent();
  mesh.geometry.dispose();
  if (Array.isArray(mesh.material)) {
    mesh.material.forEach((material) => material.dispose());
  } else {
    mesh.material.dispose();
  }
}

export class SessionWorksites {
  private readonly meshes = new Map<string, THREE.Mesh>();
  private readonly identityKeys = new Map<string, string>();
  private readonly geometryLibrary = new WorksiteGeometryLibrary();

  get(sessionId: string): THREE.Mesh | undefined {
    return this.meshes.get(sessionId);
  }

  sync(
    scene: THREE.Scene,
    sessions: readonly WorksiteIdentity[],
    positionFor: (sessionId: string) => THREE.Vector3 | undefined,
    accentFor: (sessionId: string) => THREE.Color,
  ): void {
    const activeIds = new Set<string>();
    for (const session of sessions) {
      const sessionId = session.id ?? '';
      const position = positionFor(sessionId);
      if (!position) continue;
      activeIds.add(sessionId);
      const identityKey = worksiteIdentityKey(session);
      const existing = this.meshes.get(sessionId);
      if (existing && this.identityKeys.get(sessionId) === identityKey) {
        existing.position.copy(position);
        continue;
      }
      if (existing) disposeWorksiteInstance(existing);

      const archetype = assignWorksiteArchetype(session);
      const mesh = new THREE.Mesh(
        this.geometryLibrary.get(archetype),
        createWorksiteMaterials(accentFor(sessionId)),
      );
      mesh.position.copy(position);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      this.meshes.set(sessionId, mesh);
      this.identityKeys.set(sessionId, identityKey);
    }

    for (const [sessionId, mesh] of this.meshes) {
      if (activeIds.has(sessionId)) continue;
      disposeWorksiteInstance(mesh);
      this.meshes.delete(sessionId);
      this.identityKeys.delete(sessionId);
    }
  }

  dispose(): void {
    for (const mesh of this.meshes.values()) disposeWorksiteInstance(mesh);
    this.meshes.clear();
    this.identityKeys.clear();
    this.geometryLibrary.dispose();
  }
}
