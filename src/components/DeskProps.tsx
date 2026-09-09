"use client";

import { memo } from "react";
import { motion } from "motion/react";
import { getAgentProps } from "@/lib/agent-props";

type DeskPropsProps = {
  agentId: string;
  isWorking: boolean;
};

/**
 * DeskProps — renders desk items as absolutely-positioned <img> on the desk surface.
 * Pixel art rendering. pointer-events: none. Floats subtly when agent is working using Motion.
 */
function DeskPropsInner({ agentId, isWorking }: DeskPropsProps) {
  const config = getAgentProps(agentId);

  if (config.items.length === 0) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10">
      {config.items.map((prop, i) => (
        <motion.img
          key={`${agentId}-prop-${i}`}
          src={prop.src}
          alt={prop.alt}
          className="pixel-img absolute"
          style={{
            left: prop.x,
            top: prop.y,
            width: prop.w,
            height: prop.h,
            imageRendering: "pixelated",
          }}
          width={prop.w}
          height={prop.h}
          animate={isWorking ? { y: [-2, 2, -2], rotate: [-3, 3, -3] } : { y: 0, rotate: 0 }}
          transition={isWorking ? { duration: 0.8, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 } : { duration: 0.3 }}
          initial={false}
        />
      ))}
    </div>
  );
}

const DeskProps = memo(DeskPropsInner);
export default DeskProps;