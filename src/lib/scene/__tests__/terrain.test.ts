import { describe, it, expect } from 'vitest';
import { heightAt, createTerrainGeometry, TERRAIN_HALF_RANGE, type PlanetPreset } from '../terrain';

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
});
