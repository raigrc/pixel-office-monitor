"use client";

import { useEffect, useRef } from "react";
import { threeEngine } from "@/lib/scene/three-engine";

export default function ThreeCanvas() {
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    threeEngine.populateScene();
    threeEngine.setFloors(["floor-1", "floor-2"]);
    threeEngine.setAgents([
      {
        id: "agent-1",
        position: { x: 0, y: 0, z: 0 } as any,
        target: { x: 5, y: 0, z: 0 } as any,
        clip: "idle",
        clipTime: 0,
        frame: 0,
        suitColor: { r: 1, g: 0.5, b: 0 } as any,
        faceIndex: 0,
        badge: "working",
        working: true,
      } as any,
    ]);
  }, []);

  return (
    <div
      ref={(el) => {
        if (el && !mountedRef.current) {
          threeEngine.mount(el);
          threeEngine.resize();
        }
      }}
      className="absolute inset-0"
      style={{ zIndex: 10 }}
    />
  );
}