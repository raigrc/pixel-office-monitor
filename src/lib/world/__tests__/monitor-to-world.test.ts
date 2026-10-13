import { describe, expect, it } from "vitest";
import type { ActorInfo, FloorInfo, InvocationInfo } from "@/lib/monitor-types";
import { monitorToWorld } from "../monitor-to-world";

function floor(id: string, overrides: Partial<FloorInfo> = {}): FloorInfo {
  return {
    floorId: id,
    rootSessionId: `root-${id}`,
    projectId: "proj",
    title: id,
    createdAt: 0,
    updatedAt: 0,
    closed: false,
    closedAt: null,
    sessionId: `ses-${id}`,
    ...overrides,
  };
}

function actor(id: string, floorId: string, overrides: Partial<ActorInfo> = {}): ActorInfo {
  return {
    actorId: id,
    floorId,
    sessionId: `ses-${floorId}`,
    agentKey: "senior-engineer",
    displayName: id,
    role: "specialist",
    seatIndex: 0,
    lastObservedAt: Date.now(),
    createdAt: 0,
    activity: "working",
    ...overrides,
  };
}

describe("monitorToWorld", () => {
  it("keeps one session per open floor with stable ids", () => {
    const world = monitorToWorld({ floors: [floor("f1"), floor("f2")], actors: [], invocations: [] });
    expect(world.sessions.map((s) => s.id)).toEqual(["f1", "f2"]);
  });

  it("drops closed floors and their actors", () => {
    const world = monitorToWorld({
      floors: [floor("open"), floor("gone", { closed: true, closedAt: 1 })],
      actors: [actor("a1", "gone")],
      invocations: [],
    });
    expect(world.sessions.map((s) => s.id)).toEqual(["open"]);
    expect(world.agents).toEqual([]);
  });

  it("drops system actors and idle specialists but keeps active specialists", () => {
    const world = monitorToWorld({
      floors: [floor("f1")],
      actors: [
        actor("sys", "f1", { role: "system" }),
        actor("sleeper", "f1", { activity: "idle", idleSince: Date.now() }),
        actor("worker", "f1", { activity: "working", lastObservedAt: Date.now() }),
      ],
      invocations: [],
    });
    expect(world.agents.map((a) => a.id)).toEqual(["worker"]);
  });

  it("keeps the idle orchestrator visible with a stable id", () => {
    const world = monitorToWorld({
      floors: [floor("f1")],
      actors: [actor("orc", "f1", { role: "orchestrator", agentKey: "orchestrator", activity: "idle", idleSince: Date.now(), seatIndex: -1 })],
      invocations: [],
    });
    expect(world.agents.map((a) => a.id)).toEqual(["orc"]);
    expect(world.agents[0].isOrchestrator).toBe(true);
    expect(world.agents[0].status).toBe("idle");
    expect(world.agents[0].worldId).toBe("f1");
  });

  it("maps waiting pose to waiting status", () => {
    const waiter = actor("w", "f1", { activity: undefined, seatIndex: 2 });
    const inv: InvocationInfo = {
      invocationId: "i1",
      floorId: "f1",
      senderActorId: "other",
      recipientActorId: "w",
      callId: "c1",
      parentInvocationId: null,
      revision: 0,
      executionStatus: "requested",
      outcome: null,
      taskCategory: null,
      promptPreview: null,
      requestedAt: Date.now(),
      startedAt: null,
      finishedAt: null,
    };
    const world = monitorToWorld({ floors: [floor("f1")], actors: [waiter], invocations: [inv] });
    expect(world.agents[0].status).toBe("waiting");
  });

  it("orders output deterministically regardless of input order", () => {
    const floors = [floor("f2", { createdAt: 2 }), floor("f1", { createdAt: 1 })];
    const actors = [actor("b", "f1"), actor("a", "f1")];
    const first = monitorToWorld({ floors, actors, invocations: [] });
    const second = monitorToWorld({ floors: [...floors].reverse(), actors: [...actors].reverse(), invocations: [] });
    expect(second.sessions.map((s) => s.id)).toEqual(first.sessions.map((s) => s.id));
    expect(second.agents.map((a) => a.id)).toEqual(first.agents.map((a) => a.id));
  });
});
