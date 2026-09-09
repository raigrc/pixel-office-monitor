import { describe, it, expect } from "vitest";
import { getDayNightPhase, isNight } from "@/lib/scene/day-night";

describe("day-night phase", () => {
  it("day 06–18 local", () => {
    expect(getDayNightPhase(new Date(2026, 0, 1, 6, 0))).toBe("day");
    expect(getDayNightPhase(new Date(2026, 0, 1, 12, 0))).toBe("day");
    expect(getDayNightPhase(new Date(2026, 0, 1, 17, 59))).toBe("day");
  });
  it("night outside 06–18", () => {
    expect(getDayNightPhase(new Date(2026, 0, 1, 0, 0))).toBe("night");
    expect(getDayNightPhase(new Date(2026, 0, 1, 5, 59))).toBe("night");
    expect(getDayNightPhase(new Date(2026, 0, 1, 18, 0))).toBe("night");
    expect(getDayNightPhase(new Date(2026, 0, 1, 23, 30))).toBe("night");
  });
  it("isNight helper matches", () => {
    expect(isNight(new Date(2026, 0, 1, 12))).toBe(false);
    expect(isNight(new Date(2026, 0, 1, 22))).toBe(true);
  });
});
