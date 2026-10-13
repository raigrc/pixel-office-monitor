import { describe, expect, it } from "vitest";
import type { WorldAgent } from "../world-types";
import {
  agentOffsetForAgent,
  MIN_AGENT_SEPARATION,
  orchestratorOffset,
  orderAgentsForSession,
  specialistOffsetForSeat,
} from "../world-layout";

function agent(id: string, seatIndex: number): WorldAgent {
  return {
    id,
    worldId: "f1",
    sessionId: "ses-f1",
    agentKey: id,
    displayName: id,
    role: "specialist",
    isOrchestrator: false,
    status: "working",
    seatIndex,
  };
}

function dist(
  a: { dx: number; dz: number },
  b: { dx: number; dz: number },
): number {
  return Math.hypot(a.dx - b.dx, a.dz - b.dz);
}

describe("world-layout (1.1C)", () => {
  it("fits 15 specialists plus the orchestrator with no reused positions", () => {
    const spots = new Map<string, { dx: number; dz: number }>();
    for (let seat = 0; seat < 15; seat++) {
      const at = specialistOffsetForSeat(seat);
      spots.set(`specialist:${seat}`, at);
    }
    spots.set("orchestrator", orchestratorOffset());

    const values = [...spots.values()];
    expect(values.length).toBe(16);
    for (let i = 0; i < values.length; i++) {
      for (let j = i + 1; j < values.length; j++) {
        expect(dist(values[i], values[j])).toBeGreaterThanOrEqual(
          MIN_AGENT_SEPARATION - 1e-9,
        );
      }
    }
  });

  it("keeps every 15+1 center inside the session deck", () => {
    for (let seat = 0; seat < 15; seat++) {
      const at = specialistOffsetForSeat(seat);
      expect(Math.hypot(at.dx, at.dz)).toBeLessThanOrEqual(3.6);
    }
    const orch = orchestratorOffset();
    expect(Math.hypot(orch.dx, orch.dz)).toBeLessThanOrEqual(3.6);
  });

  it("places the orchestrator independently of seatIndex", () => {
    const expected = orchestratorOffset();
    expect(agentOffsetForAgent({ seatIndex: -1, isOrchestrator: true })).toEqual(expected);
    expect(agentOffsetForAgent({ seatIndex: 99, isOrchestrator: true })).toEqual(expected);
  });

  it("keeps specialist seats stable regardless of status changes", () => {
    const before = agentOffsetForAgent(agent("a", 7));
    const after = agentOffsetForAgent({ ...agent("a", 7), status: "idle" });
    expect(after).toEqual(before);
    expect(specialistOffsetForSeat(7)).toEqual(before);
  });

  it("gives overflow seats explicit deterministic positions inside the deck", () => {
    const first = specialistOffsetForSeat(15);
    expect(specialistOffsetForSeat(15)).toEqual(first);
    expect(Math.hypot(first.dx, first.dz)).toBeLessThanOrEqual(3.6);
    expect(specialistOffsetForSeat(30)).toEqual(specialistOffsetForSeat(30));
  });

  it("orders agents deterministically without moving existing seats", () => {
    const ordered = orderAgentsForSession([agent("b", 3), agent("a", 1), agent("c", 1)]);
    expect(ordered.map((a) => a.id)).toEqual(["a", "c", "b"]);
  });
});
