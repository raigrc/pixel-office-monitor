"use client";
/* eslint-disable react-hooks/set-state-in-effect -- hydrate settings from localStorage (intentional) */

import { useEffect, useState } from "react";
import Link from "next/link";
import OpenCodeDiscoveryPanel from "@/components/OpenCodeDiscoveryPanel";

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
    <div className="flex items-center justify-between gap-4 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <div
          className="text-[14px] tracking-wide text-[var(--text)]"
          style={{ fontFamily: "var(--font-vt), VT323, monospace", fontSize: "16px" }}
        >
          {label}
        </div>
        {desc && (
          <div
            className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]"
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
          "relative inline-flex h-11 w-12 shrink-0 cursor-pointer items-center rounded-[4px] border-2 transition-colors duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--selection)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas)]",
          checked ? "border-[var(--working)] bg-[var(--working)]" : "border-[var(--strong-border)] bg-[var(--raised)]",
        ].join(" ")}
      >
        <span
          className={[
            "inline-block h-5 w-5 transform rounded-[2px] bg-[var(--canvas)] transition-transform duration-200",
            checked ? "translate-x-6" : "translate-x-1",
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
             className="text-[18px] tracking-[0.08em] text-[var(--text)]"
            style={{ fontFamily: "var(--font-pixel), monospace", fontSize: "14px", lineHeight: "16px" }}
          >
            SETTINGS
          </h1>
          <p
            className="mt-1 text-sm text-[var(--muted)]"
            style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}
          >
            Display preferences stay in localStorage. OpenCode discovery uses a separate read-only server connection.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-medium text-[var(--text)] transition-colors duration-200 hover:border-[var(--strong-border)] hover:bg-[var(--raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--selection)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas)]"
          style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}
        >
          <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
          Back to Office
        </Link>
      </div>

      {!hydrated ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[72px] animate-pulse rounded-[4px] border-2 border-[var(--border)] bg-[var(--surface)]" />
          ))}
        </div>
      ) : (
        <>
          {/* Display */}
          <section className="flex flex-col gap-3">
            <h2
              className="text-[16px] tracking-wide text-[var(--text)]"
              style={{ fontFamily: "var(--font-vt), VT323, monospace" }}
            >
              Display
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
              className="text-[16px] tracking-wide text-[var(--text)]"
              style={{ fontFamily: "var(--font-vt), VT323, monospace" }}
            >
              Motion and accessibility
            </h2>
            <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div
                    className="text-[16px] text-[var(--text)]"
                    style={{ fontFamily: "var(--font-vt), VT323, monospace" }}
                  >
                    Reduce motion
                  </div>
                  <div
                    className="text-xs text-[var(--muted)]"
                    style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}
                  >
                    Mirrors OS <code className="rounded-[2px] bg-[var(--canvas)] px-1 py-0.5 text-[var(--text)]">prefers-reduced-motion: reduce</code>. When active, status motion and transitions stop. Read-only; change in OS settings.
                  </div>
                </div>
                <span
                  className={[
                    "inline-flex min-h-11 items-center gap-2 rounded-[4px] border px-3 text-xs font-semibold",
                    prefersReducedMotion ? "border-[var(--success)] bg-[var(--raised)] text-[var(--success)]" : "border-[var(--border)] bg-[var(--canvas)] text-[var(--muted)]",
                  ].join(" ")}
                  style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}
                >
                  <span aria-hidden="true" className={`h-2 w-2 rounded-full ${prefersReducedMotion ? "bg-[var(--success)]" : "bg-[var(--idle)]"}`} />
                  Reduce: {prefersReducedMotion ? "on" : "off"}
                </span>
              </div>
              <p
                className="mt-3 text-xs leading-relaxed text-[var(--muted)]"
                style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}
              >
                Sprites honor <code className="text-[var(--muted)]">prefers-reduced-motion</code> automatically; no toggle needed. Settings page surfaces current value.
              </p>
            </div>
          </section>

          <OpenCodeDiscoveryPanel />

          {/* Info */}
          <section className="rounded-[4px] border-2 border-[var(--border)] bg-[var(--surface)] px-4 py-4">
            <h3
              className="text-[13px] tracking-widest text-[var(--muted)]"
              style={{ fontFamily: "var(--font-pixel), monospace", fontSize: "8px" }}
            >
              NOTES
            </h3>
            <ul
              className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-[var(--muted)]"
              style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}
            >
              <li>
                <code className="rounded-[2px] bg-[var(--canvas)] px-1 py-0.5 text-[var(--muted)]">showPromptPreview=false</code> only trims client display; plugin still POSTs prompt (debounced 300ms, 200-char cap). To fully omit prompt server-side, toggle would need to gate plugin payload — see plugin header note.
              </li>
              <li>
                <code className="rounded-[2px] bg-[var(--canvas)] px-1 py-0.5 text-[var(--muted)]">redactPaths</code> does client-side regex replacement; raw store keeps original for debugging.
              </li>
              <li>
                CRT overlay is CSS only (<code className="text-[var(--muted)]">.crt::after</code> 6% scanlines). No image cost.
              </li>
              <li>
                Keys: <code className="text-[var(--muted)]">pixel:showPromptPreview</code>, <code className="text-[var(--muted)]">pixel:redactPaths</code>, <code className="text-[var(--muted)]">pixel:crt</code>. Clear via devtools → Application → Local Storage.
              </li>
            </ul>
          </section>

          <footer className="pt-2 text-center">
            <p
              className="text-[11px] tracking-widest text-[var(--muted)]"
              style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}
            >
              Warm charcoal shell • Local display preferences • Manual OpenCode discovery
            </p>
          </footer>
        </>
      )}
    </main>
  );
}
