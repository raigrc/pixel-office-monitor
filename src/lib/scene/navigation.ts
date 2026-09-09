import * as THREE from 'three';

export const NAV_CELL_SIZE = 0.5;
export const NAV_HALF_EXTENT = 56;
export const NAV_GRID_SIZE = Math.ceil((NAV_HALF_EXTENT * 2) / NAV_CELL_SIZE);

export const AGENT_RADIUS = 0.55;
export const SEPARATION_DIST = 1.15;
export const ARRIVAL_RADIUS = 1.6;
export const MAX_BLOCKED_TIME = 6.0;

export interface NavGrid {
  obstacles: Uint8Array;
  generation: number;
  width: number;
  height: number;
}

export function createNavGrid(): NavGrid {
  return {
    obstacles: new Uint8Array(NAV_GRID_SIZE * NAV_GRID_SIZE),
    generation: 1,
    width: NAV_GRID_SIZE,
    height: NAV_GRID_SIZE,
  };
}

export function worldToGrid(x: number, z: number): { gx: number; gz: number } {
  const gx = Math.floor((x + NAV_HALF_EXTENT) / NAV_CELL_SIZE);
  const gz = Math.floor((z + NAV_HALF_EXTENT) / NAV_CELL_SIZE);
  return {
    gx: THREE.MathUtils.clamp(gx, 0, NAV_GRID_SIZE - 1),
    gz: THREE.MathUtils.clamp(gz, 0, NAV_GRID_SIZE - 1),
  };
}

export function gridToWorld(gx: number, gz: number): THREE.Vector3 {
  const x = gx * NAV_CELL_SIZE + NAV_CELL_SIZE * 0.5 - NAV_HALF_EXTENT;
  const z = gz * NAV_CELL_SIZE + NAV_CELL_SIZE * 0.5 - NAV_HALF_EXTENT;
  return new THREE.Vector3(x, 0, z);
}

export function rasterizeCircle(grid: NavGrid, cx: number, cz: number, radius: number): void {
  const { gx: centerGx, gz: centerGz } = worldToGrid(cx, cz);
  const radiusCells = Math.ceil(radius / NAV_CELL_SIZE);

  for (let dz = -radiusCells; dz <= radiusCells; dz++) {
    for (let dx = -radiusCells; dx <= radiusCells; dx++) {
      const gx = centerGx + dx;
      const gz = centerGz + dz;
      if (gx < 0 || gx >= grid.width || gz < 0 || gz >= grid.height) continue;

      const wx = gx * NAV_CELL_SIZE + NAV_CELL_SIZE * 0.5 - NAV_HALF_EXTENT;
      const wz = gz * NAV_CELL_SIZE + NAV_CELL_SIZE * 0.5 - NAV_HALF_EXTENT;
      const dist = Math.hypot(wx - cx, wz - cz);

      if (dist <= radius) {
        grid.obstacles[gz * grid.width + gx] = grid.generation;
      }
    }
  }
}

export function rasterizeBuilding(grid: NavGrid, position: THREE.Vector3, footprintRadius: number): void {
  const effectiveRadius = footprintRadius * 0.8 + AGENT_RADIUS;
  rasterizeCircle(grid, position.x, position.z, effectiveRadius);
}

export function rasterizeScatter(grid: NavGrid, positions: THREE.Vector3[], radius: number): void {
  for (const pos of positions) {
    rasterizeCircle(grid, pos.x, pos.z, radius + AGENT_RADIUS);
  }
}

export function rasterizeShip(grid: NavGrid, position: THREE.Vector3, radius: number): void {
  rasterizeCircle(grid, position.x, position.z, radius + AGENT_RADIUS);
}

export function clearGrid(grid: NavGrid): void {
  grid.generation++;
  if (grid.generation === 255) {
    grid.obstacles.fill(0);
    grid.generation = 1;
  }
}

export function isNavWalkable(grid: NavGrid, gx: number, gz: number): boolean {
  if (gx < 0 || gx >= grid.width || gz < 0 || gz >= grid.height) return false;
  return grid.obstacles[gz * grid.width + gx] !== grid.generation;
}

export interface PathResult {
  waypoints: THREE.Vector3[];
  blocked: boolean;
}

interface Node {
  gx: number;
  gz: number;
  g: number;
  f: number;
  parentGx: number;
  parentGz: number;
}

const NEIGHBORS_8 = [
  { dx: 1, dz: 0, cost: 1 },
  { dx: -1, dz: 0, cost: 1 },
  { dx: 0, dz: 1, cost: 1 },
  { dx: 0, dz: -1, cost: 1 },
  { dx: 1, dz: 1, cost: 1.414 },
  { dx: 1, dz: -1, cost: 1.414 },
  { dx: -1, dz: 1, cost: 1.414 },
  { dx: -1, dz: -1, cost: 1.414 },
];

