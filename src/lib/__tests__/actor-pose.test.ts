import { describe, it, expect } from "vitest";
import { getActorActivityPose } from "../scene/actor-pose";
import type { ActorInfo, InvocationInfo } from "../monitor-types";

// ---------------------------------------------------------------------------
// Actor pose resolution — scene animation truth.
// Started invocations win; explicit working beats a bare requested flag;
// requested-from-another reads as waiting (seat); recent success beats idle.
// ---------------------------------------------------------------------------

function makeActor(overrides: Partial<ActorInfo> = {}): ActorInfo {
  return {
    actorId: "actor-1",
    floorId: "floor-1",
    sessionId: "ses-1",
    agentKey: "explore",
    displayName: "explore",
    role: "specialist",
    seatIndex: 0,
    lastObservedAt: Date.now(),
    createdAt: Date.now(),
    ...overrides,
  };
}

function makeInvocation(overrides: Partial<InvocationInfo> = {}): InvocationInfo {
  return {
    invocationId: "inv-1",
    floorId: "floor-1",
    senderActorId: "actor-1",
    recipientActorId: "actor-1",
    callId: "call-1",
    parentInvocationId: null,
    revision: 0,
    executionStatus: "requested",
    outcome: null,
    taskCategory: null,
    promptPreview: null,
    requestedAt: Date.now(),
    startedAt: null,
    finishedAt: null,
    ...overrides,
  };
}

describe("getActorActivityPose", () => {
  it("explicit working wins even with a pending foreign request", () => {
    const actor = makeActor({ activity: "working" });
    const inv = makeInvocation({
      senderActorId: "actor-9",
      recipientActorId: "actor-1",
    });
    expect(getActorActivityPose(actor, [inv])).toBe("work");
  });

  it("started invocation wins even over explicit idle (live work beats stale flag)", () => {
    const actor = makeActor({ activity: "idle" });
    const inv = makeInvocation({ executionStatus: "started" });
    expect(getActorActivityPose(actor, [inv])).toBe("work");
  });

  it("self-requested invocation (plugin shape) reads as work, not seat", () => {
    const actor = makeActor({});
    const inv = makeInvocation({
      executionStatus: "requested",
      senderActorId: "actor-1",
      recipientActorId: "actor-1",
    });
    expect(getActorActivityPose(actor, [inv])).toBe("work");
  });

  it("sender-side request reads as work", () => {
    const actor = makeActor({});
    const inv = makeInvocation({
      executionStatus: "requested",
      senderActorId: "actor-1",
      recipientActorId: "actor-2",
    });
    expect(getActorActivityPose(actor, [inv])).toBe("work");
  });

  it("requested by a different sender reads as seat (waiting)", () => {
    const actor = makeActor({});
    const inv = makeInvocation({
      executionStatus: "requested",
      senderActorId: "actor-9",
      recipientActorId: "actor-1",
    });
    expect(getActorActivityPose(actor, [inv])).toBe("seat");
  });

  it("started invocation reads as work from either side", () => {
    const actor = makeActor({});
    const asRecipient = makeInvocation({
      executionStatus: "started",
      senderActorId: "actor-9",
      recipientActorId: "actor-1",
    });
    expect(getActorActivityPose(actor, [asRecipient])).toBe("work");
  });

  it("no evidence reads as idle", () => {
    expect(getActorActivityPose(makeActor({}), [])).toBe("idle");
    const unrelated = makeInvocation({
      senderActorId: "actor-9",
      recipientActorId: "actor-8",
    });
    expect(getActorActivityPose(makeActor({}), [unrelated])).toBe("idle");
  });

  it("fresh working activity reads as work", () => {
    const actor = makeActor({ activity: "working", lastObservedAt: Date.now() });
    expect(getActorActivityPose(actor, [])).toBe("work");
  });

  it("working activity silent past staleness reads as idle (stranded producer)", () => {
    const actor = makeActor({
      activity: "working",
      lastObservedAt: Date.now() - 6 * 60 * 1000,
    });
    expect(getActorActivityPose(actor, [])).toBe("idle");
  });

  it("working activity just inside staleness still reads as work", () => {
    const actor = makeActor({
      activity: "working",
      lastObservedAt: Date.now() - 4 * 60 * 1000,
    });
    expect(getActorActivityPose(actor, [])).toBe("work");
  });
});
