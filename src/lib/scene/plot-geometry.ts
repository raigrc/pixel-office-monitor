import * as THREE from 'three';
import { HEX_SIZE, DECK_TOP } from './hex-grid';

export const PLOT_HEIGHT = 0.15;
export const KERB_HEIGHT = 0.05;

export function createDeckGeometry(): THREE.BufferGeometry {
  const segments = 6;
  const radius = HEX_SIZE * 0.98;

  const vertices: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];
  const normals: number[] = [];

  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    vertices.push(
      Math.cos(angle) * radius,
      0,
      Math.sin(angle) * radius
    );
    uvs.push(0.5 + Math.cos(angle) * 0.5, 0.5 + Math.sin(angle) * 0.5);
    normals.push(0, 1, 0);
  }

  vertices.push(0, PLOT_HEIGHT, 0);
  uvs.push(0.5, 0.5);
  normals.push(0, 1, 0);
  const centerTop = segments;

  for (let i = 0; i < segments; i++) {
    vertices.push(
      Math.cos((i / segments) * Math.PI * 2) * radius,
      PLOT_HEIGHT,
      Math.sin((i / segments) * Math.PI * 2) * radius
    );
    uvs.push(0.5 + Math.cos((i / segments) * Math.PI * 2) * 0.5, 0.5 + Math.sin((i / segments) * Math.PI * 2) * 0.5);
    normals.push(0, 1, 0);
  }

  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    indices.push(i, next, centerTop);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();

  return geometry;
}

export function createKerbGeometry(): THREE.BufferGeometry {
  const segments = 6;
  const radius = HEX_SIZE * 0.98;

  const vertices: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];
  const normals: number[] = [];

  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    vertices.push(
      Math.cos(angle) * radius,
      PLOT_HEIGHT,
      Math.sin(angle) * radius
    );
    uvs.push(i / segments, 0);
    normals.push(Math.cos(angle), 0, Math.sin(angle));
  }

  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    vertices.push(
      Math.cos(angle) * radius,
      PLOT_HEIGHT + KERB_HEIGHT,
      Math.sin(angle) * radius
    );
    uvs.push(i / segments, 1);
    normals.push(Math.cos(angle), 0, Math.sin(angle));
  }

  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    indices.push(i, next, i + segments);
    indices.push(next, next + segments, i + segments);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();

  return geometry;
}

export function createPlateTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#3a3a4a';
  ctx.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y += 4) {
    for (let x = 0; x < size; x += 4) {
      const noise = Math.random() * 30 - 15;
      ctx.fillStyle = `rgb(${40 + noise}, ${40 + noise}, ${50 + noise})`;
      ctx.fillRect(x, y, 2, 2);
    }
  }

  ctx.strokeStyle = 'rgba(80, 80, 100, 0.3)';
  ctx.lineWidth = 1;
  for (let i = 0; i < size; i += 16) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  return texture;
}

export function createNormalTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (Math.random() - 0.5) * 0.1;
      const dy = (Math.random() - 0.5) * 0.1;
      const nx = dx;
      const ny = 1.0;
      const nz = dy;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);

      const idx = (y * size + x) * 4;
      data[idx] = Math.round((nx / len) * 127 + 127);
      data[idx + 1] = Math.round((ny / len) * 127 + 127);
      data[idx + 2] = Math.round((nz / len) * 127 + 127);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  return texture;
}

export function createKerbTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#2a2a3a';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(255, 200, 50, 0.6)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.strokeRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(6, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  return texture;
}

export interface PlotMaterials {
  deck: THREE.MeshStandardMaterial;
  kerb: THREE.MeshStandardMaterial;
  urgent: THREE.MeshStandardMaterial;
}

let cachedMaterials: PlotMaterials | null = null;

export function getPlotMaterials(accentColor: THREE.Color): PlotMaterials {
  if (!cachedMaterials) {
    const plateTex = createPlateTexture();
    const normalTex = createNormalTexture();
    const kerbTex = createKerbTexture();

    cachedMaterials = {
      deck: new THREE.MeshStandardMaterial({
        map: plateTex,
        normalMap: normalTex,
        normalScale: new THREE.Vector2(0.5, 0.5),
        roughness: 0.8,
        metalness: 0.2,
        color: 0xffffff,
      }),
      kerb: new THREE.MeshStandardMaterial({
        map: kerbTex,
        transparent: true,
        opacity: 0.8,
        roughness: 0.5,
        metalness: 0.8,
        color: 0xffffff,
        depthWrite: false,
      }),
      urgent: new THREE.MeshStandardMaterial({
        map: plateTex,
        normalMap: normalTex,
        normalScale: new THREE.Vector2(0.5, 0.5),
        roughness: 0.7,
        metalness: 0.3,
        color: 0xffffff,
        emissive: new THREE.Color(0xff8800),
        emissiveIntensity: 0.3,
      }),
    };
  }

  const materials = {
    deck: cachedMaterials.deck.clone(),
    kerb: cachedMaterials.kerb.clone(),
    urgent: cachedMaterials.urgent.clone(),
  };

  materials.deck.color.copy(accentColor).multiply(new THREE.Color(0x888888));
  materials.kerb.color.copy(accentColor).multiply(new THREE.Color(0xffcc44));
  materials.urgent.emissive.copy(accentColor).multiply(new THREE.Color(0xff8800));

  return materials;
}

export function disposePlotMaterials(): void {
  if (cachedMaterials) {
    cachedMaterials.deck.dispose();
    cachedMaterials.kerb.dispose();
    cachedMaterials.urgent.dispose();
    cachedMaterials = null;
  }
}