import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hexToWorld } from './hex-grid';

export interface BuildingPart {
  geometry: THREE.BufferGeometry;
  position: THREE.Vector3;
  rotation?: THREE.Euler;
  scale?: THREE.Vector3;
  materialIndex: number;
  emissiveVertices?: number[];
  rotorVertices?: number[];
}

export interface BuildingRecipe {
  name: string;
  parts: BuildingPart[];
  height: number;
  footprintRadius: number;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (t >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function seededRandom(seed: number): () => number {
  return mulberry32(seed);
}

function createBox(w: number, h: number, d: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, h, d);
}

function createCylinder(radiusTop: number, radiusBottom: number, height: number, segments = 8): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments);
}

function createCone(radius: number, height: number, segments = 8): THREE.BufferGeometry {
  return new THREE.ConeGeometry(radius, height, segments);
}

function createSphere(radius: number, segments = 8): THREE.BufferGeometry {
  return new THREE.SphereGeometry(radius, segments, segments);
}

const BUILDING_RECIPES: BuildingRecipe[] = [
  {
    name: 'habitat',
    height: 4.5,
    footprintRadius: 2.2,
    parts: [
      { geometry: createBox(4, 3, 4), position: new THREE.Vector3(0, 1.5, 0), materialIndex: 0 },
      { geometry: createBox(3.5, 0.3, 3.5), position: new THREE.Vector3(0, 3.15, 0), materialIndex: 1 },
      { geometry: createCylinder(0.8, 0.8, 1.5), position: new THREE.Vector3(1.5, 2.25, 1.5), materialIndex: 2, emissiveVertices: [0, 1, 2, 3] },
      { geometry: createCylinder(0.8, 0.8, 1.5), position: new THREE.Vector3(-1.5, 2.25, 1.5), materialIndex: 2, emissiveVertices: [0, 1, 2, 3] },
      { geometry: createCylinder(0.8, 0.8, 1.5), position: new THREE.Vector3(1.5, 2.25, -1.5), materialIndex: 2, emissiveVertices: [0, 1, 2, 3] },
      { geometry: createCylinder(0.8, 0.8, 1.5), position: new THREE.Vector3(-1.5, 2.25, -1.5), materialIndex: 2, emissiveVertices: [0, 1, 2, 3] },
    ],
  },
  {
    name: 'solar',
    height: 3.0,
    footprintRadius: 2.5,
    parts: [
      { geometry: createBox(1.5, 0.5, 5), position: new THREE.Vector3(0, 0.25, 0), materialIndex: 3 },
      { geometry: createBox(4.5, 0.1, 0.3), position: new THREE.Vector3(0, 0.6, 0), rotation: new THREE.Euler(0, 0, 0), materialIndex: 4, rotorVertices: [0, 1, 2, 3] },
    ],
  },
  {
    name: 'antenna',
    height: 8.0,
    footprintRadius: 1.0,
    parts: [
      { geometry: createCylinder(0.3, 0.5, 2), position: new THREE.Vector3(0, 1, 0), materialIndex: 5 },
      { geometry: createCylinder(0.1, 0.1, 6), position: new THREE.Vector3(0, 5, 0), materialIndex: 5 },
      { geometry: createSphere(0.8), position: new THREE.Vector3(0, 8.3, 0), materialIndex: 6 },
    ],
  },
  {
    name: 'silo',
    height: 6.0,
    footprintRadius: 1.5,
    parts: [
      { geometry: createCylinder(1.2, 1.2, 5), position: new THREE.Vector3(0, 2.5, 0), materialIndex: 0 },
      { geometry: createCone(1.5, 1.5), position: new THREE.Vector3(0, 5.5, 0), materialIndex: 1 },
      { geometry: createCylinder(0.3, 0.3, 1), position: new THREE.Vector3(0, 6.5, 0), materialIndex: 5 },
    ],
  },
  {
    name: 'workshop',
    height: 4.0,
    footprintRadius: 2.5,
    parts: [
      { geometry: createBox(5, 3, 4), position: new THREE.Vector3(0, 1.5, 0), materialIndex: 0 },
      { geometry: createBox(4.5, 0.4, 3.5), position: new THREE.Vector3(0, 3.2, 0), materialIndex: 1 },
      { geometry: createCylinder(0.5, 0.5, 1.5), position: new THREE.Vector3(2, 2.25, 0), materialIndex: 5, rotorVertices: [0, 1, 2, 3] },
      { geometry: createBox(1, 2, 1), position: new THREE.Vector3(-2, 2, 1.5), materialIndex: 2, emissiveVertices: [0, 1, 2, 3] },
    ],
  },
  {
    name: 'greenhouse',
    height: 3.5,
    footprintRadius: 2.0,
    parts: [
      { geometry: createBox(3.5, 1, 3.5), position: new THREE.Vector3(0, 0.5, 0), materialIndex: 7 },
      { geometry: createSphere(2, 12), position: new THREE.Vector3(0, 2.5, 0), scale: new THREE.Vector3(1, 0.7, 1), materialIndex: 8 },
    ],
  },
  {
    name: 'landing-pad',
    height: 0.5,
    footprintRadius: 3.5,
    parts: [
      { geometry: createCylinder(3.5, 3.5, 0.4), position: new THREE.Vector3(0, 0.2, 0), materialIndex: 1 },
      { geometry: createCylinder(2.5, 2.5, 0.1), position: new THREE.Vector3(0, 0.45, 0), materialIndex: 4 },
    ],
  },
  {
    name: 'storage',
    height: 3.0,
    footprintRadius: 2.0,
    parts: [
      { geometry: createBox(3.5, 2.5, 3.5), position: new THREE.Vector3(0, 1.25, 0), materialIndex: 0 },
      { geometry: createCylinder(0.8, 0.8, 1), position: new THREE.Vector3(0, 2.75, 0), materialIndex: 5 },
    ],
  },
  {
    name: 'lab',
    height: 4.5,
    footprintRadius: 1.8,
    parts: [
      { geometry: createBox(3, 3.5, 3), position: new THREE.Vector3(0, 1.75, 0), materialIndex: 9 },
      { geometry: createCylinder(0.6, 0.6, 1), position: new THREE.Vector3(0, 3.75, 0), materialIndex: 6, emissiveVertices: [0, 1, 2, 3] },
      { geometry: createSphere(0.8), position: new THREE.Vector3(0, 4.5, 0), materialIndex: 6, emissiveVertices: [0, 1, 2, 3, 4, 5] },
    ],
  },
  {
    name: 'relay',
    height: 7.0,
    footprintRadius: 1.2,
    parts: [
      { geometry: createCylinder(0.8, 1.0, 2), position: new THREE.Vector3(0, 1, 0), materialIndex: 5 },
      { geometry: createBox(2, 0.5, 2), position: new THREE.Vector3(0, 2.5, 0), materialIndex: 4 },
      { geometry: createCylinder(0.15, 0.15, 4.5), position: new THREE.Vector3(0, 5.5, 0), materialIndex: 5 },
      { geometry: createSphere(0.5), position: new THREE.Vector3(0, 8, 0), materialIndex: 6, emissiveVertices: [0, 1, 2, 3, 4, 5] },
    ],
  },
];

