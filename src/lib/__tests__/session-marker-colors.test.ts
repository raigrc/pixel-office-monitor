import { describe, expect, it } from "vitest";

import {
  resolveSessionLifecycleMarkerColor,
  resolveSessionOutcomeMarkerColor,
} from "../session-visual-identity";

describe("session marker colors", () => {
  it("keeps bare completion neutral instead of claiming success", () => {
    expect(resolveSessionLifecycleMarkerColor("working")).toBe("var(--working)");
    expect(resolveSessionLifecycleMarkerColor("quiet")).toBe("var(--idle)");
    expect(resolveSessionLifecycleMarkerColor("completed")).toBe("var(--session-accent)");
  });

  it("maps every terminal invocation outcome by meaning", () => {
    expect(resolveSessionOutcomeMarkerColor("succeeded")).toBe("var(--success)");
    expect(resolveSessionOutcomeMarkerColor("failed")).toBe("var(--error)");
    expect(resolveSessionOutcomeMarkerColor("cancelled")).toBe("var(--session-accent)");
    expect(resolveSessionOutcomeMarkerColor("unknown")).toBe("var(--session-accent)");
    expect(resolveSessionOutcomeMarkerColor(null)).toBe("var(--session-accent)");
  });
});
