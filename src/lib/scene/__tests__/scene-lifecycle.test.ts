import { describe, expect, it } from 'vitest';
import { decideWorldSync, toggleSceneView, type SceneViewState } from '../scene-lifecycle';

describe('3D scene lifecycle', () => {
  it('keeps 3D mounted after repeated view toggles', () => {
    let state: SceneViewState = { mode: '2d', hasMounted3D: false };

    for (let index = 0; index < 10; index++) state = toggleSceneView(state);

    expect(state).toEqual({ mode: '2d', hasMounted3D: true });
  });

  it('waits for stream hydration and places initial actors onsite', () => {
    expect(decideWorldSync(false, false, true)).toEqual({ kind: 'wait' });
    expect(decideWorldSync(true, false, true)).toEqual({
      kind: 'sync',
      animateEntrances: false,
    });
  });

  it('animates only visible arrivals after initial hydration', () => {
    expect(decideWorldSync(true, true, true)).toEqual({
      kind: 'sync',
      animateEntrances: true,
    });
    expect(decideWorldSync(true, true, false)).toEqual({
      kind: 'sync',
      animateEntrances: false,
    });
  });

  it('treats a remounted engine as needing a new non-animated baseline', () => {
    const firstEngineGeneration = 1;
    let hydratedEngineGeneration: number | null = null;

    expect(decideWorldSync(true, hydratedEngineGeneration === firstEngineGeneration, true)).toEqual({
      kind: 'sync',
      animateEntrances: false,
    });
    hydratedEngineGeneration = firstEngineGeneration;
    expect(decideWorldSync(true, hydratedEngineGeneration === firstEngineGeneration, true)).toEqual({
      kind: 'sync',
      animateEntrances: true,
    });

    const remountedEngineGeneration = 2;
    expect(decideWorldSync(true, hydratedEngineGeneration === remountedEngineGeneration, true)).toEqual({
      kind: 'sync',
      animateEntrances: false,
    });
  });
});
