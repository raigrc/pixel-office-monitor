"use client";

import { memo } from "react";
import Image from "next/image";
import { getAgentProps } from "@/lib/agent-props";

interface DeskDecorProps {
  agentKey: string;
  scale?: number;
  isWorking?: boolean;
}

/**
 * DeskDecor — per-cubicle decorations for the roster room. Each roster agent
 * has its own role props (wrench, books, shield...) rendered on the desk
 * surface flanking the monitor, in front of the plant. Static while the desk
 * sleeps; gentle CSS float (off-main-thread) while working.
 */
function DeskDecorInner({ agentKey, scale = 1, isWorking = false }: DeskDecorProps) {
  const config = getAgentProps(agentKey);
  if (config.items.length === 0) return null;

  return (
    <>
      {config.items.map((prop, i) => {
        const rightSide = i > 0;
        const w = prop.w * scale;
        const h = prop.h * scale;
        return (
          <Image
            key={`${agentKey}-decor-${i}`}
            src={prop.src}
            alt={prop.alt}
            width={prop.w}
            height={prop.h}
            loading="eager"
            className={`absolute ${isWorking ? "animate-prop-float" : ""}`}
            style={{
              left: rightSide ? 64 * scale - (3 + prop.w) * scale : 3 * scale,
              top: 28 * scale,
              width: w,
              height: h,
              imageRendering: "pixelated",
              animationDelay: isWorking ? `${i * 300}ms` : undefined,
            }}
          />
        );
      })}
    </>
  );
}

const DeskDecor = memo(DeskDecorInner);
export default DeskDecor;
