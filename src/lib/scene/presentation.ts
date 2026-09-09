import { HandoffScheduler, HandoffJob, HandoffPhase } from "./handoff-scheduler";
import { ORCHESTRATOR_SPOT } from "./office-layout";
import type { ActorInfo, InvocationInfo, FloorInfo } from "@/lib/monitor-types";
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

export class PresentationController {
  private scheduler: HandoffScheduler;
  private visualStates: Map<string, VisualHandoffState> = new Map();
  private lastUpdateTime: number = 0;
  private reducedMotion: boolean = false;

  constructor(
    private getActors: () => ActorInfo[],
    private getFloors: () => FloorInfo[],
    private getInvocations: () => InvocationInfo[]
  ) {
    this.scheduler = new HandoffScheduler(getActors, getFloors);
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

    for (const job of jobs) {
      const senderActor = this.getActors().find((a) => a.actorId === job.senderActorId);
      const recipientActor = this.getActors().find((a) => a.actorId === job.recipientActorId);

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
        recipientPose = "success";
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
}
