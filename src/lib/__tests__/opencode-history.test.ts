import { describe, expect, it } from "vitest";
import { createOpenCodeDiscoveryService, openCodeHistoryProfile } from "../opencode-discovery.server";
import { openCodeHistorySchema } from "../opencode-discovery";

const SECRET = "eNz9v7Xk_2HGm5FwJb6Ds0TqLh3Vr8CaUo1Pi4YxZsA";
const ORIGIN = "http://127.0.0.1:3011";
const DIRECTORY = "C:\\approved\\workspace";
const RECORD = { id: "ses_parent", projectID: "prj_one", title: "Saved work", location: { directory: DIRECTORY }, time: { created: 1, updated: 10 } };

function message(id: string, time: number, role: "user" | "assistant" = "assistant", text = "Saved answer") {
  return { info: { id, sessionID: "ses_parent", role, time: { created: time } }, parts: [{ id: `prt_${id}`, messageID: id, sessionID: "ses_parent", type: "text", text }] };
}

function appRequest({ method = "GET", cookie, session = "ses_parent", cursor, body, headers = {}, history = true, query = "", signal }: {
  method?: string; cookie?: string; session?: string; cursor?: string; body?: string; headers?: Record<string, string>; history?: boolean; query?: string; signal?: AbortSignal;
} = {}) {
  return new Request(`${ORIGIN}/api/opencode-discovery${history ? "/history" : ""}${query}`, { method, body, signal, headers: {
    host: "127.0.0.1:3011", origin: ORIGIN, "sec-fetch-site": "same-origin", "sec-fetch-mode": "cors", "sec-fetch-dest": "empty", "x-pixel-discovery": "1",
    ...(cookie ? { cookie } : {}), ...(history ? { "x-pixel-history-session": session } : {}), ...(cursor ? { "x-pixel-history-cursor": cursor } : {}), ...(body ? { "content-type": "application/json" } : {}), ...headers,
  } });
}

function fixture(deadlineMs = 8000) {
  const env: NodeJS.ProcessEnv = { PIXEL_DISCOVERY_ORIGIN: ORIGIN, PIXEL_DISCOVERY_ACCESS_SECRET: SECRET, PIXEL_OPENCODE_URL: "http://127.0.0.1:4098", PIXEL_OPENCODE_DIRECTORY: DIRECTORY, PIXEL_OPENCODE_PASSWORD: "synthetic-provider-password" };
  env.PIXEL_OPENCODE_HISTORY_PROFILE = openCodeHistoryProfile(env) ?? undefined;
  const calls: string[] = [];
  let now = 1_000_000;
  let lists = 0;
  let metadata = 0;
  const data: { records: typeof RECORD[]; messages: ReturnType<typeof message>[]; rawMessages: unknown; next: string | null; moveAfter: boolean; dropAfter: boolean; badJSON: boolean; large: boolean; expireAfter: boolean; changeConfig: boolean; pause: Promise<void> | null } = {
    records: [RECORD], messages: [message("msg_2", 2)], rawMessages: undefined, next: null,
    moveAfter: false, dropAfter: false, badJSON: false, large: false, expireAfter: false, changeConfig: false, pause: null,
  };
  const providerFetch: typeof fetch = async input => {
    const url = new URL(String(input));
    calls.push(url.pathname + url.search);
    let body: unknown;
    if (url.pathname === "/global/health") { if (data.pause) await data.pause; body = { healthy: true, version: "1.18.35" }; }
    else if (url.pathname === "/api/session") {
      lists++;
      body = { data: data.dropAfter && lists % 2 === 0 ? [] : data.records, cursor: {} };
    } else if (url.pathname === "/session/ses_parent") {
      metadata++;
      body = { id: "ses_parent", projectID: "prj_one", directory: data.moveAfter && metadata % 2 === 0 ? "C:\\outside" : DIRECTORY, time: { created: 1, updated: 10 } };
    } else if (url.pathname === "/session/ses_parent/message") {
      if (data.expireAfter) now += 1_000_000;
      if (data.changeConfig) env.PIXEL_OPENCODE_PASSWORD = "changed-private-credential";
      if (data.badJSON) return new Response("{bad json", { headers: { "content-type": "application/json" } });
      if (data.large) return new Response(JSON.stringify("x".repeat(270000)), { headers: { "content-type": "application/json" } });
      body = data.rawMessages ?? data.messages;
    } else return new Response("{}", { status: 404, headers: { "content-type": "application/json" } });
    return new Response(JSON.stringify(body), { headers: { "content-type": "application/json", ...(data.next && url.pathname.endsWith("/message") ? { "x-next-cursor": data.next, link: '<http://192.168.0.1/private>; rel="next"' } : {}) } });
  };
  const service = createOpenCodeDiscoveryService({ env: () => env, fetch: providerFetch, now: () => now, deadlineMs });
  async function unlock() {
    const response = await service.handle(appRequest({ history: false, method: "POST", body: JSON.stringify({ secret: SECRET }) }));
    expect(response.status).toBe(204);
    const cookie = response.headers.get("set-cookie");
    if (!cookie) throw new Error("Missing cookie");
    expect(calls).toEqual([]);
    return cookie.split(";")[0];
  }
  async function read(cookie: string, options: { cursor?: string; session?: string; headers?: Record<string, string>; query?: string } = {}) {
    const response = await service.handle(appRequest({ cookie, ...options }));
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    return openCodeHistorySchema.parse(await response.json());
  }
  return { service, unlock, read, data, env, calls, advance: (amount: number) => { now += amount; } };
}

