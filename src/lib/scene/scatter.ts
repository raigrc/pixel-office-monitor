import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { COZY_THEME, type CozyHexColor } from '../cozy-theme';
import { hexToKey, worldToHex, type HexCell } from './hex-grid';
import { createCozyMaterial } from './cozy-materials';
import { heightAt, type PlanetPreset } from './terrain';

export interface ScatterConfig {
  halfExtent: number;
  density: number;
  planetPreset: PlanetPreset;
}

export const ENVIRONMENT_FAMILIES = [
  'tree',
  'bush',
  'flower',
  'sign',
  'crate',
  'technical',
] as const;

export type EnvironmentFamily = (typeof ENVIRONMENT_FAMILIES)[number];

export interface EnvironmentPlacement {
  readonly family: EnvironmentFamily;
  readonly position: THREE.Vector3;
  readonly scale: number;
  readonly rotationY: number;
  readonly obstacleRadius: number;
}

export interface ScatterObstacle {
  position: THREE.Vector3;
  radius: number;
}

export const ENVIRONMENT_CENTER_CLEARANCE_RADIUS = 6;
export const ENVIRONMENT_TRANSIT_LANE_HALF_WIDTH = 3;

const FAMILY_SEQUENCE: readonly EnvironmentFamily[] = [
  'tree',
  'bush',
  'bush',
  'flower',
  'flower',
  'sign',
  'crate',
  'technical',
];

const FAMILY_SCALE_RANGE: Record<EnvironmentFamily, readonly [minimum: number, maximum: number]> = {
  tree: [0.7, 1.15],
  bush: [0.5, 0.9],
  flower: [0.45, 0.75],
  sign: [0.7, 1],
  crate: [0.55, 0.85],
  technical: [0.6, 0.95],
};

const FAMILY_OBSTACLE_RADIUS: Record<EnvironmentFamily, number> = {
  tree: 0.5,
  bush: 0.48,
  flower: 0,
  sign: 0.34,
  crate: 0.46,
  technical: 0.42,
};

const PRESET_SEEDS: Record<PlanetPreset, number> = {
  luna: 0xdeadc0de,
  mars: 0x0badf00d,
  terra: 0xcafebabe,
};

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = Math.imul(value ^ (value >>> 15), 1 | value);
    result ^= result + Math.imul(result ^ (result >>> 7), 61 | result);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function isReservedTransitLane(x: number, z: number, shipPosition: THREE.Vector3): boolean {
  return (
    Math.abs(x - shipPosition.x) < ENVIRONMENT_TRANSIT_LANE_HALF_WIDTH &&
    z >= shipPosition.z &&
    z <= ENVIRONMENT_CENTER_CLEARANCE_RADIUS
  );
}

export function createEnvironmentPlacements(
  config: ScatterConfig,
  occupiedCells: ReadonlyMap<string, HexCell>,
  shipPosition: THREE.Vector3 = new THREE.Vector3(0, 0, -30),
  shipRadius = 15,
): EnvironmentPlacement[] {
  const placements: EnvironmentPlacement[] = [];
  const random = mulberry32(PRESET_SEEDS[config.planetPreset]);
  const cellSize = 3;
  const gridSize = Math.ceil((config.halfExtent * 2) / cellSize);

  for (let gridZ = 0; gridZ < gridSize; gridZ++) {
    for (let gridX = 0; gridX < gridSize; gridX++) {
      const x = -config.halfExtent + (gridX + 0.5) * cellSize;
      const z = -config.halfExtent + (gridZ + 0.5) * cellSize;
      const distanceToShip = Math.hypot(x - shipPosition.x, z - shipPosition.z);
      if (distanceToShip < shipRadius) continue;
      if (Math.hypot(x, z) < ENVIRONMENT_CENTER_CLEARANCE_RADIUS) continue;
      if (isReservedTransitLane(x, z, shipPosition)) continue;

      const hex = worldToHex(x, z);
      if (occupiedCells.has(hexToKey(hex.q, hex.r))) continue;
      if (random() > config.density) continue;

      const family = FAMILY_SEQUENCE[Math.floor(random() * FAMILY_SEQUENCE.length)];
      const [minimumScale, maximumScale] = FAMILY_SCALE_RANGE[family];
      const scale = minimumScale + random() * (maximumScale - minimumScale);
      placements.push({
        family,
        position: new THREE.Vector3(x, heightAt(x, z, config.planetPreset) - 0.04, z),
        scale,
        rotationY: random() * Math.PI * 2,
        obstacleRadius: FAMILY_OBSTACLE_RADIUS[family] * scale,
      });
    }
  }

  return placements;
}

