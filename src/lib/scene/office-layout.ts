export const TILE_SIZE = 16;

export const OFFICE_DIMENSIONS = {
  width: 384,
  height: 384,
  tileSize: TILE_SIZE,
} as const;

export const LAYERS = {
  floor: 0,
  rearWalls: 10,
  furniture: 20,
  actors: 30,
  foreground: 40,
  taskToken: 50,
  uiLabels: 100,
} as const;

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DeskAnchor {
  furnitureOrigin: Point;
  seatedActorAnchor: Point;
  handoffPoint: Point;
  monitorAnchor: Point;
  propAnchors: Record<string, Point>;
}

/**
 * Fixed roster room: 15 desks (5 cols x 3 rows) matching ROSTER_KEYS order.
 * Seat N never moves. Bottom strip (y304+) holds decor props.
 */
const SEAT_ORIGINS: Array<[number, number]> = [
  [16, 48], [88, 48], [160, 48], [232, 48], [304, 48],
  [16, 144], [88, 144], [160, 144], [232, 144], [304, 144],
  [16, 240], [88, 240], [160, 240], [232, 240], [304, 240],
  // Overflow visitor desk (bottom strip, clear of storage/whiteboard/coffee).
  [200, 304],
];

function makeDesk(ox: number, oy: number): DeskAnchor {
  return {
    furnitureOrigin: { x: ox, y: oy },
    seatedActorAnchor: { x: ox + 16, y: oy + 48 },
    handoffPoint: { x: ox + 16, y: oy + 64 },
    monitorAnchor: { x: ox + 16, y: oy + 20 },
    propAnchors: {
      monitor: { x: ox + 16, y: oy + 20 },
      plant: { x: ox + 40, y: oy + 8 },
      lamp: { x: ox + 5, y: oy + 12 },
    },
  };
}

export const DESK_ANCHORS: Record<number, DeskAnchor> = Object.fromEntries(
  SEAT_ORIGINS.map(([x, y], i) => [i, makeDesk(x, y)])
);

/** Standing admin spot by the door — the orchestrator oversees the floor. */
export const ORCHESTRATOR_SPOT: Point = { x: 88, y: 44 };

export const WALK_LANES: Point[] = [
  { x: 0, y: 128 },
  { x: 384, y: 128 },
  { x: 0, y: 224 },
  { x: 384, y: 224 },
  { x: 0, y: 348 },
  { x: 384, y: 348 },
  { x: 88, y: 0 },
  { x: 88, y: 384 },
];

// Walk spine runs the 8px aisle (gap between desk columns), not through desks.
export const VERTICAL_SPINE_X = 84;

export function getRoute(from: Point, to: Point): Point[] {
  const route: Point[] = [];
  const current = { ...from };

  if (current.x !== VERTICAL_SPINE_X) {
    route.push({ x: VERTICAL_SPINE_X, y: current.y });
    current.x = VERTICAL_SPINE_X;
  }

  if (current.y !== to.y) {
    route.push({ x: current.x, y: to.y });
    current.y = to.y;
  }

  if (current.x !== to.x) {
    route.push({ x: to.x, y: current.y });
    current.x = to.x;
  }

  return route;
}

export function getDeskAnchor(seatIndex: number): DeskAnchor {
  return DESK_ANCHORS[seatIndex] ?? DESK_ANCHORS[0];
}

export function getSeatForActor(): number {
  // Legacy helper kept for compat — seats are fixed per roster key now
  // (see roster.ts seatForAgent). Returns 0; do not use for new code.
  return 0;
}

export function isWalkable(x: number, y: number): boolean {
  if (x < 0 || x >= OFFICE_DIMENSIONS.width || y < 0 || y >= OFFICE_DIMENSIONS.height) {
    return false;
  }

  const nearDesk = Object.values(DESK_ANCHORS).some((desk) => {
    const fx = desk.furnitureOrigin.x;
    const fy = desk.furnitureOrigin.y;
    return x >= fx && x < fx + 64 && y >= fy && y < fy + 64;
  });

  if (nearDesk) return false;

  return true;
}
