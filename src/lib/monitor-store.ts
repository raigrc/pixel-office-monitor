import { IngestPayload, IngestPayloadV2, AnyIngestPayload, isV1Payload, isV2Payload } from "./schema";
import {
  SessionInfo,
  FloorInfo,
  ActorInfo,
  InvocationInfo,
  InvocationStatus,
  MonitorEvent,
  EventType,
  SnapshotEnvelope,
  DeltaEnvelope,
  RuntimeState,
  deriveFloorId,
  deriveActorId,
  deriveInvocationId,
  generateEventId,
  generateEpoch,
  TASK_CATEGORIES,
  type TaskCategory,
  type CubicleLegacy,
} from "./monitor-types";
import { isSupabaseEnabled } from "./supabase";
import { seatForAgent, ROSTER_KEYS, STANDING_ADMIN } from "./scene/roster";
import { AWAKE_WINDOW_MS } from "./scene/actor-pose";

export type CubicleDTO = CubicleLegacy;

export type FloorDTO = {
  sessionID: string;
  title?: string;
  project: string;
  status: IngestPayload["status"];
  updatedAt: number;
  cubicles: CubicleDTO[];
};

export type MonitorState = {
  floors: FloorDTO[];
};

export type { SnapshotEnvelope } from "./monitor-types";

type Store = Map<string, FloorInfo>;

declare global {
  var __PIXEL_MONITOR_STORE__: Store | undefined;
  var __PIXEL_MONITOR_RUNTIME__: RuntimeState | undefined;
}

function getStore(): Store {
  if (!globalThis.__PIXEL_MONITOR_STORE__) {
    globalThis.__PIXEL_MONITOR_STORE__ = new Map<string, FloorInfo>();
  }
  return globalThis.__PIXEL_MONITOR_STORE__;
}

function getRuntime(): RuntimeState {
  if (!globalThis.__PIXEL_MONITOR_RUNTIME__) {
    globalThis.__PIXEL_MONITOR_RUNTIME__ = {
      epoch: generateEpoch(),
      sequence: 0,
      sessions: new Map(),
      floors: new Map(),
      actors: new Map(),
      invocations: new Map(),
      eventRing: [],
      dedupeIndex: new Map(),
    };
  }
  return globalThis.__PIXEL_MONITOR_RUNTIME__;
}

function ensureFloor(runtime: RuntimeState, floorId: string, sessionId: string, projectId: string, title?: string): FloorInfo {
  let floor = runtime.floors.get(floorId);
  const now = Date.now();
  if (!floor) {
    floor = {
      floorId,
      rootSessionId: sessionId,
      projectId,
      title: title ?? `Floor ${sessionId.slice(0, 8)}`,
      createdAt: now,
      updatedAt: now,
      closed: false,
      sessionId,
    };
    runtime.floors.set(floorId, floor);
  } else if (title && floor.title !== title) {
    floor.title = title;
    floor.updatedAt = now;
  }
  return floor;
}

function ensureSession(runtime: RuntimeState, sessionId: string, parentSessionId: string | null, rootSessionId: string, projectId: string, title?: string): SessionInfo {
  let session = runtime.sessions.get(sessionId);
  const now = Date.now();
  if (!session) {
    session = {
      sessionId,
      parentSessionId,
      rootSessionId,
      projectId,
      status: "active",
      title: title ?? null,
      createdAt: now,
      updatedAt: now,
      closedAt: null,
    };
    runtime.sessions.set(sessionId, session);
  } else {
    session.updatedAt = now;
    if (title && session.title !== title) session.title = title;
    if (parentSessionId && !session.parentSessionId) session.parentSessionId = parentSessionId;
  }
  return session;
}

/**
 * Fixed-desk roster room: one actor per (floor, agentKey). A repeat call for
 * the same agent lands on the SAME cubicle (busy badge counts the extra work)
 * instead of opening a new desk. Seats never leak because they never move.
 */
export function floorActorByKey(
  runtime: RuntimeState,
  floorId: string,
  agentKey: string,
  includeSystem = false
): ActorInfo | undefined {
  const want = (agentKey ?? "").trim().toLowerCase();
  for (const actor of runtime.actors.values()) {
    if (actor.floorId !== floorId) continue;
    if ((actor.agentKey ?? "").toLowerCase() !== want) continue;
    if (actor.role === "system" && !includeSystem) continue;
    return actor;
  }
  return undefined;
}

