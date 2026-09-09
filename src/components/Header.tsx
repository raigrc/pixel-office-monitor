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
  sseStatus?: SseDisplayStatus;
  reconnectAttempt?: number;
  sseFailedPermanently?: boolean;
  onSseRetry?: () => void;
  onOpenFloorSwitcher?: () => void;
  showFloorSwitcherTrigger?: boolean;
  latencyMs?: number;
  followActivity?: boolean;
  onFollowActivityChange?: (enabled: boolean) => void;
};

/**
 * Header — game HUD style.
 * Left: "PIXEL OFFICE" pixel title. Right: LIVE dot + agent count + connection status + latency.
 * Mobile: floor switcher trigger button.
 */
export default function Header({
  liveCount,
  sseStatus = "connecting",
  reconnectAttempt = 0,
  sseFailedPermanently = false,
  onSseRetry,
  onOpenFloorSwitcher,
  showFloorSwitcherTrigger = false,
  latencyMs,
  followActivity = false,
  onFollowActivityChange,
}: HeaderProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
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
          className="inline-flex items-center gap-1.5 rounded-[4px] border-2 border-[#F59E0B]/50 bg-[#F59E0B]/10 px-2.5 py-1 text-[8px] tracking-widest text-[#F59E0B] transition-colors duration-200 cursor-pointer hover:bg-[#F59E0B]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F172A]"
          style={{ fontFamily: "var(--font-pixel), monospace" }}
          role="note"
          aria-label="SSE fallback active, click to retry"
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#F59E0B] animate-pulse" aria-hidden="true" />
          FALLBACK POLL
        </button>
      );
    }

    switch (sseStatus) {
      case "live":
        return (
          <div
            className={[
              "inline-flex items-center gap-1.5 rounded-[4px] border-2 border-[#22C55E]/50 bg-[#22C55E]/10 px-2.5 py-1 text-[8px] tracking-widest text-[#22C55E] transition-colors duration-200 cursor-default",
              isMobile ? "" : "hidden md:inline-flex",
            ].join(" ")}
            style={{ fontFamily: "var(--font-pixel), monospace" }}
            role="note"
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#22C55E] animate-working" aria-hidden="true" />
            SSE LIVE
          </div>
        );
      case "reconnecting":
        return (
          <div
            className={[
              "inline-flex items-center gap-1.5 rounded-[4px] border-2 border-[#F59E0B]/50 bg-[#F59E0B]/10 px-2.5 py-1 text-[8px] tracking-widest text-[#F59E0B] transition-colors duration-200 cursor-default",
              isMobile ? "" : "hidden md:inline-flex",
            ].join(" ")}
            style={{ fontFamily: "var(--font-pixel), monospace" }}
            role="note"
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#F59E0B] animate-pulse" aria-hidden="true" />
            SSE RECONNECTING {reconnectAttempt > 0 && `(${reconnectAttempt})`}
          </div>
        );
      case "waiting":
        return (
          <div
            className={[
              "inline-flex items-center gap-1.5 rounded-[4px] border-2 border-[#F59E0B]/50 bg-[#F59E0B]/10 px-2.5 py-1 text-[8px] tracking-widest text-[#F59E0B] transition-colors duration-200 cursor-default",
              isMobile ? "" : "hidden md:inline-flex",
            ].join(" ")}
            style={{ fontFamily: "var(--font-pixel), monospace" }}
            role="note"
            title="Socket connected, but no monitor data has arrived yet. Check that the pixel-monitor plugin is loaded and the ingest server is reachable."
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#F59E0B] animate-pulse" aria-hidden="true" />
            SSE WAITING
          </div>
        );
      case "quiet":
        return (
          <div
            className={[
              "inline-flex items-center gap-1.5 rounded-[4px] border-2 border-[#38BDFC]/50 bg-[#38BDFC]/10 px-2.5 py-1 text-[8px] tracking-widest text-[#38BDFC] transition-colors duration-200 cursor-default",
              isMobile ? "" : "hidden md:inline-flex",
            ].join(" ")}
            style={{ fontFamily: "var(--font-pixel), monospace" }}
            role="note"
            title="Socket connected, but no monitor data for a while. The monitor is quiet — not off."
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#38BDFC]" aria-hidden="true" />
            SSE QUIET
          </div>
        );
      case "offline":
        return (
          <button
            type="button"
            onClick={onSseRetry}
            className={[
              "inline-flex items-center gap-1.5 rounded-[4px] border-2 border-[#EF4444]/50 bg-[#EF4444]/10 px-2.5 py-1 text-[8px] tracking-widest text-[#EF4444] transition-colors duration-200 cursor-pointer hover:bg-[#EF4444]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF4444] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F172A]",
              isMobile ? "" : "hidden md:inline-flex",
            ].join(" ")}
            style={{ fontFamily: "var(--font-pixel), monospace" }}
            role="note"
            aria-label="SSE offline, click to retry"
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#EF4444]" aria-hidden="true" />
            OFFLINE
          </button>
        );
      default: // connecting
        return (
          <div
            className={[
              "inline-flex items-center gap-1.5 rounded-[4px] border-2 border-[#64748B]/50 bg-[#64748B]/10 px-2.5 py-1 text-[8px] tracking-widest text-[#64748B] transition-colors duration-200 cursor-default",
              isMobile ? "" : "hidden md:inline-flex",
            ].join(" ")}
            style={{ fontFamily: "var(--font-pixel), monospace" }}
            role="note"
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#64748B] animate-pulse" aria-hidden="true" />
            SSE CONNECTING
          </div>
        );
    }
  };

  return (
    <header
      className="sticky top-0 z-40 flex h-14 w-full shrink-0 items-center justify-between border-b-2 border-[#334155] bg-[#0F172A]/95 px-4 sm:px-6"
      style={{
        boxShadow: "0 2px 0 #334155",
        backgroundImage: "url('/sprites/wall-tile.png')",
        backgroundRepeat: "repeat-x",
        backgroundSize: "32px 32px",
        imageRendering: "pixelated",
      }}
      role="banner"
    >
      {/* Left: pixel title + pulsing live dot */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2 shrink-0">
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-2.5 rounded-full bg-[#22C55E] animate-working shrink-0"
            style={{ boxShadow: "0 0 6px rgba(34,197,94,0.6)" }}
          />
          <h1
            className={[
              "text-[16px] font-normal leading-none tracking-[0.06em] text-[#F1F5F9] truncate",
              isMobile ? "text-[14px]" : "",
            ].join(" ")}
            style={{ fontFamily: "var(--font-pixel), monospace" }}
          >
            PIXEL OFFICE
          </h1>
        </div>
        <span
          className={[
            "inline-flex items-center rounded-full border-2 border-[#22C55E]/30 bg-[#22C55E]/10 px-2 py-0.5 text-[8px] font-bold tracking-widest text-[#22C55E] shrink-0",
            isMobile ? "hidden sm:inline-flex" : "hidden md:inline-flex",
          ].join(" ")}
          style={{ fontFamily: "var(--font-pixel), monospace" }}
        >
          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#22C55E] animate-working" aria-hidden="true" />
          LIVE
        </span>
      </div>

      {/* Right: live count badge + status + mobile floor switcher trigger */}
      <div className="flex items-center gap-3 shrink-0">
        {typeof liveCount === "number" && (
          <div
            className={[
              "hidden items-center gap-1.5 rounded-full border-2 border-[#334155] bg-[#1E293B] px-3 py-1 text-[8px] font-bold tracking-widest text-[#F1F5F9] cursor-default transition-colors duration-200 shrink-0 sm:inline-flex",
              isMobile ? "px-2 py-0.5 gap-1" : "",
            ].join(" ")}
            style={{ fontFamily: "var(--font-pixel), monospace" }}
            aria-live="polite"
            aria-label={`${liveCount} active floors`}
          >
            <span className="inline-block h-2 w-2 rounded-full bg-[#22C55E]" aria-hidden="true" />
            {liveCount} LIVE
          </div>
        )}
        {getStatusBadge()}
        {sseStatus === "live" && latencyMs !== undefined && latencyMs !== null && (
          <span className={["inline-flex items-center gap-1 rounded-[4px] border-2 border-[#334155] bg-[#1E293B] px-2.5 py-1 text-[8px] tracking-widest text-[#64748B] shrink-0", isMobile ? "hidden sm:inline-flex" : ""].join(" ")}>
            {latencyMs}ms
          </span>
        )}
        {onFollowActivityChange && (() => {
            const followBtnClass = [
              "inline-flex items-center gap-1.5 rounded-[4px] border-2 px-2.5 py-1 text-[8px] tracking-widest shrink-0 transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F172A]",
              followActivity
                ? "border-[#3B82F6] bg-[#3B82F6]/10 text-[#3B82F6] hover:bg-[#3B82F6]/20"
                : "border-[#64748B] bg-[#1E293B] text-[#64748B] hover:bg-[#24324D] hover:border-[#475569]",
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
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: followActivity ? "#3B82F6" : "#64748B" }} aria-hidden="true" />
                FOLLOW
              </button>
            );
          })()}
        {showFloorSwitcherTrigger && isMobile && onOpenFloorSwitcher && (
          <button
            type="button"
            onClick={onOpenFloorSwitcher}
            className="inline-flex items-center justify-center h-9 w-9 rounded-[6px] border-2 border-[#334155] bg-[#1E293B] text-[#F1F5F9] transition-colors duration-200 hover:bg-[#24324D] hover:border-[#475569] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F172A] cursor-pointer shrink-0"
            aria-label="Open floor switcher"
            aria-expanded="false"
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
