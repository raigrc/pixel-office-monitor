import { describe, it, expect, beforeEach } from "vitest";
import { upsert, _clearStore, getSnapshot, getState, closeFloor, prune } from "@/lib/monitor-store";
import { getActorActivityPose, getActorBusyCount, AWAKE_WINDOW_MS } from "@/lib/scene/actor-pose";
import { ROSTER_KEYS, ROSTER_SIZE, seatForAgent } from "@/lib/scene/roster";
import type { ActorInfo } from "@/lib/monitor-types";

function v2Base(over: Record<string, unknown> = {}) {
  return {
    v: 2 as const,
    eventId: `evt-${Math.random().toString(36).slice(2)}`,
    projectId: "proj",
    sessionId: "ses-root",
    rootSessionId: "ses-root",
    parentSessionId: null,
    occurredAt: Date.now(),
    kind: "invocation.requested" as const,
    detail: {
      callId: `call-${Math.random().toString(36).slice(2)}`,
      agentKey: "researcher",
      senderActorId: "proj:ses-root:orchestrator",
      recipientActorId: "proj:ses-root:researcher",
      ...((over.detail as Record<string, unknown>) ?? {}),
    },
    ...over,
  };
}

function actor(id: string, key: string, activity?: "working" | "idle"): ActorInfo {
  const now = Date.now();
  return {
    actorId: id,
    floorId: "f",
    sessionId: "s",
    agentKey: key,
    displayName: key,
    role: "specialist",
    seatIndex: 0,
    lastObservedAt: now,
    createdAt: now,
    activity,
  };
}

