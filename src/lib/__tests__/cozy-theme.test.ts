import { describe, expect, it } from "vitest";

import rawTheme from "../cozy-theme.json";
import { COZY_CSS_VARIABLES, COZY_THEME, cozyThemeSchema } from "../cozy-theme";

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("cozy theme", () => {
  it("keeps canonical JSON and typed wrapper in parity", () => {
    expect(cozyThemeSchema.parse(rawTheme)).toEqual(rawTheme);
    expect(COZY_THEME).toEqual(rawTheme);
  });

  it("keeps primary and muted text readable on every UI surface", () => {
    const surfaces = [COZY_THEME.ui.canvas, COZY_THEME.ui.surface, COZY_THEME.ui.raised, COZY_THEME.ui.elevated];
    for (const surface of surfaces) {
      expect(contrastRatio(COZY_THEME.ui.text, surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(COZY_THEME.ui.muted, surface)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastRatio(COZY_THEME.ui.dim, COZY_THEME.ui.canvas)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(COZY_THEME.ui.canvas, COZY_THEME.environment.floor)).toBeGreaterThanOrEqual(4.5);
  });

  it("uses distinct semantic colors", () => {
    const colors = Object.values(COZY_THEME.semantic);
    expect(new Set(colors).size).toBe(colors.length);
    expect(COZY_THEME.semantic.working).not.toBe(COZY_THEME.semantic.success);
    expect(COZY_THEME.semantic.delegationActive).not.toBe(COZY_THEME.semantic.delegationPending);
    expect(COZY_THEME.semantic.delegationToken).not.toBe(COZY_THEME.semantic.delegationActive);
  });

  it("keeps fixed scene and session palette lengths", () => {
    expect(COZY_THEME.scene.terrainBands).toHaveLength(4);
    expect(COZY_THEME.sessionPalette).toHaveLength(6);
  });

  it("derives CSS theme variables from canonical theme values", () => {
    expect(COZY_CSS_VARIABLES).toMatchObject({
      "--canvas": COZY_THEME.ui.canvas,
      "--surface": COZY_THEME.ui.surface,
      "--raised": COZY_THEME.ui.raised,
      "--text": COZY_THEME.ui.text,
      "--selection": COZY_THEME.semantic.selection,
      "--working": COZY_THEME.semantic.working,
      "--success": COZY_THEME.semantic.success,
      "--error": COZY_THEME.semantic.error,
      "--waiting": COZY_THEME.semantic.waiting,
      "--delegation-active": COZY_THEME.semantic.delegationActive,
      "--floor": COZY_THEME.environment.floor,
      "--wood": COZY_THEME.environment.wood,
    });
  });

  it("keeps semantic text and icon colors readable on the shell", () => {
    for (const color of [
      COZY_THEME.semantic.selection,
      COZY_THEME.semantic.working,
      COZY_THEME.semantic.success,
      COZY_THEME.semantic.error,
      COZY_THEME.semantic.waiting,
      COZY_THEME.semantic.idle,
      COZY_THEME.semantic.delegationActive,
    ]) {
      expect(contrastRatio(color, COZY_THEME.ui.canvas)).toBeGreaterThanOrEqual(4.5);
    }
    expect(
      contrastRatio(COZY_THEME.semantic.delegationPending, COZY_THEME.ui.canvas),
    ).toBeGreaterThanOrEqual(3);
  });
});
