"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { threeEngine } from "@/lib/scene/three-engine";

export default function ThreeCanvas() {
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      threeEngine.unmount();
    };
  }, []);

  useEffect(() => {
    threeEngine.populateScene();
    threeEngine.setFloors(["floor-1", "floor-2"]);
    threeEngine.setAgents([
      {
        id: "agent-1",
        position: new THREE.Vector3(-8, 0, -8),
        target: new THREE.Vector3(-8, 0, -8),
        clip: "idle",
        clipTime: 0,
        frame: 0,
        suitColor: new THREE.Color(1, 0.5, 0),
        faceIndex: 0,
        badge: "working",
        working: true,
      },
      {
        id: "agent-2",
        position: new THREE.Vector3(8, 0, 8),
        target: new THREE.Vector3(8, 0, 8),
        clip: "walk",
        clipTime: 0,
        frame: 0,
        suitColor: new THREE.Color(0, 0.8, 1),
        faceIndex: 1,
        badge: "waiting",
        working: false,
      },
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
      style={{ zIndex: 10, width: '100%', height: '100%' }}
    />
  );
}