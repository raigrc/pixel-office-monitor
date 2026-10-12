import Image from "next/image";

import { getAssetUrl } from "@/lib/scene/assets";
import {
  LAYERS,
  DESK_ANCHORS,
  OFFICE_COMMON_FLOORS,
  OFFICE_ENVIRONMENT_ITEMS,
  OFFICE_ENVIRONMENT_ZONES,
  OFFICE_LIGHT_SHAFT_OPACITY,
  OFFICE_PARTITIONS,
  OFFICE_RUGS,
  OFFICE_WALKWAYS,
  TILE_SIZE,
} from "@/lib/scene/office-layout";
import type { TimeStage } from "@/lib/scene/lighting-time";

interface OfficeEnvironmentProps {
  scale?: number;
  timeStage: TimeStage;
}

interface PixelAssetProps {
  assetKey: string;
  category: "tiles" | "furniture";
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

const WINDOW_X_POSITIONS = [176, 352] as const;

function PixelAsset({ assetKey, category, x, y, width, height, scale }: PixelAssetProps) {
  return (
    <Image
      src={getAssetUrl(category, assetKey)}
      alt=""
      width={width}
      height={height}
      loading="eager"
      unoptimized
      className="absolute pixel-img"
      style={{
        left: x * scale,
        top: y * scale,
        width: width * scale,
        height: height * scale,
      }}
    />
  );
}

export default function OfficeEnvironment({ scale = 1, timeStage }: OfficeEnvironmentProps) {
  const shaftOpacity = OFFICE_LIGHT_SHAFT_OPACITY[timeStage];
  const windowColor = timeStage === "night"
    ? "var(--night)"
    : timeStage === "dusk"
      ? "var(--waiting)"
      : "var(--monitor-idle)";

  return (
    <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
      <div
        className="absolute inset-0"
        style={{
          zIndex: LAYERS.floor,
          backgroundColor: "var(--floor)",
          backgroundImage: `url(${getAssetUrl("tiles", "floor")})`,
          backgroundRepeat: "repeat",
          backgroundSize: `${TILE_SIZE * scale}px ${TILE_SIZE * scale}px`,
          imageRendering: "pixelated",
        }}
      />

      <div className="absolute inset-0" style={{ zIndex: LAYERS.floor + 1 }}>
        {OFFICE_COMMON_FLOORS.map((bounds, index) => (
          <div
            key={`oak-${index}`}
            data-office-floor-material="oak"
            className="absolute"
            style={{
              left: bounds.x * scale, top: bounds.y * scale,
              width: bounds.width * scale, height: bounds.height * scale,
              backgroundColor: "color-mix(in srgb, var(--wood) 40%, var(--floor))",
              backgroundImage: `repeating-linear-gradient(0deg, transparent 0 ${7 * scale}px, color-mix(in srgb, var(--wood-dark) 22%, transparent) ${7 * scale}px ${8 * scale}px)`,
              boxShadow: `inset 0 0 0 ${scale}px color-mix(in srgb, var(--wood-dark) 25%, transparent)`,
            }}
          />
        ))}
        {Object.values(DESK_ANCHORS).filter((_, index) => index % 4 === 0).map((desk) => (
          <div
            key={`work-bay-${desk.furnitureOrigin.y}`}
            className="absolute"
            style={{
              left: 24 * scale, top: desk.furnitureOrigin.y * scale,
              width: 360 * scale, height: 68 * scale,
              backgroundColor: "color-mix(in srgb, var(--plant) 12%, var(--floor))",
              borderBottom: `${scale}px solid color-mix(in srgb, var(--plant) 28%, var(--floor))`,
            }}
          />
        ))}
        {OFFICE_WALKWAYS.map((bounds, index) => (
          <div
            key={`walkway-${index}`}
            data-office-walkway
            className="absolute"
            style={{
              left: bounds.x * scale, top: bounds.y * scale,
              width: bounds.width * scale, height: bounds.height * scale,
              backgroundColor: "color-mix(in srgb, var(--floor) 88%, var(--text))",
            }}
          />
        ))}
        {OFFICE_RUGS.map(({ zone, bounds }) => (
          <div
            key={zone}
            data-office-rug={zone}
            className="absolute"
            style={{
              left: bounds.x * scale, top: bounds.y * scale,
              width: bounds.width * scale, height: bounds.height * scale,
              backgroundColor: zone === "lounge"
                ? "color-mix(in srgb, var(--plant) 50%, var(--floor))"
                : "color-mix(in srgb, var(--metal) 42%, var(--floor))",
              backgroundImage: `repeating-linear-gradient(0deg, transparent 0 ${3 * scale}px, color-mix(in srgb, var(--floor) 12%, transparent) ${3 * scale}px ${4 * scale}px)`,
              border: `${2 * scale}px solid color-mix(in srgb, var(--wood-dark) 38%, var(--floor))`,
              boxShadow: `inset 0 0 0 ${2 * scale}px color-mix(in srgb, var(--floor) 50%, transparent)`,
            }}
          />
        ))}
      </div>

      <div className="absolute inset-0" style={{ zIndex: LAYERS.rearWalls }}>
        <div
          className="absolute left-0 top-0 w-full pixelated"
          style={{
            height: TILE_SIZE * scale,
            backgroundImage: `url(${getAssetUrl("tiles", "wall-north")})`,
            backgroundRepeat: "repeat-x",
            backgroundSize: `${TILE_SIZE * scale}px ${TILE_SIZE * scale}px`,
          }}
        />
        <div
          className="absolute bottom-0 left-0 w-full pixelated"
          style={{
            height: TILE_SIZE * scale,
            backgroundImage: `url(${getAssetUrl("tiles", "wall-south")})`,
            backgroundRepeat: "repeat-x",
            backgroundSize: `${TILE_SIZE * scale}px ${TILE_SIZE * scale}px`,
          }}
        />
        <div
          className="absolute left-0 top-0 h-full pixelated"
          style={{
            width: TILE_SIZE * scale,
            backgroundImage: `url(${getAssetUrl("tiles", "wall-west")})`,
            backgroundRepeat: "repeat-y",
            backgroundSize: `${TILE_SIZE * scale}px ${TILE_SIZE * scale}px`,
          }}
        />
        <div
          className="absolute right-0 top-0 h-full pixelated"
          style={{
            width: TILE_SIZE * scale,
            backgroundImage: `url(${getAssetUrl("tiles", "wall-east")})`,
            backgroundRepeat: "repeat-y",
            backgroundSize: `${TILE_SIZE * scale}px ${TILE_SIZE * scale}px`,
          }}
        />

        <PixelAsset assetKey="door-closed" category="tiles" x={104} y={0} width={16} height={32} scale={scale} />

        {WINDOW_X_POSITIONS.map((x) => (
          <div
            key={`window-${x}`}
            className="absolute"
            style={{
              left: x * scale,
              top: 0,
              width: 32 * scale,
              height: 24 * scale,
              backgroundColor: windowColor,
            }}
          >
            <PixelAsset assetKey="window" category="tiles" x={0} y={0} width={32} height={24} scale={scale} />
          </div>
        ))}
      </div>

      <div className="absolute inset-0" style={{ zIndex: LAYERS.furniture - 1 }}>
        <div
          className="office-light-shaft office-light-shaft-left absolute"
          style={{ left: 178 * scale, top: 18 * scale, width: 140 * scale, height: 174 * scale, opacity: shaftOpacity }}
        />
        <div
          className="office-light-shaft office-light-shaft-right absolute"
          style={{ left: 354 * scale, top: 18 * scale, width: 126 * scale, height: 238 * scale, opacity: shaftOpacity }}
        />
      </div>

      <div className="absolute inset-0" style={{ zIndex: LAYERS.furniture }}>
        {Object.entries(OFFICE_ENVIRONMENT_ZONES).map(([zoneName, zone]) => (
          <div
            key={zoneName}
            data-office-environment-zone={zoneName}
            className="absolute"
            style={{
              left: zone.x * scale,
              top: zone.y * scale,
              width: zone.width * scale,
              height: zone.height * scale,
            }}
          />
        ))}

        {OFFICE_PARTITIONS.map((bounds, index) => (
          <div
            key={`partition-${index}`}
            data-office-partition
            className="absolute"
            style={{
              left: bounds.x * scale, top: bounds.y * scale,
              width: bounds.width * scale, height: bounds.height * scale,
              backgroundColor: "color-mix(in srgb, var(--plant) 40%, var(--floor))",
              borderTop: `${2 * scale}px solid var(--floor)`,
              borderLeft: `${scale}px solid var(--wood-dark)`,
              boxShadow: `${2 * scale}px ${3 * scale}px 0 color-mix(in srgb, var(--wood-dark) 45%, transparent)`,
            }}
          />
        ))}
        {OFFICE_ENVIRONMENT_ITEMS.map((item) => (
          <PixelAsset
            key={item.id}
            assetKey={item.assetKey}
            category="furniture"
            x={item.bounds.x}
            y={item.bounds.y}
            width={item.bounds.width}
            height={item.bounds.height}
            scale={scale}
          />
        ))}
      </div>
    </div>
  );
}
