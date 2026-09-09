import { Point, getRoute as getRouteCore, getDeskAnchor, OFFICE_DIMENSIONS, ORCHESTRATOR_SPOT } from "./office-layout";
import type { ActorInfo } from "@/lib/monitor-types";

export function getRoute(from: Point, to: Point): Point[] {
  return getRouteCore(from, to);
}

export function getSenderStartPosition(senderActor: ActorInfo): Point {
  if (senderActor.agentKey === "orchestrator") {
    return { ...ORCHESTRATOR_SPOT };
  }
  return getDeskAnchor(senderActor.seatIndex).seatedActorAnchor;
}

export function getRecipientHandoffPosition(recipientActor: ActorInfo): Point {
  return getDeskAnchor(recipientActor.seatIndex).handoffPoint;
}

export function getSenderReturnPosition(senderActor: ActorInfo): Point {
  if (senderActor.agentKey === "orchestrator") {
    return { ...ORCHESTRATOR_SPOT };
  }
  return getDeskAnchor(senderActor.seatIndex).seatedActorAnchor;
}

export function calculateFacing(from: Point, to: Point): "up" | "down" | "left" | "right" {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? "right" : "left";
  }
  return dy > 0 ? "down" : "up";
}

export function isPositionWalkable(pos: Point): boolean {
  return pos.x >= 0 && pos.x < OFFICE_DIMENSIONS.width && pos.y >= 0 && pos.y < OFFICE_DIMENSIONS.height;
}

export function getDistance(from: Point, to: Point): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.sqrt(dx * dx + dy * dy);
}