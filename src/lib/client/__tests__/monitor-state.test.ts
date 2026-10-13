import { describe, expect, it } from "vitest";
import type { FloorInfo } from "@/lib/monitor-types";
import { applyFloorDelta, applyFloorSnapshot } from "../monitor-state";

function floor(id: string, closed = false): FloorInfo {
  return {
    floorId: id,
    rootSessionId: id,
    projectId: "project",
    title: id,
    createdAt: 1,
    updatedAt: 1,
    closed,
    closedAt: closed ? 2 : null,
    sessionId: id,
  };
}

describe("applyFloorDelta", () => {
  it("retains a closed floor upsert", () => {
    expect(applyFloorDelta([floor("one")], [floor("one", true)])).toEqual([floor("one", true)]);
  });

  it("removes only explicit floor removals", () => {
    expect(applyFloorDelta([floor("one", true), floor("two")], [], ["one"])).toEqual([floor("two")]);
  });
});

describe("applyFloorSnapshot", () => {
  it("retains closed floors in a new collection", () => {
    const input = [floor("open"), floor("closed", true)];
    const result = applyFloorSnapshot(input);
    expect(result).toEqual(input);
    expect(result).not.toBe(input);
  });
});
