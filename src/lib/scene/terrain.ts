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

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function fbm(rand: () => number, x: number, z: number, octaves: number, persistence: number, scale: number): number {
  let value = 0;
  let amplitude = 1;
  let frequency = scale;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    const nx = x * frequency;
    const nz = z * frequency;
    const ix = Math.floor(nx);
    const iz = Math.floor(nz);
    const fx = nx - ix;
    const fz = nz - iz;

    const rand1 = () => rand();
    const rand2 = () => rand();
    const rand3 = () => rand();
    const rand4 = () => rand();

    const v1 = rand1() * 2 - 1;
    const v2 = rand2() * 2 - 1;
    const v3 = rand3() * 2 - 1;
    const v4 = rand4() * 2 - 1;

    const u = fx * fx * (3 - 2 * fx);
    const v = fz * fz * (3 - 2 * fz);

    const n1 = v1 + u * (v2 - v1);
    const n2 = v3 + u * (v4 - v3);
    const noise = n1 + v * (n2 - n1);

    value += noise * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }

  return value / maxValue;
}

export function createTerrainGeometry(config: TerrainConfig): THREE.BufferGeometry {
  const { preset, halfExtent, resolution } = config;
  const planet = PLANET_PRESETS[preset];

  const rand = mulberry32(preset === 'luna' ? 0x1A2B3C4D : preset === 'mars' ? 0x5E6F7A8B : 0x9C0D1E2F);

  const vertices: number[] = [];
  const indices: number[] = [];
  const colors: number[] = [];
  const normals: number[] = [];

  const step = (halfExtent * 2) / resolution;

  for (let gz = 0; gz <= resolution; gz++) {
    const z = -halfExtent + gz * step;
    for (let gx = 0; gx <= resolution; gx++) {
      const x = -halfExtent + gx * step;

      const noise = fbm(rand, x, z, planet.noiseOctaves, planet.noisePersistence, planet.noiseScale);
      const y = noise * 2;

      vertices.push(x, y, z);

      let color = planet.colors[0];
      for (let i = 0; i < planet.heights.length - 1; i++) {
        if (y >= planet.heights[i] && y < planet.heights[i + 1]) {
          const t = (y - planet.heights[i]) / (planet.heights[i + 1] - planet.heights[i]);
          color = planet.colors[i].clone().lerp(planet.colors[i + 1], t);
          break;
        } else if (y >= planet.heights[planet.heights.length - 1]) {
          color = planet.colors[planet.colors.length - 1];
        }
      }
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