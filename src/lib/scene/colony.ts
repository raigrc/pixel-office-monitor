import * as THREE from 'three';
import { allocateCells, hexToWorld, hexToKey, type HexCell } from './hex-grid';

export type PlotStatus = 'active' | 'fallow';

export interface ColonyPlot {
  floorId: string;
  cells: HexCell[];
  adoptedAt: number;
  status: PlotStatus;
}

export interface ColonyStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const STORAGE_KEY = 'pixel:colony:v1';
const STORAGE_VERSION = 1;

function defaultStore(): ColonyStore | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch {
    // Non-browser runtimes have no persistent store. Colony stays in memory.
  }
  return null;
}

/**
 * Colony owns 3D ground. First floor adopts cells next to the origin.
 * Later floors grow outward from the root. Closed floors turn fallow:
 * dimmed, kept forever, never removed. Layout persists across reloads.
 */
export class Colony {
  private plots = new Map<string, ColonyPlot>();

  load(store: ColonyStore | null = defaultStore()): void {
    if (!store) return;
    try {
      const raw = store.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as { version: number; plots: ColonyPlot[] };
      if (data.version !== STORAGE_VERSION || !Array.isArray(data.plots)) return;
      this.plots.clear();
      for (const plot of data.plots) {
        if (plot.floorId && Array.isArray(plot.cells)) {
          this.plots.set(plot.floorId, { ...plot, status: plot.status === 'fallow' ? 'fallow' : 'active' });
        }
      }
    } catch {
      // Corrupt save lays the colony out fresh.
      this.plots.clear();
    }
  }

  save(store: ColonyStore | null = defaultStore()): void {
    if (!store) return;
    try {
      store.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, plots: [...this.plots.values()] }));
    } catch {
      // Quota or privacy mode. Colony keeps running in memory.
    }
  }

  reconcile(floorIds: string[], now: number = Date.now(), store?: ColonyStore | null): { added: string[]; fallowed: string[] } {
    const previous = new Map<string, HexCell>();
    for (const plot of this.plots.values()) {
      for (const cell of plot.cells) previous.set(hexToKey(cell.q, cell.r), cell);
    }
    const { cells } = allocateCells(
      floorIds.map((id, i) => ({ id, priority: floorIds.length - i, cellCount: 1 })),
      previous.size > 0 ? previous : null
    );
    const grouped = new Map<string, HexCell[]>();
    for (const cell of cells.values()) {
      if (!cell.projectId) continue;
      const list = grouped.get(cell.projectId) ?? [];
      list.push(cell);
      grouped.set(cell.projectId, list);
    }

    const added: string[] = [];
    const fallowed: string[] = [];
    const next = new Map<string, ColonyPlot>();
    for (const id of floorIds) {
      const prev = this.plots.get(id);
      if (prev && prev.status === 'active') {
        next.set(id, { ...prev, cells: grouped.get(id) ?? prev.cells });
      } else if (prev) {
        // A returning floor reactivates on its old ground.
        next.set(id, { ...prev, cells: grouped.get(id) ?? prev.cells, status: 'active' });
      } else {
        next.set(id, { floorId: id, cells: grouped.get(id) ?? [], adoptedAt: now, status: 'active' });
        added.push(id);
      }
    }
    for (const [id, plot] of this.plots) {
      if (!next.has(id)) {
        next.set(id, { ...plot, status: 'fallow' });
        if (plot.status === 'active') fallowed.push(id);
      }
    }
    this.plots = next;
    this.save(store === undefined ? defaultStore() : store);
    return { added, fallowed };
  }

  plotsList(): ColonyPlot[] {
    return [...this.plots.values()];
  }

  activeIds(): string[] {
    return [...this.plots.values()].filter((p) => p.status === 'active').map((p) => p.floorId);
  }

  positionOf(floorId: string): THREE.Vector3 | null {
    const plot = this.plots.get(floorId);
    const first = plot?.cells[0];
    if (!first) return null;
    return hexToWorld(first.q, first.r);
  }

  positions(): Map<string, THREE.Vector3> {
    const out = new Map<string, THREE.Vector3>();
    for (const plot of this.plots.values()) {
      const pos = this.positionOf(plot.floorId);
      if (pos) out.set(plot.floorId, pos);
    }
    return out;
  }

  /** Every claimed cell, for scatter occupancy and footprint diffing. */
  occupiedKeys(): Set<string> {
    const keys = new Set<string>();
    for (const plot of this.plots.values()) {
      for (const cell of plot.cells) keys.add(hexToKey(cell.q, cell.r));
    }
    return keys;
  }

  clear(): void {
    this.plots.clear();
  }
}

export function createColony(): Colony {
  return new Colony();
}
