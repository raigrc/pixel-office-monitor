import { describe, it, expect } from "vitest";
import { getDayNightPhase, isNight } from "@/lib/scene/day-night";
import { stageForTimeOfDay } from "@/lib/scene/lighting-time";

describe("day-night phase", () => {
  it("uses shared day, dusk, and night stage boundaries", () => {
    expect(stageForTimeOfDay(4.99)).toBe("night");
    expect(stageForTimeOfDay(5)).toBe("dusk");
    expect(stageForTimeOfDay(6.5)).toBe("dusk");
    expect(stageForTimeOfDay(7)).toBe("day");
    expect(stageForTimeOfDay(16.99)).toBe("day");
    expect(stageForTimeOfDay(17)).toBe("dusk");
    expect(stageForTimeOfDay(19.99)).toBe("dusk");
    expect(stageForTimeOfDay(20)).toBe("night");
  });

  it("derives presentation stages from local dates", () => {
    expect(getDayNightPhase(new Date(2026, 0, 1, 6, 0))).toBe("dusk");
    expect(getDayNightPhase(new Date(2026, 0, 1, 12, 0))).toBe("day");
    expect(getDayNightPhase(new Date(2026, 0, 1, 18, 30))).toBe("dusk");
    expect(getDayNightPhase(new Date(2026, 0, 1, 0, 0))).toBe("night");
    expect(getDayNightPhase(new Date(2026, 0, 1, 23, 30))).toBe("night");
  });

  it("isNight helper matches", () => {
    expect(isNight(new Date(2026, 0, 1, 12))).toBe(false);
    expect(isNight(new Date(2026, 0, 1, 18, 30))).toBe(false);
    expect(isNight(new Date(2026, 0, 1, 22))).toBe(true);
  });
});
