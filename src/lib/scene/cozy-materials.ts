import * as THREE from "three";

import { COZY_THEME, type CozyMaterialRecipeName } from "../cozy-theme";

export interface CreateCozyMaterialOptions {
  readonly recipe: CozyMaterialRecipeName;
  readonly color: THREE.ColorRepresentation;
  readonly emissive?: THREE.ColorRepresentation;
}

export function createCozyMaterial(options: CreateCozyMaterialOptions): THREE.MeshStandardMaterial {
  const recipe = COZY_THEME.materials[options.recipe];
  const parameters: THREE.MeshStandardMaterialParameters = {
    color: options.color,
    roughness: recipe.roughness,
    metalness: recipe.metalness,
  };

  if (recipe.emissiveIntensity !== undefined) {
    parameters.emissive = options.emissive ?? options.color;
    parameters.emissiveIntensity = recipe.emissiveIntensity;
  }

  return new THREE.MeshStandardMaterial(parameters);
}