function withVertexColor(geometry: THREE.BufferGeometry, color: CozyHexColor): THREE.BufferGeometry {
  const attribute = new Float32Array(geometry.getAttribute('position').count * 3);
  const value = new THREE.Color(color);
  for (let index = 0; index < attribute.length; index += 3) {
    attribute[index] = value.r;
    attribute[index + 1] = value.g;
    attribute[index + 2] = value.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(attribute, 3));
  return geometry;
}

function coloredBox(
  size: readonly [width: number, height: number, depth: number],
  position: readonly [x: number, y: number, z: number],
  color: CozyHexColor,
): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(...size);
  geometry.translate(...position);
  return withVertexColor(geometry, color);
}

function coloredCylinder(
  radiusTop: number,
  radiusBottom: number,
  height: number,
  positionY: number,
  color: CozyHexColor,
  segments = 7,
): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments);
  geometry.translate(0, positionY, 0);
  return withVertexColor(geometry, color);
}

function mergeFamilyParts(family: EnvironmentFamily, parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const normalized = parts.map((part) => part.index ? part.toNonIndexed() : part);
  const merged = mergeGeometries(normalized, false);
  normalized.forEach((part, index) => {
    if (part !== parts[index]) part.dispose();
  });
  parts.forEach((part) => part.dispose());
  if (!merged) throw new Error(`Failed to merge cozy environment family ${family}`);
  return merged;
}

function createFamilyGeometry(family: EnvironmentFamily): THREE.BufferGeometry {
  switch (family) {
    case 'tree':
      return mergeFamilyParts(family, [
        coloredCylinder(0.13, 0.18, 0.75, 0.375, COZY_THEME.environment.woodDark, 6),
        coloredCylinder(0.08, 0.58, 0.92, 1.08, COZY_THEME.environment.plant, 7),
        coloredCylinder(0.05, 0.42, 0.68, 1.62, COZY_THEME.scene.terrainBands[2], 7),
      ]);
    case 'bush':
      return mergeFamilyParts(family, [
        withVertexColor(new THREE.DodecahedronGeometry(0.5, 0).translate(-0.22, 0.42, 0), COZY_THEME.environment.plant),
        withVertexColor(new THREE.DodecahedronGeometry(0.42, 0).translate(0.25, 0.34, 0.08), COZY_THEME.scene.terrainBands[2]),
      ]);
    case 'flower':
      return mergeFamilyParts(family, [
        coloredCylinder(0.025, 0.035, 0.42, 0.21, COZY_THEME.environment.plant, 5),
        withVertexColor(new THREE.OctahedronGeometry(0.14, 0).translate(0, 0.5, 0), COZY_THEME.semantic.waiting),
      ]);
    case 'sign':
      return mergeFamilyParts(family, [
        coloredBox([0.1, 0.75, 0.1], [0, 0.375, 0], COZY_THEME.environment.woodDark),
        coloredBox([0.82, 0.38, 0.1], [0, 0.78, 0], COZY_THEME.environment.wood),
        coloredBox([0.48, 0.08, 0.04], [0, 0.79, 0.07], COZY_THEME.semantic.selection),
      ]);
    case 'crate':
      return mergeFamilyParts(family, [
        coloredBox([0.72, 0.62, 0.72], [0, 0.31, 0], COZY_THEME.environment.wood),
        coloredBox([0.78, 0.08, 0.78], [0, 0.6, 0], COZY_THEME.environment.woodDark),
        coloredBox([0.08, 0.62, 0.76], [0, 0.31, 0], COZY_THEME.environment.woodDark),
      ]);
    case 'technical':
      return mergeFamilyParts(family, [
        coloredCylinder(0.32, 0.4, 0.32, 0.16, COZY_THEME.environment.metal, 8),
        coloredBox([0.48, 0.48, 0.48], [0, 0.52, 0], COZY_THEME.environment.floor),
        coloredBox([0.24, 0.18, 0.04], [0, 0.55, 0.27], COZY_THEME.semantic.working),
        coloredCylinder(0.025, 0.025, 0.48, 0.99, COZY_THEME.environment.metal, 5),
      ]);
  }
}

