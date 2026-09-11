import * as THREE from 'three';
import type { ActorInfo, InvocationInfo } from '../monitor-types';
import { getActorActivityPose } from './actor-pose';
import { DECK_TOP } from './hex-grid';
import type { AstronautState } from './astronauts';
import { getAgentVisualIdentity } from '../agent-visual-identity';

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

export function suitColorFor(agentKey: string): THREE.Color {
  return new THREE.Color(getAgentVisualIdentity(agentKey).accent);
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
    const identity = getAgentVisualIdentity(actor.agentKey);
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
      detailColor: new THREE.Color(identity.detail),
      accessory: identity.accessory,
      faceIndex: Math.abs(actor.seatIndex) % 16,
      badge,
      working,
    });
  }
  return agents;
}
