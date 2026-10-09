import { createHmac } from "node:crypto";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOpenCodeDiscoveryService } from "../opencode-discovery.server";
import { discoveryStatusText, openCodeDiscoverySchema } from "../opencode-discovery";

const SECRET = "eNz9v7Xk_2HGm5FwJb6Ds0TqLh3Vr8CaUo1Pi4YxZsA";
const ORIGIN = "http://127.0.0.1:3011";
const DIRECTORY = "C:\\approved\\workspace";
const connection = { provider: "opencode", connectionID: "configured-opencode", directoryDisplay: "Configured workspace" };
const healthy = { kind: "healthy", version: "1.18.35" };
const appDenied = { kind: "auth-failure", scope: "app", message: "Discovery access denied. Use the configured app origin and unlock with the independent discovery secret." };

function wireRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "ses_parent", projectID: "prj_one", title: "Parent title", location: { directory: DIRECTORY, workspaceID: "wrk_one" },
    time: { created: 1000, updated: 1200 }, agent: "private-agent", model: "private-model", cost: 123, tokens: { input: 400 },
    ...overrides,
  };
}

function appRequest({ method = "GET", cookie, headers = {}, query = "", body }: {
  method?: string; cookie?: string; headers?: Record<string, string | undefined>; query?: string; body?: string;
} = {}) {
  const requestHeaders = new Headers({
    host: "127.0.0.1:3011", origin: ORIGIN,
    "sec-fetch-site": "same-origin", "sec-fetch-mode": "cors", "sec-fetch-dest": "empty", "x-pixel-discovery": "1",
    ...(cookie ? { cookie } : {}), ...(body ? { "content-type": "application/json" } : {}),
  });
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) requestHeaders.delete(key);
    else requestHeaders.set(key, value);
  }
  return new Request(`${ORIGIN}/api/opencode-discovery${query}`, {
    method,
    headers: requestHeaders,
    body,
  });
}

function signedCookie(payload: unknown) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `pixel-discovery=${encoded}.${createHmac("sha256", SECRET).update(encoded).digest("base64url")}`;
}

let server: Server;
let env: NodeJS.ProcessEnv;
let requests: { method: string | undefined; url: string | undefined; authorization: string | undefined }[];
let healthBody: unknown;
let listBody: unknown;
let healthStatus: number;
let listStatus: number;
let redirect: boolean;
let malformed: boolean;

