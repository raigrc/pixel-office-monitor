import { describe, expect, it } from "vitest";

import { getActorHitTarget, MIN_PHYSICAL_HIT_TARGET_SIZE } from "../hit-target";

describe("actor scene hit target", () => {
  it("preserves existing target geometry when viewport already provides 44 pixels", () => {
    expect(getActorHitTarget({ x: 100, y: 120 }, 1, 1)).toEqual({
      left: 76,
      top: 80,
      size: 48,
    });
  });

  it("compensates for viewport zoom while preserving target center", () => {
    const target = getActorHitTarget({ x: 100, y: 120 }, 1, 0.5);

    expect(target.size * 0.5).toBe(MIN_PHYSICAL_HIT_TARGET_SIZE);
    expect(target.left + target.size / 2).toBe(100);
    expect(target.top + target.size / 2).toBe(104);
  });

  it("keeps a larger scaled target when it already exceeds minimum", () => {
    const target = getActorHitTarget({ x: 200, y: 240 }, 2, 0.5);

    expect(target.size).toBe(96);
    expect(target.size * 0.5).toBe(48);
  });
});
