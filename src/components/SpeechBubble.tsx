"use client";

import { AnimatePresence, motion } from "motion/react";

type SpeechBubbleProps = {
  text: string;
  visible: boolean;
};

/**
 * SpeechBubble — pixel art speech bubble showing prompt text.
 * Tail points down toward the sprite. Only visible on hover or when working.
 * Uses VT323 font, max 40 chars, pointer-events: none.
 * Spring entrance/exit animation via Motion.
 */
export default function SpeechBubble({ text, visible }: SpeechBubbleProps) {
  if (!text) return null;

  const display = text.length > 40 ? text.slice(0, 39) + "\u2026" : text;

  return (
    <AnimatePresence mode="wait">
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 4 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          className="absolute -top-1 left-1/2 z-30 -translate-x-1/2 -translate-y-full pointer-events-none"
          aria-hidden="true"
        >
          {/* Bubble body */}
          <div
            className="relative rounded-[4px] border-2 px-2.5 py-1.5"
            style={{
              borderColor: "#334155",
              backgroundColor: "#1E293B",
              maxWidth: "180px",
            }}
          >
            <span
              className="block truncate text-[13px] leading-tight text-[#F1F5F9]"
              style={{ fontFamily: "var(--font-vt), VT323, monospace" }}
            >
              {display}
            </span>

            {/* Tail — pixel triangle pointing down */}
            <div
              className="absolute left-1/2 -bottom-[6px] -translate-x-1/2"
              style={{
                width: 0,
                height: 0,
                borderLeft: "6px solid transparent",
                borderRight: "6px solid transparent",
                borderTop: "6px solid #334155",
              }}
            />
            <div
              className="absolute left-1/2 -bottom-[4px] -translate-x-1/2"
              style={{
                width: 0,
                height: 0,
                borderLeft: "4px solid transparent",
                borderRight: "4px solid transparent",
                borderTop: "4px solid #1E293B",
              }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}