/**
 * Formatting helpers for Pixel Office Monitor
 */

/**
 * Format elapsed since ts (ms timestamp) as "12s" | "3m" | "2h"
 * ts is absolute millis (Date.now() style). Returns "0s" for future or invalid.
 */
export function formatSince(ts: number): string {
  if (!Number.isFinite(ts) || ts <= 0) return "0s";
  const now = Date.now();
  let diffMs = now - ts;
  if (diffMs < 0) diffMs = 0;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const days = Math.floor(hr / 24);
  return `${days}d`;
}

/**
 * Format project name for display.
 * - Takes basename (after last / or \\)
 * - Trims whitespace
 * - Truncates to 24 chars with ellipsis if needed
 * - Falls back to "unknown" for empty
 */
export function formatProject(project: string | undefined | null): string {
  if (!project || typeof project !== "string") return "unknown";
  const trimmed = project.trim();
  if (!trimmed) return "unknown";
  // basename
  const base = trimmed.split(/[\\/]/).pop() ?? trimmed;
  const cleaned = base.trim() || trimmed;
  if (cleaned.length <= 24) return cleaned;
  return cleaned.slice(0, 23) + "…";
}

/**
 * Format session title with project fallback
 */
export function formatTitle(title: string | undefined | null, project?: string): string {
  if (title && title.trim()) {
    const t = title.trim().slice(0, 80);
    return t;
  }
  return formatProject(project ?? undefined);
}
