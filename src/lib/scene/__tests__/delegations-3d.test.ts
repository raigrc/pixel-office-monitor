import * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { DirectDelegation } from "@/lib/activity/activity-model";
import { DELEGATION_SEMANTIC_COLORS, Delegations3D } from "../delegations-3d";
import { COZY_THEME } from "../../cozy-theme";

function relation(overrides: Partial<DirectDelegation> = {}): DirectDelegation {
  return {
    invocationId: "invocation-1",
    floorId: "floor-1",
    senderActorId: "sender",
    recipientActorId: "recipient",
    parentInvocationId: null,
    lifecycle: "requested",
    requestedAt: 1,
    ...overrides,
  };
}

describe("Delegations3D", () => {
  it("uses canonical purple delegation colors", () => {
    expect(DELEGATION_SEMANTIC_COLORS).toEqual({
      active: COZY_THEME.semantic.delegationActive,
      pending: COZY_THEME.semantic.delegationPending,
      token: COZY_THEME.semantic.delegationToken,
    });
  });

  it("creates one invocation-keyed arc and token, updates it, then removes it", () => {
    const scene = new THREE.Scene();
    const delegations = new Delegations3D(scene);
    const positions = new Map([
      ["sender", { position: new THREE.Vector3(0, 0, 0) }],
      ["recipient", { position: new THREE.Vector3(4, 0, 0) }],
    ]);

    delegations.reconcile([relation()]);
    delegations.reconcile([relation({ lifecycle: "started" })]);
    delegations.update(500, positions);

    expect(scene.children).toHaveLength(2);
    expect(scene.children.every((child) => child.visible)).toBe(true);
    const path = scene.children.find((child) => child instanceof THREE.LineSegments);
    const token = scene.children.find((child) => child instanceof THREE.Mesh);
    expect(path?.geometry.getAttribute('position').count).toBe(144);
    expect(token?.geometry).toBeInstanceOf(THREE.OctahedronGeometry);
    expect((path?.material as THREE.LineBasicMaterial).color.getHex()).toBe(
      new THREE.Color(COZY_THEME.semantic.delegationActive).getHex(),
    );
    expect((token?.material as THREE.MeshBasicMaterial).color.getHex()).toBe(
      new THREE.Color(COZY_THEME.semantic.delegationToken).getHex(),
    );
    delegations.reconcile([]);
    expect(scene.children).toHaveLength(0);
  });

  it("holds the token still under reduced motion and hides missing endpoints", () => {
    const scene = new THREE.Scene();
    const delegations = new Delegations3D(scene);
    const positions = new Map([
      ["sender", { position: new THREE.Vector3(0, 0, 0) }],
      ["recipient", { position: new THREE.Vector3(4, 0, 0) }],
    ]);
    delegations.reconcile([relation()]);
    delegations.setReducedMotion(true);
    delegations.update(100, positions);
    const token = scene.children.find((child) => child instanceof THREE.Mesh);
    const first = token?.position.clone();
    delegations.update(5_000, positions);
    expect(token?.position).toEqual(first);

    delegations.update(5_000, new Map());
    expect(scene.children.every((child) => !child.visible)).toBe(true);
  });
});
