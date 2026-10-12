"use client";

import { useEffect, useId, useRef } from "react";
import type { MultiSessionFloor } from "@/lib/multi-session/multi-session-model";
import {
  getSessionAccentProperties,
  resolveSessionOutcomeMarkerColor,
} from "@/lib/session-visual-identity";

export interface MultiSessionCompareProps {
  left: MultiSessionFloor;
  right: MultiSessionFloor;
  onClose: () => void;
  onOpenFloor?: (id: string) => void;
}

function formatTimestamp(timestamp: number | null): string {
  if (timestamp === null) return "Not completed";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(timestamp) + " UTC";
}

function Summary({ floor, onOpenFloor }: { floor: MultiSessionFloor; onOpenFloor?: (id: string) => void }) {
  return (
    <article className="relative min-w-0 flex-1 overflow-hidden rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-4 pt-5" style={getSessionAccentProperties(floor.floorId)}>
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-[var(--session-accent)]" />
      <div className="mb-4 flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: resolveSessionOutcomeMarkerColor(floor.latestOutcome?.outcome ?? null) }}
        />
        <div className="min-w-0">
          <h2 className="truncate text-xl text-[var(--text)]" style={{ fontFamily: "var(--font-vt), VT323, monospace" }}>{floor.title}</h2>
          <p className="truncate text-xs text-[var(--muted)]">{floor.projectId}</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-4 text-sm">
        <div><dt className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Lifecycle</dt><dd className="mt-1 capitalize text-[var(--text)]">{floor.lifecycle}</dd></div>
        <div><dt className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Active tasks</dt><dd className="mt-1 text-[var(--text)]">{floor.activeInvocationCount}</dd></div>
        <div className="col-span-2"><dt className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Active actors ({floor.activeActors.length})</dt><dd className="mt-1 text-[var(--text)]">{floor.activeActors.length ? floor.activeActors.map((actor) => `${actor.displayName} (${actor.activeWorkCount})`).join(", ") : "None"}</dd></div>
        <div className="col-span-2"><dt className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Categories</dt><dd className="mt-1 text-[var(--text)]">{floor.taskCategories.length ? floor.taskCategories.join(", ") : "None"}</dd></div>
        <div className="col-span-2"><dt className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Latest outcome</dt><dd className="mt-1 capitalize text-[var(--text)]">{floor.latestOutcome?.outcome ?? "No outcome"}</dd></div>
        <div className="col-span-2"><dt className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Last activity</dt><dd className="mt-1 text-[var(--text)]"><time dateTime={new Date(floor.lastActivityAt).toISOString()}>{formatTimestamp(floor.lastActivityAt)}</time></dd></div>
        <div className="col-span-2"><dt className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Completion</dt><dd className="mt-1 text-[var(--text)]">{floor.closedAt === null ? "Not completed" : <time dateTime={new Date(floor.closedAt).toISOString()}>{formatTimestamp(floor.closedAt)}</time>}</dd></div>
      </dl>

      {onOpenFloor && floor.lifecycle !== "completed" && <button type="button" onClick={() => onOpenFloor(floor.floorId)} className="mt-5 min-h-11 w-full cursor-pointer rounded-[4px] border border-[var(--selection)] bg-[var(--raised)] px-4 text-xs font-bold uppercase tracking-wider text-[var(--selection)] hover:bg-[var(--elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--selection)]">Open floor</button>}
    </article>
  );
}

export default function MultiSessionCompare({ left, right, onClose, onOpenFloor }: MultiSessionCompareProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (document.activeElement instanceof HTMLElement) openerRef.current = document.activeElement;
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      requestAnimationFrame(() => openerRef.current?.focus());
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-[color-mix(in_srgb,var(--canvas)_82%,transparent)] p-0 sm:items-center sm:justify-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby={titleId} className="flex max-h-[92dvh] w-full max-w-4xl flex-col rounded-t-[8px] border-2 border-[var(--strong-border)] bg-[var(--canvas)] shadow-[6px_6px_0_var(--surface)] sm:rounded-[6px]">
        <header className="flex min-h-14 items-center border-b border-[var(--border)] px-4">
          <div><h1 id={titleId} className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--text)]">Session comparison</h1><p className="mt-0.5 text-xs text-[var(--muted)]">Summary view</p></div>
          <button ref={closeRef} type="button" onClick={onClose} className="ml-auto flex h-11 w-11 cursor-pointer items-center justify-center rounded-[4px] text-[var(--muted)] hover:bg-[var(--raised)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--selection)]" aria-label="Close session comparison">
            <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </header>
        <div className="grid min-h-0 gap-3 overflow-y-auto p-3 md:grid-cols-2 md:p-4">
          <Summary floor={left} onOpenFloor={onOpenFloor} />
          <Summary floor={right} onOpenFloor={onOpenFloor} />
        </div>
      </section>
    </div>
  );
}
