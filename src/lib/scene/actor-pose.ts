import type { ActorInfo, InvocationInfo } from "@/lib/monitor-types";

/**
 * Silence after which a stuck "working" state is treated as idle.
 * Working agents emit tool/part updates constantly; 5 silent minutes means
 * the producer died mid-task (e.g. opencode restart wiped the plugin's
 * overlap guard). Genuinely busy agents renew `lastObservedAt` on every
 * event, so this only ever catches the stranded.
 */
export const STALE_ACTIVITY_MS = 5 * 60 * 1000;

/**
 * Awake window after a finished task: monitor stays ON (idle art) and lamp
 * stays lit this long before the desk falls asleep. Desks are permanent, so
 * a finished agent rests in place instead of exiting.
 */
export const AWAKE_WINDOW_MS = 90 * 1000;

/** Latest finishedAt of a finished invocation involving this actor. */
export function getActorLastFinishedAt(
  actorId: string,
  invocations: InvocationInfo[]
): number | null {
  let latest: number | null = null;
  for (const inv of invocations) {
    if (inv.finishedAt == null) continue;
    if (inv.senderActorId !== actorId && inv.recipientActorId !== actorId) continue;
    if (latest == null || inv.finishedAt > latest) latest = inv.finishedAt;
  }
  return latest;
}

/** Outcome of that latest finished invocation (null when never finished). */
export function getActorLastOutcome(
  actorId: string,
  invocations: InvocationInfo[]
): InvocationInfo["outcome"] {
  let latestAt = -1;
  let outcome: InvocationInfo["outcome"] = null;
  for (const inv of invocations) {
    if (inv.finishedAt == null) continue;
    if (inv.senderActorId !== actorId && inv.recipientActorId !== actorId) continue;
    if (inv.finishedAt >= latestAt) {
      latestAt = inv.finishedAt;
      outcome = inv.outcome;
    }
  }
  return outcome;
}

/** Active (requested/started) invocation count — the desk's busy level. */
export function getActorBusyCount(
  actorId: string,
  invocations: InvocationInfo[]
): number {
  let n = 0;
  for (const inv of invocations) {
    if (inv.executionStatus !== "requested" && inv.executionStatus !== "started") continue;
    if (inv.senderActorId === actorId || inv.recipientActorId === actorId) n += 1;
  }
  return n;
}

/**
 * Resolve an actor's scene pose. Started invocations are ground truth, then
 * explicit working activity (the plugin persists it per task — a bare
 * requested flag only means *pending*), then the just-finished success beat
 * (inside AWAKE_WINDOW_MS, succeeded/unknown only), then idle.
 *
 * - Started work reads as working regardless of role.
 * - Requested work reads as pending (seat) only when the actor waits on a
 *   *different* sender. Self-requested or sender-side requests mean the
 *   actor is engaged: work. (The plugin files both sides as the same actor
 *   when it can't attribute a distinct sender.)
 * - No evidence either way reads as idle (sleeping, lamp+monitor off).
 */
export function getActorActivityPose(
  actor: ActorInfo,
  invocations: InvocationInfo[],
  now: number = Date.now()
): "idle" | "seat" | "work" | "success" {
  const related = invocations.filter(
    (invocation) =>
      (invocation.executionStatus === "requested" || invocation.executionStatus === "started") &&
      (invocation.senderActorId === actor.actorId || invocation.recipientActorId === actor.actorId),
  );

  // Started work is ground truth — it beats any flag.
  if (related.some((inv) => inv.executionStatus === "started")) return "work";

  // Explicit working activity beats a bare requested flag (pending ≠ working).
  const activity =
    actor.activity === "working" && now - actor.lastObservedAt > STALE_ACTIVITY_MS
      ? "idle"
      : actor.activity;
  if (activity === "working") return "work";

  // Pending on someone else: seated and waiting.
  const waitingOnOther = related.some(
    (inv) =>
      inv.executionStatus === "requested" &&
      inv.recipientActorId === actor.actorId &&
      inv.senderActorId !== actor.actorId,
  );
  if (waitingOnOther) return "seat";
  if (related.length > 0) return "work";

  // Just-finished success beat: monitor stays ON, lamp stays lit.
  const lastFinished = getActorLastFinishedAt(actor.actorId, invocations);
  if (lastFinished != null && now - lastFinished < AWAKE_WINDOW_MS) {
    const outcome = getActorLastOutcome(actor.actorId, invocations);
    if (outcome === "succeeded" || outcome === "unknown") return "success";
  }

  return "idle";
}
