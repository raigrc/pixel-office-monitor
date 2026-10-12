"use client";

import { useEffect, useState } from "react";

export type SseDisplayStatus =
  | "connecting"
  | "live"
  | "reconnecting"
  | "offline"
  | "waiting"
  | "quiet";

type HeaderProps = {
  liveCount?: number;
  workingCount?: number;
  quietCount?: number;
  activeTaskCount?: number;
  unreadNotificationCount?: number;
  sseStatus?: SseDisplayStatus;
  reconnectAttempt?: number;
  sseFailedPermanently?: boolean;
  onSseRetry?: () => void;
  onOpenFloorSwitcher?: () => void;
  showFloorSwitcherTrigger?: boolean;
  latencyMs?: number;
  followActivity?: boolean;
  onFollowActivityChange?: (enabled: boolean) => void;
  onOpenNotifications?: () => void;
  onToggleComparison?: () => void;
  comparisonActive?: boolean;
  navigatorOpen?: boolean;
};

/**
 * Operational header with live session counts, connection health, and controls.
 * Mobile: floor switcher trigger button.
 */
export default function Header({
  liveCount,
  workingCount,
  quietCount,
  activeTaskCount,
  unreadNotificationCount = 0,
  sseStatus = "connecting",
  reconnectAttempt = 0,
  sseFailedPermanently = false,
  onSseRetry,
  onOpenFloorSwitcher,
  showFloorSwitcherTrigger = false,
  latencyMs,
  followActivity = false,
  onFollowActivityChange,
  onOpenNotifications,
  onToggleComparison,
  comparisonActive = false,
  navigatorOpen = false,
}: HeaderProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const getStatusBadge = () => {
    if (sseFailedPermanently) {
      return (
        <button
          type="button"
          onClick={onSseRetry}
          className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-[4px] border-2 border-[var(--waiting)] bg-[color-mix(in_srgb,var(--waiting)_10%,transparent)] px-2.5 py-1 text-[8px] tracking-widest text-[var(--waiting)] transition-colors duration-200 hover:bg-[color-mix(in_srgb,var(--waiting)_18%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--waiting)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas)]"
          style={{ fontFamily: "var(--font-pixel), monospace" }}
          aria-label="SSE fallback active, click to retry"
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--waiting)] animate-pulse" aria-hidden="true" />
          FALLBACK POLL
        </button>
      );
    }

    switch (sseStatus) {
      case "live":
        return (
          <div
            className={[
              "inline-flex items-center gap-1.5 rounded-[4px] border-2 border-[var(--working)] bg-[color-mix(in_srgb,var(--working)_10%,transparent)] px-2.5 py-1 text-[8px] tracking-widest text-[var(--working)] transition-colors duration-200 cursor-default",
              isMobile ? "hidden sm:inline-flex" : "hidden md:inline-flex",
            ].join(" ")}
            style={{ fontFamily: "var(--font-pixel), monospace" }}
            role="note"
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--working)] animate-working" aria-hidden="true" />
            SSE LIVE
          </div>
        );
      case "reconnecting":
        return (
          <div
            className={[
              "inline-flex items-center gap-1.5 rounded-[4px] border-2 border-[var(--waiting)] bg-[color-mix(in_srgb,var(--waiting)_10%,transparent)] px-2.5 py-1 text-[8px] tracking-widest text-[var(--waiting)] transition-colors duration-200 cursor-default",
              isMobile ? "hidden sm:inline-flex" : "hidden md:inline-flex",
            ].join(" ")}
            style={{ fontFamily: "var(--font-pixel), monospace" }}
            role="note"
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--waiting)] animate-pulse" aria-hidden="true" />
            SSE RECONNECTING {reconnectAttempt > 0 && `(${reconnectAttempt})`}
          </div>
        );
      case "waiting":
        return (
          <div
            className={[
              "inline-flex items-center gap-1.5 rounded-[4px] border-2 border-[var(--waiting)] bg-[color-mix(in_srgb,var(--waiting)_10%,transparent)] px-2.5 py-1 text-[8px] tracking-widest text-[var(--waiting)] transition-colors duration-200 cursor-default",
              isMobile ? "hidden sm:inline-flex" : "hidden md:inline-flex",
            ].join(" ")}
            style={{ fontFamily: "var(--font-pixel), monospace" }}
            role="note"
            title="Socket connected, but no monitor data has arrived yet. Check that the pixel-monitor plugin is loaded and the ingest server is reachable."
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--waiting)] animate-pulse" aria-hidden="true" />
            SSE WAITING
          </div>
        );
      case "quiet":
        return (
          <div
            className={[
              "inline-flex items-center gap-1.5 rounded-[4px] border-2 border-[var(--idle)] bg-[color-mix(in_srgb,var(--idle)_10%,transparent)] px-2.5 py-1 text-[8px] tracking-widest text-[var(--muted)] transition-colors duration-200 cursor-default",
              isMobile ? "hidden sm:inline-flex" : "hidden md:inline-flex",
            ].join(" ")}
            style={{ fontFamily: "var(--font-pixel), monospace" }}
            role="note"
            title="Socket connected, but no monitor data for a while. The monitor is quiet — not off."
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--idle)]" aria-hidden="true" />
            SSE QUIET
          </div>
        );
      case "offline":
        return (
          <button
            type="button"
            onClick={onSseRetry}
            className={[
              "inline-flex min-h-11 items-center gap-1.5 rounded-[4px] border-2 border-[var(--error)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] px-2.5 py-1 text-[8px] tracking-widest text-[var(--error)] transition-colors duration-200 cursor-pointer hover:bg-[color-mix(in_srgb,var(--error)_18%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--error)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas)]",
              isMobile ? "hidden sm:inline-flex" : "hidden md:inline-flex",
            ].join(" ")}
            style={{ fontFamily: "var(--font-pixel), monospace" }}
            aria-label="SSE offline, click to retry"
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--error)]" aria-hidden="true" />
            OFFLINE
          </button>
        );
      default: // connecting
        return (
          <div
            className={[
              "inline-flex items-center gap-1.5 rounded-[4px] border-2 border-[var(--idle)] bg-[color-mix(in_srgb,var(--idle)_10%,transparent)] px-2.5 py-1 text-[8px] tracking-widest text-[var(--muted)] transition-colors duration-200 cursor-default",
              isMobile ? "" : "hidden md:inline-flex",
            ].join(" ")}
            style={{ fontFamily: "var(--font-pixel), monospace" }}
            role="note"
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--idle)] animate-pulse" aria-hidden="true" />
            SSE CONNECTING
          </div>
        );
    }
  };

  return (
    <header
      className="sticky top-0 z-40 flex h-14 w-full shrink-0 items-center justify-between border-b-2 border-[var(--strong-border)] bg-[var(--canvas)] px-4 sm:px-6"
      style={{
        boxShadow: "0 2px 0 var(--border)",
      }}
      role="banner"
    >
      {/* Left: session-independent brand. */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2 shrink-0">
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-2.5 shrink-0 bg-[var(--monitor-idle)]"
          />
          <h1
            className={[
              "text-[16px] font-normal leading-none tracking-[0.06em] text-[var(--text)] truncate",
              isMobile ? "text-[14px]" : "",
            ].join(" ")}
            style={{ fontFamily: "var(--font-pixel), monospace" }}
          >
            PIXEL OFFICE
          </h1>
        </div>
      </div>

      {/* Right: live count badge + status + mobile floor switcher trigger */}
      <div className="flex items-center gap-3 shrink-0">
        {!isMobile && typeof (workingCount ?? liveCount) === "number" && (
          <div
            className={[
              "hidden items-center gap-1.5 rounded-[4px] border-2 border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[8px] font-bold tracking-widest text-[var(--text)] cursor-default transition-colors duration-200 shrink-0 sm:inline-flex",
              isMobile ? "px-2 py-0.5 gap-1" : "",
            ].join(" ")}
            style={{ fontFamily: "var(--font-pixel), monospace" }}
            aria-live="polite"
            aria-label={`${workingCount ?? liveCount} working floors, ${quietCount ?? 0} quiet floors, ${activeTaskCount ?? 0} active tasks`}
          >
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--working)]" aria-hidden="true" />
            {workingCount ?? liveCount} WORKING
          </div>
        )}
        {!isMobile && getStatusBadge()}
        {!isMobile && sseStatus === "live" && latencyMs !== undefined && latencyMs !== null && (
          <span className={["inline-flex items-center gap-1 rounded-[4px] border-2 border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[8px] tracking-widest text-[var(--muted)] shrink-0", isMobile ? "hidden sm:inline-flex" : ""].join(" ")}>
            {latencyMs}ms
          </span>
        )}
        {!isMobile && onFollowActivityChange && (() => {
            const followBtnClass = [
              "inline-flex min-h-11 items-center gap-1.5 rounded-[4px] border-2 px-2.5 py-1 text-[8px] tracking-widest shrink-0 transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--selection)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas)]",
              followActivity
                ? "border-[var(--selection)] bg-[color-mix(in_srgb,var(--selection)_10%,transparent)] text-[var(--selection)] hover:bg-[color-mix(in_srgb,var(--selection)_18%,transparent)]"
                : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--raised)] hover:border-[var(--strong-border)]",
              isMobile ? "hidden sm:inline-flex" : "",
            ].join(" ");
            return (
              <button
                type="button"
                onClick={() => onFollowActivityChange(!followActivity)}
                className={followBtnClass}
                style={{ fontFamily: "var(--font-pixel), monospace" }}
                aria-label={followActivity ? "Disable follow activity" : "Enable follow activity"}
                aria-pressed={followActivity}
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: followActivity ? "var(--selection)" : "var(--idle)" }} aria-hidden="true" />
                FOLLOW
              </button>
            );
          })()}
        {onToggleComparison && (
          <button
            type="button"
            onClick={onToggleComparison}
            className={`hidden min-h-11 cursor-pointer items-center rounded-[4px] border-2 px-2.5 text-[8px] tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--selection)] sm:inline-flex ${comparisonActive ? "border-[var(--selection)] bg-[color-mix(in_srgb,var(--selection)_14%,transparent)] text-[var(--selection)]" : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)]"}`}
            style={{ fontFamily: "var(--font-pixel), monospace" }}
            aria-pressed={comparisonActive}
          >
            COMPARE
          </button>
        )}
        {onOpenNotifications && (
          <button
            type="button"
            onClick={onOpenNotifications}
            className="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-[4px] border-2 border-[var(--border)] bg-[var(--surface)] text-[var(--text)] transition-colors hover:bg-[var(--raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--selection)]"
            aria-label={`Open notifications, ${unreadNotificationCount} unread`}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
            {unreadNotificationCount > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-[var(--selection)] px-1 text-[8px] font-bold leading-4 text-[var(--canvas)]">{unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}</span>}
          </button>
        )}
        {showFloorSwitcherTrigger && isMobile && onOpenFloorSwitcher && (
          <button
            type="button"
            onClick={onOpenFloorSwitcher}
            className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border-2 border-[var(--border)] bg-[var(--surface)] text-[var(--text)] transition-colors duration-200 hover:border-[var(--strong-border)] hover:bg-[var(--raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--selection)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas)]"
            aria-label="Open floor switcher"
            aria-expanded={navigatorOpen}
            aria-controls="mobile-session-navigator"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 9h6M9 15h6" />
            </svg>
          </button>
        )}
      </div>
    </header>
  );
}
