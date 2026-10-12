"use client";

import { useEffect, useRef, useState } from "react";
import { threeEngine } from "@/lib/scene/three-engine";
import { loadSettings, applySettingsToEngine } from "@/lib/scene/settings3d";
import type { WorldState } from "@/lib/world/world-types";
import type { ActivityModel } from "@/lib/activity/activity-model";
import { decideWorldSync } from "@/lib/scene/scene-lifecycle";

interface ThreeCanvasProps {
  world: WorldState;
  activity: ActivityModel;
  activeSessionId: string | null;
  selectedActorId: string | null;
  onAgentClick: (actorId: string) => void;
  active: boolean;
  streamHydrated: boolean;
}

export default function ThreeCanvas({ world, activity, activeSessionId, selectedActorId, onAgentClick, active, streamHydrated }: ThreeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hydratedEngineGeneration = useRef<number | null>(null);
  const [identifiedActorId, setIdentifiedActorId] = useState<string | null>(null);
  const sessionKey = world.sessions.map((session) => session.id).sort().join(",");
  const selectableActorIds = world.agents
    .filter((agent) => agent.worldId === activeSessionId)
    .map((agent) => agent.id);
  const identifiedActor = activity.actors.find((entry) => entry.actor.actorId === identifiedActorId);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    threeEngine.setPaused(true);
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

  // Initial snapshot and hidden updates represent current truth, not arrivals.
  useEffect(() => {
    if (!threeEngine.isMounted()) return;
    const engineGeneration = threeEngine.getMountGeneration();
    const decision = decideWorldSync(
      streamHydrated,
      hydratedEngineGeneration.current === engineGeneration,
      active,
    );
    if (decision.kind === "wait") {
      threeEngine.setPaused(true);
      return;
    }
    threeEngine.syncWorld(world, { animateEntrances: decision.animateEntrances });
    hydratedEngineGeneration.current = engineGeneration;
    threeEngine.setPaused(!active);
  }, [world, active, streamHydrated]);

  useEffect(() => {
    if (!threeEngine.isMounted()) return;
    threeEngine.syncActivity(activity);
  }, [activity]);

  useEffect(() => {
    if (activeSessionId && threeEngine.isMounted()) {
      threeEngine.focusSession(activeSessionId);
    }
  }, [activeSessionId, sessionKey]);

  useEffect(() => {
    if (threeEngine.isMounted()) threeEngine.setSelectedAgent(selectedActorId);
  }, [selectedActorId]);

  return (
    <div
      onClick={(event) => {
        if (!active) return;
        const actorId = threeEngine.pickAgent(event.clientX, event.clientY);
        if (actorId) onAgentClick(actorId);
      }}
      onPointerMove={(event) => {
        if (active) setIdentifiedActorId(threeEngine.pickAgent(event.clientX, event.clientY));
      }}
      onPointerLeave={() => setIdentifiedActorId(null)}
      onFocus={() => setIdentifiedActorId((current) => current ?? selectableActorIds[0] ?? null)}
      onKeyDown={(event) => {
        if (!active) return;
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
      tabIndex={active ? 0 : -1}
      aria-hidden={!active}
      aria-label="3D office agents. Use arrow keys to inspect agents and Enter to select."
      className="absolute inset-0"
      style={{ zIndex: 10, width: '100%', height: '100%', touchAction: 'none' }}
    >
      <div ref={containerRef} className="absolute inset-0" />
      {identifiedActor && (
        <div
          className="pointer-events-none absolute left-3 top-3 z-[1] rounded-[4px] border border-[var(--strong-border)] bg-[color-mix(in_srgb,var(--canvas)_88%,transparent)] px-3 py-2 text-xs text-[var(--text)] shadow-[2px_2px_0_var(--surface)]"
          aria-live="polite"
        >
          <div className="font-semibold">{identifiedActor.actor.displayName}</div>
          <div className="text-[var(--muted)]">
            {identifiedActor.actor.agentKey} / {identifiedActor.pose} / {identifiedActor.activeWorkCount} active
          </div>
        </div>
      )}
    </div>
  );
}
