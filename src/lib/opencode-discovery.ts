import { z } from "zod";

export const nativeIDSchema = z.string().min(1).max(256).regex(/^[A-Za-z0-9_.:-]+$/).refine(value => value !== "." && value !== "..");
const nativeID = nativeIDSchema;
export const sessionIDSchema = nativeID.brand<"OpenCodeSessionID">();
const sessionID = sessionIDSchema;
export const messageIDSchema = nativeID.regex(/^msg/).brand<"OpenCodeMessageID">();
export const partIDSchema = nativeID.regex(/^prt/).brand<"OpenCodePartID">();
const timestamp = z.number().int().nonnegative().max(8_640_000_000_000_000);

export const discoveryProblemSchema = z.object({
  code: z.enum(["unauthorized", "unreachable", "unsupported", "malformed", "limit-exceeded", "busy"]),
  message: z.string().max(240),
}).strict();
export type DiscoveryProblem = z.infer<typeof discoveryProblemSchema>;

export const discoverySessionSchema = z.object({
  id: sessionID,
  projectID: nativeID.brand<"OpenCodeProjectID">(),
  parentID: sessionID.nullable(),
  parentResolution: z.enum(["not-reported", "in-page", "outside-page"]),
  workspaceID: nativeID.brand<"OpenCodeWorkspaceID">().nullable(),
  title: z.string().max(160),
  titleTruncated: z.boolean(),
  time: z.object({ created: timestamp, updated: timestamp, archived: timestamp.nullable() }).strict(),
}).strict();
export type DiscoverySession = z.infer<typeof discoverySessionSchema>;

const connectionSchema = z.object({
  provider: z.literal("opencode"),
  connectionID: z.literal("configured-opencode"),
  directoryDisplay: z.literal("Configured workspace"),
}).strict();

export const discoverySessionsSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("ready"),
    records: z.array(discoverySessionSchema).max(50),
    count: z.number().int().min(0).max(50),
    limit: z.literal(50),
    order: z.literal("creation-desc"),
  }).strict(),
  z.object({ kind: z.literal("failure"), problem: discoveryProblemSchema }).strict(),
]);
export type DiscoverySessions = z.infer<typeof discoverySessionsSchema>;

export const openCodeDiscoverySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("not-configured"), message: z.string().max(240) }).strict(),
  z.object({ kind: z.literal("invalid-config"), message: z.string().max(240) }).strict(),
  z.object({ kind: z.literal("auth-failure"), scope: z.literal("app"), message: z.string().max(240) }).strict(),
  z.object({ kind: z.literal("health-failure"), connection: connectionSchema, problem: discoveryProblemSchema }).strict(),
  z.object({
    kind: z.literal("snapshot"),
    connection: connectionSchema,
    health: z.object({ kind: z.literal("healthy"), version: z.string().min(1).max(64) }).strict(),
    sessions: discoverySessionsSchema,
  }).strict(),
]);
export type OpenCodeDiscovery = z.infer<typeof openCodeDiscoverySchema>;

const historyTextSchema = z.object({
  text: z.string().refine((value) => new TextEncoder().encode(value).byteLength <= 4096),
  redacted: z.boolean(),
  truncated: z.boolean(),
}).strict();
const historyPartBinding = { id: partIDSchema, sessionID, messageID: messageIDSchema };
export const historyPartSchema = z.discriminatedUnion("kind", [
  z.object({ ...historyPartBinding, kind: z.literal("text"), content: historyTextSchema, synthetic: z.boolean(), ignored: z.boolean() }).strict(),
  z.object({
    ...historyPartBinding, kind: z.literal("recorded-tool"), name: historyTextSchema,
    status: z.enum(["pending", "running", "completed", "error"]),
    input: historyTextSchema, output: historyTextSchema.nullable(), omitted: z.boolean(),
  }).strict(),
  z.object({
    ...historyPartBinding, kind: z.literal("omitted"),
    reason: z.enum(["reasoning", "file", "snapshot", "patch", "agent", "compaction", "subtask", "retry", "step-start", "step-finish", "unsupported", "page-limit"]),
    count: z.number().int().positive(),
  }).strict(),
]);
export type HistoryPart = z.infer<typeof historyPartSchema>;
export const historyMessageSchema = z.object({
  id: messageIDSchema, sessionID, role: z.enum(["user", "assistant"]),
  time: z.object({ created: timestamp, completed: timestamp.nullable() }).strict(),
  agent: historyTextSchema.nullable(), parts: z.array(historyPartSchema).max(50), omittedParts: z.number().int().nonnegative(),
}).strict();
export type HistoryMessage = z.infer<typeof historyMessageSchema>;
export const historyProblemSchema = z.object({
  code: z.enum(["unauthorized", "unreachable", "unsupported", "malformed", "limit-exceeded", "busy", "selection-unavailable", "scope-changed", "invalid-cursor", "expired"]),
  message: z.string().max(240),
}).strict();
export type HistoryProblem = z.infer<typeof historyProblemSchema>;
export const openCodeHistorySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("not-configured"), message: z.string().max(240) }).strict(),
  z.object({ kind: z.literal("invalid-config"), message: z.string().max(240) }).strict(),
  z.object({ kind: z.literal("unsupported-profile"), message: z.string().max(240) }).strict(),
  z.object({ kind: z.literal("auth-failure"), scope: z.literal("app"), message: z.string().max(240) }).strict(),
  z.object({ kind: z.literal("failure"), problem: historyProblemSchema }).strict(),
  z.object({
    kind: z.literal("history-page"), session: discoverySessionSchema,
    messages: z.array(historyMessageSchema).max(5), limit: z.literal(5), order: z.literal("chronological"),
    olderCursor: z.string().max(8192).nullable(), expires: timestamp,
    omittedParts: z.number().int().nonnegative(), truncated: z.boolean(),
  }).strict(),
]);
export type OpenCodeHistory = z.infer<typeof openCodeHistorySchema>;
export type HistoryPage = Extract<OpenCodeHistory, { kind: "history-page" }>;

export function discoveryStatusText(result: OpenCodeDiscovery): string {
  switch (result.kind) {
    case "not-configured":
    case "invalid-config":
    case "auth-failure":
      return result.message;
    case "health-failure":
      return result.problem.message;
    case "snapshot":
      return result.sessions.kind === "ready"
        ? `OpenCode ${result.health.version} is healthy. ${result.sessions.count} persisted records returned.`
        : `OpenCode ${result.health.version} is healthy. ${result.sessions.problem.message}`;
    default: {
      const exhaustive: never = result;
      return exhaustive;
    }
  }
}
