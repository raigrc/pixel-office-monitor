import * as THREE from 'three';
import type { WorldAgent } from '../world/world-types';
import { findPath, isNavWalkable, nearestFree, SEPARATION_DIST, worldToGrid, type NavGrid } from './navigation';

export const WALK_SPEED = 2.5;
export const LEAVE_SPEED = 4;
export const ARRIVE_DISTANCE = 0.25;
export const MAX_ENTRANCES_PER_RECONCILE = 6;
export const DEPARTURE_STANDBY_SECONDS = 25;
const FIXED_STEP = 1 / 60;
const MAX_FIXED_STEPS = 6;
const TRANSIT_LANES = 6;
const TRANSIT_LANE_GAP = 0.2;

export type MotionPhase = 'entering' | 'onsite' | 'standby' | 'leaving';
type TransitLeg = 'ramp-top' | 'ramp-bottom' | 'site' | 'airlock';

export interface MotionEnvironment {
  revision: number;
  grid: NavGrid;
  sites: ReadonlyMap<string, THREE.Vector3>;
  ship: {
    rampBottom: THREE.Vector3;
    rampTop: THREE.Vector3;
    airlock: THREE.Vector3;
  };
}

export interface MotionAgentView {
  agent: WorldAgent;
  phase: MotionPhase;
  position: THREE.Vector3;
  target: THREE.Vector3;
}

export type MotionEvent =
  | { type: 'spawned'; agentId: string }
  | { type: 'arrived'; agentId: string }
  | { type: 'standby-started'; agentId: string }
  | { type: 'leave-started'; agentId: string }
  | { type: 'boarded'; agentId: string };

export interface MotionDelta {
  upserted: MotionAgentView[];
  removedIds: string[];
  events: MotionEvent[];
}

export function workSiteForAgent(
  home: THREE.Vector3,
  agent: Pick<WorldAgent, 'seatIndex' | 'isOrchestrator'>,
  buildingRadius: number,
): THREE.Vector3 {
  const slot = agent.isOrchestrator ? 15 : ((agent.seatIndex % 15) + 15) % 15;
  const radius = THREE.MathUtils.clamp(buildingRadius + 0.8, 3, 3.2);
  const angle = (slot / 16) * Math.PI * 2;
  return new THREE.Vector3(
    home.x + Math.cos(angle) * radius,
    home.y,
    home.z + Math.sin(angle) * radius,
  );
}

interface MotionAgent {
  agent: WorldAgent;
  phase: MotionPhase;
  leg: TransitLeg;
  position: THREE.Vector3;
  destination: THREE.Vector3;
  waypoints: THREE.Vector3[];
  waypointIndex: number;
  environmentRevision: number;
  blockedSeconds: number;
  laneOffset: number;
  waitSeconds: number;
  missingSeconds: number;
}

export class AgentMotionController {
  private agents = new Map<string, MotionAgent>();
  private environment: MotionEnvironment | null = null;
  private accumulator = 0;
  private reducedMotion = false;

  private claimTransit(): { laneOffset: number; waitSeconds: number } {
    const occupancy = Array.from({ length: TRANSIT_LANES }, () => 0);
    for (const runtime of this.agents.values()) {
      if (runtime.phase === 'onsite') continue;
      const slot = Math.round(runtime.laneOffset / TRANSIT_LANE_GAP + (TRANSIT_LANES - 1) / 2);
      if (slot >= 0 && slot < TRANSIT_LANES) occupancy[slot]++;
    }
    const minimum = Math.min(...occupancy);
    const slot = occupancy.indexOf(minimum);
    return {
      laneOffset: (slot - (TRANSIT_LANES - 1) / 2) * TRANSIT_LANE_GAP,
      waitSeconds: minimum * 0.8,
    };
  }

