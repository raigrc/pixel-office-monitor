import { describe, it, expect } from 'vitest';
import { deriveTimeOfDayFromEpoch } from '../three-sky';

describe('deriveTimeOfDayFromEpoch', () => {
  it('converts a noon epoch to 12.5 for 12:30 local', () => {
    const d = new Date(2026, 5, 15, 12, 30, 0, 0);
    expect(deriveTimeOfDayFromEpoch(d.getTime())).toBeCloseTo(12.5, 5);
  });

  it('converts midnight epoch to 0', () => {
    const d = new Date(2026, 5, 15, 0, 0, 0, 0);
    expect(deriveTimeOfDayFromEpoch(d.getTime())).toBeCloseTo(0, 5);
  });

  it('stays within a 24h range for live input', () => {
    // Callers must pass Date.now() scale. performance.now() scale lands
    // in 1970 and renders as night, which the engine avoids by passing
    // Date.now() (see three-engine render).
    const tod = deriveTimeOfDayFromEpoch(Date.now());
    expect(tod).toBeGreaterThanOrEqual(0);
    expect(tod).toBeLessThan(24);
  });
});
