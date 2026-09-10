import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import type { ActorInfo, FloorInfo, InvocationInfo } from '../../monitor-types';
import {
  mapActorsToAgents,
  mapPoseToClipBadge,
  layoutFloorPositions,
} from '../actor-3d-map';

function floor(id: string): FloorInfo {
  return {
    floorId: id,
    rootSessionId: `root-${id}`,
    projectId: 'proj',
    title: id,
    createdAt: 0,
    updatedAt: 0,
    closed: false,
    sessionId: `ses-${id}`,
  };
}

function actor(id: string, floorId: string, overrides: Partial<ActorInfo> = {}): ActorInfo {
  return {
    actorId: id,
    floorId,
    sessionId: `ses-${floorId}`,
    agentKey: 'senior-engineer',
    displayName: id,
    role: 'specialist',
    seatIndex: 0,
    lastObservedAt: Date.now(),
    createdAt: 0,
    activity: 'working',
    ...overrides,
  };
}

describe('mapPoseToClipBadge', () => {
  it('maps work, seat, success, idle to valid clip and badge values', () => {
    expect(mapPoseToClipBadge('work')).toEqual({ clip: 'work', badge: 'working', working: true });
    expect(mapPoseToClipBadge('seat')).toEqual({ clip: 'sitIdle', badge: 'waiting', working: false });
    expect(mapPoseToClipBadge('success')).toEqual({ clip: 'cheer', badge: 'celebrating', working: false });
    expect(mapPoseToClipBadge('idle')).toEqual({ clip: 'sitIdle', badge: 'none', working: false });
  });
});

describe('layoutFloorPositions', () => {
  it('assigns distinct hex positions per floor', () => {
    const positions = layoutFloorPositions([floor('f1'), floor('f2')], null);
    expect(positions.size).toBe(2);
    const p1 = positions.get('f1')!;
    const p2 = positions.get('f2')!;
    expect(p1).toBeInstanceOf(THREE.Vector3);
    expect(p1.distanceTo(p2)).toBeGreaterThan(0);
  });

  it('returns an empty map for no floors', () => {
    expect(layoutFloorPositions([], null).size).toBe(0);
  });
});

describe('mapActorsToAgents', () => {
  it('maps live actors to agent states near their floor position', () => {
    const floors = [floor('f1')];
    const positions = layoutFloorPositions(floors, null);
    const actors = [
      actor('a1', 'f1', { seatIndex: 0 }),
      actor('a2', 'f1', { seatIndex: 3, activity: 'idle' }),
    ];
    const invocations: InvocationInfo[] = [];
    const agents = mapActorsToAgents(actors, invocations, positions);
    expect(agents.map((a) => a.id).sort()).toEqual(['a1', 'a2']);
    const floorPos = positions.get('f1')!;
    for (const agent of agents) {
      expect(agent.position.distanceTo(floorPos)).toBeLessThan(10);
    }
    expect(agents[0].badge).toBe('working');
    expect(agents[1].badge).toBe('none');
  });

  it('skips system actors and actors on unknown floors', () => {
    const positions = layoutFloorPositions([floor('f1')], null);
    const actors = [
      actor('sys', 'f1', { role: 'system' }),
      actor('ghost', 'missing-floor', {}),
    ];
    expect(mapActorsToAgents(actors, [], positions)).toEqual([]);
  });
});
