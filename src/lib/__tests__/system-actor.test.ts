import { describe, it, expect, beforeEach } from "vitest";
import { upsert, getState, getSnapshot, _clearStore } from "../monitor-store";
import { seatForAgent } from "../scene/roster";
import type { IngestPayloadV2 } from "../schema";

// ---------------------------------------------------------------------------
// System actors — session-level signals (session.created/busy/idle filed
// under agentKey "system") must never render at desks, consume seats, or
// inflate agent counts.
// ---------------------------------------------------------------------------

function makeV2(overrides: Partial<IngestPayloadV2> = {}): IngestPayloadV2 {
  return {
    v: 2,
    eventId: `evt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    projectId: "pixel-office-monitor",
    sessionId: "ses_sys_001",
    rootSessionId: "ses_sys_001",
    parentSessionId: null,
    occurredAt: Date.now(),
    kind: "session.upsert",
    detail: { agentKey: "system" },
    ...overrides,
  };
}

describe("system-actor", () => {
  beforeEach(() => {
    _clearStore();
  });

  it("system actor gets system role and takes no seat", () => {
    upsert(makeV2({ detail: { agentKey: "system" } }));
    // A real agent keeps its fixed roster seat regardless of arrival order.
    upsert(
      makeV2({
        sessionId: "ses_sys_001",
        rootSessionId: "ses_sys_001",
        kind: "actor.activity",
        detail: { agentKey: "explore", activity: "working" },
      }),
    );

    const snap = getSnapshot();
    const system = snap.actors.find((a) => a.agentKey === "system");
    const explore = snap.actors.find((a) => a.agentKey === "explore");
    expect(system?.role).toBe("system");
    expect(system?.seatIndex).toBe(-1);
    expect(explore?.role).toBe("specialist");
    expect(explore?.seatIndex).toBe(seatForAgent("explore"));
  });

  it("system actors are excluded from desk cubicles and counts", () => {
    upsert(makeV2({ detail: { agentKey: "system" } }));
    upsert(
      makeV2({
        kind: "actor.activity",
        detail: { agentKey: "explore", activity: "working" },
      }),
    );

    const state = getState();
    expect(state.floors).toHaveLength(1);
    const agents = state.floors[0].cubicles.map((c) => c.agent);
    expect(agents).not.toContain("system");
    expect(agents).toContain("explore");
  });

  it("orchestrator role still assigns correctly", () => {
    upsert(makeV2({ detail: { agentKey: "orchestrator" } }));
    const snap = getSnapshot();
    expect(snap.actors.find((a) => a.agentKey === "orchestrator")?.role).toBe(
      "orchestrator",
    );
  });

  it("child-session orchestrator merges into the single standing admin", () => {
    upsert(
      makeV2({
        sessionId: "ses_root_010",
        rootSessionId: "ses_root_010",
        detail: { agentKey: "orchestrator" },
      }),
    );
    // Child claims itself as root and files session busyness as orchestrator.
    upsert(
      makeV2({
        sessionId: "ses_child_010",
        rootSessionId: "ses_child_010",
        parentSessionId: "ses_root_010",
        kind: "actor.activity",
        detail: { agentKey: "orchestrator", activity: "working" },
      }),
    );

    const snap = getSnapshot();
    const admins = snap.actors.filter((a) => a.agentKey === "orchestrator");
    expect(admins).toHaveLength(1);
    expect(admins[0].role).toBe("orchestrator");
    expect(admins[0].seatIndex).toBe(-1);
    const state = getState();
    expect(state.floors).toHaveLength(1);
    const agents = state.floors[0].cubicles.map((c) => c.agent);
    expect(agents.filter((a) => a === "orchestrator")).toHaveLength(1);
  });

  it("late parent linkage folds the ghost floor into the true root", () => {
    // Phantom first: no lineage at all → temporary solo floor.
    upsert(
      makeV2({
        sessionId: "ses_child_011",
        rootSessionId: "ses_child_011",
        kind: "actor.activity",
        detail: { agentKey: "orchestrator", activity: "working" },
      }),
    );
    expect(
      getSnapshot().actors.filter((a) => a.agentKey === "orchestrator"),
    ).toHaveLength(1);

    // Parent appears, then the child event carries the link.
    upsert(makeV2({ sessionId: "ses_root_011", rootSessionId: "ses_root_011" }));
    upsert(
      makeV2({
        sessionId: "ses_child_011",
        rootSessionId: "ses_child_011",
        parentSessionId: "ses_root_011",
        kind: "actor.activity",
        detail: { agentKey: "orchestrator", activity: "working" },
      }),
    );

    const state = getState();
    expect(state.floors).toHaveLength(1);
    expect(state.floors[0].sessionID).toContain("ses_root_011");
    const admins = getSnapshot().actors.filter((a) => a.agentKey === "orchestrator");
    expect(admins).toHaveLength(1);
  });
});
