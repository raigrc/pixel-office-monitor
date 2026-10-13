import type { FloorInfo } from "@/lib/monitor-types";

export function applyFloorSnapshot(floors: FloorInfo[]): FloorInfo[] {
  return [...floors];
}

export function applyFloorDelta(
  current: FloorInfo[],
  upserts: FloorInfo[] = [],
  removals: string[] = [],
): FloorInfo[] {
  const next = new Map(current.map((floor) => [floor.floorId, floor]));
  for (const floor of upserts) next.set(floor.floorId, floor);
  for (const floorId of removals) next.delete(floorId);
  return Array.from(next.values());
}
