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
