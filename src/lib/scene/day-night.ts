"use client";

import { useEffect, useState } from "react";

export type DayNightPhase = "day" | "night";

/** Day window 06:00–18:00 local. Pure clock, no toggle (per spec). */
export function getDayNightPhase(date: Date = new Date()): DayNightPhase {
  const h = date.getHours();
  return h >= 6 && h < 18 ? "day" : "night";
}

export function isNight(date: Date = new Date()): boolean {
  return getDayNightPhase(date) === "night";
}

/**
 * Client clock phase. Re-checks every 60s + on visibility return.
 * SSR-safe: defaults day on server, corrects on mount.
 */
export function useDayNight(): DayNightPhase {
  const [phase, setPhase] = useState<DayNightPhase>("day");
  useEffect(() => {
    const sync = () => setPhase(getDayNightPhase(new Date()));
    sync();
    const id = setInterval(sync, 60_000);
    const onVis = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
  return phase;
}
