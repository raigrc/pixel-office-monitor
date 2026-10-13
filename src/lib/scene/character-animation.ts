export type Pose =
  | "idle"
  | "walk"
  | "seat"
  | "work"
  | "give"
  | "receive"
  | "success"
  | "error";

export interface PoseFrameRange {
  start: number;
  count: number;
}

interface AnimationStep {
  frame: number;
  durationMs: number;
}

type AnimationSteps = readonly [AnimationStep, ...AnimationStep[]];

export type PosePlaybackPolicy =
  | { kind: "static"; frame: number; completes: boolean }
  | { kind: "loop"; steps: AnimationSteps }
  | { kind: "one-shot"; steps: AnimationSteps; finalFrame: number };

export const POSE_FRAMES: Record<Pose, PoseFrameRange> = {
  idle: { start: 0, count: 4 },
  walk: { start: 4, count: 8 },
  seat: { start: 12, count: 2 },
  work: { start: 14, count: 2 },
  give: { start: 16, count: 2 },
  receive: { start: 18, count: 2 },
  success: { start: 20, count: 2 },
  error: { start: 22, count: 2 },
};

const POSE_PLAYBACK: Record<Pose, PosePlaybackPolicy> = {
  idle: { kind: "static", frame: 0, completes: false },
  walk: {
    kind: "loop",
    steps: [
      { frame: 0, durationMs: 62 },
      { frame: 1, durationMs: 62 },
      { frame: 2, durationMs: 62 },
      { frame: 3, durationMs: 62 },
      { frame: 4, durationMs: 62 },
      { frame: 5, durationMs: 62 },
      { frame: 6, durationMs: 62 },
      { frame: 7, durationMs: 62 },
    ],
  },
  seat: {
    kind: "loop",
    steps: [
      { frame: 0, durationMs: 1_600 },
      { frame: 1, durationMs: 180 },
    ],
  },
  work: {
    kind: "loop",
    steps: [
      { frame: 0, durationMs: 95 },
      { frame: 1, durationMs: 95 },
      { frame: 0, durationMs: 95 },
      { frame: 1, durationMs: 450 },
    ],
  },
  give: {
    kind: "one-shot",
    steps: [
      { frame: 0, durationMs: 70 },
      { frame: 1, durationMs: 180 },
    ],
    finalFrame: 1,
  },
  receive: {
    kind: "one-shot",
    steps: [
      { frame: 0, durationMs: 70 },
      { frame: 1, durationMs: 180 },
    ],
    finalFrame: 1,
  },
  success: {
    kind: "one-shot",
    steps: [
      { frame: 0, durationMs: 90 },
      { frame: 1, durationMs: 260 },
    ],
    finalFrame: 1,
  },
  error: {
    kind: "one-shot",
    steps: [
      { frame: 0, durationMs: 90 },
      { frame: 1, durationMs: 260 },
    ],
    finalFrame: 1,
  },
};

export function getPosePlaybackPolicy(pose: Pose, reducedMotion: boolean): PosePlaybackPolicy {
  const policy = POSE_PLAYBACK[pose];
  if (!reducedMotion) return policy;

  if (policy.kind === "one-shot") {
    return { kind: "static", frame: policy.finalFrame, completes: true };
  }

  if (policy.kind === "static") return policy;

  return { kind: "static", frame: policy.steps[0].frame, completes: false };
}
