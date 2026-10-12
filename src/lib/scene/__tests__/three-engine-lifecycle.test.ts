import { describe, expect, it } from 'vitest';
import { frameRateForSampleWindow, motionVisualFor } from '../three-engine';

describe('ThreeEngine motion visuals', () => {
  it('waits for a complete sample window before reporting frame rate', () => {
    const halfWindow = Array.from({ length: 31 }, (_, index) => index * (500 / 30));
    const fullWindow = Array.from({ length: 61 }, (_, index) => index * (1000 / 60));

    expect(frameRateForSampleWindow(halfWindow, 0, 500)).toBeNull();
    expect(frameRateForSampleWindow(fullWindow, 0, 1000)).toBe(60);
  });

  it('keeps a standby actor onsite instead of showing walking motion', () => {
    expect(motionVisualFor('standby', 'working')).toEqual({
      clip: 'work',
      badge: 'working',
      working: true,
    });
  });

  it('reserves walking clips for entering and leaving actors', () => {
    expect(motionVisualFor('entering', 'working')).toEqual({
      clip: 'walk',
      badge: 'spawn',
      working: false,
    });
    expect(motionVisualFor('leaving', 'working')).toEqual({
      clip: 'walk',
      badge: 'leave',
      working: false,
    });
  });
});