/** Floors already seeded with the sleeping roster (runtime-only, not serialized). */
const seededFloors = new Set<string>();

/**
 * Seed-schema epoch. Bump when seeding/remap rules change so live floors
 * reheal on their next event instead of drifting forever.
 */
const ROSTER_EPOCH = 2;
const floorSeedEpoch = new Map<string, number>();

function seatRoleFor(agentKey: string): ActorInfo["role"] {
  const key = (agentKey ?? "").trim().toLowerCase();
  if (key === "orchestrator") return "orchestrator";
  if (key === "system" || key === "title" || key === "summary" || key === "compaction") return "system";
  return "specialist";
}

function ensureActor(runtime: RuntimeState, actorId: string, floorId: string, sessionId: string, agentKey: string): ActorInfo {
  let actor = runtime.actors.get(actorId);
  const now = Date.now();
  if (!actor) {
    // Fixed seat per roster key. Hidden signals and the standing admin take
    // no seat (-1) and never render at desks.
    const seatIndex = seatForAgent(agentKey);
    actor = {
      actorId,
      floorId,
      sessionId,
      agentKey,
      displayName: agentKey,
      role: seatRoleFor(agentKey),
      seatIndex,
      lastObservedAt: now,
      createdAt: now,
    };
    runtime.actors.set(actorId, actor);
  } else {
    actor.lastObservedAt = now;
  }
  return actor;
}

/**
 * Pre-occupy a fresh floor: every roster agent gets a sleeping desk (lamp
 * off, monitor off) the moment a session is detected — never an empty room.
 * Backfills live floors missing keys and remaps drifted seats to fixed ones.
 */
function seedFloorRoster(
  runtime: RuntimeState,
  floor: FloorInfo,
  projectId: string,
  rootSessionId: string,
  now: number
): void {
  // Remap every desk actor to its fixed seat (heals pre-roster dynamic
  // seats live; unknowns share the intern corner).
  for (const actor of runtime.actors.values()) {
    if (actor.floorId !== floor.floorId || actor.role === "system") continue;
    actor.seatIndex = seatForAgent(actor.agentKey);
  }
  for (const key of ROSTER_KEYS) {
    const existing = floorActorByKey(runtime, floor.floorId, key);
    if (existing) {
      continue;
    }
    const actorId = deriveActorId(projectId, rootSessionId, key);
    const actor: ActorInfo = {
      actorId,
      floorId: floor.floorId,
      sessionId: rootSessionId,
      agentKey: key,
      displayName: key,
      role: key === STANDING_ADMIN ? "orchestrator" : "specialist",
      seatIndex: seatForAgent(key),
      lastObservedAt: now,
      createdAt: now,
      activity: "idle",
      idleSince: now,
    };
    runtime.actors.set(actorId, actor);
  }
  seededFloors.add(floor.floorId);
}

/** Trailing segment of a derived actor id is its agent key. */
function agentKeyFromActorId(actorId: string): string {
  const i = actorId.lastIndexOf(":");
  return i >= 0 ? actorId.slice(i + 1) : actorId;
}

/**
 * Rewrite a plugin-derived actor id onto the merged floor actor, so links
 * stay correct when the same agent reports from different sessions.
 */
function resolveActorId(runtime: RuntimeState, floorId: string, rawId: string): string {
  const merged = floorActorByKey(runtime, floorId, agentKeyFromActorId(rawId));
  return merged ? merged.actorId : rawId;
}

/**
 * Fold an orphaned self-root floor into the true root floor once parent
 * lineage arrives late. Same-key actors merge (freshest wins); the rest move
 * over. The ghost floor is deleted immediately — no lingering empty rooms.
 */
