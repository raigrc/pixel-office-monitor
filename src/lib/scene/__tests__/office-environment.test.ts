import { describe, expect, it } from "vitest";

import {
  DESK_ANCHORS,
  OFFICE_DIMENSIONS,
  OFFICE_ENVIRONMENT_ITEMS,
  OFFICE_ENVIRONMENT_ZONES,
  OFFICE_LIGHT_SHAFT_OPACITY,
  OFFICE_PARTITIONS,
  OFFICE_RUGS,
  OFFICE_WALKWAYS,
  ORCHESTRATOR_SPOT,
  getRoute,
  type Point,
  type Rect,
} from "../office-layout";

const EXPECTED_ZONES = {
  lounge: { x: 416, y: 32, width: 80, height: 104 },
  coffee: { x: 416, y: 144, width: 80, height: 64 },
  meeting: { x: 416, y: 224, width: 80, height: 128 },
  storage: { x: 224, y: 16, width: 112, height: 28 },
} as const;

function rectanglesIntersect(first: Rect, second: Rect): boolean {
  return first.x < second.x + second.width
    && first.x + first.width > second.x
    && first.y < second.y + second.height
    && first.y + first.height > second.y;
}

function segmentIntersectsRect(from: Point, to: Point, rect: Rect): boolean {
  if (from.x === to.x) {
    const lowY = Math.min(from.y, to.y);
    const highY = Math.max(from.y, to.y);
    return from.x >= rect.x
      && from.x < rect.x + rect.width
      && lowY < rect.y + rect.height
      && highY >= rect.y;
  }

  const lowX = Math.min(from.x, to.x);
  const highX = Math.max(from.x, to.x);
  return from.y >= rect.y
    && from.y < rect.y + rect.height
    && lowX < rect.x + rect.width
    && highX >= rect.x;
}

