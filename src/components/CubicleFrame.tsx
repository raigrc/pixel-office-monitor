"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";

type CubicleFrameProps = {
  isWorking: boolean;
  children: ReactNode;
};

/**
 * CubicleFrame — renders cubicle-idle.png or cubicle-working.png as a background.
 * Children are positioned on top of the frame image.
 * Crossfade transition between working/idle states using Motion AnimatePresence.
 * Pixel art rendering with image-rendering: pixelated.
 */
export default function CubicleFrame({ isWorking, children }: CubicleFrameProps) {
  return (
    <div className="relative h-full w-full" style={{ minHeight: "212px" }}>
      {/* Cubicle background image — crossfade transition */}
      <AnimatePresence mode="wait">
        {isWorking ? (
          <motion.img
            key="working"
            src="/sprites/cubicle-working.png"
            alt=""
            aria-hidden="true"
            className="pixel-img pointer-events-none absolute inset-0 h-full w-full object-cover"
            style={{ imageRendering: "pixelated" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        ) : (
          <motion.img
            key="idle"
            src="/sprites/cubicle-idle.png"
            alt=""
            aria-hidden="true"
            className="pixel-img pointer-events-none absolute inset-0 h-full w-full object-cover"
            style={{ imageRendering: "pixelated" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>
      {/* Content overlay */}
      <div className="relative z-10 flex h-full flex-col">{children}</div>
    </div>
  );
}