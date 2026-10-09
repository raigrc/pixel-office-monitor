import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { z } from "zod";
import { discoverySessionSchema, type DiscoveryProblem, type DiscoverySessions, type OpenCodeDiscovery } from "./opencode-discovery";

const API_PATH = "/api/opencode-discovery";
const COOKIE_NAME = "pixel-discovery";
const COOKIE_TTL = 15 * 60 * 1000;
const connection = {
  provider: "opencode",
  connectionID: "configured-opencode",
  directoryDisplay: "Configured workspace",
} satisfies Extract<OpenCodeDiscovery, { kind: "snapshot" }>["connection"];

const problemMessages = {
  unauthorized: "OpenCode rejected provider authentication. Check server-side Basic credentials.",
  unreachable: "OpenCode could not complete this read within the deadline. Check the configured local server.",
  unsupported: "OpenCode version or required read-only endpoint is unsupported. Session listing requires version 1.18.35. No fallback request was sent.",
  malformed: "OpenCode returned invalid metadata or a response outside the approved workspace.",
  "limit-exceeded": "OpenCode exceeded the discovery response or 50-record page limit.",
  busy: "Two discovery reads are already running. Try again after they finish.",
} satisfies Record<DiscoveryProblem["code"], string>;

function problem(code: DiscoveryProblem["code"]): DiscoveryProblem {
  return { code, message: problemMessages[code] };
}

class ReadFailure extends Error {
  constructor(readonly code: DiscoveryProblem["code"]) { super(code); }
}

function sameSecret(left: string, right: string): boolean {
  return timingSafeEqual(createHash("sha256").update(left).digest(), createHash("sha256").update(right).digest());
}

function numericOrigin(value: string, requirePort: boolean): string | null {
  try {
    const url = new URL(value);
    const loopback = url.hostname === "[::1]" || /^127\.(?:\d{1,3}\.){2}\d{1,3}$/.test(url.hostname);
    if (!loopback || !["http:", "https:"].includes(url.protocol) || url.username || url.password ||
        url.pathname !== "/" || url.search || url.hash || value !== url.origin || (requirePort && !url.port)) return null;
    return url.origin;
  } catch { return null; }
}

function workspaceKey(directory: string): string {
  return /^[A-Za-z]:[\\/]/.test(directory)
    ? path.win32.normalize(directory).replace(/[\\/]+$/, "").toLowerCase()
    : path.posix.normalize(directory).replace(/\/+$/, "") || "/";
}

const configuredSchema = z.object({
  origin: z.string().brand<"DiscoveryAppOrigin">(),
  secret: z.string().brand<"DiscoveryAccessSecret">(),
  providerOrigin: z.string().brand<"OpenCodeOrigin">(),
  directory: z.string().brand<"ApprovedWorkspace">(),
  username: z.string(),
  password: z.string().nullable(),
});
type DiscoveryConfig = z.infer<typeof configuredSchema>;
type ConfigResult = { kind: "configured"; config: DiscoveryConfig } | Extract<OpenCodeDiscovery, { kind: "not-configured" | "invalid-config" }>;

