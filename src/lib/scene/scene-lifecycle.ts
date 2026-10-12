export interface SceneViewState {
  mode: '2d' | '3d';
  hasMounted3D: boolean;
}

export type WorldSyncDecision =
  | { kind: 'wait' }
  | { kind: 'sync'; animateEntrances: boolean };

export function toggleSceneView(state: SceneViewState): SceneViewState {
  if (state.mode === '2d') return { mode: '3d', hasMounted3D: true };
  return { mode: '2d', hasMounted3D: state.hasMounted3D };
}

export function decideWorldSync(
  streamHydrated: boolean,
  hasSyncedHydratedWorld: boolean,
  sceneActive: boolean,
): WorldSyncDecision {
  if (!streamHydrated) return { kind: 'wait' };
  return {
    kind: 'sync',
    animateEntrances: hasSyncedHydratedWorld && sceneActive,
  };
}
