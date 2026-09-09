"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { OFFICE_DIMENSIONS, TILE_SIZE } from "@/lib/scene/office-layout";
import { useDayNight } from "@/lib/scene/day-night";

/** Current camera zoom — lets scene children size HUD text in screen px. */
export const CameraZoomContext = createContext(1);
export const useCameraZoom = () => useContext(CameraZoomContext);

interface SceneViewportProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * SceneViewport — static whole-room camera.
 * Fits the entire 384×256 office into the container (no pan, no zoom),
 * centers it, and bleeds the office floor texture underneath so no
 * letterbox color ever shows.
 */
export default function SceneViewport({ children, className }: SceneViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const dayNight = useDayNight();
  const isNight = dayNight === "night";

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const compute = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return; // keep last valid scale
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

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className ?? ""}`}
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
      <CameraZoomContext.Provider value={view.scale}>
        <div
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            transformOrigin: "0 0",
            willChange: "transform",
          }}
        >
          {children}
        </div>
      </CameraZoomContext.Provider>
    </div>
  );
}
