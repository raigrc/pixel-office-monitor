import { describe, it, expect, vi } from 'vitest';
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
};

const mockCanvas = {
  width: 0,
  height: 0,
  getContext: () => mockContext,
};

vi.stubGlobal('document', {
  createElement: () => mockCanvas,
});

import { createCrewRig } from '../crew-rig';
import { createAstronauts, type AstronautState } from '../astronauts';

function state(id: string, color: THREE.Color): AstronautState {
  return {
    id,
    position: new THREE.Vector3(1, 0, 2),
    target: new THREE.Vector3(1, 0, 2),
    clip: 'idle',
    clipTime: 0,
    frame: 0,
    suitColor: color,
    faceIndex: 0,
    badge: 'none',
    working: false,
  };
}

describe('Astronaut suit colors and instance counts', () => {
  it('writes the suit color into the geometry color attribute', () => {
    const crew = createAstronauts({ maxAgents: 4, rig: createCrewRig() });
    crew.addAgent(state('a', new THREE.Color(1, 0, 0)));
    const body = crew.getMeshes()[0];
    const attr = body.geometry.getAttribute('aSuit') as THREE.InstancedBufferAttribute;
    expect(attr.getX(0)).toBeCloseTo(1, 5);
    expect(attr.getY(0)).toBeCloseTo(0, 5);
    expect(attr.getZ(0)).toBeCloseTo(0, 5);
  });

  it('hides unfilled instances instead of stacking ghosts at origin', () => {
    const crew = createAstronauts({ maxAgents: 8, rig: createCrewRig() });
    crew.addAgent(state('a', new THREE.Color(1, 0, 0)));
    crew.addAgent(state('b', new THREE.Color(0, 1, 0)));
    for (const mesh of crew.getMeshes()) {
      expect(mesh.count).toBe(2);
    }
    crew.removeAgent('a');
    for (const mesh of crew.getMeshes()) {
      expect(mesh.count).toBe(1);
    }
  });
});
