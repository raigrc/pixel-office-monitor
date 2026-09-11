import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createNavGrid, isNavWalkable, rasterizeCircle, worldToGrid } from '../navigation';
import {
  AgentMotionController,
  DEPARTURE_STANDBY_SECONDS,
  MAX_ENTRANCES_PER_RECONCILE,
  workSiteForAgent,
  type MotionEnvironment,
} from '../walkers';
import type { WorldAgent } from '../../world/world-types';

function agent(id: string, seatIndex: number = 0): WorldAgent {
  return {
    id,
    worldId: 'floor',
    sessionId: 'session',
    agentKey: id,
    displayName: id,
    role: 'specialist',
    isOrchestrator: false,
    status: 'working',
    seatIndex,
  };
}

function environment(count: number = 20): MotionEnvironment {
  return {
    revision: 1,
    grid: createNavGrid(),
    sites: new Map(
      Array.from({ length: count }, (_, index) => [
        `agent-${index}`,
        new THREE.Vector3((index % 5) * 1.5, 0.45, Math.floor(index / 5) * 1.5),
      ]),
    ),
    ship: {
      rampBottom: new THREE.Vector3(0, 0.45, -8),
      rampTop: new THREE.Vector3(0, 0.8, -9),
      airlock: new THREE.Vector3(0, 1, -10),
    },
  };
}

