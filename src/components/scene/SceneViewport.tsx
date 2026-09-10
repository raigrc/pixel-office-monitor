"use client";

import { createContext, useContext, useEffect, useRef, useState, Suspense } from "react";
import dynamic from "next/dynamic";
import { OFFICE_DIMENSIONS, TILE_SIZE } from "@/lib/scene/office-layout";
import { useDayNight } from "@/lib/scene/day-night";
import { threeEngine } from "@/lib/scene/three-engine";

/** Current camera zoom — lets scene children size HUD text in screen px. */
export const CameraZoomContext = createContext(1);
export const useCameraZoom = () => useContext(CameraZoomContext);

interface SceneViewportProps {
  children: React.ReactNode;
  className?: string;
}

const ThreeCanvas = dynamic(() => import("./ThreeCanvas"), { ssr: false });

/**
 * SceneViewport — static whole-room camera with optional 3D view.
 * Fits the entire 384×256 office into the container (no pan, no zoom),
 * centers it, and bleeds the office floor texture underneath so no
 * letterbox color ever shows.
 */
export default function SceneViewport({ children, className }: SceneViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const threeContainerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");
  const dayNight = useDayNight();
  const isNight = dayNight === "night";

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const compute = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const s = Math.min(
        rect.width / OFFICE_DIMENSIONS.width,
        rect.height / OFFICE_DIMENSIONS.height
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
  }, []);

  useEffect(() => {
    threeEngine.setViewMode(viewMode);
    const handleResize = () => threeEngine.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      threeEngine.unmount();
    };
  }, [viewMode]);

  const toggleViewMode = () => {
    setViewMode((prev) => (prev === "2d" ? "3d" : "2d"));
  };

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className ?? ""}`}
      style={{ height: '100vh', width: '100vw' }}
      role="img"
      aria-label="Office scene viewport"
    >
      {/* Floor bleed — endless office floor behind/around the walled room */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          backgroundColor: isNight ? "#1E293B" : "#D8C8A7",
          backgroundImage: [
            "linear-gradient(rgba(99, 78, 48, 0.12) 1px, transparent 1px)",
            "linear-gradient(90deg, rgba(99, 78, 48, 0.12) 1px, transparent 1px)",
            "radial-gradient(circle at 5px 6px, rgba(255, 255, 255, 0.2) 0 1px, transparent 1px)",
          ].join(", "),
          backgroundRepeat: "repeat",
          backgroundSize: `${TILE_SIZE}px ${TILE_SIZE}px`,
          imageRendering: "pixelated",
          transition: "background-color 900ms var(--ease-out)",
        }}
      />

      {/* 3D Canvas Container */}
      <div
        ref={threeContainerRef}
        className="absolute inset-0"
        style={{ zIndex: viewMode === "3d" ? 10 : -1, height: '100%', width: '100%' }}
      />

      {/* 2D Content */}
      <CameraZoomContext.Provider value={view.scale}>
        <div
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            transformOrigin: "0 0",
            willChange: "transform",
            opacity: viewMode === "2d" ? 1 : 0,
            pointerEvents: viewMode === "2d" ? "auto" : "none",
            transition: "opacity 300ms ease",
          }}
        >
          {children}
        </div>
      </CameraZoomContext.Provider>

      {/* 3D Canvas */}
      {viewMode === "3d" && (
        <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center text-white">Loading 3D...</div>}>
          <ThreeCanvas />
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