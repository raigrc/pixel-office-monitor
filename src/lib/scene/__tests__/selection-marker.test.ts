import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { AgentSelectionMarker } from '../selection-marker';

describe('AgentSelectionMarker', () => {
  it('tracks one selected agent at floor level and hides when unavailable', () => {
    const marker = new AgentSelectionMarker();
    const mesh = marker.getMesh();
    const agents = new Map([
      ['architect', { position: new THREE.Vector3(2, 0.6, -3) }],
    ]);

    expect(mesh.visible).toBe(false);
    marker.setSelectedAgent('architect');
    marker.update(agents);
    expect(mesh.visible).toBe(true);
    expect(mesh.position).toEqual(new THREE.Vector3(2, 0.63, -3));

    marker.setSelectedAgent('missing');
    marker.update(agents);
    expect(mesh.visible).toBe(false);
    marker.dispose();
  });
});
