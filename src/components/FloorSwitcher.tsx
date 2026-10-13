"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { FloorDTO } from "@/lib/monitor-store";
import type {
  MultiSessionFloor,
  MultiSessionModel,
} from "@/lib/multi-session/multi-session-model";
import {
  getSessionAccentProperties,
  resolveSessionLifecycleMarkerColor,
} from "@/lib/session-visual-identity";

type SseStatus = "connecting" | "live" | "reconnecting" | "offline";

export interface FloorSwitcherProps {
  model: MultiSessionModel;
  floorDetails: FloorDTO[];
  activeId: string | null;
  onSelect: (id: string) => void;
  pinnedFloors: Set<string>;
  onPin: (id: string) => void;
  onClose: (id: string) => void;
  onRename?: (id: string, title: string) => Promise<void>;
  onCompare: (id: string) => void;
  comparisonIds: readonly string[];
  unreadByFloorId: ReadonlyMap<string, number>;
  sseStatus?: SseStatus;
  isBottomSheetOpen?: boolean;
  onBottomSheetChange?: (open: boolean) => void;
  followActivity?: boolean;
  onFollowActivityChange?: (enabled: boolean) => void;
  desktopOpen?: boolean;
  onDesktopClose?: () => void;
}

type NavigatorContentProps = Omit<FloorSwitcherProps, "isBottomSheetOpen" | "onBottomSheetChange" | "desktopOpen" | "onDesktopClose"> & {
  idPrefix: string;
  mobile: boolean;
  onDismiss?: () => void;
};

const GROUPS: ReadonlyArray<{ key: keyof MultiSessionModel; label: string }> = [
  { key: "working", label: "Working" },
  { key: "quiet", label: "Quiet" },
  { key: "completed", label: "Recently completed" },
];

function SearchIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg aria-hidden="true" className={`h-4 w-4 ${filled ? "fill-current" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 17v5M5 14h14M7 14V9l-2-2V5h14v2l-2 2v5" />
    </svg>
  );
}

function CompareIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3M12 2v20" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20ZM14 7l3 3" />
    </svg>
  );
}

function floorAccessibleName(
  floor: MultiSessionFloor,
  active: boolean,
  compared: boolean,
  unread: number,
): string {
  const parts = [
    floor.title,
    `project ${floor.projectId}`,
    `${floor.lifecycle} lifecycle`,
    `${floor.activeInvocationCount} active ${floor.activeInvocationCount === 1 ? "task" : "tasks"}`,
    `${floor.activeActors.length} active ${floor.activeActors.length === 1 ? "actor" : "actors"}`,
    `${unread} unread`,
    active ? "selected" : "not selected",
    compared ? "compared" : "not compared",
  ];
  if (floor.lifecycle === "completed") parts.push("opens comparison details");
  return parts.join(", ");
}

function NavigatorContent({
  model,
  floorDetails,
  activeId,
  onSelect,
  pinnedFloors,
  onPin,
  onClose,
  onRename,
  onCompare,
  comparisonIds,
  unreadByFloorId,
  sseStatus = "connecting",
  followActivity = false,
  onFollowActivityChange,
  idPrefix,
  mobile,
  onDismiss,
}: NavigatorContentProps) {
  const [query, setQuery] = useState("");
  const [completedOpen, setCompletedOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const comparisonSet = useMemo(() => new Set(comparisonIds), [comparisonIds]);
  const detailsByFloorId = useMemo(
    () => new Map(floorDetails.map((floor) => [floor.sessionID, floor])),
    [floorDetails],
  );
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = useMemo(() => {
    const match = (floor: MultiSessionFloor) =>
      normalizedQuery.length === 0 ||
      floor.title.toLocaleLowerCase().includes(normalizedQuery) ||
      floor.projectId.toLocaleLowerCase().includes(normalizedQuery) ||
      floor.floorId.toLocaleLowerCase().includes(normalizedQuery);
    return {
      working: model.working.filter(match),
      quiet: model.quiet.filter(match),
      completed: model.completed.filter(match),
    } satisfies MultiSessionModel;
  }, [model, normalizedQuery]);
  const visibleFloors = useMemo(
    () => [...filtered.working, ...filtered.quiet, ...(completedOpen ? filtered.completed : [])],
    [completedOpen, filtered],
  );

  useEffect(() => {
    if (mobile) searchRef.current?.focus();
  }, [mobile]);

  const focusAt = useCallback((index: number) => {
    const floor = visibleFloors[index];
    if (floor) rowRefs.current.get(floor.floorId)?.focus();
  }, [visibleFloors]);

  const handleListKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End", "Enter"].includes(event.key)) return;
    const targetButton = event.target instanceof HTMLButtonElement ? event.target : null;
    const currentIndex = targetButton
      ? visibleFloors.findIndex((floor) => rowRefs.current.get(floor.floorId) === targetButton)
      : -1;

    if (event.key === "Enter" && currentIndex >= 0) {
      event.preventDefault();
      targetButton?.click();
      return;
    }
    if (visibleFloors.length === 0) return;
    event.preventDefault();
    if (event.key === "Home") focusAt(0);
    else if (event.key === "End") focusAt(visibleFloors.length - 1);
    else if (event.key === "ArrowDown") focusAt(Math.min(currentIndex + 1, visibleFloors.length - 1));
    else if (event.key === "ArrowUp") focusAt(currentIndex < 0 ? visibleFloors.length - 1 : Math.max(0, currentIndex - 1));
  }, [focusAt, visibleFloors]);

  const handleMainAction = (floor: MultiSessionFloor) => {
    if (floor.lifecycle === "completed") {
      onCompare(floor.floorId);
      return;
    }
    onSelect(floor.floorId);
    if (mobile) onDismiss?.();
  };

  const renameFloor = async (floor: MultiSessionFloor) => {
    if (!onRename) return;
    const value = window.prompt("Rename session", floor.title)?.trim().slice(0, 50);
    if (value && value !== floor.title) await onRename(floor.floorId, value);
  };

  const hasResults = filtered.working.length + filtered.quiet.length + filtered.completed.length > 0;
  const listId = `${idPrefix}-session-list`;

  return (
    <div className="flex min-h-0 flex-1 flex-col" onKeyDown={handleListKeyDown}>
      <div className="border-b border-[var(--border)] p-3">
        <div className="relative">
          <label className="sr-only" htmlFor={`${idPrefix}-search`}>Search sessions</label>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--dim)]"><SearchIcon /></span>
          <input
            ref={searchRef}
            id={`${idPrefix}-search`}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, project, or ID"
            aria-controls={listId}
            className="h-11 w-full rounded-[4px] border border-[var(--border)] bg-[var(--canvas)] pl-9 pr-3 text-sm text-[var(--text)] outline-none placeholder:text-[var(--dim)] focus:border-[var(--selection)] focus:ring-2 focus:ring-[var(--selection)]"
          />
        </div>
      </div>

      <div id={listId} className="min-h-0 flex-1 overflow-y-auto p-2" aria-label="Grouped sessions">
        {!hasResults && (
          <p className="px-3 py-10 text-center text-sm text-[var(--muted)]">No sessions match search.</p>
        )}
        {GROUPS.map(({ key, label }) => {
          const floors = filtered[key];
          const isCompleted = key === "completed";
          const expanded = !isCompleted || completedOpen || normalizedQuery.length > 0;
          const groupId = `${idPrefix}-${key}-group`;
          return (
            <section key={key} className="mb-2" aria-labelledby={`${groupId}-label`}>
              {isCompleted ? (
                <button
                  type="button"
                  onClick={() => setCompletedOpen((open) => !open)}
                  className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-[4px] px-2 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)] hover:bg-[var(--raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--selection)]"
                  aria-expanded={expanded}
                  aria-controls={groupId}
                >
                  <svg aria-hidden="true" className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="m4 2 4 4-4 4" /></svg>
                  <span id={`${groupId}-label`}>{label}</span>
                  <span className="ml-auto rounded-[3px] bg-[var(--raised)] px-2 py-0.5 text-[var(--text)]">{model[key].length}</span>
                </button>
              ) : (
                <h2 id={`${groupId}-label`} className="flex min-h-11 items-center px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                  {label}
                  <span className="ml-auto rounded-[3px] bg-[var(--raised)] px-2 py-0.5 text-[var(--text)]">{model[key].length}</span>
                </h2>
              )}

              {expanded && (
                <div id={groupId} className="space-y-1" role="list">
                  {floors.map((floor) => {
                    const active = floor.floorId === activeId;
                    const pinned = pinnedFloors.has(floor.floorId);
                    const compared = comparisonSet.has(floor.floorId);
                    const unread = unreadByFloorId.get(floor.floorId) ?? 0;
                    const actorCount = floor.activeActors.length;
                    const cubicleCount = detailsByFloorId.get(floor.floorId)?.cubicles.length;
                    return (
                      <div
                        key={floor.floorId}
                        role="listitem"
                        className={`group relative grid grid-cols-[minmax(0,1fr)_auto] rounded-[5px] border ${active ? "border-[var(--selection)] bg-[var(--raised)]" : "border-[var(--border)] bg-[var(--surface)]"}`}
                        style={getSessionAccentProperties(floor.floorId)}
                      >
                        <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] bg-[var(--session-accent)]" />
                        <button
                          ref={(element) => {
                            if (element) rowRefs.current.set(floor.floorId, element);
                            else rowRefs.current.delete(floor.floorId);
                          }}
                          type="button"
                          onClick={() => handleMainAction(floor)}
                          aria-current={active ? "page" : undefined}
                          aria-label={floorAccessibleName(floor, active, compared, unread)}
                          className="flex min-h-14 min-w-0 cursor-pointer items-center gap-2 rounded-l-[4px] px-3 pl-4 text-left hover:bg-[var(--raised)] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--selection)]"
                        >
                          <span
                            aria-hidden="true"
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: resolveSessionLifecycleMarkerColor(floor.lifecycle) }}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] leading-5 text-[var(--text)]" style={{ fontFamily: "var(--font-vt), VT323, monospace" }}>{floor.title}</span>
                            <span className="flex min-w-0 items-center gap-2 text-[10px] text-[var(--muted)]">
                              <span className="truncate">{floor.projectId}</span>
                              <span className="shrink-0">{floor.activeInvocationCount} task{floor.activeInvocationCount === 1 ? "" : "s"}</span>
                              <span className="shrink-0">{actorCount} actor{actorCount === 1 ? "" : "s"}</span>
                              {cubicleCount !== undefined && <span className="sr-only">{cubicleCount} cubicles</span>}
                            </span>
                          </span>
                          {unread > 0 && <span className="min-w-5 rounded-[3px] bg-[var(--selection)] px-1.5 py-0.5 text-center text-[10px] font-bold text-[var(--canvas)]" aria-hidden="true">{unread > 99 ? "99+" : unread}</span>}
                        </button>

                        <div className="flex items-center border-l border-[var(--border)] lg:grid lg:grid-cols-2">
                          {floor.lifecycle !== "completed" && <button type="button" onClick={() => onPin(floor.floorId)} aria-pressed={pinned} aria-label={`${pinned ? "Unpin" : "Pin"} ${floor.title}`} className={`flex h-11 w-11 cursor-pointer items-center justify-center hover:bg-[var(--raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--selection)] ${pinned ? "text-[var(--waiting)]" : "text-[var(--dim)]"}`}><PinIcon filled={pinned} /></button>}
                          <button type="button" onClick={() => onCompare(floor.floorId)} aria-pressed={compared} aria-label={`${compared ? "Remove" : "Add"} ${floor.title} ${compared ? "from" : "to"} comparison`} className={`flex h-11 w-11 cursor-pointer items-center justify-center hover:bg-[var(--raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--selection)] ${compared ? "bg-[var(--raised)] text-[var(--selection)]" : "text-[var(--dim)]"}`}><CompareIcon /></button>
                          {onRename && floor.lifecycle !== "completed" && <button type="button" onClick={() => void renameFloor(floor)} aria-label={`Rename ${floor.title}`} className="flex h-11 w-11 cursor-pointer items-center justify-center text-[var(--dim)] hover:bg-[var(--raised)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--selection)]"><PencilIcon /></button>}
                          {floor.lifecycle !== "completed" && <button type="button" onClick={() => onClose(floor.floorId)} aria-label={`Complete ${floor.title}`} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-r-[4px] text-[var(--dim)] hover:bg-[var(--raised)] hover:text-[var(--success)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--success)]"><CheckIcon /></button>}
                        </div>
                      </div>
                    );
                  })}
                  {floors.length === 0 && hasResults && <p className="px-3 py-2 text-xs text-[var(--dim)]">No matching sessions</p>}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <footer className="flex min-h-12 items-center gap-2 border-t border-[var(--border)] px-3 text-[10px] uppercase tracking-wider text-[var(--muted)]">
        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${sseStatus === "live" ? "bg-[var(--working)]" : sseStatus === "offline" ? "bg-[var(--error)]" : sseStatus === "reconnecting" ? "bg-[var(--waiting)]" : "bg-[var(--idle)]"}`} />
        <span>{sseStatus}</span>
        {onFollowActivityChange && (
          <button type="button" onClick={() => onFollowActivityChange(!followActivity)} aria-pressed={followActivity} className={`ml-auto min-h-11 cursor-pointer rounded-[4px] border px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--selection)] ${followActivity ? "border-[var(--selection)] bg-[var(--raised)] text-[var(--selection)]" : "border-[var(--border)] text-[var(--muted)] hover:bg-[var(--raised)]"}`}>Follow activity</button>
        )}
      </footer>
    </div>
  );
}