function healGhostFloor(
  runtime: RuntimeState,
  store: Store,
  ghostFloorId: string,
  floor: FloorInfo
): void {
  if (ghostFloorId === floor.floorId) return;
  const ghost = store.get(ghostFloorId) ?? runtime.floors.get(ghostFloorId);
  if (!ghost) return;
  // Fold actors over (merge same keys, move the rest incl. system signals).
  const foldedIds = new Map<string, string>();
  for (const actor of Array.from(runtime.actors.values())) {
    if (actor.floorId !== ghostFloorId) continue;
    if (actor.role !== "system") {
      const existing = floorActorByKey(runtime, floor.floorId, actor.agentKey);
      if (existing && existing.actorId !== actor.actorId) {
        if (actor.lastObservedAt > existing.lastObservedAt) {
          existing.lastObservedAt = actor.lastObservedAt;
          existing.sessionId = actor.sessionId;
          if (actor.activity) existing.activity = actor.activity;
          if (actor.idleSince != null) existing.idleSince = actor.idleSince;
          if (actor.displayName) existing.displayName = actor.displayName;
        }
        foldedIds.set(actor.actorId, existing.actorId);
        runtime.actors.delete(actor.actorId);
        continue;
      }
    }
    actor.floorId = floor.floorId;
  }
  // Move invocations over and rewrite links off deleted ghost actor ids.
  for (const inv of runtime.invocations.values()) {
    if (inv.floorId !== ghostFloorId) continue;
    inv.floorId = floor.floorId;
    const s = foldedIds.get(inv.senderActorId);
    const r = foldedIds.get(inv.recipientActorId);
    if (s) inv.senderActorId = s;
    if (r) inv.recipientActorId = r;
  }
  store.delete(ghostFloorId);
  runtime.floors.delete(ghostFloorId);
  seededFloors.delete(ghostFloorId);
  floorSeedEpoch.delete(ghostFloorId);
  emitEvent(runtime, "floor.deleted", { floorId: ghostFloorId });
}

function ensureInvocation(
  runtime: RuntimeState,
  invocationId: string,
  floorId: string,
  senderActorId: string,
  recipientActorId: string,
  callId: string,
  parentInvocationId: string | null,
  agentKey: string,
  promptPreview: string | null,
  taskCategory: TaskCategory | null,
): InvocationInfo {
  let invocation = runtime.invocations.get(invocationId);
  const now = Date.now();
  if (!invocation) {
    invocation = {
      invocationId,
      floorId,
      senderActorId,
      recipientActorId,
      callId,
      parentInvocationId,
      revision: 0,
      executionStatus: "requested",
      outcome: null,
      taskCategory,
      promptPreview,
      requestedAt: now,
      startedAt: null,
      finishedAt: null,
    };
    runtime.invocations.set(invocationId, invocation);
  } else {
    invocation.revision += 1;
  }
  return invocation;
}

function updateInvocationStatus(
  runtime: RuntimeState,
  invocationId: string,
  status: InvocationStatus,
  outcome: InvocationInfo["outcome"] = null,
): InvocationInfo | null {
  const invocation = runtime.invocations.get(invocationId);
  if (!invocation) return null;
  const now = Date.now();
  invocation.executionStatus = status;
  if (status === "started" && !invocation.startedAt) invocation.startedAt = now;
  if (status === "finished" || status === "failed" || status === "cancelled") {
    invocation.finishedAt = now;
    invocation.outcome = outcome;
  }
  invocation.revision += 1;
  return invocation;
}

function getActorActiveInvocations(runtime: RuntimeState, actorId: string): InvocationInfo[] {
  return Array.from(runtime.invocations.values()).filter(
    inv => (inv.senderActorId === actorId || inv.recipientActorId === actorId) &&
      (inv.executionStatus === "requested" || inv.executionStatus === "started")
  );
}

function getActorLastSuccessAt(actorId: string, runtime: RuntimeState): number | null {
  let latest: number | null = null;
  for (const inv of runtime.invocations.values()) {
    if (inv.finishedAt == null) continue;
    if (inv.outcome !== "succeeded" && inv.outcome !== "unknown") continue;
    if (inv.senderActorId !== actorId && inv.recipientActorId !== actorId) continue;
    if (latest == null || inv.finishedAt > latest) latest = inv.finishedAt;
  }
  return latest;
}

function deriveActorState(actorId: string, runtime: RuntimeState): CubicleLegacy["state"] {
  const actor = runtime.actors.get(actorId);

  // Live work first.
  const active = getActorActiveInvocations(runtime, actorId);
  if (active.length > 0) {
    if (!actor) return "working";
    if (actor.agentKey === "orchestrator") {
      return active.some(inv => inv.senderActorId === actorId) ? "delegating" : "thinking";
    }
    return "working";
  }

  // Just-finished success beat (monitor stays ON idle for the awake window).
  const lastSuccess = getActorLastSuccessAt(actorId, runtime);
  if (lastSuccess != null && Date.now() - lastSuccess < AWAKE_WINDOW_MS) {
    return "celebrating";
  }

  // Prefer V2 actor.activity state when available
  if (actor?.activity === "working") return "working";
  return "idle";
}