const MATERIAL_COUNT = 10;

function pickRecipe(rand: () => number): BuildingRecipe {
  return BUILDING_RECIPES[Math.floor(rand() * BUILDING_RECIPES.length)];
}

export function createBuildingGeometry(floorId: string): { geometry: THREE.BufferGeometry; recipe: BuildingRecipe; materials: number[] } {
  const seed = hashString(floorId);
  const rand = seededRandom(seed);
  const recipe = pickRecipe(rand);

  const geometries: THREE.BufferGeometry[] = [];
  const materialIndices: number[] = [];
  const emissiveArray: number[] = [];
  const rotorArray: number[] = [];
  let vertexOffset = 0;

  for (const part of recipe.parts) {
    let geo = part.geometry.clone();

    if (part.scale) {
      geo.scale(part.scale.x, part.scale.y, part.scale.z);
    }

    if (part.rotation) {
      geo.rotateX(part.rotation.x);
      geo.rotateY(part.rotation.y);
      geo.rotateZ(part.rotation.z);
    }

    const pos = part.position.clone();
    geo.translate(pos.x, pos.y, pos.z);

    const vertexCount = geo.attributes.position.count;

    const matIndex = new Float32Array(vertexCount).fill(part.materialIndex);
    if (!geo.attributes.materialIndex) {
      geo.setAttribute('materialIndex', new THREE.InstancedBufferAttribute(matIndex, 1));
    }

    if (part.emissiveVertices) {
      const emissive = new Float32Array(vertexCount).fill(0);
      part.emissiveVertices.forEach((idx) => { if (idx < vertexCount) emissive[idx] = 1; });
      geo.setAttribute('aEmissive', new THREE.InstancedBufferAttribute(emissive, 1));
    } else {
      geo.setAttribute('aEmissive', new THREE.InstancedBufferAttribute(new Float32Array(vertexCount).fill(0), 1));
    }

    if (part.rotorVertices) {
      const rotor = new Float32Array(vertexCount).fill(0);
      part.rotorVertices.forEach((idx) => { if (idx < vertexCount) rotor[idx] = 1; });
      geo.setAttribute('aRotor', new THREE.InstancedBufferAttribute(rotor, 1));
    } else {
      geo.setAttribute('aRotor', new THREE.InstancedBufferAttribute(new Float32Array(vertexCount).fill(0), 1));
    }

    geometries.push(geo);
    materialIndices.push(part.materialIndex);
    vertexOffset += vertexCount;
  }

  const merged = mergeGeometries(geometries, false);
  if (!merged) throw new Error('Failed to merge building geometries');

  return { geometry: merged, recipe, materials: materialIndices };
}

