import * as THREE from 'three';
import { COZY_THEME } from '../cozy-theme';

export const MAX_AGENT_CAP = 320;
export const BADGE_SIZE = 0.42;
export const BADGE_INSTANCE_BOUNDS_PADDING = 0.5;

export type BadgeType = 'none' | 'blocked' | 'working' | 'waiting' | 'celebrating' | 'spawn' | 'leave';

const BADGE_SDFS: Record<BadgeType, string> = {
  none: '',
  blocked: '!',
  working: 'W',
  waiting: '?',
  celebrating: '✓',
  spawn: '▼',
  leave: '▲',
};

export const BADGE_SEMANTIC_COLORS = {
  blocked: COZY_THEME.semantic.error,
  working: COZY_THEME.semantic.working,
  waiting: COZY_THEME.semantic.waiting,
  celebrating: COZY_THEME.semantic.success,
  spawn: COZY_THEME.semantic.selection,
  leave: COZY_THEME.semantic.delegationActive,
} satisfies Record<Exclude<BadgeType, 'none'>, string>;

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

    ctx.beginPath();
    ctx.fillStyle = COZY_THEME.ui.text;
    ctx.arc(x + size / 2, y + size / 2, size * 0.48, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = `bold ${size * 0.62}px monospace`;
    ctx.fillStyle = COZY_THEME.ui.canvas;
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

export const BADGE_VERTEX_SHADER = `
  attribute float aBadge;
  attribute vec3 aTint;

  varying float vBadge;
  varying vec3 vColor;
  varying vec2 vUv;

  uniform float uBadgeSize;

  void main() {
    vBadge = aBadge;
    vColor = aTint;
    vUv = uv;

    vec3 pos = position;
    pos.xy *= uBadgeSize;
    // Badge quads are positioned by updateView() via the per-instance
    // matrix. Apply it exactly once so badges track their agent instead
    // of stacking at the mesh origin.
    mat4 instanceTransform = mat4(1.0);
    #ifdef USE_INSTANCING
      instanceTransform = instanceMatrix;
    #endif
    vec4 worldPos = modelMatrix * instanceTransform * vec4(pos, 1.0);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const BADGE_FRAGMENT_SHADER = `
  uniform sampler2D badgeAtlas;
  uniform vec3 uBlockedColor;
  uniform vec3 uWorkingColor;
  uniform vec3 uWaitingColor;
  uniform vec3 uSuccessColor;
  uniform vec3 uSelectionColor;
  uniform vec3 uDelegationColor;
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
    if (badgeIndex == 1) color = uBlockedColor;
    else if (badgeIndex == 2) color = uWorkingColor;
    else if (badgeIndex == 3) color = uWaitingColor;
    else if (badgeIndex == 4) color = uSuccessColor;
    else if (badgeIndex == 5) color = uSelectionColor;
    else if (badgeIndex == 6) color = uDelegationColor;

    gl_FragColor = vec4(mix(vec3(0.02), color, tex.r), tex.a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class Badges {
  private mesh: THREE.InstancedMesh;
  private atlas: THREE.CanvasTexture;
  private material: THREE.ShaderMaterial;
  private maxAgents: number;
  private agentBadges: Map<string, { index: number; type: BadgeType; pos: THREE.Vector3 }> = new Map();

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
        uBadgeSize: { value: BADGE_SIZE },
        uBlockedColor: { value: new THREE.Color(BADGE_SEMANTIC_COLORS.blocked) },
        uWorkingColor: { value: new THREE.Color(BADGE_SEMANTIC_COLORS.working) },
        uWaitingColor: { value: new THREE.Color(BADGE_SEMANTIC_COLORS.waiting) },
        uSuccessColor: { value: new THREE.Color(BADGE_SEMANTIC_COLORS.celebrating) },
        uSelectionColor: { value: new THREE.Color(BADGE_SEMANTIC_COLORS.spawn) },
        uDelegationColor: { value: new THREE.Color(BADGE_SEMANTIC_COLORS.leave) },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
  }

  private createMesh(): THREE.InstancedMesh {
    // XY plane faces +z. updateView copies the camera quaternion per
    // frame so quads face the viewer from every angle.
    const geometry = new THREE.PlaneGeometry(1, 1);

    const mesh = new THREE.InstancedMesh(geometry, this.material, this.maxAgents);
    mesh.count = 0;
    mesh.renderOrder = 6;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const badgeArray = new THREE.InstancedBufferAttribute(new Float32Array(this.maxAgents), 1);
    const colorArray = new THREE.InstancedBufferAttribute(new Float32Array(this.maxAgents * 3), 3);
    geometry.setAttribute('aBadge', badgeArray);
    geometry.setAttribute('aTint', colorArray);

    return mesh;
  }

  setBadge(
    agentId: string,
    type: BadgeType,
    position: THREE.Vector3,
    color: THREE.Color = new THREE.Color(COZY_THEME.ui.text),
  ): void {
    let entry = this.agentBadges.get(agentId);
    const badgeIndex = this.badgeTypeToIndex(type);

    if (!entry) {
      const index = this.agentBadges.size;
      if (index >= this.maxAgents) return;
      entry = { index, type, pos: new THREE.Vector3() };
      this.agentBadges.set(agentId, entry);
    }

    entry.type = type;
    entry.pos.copy(position);
    entry.pos.y += 2.35;

    this.writeInstance(entry, badgeIndex, color);
    this.mesh.count = this.agentBadges.size;
  }

  /** Faces every badge at the camera. Call once per frame after setBadge. */
  updateView(quaternion: THREE.Quaternion): void {
    const bounds = new THREE.Box3();
    for (const entry of this.agentBadges.values()) {
      this.dummy.position.copy(entry.pos);
      this.dummy.quaternion.copy(quaternion);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(entry.index, this.dummy.matrix);
      bounds.expandByPoint(entry.pos);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    const sphere = this.mesh.boundingSphere ?? new THREE.Sphere();
    if (bounds.isEmpty()) {
      sphere.center.set(0, 0, 0);
      sphere.radius = 0;
    } else {
      bounds.getBoundingSphere(sphere);
      sphere.radius += BADGE_INSTANCE_BOUNDS_PADDING;
    }
    this.mesh.boundingSphere = sphere;
  }

  private writeInstance(entry: { index: number; type: BadgeType }, badgeIndex: number, color: THREE.Color): void {
    this.dummy.position.set(0, 0, 0);
    this.dummy.quaternion.identity();
    this.dummy.scale.setScalar(1);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(entry.index, this.dummy.matrix);

    const badgeArray = this.mesh.geometry.getAttribute('aBadge') as THREE.InstancedBufferAttribute;
    badgeArray.setX(entry.index, badgeIndex);
    badgeArray.needsUpdate = true;

    const colorArray = this.mesh.geometry.getAttribute('aTint') as THREE.InstancedBufferAttribute;
    colorArray.setXYZ(entry.index, color.r, color.g, color.b);
    colorArray.needsUpdate = true;

    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clearBadge(agentId: string): void {
    const entry = this.agentBadges.get(agentId);
    if (!entry) return;

    const badgeArray = this.mesh.geometry.getAttribute('aBadge') as THREE.InstancedBufferAttribute;
    badgeArray.setX(entry.index, 0);
    badgeArray.needsUpdate = true;

    this.agentBadges.delete(agentId);
    this.rebuildIndices();
  }

  private rebuildIndices(): void {
    let index = 0;
    for (const entry of this.agentBadges.values()) {
      if (entry.index !== index) {
        const badgeArray = this.mesh.geometry.getAttribute('aBadge') as THREE.InstancedBufferAttribute;
        const colorArray = this.mesh.geometry.getAttribute('aTint') as THREE.InstancedBufferAttribute;

        badgeArray.setX(index, badgeArray.getX(entry.index));
        colorArray.setXYZ(index,
          colorArray.getX(entry.index),
          colorArray.getY(entry.index),
          colorArray.getZ(entry.index)
        );
        badgeArray.needsUpdate = true;
        colorArray.needsUpdate = true;

        entry.index = index;
      }
      // Refresh the matrix at the compacted slot. updateView() rewrites
      // these every frame, but a removal between frames must not leave a
      // stale matrix visible for even one render.
      this.dummy.position.copy(entry.pos);
      this.dummy.quaternion.identity();
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(index, this.dummy.matrix);
      index++;
    }
    this.mesh.count = index;
    this.mesh.instanceMatrix.needsUpdate = true;
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