function emitEvent(
  runtime: RuntimeState,
  type: EventType,
  payload: unknown,
  causeEventId: string | null = null,
): MonitorEvent {
  runtime.sequence += 1;
  const eventId = generateEventId();
  const event: MonitorEvent = {
    eventId,
    epoch: runtime.epoch,
    sequence: runtime.sequence,
    type,
    causeEventId,
    timestamp: Date.now(),
    payload,
  };
  runtime.eventRing.push(event);
  if (runtime.eventRing.length > 2000) runtime.eventRing.shift();
  emitSSEEvent(event);
  // Feed /api/health metrics: every emitted event is a data point.
  // (Previously nothing ever called recordSSELatency, so lastEventAt was
  // permanently 0 and latency samples stayed empty.)
  recordSSELatency(event.timestamp);
  return event;
}

function buildSnapshot(runtime: RuntimeState): SnapshotEnvelope {
  return {
    v: 2,
    epoch: runtime.epoch,
    sequence: runtime.sequence,
    floors: Array.from(runtime.floors.values()),
    sessions: Array.from(runtime.sessions.values()),
    actors: Array.from(runtime.actors.values()),
    invocations: Array.from(runtime.invocations.values()),
  };
}

function buildDelta(
  runtime: RuntimeState,
  causeEventId: string,
  upserts: DeltaEnvelope["upserts"],
  removals: DeltaEnvelope["removals"],
): DeltaEnvelope {
  return {
    v: 2,
    epoch: runtime.epoch,
    sequence: runtime.sequence,
    causeEventId,
    upserts,
    removals,
  };
}

export function upsert(payload: AnyIngestPayload): FloorInfo | null {
  if (isSupabaseEnabled()) {
    // Placeholder for future Supabase delegation
  }

  const runtime = getRuntime();
  const store = getStore();
  const now = isV1Payload(payload) ? payload.ts : payload.occurredAt ?? Date.now();
  const projectId = isV1Payload(payload) ? payload.project : payload.projectId;

  if (isV1Payload(payload)) {
    const result = upsertV1(payload, runtime, store, now, projectId);
    // Auto-prune when store > 50 floors (v1 compatibility).
    // Wall-clock staleness must use real time: payload ts can be arbitrarily
    // old (backfill/replay), which would otherwise make prune a permanent no-op.
    if (store.size > 50) {
      prune();
    }
    return result;
  } else if (isV2Payload(payload)) {
    return upsertV2(payload, runtime, store, now, projectId);
  }
  return null;
}

function upsertV1(
  payload: IngestPayload,
  runtime: RuntimeState,
  store: Store,
  now: number,
  projectId: string,
): FloorInfo | null {
  const sessionId = payload.sessionID;
  // v1 backward compatibility: each sessionID gets its own floor
  const floorId = payload.sessionID;

  let floor = store.get(floorId);
  if (!floor) {
    floor = ensureFloor(runtime, floorId, sessionId, projectId, payload.title);
    floor.legacyCubicles = new Map();
    store.set(floorId, floor);
  } else {
    if (payload.title !== undefined) floor.title = payload.title;
    if (!floor.legacyCubicles) floor.legacyCubicles = new Map();
    floor.updatedAt = now;
  }

  // Legacy path renders from legacyCubicles only — it must not mint v2
  // roster actors (that would pin floors against prune and pollute counts).
  const actorId = deriveActorId(projectId, sessionId, payload.agent);

  const prompt = payload.detail?.prompt
    ? String(payload.detail.prompt).trim().slice(0, 200)
    : undefined;
  const lastTool = payload.detail?.tool
    ? String(payload.detail.tool).slice(0, 100)
    : undefined;
  const todos = payload.detail?.todos as Array<Record<string, unknown>> | undefined;

  const prevState = deriveActorState(actorId, runtime);
  let inferredState: CubicleLegacy["state"] = "idle";

  switch (payload.kind) {
    case "subtask.start":
      inferredState = "working";
      break;
    case "subtask.end":
      inferredState = "celebrating";
      break;
    case "agent.status":
      inferredState = payload.status === "working" ? "thinking" : "idle";
      break;
    case "session.busy":
      inferredState = payload.agent === "orchestrator" ? "thinking" : "delegating";
      break;
    case "session.idle":
      inferredState = "idle";
      break;
    default:
      inferredState = payload.status === "working" ? "working" : "idle";
  }

  if (prevState === "celebrating" && inferredState !== "celebrating") {
    inferredState = "idle";
  }

  const existingCubicle = floor.legacyCubicles?.get(payload.agent);
  const since = existingCubicle && existingCubicle.status === payload.status ? existingCubicle.since : now;
  const finalLastTool = lastTool ?? existingCubicle?.lastTool;
  const promptFinal = payload.detail && "prompt" in payload.detail ? prompt : (existingCubicle?.prompt);
  const todosFinal = todos !== undefined ? todos.slice(0, 20) : existingCubicle?.todos;

  const cubicle: CubicleLegacy = {
    agent: payload.agent,
    kind: payload.kind,
    status: payload.status,
    since,
    lastTool: finalLastTool,
    prompt: promptFinal,
    todos: todosFinal,
    state: inferredState,
    lastStateChange: prevState !== inferredState ? now : (existingCubicle?.lastStateChange ?? now),
  };

  floor.legacyCubicles!.set(payload.agent, cubicle);
  floor.updatedAt = now;

  emitEvent(runtime, "cubicle.updated", { floorId, cubicle });
  
  // Derive floor status from cubicles
  const hasWorkingCubicle = Array.from(floor.legacyCubicles!.values()).some(c => c.status === "working");
  const floorStatus = hasWorkingCubicle ? "working" : "idle";
  
  // Return compatible object for v1 tests
  return {
    sessionID: floor.floorId,
    title: floor.title,
    project: floor.projectId,
    status: floorStatus,
    updatedAt: floor.updatedAt,
    cubicles: floor.legacyCubicles,
  } as unknown as FloorInfo;
}

