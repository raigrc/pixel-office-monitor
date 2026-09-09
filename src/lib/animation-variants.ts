import type { Variants } from "motion";

// animate skill: strong ease-out, transform string (HW accel), UI <300ms,
// never scale(0), stagger 30-80ms, GPU opacity/transform only.
const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];
const EASE_IN_OUT: [number, number, number, number] = [0.77, 0, 0.175, 1];

export const cubicleVariants: Variants = {
  initial: { opacity: 0, transform: "translateY(8px) scale(0.98)" },
  enter: {
    opacity: 1,
    transform: "translateY(0px) scale(1)",
    transition: { duration: 0.24, ease: EASE_OUT },
  },
  exit: {
    opacity: 0,
    transform: "translateY(-8px) scale(0.98)",
    transition: { duration: 0.2, ease: EASE_OUT },
  },
};

export const staggerContainer: Variants = {
  enter: {
    transition: { staggerChildren: 0.06 },
  },
};

export const speechBubbleVariants: Variants = {
  initial: { opacity: 0, transform: "translateY(4px) scale(0.95)" },
  enter: {
    opacity: 1,
    transform: "translateY(0px) scale(1)",
    transition: { duration: 0.18, ease: EASE_OUT },
  },
  exit: {
    opacity: 0,
    transform: "translateY(4px) scale(0.95)",
    transition: { duration: 0.15, ease: EASE_OUT },
  },
};

export const monitorVariants: Variants = {
  idle: { opacity: 0.85 },
  working: {
    opacity: [0.85, 1, 0.85],
    transition: { duration: 2, repeat: Infinity, ease: EASE_IN_OUT },
  },
};

export const propVariants: Variants = {
  idle: { transform: "translateY(0px) rotate(0deg)" },
  working: {
    transform: ["translateY(0px)", "translateY(-2px)", "translateY(0px)"],
    transition: { duration: 1.5, repeat: Infinity, ease: EASE_IN_OUT },
  },
};

export const cubicleFrameVariants: Variants = {
  idle: { opacity: 0.9 },
  working: {
    opacity: 1,
    transition: { duration: 0.24, ease: EASE_OUT },
  },
};

export const entranceDelay = (index: number) => Math.min(index, 6) * 60;