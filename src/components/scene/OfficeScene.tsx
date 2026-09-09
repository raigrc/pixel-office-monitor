"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import Image from "next/image";
import CharacterSprite from "./CharacterSprite";
import DeskDecor from "./DeskDecor";
import { useCameraZoom } from "./SceneViewport";
import { getActorActivityPose, getActorBusyCount } from "@/lib/scene/actor-pose";
import { TILE_SIZE, OFFICE_DIMENSIONS, DESK_ANCHORS, getDeskAnchor, LAYERS, ORCHESTRATOR_SPOT } from "@/lib/scene/office-layout";
import { STANDING_ADMIN } from "@/lib/scene/roster";
import { getAssetUrl } from "@/lib/scene/assets";
import { useDayNight } from "@/lib/scene/day-night";
import type { ActorInfo, FloorInfo, InvocationInfo } from "@/lib/monitor-types";
import type { VisualHandoffState } from "@/lib/scene/presentation";

interface OfficeSceneProps {
  floors: FloorInfo[];
  actors: ActorInfo[];
  invocations: InvocationInfo[];
  activeFloorId: string | null;
  handoffStates?: VisualHandoffState[];
  onCubicleClick?: (actor: ActorInfo) => void;
  scale?: number;
}

export default function OfficeScene({
  floors,
  actors,
  invocations,
  activeFloorId,
  handoffStates = [],
  onCubicleClick,
  scale = 1,
}: OfficeSceneProps) {
  const activeFloor = useMemo(
    () => floors.find((f) => f.floorId === activeFloorId) ?? floors[0] ?? null,
    [floors, activeFloorId]
  );

  // Roster room: seated roster at fixed desks, admin standing by the door.
  // One desk per seat — unknown keys share the intern corner, freshest wins.
  const seatedActors = useMemo(() => {
    const bySeat = new Map<number, ActorInfo>();
    for (const a of actors) {
      if (a.floorId !== activeFloor?.floorId || a.role === "system") continue;
      if (a.agentKey === STANDING_ADMIN || a.seatIndex < 0) continue;
      const prev = bySeat.get(a.seatIndex);
      if (!prev || a.lastObservedAt >= prev.lastObservedAt) bySeat.set(a.seatIndex, a);
    }
    return Array.from(bySeat.values());
  }, [actors, activeFloor?.floorId]);

  const floorActors = seatedActors;

  const adminActors = useMemo(
    () => actors.filter((a) => a.floorId === activeFloor?.floorId && a.agentKey === STANDING_ADMIN),
    [actors, activeFloor?.floorId]
  );

  const handoffsOnFloor = useMemo(
    () => handoffStates.filter(h => {
      const sender = actors.find(a => a.actorId === h.senderActorId);
      return sender?.floorId === activeFloor?.floorId;
    }),
    [handoffStates, actors, activeFloor?.floorId]
  );

  // Viewport zoom — labels divide world sizes by net zoom so glyphs stay ~10 screen px.
  const viewZoom = useCameraZoom();
  const netZoom = Math.max(0.5, scale * viewZoom);
  // Day-night phase from client clock (06–18 day). No toggle per spec.
  const dayNight = useDayNight();
  const isNight = dayNight === "night";

  if (!activeFloor) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ width: OFFICE_DIMENSIONS.width * scale, height: OFFICE_DIMENSIONS.height * scale }}
        role="img"
        aria-label="No active floor"
      >
        <div className="text-center text-[#64748B]">
          <p style={{ fontFamily: "var(--font-vt), VT323, monospace", fontSize: "16px" }}>
            ◧ no active floor
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative"
      style={{
        width: OFFICE_DIMENSIONS.width * scale,
        height: OFFICE_DIMENSIONS.height * scale,
      }}
      role="img"
      aria-label={`Office floor: ${activeFloor.title}`}
    >
      <div className="absolute inset-0" style={{ zIndex: LAYERS.floor }}>
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: "#D8C8A7",
            backgroundImage: [
              "linear-gradient(rgba(99, 78, 48, 0.12) 1px, transparent 1px)",
              "linear-gradient(90deg, rgba(99, 78, 48, 0.12) 1px, transparent 1px)",
              "radial-gradient(circle at 5px 6px, rgba(255, 255, 255, 0.2) 0 1px, transparent 1px)",
            ].join(", "),
            backgroundRepeat: "repeat",
            backgroundSize: `${TILE_SIZE}px ${TILE_SIZE}px`,
            imageRendering: "pixelated",
          }}
        />
      </div>

      <div className="absolute inset-0" style={{ zIndex: LAYERS.rearWalls }}>
        <div
          className="absolute left-0 top-0 w-full"
          style={{ height: TILE_SIZE, backgroundImage: `url(${getAssetUrl("tiles", "wall-north")})`, backgroundRepeat: "repeat-x", imageRendering: "pixelated" }}
        />
        <div
          className="absolute left-0 bottom-0 w-full"
          style={{ height: TILE_SIZE, backgroundImage: `url(${getAssetUrl("tiles", "wall-south")})`, backgroundRepeat: "repeat-x", imageRendering: "pixelated" }}
        />
        <div
          className="absolute left-0 top-0 h-full"
          style={{ width: TILE_SIZE, backgroundImage: `url(${getAssetUrl("tiles", "wall-west")})`, backgroundRepeat: "repeat-y", imageRendering: "pixelated" }}
        />
        <div
          className="absolute right-0 top-0 h-full"
          style={{ width: TILE_SIZE, backgroundImage: `url(${getAssetUrl("tiles", "wall-east")})`, backgroundRepeat: "repeat-y", imageRendering: "pixelated" }}
        />

        <div
          className="absolute"
          style={{
            left: 80,
            top: 0,
            width: 16,
            height: 32,
            backgroundImage: `url(${getAssetUrl("tiles", "door-closed")})`,
            imageRendering: "pixelated",
          }}
        />
        {/* Windows: sky color follows clock. Day = warm sky, night = dark + moon. */}
        {[144, 240].map((wx) => (
          <div
            key={`window-${wx}`}
            className="absolute"
            style={{
              left: wx,
              top: 0,
              width: 32,
              height: 16,
              backgroundColor: isNight ? "#0B1220" : "#BAE6FD",
              border: "2px solid #334155",
              imageRendering: "pixelated",
              transition: "background-color 900ms var(--ease-out)",
            }}
            aria-hidden="true"
          >
            {!isNight ? (
              <div
                style={{
                  position: "absolute",
                  left: 18,
                  top: 3,
                  width: 6,
                  height: 6,
                  backgroundColor: "#FDE68A",
                  borderRadius: 0,
                }}
              />
            ) : (
              <div
                style={{
                  position: "absolute",
                  left: 19,
                  top: 2,
                  width: 5,
                  height: 5,
                  backgroundColor: "#E2E8F0",
                  boxShadow: "0 0 4px rgba(226,232,240,0.9)",
                }}
              />
            )}
            <div
              style={{
                position: "absolute",
                left: 15,
                top: 0,
                width: 2,
                height: 16,
                backgroundColor: "#334155",
              }}
            />
          </div>
        ))}
      </div>

      <div
        className="absolute inset-0"
        style={{
          zIndex: LAYERS.furniture,
          position: "relative",
        }}
      >
        {Object.entries(DESK_ANCHORS).map(([indexStr, desk]) => {
          const index = parseInt(indexStr, 10);
          const actorAtDesk = floorActors.find((a) => a.seatIndex === index);
          const isOccupied = !!actorAtDesk;
          const deskPose = actorAtDesk ? getActorActivityPose(actorAtDesk, invocations) : "idle";
          // Lamp rule: on while working, celebrating a finish, or pending —
          // off when the desk sleeps. Roster desks are permanent; activity,
          // not occupancy, drives the lamp.
          const lampOn = deskPose === "work" || deskPose === "success" || deskPose === "seat";
          const isAwakeAtDesk = deskPose === "work" || deskPose === "success";
          // Monitor glows only while its agent works — a pulsing idle screen
          // teaches the eye to ignore the one signal that matters.
          const isWorkingAtDesk = deskPose === "work";

          return (
            <div
              key={`desk-${index}`}
              className="absolute"
              style={{
                left: desk.furnitureOrigin.x * scale,
                top: desk.furnitureOrigin.y * scale,
                width: 64 * scale,
                height: 64 * scale,
                cursor: actorAtDesk ? "pointer" : "default",
              }}
              onClick={() => {
                if (actorAtDesk) onCubicleClick?.(actorAtDesk);
              }}
            >
              <Image
                src={getAssetUrl("furniture", "desk-rear")}
                alt=""
                width={64}
                height={64}
                className="absolute"
                style={{
                  left: 0,
                  top: 0,
                  imageRendering: "pixelated",
                }}
                // Whole room is always above the fold (static fit camera):
                // eager everywhere, preload only for occupied desks.
                loading="eager"
                priority={isOccupied}
              />
              <Image
                src={getAssetUrl("furniture", "monitor-base")}
                alt=""
                width={16}
                height={16}
                className="absolute"
                style={{
                  left: desk.propAnchors.monitor.x * scale - desk.furnitureOrigin.x * scale,
                  top: desk.propAnchors.monitor.y * scale - desk.furnitureOrigin.y * scale,
                  imageRendering: "pixelated",
                }}
              />
              {/* Monitor back-bleed: light escapes upward onto the desk behind
                  it. Awake desks (working, celebrating, pending) bleed faint
                  by day and strong by night; sleeping desks stay dark. */}
              {(isAwakeAtDesk || deskPose === "seat") && (
                <div
                  aria-hidden="true"
                  className="absolute pointer-events-none"
                  style={{
                    left: (desk.propAnchors.monitor.x - 14) * scale - desk.furnitureOrigin.x * scale,
                    top: (desk.propAnchors.monitor.y - 18) * scale - desk.furnitureOrigin.y * scale,
                    width: 44 * scale,
                    height: 30 * scale,
                    background: isAwakeAtDesk
                      ? isNight
                        ? "radial-gradient(ellipse at 50% 78%, rgba(34,197,94,0.4) 0%, rgba(34,197,94,0.14) 50%, transparent 72%)"
                        : "radial-gradient(ellipse at 50% 78%, rgba(34,197,94,0.16) 0%, rgba(34,197,94,0.06) 50%, transparent 72%)"
                      : isNight
                        ? "radial-gradient(ellipse at 50% 78%, rgba(148,197,255,0.28) 0%, rgba(148,197,255,0.1) 50%, transparent 72%)"
                        : "radial-gradient(ellipse at 50% 78%, rgba(148,197,255,0.12) 0%, transparent 70%)",
                    transition: "opacity 900ms var(--ease-out)",
                  }}
                />
              )}
              <Image
                src={isWorkingAtDesk
                  ? getAssetUrl("furniture", "monitor-screen-working")
                  : isAwakeAtDesk || deskPose === "seat"
                    ? getAssetUrl("furniture", "monitor-screen")
                    : getAssetUrl("furniture", "monitor-screen-off")}
                alt={actorAtDesk ? `${actorAtDesk.agentKey} monitor` : ""}
                width={16}
                height={8}
                className={isWorkingAtDesk ? "absolute monitor-working" : "absolute"}
                style={{
                  left: desk.propAnchors.monitor.x * scale - desk.furnitureOrigin.x * scale,
                  // Base top + 1 keeps the state inside its 16px bezel.
                  top: (desk.propAnchors.monitor.y + 1) * scale - desk.furnitureOrigin.y * scale,
                  imageRendering: "pixelated",
                  opacity: isWorkingAtDesk ? (isNight ? 1 : 0.92) : isAwakeAtDesk || deskPose === "seat" ? 0.9 : 0.8,
                  filter: isWorkingAtDesk
                    ? isNight
                      ? "brightness(1.45) drop-shadow(0 0 8px rgba(74,222,128,1))"
                      : "brightness(1.12) drop-shadow(0 0 3px rgba(74,222,128,0.5))"
                    : isAwakeAtDesk || deskPose === "seat"
                      ? isNight
                        ? "brightness(1.25)"
                        : "brightness(1.03)"
                      : undefined,
                }}
              />
              <Image
                src={getAssetUrl("furniture", "plant")}
                alt=""
                width={16}
                height={24}
                className="absolute"
                style={{
                  left: desk.propAnchors.plant.x * scale - desk.furnitureOrigin.x * scale,
                  top: desk.propAnchors.plant.y * scale - desk.furnitureOrigin.y * scale,
                  imageRendering: "pixelated",
                }}
              />
              {/* Lamp halo: only while awake (faint by day via 0.35 layer, full by night). */}
              {isNight && lampOn && (
                <div
                  aria-hidden="true"
                  className="absolute pointer-events-none lamp-glow"
                  style={{
                    left: (desk.propAnchors.lamp.x - 12) * scale - desk.furnitureOrigin.x * scale,
                    top: (desk.propAnchors.lamp.y - 10) * scale - desk.furnitureOrigin.y * scale,
                    width: 32 * scale,
                    height: 32 * scale,
                    background:
                      "radial-gradient(circle, rgba(251,191,36,0.4) 0%, rgba(251,191,36,0.15) 45%, transparent 70%)",
                  }}
                />
              )}
              <Image
                src={getAssetUrl("furniture", "lamp")}
                alt=""
                width={8}
                height={16}
                className="absolute"
                style={{
                  left: desk.propAnchors.lamp.x * scale - desk.furnitureOrigin.x * scale,
                  top: desk.propAnchors.lamp.y * scale - desk.furnitureOrigin.y * scale,
                  imageRendering: "pixelated",
                  filter: !lampOn
                    ? "brightness(0.65)"
                    : isNight
                      ? "brightness(1.5) drop-shadow(0 0 6px rgba(253,230,138,1))"
                      : "brightness(1)",
                  transition: "filter 900ms var(--ease-out)",
                }}
              />
              {/* Per-cubicle role decorations (wrench, books, shield...). */}
              {actorAtDesk && (
                <DeskDecor
                  agentKey={actorAtDesk.agentKey}
                  scale={scale}
                  isWorking={isWorkingAtDesk}
                />
              )}
            </div>
          );
        })}

        {/* Decor strip below the third row (room is 384 tall now). */}
        <div
          className="absolute"
          style={{
            left: 16 * scale,
            top: 304 * scale,
            width: 32 * scale,
            height: 64 * scale,
          }}
        >
          <Image
            src={getAssetUrl("furniture", "storage")}
            alt="Storage cabinet"
            width={32}
            height={64}
            style={{ imageRendering: "pixelated" }}
          />
        </div>

        <div
          className="absolute"
          style={{
            left: 64 * scale,
            top: 320 * scale,
            width: 48 * scale,
            height: 32 * scale,
          }}
        >
          <Image
            src={getAssetUrl("furniture", "whiteboard")}
            alt="Whiteboard"
            width={48}
            height={32}
            style={{ imageRendering: "pixelated" }}
          />
        </div>

        <div
          className="absolute"
          style={{
            left: 128 * scale,
            top: 328 * scale,
            width: 16 * scale,
            height: 24 * scale,
          }}
        >
          <Image
            src={getAssetUrl("furniture", "coffee-machine")}
            alt="Coffee machine"
            width={16}
            height={24}
            style={{ imageRendering: "pixelated" }}
          />
        </div>
      </div>

      <div className="absolute inset-0" style={{ zIndex: LAYERS.actors }}>
        {floorActors.map((actor) => {
          const desk = getDeskAnchor(actor.seatIndex);
          const handoff = handoffsOnFloor.find(h => h.senderActorId === actor.actorId || h.recipientActorId === actor.actorId);

          let position = { x: desk.seatedActorAnchor.x * scale, y: desk.seatedActorAnchor.y * scale };
          let facing: "up" | "down" | "left" | "right" = "down";
          let pose: VisualHandoffState["senderPose"] = getActorActivityPose(actor, invocations);

          if (handoff && handoff.senderActorId === actor.actorId) {
            position = { x: handoff.senderPosition.x * scale, y: handoff.senderPosition.y * scale };
            facing = handoff.senderFacing;
            pose = handoff.senderPose;
          } else if (handoff && handoff.recipientActorId === actor.actorId) {
            position = { x: desk.handoffPoint.x * scale, y: desk.handoffPoint.y * scale };
            facing = "up";
            pose = handoff.recipientPose;
          }

          return (
            <div key={actor.actorId} className="absolute inset-0 pointer-events-none">
              <CharacterSprite
                actorId={actor.actorId}
                agentKey={actor.agentKey}
                position={position}
                facing={facing}
                pose={pose}
                scale={scale}
              />
              {/* Zzz only when truly sleeping. Pending (seat) stays awake. */}
              {pose === "idle" && (
                <div
                  className="zzz-float absolute select-none"
                  aria-hidden="true"
                  style={{
                    left: position.x - 18 / netZoom,
                    top: position.y - 52 * scale,
                    width: 36 / netZoom,
                    fontFamily: "var(--font-pixel), monospace",
                    color: "#7DD3FC",
                    textShadow: `0 0 ${1 / netZoom}px #0B1220, ${1 / netZoom}px ${1 / netZoom}px 0 #0B1220`,
                    textAlign: "center",
                    lineHeight: 1,
                  }}
                >
                  <span style={{ fontSize: 10 / netZoom }}>Z</span>
                  <span style={{ fontSize: 7 / netZoom }}>z</span>
                  <span style={{ fontSize: 5 / netZoom }}>z</span>
                </div>
              )}
            </div>
          );
        })}

        {/* Standing admin by the door — oversees the floor, never seated. */}
        {adminActors.map((actor) => {
          const position = { x: ORCHESTRATOR_SPOT.x * scale, y: ORCHESTRATOR_SPOT.y * scale };
          const pose = getActorActivityPose(actor, invocations);
          return (
            <div key={actor.actorId} className="absolute inset-0 pointer-events-none">
              <div
                className="absolute"
                role="button"
                tabIndex={0}
                aria-label={`${actor.displayName || actor.agentKey} inspector`}
                onClick={() => onCubicleClick?.(actor)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onCubicleClick?.(actor);
                }}
                style={{
                  left: position.x - 20 * scale,
                  top: position.y - 40 * scale,
                  width: 40 * scale,
                  height: 44 * scale,
                  cursor: "pointer",
                  pointerEvents: "auto",
                }}
              />
              <CharacterSprite
                actorId={actor.actorId}
                agentKey={actor.agentKey}
                position={position}
                facing="down"
                pose={pose}
                scale={scale}
              />
            </div>
          );
        })}

        {handoffsOnFloor.map((handoff) => {
          if (!handoff) return null;
          
          const sender = actors.find(a => a.actorId === handoff.senderActorId);
          const recipient = actors.find(a => a.actorId === handoff.recipientActorId);
          
          if (!sender || !recipient) return null;
          
          return (
            <motion.div
              key={`handoff-task-${handoff.jobId}`}
              className="absolute pointer-events-none"
              style={{
                left: handoff.senderPosition.x * scale,
                top: (handoff.senderPosition.y - 40) * scale,
                zIndex: LAYERS.taskToken,
              }}
              initial={{ opacity: 0, transform: "scale(0.95)" }}
              animate={{ opacity: 1, transform: "scale(1)" }}
              exit={{ opacity: 0, transform: "scale(0.95)" }}
              transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
            >
              <Image
                src={getAssetUrl("props", "task-folder")}
                alt="Task handoff"
                width={8}
                height={8}
                style={{ imageRendering: "pixelated" }}
              />
            </motion.div>
          );
        })}
      </div>

      {/* Delegation links: live sender → recipient invocations */}
      <svg
        className="absolute inset-0 pointer-events-none"
        width={OFFICE_DIMENSIONS.width * scale}
        height={OFFICE_DIMENSIONS.height * scale}
        style={{ zIndex: LAYERS.taskToken }}
        aria-hidden="true"
      >
        {invocations
          .filter((inv) => inv.executionStatus === "requested" || inv.executionStatus === "started")
          .map((inv) => {
            const sender = actors.find((a) => a.actorId === inv.senderActorId);
            const recipient = actors.find((a) => a.actorId === inv.recipientActorId);
            if (!sender || !recipient) return null;
            const handoff = handoffsOnFloor.find(
              (h) => h.senderActorId === sender.actorId && h.recipientActorId === recipient.actorId
            );
            // Standing admin links start/end at the door spot, not a desk.
            const senderSpot = sender.agentKey === STANDING_ADMIN ? ORCHESTRATOR_SPOT : getDeskAnchor(sender.seatIndex).seatedActorAnchor;
            const sPos = handoff ? handoff.senderPosition : senderSpot;
            const rDesk = getDeskAnchor(recipient.seatIndex);
            const rPos = handoff
              ? rDesk.handoffPoint
              : recipient.agentKey === STANDING_ADMIN
                ? ORCHESTRATOR_SPOT
                : rDesk.seatedActorAnchor;
            const started = inv.executionStatus === "started";
            return (
              <line
                key={`delegation-${inv.invocationId}`}
                x1={sPos.x * scale}
                y1={(sPos.y - 28) * scale}
                x2={rPos.x * scale}
                y2={(rPos.y - 28) * scale}
                stroke={started ? "#3B82F6" : "#64748B"}
                strokeWidth={Math.max(1, scale)}
                strokeDasharray={`${4 * scale} ${3 * scale}`}
                opacity={started ? 0.9 : 0.5}
                className={started ? "delegation-link-active" : undefined}
              >
                <title>{`${sender.displayName || sender.agentKey} → ${recipient.displayName || recipient.agentKey}`}</title>
              </line>
            );
          })}
      </svg>

      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: LAYERS.foreground }}>
        {Object.entries(DESK_ANCHORS).map(([indexStr, desk]) => (
          <Image
            key={`desk-front-${indexStr}`}
            src={getAssetUrl("furniture", "desk-front")}
            alt=""
            width={64}
            height={32}
            className="absolute"
            style={{
              left: desk.furnitureOrigin.x * scale,
              // Front top 36 below origin: character rows 0-20 stay visible
              // (head + shoulders + hands), rows 20-32 tuck behind (seated legs).
              // Front bottom stays clear of the y128 walk lane on both rows.
              top: (desk.furnitureOrigin.y + 36) * scale,
              imageRendering: "pixelated",
              filter: isNight ? "brightness(0.72)" : undefined,
              transition: "filter 900ms var(--ease-out)",
            }}
          />
        ))}
      </div>

      {/* Night tint: darkens room. Lights render ABOVE it so they truly spill. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none daynight-tint"
        style={{
          zIndex: LAYERS.foreground + 1,
          backgroundColor: "#0B1220",
          opacity: isNight ? 0.45 : 0,
        }}
      />
      {/* Light layer: additive spill above tint (screen blend).
          Monitor bleed goes BEHIND the monitor (upward, away from camera) —
          we see the back of the monitor. Day renders faint, night strong. */}
      {
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: LAYERS.foreground + 2, opacity: isNight ? 1 : 0.35, transition: "opacity 900ms var(--ease-out)" }}
        >
          {Object.entries(DESK_ANCHORS).map(([indexStr, desk]) => {
            const index = parseInt(indexStr, 10);
            const actorAtDesk = floorActors.find((a) => a.seatIndex === index);
            const deskPose = actorAtDesk ? getActorActivityPose(actorAtDesk, invocations) : "idle";
            const isAwakeAtDesk = deskPose === "work" || deskPose === "success";
            // Lamp rule: on while working, celebrating, or pending — off asleep.
            const lampOn = deskPose === "work" || deskPose === "success" || deskPose === "seat";
            const lampX = desk.propAnchors.lamp.x * scale;
            const lampY = desk.propAnchors.lamp.y * scale;
            const monX = desk.propAnchors.monitor.x * scale;
            const monY = desk.propAnchors.monitor.y * scale;
            return (
              <div key={`night-light-${index}`} className="absolute inset-0">
                {/* Lamp: on when occupied, dark when empty. */}
                {lampOn && (
                  <>
                    {/* Lamp cone: warm trapezoid from bulb down to desk. */}
                    <div
                      className="absolute lamp-cone"
                      style={{
                        left: lampX - 8 * scale,
                        top: lampY + 2 * scale,
                        width: 24 * scale,
                        height: 38 * scale,
                        background:
                          "linear-gradient(to bottom, rgba(251,191,36,0.55) 0%, rgba(251,191,36,0.22) 55%, transparent 100%)",
                        clipPath: "polygon(38% 0, 62% 0, 100% 100%, 0% 100%)",
                        mixBlendMode: "screen",
                      }}
                    />
                    {/* Lamp pool on desk/floor. */}
                    <div
                      className="absolute"
                      style={{
                        left: (desk.furnitureOrigin.x + 2) * scale,
                        top: (desk.furnitureOrigin.y + 28) * scale,
                        width: 60 * scale,
                        height: 30 * scale,
                        background:
                          "radial-gradient(ellipse at 30% 40%, rgba(251,191,36,0.5) 0%, rgba(251,191,36,0.18) 50%, transparent 72%)",
                        mixBlendMode: "screen",
                      }}
                    />
                    {/* Bulb hot spot: emissive source punches through dark. */}
                    <div
                      className="absolute"
                      style={{
                        left: lampX + 1 * scale,
                        top: lampY + 3 * scale,
                        width: 6 * scale,
                        height: 6 * scale,
                        backgroundColor: "#FDE68A",
                        boxShadow: `0 0 ${8 * scale}px rgba(253,230,138,0.95), 0 0 ${16 * scale}px rgba(251,191,36,0.6)`,
                        mixBlendMode: "screen",
                      }}
                    />
                    {/* Desk surface highlight strip under lamp. */}
                    <div
                      className="absolute"
                      style={{
                        left: (desk.furnitureOrigin.x + 4) * scale,
                        top: (desk.furnitureOrigin.y + 36) * scale,
                        width: 56 * scale,
                        height: Math.max(2, 2 * scale),
                        background:
                          "linear-gradient(to right, rgba(251,191,36,0.65), rgba(251,191,36,0.15))",
                        mixBlendMode: "screen",
                      }}
                    />
                  </>
                )}
                {/* Monitor bleed: back faces camera, so light escapes BEHIND
                    the monitor (upward, onto desk-rear). Awake (working or
                    just-finished) = green afterglow, pending = cool,
                    asleep = nothing. */}
                {(isAwakeAtDesk || deskPose === "seat") && (
                  <>
                    <div
                      className={`absolute ${isAwakeAtDesk ? "monitor-spill-working" : ""}`}
                      style={{
                        left: monX - 12 * scale,
                        top: monY - 18 * scale,
                        width: 40 * scale,
                        height: 30 * scale,
                        background: isAwakeAtDesk
                          ? "radial-gradient(ellipse at 50% 82%, rgba(34,197,94,0.6) 0%, rgba(34,197,94,0.22) 50%, transparent 72%)"
                          : "radial-gradient(ellipse at 50% 82%, rgba(148,197,255,0.36) 0%, rgba(148,197,255,0.1) 55%, transparent 75%)",
                        mixBlendMode: "screen",
                      }}
                    />
                    {/* Back-panel rim: top edge catches screen light. */}
                    <div
                      className="absolute"
                      style={{
                        left: monX,
                        top: monY - 1 * scale,
                        width: 16 * scale,
                        height: Math.max(1, 1.5 * scale),
                        backgroundColor: isAwakeAtDesk ? "#4ADE80" : "#93C5FD",
                        opacity: isAwakeAtDesk ? 0.85 : 0.55,
                        boxShadow: isAwakeAtDesk
                          ? `0 0 ${8 * scale}px rgba(74,222,128,0.9)`
                          : `0 0 ${4 * scale}px rgba(147,197,253,0.7)`,
                        mixBlendMode: "screen",
                      }}
                    />
                    {/* Power LED dot on the back panel. */}
                    <div
                      className="absolute"
                      style={{
                        left: monX + 12 * scale,
                        top: (desk.propAnchors.monitor.y + 5) * scale,
                        width: Math.max(1, 1.5 * scale),
                        height: Math.max(1, 1.5 * scale),
                        backgroundColor: isAwakeAtDesk ? "#4ADE80" : "#F59E0B",
                        boxShadow: `0 0 ${4 * scale}px rgba(74,222,128,0.9)`,
                        mixBlendMode: "screen",
                      }}
                    />
                    {/* Faint bounce toward actor side. */}
                    <div
                      className="absolute"
                      style={{
                        left: monX - 8 * scale,
                        top: (desk.furnitureOrigin.y + 24) * scale,
                        width: 32 * scale,
                        height: 12 * scale,
                        background: isAwakeAtDesk
                          ? "radial-gradient(ellipse at center, rgba(34,197,94,0.18) 0%, transparent 70%)"
                          : "radial-gradient(ellipse at center, rgba(147,197,253,0.12) 0%, transparent 70%)",
                        mixBlendMode: "screen",
                      }}
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>
      }

      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: LAYERS.uiLabels }}>
        {floorActors.map((actor) => {
          const desk = getDeskAnchor(actor.seatIndex);
          const actorLabel = (actor.displayName || actor.agentKey).replace(/-/g, " ");
          // Repeat calls stack here: busy count becomes a queue badge.
          const busyCount = getActorBusyCount(actor.actorId, invocations);
          // Nameplate pinned on the desk front — never collides with the row
          // above, at any room height. Screen-space font, desk-width plate.
          const fs = 10 / netZoom;
          const lw = Math.min(120 / netZoom, 60 * scale);
          const o = 1 / netZoom;
          return (
            <div
              key={`label-${actor.actorId}`}
              className="absolute select-none"
              title={busyCount > 1 ? `${actorLabel} (${busyCount} tasks)` : actorLabel}
              style={{
                left: (desk.furnitureOrigin.x + 32) * scale - lw / 2,
                top: (desk.furnitureOrigin.y + 45) * scale,
                width: lw,
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
                fontSize: fs,
                lineHeight: `${12 / netZoom}px`,
                color: busyCount > 1 ? "#4ADE80" : "#F1F5F9",
                textShadow: `0 0 ${o}px #0B1220, ${o}px ${o}px 0 #0B1220, ${-o}px ${-o}px 0 #0B1220, ${o}px ${-o}px 0 #0B1220, ${-o}px ${o}px 0 #0B1220`,
                fontFamily: "var(--font-pixel), monospace",
                textAlign: "center",
                pointerEvents: "none",
              }}
            >
              {actorLabel}{busyCount > 1 ? ` ×${busyCount}` : ""}
            </div>
          );
        })}
        {adminActors.map((actor) => {
          const actorLabel = (actor.displayName || actor.agentKey).replace(/-/g, " ");
          const fs = 10 / netZoom;
          const lw = 120 / netZoom;
          const o = 1 / netZoom;
          return (
            <div
              key={`label-admin-${actor.actorId}`}
              className="absolute select-none"
              title={actorLabel}
              style={{
                left: ORCHESTRATOR_SPOT.x * scale - lw / 2,
                top: (ORCHESTRATOR_SPOT.y - 24) * scale,
                width: lw,
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
                fontSize: fs,
                lineHeight: `${12 / netZoom}px`,
                color: "#FBBF24",
                textShadow: `0 0 ${o}px #0B1220, ${o}px ${o}px 0 #0B1220`,
                fontFamily: "var(--font-pixel), monospace",
                textAlign: "center",
                pointerEvents: "none",
              }}
            >
              {actorLabel}
            </div>
          );
        })}
      </div>
    </div>
  );
}