export default function FloorSwitcher(props: FloorSwitcherProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const generatedId = useId().replaceAll(":", "");
  const mobileOpenerRef = useRef<HTMLElement | null>(null);
  const mobileOpen = props.isBottomSheetOpen ?? uncontrolledOpen;
  const isMobileControlled = props.isBottomSheetOpen !== undefined;
  const onBottomSheetChange = props.onBottomSheetChange;
  const closeMobile = useCallback(() => {
    if (!isMobileControlled) setUncontrolledOpen(false);
    onBottomSheetChange?.(false);
  }, [isMobileControlled, onBottomSheetChange]);

  useEffect(() => {
    if (!mobileOpen) return;
    if (document.activeElement instanceof HTMLElement) mobileOpenerRef.current = document.activeElement;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMobile();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      requestAnimationFrame(() => mobileOpenerRef.current?.focus());
    };
  }, [closeMobile, mobileOpen]);

  const contentProps = {
    model: props.model,
    floorDetails: props.floorDetails,
    activeId: props.activeId,
    onSelect: props.onSelect,
    pinnedFloors: props.pinnedFloors,
    onPin: props.onPin,
    onClose: props.onClose,
    onRename: props.onRename,
    onCompare: props.onCompare,
    comparisonIds: props.comparisonIds,
    unreadByFloorId: props.unreadByFloorId,
    sseStatus: props.sseStatus,
    followActivity: props.followActivity,
    onFollowActivityChange: props.onFollowActivityChange,
  } satisfies Omit<NavigatorContentProps, "idPrefix" | "mobile" | "onDismiss">;

  return (
    <>
      {props.desktopOpen !== false && (
        <aside className="fixed left-0 top-14 z-30 hidden h-[calc(100dvh-3.5rem)] w-[18rem] flex-col border-r-2 border-[var(--strong-border)] bg-[var(--canvas)] shadow-[2px_0_0_var(--border)] lg:flex" aria-label="Session navigator">
          <header className="flex min-h-12 items-center border-b border-[var(--border)] px-3">
            <h1 className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text)]">Sessions</h1>
            {props.onDesktopClose && <button type="button" onClick={props.onDesktopClose} className="ml-auto flex h-11 w-11 cursor-pointer items-center justify-center rounded-[4px] text-[var(--muted)] hover:bg-[var(--raised)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--selection)]" aria-label="Hide session navigator"><CloseIcon /></button>}
          </header>
          <NavigatorContent {...contentProps} idPrefix={`${generatedId}-desktop`} mobile={false} />
        </aside>
      )}

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-[color-mix(in_srgb,var(--canvas)_82%,transparent)] lg:hidden" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeMobile(); }}>
          <section id="mobile-session-navigator" role="dialog" aria-modal="true" aria-labelledby={`${generatedId}-mobile-title`} className="flex max-h-[88dvh] w-full flex-col rounded-t-[8px] border-t-2 border-[var(--strong-border)] bg-[var(--canvas)] shadow-[0_-8px_0_var(--border)]">
            <header className="flex min-h-14 items-center border-b border-[var(--border)] px-4">
              <h1 id={`${generatedId}-mobile-title`} className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text)]">Sessions</h1>
              <button type="button" onClick={closeMobile} className="ml-auto flex h-11 w-11 cursor-pointer items-center justify-center rounded-[4px] text-[var(--muted)] hover:bg-[var(--raised)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--selection)]" aria-label="Close session navigator"><CloseIcon /></button>
            </header>
            <NavigatorContent {...contentProps} idPrefix={`${generatedId}-mobile`} mobile onDismiss={closeMobile} />
          </section>
        </div>
      )}
    </>
  );
}
