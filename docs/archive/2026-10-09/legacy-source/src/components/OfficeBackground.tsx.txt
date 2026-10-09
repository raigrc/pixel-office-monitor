"use client";

/**
 * OfficeBackground — full-viewport fixed pixel-art floor tile.
 * Uses floor-tile.png as a repeating pattern with image-rendering: pixelated.
 * Sits at z-index 0 behind all content.
 */
export default function OfficeBackground() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none"
      style={{
        backgroundImage: "url('/sprites/floor-tile.png')",
        backgroundRepeat: "repeat",
        backgroundSize: "32px 32px",
        imageRendering: "pixelated",
        backgroundColor: "#0F172A",
      }}
    />
  );
}