function readConfig(env: NodeJS.ProcessEnv): ConfigResult {
  const required = ["PIXEL_DISCOVERY_ORIGIN", "PIXEL_DISCOVERY_ACCESS_SECRET", "PIXEL_OPENCODE_URL", "PIXEL_OPENCODE_DIRECTORY"];
  if (required.some((key) => !env[key])) return { kind: "not-configured", message: "Read-only discovery is not configured. Set the four required discovery environment keys on the server." };
  const origin = env.PIXEL_DISCOVERY_ORIGIN ?? "";
  const secret = env.PIXEL_DISCOVERY_ACCESS_SECRET ?? "";
  const providerOrigin = env.PIXEL_OPENCODE_URL ?? "";
  const directory = env.PIXEL_OPENCODE_DIRECTORY ?? "";
  const password = env.PIXEL_OPENCODE_PASSWORD || null;
  const username = env.PIXEL_OPENCODE_USERNAME ?? "opencode";
  const forbidden = Object.entries(env).filter(([key]) => key.startsWith("NEXT_PUBLIC_") ||
    ["MONITOR_TOKEN", "PIXEL_MONITOR_TOKEN", "PIXEL_OPENCODE_PASSWORD", "OPENCODE_SERVER_PASSWORD"].includes(key));
  if (!numericOrigin(origin, true) || !numericOrigin(providerOrigin, false)) {
    return { kind: "invalid-config", message: "Discovery origins must be canonical numeric loopback origins. PIXEL_DISCOVERY_ORIGIN must include a non-default port." };
  }
  const secretBytes = Buffer.byteLength(secret, "utf8");
  const strongSecretFormat = /^[A-Za-z0-9_-]{43,512}$/.test(secret) ||
    (secretBytes >= 32 && secretBytes <= 512 && !/[\x00-\x1f\x7f]/.test(secret));
  if (!strongSecretFormat || new Set(secret).size < 16 ||
      forbidden.some(([, value]) => value !== undefined && sameSecret(secret, value))) {
    return { kind: "invalid-config", message: "PIXEL_DISCOVERY_ACCESS_SECRET must be an independent random secret of at least 43 base64url characters or 32 strong bytes, not a public, monitor, or provider credential." };
  }
  if (directory.length > 4096 || /[\x00-\x1f]/.test(directory) || directory.startsWith("\\\\") ||
      !(path.posix.isAbsolute(directory) || /^[A-Za-z]:[\\/]/.test(directory)) ||
      !username || username.length > 256 || /[:\x00-\x1f]/.test(username) ||
      (password !== null && (password.length > 1024 || /[\x00-\x1f]/.test(password)))) {
    return { kind: "invalid-config", message: "Configure an absolute approved PIXEL_OPENCODE_DIRECTORY and valid server-side Basic credentials." };
  }
  return { kind: "configured", config: configuredSchema.parse({ origin, secret, providerOrigin, directory, username, password }) };
}

function boundaryAllowed(request: Request, config: DiscoveryConfig): boolean {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  return (request.method === "GET" || request.method === "POST") &&
    url.pathname === API_PATH && !url.search && !url.hash &&
    request.headers.get("host") === new URL(config.origin).host &&
    (origin === config.origin || (request.method === "GET" && origin === null)) &&
    request.headers.get("sec-fetch-site") === "same-origin" &&
    ["cors", "same-origin"].includes(request.headers.get("sec-fetch-mode") ?? "") &&
    request.headers.get("sec-fetch-dest") === "empty" &&
    request.headers.get("x-pixel-discovery") === "1";
}

const cookiePayloadSchema = z.object({
  audience: z.string().max(256),
  issued: z.number().int().nonnegative(),
  expires: z.number().int().nonnegative(),
  nonce: z.string().regex(/^[A-Za-z0-9_-]{32}$/),
}).strict();

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function authorizedCookie(request: Request, config: DiscoveryConfig, now: number): boolean {
  const cookies = request.headers.get("cookie") ?? "";
  if (cookies.length > 8192) return false;
  const matches = cookies.split(";").map((part) => part.trim()).filter((part) => part.split("=", 1)[0] === COOKIE_NAME);
  if (matches.length !== 1) return false;
  const value = matches[0].slice(COOKIE_NAME.length + 1);
  if (value.length > 1024 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(value)) return false;
  const [payload, signature] = value.split(".");
  if (!sameSecret(sign(payload, config.secret), signature)) return false;
  try {
    const decoded = cookiePayloadSchema.safeParse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
    return decoded.success && decoded.data.audience === `${config.origin}${API_PATH}` &&
      decoded.data.issued <= now && decoded.data.expires > now &&
      decoded.data.expires - decoded.data.issued === COOKIE_TTL;
  } catch { return false; }
}

async function withinDeadline<T>(pending: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  let onAbort = () => {};
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(new ReadFailure("unreachable"));
    signal.addEventListener("abort", onAbort, { once: true });
  });
  try { return await Promise.race([pending, aborted]); }
  finally { signal.removeEventListener("abort", onAbort); }
}

