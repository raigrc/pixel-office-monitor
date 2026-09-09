import { describe, it, expect, beforeEach } from "vitest";
import {
  upsert,
  prune,
  getState,
  _clearStore,
  _getStoreSize,
  getFloorsCount,
  getUptimeMs,
} from "../monitor-store";
import type { IngestPayload } from "../schema";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makePayload(overrides: Partial<IngestPayload> & { ts?: number } = {}): IngestPayload {
  return {
    v: 1,
    ts: Date.now(),
    sessionID: "ses_test_001",
    project: "pixel-office-monitor",
    title: "Test Session",
    agent: "senior-engineer",
    kind: "subtask.start",
    status: "working",
    ...overrides,
  } as IngestPayload;
}

function _makePayloadWithDetail(detail: Record<string, unknown>, overrides: Partial<IngestPayload> = {}) {
  return makePayload({ detail: detail as unknown as IngestPayload["detail"], ...overrides });
}
void _makePayloadWithDetail;

// ---------------------------------------------------------------------------
// Monitor Store — QA Gate Sprint 6
// Covers: upsert creates floor/cubicle, updates existing, derives floor status,
// trims prompt 200, handles todos, prune idle >24h, getState sorts, _clearStore
// + spec edges: 3 parallel tasks, duplicate webhook, rate flood 20/sec, todo.updated in_progress
// ---------------------------------------------------------------------------
describe("monitor-store", () => {
  beforeEach(() => {
    _clearStore();
  });

  // -------------------------------------------------------------------------
  // _clearStore helper
  // -------------------------------------------------------------------------
  describe("_clearStore", () => {
    it("clears store and getState returns empty", () => {
      upsert(makePayload());
      expect(_getStoreSize()).toBe(1);
      _clearStore();
      expect(_getStoreSize()).toBe(0);
      expect(getState().floors).toEqual([]);
      expect(getFloorsCount()).toBe(0);
    });

    it("is idempotent when already empty", () => {
      expect(() => _clearStore()).not.toThrow();
      expect(getState().floors).toHaveLength(0);
    });

    it("getUptimeMs returns finite positive number", () => {
      const up = getUptimeMs();
      expect(typeof up).toBe("number");
      expect(up).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(up)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // upsert creates floor / cubicle
  // -------------------------------------------------------------------------
  describe("upsert — creates floor/cubicle", () => {
    it("creates floor and cubicle on first ingest", () => {
      const ts = 1_700_000_000_000;
      const floor = upsert(makePayload({ ts, sessionID: "ses_A", agent: "explore" }));
      expect(floor.sessionID).toBe("ses_A");
      expect(floor.project).toBe("pixel-office-monitor");
      expect(floor.status).toBe("working");
      expect(floor.updatedAt).toBe(ts);
      expect(floor.cubicles.size).toBe(1);
      expect(floor.cubicles.get("explore")).toBeDefined();
      expect(floor.cubicles.get("explore")!.status).toBe("working");
      expect(floor.cubicles.get("explore")!.since).toBe(ts);
    });

    it("stores title and project correctly", () => {
      upsert(makePayload({ sessionID: "ses_title", title: "My Task", project: "my-proj" }));
      const state = getState();
      expect(state.floors[0].title).toBe("My Task");
      expect(state.floors[0].project).toBe("my-proj");
    });

    it("creates floor with Map cubicles keyed by agent", () => {
      upsert(makePayload({ sessionID: "ses_map", agent: "qa-engineer", kind: "tool.before", status: "working" }));
      const state = getState();
      expect(state.floors[0].cubicles).toHaveLength(1);
      expect(state.floors[0].cubicles[0].agent).toBe("qa-engineer");
    });
  });

  // -------------------------------------------------------------------------
  // upsert updates existing
  // -------------------------------------------------------------------------
  describe("upsert — updates existing", () => {
    it("updates same session same agent — overwrites kind/status, preserves since if status unchanged", () => {
      const t1 = 1_000_000;
      const t2 = 2_000_000;
      upsert(makePayload({ sessionID: "ses_upd", agent: "senior-engineer", status: "working", kind: "subtask.start", ts: t1 }));
      const floorAfterFirst = getState().floors[0];
      expect(floorAfterFirst.cubicles[0].since).toBe(t1);
      expect(floorAfterFirst.cubicles[0].kind).toBe("subtask.start");

      // same status, different kind — since should stay t1
      upsert(makePayload({ sessionID: "ses_upd", agent: "senior-engineer", status: "working", kind: "tool.before", ts: t2 }));
      const afterSecond = getState().floors[0];
      expect(afterSecond.cubicles[0].kind).toBe("tool.before");
      expect(afterSecond.cubicles[0].since).toBe(t1); // preserved because status same
      expect(afterSecond.updatedAt).toBe(t2);
    });

    it("updates since when status flips working -> idle", () => {
      const t1 = 1_000_000;
      const t2 = 2_000_000;
      upsert(makePayload({ sessionID: "ses_flip", agent: "explore", status: "working", ts: t1 }));
      upsert(makePayload({ sessionID: "ses_flip", agent: "explore", status: "idle", kind: "subtask.end", ts: t2 }));
      const cub = getState().floors[0].cubicles[0];
      expect(cub.status).toBe("idle");
      expect(cub.since).toBe(t2);
    });

    it("updates floor title when new payload has title, keeps old when undefined", () => {
      upsert(makePayload({ sessionID: "ses_title_upd", title: "First", ts: 1000 }));
      upsert(makePayload({ sessionID: "ses_title_upd", title: "Second", ts: 2000 }));
      expect(getState().floors[0].title).toBe("Second");
      // undefined title should preserve
      upsert(makePayload({ sessionID: "ses_title_upd", title: undefined as unknown as string, ts: 3000 }));
      // The helper omits title if undefined? makePayload spreads ... but if title is undefined, it will be set to undefined
      // Store logic: if payload.title !== undefined floor.title = payload.title; so undefined preserves Second
      expect(getState().floors[0].title).toBe("Second");
    });

    it("creates new cubicle for different agent on same floor", () => {
      upsert(makePayload({ sessionID: "ses_multi", agent: "senior-engineer", ts: 1000 }));
      upsert(makePayload({ sessionID: "ses_multi", agent: "qa-engineer", ts: 1000 }));
      const floor = getState().floors[0];
      expect(floor.cubicles).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // 3 parallel tasks (same session, 3 agents)
  // -------------------------------------------------------------------------
  describe("upsert — 3 parallel tasks", () => {
    it("handles 3 parallel subtask.start on same session as 1 floor with 3 cubicles", () => {
      const sid = "ses_parallel";
      const ts = Date.now();
      upsert(makePayload({ sessionID: sid, agent: "senior-engineer", kind: "subtask.start", status: "working", ts }));
      upsert(makePayload({ sessionID: sid, agent: "qa-engineer", kind: "subtask.start", status: "working", ts: ts + 1 }));
      upsert(makePayload({ sessionID: sid, agent: "architect", kind: "subtask.start", status: "working", ts: ts + 2 }));
      const state = getState();
      expect(state.floors).toHaveLength(1);
      expect(state.floors[0].cubicles).toHaveLength(3);
      expect(state.floors[0].status).toBe("working");
      // cubicles sorted by agent in getState
      const agents = state.floors[0].cubicles.map((c) => c.agent).sort();
      expect(agents).toEqual(["architect", "qa-engineer", "senior-engineer"]);
    });

    it("supports 6 per floor before scroll — allows >6 without crash", () => {
      const sid = "ses_many";
      for (let i = 0; i < 10; i++) {
        upsert(makePayload({ sessionID: sid, agent: `agent-${i}`, ts: 1000 + i }));
      }
      expect(getState().floors[0].cubicles).toHaveLength(10);
    });
  });

  // -------------------------------------------------------------------------
  // duplicate webhook idempotency
  // -------------------------------------------------------------------------
  describe("duplicate webhook", () => {
    it("duplicate payload does not create duplicate floor or cubicle", () => {
      const payload = makePayload({ sessionID: "ses_dup", agent: "explore", ts: 5000, kind: "session.busy", status: "working" });
      upsert(payload);
      upsert(payload); // duplicate
      expect(_getStoreSize()).toBe(1);
      expect(getState().floors[0].cubicles).toHaveLength(1);
    });

    it("duplicate payload preserves since when status same", () => {
      const payload = makePayload({ sessionID: "ses_dup2", agent: "explore", ts: 9999, status: "working", kind: "tool.before" });
      upsert(payload);
      const sinceFirst = getState().floors[0].cubicles[0].since;
      upsert(payload);
      const sinceSecond = getState().floors[0].cubicles[0].since;
      expect(sinceSecond).toBe(sinceFirst);
    });

    it("duplicate with same ts but different prompt updates prompt", () => {
      const base = { sessionID: "ses_dup_prompt", agent: "qa-engineer", ts: 1234, status: "working" as const, kind: "subtask.start" as const };
      upsert(makePayload({ ...base, detail: { prompt: "first" } }));
      expect(getState().floors[0].cubicles[0].prompt).toBe("first");
      upsert(makePayload({ ...base, detail: { prompt: "second" } }));
      expect(getState().floors[0].cubicles[0].prompt).toBe("second");
    });
  });

  // -------------------------------------------------------------------------
  // derives floor status working vs idle
  // -------------------------------------------------------------------------
  describe("floor status derivation", () => {
    it("floor status working when any cubicle working", () => {
      const sid = "ses_status";
      upsert(makePayload({ sessionID: sid, agent: "a1", status: "idle", kind: "subtask.end", ts: 1000 }));
      // floor idle initially (no working cubicles)
      expect(getState().floors[0].status).toBe("idle");
      upsert(makePayload({ sessionID: sid, agent: "a2", status: "working", kind: "subtask.start", ts: 2000 }));
      expect(getState().floors[0].status).toBe("working");
      // even if a1 still idle, floor stays working because a2 working
    });

    it("floor status idle when all cubicles idle", () => {
      const sid = "ses_all_idle";
      upsert(makePayload({ sessionID: sid, agent: "a1", status: "working", kind: "subtask.start", ts: 1000 }));
      upsert(makePayload({ sessionID: sid, agent: "a2", status: "working", kind: "subtask.start", ts: 1001 }));
      expect(getState().floors[0].status).toBe("working");
      upsert(makePayload({ sessionID: sid, agent: "a1", status: "idle", kind: "subtask.end", ts: 2000 }));
      expect(getState().floors[0].status).toBe("working"); // a2 still working
      upsert(makePayload({ sessionID: sid, agent: "a2", status: "idle", kind: "subtask.end", ts: 3000 }));
      expect(getState().floors[0].status).toBe("idle");
    });

    it("session.busy / session.idle / session.created directly sets floor status", () => {
      const sid = "ses_session_level";
      // Start idle
      upsert(makePayload({ sessionID: sid, agent: "senior-engineer", kind: "session.idle", status: "idle", ts: 1000 }));
      expect(getState().floors[0].status).toBe("idle");
      // session.busy working
      upsert(makePayload({ sessionID: sid, agent: "senior-engineer", kind: "session.busy", status: "working", ts: 2000 }));
      expect(getState().floors[0].status).toBe("working");
      // session.created idle
      upsert(makePayload({ sessionID: sid, agent: "senior-engineer", kind: "session.created", status: "idle", ts: 3000 }));
      expect(getState().floors[0].status).toBe("idle");
    });

    it("non-session kinds reconcile correctly after cubicle update", () => {
      const sid = "ses_reconcile";
      // Single cubicle working via subtask.start -> floor working
      upsert(makePayload({ sessionID: sid, agent: "explore", kind: "subtask.start", status: "working", ts: 1000 }));
      expect(getState().floors[0].status).toBe("working");
      // Same cubicle now idle via subtask.end -> floor idle (no other working)
      upsert(makePayload({ sessionID: sid, agent: "explore", kind: "subtask.end", status: "idle", ts: 2000 }));
      expect(getState().floors[0].status).toBe("idle");
      // tool.before working -> floor working again
      upsert(makePayload({ sessionID: sid, agent: "explore", kind: "tool.before", status: "working", ts: 3000 }));
      expect(getState().floors[0].status).toBe("working");
    });
  });

  // -------------------------------------------------------------------------
  // trims prompt 200
  // -------------------------------------------------------------------------
  describe("prompt trimming 200 chars", () => {
    it("trims prompt to 200 chars on store", () => {
      const long = "a".repeat(500);
      upsert(makePayload({ detail: { prompt: long } }));
      const cub = getState().floors[0].cubicles[0];
      expect(cub.prompt!.length).toBe(200);
      expect(cub.prompt).toBe("a".repeat(200));
    });

    it("trims and slices after trimming whitespace", () => {
      const withSpaces = "   " + "b".repeat(300) + "   ";
      // Store does trim().slice(0,200)
      upsert(makePayload({ detail: { prompt: withSpaces } }));
      const cub = getState().floors[0].cubicles[0];
      expect(cub.prompt!.length).toBe(200);
      expect(cub.prompt).toBe("b".repeat(200));
    });

    it("preserves prompt under 200 unchanged (except trim)", () => {
      const short = "  hello world  ";
      upsert(makePayload({ detail: { prompt: short } }));
      expect(getState().floors[0].cubicles[0].prompt).toBe("hello world");
    });

    it("handles undefined prompt — keeps existing", () => {
      upsert(makePayload({ sessionID: "ses_prompt_keep", agent: "qa-engineer", detail: { prompt: "keep me" }, ts: 1000 }));
      expect(getState().floors[0].cubicles[0].prompt).toBe("keep me");
      // next update without prompt key should keep previous
      upsert(makePayload({ sessionID: "ses_prompt_keep", agent: "qa-engineer", detail: { tool: "grep" } as unknown as Record<string, unknown>, ts: 2000 }));
      // stored payload has no prompt key, so existing preserved
      expect(getState().floors[0].cubicles[0].prompt).toBe("keep me");
    });

    it("handles prompt explicitly cleared via empty detail prompt key", () => {
      // First set a prompt
      upsert(makePayload({ sessionID: "ses_prompt_clear", agent: "a1", detail: { prompt: "initial" }, ts: 1000 }));
      expect(getState().floors[0].cubicles[0].prompt).toBe("initial");
      // Now send empty string after trim => stored as undefined (cleared) per store logic
      // payload.detail.prompt = "   " -> trim -> "" -> store prompt = undefined? Actually via store logic prompt = "" ? ""? Let's see: store does prompt ? String().trim().slice... : undefined => "   " truthy => "   ".trim() => "" slice => "" => prompt = "" but then cubicle.prompt = "" via overwrite? Wait empty "" truthy check? "   " is truthy, so prompt="" . Then if "prompt" in detail, cubicle.prompt = "" . So it becomes "" not undefined.
      // To clear, we send undefined explicitly: not useful. Testing that prompt key with whitespace results in "" not "initial"
      upsert(makePayload({ sessionID: "ses_prompt_clear", agent: "a1", detail: { prompt: "   " }, ts: 2000 }));
      expect(getState().floors[0].cubicles[0].prompt).toBe("");
    });

    it("caps very long prompt at exactly 200 even with unicode", () => {
      const unicode = "🔥".repeat(300); // each emoji is 2 chars in JS length? Actually "🔥".length === 2, so 300*2=600 length, slice 200 will cut mid-surrogate but still 200 chars
      upsert(makePayload({ detail: { prompt: unicode } }));
      const prompt = getState().floors[0].cubicles[0].prompt!;
      expect(prompt.length).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  // handles todos
  // -------------------------------------------------------------------------
  describe("todos handling", () => {
    it("stores todos array from detail", () => {
      const todos = [{ content: "Task 1", status: "pending" }, { content: "Task 2", status: "in_progress" }];
      upsert(makePayload({ detail: { todos } as unknown as Record<string, unknown> }));
      const cub = getState().floors[0].cubicles[0];
      expect(cub.todos).toHaveLength(2);
      expect(cub.todos![0]).toMatchObject({ content: "Task 1" });
    });

    it("caps todos at 20", () => {
      const many = Array.from({ length: 30 }, (_, i) => ({ content: `t${i}`, status: "pending" }));
      upsert(makePayload({ detail: { todos: many } as unknown as Record<string, unknown> }));
      expect(getState().floors[0].cubicles[0].todos).toHaveLength(20);
    });

    it("preserves existing todos when new payload has no todos", () => {
      upsert(makePayload({ sessionID: "ses_todo_keep", agent: "a1", detail: { todos: [{ content: "keep" }] } as unknown as Record<string, unknown>, ts: 1000 }));
      upsert(makePayload({ sessionID: "ses_todo_keep", agent: "a1", detail: { tool: "edit" } as unknown as Record<string, unknown>, ts: 2000 }));
      expect(getState().floors[0].cubicles[0].todos).toHaveLength(1);
      expect(getState().floors[0].cubicles[0].todos![0].content).toBe("keep");
    });

    it("overwrites todos when new todos provided", () => {
      upsert(makePayload({ sessionID: "ses_todo_over", agent: "a1", detail: { todos: [{ content: "first" }] } as unknown as Record<string, unknown>, ts: 1000 }));
      upsert(makePayload({ sessionID: "ses_todo_over", agent: "a1", detail: { todos: [{ content: "second" }] } as unknown as Record<string, unknown>, ts: 2000 }));
      expect(getState().floors[0].cubicles[0].todos).toHaveLength(1);
      expect(getState().floors[0].cubicles[0].todos![0].content).toBe("second");
    });

    it("handles empty todos array — clears to empty", () => {
      upsert(makePayload({ sessionID: "ses_todo_empty", agent: "a1", detail: { todos: [{ content: "x" }] } as unknown as Record<string, unknown>, ts: 1000 }));
      upsert(makePayload({ sessionID: "ses_todo_empty", agent: "a1", detail: { todos: [] } as unknown as Record<string, unknown>, ts: 2000 }));
      expect(getState().floors[0].cubicles[0].todos).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // todo.updated with in_progress
  // -------------------------------------------------------------------------
  describe("todo.updated with in_progress", () => {
    it("handles todo.updated kind with in_progress status", () => {
      const todos = [
        { content: "Design API", status: "completed" },
        { content: "Implement store", status: "in_progress", activeForm: "Implementing store" },
        { content: "Write tests", status: "pending" },
      ];
      upsert(
        makePayload({
          sessionID: "ses_todo_upd",
          agent: "qa-engineer",
          kind: "todo.updated",
          status: "working",
          detail: { todos } as unknown as Record<string, unknown>,
          ts: 1000,
        })
      );
      const cub = getState().floors[0].cubicles[0];
      expect(cub.kind).toBe("todo.updated");
      expect(cub.status).toBe("working");
      expect(cub.todos).toHaveLength(3);
      expect(cub.todos![1].status).toBe("in_progress");
    });

    it("todo.updated preserves alternative field names (text vs content, state vs status)", () => {
      const todos = [{ text: "alt field", state: "in_progress", priority: "high" }];
      upsert(
        makePayload({
          sessionID: "ses_todo_alt",
          agent: "architect",
          kind: "todo.updated",
          status: "working",
          detail: { todos } as unknown as Record<string, unknown>,
        })
      );
      const cub = getState().floors[0].cubicles[0];
      expect(cub.todos![0].text).toBe("alt field");
      expect(cub.todos![0].state).toBe("in_progress");
    });

    it("floor stays working when todo.updated working", () => {
      upsert(
        makePayload({
          sessionID: "ses_todo_working",
          agent: "senior-engineer",
          kind: "todo.updated",
          status: "working",
          ts: 1000,
        })
      );
      expect(getState().floors[0].status).toBe("working");
    });
  });

  // -------------------------------------------------------------------------
  // prune removes idle >24h + session idle prune + stale cubicles
  // -------------------------------------------------------------------------
  describe("prune", () => {
    it("removes floor idle >24h", () => {
      const now = Date.now();
      const old = now - 25 * 60 * 60 * 1000; // 25h ago
      upsert(makePayload({ sessionID: "ses_prune_old", agent: "a1", status: "idle", kind: "session.idle", ts: old }));
      expect(_getStoreSize()).toBe(1);
      const removed = prune(now);
      expect(removed).toBe(1);
      expect(_getStoreSize()).toBe(0);
    });

    it("does NOT prune working floor even if old", () => {
      const now = Date.now();
      const old = now - 25 * 60 * 60 * 1000;
      upsert(makePayload({ sessionID: "ses_prune_working", agent: "a1", status: "working", kind: "session.busy", ts: old }));
      // prune with now 25h later — floor is working, should NOT be pruned (condition requires idle)
      const removed = prune(now);
      expect(removed).toBe(0);
      expect(_getStoreSize()).toBe(1);
    });

    it("does NOT prune idle floor within TTL", () => {
      const now = Date.now();
      const recent = now - 1 * 60 * 60 * 1000; // 1h ago
      upsert(makePayload({ sessionID: "ses_prune_recent", agent: "a1", status: "idle", kind: "session.idle", ts: recent }));
      expect(prune(now)).toBe(0);
      expect(_getStoreSize()).toBe(1);
    });

    it("removes stale idle cubicles >24h but keeps working cubicles", () => {
      const now = Date.now();
      const old = now - 25 * 60 * 60 * 1000;
      const sid = "ses_cubicle_prune";
      // create floor with two cubicles: one idle old, one working old
      upsert(makePayload({ sessionID: sid, agent: "idle-agent", status: "idle", kind: "subtask.end", ts: old }));
      upsert(makePayload({ sessionID: sid, agent: "working-agent", status: "working", kind: "subtask.start", ts: old }));
      // set floor to idle for prune to also check floor? Actually floor status will be working because one working cubicle, so floor not pruned.
      // Need to make floor idle: both idle old? Let's test separate: first make both idle, then one working recently?
      // Here floor status = working (since one working), so floor not removed. But idle cubicle should be pruned.
      const removed = prune(now);
      // idle cubicle should be removed, working kept, floor not removed because working status
      const floor = getState().floors.find((f) => f.sessionID === sid)!;
      expect(floor).toBeDefined();
      expect(floor.cubicles.some((c) => c.agent === "idle-agent")).toBe(false);
      expect(floor.cubicles.some((c) => c.agent === "working-agent")).toBe(true);
      // No floor removed because floor working
      expect(removed).toBe(0);
    });

    it("prunes empty floor stale >1h", () => {
      const now = Date.now();
      const old = now - 2 * 60 * 60 * 1000; // 2h ago
      upsert(makePayload({ sessionID: "ses_empty_stale", agent: "a1", status: "idle", kind: "subtask.end", ts: old }));
      // Manually prune idle cubicle first by advancing time 25h
      const later = old + 25 * 60 * 60 * 1000 + 1000;
      prune(later); // removes idle cubicle, floor cubicles now 0, but floor updatedAt is still old
      // Now floor has 0 cubicles and updatedAt old >1h, should be pruned on next prune
      // Actually the same prune call also checks emptyStale, so it would prune floor in same call.
      // So after prune(later), floor should be gone
      expect(_getStoreSize()).toBe(0);
    });

    it("prune returns count of removed floors", () => {
      const now = Date.now();
      const old = now - 30 * 60 * 60 * 1000;
      upsert(makePayload({ sessionID: "ses1", agent: "a1", status: "idle", kind: "session.idle", ts: old }));
      upsert(makePayload({ sessionID: "ses2", agent: "a1", status: "idle", kind: "session.idle", ts: old }));
      upsert(makePayload({ sessionID: "ses3", agent: "a1", status: "working", kind: "session.busy", ts: old }));
      const removed = prune(now);
      expect(removed).toBe(2); // two idle floors removed
      expect(_getStoreSize()).toBe(1);
    });

    it("session idle prune threshold — exactly 24h not pruned, 24h+1ms pruned", () => {
      const base = 1_000_000_000_000;
      const TTL = 24 * 60 * 60 * 1000;
      upsert(makePayload({ sessionID: "ses_exact", agent: "a1", status: "idle", kind: "session.idle", ts: base }));
      // at exactly 24h, not pruned (condition is > TTL)
      expect(prune(base + TTL)).toBe(0);
      expect(_getStoreSize()).toBe(1);
      // at 24h+1ms, pruned
      expect(prune(base + TTL + 1)).toBe(1);
      expect(_getStoreSize()).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // getState sorts by updatedAt
  // -------------------------------------------------------------------------
  describe("getState sorting", () => {
    it("sorts floors by updatedAt desc", () => {
      upsert(makePayload({ sessionID: "ses_old", agent: "a1", ts: 1000 }));
      upsert(makePayload({ sessionID: "ses_new", agent: "a1", ts: 3000 }));
      upsert(makePayload({ sessionID: "ses_mid", agent: "a1", ts: 2000 }));
      const floors = getState().floors;
      expect(floors.map((f) => f.sessionID)).toEqual(["ses_new", "ses_mid", "ses_old"]);
    });

    it("sorts cubicles by agent alphabetically", () => {
      const sid = "ses_sort_cub";
      upsert(makePayload({ sessionID: sid, agent: "zebra", ts: 1000 }));
      upsert(makePayload({ sessionID: sid, agent: "alpha", ts: 1000 }));
      upsert(makePayload({ sessionID: sid, agent: "middle", ts: 1000 }));
      const cubs = getState().floors[0].cubicles.map((c) => c.agent);
      expect(cubs).toEqual(["alpha", "middle", "zebra"]);
    });

    it("returns deep-ish copy — mutating returned array does not affect store", () => {
      upsert(makePayload({ sessionID: "ses_copy", agent: "a1", ts: 1000 }));
      const state1 = getState();
      state1.floors.push({} as unknown as typeof state1.floors[0]);
      const state2 = getState();
      expect(state2.floors).toHaveLength(1);
    });

    it("updatedAt reflects latest payload ts", () => {
      upsert(makePayload({ sessionID: "ses_time", agent: "a1", ts: 1111 }));
      expect(getState().floors[0].updatedAt).toBe(1111);
      upsert(makePayload({ sessionID: "ses_time", agent: "a1", ts: 2222 }));
      expect(getState().floors[0].updatedAt).toBe(2222);
    });
  });

  // -------------------------------------------------------------------------
  // rate flood 20/sec burst without crash
  // -------------------------------------------------------------------------
  describe("rate flood 20/sec burst", () => {
    it("handles 20 rapid upserts without crash and preserves last state", () => {
      const sid = "ses_flood";
      const baseTs = Date.now();
      expect(() => {
        for (let i = 0; i < 20; i++) {
          upsert(
            makePayload({
              sessionID: sid,
              agent: "senior-engineer",
              ts: baseTs + i,
              kind: i % 2 === 0 ? "tool.before" : "tool.after",
              status: "working",
              detail: { tool: `tool_${i}`, prompt: `prompt ${i}` },
            })
          );
        }
      }).not.toThrow();
      const floor = getState().floors.find((f) => f.sessionID === sid)!;
      expect(floor).toBeDefined();
      expect(floor.cubicles).toHaveLength(1);
      // lastTool should be from last iteration
      const cub = floor.cubicles[0];
      expect(cub.lastTool).toBe("tool_19");
      expect(cub.prompt).toBe("prompt 19");
      expect(_getStoreSize()).toBeGreaterThanOrEqual(1);
    });

    it("handles 20/sec burst across 3 agents (60 total) without crash", () => {
      const sid = "ses_flood_multi";
      const base = Date.now();
      expect(() => {
        for (let i = 0; i < 20; i++) {
          for (const agent of ["a1", "a2", "a3"]) {
            upsert(makePayload({ sessionID: sid, agent, ts: base + i, status: "working", kind: "tool.before" }));
          }
        }
      }).not.toThrow();
      const floor = getState().floors[0];
      expect(floor.cubicles).toHaveLength(3);
    });

    it("auto-prune triggers when store >50 floors", () => {
      // Create 51 floors with old idle timestamps — upsert auto-prunes when size >50,
      // so the 51st insert will immediately prune old idle floors.
      const now = Date.now();
      const old = now - 30 * 60 * 60 * 1000;
      for (let i = 0; i < 51; i++) {
        upsert(makePayload({ sessionID: `ses_big_${i}`, agent: "a1", status: "idle", kind: "session.idle", ts: old }));
      }
      // Because prune fires inside the 51st upsert, size will be 0 or 1, not 51
      expect(_getStoreSize()).toBeLessThanOrEqual(1);
      // Next fresh upsert should still work and keep store small
      upsert(makePayload({ sessionID: "ses_trigger_prune", agent: "a1", status: "working", ts: now }));
      expect(_getStoreSize()).toBeLessThanOrEqual(2);
      expect(_getStoreSize()).toBeGreaterThanOrEqual(1);
    });
  });

  // -------------------------------------------------------------------------
  // edge — invalid handling not crash
  // -------------------------------------------------------------------------
  describe("edge cases — malformed / boundary", () => {
    it("handles huge prompt without crash (5000 chars)", () => {
      const huge = "x".repeat(5000);
      expect(() => upsert(makePayload({ detail: { prompt: huge } }))).not.toThrow();
      expect(getState().floors[0].cubicles[0].prompt!.length).toBe(200);
    });

    it("handles null detail gracefully (treated as no detail)", () => {
      // @ts-expect-error null detail runtime edge case — store handles gracefully
      expect(() => upsert(makePayload({ detail: null as unknown as IngestPayload["detail"] }))).not.toThrow();
    });

    it("handles missing optional title", () => {
      const p = makePayload({ title: undefined as unknown as string });
      // @ts-expect-error delete title to simulate missing optional field
      delete (p as Record<string, unknown>).title;
      expect(() => upsert(p as IngestPayload)).not.toThrow();
      // Missing title falls back to the default "Floor <session8>" display title.
      expect(getState().floors[0].title).toBe("Floor ses_test");
    });

    it("handles tool truncation to 100", () => {
      const longTool = "t".repeat(300);
      upsert(makePayload({ detail: { tool: longTool } }));
      expect(getState().floors[0].cubicles[0].lastTool!.length).toBe(100);
    });

    it("handles concurrent different sessions isolation", () => {
      upsert(makePayload({ sessionID: "ses_iso_1", agent: "a1", status: "working", ts: 1000 }));
      upsert(makePayload({ sessionID: "ses_iso_2", agent: "a1", status: "idle", ts: 1000 }));
      const state = getState();
      expect(state.floors).toHaveLength(2);
      const f1 = state.floors.find((f) => f.sessionID === "ses_iso_1")!;
      const f2 = state.floors.find((f) => f.sessionID === "ses_iso_2")!;
      expect(f1.status).toBe("working");
      expect(f2.status).toBe("idle");
    });
  });

  // -------------------------------------------------------------------------
  // detail lastTool / prompt preservation semantics
  // -------------------------------------------------------------------------
  describe("detail field preservation", () => {
    it("preserves lastTool when new payload has no tool", () => {
      upsert(makePayload({ sessionID: "ses_tool_keep", agent: "a1", detail: { tool: "initial-tool" }, ts: 1000 }));
      upsert(makePayload({ sessionID: "ses_tool_keep", agent: "a1", detail: { prompt: "no tool here" }, ts: 2000 }));
      expect(getState().floors[0].cubicles[0].lastTool).toBe("initial-tool");
    });

    it("updates lastTool when new tool provided", () => {
      upsert(makePayload({ sessionID: "ses_tool_upd", agent: "a1", detail: { tool: "first" }, ts: 1000 }));
      upsert(makePayload({ sessionID: "ses_tool_upd", agent: "a1", detail: { tool: "second" }, ts: 2000 }));
      expect(getState().floors[0].cubicles[0].lastTool).toBe("second");
    });

    it("handles all ingest kinds without throw", () => {
      const kinds = [
        "subtask.start",
        "subtask.end",
        "session.busy",
        "session.idle",
        "session.created",
        "tool.before",
        "tool.after",
        "todo.updated",
      ] as const;
      for (const kind of kinds) {
        expect(() =>
          upsert(
            makePayload({
              sessionID: `ses_kind_${kind}`,
              agent: "a1",
              kind,
              status: kind.includes("idle") || kind === "subtask.end" ? "idle" : "working",
              ts: Date.now(),
            })
          )
        ).not.toThrow();
      }
      expect(_getStoreSize()).toBe(kinds.length);
    });
  });
});
