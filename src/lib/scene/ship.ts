import * as THREE from 'three';

export interface ShipConfig {
  position: THREE.Vector3;
  scale: number;
}

export interface ShipTransit {
  rampBottom: THREE.Vector3;
  rampTop: THREE.Vector3;
  airlock: THREE.Vector3;
}

export class Ship {
  private hullMesh!: THREE.Mesh;
  private engineMesh!: THREE.Mesh;
  private airlockMesh!: THREE.Mesh;
  private rampMesh!: THREE.Mesh;
  private group!: THREE.Group;
  private airlockAnchor!: THREE.Object3D;
  private rampTopAnchor!: THREE.Object3D;
  private rampBottomAnchor!: THREE.Object3D;
  /** Shared beacon geometry/material. Owned here, disposed exactly once. */
  private lightGeometry: THREE.BufferGeometry | null = null;
  private lightMaterial: THREE.Material | null = null;

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
    airlockGeo.rotateX(Math.PI / 2);

    const airlockMat = new THREE.MeshStandardMaterial({
      color: 0x666666,
      roughness: 0.5,
      metalness: 0.6,
      side: THREE.DoubleSide,
    });
    this.airlockMesh = new THREE.Mesh(airlockGeo, airlockMat);
    this.airlockMesh.position.set(0, 2.5, 9);
    this.airlockMesh.castShadow = true;
    this.group.add(this.airlockMesh);

    const rampGeo = new THREE.BoxGeometry(3, 0.2, 12);

    const rampMat = new THREE.MeshStandardMaterial({
      color: 0x555555,
      roughness: 0.8,
      metalness: 0.3,
    });
    this.rampMesh = new THREE.Mesh(rampGeo, rampMat);
    this.rampMesh.position.set(0, 1.5, 15);
    this.rampMesh.rotation.x = 0.25;
    this.rampMesh.receiveShadow = true;
    this.group.add(this.rampMesh);

    this.airlockAnchor = new THREE.Object3D();
    this.airlockAnchor.position.set(0, 2.5, 8.5);
    this.rampTopAnchor = new THREE.Object3D();
    this.rampTopAnchor.position.set(0, 3, 9);
    this.rampBottomAnchor = new THREE.Object3D();
    this.rampBottomAnchor.position.set(0, 0, 21);
    this.group.add(this.airlockAnchor, this.rampTopAnchor, this.rampBottomAnchor);

    const lightGeo = new THREE.SphereGeometry(0.3, 8, 6);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
    this.lightGeometry = lightGeo;
    this.lightMaterial = lightMat;

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
    return this.getTransit().rampTop;
  }

  getRampBottom(): THREE.Vector3 {
    return this.getTransit().rampBottom;
  }

  getAirlockPosition(): THREE.Vector3 {
    return this.getTransit().airlock;
  }

  getTransit(): ShipTransit {
    this.group.updateWorldMatrix(true, true);
    return {
      airlock: this.airlockAnchor.getWorldPosition(new THREE.Vector3()),
      rampTop: this.rampTopAnchor.getWorldPosition(new THREE.Vector3()),
      rampBottom: this.rampBottomAnchor.getWorldPosition(new THREE.Vector3()),
    };
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
    // Beacon assets are shared by both lights: dispose once here.
    this.lightGeometry?.dispose();
    this.lightMaterial?.dispose();
    this.lightGeometry = null;
    this.lightMaterial = null;
  }
}

export function createShip(config: ShipConfig): Ship {
  return new Ship(config);
}