async function boundedJSON(body: ReadableStream<Uint8Array> | null, cap: number, signal: AbortSignal): Promise<unknown> {
  if (!body) throw new ReadFailure("malformed");
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let text = "";
  try {
    while (true) {
      const chunk = await withinDeadline(reader.read(), signal);
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > cap) throw new ReadFailure("limit-exceeded");
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } catch (error) {
    if (signal.aborted) throw new ReadFailure("unreachable");
    if (error instanceof ReadFailure) throw error;
    throw new ReadFailure("malformed");
  } finally {
    void reader.cancel().catch(() => {});
  }
}

const healthSchema = z.object({ healthy: z.literal(true), version: z.string().min(1).max(64).regex(/^[A-Za-z0-9.+_-]+$/) });
const wireSessionSchema = z.object({
  id: discoverySessionSchema.shape.id,
  projectID: discoverySessionSchema.shape.projectID,
  parentID: discoverySessionSchema.shape.parentID.optional(),
  title: z.string().max(16_384),
  location: z.object({ directory: z.string().max(4096), workspaceID: discoverySessionSchema.shape.workspaceID.optional() }),
  time: z.object({
    created: discoverySessionSchema.shape.time.shape.created,
    updated: discoverySessionSchema.shape.time.shape.updated,
    archived: discoverySessionSchema.shape.time.shape.archived.unwrap().optional(),
  }),
});
const wirePageSchema = z.object({
  data: z.array(wireSessionSchema),
  cursor: z.object({ previous: z.string().max(4096).optional(), next: z.string().max(4096).optional() }),
});

function projectPage(raw: unknown, config: DiscoveryConfig): DiscoverySessions {
  const envelope = z.object({ data: z.array(z.unknown()) }).safeParse(raw);
  if (envelope.success && envelope.data.data.length > 50) throw new ReadFailure("limit-exceeded");
  const page = wirePageSchema.safeParse(raw);
  if (!page.success) throw new ReadFailure("malformed");
  const ids = new Set(page.data.data.map((record) => record.id));
  if (ids.size !== page.data.data.length || page.data.data.some((record) =>
    workspaceKey(record.location.directory) !== workspaceKey(config.directory) || record.parentID === record.id)) throw new ReadFailure("malformed");
  const records = page.data.data.map((record) => ({
    id: record.id,
    projectID: record.projectID,
    parentID: record.parentID ?? null,
    parentResolution: record.parentID == null ? "not-reported" : ids.has(record.parentID) ? "in-page" : "outside-page",
    workspaceID: record.location.workspaceID ?? null,
    title: record.title.length > 160 ? `${record.title.slice(0, 159)}…` : record.title,
    titleTruncated: record.title.length > 160,
    time: { created: record.time.created, updated: record.time.updated, archived: record.time.archived ?? null },
  } satisfies z.infer<typeof discoverySessionSchema>)).sort((left, right) => right.time.created - left.time.created);
  return { kind: "ready", records, count: records.length, limit: 50, order: "creation-desc" };
}

function failureCode(error: unknown): DiscoveryProblem["code"] {
  return error instanceof ReadFailure ? error.code : "unreachable";
}

const privateHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  Vary: "Cookie, Origin, Sec-Fetch-Site",
};

function dtoResponse(dto: OpenCodeDiscovery, status = 200): Response {
  return Response.json(dto, { status, headers: privateHeaders });
}

type DiscoveryServiceOptions = {
  env?: () => NodeJS.ProcessEnv;
  fetch?: typeof fetch;
  now?: () => number;
  deadlineMs?: number;
};

