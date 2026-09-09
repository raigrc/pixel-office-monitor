export type SessionStatus = "active" | "idle" | "closed";

export interface SessionInfo {
  sessionId: string;
  parentSessionId: string | null;
  rootSessionId: string;
  projectId: string;
  status: SessionStatus;
  title: string | null;
  createdAt: number;
  updatedAt: number;
  closedAt: number | null;
}

export interface FloorInfo {
  floorId: string;
  rootSessionId: string;
  projectId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  closed: boolean;
  sessionId: string;
  legacyCubicles?: Map<string, CubicleLegacy>;
}

export interface ActorInfo {
  actorId: string;
  floorId: string;
  sessionId: string;
  agentKey: string;
  displayName: string;
  role: "orchestrator" | "specialist" | "system" | "unknown";
  seatIndex: number;
  lastObservedAt: number;
  createdAt: number;
  /** Latest activity state from V2 actor.activity events. */
  activity?: "working" | "idle";
  /** Timestamp when the actor entered idle state. */
  idleSince?: number;
}

export type InvocationStatus =
  | "requested"
  | "started"
  | "finished"
  | "failed"
  | "cancelled";

export interface InvocationInfo {
  invocationId: string;
  floorId: string;
  senderActorId: string;
  recipientActorId: string;
  callId: string;
  parentInvocationId: string | null;
  revision: number;
  executionStatus: InvocationStatus;
  outcome: "succeeded" | "failed" | "cancelled" | "unknown" | null;
  taskCategory: TaskCategory | null;
  promptPreview: string | null;
  requestedAt: number;
  startedAt: number | null;
  finishedAt: number | null;
}

export type TaskCategory =
  | "research"
  | "design"
  | "implementation"
  | "testing"
  | "operations"
  | "other";

export type CubicleLegacy = {
  agent: string;
  kind: string;
  status: "working" | "idle";
  since: number;
  lastTool?: string;
  prompt?: string;
  todos?: Array<Record<string, unknown>>;
  state: "idle" | "working" | "thinking" | "delegating" | "celebrating";
  lastStateChange: number;
};

export interface RuntimeState {
  epoch: string;
  sequence: number;
  sessions: Map<string, SessionInfo>;
  floors: Map<string, FloorInfo>;
  actors: Map<string, ActorInfo>;
  invocations: Map<string, InvocationInfo>;
  eventRing: MonitorEvent[];
  dedupeIndex: Map<string, number>;
}

export interface MonitorEvent {
  eventId: string;
  epoch: string;
  sequence: number;
  type: EventType;
  causeEventId: string | null;
  timestamp: number;
  payload: unknown;
}

export type EventType =
  | "session.upsert"
  | "session.closed"
  | "actor.activity"
  | "actor.removed"
  | "invocation.requested"
  | "invocation.started"
  | "invocation.finished"
  | "floor.created"
  | "floor.updated"
  | "floor.closed"
  | "floor.deleted"
  | "cubicle.updated"
  | "cubicle.removed"
  | "reset";

export interface SnapshotEnvelope {
  v: 2;
  epoch: string;
  sequence: number;
  floors: FloorInfo[];
  sessions: SessionInfo[];
  actors: ActorInfo[];
  invocations: InvocationInfo[];
}

export interface DeltaEnvelope {
  v: 2;
  epoch: string;
  sequence: number;
  causeEventId: string;
  upserts: {
    sessions?: SessionInfo[];
    floors?: FloorInfo[];
    actors?: ActorInfo[];
    invocations?: InvocationInfo[];
  };
  removals: {
    sessions?: string[];
    floors?: string[];
    actors?: string[];
    invocations?: string[];
  };
}

export interface IngestAck {
  accepted: boolean;
  duplicate: boolean;
  epoch: string;
  sequence: number;
  eventId: string;
}

export const TASK_CATEGORIES: TaskCategory[] = [
  "research",
  "design",
  "implementation",
  "testing",
  "operations",
  "other",
];

export function generateEventId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function generateEpoch(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function deriveFloorId(projectId: string, rootSessionId: string): string {
  return `${projectId}:${rootSessionId}`;
}

export function deriveActorId(projectId: string, sessionId: string, agentKey: string): string {
  return `${projectId}:${sessionId}:${agentKey}`;
}

export function deriveInvocationId(projectId: string, senderSessionId: string, callId: string): string {
  return `${projectId}:${senderSessionId}:${callId}`;
}