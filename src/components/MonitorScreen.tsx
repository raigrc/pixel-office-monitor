"use client";

import { memo } from "react";
import { motion } from "motion/react";

type MonitorScreenProps = {
  agentId: string;
  isWorking: boolean;
};

/**
 * MonitorScreen — renders monitor screen PNG from /sprites/monitors/{agent}.png.
 * Positioned in the monitor area of the cubicle frame.
 * Shows green glow animation when working using Motion.
 */
function MonitorScreenInner({ agentId, isWorking }: MonitorScreenProps) {
  const key = (agentId || "general").trim().toLowerCase() || "general";
  const src = `/sprites/monitors/${key}.png`;

  return (
    <motion.div
      aria-hidden="true"
      className="absolute left-1/2 top-[18px] z-5 -translate-x-1/2"
      animate={isWorking ? { boxShadow: ["0 0 4px rgba(34, 197, 94, 0.4), inset 0 0 2px rgba(34, 197, 94, 0.2)", "0 0 8px rgba(34, 197, 94, 0.6), inset 0 0 4px rgba(34, 197, 94, 0.3)"] } : { boxShadow: "0 0 4px rgba(34, 197, 94, 0.2)" }}
      transition={isWorking ? { duration: 2, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" } : { duration: 0.3 }}
      initial={false}
    >
      <img
        src={src}
        alt=""
        className="pixel-img block"
        style={{
          width: "32px",
          height: "16px",
          imageRendering: "pixelated",
        }}
        width={32}
        height={16}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    </motion.div>
  );
}

const MonitorScreen = memo(MonitorScreenInner);
export default MonitorScreen;