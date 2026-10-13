import * as THREE from 'three';
import { hexDistance, hexRing, hexToWorld, hexToKey, type HexCell } from './hex-grid';

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

const STORAGE_KEY = 'pixel:colony:v2';
const LEGACY_STORAGE_KEY = 'pixel:colony:v1';
const STORAGE_VERSION = 2;
const LEGACY_STORAGE_VERSION = 1;

/**
 * Minimum axial distance between retained plot anchors. Deck slabs have
 * radius 3.6 (diameter 7.2) while adjacent hex centers sit only 2.598
 * world units apart, so single-cell adjacency overlaps worksites.
 * Distance 3 yields ~7.794 world units between anchors.
 */
export const COLONY_MIN_ANCHOR_DISTANCE = 3;
/** Search bound for free anchors. Colony scale is tens of plots. */
const ANCHOR_SEARCH_RADIUS = 64;

function defaultStore(): ColonyStore | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch {
    // Non-browser runtimes have no persistent store. Colony stays in memory.
  }
  return null;
}

/**
 * Colony owns 3D ground. First floor adopts the origin cell. Later floors
 * take deterministic anchors at least COLONY_MIN_ANCHOR_DISTANCE away from
 * every retained anchor. Closed floors turn fallow: kept forever inside
 * the exclusion footprint so a new floor never overlaps returning ground.
 * Layout persists across reloads (schema v2; v1 saves migrate on load).
 */
export class Colony {
  private plots = new Map<string, ColonyPlot>();
  private needsMigration = false;

