import type { SpriteState } from "@/components/Sprite";
import { getAgentVisualIdentity } from "@/lib/agent-visual-identity";

export interface AgentAnimationConfig {
  // Custom keyframe overrides per state
  working?: string;
  thinking?: string;
  delegating?: string;
  celebrating?: string;
  // CSS custom properties for agent-specific styling
  propOffset?: { x: number; y: number };
  // Whether agent has special prop animation
  hasPropAnimation?: boolean;
}

export const AGENT_ANIMATIONS: Record<string, AgentAnimationConfig> = {
  "ai-systems": {
    working: "animate-state-working",
    thinking: "animate-state-thinking",
    celebrating: "animate-state-celebrating",
    hasPropAnimation: true,
  },
  architect: {
    working: "animate-state-working",
    thinking: "animate-state-thinking",
    celebrating: "animate-state-celebrating",
    hasPropAnimation: true,
  },
  "automation-engineer": {
    working: "animate-prop-sync", // wrench swing
    delegating: "animate-state-delegating",
    celebrating: "animate-state-celebrating",
    hasPropAnimation: true,
  },
  devops: {
    working: "animate-state-working",
    thinking: "animate-state-thinking",
    celebrating: "animate-state-celebrating",
    hasPropAnimation: true,
  },
  documentation: {
    working: "animate-state-working", // pen writing
    thinking: "animate-state-thinking",
    celebrating: "animate-state-celebrating",
    hasPropAnimation: true,
  },
  "project-manager": {
    working: "animate-state-working", // clipboard check
    delegating: "animate-state-delegating",
    celebrating: "animate-state-celebrating",
    hasPropAnimation: true,
  },
  "qa-engineer": {
    working: "animate-prop-sync", // magnifier inspect
    thinking: "animate-state-thinking",
    celebrating: "animate-state-celebrating",
    hasPropAnimation: true,
  },
  researcher: {
    working: "animate-state-working", // page flip
    thinking: "animate-state-thinking",
    celebrating: "animate-state-celebrating",
    hasPropAnimation: true,
  },
  "security-reviewer": {
    working: "animate-state-working", // shield pulse
    thinking: "animate-state-thinking",
    celebrating: "animate-state-celebrating",
    hasPropAnimation: true,
  },
  "senior-engineer": {
    working: "animate-prop-sync", // typing hands
    thinking: "animate-state-thinking",
    celebrating: "animate-state-celebrating",
    hasPropAnimation: true,
  },
  build: {
    working: "animate-prop-sync", // hammer swing
    celebrating: "animate-state-celebrating",
    hasPropAnimation: true,
  },
  plan: {
    working: "animate-state-working",
    thinking: "animate-state-thinking",
    celebrating: "animate-state-celebrating",
  },
  general: {
    working: "animate-prop-sync", // coffee steam
    celebrating: "animate-state-celebrating",
    hasPropAnimation: true,
  },
  explore: {
    working: "animate-state-working", // binoculars scan
    thinking: "animate-state-thinking",
    celebrating: "animate-state-celebrating",
    hasPropAnimation: true,
  },
  scout: {
    working: "animate-state-working", // book flip
    thinking: "animate-state-thinking",
    celebrating: "animate-state-celebrating",
    hasPropAnimation: true,
  },
  orchestrator: {
    working: "animate-state-working",
    thinking: "animate-state-thinking",
    delegating: "animate-state-delegating",
    celebrating: "animate-state-celebrating",
    hasPropAnimation: true,
  },
  intern: {
    working: "animate-state-working",
    celebrating: "animate-state-celebrating",
  },
  unknown: {
    working: "animate-state-working",
    celebrating: "animate-state-celebrating",
  },
};

export function getAgentAnimationConfig(agentId: string): AgentAnimationConfig {
  const key = agentId.trim().toLowerCase();
  return AGENT_ANIMATIONS[key] ?? AGENT_ANIMATIONS.unknown;
}

export function getAgentAccentColor(agentId: string): string {
  return getAgentVisualIdentity(agentId).accent;
}

export function getAgentStateAnimationClass(agentId: string, state: SpriteState): string {
  const config = getAgentAnimationConfig(agentId);
  switch (state) {
    case "working":
      return config.working ?? "animate-state-working";
    case "thinking":
      return config.thinking ?? "animate-state-thinking";
    case "delegating":
      return config.delegating ?? "animate-state-delegating";
    case "celebrating":
      return config.celebrating ?? "animate-state-celebrating";
    default:
      return "";
  }
}
