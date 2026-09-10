"use client";

import { useEffect, useRef } from "react";
import { threeEngine } from "@/lib/scene/three-engine";
import { useMonitorState } from "@/hooks/useMonitorStream";
import { mapActorsToAgents } from "@/lib/scene/actor-3d-map";
import { loadSettings, applySettingsToEngine } from "@/lib/scene/settings3d";

export default function ThreeCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const focusedRef = useRef(false);
  const { floors, actors, invocations } = useMonitorState();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    threeEngine.mount(el);
    // Saved quality, bloom, sky, and planet choices apply at mount.
    applySettingsToEngine(threeEngine, loadSettings());
    threeEngine.resize();
    return () => {
      focusedRef.current = false;
      threeEngine.unmount();
    };
  }, []);

  // Live monitor state drives the scene. mount() already populates
  // terrain, scatter, ship, badges, particles, astronauts once.
  useEffect(() => {
    if (!threeEngine.isMounted()) return;
    threeEngine.setFloors(floors.map((f) => f.floorId));
    threeEngine.setAgents(mapActorsToAgents(actors, invocations, threeEngine.getFloorPositions()));
    // Frame the first plot once. Later floors never steal the camera.
    if (!focusedRef.current && floors.length > 0) {
      const home = threeEngine.getFloorPositions().get(floors[0].floorId);
      if (home) {
        threeEngine.focusCamera(home, 20);
        focusedRef.current = true;
      }
    }
  }, [floors, actors, invocations]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ zIndex: 10, width: '100%', height: '100%' }}
    />
  );
}
