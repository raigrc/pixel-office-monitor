export type AgentAccessoryFamily = "sensor" | "document" | "tool" | "comms" | "shield" | "device";
export const AGENT_ACCESSORY_FAMILIES: AgentAccessoryFamily[] = ["sensor", "document", "tool", "comms", "shield", "device"];
export type AgentDeskPropSet =
  | "ai-systems"
  | "architect"
  | "automation-engineer"
  | "devops"
  | "documentation"
  | "project-manager"
  | "qa-engineer"
  | "researcher"
  | "security-reviewer"
  | "senior-engineer"
  | "build"
  | "plan"
  | "general"
  | "explore"
  | "scout";

export interface AgentVisualIdentity {
  accent: string;
  detail: string;
  accessory: AgentAccessoryFamily;
  deskPropSet: AgentDeskPropSet;
}

export const AGENT_VISUAL_IDENTITIES = {
  "ai-systems": { accent: "#5FAE9A", detail: "#B8E0D5", accessory: "sensor", deskPropSet: "ai-systems" },
  architect: { accent: "#648FCB", detail: "#B8CEE8", accessory: "document", deskPropSet: "architect" },
  "automation-engineer": { accent: "#B48655", detail: "#DFC29D", accessory: "tool", deskPropSet: "automation-engineer" },
  devops: { accent: "#777BA8", detail: "#BEC0DB", accessory: "comms", deskPropSet: "devops" },
  documentation: { accent: "#9C806D", detail: "#D9C4B5", accessory: "document", deskPropSet: "documentation" },
  "project-manager": { accent: "#A58C58", detail: "#D9C894", accessory: "comms", deskPropSet: "project-manager" },
  "qa-engineer": { accent: "#A66F76", detail: "#D7ADB2", accessory: "sensor", deskPropSet: "qa-engineer" },
  researcher: { accent: "#5F8F8A", detail: "#A9CFCA", accessory: "sensor", deskPropSet: "researcher" },
  "security-reviewer": { accent: "#747E93", detail: "#B5BED0", accessory: "shield", deskPropSet: "security-reviewer" },
  "senior-engineer": { accent: "#6E7FAE", detail: "#B4BFDD", accessory: "device", deskPropSet: "senior-engineer" },
  explore: { accent: "#6E9470", detail: "#B5D1B4", accessory: "sensor", deskPropSet: "explore" },
  build: { accent: "#A97855", detail: "#D6B79E", accessory: "tool", deskPropSet: "build" },
  plan: { accent: "#718BAD", detail: "#B9C9DD", accessory: "document", deskPropSet: "plan" },
  general: { accent: "#7D8794", detail: "#C0C6CE", accessory: "device", deskPropSet: "general" },
  scout: { accent: "#7C759D", detail: "#C1BCD4", accessory: "document", deskPropSet: "scout" },
  title: { accent: "#7B8490", detail: "#C1C6CD", accessory: "document", deskPropSet: "general" },
  summary: { accent: "#778798", detail: "#BAC5D0", accessory: "document", deskPropSet: "documentation" },
  compaction: { accent: "#817B91", detail: "#C4BFCE", accessory: "device", deskPropSet: "general" },
  orchestrator: { accent: "#B6944E", detail: "#E0CB8D", accessory: "comms", deskPropSet: "project-manager" },
  intern: { accent: "#7D8794", detail: "#C0C6CE", accessory: "device", deskPropSet: "general" },
  unknown: { accent: "#737C88", detail: "#B8BEC6", accessory: "device", deskPropSet: "general" },
} satisfies Record<string, AgentVisualIdentity>;

const AGENT_VISUAL_IDENTITY_BY_KEY: Readonly<Record<string, AgentVisualIdentity>> = AGENT_VISUAL_IDENTITIES;

const FALLBACK_ACCENTS = ["#718096", "#778B89", "#817A95", "#8C7C6B"] as const;
const FALLBACK_DETAILS = ["#CBD5E1", "#C1D1CE", "#CEC8DB", "#D3C7BA"] as const;
const FALLBACK_ACCESSORIES: AgentAccessoryFamily[] = ["device", "sensor", "document", "tool"];

function normalizeAgentKey(agentKey: string): string {
  return agentKey.trim().toLowerCase();
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getAgentVisualIdentity(agentKey: string): AgentVisualIdentity {
  const key = normalizeAgentKey(agentKey);
  const known = AGENT_VISUAL_IDENTITY_BY_KEY[key];
  if (known) return known;
  const hash = stableHash(key || "unknown");
  const paletteIndex = hash % FALLBACK_ACCENTS.length;
  return {
    accent: FALLBACK_ACCENTS[paletteIndex],
    detail: FALLBACK_DETAILS[paletteIndex],
    accessory: FALLBACK_ACCESSORIES[hash % FALLBACK_ACCESSORIES.length],
    deskPropSet: "general",
  };
}

export function resolveAgentAccent(agentKey: string, semanticAccent?: string): string {
  return semanticAccent ?? getAgentVisualIdentity(agentKey).accent;
}
