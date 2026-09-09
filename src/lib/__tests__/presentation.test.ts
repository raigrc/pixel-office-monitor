import { describe, expect, it } from "vitest";
import type { ActorInfo, FloorInfo, InvocationInfo } from "../monitor-types";
import { HandoffScheduler } from "../scene/handoff-scheduler";
import { PresentationController } from "../scene/presentation";

const floor: FloorInfo = {
  floorId: "project:root",
  rootSessionId: "root",
  projectId: "project",
  title: "Test floor",
  createdAt: 1,
  updatedAt: 1,
  closed: false,
  sessionId: "root",
};

const sender: ActorInfo = {
  actorId: "sender",
  floorId: floor.floorId,
  sessionId: "root",
  agentKey: "orchestrator",
  displayName: "Orchestrator",
  role: "orchestrator",
  seatIndex: 0,
  lastObservedAt: 1,
  createdAt: 1,
};

const recipient: ActorInfo = {
  actorId: "recipient",
  floorId: floor.floorId,
  sessionId: "child",
  agentKey: "senior-engineer",
  displayName: "Senior Engineer",
  role: "specialist",
  seatIndex: 1,
  lastObservedAt: 1,
  createdAt: 1,
};

function makeInvocation(revision = 1): InvocationInfo {
  return {
    invocationId: "invocation-1",
    floorId: floor.floorId,
    senderActorId: sender.actorId,
    recipientActorId: recipient.actorId,
    callId: "call-1",
    parentInvocationId: null,
    revision,
    executionStatus: "requested",
    outcome: null,
    taskCategory: "implementation",
    promptPreview: null,
    requestedAt: 1,
    startedAt: null,
    finishedAt: null,
  };
}

describe("HandoffScheduler", () => {
  it("deduplicates SSE revisions by stable invocation id", () => {
    const scheduler = new HandoffScheduler(() => [sender, recipient], () => [floor]);

    expect(scheduler.enqueue(makeInvocation(1), sender, recipient)).not.toBeNull();
    expect(scheduler.enqueue(makeInvocation(2), sender, recipient)).toBeNull();
    expect(scheduler.getActiveJobs()).toHaveLength(1);
  });
});

describe("PresentationController", () => {
  it("publishes each update through getVisualStates", () => {
    let actors = [sender, recipient];
    const controller = new PresentationController(
      () => actors,
      () => [floor],
      () => [makeInvocation()]
    );
    controller.enqueueHandoff(makeInvocation(), sender, recipient);

    const updatedStates = controller.update(0);

    expect(updatedStates).toHaveLength(1);
    expect(controller.getVisualStates()).toEqual(updatedStates);

    actors = [recipient];
    expect(controller.update(0)).toEqual([]);
    expect(controller.getVisualStates()).toEqual([]);
  });
});
