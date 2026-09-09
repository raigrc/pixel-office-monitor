"use client";

type AgentTooltipProps = {
  label: string;
  role: string;
  isWorking: boolean;
  prompt?: string;
  lastTool?: string;
  sinceLabel: string;
  visible?: boolean; // For mobile tap visibility
};

/**
 * AgentTooltip — pixel art tooltip showing agent info on hover (desktop) or tap (mobile).
 * Appears on group-hover with opacity transition on desktop, or when `visible` prop is true on mobile.
 * Uses Press_Start_2P for name, VT323 for role/status.
 */
export default function AgentTooltip({
  label,
  role,
  isWorking,
  prompt,
  lastTool,
  sinceLabel,
  visible = false,
}: AgentTooltipProps) {
  const statusText = isWorking ? "WORKING" : "IDLE";
  const detailText = prompt
    ? truncate(prompt, 40)
    : lastTool
      ? truncate(lastTool, 40)
      : isWorking
        ? "working\u2026"
        : "sleeping";

  const shouldShow = visible;

  return (
    <div
      className={[
        "pointer-events-none absolute left-1/2 top-2 z-20 -translate-x-1/2",
        "w-[200px] rounded-[4px] border-2 px-3 py-2.5",
        "opacity-0 transition-opacity duration-150",
        "group-hover:opacity-100",
        shouldShow ? "opacity-100" : "",
        isWorking ? "shadow-[0_0_12px_rgba(34,197,94,0.3)]" : "",
      ].join(" ")}
      style={{
        borderColor: isWorking ? "rgba(34,197,94,0.5)" : "#334155",
        backgroundColor: "#1E293B",
      }}
      role="tooltip"
    >
      {/* Agent name — pixel font */}
      <div
        className="truncate text-[8px] leading-none text-[#F1F5F9]"
        style={{ fontFamily: "var(--font-pixel), monospace" }}
      >
        {label}
      </div>

      {/* Role — VT323 */}
      <div
        className="mt-1 truncate text-[14px] leading-none text-[#94A3B8]"
        style={{ fontFamily: "var(--font-vt), VT323, monospace" }}
      >
        {role}
      </div>

      {/* Status badge */}
      <div className="mt-1.5 flex items-center gap-1.5">
        <span
          className={[
            "inline-block h-1.5 w-1.5 rounded-full",
            isWorking ? "bg-[#22C55E] animate-working" : "bg-[#64748B]",
          ].join(" ")}
          aria-hidden="true"
        />
        <span
          className="text-[8px] tracking-widest"
          style={{
            fontFamily: "var(--font-pixel), monospace",
            color: isWorking ? "#22C55E" : "#94A3B8",
            fontSize: "7px",
          }}
        >
          {statusText}
        </span>
        <span
          className="ml-auto text-[12px] text-[#64748B]"
          style={{ fontFamily: "var(--font-vt), VT323, monospace" }}
        >
          {sinceLabel}
        </span>
      </div>

      {/* Prompt or tool line */}
      <div
        className="mt-1.5 truncate text-[12px] leading-tight text-[#64748B]"
        style={{ fontFamily: "var(--font-vt), VT323, monospace" }}
        title={prompt || lastTool || ""}
      >
        {detailText}
      </div>
    </div>
  );
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "\u2026";
}