describe("roster room", () => {
  beforeEach(() => _clearStore());

  it("roster holds 15 fixed seats", () => {
    expect(ROSTER_SIZE).toBe(15);
    expect(ROSTER_KEYS).toHaveLength(15);
    expect(seatForAgent("explore")).toBe(13);
    expect(seatForAgent("orchestrator")).toBe(-1);
    expect(seatForAgent("system")).toBe(-1);
    expect(seatForAgent("title")).toBe(-1);
  });

  it("first session event pre-occupies the floor with sleeping roster", () => {
    upsert(v2Base({ eventId: "seed1", kind: "session.upsert", detail: {} }) as never);
    const snap = getSnapshot();
    for (const key of ROSTER_KEYS) {
      const a = snap.actors.find((x) => x.agentKey === key);
      expect(a, key).toBeDefined();
      expect(a?.activity).toBe("idle");
    }
    const seats = snap.actors.filter((a) => a.role === "specialist").map((a) => a.seatIndex);
    expect(new Set(seats).size).toBe(ROSTER_SIZE);
    // Orchestrator stands: no actor until it reports.
    expect(snap.actors.some((a) => a.agentKey === "orchestrator")).toBe(false);
  });

  it("repeat calls from another session land on the SAME cubicle", () => {
    upsert(v2Base({ eventId: "m1", sessionId: "ses-a", rootSessionId: "ses-a", kind: "invocation.requested", detail: { callId: "c-a", agentKey: "researcher", senderActorId: "proj:ses-a:orchestrator", recipientActorId: "proj:ses-a:researcher" } }) as never);
    const seatA = getSnapshot().actors.find((a) => a.agentKey === "researcher")?.seatIndex;
    upsert(v2Base({ eventId: "m2", sessionId: "ses-b", rootSessionId: "ses-a", parentSessionId: "ses-a", kind: "invocation.requested", detail: { callId: "c-b", agentKey: "researcher", senderActorId: "proj:ses-b:orchestrator", recipientActorId: "proj:ses-b:researcher" } }) as never);
    const researchers = getSnapshot().actors.filter((a) => a.agentKey === "researcher" && a.role === "specialist");
    // Parent-subtask actor and child-busyness actor merge by key on one floor.
    expect(researchers.length).toBeLessThanOrEqual(2);
    for (const r of researchers) expect(r.seatIndex).toBe(seatA);
  });

  it("finished task keeps the desk (rests in place, no exit)", () => {
    upsert(v2Base({ eventId: "k1", kind: "invocation.requested", detail: { callId: "k-call", agentKey: "researcher", senderActorId: "proj:ses-root:orchestrator", recipientActorId: "proj:ses-root:researcher" } }) as never);
    upsert(v2Base({ eventId: "k2", kind: "invocation.finished", detail: { callId: "k-call", agentKey: "researcher", senderActorId: "proj:ses-root:orchestrator", recipientActorId: "proj:ses-root:researcher", outcome: "succeeded" } }) as never);
    const snap = getSnapshot();
    const r = snap.actors.find((a) => a.agentKey === "researcher");
    expect(r).toBeDefined();
    expect(r?.activity).toBe("idle");
  });

  it("concurrent repeat calls stack a busy count on one desk", () => {
    const a = "proj:ses-root:researcher";
    const s = "proj:ses-root:orchestrator";
    upsert(v2Base({ eventId: "q1", kind: "invocation.requested", detail: { callId: "q-1", agentKey: "researcher", senderActorId: s, recipientActorId: a } }) as never);
    upsert(v2Base({ eventId: "q2", kind: "invocation.requested", detail: { callId: "q-2", agentKey: "researcher", senderActorId: s, recipientActorId: a } }) as never);
    const snap = getSnapshot();
    const invs = snap.invocations.filter((i) => i.floorId === "proj:ses-root");
    expect(getActorBusyCount(a, invs)).toBe(2);
    // Finish one: desk stays working on the other.
    upsert(v2Base({ eventId: "q3", kind: "invocation.finished", detail: { callId: "q-1", agentKey: "researcher", senderActorId: s, recipientActorId: a, outcome: "succeeded" } }) as never);
    const snap2 = getSnapshot();
    const invs2 = snap2.invocations.filter((i) => i.floorId === "proj:ses-root");
    expect(getActorBusyCount(a, invs2)).toBe(1);
    // Remaining work is requested-but-not-started from another sender:
    // seated and waiting (lamp on), not yet typing.
    expect(getActorActivityPose(actor(a, "researcher", "working"), invs2)).toBe("work");
    expect(getActorActivityPose(actor(a, "researcher", undefined), invs2)).toBe("seat");
  });

  it("pose flows work -> success -> idle across the awake window", () => {
    const a = actor("actor-1", "researcher", "idle");
    const finishedAt = Date.now() - 10_000;
    const inv = {
      invocationId: "i", floorId: "f", senderActorId: "s", recipientActorId: "actor-1",
      callId: "c", parentInvocationId: null, revision: 1, executionStatus: "finished" as const,
      outcome: "succeeded" as const, taskCategory: null, promptPreview: null,
      requestedAt: finishedAt - 1000, startedAt: finishedAt - 500, finishedAt,
    };
    expect(getActorActivityPose(a, [inv], finishedAt + 10_000)).toBe("success");
    expect(getActorActivityPose(a, [inv], finishedAt + AWAKE_WINDOW_MS + 1000)).toBe("idle");
  });

  it("failed finish never celebrates", () => {
    const a = actor("actor-2", "researcher", "idle");
    const finishedAt = Date.now() - 1000;
    const inv = {
      invocationId: "i2", floorId: "f", senderActorId: "s", recipientActorId: "actor-2",
      callId: "c2", parentInvocationId: null, revision: 1, executionStatus: "finished" as const,
      outcome: "failed" as const, taskCategory: null, promptPreview: null,
      requestedAt: finishedAt - 1000, startedAt: finishedAt - 500, finishedAt,
    };
    expect(getActorActivityPose(a, [inv], finishedAt + 1000)).toBe("idle");
  });

  it("unknown future keys share the visitor desk, never a roster seat", () => {
    upsert(v2Base({ eventId: "n1", kind: "actor.activity", detail: { agentKey: "future-bot", activity: "working" } }) as never);
    upsert(v2Base({ eventId: "n2", kind: "actor.activity", detail: { agentKey: "title", activity: "working" } }) as never);
    const snap = getSnapshot();
    expect(snap.actors.find((a) => a.agentKey === "future-bot")?.seatIndex).toBe(ROSTER_SIZE);
    // Scout keeps its corner even with a guest around.
    expect(snap.actors.find((a) => a.agentKey === "scout")?.seatIndex).toBe(ROSTER_SIZE - 1);
    expect(snap.actors.find((a) => a.agentKey === "title")?.role).toBe("system");
  });

  it("orchestrator reports as standing admin, never seated", () => {
    upsert(v2Base({ eventId: "ad1", kind: "actor.activity", detail: { agentKey: "orchestrator", activity: "working" } }) as never);
    const snap = getSnapshot();
    const orch = snap.actors.filter((a) => a.agentKey === "orchestrator");
    expect(orch).toHaveLength(1);
    expect(orch[0].role).toBe("orchestrator");
    expect(orch[0].seatIndex).toBe(-1);
  });

  it("seeded sleeping floors survive short silence but prune when long dead", () => {
    const base = Date.now();
    upsert(v2Base({ eventId: "p1", occurredAt: base, kind: "session.upsert", detail: {} }) as never);
    expect(getState().floors.some((f) => f.sessionID === "proj:ses-root")).toBe(true);
    // 2h of silence: sleeping office stays.
    expect(prune(base + 2 * 60 * 60 * 1000)).toBe(0);
    expect(getState().floors.some((f) => f.sessionID === "proj:ses-root")).toBe(true);
    // 25h of silence: dead floor reaped.
    expect(prune(base + 25 * 60 * 60 * 1000)).toBe(1);
    expect(getState().floors.some((f) => f.sessionID === "proj:ses-root")).toBe(false);
  });

  it("prune reaps runtime maps too (no snapshot/state split)", () => {
    upsert(v2Base({ eventId: "rp1", sessionId: "ses-doom", rootSessionId: "ses-doom", kind: "invocation.requested", detail: { callId: "rp-c", agentKey: "researcher", senderActorId: "proj:ses-doom:orchestrator", recipientActorId: "proj:ses-doom:researcher" } }) as never);
    const doomedFloor = "proj:ses-doom";
    expect(getSnapshot().floors.some((f) => f.floorId === doomedFloor)).toBe(true);
    // Force-finish then age past the idle TTL via close + prune path.
    upsert(v2Base({ eventId: "rp2", sessionId: "ses-doom", rootSessionId: "ses-doom", kind: "invocation.finished", detail: { callId: "rp-c", agentKey: "researcher", senderActorId: "proj:ses-doom:orchestrator", recipientActorId: "proj:ses-doom:researcher", outcome: "succeeded" } }) as never);
    closeFloor(doomedFloor);
    prune(Date.now() + 25 * 60 * 60 * 1000);
    const snap = getSnapshot();
    expect(snap.floors.some((f) => f.floorId === doomedFloor)).toBe(false);
    expect(snap.actors.some((a) => a.floorId === doomedFloor)).toBe(false);
    expect(snap.invocations.some((i) => i.floorId === doomedFloor)).toBe(false);
  });

  it("ghost heal moves invocations and system signals to the true floor", () => {
    upsert(v2Base({ eventId: "gh1", sessionId: "ses-ghost", rootSessionId: "ses-ghost", kind: "invocation.requested", detail: { callId: "gh-c", agentKey: "researcher", senderActorId: "proj:ses-ghost:orchestrator", recipientActorId: "proj:ses-ghost:researcher" } }) as never);
    upsert(v2Base({ eventId: "gh2", sessionId: "ses-ghost-root", rootSessionId: "ses-ghost-root", kind: "session.upsert", detail: { agentKey: "orchestrator" } }) as never);
    upsert(v2Base({ eventId: "gh3", sessionId: "ses-ghost", rootSessionId: "ses-ghost", parentSessionId: "ses-ghost-root", kind: "actor.activity", detail: { agentKey: "researcher", activity: "working" } }) as never);
    const snap = getSnapshot();
    expect(snap.floors.map((f) => f.floorId)).toEqual(["proj:ses-ghost-root"]);
    expect(snap.invocations.every((i) => i.floorId === "proj:ses-ghost-root")).toBe(true);
    expect(snap.actors.every((a) => a.floorId === "proj:ses-ghost-root")).toBe(true);
  });

  it("system signals merge to one actor per floor", () => {
    upsert(v2Base({ eventId: "sy1", sessionId: "ses-s1", rootSessionId: "ses-s1", kind: "session.upsert", detail: { agentKey: "system" } }) as never);
    upsert(v2Base({ eventId: "sy2", sessionId: "ses-s2", rootSessionId: "ses-s1", parentSessionId: "ses-s1", kind: "session.upsert", detail: { agentKey: "system" } }) as never);
    const systems = getSnapshot().actors.filter((a) => a.agentKey === "system");
    expect(systems).toHaveLength(1);
  });

  it("closed floors hide from state", () => {
    upsert(v2Base({ eventId: "cl1", kind: "invocation.requested", detail: { callId: "cl-call", agentKey: "researcher", senderActorId: "proj:ses-root:orchestrator", recipientActorId: "proj:ses-root:researcher" } }) as never);
    expect(getState().floors.some((f) => f.sessionID === "proj:ses-root")).toBe(true);
    closeFloor("proj:ses-root");
    expect(getState().floors.some((f) => f.sessionID === "proj:ses-root")).toBe(false);
  });
});
