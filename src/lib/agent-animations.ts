import type { SpriteState } from "@/components/Sprite";

export interface AgentAnimationConfig {
  // Custom keyframe overrides per state
  working?: string;
  thinking?: string;
  delegating?: string;
  celebrating?: string;
  // CSS custom properties for agent-specific styling
  accentColor?: string;
  propOffset?: { x: number; y: number };
  // Whether agent has special prop animation
  hasPropAnimation?: boolean;
}

export const AGENT_ANIMATIONS: Record<string, AgentAnimationConfig> = {
  "ai-systems": {
    accentColor: "#22C55E",
    working: "animate-state-working",
    thinking: "animate-state-thinking",
    celebrating: "animate-state-celebrating",
    hasPropAnimation: true,
  },
  architect: {
    accentColor: "#3B82F6",
    working: "animate-state-working",
    thinking: "animate-state-thinking",
    celebrating: "animate-state-celebrating",
    hasPropAnimation: true,
  },
  "automation-engineer": {
    accentColor: "#F59E0B",
    working: "animate-prop-sync", // wrench swing
    delegating: "animate-state-delegating",
    celebrating: "animate-state-celebrating",
    hasPropAnimation: true,
  },
  devops: {
    accentColor: "#8B5CF6",
    working: "animate-state-working",
    thinking: "animate-state-thinking",
    celebrating: "animate-state-celebrating",
    hasPropAnimation: true,
  },
  documentation: {
    accentColor: "#06B6D4",
    working: "animate-state-working", // pen writing
    thinking: "animate-state-thinking",
    celebrating: "animate-state-celebrating",
    hasPropAnimation: true,
  },
  "project-manager": {
    accentColor: "#FBBF24",
    working: "animate-state-working", // clipboard check
    delegating: "animate-state-delegating",
    celebrating: "animate-state-celebrating",
    hasPropAnimation: true,
  },
  "qa-engineer": {
    accentColor: "#EF4444",
    working: "animate-prop-sync", // magnifier inspect
    thinking: "animate-state-thinking",
    celebrating: "animate-state-celebrating",
    hasPropAnimation: true,
  },
  researcher: {
    accentColor: "#14B8A6",
    working: "animate-state-working", // page flip
    thinking: "animate-state-thinking",
    celebrating: "animate-state-celebrating",
    hasPropAnimation: true,
  },
  "security-reviewer": {
    accentColor: "#EC4899",
    working: "animate-state-working", // shield pulse
    thinking: "animate-state-thinking",
    celebrating: "animate-state-celebrating",
    hasPropAnimation: true,
  },
  "senior-engineer": {
    accentColor: "#6366F1",
    working: "animate-prop-sync", // typing hands
    thinking: "animate-state-thinking",
    celebrating: "animate-state-celebrating",
    hasPropAnimation: true,
  },
  build: {
    accentColor: "#F97316",
    working: "animate-prop-sync", // hammer swing
    celebrating: "animate-state-celebrating",
    hasPropAnimation: true,
  },
  plan: {
    accentColor: "#3B82F6",
    working: "animate-state-working",
    thinking: "animate-state-thinking",
    celebrating: "animate-state-celebrating",
  },
  general: {
    accentColor: "#94A3B8",
    working: "animate-prop-sync", // coffee steam
    celebrating: "animate-state-celebrating",
    hasPropAnimation: true,
  },
  explore: {
    accentColor: "#22C55E",
    working: "animate-state-working", // binoculars scan
    thinking: "animate-state-thinking",
    celebrating: "animate-state-celebrating",
    hasPropAnimation: true,
  },
  scout: {
    accentColor: "#8B5CF6",
    working: "animate-state-working", // book flip
    thinking: "animate-state-thinking",
    celebrating: "animate-state-celebrating",
    hasPropAnimation: true,
  },
  orchestrator: {
    accentColor: "#FBBF24",
    working: "animate-state-working",
    thinking: "animate-state-thinking",
    delegating: "animate-state-delegating",
    celebrating: "animate-state-celebrating",
    hasPropAnimation: true,
  },
  intern: {
    accentColor: "#64748B",
    working: "animate-state-working",
    celebrating: "animate-state-celebrating",
  },
  unknown: {
    accentColor: "#64748B",
    working: "animate-state-working",
    celebrating: "animate-state-celebrating",
  },
};

export function getAgentAnimationConfig(agentId: string): AgentAnimationConfig {
  const key = agentId.trim().toLowerCase();
  return AGENT_ANIMATIONS[key] ?? AGENT_ANIMATIONS.unknown;
}

export function getAgentAccentColor(agentId: string): string {
  return getAgentAnimationConfig(agentId).accentColor ?? "#64748B";
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