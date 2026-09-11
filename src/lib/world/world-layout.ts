import type { WorldAgent } from "./world-types";

/**
 * Deterministic agent placement inside one session plot (deck radius 3.6).
 * The old modulo-eight ring wrapped the 15-seat roster onto 8 slots, so
 * this layout is explicit: 6 inner specialists, 9 outer specialists with
 * a 10-degree phase offset, and one orchestrator slot at 30 degrees.
 * Minimum tested center separation is >= 1.2 units.
 */
export const SPECIALIST_INNER_RADIUS = 1.3;
export const SPECIALIST_INNER_COUNT = 6;
export const SPECIALIST_OUTER_RADIUS = 2.5;
export const SPECIALIST_OUTER_COUNT = 9;
/** Ten-degree phase offset between the inner and outer specialist rings. */
export const SPECIALIST_OUTER_PHASE = Math.PI / 18;
export const ORCHESTRATOR_RADIUS = 3.2;
export const ORCHESTRATOR_ANGLE = Math.PI / 6;
/** Supported specialist roster size. Higher seats use explicit overflow. */
export const MAX_SPECIALIST_SEATS = 15;
/** Minimum tested center-to-center separation for the 15+1 layout. */
export const MIN_AGENT_SEPARATION = 1.2;

function polar(radius: number, angle: number): { dx: number; dz: number } {
  return { dx: Math.cos(angle) * radius, dz: Math.sin(angle) * radius };
}

function rotate(offset: { dx: number; dz: number }, angle: number): { dx: number; dz: number } {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { dx: offset.dx * cos - offset.dz * sin, dz: offset.dx * sin + offset.dz * cos };
}

function baseSpecialistOffset(slot: number): { dx: number; dz: number } {
  if (slot < SPECIALIST_INNER_COUNT) {
    return polar(SPECIALIST_INNER_RADIUS, (slot / SPECIALIST_INNER_COUNT) * Math.PI * 2);
  }
  const outer = slot - SPECIALIST_INNER_COUNT;
  return polar(
    SPECIALIST_OUTER_RADIUS,
    SPECIALIST_OUTER_PHASE + (outer / SPECIALIST_OUTER_COUNT) * Math.PI * 2,
  );
}

/**
 * Specialist seat position. Seats 0..14 have fixed ring slots; seats
 * outside that range (future roster growth) rotate deterministically by
 * 20 degrees per 15-seat cycle instead of silently wrapping.
 */
export function specialistOffsetForSeat(seatIndex: number): { dx: number; dz: number } {
  const slots = SPECIALIST_INNER_COUNT + SPECIALIST_OUTER_COUNT;
  const slot = ((seatIndex % slots) + slots) % slots;
  const cycle = Math.floor(seatIndex / slots);
  return rotate(baseSpecialistOffset(slot), cycle * (Math.PI / 9));
}

/** Orchestrator slot. Independent of seatIndex (orchestrators use -1). */
export function orchestratorOffset(): { dx: number; dz: number } {
  return polar(ORCHESTRATOR_RADIUS, ORCHESTRATOR_ANGLE);
}

/** Placement for one world agent. Depends only on seat/role, never status. */
export function agentOffsetForAgent(agent: Pick<WorldAgent, "seatIndex" | "isOrchestrator">): {
  dx: number;
  dz: number;
} {
  if (agent.isOrchestrator) return orchestratorOffset();
  return specialistOffsetForSeat(agent.seatIndex);
}

export function orderAgentsForSession(agents: readonly WorldAgent[]): WorldAgent[] {
  return [...agents].sort((a, b) =>
    a.seatIndex - b.seatIndex ||
    (a.agentKey < b.agentKey ? -1 : 1) ||
    (a.id < b.id ? -1 : 1),
  );
}