beforeEach(async () => {
  requests = [];
  healthBody = { healthy: true, version: "1.18.35" };
  listBody = { data: [wireRecord()], cursor: { previous: "private-previous", next: "private-next" } };
  healthStatus = listStatus = 200;
  redirect = malformed = false;
  server = createServer((request, response) => {
    requests.push({ method: request.method, url: request.url, authorization: request.headers.authorization });
    const isHealth = request.url === "/global/health";
    response.writeHead(redirect ? 302 : isHealth ? healthStatus : listStatus, {
      "content-type": "application/json",
      ...(redirect ? { location: "/forbidden" } : {}),
    });
    response.end(malformed ? "{bad json" : JSON.stringify(isHealth ? healthBody : listBody));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Expected isolated provider address");
  env = {
    PIXEL_DISCOVERY_ORIGIN: ORIGIN, PIXEL_DISCOVERY_ACCESS_SECRET: SECRET,
    PIXEL_OPENCODE_URL: `http://127.0.0.1:${address.port}`, PIXEL_OPENCODE_DIRECTORY: DIRECTORY,
    PIXEL_OPENCODE_PASSWORD: "synthetic-provider-password",
  };
});

afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

type Service = ReturnType<typeof createOpenCodeDiscoveryService>;

async function unlock(service: Service): Promise<string> {
  const before = [...requests];
  const response = await service.handle(appRequest({ method: "POST", body: JSON.stringify({ secret: SECRET }) }));
  expect(response.status).toBe(204);
  const cookie = response.headers.get("set-cookie");
  if (cookie === null) throw new Error("Missing discovery cookie");
  expect(cookie).toContain("Path=/api/opencode-discovery; HttpOnly; SameSite=Strict; Max-Age=900");
  expect(requests).toEqual(before);
  return cookie.split(";")[0];
}

async function read(service: Service): Promise<unknown> {
  const cookie = await unlock(service);
  const response = await service.handle(appRequest({ cookie }));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  return response.json();
}

describe("OpenCode discovery read-only boundary", () => {
  it("projects literal root-unknown, child, archived and unresolved metadata, then sends only approved GETs", async () => {
    listBody = { data: [
      wireRecord(),
      wireRecord({ id: "ses_child", parentID: "ses_parent", title: "Child title", time: { created: 3000, updated: 3500, archived: 4000 } }),
      wireRecord({ id: "ses_orphan", parentID: "ses_absent", title: "Unresolved child", location: { directory: DIRECTORY }, time: { created: 2000, updated: 2200 } }),
    ], cursor: { previous: "private-previous", next: "private-next" }, unused: "private-field" };
    const dto = await read(createOpenCodeDiscoveryService({ env: () => env }));
    expect(dto).toEqual({ kind: "snapshot", connection, health: healthy, sessions: {
      kind: "ready", count: 3, limit: 50, order: "creation-desc", records: [
        { id: "ses_child", projectID: "prj_one", parentID: "ses_parent", parentResolution: "in-page", workspaceID: "wrk_one", title: "Child title", titleTruncated: false, time: { created: 3000, updated: 3500, archived: 4000 } },
        { id: "ses_orphan", projectID: "prj_one", parentID: "ses_absent", parentResolution: "outside-page", workspaceID: null, title: "Unresolved child", titleTruncated: false, time: { created: 2000, updated: 2200, archived: null } },
        { id: "ses_parent", projectID: "prj_one", parentID: null, parentResolution: "not-reported", workspaceID: "wrk_one", title: "Parent title", titleTruncated: false, time: { created: 1000, updated: 1200, archived: null } },
      ],
    } });
    expect(requests).toEqual([
      { method: "GET", url: "/global/health", authorization: "Basic b3BlbmNvZGU6c3ludGhldGljLXByb3ZpZGVyLXBhc3N3b3Jk" },
      { method: "GET", url: "/api/session?directory=C%3A%5Capproved%5Cworkspace&limit=50&order=desc", authorization: "Basic b3BlbmNvZGU6c3ludGhldGljLXByb3ZpZGVyLXBhc3N3b3Jk" },
    ]);
    const serialized = JSON.stringify(dto);
    for (const forbidden of [DIRECTORY, "private-next", "private-previous", "private-agent", "private-model", "private-field", "tokens", "cost", SECRET, "synthetic-provider-password"]) expect(serialized.includes(forbidden)).toBe(false);
    const parsed = openCodeDiscoverySchema.parse(dto);
    expect(discoveryStatusText(parsed)).toBe("OpenCode 1.18.35 is healthy. 3 persisted records returned.");
  });

  it("returns honest empty page despite advertised cursor", async () => {
    listBody = { data: [], cursor: { next: "advertised-but-not-proof" } };
    expect(await read(createOpenCodeDiscoveryService({ env: () => env }))).toEqual({
      kind: "snapshot", connection, health: healthy,
      sessions: { kind: "ready", count: 0, limit: 50, order: "creation-desc", records: [] },
    });
  });

  it("truncates titles visibly and preserves native zero archive time", async () => {
    listBody = { data: [wireRecord({ title: "x".repeat(170), time: { created: 0, updated: 0, archived: 0 } })], cursor: {} };
    const dto = openCodeDiscoverySchema.parse(await read(createOpenCodeDiscoveryService({ env: () => env })));
    if (dto.kind !== "snapshot" || dto.sessions.kind !== "ready") throw new Error("Expected ready snapshot");
    expect(dto.sessions.records[0].title).toBe(`${"x".repeat(159)}…`);
    expect(dto.sessions.records[0].titleTruncated).toBe(true);
    expect(dto.sessions.records[0].time).toEqual({ created: 0, updated: 0, archived: 0 });
  });

  it("returns missing config without provider contact", async () => {
    const response = await createOpenCodeDiscoveryService({ env: () => ({}) }).handle(appRequest());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ kind: "not-configured", message: "Read-only discovery is not configured. Set the four required discovery environment keys on the server." });
    expect(requests).toEqual([]);
  });

  it.each([
    ["PIXEL_OPENCODE_URL", "http://localhost:4096"], ["PIXEL_OPENCODE_URL", "http://192.168.1.2:4096"],
    ["PIXEL_OPENCODE_URL", "http://user:pass@127.0.0.1:4096"], ["PIXEL_OPENCODE_URL", "http://127.0.0.1:4096/path"],
    ["PIXEL_OPENCODE_URL", "http://127.0.0.1:4096?x=1"], ["PIXEL_OPENCODE_URL", "http://127.0.0.1:4096#x"],
    ["PIXEL_DISCOVERY_ORIGIN", "http://localhost:3011"], ["PIXEL_DISCOVERY_ORIGIN", "http://127.0.0.1"],
    ["PIXEL_DISCOVERY_ACCESS_SECRET", "a".repeat(43)], ["PIXEL_DISCOVERY_ACCESS_SECRET", "short"],
    ["PIXEL_OPENCODE_DIRECTORY", "relative/workspace"], ["PIXEL_OPENCODE_DIRECTORY", "\\\\network\\share"],
  ])("rejects unsafe server configuration %s", async (key, value) => {
    env[key] = value;
    const response = await createOpenCodeDiscoveryService({ env: () => env }).handle(appRequest());
    expect(response.status).toBe(503);
    const dto = openCodeDiscoverySchema.parse(await response.json());
    expect(dto.kind).toBe("invalid-config");
    expect(requests).toEqual([]);
  });

  it.each(["MONITOR_TOKEN", "PIXEL_MONITOR_TOKEN", "NEXT_PUBLIC_PIXEL_MONITOR_TOKEN", "PIXEL_OPENCODE_PASSWORD", "OPENCODE_SERVER_PASSWORD"])("rejects secret shared with %s", async (key) => {
    env[key] = SECRET;
    const response = await createOpenCodeDiscoveryService({ env: () => env }).handle(appRequest());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ kind: "invalid-config", message: "PIXEL_DISCOVERY_ACCESS_SECRET must be an independent random secret of at least 43 base64url characters or 32 strong bytes, not a public, monitor, or provider credential." });
    expect(requests).toEqual([]);
  });

  it("denies unauthenticated and monitor-token-only requests", async () => {
    const service = createOpenCodeDiscoveryService({ env: () => env });
    for (const headers of [{}, { "x-monitor-token": SECRET, authorization: `Bearer ${SECRET}` }]) {
      const response = await service.handle(appRequest({ headers }));
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual(appDenied);
    }
    expect(requests).toEqual([]);
  });

  it("also accepts a 32-byte strong configured secret outside base64url format", async () => {
    const secret = "T9$kxM4!vN2@aR8#dP6%hQ0^sJ3&fL5*";
    env.PIXEL_DISCOVERY_ACCESS_SECRET = secret;
    const service = createOpenCodeDiscoveryService({ env: () => env });
    const unlocked = await service.handle(appRequest({ method: "POST", body: JSON.stringify({ secret }) }));
    expect(unlocked.status).toBe(204);
    expect(requests).toEqual([]);
    const cookie = unlocked.headers.get("set-cookie")?.split(";")[0];
    expect(openCodeDiscoverySchema.parse(await (await service.handle(appRequest({ cookie }))).json()).kind).toBe("snapshot");
    expect(requests.map((value) => value.method)).toEqual(["GET", "GET"]);
  });

  it("denies forged, expired, wrong-audience, future and duplicate cookies", async () => {
    const service = createOpenCodeDiscoveryService({ env: () => env, now: () => 1_000_000 });
    const valid = await unlock(service);
    const payload = { audience: `${ORIGIN}/api/opencode-discovery`, issued: 1_000_000, expires: 1_900_000, nonce: "N".repeat(32) };
    for (const cookie of [
      `${valid}x`, valid.replace(/.$/, "!"), `${valid}; ${valid}`, `${valid}; pixel-discovery=`,
      `${valid.slice(0, valid.indexOf(".") + 1)}${"A".repeat(43)}`,
      signedCookie({ ...payload, issued: 0, expires: 900_000 }),
      signedCookie({ ...payload, audience: "http://127.0.0.1:9999/api/opencode-discovery" }),
      signedCookie({ ...payload, issued: 1_000_001, expires: 1_900_001 }),
      signedCookie({ ...payload, extra: true }),
    ]) {
      const response = await service.handle(appRequest({ cookie }));
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual(appDenied);
    }
    expect(requests).toEqual([]);
  });

  it.each([
    { host: "evil.test:3011" }, { host: "127.0.0.1:3012" }, { origin: "http://127.0.0.1:3012" },
    { origin: "https://evil.test" }, { "sec-fetch-site": "cross-site" }, { "sec-fetch-site": "" },
    { "sec-fetch-mode": "navigate" }, { "sec-fetch-dest": "document" }, { "x-pixel-discovery": "" },
    { "sec-fetch-mode": undefined }, { "sec-fetch-dest": undefined }, { host: undefined },
  ])("denies wrong authority or metadata %j before provider reads", async (headers) => {
    const service = createOpenCodeDiscoveryService({ env: () => env });
    const cookie = await unlock(service);
    const response = await service.handle(appRequest({ cookie, headers }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual(appDenied);
    expect(requests).toEqual([]);
  });

  it("rejects browser query inputs and accepts Next forwarded defaults without trusting them", async () => {
    const service = createOpenCodeDiscoveryService({ env: () => env });
    const cookie = await unlock(service);
    const denied = await service.handle(appRequest({ cookie, query: "?directory=C%3A%5Cother" }));
    expect(await denied.json()).toEqual(appDenied);
    expect(requests).toEqual([]);
    const request = appRequest({ cookie, headers: { "x-forwarded-host": "localhost:3011", "x-forwarded-proto": "http" } });
    request.headers.delete("origin");
    const accepted = openCodeDiscoverySchema.parse(await (await service.handle(request)).json());
    expect(accepted.kind).toBe("snapshot");
    expect(requests.map((value) => value.method)).toEqual(["GET", "GET"]);
  });

  it.each(["wrong-secret", JSON.stringify({ secret: SECRET, directory: DIRECTORY }), "{bad", "x".repeat(2048)])("denies wrong or malformed unlock body %s", async (body) => {
    const service = createOpenCodeDiscoveryService({ env: () => env });
    const response = await service.handle(appRequest({ method: "POST", body: body === "wrong-secret" ? JSON.stringify({ secret: body }) : body }));
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBe(null);
    expect(await response.json()).toEqual(appDenied);
    expect(requests).toEqual([]);
  });

  it("requires POST Origin even with other gates and rejects non-JSON unlock", async () => {
    const service = createOpenCodeDiscoveryService({ env: () => env });
    for (const missingOrigin of [true, false]) {
      const request = appRequest({ method: "POST", body: JSON.stringify({ secret: SECRET }), headers: missingOrigin ? {} : { "content-type": "text/plain" } });
      if (missingOrigin) request.headers.delete("origin");
      const response = await service.handle(request);
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual(appDenied);
    }
    expect(requests).toEqual([]);
  });

  it("caps stalled unlock parsers before reading excess bodies and releases slots after completion and timeout", async () => {
    vi.useFakeTimers();
    const service = createOpenCodeDiscoveryService({ env: () => env });
    let finishFirst = () => {};
    const firstBody = new ReadableStream<Uint8Array>({
      start(controller) {
        finishFirst = () => {
          controller.enqueue(new TextEncoder().encode(JSON.stringify({ secret: SECRET })));
          controller.close();
        };
      },
    });
    const secondBody = new ReadableStream<Uint8Array>();
    function streamedUnlock(body: ReadableStream<Uint8Array>) {
      const base = appRequest({ method: "POST", headers: { "content-type": "application/json" } });
      const init: RequestInit & { duplex: "half" } = { method: "POST", headers: base.headers, body, duplex: "half" };
      return new Request(base.url, init);
    }
    const first = service.handle(streamedUnlock(firstBody));
    const second = service.handle(streamedUnlock(secondBody));
    const excess = appRequest({ method: "POST", body: JSON.stringify({ secret: SECRET }) });
    const busy = await service.handle(excess);
    expect(busy.status).toBe(429);
    const busyDTO: unknown = await busy.json();
    expect(openCodeDiscoverySchema.parse(busyDTO)).toEqual({ kind: "auth-failure", scope: "app", message: "Two discovery unlock requests are already reading bodies. Try again after they finish." });
    expect(busy.headers.get("set-cookie")).toBe(null);
    expect(busy.headers.get("cache-control")).toBe("private, no-store");
    expect(excess.bodyUsed).toBe(false);
    expect(requests).toEqual([]);
    finishFirst();
    expect((await first).status).toBe(204);
    await unlock(service);
    await vi.advanceTimersByTimeAsync(2000);
    const timedOut = await second;
    expect(timedOut.status).toBe(401);
    expect(await timedOut.json()).toEqual(appDenied);
    await unlock(service);
    expect(requests).toEqual([]);
  });

  it("releases unlock parser slots after bad secret, malformed and oversized bodies", async () => {
    const service = createOpenCodeDiscoveryService({ env: () => env });
    for (const body of [JSON.stringify({ secret: "wrong" }), "{bad", "x".repeat(2048)]) {
      const denied = await service.handle(appRequest({ method: "POST", body }));
      expect(denied.status).toBe(401);
      expect(await denied.json()).toEqual(appDenied);
    }
    await unlock(service);
    await unlock(service);
    await unlock(service);
    expect(requests).toEqual([]);
  });

  it("retains healthy version when provider listing rejects Basic auth", async () => {
    listStatus = 401;
    expect(await read(createOpenCodeDiscoveryService({ env: () => env }))).toEqual({ kind: "snapshot", connection, health: healthy, sessions: {
      kind: "failure", problem: { code: "unauthorized", message: "OpenCode rejected provider authentication. Check server-side Basic credentials." },
    } });
  });

  it("reports provider health auth failure distinctly from app auth", async () => {
    healthStatus = 401;
    expect(await read(createOpenCodeDiscoveryService({ env: () => env }))).toEqual({ kind: "health-failure", connection,
      problem: { code: "unauthorized", message: "OpenCode rejected provider authentication. Check server-side Basic credentials." },
    });
    expect(requests.map((value) => value.url)).toEqual(["/global/health"]);
  });

  it("does not list unsupported healthy versions or use fallback routes", async () => {
    healthBody = { healthy: true, version: "1.18.36" };
    expect(await read(createOpenCodeDiscoveryService({ env: () => env }))).toEqual({ kind: "snapshot", connection,
      health: { kind: "healthy", version: "1.18.36" }, sessions: { kind: "failure", problem: {
        code: "unsupported", message: "OpenCode version or required read-only endpoint is unsupported. Session listing requires version 1.18.35. No fallback request was sent.",
      } },
    });
    expect(requests.map((value) => value.url)).toEqual(["/global/health"]);
  });

  it.each([404, 405])("reports unsupported health endpoint for provider HTTP %i without fallback", async (status) => {
    healthStatus = status;
    expect(await read(createOpenCodeDiscoveryService({ env: () => env }))).toEqual({ kind: "health-failure", connection,
      problem: { code: "unsupported", message: "OpenCode version or required read-only endpoint is unsupported. Session listing requires version 1.18.35. No fallback request was sent." },
    });
    expect(requests.map((value) => ({ method: value.method, url: value.url }))).toEqual([{ method: "GET", url: "/global/health" }]);
  });

  it.each([404, 405])("retains healthy version when listing endpoint returns provider HTTP %i without fallback", async (status) => {
    listStatus = status;
    expect(await read(createOpenCodeDiscoveryService({ env: () => env }))).toEqual({ kind: "snapshot", connection, health: healthy, sessions: {
      kind: "failure", problem: { code: "unsupported", message: "OpenCode version or required read-only endpoint is unsupported. Session listing requires version 1.18.35. No fallback request was sent." },
    } });
    expect(requests.map((value) => ({ method: value.method, url: value.url }))).toEqual([
      { method: "GET", url: "/global/health" },
      { method: "GET", url: "/api/session?directory=C%3A%5Capproved%5Cworkspace&limit=50&order=desc" },
    ]);
  });

  it.each([
    { data: [wireRecord(), wireRecord()], cursor: {} },
    { data: [wireRecord({ location: { directory: "C:\\different" } })], cursor: {} },
    { data: [wireRecord({ id: "invalid id" })], cursor: {} },
    { data: [wireRecord({ parentID: "ses_parent" })], cursor: {} },
    { data: [wireRecord({ time: { created: "bad", updated: 10 } })], cursor: {} },
    { data: [wireRecord()], cursor: "not-object" },
    [],
  ])("rejects malformed, duplicate, or outside-scope page %j", async (body) => {
    listBody = body;
    expect(await read(createOpenCodeDiscoveryService({ env: () => env }))).toEqual({ kind: "snapshot", connection, health: healthy, sessions: {
      kind: "failure", problem: { code: "malformed", message: "OpenCode returned invalid metadata or a response outside the approved workspace." },
    } });
  });

  it("rejects oversized pages without returning partial rows", async () => {
    listBody = { data: Array.from({ length: 51 }, (_, index) => wireRecord({ id: `ses_${index}` })), cursor: {} };
    expect(await read(createOpenCodeDiscoveryService({ env: () => env }))).toEqual({ kind: "snapshot", connection, health: healthy, sessions: {
      kind: "failure", problem: { code: "limit-exceeded", message: "OpenCode exceeded the discovery response or 50-record page limit." },
    } });
  });

  it("never follows redirects and masks raw provider errors", async () => {
    redirect = true;
    expect(await read(createOpenCodeDiscoveryService({ env: () => env }))).toEqual({ kind: "health-failure", connection,
      problem: { code: "malformed", message: "OpenCode returned invalid metadata or a response outside the approved workspace." },
    });
    expect(requests.map((value) => value.url)).toEqual(["/global/health"]);
  });

  it("rejects invalid JSON health responses", async () => {
    malformed = true;
    expect(await read(createOpenCodeDiscoveryService({ env: () => env }))).toEqual({ kind: "health-failure", connection,
      problem: { code: "malformed", message: "OpenCode returned invalid metadata or a response outside the approved workspace." },
    });
  });

  it("rejects malformed listing JSON while retaining healthy version", async () => {
    const injectedFetch: typeof fetch = async (input) => String(input).endsWith("/global/health")
      ? Response.json({ healthy: true, version: "1.18.35" })
      : new Response("private-error {", { headers: { "content-type": "application/json" } });
    expect(await read(createOpenCodeDiscoveryService({ env: () => env, fetch: injectedFetch }))).toEqual({ kind: "snapshot", connection, health: healthy, sessions: {
      kind: "failure", problem: { code: "malformed", message: "OpenCode returned invalid metadata or a response outside the approved workspace." },
    } });
  });

  it("masks network exceptions and does not retry", async () => {
    let attempts = 0;
    const injectedFetch: typeof fetch = async () => { attempts++; throw new Error("private-network-address-and-password"); };
    expect(await read(createOpenCodeDiscoveryService({ env: () => env, fetch: injectedFetch }))).toEqual({ kind: "health-failure", connection,
      problem: { code: "unreachable", message: "OpenCode could not complete this read within the deadline. Check the configured local server." },
    });
    expect(attempts).toBe(1);
  });

  it("sends no Basic header when optional provider password is absent", async () => {
    delete env.PIXEL_OPENCODE_PASSWORD;
    const dto = openCodeDiscoverySchema.parse(await read(createOpenCodeDiscoveryService({ env: () => env })));
    expect(dto.kind).toBe("snapshot");
    expect(requests).toEqual([
      { method: "GET", url: "/global/health", authorization: undefined },
      { method: "GET", url: "/api/session?directory=C%3A%5Capproved%5Cworkspace&limit=50&order=desc", authorization: undefined },
    ]);
  });

  it("keeps POSIX scope case-sensitive and accepts nullable parent and workspace", async () => {
    env.PIXEL_OPENCODE_DIRECTORY = "/approved/Workspace";
    listBody = { data: [wireRecord({ parentID: null, location: { directory: "/approved/Workspace", workspaceID: null } })], cursor: {} };
    const service = createOpenCodeDiscoveryService({ env: () => env });
    const dto = openCodeDiscoverySchema.parse(await read(service));
    if (dto.kind !== "snapshot" || dto.sessions.kind !== "ready") throw new Error("Expected ready snapshot");
    expect(dto.sessions.records[0].parentID).toBe(null);
    expect(dto.sessions.records[0].workspaceID).toBe(null);
    listBody = { data: [wireRecord({ location: { directory: "/approved/workspace" } })], cursor: {} };
    const cookie = await unlock(service);
    expect(await (await service.handle(appRequest({ cookie }))).json()).toEqual({ kind: "snapshot", connection, health: healthy, sessions: {
      kind: "failure", problem: { code: "malformed", message: "OpenCode returned invalid metadata or a response outside the approved workspace." },
    } });
  });

  it("bounds streamed bytes even without Content-Length and cancels oversized stream", async () => {
    let cancelled = false;
    const injectedFetch: typeof fetch = async (input) => String(input).endsWith("/global/health")
      ? Response.json({ healthy: true, version: "1.18.35" })
      : new Response(new ReadableStream<Uint8Array>({
        start(controller) { controller.enqueue(new Uint8Array(262_145)); },
        cancel() { cancelled = true; },
      }), { headers: { "content-type": "application/json" } });
    expect(await read(createOpenCodeDiscoveryService({ env: () => env, fetch: injectedFetch }))).toEqual({ kind: "snapshot", connection, health: healthy, sessions: {
      kind: "failure", problem: { code: "limit-exceeded", message: "OpenCode exceeded the discovery response or 50-record page limit." },
    } });
    expect(cancelled).toBe(true);
  });

  it("total deadline includes body consumption and releases both concurrency slots", async () => {
    let stalled = true;
    let cancelled = 0;
    const injectedFetch: typeof fetch = async () => stalled
      ? new Response(new ReadableStream<Uint8Array>({ cancel() { cancelled++; } }), { headers: { "content-type": "application/json" } })
      : Response.json({ healthy: true, version: "1.18.36" });
    const service = createOpenCodeDiscoveryService({ env: () => env, fetch: injectedFetch, deadlineMs: 30 });
    const cookie = await unlock(service);
    const first = service.handle(appRequest({ cookie }));
    const second = service.handle(appRequest({ cookie }));
    const busy = await service.handle(appRequest({ cookie }));
    expect(await busy.json()).toEqual({ kind: "health-failure", connection,
      problem: { code: "busy", message: "Two discovery reads are already running. Try again after they finish." },
    });
    for (const pending of [first, second]) expect(await (await pending).json()).toEqual({ kind: "health-failure", connection,
      problem: { code: "unreachable", message: "OpenCode could not complete this read within the deadline. Check the configured local server." },
    });
    expect(cancelled).toBe(2);
    stalled = false;
    const resumed = openCodeDiscoverySchema.parse(await (await service.handle(appRequest({ cookie }))).json());
    expect(resumed.kind).toBe("snapshot");
  });

  it("uses one deadline across health response and listing body, not one deadline per call", async () => {
    vi.useFakeTimers();
    const endpoints: string[] = [];
    const injectedFetch: typeof fetch = async (input) => {
      endpoints.push(new URL(String(input)).pathname);
      if (String(input).endsWith("/global/health")) {
        await new Promise<void>((resolve) => setTimeout(resolve, 10));
        return Response.json({ healthy: true, version: "1.18.35" });
      }
      return new Response(new ReadableStream<Uint8Array>(), { headers: { "content-type": "application/json" } });
    };
    const service = createOpenCodeDiscoveryService({ env: () => env, fetch: injectedFetch, deadlineMs: 20 });
    const cookie = await unlock(service);
    const pending = service.handle(appRequest({ cookie }));
    await vi.advanceTimersByTimeAsync(20);
    expect(await (await pending).json()).toEqual({ kind: "snapshot", connection, health: healthy, sessions: {
      kind: "failure", problem: { code: "unreachable", message: "OpenCode could not complete this read within the deadline. Check the configured local server." },
    } });
    expect(endpoints).toEqual(["/global/health", "/api/session"]);
  });

  it("route exports use same authorization boundary and GET/POST contract", async () => {
    for (const [key, value] of Object.entries(env)) if (value !== undefined) vi.stubEnv(key, value);
    const route = await import("../../app/api/opencode-discovery/route");
    expect(await (await route.GET(appRequest())).json()).toEqual(appDenied);
    const unlocked = await route.POST(appRequest({ method: "POST", body: JSON.stringify({ secret: SECRET }) }));
    expect(unlocked.status).toBe(204);
    expect(requests).toEqual([]);
    const cookie = unlocked.headers.get("set-cookie")?.split(";")[0];
    expect(openCodeDiscoverySchema.parse(await (await route.GET(appRequest({ cookie }))).json()).kind).toBe("snapshot");
    expect(route.HEAD().status).toBe(405);
    expect(requests.map((value) => value.method)).toEqual(["GET", "GET"]);
  });
});
