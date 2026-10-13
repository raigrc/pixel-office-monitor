import type { CSSProperties } from "react";

import { COZY_THEME, type CozyHexColor } from "./cozy-theme";
import type { SessionLifecycle, SessionOutcome } from "./multi-session/multi-session-model";

export const SESSION_VISUAL_IDENTITY_VERSION = "cozy-session-visual-identity:v1";

export interface SessionVisualIdentity {
  readonly accent: CozyHexColor;
  readonly paletteIndex: number;
}

export interface SessionAccentProperties extends CSSProperties {
  readonly "--session-accent": CozyHexColor;
}

export type SessionMarkerColor =
  | "var(--working)"
  | "var(--idle)"
  | "var(--session-accent)"
  | "var(--success)"
  | "var(--error)";

export function normalizeSessionIdentity(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-US");
}

export function sessionVisualIdentityKey(value: string): string {
  const normalized = normalizeSessionIdentity(value);
  return `${SESSION_VISUAL_IDENTITY_VERSION}\u0000${normalized || "blank"}`;
}

function stableHash32(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function getSessionVisualIdentity(value: string): SessionVisualIdentity {
  const paletteIndex = stableHash32(sessionVisualIdentityKey(value)) % COZY_THEME.sessionPalette.length;
  return {
    accent: COZY_THEME.sessionPalette[paletteIndex],
    paletteIndex,
  };
}

export function resolveSessionAccent(value: string): CozyHexColor {
  return getSessionVisualIdentity(value).accent;
}

export function getSessionAccentProperties(value: string): SessionAccentProperties {
  return { "--session-accent": resolveSessionAccent(value) };
}

export function resolveSessionLifecycleMarkerColor(lifecycle: SessionLifecycle): SessionMarkerColor {
  switch (lifecycle) {
    case "working":
      return "var(--working)";
    case "quiet":
      return "var(--idle)";
    case "completed":
      return "var(--session-accent)";
  }
}

export function resolveSessionOutcomeMarkerColor(
  outcome: SessionOutcome["outcome"] | null,
): SessionMarkerColor {
  switch (outcome) {
    case "succeeded":
      return "var(--success)";
    case "failed":
      return "var(--error)";
    case "cancelled":
    case "unknown":
    case null:
      return "var(--session-accent)";
  }
}
