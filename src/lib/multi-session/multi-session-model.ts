import type { ActivityModel } from "@/lib/activity/activity-model";
import type { ActorInfo, FloorInfo, InvocationInfo, TaskCategory } from "@/lib/monitor-types";

export type SessionLifecycle = "working" | "quiet" | "completed";

export interface ActiveActorSummary {
  actorId: string;
  agentKey: string;
  displayName: string;
  role: ActorInfo["role"];
  activeWorkCount: number;
}

export interface SessionOutcome {
  invocationId: string;
  outcome: NonNullable<InvocationInfo["outcome"]>;
  finishedAt: number;
}

export interface MultiSessionFloor {
  floorId: string;
  title: string;
  projectId: string;
  lifecycle: SessionLifecycle;
  pinned: boolean;
  activeInvocationCount: number;
  activeActors: ActiveActorSummary[];
  taskCategories: TaskCategory[];
  latestOutcome: SessionOutcome | null;
  lastActivityAt: number;
  closedAt: number | null;
}

export interface MultiSessionModel {
  working: MultiSessionFloor[];
  quiet: MultiSessionFloor[];
  completed: MultiSessionFloor[];
}

export interface MultiSessionModelInput {
  floors: FloorInfo[];
  actors: ActorInfo[];
  invocations: InvocationInfo[];
  activity: ActivityModel;
  pinnedFloorIds: Iterable<string>;
}

const CATEGORY_ORDER: TaskCategory[] = ["research", "design", "implementation", "testing", "operations", "other"];

function isActive(invocation: InvocationInfo): boolean {
  return invocation.executionStatus === "requested" || invocation.executionStatus === "started";
}

function invocationActivityAt(invocation: InvocationInfo): number {
  return Math.max(invocation.requestedAt ?? 0, invocation.startedAt ?? 0, invocation.finishedAt ?? 0);
}

function compareOpen(a: MultiSessionFloor, b: MultiSessionFloor): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  return b.lastActivityAt - a.lastActivityAt || a.floorId.localeCompare(b.floorId);
}

function compareCompleted(a: MultiSessionFloor, b: MultiSessionFloor): number {
  return b.lastActivityAt - a.lastActivityAt || a.floorId.localeCompare(b.floorId);
}

export function buildMultiSessionModel(input: MultiSessionModelInput): MultiSessionModel {
  const pinned = new Set(input.pinnedFloorIds);
  const activityActors = new Map(input.activity.actors.map((entry) => [entry.actor.actorId, entry]));
  const working: MultiSessionFloor[] = [];
  const quiet: MultiSessionFloor[] = [];
  const completed: MultiSessionFloor[] = [];

  for (const floor of input.floors) {
    const floorActors = input.actors.filter((actor) => actor.floorId === floor.floorId);
    const floorInvocations = input.invocations.filter((invocation) => invocation.floorId === floor.floorId);
    const activeInvocations = floorInvocations.filter(isActive);
    const activeActors = floorActors.flatMap((actor): ActiveActorSummary[] => {
      const entry = activityActors.get(actor.actorId);
      if (!entry || (entry.activeWorkCount === 0 && entry.basePose === "idle")) return [];
      return [{
        actorId: actor.actorId,
        agentKey: actor.agentKey,
        displayName: actor.displayName,
        role: actor.role,
        activeWorkCount: entry.activeWorkCount,
      }];
    }).sort((a, b) => b.activeWorkCount - a.activeWorkCount || a.actorId.localeCompare(b.actorId));
    const latestFinished = floorInvocations
      .filter((invocation) => invocation.finishedAt !== null && invocation.outcome !== null)
      .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0) || a.invocationId.localeCompare(b.invocationId))[0];
    const latestOutcome = latestFinished?.finishedAt != null && latestFinished.outcome !== null
      ? { invocationId: latestFinished.invocationId, outcome: latestFinished.outcome, finishedAt: latestFinished.finishedAt }
      : null;
    const taskCategorySet = new Set(floorInvocations.flatMap((invocation) => invocation.taskCategory ? [invocation.taskCategory] : []));
    const lastActivityAt = Math.max(
      floor.updatedAt,
      floor.closedAt ?? 0,
      ...floorActors.map((actor) => actor.lastObservedAt),
      ...floorInvocations.map(invocationActivityAt),
    );
    const lifecycle: SessionLifecycle = floor.closed
      ? "completed"
      : activeInvocations.length > 0 || activeActors.length > 0
        ? "working"
        : "quiet";
    const item: MultiSessionFloor = {
      floorId: floor.floorId,
      title: floor.title,
      projectId: floor.projectId,
      lifecycle,
      pinned: pinned.has(floor.floorId),
      activeInvocationCount: new Set(activeInvocations.map((invocation) => invocation.invocationId)).size,
      activeActors,
      taskCategories: CATEGORY_ORDER.filter((category) => taskCategorySet.has(category)),
      latestOutcome,
      lastActivityAt,
      closedAt: floor.closedAt,
    };
    if (lifecycle === "working") working.push(item);
    else if (lifecycle === "quiet") quiet.push(item);
    else completed.push(item);
  }

  working.sort(compareOpen);
  quiet.sort(compareOpen);
  completed.sort(compareCompleted);
  return { working, quiet, completed };
}

function allFloors(model: MultiSessionModel): MultiSessionFloor[] {
  return [...model.working, ...model.quiet, ...model.completed];
}

export function chooseFollowTarget(model: MultiSessionModel, currentFloorId: string | null = null): string | null {
  if (currentFloorId && model.working.some((floor) => floor.floorId === currentFloorId)) return currentFloorId;
  return model.working[0]?.floorId ?? null;
}

export function chooseFallbackFloor(model: MultiSessionModel, currentFloorId: string | null = null): string | null {
  if (currentFloorId && allFloors(model).some((floor) => floor.floorId === currentFloorId)) return currentFloorId;
  return model.working[0]?.floorId ?? model.quiet[0]?.floorId ?? model.completed[0]?.floorId ?? null;
}
