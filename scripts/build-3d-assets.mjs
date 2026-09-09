import * as THREE from 'three';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = join(process.cwd(), 'public', 'assets', '3d');

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function createBuildingGLB(name: string): ArrayBuffer {
  const geometry = new THREE.BoxGeometry(2, 3, 2);
  geometry.translate(0, 1.5, 0);

  const material = new THREE.MeshStandardMaterial({
    color: 0x888888,
    roughness: 0.7,
    metalness: 0.3,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const exporter = new THREE.GLTFExporter();
  const result = exporter.parseSync(mesh, { binary: true });
  return result as ArrayBuffer;
}

function createAstronautGLB(): ArrayBuffer {
  const group = new THREE.Group();

  const bodyGeo = new THREE.CapsuleGeometry(0.25, 0.8, 4, 8);
  bodyGeo.translate(0, 1.2, 0);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.3 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  group.add(body);

  const helmetGeo = new THREE.SphereGeometry(0.3, 8, 6);
  helmetGeo.translate(0, 1.85, 0);
  helmetGeo.scale(1, 1.1, 1);
  const helmetMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.7 });
  const helmet = new THREE.Mesh(helmetGeo, helmetMat);
  helmet.castShadow = true;
  group.add(helmet);

  const exporter = new THREE.GLTFExporter();
  const result = exporter.parseSync(group, { binary: true });
  return result as ArrayBuffer;
}

function createScatterGLB(name: string): ArrayBuffer {
  let geometry: THREE.BufferGeometry;
  switch (name) {
    case 'boulder':
      geometry = new THREE.IcosahedronGeometry(1, 1);
      break;
    case 'rock':
      geometry = new THREE.DodecahedronGeometry(1, 0);
      break;
    case 'crater':
      geometry = new THREE.CylinderGeometry(1.2, 1.5, 0.3, 8, 1, true);
      break;
    default:
      geometry = new THREE.BoxGeometry(1, 1, 1);
  }

  const material = new THREE.MeshStandardMaterial({
    color: 0x3a3a3a,
    roughness: 0.9,
    metalness: 0.05,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const exporter = new THREE.GLTFExporter();
  const result = exporter.parseSync(mesh, { binary: true });
  return result as ArrayBuffer;
}

function createShipGLB(): ArrayBuffer {
  const group = new THREE.Group();

  const hullGeo = new THREE.SphereGeometry(8, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  hullGeo.scale(1, 0.4, 1.2);
  hullGeo.translate(0, 3, 0);
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.6, metalness: 0.7, side: THREE.DoubleSide });
  const hull = new THREE.Mesh(hullGeo, hullMat);
  hull.castShadow = true;
  hull.receiveShadow = true;
  group.add(hull);

  const engineGeo = new THREE.CylinderGeometry(2, 3, 2, 12, 1, true);
  engineGeo.translate(0, -1, 0);
  engineGeo.rotateX(Math.PI);
  const engineMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.5, metalness: 0.8, side: THREE.DoubleSide });
  const engine = new THREE.Mesh(engineGeo, engineMat);
  engine.castShadow = true;
  group.add(engine);

  const exporter = new THREE.GLTFExporter();
  const result = exporter.parseSync(group, { binary: true });
  return result as ArrayBuffer;
}

function createTerrainGLB(): ArrayBuffer {
  const geometry = new THREE.PlaneGeometry(112, 112, 112, 112);
  geometry.rotateX(-Math.PI / 2);

  const material = new THREE.MeshStandardMaterial({
    color: 0x2a2a2a,
    roughness: 0.9,
    metalness: 0.05,
    vertexColors: true,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;

  const exporter = new THREE.GLTFExporter();
  const result = exporter.parseSync(mesh, { binary: true });
  return result as ArrayBuffer;
}

function buildAll(): void {
  console.log('Building 3D assets...');
  ensureDir(OUTPUT_DIR);

  const buildings = ['habitat', 'solar', 'antenna', 'silo', 'workshop', 'greenhouse', 'landing-pad', 'storage', 'lab', 'relay'];
  for (const name of buildings) {
    const glb = createBuildingGLB(name);
    writeFileSync(join(OUTPUT_DIR, `building-${name}.glb`), Buffer.from(glb));
    console.log(`  ✓ building-${name}.glb`);
  }

  const astronautGlb = createAstronautGLB();
  writeFileSync(join(OUTPUT_DIR, 'astronaut.glb'), Buffer.from(astronautGlb));
  console.log(`  ✓ astronaut.glb`);

  const scatterTypes = ['boulder', 'rock', 'crater'];
  for (const name of scatterTypes) {
    const glb = createScatterGLB(name);
    writeFileSync(join(OUTPUT_DIR, `scatter-${name}.glb`), Buffer.from(glb));
    console.log(`  ✓ scatter-${name}.glb`);
  }

  const shipGlb = createShipGLB();
  writeFileSync(join(OUTPUT_DIR, 'ship.glb'), Buffer.from(shipGlb));
  console.log(`  ✓ ship.glb`);

  const terrainGlb = createTerrainGLB();
  writeFileSync(join(OUTPUT_DIR, 'terrain.glb'), Buffer.from(terrainGlb));
  console.log(`  ✓ terrain.glb`);

  console.log('3D assets built successfully!');
}

buildAll();