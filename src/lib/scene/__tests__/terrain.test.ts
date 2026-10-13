import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { heightAt, createTerrainGeometry, createTerrainMaterial, TERRAIN_HALF_RANGE, type PlanetPreset } from '../terrain';
import { COZY_THEME } from '../../cozy-theme';

const PRESETS: PlanetPreset[] = ['luna', 'mars', 'terra'];

describe('heightAt', () => {
  it('is deterministic for the same point', () => {
    for (const preset of PRESETS) {
      expect(heightAt(3.7, -12.2, preset)).toBe(heightAt(3.7, -12.2, preset));
    }
  });

  it('stays inside the relief range', () => {
    for (const preset of PRESETS) {
      for (let i = 0; i < 200; i++) {
        const h = heightAt(i * 1.3 - 50, i * 0.7 - 30, preset);
        expect(h).toBeGreaterThanOrEqual(-TERRAIN_HALF_RANGE);
        expect(h).toBeLessThanOrEqual(TERRAIN_HALF_RANGE);
      }
    }
  });

  it('varies across space and presets', () => {
    const a = heightAt(0, 0, 'terra');
    const b = heightAt(40, -25, 'terra');
    expect(a).not.toBe(b);
    expect(heightAt(5, 5, 'luna')).not.toBe(heightAt(5, 5, 'mars'));
  });
});

describe('createTerrainGeometry', () => {
  it('matches heightAt at every vertex', () => {
    const geo = createTerrainGeometry({ preset: 'terra', halfExtent: 8, resolution: 8 });
    const pos = geo.attributes.position;
    expect(pos.count).toBe(81);
    for (let i = 0; i < pos.count; i++) {
      const expected = heightAt(pos.getX(i), pos.getZ(i), 'terra');
      expect(pos.getY(i)).toBeCloseTo(expected, 5);
    }
  });

  it('uses only canonical sage and moss bands for Terra', () => {
    const geometry = createTerrainGeometry({ preset: 'terra', halfExtent: 8, resolution: 8 });
    const colors = geometry.getAttribute('color');
    const canonical = new Set(COZY_THEME.scene.terrainBands.map((color) => new THREE.Color(color).getHexString()));
    for (let index = 0; index < colors.count; index++) {
      const value = new THREE.Color(colors.getX(index), colors.getY(index), colors.getZ(index));
      expect(canonical.has(value.getHexString())).toBe(true);
    }
    const material = createTerrainMaterial();
    expect(material.vertexColors).toBe(true);
    expect(material.roughness).toBe(COZY_THEME.materials.matte.roughness);
    geometry.dispose();
    material.dispose();
  });
});