export function getBuildingHeight(floorId: string): number {
  const { recipe } = createBuildingGeometry(floorId);
  return recipe.height;
}

export function getBuildingFootprint(floorId: string): number {
  const { recipe } = createBuildingGeometry(floorId);
  return recipe.footprintRadius;
}

export function createBuildingMaterials(accentColor: THREE.Color): THREE.MeshStandardMaterial[] {
  return [
    new THREE.MeshStandardMaterial({ color: accentColor.clone().multiply(new THREE.Color(0x666666)), roughness: 0.7, metalness: 0.3 }),
    new THREE.MeshStandardMaterial({ color: accentColor.clone().multiply(new THREE.Color(0x444444)), roughness: 0.5, metalness: 0.5 }),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: accentColor.clone().multiply(new THREE.Color(0x884400)), emissiveIntensity: 0, roughness: 0.2, metalness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: accentColor.clone().multiply(new THREE.Color(0x555555)), roughness: 0.8, metalness: 0.2 }),
    new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9, metalness: 0.1 }),
    new THREE.MeshStandardMaterial({ color: accentColor.clone().multiply(new THREE.Color(0x777777)), roughness: 0.4, metalness: 0.6 }),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: accentColor.clone(), emissiveIntensity: 0, roughness: 0.1, metalness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0x88cc88, transparent: true, opacity: 0.6, roughness: 0.1, metalness: 0.0 }),
    new THREE.MeshStandardMaterial({ color: 0xaaffaa, transparent: true, opacity: 0.4, roughness: 0.1, metalness: 0.0 }),
    new THREE.MeshStandardMaterial({ color: accentColor.clone().multiply(new THREE.Color(0x555577)), roughness: 0.6, metalness: 0.4 }),
  ];
}

export function disposeBuildingGeometry(geometry: THREE.BufferGeometry): void {
  geometry.dispose();
}