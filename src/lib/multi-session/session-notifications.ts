import type { MultiSessionFloor, MultiSessionModel, SessionLifecycle } from "./multi-session-model";

export type SessionNotificationKind = "started-working" | "became-quiet" | "completed" | "follow-moved";

export interface SessionNotification {
  id: string;
  kind: SessionNotificationKind;
  floorId: string;
  title: string;
  occurredAt: number;
  fromFloorId: string | null;
}

export interface SessionNotificationState {
  lifecycles: Readonly<Record<string, SessionLifecycle>>;
  followedFloorId: string | null;
  notifications: SessionNotification[];
}

export interface SessionNotificationInput {
  model: MultiSessionModel;
  followedFloorId: string | null;
}

const MAX_NOTIFICATIONS = 20;

function modelFloors(model: MultiSessionModel): MultiSessionFloor[] {
  return [...model.working, ...model.quiet, ...model.completed];
}

function notificationId(kind: SessionNotificationKind, floorId: string, occurredAt: number, fromFloorId: string | null): string {
  return `${kind}:${fromFloorId ?? "none"}:${floorId}:${occurredAt}`;
}

export function transitionSessionNotifications(
  previous: SessionNotificationState | null,
  input: SessionNotificationInput,
): SessionNotificationState {
  const floors = modelFloors(input.model);
  const lifecycles = Object.fromEntries(floors.map((floor) => [floor.floorId, floor.lifecycle]));
  if (!previous) return { lifecycles, followedFloorId: input.followedFloorId, notifications: [] };

  const additions: SessionNotification[] = [];
  for (const floor of floors) {
    const before = previous.lifecycles[floor.floorId];
    let kind: SessionNotificationKind | null = null;
    if (before === "quiet" && floor.lifecycle === "working") kind = "started-working";
    else if (before === "working" && floor.lifecycle === "quiet") kind = "became-quiet";
    else if ((before === "working" || before === "quiet") && floor.lifecycle === "completed") kind = "completed";
    if (!kind) continue;
    const occurredAt = kind === "completed" ? floor.closedAt ?? floor.lastActivityAt : floor.lastActivityAt;
    additions.push({
      id: notificationId(kind, floor.floorId, occurredAt, null),
      kind,
      floorId: floor.floorId,
      title: floor.title,
      occurredAt,
      fromFloorId: null,
    });
  }

  if (previous.followedFloorId && input.followedFloorId && previous.followedFloorId !== input.followedFloorId) {
    const target = floors.find((floor) => floor.floorId === input.followedFloorId);
    if (target) {
      additions.push({
        id: notificationId("follow-moved", target.floorId, target.lastActivityAt, previous.followedFloorId),
        kind: "follow-moved",
        floorId: target.floorId,
        title: target.title,
        occurredAt: target.lastActivityAt,
        fromFloorId: previous.followedFloorId,
      });
    }
  }

  const seen = new Set<string>();
  const notifications = [...additions, ...previous.notifications]
    .filter((notification) => {
      if (seen.has(notification.id)) return false;
      seen.add(notification.id);
      return true;
    })
    .sort((a, b) => b.occurredAt - a.occurredAt || a.id.localeCompare(b.id))
    .slice(0, MAX_NOTIFICATIONS);
  return { lifecycles, followedFloorId: input.followedFloorId, notifications };
}
