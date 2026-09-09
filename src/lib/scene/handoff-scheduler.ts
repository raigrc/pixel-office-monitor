import { Point, getRoute, getDeskAnchor, ORCHESTRATOR_SPOT } from "./office-layout";
import type { ActorInfo, InvocationInfo, FloorInfo } from "@/lib/monitor-types";

export type HandoffPhase =
  | "queued"
  | "approaching"
  | "arrived"
  | "facing"
  | "handing-off"
  | "acknowledging"
  | "departing"
  | "returning"
  | "settled";

export interface HandoffJob {
  jobId: string;
  invocationId: string;
  senderActorId: string;
  recipientActorId: string;
  floorId: string;
  phase: HandoffPhase;
  queuedAt: number;
  startedAt: number | null;
  phaseStartedAt: number | null;
  senderStartPos: Point;
  senderTargetPos: Point;
  route: Point[];
  routeIndex: number;
  phaseTimer: number;
}

const PHASE_DURATIONS: Record<string, number> = {
  approaching: 0,
  arrived: 120,
  facing: 120,
  "handing-off": 180,
  acknowledging: 180,
  departing: 0,
  returning: 0,
  settled: 0,
};

const WALK_SPEED = 120;

export class HandoffScheduler {
  private jobs: Map<string, HandoffJob> = new Map();
  private senderQueues: Map<string, string[]> = new Map();
  private seenInvocationIds: Set<string> = new Set();
  private lastProcessedTime: number = 0;
  private maxVisualBacklog = 8;

  constructor(private getActors: () => ActorInfo[], private getFloors: () => FloorInfo[]) {}

  enqueue(invocation: InvocationInfo, senderActor: ActorInfo, recipientActor: ActorInfo): HandoffJob | null {
    if (this.seenInvocationIds.has(invocation.invocationId)) {
      return null;
    }

    const senderQueue = this.senderQueues.get(senderActor.actorId) ?? [];
    if (senderQueue.length >= this.maxVisualBacklog) {
      return null;
    }

    const senderDesk = senderActor.agentKey === "orchestrator"
      ? { ...ORCHESTRATOR_SPOT }
      : getDeskAnchor(senderActor.seatIndex).seatedActorAnchor;

    const recipientDesk = getDeskAnchor(recipientActor.seatIndex);
    const recipientHandoff = recipientDesk.handoffPoint;

    const route = getRoute(senderDesk, recipientHandoff);

    const job: HandoffJob = {
      jobId: `handoff-${invocation.invocationId}`,
      invocationId: invocation.invocationId,
      senderActorId: senderActor.actorId,
      recipientActorId: recipientActor.actorId,
      floorId: invocation.floorId,
      phase: "queued",
      queuedAt: Date.now(),
      startedAt: null,
      phaseStartedAt: null,
      senderStartPos: { ...senderDesk },
      senderTargetPos: { ...recipientHandoff },
      route,
      routeIndex: 0,
      phaseTimer: 0,
    };

    this.jobs.set(job.jobId, job);
    this.seenInvocationIds.add(invocation.invocationId);
    senderQueue.push(job.jobId);
    this.senderQueues.set(senderActor.actorId, senderQueue);

    return job;
  }