/**
 * Walk stored parent links to the true root session.
 * The claimed rootSessionId is only as good as the producer's memory:
 * missed or stale session.created events self-root every child into its
 * own floor. The stored lineage is the source of truth — fall back to the
 * claim only when no parent chain was ever recorded.
 */
function resolveRootSessionId(
  runtime: RuntimeState,
  sessionId: string,
  claimedRootSessionId: string,
): string {
  const seen = new Set<string>([sessionId]);
  let current = runtime.sessions.get(sessionId);
  while (current?.parentSessionId && !seen.has(current.parentSessionId)) {
    const parent = runtime.sessions.get(current.parentSessionId);
    if (!parent) break;
    seen.add(parent.sessionId);
    current = parent;
  }
  if (current && current.sessionId !== sessionId) return current.sessionId;
  return claimedRootSessionId;
}

function upsertV2(
  payload: IngestPayloadV2,
  runtime: RuntimeState,
  store: Store,
  now: number,
  projectId: string,
): FloorInfo | null {
  const { sessionId, rootSessionId, parentSessionId, kind, detail } = payload;

  const session = ensureSession(runtime, sessionId, parentSessionId ?? null, rootSessionId, projectId);
  // Group by true root, not by whatever the producer claimed.
  const resolvedRoot = resolveRootSessionId(runtime, sessionId, rootSessionId);
  session.rootSessionId = resolvedRoot;
  const floorId = deriveFloorId(projectId, resolvedRoot);

  const floor = ensureFloor(runtime, floorId, resolvedRoot, projectId);
  store.set(floorId, floor);
  // Freshness in event time: every signal keeps the floor alive.
  floor.updatedAt = now;

  // Parent linkage arrived late: fold the orphaned self-root floor in.
  healGhostFloor(runtime, store, deriveFloorId(projectId, rootSessionId), floor);

  // Pre-occupy the floor on first sight: full sleeping roster, no empty room.
  // Re-runs when the seed epoch bumps (live floors reheal instead of drift).
  if (floorSeedEpoch.get(floorId) !== ROSTER_EPOCH) {
    seedFloorRoster(runtime, floor, projectId, resolvedRoot, now);
    floorSeedEpoch.set(floorId, ROSTER_EPOCH);
  }

  const actorKey = detail?.agentKey ?? "unknown";
  // Merge by key: repeat calls for the same agent land on the SAME cubicle
  // even when reported from different sessions (parent subtask vs child
  // busyness). The merged actor tracks the latest reporting session.
  // Pure session signals (no agentKey) touch no actor — no junk desks.
  let actor: ActorInfo | null = null;
  if (detail?.agentKey) {
    // Hidden signals merge too (one system actor per floor, not per session).
    const mergedActor = floorActorByKey(runtime, floorId, actorKey, seatRoleFor(actorKey) === "system");
    if (mergedActor) {
      mergedActor.sessionId = sessionId;
      mergedActor.lastObservedAt = now;
      actor = mergedActor;
    } else {
      actor = ensureActor(runtime, deriveActorId(projectId, sessionId, actorKey), floorId, sessionId, actorKey);
    }
  }
  const actorId = actor?.actorId ?? deriveActorId(projectId, sessionId, actorKey);

  const callId = detail?.callId ?? `${sessionId}:${actorKey}:${Date.now()}`;
  const parentInvocationId = detail?.parentInvocationId ?? null;
  // Rewrite links onto merged floor actors so poses and busy counts stay
  // correct across sessions.
  const senderActorId = resolveActorId(runtime, floorId, detail?.senderActorId ?? actorId);
  const recipientActorId = resolveActorId(runtime, floorId, detail?.recipientActorId ?? actorId);
  const invocationId = deriveInvocationId(projectId, senderActorId, callId);
  const promptPreview = detail?.promptPreview ?? null;
  const taskCategory = detail?.taskCategory ?? null;
  const revision = detail?.revision ?? 0;

  switch (kind) {
    case "session.upsert": {
      emitEvent(runtime, "session.upsert", { floorId, session });
      break;
    }
    case "actor.activity": {
      // Persist activity state from V2 event payload
      const activityState = detail?.activity as "working" | "idle" | undefined;
      if (activityState && actor) {
        actor.activity = activityState;
        if (activityState === "idle") {
          actor.idleSince = now;
        } else {
          // Clear idleSince when actor becomes active
          actor.idleSince = undefined;
        }
      }
      if (actor) emitEvent(runtime, "actor.activity", { floorId, actor });
      break;
    }
    case "invocation.requested": {
      const invocation = ensureInvocation(
        runtime,
        invocationId,
        floorId,
        senderActorId,
        recipientActorId,
        callId,
        parentInvocationId,
        actorKey,
        promptPreview,
        taskCategory,
      );
      emitEvent(runtime, "invocation.requested", { floorId, invocation });
      break;
    }
    case "invocation.started": {
      const invocation = updateInvocationStatus(runtime, invocationId, "started");
      if (invocation) {
        emitEvent(runtime, "invocation.started", { floorId, invocation });
      }
      break;
    }
    case "invocation.finished": {
      const outcome = detail?.outcome ?? "unknown";
      const invocation = updateInvocationStatus(runtime, invocationId, "finished", outcome);
      if (!invocation) {
        // Unknown invocation (e.g. missed requested): still rest the named
        // desk so a lost finish can't leave it typing forever. No success
        // beat without a record — just idle.
        if ((outcome === "succeeded" || outcome === "unknown") && detail?.agentKey) {
          const named = floorActorByKey(runtime, floorId, detail.agentKey);
          if (named && named.floorId === floorId) {
            named.activity = "idle";
            named.idleSince = now;
            named.lastObservedAt = now;
          }
        }
      }
      if (invocation) {
        emitEvent(runtime, "invocation.finished", { floorId, invocation });
        // Roster room: nobody exits. Desks are permanent — a finished agent
        // rests in place (success beat, then monitor-ON idle, then sleep).
        // Mark involved actors idle when they have no other active work so
        // the success pose and awake window trigger correctly.
        for (const involvedId of [invocation.recipientActorId, invocation.senderActorId]) {
          const involved = runtime.actors.get(involvedId);
          if (!involved || involved.floorId !== floorId) continue;
          const stillActive = Array.from(runtime.invocations.values()).some(
            (inv) =>
              (inv.executionStatus === "requested" || inv.executionStatus === "started") &&
              (inv.senderActorId === involvedId || inv.recipientActorId === involvedId)
          );
          if (stillActive) continue;
          involved.activity = "idle";
          involved.idleSince = now;
          involved.lastObservedAt = now;
        }
      }
      break;
    }
  }

  return floor;
}

