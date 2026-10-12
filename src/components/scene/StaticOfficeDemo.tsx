"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

import CharacterSprite from "@/components/scene/CharacterSprite";
import OfficeEnvironment from "@/components/scene/OfficeEnvironment";
import { getAssetUrl } from "@/lib/scene/assets";
import { DESK_ANCHORS, LAYERS, OFFICE_DIMENSIONS, ORCHESTRATOR_SPOT } from "@/lib/scene/office-layout";
import { DEFAULT_VISIBLE_ROLE_KEYS } from "@/lib/scene/roster";

interface StaticOfficeDemoProps {
  scale?: number;
}

const STATIC_POSES = ["work", "seat", "success"] as const;

export default function StaticOfficeDemo({ scale = 2 }: StaticOfficeDemoProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [fittedScale, setFittedScale] = useState(Math.min(scale, 1));
  const visibleDesks = DEFAULT_VISIBLE_ROLE_KEYS.map((agentKey, seatIndex) => ({
    agentKey,
    desk: DESK_ANCHORS[seatIndex],
    pose: STATIC_POSES[seatIndex % STATIC_POSES.length],
  }));

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const fit = () => {
      const availableWidth = Math.min(
        frame.getBoundingClientRect().width,
        Math.max(1, window.innerWidth - 64)
      );
      setFittedScale(Math.min(scale, availableWidth / OFFICE_DIMENSIONS.width));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [scale]);

  return (
    <section className="flex w-full flex-col items-center gap-4 bg-[var(--canvas)] p-4">
      <div ref={frameRef} className="flex w-full justify-center">
        <div
          data-static-office-scene
          className="relative shrink-0 overflow-hidden"
          style={{
            width: OFFICE_DIMENSIONS.width * fittedScale,
            height: OFFICE_DIMENSIONS.height * fittedScale,
          }}
        >
          <div
            className="relative"
            style={{
              width: OFFICE_DIMENSIONS.width,
              height: OFFICE_DIMENSIONS.height,
              transform: `scale(${fittedScale})`,
              transformOrigin: "0 0",
            }}
          >
            <OfficeEnvironment timeStage="day" />

            <div className="absolute inset-0" style={{ zIndex: LAYERS.furniture }}>
              {visibleDesks.map(({ agentKey, desk }) => (
                <div
                  key={agentKey}
                  className="absolute h-16 w-16"
                  style={{ left: desk.furnitureOrigin.x, top: desk.furnitureOrigin.y }}
                >
                  <Image
                    src={getAssetUrl("furniture", "desk-rear")}
                    alt=""
                    width={64}
                    height={64}
                    unoptimized
                    className="absolute pixel-img"
                  />
                  <Image
                    src={getAssetUrl("furniture", "monitor-base")}
                    alt=""
                    width={16}
                    height={16}
                    unoptimized
                    className="absolute pixel-img"
                    style={{ left: 16, top: 20 }}
                  />
                  <Image
                    src={getAssetUrl("furniture", "monitor-screen")}
                    alt=""
                    width={16}
                    height={8}
                    unoptimized
                    className="absolute pixel-img"
                    style={{ left: 16, top: 21 }}
                  />
                  <Image
                    src={getAssetUrl("furniture", "plant")}
                    alt=""
                    width={16}
                    height={24}
                    unoptimized
                    className="absolute pixel-img"
                    style={{ left: 40, top: 8 }}
                  />
                  <Image
                    src={getAssetUrl("furniture", "lamp")}
                    alt=""
                    width={8}
                    height={16}
                    unoptimized
                    className="absolute pixel-img"
                    style={{ left: 5, top: 12 }}
                  />
                </div>
              ))}
            </div>

            <div className="absolute inset-0 pointer-events-none" style={{ zIndex: LAYERS.actors }}>
              {visibleDesks.map(({ agentKey, desk, pose }) => (
                <CharacterSprite
                  key={agentKey}
                  actorId={`static-${agentKey}`}
                  agentKey={agentKey}
                  position={desk.seatedActorAnchor}
                  facing="down"
                  pose={pose}
                />
              ))}
              <CharacterSprite
                actorId="static-orchestrator"
                agentKey="orchestrator"
                position={ORCHESTRATOR_SPOT}
                facing="down"
                pose="idle"
              />
            </div>

            <div className="absolute inset-0 pointer-events-none" style={{ zIndex: LAYERS.foreground }}>
              {visibleDesks.map(({ agentKey, desk }) => (
                <div key={agentKey}>
                  <Image
                    src={getAssetUrl("furniture", "desk-front")}
                    alt=""
                    width={64}
                    height={32}
                    unoptimized
                    className="absolute pixel-img"
                    style={{ left: desk.furnitureOrigin.x, top: desk.furnitureOrigin.y + 36 }}
                  />
                  <span
                    className="absolute overflow-hidden text-ellipsis whitespace-nowrap text-center text-[5px] text-[var(--text)]"
                    style={{
                      left: desk.furnitureOrigin.x + 15,
                      top: desk.furnitureOrigin.y + 46,
                      width: 36,
                      lineHeight: "6px",
                      fontFamily: "var(--font-pixel), monospace",
                    }}
                  >
                    {agentKey.replace(/-/g, " ")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-[var(--muted)]" style={{ fontFamily: "var(--font-pixel), monospace" }}>
        Static office, {OFFICE_DIMENSIONS.width}×{OFFICE_DIMENSIONS.height} logical pixels, native 48px character frames
      </p>
    </section>
  );
}
