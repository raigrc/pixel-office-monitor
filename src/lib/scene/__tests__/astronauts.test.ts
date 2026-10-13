import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import * as THREE from 'three';

// Mock document for CanvasTexture creation
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

import { createCrewRig, CrewRig, getClipFrame, getBoneMatrix } from '../crew-rig';
import {
  ASTRONAUT_INSTANCE_BOUNDS_PADDING,
  createAstronauts,
  Astronauts,
  AstronautState,
} from '../astronauts';
import { COZY_THEME } from '../../cozy-theme';

describe('Crew Rig', () => {
  let rig: CrewRig;

  beforeAll(() => {
    rig = createCrewRig();
  });

  it('should create skeleton with 22 bones', () => {
    expect(rig.skeleton.bones.length).toBe(22);
    expect(rig.boneCount).toBe(22);
  });

  it('should have all expected bone names', () => {
    const names = rig.skeleton.bones.map(b => b.name).sort();
    expect(names).toContain('hips');
    expect(names).toContain('spine');
    expect(names).toContain('head');
    expect(names).toContain('leftArm');
    expect(names).toContain('rightArm');
    expect(names).toContain('leftLeg');
    expect(names).toContain('rightLeg');
  });

  it('should have 12 clips', () => {
    expect(rig.clips.size).toBe(12);
    expect(rig.clips.has('idle')).toBe(true);
    expect(rig.clips.has('walk')).toBe(true);
    expect(rig.clips.has('run')).toBe(true);
    expect(rig.clips.has('work')).toBe(true);
    expect(rig.clips.has('wave')).toBe(true);
    expect(rig.clips.has('cheer')).toBe(true);
    expect(rig.clips.has('sitDown')).toBe(true);
    expect(rig.clips.has('sitIdle')).toBe(true);
    expect(rig.clips.has('standUp')).toBe(true);
    expect(rig.clips.has('hit')).toBe(true);
    expect(rig.clips.has('spawn')).toBe(true);
    expect(rig.clips.has('interact')).toBe(true);
  });

  it('should have bone matrices for each clip', () => {
    for (const clip of rig.clips.values()) {
      expect(clip.boneMatrices.length).toBe(clip.frames * rig.boneCount * 16);
      expect(clip.duration).toBeGreaterThan(0);
    }
  });

  it('should have bind matrix and inverse', () => {
    expect(rig.bindMatrix).toBeInstanceOf(THREE.Matrix4);
    expect(rig.bindMatrixInverse).toBeInstanceOf(THREE.Matrix4);
  });

  it('should have head, chest, hand offsets', () => {
    expect(rig.headOffset).toBeInstanceOf(THREE.Vector3);
    expect(rig.chestOffset).toBeInstanceOf(THREE.Vector3);
    expect(rig.handOffsets.left).toBeInstanceOf(THREE.Vector3);
    expect(rig.handOffsets.right).toBeInstanceOf(THREE.Vector3);
  });
});

