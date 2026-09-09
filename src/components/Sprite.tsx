"use client";

import { useMemo, memo } from "react";
import { getAgentStateAnimationClass } from "@/lib/agent-animations";

/**
 * Sprite — production pixel art 16×16 matrix → 48px (3px per pixel)
 * ---------------------------------------------------------------
 * - CSS pixel-art rendered via div grid (no external PNG needed).
 * - 18 distinct characters matching agents.ts + intern fallback.
 * - Props: 16×16 color matrix using NES palette keys.
 * - States driven by CSS animations via data-state attribute:
 *   working, idle/sleeping, thinking, delegating, celebrating
 * - Future PNG swap: place `public/sprites/<spriteKey>.png` sheet
 *   144×48 (3×48 frames) and replace grid with <img> + background-position.
 *   Keep spriteKey naming identical so no CubicleCard change needed.
 * - A11y: role=img aria-label="{spriteKey} {state}", pixelated rendering.
 */

export type SpriteState = "working" | "sleeping" | "idle" | "thinking" | "delegating" | "celebrating";
export type SpriteProps = {
  spriteKey: string;
  state: SpriteState;
  size?: number; // default 48 (16×3px)
};

// --- palette char → hex (null = transparent) --------------------
const CHAR_TO_HEX: Record<string, string | null> = {
  ".": null,
  // skin
  S: "#F5D0A9",
  s: "#E8B8A0",
  // eyes / face
  E: "#0F172A", // open eye black
  X: "#64748B", // sleeping X eye (slate)
  C: "#F9A8A8", // cheek
  O: "#0F172A", // outline / mouth dark
  // hair
  K: "#1A1F2E", // black / dark hair
  k: "#4B2E14", // brown
  B: "#FBBF24", // blonde
  G: "#9CA3AF", // gray
  // outfit
  W: "#E5E7EB", // lab coat white
  w: "#CBD5E1", // coat shadow
  p: "#475569", // hoodie slate (dark)
  P: "#1E293B", // pants navy
  // accents
  H: "#F59E0B", // hard hat yellow
  h: "#D97706", // hard hat shadow
  Y: "#FDE68A", // clipboard / paper yellow
  y: "#FACC15", // clipboard clip yellow accent
  R: "#EF4444", // tie red
  L: "#3B82F6", // shield blue / cap blue
  l: "#60A5FA", // blueprint light blue
  D: "#1E3A8A",
  M: "#E2E8F0", // metal / wrench light
  m: "#94A3B8", // metal dark
  Q: "#8B5CF6", // book purple
  q: "#5B21B6", // book dark
  V: "#22C55E", // green bright (node / globe)
  v: "#15803D", // green dark
  N: "#111827", // headset black
  T: "#92400E", // wood / coffee brown
  t: "#78350F",
  U: "#FEF3C7", // paper light
  u: "#FDE68A",
  I: "#7DD3FC", // magnifier glass cyan
  J: "#1D4ED8", // shield dark
  F: "#374151", // laptop gray
  f: "#1F2937",
  A: "#92400E", // coffee same as wood
};

type Matrix = string[][]; // 16×16 char

function createEmpty(): Matrix {
  return Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => "."));
}
function setPixel(m: Matrix, x: number, y: number, ch: string) {
  if (x < 0 || x >= 16 || y < 0 || y >= 16) return;
  m[y][x] = ch;
}
function fillRect(m: Matrix, x: number, y: number, w: number, h: number, ch: string) {
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) setPixel(m, x + dx, y + dy, ch);
}

// per-agent config
type AgentCfg = { hair: string; outfit: string };
const AGENT_CFG: Record<string, AgentCfg> = {
  "ai-systems": { hair: "K", outfit: "W" },
  architect: { hair: "k", outfit: "W" },
  "automation-engineer": { hair: "K", outfit: "p" },
  devops: { hair: "K", outfit: "p" },
  documentation: { hair: "B", outfit: "W" },
  "project-manager": { hair: "K", outfit: "W" },
  "qa-engineer": { hair: "G", outfit: "p" },
  researcher: { hair: "k", outfit: "p" },
  "security-reviewer": { hair: "K", outfit: "p" },
  "senior-engineer": { hair: "K", outfit: "p" },
  build: { hair: "H", outfit: "p" },
  plan: { hair: "k", outfit: "W" },
  general: { hair: "B", outfit: "p" },
  explore: { hair: "K", outfit: "p" },
  scout: { hair: "k", outfit: "p" },
  intern: { hair: "B", outfit: "p" },
  unknown: { hair: "B", outfit: "p" },
  orchestrator: { hair: "K", outfit: "W" },
};

