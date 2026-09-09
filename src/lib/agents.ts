/**
 * Agent map — 15 agents (10 global subagents + 5 built-ins)
 * See PLAN.md §1 for verified role → character mapping.
 * Export type AgentMeta {id,label,role,description,spriteKey, icon}
 * and getAgentMeta(id) with fallback intern.
 * spriteKey same as id for now; icon is lucide name stub.
 */

export type AgentMeta = {
  id: string;
  label: string;
  role: string;
  description: string;
  spriteKey: string;
  icon: string; // lucide icon name stub
};

const AGENT_MAP: Record<string, AgentMeta> = {
  "ai-systems": {
    id: "ai-systems",
    label: "AI Systems",
    role: "AI Scientist",
    description: "LLM / RAG / evals — lab coat, neural node, pulse green when working",
    spriteKey: "ai-systems",
    icon: "Brain",
  },
  "architect": {
    id: "architect",
    label: "Architect",
    role: "Architect",
    description: "Design / schemas — blueprint roll, T-square, flips blueprint",
    spriteKey: "architect",
    icon: "DraftingCompass",
  },
  "automation-engineer": {
    id: "automation-engineer",
    label: "Automation",
    role: "Technician",
    description: "n8n / Apify / webhooks — wrench, cables, connects plugs",
    spriteKey: "automation-engineer",
    icon: "Wrench",
  },
  "devops": {
    id: "devops",
    label: "DevOps",
    role: "Operator",
    description: "Vercel / env / cron — headset, rack LEDs, taps terminal",
    spriteKey: "devops",
    icon: "Server",
  },
  "documentation": {
    id: "documentation",
    label: "Documentation",
    role: "Scribe",
    description: "READMEs / runbooks — papers, pen, writes scroll",
    spriteKey: "documentation",
    icon: "FileText",
  },
  "project-manager": {
    id: "project-manager",
    label: "Project Manager",
    role: "Manager",
    description: "Planning / sprints — clipboard, tie, checks box",
    spriteKey: "project-manager",
    icon: "ClipboardList",
  },
  "qa-engineer": {
    id: "qa-engineer",
    label: "QA Engineer",
    role: "Inspector",
    description: "Tests / ship gate — magnifier, stamp, stamp flip",
    spriteKey: "qa-engineer",
    icon: "SearchCheck",
  },
  "researcher": {
    id: "researcher",
    label: "Researcher",
    role: "Researcher",
    description: "Eval tools / APIs — books, globe, book flip",
    spriteKey: "researcher",
    icon: "Library",
  },
  "security-reviewer": {
    id: "security-reviewer",
    label: "Security",
    role: "Guard",
    description: "Audit / secrets — shield, lock, shield shimmer",
    spriteKey: "security-reviewer",
    icon: "ShieldCheck",
  },
  "senior-engineer": {
    id: "senior-engineer",
    label: "Senior Engineer",
    role: "Engineer",
    description: "Next.js prod code — laptop, hoodie, typing burst",
    spriteKey: "senior-engineer",
    icon: "Laptop",
  },
  "build": {
    id: "build",
    label: "Build",
    role: "Builder",
    description: "Default builder — hard hat, hammer, hammer desk",
    spriteKey: "build",
    icon: "Hammer",
  },
  "plan": {
    id: "plan",
    label: "Plan",
    role: "Planner",
    description: "Restricted planner — blueprints lite, flips small sheet",
    spriteKey: "plan",
    icon: "Map",
  },
  "general": {
    id: "general",
    label: "General",
    role: "Generalist",
    description: "General-purpose — hoodie, coffee, types + steam",
    spriteKey: "general",
    icon: "Coffee",
  },
  "explore": {
    id: "explore",
    label: "Explore",
    role: "Scout",
    description: "Read-only codebase — binoculars, lens, scans L/R",
    spriteKey: "explore",
    icon: "Binoculars",
  },
  "scout": {
    id: "scout",
    label: "Scout",
    role: "Librarian",
    description: "External docs — book stack, book flip",
    spriteKey: "scout",
    icon: "BookOpen",
  },
  "title": {
    id: "title",
    label: "Title",
    role: "Titler",
    description: "Session title generator — hidden internal role",
    spriteKey: "title",
    icon: "Tag",
  },
  "summary": {
    id: "summary",
    label: "Summary",
    role: "Summarizer",
    description: "Session summarizer — hidden internal role",
    spriteKey: "summary",
    icon: "AlignLeft",
  },
  "compaction": {
    id: "compaction",
    label: "Compaction",
    role: "Compactor",
    description: "Context compaction — hidden internal role",
    spriteKey: "compaction",
    icon: "Minimize2",
  },
  "orchestrator": {
    id: "orchestrator",
    label: "Orchestrator",
    role: "Lead",
    description: "Main agent coordinating tasks — headset, clipboard, directs team",
    spriteKey: "orchestrator",
    icon: "Users",
  },
};

// Fallback intern — also registered for direct lookup
const INTERN_META: AgentMeta = {
  id: "intern",
  label: "Intern",
  role: "Intern",
  description: "Fallback — cap, shrug (unknown / hidden agent)",
  spriteKey: "intern",
  icon: "User",
};

AGENT_MAP["intern"] = INTERN_META;
AGENT_MAP["unknown"] = { ...INTERN_META, id: "unknown", spriteKey: "unknown" };

export const agents = AGENT_MAP;

export function getAgentMeta(id: string): AgentMeta {
  if (!id) return INTERN_META;
  const key = id.trim().toLowerCase();
  return AGENT_MAP[key] ?? AGENT_MAP[id] ?? INTERN_META;
}

export const AGENT_IDS = Object.keys(AGENT_MAP).filter((k) => k !== "unknown");

export default AGENT_MAP;