  load(store: ColonyStore | null = defaultStore()): void {
    if (!store) return;
    const raw = store.getItem(STORAGE_KEY) ?? store.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as { version: number; plots: ColonyPlot[] };
      if (
        (data.version !== STORAGE_VERSION && data.version !== LEGACY_STORAGE_VERSION) ||
        !Array.isArray(data.plots)
      ) {
        return;
      }
      this.needsMigration = data.version === LEGACY_STORAGE_VERSION;
      this.plots.clear();
      for (const plot of data.plots) {
        // Anchors normalize on the next reconcile(); only shape is kept here.
        if (plot.floorId && Array.isArray(plot.cells) && plot.cells.length > 0) {
          this.plots.set(plot.floorId, {
            floorId: plot.floorId,
            cells: [{ q: plot.cells[0].q, r: plot.cells[0].r, projectId: plot.floorId }],
            adoptedAt: typeof plot.adoptedAt === 'number' ? plot.adoptedAt : 0,
            status: plot.status === 'fallow' ? 'fallow' : 'active',
          });
        }
      }
    } catch {
      // Corrupt save lays the colony out fresh.
      this.plots.clear();
      this.needsMigration = false;
    }
  }

  save(store: ColonyStore | null = defaultStore()): boolean {
    if (!store) return false;
    try {
      store.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, plots: [...this.plots.values()] }));
      return true;
    } catch {
      // Quota or privacy mode. Colony keeps running in memory.
      return false;
    }
  }

  /** True when the anchor keeps full exclusion distance from assigned ones. */
  private static anchorFits(
    anchor: { q: number; r: number },
    assigned: Iterable<{ q: number; r: number }>,
  ): boolean {
    for (const other of assigned) {
      if (hexDistance(anchor, other) < COLONY_MIN_ANCHOR_DISTANCE) return false;
    }
    return true;
  }

  /**
   * Deterministic free anchor: scan rings around the origin by (radius,
   * then axial q, r) and take the first cell outside every assigned
   * exclusion zone. Input order never matters, only the assigned set.
   */
  private static findFreeAnchor(
    assigned: Map<string, { q: number; r: number }>,
    extraExcluded: Iterable<{ q: number; r: number }> = [],
  ): { q: number; r: number } {
    const taken = [...assigned.values(), ...extraExcluded];
    for (let radius = 0; radius <= ANCHOR_SEARCH_RADIUS; radius++) {
      const ring = radius === 0 ? [{ q: 0, r: 0 }] : hexRing({ q: 0, r: 0 }, radius);
      const ordered = [...ring].sort((a, b) => a.q - b.q || a.r - b.r);
      for (const cell of ordered) {
        if (Colony.anchorFits(cell, taken)) return { q: cell.q, r: cell.r };
      }
    }
    throw new Error('Colony anchor search exhausted');
  }

  private static plotsEqual(a: Map<string, ColonyPlot>, b: Map<string, ColonyPlot>): boolean {
    if (a.size !== b.size) return false;
    for (const [id, plot] of a) {
      const cur = b.get(id);
      if (!cur) return false;
      if (cur.status !== plot.status || cur.adoptedAt !== plot.adoptedAt) return false;
      if (cur.cells.length !== plot.cells.length) return false;
      for (let i = 0; i < cur.cells.length; i++) {
        const ca = cur.cells[i];
        const cb = plot.cells[i];
        if (ca.q !== cb.q || ca.r !== cb.r) return false;
      }
    }
    return true;
  }

  reconcile(floorIds: string[], now: number = Date.now(), store?: ColonyStore | null): { added: string[]; fallowed: string[] } {
    const assigned = new Map<string, { q: number; r: number }>();
    const added: string[] = [];
    const fallowed: string[] = [];
    const next = new Map<string, ColonyPlot>();
    const activeSet = new Set(floorIds);

    // Fallow anchors reserve their ground up front: a new session must
    // never overlap a returning session's plot, even before the fallow
    // records are re-emitted below. Retained active anchors win ties
    // against colliding legacy fallow anchors (actives relocate never).
    const fallowReserved: { q: number; r: number }[] = [];
    for (const plot of this.plots.values()) {
      const anchor = plot.cells[0];
      if (!activeSet.has(plot.floorId) && anchor) {
        fallowReserved.push({ q: anchor.q, r: anchor.r });
      }
    }

    // Active floors first, in caller priority order. Valid retained anchors
    // never move; colliding ones (v1 adjacency) relocate deterministically.
    for (const id of floorIds) {
      const prev = this.plots.get(id);
      const prevAnchor = prev?.cells[0];
      let anchor: { q: number; r: number };
      if (prevAnchor && Colony.anchorFits(prevAnchor, assigned.values())) {
        anchor = { q: prevAnchor.q, r: prevAnchor.r };
      } else {
        anchor = Colony.findFreeAnchor(assigned, fallowReserved);
      }
      assigned.set(id, anchor);
      if (prev && prev.status === 'active') {
        next.set(id, { ...prev, cells: [{ q: anchor.q, r: anchor.r, projectId: id }] });
      } else if (prev) {
        // A returning floor reactivates on its old (possibly migrated) ground.
        next.set(id, { ...prev, cells: [{ q: anchor.q, r: anchor.r, projectId: id }], status: 'active' });
      } else {
        next.set(id, { floorId: id, cells: [{ q: anchor.q, r: anchor.r, projectId: id }], adoptedAt: now, status: 'active' });
        added.push(id);
      }
    }
    // Fallow plots keep their ground inside the exclusion footprint.
    const fallowPrev = [...this.plots.values()]
      .filter((p) => !next.has(p.floorId))
      .sort((a, b) => a.adoptedAt - b.adoptedAt || (a.floorId < b.floorId ? -1 : 1));
    for (const plot of fallowPrev) {
      const prevAnchor = plot.cells[0];
      let anchor: { q: number; r: number };
      if (prevAnchor && Colony.anchorFits(prevAnchor, assigned.values())) {
        anchor = { q: prevAnchor.q, r: prevAnchor.r };
      } else {
        anchor = Colony.findFreeAnchor(assigned);
      }
      assigned.set(plot.floorId, anchor);
      next.set(plot.floorId, {
        ...plot,
        cells: [{ q: anchor.q, r: anchor.r, projectId: plot.floorId }],
        status: 'fallow',
      });
      if (plot.status === 'active') fallowed.push(plot.floorId);
    }
    const changed = !Colony.plotsEqual(next, this.plots);
    this.plots = next;
    // Semantic gating: unchanged snapshots never touch storage, so the
    // per-frame world sync cannot churn localStorage.
    if (changed || this.needsMigration) {
      const saved = this.save(store === undefined ? defaultStore() : store);
      if (saved) this.needsMigration = false;
    }
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
    this.needsMigration = false;
  }
}

export function createColony(): Colony {
  return new Colony();
}
