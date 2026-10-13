import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { ActorInfo, FloorInfo } from "@/lib/monitor-types";
import { Colony, type ColonyStore } from "@/lib/scene/colony";
import { agentOffsetForAgent, MIN_AGENT_SEPARATION } from "../world-layout";
import { monitorToWorld } from "../monitor-to-world";
import type { WorldAgent } from "../world-types";

function floor(id: string, createdAt: number): FloorInfo {
  return {
    floorId: id,
    rootSessionId: `root-${id}`,
    projectId: "proj",
    title: id,
    createdAt,
    updatedAt: createdAt,
    closed: false,
    closedAt: null,
    sessionId: `ses-${id}`,
  };
}

function specialist(
  id: string,
  floorId: string,
  seatIndex: number,
  now: number,
): ActorInfo {
  return {
    actorId: id,
    floorId,
    sessionId: `ses-${floorId}`,
    agentKey: `agent-${seatIndex}`,
    displayName: id,
    role: "specialist",
    seatIndex,
    lastObservedAt: now,
    createdAt: now,
    activity: "working",
  };
}

function orchestrator(id: string, floorId: string, now: number): ActorInfo {
  return {
    actorId: id,
    floorId,
    sessionId: `ses-${floorId}`,
    agentKey: "orchestrator",
    displayName: id,
    role: "orchestrator",
    seatIndex: -1,
    lastObservedAt: now,
    createdAt: now,
    activity: "idle",
    idleSince: now,
  };
}

function countingStore(): ColonyStore & { writes: () => number } {
  const data = new Map<string, string>();
  let writes = 0;
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
      writes++;
    },
    writes: () => writes,
  };
}

/** Visible world position of every agent: plot anchor plus seat offset. */
function worldPositions(colony: Colony, agents: WorldAgent[]): Map<string, THREE.Vector3> {
  const out = new Map<string, THREE.Vector3>();
  for (const agent of agents) {
    const home = colony.positionOf(agent.worldId)!;
    const { dx, dz } = agentOffsetForAgent(agent);
    out.set(agent.id, new THREE.Vector3(home.x + dx, 0.6, home.z + dz));
  }
  return out;
}

function expectNoCollisions(positions: Map<string, THREE.Vector3>): void {
  const entries = [...positions.entries()];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      expect(entries[i][1].distanceTo(entries[j][1])).toBeGreaterThanOrEqual(
        MIN_AGENT_SEPARATION - 1e-9,
      );
    }
  }
}