function applyBase(m: Matrix, hair: string, outfit: string, isSleeping: boolean) {
  // head + hair top
  fillRect(m, 5, 1, 6, 1, hair);
  fillRect(m, 4, 2, 8, 1, hair);
  // side hair + forehead
  setPixel(m, 4, 3, hair);
  setPixel(m, 11, 3, hair);
  setPixel(m, 4, 4, hair);
  setPixel(m, 11, 4, hair);
  // face skin block 5..10,3..8
  fillRect(m, 5, 3, 6, 1, "S");
  fillRect(m, 5, 4, 6, 1, "S");
  fillRect(m, 5, 5, 6, 1, "S");
  fillRect(m, 5, 6, 6, 1, "S");
  fillRect(m, 5, 7, 6, 1, "S");
  fillRect(m, 5, 8, 6, 1, "S");
  // eyes
  if (isSleeping) {
    setPixel(m, 6, 5, "X");
    setPixel(m, 9, 5, "X");
    setPixel(m, 7, 6, "O");
    setPixel(m, 8, 6, "O");
  } else {
    setPixel(m, 6, 5, "E");
    setPixel(m, 9, 5, "E");
    setPixel(m, 6, 6, "C");
    setPixel(m, 9, 6, "C");
    setPixel(m, 7, 6, "O");
    setPixel(m, 8, 6, "O");
  }
  // neck
  fillRect(m, 7, 8, 2, 1, "S");
  // torso 4,9 8×3
  fillRect(m, 4, 9, 8, 3, outfit);
  // legs
  fillRect(m, 5, 12, 2, 2, "P");
  fillRect(m, 9, 12, 2, 2, "P");
  // feet
  fillRect(m, 5, 14, 2, 1, "O");
  fillRect(m, 9, 14, 2, 1, "O");
  // ground shadow 1px at bottom
  fillRect(m, 4, 15, 8, 1, "O");
}

