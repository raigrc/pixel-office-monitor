"use client";

import type { ReactNode } from "react";

type OfficeFloorProps = {
  children: ReactNode;
  title?: string;
  className?: string;
};

/**
 * OfficeFloor — OLED office floor texture wrapper
 * Base #0F172A + subtle carpet grid (≤12% via .office-floor), baseboard inset,
 * top aisle with door pixel box + muted label. Respects prefers-reduced-motion
 * (CSS-only, no JS animation). Text contrast #F1F5F9 >4.5:1 preserved.
 */
export default function OfficeFloor({ children, title = "OFFICE FLOOR", className = "" }: OfficeFloorProps) {
  return (
    <div
      className={`office-floor relative rounded-[8px] border-2 border-[#334155] bg-[#0F172A] p-3 md:p-4 ${className}`}
      role="region"
      aria-label={title}
    >
      {/* Top aisle — dashed corridor stripe + door pixel art + label */}
      <div className="aisle flex h-2 min-h-[28px] items-center gap-2 border-b border-dashed border-[#334155]/40 mb-3 pb-2">
        {/* door pixel art tile */}
        <img
          src="/sprites/door-tile.png"
          alt=""
          aria-hidden="true"
          className="pixel-img inline-block shrink-0"
          style={{ width: "16px", height: "16px", imageRendering: "pixelated" }}
        />
        <span
          className="tracking-widest text-[#94A3B8]"
          style={{
            fontFamily: "var(--font-pixel), monospace",
            fontSize: "7px",
            lineHeight: "1",
          }}
        >
          {title}
        </span>
        {/* aisle center stripe hint */}
        <span className="ml-auto hidden h-0.5 w-16 rounded bg-[#334155]/30 sm:inline-block" aria-hidden="true" />
      </div>

      {/* content */}
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
