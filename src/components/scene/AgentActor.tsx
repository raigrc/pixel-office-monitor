"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, animate } from "motion/react";
import Image from "next/image";
import { getCharacterMeta, getAssetUrl } from "@/lib/scene/assets";
import { Point } from "@/lib/scene/office-layout";

type Pose = "idle" | "walk" | "seat" | "work" | "give" | "receive" | "success" | "error";

interface FrameData {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AnimationState {
  pose: Pose;
  direction: "up" | "down" | "left" | "right";
  frameIndex: number;
  frameCount: number;
  frameDuration: number;
}

const POSE_FRAMES: Record<Pose, { start: number; count: number; row: number }> = {
  idle: { start: 0, count: 4, row: 0 },
  walk: { start: 4, count: 8, row: 1 },
  seat: { start: 12, count: 2, row: 2 },
  work: { start: 14, count: 2, row: 2 },
  give: { start: 16, count: 2, row: 3 },
  receive: { start: 18, count: 2, row: 3 },
  success: { start: 20, count: 2, row: 4 },
  error: { start: 22, count: 2, row: 4 },
};

const FRAME_DURATION = 125;

interface AgentActorProps {
  actorId: string;
  agentKey: string;
  position: Point;
  targetPosition?: Point;
  facing: "up" | "down" | "left" | "right";
  pose: Pose;
  scale?: number;
  onAnimationComplete?: () => void;
}

export default function AgentActor({
  actorId,
  agentKey,
  position,
  targetPosition,
  facing,
  pose,
  scale = 2,
  onAnimationComplete,
}: AgentActorProps) {
  const meta = getCharacterMeta(agentKey);
  const frameRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const [currentFrame, setCurrentFrame] = useState(0);
  const animationRef = useRef(0);

  const poseData = POSE_FRAMES[pose] ?? POSE_FRAMES.idle;
  const frameCount = poseData.count;
  const row = poseData.row;

  const frameWidth = meta.frameWidth ?? meta.width;
  const frameHeight = meta.frameHeight ?? meta.height;

  useEffect(() => {
    if (pose === "idle" || pose === "work" || pose === "seat") {
      const animateFrames = () => {
        const now = performance.now();
        if (now - lastFrameTimeRef.current >= FRAME_DURATION) {
          setCurrentFrame((prev) => (prev + 1) % frameCount);
          lastFrameTimeRef.current = now;
        }
        animationRef.current = requestAnimationFrame(animateFrames);
      };
      animationRef.current = requestAnimationFrame(animateFrames);
      return () => cancelAnimationFrame(animationRef.current!);
    } else if (pose === "walk") {
      const animateFrames = () => {
        const now = performance.now();
        if (now - lastFrameTimeRef.current >= FRAME_DURATION / 2) {
          setCurrentFrame((prev) => (prev + 1) % frameCount);
          lastFrameTimeRef.current = now;
        }
        animationRef.current = requestAnimationFrame(animateFrames);
      };
      animationRef.current = requestAnimationFrame(animateFrames);
      return () => cancelAnimationFrame(animationRef.current!);
    } else {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      animationRef.current = requestAnimationFrame(() => setCurrentFrame(0));
      const completionTimeout = setTimeout(
        () => onAnimationComplete?.(),
        FRAME_DURATION * frameCount
      );
      return () => {
        cancelAnimationFrame(animationRef.current);
        clearTimeout(completionTimeout);
      };
    }
  }, [pose, frameCount, onAnimationComplete]);

  const directionRowMap = { down: 0, left: 1, right: 2, up: 3 };
  const directionRow = directionRowMap[facing] ?? 0;
  const frameX = (poseData.start + currentFrame % frameCount) * frameWidth;
  const frameY = (row + directionRow) * frameHeight;

  const style = useMemo(() => ({
    position: "absolute",
    left: position.x,
    top: position.y,
    width: frameWidth * scale,
    height: frameHeight * scale,
    transform: `translate(-50%, -100%) scale(${scale})`,
    imageRendering: "pixelated",
    zIndex: 30,
  } as React.CSSProperties), [position, frameWidth, frameHeight, scale]);

  return (
    <div style={style} role="img" aria-label={`${agentKey} (${pose})`}>
      <Image
        src={getAssetUrl("characters", agentKey)}
        alt=""
        width={meta.width}
        height={meta.height}
        style={{
          objectFit: "none",
          objectPosition: `-${frameX}px -${frameY}px`,
          width: meta.width,
          height: meta.height,
          imageRendering: "pixelated",
        }}
      />
    </div>
  );
}
