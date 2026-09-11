import { describe, expect, it } from 'vitest';
import {
  computeLightingProfile,
  NIGHT_AMBIENT_FLOOR,
  NIGHT_FILL_INTENSITY,
  resolveTimeOfDay,
  stageForTimeOfDay,
  type SkyPreset,
} from '../three-sky';
import { deriveTimeOfDayFromDate, normalizeTimeOfDay } from '../lighting-time';

const PRESETS: SkyPreset[] = ['luna', 'mars', 'terra'];

function channels(hex: number): [number, number, number] {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

describe('lighting stages (1.5B)', () => {
  it('labels the planned day/dusk/night windows', () => {
    expect(stageForTimeOfDay(2)).toBe('night');
    expect(stageForTimeOfDay(4.99)).toBe('night');
    expect(stageForTimeOfDay(5)).toBe('dusk');
    expect(stageForTimeOfDay(6)).toBe('dusk');
    expect(stageForTimeOfDay(6.5)).toBe('dusk');
    expect(stageForTimeOfDay(7)).toBe('day');
    expect(stageForTimeOfDay(12)).toBe('day');
    expect(stageForTimeOfDay(16.99)).toBe('day');
    expect(stageForTimeOfDay(17)).toBe('dusk');
    expect(stageForTimeOfDay(18.5)).toBe('dusk');
    expect(stageForTimeOfDay(19.99)).toBe('dusk');
    expect(stageForTimeOfDay(20)).toBe('night');
    expect(stageForTimeOfDay(23)).toBe('night');
  });

  it('matches the profile stage at the six acceptance times', () => {
    expect(computeLightingProfile(2, 'terra').stage).toBe('night');
    expect(computeLightingProfile(6, 'terra').stage).toBe('dusk');
    expect(computeLightingProfile(6.5, 'terra').stage).toBe('dusk');
    expect(computeLightingProfile(12, 'terra').stage).toBe('day');
    expect(computeLightingProfile(18.5, 'terra').stage).toBe('dusk');
    expect(computeLightingProfile(23, 'terra').stage).toBe('night');
  });
});

describe('readable night floor (1.5C)', () => {
  it('kills directional sun through full night on every preset', () => {
    for (const preset of PRESETS) {
      expect(computeLightingProfile(2, preset).sunIntensity).toBe(0);
      expect(computeLightingProfile(23, preset).sunIntensity).toBe(0);
      expect(computeLightingProfile(0, preset).sunIntensity).toBe(0);
    }
  });

  it('keeps ambient at or above the readable floor on every preset', () => {
    for (const preset of PRESETS) {
      for (const t of [0, 2, 4, 5, 12, 18.5, 20, 23]) {
        expect(computeLightingProfile(t, preset).ambientIntensity).toBeGreaterThanOrEqual(
          NIGHT_AMBIENT_FLOOR,
        );
      }
    }
  });

  it('keeps full-night terrain lighting readable without directional sun', () => {
    for (const preset of PRESETS) {
      const night = computeLightingProfile(2, preset);
      expect(night.ambientIntensity).toBeGreaterThanOrEqual(0.45);
      expect(night.fillIntensity).toBeGreaterThanOrEqual(0.6);
      expect(night.ambientIntensity + night.fillIntensity).toBeGreaterThanOrEqual(1.05);
    }
  });

  it('holds full day sun at noon and a reduced dusk response', () => {
    const noon = computeLightingProfile(12, 'terra');
    expect(noon.sunIntensity).toBeGreaterThan(1);
    expect(noon.daylight).toBe(1);
    const dawn = computeLightingProfile(6.5, 'terra');
    expect(dawn.sunIntensity).toBeGreaterThan(0);
    expect(dawn.sunIntensity).toBeLessThan(noon.sunIntensity);
    // Sun is below the horizon by 18:30; dusk reads through warm glow.
    const evening = computeLightingProfile(18.5, 'terra');
    expect(evening.sunIntensity).toBe(0);
    expect(evening.duskWeight).toBeGreaterThan(0);
  });

  it('peaks the warm glow mid-transition and clears it day and night', () => {
    expect(computeLightingProfile(12, 'terra').duskWeight).toBe(0);
    expect(computeLightingProfile(2, 'terra').duskWeight).toBe(0);
    expect(computeLightingProfile(6, 'terra').duskWeight).toBeGreaterThan(0);
    expect(computeLightingProfile(18.5, 'terra').duskWeight).toBeGreaterThan(0);
  });
});

describe('smooth transitions (1.5B)', () => {
  it('carries a cool fill at night and none at full day', () => {
    for (const preset of PRESETS) {
      expect(computeLightingProfile(2, preset).fillIntensity).toBeCloseTo(
        NIGHT_FILL_INTENSITY,
        5,
      );
      expect(computeLightingProfile(12, preset).fillIntensity).toBe(0);
    }
  });

  it('moves sun, ambient, fill, and daylight continuously with no jumps', () => {
    for (const preset of PRESETS) {
      let prev = computeLightingProfile(0, preset);
      for (let m = 10; m < 24 * 60; m += 10) {
        const next = computeLightingProfile(m / 60, preset);
        expect(Math.abs(next.sunIntensity - prev.sunIntensity)).toBeLessThan(0.35);
        expect(Math.abs(next.ambientIntensity - prev.ambientIntensity)).toBeLessThan(0.1);
        expect(Math.abs(next.fillIntensity - prev.fillIntensity)).toBeLessThan(0.1);
        expect(Math.abs(next.daylight - prev.daylight)).toBeLessThan(0.15);
        expect(Math.abs(next.duskWeight - prev.duskWeight)).toBeLessThan(0.3);
        prev = next;
      }
    }
  });

  it('keeps every color channel bounded', () => {
    for (const preset of PRESETS) {
      for (let m = 0; m < 24 * 60; m += 30) {
        const p = computeLightingProfile(m / 60, preset);
        for (const hex of [p.ambientHex, p.zenithHex, p.horizonHex, p.groundHex]) {
          for (const c of channels(hex)) {
            expect(c).toBeGreaterThanOrEqual(0);
            expect(c).toBeLessThanOrEqual(255);
          }
        }
        const dir = p.sunDirection;
        const len = Math.hypot(dir.x, dir.y, dir.z);
        expect(len).toBeCloseTo(1, 5);
      }
    }
  });

  it('keeps night darker than day but never black', () => {
    for (const preset of PRESETS) {
      const night = computeLightingProfile(2, preset);
      const day = computeLightingProfile(12, preset);
      // Total light strictly separates night from day on every preset.
      expect(night.sunIntensity + night.ambientIntensity + night.fillIntensity).toBeLessThan(
        day.sunIntensity + day.ambientIntensity + day.fillIntensity,
      );
      const [r, g, b] = channels(night.horizonHex);
      expect(r + g + b).toBeGreaterThan(0);
    }
  });
});

describe('shared clock (1.5A)', () => {
  it('reads live epoch millis in liveMode and ignores manual time', () => {
    const noon = new Date(2026, 5, 15, 12, 0, 0, 0).getTime();
    expect(resolveTimeOfDay({ preset: 'terra', timeOfDay: 3, liveMode: true }, noon)).toBeCloseTo(
      12,
      5,
    );
  });

  it('keeps manual timeOfDay when liveMode is false', () => {
    const noon = new Date(2026, 5, 15, 12, 0, 0, 0).getTime();
    expect(resolveTimeOfDay({ preset: 'terra', timeOfDay: 3, liveMode: false }, noon)).toBe(3);
    expect(resolveTimeOfDay({ preset: 'terra', timeOfDay: 3, liveMode: false })).toBe(3);
  });

  it('freezes boot-clock scale instead of tracking the wall clock', () => {
    // performance.now() scale lands near 1970: the sky must not follow the
    // wall clock. It freezes at the frozen epoch time (timezone-dependent),
    // which reads as a stuck sky rather than live lighting.
    const a = resolveTimeOfDay({ preset: 'terra', timeOfDay: 12, liveMode: true }, 5000);
    const b = resolveTimeOfDay({ preset: 'terra', timeOfDay: 12, liveMode: true }, 5000);
    expect(a).toBe(b);
    expect(a).not.toBe(12);
  });

  it('shares one local-clock conversion between sky and UI phase', () => {
    const d = new Date(2026, 5, 15, 6, 30, 0, 0);
    expect(deriveTimeOfDayFromDate(d)).toBeCloseTo(6.5, 5);
    expect(normalizeTimeOfDay(25.5)).toBeCloseTo(1.5, 5);
    expect(normalizeTimeOfDay(-1)).toBeCloseTo(23, 5);
  });
});
