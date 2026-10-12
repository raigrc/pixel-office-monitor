import { describe, expect, it } from "vitest";

import { getPosePlaybackPolicy, POSE_FRAMES, type Pose } from "../character-animation";

describe("character pose playback policy", () => {
  it("keeps sleeping idle body static on first idle frame", () => {
    expect(getPosePlaybackPolicy("idle", false)).toEqual({
      kind: "static",
      frame: 0,
      completes: false,
    });
  });

  it("uses short second frame as slow seated blink", () => {
    expect(getPosePlaybackPolicy("seat", false)).toEqual({
      kind: "loop",
      steps: [
        { frame: 0, durationMs: 1_600 },
        { frame: 1, durationMs: 180 },
      ],
    });
  });

  it("types in a short alternating burst followed by a pause", () => {
    expect(getPosePlaybackPolicy("work", false)).toEqual({
      kind: "loop",
      steps: [
        { frame: 0, durationMs: 95 },
        { frame: 1, durationMs: 95 },
        { frame: 0, durationMs: 95 },
        { frame: 1, durationMs: 450 },
      ],
    });
  });

  it.each(["give", "receive", "success", "error"] satisfies Pose[])(
    "%s plays once and lands on final frame",
    (pose) => {
      const policy = getPosePlaybackPolicy(pose, false);
      expect(policy.kind).toBe("one-shot");
      if (policy.kind !== "one-shot") return;

      expect(policy.steps.map((step) => step.frame)).toEqual([0, 1]);
      expect(policy.finalFrame).toBe(POSE_FRAMES[pose].count - 1);
    }
  );

  it.each(["walk", "seat", "work"] satisfies Pose[])(
    "freezes %s loops on their meaningful first frame under reduced motion",
    (pose) => {
      expect(getPosePlaybackPolicy(pose, true)).toEqual({
        kind: "static",
        frame: 0,
        completes: false,
      });
    }
  );

  it.each(["give", "receive", "success", "error"] satisfies Pose[])(
    "freezes %s on final frame and completes under reduced motion",
    (pose) => {
      expect(getPosePlaybackPolicy(pose, true)).toEqual({
        kind: "static",
        frame: 1,
        completes: true,
      });
    }
  );
});