describe('Astronauts', () => {
  let astronauts: Astronauts;
  let rig: CrewRig;

  beforeAll(() => {
    rig = createCrewRig();
    astronauts = createAstronauts({ maxAgents: 16, rig });
  });

  afterAll(() => {
    astronauts?.dispose();
  });

  it('should create 12 empty instanced meshes', () => {
    const meshes = astronauts.getMeshes();
    expect(meshes.length).toBe(12);
    for (const mesh of meshes) {
      expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
      expect(mesh.count).toBe(0);
    }
  });

  it('should add and track agents', () => {
    const agent: AstronautState = {
      id: 'agent-1',
      position: new THREE.Vector3(0, 0, 0),
      target: new THREE.Vector3(5, 0, 0),
      clip: 'idle',
      clipTime: 0,
      frame: 0,
      suitColor: new THREE.Color(0xff8800),
      detailColor: new THREE.Color(0xffffff),
      accessory: 'device',
      faceIndex: 0,
      badge: 'none',
      working: false,
    };
    astronauts.addAgent(agent);
    expect(astronauts.getAgentCount()).toBe(1);
    expect(astronauts.getAgent('agent-1')).toBeDefined();
  });

  it('should remove agents', () => {
    const agent: AstronautState = {
      id: 'agent-2',
      position: new THREE.Vector3(0, 0, 0),
      target: new THREE.Vector3(5, 0, 0),
      clip: 'idle',
      clipTime: 0,
      frame: 0,
      suitColor: new THREE.Color(0xff8800),
      detailColor: new THREE.Color(0xffffff),
      accessory: 'device',
      faceIndex: 0,
      badge: 'none',
      working: false,
    };
    astronauts.addAgent(agent);
    expect(astronauts.getAgentCount()).toBe(2);
    astronauts.removeAgent('agent-2');
    expect(astronauts.getAgentCount()).toBe(1);
    expect(astronauts.getAgent('agent-2')).toBeUndefined();
  });

  it('should update agent state', () => {
    astronauts.updateAgent('agent-1', { clip: 'walk', working: true });
    const agent = astronauts.getAgent('agent-1');
    expect(agent?.clip).toBe('walk');
    expect(agent?.working).toBe(true);
  });

  it('should update clip frames over time', () => {
    const initialFrame = astronauts.getAgent('agent-1')?.frame ?? 0;
    astronauts.update(0.1, 0.1);
    const newFrame = astronauts.getAgent('agent-1')?.frame ?? 0;
    expect(newFrame).toBeGreaterThanOrEqual(initialFrame);
  });

  it('should respect max agents limit', () => {
    for (let i = 0; i < 20; i++) {
      const agent: AstronautState = {
        id: `agent-limit-${i}`,
        position: new THREE.Vector3(i, 0, 0),
        target: new THREE.Vector3(i + 1, 0, 0),
        clip: 'idle',
        clipTime: 0,
        frame: 0,
        suitColor: new THREE.Color(0xffffff),
        detailColor: new THREE.Color(0xffffff),
        accessory: 'device',
        faceIndex: 0,
        badge: 'none',
        working: false,
      };
      astronauts.addAgent(agent);
    }
    expect(astronauts.getAgentCount()).toBeLessThanOrEqual(16);
  });

  it('should set uniforms', () => {
    astronauts.setUniforms({
      uSunDirection: new THREE.Vector3(0, 1, 0),
      uSunIntensity: 1.5,
    });
  });

  it('uses warm opaque supporting materials and disables shader bob under reduced motion', () => {
    const meshes = astronauts.getMeshes();
    const helmet = meshes[1].material as THREE.MeshStandardMaterial;
    const visor = meshes[2].material as THREE.MeshStandardMaterial;
    const lamp = meshes[5].material as THREE.MeshStandardMaterial;
    const body = meshes[0].material as THREE.ShaderMaterial;

    expect(helmet.color.getHex()).toBe(new THREE.Color(COZY_THEME.environment.floor).getHex());
    expect(helmet.metalness).toBe(COZY_THEME.materials.paintedMetal.metalness);
    expect(visor.transparent).toBe(false);
    expect(lamp.emissive.getHex()).toBe(new THREE.Color(COZY_THEME.environment.lamp).getHex());

    astronauts.setReducedMotion(true);
    expect(body.uniforms.uIdleMotion.value).toBe(0);
    astronauts.setUniforms({ uTime: 42 });
    expect(body.uniforms.uTime.value).toBe(42);
    expect(body.uniforms.uIdleMotion.value).toBe(0);
    astronauts.setReducedMotion(false);
    expect(body.uniforms.uIdleMotion.value).toBe(1);
  });
});

describe('Animation utilities', () => {
  let rig: CrewRig;

  beforeAll(() => {
    rig = createCrewRig();
  });

  it('should get clip frame for time', () => {
    const frame = getClipFrame(rig, 'idle', 1.0);
    expect(frame).toBeGreaterThanOrEqual(0);
    expect(frame).toBeLessThan(rig.clips.get('idle')!.frames);
  });

  it('should get bone matrix', () => {
    const mat = getBoneMatrix(rig, 'idle', 0, 0);
    expect(mat).toBeInstanceOf(THREE.Matrix4);
  });

  it('should return identity for invalid clip', () => {
    const mat = getBoneMatrix(rig, 'nonexistent', 0, 0);
    expect(mat.determinant()).toBe(1);
  });
});

