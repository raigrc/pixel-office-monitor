import { describe, expect, it } from "vitest";
import type { ActorInfo, FloorInfo, InvocationInfo } from "@/lib/monitor-types";
import { ERROR_BEAT_MS, SUCCESS_BEAT_MS } from "../activity-model";
import { monitorToActivity } from "../monitor-to-activity";

const floor: FloorInfo = {
  floorId: "project:root",
  rootSessionId: "root",
  projectId: "project",
  title: "Root",
  createdAt: 1,
  updatedAt: 1,
  closed: false,
  closedAt: null,
  sessionId: "root",
};

function actor(id: string, role: ActorInfo["role"] = "specialist"): ActorInfo {
  return {
    actorId: id,
    floorId: floor.floorId,
    sessionId: "root",
    agentKey: id,
    displayName: id,
    role,
    seatIndex: role === "orchestrator" ? -1 : 0,
    lastObservedAt: 1_000,
    createdAt: 1,
    activity: "idle",
    idleSince: 1_000,
  };
}

function invocation(overrides: Partial<InvocationInfo> = {}): InvocationInfo {
  return {
    invocationId: "inv-1",
    floorId: floor.floorId,
    senderActorId: "orchestrator",
    recipientActorId: "architect",
    callId: "call-1",
    parentInvocationId: null,
    revision: 1,
    executionStatus: "requested",
    outcome: null,
    taskCategory: "design",
    promptPreview: "Inspect auth flow",
    requestedAt: 1_000,
    startedAt: null,
    finishedAt: null,
    ...overrides,
  };
}

describe("monitorToActivity", () => {
  const actors = [actor("orchestrator", "orchestrator"), actor("architect"), actor("explore")];

  it("represents direct and nested delegation only with valid endpoints", () => {
    const parent = invocation();
    const child = invocation({
      invocationId: "inv-2",
      callId: "call-2",
      senderActorId: "architect",
      recipientActorId: "explore",
      parentInvocationId: parent.invocationId,
    });

    const model = monitorToActivity({ floors: [floor], actors, invocations: [parent, child] }, 1_100);

    expect(model.directDelegations).toEqual([
      expect.objectContaining({ invocationId: "inv-1", parentInvocationId: null }),
      expect.objectContaining({ invocationId: "inv-2", parentInvocationId: "inv-1" }),
    ]);
  });

  it("validates out-of-order parents and rejects missing, cross-floor, inconsistent, and cyclic parents", () => {
    const parent = invocation();
    const child = invocation({
      invocationId: "child",
      callId: "child-call",
      senderActorId: "architect",
      recipientActorId: "explore",
      parentInvocationId: parent.invocationId,
    });
    const missing = invocation({ invocationId: "missing", parentInvocationId: "not-found" });
    const crossFloorParent = invocation({ ...parent, invocationId: "cross-parent", floorId: "other-floor" });
    const crossFloor = invocation({ invocationId: "cross", parentInvocationId: crossFloorParent.invocationId });
    const inconsistent = invocation({ invocationId: "inconsistent", senderActorId: "orchestrator", parentInvocationId: parent.invocationId });
    const cycleA = invocation({ invocationId: "cycle-a", senderActorId: "architect", recipientActorId: "orchestrator", parentInvocationId: "cycle-b" });
    const cycleB = invocation({ invocationId: "cycle-b", senderActorId: "orchestrator", recipientActorId: "architect", parentInvocationId: "cycle-a" });

    const model = monitorToActivity({
      floors: [floor],
      actors,
      invocations: [child, missing, crossFloor, inconsistent, cycleA, cycleB, crossFloorParent, parent],
    }, 1_100);
    const parents = new Map(model.invocations.map((entry) => [entry.invocation.invocationId, entry.validatedParentInvocationId]));

    expect(parents.get("child")).toBe(parent.invocationId);
    expect(parents.get("missing")).toBeNull();
    expect(parents.get("cross")).toBeNull();
    expect(parents.get("inconsistent")).toBeNull();
    expect(parents.get("cycle-a")).toBeNull();
    expect(parents.get("cycle-b")).toBeNull();
  });

  it("suppresses self, unknown, and cross-floor relationships", () => {
    const model = monitorToActivity({
      floors: [floor],
      actors,
      invocations: [
        invocation({ invocationId: "self", senderActorId: "architect", recipientActorId: "architect" }),
        invocation({ invocationId: "unknown", senderActorId: null }),
        invocation({ invocationId: "missing", recipientActorId: "other-floor-actor" }),
      ],
    }, 1_100);

    expect(model.directDelegations).toEqual([]);
    expect(model.invocations.map((entry) => entry.endpointAvailability)).toEqual(["self", "unknown", "unknown"]);
  });

  it("uses active work before temporary outcome beats", () => {
    const finishedAt = 2_000;
    const success = invocation({ executionStatus: "finished", outcome: "succeeded", finishedAt });
    const failure = invocation({ invocationId: "inv-2", executionStatus: "finished", outcome: "failed", finishedAt });

    expect(monitorToActivity({ floors: [floor], actors, invocations: [success] }, finishedAt + 1).actors[1].pose).toBe("success");
    expect(monitorToActivity({ floors: [floor], actors, invocations: [success] }, finishedAt + SUCCESS_BEAT_MS).actors[1].pose).toBe("idle");
    expect(monitorToActivity({ floors: [floor], actors, invocations: [failure] }, finishedAt + 1).actors[1].pose).toBe("error");
    expect(monitorToActivity({ floors: [floor], actors, invocations: [failure] }, finishedAt + ERROR_BEAT_MS).actors[1].pose).toBe("idle");
    expect(monitorToActivity({ floors: [floor], actors, invocations: [success, invocation({ invocationId: "active" })] }, finishedAt + 1).actors[1].pose).toBe("seat");
  });

  it("marks only observed idle specialists without work as standby eligible", () => {
    const model = monitorToActivity({ floors: [floor], actors, invocations: [] }, 2_000);
    expect(model.actors.map((entry) => [entry.actor.actorId, entry.standbyEligible])).toEqual([
      ["orchestrator", false],
      ["architect", true],
      ["explore", true],
    ]);
  });
});
