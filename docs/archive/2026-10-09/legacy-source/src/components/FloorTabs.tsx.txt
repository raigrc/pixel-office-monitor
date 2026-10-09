"use client";

import type { FloorDTO } from "@/lib/monitor-store";
import { formatProject } from "@/lib/format";

type FloorTabsProps = {
  floors: FloorDTO[];
  activeId: string | null;
  onSelect: (id: string) => void;
};

export default function FloorTabs({ floors, activeId, onSelect }: FloorTabsProps) {
  // Empty / loading skeleton
  if (!floors || floors.length === 0) {
    return (
      <div
        className="flex gap-2 overflow-x-auto pb-2"
        role="tablist"
        aria-label="Office floors"
        style={{ scrollbarWidth: "thin" }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[44px] min-w-[160px] flex-1 animate-pulse rounded-[6px] border-2 bg-[#1E293B]"
            style={{ borderColor: "#334155", minHeight: "44px" }}
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className="flex gap-2 overflow-x-auto overflow-y-hidden pb-2 snap-x snap-mandatory"
      role="tablist"
      aria-label="Office floors"
      style={{ scrollbarWidth: "thin" }}
    >
      {floors.map((floor) => {
        const isActive = floor.sessionID === activeId;
        const isWorking = floor.status === "working";
        const label = floor.title?.trim() ? floor.title.trim().slice(0, 28) : formatProject(floor.project);
        const shortId = floor.sessionID.slice(0, 6);

        return (
          <button
            key={floor.sessionID}
            role="tab"
            aria-selected={isActive}
            aria-label={`Floor ${label} ${shortId}, ${floor.status}, ${floor.cubicles.length} agents`}
            onClick={() => onSelect(floor.sessionID)}
            className={[
              "group relative inline-flex min-h-[44px] min-w-[160px] shrink-0 snap-start items-center gap-2.5 rounded-[6px] border-2 px-3 py-2 text-left transition-colors duration-200 cursor-pointer",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F172A]",
              isActive
                ? "bg-[#24324D] ring-1 ring-[#3B82F6]/30"
                : "bg-[#1E293B] hover:bg-[#24324D] hover:border-[#475569]",
            ].join(" ")}
            style={{
              borderColor: isActive ? "#3B82F6" : "#334155",
            }}
          >
            {/* Status dot */}
            <span
              aria-hidden="true"
              className={[
                "inline-block h-2.5 w-2.5 shrink-0 rounded-full border",
                isWorking ? "bg-[#22C55E] border-[#22C55E] shadow-[0_0_6px_rgba(34,197,94,0.6)]" : "bg-[#64748B] border-[#475569]",
                isWorking ? "animate-working" : "",
              ].join(" ")}
            />

            <span className="flex min-w-0 flex-col leading-none">
              <span
                className="truncate text-[14px] font-normal tracking-wide text-[#F1F5F9]"
                style={{ fontFamily: "var(--font-vt), VT323, monospace", lineHeight: "14px" }}
                title={label}
              >
                {label}
              </span>
              <span
                className="truncate text-[11px] text-[#94A3B8]"
                style={{ fontFamily: "var(--font-inter), Inter, sans-serif", lineHeight: "12px" }}
              >
                {shortId} • {floor.cubicles.length}
              </span>
            </span>

            {/* Active underline accent */}
            {isActive && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-2 -bottom-[1px] h-[2px] rounded-full bg-[#3B82F6]"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