const SCRATCH_OPEN: Node[] = [];
const SCRATCH_CLOSED: Uint8Array = new Uint8Array(NAV_GRID_SIZE * NAV_GRID_SIZE);
const SCRATCH_G_SCORE: Float32Array = new Float32Array(NAV_GRID_SIZE * NAV_GRID_SIZE);
const SCRATCH_PARENT: Int32Array = new Int32Array(NAV_GRID_SIZE * NAV_GRID_SIZE);

function idx(gx: number, gz: number, width: number): number {
  return gz * width + gx;
}

export function findPath(
  grid: NavGrid,
  start: THREE.Vector3,
  goal: THREE.Vector3
): PathResult {
  const { gx: startGx, gz: startGz } = worldToGrid(start.x, start.z);
  const { gx: goalGx, gz: goalGz } = worldToGrid(goal.x, goal.z);

  if (!isNavWalkable(grid, startGx, startGz) || !isNavWalkable(grid, goalGx, goalGz)) {
    return { waypoints: [], blocked: true };
  }

  if (startGx === goalGx && startGz === goalGz) {
    return { waypoints: [goal], blocked: false };
  }

  SCRATCH_OPEN.length = 0;
  SCRATCH_CLOSED.fill(0);
  SCRATCH_G_SCORE.fill(Infinity);

  const startIndex = idx(startGx, startGz, grid.width);
  SCRATCH_G_SCORE[startIndex] = 0;
  SCRATCH_PARENT[startIndex] = -1;

  SCRATCH_OPEN.push({
    gx: startGx,
    gz: startGz,
    g: 0,
    f: heuristic(startGx, startGz, goalGx, goalGz),
    parentGx: -1,
    parentGz: -1,
  });

  let openStart = 0;
  const maxIterations = grid.width * grid.height;

  for (let iter = 0; iter < maxIterations && openStart < SCRATCH_OPEN.length; iter++) {
    let bestIdx = openStart;
    let bestF = SCRATCH_OPEN[openStart].f;
    for (let i = openStart + 1; i < SCRATCH_OPEN.length; i++) {
      if (SCRATCH_OPEN[i].f < bestF) {
        bestF = SCRATCH_OPEN[i].f;
        bestIdx = i;
      }
    }

    if (bestIdx !== openStart) {
      [SCRATCH_OPEN[openStart], SCRATCH_OPEN[bestIdx]] = [SCRATCH_OPEN[bestIdx], SCRATCH_OPEN[openStart]];
    }

    const current = SCRATCH_OPEN[openStart];
    openStart++;

    if (current.gx === goalGx && current.gz === goalGz) {
      return reconstructPath(grid, current, startGx, startGz);
    }

    const currentIndex = idx(current.gx, current.gz, grid.width);
    SCRATCH_CLOSED[currentIndex] = 1;

    for (const n of NEIGHBORS_8) {
      const ngx = current.gx + n.dx;
      const ngz = current.gz + n.dz;

      if (ngx < 0 || ngx >= grid.width || ngz < 0 || ngz >= grid.height) continue;
      if (!isNavWalkable(grid, ngx, ngz)) continue;

      const neighborIndex = idx(ngx, ngz, grid.width);
      if (SCRATCH_CLOSED[neighborIndex]) continue;

      const g = current.g + n.cost;

      if (g < SCRATCH_G_SCORE[neighborIndex]) {
        SCRATCH_G_SCORE[neighborIndex] = g;
        SCRATCH_PARENT[neighborIndex] = currentIndex;

        const f = g + heuristic(ngx, ngz, goalGx, goalGz);

        let existingIdx = -1;
        for (let i = openStart; i < SCRATCH_OPEN.length; i++) {
          if (SCRATCH_OPEN[i].gx === ngx && SCRATCH_OPEN[i].gz === ngz) {
            existingIdx = i;
            break;
          }
        }

        if (existingIdx >= 0) {
          SCRATCH_OPEN[existingIdx].g = g;
          SCRATCH_OPEN[existingIdx].f = f;
        } else {
          SCRATCH_OPEN.push({
            gx: ngx,
            gz: ngz,
            g,
            f,
            parentGx: current.gx,
            parentGz: current.gz,
          });
        }
      }
    }
  }

  return { waypoints: [], blocked: true };
}

function heuristic(gx: number, gz: number, goalGx: number, goalGz: number): number {
  const dx = Math.abs(gx - goalGx);
  const dz = Math.abs(gz - goalGz);
  return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
}

