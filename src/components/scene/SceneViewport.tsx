"use client";

import { createContext, useContext, useEffect, useRef, useState, Suspense } from "react";
import dynamic from "next/dynamic";
import { OFFICE_DIMENSIONS } from "@/lib/scene/office-layout";
import type { WorldState } from "@/lib/world/world-types";
import type { ActivityModel } from "@/lib/activity/activity-model";

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
  sidebarOpen?: boolean;
}

const ThreeCanvas = dynamic(() => import("./ThreeCanvas"), { ssr: false });

/**
 * SceneViewport — static whole-room camera with optional 3D view.
 * Fits the entire 384×384 office into the container (no pan, no zoom),
 * centers it, and bleeds the office floor texture underneath so no
 * letterbox color ever shows.
 */
export default function SceneViewport({ children, className, world, activity, activeSessionId, selectedActorId, onAgentClick, sidebarOpen = true }: SceneViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");

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
    setViewMode((prev) => (prev === "2d" ? "3d" : "2d"));
  };

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className ?? ""}`}
      style={{ height: "100%", width: "100%" }}
      role="img"
      aria-label="Office scene viewport"
    >
      {/* Dark framing separates finite office walls from unused viewport space. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          backgroundColor: "#0B1220",
          backgroundImage: [
            "linear-gradient(rgba(71, 85, 105, 0.12) 1px, transparent 1px)",
            "linear-gradient(90deg, rgba(71, 85, 105, 0.12) 1px, transparent 1px)",
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
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            transformOrigin: "0 0",
            willChange: "transform",
            opacity: viewMode === "2d" ? 1 : 0,
            pointerEvents: viewMode === "2d" ? "auto" : "none",
            transition: "transform var(--dur-ui) var(--ease-in-out), opacity var(--dur-ui) var(--ease-out)",
          }}
        >
          {children}
        </div>
      </CameraZoomContext.Provider>

      {/* 3D Canvas. ThreeCanvas alone owns the engine lifecycle. */}
      {viewMode === "3d" && (
        <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center text-white">Loading 3D...</div>}>
          <ThreeCanvas world={world} activity={activity} activeSessionId={activeSessionId} selectedActorId={selectedActorId} onAgentClick={onAgentClick} />
        </Suspense>
      )}

      {/* View Mode Toggle Button */}
      {/* Fixed above page chrome: main carries z-[1], so an absolute
          button buries under header, sidebar, and sheets. */}
      <button
        onClick={toggleViewMode}
        className="fixed right-3 z-[60] px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
        style={{
          top: "4.25rem",
          background: "rgba(0, 0, 0, 0.6)",
          color: "#fff",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          backdropFilter: "blur(4px)",
        }}
        aria-label={`Switch to ${viewMode === "2d" ? "3D" : "2D"} view`}
      >
        {viewMode === "2d" ? "3D" : "2D"}
      </button>
    </div>
  );
}