function bakePlacements(placements: readonly EnvironmentPlacement[]): THREE.BufferGeometry {
  const familyGeometries = new Map(
    ENVIRONMENT_FAMILIES.map((family) => [family, createFamilyGeometry(family)]),
  );
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const matrix = new THREE.Matrix4();
  const normalMatrix = new THREE.Matrix3();
  const quaternion = new THREE.Quaternion();
  const transformedPosition = new THREE.Vector3();
  const transformedNormal = new THREE.Vector3();

  for (const placement of placements) {
    const geometry = familyGeometries.get(placement.family);
    if (!geometry) continue;
    quaternion.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, placement.rotationY);
    matrix.compose(
      placement.position,
      quaternion,
      new THREE.Vector3(placement.scale, placement.scale, placement.scale),
    );
    normalMatrix.getNormalMatrix(matrix);
    const sourcePositions = geometry.getAttribute('position');
    const sourceNormals = geometry.getAttribute('normal');
    const sourceColors = geometry.getAttribute('color');
    for (let index = 0; index < sourcePositions.count; index++) {
      transformedPosition.fromBufferAttribute(sourcePositions, index).applyMatrix4(matrix);
      transformedNormal.fromBufferAttribute(sourceNormals, index).applyNormalMatrix(normalMatrix);
      positions.push(transformedPosition.x, transformedPosition.y, transformedPosition.z);
      normals.push(transformedNormal.x, transformedNormal.y, transformedNormal.z);
      colors.push(sourceColors.getX(index), sourceColors.getY(index), sourceColors.getZ(index));
    }
  }

  familyGeometries.forEach((geometry) => geometry.dispose());
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

export function environmentNavigationRevision(placements: readonly EnvironmentPlacement[]): string {
  return placements
    .filter((placement) => placement.obstacleRadius > 0)
    .map((placement) => [
      placement.family,
      placement.position.x.toFixed(3),
      placement.position.z.toFixed(3),
      placement.obstacleRadius.toFixed(3),
    ].join(':'))
    .join('|');
}

export function createScatterMesh(
  config: ScatterConfig,
  occupiedCells: Map<string, HexCell>,
  shipPosition: THREE.Vector3 = new THREE.Vector3(0, 0, -30),
  shipRadius = 15,
): THREE.Mesh {
  const placements = createEnvironmentPlacements(config, occupiedCells, shipPosition, shipRadius);
  const material = createCozyMaterial({ recipe: 'matte', color: COZY_THEME.ui.text });
  material.vertexColors = true;
  const mesh = new THREE.Mesh(bakePlacements(placements), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.environmentPlacements = placements;
  mesh.userData.obstacles = placements
    .filter((placement) => placement.obstacleRadius > 0)
    .map((placement) => ({
      position: placement.position.clone(),
      radius: placement.obstacleRadius,
    })) satisfies ScatterObstacle[];
  return mesh;
}

export function getEnvironmentPlacements(mesh: THREE.Mesh | null): readonly EnvironmentPlacement[] {
  return (mesh?.userData.environmentPlacements as EnvironmentPlacement[] | undefined) ?? [];
}

export function getScatterObstacles(mesh: THREE.Mesh | null): readonly ScatterObstacle[] {
  return (mesh?.userData.obstacles as ScatterObstacle[] | undefined) ?? [];
}

export function rebuildScatter(
  mesh: THREE.Mesh,
  config: ScatterConfig,
  occupiedCells: Map<string, HexCell>,
  shipPosition: THREE.Vector3,
  shipRadius: number,
): THREE.Mesh {
  mesh.geometry.dispose();
  if (Array.isArray(mesh.material)) mesh.material.forEach((material) => material.dispose());
  else mesh.material.dispose();
  return createScatterMesh(config, occupiedCells, shipPosition, shipRadius);
}
