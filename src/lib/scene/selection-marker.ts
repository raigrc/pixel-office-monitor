import * as THREE from 'three';

export class AgentSelectionMarker {
  private selectedAgentId: string | null = null;
  private geometry = new THREE.RingGeometry(0.38, 0.52, 24);
  private material = new THREE.MeshBasicMaterial({
    color: 0xf8fafc,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  private mesh = new THREE.Mesh(this.geometry, this.material);

  constructor() {
    this.mesh.name = 'selected-agent-marker';
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.renderOrder = 7;
    this.mesh.visible = false;
  }

  setSelectedAgent(agentId: string | null): void {
    this.selectedAgentId = agentId;
  }

  update(agents: ReadonlyMap<string, { position: THREE.Vector3 }>): void {
    const position = this.selectedAgentId ? agents.get(this.selectedAgentId)?.position : undefined;
    this.mesh.visible = Boolean(position);
    if (position) this.mesh.position.set(position.x, position.y + 0.03, position.z);
  }

  getMesh(): THREE.Mesh {
    return this.mesh;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
