"use client";

import { useEffect, useRef, useState } from "react";
import { threeEngine } from "@/lib/scene/three-engine";
import { loadSettings, applySettingsToEngine } from "@/lib/scene/settings3d";
import type { WorldState } from "@/lib/world/world-types";
import type { ActivityModel } from "@/lib/activity/activity-model";

interface ThreeCanvasProps {
  world: WorldState;
  activity: ActivityModel;
  activeSessionId: string | null;
  onAgentClick: (actorId: string) => void;
}

export default function ThreeCanvas({ world, activity, activeSessionId, onAgentClick }: ThreeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [identifiedActorId, setIdentifiedActorId] = useState<string | null>(null);
  const sessionKey = world.sessions.map((session) => session.id).sort().join(",");
  const selectableActorIds = world.agents.map((agent) => agent.id);
  const identifiedActor = activity.actors.find((entry) => entry.actor.actorId === identifiedActorId);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    threeEngine.mount(el);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncReducedMotion = () => threeEngine.setReducedMotion(reducedMotion.matches);
    syncReducedMotion();
    reducedMotion.addEventListener("change", syncReducedMotion);
    // Saved quality, bloom, sky, and planet choices apply at mount.
    applySettingsToEngine(threeEngine, loadSettings());
    threeEngine.resize();
    const ro = new ResizeObserver(() => threeEngine.resize());
    ro.observe(el);
    const handleResize = () => threeEngine.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      ro.disconnect();
      reducedMotion.removeEventListener("change", syncReducedMotion);
      window.removeEventListener("resize", handleResize);
      threeEngine.unmount();
    };
  }, []);

  // Single initial sync: this effect also runs on mount, after the mount
  // effect above, so no explicit syncWorld call is needed there. Every
  // world change reconciles exactly once.
  useEffect(() => {
    if (!threeEngine.isMounted()) return;
    threeEngine.syncWorld(world);
  }, [world]);

  useEffect(() => {
    if (!threeEngine.isMounted()) return;
    threeEngine.syncActivity(activity);
  }, [activity]);

  useEffect(() => {
    if (activeSessionId && threeEngine.isMounted()) {
      threeEngine.focusSession(activeSessionId);
    }
  }, [activeSessionId, sessionKey]);

  return (
    <div
      onClick={(event) => {
        const actorId = threeEngine.pickAgent(event.clientX, event.clientY);
        if (actorId) onAgentClick(actorId);
      }}
      onPointerMove={(event) => setIdentifiedActorId(threeEngine.pickAgent(event.clientX, event.clientY))}
      onPointerLeave={() => setIdentifiedActorId(null)}
      onFocus={() => setIdentifiedActorId((current) => current ?? selectableActorIds[0] ?? null)}
      onKeyDown={(event) => {
        if (selectableActorIds.length === 0) return;
        const currentIndex = Math.max(0, selectableActorIds.indexOf(identifiedActorId ?? ""));
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          event.preventDefault();
          setIdentifiedActorId(selectableActorIds[(currentIndex + 1) % selectableActorIds.length]);
        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          event.preventDefault();
          setIdentifiedActorId(selectableActorIds[(currentIndex - 1 + selectableActorIds.length) % selectableActorIds.length]);
        } else if ((event.key === "Enter" || event.key === " ") && identifiedActorId) {
          event.preventDefault();
          onAgentClick(identifiedActorId);
        }
      }}
      tabIndex={0}
      aria-label="3D office agents. Use arrow keys to inspect agents and Enter to select."
      className="absolute inset-0"
      style={{ zIndex: 10, width: '100%', height: '100%', touchAction: 'none' }}
    >
      <div ref={containerRef} className="absolute inset-0" />
      {identifiedActor && (
        <div
          className="pointer-events-none absolute left-3 top-3 z-[1] rounded border border-white/20 bg-slate-950/85 px-3 py-2 text-xs text-white"
          aria-live="polite"
        >
          <div className="font-semibold">{identifiedActor.actor.displayName}</div>
          <div className="text-slate-300">
            {identifiedActor.actor.agentKey} / {identifiedActor.pose} / {identifiedActor.activeWorkCount} active
          </div>
        </div>
      )}
    </div>
  );
}