export function createOpenCodeDiscoveryService(options: DiscoveryServiceOptions = {}) {
  const getEnv = options.env ?? (() => process.env);
  const providerFetch = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const deadlineMs = options.deadlineMs ?? 8000;
  let inFlight = 0;
  let unlockInFlight = 0;

  async function providerJSON(config: DiscoveryConfig, endpoint: URL, cap: number, signal: AbortSignal): Promise<unknown> {
    signal.throwIfAborted();
    const headers = new Headers({ Accept: "application/json" });
    if (config.password !== null) headers.set("Authorization", `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}`);
    const response = await withinDeadline(providerFetch(endpoint, { method: "GET", headers, redirect: "manual", cache: "no-store", signal }), signal);
    if (!response.ok || !/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type") ?? "")) {
      void response.body?.cancel().catch(() => {});
      if (response.status === 401 || response.status === 403) throw new ReadFailure("unauthorized");
      if (response.status === 404 || response.status === 405) throw new ReadFailure("unsupported");
      throw new ReadFailure(response.status >= 500 ? "unreachable" : "malformed");
    }
    const length = response.headers.get("content-length");
    if (length !== null && Number(length) > cap) {
      void response.body?.cancel().catch(() => {});
      throw new ReadFailure("limit-exceeded");
    }
    return boundedJSON(response.body, cap, signal);
  }

  async function discover(config: DiscoveryConfig, request: Request): Promise<OpenCodeDiscovery> {
    if (inFlight >= 2) return { kind: "health-failure", connection, problem: problem("busy") };
    inFlight++;
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    request.signal.addEventListener("abort", onAbort, { once: true });
    if (request.signal.aborted) controller.abort();
    const timer = setTimeout(() => controller.abort(), deadlineMs);
    try {
      const health = healthSchema.safeParse(await providerJSON(config, new URL("/global/health", config.providerOrigin), 4096, controller.signal));
      if (!health.success) throw new ReadFailure("malformed");
      let sessions: DiscoverySessions;
      if (health.data.version !== "1.18.35") sessions = { kind: "failure", problem: problem("unsupported") };
      else {
        try {
          const endpoint = new URL("/api/session", config.providerOrigin);
          endpoint.searchParams.set("directory", config.directory);
          endpoint.searchParams.set("limit", "50");
          endpoint.searchParams.set("order", "desc");
          sessions = projectPage(await providerJSON(config, endpoint, 256 * 1024, controller.signal), config);
        } catch (error) { sessions = { kind: "failure", problem: problem(failureCode(error)) }; }
      }
      return { kind: "snapshot", connection, health: { kind: "healthy", version: health.data.version }, sessions };
    } catch (error) { return { kind: "health-failure", connection, problem: problem(failureCode(error)) }; }
    finally {
      clearTimeout(timer);
      request.signal.removeEventListener("abort", onAbort);
      inFlight--;
    }
  }

  async function handle(request: Request): Promise<Response> {
    const configured = readConfig(getEnv());
    if (configured.kind !== "configured") return dtoResponse(configured, 503);
    const { config } = configured;
    const denied = () => dtoResponse({ kind: "auth-failure", scope: "app", message: "Discovery access denied. Use the configured app origin and unlock with the independent discovery secret." }, 401);
    if (!boundaryAllowed(request, config)) return denied();
    if (request.method === "POST") {
      if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) return denied();
      if (unlockInFlight >= 2) return dtoResponse({ kind: "auth-failure", scope: "app", message: "Two discovery unlock requests are already reading bodies. Try again after they finish." }, 429);
      unlockInFlight++;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      try {
        const unlock = z.object({ secret: z.string().max(512) }).strict().safeParse(await boundedJSON(request.body, 1024, controller.signal));
        if (!unlock.success || !sameSecret(unlock.data.secret, config.secret)) return denied();
        const issued = now();
        const payload = Buffer.from(JSON.stringify({ audience: `${config.origin}${API_PATH}`, issued, expires: issued + COOKIE_TTL, nonce: randomBytes(24).toString("base64url") })).toString("base64url");
        const secure = config.origin.startsWith("https:") ? "; Secure" : "";
        return new Response(null, { status: 204, headers: { ...privateHeaders,
          "Set-Cookie": `${COOKIE_NAME}=${payload}.${sign(payload, config.secret)}; Path=${API_PATH}; HttpOnly; SameSite=Strict; Max-Age=900${secure}`,
        } });
      } catch { return denied(); }
      finally {
        clearTimeout(timer);
        unlockInFlight--;
      }
    }
    if (!authorizedCookie(request, config, now())) return denied();
    return dtoResponse(await discover(config, request));
  }

  return { handle };
}