  process(deltaTime: number): HandoffJob[] {
    const now = Date.now();
    const completedJobs: HandoffJob[] = [];

    for (const [jobId, job] of this.jobs) {
      if (job.phase === "queued") {
        const senderQueue = this.senderQueues.get(job.senderActorId) ?? [];
        if (senderQueue[0] === jobId) {
          job.phase = "approaching";
          job.startedAt = now;
          job.phaseStartedAt = now;
          job.phaseTimer = 0;
        }
      } else if (job.phase === "approaching") {
        const progress = this.moveAlongRoute(job, deltaTime);
        if (progress >= 1) {
          job.phase = "arrived";
          job.phaseStartedAt = now;
          job.phaseTimer = 0;
        }
      } else if (job.phase === "arrived") {
        job.phaseTimer += deltaTime;
        if (job.phaseTimer >= PHASE_DURATIONS.arrived) {
          job.phase = "facing";
          job.phaseStartedAt = now;
          job.phaseTimer = 0;
        }
      } else if (job.phase === "facing") {
        job.phaseTimer += deltaTime;
        if (job.phaseTimer >= PHASE_DURATIONS.facing) {
          job.phase = "handing-off";
          job.phaseStartedAt = now;
          job.phaseTimer = 0;
        }
      } else if (job.phase === "handing-off") {
        job.phaseTimer += deltaTime;
        if (job.phaseTimer >= PHASE_DURATIONS["handing-off"]) {
          job.phase = "acknowledging";
          job.phaseStartedAt = now;
          job.phaseTimer = 0;
        }
      } else if (job.phase === "acknowledging") {
        job.phaseTimer += deltaTime;
        if (job.phaseTimer >= PHASE_DURATIONS.acknowledging) {
          job.phase = "departing";
          job.phaseStartedAt = now;
          job.phaseTimer = 0;
        }
      } else if (job.phase === "departing") {
        job.phase = "returning";
        job.phaseStartedAt = now;
        job.phaseTimer = 0;
      } else if (job.phase === "returning") {
        const progress = this.returnAlongRoute(job, deltaTime);
        if (progress >= 1) {
          job.phase = "settled";
          completedJobs.push(job);
        }
      }
    }

    for (const completedJob of completedJobs) {
      this.jobs.delete(completedJob.jobId);
      const senderQueue = this.senderQueues.get(completedJob.senderActorId) ?? [];
      const idx = senderQueue.indexOf(completedJob.jobId);
      if (idx >= 0) senderQueue.splice(idx, 1);
    }

    return Array.from(this.jobs.values());
  }

  private moveAlongRoute(job: HandoffJob, deltaTime: number): number {
    if (job.routeIndex >= job.route.length) return 1;

    const target = job.route[job.routeIndex];
    const dx = target.x - job.senderStartPos.x;
    const dy = target.y - job.senderStartPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 1) {
      job.routeIndex++;
      if (job.routeIndex >= job.route.length) return 1;
      return this.moveAlongRoute(job, deltaTime);
    }

    const moveDistance = WALK_SPEED * (deltaTime / 1000);
    const ratio = Math.min(moveDistance / distance, 1);

    job.senderStartPos.x += dx * ratio;
    job.senderStartPos.y += dy * ratio;

    if (ratio >= 1) {
      job.routeIndex++;
      return this.moveAlongRoute(job, deltaTime - moveDistance);
    }

    return job.routeIndex / Math.max(1, job.route.length);
  }

  private returnAlongRoute(job: HandoffJob, deltaTime: number): number {
    const senderDesk = job.senderActorId.includes("orchestrator")
      ? { ...ORCHESTRATOR_SPOT }
      : this.getDeskAnchorForActor(job.senderActorId).seatedActorAnchor;

    const dx = senderDesk.x - job.senderStartPos.x;
    const dy = senderDesk.y - job.senderStartPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 1) {
      job.senderStartPos = { ...senderDesk };
      return 1;
    }

    const moveDistance = WALK_SPEED * (deltaTime / 1000);
    const ratio = Math.min(moveDistance / distance, 1);

    job.senderStartPos.x += dx * ratio;
    job.senderStartPos.y += dy * ratio;

    return ratio;
  }

  private getDeskAnchorForActor(actorId: string): ReturnType<typeof getDeskAnchor> {
    const actor = this.getActors().find((a) => a.actorId === actorId);
    if (!actor) return getDeskAnchor(0);
    return getDeskAnchor(actor.seatIndex);
  }

  getActiveJobs(): HandoffJob[] {
    return Array.from(this.jobs.values());
  }

  getJob(jobId: string): HandoffJob | undefined {
    return this.jobs.get(jobId);
  }

  clear(): void {
    this.jobs.clear();
    this.senderQueues.clear();
    this.seenInvocationIds.clear();
  }
}
