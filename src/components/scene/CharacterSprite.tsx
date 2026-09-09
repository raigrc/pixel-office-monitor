"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { getCharacterMeta } from "@/lib/scene/assets";
import { Point } from "@/lib/scene/office-layout";

export type Pose = "idle" | "walk" | "seat" | "work" | "give" | "receive" | "success" | "error";

interface CharacterSpriteProps {
  actorId: string;
  agentKey: string;
  position: Point;
  facing: "up" | "down" | "left" | "right";
  pose: Pose;
  scale?: number;
  onAnimationComplete?: () => void;
}

const POSE_FRAMES: Record<Pose, { start: number; count: number }> = {
  idle: { start: 0, count: 4 },
  walk: { start: 4, count: 8 },
  seat: { start: 12, count: 2 },
  work: { start: 14, count: 2 },
  give: { start: 16, count: 2 },
  receive: { start: 18, count: 2 },
  success: { start: 20, count: 2 },
  error: { start: 22, count: 2 },
};

const FRAME_DURATION = 125;
const DIRECTION_ROWS = { down: 0, left: 1, right: 2, up: 3 };

/**
 * Per-frame hold durations (ms). Research consensus: timing beats frame
 * count — uneven holds read as alive, uniform ticks read as mechanical.
 * - idle: slow-breath tempo (kept for contract; idle currently holds frame 0
 *   so the frozen body never fights the Zzz indicator).
 * - work: type-type-type-PAUSE burst rhythm over the 2 typing frames.
 * - walk: even fast strides.
 * - one-shots: snap to the gesture, hold the impact frame, then complete.
 */
const POSE_DURATIONS: Record<Pose, number[]> = {
  idle: [450, 450, 450, 450],
  walk: [62, 62, 62, 62, 62, 62, 62, 62],
  seat: [1000, 1000],
  work: [95, 95, 95, 450],
  give: [70, 180],
  receive: [70, 180],
  success: [90, 260],
  error: [90, 260],
};

export default function CharacterSprite({
  actorId,
  agentKey,
  position,
  facing,
  pose,
  scale = 2,
  onAnimationComplete,
}: CharacterSpriteProps) {
  const meta = getCharacterMeta(agentKey);
  const [frameState, setFrameState] = useState<{ pose: Pose; frame: number }>({
    pose,
    frame: 0,
  });
  const lastFrameTimeRef = useRef(0);
  const animationRef = useRef(0);

  const poseData = POSE_FRAMES[pose] ?? POSE_FRAMES.idle;
  const frameWidth = meta.frameWidth ?? meta.width;
  const frameHeight = meta.frameHeight ?? meta.height;

  useEffect(() => {
    const isLooping = pose === "walk" || pose === "work";
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    lastFrameTimeRef.current = performance.now();

    if (pose === "idle" || pose === "seat") {
      // Resting poses hold frame 0 — the Zzz indicator carries idle status,
      // and any body motion fights it.
      animationRef.current = requestAnimationFrame(() => {
        setFrameState((previous) =>
          previous.pose === pose && previous.frame === 0 ? previous : { pose, frame: 0 }
        );
      });
      if (reducedMotion) onAnimationComplete?.();
      return () => cancelAnimationFrame(animationRef.current);
    }

    if (reducedMotion) {
      onAnimationComplete?.();
      return;
    }

    const durations = POSE_DURATIONS[pose] ?? [FRAME_DURATION];

    if (isLooping) {
      let step = 0;
      const animateFrames = () => {
        const now = performance.now();
        if (now - lastFrameTimeRef.current >= durations[step % durations.length]) {
          step += 1;
          setFrameState({ pose, frame: step % poseData.count });
          lastFrameTimeRef.current = performance.now();
        }
        animationRef.current = requestAnimationFrame(animateFrames);
      };
      animationRef.current = requestAnimationFrame(animateFrames);
      return () => cancelAnimationFrame(animationRef.current);
    } else {
      // One-shot: visibly step through frames with per-frame holds, then land
      // on the final frame and complete. (Previously only a timer ran — the
      // gesture frames never displayed.)
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      let step = 0;
      let completed = false;
      const advance = () => {
        if (completed) return;
        const now = performance.now();
        if (now - lastFrameTimeRef.current >= durations[Math.min(step, durations.length - 1)]) {
          lastFrameTimeRef.current = now;
          if (step >= durations.length - 1) {
            completed = true;
            setFrameState({ pose, frame: poseData.count - 1 });
            onAnimationComplete?.();
            return;
          }
          step += 1;
          setFrameState({ pose, frame: step % poseData.count });
        }
        animationRef.current = requestAnimationFrame(advance);
      };
      animationRef.current = requestAnimationFrame(advance);
      return () => {
        completed = true;
        cancelAnimationFrame(animationRef.current);
      };
    }
  }, [pose, poseData.count, onAnimationComplete]);

  const currentFrame = frameState.pose === pose ? frameState.frame : 0;
  const frameX = (poseData.start + currentFrame % poseData.count) * frameWidth;
  const frameY = DIRECTION_ROWS[facing] * frameHeight;

  const style: React.CSSProperties = {
    position: "absolute",
    left: position.x,
    top: position.y,
    width: frameWidth,
    height: frameHeight,
    transform: `translate(-50%, -100%) scale(${scale})`,
    transformOrigin: "bottom center",
    overflow: "hidden",
    imageRendering: "pixelated",
    zIndex: 30,
  };

  return (
    <div style={style} role="img" aria-label={`${agentKey} (${pose})`} data-actor-id={actorId}>
      <Image
        src={meta.path}
        alt=""
        width={meta.width}
        height={meta.height}
        style={{
          position: "absolute",
          left: -frameX,
          top: -frameY,
          width: meta.width,
          height: meta.height,
          maxWidth: "none",
          imageRendering: "pixelated",
          filter:
            "drop-shadow(1px 0 #0F172A) drop-shadow(-1px 0 #0F172A) drop-shadow(0 1px #0F172A) drop-shadow(0 -1px #0F172A)",
        }}
      />
    </div>
  );
}
