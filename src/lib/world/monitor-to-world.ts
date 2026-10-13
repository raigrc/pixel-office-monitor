import type { ActorInfo, FloorInfo, InvocationInfo } from "@/lib/monitor-types";
import { getActorActivityPose } from "@/lib/scene/actor-pose";
import type { WorldAgent, WorldAgentStatus, WorldSession, WorldState } from "./world-types";

export interface MonitorSnapshotInput {
  floors: FloorInfo[];
  actors: ActorInfo[];
  invocations: InvocationInfo[];
}

function toAgentStatus(pose: "idle" | "seat" | "work" | "success" | "error"): WorldAgentStatus {
  switch (pose) {
    case "work":
      return "working";
    case "seat":
      return "waiting";
    case "success":
      return "success";
    case "error":
      return "error";
    case "idle":
      return "idle";
  }
}

/**
 * Filtering rule: system actors never render. Specialist actors render only
 * when live semantics say they are active (pose is not idle). An observed
 * orchestrator always renders, even when idle, because the 2D room keeps a
 * standing admin visible. Seeded idle roster specialists stay out until
 * observed working, waiting, or succeeding. Plots without any observed
 * orchestrator render specialists only; no synthetic owner is invented.
 */
export function monitorToWorld(input: MonitorSnapshotInput, now: number = Date.now()): WorldState {
  const activeFloors = input.floors
    .filter((floor) => !floor.closed)
    .sort((a, b) => a.createdAt - b.createdAt || (a.floorId < b.floorId ? -1 : 1));
  const activeFloorIds = new Set(activeFloors.map((floor) => floor.floorId));

  const sessions: WorldSession[] = activeFloors.map((floor) => ({
    id: floor.floorId,
    projectId: floor.projectId,
    rootSessionId: floor.rootSessionId,
    title: floor.title,
    createdAt: floor.createdAt,
  }));

  const agents: WorldAgent[] = [];
  for (const actor of input.actors) {
    if (!activeFloorIds.has(actor.floorId)) continue;
    if (actor.role === "system") continue;
    const isOrchestrator = actor.role === "orchestrator";
    const pose = getActorActivityPose(actor, input.invocations, now);
    if (pose === "idle" && !isOrchestrator) continue;
    agents.push({
      id: actor.actorId,
      worldId: actor.floorId,
      sessionId: actor.sessionId,
      agentKey: actor.agentKey,
      displayName: actor.displayName,
      role: actor.role,
      isOrchestrator,
      status: toAgentStatus(pose),
      seatIndex: actor.seatIndex,
    });
  }
  agents.sort((a, b) => a.id < b.id ? -1 : 1);

  return { sessions, agents };
}