function overlayProp(m: Matrix, key: string, frame: number) {
  const f = frame % 2;
  switch (key) {
    case "ai-systems": {
      const c = f === 0 ? "V" : "v";
      fillRect(m, 7, 10, 2, 2, c);
      if (f === 0) setPixel(m, 7, 10, "W");
      break;
    }
    case "architect": {
      const x = f === 0 ? 1 : 2;
      fillRect(m, x, 8, 2, 5, "l");
      setPixel(m, x, 8, "W");
      setPixel(m, x, 12, "w");
      if (f === 1) setPixel(m, x + 1, 10, "W");
      break;
    }
    case "automation-engineer": {
      const yOff = f === 0 ? 0 : -1;
      fillRect(m, 1, 10 + yOff, 3, 1, "M");
      fillRect(m, 3, 9 + yOff, 1, 3, "M");
      setPixel(m, 2, 9 + yOff, "m");
      break;
    }
    case "devops": {
      setPixel(m, 4, 5, "N");
      setPixel(m, 11, 5, "N");
      setPixel(m, 4, 6, "N");
      setPixel(m, 11, 6, "N");
      setPixel(m, 12, 9, "V");
      setPixel(m, 12, 10, f === 0 ? "V" : "v");
      setPixel(m, 12, 11, "V");
      setPixel(m, 5, 7, "m");
      setPixel(m, 6, 7, "m");
      break;
    }
    case "documentation": {
      fillRect(m, 1, 9, 3, 4, "U");
      setPixel(m, 1, 9, "W");
      const py = f === 0 ? 10 : 11;
      setPixel(m, 4, py, "O");
      setPixel(m, 4, py + 1, "O");
      setPixel(m, 3, py, "m");
      break;
    }
    case "project-manager": {
      fillRect(m, 7, 9, 1, 4, "R");
      setPixel(m, 7, 9, "O");
      fillRect(m, 1, 9, 3, 4, "Y");
      setPixel(m, 2, 9, "O");
      if (f === 1) {
        setPixel(m, 2, 11, "V");
        setPixel(m, 2, 10, "V");
      } else {
        setPixel(m, 2, 11, "m");
      }
      break;
    }
    case "orchestrator": {
      setPixel(m, 4, 5, "N");
      setPixel(m, 11, 5, "N");
      setPixel(m, 4, 6, "N");
      setPixel(m, 11, 6, "N");
      fillRect(m, 1, 9, 3, 4, "Y");
      setPixel(m, 2, 9, "O");
      if (f === 1) {
        setPixel(m, 2, 11, "V");
        setPixel(m, 2, 10, "V");
      } else {
        setPixel(m, 2, 11, "m");
      }
      setPixel(m, 5, 7, "m");
      setPixel(m, 6, 7, "m");
      break;
    }
    case "qa-engineer": {
      const x = f === 0 ? 1 : 2;
      fillRect(m, x, 9, 3, 3, "M");
      setPixel(m, x + 1, 10, "I");
      setPixel(m, x + 2, 12, "T");
      setPixel(m, x + 3, 13, "T");
      break;
    }
    case "researcher": {
      fillRect(m, 1, 9, 3, 1, "Q");
      fillRect(m, 1, 10, 3, 1, "q");
      fillRect(m, 1, 11, 3, 1, "Q");
      fillRect(m, 1, 12, 3, 1, "q");
      if (f === 1) {
        setPixel(m, 2, 9, "W");
        setPixel(m, 3, 9, "W");
      }
      setPixel(m, 1, 8, "V");
      break;
    }
    case "security-reviewer": {
      const shieldC = f === 0 ? "L" : "J";
      fillRect(m, 6, 9, 3, 3, shieldC);
      setPixel(m, 7, 12, shieldC);
      setPixel(m, 7, 10, "Y");
      setPixel(m, 7, 11, "O");
      break;
    }
    case "senior-engineer": {
      fillRect(m, 5, 11, 6, 2, "F");
      fillRect(m, 6, 10, 4, 1, "l");
      setPixel(m, 6, 12, "f");
      setPixel(m, 8, 12, "f");
      if (f === 0) {
        setPixel(m, 4, 11, "S");
        setPixel(m, 11, 11, "S");
      } else {
        setPixel(m, 4, 10, "S");
        setPixel(m, 11, 10, "S");
      }
      break;
    }
    case "build": {
      const yHead = f === 0 ? 9 : 8;
      fillRect(m, 2, 10, 1, 3, "T");
      fillRect(m, 1, yHead, 3, 1, "W");
      break;
    }
    case "plan": {
      const x = f === 0 ? 1 : 2;
      fillRect(m, x, 9, 2, 3, "l");
      setPixel(m, x, 9, "W");
      break;
    }
    case "general": {
      fillRect(m, 1, 11, 2, 2, "T");
      setPixel(m, 3, 11, "W");
      if (f === 0) {
        setPixel(m, 2, 9, "W");
        setPixel(m, 1, 8, "W");
      } else {
        setPixel(m, 2, 8, "W");
        setPixel(m, 1, 7, "W");
      }
      break;
    }
    case "explore": {
      fillRect(m, 5, 10, 4, 2, "N");
      if (f === 0) {
        setPixel(m, 6, 11, "I");
        setPixel(m, 8, 11, "I");
      } else {
        setPixel(m, 7, 11, "I");
        setPixel(m, 9, 11, "I");
      }
      break;
    }
    case "scout": {
      fillRect(m, 1, 9, 3, 3, "Q");
      setPixel(m, 1, 10, "W");
      if (f === 1) setPixel(m, 2, 9, "W");
      setPixel(m, 1, 12, "q");
      setPixel(m, 3, 12, "q");
      break;
    }
    case "intern":
    case "unknown": {
      setPixel(m, 6, 10, "w");
      break;
    }
    default: {
      setPixel(m, 7, 10, "m");
      break;
    }
  }
}

