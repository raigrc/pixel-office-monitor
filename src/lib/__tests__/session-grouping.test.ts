import { describe, it, expect, beforeEach } from "vitest";
import { upsert, getState, getSnapshot, _clearStore } from "../monitor-store";
import type { IngestPayloadV2 } from "../schema";

// ---------------------------------------------------------------------------
// Session grouping — delegated (child) sessions must land on the parent's
// floor instead of spawning one floor per session.
// ---------------------------------------------------------------------------

function makeV2(overrides: Partial<IngestPayloadV2> = {}): IngestPayloadV2 {
  return {
    v: 2,
    eventId: `evt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    projectId: "pixel-office-monitor",
    sessionId: "ses_root_001",
    rootSessionId: "ses_root_001",
    parentSessionId: null,
    occurredAt: Date.now(),
    kind: "session.upsert",
    detail: { agentKey: "orchestrator" },
    ...overrides,
  };
}

describe("session-grouping", () => {
  beforeEach(() => {
    _clearStore();
  });

  it("child with self-claimed root but recorded parent joins the parent floor", () => {
    upsert(makeV2({ sessionId: "ses_root_001", rootSessionId: "ses_root_001" }));
    // Child claims itself as root (plugin missed the parent's session.created),
    // but the parent link was recorded.
    upsert(
      makeV2({
        sessionId: "ses_child_001",
        rootSessionId: "ses_child_001",
        parentSessionId: "ses_root_001",
        detail: { agentKey: "explore" },
      }),
    );

    const state = getState();
    expect(state.floors).toHaveLength(1);
    expect(state.floors[0].sessionID).toContain("ses_root_001");
    const snap = getSnapshot();
    const explore = snap.actors.find((a) => a.agentKey === "explore");
    expect(explore?.floorId).toBe(state.floors[0].sessionID);
  });

  it("late parent linkage re-homes the actor and removes the ghost floor", () => {
    // Child streams first with no lineage at all → temporary solo floor.
    upsert(
      makeV2({
        sessionId: "ses_child_002",
        rootSessionId: "ses_child_002",
        detail: { agentKey: "researcher" },
      }),
    );
    expect(getState().floors).toHaveLength(1);

    // Parent appears, then the child event carries the parent link.
    upsert(makeV2({ sessionId: "ses_root_002", rootSessionId: "ses_root_002" }));
    upsert(
      makeV2({
        sessionId: "ses_child_002",
        rootSessionId: "ses_child_002",
        parentSessionId: "ses_root_002",
        kind: "actor.activity",
        detail: { agentKey: "researcher", activity: "working" },
      }),
    );

    const state = getState();
    expect(state.floors).toHaveLength(1);
    expect(state.floors[0].sessionID).toContain("ses_root_002");
    const snap = getSnapshot();
    const researcher = snap.actors.find((a) => a.agentKey === "researcher");
    expect(researcher?.floorId).toBe(state.floors[0].sessionID);
    // Re-homed actor must not share a seat with the parent floor's occupant.
    const seats = snap.actors
      .filter((a) => a.floorId === state.floors[0].sessionID)
      .map((a) => a.seatIndex);
    expect(new Set(seats).size).toBe(seats.length);
  });

  it("a new parentless session still starts its own floor", () => {
    upsert(makeV2({ sessionId: "ses_root_003", rootSessionId: "ses_root_003" }));
    upsert(
      makeV2({
        sessionId: "ses_root_004",
        rootSessionId: "ses_root_004",
        parentSessionId: null,
      }),
    );

    expect(getState().floors).toHaveLength(2);
  });

  it("re-homed actors do not collide on seats", () => {
    upsert(makeV2({ sessionId: "ses_root_005", rootSessionId: "ses_root_005" }));
    upsert(
      makeV2({
        sessionId: "ses_child_005a",
        rootSessionId: "ses_child_005a",
        parentSessionId: "ses_root_005",
        detail: { agentKey: "explore" },
      }),
    );
    upsert(
      makeV2({
        sessionId: "ses_child_005b",
        rootSessionId: "ses_child_005b",
        parentSessionId: "ses_root_005",
        detail: { agentKey: "researcher" },
      }),
    );

    const state = getState();
    expect(state.floors).toHaveLength(1);
    const snap = getSnapshot();
    const seats = snap.actors
      .filter((a) => a.floorId === state.floors[0].sessionID)
      .map((a) => a.seatIndex);
    expect(seats.length).toBeGreaterThan(1);
    expect(new Set(seats).size).toBe(seats.length);
  });
});
