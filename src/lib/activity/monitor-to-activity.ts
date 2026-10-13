import type { ActorInfo, FloorInfo, InvocationInfo } from "@/lib/monitor-types";
import {
  ERROR_BEAT_MS,
  SUCCESS_BEAT_MS,
  STALE_ACTIVITY_MS,
  type ActivityActor,
  type ActivityBasePose,
  type ActivityInvocation,
  type ActivityModel,
  type DirectDelegation,
  type OutcomeBeat,
} from "./activity-model";

export interface ActivitySnapshotInput {
  floors: FloorInfo[];
  actors: ActorInfo[];
  invocations: InvocationInfo[];
}

function isActive(invocation: InvocationInfo): boolean {
  return invocation.executionStatus === "requested" || invocation.executionStatus === "started";
}

function related(invocation: InvocationInfo, actorId: string): boolean {
  return invocation.senderActorId === actorId || invocation.recipientActorId === actorId;
}

function validatedParentId(
  invocation: InvocationInfo,
  invocationsById: ReadonlyMap<string, InvocationInfo>,
): string | null {
  const immediateParentId = invocation.parentInvocationId;
  if (!immediateParentId) return null;
  const visited = new Set([invocation.invocationId]);
  let child = invocation;
  let parentId: string | null = immediateParentId;
  while (parentId) {
    if (visited.has(parentId)) return null;
    visited.add(parentId);
    const parent = invocationsById.get(parentId);
    if (!parent || parent.floorId !== invocation.floorId || parent.recipientActorId !== child.senderActorId) return null;
    child = parent;
    parentId = parent.parentInvocationId;
  }
  return immediateParentId;
}

export function resolveActorBasePose(actor: ActorInfo, invocations: InvocationInfo[], now: number): ActivityBasePose {
  const active = invocations.filter((invocation) => isActive(invocation) && related(invocation, actor.actorId));
  if (active.some((invocation) => invocation.executionStatus === "started")) return "work";
  if (actor.activity === "working" && now - actor.lastObservedAt <= STALE_ACTIVITY_MS) return "work";
  if (active.some((invocation) =>
    invocation.executionStatus === "requested" &&
    invocation.recipientActorId === actor.actorId &&
    invocation.senderActorId !== null &&
    invocation.senderActorId !== actor.actorId
  )) return "seat";
  return active.length > 0 ? "work" : "idle";
}

export function resolveActorOutcomeBeat(actorId: string, invocations: InvocationInfo[], now: number): OutcomeBeat | null {
  const candidates = invocations
    .filter((invocation) => invocation.finishedAt != null && related(invocation, actorId))
    .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0) || b.invocationId.localeCompare(a.invocationId));
  const latest = candidates[0];
  if (!latest?.finishedAt) return null;
  const kind = latest.outcome === "succeeded" ? "success" : latest.outcome === "failed" ? "error" : null;
  if (!kind) return null;
  const expiresAt = latest.finishedAt + (kind === "success" ? SUCCESS_BEAT_MS : ERROR_BEAT_MS);
  if (now >= expiresAt) return null;
  return { invocationId: latest.invocationId, kind, occurredAt: latest.finishedAt, expiresAt };
}

export function monitorToActivity(input: ActivitySnapshotInput, now: number): ActivityModel {
  const floors = new Map(input.floors.map((floor) => [floor.floorId, floor]));
  const actorsById = new Map(input.actors.map((actor) => [actor.actorId, actor]));
  const invocationsById = new Map(input.invocations.map((invocation) => [invocation.invocationId, invocation]));

  const semanticInvocations: ActivityInvocation[] = input.invocations.map((invocation) => {
    const sender = invocation.senderActorId ? actorsById.get(invocation.senderActorId) : undefined;
    const recipient = invocation.recipientActorId ? actorsById.get(invocation.recipientActorId) : undefined;
    const self = invocation.senderActorId !== null && invocation.senderActorId === invocation.recipientActorId;
    const direct = Boolean(sender && recipient && !self && sender.floorId === invocation.floorId && recipient.floorId === invocation.floorId);
    return {
      invocation,
      endpointAvailability: direct ? "direct" : self ? "self" : "unknown",
      validatedParentInvocationId: direct ? validatedParentId(invocation, invocationsById) : null,
    };
  });

  const directDelegations: DirectDelegation[] = semanticInvocations
    .filter((entry) => entry.endpointAvailability === "direct" && isActive(entry.invocation))
    .flatMap((entry) => {
      const { invocation } = entry;
      if (!invocation.senderActorId || !invocation.recipientActorId) return [];
      return [{
        invocationId: invocation.invocationId,
        floorId: invocation.floorId,
        senderActorId: invocation.senderActorId,
        recipientActorId: invocation.recipientActorId,
        parentInvocationId: entry.validatedParentInvocationId,
        lifecycle: invocation.executionStatus,
        requestedAt: invocation.requestedAt,
      }];
    })
    .sort((a, b) => (a.requestedAt ?? 0) - (b.requestedAt ?? 0) || a.invocationId.localeCompare(b.invocationId));

  const actors: ActivityActor[] = input.actors.map((actor) => {
    const activeWorkCount = input.invocations.filter((invocation) => isActive(invocation) && related(invocation, actor.actorId)).length;
    const resolvedBasePose = resolveActorBasePose(actor, input.invocations, now);
    const outcomeBeat = activeWorkCount === 0 ? resolveActorOutcomeBeat(actor.actorId, input.invocations, now) : null;
    const floor = floors.get(actor.floorId);
    return {
      actor,
      basePose: resolvedBasePose,
      pose: outcomeBeat?.kind ?? resolvedBasePose,
      activeWorkCount,
      outcomeBeat,
      standbyEligible: actor.role === "specialist" && actor.activity === "idle" && actor.idleSince != null && activeWorkCount === 0 && floor?.closed === false,
    };
  });

  return {
    now,
    actors,
    invocations: semanticInvocations,
    directDelegations,
    closedFloorIds: new Set(input.floors.filter((floor) => floor.closed).map((floor) => floor.floorId)),
  };
}
