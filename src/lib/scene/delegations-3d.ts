import * as THREE from "three";
import type { DirectDelegation } from "@/lib/activity/activity-model";

interface DelegationVisual {
  relation: DirectDelegation;
  line: THREE.LineSegments;
  lineMaterial: THREE.LineBasicMaterial;
  token: THREE.Mesh;
  tokenMaterial: THREE.MeshBasicMaterial;
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
        const pathColor = relation.lifecycle === "started" ? 0x58c8e8 : 0xe8a94f;
        const tokenColor = relation.lifecycle === "started" ? 0xd9f8ff : 0xffedb3;
        existing.lineMaterial.color.setHex(pathColor);
        existing.tokenMaterial.color.setHex(tokenColor);
        continue;
      }
      const pathColor = relation.lifecycle === "started" ? 0x58c8e8 : 0xe8a94f;
      const tokenColor = relation.lifecycle === "started" ? 0xd9f8ff : 0xffedb3;
      const lineMaterial = new THREE.LineBasicMaterial({ color: pathColor, transparent: true, opacity: 0.88, depthTest: false });
      const line = new THREE.LineSegments(new THREE.BufferGeometry(), lineMaterial);
      const tokenMaterial = new THREE.MeshBasicMaterial({ color: tokenColor, depthTest: false });
      const token = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.19, 0),
        tokenMaterial,
      );
      line.renderOrder = 4;
      token.renderOrder = 5;
      line.frustumCulled = false;
      token.frustumCulled = false;
      this.scene.add(line, token);
      this.visuals.set(relation.invocationId, {
        relation,
        line,
        lineMaterial,
        token,
        tokenMaterial,
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
        const points = visual.curve.getPoints(24);
        const segments: THREE.Vector3[] = [];
        for (const offset of [-0.035, 0, 0.035]) {
          for (let index = 1; index < points.length; index++) {
            const previous = points[index - 1].clone();
            const current = points[index].clone();
            previous.y += offset;
            current.y += offset;
            segments.push(
              previous,
              current,
            );
          }
        }
        visual.line.geometry.setFromPoints(segments);
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
    visual.lineMaterial.dispose();
    visual.token.geometry.dispose();
    visual.tokenMaterial.dispose();
    this.visuals.delete(id);
  }
}
