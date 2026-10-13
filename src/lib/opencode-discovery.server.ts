import "server-only";

import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { z } from "zod";
import { discoverySessionSchema, messageIDSchema, partIDSchema, sessionIDSchema, openCodeHistorySchema, type HistoryMessage, type HistoryPart, type HistoryPage, type HistoryProblem, type OpenCodeHistory, type DiscoveryProblem, type DiscoverySessions, type OpenCodeDiscovery } from "./opencode-discovery";

const API_PATH = "/api/opencode-discovery";
const COOKIE_NAME = "pixel-discovery";
const COOKIE_TTL = 15 * 60 * 1000;
const HISTORY_PATH = `${API_PATH}/history`;
const HISTORY_TTL = 5 * 60 * 1000;
const HISTORY_PURPOSE = "pixel-opencode-history-v1";
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
  secrets: z.array(z.string()),
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
  const secrets = [...new Set(Object.entries(env).filter(([key, value]) => value &&
    /(?:^|_)(?:SECRET|TOKEN|PASSWORD|PASSWD|API_KEY|APIKEY|ACCESS_KEY|PRIVATE_KEY|CLIENT_SECRET)(?:$|_)/i.test(key)).map(([, value]) => value ?? ""))].filter(Boolean).sort((left, right) => right.length - left.length);
  if (password) secrets.push(Buffer.from(`${username}:${password}`).toString("base64"));
  return { kind: "configured", config: configuredSchema.parse({ origin, secret, providerOrigin, directory, username, password, secrets }) };
}

function boundaryAllowed(request: Request, config: DiscoveryConfig, history = false): boolean {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  return (history ? request.method === "GET" && request.body === null : request.method === "GET" || request.method === "POST") &&
    url.pathname === (history ? HISTORY_PATH : API_PATH) && !url.search && !url.hash &&
    (history || (!request.headers.has("x-pixel-history-session") && !request.headers.has("x-pixel-history-cursor"))) &&
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

function authorizedCookie(request: Request, config: DiscoveryConfig, now: number): z.infer<typeof cookiePayloadSchema> | null {
  const cookies = request.headers.get("cookie") ?? "";
  if (cookies.length > 8192) return null;
  const matches = cookies.split(";").map((part) => part.trim()).filter((part) => part.split("=", 1)[0] === COOKIE_NAME);
  if (matches.length !== 1) return null;
  const value = matches[0].slice(COOKIE_NAME.length + 1);
  if (value.length > 1024 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(value)) return null;
  const [payload, signature] = value.split(".");
  if (!sameSecret(sign(payload, config.secret), signature)) return null;
  try {
    const decoded = cookiePayloadSchema.safeParse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
    return decoded.success && decoded.data.audience === `${config.origin}${API_PATH}` &&
      decoded.data.issued <= now && decoded.data.expires > now &&
      decoded.data.expires - decoded.data.issued === COOKIE_TTL ? decoded.data : null;
  } catch { return null; }
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
    workspaceKey(record.location.directory) !== workspaceKey(config.directory) || record.parentID === record.id ||
    [record.id, record.projectID, record.parentID, record.location.workspaceID].some((id) => id != null && redact(id, config) !== id))) throw new ReadFailure("malformed");
  const records = page.data.data.map((record) => ({
    id: record.id,
    projectID: record.projectID,
    parentID: record.parentID ?? null,
    parentResolution: record.parentID == null ? "not-reported" : ids.has(record.parentID) ? "in-page" : "outside-page",
    workspaceID: record.location.workspaceID ?? null,
    ...metadataTitle(record.title, config),
    time: { created: record.time.created, updated: record.time.updated, archived: record.time.archived ?? null },
  } satisfies z.infer<typeof discoverySessionSchema>)).sort((left, right) => right.time.created - left.time.created);
  return { kind: "ready", records, count: records.length, limit: 50, order: "creation-desc" };
}

