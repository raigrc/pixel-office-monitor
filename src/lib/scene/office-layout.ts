export const TILE_SIZE = 16;

export const OFFICE_DIMENSIONS = {
  width: 512,
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

export const OFFICE_ENVIRONMENT_ZONES = {
  lounge: { x: 416, y: 32, width: 80, height: 104 },
  coffee: { x: 416, y: 144, width: 80, height: 64 },
  meeting: { x: 416, y: 224, width: 80, height: 128 },
  storage: { x: 224, y: 16, width: 112, height: 28 },
} as const satisfies Record<string, Rect>;

export type OfficeEnvironmentZoneName = keyof typeof OFFICE_ENVIRONMENT_ZONES;

interface OfficeEnvironmentItem {
  id: string;
  zone: OfficeEnvironmentZoneName;
  assetKey: string;
  bounds: Rect;
}

export const OFFICE_ENVIRONMENT_ITEMS = [
  { id: "storage-shelf", zone: "storage", assetKey: "wall-shelf", bounds: { x: 224, y: 20, width: 48, height: 16 } },
  { id: "storage-cabinet", zone: "storage", assetKey: "credenza", bounds: { x: 272, y: 20, width: 64, height: 24 } },
  { id: "lounge-plant", zone: "lounge", assetKey: "plant", bounds: { x: 476, y: 36, width: 16, height: 24 } },
  { id: "lounge-sofa", zone: "lounge", assetKey: "sofa", bounds: { x: 424, y: 40, width: 48, height: 32 } },
  { id: "lounge-table", zone: "lounge", assetKey: "lounge-table", bounds: { x: 440, y: 80, width: 32, height: 24 } },
  { id: "coffee-shelf", zone: "coffee", assetKey: "wall-shelf", bounds: { x: 432, y: 144, width: 48, height: 16 } },
  { id: "coffee-counter", zone: "coffee", assetKey: "coffee-counter", bounds: { x: 424, y: 172, width: 48, height: 24 } },
  { id: "coffee-machine", zone: "coffee", assetKey: "coffee-machine", bounds: { x: 446, y: 154, width: 16, height: 24 } },
  { id: "meeting-whiteboard", zone: "meeting", assetKey: "whiteboard", bounds: { x: 432, y: 224, width: 48, height: 24 } },
  { id: "meeting-chair-northwest", zone: "meeting", assetKey: "meeting-chair", bounds: { x: 436, y: 260, width: 12, height: 12 } },
  { id: "meeting-chair-northeast", zone: "meeting", assetKey: "meeting-chair", bounds: { x: 468, y: 260, width: 12, height: 12 } },
  { id: "meeting-table", zone: "meeting", assetKey: "conference-table", bounds: { x: 428, y: 270, width: 56, height: 40 } },
  { id: "meeting-chair-southwest", zone: "meeting", assetKey: "meeting-chair", bounds: { x: 436, y: 310, width: 12, height: 12 } },
  { id: "meeting-chair-southeast", zone: "meeting", assetKey: "meeting-chair", bounds: { x: 468, y: 310, width: 12, height: 12 } },
  { id: "meeting-plant", zone: "meeting", assetKey: "plant", bounds: { x: 476, y: 328, width: 16, height: 24 } },
] as const satisfies readonly OfficeEnvironmentItem[];

export const OFFICE_COMMON_FLOORS = [
  { x: 16, y: 16, width: 480, height: 28 },
  { x: 408, y: 16, width: 88, height: 352 },
] as const satisfies readonly Rect[];

export const OFFICE_WALKWAYS = [
  { x: 384, y: 24, width: 24, height: 344 },
  { x: 104, y: 32, width: 16, height: 336 },
  ...[116, 196, 276, 356].map((y) => ({ x: 16, y, width: 400, height: 12 })),
] satisfies readonly Rect[];

export const OFFICE_PARTITIONS = [
  { x: 408, y: 40, width: 4, height: 56 },
  { x: 440, y: 216, width: 56, height: 6 },
  { x: 408, y: 232, width: 4, height: 40 },
  { x: 408, y: 312, width: 4, height: 40 },
] as const satisfies readonly Rect[];

export const OFFICE_RUGS = [
  { zone: "lounge", bounds: { x: 420, y: 56, width: 72, height: 72 } },
  { zone: "meeting", bounds: { x: 420, y: 252, width: 72, height: 84 } },
] as const satisfies readonly { zone: OfficeEnvironmentZoneName; bounds: Rect }[];

export const OFFICE_LIGHT_SHAFT_OPACITY = {
  day: 0.16,
  dusk: 0.1,
  night: 0,
} as const;

/**
 * Compact roster room: 16 possible desks in four columns. Default roles fill
 * seats 0-10; observed optional roles append from seat 11 without gaps.
 */
const SEAT_ORIGINS: Array<[number, number]> = [
  [32, 48], [128, 48], [224, 48], [320, 48],
  [32, 128], [128, 128], [224, 128], [320, 128],
  [32, 208], [128, 208], [224, 208], [320, 208],
  [32, 288], [128, 288], [224, 288], [320, 288],
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
export const ORCHESTRATOR_SPOT: Point = { x: 112, y: 44 };

export const WALK_LANES: Point[] = [
  { x: 0, y: 112 },
  { x: 512, y: 112 },
  { x: 0, y: 192 },
  { x: 512, y: 192 },
  { x: 0, y: 272 },
  { x: 512, y: 272 },
  { x: 112, y: 0 },
  { x: 112, y: 384 },
];

export const VERTICAL_SPINE_X = 112;

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
