import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { COZY_THEME } from '../cozy-theme';
import { createCozyMaterial } from './cozy-materials';

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
  private trimMesh!: THREE.Mesh;
  private windowMesh!: THREE.Mesh;
  private group!: THREE.Group;
  private airlockAnchor!: THREE.Object3D;
  private rampTopAnchor!: THREE.Object3D;
  private rampBottomAnchor!: THREE.Object3D;
  /** Shared beacon geometry/material. Owned here, disposed exactly once. */
  private lightGeometry: THREE.BufferGeometry | null = null;
  private lightMaterial: THREE.Material | null = null;

  private config: ShipConfig;
  private disposed = false;

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

    const hullMat = createCozyMaterial({
      recipe: 'paintedMetal',
      color: COZY_THEME.environment.floor,
    });
    hullMat.side = THREE.DoubleSide;
    this.hullMesh = new THREE.Mesh(hullGeo, hullMat);
    this.hullMesh.name = 'utility-shuttle-hull';
    this.hullMesh.castShadow = true;
    this.hullMesh.receiveShadow = true;
    this.group.add(this.hullMesh);

    const engineGeo = new THREE.CylinderGeometry(2, 3, 2, 12, 1, true);
    engineGeo.translate(0, -1, 0);
    engineGeo.rotateX(Math.PI);

    const engineMat = createCozyMaterial({
      recipe: 'brushedMetal',
      color: COZY_THEME.environment.metal,
    });
    engineMat.side = THREE.DoubleSide;
    this.engineMesh = new THREE.Mesh(engineGeo, engineMat);
    this.engineMesh.castShadow = true;
    this.group.add(this.engineMesh);

    const airlockGeo = new THREE.CylinderGeometry(1.5, 1.5, 3, 12, 1, true);
    airlockGeo.rotateX(Math.PI / 2);

    const airlockMat = createCozyMaterial({
      recipe: 'paintedMetal',
      color: COZY_THEME.semantic.success,
    });
    airlockMat.side = THREE.DoubleSide;
    this.airlockMesh = new THREE.Mesh(airlockGeo, airlockMat);
    this.airlockMesh.name = 'utility-shuttle-airlock';
    this.airlockMesh.position.set(0, 2.5, 9);
    this.airlockMesh.castShadow = true;
    this.group.add(this.airlockMesh);

    const rampGeo = new THREE.BoxGeometry(3, 0.2, 12);

    const rampMat = createCozyMaterial({
      recipe: 'wood',
      color: COZY_THEME.environment.woodDark,
    });
    this.rampMesh = new THREE.Mesh(rampGeo, rampMat);
    this.rampMesh.position.set(0, 1.5, 15);
    this.rampMesh.rotation.x = 0.25;
    this.rampMesh.receiveShadow = true;
    this.group.add(this.rampMesh);

    const trimGeo = new THREE.TorusGeometry(7.25, 0.28, 6, 24);
    trimGeo.rotateX(Math.PI / 2);
    trimGeo.translate(0, 3.05, 0);
    this.trimMesh = new THREE.Mesh(
      trimGeo,
      createCozyMaterial({ recipe: 'paintedMetal', color: COZY_THEME.semantic.success }),
    );
    this.trimMesh.name = 'utility-shuttle-trim';
    this.trimMesh.castShadow = true;
    this.group.add(this.trimMesh);

    const windowParts = [-4.2, -2.1, 0, 2.1, 4.2].map((x) => {
      const geometry = new THREE.SphereGeometry(0.48, 8, 5);
      geometry.scale(1, 0.78, 0.32);
      geometry.translate(x, 3.45, 6.55 - Math.abs(x) * 0.16);
      return geometry;
    });
    const windowGeo = mergeGeometries(windowParts, false);
    windowParts.forEach((geometry) => geometry.dispose());
    if (!windowGeo) throw new Error('Failed to merge shuttle windows');
    this.windowMesh = new THREE.Mesh(
      windowGeo,
      createCozyMaterial({
        recipe: 'softGlow',
        color: COZY_THEME.environment.lamp,
        emissive: COZY_THEME.environment.lamp,
      }),
    );
    this.windowMesh.name = 'utility-shuttle-windows';
    this.group.add(this.windowMesh);

    this.airlockAnchor = new THREE.Object3D();
    this.airlockAnchor.position.set(0, 2.5, 8.5);
    this.rampTopAnchor = new THREE.Object3D();
    this.rampTopAnchor.position.set(0, 3, 9);
    this.rampBottomAnchor = new THREE.Object3D();
    this.rampBottomAnchor.position.set(0, 0, 21);
    this.group.add(this.airlockAnchor, this.rampTopAnchor, this.rampBottomAnchor);

    const lightGeo = new THREE.SphereGeometry(0.3, 8, 6);
    const lightMat = new THREE.MeshBasicMaterial({ color: COZY_THEME.semantic.success });
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
    if (this.disposed) return;
    this.disposed = true;
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
    this.trimMesh.geometry.dispose();
    if (Array.isArray(this.trimMesh.material)) this.trimMesh.material.forEach((material) => material.dispose());
    else this.trimMesh.material.dispose();
    this.windowMesh.geometry.dispose();
    if (Array.isArray(this.windowMesh.material)) this.windowMesh.material.forEach((material) => material.dispose());
    else this.windowMesh.material.dispose();
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