  setReducedMotion(enabled: boolean): MotionDelta {
    this.reducedMotion = enabled;
    if (!enabled || !this.environment) return this.delta();

    const removedIds: string[] = [];
    for (const [id, runtime] of this.agents) {
      if (runtime.phase === 'leaving') {
        this.agents.delete(id);
        removedIds.push(id);
        continue;
      }
      const site = this.environment.sites.get(id);
      if (!site) continue;
      runtime.position.copy(site);
      runtime.destination.copy(site);
      runtime.phase = 'onsite';
      runtime.leg = 'site';
      runtime.waypoints = [];
      runtime.waypointIndex = 0;
      runtime.missingSeconds = 0;
    }
    return this.delta(removedIds);
  }

  reconcile(
    desiredAgents: readonly WorldAgent[],
    environment: MotionEnvironment,
    options: { animateEntrances?: boolean; activeWorldIds?: ReadonlySet<string> } = {},
  ): MotionDelta {
    this.environment = environment;
    const animateEntrances = options.animateEntrances !== false && !this.reducedMotion;
    const desired = new Map(desiredAgents.map((agent) => [agent.id, agent]));
    const events: MotionEvent[] = [];
    const removedIds: string[] = [];
    let entrances = [...this.agents.values()].filter((agent) => agent.phase === 'entering').length;

    for (const agent of [...desiredAgents].sort((a, b) => a.id.localeCompare(b.id))) {
      const site = environment.sites.get(agent.id);
      if (!site) continue;
      const runtime = this.agents.get(agent.id);
      if (runtime) {
        runtime.agent = agent;
        if (runtime.phase === 'leaving') {
          runtime.phase = 'entering';
          runtime.leg = 'site';
          runtime.waitSeconds = 0;
          this.route(runtime, site, environment);
        } else if (runtime.phase === 'standby') {
          runtime.phase = 'onsite';
          runtime.missingSeconds = 0;
          runtime.destination.copy(site);
          runtime.waypoints = [];
          runtime.waypointIndex = 0;
        } else if (
          runtime.environmentRevision !== environment.revision ||
          runtime.destination.distanceToSquared(site) > 0.01
        ) {
          runtime.leg = 'site';
          this.route(runtime, site, environment);
        }
        continue;
      }

      const enter = animateEntrances && entrances < MAX_ENTRANCES_PER_RECONCILE;
      const transit = enter ? this.claimTransit() : { laneOffset: 0, waitSeconds: 0 };
      const created: MotionAgent = {
        agent,
        phase: enter ? 'entering' : 'onsite',
        leg: enter ? 'ramp-top' : 'site',
        position: (enter ? environment.ship.airlock : site).clone(),
        destination: (enter ? environment.ship.rampTop : site).clone(),
        waypoints: enter ? [environment.ship.rampTop.clone()] : [],
        waypointIndex: 0,
        environmentRevision: environment.revision,
        blockedSeconds: 0,
        laneOffset: transit.laneOffset,
        waitSeconds: transit.waitSeconds,
        missingSeconds: 0,
      };
      if (enter) {
        created.position.x += created.laneOffset;
        created.destination.x += created.laneOffset;
        created.waypoints[0].x += created.laneOffset;
      }
      this.agents.set(agent.id, created);
      if (enter) {
        entrances++;
        events.push({ type: 'spawned', agentId: agent.id });
      }
    }

    for (const [id, runtime] of this.agents) {
      if (desired.has(id)) continue;
      if (runtime.phase === 'leaving' || runtime.phase === 'standby') continue;
      const worldClosed = options.activeWorldIds && !options.activeWorldIds.has(runtime.agent.worldId);
      if (worldClosed) this.beginDeparture(id, runtime, environment, removedIds, events);
      else {
        runtime.phase = 'standby';
        runtime.missingSeconds = 0;
        runtime.waypoints = [];
        runtime.waypointIndex = 0;
        events.push({ type: 'standby-started', agentId: id });
      }
    }

    return this.delta(removedIds, events);
  }

