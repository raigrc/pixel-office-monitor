"use client";

import { memo } from "react";
import Image from "next/image";
import { getAgentAnimationConfig } from "@/lib/agent-animations";
import { getAgentProps } from "@/lib/agent-props";
import { getAgentVisualIdentity, resolveAgentAccent } from "@/lib/agent-visual-identity";

interface DeskDecorProps {
  agentKey: string;
  scale?: number;
  isWorking?: boolean;
}

/**
 * DeskDecor — per-cubicle decorations for the roster room. Each roster agent
 * has its own role props (wrench, books, shield...) rendered on the desk
 * surface flanking the monitor, in front of the plant. One configured primary
 * prop can mark active work; secondary props stay still.
 */
function DeskDecorInner({ agentKey, scale = 1, isWorking = false }: DeskDecorProps) {
  const config = getAgentProps(agentKey);
  const animationConfig = getAgentAnimationConfig(agentKey);
  const identity = getAgentVisualIdentity(agentKey);
  const animatePrimaryProp =
    isWorking &&
    animationConfig.hasPropAnimation === true &&
    animationConfig.working === "animate-prop-sync";
  if (config.items.length === 0) return null;

  return (
    <>
      <span
        aria-hidden="true"
        className="absolute"
        style={{
          left: 3 * scale,
          top: 30 * scale,
          width: Math.max(2, 3 * scale),
          height: 8 * scale,
          backgroundColor: resolveAgentAccent(agentKey, isWorking ? "var(--working)" : undefined),
          boxShadow: `0 0 ${Math.max(1, 2 * scale)}px ${identity.accent}`,
        }}
      />
      {config.items.map((prop, i) => {
        const rightSide = i > 0;
        const w = prop.w * scale;
        const h = prop.h * scale;
        return (
          <Image
            key={`${agentKey}-decor-${i}`}
            src={prop.src}
            alt=""
            width={prop.w}
            height={prop.h}
            loading="eager"
            className={`absolute ${animatePrimaryProp && i === 0 ? "animate-prop-sync" : ""}`}
            data-role-accent={identity.accent}
            style={{
              left: rightSide ? 64 * scale - (3 + prop.w) * scale : 3 * scale,
              top: 28 * scale,
              width: w,
              height: h,
              imageRendering: "pixelated",
            }}
          />
        );
      })}
    </>
  );
}

const DeskDecor = memo(DeskDecorInner);
export default DeskDecor;
