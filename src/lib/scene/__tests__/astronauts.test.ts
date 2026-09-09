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
import { createAstronauts, Astronauts, AstronautState } from '../astronauts';

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

  it('should create 7 instanced meshes', () => {
    const meshes = astronauts.getMeshes();
    expect(meshes.length).toBe(7);
    for (const mesh of meshes) {
      expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
      expect(mesh.count).toBe(16);
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