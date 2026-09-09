"use client";

type VacantCubicleProps = {
  index?: number;
  compact?: boolean;
};

/**
 * VacantCubicle — vacant desk placeholder using cubicle-idle.png.
 * Same dimensions as CubicleCard. Desaturated and dimmed.
 */
export default function VacantCubicle({ index = 0, compact = false }: VacantCubicleProps) {
  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-[6px] pixelated ${compact ? "h-full min-h-0" : ""}`}
      style={{
        minHeight: compact ? undefined : "212px",
        filter: "saturate(0.3) brightness(0.6)",
        opacity: 0.7,
      }}
      aria-label={`vacant cubicle ${index + 1}`}
      data-vacant-index={index}
    >
      {/* Cubicle idle background */}
      <img
        src="/sprites/cubicle-idle.png"
        alt=""
        aria-hidden="true"
        className="pixel-img pointer-events-none absolute inset-0 h-full w-full object-cover"
        style={{ imageRendering: "pixelated" }}
      />

      {/* Content overlay */}
      <div className="relative z-10 flex h-full flex-col">
        {/* Header — transparent */}
        <div className={`flex items-center border-b border-dashed border-[#334155]/30 bg-[#0F172A]/40 ${compact ? "h-9 gap-1.5 px-2 py-1" : "h-[53px] gap-2.5 px-3 py-2.5"}`}>
          {/* Ghost icon V pixel box dashed */}
          <div
            aria-hidden="true"
            className={`flex shrink-0 items-center justify-center rounded-[4px] border border-dashed bg-[#0B1220]/40 text-[#475569] pixelated cursor-default select-none ${compact ? "h-6 w-6" : "h-8 w-8"}`}
            style={{
              borderColor: "rgba(51,65,85,0.4)",
              fontFamily: "var(--font-pixel), monospace",
              fontSize: "10px",
              lineHeight: 1,
              imageRendering: "pixelated",
            }}
            title="vacant"
          >
            V
          </div>

          <div className="min-w-0 flex-1">
            <div
              className="truncate tracking-widest text-[#475569]"
              style={{ fontFamily: "var(--font-pixel), monospace", fontSize: "7px", lineHeight: 1 }}
            >
              VACANT
            </div>
            <div
              className="truncate text-[11px] leading-none text-[#475569]/70"
              style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}
            >
              empty
            </div>
          </div>

          <span
            className={`shrink-0 items-center rounded-full border border-dashed px-2 py-0.5 text-[10px] font-bold leading-none tracking-widest text-[#475569]/70 ${compact ? "hidden" : "inline-flex"}`}
            style={{
              borderColor: "rgba(51,65,85,0.4)",
              fontFamily: "var(--font-pixel), monospace",
              fontSize: "7px",
              background: "rgba(11,18,32,0.4)",
            }}
          >
            EMPTY
          </span>
        </div>

        {/* Body — ghost desk outline */}
        <div className={`flex min-h-0 flex-1 flex-col items-center justify-center bg-[#0B1220]/30 ${compact ? "gap-0.5 px-1 py-1" : "h-28 gap-2 px-3 py-3"}`}>
          <div
            aria-hidden="true"
            className={`flex items-center justify-center rounded-[4px] border border-dashed bg-transparent ${compact ? "h-5 w-16" : "h-14 w-24"}`}
            style={{ borderColor: "rgba(51,65,85,0.35)" }}
          >
            <div className="flex flex-col items-center gap-1">
              <div className="h-[2px] w-10 rounded bg-[#334155]/30" aria-hidden="true" />
              <div className="h-1 w-12 rounded border border-dashed bg-[#0B1220]/40" style={{ borderColor: "rgba(51,65,85,0.25)" }} aria-hidden="true" />
            </div>
          </div>
          <span
            className={`text-center tracking-widest text-[#334155] ${compact ? "hidden" : ""}`}
            style={{ fontFamily: "var(--font-pixel), monospace", fontSize: "7px" }}
            aria-hidden="true"
          >
            \u2014 empty \u2014
          </span>
        </div>

        {/* Desk rail — muted dashed */}
        <div
          aria-hidden="true"
          className="h-[3px] w-full shrink-0 border-t border-dashed bg-[#475569]/20"
          style={{ borderColor: "rgba(51,65,85,0.3)" }}
        />

        {/* Footer */}
        <div className={`flex-col gap-1 px-3 py-2.5 bg-[#0F172A]/40 ${compact ? "hidden" : "flex"}`}>
          <div
            className="truncate text-[12px] leading-none text-[#475569]"
            style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}
          >
            empty desk \u2014 awaiting agent
          </div>
          <div
            className="truncate pt-0.5 tracking-widest text-[#334155]/70"
            style={{ fontFamily: "var(--font-pixel), monospace", fontSize: "7px" }}
          >
            vacant \u2022 {String(index + 1).padStart(2, "0")}
          </div>
        </div>
      </div>
    </article>
  );
}
