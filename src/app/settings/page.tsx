"use client";
/* eslint-disable react-hooks/set-state-in-effect -- hydrate settings from localStorage (intentional) */

import { useEffect, useState } from "react";
import Link from "next/link";

const LS_KEYS = {
  showPromptPreview: "pixel:showPromptPreview",
  redactPaths: "pixel:redactPaths",
  crt: "pixel:crt",
} as const;

function useBoolSetting(key: string, defaultValue: boolean) {
  const [value, setValue] = useState(defaultValue);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) setValue(raw === "true");
    } catch {}
    setHydrated(true);
  }, [key]);

  const update = (next: boolean) => {
    setValue(next);
    try {
      localStorage.setItem(key, String(next));
      // dispatch storage-like event for same-tab listeners (page.tsx)
      window.dispatchEvent(new StorageEvent("storage", { key, newValue: String(next) }));
      // also custom event for instant sync
      window.dispatchEvent(new CustomEvent("pixel-settings", { detail: { key, value: next } }));
    } catch {}
  };

  return [value, update, hydrated] as const;
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
  id,
}: {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[6px] border bg-[#0B1220] px-4 py-3.5" style={{ borderColor: "#334155" }}>
      <div className="min-w-0 flex-1">
        <div
          className="text-[14px] tracking-wide text-[#F1F5F9]"
          style={{ fontFamily: "var(--font-vt), VT323, monospace", fontSize: "16px" }}
        >
          {label}
        </div>
        {desc && (
          <div
            className="mt-0.5 text-xs leading-relaxed text-[#94A3B8]"
            style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}
          >
            {desc}
          </div>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={[
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 transition-colors duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F172A]",
          checked ? "bg-[#22C55E] border-[#22C55E]" : "bg-[#1E293B] border-[#334155]",
        ].join(" ")}
      >
        <span
          className={[
            "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200",
            checked ? "translate-x-5" : "translate-x-1",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const [showPromptPreview, setShowPromptPreview, hydrated1] = useBoolSetting(LS_KEYS.showPromptPreview, true);
  const [redactPaths, setRedactPaths, hydrated2] = useBoolSetting(LS_KEYS.redactPaths, false);
  const [crtEnabled, setCrtEnabled, hydrated3] = useBoolSetting(LS_KEYS.crt, false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(mql.matches);
    update();
    if (mql.addEventListener) mql.addEventListener("change", update);
    else (mql as unknown as { addListener: (cb: () => void) => void }).addListener(update);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", update);
      else (mql as unknown as { removeListener: (cb: () => void) => void }).removeListener(update);
    };
  }, []);

  const hydrated = hydrated1 && hydrated2 && hydrated3;

  return (
    <main className="mx-auto flex w-full max-w-[880px] flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1
            className="text-[18px] tracking-[0.08em] text-[#F1F5F9]"
            style={{ fontFamily: "var(--font-pixel), monospace", fontSize: "14px", lineHeight: "16px" }}
          >
            SETTINGS
          </h1>
          <p
            className="mt-1 text-sm text-[#94A3B8]"
            style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}
          >
            OLED • Pixel Office Monitor — local only, stored in localStorage.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center rounded-md border bg-[#1E293B] px-3 py-2 text-xs font-medium text-[#F1F5F9] transition-colors duration-200 hover:bg-[#24324D] hover:border-[#475569] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F172A]"
          style={{ borderColor: "#334155", fontFamily: "var(--font-inter), Inter, sans-serif" }}
        >
          ← Back to Office
        </Link>
      </div>

      {!hydrated ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[72px] animate-pulse rounded-[6px] border-2 bg-[#1E293B]" style={{ borderColor: "#334155" }} />
          ))}
        </div>
      ) : (
        <>
          {/* Display */}
          <section className="flex flex-col gap-3">
            <h2
              className="text-[16px] tracking-wide text-[#F1F5F9]"
              style={{ fontFamily: "var(--font-vt), VT323, monospace" }}
            >
              ▸ display
            </h2>
            <ToggleRow
              id="showPromptPreview"
              label="Show prompt preview"
              desc="When off, office cards hide the 40-char prompt line. Server still receives it; this only trims client render. Controlled by settings.showPromptPreview (localStorage)."
              checked={showPromptPreview}
              onChange={setShowPromptPreview}
            />
            <ToggleRow
              id="redactPaths"
              label="Redact file paths"
              desc="Replaces absolute paths ( /foo/bar , C:\Users\… ) with […] in prompt previews. Useful when screen-sharing."
              checked={redactPaths}
              onChange={setRedactPaths}
            />
            <ToggleRow
              id="crtToggle"
              label="CRT scanline overlay"
              desc="6% subtle scanlines over the office grid. Toggle writes pixel:crt and adds .crt class on the main container."
              checked={crtEnabled}
              onChange={setCrtEnabled}
            />
          </section>

          {/* Motion */}
          <section className="flex flex-col gap-3">
            <h2
              className="text-[16px] tracking-wide text-[#F1F5F9]"
              style={{ fontFamily: "var(--font-vt), VT323, monospace" }}
            >
              ▸ motion & a11y
            </h2>
            <div className="rounded-[6px] border bg-[#1E293B] px-4 py-4" style={{ borderColor: "#334155" }}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div
                    className="text-[16px] text-[#F1F5F9]"
                    style={{ fontFamily: "var(--font-vt), VT323, monospace" }}
                  >
                    Reduce motion
                  </div>
                  <div
                    className="text-xs text-[#94A3B8]"
                    style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}
                  >
                    Mirrors OS <code className="rounded bg-[#0F172A] px-1 py-0.5 text-[#F1F5F9]">prefers-reduced-motion: reduce</code>. When active, sprite ticks (200ms) and Zzz float (1800ms) freeze. Read-only; change in OS settings.
                  </div>
                </div>
                <span
                  className={[
                    "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
                    prefersReducedMotion ? "border-[#22C55E]/30 bg-[#22C55E]/10 text-[#22C55E]" : "border-[#334155] bg-[#0B1220] text-[#94A3B8]",
                  ].join(" ")}
                  style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}
                >
                  {prefersReducedMotion ? "● reduce: on" : "○ reduce: off"}
                </span>
              </div>
              <p
                className="mt-3 text-xs leading-relaxed text-[#64748B]"
                style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}
              >
                Sprites honor <code className="text-[#94A3B8]">prefers-reduced-motion</code> automatically; no toggle needed. Settings page just surfaces the current value.
              </p>
            </div>
          </section>

          {/* Info */}
          <section className="rounded-[6px] border-2 bg-[#1E293B] px-4 py-4" style={{ borderColor: "#334155" }}>
            <h3
              className="text-[13px] tracking-widest text-[#94A3B8]"
              style={{ fontFamily: "var(--font-pixel), monospace", fontSize: "8px" }}
            >
              NOTES
            </h3>
            <ul
              className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-[#64748B]"
              style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}
            >
              <li>
                <code className="rounded bg-[#0F172A] px-1 py-0.5 text-[#94A3B8]">showPromptPreview=false</code> only trims client display; plugin still POSTs prompt (debounced 300ms, 200-char cap). To fully omit prompt server-side, toggle would need to gate plugin payload — see plugin header note.
              </li>
              <li>
                <code className="rounded bg-[#0F172A] px-1 py-0.5 text-[#94A3B8]">redactPaths</code> does client-side regex replacement; raw store keeps original for debugging.
              </li>
              <li>
                CRT overlay is CSS only (<code className="text-[#94A3B8]">.crt::after</code> 6% scanlines). No image cost.
              </li>
              <li>
                Keys: <code className="text-[#94A3B8]">pixel:showPromptPreview</code>, <code className="text-[#94A3B8]">pixel:redactPaths</code>, <code className="text-[#94A3B8]">pixel:crt</code>. Clear via devtools → Application → Local Storage.
              </li>
            </ul>
          </section>

          <footer className="pt-2 text-center">
            <p
              className="text-[11px] tracking-widest text-[#475569]"
              style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}
            >
              OLED #0F172A • VT323 headings • localStorage only — no server write
            </p>
          </footer>
        </>
      )}
    </main>
  );
}