function failureCode(error: unknown): DiscoveryProblem["code"] {
  return error instanceof ReadFailure ? error.code : "unreachable";
}

function redact(value: string, config: DiscoveryConfig): string {
  let result = value;
  for (const secret of config.secrets) result = result.split(secret).join("[REDACTED]");
  return result
    .replace(/-----BEGIN (?:[A-Z ]*PRIVATE KEY)-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g, "[REDACTED]")
    .replace(/\b(Bearer|Basic)\s+(?:\[REDACTED\]|[A-Za-z0-9+/_.=~-]+)/gi, "$1 [REDACTED]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED]")
    .replace(/\b(?:sk-[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9_]{8,}|github_pat_[A-Za-z0-9_]+|AIza[A-Za-z0-9_-]{20,}|(?:AKIA|ASIA)[A-Z0-9]{16}|xox[baprs]-[A-Za-z0-9-]{8,}|ya29\.[A-Za-z0-9_-]{12,})\b/g, "[REDACTED]")
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, "$1[REDACTED]@")
    .replace(/([?&](?:api[_-]?key|access[_-]?token|token|secret|password)=)[^\s&#]*/gi, "$1[REDACTED]")
    .replace(/((?:["']?)(?:api[_-]?key|access[_-]?token|token|secret|password|passwd|private[_-]?key)(?:["']?)\s*[:=]\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;}]+)/gi, "$1[REDACTED]")
    .replace(/data:[^\s"'<>]+/gi, "[Media omitted]");
}

function safeTitle(value: string): string {
  let result = "";
  for (const character of value) {
    if (result.length + character.length > 159) break;
    result += character;
  }
  return result;
}

function metadataTitle(value: string, config: DiscoveryConfig) {
  const title = redact(value, config);
  return { title: title.length > 160 ? `${safeTitle(title)}…` : title, titleTruncated: title.length > 160 };
}

function byteClip(value: string, cap: number): string {
  let size = 0;
  let result = "";
  for (const character of value) {
    const bytes = Buffer.byteLength(character, "utf8");
    if (size + bytes > cap) break;
    size += bytes;
    result += character;
  }
  return result;
}

function projectText(value: string, config: DiscoveryConfig, cap: number) {
  const redacted = redact(value, config);
  const text = byteClip(redacted, cap);
  return { text, redacted: value !== redacted, truncated: text !== redacted };
}

export function openCodeHistoryProfile(env: NodeJS.ProcessEnv): string | null {
  const result = readConfig(env);
  if (result.kind !== "configured") return null;
  const { providerOrigin, directory, username, password } = result.config;
  return createHash("sha256").update(JSON.stringify([HISTORY_PURPOSE, providerOrigin, workspaceKey(directory), username, password, "1.18.35"]), "utf8").digest("hex");
}

const historyMessages = {
  ...problemMessages,
  "selection-unavailable": "Selected session is unavailable in the fresh configured-workspace first page. Refresh metadata and select again.",
  "scope-changed": "Selected session scope changed during inspection. No message content is shown.",
  "invalid-cursor": "History continuation is invalid for this owner, session, or configuration. Inspect Latest again.",
  expired: "History inspection expired. Inspect Latest again.",
} satisfies Record<HistoryProblem["code"], string>;

class HistoryFailure extends Error {
  constructor(readonly code: HistoryProblem["code"]) { super(code); }
}

function historyFailure(error: unknown): OpenCodeHistory {
  const code = error instanceof HistoryFailure || error instanceof ReadFailure ? error.code : "unreachable";
  return { kind: "failure", problem: { code, message: historyMessages[code] } };
}

const legacySessionSchema = z.object({
  id: sessionIDSchema, projectID: discoverySessionSchema.shape.projectID,
  directory: z.string().max(4096), parentID: sessionIDSchema.nullish(),
  workspaceID: discoverySessionSchema.shape.workspaceID.optional(),
  time: z.object({ created: discoverySessionSchema.shape.time.shape.created, updated: discoverySessionSchema.shape.time.shape.updated }),
});
type LegacySession = z.infer<typeof legacySessionSchema>;
type ScopedSession = z.infer<typeof discoverySessionSchema>;
const nativeCursorSchema = z.object({ id: messageIDSchema, time: discoverySessionSchema.shape.time.shape.created }).strict();
type NativeCursor = z.infer<typeof nativeCursorSchema>;
const cursorClaimsSchema = z.object({
  purpose: z.literal(HISTORY_PURPOSE), version: z.literal(1), session: sessionIDSchema,
  project: discoverySessionSchema.shape.projectID, workspace: discoverySessionSchema.shape.workspaceID,
  directory: z.string().max(4096), profile: z.string().regex(/^[a-f0-9]{64}$/),
  cookieNonce: cookiePayloadSchema.shape.nonce, limit: z.literal(5), order: z.literal("backward"),
  native: nativeCursorSchema, issued: cookiePayloadSchema.shape.issued, expires: cookiePayloadSchema.shape.expires,
}).strict();
type CursorClaims = z.infer<typeof cursorClaimsSchema>;

function cursorKey(config: DiscoveryConfig) {
  return Buffer.from(hkdfSync("sha256", config.secret, "pixel-discovery-history", HISTORY_PURPOSE, 32));
}

function sealCursor(claims: CursorClaims, config: DiscoveryConfig): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", cursorKey(config), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(claims), "utf8"), cipher.final()]);
  const token = Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
  if (token.length > 8192) throw new HistoryFailure("limit-exceeded");
  return token;
}

function openCursor(token: string, config: DiscoveryConfig, owner: z.infer<typeof cookiePayloadSchema>, session: z.infer<typeof sessionIDSchema>, profile: string, now: number): CursorClaims {
  try {
    if (token.length > 8192 || !/^[A-Za-z0-9_-]+$/.test(token)) throw new Error();
    const bytes = Buffer.from(token, "base64url");
    if (bytes.length < 29 || bytes.toString("base64url") !== token) throw new Error();
    const decipher = createDecipheriv("aes-256-gcm", cursorKey(config), bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const plain = Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]);
    const claims = cursorClaimsSchema.parse(JSON.parse(plain.toString("utf8")));
    if (claims.session !== session || claims.profile !== profile || claims.directory !== workspaceKey(config.directory) ||
        claims.cookieNonce !== owner.nonce || claims.issued > now || claims.expires <= claims.issued ||
        claims.expires - claims.issued > HISTORY_TTL || claims.expires > owner.expires) throw new Error();
    if (claims.expires <= now) throw new HistoryFailure("expired");
    return claims;
  } catch (error) {
    if (error instanceof HistoryFailure) throw error;
    throw new HistoryFailure("invalid-cursor");
  }
}

function decodeNativeCursor(token: string): NativeCursor {
  try {
    if (token.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(token)) throw new Error();
    const bytes = Buffer.from(token, "base64url");
    if (bytes.toString("base64url") !== token) throw new Error();
    return nativeCursorSchema.parse(JSON.parse(bytes.toString("utf8")));
  } catch { throw new HistoryFailure("malformed"); }
}

function older(left: NativeCursor, right: NativeCursor): boolean {
  return left.time < right.time || (left.time === right.time && left.id < right.id);
}

function sameScope(left: ScopedSession, right: ScopedSession): boolean {
  return left.id === right.id && left.projectID === right.projectID && left.parentID === right.parentID &&
    left.time.created === right.time.created && left.workspaceID === right.workspaceID;
}

function requireLegacyScope(raw: unknown, selected: ScopedSession, config: DiscoveryConfig): LegacySession {
  const parsed = legacySessionSchema.safeParse(raw);
  if (!parsed.success) throw new HistoryFailure("malformed");
  const record = parsed.data;
  if (record.id !== selected.id || record.projectID !== selected.projectID || (record.parentID ?? null) !== selected.parentID ||
      record.time.created !== selected.time.created || workspaceKey(record.directory) !== workspaceKey(config.directory) ||
      (record.workspaceID != null && record.workspaceID !== selected.workspaceID)) throw new HistoryFailure("selection-unavailable");
  return record;
}

const infoBase = { id: messageIDSchema, sessionID: sessionIDSchema, agent: z.string().optional() };
const wireInfoSchema = z.discriminatedUnion("role", [
  z.object({ ...infoBase, role: z.literal("user"), time: z.object({ created: nativeCursorSchema.shape.time }) }),
  z.object({ ...infoBase, role: z.literal("assistant"), time: z.object({ created: nativeCursorSchema.shape.time, completed: nativeCursorSchema.shape.time.optional() }) }),
]);
const partBase = { id: partIDSchema, sessionID: sessionIDSchema, messageID: messageIDSchema };
const inputSchema = z.record(z.string(), z.unknown());
const toolStateSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("pending"), input: inputSchema, raw: z.string() }),
  z.object({ status: z.literal("running"), input: inputSchema, time: z.object({ start: nativeCursorSchema.shape.time }) }),
  z.object({ status: z.literal("completed"), input: inputSchema, output: z.string(), time: z.object({ start: nativeCursorSchema.shape.time, end: nativeCursorSchema.shape.time, compacted: nativeCursorSchema.shape.time.optional() }), attachments: z.array(z.unknown()).optional() }),
  z.object({ status: z.literal("error"), input: inputSchema, error: z.string(), time: z.object({ start: nativeCursorSchema.shape.time, end: nativeCursorSchema.shape.time }) }),
]);
const wirePartSchema = z.union([
  z.object({ ...partBase, type: z.literal("text"), text: z.string(), synthetic: z.boolean().optional(), ignored: z.boolean().optional() }),
  z.object({ ...partBase, type: z.literal("tool"), tool: z.string(), state: toolStateSchema }),
  z.object({ ...partBase, type: z.string().refine((type) => type !== "text" && type !== "tool") }),
]);
const wireMessagesSchema = z.array(z.object({ info: wireInfoSchema, parts: z.array(wirePartSchema) }));
type WirePart = z.infer<typeof wirePartSchema>;

function boundedInput(input: Record<string, unknown>, config: DiscoveryConfig) {
  let nodes = 0;
  let omitted = false;
  let redacted = false;
  function walk(value: unknown, depth: number): unknown {
    if (++nodes > 128 || depth > 4) { omitted = true; return "[Input omitted]"; }
    if (typeof value === "string") {
      const next = redact(value, config);
      redacted ||= next !== value;
      return next;
    }
    if (value === null || typeof value === "boolean" || typeof value === "number") return value;
    if (Array.isArray(value)) {
      const result: unknown[] = [];
      for (const child of value) {
        if (nodes >= 128) { omitted = true; result.push("[Input omitted]"); break; }
        result.push(walk(child, depth + 1));
      }
      return result;
    }
    const object = z.record(z.string(), z.unknown()).safeParse(value);
    if (!object.success) { omitted = true; return "[Input omitted]"; }
    const entries: [string, unknown][] = [];
    for (const [key, child] of Object.entries(object.data)) {
      if (nodes >= 128) { omitted = true; entries.push(["omitted", "[Input omitted]"]); break; }
      const safeKey = redact(key, config);
      redacted ||= safeKey !== key;
      if (/(?:password|passwd|secret|token|api[_-]?key|private[_-]?key|authorization)/i.test(key)) {
        redacted = true;
        entries.push([safeKey, "[REDACTED]"]);
        nodes++;
      } else entries.push([safeKey, walk(child, depth + 1)]);
    }
    return Object.fromEntries(entries);
  }
  return { text: JSON.stringify(walk(input, 0)), omitted, redacted };
}

function omissionReason(type: string): Extract<HistoryPart, { kind: "omitted" }>["reason"] {
  switch (type) {
    case "reasoning": case "file": case "snapshot": case "patch": case "agent": case "compaction":
    case "subtask": case "retry": case "step-start": case "step-finish": return type;
    default: return "unsupported";
  }
}

function projectPart(part: WirePart, config: DiscoveryConfig): HistoryPart {
  const binding = { id: part.id, sessionID: part.sessionID, messageID: part.messageID };
  if (part.type === "text" && "text" in part) return {
    ...binding, kind: "text", content: projectText(part.text, config, 4096), synthetic: part.synthetic ?? false, ignored: part.ignored ?? false,
  };
  if (part.type === "tool" && "state" in part) {
    const args = boundedInput(part.state.input, config);
    const inputText = byteClip(args.text, 4096);
    const input = { text: inputText, redacted: args.redacted, truncated: args.omitted || inputText !== args.text };
    const output = part.state.status === "completed" && part.state.time.compacted === undefined
      ? projectText(part.state.output, config, 4096 - Buffer.byteLength(input.text, "utf8")) : null;
    return { ...binding, kind: "recorded-tool", name: projectText(part.tool, config, 160), status: part.state.status, input, output,
      omitted: args.omitted || part.state.status === "error" || (part.state.status === "completed" && (part.state.attachments?.length !== undefined && part.state.attachments.length > 0 || part.state.time.compacted !== undefined)) };
  }
  return { ...binding, kind: "omitted", reason: omissionReason(part.type), count: 1 };
}

function projectMessages(raw: unknown, selected: ScopedSession, config: DiscoveryConfig, before: NativeCursor | null): HistoryMessage[] {
  const count = z.array(z.unknown()).safeParse(raw);
  if (count.success && count.data.length > 5) throw new HistoryFailure("limit-exceeded");
  const parsed = wireMessagesSchema.safeParse(raw);
  if (!parsed.success) throw new HistoryFailure("unsupported");
  const messageIDs = new Set<string>();
  const partIDs = new Set<string>();
  let previous: NativeCursor | null = null;
  for (const message of parsed.data) {
    const tuple = { id: message.info.id, time: message.info.time.created };
    if (message.info.sessionID !== selected.id || messageIDs.has(message.info.id) ||
        (previous && !older(previous, tuple)) || (before && !older(tuple, before))) throw new HistoryFailure("malformed");
    messageIDs.add(message.info.id);
    previous = tuple;
    for (const id of [message.info.id, message.info.sessionID]) if (redact(id, config) !== id) throw new HistoryFailure("malformed");
    for (const part of message.parts) {
      if (part.sessionID !== selected.id || part.messageID !== message.info.id || partIDs.has(part.id) ||
          [part.id, part.messageID, part.sessionID].some((id) => redact(id, config) !== id)) throw new HistoryFailure("malformed");
      partIDs.add(part.id);
    }
  }
  let budget = 50;
  return parsed.data.map((message, index) => {
    const reserve = parsed.data.slice(index + 1).filter((item) => item.parts.length > 0).length;
    const available = budget - reserve;
    const take = message.parts.length > available ? Math.max(0, available - 1) : message.parts.length;
    const parts = message.parts.slice(0, take).map((part) => projectPart(part, config));
    const omittedParts = message.parts.length - take;
    const marker = message.parts[take];
    if (omittedParts > 0 && marker) parts.push({ id: marker.id, sessionID: marker.sessionID, messageID: marker.messageID, kind: "omitted", reason: "page-limit", count: omittedParts });
    budget -= parts.length;
    return { id: message.info.id, sessionID: message.info.sessionID, role: message.info.role,
      time: { created: message.info.time.created, completed: "completed" in message.info.time ? message.info.time.completed ?? null : null },
      agent: message.info.agent === undefined ? null : projectText(message.info.agent, config, 160), parts, omittedParts };
  });
}

function fitHistoryPage(page: HistoryPage): HistoryPage {
  if (Buffer.byteLength(JSON.stringify(page), "utf8") <= 65536) return page;
  page.truncated = true;
  for (const message of [...page.messages].reverse()) {
    for (let index = message.parts.length - 1; index >= 0; index--) {
      const part = message.parts[index];
      if (part.kind === "omitted") continue;
      message.parts[index] = { id: part.id, sessionID: part.sessionID, messageID: part.messageID, kind: "omitted", reason: "page-limit", count: 1 };
      message.omittedParts++;
      page.omittedParts++;
      if (Buffer.byteLength(JSON.stringify(page), "utf8") <= 65536) return page;
    }
  }
  throw new HistoryFailure("limit-exceeded");
}

const privateHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  Vary: "Cookie, Origin, Sec-Fetch-Site",
};

