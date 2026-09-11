"use client";

import { useEffect, useState } from "react";
import { deriveTimeOfDayFromDate } from "./lighting-time";

export type DayNightPhase = "day" | "night";

/**
 * Day window 06:00-18:00 local. Binary UI phase stays compatible; only the
 * clock conversion is shared with the 3D sky (see lighting-time).
 */
export function getDayNightPhase(date: Date = new Date()): DayNightPhase {
  const t = deriveTimeOfDayFromDate(date);
  return t >= 6 && t < 18 ? "day" : "night";
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
