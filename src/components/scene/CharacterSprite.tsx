"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { getCharacterMeta } from "@/lib/scene/assets";
import {
  getPosePlaybackPolicy,
  POSE_FRAMES,
  type Pose,
  type PosePlaybackPolicy,
} from "@/lib/scene/character-animation";
import type { Point } from "@/lib/scene/office-layout";

export type { Pose } from "@/lib/scene/character-animation";

interface CharacterSpriteProps {
  actorId: string;
  agentKey: string;
  position: Point;
  facing: "up" | "down" | "left" | "right";
  pose: Pose;
  scale?: number;
  decorative?: boolean;
  onAnimationComplete?: () => void;
}

const DIRECTION_ROWS = { down: 0, left: 1, right: 2, up: 3 };

function firstFrame(policy: PosePlaybackPolicy): number {
  return policy.kind === "static" ? policy.frame : policy.steps[0].frame;
}

export default function CharacterSprite({
  actorId,
  agentKey,
  position,
  facing,
  pose,
  scale = 1,
  decorative = false,
  onAnimationComplete,
}: CharacterSpriteProps) {
  const meta = getCharacterMeta(agentKey);
  const [frameState, setFrameState] = useState<{ pose: Pose; frame: number }>({
    pose,
    frame: 0,
  });
  const onAnimationCompleteRef = useRef(onAnimationComplete);

  const poseData = POSE_FRAMES[pose];
  const frameWidth = meta.frameWidth ?? meta.width;
  const frameHeight = meta.frameHeight ?? meta.height;
  const anchor = meta.anchor ?? { x: frameWidth / 2, y: frameHeight };

  useEffect(() => {
    onAnimationCompleteRef.current = onAnimationComplete;
  }, [onAnimationComplete]);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animationFrame = 0;
    let oneShotCompleted = false;

    const setFrame = (frame: number) => {
      setFrameState((previous) =>
        previous.pose === pose && previous.frame === frame ? previous : { pose, frame }
      );
    };

    const completeOneShot = () => {
      if (oneShotCompleted) return;
      oneShotCompleted = true;
      onAnimationCompleteRef.current?.();
    };

    const startPlayback = () => {
      cancelAnimationFrame(animationFrame);
      const policy = getPosePlaybackPolicy(pose, reducedMotion.matches);

      if (oneShotCompleted) {
        const basePolicy = getPosePlaybackPolicy(pose, false);
        if (basePolicy.kind === "one-shot") setFrame(basePolicy.finalFrame);
        return;
      }

      setFrame(firstFrame(policy));
      if (policy.kind === "static") {
        if (policy.completes) completeOneShot();
        return;
      }

      let stepIndex = 0;
      let frameStartedAt = performance.now();
      const advance = (now: number) => {
        const step = policy.steps[stepIndex] ?? policy.steps[0];
        if (now - frameStartedAt >= step.durationMs) {
          if (policy.kind === "one-shot" && stepIndex === policy.steps.length - 1) {
            setFrame(policy.finalFrame);
            completeOneShot();
            return;
          }

          stepIndex = (stepIndex + 1) % policy.steps.length;
          frameStartedAt = now;
          setFrame(policy.steps[stepIndex]?.frame ?? policy.steps[0].frame);
        }
        animationFrame = requestAnimationFrame(advance);
      };

      animationFrame = requestAnimationFrame(advance);
    };

    startPlayback();
    reducedMotion.addEventListener("change", startPlayback);
    return () => {
      reducedMotion.removeEventListener("change", startPlayback);
      cancelAnimationFrame(animationFrame);
    };
  }, [pose]);

  const currentFrame = frameState.pose === pose ? frameState.frame : 0;
  const frameX = (poseData.start + currentFrame % poseData.count) * frameWidth;
  const frameY = DIRECTION_ROWS[facing] * frameHeight;

  const style: React.CSSProperties = {
    position: "absolute",
    left: position.x - anchor.x * scale,
    top: position.y - anchor.y * scale,
    width: frameWidth * scale,
    height: frameHeight * scale,
    overflow: "hidden",
    imageRendering: "pixelated",
    zIndex: 30,
  };

  return (
    <div
      style={style}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : `${agentKey} (${pose})`}
      aria-hidden={decorative || undefined}
      data-actor-id={actorId}
    >
      <Image
        src={meta.path}
        alt=""
        width={meta.width}
        height={meta.height}
        unoptimized
        style={{
          position: "absolute",
          left: -frameX * scale,
          top: -frameY * scale,
          width: meta.width * scale,
          height: meta.height * scale,
          maxWidth: "none",
          imageRendering: "pixelated",
          filter:
            "drop-shadow(1px 0 var(--canvas)) drop-shadow(-1px 0 var(--canvas)) drop-shadow(0 1px var(--canvas)) drop-shadow(0 -1px var(--canvas))",
        }}
      />
    </div>
  );
}
