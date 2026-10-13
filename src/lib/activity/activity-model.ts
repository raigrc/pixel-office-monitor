import type { ActorInfo, InvocationInfo } from "@/lib/monitor-types";

export type ActivityBasePose = "idle" | "seat" | "work";
export type ActivityPose = ActivityBasePose | "success" | "error";
export type EndpointAvailability = "direct" | "self" | "unknown";

export const SUCCESS_BEAT_MS = 2_500;
export const ERROR_BEAT_MS = 3_000;
export const STALE_ACTIVITY_MS = 5 * 60 * 1000;

export interface OutcomeBeat {
  invocationId: string;
  kind: "success" | "error";
  occurredAt: number;
  expiresAt: number;
}

export interface ActivityActor {
  actor: ActorInfo;
  basePose: ActivityBasePose;
  pose: ActivityPose;
  activeWorkCount: number;
  outcomeBeat: OutcomeBeat | null;
  standbyEligible: boolean;
}

export interface ActivityInvocation {
  invocation: InvocationInfo;
  endpointAvailability: EndpointAvailability;
  validatedParentInvocationId: string | null;
}

export interface DirectDelegation {
  invocationId: string;
  floorId: string;
  senderActorId: string;
  recipientActorId: string;
  parentInvocationId: string | null;
  lifecycle: InvocationInfo["executionStatus"];
  requestedAt: number | null;
}

export interface ActivityModel {
  now: number;
  actors: ActivityActor[];
  invocations: ActivityInvocation[];
  directDelegations: DirectDelegation[];
  closedFloorIds: Set<string>;
}

export function activityActor(model: ActivityModel, actorId: string): ActivityActor | undefined {
  return model.actors.find((entry) => entry.actor.actorId === actorId);
}

export function actorPose(model: ActivityModel, actorId: string): ActivityPose {
  return activityActor(model, actorId)?.pose ?? "idle";
}

export function actorBasePose(model: ActivityModel, actorId: string): ActivityBasePose {
  return activityActor(model, actorId)?.basePose ?? "idle";
}

export function actorActiveWorkCount(model: ActivityModel, actorId: string): number {
  return activityActor(model, actorId)?.activeWorkCount ?? 0;
}

export function standbyEligibleActorIds(model: ActivityModel): Set<string> {
  return new Set(model.actors.filter((entry) => entry.standbyEligible).map((entry) => entry.actor.actorId));
}