describe('Astronauts compaction (1.1D)', () => {
  let rig: CrewRig;

  beforeAll(() => {
    rig = createCrewRig();
  });

  function makeAgent(id: string, x: number, color: number, face: number): AstronautState {
    return {
      id,
      position: new THREE.Vector3(x, 0.6, 0),
      target: new THREE.Vector3(x, 0.6, 0),
      clip: 'idle',
      clipTime: 0,
      frame: 0,
      suitColor: new THREE.Color(color),
      detailColor: new THREE.Color(0xffffff),
      accessory: 'device',
      faceIndex: face,
      badge: 'none',
      working: false,
    };
  }

  function makeTrio(): Astronauts {
    const crew = createAstronauts({ maxAgents: 8, rig });
    crew.addAgent(makeAgent('a', 0, 0xff0000, 1));
    crew.addAgent(makeAgent('b', 5, 0x00ff00, 2));
    crew.addAgent(makeAgent('c', -5, 0x0000ff, 3));
    return crew;
  }

  function translationOf(mesh: THREE.InstancedMesh, index: number): THREE.Vector3 {
    const m = new THREE.Matrix4();
    mesh.getMatrixAt(index, m);
    return new THREE.Vector3().setFromMatrixPosition(m);
  }

  function expectCloseTo(actual: THREE.Vector3, expected: THREE.Vector3): void {
    expect(actual.x).toBeCloseTo(expected.x, 5);
    expect(actual.y).toBeCloseTo(expected.y, 5);
    expect(actual.z).toBeCloseTo(expected.z, 5);
  }

  function expectSurvivors(
    crew: Astronauts,
    expected: { id: string; x: number; color: number; face: number }[],
  ): void {
    expect(crew.getAgentCount()).toBe(expected.length);
    const meshes = crew.getMeshes();
    expect(meshes.length).toBe(12);
    const body = meshes[0];
    const suit = body.geometry.getAttribute('aSuit') as THREE.InstancedBufferAttribute;
    const faceAttr = body.geometry.getAttribute('instanceFace') as THREE.InstancedBufferAttribute;
    expected.forEach((want, slot) => {
      expect(crew.getAgent(want.id)).toBeDefined();
      const expectedPos = new THREE.Vector3(want.x, 0.6, 0);
      for (const mesh of meshes) {
        expect(mesh.count).toBe(expected.length);
        expectCloseTo(translationOf(mesh, slot), expectedPos);
      }
      const color = new THREE.Color(want.color);
      expect(suit.getX(slot)).toBeCloseTo(color.r, 5);
      expect(suit.getY(slot)).toBeCloseTo(color.g, 5);
      expect(suit.getZ(slot)).toBeCloseTo(color.b, 5);
      expect(faceAttr.getX(slot)).toBe(want.face);
    });
  }

  it('rewrites survivors after removing the first agent', () => {
    const crew = makeTrio();
    crew.removeAgent('a');
    expectSurvivors(crew, [
      { id: 'b', x: 5, color: 0x00ff00, face: 2 },
      { id: 'c', x: -5, color: 0x0000ff, face: 3 },
    ]);
    crew.dispose();
  });

  it('rewrites survivors after removing the middle agent', () => {
    const crew = makeTrio();
    crew.removeAgent('b');
    expectSurvivors(crew, [
      { id: 'a', x: 0, color: 0xff0000, face: 1 },
      { id: 'c', x: -5, color: 0x0000ff, face: 3 },
    ]);
    crew.dispose();
  });

  it('keeps survivors in place after removing the last agent', () => {
    const crew = makeTrio();
    crew.removeAgent('c');
    expectSurvivors(crew, [
      { id: 'a', x: 0, color: 0xff0000, face: 1 },
      { id: 'b', x: 5, color: 0x00ff00, face: 2 },
    ]);
    crew.dispose();
  });

  it('uploads animation frames to the rendered instance attribute', () => {
    const crew = createAstronauts({ maxAgents: 1, rig });
    const subject = makeAgent('animated', 0, 0xffffff, 0);
    subject.clip = 'walk';
    crew.addAgent(subject);
    const elapsed = rig.clips.get('walk')!.duration * 0.5;

    crew.update(0, elapsed);

    const frame = crew.getAgent('animated')!.frame;
    const attr = crew.getMeshes()[0].geometry.getAttribute('instanceFrame') as THREE.InstancedBufferAttribute;
    expect(frame).toBeGreaterThan(0);
    expect(attr.getX(0)).toBe(frame);
    crew.dispose();
  });

  it('reports capacity rejection and accepts the agent after a slot frees', () => {
    const crew = createAstronauts({ maxAgents: 1, rig });
    expect(crew.addAgent(makeAgent('a', 0, 0xffffff, 0))).toBe(true);
    expect(crew.addAgent(makeAgent('b', 1, 0xffffff, 0))).toBe(false);

    crew.removeAgent('a');

    expect(crew.addAgent(makeAgent('b', 1, 0xffffff, 0))).toBe(true);
    expect(crew.getAgent('b')).toBeDefined();
    crew.dispose();
  });

  it('renders one batched accessory family per agent', () => {
    const crew = createAstronauts({ maxAgents: 2, rig });
    crew.addAgent(makeAgent('device', 1, 0xffffff, 0));
    const sensor = makeAgent('sensor', 2, 0xffffff, 0);
    sensor.accessory = 'sensor';
    crew.addAgent(sensor);

    const deviceMatrix = new THREE.Matrix4();
    const hiddenDeviceMatrix = new THREE.Matrix4();
    const sensorMatrix = new THREE.Matrix4();
    crew.getAccessoryMeshes().device.getMatrixAt(0, deviceMatrix);
    crew.getAccessoryMeshes().device.getMatrixAt(1, hiddenDeviceMatrix);
    crew.getAccessoryMeshes().sensor.getMatrixAt(1, sensorMatrix);
    const deviceScale = new THREE.Vector3().setFromMatrixScale(deviceMatrix);
    const hiddenDeviceScale = new THREE.Vector3().setFromMatrixScale(hiddenDeviceMatrix);
    const sensorScale = new THREE.Vector3().setFromMatrixScale(sensorMatrix);

    expect(deviceScale.x).toBeCloseTo(1);
    expect(hiddenDeviceScale.x).toBeCloseTo(0);
    expect(sensorScale.x).toBeCloseTo(1);
    const detailColor = new THREE.Color();
    crew.getAccessoryMeshes().sensor.getColorAt(1, detailColor);
    expect(detailColor.getHex()).toBe(0xffffff);
    crew.dispose();
  });

  it('shares exact batch bounds across moving body and accessory instances', () => {
    const crew = createAstronauts({ maxAgents: 2, rig });
    const distant = makeAgent('distant', 42, 0xffffff, 0);
    const farther = makeAgent('farther', -170, 0xffffff, 0);
    const meshes = crew.getMeshes();
    const computeSpies = meshes.map((mesh) => vi.spyOn(mesh, 'computeBoundingSphere'));

    crew.addAgent(distant);
    crew.addAgent(farther);
    crew.refreshBounds();

    for (const mesh of meshes) {
      expect(mesh.frustumCulled).toBe(true);
      expect(mesh.boundingSphere).not.toBeNull();
      expect(mesh.boundingSphere!.radius).toBeGreaterThan(ASTRONAUT_INSTANCE_BOUNDS_PADDING);
      expect(mesh.boundingSphere!.containsPoint(distant.position)).toBe(true);
      expect(mesh.boundingSphere!.containsPoint(farther.position)).toBe(true);
    }
    for (const spy of computeSpies) expect(spy).not.toHaveBeenCalled();
    crew.dispose();
  });
});
