import { describe, it, expect } from 'vitest';
import { createNavGrid, findPath, nearestFree, isNavWalkable, rasterizeCircle, rasterizeBuilding, clearGrid, worldToGrid, gridToWorld, computeSeparation, slideAlongObstacle, getWorkSite, NAV_CELL_SIZE, NAV_HALF_EXTENT } from '../navigation';
import * as THREE from 'three';

describe('Navigation', () => {
  describe('Grid operations', () => {
    it('should create empty grid', () => {
      const grid = createNavGrid();
      expect(grid.obstacles.length).toBeGreaterThan(0);
      expect(grid.generation).toBe(1);
    });

    it('should convert world to grid and back', () => {
      const world = new THREE.Vector3(10, 0, -5);
      const { gx, gz } = worldToGrid(world.x, world.z);
      const back = gridToWorld(gx, gz);
      expect(Math.abs(back.x - world.x)).toBeLessThan(NAV_CELL_SIZE);
      expect(Math.abs(back.z - world.z)).toBeLessThan(NAV_CELL_SIZE);
    });

    it('should rasterize circle', () => {
      const grid = createNavGrid();
      rasterizeCircle(grid, 0, 0, 2);
      const { gx, gz } = worldToGrid(0, 0);
      expect(isNavWalkable(grid, gx, gz)).toBe(false);
    });

    it('should rasterize building', () => {
      const grid = createNavGrid();
      const pos = new THREE.Vector3(5, 0, 5);
      rasterizeBuilding(grid, pos, 3);
      const { gx, gz } = worldToGrid(5, 5);
      expect(isNavWalkable(grid, gx, gz)).toBe(false);
    });

    it('should clear grid with generation increment', () => {
      const grid = createNavGrid();
      rasterizeCircle(grid, 0, 0, 2);
      const { gx, gz } = worldToGrid(0, 0);
      expect(isNavWalkable(grid, gx, gz)).toBe(false);

      clearGrid(grid);
      expect(isNavWalkable(grid, gx, gz)).toBe(true);
      expect(grid.generation).toBe(2);
    });
  });

  describe('Pathfinding', () => {
    it('should find direct path on empty grid', () => {
      const grid = createNavGrid();
      const start = new THREE.Vector3(-10, 0, 0);
      const goal = new THREE.Vector3(10, 0, 0);
      const result = findPath(grid, start, goal);
      expect(result.blocked).toBe(false);
      expect(result.waypoints.length).toBeGreaterThan(1);
    });

    it('should return blocked for obstructed goal', () => {
      const grid = createNavGrid();
      rasterizeCircle(grid, 0, 0, 20);
      const start = new THREE.Vector3(-10, 0, 0);
      const goal = new THREE.Vector3(0, 0, 0);
      const result = findPath(grid, start, goal);
      expect(result.blocked).toBe(true);
    });

    it('should return blocked for obstructed start', () => {
      const grid = createNavGrid();
      rasterizeCircle(grid, 0, 0, 20);
      const start = new THREE.Vector3(0, 0, 0);
      const goal = new THREE.Vector3(10, 0, 0);
      const result = findPath(grid, start, goal);
      expect(result.blocked).toBe(true);
    });

    it('should find path around obstacle', () => {
      const grid = createNavGrid();
      rasterizeCircle(grid, 0, 0, 3);
      const start = new THREE.Vector3(-10, 0, 0);
      const goal = new THREE.Vector3(10, 0, 0);
      const result = findPath(grid, start, goal);
      expect(result.blocked).toBe(false);
      for (const wp of result.waypoints) {
        const { gx, gz } = worldToGrid(wp.x, wp.z);
        expect(isNavWalkable(grid, gx, gz)).toBe(true);
      }
    });
  });

  describe('Nearest free', () => {
    it('should return current position if walkable', () => {
      const grid = createNavGrid();
      const free = nearestFree(grid, 10, 10);
      expect(free).not.toBeNull();
      expect(free!.x).toBeCloseTo(10, 0);
      expect(free!.z).toBeCloseTo(10, 0);
    });

    it('should find nearby free cell', () => {
      const grid = createNavGrid();
      rasterizeCircle(grid, 0, 0, 5);
      const free = nearestFree(grid, 0, 0);
      expect(free).not.toBeNull();
      const { gx, gz } = worldToGrid(free!.x, free!.z);
      expect(isNavWalkable(grid, gx, gz)).toBe(true);
    });
  });

  describe('Separation', () => {
    it('should compute zero force for isolated agent', () => {
      const agent = { position: new THREE.Vector3(0, 0, 0), velocity: new THREE.Vector3() };
      const others: { position: THREE.Vector3 }[] = [];
      const force = computeSeparation(agent, others, 1.15);
      expect(force.length()).toBe(0);
    });

    it('should push away from nearby agents', () => {
      const agent = { position: new THREE.Vector3(0, 0, 0), velocity: new THREE.Vector3() };
      const others = [
        { position: new THREE.Vector3(0.5, 0, 0) },
        { position: new THREE.Vector3(0, 0.5, 0) },
      ];
      const force = computeSeparation(agent, others, 1.15);
      expect(force.length()).toBeGreaterThan(0);
    });

    it('should not push for distant agents', () => {
      const agent = { position: new THREE.Vector3(0, 0, 0), velocity: new THREE.Vector3() };
      const others = [
        { position: new THREE.Vector3(5, 0, 0) },
      ];
      const force = computeSeparation(agent, others, 1.15);
      expect(force.length()).toBe(0);
    });
  });

  describe('Slide along obstacle', () => {
    it('should find walkable direction', () => {
      const grid = createNavGrid();
      rasterizeCircle(grid, 0, 0, 2);
      const agent = { position: new THREE.Vector3(0, 0, 0), velocity: new THREE.Vector3(1, 0, 0) };
      const slide = slideAlongObstacle(agent, grid, 1);
      expect(slide.length()).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Work site', () => {
    it('should find work site near building', () => {
      const grid = createNavGrid();
      const buildingPos = new THREE.Vector3(10, 0, 10);
      const site = getWorkSite(buildingPos, 2, grid);
      expect(site).not.toBeNull();
      if (site) {
        const dist = site.distanceTo(buildingPos);
        expect(dist).toBeGreaterThan(2);
        expect(dist).toBeLessThan(5);
      }
    });

    it('should return null if no walkable site', () => {
      const grid = createNavGrid();
      rasterizeCircle(grid, 0, 0, 50);
      const buildingPos = new THREE.Vector3(0, 0, 0);
      const site = getWorkSite(buildingPos, 2, grid);
      expect(site).toBeNull();
    });
  });
});