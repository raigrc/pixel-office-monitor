"use client";

import { memo } from "react";
import { motion } from "motion/react";
import type { FloorDTO, CubicleDTO } from "@/lib/monitor-store";
import { getAgentMeta } from "@/lib/agents";

type FloorPreviewProps = {
  floor: FloorDTO;
};

const MAX_PREVIEW_CUBICLES = 6;

function FloorPreviewInner({ floor }: FloorPreviewProps) {
  // Separate orchestrator and filter out system agent
  const orchestratorCubicle = floor.cubicles.find((c) => c.agent === "orchestrator");
  const otherCubicles = floor.cubicles.filter(
    (c) => c.agent !== "orchestrator" && c.agent !== "system"
  );

  // Render order: orchestrator first, then others
  const renderOrder = orchestratorCubicle ? [orchestratorCubicle, ...otherCubicles] : otherCubicles;
  const displayCubicles = renderOrder.slice(0, MAX_PREVIEW_CUBICLES);
  const overflowCount = renderOrder.length - MAX_PREVIEW_CUBICLES;

  return (
    <motion.div
      className="relative w-[280px] rounded-[8px] border-2 border-[#334155] bg-[#0F172A] p-3 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
      style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}
      role="tooltip"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-[13px] font-normal tracking-wide text-[#F1F5F9]"
            style={{ fontFamily: "var(--font-vt), VT323, monospace" }}
          >
            {floor.title?.trim() ? floor.title.trim().slice(0, 40) : floor.project.split(/[\\/]/).pop() ?? floor.project}
          </p>
          <p className="text-[10px] text-[#64748B]" style={{ fontFamily: "var(--font-pixel), monospace", fontSize: "7px" }}>
            {floor.sessionID.slice(0, 8)} • {floor.cubicles.length} agents
          </p>
        </div>
        <span
          className={[
            "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold leading-none tracking-widest",
            floor.status === "working"
              ? "border-[#22C55E]/30 bg-[#22C55E]/10 text-[#22C55E]"
              : "border-[#334155] bg-[#0B1220]/80 text-[#94A3B8]",
          ].join(" ")}
          style={{ fontFamily: "var(--font-pixel), monospace", fontSize: "7px" }}
        >
          {floor.status.toUpperCase()}
        </span>
      </div>

      {/* Mini grid - 2 columns max */}
      <div className="grid grid-cols-2 gap-2">
        {displayCubicles.map((cubicle) => (
          <MiniCubicle key={cubicle.agent} cubicle={cubicle} />
        ))}

        {/* Fill remaining slots with vacant if less than 6 */}
        {displayCubicles.length < MAX_PREVIEW_CUBICLES &&
          Array.from({ length: MAX_PREVIEW_CUBICLES - displayCubicles.length }).map((_, i) => (
            <VacantMiniCubicle key={`vacant-${i}`} />
          ))}

        {/* Overflow badge */}
        {overflowCount > 0 && (
          <div className="col-span-2 flex items-center justify-center rounded-[4px] border border-dashed border-[#334155]/50 bg-[#0B1220]/50 px-2 py-1.5" style={{ gridColumn: "span 2" }}>
            <span className="text-[10px] text-[#64748B]" style={{ fontFamily: "var(--font-pixel), monospace", fontSize: "7px" }}>
              +{overflowCount} more
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function MiniCubicle({ cubicle }: { cubicle: CubicleDTO }) {
  const meta = getAgentMeta(cubicle.agent);
  const isWorking = cubicle.status === "working";
  const isOrchestrator = cubicle.agent === "orchestrator";

  return (
    <div
      className={[
        "relative flex flex-col overflow-hidden rounded-[4px] border transition-colors duration-200",
        isWorking ? "border-[#22C55E]/30 bg-[#0F172A]" : "border-[#334155]/50 bg-[#0B1220]/80",
        isOrchestrator ? "ring-1 ring-[#FBBF24]/50" : "",
      ].join(" ")}
      style={{ minHeight: "72px" }}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 border-b px-1.5 py-1" style={{ borderColor: isWorking ? "rgba(34,197,94,0.3)" : "rgba(51,65,85,0.4)" }}>
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-[10px] font-normal leading-none text-[#F1F5F9]"
            style={{ fontFamily: "var(--font-vt), VT323, monospace" }}
            title={meta.label}
          >
            {meta.label}
          </p>
        </div>
        <span
          className={[
            "inline-flex shrink-0 items-center rounded-full border px-1 py-0.5 text-[7px] font-bold leading-none tracking-widest",
            isWorking ? "border-[#22C55E]/30 bg-[#22C55E]/10 text-[#22C55E]" : "border-[#334155] bg-[#0B1220]/80 text-[#64748B]",
          ].join(" ")}
          style={{ fontFamily: "var(--font-pixel), monospace", fontSize: "6px" }}
        >
          {isWorking ? "WORK" : "IDLE"}
        </span>
      </div>

      {/* Sprite */}
      <div className="flex flex-1 items-center justify-center px-1 py-1.5">
        <img
          src={`/sprites/${meta.spriteKey}-idle.png`}
          alt=""
          aria-hidden="true"
          className="pixel-img h-[28px] w-[28px] object-contain"
          style={{
            imageRendering: "pixelated",
            filter: isWorking ? "none" : "saturate(0.5) brightness(0.7)",
            opacity: isWorking ? 1 : 0.6,
          }}
        />
      </div>

      {/* Working indicator */}
      {isWorking && (
        <div className="absolute inset-x-0 top-0 h-[2px] bg-[#22C55E]/60" aria-hidden="true" />
      )}
    </div>
  );
}

function VacantMiniCubicle() {
  return (
    <div
      className="relative flex flex-col overflow-hidden rounded-[4px] border border-dashed border-[#334155]/30 bg-[#0B1220]/40"
      style={{ minHeight: "72px", filter: "saturate(0.3) brightness(0.6)", opacity: 0.7 }}
    >
      <div className="flex items-center justify-center border-b px-1.5 py-1" style={{ borderColor: "rgba(51,65,85,0.3)" }}>
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[3px] border border-dashed bg-[#0B1220]/40 text-[#475569]"
          style={{
            borderColor: "rgba(51,65,85,0.4)",
            fontFamily: "var(--font-pixel), monospace",
            fontSize: "8px",
            lineHeight: 1,
          }}
        >
          V
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <div className="flex h-5 w-10 items-center justify-center rounded-[3px] border border-dashed" style={{ borderColor: "rgba(51,65,85,0.35)" }}>
          <div className="h-[1px] w-6 rounded bg-[#334155]/30" />
        </div>
      </div>
    </div>
  );
}

const FloorPreview = memo(FloorPreviewInner);
export default FloorPreview;