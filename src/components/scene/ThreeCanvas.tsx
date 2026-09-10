"use client";

import { useEffect, useRef } from "react";
import { threeEngine } from "@/lib/scene/three-engine";
import { useMonitorState } from "@/hooks/useMonitorStream";
import { mapActorsToAgents } from "@/lib/scene/actor-3d-map";

export default function ThreeCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { floors, actors, invocations } = useMonitorState();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    threeEngine.mount(el);
    threeEngine.resize();
    return () => {
      threeEngine.unmount();
    };
  }, []);

  // Live monitor state drives the scene. mount() already populates
  // terrain, scatter, ship, badges, particles, astronauts once.
  useEffect(() => {
    if (!threeEngine.isMounted()) return;
    threeEngine.setFloors(floors.map((f) => f.floorId));
    threeEngine.setAgents(mapActorsToAgents(actors, invocations, threeEngine.getFloorPositions()));
  }, [floors, actors, invocations]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ zIndex: 10, width: '100%', height: '100%' }}
    />
  );
}
