import * as THREE from 'three';

export interface ShipConfig {
  position: THREE.Vector3;
  scale: number;
}

export class Ship {
  private hullMesh!: THREE.Mesh;
  private engineMesh!: THREE.Mesh;
  private airlockMesh!: THREE.Mesh;
  private rampMesh!: THREE.Mesh;
  private group!: THREE.Group;

  private config: ShipConfig;

  constructor(config: ShipConfig) {
    this.config = config;
    this.group = new THREE.Group();
    this.createGeometry();
    this.group.position.copy(config.position);
    this.group.scale.setScalar(config.scale);
  }

  private createGeometry(): void {
    const hullGeo = new THREE.SphereGeometry(8, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    hullGeo.scale(1, 0.4, 1.2);
    hullGeo.translate(0, 3, 0);

    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x888888,
      roughness: 0.6,
      metalness: 0.7,
      side: THREE.DoubleSide,
    });
    this.hullMesh = new THREE.Mesh(hullGeo, hullMat);
    this.hullMesh.castShadow = true;
    this.hullMesh.receiveShadow = true;
    this.group.add(this.hullMesh);

    const engineGeo = new THREE.CylinderGeometry(2, 3, 2, 12, 1, true);
    engineGeo.translate(0, -1, 0);
    engineGeo.rotateX(Math.PI);

    const engineMat = new THREE.MeshStandardMaterial({
      color: 0x444444,
      roughness: 0.5,
      metalness: 0.8,
      side: THREE.DoubleSide,
    });
    this.engineMesh = new THREE.Mesh(engineGeo, engineMat);
    this.engineMesh.castShadow = true;
    this.group.add(this.engineMesh);

    const airlockGeo = new THREE.CylinderGeometry(1.5, 1.5, 3, 12, 1, true);
    airlockGeo.translate(0, 1.5, -9);
    airlockGeo.rotateX(Math.PI / 2);

    const airlockMat = new THREE.MeshStandardMaterial({
      color: 0x666666,
      roughness: 0.5,
      metalness: 0.6,
      side: THREE.DoubleSide,
    });
    this.airlockMesh = new THREE.Mesh(airlockGeo, airlockMat);
    this.airlockMesh.castShadow = true;
    this.group.add(this.airlockMesh);

    const rampGeo = new THREE.BoxGeometry(3, 0.2, 12);
    rampGeo.translate(0, 0.1, -15);
    rampGeo.rotateX(-0.25);

    const rampMat = new THREE.MeshStandardMaterial({
      color: 0x555555,
      roughness: 0.8,
      metalness: 0.3,
    });
    this.rampMesh = new THREE.Mesh(rampGeo, rampMat);
    this.rampMesh.receiveShadow = true;
    this.group.add(this.rampMesh);

    const lightGeo = new THREE.SphereGeometry(0.3, 8, 6);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });

    const light1 = new THREE.Mesh(lightGeo, lightMat);
    light1.position.set(-3, 4, -5);
    this.group.add(light1);

    const light2 = new THREE.Mesh(lightGeo, lightMat);
    light2.position.set(3, 4, -5);
    this.group.add(light2);
  }

  getGroup(): THREE.Group {
    return this.group;
  }

  getRampTop(): THREE.Vector3 {
    const worldPos = new THREE.Vector3();
    this.rampMesh.getWorldPosition(worldPos);
    worldPos.y += 0.2;
    return worldPos;
  }

  getRampBottom(): THREE.Vector3 {
    const worldPos = new THREE.Vector3();
    this.rampMesh.getWorldPosition(worldPos);
    worldPos.z += 12 * Math.cos(0.25) * this.config.scale;
    worldPos.y = 0;
    return worldPos;
  }

  getAirlockPosition(): THREE.Vector3 {
    const worldPos = new THREE.Vector3();
    this.airlockMesh.getWorldPosition(worldPos);
    return worldPos;
  }

  dispose(): void {
    this.hullMesh.geometry.dispose();
    if (Array.isArray(this.hullMesh.material)) {
      this.hullMesh.material.forEach((m) => m.dispose());
    } else {
      this.hullMesh.material.dispose();
    }
    this.engineMesh.geometry.dispose();
    if (Array.isArray(this.engineMesh.material)) {
      this.engineMesh.material.forEach((m) => m.dispose());
    } else {
      this.engineMesh.material.dispose();
    }
    this.airlockMesh.geometry.dispose();
    if (Array.isArray(this.airlockMesh.material)) {
      this.airlockMesh.material.forEach((m) => m.dispose());
    } else {
      this.airlockMesh.material.dispose();
    }
    this.rampMesh.geometry.dispose();
    if (Array.isArray(this.rampMesh.material)) {
      this.rampMesh.material.forEach((m) => m.dispose());
    } else {
      this.rampMesh.material.dispose();
    }
  }
}

export function createShip(config: ShipConfig): Ship {
  return new Ship(config);
}