function buildMatrix(spriteKey: string, frame: number, isSleeping: boolean): Matrix {
  const key = (spriteKey || "intern").trim().toLowerCase() || "intern";
  const cfg = AGENT_CFG[key] ?? AGENT_CFG["intern"];
  const m = createEmpty();
  applyBase(m, cfg.hair, cfg.outfit, isSleeping);

  // hat overrides for special agents
  if (key === "build") {
    fillRect(m, 5, 0, 6, 1, "H");
    fillRect(m, 4, 1, 8, 1, "H");
    setPixel(m, 4, 2, "h");
    setPixel(m, 11, 2, "h");
    setPixel(m, 5, 2, "H");
    setPixel(m, 6, 2, "H");
    setPixel(m, 7, 2, "H");
    setPixel(m, 8, 2, "H");
    setPixel(m, 9, 2, "H");
    setPixel(m, 10, 2, "H");
    fillRect(m, 3, 2, 10, 1, "h");
  } else if (key === "intern" || key === "unknown") {
    fillRect(m, 5, 1, 6, 1, "L");
    fillRect(m, 4, 2, 8, 1, "L");
    setPixel(m, 3, 2, "L");
    setPixel(m, 12, 2, "L");
    setPixel(m, 5, 0, "L");
    setPixel(m, 6, 0, "L");
    setPixel(m, 7, 0, "L");
    setPixel(m, 8, 0, "L");
  } else if (key === "security-reviewer") {
    setPixel(m, 5, 2, "m");
    setPixel(m, 10, 2, "m");
  }

  overlayProp(m, key, isSleeping ? 0 : frame);
  return m;
}

// Map backend state to CSS animation class (agent-specific)
function getAnimationClass(spriteKey: string, state: SpriteState): string {
  return getAgentStateAnimationClass(spriteKey, state);
}

// Map backend state to isSleeping for eye rendering
function getIsSleeping(state: SpriteState): boolean {
  return state === "sleeping" || state === "idle";
}

export default memo(function Sprite({ spriteKey, state, size = 48 }: SpriteProps) {
  const isSleeping = getIsSleeping(state);
  const animationClass = getAnimationClass(spriteKey, state);
  const key = (spriteKey || "intern").trim().toLowerCase() || "intern";

  // Frame 0 for non-working states, frame alternates for working via CSS
  // For CSS-driven animation, we use frame 0 for static, frame 1 for alt
  // The working animation is now handled by CSS transform on the wrapper
  const matrix = useMemo(() => buildMatrix(key, 0, isSleeping), [key, isSleeping]);

  const label = `${key} ${state}`;

  return (
    <div
      role="img"
      aria-label={label}
      data-state={state}
      className={`pixelated relative inline-block shrink-0 select-none ${animationClass}`}
      style={{
        width: size,
        height: size,
        imageRendering: "pixelated" as const,
        transformOrigin: "center bottom",
      }}
      title={label}
    >
      {/* pixel grid 16×16 */}
      <div
        aria-hidden="true"
        className="pixelated grid h-full w-full"
        style={{
          gridTemplateColumns: "repeat(16, 1fr)",
          gridTemplateRows: "repeat(16, 1fr)",
          width: size,
          height: size,
          imageRendering: "pixelated",
        }}
      >
        {matrix.map((row, y) =>
          row.map((ch, x) => {
            const hex = CHAR_TO_HEX[ch];
            if (!hex) return <div key={`${x}-${y}`} style={{ width: "100%", height: "100%" }} />;
            return (
              <div
                key={`${x}-${y}`}
                style={{
                  backgroundColor: hex,
                  width: "100%",
                  height: "100%",
                }}
              />
            );
          })
        )}
      </div>

      {/* Zzz overlay for sleeping/idle */}
      {isSleeping && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-2 -top-2 flex items-start gap-[1px]"
          style={{ lineHeight: 1 }}
        >
          <span
            className="animate-floatZ"
            style={{
              fontFamily: "var(--font-vt), VT323, monospace",
              color: "#94A3B8",
              fontSize: 14,
              animationDelay: "0s",
              display: "inline-block",
            }}
          >
            Z
          </span>
          <span
            className="animate-floatZ"
            style={{
              fontFamily: "var(--font-vt), VT323, monospace",
              color: "#94A3B8",
              fontSize: 12,
              animationDelay: "0.4s",
              display: "inline-block",
            }}
          >
            Z
          </span>
          <span
            className="animate-floatZ"
            style={{
              fontFamily: "var(--font-vt), VT323, monospace",
              color: "#94A3B8",
              fontSize: 10,
              animationDelay: "0.8s",
              display: "inline-block",
            }}
          >
            Z
          </span>
        </div>
      )}
    </div>
  );
});