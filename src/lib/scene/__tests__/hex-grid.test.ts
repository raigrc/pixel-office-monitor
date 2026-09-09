import { describe, it, expect } from 'vitest';
import { hexToWorld, worldToHex, hexDistance, hexRing, hexToKey, keyToHex, allocateCells, getNeighbors, HEX_SIZE, HEX_DIRS } from '../hex-grid';

describe('Hex Grid', () => {
  describe('Coordinate conversion', () => {
    it('should convert hex to world correctly', () => {
      const world = hexToWorld(0, 0);
      expect(world.x).toBeCloseTo(0);
      expect(world.z).toBeCloseTo(0);
    });

    it('should convert world to hex correctly', () => {
      const world = hexToWorld(1, 0);
      const hex = worldToHex(world.x, world.z);
      expect(hex.q).toBe(1);
      expect(hex.r).toBe(0);
    });

    it('should round-trip correctly', () => {
      const original = { q: 5, r: -3 };
      const world = hexToWorld(original.q, original.r);
      const hex = worldToHex(world.x, world.z);
      expect(hex.q).toBe(original.q);
      expect(hex.r).toBe(original.r);
    });
  });

  describe('Hex distance', () => {
    it('should calculate distance correctly', () => {
      expect(hexDistance({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(0);
      expect(hexDistance({ q: 0, r: 0 }, { q: 1, r: 0 })).toBe(1);
      expect(hexDistance({ q: 0, r: 0 }, { q: 1, r: -1 })).toBe(1);
      expect(hexDistance({ q: 0, r: 0 }, { q: 2, r: -1 })).toBe(2);
    });
  });

  describe('Hex ring', () => {
    it('should return center for radius 0', () => {
      const ring = hexRing({ q: 0, r: 0 }, 0);
      expect(ring.length).toBe(1);
      expect(ring[0]).toEqual({ q: 0, r: 0 });
    });

    it('should return 6 cells for radius 1', () => {
      const ring = hexRing({ q: 0, r: 0 }, 1);
      expect(ring.length).toBe(6);
    });

    it('should return 12 cells for radius 2', () => {
      const ring = hexRing({ q: 0, r: 0 }, 2);
      expect(ring.length).toBe(12);
    });
  });

  describe('Neighbors', () => {
    it('should return 6 neighbors', () => {
      const neighbors = getNeighbors({ q: 0, r: 0 });
      expect(neighbors.length).toBe(6);
    });

    it('should match HEX_DIRS', () => {
      const neighbors = getNeighbors({ q: 0, r: 0 });
      expect(neighbors).toEqual(HEX_DIRS.map(d => ({ q: d.q, r: d.r })));
    });
  });

  describe('Key conversion', () => {
    it('should convert to key and back', () => {
      const key = hexToKey(5, -3);
      const hex = keyToHex(key);
      expect(hex.q).toBe(5);
      expect(hex.r).toBe(-3);
    });
  });

  describe('Allocation stability', () => {
    it('should allocate cells for projects', () => {
      const projects = [
        { id: 'A', priority: 10, cellCount: 3 },
        { id: 'B', priority: 5, cellCount: 2 },
      ];
      const result = allocateCells(projects, null);
      expect(result.cells.size).toBe(5);
    });

    it('should preserve previous layout for unchanged zones', () => {
      const projects = [
        { id: 'A', priority: 10, cellCount: 3 },
      ];
      const prev = new Map<string, { q: number; r: number; projectId?: string }>();
      prev.set('0,0', { q: 0, r: 0, projectId: 'A' });
      prev.set('1,0', { q: 1, r: 0, projectId: 'A' });
      prev.set('0,1', { q: 0, r: 1, projectId: 'A' });

      const result = allocateCells(projects, prev);
      expect(result.cells.get('0,0')?.projectId).toBe('A');
      expect(result.cells.get('1,0')?.projectId).toBe('A');
      expect(result.cells.get('0,1')?.projectId).toBe('A');
    });

    it('should grow outward from root', () => {
      const projects = [
        { id: 'A', priority: 10, cellCount: 7 },
      ];
      const prev = new Map<string, { q: number; r: number; projectId?: string }>();
      prev.set('0,0', { q: 0, r: 0, projectId: 'A' });

      const result = allocateCells(projects, prev);
      const cellsA = Array.from(result.cells.values()).filter(c => c.projectId === 'A');
      expect(cellsA.length).toBe(7);
    });

    it('should shrink from newest cells', () => {
      const projects = [
        { id: 'A', priority: 10, cellCount: 3 },
      ];
      const prev = new Map<string, { q: number; r: number; projectId?: string }>();
      prev.set('0,0', { q: 0, r: 0, projectId: 'A' });
      prev.set('1,0', { q: 1, r: 0, projectId: 'A' });
      prev.set('0,1', { q: 0, r: 1, projectId: 'A' });

      const shrunkProjects = [
        { id: 'A', priority: 10, cellCount: 2 },
      ];
      const result = allocateCells(shrunkProjects, prev);
      const cellsA = Array.from(result.cells.values()).filter(c => c.projectId === 'A');
      expect(cellsA.length).toBe(2);
      expect(result.cells.has('0,0')).toBe(true);
    });

    it('should give new projects innermost free cells', () => {
      const projects = [
        { id: 'A', priority: 10, cellCount: 3 },
        { id: 'B', priority: 5, cellCount: 2 },
      ];
      const result = allocateCells(projects, null);
      const cellsA = Array.from(result.cells.values()).filter(c => c.projectId === 'A');
      const cellsB = Array.from(result.cells.values()).filter(c => c.projectId === 'B');
      expect(cellsA.length).toBe(3);
      expect(cellsB.length).toBe(2);
    });
  });
});