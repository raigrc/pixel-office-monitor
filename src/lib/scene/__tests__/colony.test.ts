import { describe, it, expect, beforeEach } from 'vitest';
import { Colony, type ColonyStore } from '../colony';

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
