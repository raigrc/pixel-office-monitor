import { agents } from "@/lib/agents";

/**
 * Fixed-desk roster room.
 *
 * Every seated agent owns one desk forever (seat = roster position), so desks
 * never leak, never churn, and a second call for the same agent lands on the
 * SAME cubicle (surfaced as a busy/queue badge, not a new desk).
 *
 * - `orchestrator` stands as admin by the door (no desk).
 * - Hidden internal roles (`system`, `title`, `summary`, `compaction`) never
 *   take desks — they are signals, not occupants.
 * - Unknown future agent keys share the intern corner (last wins rendering).
 */

export const STANDING_ADMIN = "orchestrator";

const HIDDEN_KEYS = new Set(["system", "title", "summary", "compaction"]);

function normalizeKey(agentKey: string): string {
  return (agentKey ?? "").trim().toLowerCase();
}

/** The 15 seated agents, in canonical order = seat order 0–14. */
export const ROSTER_KEYS: string[] = Object.keys(agents).filter(
  (k) => k !== "unknown" && k !== "intern" && !HIDDEN_KEYS.has(k) && k !== STANDING_ADMIN
);

export const ROSTER_SIZE = ROSTER_KEYS.length;

/**
 * Shared visitor desk for unknown future agent keys (bottom strip, clear of
 * decor). Roster seats are never shared — a guest can never evict scout.
 */
export const OVERFLOW_SEAT = ROSTER_SIZE;

export const ROSTER_SEATS: Record<string, number> = Object.fromEntries(
  ROSTER_KEYS.map((k, i) => [k, i])
);

/** Fixed seat for an agent key. -1 = never seated (admin standing, hidden). */
export function seatForAgent(agentKey: string): number {
  const key = normalizeKey(agentKey);
  if (!key || HIDDEN_KEYS.has(key) || key === STANDING_ADMIN) return -1;
  return ROSTER_SEATS[key] ?? OVERFLOW_SEAT;
}

export function isHiddenKey(agentKey: string): boolean {
  return HIDDEN_KEYS.has(normalizeKey(agentKey));
}

export function isStandingAdmin(agentKey: string): boolean {
  return normalizeKey(agentKey) === STANDING_ADMIN;
}
