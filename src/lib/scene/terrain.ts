import * as THREE from 'three';

export type PlanetPreset = 'luna' | 'mars' | 'terra';

export interface TerrainConfig {
  preset: PlanetPreset;
  halfExtent: number;
  resolution: number;
}

const PLANET_PRESETS: Record<PlanetPreset, {
  colors: THREE.Color[];
  heights: number[];
  noiseScale: number;
  noiseOctaves: number;
  noisePersistence: number;
}> = {
  luna: {
    colors: [
      new THREE.Color(0x1a1a2e),
      new THREE.Color(0x2a2a4a),
      new THREE.Color(0x3a3a5e),
      new THREE.Color(0x4a4a6e),
    ],
    heights: [0, 0.5, 1.5, 3.0],
    noiseScale: 0.02,
    noiseOctaves: 4,
    noisePersistence: 0.5,
  },
  mars: {
    colors: [
      new THREE.Color(0x3d1a10),
      new THREE.Color(0x5c2a1a),
      new THREE.Color(0x8b4513),
      new THREE.Color(0xcd6839),
    ],
    heights: [0, 0.8, 2.0, 4.0],
    noiseScale: 0.015,
    noiseOctaves: 5,
    noisePersistence: 0.55,
  },
  terra: {
    colors: [
      new THREE.Color(0x0d3b1a),
      new THREE.Color(0x1a5c2a),
      new THREE.Color(0x2d7a3a),
      new THREE.Color(0x4a9b5a),
    ],
    heights: [0, 0.3, 1.0, 2.5],
    noiseScale: 0.025,
    noiseOctaves: 3,
    noisePersistence: 0.45,
  },
};

const PRESET_SEEDS: Record<PlanetPreset, number> = {
  luna: 0x1a2b3c4d,
  mars: 0x5e6f7a8b,
  terra: 0x9c0d1e2f,
};

/** Terrain relief half-range. Deck slabs sit above this. */
export const TERRAIN_HALF_RANGE = 0.45;

/** Pure hash of an integer lattice point. No sequential state. */
function hashLattice(ix: number, iz: number, seed: number): number {
  let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + seed;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function latticeNoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  const v1 = hashLattice(ix, iz, seed) * 2 - 1;
  const v2 = hashLattice(ix + 1, iz, seed) * 2 - 1;
  const v3 = hashLattice(ix, iz + 1, seed) * 2 - 1;
  const v4 = hashLattice(ix + 1, iz + 1, seed) * 2 - 1;
  const n1 = v1 + u * (v2 - v1);
  const n2 = v3 + u * (v4 - v3);
  return n1 + v * (n2 - n1);
}

/**
 * Terrain height at any world point. Pure function of coordinates,
 * so placements can resample the exact surface the mesh shows.
 */
export function heightAt(x: number, z: number, preset: PlanetPreset): number {
  const planet = PLANET_PRESETS[preset];
  const seed = PRESET_SEEDS[preset];
  let value = 0;
  let amplitude = 1;
  let frequency = planet.noiseScale;
  let maxValue = 0;
  for (let i = 0; i < planet.noiseOctaves; i++) {
    value += latticeNoise(x * frequency, z * frequency, seed + i * 0x9e3779b9) * amplitude;
    maxValue += amplitude;
    amplitude *= planet.noisePersistence;
    frequency *= 2;
  }
  return (value / maxValue) * TERRAIN_HALF_RANGE;
}

export function createTerrainGeometry(config: TerrainConfig): THREE.BufferGeometry {
  const { preset, halfExtent, resolution } = config;
  const planet = PLANET_PRESETS[preset];

  const vertices: number[] = [];
  const indices: number[] = [];
  const colors: number[] = [];
  const normals: number[] = [];

  const step = (halfExtent * 2) / resolution;

  for (let gz = 0; gz <= resolution; gz++) {
    const z = -halfExtent + gz * step;
    for (let gx = 0; gx <= resolution; gx++) {
      const x = -halfExtent + gx * step;

      const y = heightAt(x, z, preset);
      vertices.push(x, y, z);

      // Normalized elevation picks the color band. Bands stay even
      // across presets so relief reads the same on every planet.
      const t = (y + TERRAIN_HALF_RANGE) / (TERRAIN_HALF_RANGE * 2);
      const band = t < 0.25 ? 0 : t < 0.55 ? 1 : t < 0.8 ? 2 : 3;
      const color = planet.colors[band];
      colors.push(color.r, color.g, color.b);

      normals.push(0, 1, 0);
    }
  }

  for (let gz = 0; gz < resolution; gz++) {
    for (let gx = 0; gx < resolution; gx++) {
      const a = gz * (resolution + 1) + gx;
      const b = a + 1;
      const c = a + resolution + 1;
      const d = c + 1;

      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return geometry;
}

export function createTerrainMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.05,
    flatShading: false,
  });
}