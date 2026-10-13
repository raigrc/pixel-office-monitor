import { describe, expect, it } from "vitest";

import { COZY_THEME, type CozyMaterialRecipeName } from "../../cozy-theme";
import { createCozyMaterial } from "../cozy-materials";

const RECIPE_NAMES: CozyMaterialRecipeName[] = [
  "matte",
  "wood",
  "paintedMetal",
  "brushedMetal",
  "softGlow",
];

function relativeLuminance(hex: number): number {
  const channels = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
  const linear = channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

describe("cozy Three materials", () => {
  it("translates every canonical recipe into a standard material", () => {
    for (const recipeName of RECIPE_NAMES) {
      const recipe = COZY_THEME.materials[recipeName];
      const material = createCozyMaterial({ recipe: recipeName, color: COZY_THEME.environment.wood });
      expect(material.roughness).toBe(recipe.roughness);
      expect(material.metalness).toBe(recipe.metalness);
      expect(`#${material.color.getHexString().toUpperCase()}`).toBe(COZY_THEME.environment.wood);
      expect(material.emissiveIntensity).toBe(recipe.emissiveIntensity ?? 1);
      material.dispose();
    }
  });

  it("applies soft glow color and intensity without leaking Three into theme data", () => {
    const material = createCozyMaterial({
      recipe: "softGlow",
      color: COZY_THEME.environment.lamp,
      emissive: COZY_THEME.semantic.waiting,
    });
    expect(`#${material.emissive.getHexString().toUpperCase()}`).toBe(COZY_THEME.semantic.waiting);
    expect(material.emissiveIntensity).toBe(COZY_THEME.materials.softGlow.emissiveIntensity);
    material.dispose();
  });

  it("keeps warm emissive signals stronger than matching decoration with bloom off", () => {
    const signal = createCozyMaterial({
      recipe: "softGlow",
      color: "#EDC46A",
      emissive: "#EDC46A",
    });
    const decoration = createCozyMaterial({ recipe: "paintedMetal", color: "#EDC46A" });
    const signalEmission = relativeLuminance(signal.emissive.getHex()) * signal.emissiveIntensity;
    const decorationEmission = relativeLuminance(decoration.emissive.getHex()) * decoration.emissiveIntensity;

    expect(signal.emissive.getHex()).toBe(0xedc46a);
    expect(signal.emissiveIntensity).toBe(0.45);
    expect(signalEmission).toBeCloseTo(0.2633624455, 10);
    expect(decorationEmission).toBe(0);
    expect(signalEmission).toBeGreaterThan(decorationEmission);

    signal.dispose();
    decoration.dispose();
  });
});
