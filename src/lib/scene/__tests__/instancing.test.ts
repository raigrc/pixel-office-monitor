import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import * as THREE from 'three';

// Mock document for CanvasTexture creation (same pattern as astronauts.test.ts).
const mockContext = {
  fillStyle: '',
  fillRect: vi.fn(),
  font: '',
  textAlign: '',
  textBaseline: '',
  fillText: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  createImageData: () => ({ data: new Uint8ClampedArray(128 * 128 * 4) }),
  putImageData: vi.fn(),
  strokeStyle: '',
  lineWidth: 1,
  setLineDash: vi.fn(),
  strokeRect: vi.fn(),
};

const mockCanvas = {
  width: 0,
  height: 0,
  getContext: () => mockContext,
};

vi.stubGlobal('document', {
  createElement: () => mockCanvas,
});

import { createCrewRig, type CrewRig } from '../crew-rig';
import {
  ASTRONAUT_VERTEX_SHADER,
  createAstronauts,
  type Astronauts,
  type AstronautState,
} from '../astronauts';
import { BADGE_VERTEX_SHADER, createBadges } from '../indicators';

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

function translationOf(mesh: THREE.InstancedMesh, index: number): THREE.Vector3 {
  const m = new THREE.Matrix4();
  mesh.getMatrixAt(index, m);
  return new THREE.Vector3().setFromMatrixPosition(m);
}

// Instance matrices live in Float32 buffers, so exact float equality
// (0.6, 2.2) never survives a round trip. Compare within tolerance.
function expectCloseTo(actual: THREE.Vector3, expected: THREE.Vector3): void {
  expect(actual.x).toBeCloseTo(expected.x, 5);
  expect(actual.y).toBeCloseTo(expected.y, 5);
  expect(actual.z).toBeCloseTo(expected.z, 5);
}

describe('astronaut instanced shader (1.1A)', () => {
  it('applies instanceMatrix exactly once', () => {
    expect(countOccurrences(ASTRONAUT_VERTEX_SHADER, 'instanceMatrix')).toBe(1);
  });

  it('guards the instancing path so single-mesh use still compiles', () => {
    expect(ASTRONAUT_VERTEX_SHADER).toContain('#ifdef USE_INSTANCING');
  });

  it('builds world position from model * instance, not model alone', () => {
    expect(ASTRONAUT_VERTEX_SHADER).toContain('modelMatrix * instanceTransform');
    expect(ASTRONAUT_VERTEX_SHADER).not.toContain('modelMatrix * vec4');
  });

  it('transforms normals with the instance transform', () => {
    expect(ASTRONAUT_VERTEX_SHADER).toContain('mat3(instanceTransform) * normal');
  });

  it('preserves animation, suit color, and face varyings', () => {
    expect(ASTRONAUT_VERTEX_SHADER).toContain('instanceFrame');
    expect(ASTRONAUT_VERTEX_SHADER).toContain('aSuit');
    expect(ASTRONAUT_VERTEX_SHADER).toContain('instanceFace');
    expect(ASTRONAUT_VERTEX_SHADER).toContain('uTime');
  });
});

describe('badge instanced shader (1.1A)', () => {
  it('applies instanceMatrix exactly once', () => {
    expect(countOccurrences(BADGE_VERTEX_SHADER, 'instanceMatrix')).toBe(1);
  });

  it('has no second position source', () => {
    expect(BADGE_VERTEX_SHADER).not.toContain('instancePosition');
  });

  it('builds world position from model * instance, not model alone', () => {
    expect(BADGE_VERTEX_SHADER).toContain('modelMatrix * instanceTransform');
    expect(BADGE_VERTEX_SHADER).not.toContain('modelMatrix * vec4');
  });

  it('preserves badge atlas, tint, and size inputs', () => {
    expect(BADGE_VERTEX_SHADER).toContain('aBadge');
    expect(BADGE_VERTEX_SHADER).toContain('aTint');
    expect(BADGE_VERTEX_SHADER).toContain('uBadgeSize');
  });
});

describe('multi-instance placement (1.1A/1.1D)', () => {
  let rig: CrewRig;
  let astronauts: Astronauts;

  const agent = (id: string, x: number, z: number): AstronautState => ({
    id,
    position: new THREE.Vector3(x, 0.6, z),
    target: new THREE.Vector3(x, 0.6, z),
    clip: 'idle',
    clipTime: 0,
    frame: 0,
    suitColor: new THREE.Color(0xff8800),
    detailColor: new THREE.Color(0xffffff),
    accessory: 'device',
    faceIndex: 0,
    badge: 'none',
    working: false,
  });

  beforeAll(() => {
    rig = createCrewRig();
    astronauts = createAstronauts({ maxAgents: 8, rig });
  });

  afterAll(() => {
    astronauts?.dispose();
  });

  it('keeps two non-origin agents out of the origin on every mesh', () => {
    astronauts.addAgent(agent('n1', 5, 3));
    astronauts.addAgent(agent('n2', -4, -2));
    const meshes = astronauts.getMeshes();
    expect(meshes.length).toBe(12);
    for (const mesh of meshes) {
      expectCloseTo(translationOf(mesh, 0), new THREE.Vector3(5, 0.6, 3));
      expectCloseTo(translationOf(mesh, 1), new THREE.Vector3(-4, 0.6, -2));
    }
  });

  it('places two badges at their agent offsets, not the origin', () => {
    const badges = createBadges(4);
    badges.setBadge('a', 'working', new THREE.Vector3(2, 0, 3), new THREE.Color(1, 1, 1));
    badges.setBadge('b', 'waiting', new THREE.Vector3(-1, 0, 4), new THREE.Color(1, 1, 1));
    badges.updateView(new THREE.Quaternion());
    const mesh = badges.getMesh();
    expectCloseTo(translationOf(mesh, 0), new THREE.Vector3(2, 2.2, 3));
    expectCloseTo(translationOf(mesh, 1), new THREE.Vector3(-1, 2.2, 4));
    badges.dispose();
  });
});
