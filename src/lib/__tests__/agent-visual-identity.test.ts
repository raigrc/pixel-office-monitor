import { describe, expect, it } from "vitest";

import { AGENT_VISUAL_IDENTITIES, getAgentVisualIdentity, resolveAgentAccent } from "../agent-visual-identity";
import { agents } from "../agents";

describe("agent visual identity", () => {
  it("defines identity for every supported registry role", () => {
    for (const agentKey of Object.keys(agents)) {
      expect(AGENT_VISUAL_IDENTITIES).toHaveProperty(agentKey);
    }
  });

  it("resolves unknown roles deterministically", () => {
    expect(getAgentVisualIdentity("future-agent")).toEqual(getAgentVisualIdentity("future-agent"));
    expect(getAgentVisualIdentity("future-agent")).not.toBe(getAgentVisualIdentity("other-agent"));
  });

  it("lets semantic state override role accent", () => {
    expect(resolveAgentAccent("architect", "#22C55E")).toBe("#22C55E");
    expect(resolveAgentAccent("architect")).toBe(AGENT_VISUAL_IDENTITIES.architect.accent);
  });
});
