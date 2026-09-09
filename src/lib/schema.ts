import { z } from "zod";

function trimPrompt(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim().slice(0, 200);
  return trimmed;
}

export const todoSchema = z.object({
  content: z.string().optional(),
  text: z.string().optional(),
  status: z.string().optional(),
  state: z.string().optional(),
  priority: z.string().optional(),
  activeForm: z.string().optional(),
});

export type Todo = z.infer<typeof todoSchema> & Record<string, unknown>;

export const ingestKindSchema = z.enum([
  "subtask.start",
  "subtask.end",
  "session.busy",
  "session.idle",
  "session.created",
  "tool.before",
  "tool.after",
  "todo.updated",
  "agent.status",
]);

export const ingestKindV2Schema = z.enum([
  "session.upsert",
  "actor.activity",
  "invocation.requested",
  "invocation.started",
  "invocation.finished",
]);

export const ingestStatusSchema = z.enum(["working", "idle"]);
export const invocationStatusSchema = z.enum([
  "requested",
  "started",
  "finished",
  "failed",
  "cancelled",
]);
export const taskCategorySchema = z.enum([
  "research",
  "design",
  "implementation",
  "testing",
  "operations",
  "other",
]);

export const ingestDetailSchema = z
  .object({
    prompt: z
      .string()
      .optional()
      .transform((v) => (v === undefined ? undefined : v.trim().slice(0, 200))),
    tool: z.string().optional(),
    todos: z.array(todoSchema.passthrough()).optional(),
  })
  .passthrough()
  .optional();

export const ingestDetailV2Schema = z
  .object({
    parentSessionId: z.string().optional().nullable(),
    rootSessionId: z.string().optional(),
    callId: z.string().optional(),
    parentInvocationId: z.string().optional().nullable(),
    revision: z.number().int().nonnegative().optional(),
    agentKey: z.string().optional(),
    senderActorId: z.string().optional(),
    recipientActorId: z.string().optional(),
    invocationStatus: invocationStatusSchema.optional(),
    outcome: z.enum(["succeeded", "failed", "cancelled", "unknown"]).optional().nullable(),
    taskCategory: taskCategorySchema.optional().nullable(),
    promptPreview: z.string().optional().nullable(),
  })
  .passthrough()
  .optional();

export const ingestPayloadSchema = z.object({
  v: z.literal(1),
  ts: z.number().int().nonnegative(),
  sessionID: z.string().min(1, "sessionID required"),
  project: z.string().min(1, "project required"),
  title: z.string().max(200).optional(),
  agent: z.string().min(1, "agent required"),
  kind: ingestKindSchema,
  status: ingestStatusSchema,
  detail: ingestDetailSchema,
});

export const ingestPayloadV2Schema = z.object({
  v: z.literal(2),
  eventId: z.string().min(1),
  producerId: z.string().optional(),
  projectId: z.string().min(1, "projectId required"),
  sessionId: z.string().min(1, "sessionId required"),
  rootSessionId: z.string().min(1, "rootSessionId required"),
  parentSessionId: z.string().optional().nullable(),
  occurredAt: z.number().int().nonnegative(),
  kind: ingestKindV2Schema,
  detail: ingestDetailV2Schema,
});

export const anyIngestPayloadSchema = z.union([
  ingestPayloadSchema,
  ingestPayloadV2Schema,
]);

export type IngestPayload = z.infer<typeof ingestPayloadSchema>;
export type IngestPayloadV2 = z.infer<typeof ingestPayloadV2Schema>;
export type AnyIngestPayload = z.infer<typeof anyIngestPayloadSchema>;
export type IngestKind = z.infer<typeof ingestKindSchema>;
export type IngestKindV2 = z.infer<typeof ingestKindV2Schema>;
export type IngestStatus = z.infer<typeof ingestStatusSchema>;
export type InvocationStatus = z.infer<typeof invocationStatusSchema>;
export type TaskCategory = z.infer<typeof taskCategorySchema>;

export function normalizePrompt(prompt: string | undefined): string | undefined {
  return trimPrompt(prompt);
}

export function isV1Payload(payload: AnyIngestPayload): payload is IngestPayload {
  return payload.v === 1;
}

export function isV2Payload(payload: AnyIngestPayload): payload is IngestPayloadV2 {
  return payload.v === 2;
}