describe("2D office environment geometry", () => {
  it("preserves room, seat, anchor, and orchestrator geometry", () => {
    const expectedOrigins = [
      [32, 48], [128, 48], [224, 48], [320, 48],
      [32, 128], [128, 128], [224, 128], [320, 128],
      [32, 208], [128, 208], [224, 208], [320, 208],
      [32, 288], [128, 288], [224, 288], [320, 288],
    ];

    expect(OFFICE_DIMENSIONS).toEqual({ width: 512, height: 384, tileSize: 16 });
    expect(ORCHESTRATOR_SPOT).toEqual({ x: 112, y: 44 });
    expect(Object.values(DESK_ANCHORS).map((desk) => [desk.furnitureOrigin.x, desk.furnitureOrigin.y])).toEqual(expectedOrigins);
    for (const desk of Object.values(DESK_ANCHORS)) {
      expect(desk.seatedActorAnchor).toEqual({ x: desk.furnitureOrigin.x + 16, y: desk.furnitureOrigin.y + 48 });
      expect(desk.handoffPoint).toEqual({ x: desk.furnitureOrigin.x + 16, y: desk.furnitureOrigin.y + 64 });
    }
  });

  it("places rear-wall storage separately from the connected common rooms", () => {
    expect(OFFICE_ENVIRONMENT_ZONES).toEqual(EXPECTED_ZONES);
  });

  it("contains every environment item inside its declared zone", () => {
    for (const item of OFFICE_ENVIRONMENT_ITEMS) {
      const zone = OFFICE_ENVIRONMENT_ZONES[item.zone];
      expect(item.bounds.x, item.id).toBeGreaterThanOrEqual(zone.x);
      expect(item.bounds.y, item.id).toBeGreaterThanOrEqual(zone.y);
      expect(item.bounds.x + item.bounds.width, item.id).toBeLessThanOrEqual(zone.x + zone.width);
      expect(item.bounds.y + item.bounds.height, item.id).toBeLessThanOrEqual(zone.y + zone.height);
    }
  });

  it("uses exact static daylight shaft opacity by time stage", () => {
    expect(OFFICE_LIGHT_SHAFT_OPACITY).toEqual({ day: 0.16, dusk: 0.1, night: 0 });
  });

  it("keeps walkways clear of furniture, partitions, and all sixteen desk fronts", () => {
    const obstacles = [
      ...OFFICE_ENVIRONMENT_ITEMS.map((item) => item.bounds),
      ...OFFICE_PARTITIONS,
      ...Object.values(DESK_ANCHORS).map((desk) => ({ ...desk.furnitureOrigin, width: 64, height: 68 })),
    ];
    for (const walkway of OFFICE_WALKWAYS) {
      expect(obstacles.some((obstacle) => rectanglesIntersect(walkway, obstacle))).toBe(false);
    }
  });

  it("contains rugs and partitions inside the room walls", () => {
    for (const bounds of [...OFFICE_PARTITIONS, ...OFFICE_RUGS.map((rug) => rug.bounds)]) {
      expect(bounds.x).toBeGreaterThanOrEqual(16);
      expect(bounds.y).toBeGreaterThanOrEqual(16);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(496);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(368);
    }
  });

  it("connects the entrance to every common room with all sixteen desks occupied", () => {
    const obstacles = [
      ...OFFICE_ENVIRONMENT_ITEMS.map((item) => item.bounds),
      ...OFFICE_PARTITIONS,
      ...Object.values(DESK_ANCHORS).map((desk) => ({ ...desk.furnitureOrigin, width: 64, height: 68 })),
    ];
    const queue: Point[] = [ORCHESTRATOR_SPOT];
    const visited = new Set([`${ORCHESTRATOR_SPOT.x},${ORCHESTRATOR_SPOT.y}`]);
    for (let index = 0; index < queue.length; index += 1) {
      const { x, y } = queue[index];
      for (const next of [{ x: x + 4, y }, { x: x - 4, y }, { x, y: y + 4 }, { x, y: y - 4 }]) {
        const key = `${next.x},${next.y}`;
        if (visited.has(key) || next.x < 16 || next.x >= 496 || next.y < 16 || next.y >= 368) continue;
        if (obstacles.some((bounds) => rectanglesIntersect({ ...next, width: 4, height: 4 }, bounds))) continue;
        visited.add(key);
        queue.push(next);
      }
    }
    expect(["420,120", "420,200", "420,280", "256,44"].map((entry) => visited.has(entry))).toEqual([true, true, true, true]);
  });

  it("keeps every zone outside all sixteen 64px seat footprints", () => {
    for (const [zoneName, zone] of Object.entries(OFFICE_ENVIRONMENT_ZONES)) {
      for (const [seatIndex, desk] of Object.entries(DESK_ANCHORS)) {
        const seatFootprint = { ...desk.furnitureOrigin, width: 64, height: 64 };
        expect(
          rectanglesIntersect(zone, seatFootprint),
          `${zoneName} overlaps seat ${seatIndex}`,
        ).toBe(false);
      }
    }
  });

  it("keeps every zone clear of all current handoff route segments", () => {
    const starts = [
      ORCHESTRATOR_SPOT,
      ...Object.values(DESK_ANCHORS).map((desk) => desk.seatedActorAnchor),
    ];
    const destinations = Object.values(DESK_ANCHORS).map((desk) => desk.handoffPoint);

    for (const start of starts) {
      for (const destination of destinations) {
        const points = [start, ...getRoute(start, destination)];
        for (let index = 1; index < points.length; index += 1) {
          for (const [zoneName, zone] of [
            ...Object.entries(OFFICE_ENVIRONMENT_ZONES),
            ...OFFICE_PARTITIONS.map((partition, i) => [`partition-${i}`, partition] as const),
          ]) {
            expect(
              segmentIntersectsRect(points[index - 1], points[index], zone),
              `${zoneName} intersects route ${JSON.stringify(points)}`,
            ).toBe(false);
          }
        }
      }
    }
  });
});
