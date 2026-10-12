/**
 * Shared local-time source for the 2D day/night phase and the 3D sky.
 * Both systems read the same local clock conversion; neither touches
 * monitor-store or any renderer. Kept free of three.js so the 2D bundle
 * does not pay for the 3D dependency.
 */

/** Fractional local hours in [0, 24) for a Date. */
export function deriveTimeOfDayFromDate(date: Date): number {
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

/** Wraps any hour value into [0, 24) for manual slider input. */
export function normalizeTimeOfDay(t: number): number {
  return ((t % 24) + 24) % 24;
}

export type TimeStage = "day" | "dusk" | "night";

export const DAY_START = 7;
export const DAY_END = 17;
export const DUSK_MORNING_START = 5;
export const DUSK_EVENING_END = 20;

export function stageForTimeOfDay(timeOfDay: number): TimeStage {
  const normalized = normalizeTimeOfDay(timeOfDay);
  if (normalized >= DUSK_MORNING_START && normalized < DAY_START) return "dusk";
  if (normalized >= DAY_START && normalized < DAY_END) return "day";
  if (normalized >= DAY_END && normalized < DUSK_EVENING_END) return "dusk";
  return "night";
}

export function deriveTimeStageFromDate(date: Date): TimeStage {
  return stageForTimeOfDay(deriveTimeOfDayFromDate(date));
}
