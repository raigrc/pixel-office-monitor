"use client";

import { useEffect, useId, useRef } from "react";
import type { MultiSessionFloor } from "@/lib/multi-session/multi-session-model";

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
    <article className="min-w-0 flex-1 rounded-[6px] border border-[#334155] bg-[#111C30] p-4">
      <div className="mb-4 flex items-start gap-3">
        <span aria-hidden="true" className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${floor.lifecycle === "working" ? "bg-[#22C55E]" : floor.lifecycle === "quiet" ? "bg-[#64748B]" : "bg-[#3B82F6]"}`} />
        <div className="min-w-0">
          <h2 className="truncate text-xl text-[#F1F5F9]" style={{ fontFamily: "var(--font-vt), VT323, monospace" }}>{floor.title}</h2>
          <p className="truncate text-xs text-[#94A3B8]">{floor.projectId}</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-4 text-sm">
        <div><dt className="text-[10px] uppercase tracking-wider text-[#64748B]">Lifecycle</dt><dd className="mt-1 capitalize text-[#E2E8F0]">{floor.lifecycle}</dd></div>
        <div><dt className="text-[10px] uppercase tracking-wider text-[#64748B]">Active tasks</dt><dd className="mt-1 text-[#E2E8F0]">{floor.activeInvocationCount}</dd></div>
        <div className="col-span-2"><dt className="text-[10px] uppercase tracking-wider text-[#64748B]">Active actors ({floor.activeActors.length})</dt><dd className="mt-1 text-[#E2E8F0]">{floor.activeActors.length ? floor.activeActors.map((actor) => `${actor.displayName} (${actor.activeWorkCount})`).join(", ") : "None"}</dd></div>
        <div className="col-span-2"><dt className="text-[10px] uppercase tracking-wider text-[#64748B]">Categories</dt><dd className="mt-1 text-[#E2E8F0]">{floor.taskCategories.length ? floor.taskCategories.join(", ") : "None"}</dd></div>
        <div className="col-span-2"><dt className="text-[10px] uppercase tracking-wider text-[#64748B]">Latest outcome</dt><dd className="mt-1 capitalize text-[#E2E8F0]">{floor.latestOutcome?.outcome ?? "No outcome"}</dd></div>
        <div className="col-span-2"><dt className="text-[10px] uppercase tracking-wider text-[#64748B]">Last activity</dt><dd className="mt-1 text-[#E2E8F0]"><time dateTime={new Date(floor.lastActivityAt).toISOString()}>{formatTimestamp(floor.lastActivityAt)}</time></dd></div>
        <div className="col-span-2"><dt className="text-[10px] uppercase tracking-wider text-[#64748B]">Completion</dt><dd className="mt-1 text-[#E2E8F0]">{floor.closedAt === null ? "Not completed" : <time dateTime={new Date(floor.closedAt).toISOString()}>{formatTimestamp(floor.closedAt)}</time>}</dd></div>
      </dl>

      {onOpenFloor && floor.lifecycle !== "completed" && <button type="button" onClick={() => onOpenFloor(floor.floorId)} className="mt-5 min-h-11 w-full cursor-pointer rounded-[4px] border border-[#3B82F6] bg-[#3B82F6]/10 px-4 text-xs font-bold uppercase tracking-wider text-[#60A5FA] hover:bg-[#3B82F6]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA]">Open floor</button>}
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
    <div className="fixed inset-0 z-50 flex items-end bg-[#020617]/80 p-0 sm:items-center sm:justify-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby={titleId} className="flex max-h-[92dvh] w-full max-w-4xl flex-col rounded-t-[10px] border-2 border-[#334155] bg-[#0F172A] shadow-2xl sm:rounded-[8px]">
        <header className="flex min-h-14 items-center border-b border-[#334155] px-4">
          <div><h1 id={titleId} className="text-sm font-bold uppercase tracking-[0.16em] text-[#F1F5F9]">Session comparison</h1><p className="mt-0.5 text-xs text-[#94A3B8]">Summary view</p></div>
          <button ref={closeRef} type="button" onClick={onClose} className="ml-auto flex h-11 w-11 cursor-pointer items-center justify-center rounded-[4px] text-[#94A3B8] hover:bg-[#1E293B] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]" aria-label="Close session comparison">
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
