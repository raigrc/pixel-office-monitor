import { describe, it, expect, beforeEach } from 'vitest';
import { Colony, COLONY_MIN_ANCHOR_DISTANCE, type ColonyStore } from '../colony';
import { hexDistance } from '../hex-grid';

function memStore(): ColonyStore & { dump(): string | null } {
  let saved: string | null = null;
  return {
    getItem: () => saved,
    setItem: (_k: string, v: string) => { saved = v; },
    dump: () => saved,
  };
}

describe('Colony', () => {
  let colony: Colony;
  let store: ReturnType<typeof memStore>;

  beforeEach(() => {
    colony = new Colony();
    store = memStore();
  });

  it('adopts the first floor next to the origin', () => {
    const { added } = colony.reconcile(['f1'], 1000, store);
    expect(added).toEqual(['f1']);
    const pos = colony.positionOf('f1')!;
    expect(pos).toBeDefined();
    // Root cell (0,0) maps to world origin.
    expect(pos.length()).toBeCloseTo(0, 5);
  });

  it('grows later floors onto distinct adjacent ground', () => {
    colony.reconcile(['f1'], 1000, store);
    const { added } = colony.reconcile(['f1', 'f2'], 2000, store);
    expect(added).toEqual(['f2']);
    const p1 = colony.positionOf('f1')!;
    const p2 = colony.positionOf('f2')!;
    expect(p1.distanceTo(p2)).toBeGreaterThan(0);
    // First floor never moves when a neighbor arrives.
    expect(p1.length()).toBeCloseTo(0, 5);
  });

  it('fallows closed floors instead of removing them', () => {
    colony.reconcile(['f1', 'f2'], 1000, store);
    const { fallowed } = colony.reconcile(['f2'], 2000, store);
    expect(fallowed).toEqual(['f1']);
    expect(colony.activeIds()).toEqual(['f2']);
    // Fallow ground persists with a position.
    expect(colony.positionOf('f1')).not.toBeNull();
    expect(colony.plotsList().length).toBe(2);
  });

  it('reactivates a returning floor on its old ground', () => {
    colony.reconcile(['f1'], 1000, store);
    const before = colony.positionOf('f1')!;
    colony.reconcile([], 2000, store);
    expect(colony.activeIds()).toEqual([]);
    colony.reconcile(['f1'], 3000, store);
    expect(colony.activeIds()).toEqual(['f1']);
    const after = colony.positionOf('f1')!;
    expect(after.distanceTo(before)).toBeCloseTo(0, 5);
  });

  it('persists layout across reloads', () => {
    colony.reconcile(['f1', 'f2'], 1000, store);
    colony.reconcile(['f2'], 2000, store);
    const clone = new Colony();
    clone.load(store);
    expect(clone.activeIds()).toEqual(['f2']);
    expect(clone.positionOf('f1')).not.toBeNull();
    const p1 = colony.positionOf('f1')!;
    const p2 = clone.positionOf('f1')!;
    expect(p1.distanceTo(p2)).toBeCloseTo(0, 5);
  });

  it('ignores corrupt saves and lays out fresh', () => {
    const bad: ColonyStore = { getItem: () => '{nope', setItem: () => undefined };
    const clone = new Colony();
    clone.load(bad);
    expect(clone.plotsList()).toEqual([]);
  });
});

function keyStore(): ColonyStore & {
  writes: () => number;
  has: (key: string) => boolean;
  seed: (key: string, value: string) => void;
} {
  const data = new Map<string, string>();
  let writeCount = 0;
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
      writeCount++;
    },
    writes: () => writeCount,
    has: (key: string) => data.has(key),
    seed: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

function anchorsOf(colony: Colony): Map<string, { q: number; r: number }> {
  const out = new Map<string, { q: number; r: number }>();
  for (const plot of colony.plotsList()) {
    out.set(plot.floorId, { q: plot.cells[0].q, r: plot.cells[0].r });
  }
  return out;
}

function expectSeparated(colony: Colony): void {
  const anchors = [...anchorsOf(colony).values()];
  for (let i = 0; i < anchors.length; i++) {
    for (let j = i + 1; j < anchors.length; j++) {
      expect(hexDistance(anchors[i], anchors[j])).toBeGreaterThanOrEqual(
        COLONY_MIN_ANCHOR_DISTANCE,
      );
    }
  }
  const positions = colony.plotsList().map((p) => colony.positionOf(p.floorId)!);
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      // Deck diameter is 7.2; anchors 3 hexes apart sit ~7.794 units apart.
      expect(positions[i].distanceTo(positions[j])).toBeGreaterThan(7.2);
    }
  }
}

