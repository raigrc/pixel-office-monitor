import { describe, expect, it } from "vitest";
import type { MultiSessionFloor, MultiSessionModel, SessionLifecycle } from "../multi-session-model";
import { transitionSessionNotifications, type SessionNotificationState } from "../session-notifications";

function item(floorId: string, lifecycle: SessionLifecycle, lastActivityAt: number): MultiSessionFloor {
  return {
    floorId,
    title: floorId,
    projectId: "project",
    lifecycle,
    pinned: false,
    activeInvocationCount: lifecycle === "working" ? 1 : 0,
    activeActors: [],
    taskCategories: [],
    latestOutcome: null,
    lastActivityAt,
    closedAt: lifecycle === "completed" ? lastActivityAt : null,
  };
}

function model(...floors: MultiSessionFloor[]): MultiSessionModel {
  return {
    working: floors.filter((floor) => floor.lifecycle === "working"),
    quiet: floors.filter((floor) => floor.lifecycle === "quiet"),
    completed: floors.filter((floor) => floor.lifecycle === "completed"),
  };
}

describe("transitionSessionNotifications", () => {
  it("uses first snapshot as baseline", () => {
    const state = transitionSessionNotifications(null, { model: model(item("one", "working", 1)), followedFloorId: "one" });
    expect(state.notifications).toEqual([]);
    expect(state.lifecycles).toEqual({ one: "working" });
  });

  it.each([
    ["quiet", "working", "started-working"],
    ["working", "quiet", "became-quiet"],
    ["working", "completed", "completed"],
    ["quiet", "completed", "completed"],
  ] as const)("notifies for %s to %s", (before, after, kind) => {
    const baseline = transitionSessionNotifications(null, { model: model(item("one", before, 1)), followedFloorId: null });
    const next = transitionSessionNotifications(baseline, { model: model(item("one", after, 2)), followedFloorId: null });
    expect(next.notifications).toMatchObject([{ kind, floorId: "one", occurredAt: 2 }]);
  });

  it("does not notify for new floors or unchanged lifecycle", () => {
    const baseline = transitionSessionNotifications(null, { model: model(item("one", "quiet", 1)), followedFloorId: null });
    const next = transitionSessionNotifications(baseline, {
      model: model(item("one", "quiet", 2), item("two", "working", 2)),
      followedFloorId: null,
    });
    expect(next.notifications).toEqual([]);
  });

  it("notifies when follow target moves between floors", () => {
    const baseline = transitionSessionNotifications(null, { model: model(item("one", "working", 1)), followedFloorId: "one" });
    const next = transitionSessionNotifications(baseline, {
      model: model(item("one", "working", 1), item("two", "working", 4)),
      followedFloorId: "two",
    });
    expect(next.notifications).toMatchObject([{ kind: "follow-moved", floorId: "two", fromFloorId: "one" }]);
  });

  it("deduplicates stable IDs and retains at most 20 newest notifications", () => {
    let state: SessionNotificationState | null = transitionSessionNotifications(null, {
      model: model(...Array.from({ length: 25 }, (_, index) => item(`floor-${index}`, "quiet", index))),
      followedFloorId: null,
    });
    state = transitionSessionNotifications(state, {
      model: model(...Array.from({ length: 25 }, (_, index) => item(`floor-${index}`, "working", index + 100))),
      followedFloorId: null,
    });
    expect(state.notifications).toHaveLength(20);
    expect(new Set(state.notifications.map((notification) => notification.id)).size).toBe(20);

    const repeated = transitionSessionNotifications(state, {
      model: model(...Array.from({ length: 25 }, (_, index) => item(`floor-${index}`, "working", index + 100))),
      followedFloorId: null,
    });
    expect(repeated.notifications).toEqual(state.notifications);
  });
});
