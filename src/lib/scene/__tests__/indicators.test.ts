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
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
};

const mockCanvas = {
  width: 0,
  height: 0,
  getContext: () => mockContext,
};

vi.stubGlobal('document', {
  createElement: () => mockCanvas,
});

import {
  BADGE_INSTANCE_BOUNDS_PADDING,
  BADGE_SEMANTIC_COLORS,
  createBadges,
} from '../indicators';
import { COZY_THEME } from '../../cozy-theme';

function readColor(badges: ReturnType<typeof createBadges>, index: number): [number, number, number] {
  const attr = badges.getMesh().geometry.getAttribute('aTint') as THREE.InstancedBufferAttribute;
  return [attr.getX(index), attr.getY(index), attr.getZ(index)];
}

describe('Badges index rebuild', () => {
  it('maps status glyph colors to canonical semantics', () => {
    expect(BADGE_SEMANTIC_COLORS).toEqual({
      blocked: COZY_THEME.semantic.error,
      working: COZY_THEME.semantic.working,
      waiting: COZY_THEME.semantic.waiting,
      celebrating: COZY_THEME.semantic.success,
      spawn: COZY_THEME.semantic.selection,
      leave: COZY_THEME.semantic.delegationActive,
    });
    const badges = createBadges(1);
    const material = badges.getMesh().material as THREE.ShaderMaterial;
    expect(material.uniforms.uWorkingColor.value.getHex()).toBe(
      new THREE.Color(COZY_THEME.semantic.working).getHex(),
    );
    expect(material.uniforms.uSuccessColor.value.getHex()).toBe(
      new THREE.Color(COZY_THEME.semantic.success).getHex(),
    );
    badges.dispose();
  });

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

  it('faces badges at the camera quaternion on updateView', () => {    const badges = createBadges(4);
    badges.setBadge('a', 'working', new THREE.Vector3(2, 0, 3), new THREE.Color(1, 1, 1));
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(5, 8, 12);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    badges.updateView(camera.quaternion);

    const mesh = badges.getMesh();
    const expected = new THREE.Matrix4().compose(
      new THREE.Vector3(2, 2.35, 3),
      camera.quaternion,
      new THREE.Vector3(1, 1, 1)
    );
    const actual = mesh.instanceMatrix.array as Float32Array;
    for (let i = 0; i < 16; i++) {
      expect(actual[i]).toBeCloseTo(expected.elements[i], 5);
    }
  });

  it('derives one exact bound for moving badge instances', () => {
    const badges = createBadges(4);
    const mesh = badges.getMesh();
    const position = new THREE.Vector3(42, 0, 0);
    const farther = new THREE.Vector3(-170, 0, 0);
    const computeSpy = vi.spyOn(mesh, 'computeBoundingSphere');
    badges.setBadge('distant', 'working', position);
    badges.setBadge('farther', 'waiting', farther);

    badges.updateView(new THREE.Quaternion());

    expect(mesh.frustumCulled).toBe(true);
    expect(mesh.boundingSphere).not.toBeNull();
    expect(mesh.boundingSphere!.radius).toBeGreaterThan(BADGE_INSTANCE_BOUNDS_PADDING);
    expect(mesh.boundingSphere!.containsPoint(position.clone().setY(2.35))).toBe(true);
    expect(mesh.boundingSphere!.containsPoint(farther.clone().setY(2.35))).toBe(true);
    expect(computeSpy).not.toHaveBeenCalled();
    badges.dispose();
  });

  it('refreshes the surviving matrix slot after clearBadge (1.1D)', () => {
    const badges = createBadges(4);
    badges.setBadge('a', 'working', new THREE.Vector3(0, 0, 0), new THREE.Color(1, 0, 0));
    badges.setBadge('b', 'waiting', new THREE.Vector3(5, 0, 5), new THREE.Color(0, 0, 1));

    badges.clearBadge('a');

    const m = new THREE.Matrix4();
    badges.getMesh().getMatrixAt(0, m);
    const pos = new THREE.Vector3().setFromMatrixPosition(m);
    expect(pos.x).toBeCloseTo(5, 5);
    expect(pos.y).toBeCloseTo(2.35, 5);
    expect(pos.z).toBeCloseTo(5, 5);
    badges.dispose();
  });

  it('renders only live badge slots after first, middle, and last removal', () => {
    const badges = createBadges(4);
    badges.setBadge('a', 'working', new THREE.Vector3(0, 0, 0));
    badges.setBadge('b', 'waiting', new THREE.Vector3(1, 0, 0));
    badges.setBadge('c', 'celebrating', new THREE.Vector3(2, 0, 0));
    expect(badges.getMesh().count).toBe(3);

    badges.clearBadge('b');
    expect(badges.getMesh().count).toBe(2);
    badges.clearBadge('a');
    expect(badges.getMesh().count).toBe(1);
    badges.clearBadge('c');
    expect(badges.getMesh().count).toBe(0);
    badges.dispose();
  });
});