describe('Colony exclusion spacing (1.1B)', () => {
  it('separates two sessions by the exclusion distance', () => {
    const colony = new Colony();
    const store = keyStore();
    colony.reconcile(['f1', 'f2'], 1000, store);
    expect(colony.positionOf('f1')!.length()).toBeCloseTo(0, 5);
    expectSeparated(colony);
  });

  it('separates many sessions deterministically', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `floor-${i}`);
    const first = new Colony();
    first.reconcile(ids, 1000, keyStore());
    expectSeparated(first);

    const second = new Colony();
    second.reconcile(ids, 1000, keyStore());
    for (const id of ids) {
      expect(second.positionOf(id)!.distanceTo(first.positionOf(id)!)).toBeCloseTo(0, 5);
    }
  });

  it('keeps fallow ground inside the exclusion footprint', () => {
    const colony = new Colony();
    const store = keyStore();
    colony.reconcile(['f1', 'f2'], 1000, store);
    const fallowAnchor = anchorsOf(colony).get('f1')!;
    colony.reconcile(['f2'], 2000, store);
    colony.reconcile(['f2', 'f3'], 3000, store);
    const anchors = anchorsOf(colony);
    expect(hexDistance(anchors.get('f3')!, fallowAnchor)).toBeGreaterThanOrEqual(
      COLONY_MIN_ANCHOR_DISTANCE,
    );
    expectSeparated(colony);
  });

  it('migrates adjacent v1 anchors to spaced v2 anchors and preserves metadata', () => {
    const store = keyStore();
    store.seed(
      'pixel:colony:v1',
      JSON.stringify({
        version: 1,
        plots: [
          { floorId: 'f1', cells: [{ q: 0, r: 0, projectId: 'f1' }], adoptedAt: 1000, status: 'active' },
          { floorId: 'f2', cells: [{ q: 1, r: 0, projectId: 'f2' }], adoptedAt: 2000, status: 'fallow' },
        ],
      }),
    );
    const colony = new Colony();
    colony.load(store);
    colony.reconcile(['f1', 'f2'], 3000, store);
    const plots = new Map(colony.plotsList().map((p) => [p.floorId, p]));
    expect(plots.get('f1')!.adoptedAt).toBe(1000);
    expect(plots.get('f2')!.adoptedAt).toBe(2000);
    expect(plots.get('f1')!.status).toBe('active');
    expect(plots.get('f2')!.status).toBe('active');
    expectSeparated(colony);
    expect(store.has('pixel:colony:v2')).toBe(true);

    const clone = new Colony();
    clone.load(store);
    clone.reconcile(['f1', 'f2'], 4000, store);
    for (const id of ['f1', 'f2']) {
      expect(clone.positionOf(id)!.distanceTo(colony.positionOf(id)!)).toBeCloseTo(0, 5);
    }
  });

  it('writes an already-valid v1 layout to v2 on first reconcile', () => {
    const store = keyStore();
    store.seed(
      'pixel:colony:v1',
      JSON.stringify({
        version: 1,
        plots: [
          { floorId: 'f1', cells: [{ q: 0, r: 0, projectId: 'f1' }], adoptedAt: 1000, status: 'active' },
        ],
      }),
    );
    const colony = new Colony();
    colony.load(store);

    colony.reconcile(['f1'], 2000, store);

    expect(store.writes()).toBe(1);
    expect(store.has('pixel:colony:v2')).toBe(true);
    expect(colony.positionOf('f1')!.length()).toBeCloseTo(0, 5);
  });

  it('keeps returning floors on their migrated ground', () => {
    const colony = new Colony();
    const store = keyStore();
    colony.reconcile(['f1', 'f2'], 1000, store);
    const before = colony.positionOf('f1')!;
    colony.reconcile(['f2'], 2000, store);
    colony.reconcile(['f1', 'f2'], 3000, store);
    expect(colony.positionOf('f1')!.distanceTo(before)).toBeCloseTo(0, 5);
    expectSeparated(colony);
  });
});

describe('Colony write gating (1.1E)', () => {
  it('writes once for new state and never for identical snapshots', () => {
    const colony = new Colony();
    const store = keyStore();
    colony.reconcile(['f1'], 1000, store);
    expect(store.writes()).toBe(1);
    colony.reconcile(['f1'], 1000, store);
    colony.reconcile(['f1'], 2000, store);
    expect(store.writes()).toBe(1);
  });

  it('writes once per add, fallow, and reactivation', () => {
    const colony = new Colony();
    const store = keyStore();
    colony.reconcile(['f1'], 1000, store);
    colony.reconcile(['f1', 'f2'], 2000, store);
    expect(store.writes()).toBe(2);
    colony.reconcile(['f2'], 3000, store);
    expect(store.writes()).toBe(3);
    colony.reconcile(['f1', 'f2'], 4000, store);
    expect(store.writes()).toBe(4);
    colony.reconcile(['f1', 'f2'], 4000, store);
    expect(store.writes()).toBe(4);
  });
});
