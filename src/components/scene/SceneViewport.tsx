"use client";

import { createContext, useContext, useEffect, useRef, useState, Suspense } from "react";
import dynamic from "next/dynamic";
import { OFFICE_DIMENSIONS } from "@/lib/scene/office-layout";
import type { WorldState } from "@/lib/world/world-types";
import type { ActivityModel } from "@/lib/activity/activity-model";
import { toggleSceneView, type SceneViewState } from "@/lib/scene/scene-lifecycle";

/** Current camera zoom — lets scene children size HUD text in screen px. */
export const CameraZoomContext = createContext(1);
export const useCameraZoom = () => useContext(CameraZoomContext);

interface SceneViewportProps {
  children: React.ReactNode;
  className?: string;
  world: WorldState;
  activity: ActivityModel;
  activeSessionId: string | null;
  selectedActorId: string | null;
  onAgentClick: (actorId: string) => void;
  streamHydrated: boolean;
  sidebarOpen?: boolean;
}

const ThreeCanvas = dynamic(() => import("./ThreeCanvas"), { ssr: false });

/**
 * SceneViewport — static whole-room camera with optional 3D view.
 * Fits the entire 512×384 office into the container (no pan, no zoom),
 * centers it, and bleeds the office floor texture underneath so no
 * letterbox color ever shows.
 */
export default function SceneViewport({ children, className, world, activity, activeSessionId, selectedActorId, onAgentClick, streamHydrated, sidebarOpen = true }: SceneViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const [sceneView, setSceneView] = useState<SceneViewState>({ mode: "2d", hasMounted3D: false });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const compute = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const desktop = window.matchMedia("(min-width: 1024px)").matches;
      const inset = desktop ? (sidebarOpen ? 28 : 12) : 8;
      const s = Math.min(
        Math.max(1, rect.width - inset * 2) / OFFICE_DIMENSIONS.width,
        Math.max(1, rect.height - inset * 2) / OFFICE_DIMENSIONS.height
      );
      setView({
        scale: s,
        x: (rect.width - OFFICE_DIMENSIONS.width * s) / 2,
        y: (rect.height - OFFICE_DIMENSIONS.height * s) / 2,
      });
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [sidebarOpen]);

  const toggleViewMode = () => {
    setSceneView(toggleSceneView);
  };

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className ?? ""}`}
      style={{ height: "100%", width: "100%" }}
      role="region"
      aria-label="Office scene viewport"
      data-scene-view={sceneView.mode}
    >
      {/* Warm charcoal pixel framing separates room from unused viewport space. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          backgroundColor: "var(--canvas)",
          backgroundImage: [
            "linear-gradient(color-mix(in srgb, var(--border) 24%, transparent) 1px, transparent 1px)",
            "linear-gradient(90deg, color-mix(in srgb, var(--border) 24%, transparent) 1px, transparent 1px)",
          ].join(", "),
          backgroundRepeat: "repeat",
          backgroundSize: "16px 16px",
        }}
      />

      {/* 2D Content */}
      <CameraZoomContext.Provider value={view.scale}>
        <div
          data-office-frame="2d"
          data-office-scale={view.scale}
          inert={sceneView.mode !== "2d"}
          aria-hidden={sceneView.mode !== "2d"}
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            transformOrigin: "0 0",
            willChange: "transform",
            opacity: sceneView.mode === "2d" ? 1 : 0,
            pointerEvents: sceneView.mode === "2d" ? "auto" : "none",
            transition: "transform var(--dur-ui) var(--ease-in-out), opacity var(--dur-ui) var(--ease-out)",
          }}
        >
          {children}
        </div>
      </CameraZoomContext.Provider>

      {sceneView.hasMounted3D && (
        <div
          className="absolute inset-0"
          inert={sceneView.mode !== "3d"}
          aria-hidden={sceneView.mode !== "3d"}
          style={{
            visibility: sceneView.mode === "3d" ? "visible" : "hidden",
            pointerEvents: sceneView.mode === "3d" ? "auto" : "none",
          }}
        >
          <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center bg-[var(--canvas)] text-[var(--text)]">Loading 3D...</div>}>
            <ThreeCanvas
              world={world}
              activity={activity}
              activeSessionId={activeSessionId}
              selectedActorId={selectedActorId}
              onAgentClick={onAgentClick}
              active={sceneView.mode === "3d"}
              streamHydrated={streamHydrated}
            />
          </Suspense>
        </div>
      )}

      {/* Fixed above page chrome: main carries z-[1]. */}
      <button
        type="button"
        onClick={toggleViewMode}
        className="fixed right-3 z-[60] inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-[4px] border-2 border-[var(--strong-border)] bg-[var(--surface)] px-3 text-[10px] font-bold tracking-wider text-[var(--text)] transition-colors hover:bg-[var(--raised)] focus-visible:ring-2 focus-visible:ring-[var(--selection)]"
        style={{
          top: "4.25rem",
          fontFamily: "var(--font-pixel), monospace",
          boxShadow: "2px 2px 0 var(--canvas)",
        }}
        aria-label={`Switch to ${sceneView.mode === "2d" ? "3D" : "2D"} view`}
      >
        {sceneView.mode === "2d" ? "3D" : "2D"}
      </button>
    </div>
  );
}
