import type { Point } from "./office-layout";

export const MIN_PHYSICAL_HIT_TARGET_SIZE = 44;
const DEFAULT_ACTOR_HIT_TARGET_SIZE = 48;
const ACTOR_HIT_TARGET_CENTER_Y_OFFSET = 16;

export interface SceneHitTarget {
  readonly left: number;
  readonly top: number;
  readonly size: number;
}

export function getActorHitTarget(
  position: Point,
  sceneScale: number,
  viewZoom: number,
): SceneHitTarget {
  const size = Math.max(
    DEFAULT_ACTOR_HIT_TARGET_SIZE * sceneScale,
    MIN_PHYSICAL_HIT_TARGET_SIZE / viewZoom,
  );
  const centerY = position.y - ACTOR_HIT_TARGET_CENTER_Y_OFFSET * sceneScale;

  return {
    left: position.x - size / 2,
    top: centerY - size / 2,
    size,
  };
}
