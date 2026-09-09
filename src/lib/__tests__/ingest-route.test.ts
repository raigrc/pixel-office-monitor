import { describe, it, expect, beforeEach } from "vitest";
import { _clearStore, getState } from "../monitor-store";

// NOTE: We import the route handler directly. Next.js 16 route exports POST/GET.
// To avoid ESM alias issues we use relative path via vitest alias alias @ => src.
import { POST, GET } from "../../app/api/ingest/route";
import { NextRequest } from "next/server";

// Helper to create a NextRequest with JSON body and headers
function mockRequest(body: unknown, headers: Record<string, string> = {}, method = "POST") {
  const url = "http://localhost:3001/api/ingest";
  // For invalid json case, we need to override json() to throw. Simulate by passing raw invalid string?
  // NextRequest.json() parses body; if body is string "invalid-json", we can create request with that string.
  // Simpler: handle two modes — if body === "__INVALID_JSON__" then create request with malformed JSON.
  if (body === "__INVALID_JSON__") {
    return new NextRequest(url, {
      method,
      headers: { "content-type": "application/json", ...headers },
      body: "not-json{{{",
    });
  }
  return new NextRequest(url, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    v: 1,
    ts: Date.now(),
    sessionID: "ses_route_test",
    project: "pixel-office-monitor",
    agent: "senior-engineer",
    kind: "subtask.start",
    status: "working",
    detail: { prompt: "hello" },
    ...overrides,
  };
}

describe("POST /api/ingest — 401/400/200", () => {
  beforeEach(() => {
    _clearStore();
    // Ensure token env is dev-token for tests (route falls back to dev-token)
    process.env.MONITOR_TOKEN = "dev-token";
    delete process.env.PIXEL_MONITOR_TOKEN;
  });

  it("returns 401 without token", async () => {
    const req = mockRequest(validPayload(), {});
    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error).toBe("unauthorized");
  });

  it("returns 401 with bad token", async () => {
    const req = mockRequest(validPayload(), { "x-monitor-token": "bad-token" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("accepts x-monitor-token header (valid)", async () => {
    const req = mockRequest(validPayload(), { "x-monitor-token": "dev-token" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it("accepts x-token header (legacy)", async () => {
    const req = mockRequest(validPayload(), { "x-token": "dev-token" });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("accepts Authorization Bearer", async () => {
    const req = mockRequest(validPayload(), { authorization: "Bearer dev-token" });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("accepts Authorization Bearer case-insensitive", async () => {
    const req = mockRequest(validPayload(), { authorization: "bearer dev-token" });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("accepts Authorization raw token without Bearer", async () => {
    const req = mockRequest(validPayload(), { authorization: "dev-token" });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("returns 400 on invalid json", async () => {
    const req = mockRequest("__INVALID_JSON__", { "x-monitor-token": "dev-token" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("invalid json");
  });

  it("returns 400 on missing required fields (invalid payload)", async () => {
    const bad = { v: 1, ts: Date.now() }; // missing sessionID, project, etc.
    const req = mockRequest(bad, { "x-monitor-token": "dev-token" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error).toBe("invalid payload");
    expect(json.issues).toBeDefined();
    expect(Array.isArray(json.issues)).toBe(true);
  });

  it("returns 400 on bad kind enum", async () => {
    const p = validPayload({ kind: "not.a.kind" });
    const req = mockRequest(p, { "x-monitor-token": "dev-token" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 200 on good payload and persists floor", async () => {
    const p = validPayload({ sessionID: "ses_ingest_200", agent: "explore" });
    const req = mockRequest(p, { "x-monitor-token": "dev-token" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const state = getState();
    expect(state.floors.some((f) => f.sessionID === "ses_ingest_200")).toBe(true);
  });

  it("trims long prompt via zod to 200 and stores", async () => {
    const long = "a".repeat(500);
    const p = validPayload({ detail: { prompt: long } });
    const req = mockRequest(p, { "x-monitor-token": "dev-token" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const cub = getState().floors[0].cubicles[0];
    expect(cub.prompt!.length).toBe(200);
  });

  it("handles duplicate webhook idempotently — second 200 does not duplicate floor", async () => {
    const p = validPayload({ sessionID: "ses_dup_route", ts: 12345 });
    const req1 = mockRequest(p, { "x-monitor-token": "dev-token" });
    const req2 = mockRequest(p, { "x-monitor-token": "dev-token" });
    expect((await POST(req1)).status).toBe(200);
    expect((await POST(req2)).status).toBe(200);
    const state = getState();
    const matches = state.floors.filter((f) => f.sessionID === "ses_dup_route");
    expect(matches).toHaveLength(1);
    expect(matches[0].cubicles).toHaveLength(1);
  });

  it("handles 20/sec burst without crash (all 200)", async () => {
    const base = Date.now();
    const results: number[] = [];
    for (let i = 0; i < 20; i++) {
      const p = validPayload({ sessionID: "ses_burst", agent: "qa-engineer", ts: base + i, detail: { prompt: `p${i}` } });
      const req = mockRequest(p, { "x-monitor-token": "dev-token" });
      const res = await POST(req);
      results.push(res.status);
    }
    expect(results.every((s) => s === 200)).toBe(true);
    const floor = getState().floors.find((f) => f.sessionID === "ses_burst")!;
    expect(floor).toBeDefined();
  });

  it("returns 405 on GET", async () => {
    const res = await GET();
    expect(res.status).toBe(405);
  });

  it("rejects empty sessionID via 400", async () => {
    const p = validPayload({ sessionID: "" });
    const req = mockRequest(p, { "x-monitor-token": "dev-token" });
    expect((await POST(req)).status).toBe(400);
  });
});
