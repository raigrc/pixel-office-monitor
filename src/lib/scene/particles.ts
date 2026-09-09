import * as THREE from 'three';

export type ParticleType = 'spark' | 'confetti' | 'z' | 'dust' | 'ping';

export interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
  type: ParticleType;
  rotation: number;
  rotationSpeed: number;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private maxParticles: number;
  private geometry: THREE.BufferGeometry;
  private material: THREE.PointsMaterial;
  private mesh: THREE.Points;

  private positionArray: Float32Array;
  private colorArray: Float32Array;
  private sizeArray: Float32Array;

  constructor(maxParticles: number = 10000) {
    this.maxParticles = maxParticles;
    this.geometry = new THREE.BufferGeometry();
    this.material = new THREE.PointsMaterial({
      size: 0.1,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.mesh = new THREE.Points(this.geometry, this.material);

    this.positionArray = new Float32Array(maxParticles * 3);
    this.colorArray = new Float32Array(maxParticles * 3);
    this.sizeArray = new Float32Array(maxParticles);

    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positionArray, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colorArray, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizeArray, 1));
    this.geometry.setDrawRange(0, 0);
  }

  emit(type: ParticleType, position: THREE.Vector3, count: number, options?: {
    color?: THREE.Color;
    velocity?: THREE.Vector3;
    spread?: number;
    life?: number;
    size?: number;
  }): void {
    const opts = {
      color: options?.color ?? new THREE.Color(0xffffff),
      velocity: options?.velocity ?? new THREE.Vector3(),
      spread: options?.spread ?? 1,
      life: options?.life ?? 1,
      size: options?.size ?? 0.1,
    };

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const p: Particle = {
        position: position.clone(),
        velocity: opts.velocity.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * opts.spread,
          (Math.random() - 0.5) * opts.spread,
          (Math.random() - 0.5) * opts.spread
        )),
        life: opts.life,
        maxLife: opts.life,
        size: opts.size * (0.5 + Math.random() * 0.5),
        color: opts.color.clone(),
        type,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 10,
      };

      if (type === 'spark') {
        p.velocity.y += 2 + Math.random() * 3;
        p.velocity.x += (Math.random() - 0.5) * 4;
        p.velocity.z += (Math.random() - 0.5) * 4;
        p.life = 0.3 + Math.random() * 0.2;
        p.maxLife = p.life;
        p.size = 0.05 + Math.random() * 0.05;
        p.color.setHSL(0.15, 1, 0.5 + Math.random() * 0.3);
      } else if (type === 'confetti') {
        p.velocity.y += 3 + Math.random() * 2;
        p.velocity.x += (Math.random() - 0.5) * 3;
        p.velocity.z += (Math.random() - 0.5) * 3;
        p.life = 1.5 + Math.random() * 1;
        p.maxLife = p.life;
        p.size = 0.15 + Math.random() * 0.1;
        const hue = Math.random() * 0.15;
        p.color.setHSL(hue, 0.8, 0.6);
      } else if (type === 'z') {
        p.velocity.y = 0.5 + Math.random() * 0.5;
        p.life = 2 + Math.random() * 1;
        p.maxLife = p.life;
        p.size = 0.08 + Math.random() * 0.04;
        p.color.setHSL(0.6, 0.5, 0.7);
      } else if (type === 'dust') {
        p.velocity.y = Math.random() * 0.5;
        p.velocity.x += (Math.random() - 0.5) * 1;
        p.velocity.z += (Math.random() - 0.5) * 1;
        p.life = 0.5 + Math.random() * 0.5;
        p.maxLife = p.life;
        p.size = 0.05 + Math.random() * 0.05;
        p.color.setHSL(0.1, 0.2, 0.4);
      } else if (type === 'ping') {
        p.velocity.set(0, 0, 0);
        p.life = 0.5;
        p.maxLife = 0.5;
        p.size = 0.5;
        p.color.setHSL(0.55, 1, 0.6);
      }

      this.particles.push(p);
    }
  }

  update(dt: number): void {
    let aliveCount = 0;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.life -= dt;

      if (p.life <= 0) {
        continue;
      }

      p.position.addScaledVector(p.velocity, dt);
      p.velocity.y -= 9.8 * dt * 0.3;
      p.rotation += p.rotationSpeed * dt;

      const lifeRatio = p.life / p.maxLife;

      this.positionArray[aliveCount * 3] = p.position.x;
      this.positionArray[aliveCount * 3 + 1] = p.position.y;
      this.positionArray[aliveCount * 3 + 2] = p.position.z;

      this.colorArray[aliveCount * 3] = p.color.r * lifeRatio;
      this.colorArray[aliveCount * 3 + 1] = p.color.g * lifeRatio;
      this.colorArray[aliveCount * 3 + 2] = p.color.b * lifeRatio;

      this.sizeArray[aliveCount] = p.size * lifeRatio;

      if (aliveCount !== i) {
        this.particles[aliveCount] = p;
      }
      aliveCount++;
    }

    this.particles.length = aliveCount;
    this.geometry.setDrawRange(0, aliveCount);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;
  }

  getMesh(): THREE.Points {
    return this.mesh;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}

export function createParticleSystem(maxParticles?: number): ParticleSystem {
  return new ParticleSystem(maxParticles);
}