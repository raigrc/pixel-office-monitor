"use client";

import { motion } from "motion/react";
import Image from "next/image";
import { DESK_ANCHORS, OFFICE_DIMENSIONS } from "@/lib/scene/office-layout";
import { ROSTER_KEYS } from "@/lib/scene/roster";
import { getAssetUrl } from "@/lib/scene/assets";

interface StaticOfficeDemoProps {
  scale?: number;
  showGrid?: boolean;
}

export default function StaticOfficeDemo({ scale = 2 }: StaticOfficeDemoProps) {
  return (
    <div className="relative flex items-center justify-center min-h-[500px] bg-[#0F172A] p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="relative"
        style={{
          width: OFFICE_DIMENSIONS.width * scale,
          height: OFFICE_DIMENSIONS.height * scale,
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${getAssetUrl("tiles", "floor")})`,
            backgroundRepeat: "repeat",
            backgroundSize: "16px 16px",
            imageRendering: "pixelated",
          }}
        />

        {Object.entries(DESK_ANCHORS).map(([indexStr, desk]) => (
          <div
            key={`desk-${indexStr}`}
            className="absolute"
            style={{
              left: desk.furnitureOrigin.x * scale,
              top: desk.furnitureOrigin.y * scale,
              width: 64 * scale,
              height: 64 * scale,
            }}
          >
            <Image
              src="/sprites/office/desk-rear.png"
              alt=""
              width={64}
              height={64}
              className="absolute"
              style={{
                left: 0,
                top: 0,
                imageRendering: "pixelated",
              }}
            />
            <Image
              src="/sprites/office/monitor-base.png"
              alt=""
              width={16}
              height={16}
              className="absolute"
              style={{
                left: (desk.propAnchors.monitor.x - desk.furnitureOrigin.x) * scale,
                top: (desk.propAnchors.monitor.y - desk.furnitureOrigin.y) * scale,
                imageRendering: "pixelated",
              }}
            />
            <Image
              src="/sprites/office/monitor-screen-on.png"
              alt=""
              width={16}
              height={8}
              className="absolute animate-pulse"
              style={{
                left: (desk.propAnchors.monitor.x - desk.furnitureOrigin.x) * scale,
                top: (desk.propAnchors.monitor.y - desk.furnitureOrigin.y + 1) * scale,
                imageRendering: "pixelated",
                opacity: 0.8,
              }}
            />
            <Image
              src="/sprites/office/plant.png"
              alt=""
              width={16}
              height={24}
              className="absolute"
              style={{
                left: (desk.propAnchors.plant.x - desk.furnitureOrigin.x) * scale,
                top: (desk.propAnchors.plant.y - desk.furnitureOrigin.y) * scale,
                imageRendering: "pixelated",
              }}
            />
            <Image
              src="/sprites/office/lamp.png"
              alt=""
              width={8}
              height={16}
              className="absolute"
              style={{
                left: (desk.propAnchors.lamp.x - desk.furnitureOrigin.x) * scale,
                top: (desk.propAnchors.lamp.y - desk.furnitureOrigin.y) * scale,
                imageRendering: "pixelated",
              }}
            />
            <Image
              src="/sprites/office/desk-front.png"
              alt=""
              width={64}
              height={32}
              className="absolute"
              style={{
                left: 0,
                top: 36 * scale,
                imageRendering: "pixelated",
                zIndex: 10,
              }}
            />
          </div>
        ))}

        <div
          className="absolute"
          style={{
            left: 16 * scale,
            top: 180 * scale,
            width: 32 * scale,
            height: 48 * scale,
          }}
        >
          <img
            src="/sprites/office/storage.png"
            alt="Storage"
            width={32}
            height={48}
            style={{ imageRendering: "pixelated" }}
          />
        </div>

        <div
          className="absolute"
          style={{
            left: 320 * scale,
            top: 180 * scale,
            width: 48 * scale,
            height: 32 * scale,
          }}
        >
          <img
            src="/sprites/office/whiteboard.png"
            alt="Whiteboard"
            width={48}
            height={32}
            style={{ imageRendering: "pixelated" }}
          />
        </div>

        <div
          className="absolute"
          style={{
            left: 280 * scale,
            top: 220 * scale,
            width: 16 * scale,
            height: 24 * scale,
          }}
        >
          <img
            src="/sprites/office/coffee-machine.png"
            alt="Coffee"
            width={16}
            height={24}
            style={{ imageRendering: "pixelated" }}
          />
        </div>

        <div
          className="absolute"
          style={{
            left: 16 * scale,
            top: 16 * scale,
            width: 64 * scale,
            height: 64 * scale,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-end",
          }}
        >
          <img
            src="/sprites/characters/orchestrator.png"
            alt="Orchestrator"
            width={32}
            height={32}
            style={{
              imageRendering: "pixelated",
              transform: "translate(-50%, -100%) scale(2)",
            }}
          />
          <span
            style={{
              fontSize: "10px",
              color: "#94A3B8",
              fontFamily: "var(--font-inter), Inter, sans-serif",
              textAlign: "center",
              width: "64px",
            }}
          >
            Orchestrator
          </span>
        </div>

        {Object.entries(DESK_ANCHORS).map(([indexStr, desk], idx) => (
          <div
            key={`label-${indexStr}`}
            className="absolute"
            style={{
              left: desk.furnitureOrigin.x * scale,
              top: (desk.furnitureOrigin.y - 20) * scale,
              whiteSpace: "nowrap",
              fontSize: "10px",
              color: "#64748B",
              fontFamily: "var(--font-inter), Inter, sans-serif",
              textAlign: "center",
              width: 64 * scale,
            }}
          >
            {ROSTER_KEYS[idx] || "specialist"}
          </div>
        ))}
      </motion.div>

      <div className="mt-4 text-center text-xs text-[#64748B] font-mono">
        Static Office Demo — {OFFICE_DIMENSIONS.width}×{OFFICE_DIMENSIONS.height} @ {scale}x scale
      </div>
    </div>
  );
}
