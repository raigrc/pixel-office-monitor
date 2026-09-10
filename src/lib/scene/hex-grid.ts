import * as THREE from 'three';

export const HEX_DIRS = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export const HEX_SIZE = 1.5;
// Deck slabs sit above the worst terrain relief (TERRAIN_HALF_RANGE).
export const DECK_TOP = 0.6;

export interface HexCell {
  q: number;
  r: number;
  projectId?: string;
}

export function hexToWorld(q: number, r: number): THREE.Vector3 {
  const x = HEX_SIZE * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r);
  const z = HEX_SIZE * (3 / 2 * r);
  return new THREE.Vector3(x, 0, z);
}

export function worldToHex(x: number, z: number): { q: number; r: number } {
  const q = (Math.sqrt(3) / 3 * x - 1 / 3 * z) / HEX_SIZE;
  const r = (2 / 3 * z) / HEX_SIZE;
  return axialRound(q, r);
}

function axialRound(q: number, r: number): { q: number; r: number } {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);

  const qDiff = Math.abs(rq - q);
  const rDiff = Math.abs(rr - r);
  const sDiff = Math.abs(rs - s);

  if (qDiff > rDiff && qDiff > sDiff) {
    rq = -rr - rs;
  } else if (rDiff > sDiff) {
    rr = -rq - rs;
  }
  return { q: rq, r: rr };
}

export function hexDistance(a: { q: number; r: number }, b: { q: number; r: number }): number {
  const dq = Math.abs(a.q - b.q);
  const dr = Math.abs(a.r - b.r);
  const ds = Math.abs(-a.q - a.r + b.q + b.r);
  return Math.max(dq, dr, ds);
}

export function hexRing(center: { q: number; r: number }, radius: number): { q: number; r: number }[] {
  const results: { q: number; r: number }[] = [];
  if (radius === 0) {
    results.push({ q: center.q, r: center.r });
    return results;
  }

  let hex = { q: center.q - radius, r: center.r + radius };
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < radius; j++) {
      results.push({ q: hex.q, r: hex.r });
      hex = hexNeighbor(hex, i);
    }
  }
  return results;
}

function hexNeighbor(hex: { q: number; r: number }, direction: number): { q: number; r: number } {
  const dir = HEX_DIRS[direction];
  return { q: hex.q + dir.q, r: hex.r + dir.r };
}

export function getNeighbors(hex: { q: number; r: number }): { q: number; r: number }[] {
  return HEX_DIRS.map((dir) => ({ q: hex.q + dir.q, r: hex.r + dir.r }));
}

export function hexToKey(q: number, r: number): string {
  return `${q},${r}`;
}

export function keyToHex(key: string): { q: number; r: number } {
  const [q, r] = key.split(',').map(Number);
  return { q, r };
}

export interface Project {
  id: string;
  priority: number;
  cellCount: number;
}

export interface AllocationResult {
  cells: Map<string, HexCell>;
  root: { q: number; r: number };
}

export function allocateCells(
  projects: Project[],
  previousCells: Map<string, HexCell> | null
): AllocationResult {
  const cells = new Map<string, HexCell>();
  const occupied = new Set<string>();

  if (previousCells) {
    previousCells.forEach((cell, key) => {
      cells.set(key, { ...cell });
      occupied.add(key);
    });
  }

  const sortedProjects = [...projects].sort((a, b) => b.priority - a.priority);

  let root: { q: number; r: number } | null = null;

  if (previousCells) {
    const firstProject = sortedProjects[0];
    const prevProjectCells = Array.from(previousCells.values()).filter(
      (c) => c.projectId === firstProject?.id
    );
    if (prevProjectCells.length > 0) {
      let sumQ = 0, sumR = 0;
      prevProjectCells.forEach((c) => { sumQ += c.q; sumR += c.r; });
      root = { q: Math.round(sumQ / prevProjectCells.length), r: Math.round(sumR / prevProjectCells.length) };
    }
  }

  if (!root) {
    root = { q: 0, r: 0 };
  }

  const rootKey = hexToKey(root.q, root.r);
  if (!occupied.has(rootKey)) {
    const firstProject = sortedProjects[0];
    if (firstProject) {
      cells.set(rootKey, { q: root.q, r: root.r, projectId: firstProject.id });
      occupied.add(rootKey);
    }
  }

  for (const project of sortedProjects) {
    const existingCells = Array.from(cells.values()).filter((c) => c.projectId === project.id);
    const existingCount = existingCells.length;
    const needed = project.cellCount - existingCount;

    if (needed > 0) {
      const frontier: { q: number; r: number }[] = [{ q: root.q, r: root.r }];
      const visited = new Set<string>([rootKey]);

      let added = 0;
      while (added < needed && frontier.length > 0) {
        const current = frontier.shift()!;
        const neighbors = getNeighbors(current);

        for (const neighbor of neighbors) {
          const key = hexToKey(neighbor.q, neighbor.r);
          if (occupied.has(key) || visited.has(key)) continue;

          cells.set(key, { q: neighbor.q, r: neighbor.r, projectId: project.id });
          occupied.add(key);
          visited.add(key);
          frontier.push(neighbor);
          added++;

          if (added >= needed) break;
        }
      }
    } else if (needed < 0) {
      const cellsToRemove = -needed;
      const sortedByDistance = existingCells
        .map(cell => ({
          cell,
          dist: hexDistance(cell, root),
        }))
        .sort((a, b) => b.dist - a.dist);

      for (let i = 0; i < cellsToRemove && i < sortedByDistance.length; i++) {
        const key = hexToKey(sortedByDistance[i].cell.q, sortedByDistance[i].cell.r);
        cells.delete(key);
        occupied.delete(key);
      }
    }
  }

  return { cells, root };
}

export function growBlob(cells: Map<string, HexCell>, root: { q: number; r: number }, count: number): void {
  const occupied = new Set<string>(cells.keys());
  const frontier: { q: number; r: number }[] = [{ q: root.q, r: root.r }];
  const visited = new Set<string>([hexToKey(root.q, root.r)]);

  let added = 0;
  while (added < count && frontier.length > 0) {
    const current = frontier.shift()!;
    const neighbors = getNeighbors(current);

    for (const neighbor of neighbors) {
      const key = hexToKey(neighbor.q, neighbor.r);
      if (occupied.has(key) || visited.has(key)) continue;

      cells.set(key, { q: neighbor.q, r: neighbor.r });
      occupied.add(key);
      visited.add(key);
      frontier.push(neighbor);
      added++;

      if (added >= count) break;
    }
  }
}