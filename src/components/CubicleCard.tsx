"use client";
/* eslint-disable react-hooks/set-state-in-effect -- R4 entrance walk: intentional sync from first-seen/reduced-motion check to entered state; double-rAF ensures mount transition */

import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { CubicleDTO } from "@/lib/monitor-store";
import { getAgentMeta } from "@/lib/agents";
import { formatSince } from "@/lib/format";
import Sprite from "./Sprite";
import CubicleFrame from "./CubicleFrame";
import AgentTooltip from "./AgentTooltip";
import SpeechBubble from "./SpeechBubble";
import DeskProps from "./DeskProps";
import MonitorScreen from "./MonitorScreen";

type CubicleCardProps = {
  cubicle: CubicleDTO;
  index?: number;
};

function CubicleCardInner({ cubicle, index = 0 }: CubicleCardProps) {
  const meta = getAgentMeta(cubicle.agent);
  const isWorking = cubicle.status === "working";
  const isOrchestrator = cubicle.agent === "orchestrator";
  const sinceLabel = formatSince(cubicle.since);
  const spriteState = cubicle.state ?? (isWorking ? "working" : "sleeping");

  // Mobile touch state
  const [isMobile, setIsMobile] = useState(false);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [isSpeechVisible, setIsSpeechVisible] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // R4 — entrance: translateY(8px) scale(0.98) → 0 1, 300ms ease-out, stagger index*80ms
  const [entered, setEntered] = useState(false);
  const seenRef = useRef<Set<string>>(new Set());
  const prevStatusRef = useRef(cubicle.status);
  const enteredOnceRef = useRef(false);

  useEffect(() => {
    const key = cubicle.agent;
    const workingKey = `${key}:working`;
    const isWorkingNow = cubicle.status === "working";
    const alreadySeenAny = seenRef.current.has(key);
    const alreadySeenWorking = seenRef.current.has(workingKey);

    const shouldAnimateNew = !alreadySeenAny;
    const shouldAnimateWorking = isWorkingNow && !alreadySeenWorking;

    if (shouldAnimateWorking) seenRef.current.add(workingKey);
    if (shouldAnimateNew) seenRef.current.add(key);

    const needAnimation = shouldAnimateNew || shouldAnimateWorking;

    if (!needAnimation) {
      setEntered(true);
      return;
    }

    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setEntered(true);
      return;
    }

    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [cubicle.agent, cubicle.status]);

  useEffect(() => {
    const prev = prevStatusRef.current;
    if (prev !== "working" && cubicle.status === "working") {
      const workingKey = `${cubicle.agent}:working`;
      if (!seenRef.current.has(workingKey)) {
        seenRef.current.add(workingKey);
        if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          setEntered(true);
          enteredOnceRef.current = true;
        } else if (!enteredOnceRef.current) {
          enteredOnceRef.current = true;
          requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)));
        }
      }
    }
    prevStatusRef.current = cubicle.status;
  }, [cubicle.status, cubicle.agent]);

  // Touch handlers for mobile
  const handleTouchStart = useCallback(() => {
    if (!isMobile) return;
    longPressTimerRef.current = setTimeout(() => {
      // Long press could trigger context menu in future
      // For now, show tooltip
      setIsTooltipVisible(true);
      setIsSpeechVisible(true);
    }, 500);
  }, [isMobile]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (!isMobile) return;
    // Tap toggles tooltip/speech bubble
    setIsTooltipVisible((prev) => !prev);
    setIsSpeechVisible((prev) => !prev);
  }, [isMobile]);

  const handleTouchMove = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleClick = useCallback(() => {
    if (isMobile) {
      setIsTooltipVisible((prev) => !prev);
      setIsSpeechVisible((prev) => !prev);
    }
  }, [isMobile]);

  // Determine visibility: hover on desktop, tap state on mobile
  const showTooltip = isMobile ? isTooltipVisible : undefined; // undefined lets CSS :hover handle it
  const showSpeechBubble = isMobile ? isSpeechVisible : isWorking;

  return (
    <article
      className={[
        "group relative flex flex-col rounded-[6px] transition-colors duration-200",
        "hover:brightness-110 focus-within:ring-2 focus-within:ring-[#3B82F6] focus-within:ring-offset-2 focus-within:ring-offset-[#0F172A]",
        "transform-gpu transition-transform duration-200 ease-out hover:scale-[1.015]",
        isWorking ? "" : "opacity-90",
        isOrchestrator ? "ring-2 ring-[#FBBF24]/50" : "",
        entered ? "cubicle-enter" : "cubicle-enter cubicle-enter--initial",
      ].join(" ")}
      style={{ transitionDelay: `${index * 80}ms`, minHeight: "212px" }}
      aria-label={`${meta.label} ${isWorking ? "working" : "idle"} ${sinceLabel}`}
      // Mobile touch handlers
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onClick={handleClick}
      // Ensure touch target is at least 44px
      tabIndex={isMobile ? 0 : -1}
    >
      <CubicleFrame isWorking={isWorking}>
        {/* Header — transparent over frame image */}
        <div className={[
          "flex items-center gap-2.5 border-b border-[#334155]/40 px-3 py-2.5 backdrop-blur-[1px]",
          isOrchestrator ? "bg-[#1F1A0E]/80" : "bg-[#0F172A]/60",
        ].join(" ")}>

          <div className="min-w-0 flex-1">
            <div
              className="truncate text-[13px] font-normal leading-none text-[#F1F5F9]"
              style={{ fontFamily: "var(--font-vt), VT323, monospace" }}
              title={meta.label}
            >
              {meta.label}
            </div>
            <div
              className="truncate text-[11px] leading-none text-[#94A3B8]"
              style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}
              title={meta.role}
            >
              {meta.role}
            </div>
          </div>

          <span
            className={[
              "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-bold leading-none tracking-widest transition-colors duration-200",
              isWorking ? "border-[#22C55E]/30 bg-[#22C55E]/10 text-[#22C55E]" : "border-[#334155] bg-[#0B1220]/80 text-[#94A3B8]",
            ].join(" ")}
            style={{ fontFamily: "var(--font-pixel), monospace", fontSize: "8px" }}
          >
            {spriteState.toUpperCase()}
          </span>

          {isOrchestrator && (
            <span
              className="inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-bold leading-none tracking-widest"
              style={{
                fontFamily: "var(--font-pixel), monospace",
                fontSize: "8px",
                borderColor: "#FBBF24",
                backgroundColor: "#FBBF2420",
                color: "#FBBF24",
              }}
            >
              ORCHESTRATOR
            </span>
          )}
        </div>

        {/* Body — sprite on desk with speech bubble on hover/tap */}
        <div className="relative flex h-28 flex-col items-center justify-center gap-1 bg-[#0B1220]/40 px-3 py-3">
          {/* Monitor screen — positioned at top of cubicle */}
          <MonitorScreen agentId={cubicle.agent} isWorking={isWorking} />

          {/* Desk props — scattered on desk surface */}
          <DeskProps agentId={cubicle.agent} isWorking={isWorking} />
          {/* Speech bubble — visible on hover (desktop) or tap (mobile) or when working */}
          <SpeechBubble
            text={cubicle.prompt || ""}
            visible={showSpeechBubble}
          />

          <Sprite
            spriteKey={cubicle.agent}
            state={spriteState}
            size={48}
          />

          {cubicle.prompt ? (
            <span
              className="max-w-[184px] truncate text-center text-[11px] leading-none tracking-wide text-[#94A3B8]"
              style={{ fontFamily: "var(--font-vt), VT323, monospace" }}
              title={cubicle.prompt}
            >
              {truncate(cubicle.prompt, 40)}
            </span>
          ) : isWorking && cubicle.lastTool ? (
            <span
              className="max-w-[184px] truncate text-center text-[11px] leading-none tracking-wide text-[#64748B]"
              style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}
              title={cubicle.lastTool}
            >
              {truncate(cubicle.lastTool, 40)}
            </span>
          ) : (
            <span
              className="text-center text-[10px] leading-none tracking-widest text-[#334155]"
              style={{ fontFamily: "var(--font-pixel), monospace", fontSize: "7px" }}
              aria-hidden="true"
            >
              {spriteState === "working" ? "working\u2026" : spriteState === "thinking" ? "thinking\u2026" : spriteState === "delegating" ? "delegating\u2026" : spriteState === "celebrating" ? "done!" : "sleeping"}
            </span>
          )}
        </div>

        {/* Desk rail — pixel partition highlight */}
        <div aria-hidden="true" className="h-[3px] w-full shrink-0 bg-[#475569] border-t border-[#64748B]" />
      </CubicleFrame>

      {/* Agent tooltip — shows on hover (desktop) or tap (mobile) */}
      <AgentTooltip
        label={meta.label}
        role={meta.role}
        isWorking={isWorking}
        prompt={cubicle.prompt}
        lastTool={cubicle.lastTool}
        sinceLabel={sinceLabel}
        visible={showTooltip}
      />

      {/* Working glow top accent */}
      {isWorking && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[2px] bg-[#22C55E]/60"
        />
      )}
    </article>
  );
}

const CubicleCard = memo(CubicleCardInner);
export default CubicleCard;

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "\u2026";
}