describe("bounded recorded OpenCode history", () => {
  it("returns scoped literal recorded text and only six named GET reads", async () => {
    const f = fixture(); const cookie = await f.unlock(); const result = await f.read(cookie);
    if (result.kind !== "history-page") throw new Error("Expected page");
    expect(result.messages).toEqual([{ id: "msg_2", sessionID: "ses_parent", role: "assistant", time: { created: 2, completed: null }, agent: null,
      parts: [{ id: "prt_msg_2", sessionID: "ses_parent", messageID: "msg_2", kind: "text", content: { text: "Saved answer", redacted: false, truncated: false }, synthetic: false, ignored: false }], omittedParts: 0 }]);
    expect(result.olderCursor).toBeNull(); expect(result.limit).toBe(5); expect(result.order).toBe("chronological"); expect(result.expires).toBe(1_300_000);
    expect(f.calls).toEqual(["/global/health", "/api/session?directory=C%3A%5Capproved%5Cworkspace&limit=50&order=desc", "/session/ses_parent?directory=C%3A%5Capproved%5Cworkspace", "/session/ses_parent/message?directory=C%3A%5Capproved%5Cworkspace&limit=5", "/session/ses_parent?directory=C%3A%5Capproved%5Cworkspace", "/api/session?directory=C%3A%5Capproved%5Cworkspace&limit=50&order=desc"]);
    for (const forbidden of [SECRET, "synthetic-provider-password", DIRECTORY, "cost", "tokens"]) expect(JSON.stringify(result).includes(forbidden)).toBe(false);
  });

  it("uses authenticated encrypted continuation for an older replacement page", async () => {
    const f = fixture(); const cookie = await f.unlock();
    f.data.messages = [message("msg_2", 2, "user", "Saved question"), message("msg_3", 3)];
    const native = Buffer.from(JSON.stringify({ id: "msg_2", time: 2 })).toString("base64url"); f.data.next = native;
    const latest = await f.read(cookie);
    if (latest.kind !== "history-page" || !latest.olderCursor) throw new Error("Expected continuation");
    expect(latest.olderCursor.includes(native)).toBe(false); expect(latest.olderCursor.includes("ses_parent")).toBe(false);
    f.data.messages = [message("msg_1", 1, "user", "Older question")]; f.data.next = null;
    const older = await f.read(cookie, { cursor: latest.olderCursor });
    if (older.kind !== "history-page") throw new Error("Expected older page");
    expect(older.messages.map(item => item.id)).toEqual(["msg_1"]); expect(older.olderCursor).toBeNull();
    expect(f.calls.some(value => value.includes(`before=${native}`))).toBe(true);
    expect(f.calls.some(value => value.includes("192.168.0.1") || value.includes("/api/session/ses_parent/message"))).toBe(false);
  });

  it("rejects missing or changed connection enrollment while leaving metadata available", async () => {
    const f = fixture(); const cookie = await f.unlock(); delete f.env.PIXEL_OPENCODE_HISTORY_PROFILE;
    expect((await f.read(cookie)).kind).toBe("unsupported-profile"); expect(f.calls).toEqual([]);
    f.env.PIXEL_OPENCODE_HISTORY_PROFILE = "a".repeat(64); expect((await f.read(cookie)).kind).toBe("unsupported-profile");
    const response = await f.service.handle(appRequest({ history: false, cookie })); expect((await response.json()).kind).toBe("snapshot");
  });

  it.each(["missing", "foreign-origin", "query", "missing-session"])('denies %s without a provider history read', async mode => {
    const f = fixture(); const cookie = await f.unlock();
    const result = await f.read(mode === "missing" ? "pixel-discovery=forged" : cookie, {
      ...(mode === "foreign-origin" ? { headers: { origin: "http://127.0.0.1:9999" } } : {}),
      ...(mode === "query" ? { query: "?directory=C:\\outside" } : {}), ...(mode === "missing-session" ? { session: "" } : {}),
    });
    expect(result.kind === "history-page").toBe(false); expect(f.calls).toEqual([]);
  });

  it("refuses unknown selection before any legacy location bootstrap", async () => {
    const f = fixture(); const cookie = await f.unlock(); const result = await f.read(cookie, { session: "ses_foreign" });
    expect(result.kind === "failure" && result.problem.code).toBe("selection-unavailable");
    expect(f.calls.some(value => value.startsWith("/session/"))).toBe(false);
  });

  it.each([".", ".."])("refuses URL dot-segment selection %s before any provider read", async session => {
    const f = fixture(); const cookie = await f.unlock();
    const result = await f.read(cookie, { session });
    expect(result.kind === "failure" && result.problem.code).toBe("selection-unavailable"); expect(f.calls).toEqual([]);
  });

  it.each(["move", "disappear"])('discards content after scope %s', async mode => {
    const f = fixture(); const cookie = await f.unlock(); f.data.moveAfter = mode === "move"; f.data.dropAfter = mode === "disappear";
    const result = await f.read(cookie); expect(result.kind === "failure" && result.problem.code).toBe("scope-changed"); expect(JSON.stringify(result).includes("Saved answer")).toBe(false);
  });

  it("rejects swapped message bindings including omitted content", async () => {
    const f = fixture(); const cookie = await f.unlock(); f.data.messages[0].parts[0].sessionID = "ses_foreign";
    expect((await f.read(cookie)).kind).toBe("failure");
  });

  it("redacts complete secret before clipping and preserves inert text", async () => {
    const f = fixture(); const cookie = await f.unlock();
    f.data.messages[0].parts[0].text = "<img src=x onerror=alert(1)> " + "x".repeat(4060) + SECRET + " tail";
    const result = await f.read(cookie); if (result.kind !== "history-page") throw new Error("Expected page");
    const part = result.messages[0].parts[0]; if (part.kind !== "text") throw new Error("Expected text");
    expect(part.content.text.startsWith("<img src=x onerror=alert(1)>")).toBe(true); expect(part.content.redacted).toBe(true); expect(part.content.truncated).toBe(true);
    expect(part.content.text.includes(SECRET.slice(0, 8))).toBe(false); expect(Buffer.byteLength(part.content.text)).toBeLessThanOrEqual(4096);
  });

  it("shows explicit empty legacy page without claiming absent conversation", async () => {
    const f = fixture(); const cookie = await f.unlock(); f.data.messages = [];
    const result = await f.read(cookie); if (result.kind !== "history-page") throw new Error("Expected page"); expect(result.messages).toEqual([]); expect(result.olderCursor).toBeNull();
  });

  it.each(["json", "bytes", "expiry"])('fails safely on %s and releases admission', async mode => {
    const f = fixture(); const cookie = await f.unlock(); f.data.badJSON = mode === "json"; f.data.large = mode === "bytes"; f.data.expireAfter = mode === "expiry";
    const result = await f.read(cookie); expect(result.kind).toBe("failure");
    expect(JSON.stringify(result).includes("Saved answer")).toBe(false);
    if (result.kind === "failure") expect(result.problem.code).toBe(mode === "json" ? "malformed" : mode === "bytes" ? "limit-exceeded" : "expired");
  });

  it("rejects tampered, raw, other-session and other-owner continuations before provider contact", async () => {
    const f = fixture(); const cookie = await f.unlock(); const native = Buffer.from(JSON.stringify({ id: "msg_2", time: 2 })).toString("base64url"); f.data.next = native;
    const result = await f.read(cookie); if (result.kind !== "history-page" || !result.olderCursor) throw new Error("Expected cursor");
    for (const options of [{ cursor: native }, { cursor: result.olderCursor + "x" }, { cursor: result.olderCursor, session: "ses_other" }]) {
      const before = f.calls.length; const rejected = await f.read(cookie, options); expect(rejected.kind === "failure" && rejected.problem.code).toBe("invalid-cursor"); expect(f.calls.length).toBe(before);
    }
    f.calls.length = 0; const another = await f.unlock(); const rejected = await f.read(another, { cursor: result.olderCursor });
    expect(rejected.kind === "failure" && rejected.problem.code).toBe("invalid-cursor"); expect(f.calls).toEqual([]);
  });

  it("projects recorded tool states and credential-redacted arguments/output with inert omissions", async () => {
    const f = fixture(); const cookie = await f.unlock();
    const binding = { sessionID: "ses_parent", messageID: "msg_2" };
    f.data.rawMessages = [{ info: { id: "msg_2", sessionID: "ses_parent", role: "assistant", agent: "build", time: { created: 2, completed: 8 } }, parts: [
      { ...binding, id: "prt_completed", type: "tool", tool: "read", state: { status: "completed", input: { password: "arbitrary-sensitive", query: "ok" }, output: `Bearer ${SECRET}`, time: { start: 3, end: 4 } } },
      { ...binding, id: "prt_running", type: "tool", tool: "task", state: { status: "running", input: { subagent_type: "architect" }, time: { start: 5 } } },
      { ...binding, id: "prt_error", type: "tool", tool: "shell", state: { status: "error", input: { command: "read-only recorded input" }, error: "PRIVATE ERROR STACK", time: { start: 5, end: 6 } } },
      { ...binding, id: "prt_reasoning", type: "reasoning", text: "PRIVATE REASONING" },
      { ...binding, id: "prt_file", type: "file", url: "https://example.invalid/private", filename: "private-name" },
    ] }];
    const result = await f.read(cookie); if (result.kind !== "history-page") throw new Error("Expected page");
    const parts = result.messages[0].parts;
    expect(result.messages[0].agent).toEqual({ text: "build", redacted: false, truncated: false });
    expect(parts[0].kind === "recorded-tool" && parts[0].input.text).toBe('{"password":"[REDACTED]","query":"ok"}');
    expect(parts[0].kind === "recorded-tool" && parts[0].output?.text).toBe("Bearer [REDACTED]");
    expect(parts[1].kind === "recorded-tool" && parts[1].status).toBe("running");
    expect(parts[2].kind === "recorded-tool" && parts[2].output).toBeNull();
    expect(parts[3].kind === "omitted" && parts[3].reason).toBe("reasoning");
    expect(parts[4].kind === "omitted" && parts[4].reason).toBe("file");
    for (const secret of [SECRET, "PRIVATE ERROR STACK", "PRIVATE REASONING", "private-name", "example.invalid"]) expect(JSON.stringify(result).includes(secret)).toBe(false);
  });

  it("bounds UTF-8 content, part count across page and full serialized DTO", async () => {
    const f = fixture(); const cookie = await f.unlock();
    f.data.rawMessages = Array.from({ length: 5 }, (_, index) => ({ info: { id: `msg_${String(index + 1).padStart(2, "0")}`, sessionID: "ses_parent", role: "user", time: { created: index + 1 } }, parts: Array.from({ length: 12 }, (_, part) => ({ id: `prt_${index}_${part}`, sessionID: "ses_parent", messageID: `msg_${String(index + 1).padStart(2, "0")}`, type: "text", text: "界".repeat(1300) })) }));
    const result = await f.read(cookie); if (result.kind !== "history-page") throw new Error("Expected page");
    expect(result.messages).toHaveLength(5); expect(result.truncated).toBe(true);
    expect(result.messages.reduce((total, item) => total + item.parts.length, 0)).toBeLessThanOrEqual(50);
    expect(Buffer.byteLength(JSON.stringify(result), "utf8")).toBeLessThanOrEqual(65536);
    expect(result.omittedParts).toBeGreaterThan(0);
  });

  it("validates hidden parts before the part-count clipping boundary", async () => {
    const f = fixture(); const cookie = await f.unlock();
    f.data.rawMessages = [{ info: { id: "msg_2", sessionID: "ses_parent", role: "assistant", time: { created: 2 } }, parts: Array.from({ length: 51 }, (_, index) => ({ id: `prt_${index}`, sessionID: index === 50 ? "ses_foreign" : "ses_parent", messageID: "msg_2", type: "reasoning" })) }];
    const result = await f.read(cookie); expect(result.kind === "failure" && result.problem.code).toBe("malformed");
  });

  it("refuses a native cursor that points past the returned page boundary", async () => {
    const f = fixture(); const cookie = await f.unlock();
    f.data.next = Buffer.from(JSON.stringify({ id: "msg_9", time: 9 })).toString("base64url");
    const result = await f.read(cookie); expect(result.kind === "failure" && result.problem.code).toBe("malformed");
  });

  it("rejects expired continuation before provider contact while owner cookie remains valid", async () => {
    const f = fixture(); const cookie = await f.unlock(); f.data.next = Buffer.from(JSON.stringify({ id: "msg_2", time: 2 })).toString("base64url");
    const page = await f.read(cookie); if (page.kind !== "history-page" || !page.olderCursor) throw new Error("Expected cursor");
    f.advance(300001); const count = f.calls.length;
    const result = await f.read(cookie, { cursor: page.olderCursor });
    expect(result.kind === "failure" && result.problem.code).toBe("expired"); expect(f.calls).toHaveLength(count);
    expect((await f.read(cookie)).kind).toBe("history-page");
  });

  it("discards completed page when private connection config changes during read", async () => {
    const f = fixture(); const cookie = await f.unlock(); f.data.changeConfig = true;
    const result = await f.read(cookie); expect(result.kind === "failure" && result.problem.code).toBe("scope-changed");
    expect(JSON.stringify(result).includes("Saved answer")).toBe(false);
  });

  it("shares two read slots between metadata and history and frees both after completion", async () => {
    const f = fixture(); const cookie = await f.unlock(); let release = () => {};
    f.data.pause = new Promise<void>(resolve => { release = resolve; });
    const metadata = f.service.handle(appRequest({ history: false, cookie }));
    const history = f.read(cookie);
    const busy = await f.read(cookie); expect(busy.kind === "failure" && busy.problem.code).toBe("busy");
    const busyMetadata = await f.service.handle(appRequest({ history: false, cookie }));
    expect(await busyMetadata.json()).toMatchObject({ kind: "health-failure", problem: { code: "busy" } });
    expect(f.calls).toEqual(["/global/health", "/global/health"]);
    f.data.pause = null; release(); expect((await history).kind).toBe("history-page"); expect((await metadata).status).toBe(200);
    expect((await f.read(cookie)).kind).toBe("history-page");
  });

  it.each(["POST", "PUT", "HEAD", "DELETE"])("refuses history %s before provider contact", async method => {
    const f = fixture(); const cookie = await f.unlock();
    expect((await f.service.handle(appRequest({ method, cookie }))).status).toBe(401); expect(f.calls).toEqual([]);
  });

  it("rejects repeated or reordered native messages instead of returning a non-progressing page", async () => {
    const f = fixture(); const cookie = await f.unlock();
    for (const messages of [[message("msg_2", 2), message("msg_2", 2)], [message("msg_3", 3), message("msg_2", 2)]]) {
      f.data.messages = messages; const result = await f.read(cookie); expect(result.kind === "failure" && result.problem.code).toBe("malformed");
    }
  });

  it.each(["abort", "deadline"])("releases history read admission after %s", async mode => {
    const f = fixture(50); const cookie = await f.unlock(); let release = () => {};
    f.data.pause = new Promise<void>(resolve => { release = resolve; });
    const controller = new AbortController();
    const pending = f.service.handle(appRequest({ cookie, signal: controller.signal }));
    if (mode === "abort") controller.abort();
    const result = openCodeHistorySchema.parse(await (await pending).json());
    expect(result.kind === "failure" && result.problem.code).toBe("unreachable");
    f.data.pause = null; release(); expect((await f.read(cookie)).kind).toBe("history-page");
  });

  it.each(["project", "workspace"])("refuses %s scope swap on an authenticated continuation before legacy reads", async mode => {
    const f = fixture(); const cookie = await f.unlock(); f.data.next = Buffer.from(JSON.stringify({ id: "msg_2", time: 2 })).toString("base64url");
    const page = await f.read(cookie); if (page.kind !== "history-page" || !page.olderCursor) throw new Error("Expected cursor");
    f.data.records = [{ ...RECORD, projectID: mode === "project" ? "prj_other" : RECORD.projectID, location: mode === "workspace" ? Object.assign({}, RECORD.location, { workspaceID: "wrk_other" }) : RECORD.location }];
    const count = f.calls.length; const result = await f.read(cookie, { cursor: page.olderCursor });
    expect(result.kind === "failure" && result.problem.code).toBe("invalid-cursor");
    expect(f.calls.slice(count)).toEqual(["/global/health", "/api/session?directory=C%3A%5Capproved%5Cworkspace&limit=50&order=desc"]);
  });
});
