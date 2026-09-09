/**
 * Agent desk props — maps agent ID to array of prop PNG paths + positions.
 * Props are rendered as absolutely-positioned <img> inside the cubicle body.
 */

export type PropDef = {
  src: string;
  x: string;
  y: string;
  w: number;
  h: number;
  alt: string;
};

export type AgentPropsConfig = {
  items: PropDef[];
};

const AGENT_PROPS: Record<string, AgentPropsConfig> = {
  "ai-systems": {
    items: [
      { src: "/sprites/props/server-rack.png", x: "8%", y: "30%", w: 24, h: 16, alt: "server rack" },
      { src: "/sprites/props/neural-orb.png", x: "70%", y: "20%", w: 12, h: 12, alt: "neural orb" },
    ],
  },
  architect: {
    items: [
      { src: "/sprites/props/blueprint-scroll.png", x: "10%", y: "25%", w: 16, h: 20, alt: "blueprint scroll" },
      { src: "/sprites/props/t-square.png", x: "75%", y: "35%", w: 20, h: 8, alt: "T-square" },
    ],
  },
  "automation-engineer": {
    items: [
      { src: "/sprites/props/wrench.png", x: "12%", y: "30%", w: 16, h: 16, alt: "wrench" },
      { src: "/sprites/props/cable-coil.png", x: "68%", y: "25%", w: 16, h: 12, alt: "cable coil" },
    ],
  },
  devops: {
    items: [
      { src: "/sprites/props/headset.png", x: "10%", y: "20%", w: 20, h: 16, alt: "headset" },
      { src: "/sprites/props/server-rack.png", x: "72%", y: "28%", w: 16, h: 16, alt: "server rack" },
    ],
  },
  documentation: {
    items: [
      { src: "/sprites/props/paper-stack.png", x: "10%", y: "25%", w: 16, h: 16, alt: "paper stack" },
      { src: "/sprites/props/pen.png", x: "70%", y: "35%", w: 12, h: 12, alt: "pen" },
    ],
  },
  "project-manager": {
    items: [
      { src: "/sprites/props/clipboard.png", x: "10%", y: "22%", w: 16, h: 20, alt: "clipboard" },
      { src: "/sprites/props/coffee-mug.png", x: "72%", y: "30%", w: 12, h: 12, alt: "coffee mug" },
    ],
  },
  "qa-engineer": {
    items: [
      { src: "/sprites/props/magnifier.png", x: "12%", y: "28%", w: 16, h: 16, alt: "magnifier" },
      { src: "/sprites/props/stamp.png", x: "70%", y: "25%", w: 12, h: 16, alt: "stamp" },
    ],
  },
  researcher: {
    items: [
      { src: "/sprites/props/book-stack.png", x: "8%", y: "22%", w: 20, h: 16, alt: "book stack" },
      { src: "/sprites/props/globe.png", x: "72%", y: "28%", w: 14, h: 14, alt: "globe" },
    ],
  },
  "security-reviewer": {
    items: [
      { src: "/sprites/props/padlock.png", x: "12%", y: "25%", w: 12, h: 16, alt: "padlock" },
      { src: "/sprites/props/camera.png", x: "70%", y: "30%", w: 16, h: 12, alt: "camera" },
    ],
  },
  "senior-engineer": {
    items: [
      { src: "/sprites/props/laptop.png", x: "30%", y: "20%", w: 24, h: 16, alt: "laptop" },
    ],
  },
  build: {
    items: [
      { src: "/sprites/props/hard-hat.png", x: "10%", y: "18%", w: 16, h: 14, alt: "hard hat" },
      { src: "/sprites/props/toolbox.png", x: "70%", y: "30%", w: 20, h: 14, alt: "toolbox" },
    ],
  },
  plan: {
    items: [
      { src: "/sprites/props/blueprint-scroll.png", x: "12%", y: "25%", w: 16, h: 20, alt: "blueprint" },
      { src: "/sprites/props/compass.png", x: "72%", y: "30%", w: 14, h: 14, alt: "compass" },
    ],
  },
  general: {
    items: [
      { src: "/sprites/props/coffee-mug.png", x: "12%", y: "30%", w: 12, h: 12, alt: "coffee mug" },
    ],
  },
  explore: {
    items: [
      { src: "/sprites/props/binoculars.png", x: "30%", y: "22%", w: 20, h: 14, alt: "binoculars" },
      { src: "/sprites/props/map.png", x: "70%", y: "35%", w: 16, h: 16, alt: "map" },
    ],
  },
  scout: {
    items: [
      { src: "/sprites/props/book-stack.png", x: "10%", y: "25%", w: 18, h: 14, alt: "book stack" },
      { src: "/sprites/props/map.png", x: "70%", y: "30%", w: 14, h: 14, alt: "map" },
    ],
  },
};

const INTERN_PROPS: AgentPropsConfig = {
  items: [
    { src: "/sprites/props/coffee-mug.png", x: "12%", y: "30%", w: 12, h: 12, alt: "coffee mug" },
  ],
};

/**
 * Get desk props for an agent. Returns empty items if unknown.
 */
export function getAgentProps(agentId: string): AgentPropsConfig {
  if (!agentId) return INTERN_PROPS;
  const key = agentId.trim().toLowerCase();
  return AGENT_PROPS[key] ?? INTERN_PROPS;
}
