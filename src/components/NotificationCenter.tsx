"use client";

import { useEffect, useId, useRef } from "react";
import type { SessionNotification, SessionNotificationKind } from "@/lib/multi-session/session-notifications";
import { getSessionAccentProperties } from "@/lib/session-visual-identity";

export interface NotificationCenterProps {
  notifications: readonly SessionNotification[];
  unreadIds: Set<string>;
  open: boolean;
  onClose: () => void;
  onMarkAllRead: () => void;
  onSelectFloor: (id: string) => void;
}

const KIND_LABELS: Record<SessionNotificationKind, string> = {
  "started-working": "Started working",
  "became-quiet": "Became quiet",
  completed: "Completed",
  "follow-moved": "Follow moved",
};

const KIND_COLORS: Record<SessionNotificationKind, string> = {
  "started-working": "bg-[var(--working)]",
  "became-quiet": "bg-[var(--idle)]",
  completed: "bg-[var(--session-accent)]",
  "follow-moved": "bg-[var(--selection)]",
};

function notificationDescription(notification: SessionNotification): string {
  if (notification.kind === "follow-moved" && notification.fromFloorId) {
    return `Follow moved from ${notification.fromFloorId} to ${notification.title}`;
  }
  return `${notification.title}: ${KIND_LABELS[notification.kind]}`;
}

function formatTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(timestamp) + " UTC";
}

export default function NotificationCenter({ notifications, unreadIds, open, onClose, onMarkAllRead, onSelectFloor }: NotificationCenterProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
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
  }, [onClose, open]);

  if (!open) return null;
  const unreadCount = notifications.reduce((count, notification) => count + Number(unreadIds.has(notification.id)), 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[color-mix(in_srgb,var(--canvas)_78%,transparent)] sm:p-3" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby={titleId} className="flex h-full w-full flex-col border-l-2 border-[var(--strong-border)] bg-[var(--canvas)] shadow-[6px_6px_0_var(--surface)] sm:max-w-md sm:rounded-[6px] sm:border-2">
        <header className="flex min-h-16 items-center border-b border-[var(--border)] px-4">
          <div>
            <h1 id={titleId} className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--text)]">Notifications</h1>
            <p className="mt-0.5 text-xs text-[var(--muted)]" aria-live="polite">{unreadCount} unread</p>
          </div>
          {unreadCount > 0 && <button type="button" onClick={onMarkAllRead} className="ml-auto min-h-11 cursor-pointer rounded-[4px] px-3 text-xs font-semibold text-[var(--selection)] hover:bg-[var(--raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--selection)]">Mark all read</button>}
          <button ref={closeRef} type="button" onClick={onClose} className="ml-1 flex h-11 w-11 cursor-pointer items-center justify-center rounded-[4px] text-[var(--muted)] hover:bg-[var(--raised)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--selection)]" aria-label="Close notifications">
            <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {notifications.length === 0 ? (
            <div className="flex h-full min-h-64 flex-col items-center justify-center rounded-[4px] border border-dashed border-[var(--border)] px-6 text-center">
              <svg aria-hidden="true" className="mb-3 h-7 w-7 text-[var(--dim)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" /></svg>
              <h2 className="text-sm font-semibold text-[var(--text)]">No notifications</h2>
              <p className="mt-1 text-xs text-[var(--muted)]">Session changes will appear here.</p>
            </div>
          ) : (
            <ul className="space-y-2" aria-label="Session notifications">
              {notifications.map((notification) => {
                const unread = unreadIds.has(notification.id);
                const description = notificationDescription(notification);
                return (
                  <li key={notification.id}>
                    <button
                      type="button"
                      onClick={() => { onSelectFloor(notification.floorId); onClose(); }}
                      aria-label={`${description}. ${unread ? "Unread." : "Read."} ${formatTimestamp(notification.occurredAt)}`}
                      className={`relative flex min-h-16 w-full cursor-pointer gap-3 rounded-[4px] border p-3 pl-4 text-left hover:bg-[var(--raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--selection)] ${unread ? "border-[var(--selection)] bg-[var(--raised)]" : "border-[var(--border)] bg-[var(--surface)]"}`}
                      style={getSessionAccentProperties(notification.floorId)}
                    >
                      <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] bg-[var(--session-accent)]" />
                      <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${KIND_COLORS[notification.kind]}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-[var(--text)]">{KIND_LABELS[notification.kind]}</span>
                        <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">{notification.title}</span>
                        <time dateTime={new Date(notification.occurredAt).toISOString()} className="mt-1 block text-[10px] uppercase tracking-wider text-[var(--muted)]">{formatTimestamp(notification.occurredAt)}</time>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