  advance(seconds: number): MotionDelta {
    if (!this.environment) return this.delta();
    const removedIds: string[] = [];
    const events: MotionEvent[] = [];
    const elapsed = Math.max(0, seconds);
    for (const [id, runtime] of [...this.agents]) {
      if (runtime.phase !== 'standby') continue;
      runtime.missingSeconds += elapsed;
      if (runtime.missingSeconds >= DEPARTURE_STANDBY_SECONDS) {
        this.beginDeparture(id, runtime, this.environment, removedIds, events);
      }
    }
    if (this.reducedMotion) return this.delta(removedIds, events);
    this.accumulator = Math.min(this.accumulator + elapsed, FIXED_STEP * MAX_FIXED_STEPS);
    while (this.accumulator >= FIXED_STEP) {
      this.step(FIXED_STEP, removedIds, events);
      this.accumulator -= FIXED_STEP;
    }
    return this.delta(removedIds, events);
  }

  snapshot(): MotionAgentView[] {
    return [...this.agents.values()]
      .sort((a, b) => a.agent.id.localeCompare(b.agent.id))
      .map((runtime) => ({
        agent: runtime.agent,
        phase: runtime.phase,
        position: runtime.position.clone(),
        target: (runtime.waypoints[runtime.waypointIndex] ?? runtime.destination).clone(),
      }));
  }

  reset(): void {
    this.agents.clear();
    this.environment = null;
    this.accumulator = 0;
  }

  private route(runtime: MotionAgent, destination: THREE.Vector3, environment: MotionEnvironment): void {
    runtime.destination.copy(destination);
    runtime.environmentRevision = environment.revision;
    runtime.blockedSeconds = 0;
    const path = findPath(environment.grid, runtime.position, destination);
    if (!path.blocked) {
      runtime.waypoints = path.waypoints.map((waypoint, index) => {
        if (index === path.waypoints.length - 1) return destination.clone();
        waypoint.y = THREE.MathUtils.lerp(runtime.position.y, destination.y, 0.5);
        return waypoint;
      });
      runtime.waypointIndex = runtime.waypoints.length > 1 ? 1 : 0;
      return;
    }
    const fallback = nearestFree(environment.grid, destination.x, destination.z);
    runtime.waypoints = fallback ? [fallback.setY(destination.y)] : [];
    runtime.waypointIndex = 0;
  }

  private step(dt: number, removedIds: string[], events: MotionEvent[]): void {
    const environment = this.environment;
    if (!environment) return;
    for (const [id, runtime] of [...this.agents].sort(([a], [b]) => a.localeCompare(b))) {
      if (runtime.phase === 'onsite') continue;
      if (runtime.phase === 'standby') continue;
      if (runtime.waitSeconds > 0) {
        runtime.waitSeconds = Math.max(0, runtime.waitSeconds - dt);
        continue;
      }
      const waypoint = runtime.waypoints[runtime.waypointIndex];
      if (!waypoint) {
        runtime.blockedSeconds += dt;
        if (runtime.blockedSeconds >= 6) {
          if (runtime.phase === 'leaving') {
            this.agents.delete(id);
            removedIds.push(id);
            events.push({ type: 'boarded', agentId: id });
          } else {
            runtime.phase = 'onsite';
          }
        }
        continue;
      }

      const speed = runtime.phase === 'leaving' ? LEAVE_SPEED : WALK_SPEED;
      if (!stepToward(runtime.position, waypoint, speed, dt)) continue;
      runtime.waypointIndex++;
      if (runtime.waypointIndex < runtime.waypoints.length) continue;
      this.completeLeg(runtime, environment, removedIds, events);
    }
    this.separateAgents();
  }