export function closeFloor(floorId: string): boolean {
  const runtime = getRuntime();
  const store = getStore();
  const floor = store.get(floorId);
  if (!floor) return false;

  floor.closed = true;
  emitEvent(runtime, "floor.closed", { floorId });
  return true;
}

export { closeFloor as deleteFloor };

export function renameFloor(floorId: string, title: string): FloorInfo | null {
  const runtime = getRuntime();
  const store = getStore();
  const floor = store.get(floorId);
  if (!floor) return null;

  floor.title = title.trim().slice(0, 50);
  emitEvent(runtime, "floor.updated", { floorId, title: floor.title });
  return floor;
}

export function prune(now: number = Date.now()): number {
  const runtime = getRuntime();
  const store = getStore();
  let removedFloors = 0;

  for (const [floorId, floor] of store) {
    // Prune stale cubicles first
    if (floor.legacyCubicles) {
      for (const [agent, cub] of floor.legacyCubicles) {
        if (now - cub.since > 24 * 60 * 60 * 1000 && cub.status === "idle") {
          floor.legacyCubicles.delete(agent);
          emitEvent(runtime, "cubicle.removed", { floorId, agent });
        }
      }
    }

    // A floor counts as occupied when v2 roster actors sit on it — a
    // sleeping pre-occupied office is NOT empty and must survive. Working
    // covers legacy cubicles, explicit working flags, and live invocations.
    const hasDeskActors = Array.from(runtime.actors.values()).some(
      a => a.floorId === floorId && a.role !== "system"
    );
    const hasWorkingActor = Array.from(runtime.actors.values()).some(
      a => a.floorId === floorId && a.role !== "system" && a.activity === "working"
    );
    const hasLiveInvocation = Array.from(runtime.invocations.values()).some(
      inv => inv.floorId === floorId &&
        (inv.executionStatus === "requested" || inv.executionStatus === "started")
    );
    // If floor idle and outdated, remove floor
    const hasWorkingCubicle = floor.legacyCubicles && Array.from(floor.legacyCubicles.values()).some(c => c.status === "working");
    const floorStatus = (hasWorkingCubicle || hasWorkingActor || hasLiveInvocation) ? "working" : "idle";
    const idleTooLong = floorStatus === "idle" && now - floor.updatedAt > 24 * 60 * 60 * 1000;
    // Also if floor has no cubicles and is old (>1h) prune it
    const emptyStale = (!floor.legacyCubicles || floor.legacyCubicles.size === 0) && !hasDeskActors && now - floor.updatedAt > 60 * 60 * 1000;
    if (idleTooLong || emptyStale) {
      reapFloor(runtime, store, floorId);
      removedFloors++;
      emitEvent(runtime, "floor.deleted", { floorId });
    }
  }

  return removedFloors;
}

