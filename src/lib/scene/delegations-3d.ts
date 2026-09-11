import * as THREE from "three";
import type { DirectDelegation } from "@/lib/activity/activity-model";

interface DelegationVisual {
  relation: DirectDelegation;
  line: THREE.Line;
  token: THREE.Mesh;
  curve: THREE.QuadraticBezierCurve3;
  senderPosition: THREE.Vector3;
  recipientPosition: THREE.Vector3;
}

export class Delegations3D {
  private visuals = new Map<string, DelegationVisual>();
  private reducedMotion = false;

  constructor(private scene: THREE.Scene) {}

  setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled;
  }

  reconcile(relations: readonly DirectDelegation[]): void {
    const activeIds = new Set(relations.map((relation) => relation.invocationId));
    for (const id of this.visuals.keys()) {
      if (!activeIds.has(id)) this.remove(id);
    }

    for (const relation of relations) {
      const existing = this.visuals.get(relation.invocationId);
      if (existing) {
        existing.relation = relation;
        const color = relation.lifecycle === "started" ? 0x62d9ff : 0xffc86a;
        (existing.line.material as THREE.LineBasicMaterial).color.setHex(color);
        (existing.token.material as THREE.MeshBasicMaterial).color.setHex(color);
        continue;
      }
      const color = relation.lifecycle === "started" ? 0x62d9ff : 0xffc86a;
      const line = new THREE.Line(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.7 }),
      );
      const token = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 10, 8),
        new THREE.MeshBasicMaterial({ color }),
      );
      line.frustumCulled = false;
      token.frustumCulled = false;
      this.scene.add(line, token);
      this.visuals.set(relation.invocationId, {
        relation,
        line,
        token,
        curve: new THREE.QuadraticBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()),
        senderPosition: new THREE.Vector3(Number.POSITIVE_INFINITY, 0, 0),
        recipientPosition: new THREE.Vector3(Number.POSITIVE_INFINITY, 0, 0),
      });
    }
  }

  update(timeMs: number, agents: ReadonlyMap<string, { position: THREE.Vector3 }>): void {
    for (const [id, visual] of this.visuals) {
      const start = agents.get(visual.relation.senderActorId)?.position;
      const end = agents.get(visual.relation.recipientActorId)?.position;
      if (!start || !end) {
        visual.line.visible = false;
        visual.token.visible = false;
        continue;
      }
      visual.line.visible = true;
      visual.token.visible = true;
      if (!visual.senderPosition.equals(start) || !visual.recipientPosition.equals(end)) {
        visual.senderPosition.copy(start);
        visual.recipientPosition.copy(end);
        visual.curve.v0.copy(start).y += 1.8;
        visual.curve.v2.copy(end).y += 1.8;
        visual.curve.v1.copy(visual.curve.v0).lerp(visual.curve.v2, 0.5);
        visual.curve.v1.y += Math.max(1, visual.curve.v0.distanceTo(visual.curve.v2) * 0.2);
        visual.line.geometry.setFromPoints(visual.curve.getPoints(20));
      }
      const progress = this.reducedMotion ? 0.5 : (timeMs * 0.00035 + this.phaseOffset(id)) % 1;
      visual.token.position.copy(visual.curve.getPoint(progress));
    }
  }

  dispose(): void {
    for (const id of [...this.visuals.keys()]) this.remove(id);
  }

  private phaseOffset(id: string): number {
    let hash = 0;
    for (let index = 0; index < id.length; index++) hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
    return (hash % 1000) / 1000;
  }

  private remove(id: string): void {
    const visual = this.visuals.get(id);
    if (!visual) return;
    this.scene.remove(visual.line, visual.token);
    visual.line.geometry.dispose();
    (visual.line.material as THREE.Material).dispose();
    visual.token.geometry.dispose();
    (visual.token.material as THREE.Material).dispose();
    this.visuals.delete(id);
  }
}
