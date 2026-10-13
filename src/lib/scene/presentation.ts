import { HandoffScheduler, HandoffJob, HandoffPhase } from "./handoff-scheduler";
import { ORCHESTRATOR_SPOT } from "./office-layout";
import type { ActorInfo, InvocationInfo, FloorInfo } from "@/lib/monitor-types";
import type { ActivityModel, ActivityPose } from "@/lib/activity/activity-model";
import { getDeskAnchor, Point } from "./office-layout";

export interface VisualHandoffState {
  jobId: string;
  senderActorId: string;
  recipientActorId: string;
  senderPosition: Point;
  senderFacing: "up" | "down" | "left" | "right";
  senderPose: "idle" | "walk" | "seat" | "work" | "give" | "receive" | "success" | "error";
  recipientPose: "idle" | "walk" | "seat" | "work" | "give" | "receive" | "success" | "error";
  phase: HandoffPhase;
  progress: number;
}

export interface VisualActorPoseState {
  actorId: string;
  floorId: string;
  pose: Extract<ActivityPose, "success" | "error">;
  expiresAt: number;
}

export class PresentationController {
  private scheduler: HandoffScheduler;
  private visualStates: Map<string, VisualHandoffState> = new Map();
  private lastUpdateTime: number = 0;
  private reducedMotion: boolean = false;
  private activity: ActivityModel | null = null;

  constructor(
    private getActors: () => ActorInfo[] = () => [],
    getFloors: () => FloorInfo[] = () => [],
  ) {
    this.scheduler = new HandoffScheduler(getActors, getFloors);
  }

  reconcile(activity: ActivityModel): void {
    this.activity = activity;
    this.scheduler.reconcile(activity.directDelegations, activity.actors);
  }

  setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled;
  }

  update(deltaTime: number): VisualHandoffState[] {
    if (this.reducedMotion) {
      this.processReducedMotion();
    } else {
      this.scheduler.process(deltaTime);
    }
    const states = this.buildVisualStates();
    this.visualStates = new Map(states.map((state) => [state.jobId, state]));
    return states;
  }

  private processReducedMotion(): void {
    const jobs = this.scheduler.getActiveJobs();
    for (const job of jobs) {
      if (job.phase !== "settled") {
        job.phase = "settled";
      }
    }
  }

  private buildVisualStates(): VisualHandoffState[] {
    const states: VisualHandoffState[] = [];
    const jobs = this.scheduler.getActiveJobs();
    const actors = this.activity?.actors.map((entry) => entry.actor) ?? this.getActors();

    for (const job of jobs) {
      const senderActor = actors.find((a) => a.actorId === job.senderActorId);
      const recipientActor = actors.find((a) => a.actorId === job.recipientActorId);

      if (!senderActor || !recipientActor) continue;

      const senderDesk = senderActor.agentKey === "orchestrator"
        ? { ...ORCHESTRATOR_SPOT }
        : getDeskAnchor(senderActor.seatIndex).seatedActorAnchor;

      let senderPosition: Point = { ...senderDesk };
      let senderFacing: "up" | "down" | "left" | "right" = "down";
      let senderPose: VisualHandoffState["senderPose"] = "idle";
      let recipientPose: VisualHandoffState["recipientPose"] = "seat";
      let progress = 0;

      if (job.phase === "queued") {
        senderPosition = { ...senderDesk };
        senderPose = "seat";
        recipientPose = "seat";
      } else if (job.phase === "approaching") {
        senderPosition = { ...job.senderStartPos };
        senderFacing = this.calculateFacing(job.senderStartPos, job.route[job.routeIndex] ?? job.senderTargetPos);
        senderPose = "walk";
        recipientPose = "seat";
        progress = job.routeIndex / Math.max(1, job.route.length);
      } else if (job.phase === "arrived" || job.phase === "facing") {
        senderPosition = { ...job.senderTargetPos };
        senderFacing = "down";
        senderPose = "idle";
        recipientPose = "seat";
      } else if (job.phase === "handing-off") {
        senderPosition = { ...job.senderTargetPos };
        senderFacing = "down";
        senderPose = "give";
        recipientPose = "receive";
      } else if (job.phase === "acknowledging") {
        senderPosition = { ...job.senderTargetPos };
        senderFacing = "down";
        senderPose = "idle";
        recipientPose = "receive";
      } else if (job.phase === "departing" || job.phase === "returning") {
        senderPosition = { ...job.senderStartPos };
        senderFacing = this.calculateFacing(job.senderStartPos, job.senderTargetPos);
        senderPose = "walk";
        recipientPose = "work";
      } else if (job.phase === "settled") {
        senderPosition = { ...senderDesk };
        senderPose = "seat";
        recipientPose = "work";
      }

      states.push({
        jobId: job.jobId,
        senderActorId: job.senderActorId,
        recipientActorId: job.recipientActorId,
        senderPosition,
        senderFacing,
        senderPose,
        recipientPose,
        phase: job.phase,
        progress,
      });
    }

    return states;
  }

  private calculateFacing(from: Point, to: Point): "up" | "down" | "left" | "right" {
    const dx = to.x - from.x;
    const dy = to.y - from.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? "right" : "left";
    }
    return dy > 0 ? "down" : "up";
  }

  enqueueHandoff(invocation: InvocationInfo, senderActor: ActorInfo, recipientActor: ActorInfo): HandoffJob | null {
    return this.scheduler.enqueue(invocation, senderActor, recipientActor);
  }

  getVisualStates(): VisualHandoffState[] {
    return Array.from(this.visualStates.values());
  }

  getActorPoseStates(now: number = Date.now()): VisualActorPoseState[] {
    if (!this.activity) return [];
    return this.activity.actors.flatMap((entry) => {
      const beat = entry.outcomeBeat;
      if (!beat || now >= beat.expiresAt) return [];
      return [{
        actorId: entry.actor.actorId,
        floorId: entry.actor.floorId,
        pose: beat.kind,
        expiresAt: beat.expiresAt,
      }];
    });
  }
}
