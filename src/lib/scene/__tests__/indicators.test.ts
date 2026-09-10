import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';

// Mock document for badge atlas canvas (same pattern as astronauts.test.ts).
const mockContext = {
  fillStyle: '',
  fillRect: vi.fn(),
  font: '',
  textAlign: '',
  textBaseline: '',
  fillText: vi.fn(),
};

const mockCanvas = {
  width: 0,
  height: 0,
  getContext: () => mockContext,
};

vi.stubGlobal('document', {
  createElement: () => mockCanvas,
});

import { createBadges } from '../indicators';

function readColor(badges: ReturnType<typeof createBadges>, index: number): [number, number, number] {
  const attr = badges.getMesh().geometry.getAttribute('instanceColor') as THREE.InstancedBufferAttribute;
  return [attr.getX(index), attr.getY(index), attr.getZ(index)];
}

describe('Badges index rebuild', () => {
  it('keeps the surviving agent color after a clear + implicit rebuild', () => {
    const badges = createBadges(4);
    badges.setBadge('a', 'working', new THREE.Vector3(0, 0, 0), new THREE.Color(1, 0, 0));
    badges.setBadge('b', 'waiting', new THREE.Vector3(5, 0, 5), new THREE.Color(0, 0, 1));

    badges.clearBadge('a');

    const [r, g, b] = readColor(badges, 0);
    expect(r).toBeCloseTo(0, 5);
    expect(g).toBeCloseTo(0, 5);
    expect(b).toBeCloseTo(1, 5);
  });
});