/**
 * Fully reap a floor: store entry, runtime maps, seed marker. Otherwise
 * pruned floors linger in snapshots (state/snapshot diverge) and leak.
 */
function reapFloor(runtime: RuntimeState, store: Store, floorId: string): void {
  store.delete(floorId);
  runtime.floors.delete(floorId);
  for (const [id, actor] of Array.from(runtime.actors.entries())) {
    if (actor.floorId === floorId) runtime.actors.delete(id);
  }
  for (const inv of Array.from(runtime.invocations.values())) {
    if (inv.floorId === floorId) runtime.invocations.delete(inv.invocationId);
  }
  for (const [id, session] of Array.from(runtime.sessions.entries())) {
    if (deriveFloorId(session.projectId, session.rootSessionId) === floorId) {
      runtime.sessions.delete(id);
    }
  }
  seededFloors.delete(floorId);
  floorSeedEpoch.delete(floorId);
}

export function getState(): MonitorState {
  const runtime = getRuntime();
  const store = getStore();

  // Closed floors stay in the ring for history but never render or count.
  const floorDTOs: FloorDTO[] = Array.from(store.values())
    .filter((floor) => !floor.closed)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((floor) => {
      let cubicles: CubicleDTO[];

      if (floor.legacyCubicles && floor.legacyCubicles.size > 0) {
        // v1 compatibility: use legacy cubicles
        cubicles = Array.from(floor.legacyCubicles.values())
          .sort((a, b) => a.agent.localeCompare(b.agent));
      } else {
        // v2: derive from actors and invocations (system actors excluded).
        // One desk per seat: unknown keys share the intern corner, so keep
        // the freshest actor per seat.
        const bySeat = new Map<number, ActorInfo>();
        for (const a of runtime.actors.values()) {
          if (a.floorId !== floor.floorId || a.role === "system") continue;
          const prev = bySeat.get(a.seatIndex);
          if (!prev || a.lastObservedAt >= prev.lastObservedAt) bySeat.set(a.seatIndex, a);
        }
        cubicles = Array.from(bySeat.values())
          .map(actor => {
            const state = deriveActorState(actor.actorId, runtime);
            const cubicleStatus: "idle" | "working" = state === "idle" ? "idle" : "working";
            return {
              agent: actor.agentKey,
              kind: "agent.status" as const,
              status: cubicleStatus,
              since: actor.lastObservedAt,
              prompt: undefined,
              todos: [],
              state,
              lastStateChange: actor.lastObservedAt,
            };
          })
          .sort((a, b) => a.agent.localeCompare(b.agent));
      }

      return {
        sessionID: floor.floorId,
        title: floor.title,
        project: floor.projectId,
        status: cubicles.some(c => c.status === "working") ? "working" : "idle",
        updatedAt: floor.updatedAt,
        cubicles,
      };
    });

  return { floors: floorDTOs };
}

