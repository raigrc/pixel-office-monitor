import { describe, it, expect } from "vitest";
import { ingestPayloadSchema, todoSchema, normalizePrompt } from "../schema";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    v: 1,
    ts: Date.now(),
    sessionID: "ses_123",
    project: "pixel-office-monitor",
    title: "Test Title",
    agent: "qa-engineer",
    kind: "subtask.start" as const,
    status: "working" as const,
    detail: {
      prompt: "find auth logic",
      tool: "grep",
      todos: [{ content: "task 1", status: "pending" }],
    },
    ...overrides,
  };
}

describe("ingestPayloadSchema — valid / invalid", () => {
  // -----------------------------------------------------------------------
  // valid
  // -----------------------------------------------------------------------
  describe("valid payloads", () => {
    it("accepts minimal valid payload", () => {
      const p = {
        v: 1,
        ts: 1000,
        sessionID: "ses_min",
        project: "proj",
        agent: "explore",
        kind: "session.busy",
        status: "working",
      };
      const res = ingestPayloadSchema.safeParse(p);
      expect(res.success).toBe(true);
    });

    it("accepts all 8 kinds", () => {
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
        const p = validPayload({ kind });
        const res = ingestPayloadSchema.safeParse(p);
        expect(res.success, `kind ${kind} should pass`).toBe(true);
      }
    });

    it("accepts both working and idle status", () => {
      expect(ingestPayloadSchema.safeParse(validPayload({ status: "working" })).success).toBe(true);
      expect(ingestPayloadSchema.safeParse(validPayload({ status: "idle" })).success).toBe(true);
    });

    it("accepts without title and detail (optional)", () => {
      const p = {
        v: 1,
        ts: 123,
        sessionID: "ses",
        project: "proj",
        agent: "a1",
        kind: "tool.before",
        status: "working",
      };
      expect(ingestPayloadSchema.safeParse(p).success).toBe(true);
    });

    it("accepts detail with only prompt", () => {
      const p = validPayload({ detail: { prompt: "hello" } });
      expect(ingestPayloadSchema.safeParse(p).success).toBe(true);
    });

    it("accepts detail with only tool", () => {
      const p = validPayload({ detail: { tool: "bash" } });
      expect(ingestPayloadSchema.safeParse(p).success).toBe(true);
    });

    it("accepts detail with todos array", () => {
      const p = validPayload({
        detail: { todos: [{ content: "a", status: "in_progress" }, { text: "b", state: "pending" }] },
      });
      expect(ingestPayloadSchema.safeParse(p).success).toBe(true);
    });

    it("allows passthrough extra fields in detail", () => {
      const p = validPayload({ detail: { prompt: "hi", unknownField: "extra", another: 123 } });
      const res = ingestPayloadSchema.safeParse(p);
      expect(res.success).toBe(true);
      if (res.success) {
        // passthrough should preserve unknown fields
        expect((res.data.detail as Record<string, unknown>).unknownField).toBe("extra");
      }
    });

    it("allows passthrough extra fields in todo", () => {
      const p = validPayload({ detail: { todos: [{ content: "x", status: "pending", custom: "field" }] } });
      const res = ingestPayloadSchema.safeParse(p);
      expect(res.success).toBe(true);
      if (res.success) {
        expect((res.data.detail!.todos![0] as Record<string, unknown>).custom).toBe("field");
      }
    });

    it("accepts title up to 200 chars", () => {
      const title = "t".repeat(200);
      expect(ingestPayloadSchema.safeParse(validPayload({ title })).success).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // invalid — missing fields
  // -----------------------------------------------------------------------
  describe("invalid payloads — missing fields", () => {
    it("rejects missing sessionID", () => {
      const p = validPayload();
      // @ts-expect-error delete for test
      delete p.sessionID;
      expect(ingestPayloadSchema.safeParse(p).success).toBe(false);
    });

    it("rejects empty sessionID", () => {
      expect(ingestPayloadSchema.safeParse(validPayload({ sessionID: "" })).success).toBe(false);
    });

    it("rejects missing project", () => {
      const p = validPayload();
      // @ts-expect-error delete missing project — runtime negative test
      delete (p as Record<string, unknown>).project;
      expect(ingestPayloadSchema.safeParse(p).success).toBe(false);
    });

    it("rejects empty project", () => {
      expect(ingestPayloadSchema.safeParse(validPayload({ project: "" })).success).toBe(false);
    });

    it("rejects missing agent", () => {
      const p = validPayload();
      // @ts-expect-error delete missing agent — runtime negative test
      delete (p as Record<string, unknown>).agent;
      expect(ingestPayloadSchema.safeParse(p).success).toBe(false);
    });

    it("rejects empty agent", () => {
      expect(ingestPayloadSchema.safeParse(validPayload({ agent: "" })).success).toBe(false);
    });

    it("rejects missing kind", () => {
      const p = validPayload();
      // @ts-expect-error delete missing kind — runtime negative test
      delete (p as Record<string, unknown>).kind;
      expect(ingestPayloadSchema.safeParse(p).success).toBe(false);
    });

    it("rejects invalid kind enum", () => {
      expect(ingestPayloadSchema.safeParse(validPayload({ kind: "invalid.kind" })).success).toBe(false);
    });

    it("rejects missing status", () => {
      const p = validPayload();
      // @ts-expect-error delete missing status — runtime negative test
      delete (p as Record<string, unknown>).status;
      expect(ingestPayloadSchema.safeParse(p).success).toBe(false);
    });

    it("rejects invalid status enum", () => {
      expect(ingestPayloadSchema.safeParse(validPayload({ status: "busy" })).success).toBe(false);
    });

    it("rejects v != 1", () => {
      expect(ingestPayloadSchema.safeParse(validPayload({ v: 2 })).success).toBe(false);
      expect(ingestPayloadSchema.safeParse(validPayload({ v: 0 })).success).toBe(false);
      expect(ingestPayloadSchema.safeParse(validPayload({ v: "1" })).success).toBe(false);
    });

    it("rejects negative ts", () => {
      expect(ingestPayloadSchema.safeParse(validPayload({ ts: -1 })).success).toBe(false);
    });

    it("rejects non-integer ts", () => {
      expect(ingestPayloadSchema.safeParse(validPayload({ ts: 1.5 })).success).toBe(false);
    });

    it("rejects missing ts", () => {
      const p = validPayload();
      // @ts-expect-error delete missing ts — runtime negative test
      delete (p as Record<string, unknown>).ts;
      expect(ingestPayloadSchema.safeParse(p).success).toBe(false);
    });

    it("rejects title >200 chars", () => {
      expect(ingestPayloadSchema.safeParse(validPayload({ title: "x".repeat(201) })).success).toBe(false);
    });

    it("rejects wrong types for sessionID", () => {
      expect(ingestPayloadSchema.safeParse(validPayload({ sessionID: 123 as unknown as string })).success).toBe(false);
    });

    it("issues include path and message for invalid payload", () => {
      const res = ingestPayloadSchema.safeParse(validPayload({ sessionID: "" }));
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues.length).toBeGreaterThan(0);
        expect(res.error.issues[0].path).toContain("sessionID");
      }
    });
  });

  // -----------------------------------------------------------------------
  // prompt trimming 200 behavior (zod transform)
  // -----------------------------------------------------------------------
  describe("prompt trimming 200 via zod transform", () => {
    it("trims whitespace via schema transform", () => {
      const p = validPayload({ detail: { prompt: "  hello  " } });
      const res = ingestPayloadSchema.safeParse(p);
      expect(res.success).toBe(true);
      if (res.success) expect(res.data.detail!.prompt).toBe("hello");
    });

    it("slices to 200 chars after trim", () => {
      const long = "a".repeat(500);
      const res = ingestPayloadSchema.safeParse(validPayload({ detail: { prompt: long } }));
      expect(res.success).toBe(true);
      if (res.success) expect(res.data.detail!.prompt!.length).toBe(200);
    });

    it("trims then slices: spaces + long string", () => {
      const val = "   " + "b".repeat(300) + "   ";
      const res = ingestPayloadSchema.safeParse(validPayload({ detail: { prompt: val } }));
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.detail!.prompt).toBe("b".repeat(200));
      }
    });

    it("keeps prompt under 200 unchanged (after trim)", () => {
      const short = "short prompt";
      const res = ingestPayloadSchema.safeParse(validPayload({ detail: { prompt: short } }));
      expect(res.success).toBe(true);
      if (res.success) expect(res.data.detail!.prompt).toBe("short prompt");
    });

    it("handles undefined prompt as optional (no error, undefined)", () => {
      const p = validPayload({ detail: {} });
      const res = ingestPayloadSchema.safeParse(p);
      expect(res.success).toBe(true);
      if (res.success) expect(res.data.detail!.prompt).toBeUndefined();
    });

    it("exposes normalizePrompt helper consistent with schema", () => {
      expect(normalizePrompt("  hello  ")).toBe("hello");
      expect(normalizePrompt("a".repeat(500))!.length).toBe(200);
      expect(normalizePrompt(undefined)).toBeUndefined();
      expect(normalizePrompt("   ")).toBe("");
    });

    it("long prompt 200 exactly not truncated", () => {
      const exact = "x".repeat(200);
      const res = ingestPayloadSchema.safeParse(validPayload({ detail: { prompt: exact } }));
      expect(res.success).toBe(true);
      if (res.success) expect(res.data.detail!.prompt!.length).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // todos edge
  // -----------------------------------------------------------------------
  describe("todos schema", () => {
    it("accepts empty todos array", () => {
      expect(ingestPayloadSchema.safeParse(validPayload({ detail: { todos: [] } })).success).toBe(true);
    });

    it("accepts todos with alternative field names", () => {
      const todos = [{ text: "alt", state: "in_progress", priority: "high", activeForm: "Doing" }];
      expect(ingestPayloadSchema.safeParse(validPayload({ detail: { todos } })).success).toBe(true);
    });

    it("rejects todos if not array", () => {
      expect(ingestPayloadSchema.safeParse(validPayload({ detail: { todos: "not-array" as unknown as [] } })).success).toBe(false);
    });

    it("todoSchema accepts flexible shapes", () => {
      expect(todoSchema.safeParse({ content: "hi" }).success).toBe(true);
      expect(todoSchema.safeParse({ text: "hi", state: "pending" }).success).toBe(true);
      expect(todoSchema.safeParse({}).success).toBe(true); // all optional
      expect(todoSchema.safeParse({ content: 123 }).success).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // additional invalid json / type edge — simulate route 400 cases
  // -----------------------------------------------------------------------
  describe("edge — simulate bad payloads (route 400 cases)", () => {
    it("rejects null payload", () => {
      expect(ingestPayloadSchema.safeParse(null).success).toBe(false);
    });

    it("rejects undefined payload", () => {
      expect(ingestPayloadSchema.safeParse(undefined).success).toBe(false);
    });

    it("rejects empty object", () => {
      expect(ingestPayloadSchema.safeParse({}).success).toBe(false);
    });

    it("rejects extra top-level missing required but with extra fields", () => {
      const p = { v: 1, ts: 1000, extra: "field" };
      expect(ingestPayloadSchema.safeParse(p).success).toBe(false);
    });

    it("rejects malformed agent type (number)", () => {
      expect(ingestPayloadSchema.safeParse(validPayload({ agent: 123 as unknown as string })).success).toBe(false);
    });

    it("rejects malformed kind wrong case", () => {
      expect(ingestPayloadSchema.safeParse(validPayload({ kind: "Subtask.Start" as unknown as string })).success).toBe(false);
    });

    it("detail as null should fail (expects object)", () => {
      // @ts-expect-error detail null — runtime negative test for zod
      expect(ingestPayloadSchema.safeParse(validPayload({ detail: null as unknown as { prompt: string } })).success).toBe(false);
    });
  });
});
