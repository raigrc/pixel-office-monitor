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