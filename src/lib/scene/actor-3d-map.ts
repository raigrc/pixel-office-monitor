import * as THREE from 'three';
import type { ActorInfo, FloorInfo, InvocationInfo } from '../monitor-types';
import { getActorActivityPose } from './actor-pose';
import { allocateCells, hexToWorld, DECK_TOP, type HexCell } from './hex-grid';
import type { AstronautState } from './astronauts';

export type ActivityPose3D = 'work' | 'seat' | 'success' | 'idle';

const POSE_TO_CLIP_BADGE: Record<ActivityPose3D, { clip: string; badge: string; working: boolean }> = {
  work: { clip: 'work', badge: 'working', working: true },
  seat: { clip: 'sitIdle', badge: 'waiting', working: false },
  success: { clip: 'cheer', badge: 'celebrating', working: false },
  idle: { clip: 'sitIdle', badge: 'none', working: false },
};

export function mapPoseToClipBadge(pose: ActivityPose3D): { clip: string; badge: string; working: boolean } {
  return POSE_TO_CLIP_BADGE[pose];
}

/** Deterministic suit color per agent key. Stable across snapshots. */
export function suitColorFor(agentKey: string): THREE.Color {
  let hash = 0;
  for (let i = 0; i < agentKey.length; i++) hash = (hash * 31 + agentKey.charCodeAt(i)) >>> 0;
  return new THREE.Color().setHSL((hash % 360) / 360, 0.7, 0.55);
}

/**
 * One hex cell per floor, sticky across snapshots when previous cells
 * pass through. Mirrors the engine allocation inputs so both agree.
 */
export function layoutFloorPositions(
  floors: FloorInfo[],
  previous: Map<string, HexCell> | null
): Map<string, THREE.Vector3> {
  const out = new Map<string, THREE.Vector3>();
  if (floors.length === 0) return out;
  const { cells } = allocateCells(
    floors.map((f, i) => ({ id: f.floorId, priority: floors.length - i, cellCount: 1 })),
    previous
  );
  for (const cell of cells.values()) {
    if (cell.projectId && !out.has(cell.projectId)) {
      out.set(cell.projectId, hexToWorld(cell.q, cell.r));
    }
  }
  return out;
}

/**
 * Live monitor actors become astronaut states. Same pose logic as the 2D
 * renderer. System actors stay out, matching OfficeScene seating.
 * Idle roster filler stays out too: only called agents appear.
 * No 2D mirror. The colony shows who works, waits, or just finished.
 */
export function mapActorsToAgents(
  actors: ActorInfo[],
  invocations: InvocationInfo[],
  floorPositions: Map<string, THREE.Vector3>,
  now: number = Date.now()
): AstronautState[] {
  const agents: AstronautState[] = [];
  for (const actor of actors) {
    if (actor.role === 'system') continue;
    const home = floorPositions.get(actor.floorId);
    if (!home) continue;
    const pose = getActorActivityPose(actor, invocations, now) as ActivityPose3D;
    if (pose === 'idle') continue;
    const { clip, badge, working } = mapPoseToClipBadge(pose);
    const angle = (actor.seatIndex % 8) * (Math.PI / 4);
    const position = new THREE.Vector3(
      home.x + Math.cos(angle) * 2.4,
      DECK_TOP,
      home.z + Math.sin(angle) * 2.4
    );
    agents.push({
      id: actor.actorId,
      position,
      target: position.clone(),
      clip,
      clipTime: 0,
      frame: 0,
      suitColor: suitColorFor(actor.agentKey),
      faceIndex: Math.abs(actor.seatIndex) % 16,
      badge,
      working,
    });
  }
  return agents;
}
