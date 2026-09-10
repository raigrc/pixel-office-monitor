import * as THREE from 'three';
import { hexToWorld, hexToKey, HexCell } from './hex-grid';

export interface ScatterConfig {
  halfExtent: number;
  density: number;
  planetPreset: 'luna' | 'mars' | 'terra';
}

const SCATTER_PRESETS: Record<'luna' | 'mars' | 'terra', {
  models: ('boulder' | 'crater' | 'rock')[];
  weights: number[];
  scaleRange: [number, number];
}> = {
  luna: {
    models: ['boulder', 'crater', 'rock', 'rock'],
    weights: [0.3, 0.2, 0.25, 0.25],
    scaleRange: [0.5, 2.0],
  },
  mars: {
    models: ['boulder', 'rock', 'rock', 'crater'],
    weights: [0.25, 0.3, 0.25, 0.2],
    scaleRange: [0.4, 1.8],
  },
  terra: {
    models: ['rock', 'boulder', 'crater'],
    weights: [0.4, 0.3, 0.3],
    scaleRange: [0.3, 1.5],
  },
};

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function createBoulderGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.IcosahedronGeometry(1, 1);
  const positions = geometry.attributes.position;
  const rand = mulberry32(0xB0B0B0B0);

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const noise = 1 + (rand() - 0.5) * 0.4;
    positions.setXYZ(i, x * noise, y * noise, z * noise);
  }

  geometry.computeVertexNormals();
  return geometry;
}

function createRockGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.DodecahedronGeometry(1, 0);
  const positions = geometry.attributes.position;
  const rand = mulberry32(0xDEADBEEF);

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const noise = 1 + (rand() - 0.5) * 0.6;
    positions.setXYZ(i, x * noise, y * noise, z * noise);
  }

  geometry.computeVertexNormals();
  return geometry;
}

function createCraterGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(1.2, 1.5, 0.3, 8, 1, true);
  const positions = geometry.attributes.position;
  const rand = mulberry32(0xFEEDFACE);

  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    if (y > 0) {
      positions.setY(i, y * (0.5 + rand() * 0.3));
    }
  }

  geometry.computeVertexNormals();
  return geometry;
}

function getGeometry(type: 'boulder' | 'rock' | 'crater'): THREE.BufferGeometry {
  switch (type) {
    case 'boulder':
      return createBoulderGeometry();
    case 'rock':
      return createRockGeometry();
    case 'crater':
      return createCraterGeometry();
  }
}

export function createScatterMesh(
  config: ScatterConfig,
  occupiedCells: Map<string, HexCell>,
  shipPosition: THREE.Vector3 = new THREE.Vector3(0, 0, -30),
  shipRadius: number = 15
): THREE.Mesh {
  const { halfExtent, density, planetPreset } = config;
  const preset = SCATTER_PRESETS[planetPreset];

  const geometries: THREE.BufferGeometry[] = [];
  for (const model of preset.models) {
    geometries.push(getGeometry(model));
  }

  const dummy = new THREE.Object3D();
  const positions: THREE.Vector3[] = [];
  const scales: number[] = [];
  const geometryIndices: number[] = [];

  const rand = mulberry32(planetPreset === 'luna' ? 0xDEADC0DE : planetPreset === 'mars' ? 0xBADF00D : 0xCAFEBABE);
  const cellSize = 3;
  const gridSize = Math.ceil((halfExtent * 2) / cellSize);

  for (let gz = 0; gz < gridSize; gz++) {
    for (let gx = 0; gx < gridSize; gx++) {
      const x = -halfExtent + (gx + 0.5) * cellSize;
      const z = -halfExtent + (gz + 0.5) * cellSize;

      const distToShip = Math.hypot(x - shipPosition.x, z - shipPosition.z);
      if (distToShip < shipRadius) continue;

      const worldPos = new THREE.Vector3(x, 0, z);
      const hex = { q: Math.round(x / 2.6), r: Math.round(z / 2.6) };
      const hexKey = hexToKey(hex.q, hex.r);
      if (occupiedCells.has(hexKey)) continue;

      if (rand() > density) continue;

      const modelIdx = Math.floor(rand() * preset.models.length);
      const scale = preset.scaleRange[0] + rand() * (preset.scaleRange[1] - preset.scaleRange[0]);

      positions.push(worldPos);
      scales.push(scale);
      geometryIndices.push(modelIdx);
    }
  }

  const totalCount = positions.length;
  if (totalCount === 0) {
    return new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial());
  }

  const mergedGeometry = new THREE.BufferGeometry();
  const mergedAttributes: Map<string, number[]> = new Map();
  let vertexCount = 0;

  for (let i = 0; i < totalCount; i++) {
    const geo = geometries[geometryIndices[i]];
    const pos = geo.attributes.position;
    const scale = scales[i];
    const position = positions[i];

    for (let v = 0; v < pos.count; v++) {
      const x = pos.getX(v) * scale + position.x;
      const y = pos.getY(v) * scale + position.y;
      const z = pos.getZ(v) * scale + position.z;

      if (!mergedAttributes.has('position')) mergedAttributes.set('position', []);
      mergedAttributes.get('position')!.push(x, y, z);

      if (geo.attributes.normal) {
        const nx = geo.attributes.normal.getX(v);
        const ny = geo.attributes.normal.getY(v);
        const nz = geo.attributes.normal.getZ(v);
        if (!mergedAttributes.has('normal')) mergedAttributes.set('normal', []);
        mergedAttributes.get('normal')!.push(nx, ny, nz);
      }
    }
    vertexCount += pos.count;
  }

  for (const [name, array] of mergedAttributes) {
    mergedGeometry.setAttribute(name, new THREE.Float32BufferAttribute(array, 3));
  }

  mergedGeometry.computeBoundingSphere();

  const material = new THREE.MeshStandardMaterial({
    color: 0x3a3a3a,
    roughness: 0.9,
    metalness: 0.05,
  });

  const mesh = new THREE.Mesh(mergedGeometry, material);

  // Source part geometries served their purpose. Free them.
  for (const geo of geometries) geo.dispose();

  return mesh;
}

export function rebuildScatter(
  mesh: THREE.Mesh,
  config: ScatterConfig,
  occupiedCells: Map<string, HexCell>,
  shipPosition: THREE.Vector3,
  shipRadius: number
): THREE.Mesh {
  mesh.geometry.dispose();
  if (Array.isArray(mesh.material)) {
    mesh.material.forEach((m) => m.dispose());
  } else {
    mesh.material.dispose();
  }
  return createScatterMesh(config, occupiedCells, shipPosition, shipRadius);
}