export function getSnapshot(): SnapshotEnvelope {
  return buildSnapshot(getRuntime());
}

export function getEventsSince(epoch: string, sequence: number): MonitorEvent[] {
  const runtime = getRuntime();
  if (runtime.epoch !== epoch) return [];
  return runtime.eventRing.filter(e => e.sequence > sequence);
}

export function getLatestEvent(): { epoch: string; sequence: number } {
  const runtime = getRuntime();
  return { epoch: runtime.epoch, sequence: runtime.sequence };
}

export function getUptimeMs(): number {
  const startTime = (globalThis as { __PIXEL_MONITOR_START__?: number }).__PIXEL_MONITOR_START__;
  return Date.now() - (startTime ?? Date.now());
}

export function getFloorsCount(): number {
  return getStore().size;
}

export function _clearStore(): void {
  getStore().clear();
  globalThis.__PIXEL_MONITOR_RUNTIME__ = undefined;
  seededFloors.clear();
  floorSeedEpoch.clear();
}

export function _getStoreSize(): number {
  return getStore().size;
}

export function getDedupeIndex(): Map<string, number> {
  return getRuntime().dedupeIndex;
}

export function setDedupe(eventId: string, sequence: number): void {
  getRuntime().dedupeIndex.set(eventId, sequence);
}

export function checkDedupe(eventId: string): number | undefined {
  return getRuntime().dedupeIndex.get(eventId);
}

// SSE Connection tracking
let activeSSEConnections = 0;
const connectionsPerIP = new Map<string, number>();
const eventListeners = new Set<(event: MonitorEvent) => void>();

export function incrementSSEConnections(): void {
  activeSSEConnections++;
}

export function decrementSSEConnections(): void {
  activeSSEConnections = Math.max(0, activeSSEConnections - 1);
}

export function getActiveSSEConnections(): number {
  return activeSSEConnections;
}

export function checkAndIncrementIPConnection(ip: string): boolean {
  const current = connectionsPerIP.get(ip) ?? 0;
  if (current >= 5) {
    return false;
  }
  connectionsPerIP.set(ip, current + 1);
  return true;
}

export function decrementIPConnection(ip: string): void {
  const current = connectionsPerIP.get(ip) ?? 0;
  if (current > 0) {
    connectionsPerIP.set(ip, current - 1);
  }
}

export function subscribeToSSEEvents(listener: (event: MonitorEvent) => void): () => void {
  eventListeners.add(listener);
  return () => eventListeners.delete(listener);
}

function emitSSEEvent(event: MonitorEvent): void {
  for (const listener of eventListeners) {
    try {
      listener(event);
    } catch {
      // ignore listener errors
    }
  }
}

// Override emitEvent to also notify SSE listeners
const originalEmitEvent = emitEvent;

// Latency tracking
let lastEventTimestamp = 0;
const latencySamples: number[] = [];

export function recordSSELatency(eventTimestamp: number): void {
  const now = Date.now();
  const latency = now - eventTimestamp;
  latencySamples.push(latency);
  if (latencySamples.length > 100) latencySamples.shift();
  lastEventTimestamp = eventTimestamp;
}

export function getSSEMetrics() {
  if (latencySamples.length === 0) return { avgLatencyMs: 0, minLatencyMs: 0, maxLatencyMs: 0, p50LatencyMs: 0, p95LatencyMs: 0, sampleCount: 0, lastEventAt: 0 };
  const sorted = [...latencySamples].sort((a, b) => a - b);
  return {
    avgLatencyMs: Math.round(latencySamples.reduce((a, b) => a + b, 0) / latencySamples.length),
    minLatencyMs: sorted[0],
    maxLatencyMs: sorted[sorted.length - 1],
    p50LatencyMs: sorted[Math.floor(sorted.length * 0.5)],
    p95LatencyMs: sorted[Math.floor(sorted.length * 0.95)],
    sampleCount: latencySamples.length,
    lastEventAt: lastEventTimestamp,
  };
}