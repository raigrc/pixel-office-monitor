import { describe, expect, it } from "vitest";

import { COZY_THEME } from "../cozy-theme";
import {
  getSessionVisualIdentity,
  getSessionAccentProperties,
  normalizeSessionIdentity,
  resolveSessionAccent,
  sessionVisualIdentityKey,
  SESSION_VISUAL_IDENTITY_VERSION,
} from "../session-visual-identity";

describe("session visual identity", () => {
  it("uses explicit versioned normalization", () => {
    expect(normalizeSessionIdentity("  Ｐroject A  ")).toBe("project a");
    expect(sessionVisualIdentityKey("  Ｐroject A  ")).toBe(
      `${SESSION_VISUAL_IDENTITY_VERSION}\u0000project a`,
    );
  });

  it("maps normalized equivalents to one deterministic identity", () => {
    const expected = getSessionVisualIdentity("project a");
    expect(getSessionVisualIdentity("  PROJECT A ")).toEqual(expected);
    expect(getSessionVisualIdentity("Ｐroject A")).toEqual(expected);
    expect(resolveSessionAccent("project a")).toBe(expected.accent);
  });

  it("locks v1 hash results", () => {
    expect(getSessionVisualIdentity("")).toEqual({ accent: "#9A835C", paletteIndex: 4 });
    expect(getSessionVisualIdentity("alpha")).toEqual({ accent: "#A86F55", paletteIndex: 0 });
    expect(getSessionVisualIdentity("session-42")).toEqual({ accent: "#8D758E", paletteIndex: 3 });
  });

  it("returns colors only from canonical session palette", () => {
    for (const sessionId of ["", "alpha", "beta", "gamma", "session-42"]) {
      const identity = getSessionVisualIdentity(sessionId);
      expect(identity.paletteIndex).toBeGreaterThanOrEqual(0);
      expect(identity.paletteIndex).toBeLessThan(COZY_THEME.sessionPalette.length);
      expect(identity.accent).toBe(COZY_THEME.sessionPalette[identity.paletteIndex]);
    }
  });

  it("exposes navigator accents through one CSS property seam", () => {
    expect(getSessionAccentProperties("alpha")).toEqual({
      "--session-accent": getSessionVisualIdentity("alpha").accent,
    });
    expect(getSessionAccentProperties("  ALPHA ")).toEqual(
      getSessionAccentProperties("alpha"),
    );
  });
});
