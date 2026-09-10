import * as THREE from 'three';
import { CrewRig, Clip, createCrewRig, createBoneTexture, getClipFrame, getBoneMatrix } from './crew-rig';
import { hexToWorld } from './hex-grid';

export interface AstronautState {
  id: string;
  position: THREE.Vector3;
  target: THREE.Vector3;
  clip: string;
  clipTime: number;
  frame: number;
  suitColor: THREE.Color;
  faceIndex: number;
  badge: string;
  working: boolean;
}

export interface AstronautConfig {
  maxAgents: number;
  rig: CrewRig;
}

const FACE_ATLAS_SIZE = 4;
const FACE_COUNT = FACE_ATLAS_SIZE * FACE_ATLAS_SIZE;

const FACE_EXPRESSIONS = [
  'neutral', 'happy', 'focused', 'concerned',
  'tired', 'sleepy', 'alert', 'excited',
  'confused', 'determined', 'bored', 'stressed',
  'proud', 'worried', 'curious', 'calm',
];

function createFaceAtlas(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size * FACE_ATLAS_SIZE;
  canvas.height = size * FACE_ATLAS_SIZE;
  const ctx = canvas.getContext('2d')!;

  for (let fy = 0; fy < FACE_ATLAS_SIZE; fy++) {
    for (let fx = 0; fx < FACE_ATLAS_SIZE; fx++) {
      const idx = fy * FACE_ATLAS_SIZE + fx;
      const x = fx * size;
      const y = fy * size;

      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(x, y, size, size);

      ctx.fillStyle = '#ffffff';
      const eyeSize = 12;
      const eyeY = size * 0.35;
      const eyeSpacing = size * 0.25;
      const centerX = x + size / 2;

      ctx.beginPath();
      ctx.arc(centerX - eyeSpacing, y + eyeY, eyeSize, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(centerX + eyeSpacing, y + eyeY, eyeSize, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#1a1a1a';
      const pupilSize = 5;
      const pupilOffset = (idx % 3 - 1) * 2;

      ctx.beginPath();
      ctx.arc(centerX - eyeSpacing + pupilOffset, y + eyeY, pupilSize, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(centerX + eyeSpacing + pupilOffset, y + eyeY, pupilSize, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      const mouthY = y + size * 0.65;
      const mouthWidth = size * 0.3;

      if (idx === 1 || idx === 7) {
        ctx.beginPath();
        ctx.arc(centerX, mouthY, mouthWidth, 0, Math.PI);
        ctx.stroke();
      } else if (idx === 3 || idx === 5) {
        ctx.beginPath();
        ctx.arc(centerX, mouthY + mouthWidth, mouthWidth, Math.PI, 0);
        ctx.stroke();
      } else if (idx === 8) {
        ctx.beginPath();
        ctx.moveTo(centerX - mouthWidth / 2, mouthY);
        ctx.lineTo(centerX + mouthWidth / 2, mouthY);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(centerX, mouthY, mouthWidth * 0.3, 0, Math.PI);
        ctx.stroke();
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.needsUpdate = true;

  return texture;
}

const ASTRONAUT_VERTEX_SHADER = `
  attribute vec3 instanceColor;
  attribute float instanceFrame;
  attribute float instanceFace;

  varying vec3 vColor;
  varying vec2 vFaceUV;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  uniform float uTime;
  uniform vec3 uSunDirection;
  uniform vec3 uSunColor;
  uniform float uSunIntensity;
  uniform vec3 uAmbientColor;
  uniform float uAmbientIntensity;

  void main() {
    vColor = instanceColor;
    vFaceUV = vec2(
      mod(instanceFace, 4.0) / 4.0 + 0.125 / 4.0,
      floor(instanceFace / 4.0) / 4.0 + 0.125 / 4.0
    );

    vec3 pos = position;
    float anim = sin(uTime * 2.0 + instanceFrame) * 0.05;
    pos.y += anim;

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPos.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const ASTRONAUT_FRAGMENT_SHADER = `
  uniform sampler2D faceAtlas;
  varying vec3 vColor;
  varying vec2 vFaceUV;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  uniform vec3 uSunDirection;
  uniform vec3 uSunColor;
  uniform float uSunIntensity;
  uniform vec3 uAmbientColor;
  uniform float uAmbientIntensity;

  void main() {
    vec3 N = normalize(vNormal);
    vec3 L = normalize(uSunDirection);
    float NdotL = max(dot(N, L), 0.0);

    vec3 diffuse = vColor * uSunColor * NdotL * uSunIntensity;
    vec3 ambient = vColor * uAmbientColor * uAmbientIntensity;
    vec3 color = ambient + diffuse;

    gl_FragColor = vec4(color, 1.0);
  }
`;

export class Astronauts {
  private rig: CrewRig;
  private boneTexture: THREE.DataTexture;
  private faceAtlas: THREE.CanvasTexture;

  private bodyMesh!: THREE.InstancedMesh;
  private helmetMesh!: THREE.InstancedMesh;
  private visorMesh!: THREE.InstancedMesh;
  private backpackMesh!: THREE.InstancedMesh;
  private antennaMesh!: THREE.InstancedMesh;
  private lampMesh!: THREE.InstancedMesh;
  private hammerMesh!: THREE.InstancedMesh;

  private maxAgents: number;
  private agentCount = 0;
  private agents: Map<string, AstronautState> = new Map();

  private dummy = new THREE.Object3D();
  private material!: THREE.ShaderMaterial;

  constructor(config: AstronautConfig) {
    this.rig = config.rig;
    this.maxAgents = config.maxAgents;
    this.boneTexture = createBoneTexture(this.rig);
    this.faceAtlas = createFaceAtlas();

    this.createGeometries();
    this.createMeshes();
  }

  private createGeometries(): void {
    const bodyGeo = new THREE.CapsuleGeometry(0.25, 0.8, 4, 8);
    bodyGeo.translate(0, 1.2, 0);

    const helmetGeo = new THREE.SphereGeometry(0.3, 8, 6);
    helmetGeo.translate(0, 1.85, 0);
    helmetGeo.scale(1, 1.1, 1);

    const visorGeo = new THREE.SphereGeometry(0.28, 8, 6);
    visorGeo.translate(0, 1.85, 0.3);
    visorGeo.scale(1, 1.1, 0.5);

    const backpackGeo = new THREE.BoxGeometry(0.4, 0.5, 0.2);
    backpackGeo.translate(0, 1.3, -0.35);

    const antennaGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.6, 4);
    antennaGeo.translate(0.15, 2.1, 0);

    const lampGeo = new THREE.ConeGeometry(0.1, 0.3, 4);
    lampGeo.translate(-0.15, 2.1, 0);
    lampGeo.rotateX(-Math.PI / 2);

    const hammerGeo = new THREE.BoxGeometry(0.15, 0.5, 0.15);
    hammerGeo.translate(0.4, 1.0, 0.2);
    hammerGeo.rotateZ(-Math.PI / 4);

    this.bodyMesh = new THREE.InstancedMesh(bodyGeo, this.createMaterial(), this.maxAgents);
    this.bodyMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const instanceFrame = new THREE.InstancedBufferAttribute(new Float32Array(this.maxAgents), 1);
    const instanceFace = new THREE.InstancedBufferAttribute(new Float32Array(this.maxAgents), 1);
    const instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.maxAgents * 3), 3);
    bodyGeo.setAttribute('instanceFrame', instanceFrame);
    bodyGeo.setAttribute('instanceFace', instanceFace);
    bodyGeo.setAttribute('instanceColor', instanceColor);

    this.helmetMesh = new THREE.InstancedMesh(helmetGeo, new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
      metalness: 0.7,
    }), this.maxAgents);

    this.visorMesh = new THREE.InstancedMesh(visorGeo, new THREE.MeshStandardMaterial({
      color: 0x001133,
      roughness: 0.05,
      metalness: 0.9,
      transparent: true,
      opacity: 0.6,
    }), this.maxAgents);

    this.backpackMesh = new THREE.InstancedMesh(backpackGeo, new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.8,
      metalness: 0.2,
    }), this.maxAgents);

    this.antennaMesh = new THREE.InstancedMesh(antennaGeo, new THREE.MeshStandardMaterial({
      color: 0x444444,
      roughness: 0.5,
      metalness: 0.5,
    }), this.maxAgents);

    this.lampMesh = new THREE.InstancedMesh(lampGeo, new THREE.MeshStandardMaterial({
      color: 0xffffaa,
      emissive: 0xffffaa,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.8,
    }), this.maxAgents);

    this.hammerMesh = new THREE.InstancedMesh(hammerGeo, new THREE.MeshStandardMaterial({
      color: 0x555555,
      roughness: 0.7,
      metalness: 0.3,
    }), this.maxAgents);
  }

  private createMaterial(): THREE.ShaderMaterial {
    this.material = new THREE.ShaderMaterial({
      vertexShader: ASTRONAUT_VERTEX_SHADER,
      fragmentShader: ASTRONAUT_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uSunDirection: { value: new THREE.Vector3(0, 1, 0) },
        uSunColor: { value: new THREE.Color(0xffffee) },
        uSunIntensity: { value: 1 },
        uAmbientColor: { value: new THREE.Color(0x333344) },
        uAmbientIntensity: { value: 0.5 },
      },
    });

    return this.material;
  }

  private createMeshes(): void {
    // Meshes created in createGeometries
  }

  addAgent(agent: AstronautState): void {
    if (this.agentCount >= this.maxAgents) return;
    this.agents.set(agent.id, agent);
    this.updateInstance(agent);
    this.agentCount++;
    this.syncCounts();
  }

  removeAgent(id: string): void {
    this.agents.delete(id);
    this.rebuildInstances();
    this.syncCounts();
  }

  updateAgent(id: string, updates: Partial<AstronautState>): void {
    const agent = this.agents.get(id);
    if (!agent) return;
    Object.assign(agent, updates);
    this.updateInstance(agent);
  }

  private updateInstance(agent: AstronautState): void {
    const index = Array.from(this.agents.keys()).indexOf(agent.id);
    if (index === -1) return;

    this.dummy.position.copy(agent.position);
    this.dummy.rotation.y = Math.atan2(
      agent.target.x - agent.position.x,
      agent.target.z - agent.position.z
    );
    this.dummy.updateMatrix();

    this.bodyMesh.setMatrixAt(index, this.dummy.matrix);
    this.helmetMesh.setMatrixAt(index, this.dummy.matrix);
    this.visorMesh.setMatrixAt(index, this.dummy.matrix);
    this.backpackMesh.setMatrixAt(index, this.dummy.matrix);
    this.antennaMesh.setMatrixAt(index, this.dummy.matrix);
    this.lampMesh.setMatrixAt(index, this.dummy.matrix);
    this.hammerMesh.setMatrixAt(index, this.dummy.matrix);

    const colorArray = this.bodyMesh.geometry.getAttribute('instanceColor') as THREE.InstancedBufferAttribute | undefined;
    if (colorArray) {
      colorArray.setXYZ(index, agent.suitColor.r, agent.suitColor.g, agent.suitColor.b);
      colorArray.needsUpdate = true;
    }

    const frameArray = this.bodyMesh.geometry.getAttribute('instanceFrame') as THREE.InstancedBufferAttribute;
    if (frameArray) {
      frameArray.setX(index, agent.frame);
      frameArray.needsUpdate = true;
    }

    const faceArray = this.bodyMesh.geometry.getAttribute('instanceFace') as THREE.InstancedBufferAttribute;
    if (faceArray) {
      faceArray.setX(index, agent.faceIndex);
      faceArray.needsUpdate = true;
    }

    this.bodyMesh.instanceMatrix.needsUpdate = true;
    this.helmetMesh.instanceMatrix.needsUpdate = true;
    this.visorMesh.instanceMatrix.needsUpdate = true;
    this.backpackMesh.instanceMatrix.needsUpdate = true;
    this.antennaMesh.instanceMatrix.needsUpdate = true;
    this.lampMesh.instanceMatrix.needsUpdate = true;
    this.hammerMesh.instanceMatrix.needsUpdate = true;
  }

  private rebuildInstances(): void {
    let index = 0;
    for (const agent of this.agents.values()) {
      const prevIndex = Array.from(this.agents.keys()).indexOf(agent.id);
      if (prevIndex !== index) {
        this.updateInstance(agent);
      }
      index++;
    }
    this.agentCount = this.agents.size;
  }

  /** Hide unfilled instances. Without this, idle slots render at origin. */
  private syncCounts(): void {
    this.bodyMesh.count = this.agentCount;
    this.helmetMesh.count = this.agentCount;
    this.visorMesh.count = this.agentCount;
    this.backpackMesh.count = this.agentCount;
    this.antennaMesh.count = this.agentCount;
    this.lampMesh.count = this.agentCount;
    this.hammerMesh.count = this.agentCount;
  }

  update(time: number, dt: number): void {
    for (const agent of this.agents.values()) {
      agent.clipTime += dt;
      const clip = this.rig.clips.get(agent.clip);
      if (clip) {
        agent.frame = getClipFrame(this.rig, agent.clip, agent.clipTime);
      }
    }
  }

  setUniforms(uniforms: {
    uTime?: number;
    uSunDirection?: THREE.Vector3;
    uSunColor?: THREE.Color;
    uSunIntensity?: number;
    uAmbientColor?: THREE.Color;
    uAmbientIntensity?: number;
  }): void {
    if (uniforms.uTime !== undefined) this.material.uniforms.uTime.value = uniforms.uTime;
    if (uniforms.uSunDirection) this.material.uniforms.uSunDirection.value.copy(uniforms.uSunDirection);
    if (uniforms.uSunColor) this.material.uniforms.uSunColor.value.copy(uniforms.uSunColor);
    if (uniforms.uSunIntensity !== undefined) this.material.uniforms.uSunIntensity.value = uniforms.uSunIntensity;
    if (uniforms.uAmbientColor) this.material.uniforms.uAmbientColor.value.copy(uniforms.uAmbientColor);
    if (uniforms.uAmbientIntensity !== undefined) this.material.uniforms.uAmbientIntensity.value = uniforms.uAmbientIntensity;
  }

  getMeshes(): THREE.InstancedMesh[] {
    return [
      this.bodyMesh,
      this.helmetMesh,
      this.visorMesh,
      this.backpackMesh,
      this.antennaMesh,
      this.lampMesh,
      this.hammerMesh,
    ];
  }

  getAgentCount(): number {
    return this.agentCount;
  }

  getAgent(id: string): AstronautState | undefined {
    return this.agents.get(id);
  }

  getAllAgents(): AstronautState[] {
    return Array.from(this.agents.values());
  }

  dispose(): void {
    this.bodyMesh.geometry.dispose();
    if (Array.isArray(this.bodyMesh.material)) {
      this.bodyMesh.material.forEach((m) => m.dispose());
    } else {
      this.bodyMesh.material.dispose();
    }
    this.helmetMesh.geometry.dispose();
    if (Array.isArray(this.helmetMesh.material)) {
      this.helmetMesh.material.forEach((m) => m.dispose());
    } else {
      this.helmetMesh.material.dispose();
    }
    this.visorMesh.geometry.dispose();
    if (Array.isArray(this.visorMesh.material)) {
      this.visorMesh.material.forEach((m) => m.dispose());
    } else {
      this.visorMesh.material.dispose();
    }
    this.backpackMesh.geometry.dispose();
    if (Array.isArray(this.backpackMesh.material)) {
      this.backpackMesh.material.forEach((m) => m.dispose());
    } else {
      this.backpackMesh.material.dispose();
    }
    this.antennaMesh.geometry.dispose();
    if (Array.isArray(this.antennaMesh.material)) {
      this.antennaMesh.material.forEach((m) => m.dispose());
    } else {
      this.antennaMesh.material.dispose();
    }
    this.lampMesh.geometry.dispose();
    if (Array.isArray(this.lampMesh.material)) {
      this.lampMesh.material.forEach((m) => m.dispose());
    } else {
      this.lampMesh.material.dispose();
    }
    this.hammerMesh.geometry.dispose();
    if (Array.isArray(this.hammerMesh.material)) {
      this.hammerMesh.material.forEach((m) => m.dispose());
    } else {
      this.hammerMesh.material.dispose();
    }
    this.boneTexture.dispose();
    this.faceAtlas.dispose();
  }
}

export function createAstronauts(config: AstronautConfig): Astronauts {
  return new Astronauts(config);
}