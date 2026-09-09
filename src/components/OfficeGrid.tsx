"use client";

import { memo } from "react";
import { motion } from "motion/react";
import type { FloorDTO } from "@/lib/monitor-store";
import CubicleCard from "./CubicleCard";
import VacantCubicle from "./VacantCubicle";
import { cubicleVariants, staggerContainer, entranceDelay } from "@/lib/animation-variants";

type OfficeGridProps = {
  floors: FloorDTO[];
  activeId: string | null;
};

function OfficeGridInner({ floors, activeId }: OfficeGridProps) {
  const activeFloor = floors.find((f) => f.sessionID === activeId) ?? floors[0] ?? null;

  if (!activeFloor) {
    // Skeleton grid — shown when loading or empty per spec — walled row (R3)
    return (
      <div
        aria-label="loading office grid"
        className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3 bg-[#475569] p-1 rounded-[8px]"
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-[212px] animate-pulse rounded-[6px] border-2 bg-[#1E293B]"
            style={{ borderColor: "#334155" }}
            aria-hidden="true"
          >
            <div className="h-[53px] border-b px-3 py-2.5" style={{ borderColor: "#334155" }}>
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-[4px] bg-[#0B1220]" style={{ border: "1px solid #334155" }} />
                <div className="flex flex-col gap-1.5">
                  <div className="h-3 w-20 rounded bg-[#334155]/60" />
                  <div className="h-2 w-16 rounded bg-[#334155]/40" />
                </div>
              </div>
            </div>
            <div className="flex h-28 items-center justify-center bg-[#0B1220] px-3">
              <div className="h-3 w-24 rounded bg-[#334155]/50" />
            </div>
            <div className="px-3 py-2.5">
              <div className="h-3 w-32 rounded bg-[#334155]/40" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activeFloor.cubicles.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <div
          className="rounded-[6px] border-2 bg-[#1E293B] px-6 py-12 text-center"
          style={{ borderColor: "#334155" }}
        >
          <p
            className="text-[18px] text-[#94A3B8]"
            style={{ fontFamily: "var(--font-vt), VT323, monospace" }}
          >
            ◧ floor idle — no agents yet
          </p>
          <p
            className="mt-1 text-sm text-[#64748B]"
            style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}
          >
            {activeFloor.sessionID.slice(0, 8)} • waiting for signal…
          </p>
        </div>
        {/* R4: 6 vacant cubicles — walled grid gap 2px bg #475569, opacity 100 (dashed) */}
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3 bg-[#475569] p-1 rounded-[8px]">
          {Array.from({ length: 6 }).map((_, i) => (
            <VacantCubicle key={i} index={i} />
          ))}
        </div>
      </div>
    );
  }

  // Separate orchestrator cubicle and filter out "system" agent
  const orchestratorCubicle = activeFloor.cubicles.find((c) => c.agent === "orchestrator");
  const otherCubicles = activeFloor.cubicles.filter(
    (c) => c.agent !== "orchestrator" && c.agent !== "system"
  );

  // Render order: orchestrator first (if exists), then remaining cubicles
  const renderOrder = orchestratorCubicle ? [orchestratorCubicle, ...otherCubicles] : otherCubicles;

  return (
    <motion.div
      className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3 bg-[#475569] p-1 rounded-[8px]"
      variants={staggerContainer}
      initial="initial"
      animate="enter"
    >
      {renderOrder.map((cubicle, i) => (
        <motion.div
          key={cubicle.agent}
          custom={entranceDelay(i)}
          variants={cubicleVariants}
        >
          <CubicleCard cubicle={cubicle} index={i} />
        </motion.div>
      ))}
    </motion.div>
  );
}

const OfficeGrid = memo(OfficeGridInner);
export default OfficeGrid;