describe("world sync path (1.1G)", () => {
  it("reconciles two sessions with 16 agents and no collisions", () => {
    const now = Date.now();
    const floors = [floor("f1", 1), floor("f2", 2)];
    const actors: ActorInfo[] = [
      orchestrator("orc-1", "f1", now),
      ...Array.from({ length: 7 }, (_, seat) => specialist(`f1-s${seat}`, "f1", seat, now)),
      ...Array.from({ length: 8 }, (_, k) => specialist(`f2-s${k + 7}`, "f2", k + 7, now)),
    ];
    const world = monitorToWorld({ floors, actors, invocations: [] }, now);
    expect(world.sessions.map((s) => s.id)).toEqual(["f1", "f2"]);
    expect(world.agents.length).toBe(16);

    const colony = new Colony();
    const store = countingStore();
    colony.reconcile(world.sessions.map((s) => s.id), now, store);
    expect(store.writes()).toBe(1);

    const positions = worldPositions(colony, world.agents);
    expect(positions.size).toBe(16);
    expectNoCollisions(positions);

    // Plots stay separated: deck diameter is 7.2.
    const p1 = colony.positionOf("f1")!;
    const p2 = colony.positionOf("f2")!;
    expect(p1.distanceTo(p2)).toBeGreaterThan(7.2);
  });

  it("removes a closed session and its agents while keeping survivors still", () => {
    const now = Date.now();
    const actors: ActorInfo[] = [
      orchestrator("orc-1", "f1", now),
      specialist("f1-s0", "f1", 0, now),
      specialist("f2-s1", "f2", 1, now),
    ];
    const open = monitorToWorld(
      { floors: [floor("f1", 1), floor("f2", 2)], actors, invocations: [] },
      now,
    );
    const colony = new Colony();
    const store = countingStore();
    colony.reconcile(open.sessions.map((s) => s.id), now, store);
    const before = worldPositions(colony, open.agents);

    const closed = monitorToWorld(
      { floors: [floor("f1", 1), { ...floor("f2", 2), closed: true, closedAt: 3 }], actors, invocations: [] },
      now,
    );
    expect(closed.sessions.map((s) => s.id)).toEqual(["f1"]);
    expect(closed.agents.map((a) => a.id).sort()).toEqual(["f1-s0", "orc-1"]);

    colony.reconcile(closed.sessions.map((s) => s.id), now, store);
    expect(colony.activeIds()).toEqual(["f1"]);
    // Fallow ground persists for a returning session.
    expect(colony.positionOf("f2")).not.toBeNull();

    const after = worldPositions(colony, closed.agents);
    for (const [id, pos] of after) {
      expect(pos.distanceTo(before.get(id)!)).toBeCloseTo(0, 5);
    }
  });

  it("removes a departed agent without moving survivors or rewriting storage twice", () => {
    const now = Date.now();
    const floors = [floor("f1", 1)];
    const full: ActorInfo[] = [
      orchestrator("orc-1", "f1", now),
      specialist("a", "f1", 0, now),
      specialist("b", "f1", 1, now),
    ];
    const colony = new Colony();
    const store = countingStore();
    const first = monitorToWorld({ floors, actors: full, invocations: [] }, now);
    colony.reconcile(first.sessions.map((s) => s.id), now, store);
    const before = worldPositions(colony, first.agents);

    const reduced = monitorToWorld(
      { floors, actors: full.filter((a) => a.actorId !== "b"), invocations: [] },
      now,
    );
    expect(reduced.agents.map((a) => a.id).sort()).toEqual(["a", "orc-1"]);
    colony.reconcile(reduced.sessions.map((s) => s.id), now, store);
    // Session set unchanged: no anchor or status change, no storage write.
    expect(store.writes()).toBe(1);

    const after = worldPositions(colony, reduced.agents);
    for (const [id, pos] of after) {
      expect(pos.distanceTo(before.get(id)!)).toBeCloseTo(0, 5);
    }
  });

  it("keeps plot and agent placement stable across status-only updates", () => {
    const now = Date.now();
    const floors = [floor("f1", 1)];
    const actors: ActorInfo[] = [orchestrator("orc-1", "f1", now), specialist("a", "f1", 3, now)];
    const colony = new Colony();
    const store = countingStore();
    const first = monitorToWorld({ floors, actors, invocations: [] }, now);
    colony.reconcile(first.sessions.map((s) => s.id), now, store);
    const before = worldPositions(colony, first.agents);

    const second = monitorToWorld({ floors, actors, invocations: [] }, now + 1000);
    colony.reconcile(second.sessions.map((s) => s.id), now + 1000, store);
    expect(store.writes()).toBe(1);
    const after = worldPositions(colony, second.agents);
    for (const [id, pos] of after) {
      expect(pos.distanceTo(before.get(id)!)).toBeCloseTo(0, 5);
    }
  });

  it("drops the orchestrator marker input when the orchestrator leaves", () => {
    const now = Date.now();
    const floors = [floor("f1", 1)];
    const withOrc = monitorToWorld(
      { floors, actors: [orchestrator("orc-1", "f1", now), specialist("a", "f1", 0, now)], invocations: [] },
      now,
    );
    expect(withOrc.agents.some((a) => a.isOrchestrator)).toBe(true);
    const withoutOrc = monitorToWorld(
      { floors, actors: [specialist("a", "f1", 0, now)], invocations: [] },
      now,
    );
    expect(withoutOrc.agents.some((a) => a.isOrchestrator)).toBe(false);
  });
});