describe('AgentMotionController Phase 2 lifecycle', () => {
  it('assigns 15 specialists plus orchestrator collision-free building-aware sites', () => {
    const home = new THREE.Vector3(0, 0.45, 0);
    const sites = Array.from({ length: 15 }, (_, seatIndex) =>
      workSiteForAgent(home, { seatIndex, isOrchestrator: false }, 1.5),
    );
    sites.push(workSiteForAgent(home, { seatIndex: -1, isOrchestrator: true }, 1.5));

    for (let i = 0; i < sites.length; i++) {
      expect(sites[i].distanceTo(home)).toBeGreaterThan(2.25);
      expect(sites[i].distanceTo(home)).toBeLessThanOrEqual(3.2);
      for (let j = i + 1; j < sites.length; j++) {
        expect(sites[i].distanceTo(sites[j])).toBeGreaterThanOrEqual(1.15);
      }
    }
  });

  it('walks only the first six arrivals and places the remainder onsite', () => {
    const controller = new AgentMotionController();
    const agents = Array.from({ length: 20 }, (_, index) => agent(`agent-${index}`, index));

    controller.reconcile(agents, environment());

    const snapshot = controller.snapshot();
    expect(snapshot.filter((item) => item.phase === 'entering')).toHaveLength(
      MAX_ENTRANCES_PER_RECONCILE,
    );
    expect(snapshot.filter((item) => item.phase === 'onsite')).toHaveLength(14);
  });

  it('does not restart motion for an identical or status-only snapshot', () => {
    const controller = new AgentMotionController();
    const env = environment(1);
    controller.reconcile([agent('agent-0')], env);
    controller.advance(0.5);
    const before = controller.snapshot()[0];

    controller.reconcile([{ ...agent('agent-0'), status: 'waiting' }], env);
    const after = controller.snapshot()[0];

    expect(after.position.distanceTo(before.position)).toBeCloseTo(0, 5);
    expect(after.phase).toBe(before.phase);
  });

  it('keeps a missing agent in standby before boarding', () => {
    const controller = new AgentMotionController();
    const env = environment(1);
    controller.reconcile([agent('agent-0')], env, { animateEntrances: false });

    controller.reconcile([], env);
    expect(controller.snapshot()[0].phase).toBe('standby');

    controller.advance(DEPARTURE_STANDBY_SECONDS - 0.001);
    expect(controller.snapshot()[0].phase).toBe('standby');
    controller.advance(0.001);
    expect(controller.snapshot()[0].phase).toBe('leaving');

    for (let i = 0; i < 600 && controller.snapshot().length > 0; i++) {
      controller.advance(1 / 60);
    }
    expect(controller.snapshot()).toHaveLength(0);
  });

  it('boards a full floor through staggered transit lanes', () => {
    const controller = new AgentMotionController();
    const agents = Array.from({ length: 20 }, (_, index) => agent(`agent-${index}`, index));
    const env = environment();
    controller.reconcile(agents, env, { animateEntrances: false });
    controller.reconcile([], env);
    controller.advance(DEPARTURE_STANDBY_SECONDS);

    for (let i = 0; i < 2400 && controller.snapshot().length > 0; i++) {
      controller.advance(1 / 60);
    }

    expect(controller.snapshot()).toHaveLength(0);
  });

  it('cancels departure when the same stable ID returns', () => {
    const controller = new AgentMotionController();
    const env = environment(1);
    controller.reconcile([agent('agent-0')], env, { animateEntrances: false });
    controller.reconcile([], env);
    controller.advance(DEPARTURE_STANDBY_SECONDS);
    const leavingPosition = controller.snapshot()[0].position.clone();

    controller.reconcile([agent('agent-0')], env);

    const returned = controller.snapshot();
    expect(returned).toHaveLength(1);
    expect(returned[0].phase).toBe('entering');
    expect(returned[0].position.distanceTo(leavingPosition)).toBeCloseTo(0, 5);
  });

  it('cancels standby without moving when work returns', () => {
    const controller = new AgentMotionController();
    const env = environment(1);
    controller.reconcile([agent('agent-0')], env, { animateEntrances: false });
    const onsite = controller.snapshot()[0].position;
    controller.reconcile([], env);
    controller.advance(20);

    controller.reconcile([agent('agent-0')], env);

    expect(controller.snapshot()[0].phase).toBe('onsite');
    expect(controller.snapshot()[0].position.distanceTo(onsite)).toBe(0);
  });

  it('does not restart standby on repeated missing snapshots', () => {
    const controller = new AgentMotionController();
    const env = environment(1);
    controller.reconcile([agent('agent-0')], env, { animateEntrances: false });
    controller.reconcile([], env);
    controller.advance(20);
    controller.reconcile([], env);
    controller.advance(5);

    expect(controller.snapshot()[0].phase).toBe('leaving');
  });

  it('bypasses standby when the floor closes', () => {
    const controller = new AgentMotionController();
    const env = environment(1);
    controller.reconcile([agent('agent-0')], env, { animateEntrances: false });

    controller.reconcile([], env, { activeWorldIds: new Set() });

    expect(controller.snapshot()[0].phase).toBe('leaving');
  });

  it('routes an arrival around blocked building cells', () => {
    const controller = new AgentMotionController();
    const env: MotionEnvironment = {
      ...environment(1),
      sites: new Map([['agent-0', new THREE.Vector3(0, 0.45, 8)]]),
    };
    rasterizeCircle(env.grid, 0, 0, 2.5);
    controller.reconcile([agent('agent-0')], env);

    for (let i = 0; i < 1800 && controller.snapshot()[0]?.phase !== 'onsite'; i++) {
      controller.advance(1 / 60);
      const current = controller.snapshot()[0]?.position;
      if (!current) continue;
      const { gx, gz } = worldToGrid(current.x, current.z);
      expect(isNavWalkable(env.grid, gx, gz)).toBe(true);
    }

    expect(controller.snapshot()[0].phase).toBe('onsite');
    expect(controller.snapshot()[0].position.distanceTo(env.sites.get('agent-0')!)).toBeLessThan(0.3);
  });

  it('snaps arrivals and removes departures when motion is reduced', () => {
    const controller = new AgentMotionController();
    const env = environment(1);
    controller.setReducedMotion(true);

    controller.reconcile([agent('agent-0')], env);
    expect(controller.snapshot()[0].phase).toBe('onsite');
    expect(controller.snapshot()[0].position.distanceTo(env.sites.get('agent-0')!)).toBeCloseTo(0, 5);

    controller.reconcile([], env);
    expect(controller.snapshot()[0].phase).toBe('standby');
    const delta = controller.advance(DEPARTURE_STANDBY_SECONDS);
    expect(delta.removedIds).toEqual(['agent-0']);
    expect(controller.snapshot()).toHaveLength(0);
  });
});
