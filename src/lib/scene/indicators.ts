import * as THREE from 'three';

export const MAX_AGENT_CAP = 320;
export const BADGE_SIZE = 0.5;

export type BadgeType = 'none' | 'blocked' | 'working' | 'waiting' | 'celebrating' | 'spawn' | 'leave';

const BADGE_SDFS: Record<BadgeType, string> = {
  none: '',
  blocked: '!',
  working: '⚒',
  waiting: '?',
  celebrating: '✓',
  spawn: '▼',
  leave: '▲',
};

function createBadgeAtlas(): THREE.CanvasTexture {
  const glyphSize = 64;
  const padding = 8;
  const atlasWidth = glyphSize * 8;
  const atlasHeight = glyphSize;

  const canvas = document.createElement('canvas');
  canvas.width = atlasWidth;
  canvas.height = atlasHeight;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#00000000';
  ctx.fillRect(0, 0, atlasWidth, atlasHeight);

  const badgeTypes: BadgeType[] = ['none', 'blocked', 'working', 'waiting', 'celebrating', 'spawn', 'leave'];

  badgeTypes.forEach((type, i) => {
    const x = i * glyphSize + padding;
    const y = padding;
    const size = glyphSize - padding * 2;

    if (type === 'none') return;

    ctx.font = `bold ${size}px monospace`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(BADGE_SDFS[type], x + size / 2, y + size / 2);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  return texture;
}

const BADGE_VERTEX_SHADER = `
  attribute vec3 instancePosition;
  attribute float instanceBadge;
  attribute vec3 instanceColor;

  varying float vBadge;
  varying vec3 vColor;
  varying vec2 vUv;

  uniform float uBadgeSize;

  void main() {
    vBadge = instanceBadge;
    vColor = instanceColor;
    vUv = uv;

    vec3 pos = position;
    pos.xy *= uBadgeSize;
    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const BADGE_FRAGMENT_SHADER = `
  uniform sampler2D badgeAtlas;
  varying float vBadge;
  varying vec3 vColor;
  varying vec2 vUv;

  void main() {
    if (vBadge < 0.5) discard;

    int badgeIndex = int(vBadge);
    float glyphWidth = 1.0 / 8.0;
    float u = (vUv.x - 0.5) * glyphWidth + (float(badgeIndex) + 0.5) * glyphWidth;
    float v = vUv.y;

    vec4 tex = texture2D(badgeAtlas, vec2(u, v));
    if (tex.a < 0.1) discard;

    vec3 color = vColor;
    if (badgeIndex == 1) color = vec3(1.0, 0.2, 0.2);      // blocked - red
    else if (badgeIndex == 2) color = vec3(1.0, 0.8, 0.2);  // working - amber
    else if (badgeIndex == 3) color = vec3(0.2, 0.8, 1.0);  // waiting - cyan
    else if (badgeIndex == 4) color = vec3(0.2, 1.0, 0.4);  // celebrating - green
    else if (badgeIndex == 5) color = vec3(0.4, 0.6, 1.0);  // spawn - blue
    else if (badgeIndex == 6) color = vec3(0.8, 0.4, 1.0);  // leave - purple

    gl_FragColor = vec4(color, tex.a);
  }
`;

export class Badges {
  private mesh: THREE.InstancedMesh;
  private atlas: THREE.CanvasTexture;
  private material: THREE.ShaderMaterial;
  private maxAgents: number;
  private agentBadges: Map<string, { index: number; type: BadgeType }> = new Map();

  private dummy = new THREE.Object3D();

  constructor(maxAgents: number = MAX_AGENT_CAP) {
    this.maxAgents = maxAgents;
    this.atlas = createBadgeAtlas();
    this.material = this.createMaterial();
    this.mesh = this.createMesh();
  }

  private createMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      vertexShader: BADGE_VERTEX_SHADER,
      fragmentShader: BADGE_FRAGMENT_SHADER,
      uniforms: {
        badgeAtlas: { value: this.atlas },
        uBadgeSize: { value: 0.5 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
    });
  }

  private createMesh(): THREE.InstancedMesh {
    const geometry = new THREE.PlaneGeometry(1, 1);
    geometry.rotateX(-Math.PI / 2);

    const mesh = new THREE.InstancedMesh(geometry, this.material, this.maxAgents);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const badgeArray = new THREE.InstancedBufferAttribute(new Float32Array(this.maxAgents), 1);
    const colorArray = new THREE.InstancedBufferAttribute(new Float32Array(this.maxAgents * 3), 3);
    geometry.setAttribute('instanceBadge', badgeArray);
    geometry.setAttribute('instanceColor', colorArray);

    return mesh;
  }

  setBadge(agentId: string, type: BadgeType, position: THREE.Vector3, color: THREE.Color = new THREE.Color(0xffffff)): void {
    let entry = this.agentBadges.get(agentId);
    const badgeIndex = this.badgeTypeToIndex(type);

    if (!entry) {
      const index = this.agentBadges.size;
      if (index >= this.maxAgents) return;
      entry = { index, type };
      this.agentBadges.set(agentId, entry);
    }

    entry.type = type;

    this.dummy.position.copy(position);
    this.dummy.position.y += 2.2;
    this.dummy.lookAt(new THREE.Vector3(0, 1.7, 0));
    this.dummy.updateMatrix();

    this.mesh.setMatrixAt(entry.index, this.dummy.matrix);

    const badgeArray = this.mesh.geometry.getAttribute('instanceBadge') as THREE.InstancedBufferAttribute;
    badgeArray.setX(entry.index, badgeIndex);
    badgeArray.needsUpdate = true;

    const colorArray = this.mesh.geometry.getAttribute('instanceColor') as THREE.InstancedBufferAttribute;
    colorArray.setXYZ(entry.index, color.r, color.g, color.b);
    colorArray.needsUpdate = true;

    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clearBadge(agentId: string): void {
    const entry = this.agentBadges.get(agentId);
    if (!entry) return;

    const badgeArray = this.mesh.geometry.getAttribute('instanceBadge') as THREE.InstancedBufferAttribute;
    badgeArray.setX(entry.index, 0);
    badgeArray.needsUpdate = true;

    this.agentBadges.delete(agentId);
    this.rebuildIndices();
  }

  private rebuildIndices(): void {
    let index = 0;
    for (const [agentId, entry] of this.agentBadges) {
      if (entry.index !== index) {
        const badgeArray = this.mesh.geometry.getAttribute('instanceBadge') as THREE.InstancedBufferAttribute;
        const colorArray = this.mesh.geometry.getAttribute('instanceColor') as THREE.InstancedBufferAttribute;

        badgeArray.setX(index, badgeArray.getX(entry.index));
        colorArray.setXYZ(index,
          colorArray.getX(entry.index * 3),
          colorArray.getY(entry.index * 3),
          colorArray.getZ(entry.index * 3)
        );

        entry.index = index;
      }
      index++;
    }
  }

  private badgeTypeToIndex(type: BadgeType): number {
    switch (type) {
      case 'none': return 0;
      case 'blocked': return 1;
      case 'working': return 2;
      case 'waiting': return 3;
      case 'celebrating': return 4;
      case 'spawn': return 5;
      case 'leave': return 6;
    }
  }

  getMesh(): THREE.InstancedMesh {
    return this.mesh;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.atlas.dispose();
  }
}

export function createBadges(maxAgents?: number): Badges {
  return new Badges(maxAgents);
}