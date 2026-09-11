import { describe, expect, it } from "vitest";
import type { ActivityModel } from "@/lib/activity/activity-model";
import type { ActorInfo, FloorInfo, InvocationInfo } from "@/lib/monitor-types";
import { buildMultiSessionModel, chooseFallbackFloor, chooseFollowTarget } from "../multi-session-model";

function floor(id: string, updatedAt: number, closedAt: number | null = null): FloorInfo {
  return {
    floorId: id,
    rootSessionId: `root-${id}`,
    projectId: "project",
    title: `Floor ${id}`,
    createdAt: 1,
    updatedAt,
    closed: closedAt !== null,
    closedAt,
    sessionId: `session-${id}`,
  };
}

function actor(id: string, floorId: string, lastObservedAt = 1): ActorInfo {
  return {
    actorId: id,
    floorId,
    sessionId: `session-${floorId}`,
    agentKey: id,
    displayName: `Agent ${id}`,
    role: "specialist",
    seatIndex: 0,
    lastObservedAt,
    createdAt: 1,
    activity: "idle",
    idleSince: 1,
  };
}

function invocation(id: string, floorId: string, overrides: Partial<InvocationInfo> = {}): InvocationInfo {
  return {
    invocationId: id,
    floorId,
    senderActorId: `${floorId}-sender`,
    recipientActorId: `${floorId}-recipient`,
    callId: `call-${id}`,
    parentInvocationId: null,
    revision: 1,
    executionStatus: "started",
    outcome: null,
    taskCategory: "implementation",
    promptPreview: null,
    requestedAt: 10,
    startedAt: 20,
    finishedAt: null,
    ...overrides,
  };
}

function activity(actors: ActorInfo[], activeIds: string[]): ActivityModel {
  return {
    now: 1_000,
    actors: actors.map((item) => ({
      actor: item,
      basePose: activeIds.includes(item.actorId) ? "work" : "idle",
      pose: activeIds.includes(item.actorId) ? "work" : "idle",
      activeWorkCount: activeIds.includes(item.actorId) ? 1 : 0,
      outcomeBeat: null,
      standbyEligible: false,
    })),
    invocations: [],
    directDelegations: [],
    closedFloorIds: new Set(),
  };
}

describe("buildMultiSessionModel", () => {
  it("groups working, quiet, and completed floors", () => {
    const floors = [floor("working", 10), floor("quiet", 20), floor("done", 30, 40)];
    const actors = [actor("worker", "working")];
    const model = buildMultiSessionModel({
      floors,
      actors,
      invocations: [],
      activity: activity(actors, ["worker"]),
      pinnedFloorIds: [],
    });

    expect(model.working.map((item) => item.floorId)).toEqual(["working"]);
    expect(model.quiet.map((item) => item.floorId)).toEqual(["quiet"]);
    expect(model.completed.map((item) => item.floorId)).toEqual(["done"]);
  });

  it("counts each active invocation once and summarizes both active endpoints", () => {
    const actors = [actor("sender", "work"), actor("recipient", "work")];
    const model = buildMultiSessionModel({
      floors: [floor("work", 1)],
      actors,
      invocations: [invocation("one", "work", { senderActorId: "sender", recipientActorId: "recipient" })],
      activity: activity(actors, ["sender", "recipient"]),
      pinnedFloorIds: [],
    });

    expect(model.working[0].activeInvocationCount).toBe(1);
    expect(model.working[0].activeActors.map((item) => item.actorId)).toEqual(["recipient", "sender"]);
  });

  it("collects categories and selects latest terminal outcome deterministically", () => {
    const invocations = [
      invocation("z", "quiet", { executionStatus: "finished", outcome: "failed", taskCategory: "testing", finishedAt: 90 }),
      invocation("a", "quiet", { executionStatus: "finished", outcome: "succeeded", taskCategory: "design", finishedAt: 90 }),
    ];
    const model = buildMultiSessionModel({
      floors: [floor("quiet", 1)],
      actors: [],
      invocations,
      activity: activity([], []),
      pinnedFloorIds: [],
    });

    expect(model.quiet[0].taskCategories).toEqual(["design", "testing"]);
    expect(model.quiet[0].latestOutcome).toEqual({ invocationId: "a", outcome: "succeeded", finishedAt: 90 });
    expect(model.quiet[0].lastActivityAt).toBe(90);
  });

  it("sorts pinned open floors first, then activity and floor ID", () => {
    const floors = [floor("z", 100), floor("b", 50), floor("a", 50)];
    const model = buildMultiSessionModel({
      floors,
      actors: [],
      invocations: [],
      activity: activity([], []),
      pinnedFloorIds: ["a", "b"],
    });

    expect(model.quiet.map((item) => item.floorId)).toEqual(["a", "b", "z"]);
  });

  it("sorts completed floors by latest activity without pin priority", () => {
    const model = buildMultiSessionModel({
      floors: [floor("older-pinned", 10, 20), floor("newer", 10, 30)],
      actors: [],
      invocations: [],
      activity: activity([], []),
      pinnedFloorIds: ["older-pinned"],
    });

    expect(model.completed.map((item) => item.floorId)).toEqual(["newer", "older-pinned"]);
    expect(model.completed[0].closedAt).toBe(30);
  });
});

describe("floor choices", () => {
  const actors = [actor("worker", "work")];
  const model = buildMultiSessionModel({
    floors: [floor("work", 20), floor("quiet", 10), floor("done", 1, 5)],
    actors,
    invocations: [],
    activity: activity(actors, ["worker"]),
    pinnedFloorIds: [],
  });

  it("keeps a working follow target and otherwise chooses first working floor", () => {
    expect(chooseFollowTarget(model, "work")).toBe("work");
    expect(chooseFollowTarget(model, "quiet")).toBe("work");
  });

  it("keeps an existing selection and falls back by lifecycle priority", () => {
    expect(chooseFallbackFloor(model, "done")).toBe("done");
    expect(chooseFallbackFloor(model, "missing")).toBe("work");
    expect(chooseFallbackFloor({ working: [], quiet: [], completed: [] }, "missing")).toBeNull();
  });
});