  private completeLeg(
    runtime: MotionAgent,
    environment: MotionEnvironment,
    removedIds: string[],
    events: MotionEvent[],
  ): void {
    if (runtime.phase === 'entering') {
      if (runtime.leg === 'ramp-top') {
        runtime.leg = 'ramp-bottom';
        runtime.waypoints = [environment.ship.rampBottom.clone().add(new THREE.Vector3(runtime.laneOffset, 0, 0))];
        runtime.waypointIndex = 0;
        return;
      }
      if (runtime.leg === 'ramp-bottom') {
        runtime.leg = 'site';
        const site = environment.sites.get(runtime.agent.id);
        if (site) this.route(runtime, site, environment);
        return;
      }
      runtime.phase = 'onsite';
      runtime.waypoints = [];
      events.push({ type: 'arrived', agentId: runtime.agent.id });
      return;
    }

    if (runtime.leg === 'ramp-bottom') {
      runtime.leg = 'ramp-top';
      runtime.waypoints = [environment.ship.rampTop.clone().add(new THREE.Vector3(runtime.laneOffset, 0, 0))];
      runtime.waypointIndex = 0;
      return;
    }
    if (runtime.leg === 'ramp-top') {
      runtime.leg = 'airlock';
      runtime.waypoints = [environment.ship.airlock.clone()];
      runtime.waypointIndex = 0;
      return;
    }
    this.agents.delete(runtime.agent.id);
    removedIds.push(runtime.agent.id);
    events.push({ type: 'boarded', agentId: runtime.agent.id });
  }

  private beginDeparture(
    id: string,
    runtime: MotionAgent,
    environment: MotionEnvironment,
    removedIds: string[],
    events: MotionEvent[],
  ): void {
    if (this.reducedMotion) {
      this.agents.delete(id);
      removedIds.push(id);
      events.push({ type: 'boarded', agentId: id });
      return;
    }
    const transit = this.claimTransit();
    runtime.phase = 'leaving';
    runtime.leg = 'ramp-bottom';
    runtime.laneOffset = transit.laneOffset;
    runtime.waitSeconds = transit.waitSeconds;
    runtime.missingSeconds = 0;
    this.route(runtime, environment.ship.rampBottom, environment);
    events.push({ type: 'leave-started', agentId: id });
  }

  private separateAgents(): void {
    const environment = this.environment;
    if (!environment) return;
    const moving = [...this.agents.values()].filter(
      (agent) => agent.phase !== 'onsite' && agent.phase !== 'standby' && agent.waitSeconds === 0,
    );
    const all = [...this.agents.values()];
    for (const runtime of moving) {
      for (const other of all) {
        if (runtime === other) continue;
        const dx = runtime.position.x - other.position.x;
        const dz = runtime.position.z - other.position.z;
        const distance = Math.hypot(dx, dz);
        if (distance >= SEPARATION_DIST) continue;
        const correction = Math.min((SEPARATION_DIST - distance) * 0.25, 0.05);
        const directionX = distance <= 0.001 ? (runtime.agent.id < other.agent.id ? -1 : 1) : dx / distance;
        const directionZ = distance <= 0.001 ? 0 : dz / distance;
        const nextX = runtime.position.x + directionX * correction;
        const nextZ = runtime.position.z + directionZ * correction;
        const { gx, gz } = worldToGrid(nextX, nextZ);
        if (isNavWalkable(environment.grid, gx, gz)) {
          runtime.position.x = nextX;
          runtime.position.z = nextZ;
        }
      }
    }
  }

  private delta(removedIds: string[] = [], events: MotionEvent[] = []): MotionDelta {
    return { upserted: this.snapshot(), removedIds, events };
  }
}

export function stepToward(position: THREE.Vector3, target: THREE.Vector3, speed: number, dt: number): boolean {
  const dx = target.x - position.x;
  const dz = target.z - position.z;
  const dist = Math.hypot(dx, dz);
  position.y += (target.y - position.y) * Math.min(1, dt * 3);
  if (dist < ARRIVE_DISTANCE) {
    position.copy(target);
    return true;
  }
  const step = Math.min(speed * dt, dist);
  position.x += (dx / dist) * step;
  position.z += (dz / dist) * step;
  return false;
}