function reconstructPath(
  grid: NavGrid,
  goalNode: Node,
  startGx: number,
  startGz: number
): PathResult {
  const path: { gx: number; gz: number }[] = [];
  let gx = goalNode.gx;
  let gz = goalNode.gz;

  while (!(gx === startGx && gz === startGz)) {
    path.push({ gx, gz });
    const currentIndex = idx(gx, gz, grid.width);
    const parentIndex = SCRATCH_PARENT[currentIndex];
    if (parentIndex === -1) break;
    gx = parentIndex % grid.width;
    gz = Math.floor(parentIndex / grid.width);
  }
  path.push({ gx: startGx, gz: startGz });
  path.reverse();

  const waypoints: THREE.Vector3[] = [];
  for (let i = 0; i < path.length; i++) {
    const wp = gridToWorld(path[i].gx, path[i].gz);
    waypoints.push(wp);
  }

  const simplified = stringPull(waypoints, grid);
  return { waypoints: simplified, blocked: false };
}

function stringPull(waypoints: THREE.Vector3[], grid: NavGrid): THREE.Vector3[] {
  if (waypoints.length <= 2) return waypoints;

  const result: THREE.Vector3[] = [waypoints[0]];
  let currentIdx = 0;

  for (let i = 2; i < waypoints.length; i++) {
    if (!lineOfSight(grid, result[currentIdx], waypoints[i])) {
      result.push(waypoints[i - 1]);
      currentIdx = result.length - 1;
    }
  }

  result.push(waypoints[waypoints.length - 1]);
  return result;
}

function lineOfSight(grid: NavGrid, a: THREE.Vector3, b: THREE.Vector3): boolean {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const dist = Math.hypot(dx, dz);
  const steps = Math.ceil(dist / (NAV_CELL_SIZE * 0.5));

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = a.x + dx * t;
    const z = a.z + dz * t;
    const { gx, gz } = worldToGrid(x, z);
    if (!isNavWalkable(grid, gx, gz)) return false;
  }
  return true;
}

export function nearestFree(grid: NavGrid, x: number, z: number, maxRadius = 20): THREE.Vector3 | null {
  const { gx, gz } = worldToGrid(x, z);
  if (isNavWalkable(grid, gx, gz)) return new THREE.Vector3(x, 0, z);

  for (let r = 1; r <= maxRadius; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
        const ngx = gx + dx;
        const ngz = gz + dz;
        if (isNavWalkable(grid, ngx, ngz)) {
          return gridToWorld(ngx, ngz);
        }
      }
    }
  }
  return null;
}

export function computeSeparation(
  agent: { position: THREE.Vector3; velocity: THREE.Vector3 },
  agents: { position: THREE.Vector3 }[],
  separationDist: number
): THREE.Vector3 {
  const force = new THREE.Vector3();
  let count = 0;

  for (const other of agents) {
    if (other.position === agent.position) continue;
    const diff = new THREE.Vector3().subVectors(agent.position, other.position);
    const dist = diff.length();
    if (dist > 0 && dist < separationDist) {
      force.add(diff.normalize().divideScalar(dist));
      count++;
    }
  }

  if (count > 0) force.divideScalar(count);
  return force;
}

export function slideAlongObstacle(
  agent: { position: THREE.Vector3; velocity: THREE.Vector3 },
  grid: NavGrid,
  step: number
): THREE.Vector3 {
  const { gx, gz } = worldToGrid(agent.position.x, agent.position.z);
  const dirs = [
    { dx: 1, dz: 0 }, { dx: -1, dz: 0 },
    { dx: 0, dz: 1 }, { dx: 0, dz: -1 },
    { dx: 1, dz: 1 }, { dx: 1, dz: -1 },
    { dx: -1, dz: 1 }, { dx: -1, dz: -1 },
  ];

  for (const d of dirs) {
    const ngx = gx + d.dx;
    const ngz = gz + d.dz;
    if (isNavWalkable(grid, ngx, ngz)) {
      const target = gridToWorld(ngx, ngz);
      const toTarget = new THREE.Vector3().subVectors(target, agent.position);
      toTarget.y = 0;
      if (toTarget.length() > 0.01) {
        return toTarget.normalize().multiplyScalar(step);
      }
    }
  }
  return new THREE.Vector3();
}

export function getWorkSite(
  buildingPos: THREE.Vector3,
  buildingFootprint: number,
  grid: NavGrid
): THREE.Vector3 | null {
  const radius = buildingFootprint + AGENT_RADIUS + 0.5;
  const angles = 8;

  for (let i = 0; i < angles; i++) {
    const angle = (i / angles) * Math.PI * 2;
    const x = buildingPos.x + Math.cos(angle) * radius;
    const z = buildingPos.z + Math.sin(angle) * radius;

    const { gx, gz } = worldToGrid(x, z);
    if (isNavWalkable(grid, gx, gz)) {
      return new THREE.Vector3(x, 0, z);
    }
  }

  return nearestFree(grid, buildingPos.x, buildingPos.z, 10);
}