function dtoResponse(dto: OpenCodeDiscovery | OpenCodeHistory, status = 200): Response {
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

  async function providerReply(config: DiscoveryConfig, endpoint: URL, cap: number, signal: AbortSignal): Promise<{ data: unknown; next: string | null }> {
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
    return { data: await boundedJSON(response.body, cap, signal), next: response.headers.get("x-next-cursor") };
  }

  async function providerJSON(config: DiscoveryConfig, endpoint: URL, cap: number, signal: AbortSignal): Promise<unknown> {
    return (await providerReply(config, endpoint, cap, signal)).data;
  }

  function listingURL(config: DiscoveryConfig): URL {
    const endpoint = new URL("/api/session", config.providerOrigin);
    endpoint.searchParams.set("directory", config.directory);
    endpoint.searchParams.set("limit", "50");
    endpoint.searchParams.set("order", "desc");
    return endpoint;
  }

  function legacyURL(config: DiscoveryConfig, session: ScopedSession, messages = false): URL {
    const endpoint = new URL(`/session/${encodeURIComponent(session.id)}${messages ? "/message" : ""}`, config.providerOrigin);
    endpoint.searchParams.set("directory", config.directory);
    if (messages) endpoint.searchParams.set("limit", "5");
    return endpoint;
  }

  async function history(config: DiscoveryConfig, request: Request, owner: z.infer<typeof cookiePayloadSchema>): Promise<OpenCodeHistory> {
    const profile = openCodeHistoryProfile(getEnv());
    if (profile === null || getEnv().PIXEL_OPENCODE_HISTORY_PROFILE !== profile) return {
      kind: "unsupported-profile", message: "History needs an enrolled plugin-free OpenCode connection. Metadata discovery remains available.",
    };
    const selection = sessionIDSchema.safeParse(request.headers.get("x-pixel-history-session"));
    if (!selection.success) return historyFailure(new HistoryFailure("selection-unavailable"));
    const token = request.headers.get("x-pixel-history-cursor");
    let incoming: CursorClaims | null;
    try { incoming = token === null ? null : openCursor(token, config, owner, selection.data, profile, now()); }
    catch (error) { return historyFailure(error); }
    if (inFlight >= 2) return historyFailure(new HistoryFailure("busy"));
    inFlight++;
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    request.signal.addEventListener("abort", onAbort, { once: true });
    if (request.signal.aborted) controller.abort();
    const timer = setTimeout(() => controller.abort(), deadlineMs);
    try {
      const health = healthSchema.safeParse(await providerJSON(config, new URL("/global/health", config.providerOrigin), 4096, controller.signal));
      if (!health.success) throw new HistoryFailure("malformed");
      if (health.data.version !== "1.18.35") throw new HistoryFailure("unsupported");
      const fresh = projectPage(await providerJSON(config, listingURL(config), 262144, controller.signal), config);
      if (fresh.kind !== "ready") throw new HistoryFailure("malformed");
      const selected = fresh.records.find(record => record.id === selection.data);
      if (!selected) throw new HistoryFailure("selection-unavailable");
      if (incoming && (incoming.project !== selected.projectID || incoming.workspace !== selected.workspaceID)) throw new HistoryFailure("invalid-cursor");
      requireLegacyScope(await providerJSON(config, legacyURL(config, selected), 262144, controller.signal), selected, config);
      const endpoint = legacyURL(config, selected, true);
      if (incoming) endpoint.searchParams.set("before", Buffer.from(JSON.stringify(incoming.native)).toString("base64url"));
      const reply = await providerReply(config, endpoint, 262144, controller.signal);
      const messages = projectMessages(reply.data, selected, config, incoming?.native ?? null);
      const next = reply.next === null ? null : decodeNativeCursor(reply.next);
      if (next && (messages.length === 0 || next.id !== messages[0].id || next.time !== messages[0].time.created || (incoming && !older(next, incoming.native)))) throw new HistoryFailure("malformed");
      try { requireLegacyScope(await providerJSON(config, legacyURL(config, selected), 262144, controller.signal), selected, config); }
      catch (error) { if (error instanceof ReadFailure) throw error; throw new HistoryFailure("scope-changed"); }
      const last = projectPage(await providerJSON(config, listingURL(config), 262144, controller.signal), config);
      const ending = last.kind === "ready" ? last.records.find(record => record.id === selected.id) : undefined;
      if (!ending || !sameScope(selected, ending)) throw new HistoryFailure("scope-changed");
      const current = readConfig(getEnv());
      if (current.kind !== "configured" || current.config.origin !== config.origin ||
          !sameSecret(current.config.secret, config.secret) || openCodeHistoryProfile(getEnv()) !== profile ||
          getEnv().PIXEL_OPENCODE_HISTORY_PROFILE !== profile) throw new HistoryFailure("scope-changed");
      const checked = now();
      const renewed = authorizedCookie(request, config, checked);
      if (!renewed || renewed.nonce !== owner.nonce || checked >= owner.expires || (incoming && checked >= incoming.expires)) throw new HistoryFailure("expired");
      const expires = Math.min(checked + HISTORY_TTL, owner.expires, incoming?.expires ?? Number.MAX_SAFE_INTEGER);
      const olderCursor = next === null ? null : sealCursor({ purpose: HISTORY_PURPOSE, version: 1, session: selected.id,
        project: selected.projectID, workspace: selected.workspaceID, directory: workspaceKey(config.directory), profile,
        cookieNonce: owner.nonce, limit: 5, order: "backward", native: next, issued: checked, expires }, config);
      const page = fitHistoryPage({ kind: "history-page", session: selected, messages, limit: 5, order: "chronological", olderCursor, expires,
        omittedParts: messages.reduce((total, message) => total + message.omittedParts, 0),
        truncated: messages.some(message => message.omittedParts > 0 || message.parts.some(part => part.kind === "text" ? part.content.truncated : part.kind === "recorded-tool" && (part.input.truncated || part.output?.truncated || part.name.truncated))) });
      return openCodeHistorySchema.parse(page);
    } catch (error) { return historyFailure(error); }
    finally { clearTimeout(timer); request.signal.removeEventListener("abort", onAbort); inFlight--; }
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
    const isHistory = new URL(request.url).pathname === HISTORY_PATH;
    if (!boundaryAllowed(request, config, isHistory)) return denied();
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
    const owner = authorizedCookie(request, config, now());
    if (!owner) return denied();
    if (isHistory) {
      const result = await history(config, request, owner);
      return dtoResponse(result, result.kind === "unsupported-profile" ? 503 : result.kind === "failure" && result.problem.code === "busy" ? 429 : 200);
    }
    return dtoResponse(await discover(config, request));
  }

  return { handle };
}

declare global {
  var pixelOpenCodeReadService: ReturnType<typeof createOpenCodeDiscoveryService> | undefined;
}

export const openCodeReadService = globalThis.pixelOpenCodeReadService ??= createOpenCodeDiscoveryService();
