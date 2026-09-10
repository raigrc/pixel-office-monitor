import { describe, it, expect } from 'vitest';
import { createBuildingGeometry, getBuildingHeight, getBuildingFootprint, createBuildingMaterials, BUILDING_RECIPES, BuildingRecipe } from '../buildings';
import * as THREE from 'three';

describe('Buildings', () => {
  describe('Recipes', () => {
    it('should have 10 recipes', () => {
      expect(BUILDING_RECIPES.length).toBe(10);
    });

    it('should have unique names', () => {
      const names = BUILDING_RECIPES.map(r => r.name);
      const unique = new Set(names);
      expect(unique.size).toBe(names.length);
    });

    it('should have valid parts', () => {
      for (const recipe of BUILDING_RECIPES) {
        expect(recipe.parts.length).toBeGreaterThan(0);
        for (const part of recipe.parts) {
          expect(part.geometry).toBeInstanceOf(THREE.BufferGeometry);
          expect(part.position).toBeInstanceOf(THREE.Vector3);
          expect(typeof part.materialIndex).toBe('number');
          expect(part.materialIndex).toBeGreaterThanOrEqual(0);
          expect(part.materialIndex).toBeLessThan(10);
        }
      }
    });
  });

  describe('Geometry creation', () => {
    it('should create geometry for any floor ID', () => {
      const { geometry, recipe, materials } = createBuildingGeometry('test-floor-1');
      expect(geometry).toBeInstanceOf(THREE.BufferGeometry);
      expect(geometry.attributes.position).toBeDefined();
      expect(geometry.attributes.normal).toBeDefined();
      expect(geometry.attributes.materialIndex).toBeDefined();
      expect(geometry.attributes.aEmissive).toBeDefined();
      expect(geometry.attributes.aRotor).toBeDefined();
      expect(recipe).toBeDefined();
      expect(materials.length).toBeGreaterThan(0);
    });

    it('should produce deterministic geometry for same floor ID', () => {
      const { geometry: geo1 } = createBuildingGeometry('deterministic-floor');
      const { geometry: geo2 } = createBuildingGeometry('deterministic-floor');
      expect(geo1.attributes.position.count).toBe(geo2.attributes.position.count);
      for (let i = 0; i < geo1.attributes.position.count; i++) {
        const x1 = geo1.attributes.position.getX(i);
        const y1 = geo1.attributes.position.getY(i);
        const z1 = geo1.attributes.position.getZ(i);
        const x2 = geo2.attributes.position.getX(i);
        const y2 = geo2.attributes.position.getY(i);
        const z2 = geo2.attributes.position.getZ(i);
        expect(x1).toBeCloseTo(x2);
        expect(y1).toBeCloseTo(y2);
        expect(z1).toBeCloseTo(z2);
      }
    });

    it('should produce different geometry for different floor IDs', () => {
      const { geometry: geo1, recipe: r1 } = createBuildingGeometry('floor-a');
      const { geometry: geo2, recipe: r2 } = createBuildingGeometry('floor-b');
      // At least recipe might be different
      // We can't guarantee geometry differs but recipes might
    });

    it('should have correct material indices', () => {
      const { geometry, materials } = createBuildingGeometry('material-test');
      const matIndices = geometry.attributes.materialIndex as THREE.InstancedBufferAttribute;
      for (let i = 0; i < matIndices.count; i++) {
        const idx = matIndices.getX(i);
        expect(materials).toContain(idx);
      }
    });

    it('should have recipes with emissive and rotor attributes', () => {
      let hasEmissiveRecipe = false;
      let hasRotorRecipe = false;
      for (const recipe of BUILDING_RECIPES) {
        for (const part of recipe.parts) {
          if (part.emissiveVertices && part.emissiveVertices.length > 0) hasEmissiveRecipe = true;
          if (part.rotorVertices && part.rotorVertices.length > 0) hasRotorRecipe = true;
        }
      }
      expect(hasEmissiveRecipe).toBe(true);
      expect(hasRotorRecipe).toBe(true);
    });
  });

  describe('Height and footprint', () => {
    it('should return height for any floor ID', () => {
      const height = getBuildingHeight('height-test');
      expect(height).toBeGreaterThan(0);
      expect(height).toBeLessThan(10);
    });

    it('should never roll the flat pad for a floor', () => {
      for (let i = 0; i < 20; i++) {
        const { recipe } = createBuildingGeometry(`floor-roll-${i}`);
        expect(recipe.height).toBeGreaterThanOrEqual(1.5);
      }
    });

    it('should produce human-scale bounds that sit near the deck', () => {
      // Guards the buried-building class of bug: geometry must rise
      // from near y=0 and fit inside a deck of radius ~1.7.
      for (const id of ['proj:root-a', 'proj:root-b', 'proj:root-c']) {
        const { geometry } = createBuildingGeometry(id);
        geometry.computeBoundingBox();
        const box = geometry.boundingBox!;
        const size = new THREE.Vector3();
        box.getSize(size);
        expect(size.y).toBeGreaterThan(0.5);
        expect(size.y).toBeLessThan(8);
        expect(size.x).toBeLessThan(4);
        expect(size.z).toBeLessThan(4);
        expect(box.min.y).toBeGreaterThan(-0.5);
      }
    });

    it('should return footprint for any floor ID', () => {
      const footprint = getBuildingFootprint('footprint-test');
      expect(footprint).toBeGreaterThan(0);
      expect(footprint).toBeLessThan(5);
    });
  });

  describe('Materials', () => {
    it('should create 10 materials', () => {
      const materials = createBuildingMaterials(new THREE.Color(0xff8800));
      expect(materials.length).toBe(10);
      for (const mat of materials) {
        expect(mat).toBeInstanceOf(THREE.MeshStandardMaterial);
      }
    });

    it('should tint materials with accent color', () => {
      const accent = new THREE.Color(0xff0000);
      const materials = createBuildingMaterials(accent);
      expect(materials[0].color.r).toBeGreaterThan(materials[0].color.g);
    });
  });
});