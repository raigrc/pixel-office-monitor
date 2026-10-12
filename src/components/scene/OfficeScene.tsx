"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import Image from "next/image";
import CharacterSprite from "./CharacterSprite";
import DeskDecor from "./DeskDecor";
import OfficeEnvironment from "./OfficeEnvironment";
import { useCameraZoom } from "./SceneViewport";
import { actorActiveWorkCount, actorPose, type ActivityModel } from "@/lib/activity/activity-model";
import { OFFICE_DIMENSIONS, getDeskAnchor, LAYERS, ORCHESTRATOR_SPOT } from "@/lib/scene/office-layout";
import { STANDING_ADMIN } from "@/lib/scene/roster";
import { getAssetUrl } from "@/lib/scene/assets";
import { useDayNight } from "@/lib/scene/day-night";
import { getActorHitTarget } from "@/lib/scene/hit-target";
import { getSessionAccentProperties } from "@/lib/session-visual-identity";
import type { ActorInfo, FloorInfo } from "@/lib/monitor-types";
import type { VisualActorPoseState, VisualHandoffState } from "@/lib/scene/presentation";

interface OfficeSceneProps {
  floors: FloorInfo[];
  actors: ActorInfo[];
  activeFloorId: string | null;
  handoffStates?: VisualHandoffState[];
  actorPoseStates?: VisualActorPoseState[];
  activity: ActivityModel;
  onCubicleClick?: (actor: ActorInfo) => void;
  scale?: number;
}

export default function OfficeScene({
  floors,
  actors,
  activeFloorId,
  handoffStates = [],
  actorPoseStates = [],
  activity,
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
    return Array.from(bySeat.values()).sort((a, b) => a.seatIndex - b.seatIndex);
  }, [actors, activeFloor?.floorId]);

  const floorActors = seatedActors;
  const visibleDeskEntries = useMemo(
    () => floorActors.map((actor) => [actor.seatIndex, getDeskAnchor(actor.seatIndex)] as const),
    [floorActors]
  );

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
  const timeStage = useDayNight();
  const isDusk = timeStage === "dusk";
  const isNight = timeStage === "night";

  if (!activeFloor) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ width: OFFICE_DIMENSIONS.width * scale, height: OFFICE_DIMENSIONS.height * scale }}
        role="img"
        aria-label="No active floor"
      >
        <div className="text-center text-[var(--muted)]">
          <p style={{ fontFamily: "var(--font-vt), VT323, monospace", fontSize: "16px" }}>
            No active floor
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative time-stage-${timeStage}`}
      style={{
        ...getSessionAccentProperties(activeFloor.floorId),
        width: OFFICE_DIMENSIONS.width * scale,
        height: OFFICE_DIMENSIONS.height * scale,
      }}
      role="group"
      aria-label={`Office floor: ${activeFloor.title}`}
      data-time-stage={timeStage}
    >
      <OfficeEnvironment scale={scale} timeStage={timeStage} />

      <div
        className="absolute inset-0"
        style={{
          zIndex: LAYERS.furniture,
          position: "relative",
        }}
      >
        {visibleDeskEntries.map(([index, desk]) => {
          const actorAtDesk = floorActors.find((a) => a.seatIndex === index);
          const deskPose = actorAtDesk ? actorPose(activity, actorAtDesk.actorId) : "idle";
          // Lamp rule: on while working, celebrating a finish, or pending —
          // off when the desk sleeps. Roster desks are permanent; activity,
          // not occupancy, drives the lamp.
          const lampOn = deskPose === "work" || deskPose === "success" || deskPose === "seat";
          const isAwakeAtDesk = deskPose === "work" || deskPose === "success";
          // Only active work pulses; success keeps a static afterglow.
          const isWorkingAtDesk = deskPose === "work";
          const monitorGlowColor = isWorkingAtDesk
            ? "var(--working)"
            : deskPose === "success"
              ? "var(--success)"
              : "var(--monitor-idle)";

          return (
            <div
              key={`desk-${index}`}
              data-office-desk={actorAtDesk?.agentKey}
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
                // Whole room is always above the fold in the static fit camera.
                loading="eager"
                unoptimized
              />
              <Image
                src={getAssetUrl("furniture", "monitor-base")}
                alt=""
                width={16}
                height={16}
                unoptimized
                className="absolute"
                style={{
                  left: desk.propAnchors.monitor.x * scale - desk.furnitureOrigin.x * scale,
                  top: desk.propAnchors.monitor.y * scale - desk.furnitureOrigin.y * scale,
                  imageRendering: "pixelated",
                }}
              />
              {/* Monitor back-bleed stays secondary to the screen state. */}
              {(isAwakeAtDesk || deskPose === "seat") && (
                <div
                  aria-hidden="true"
                  className="absolute pointer-events-none"
                  style={{
                    left: (desk.propAnchors.monitor.x - 14) * scale - desk.furnitureOrigin.x * scale,
                    top: (desk.propAnchors.monitor.y - 18) * scale - desk.furnitureOrigin.y * scale,
                    width: 44 * scale,
                    height: 30 * scale,
                    background: `radial-gradient(ellipse at 50% 78%, color-mix(in srgb, ${monitorGlowColor} ${isAwakeAtDesk ? 32 : 24}%, transparent) 0%, transparent 70%)`,
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
                alt=""
                width={16}
                height={8}
                unoptimized
                className={isWorkingAtDesk ? "absolute monitor-working" : "absolute"}
                style={{
                  left: desk.propAnchors.monitor.x * scale - desk.furnitureOrigin.x * scale,
                  // Base top + 1 keeps the state inside its 16px bezel.
                  top: (desk.propAnchors.monitor.y + 1) * scale - desk.furnitureOrigin.y * scale,
                  imageRendering: "pixelated",
                  opacity: isWorkingAtDesk ? (isNight ? 1 : 0.92) : isAwakeAtDesk || deskPose === "seat" ? 0.9 : 0.8,
                  filter: isWorkingAtDesk
                      ? isNight
                        ? "brightness(1.25) drop-shadow(0 0 4px var(--working))"
                        : "brightness(1.08)"
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
                unoptimized
                className="absolute"
                style={{
                  left: desk.propAnchors.plant.x * scale - desk.furnitureOrigin.x * scale,
                  top: desk.propAnchors.plant.y * scale - desk.furnitureOrigin.y * scale,
                  imageRendering: "pixelated",
                }}
              />
              <Image
                src={getAssetUrl("furniture", "lamp")}
                alt=""
                width={8}
                height={16}
                unoptimized
                className="absolute"
                style={{
                  left: desk.propAnchors.lamp.x * scale - desk.furnitureOrigin.x * scale,
                  top: desk.propAnchors.lamp.y * scale - desk.furnitureOrigin.y * scale,
                  imageRendering: "pixelated",
                  filter: !lampOn
                    ? "brightness(0.65)"
                    : isNight
                      ? "brightness(1.25) drop-shadow(0 0 3px var(--lamp))"
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

      </div>

      <div className="absolute inset-0" style={{ zIndex: LAYERS.actors }}>
        {floorActors.map((actor) => {
          const desk = getDeskAnchor(actor.seatIndex);
          const handoff = handoffsOnFloor.find(h => h.senderActorId === actor.actorId || h.recipientActorId === actor.actorId);

          let position = { x: desk.seatedActorAnchor.x * scale, y: desk.seatedActorAnchor.y * scale };
          let facing: "up" | "down" | "left" | "right" = "down";
          let pose: VisualHandoffState["senderPose"] = actorPoseStates.find((state) => state.actorId === actor.actorId)?.pose ?? actorPose(activity, actor.actorId);

          if (handoff && handoff.senderActorId === actor.actorId) {
            position = { x: handoff.senderPosition.x * scale, y: handoff.senderPosition.y * scale };
            facing = handoff.senderFacing;
            pose = handoff.senderPose;
          } else if (handoff && handoff.recipientActorId === actor.actorId) {
            position = { x: desk.handoffPoint.x * scale, y: desk.handoffPoint.y * scale };
            facing = "up";
            pose = handoff.recipientPose;
          }

          const hitTarget = getActorHitTarget(position, scale, viewZoom);

          return (
            <div key={actor.actorId} className="absolute inset-0 pointer-events-none">
              <div
                className="absolute"
                role="button"
                data-office-actor={actor.actorId}
                tabIndex={0}
                aria-label={`${actor.displayName || actor.agentKey} inspector`}
                onClick={() => onCubicleClick?.(actor)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") onCubicleClick?.(actor);
                }}
                style={{
                  left: hitTarget.left,
                  top: hitTarget.top,
                  width: hitTarget.size,
                  height: hitTarget.size,
                  cursor: "pointer",
                  pointerEvents: "auto",
                }}
              />
              <CharacterSprite
                actorId={actor.actorId}
                agentKey={actor.agentKey}
                position={position}
                facing={facing}
                pose={pose}
                scale={scale}
                decorative
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
                    color: "var(--monitor-idle)",
                    textShadow: `0 0 ${1 / netZoom}px var(--canvas), ${1 / netZoom}px ${1 / netZoom}px 0 var(--canvas)`,
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
          const handoff = handoffsOnFloor.find((state) => state.senderActorId === actor.actorId || state.recipientActorId === actor.actorId);
          const position = handoff?.senderActorId === actor.actorId
            ? { x: handoff.senderPosition.x * scale, y: handoff.senderPosition.y * scale }
            : { x: ORCHESTRATOR_SPOT.x * scale, y: ORCHESTRATOR_SPOT.y * scale };
          const basePose = actorPoseStates.find((state) => state.actorId === actor.actorId)?.pose ?? actorPose(activity, actor.actorId);
          const pose = handoff?.senderActorId === actor.actorId
            ? handoff.senderPose
            : handoff?.recipientActorId === actor.actorId
              ? handoff.recipientPose
              : basePose;
          const hitTarget = getActorHitTarget(position, scale, viewZoom);
          return (
            <div key={actor.actorId} className="absolute inset-0 pointer-events-none">
              <div
                className="absolute"
                role="button"
                data-office-actor={actor.actorId}
                tabIndex={0}
                aria-label={`${actor.displayName || actor.agentKey} inspector`}
                onClick={() => onCubicleClick?.(actor)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onCubicleClick?.(actor);
                }}
                style={{
                  left: hitTarget.left,
                  top: hitTarget.top,
                  width: hitTarget.size,
                  height: hitTarget.size,
                  cursor: "pointer",
                  pointerEvents: "auto",
                }}
              />
              <CharacterSprite
                actorId={actor.actorId}
                agentKey={actor.agentKey}
                position={position}
                facing={handoff?.senderActorId === actor.actorId ? handoff.senderFacing : "down"}
                pose={pose}
                scale={scale}
                decorative
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
                unoptimized
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
        {activity.directDelegations
          .filter((inv) => inv.floorId === activeFloor.floorId)
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
            const started = inv.lifecycle === "started";
            return (
              <line
                key={`delegation-${inv.invocationId}`}
                x1={sPos.x * scale}
                y1={(sPos.y - 28) * scale}
                x2={rPos.x * scale}
                y2={(rPos.y - 28) * scale}
                stroke={started ? "var(--delegation-active)" : "var(--delegation-pending)"}
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
        {visibleDeskEntries.map(([index, desk]) => (
          <Image
            key={`desk-front-${index}`}
            src={getAssetUrl("furniture", "desk-front")}
            alt=""
            width={64}
            height={32}
            unoptimized
            className="absolute"
            style={{
              left: desk.furnitureOrigin.x * scale,
                  // Front top 36 below origin: 48px character rows 0-33 stay visible
                  // (head + shoulders + hands), lower seated rows tuck behind.
              // Front bottom stays clear of the y128 walk lane on both rows.
              top: (desk.furnitureOrigin.y + 36) * scale,
              imageRendering: "pixelated",
              filter: isNight ? "brightness(0.78)" : isDusk ? "brightness(0.9)" : undefined,
              transition: "filter 900ms var(--ease-out)",
            }}
          />
        ))}
      </div>

      {/* Dusk and night tint preserve room detail. Lights render above it. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none daynight-tint"
        style={{
          zIndex: LAYERS.foreground + 1,
          backgroundColor: "var(--night)",
          opacity: isNight ? 0.28 : isDusk ? 0.12 : 0,
        }}
      />
      {/* Restrained additive spill above tint. */}
      {
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: LAYERS.foreground + 2, opacity: isNight ? 0.78 : isDusk ? 0.48 : 0.18, transition: "opacity 900ms var(--ease-out)" }}
        >
          {visibleDeskEntries.map(([index, desk]) => {
            const actorAtDesk = floorActors.find((a) => a.seatIndex === index);
            const deskPose = actorAtDesk ? actorPose(activity, actorAtDesk.actorId) : "idle";
            const isAwakeAtDesk = deskPose === "work" || deskPose === "success";
            const isWorkingAtDesk = deskPose === "work";
            const monitorGlowColor = isWorkingAtDesk
              ? "var(--working)"
              : deskPose === "success"
                ? "var(--success)"
                : "var(--monitor-idle)";
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
                          "linear-gradient(to bottom, color-mix(in srgb, var(--lamp) 38%, transparent) 0%, transparent 100%)",
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
                          "radial-gradient(ellipse at 30% 40%, color-mix(in srgb, var(--lamp) 32%, transparent) 0%, transparent 72%)",
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
                        backgroundColor: "var(--lamp)",
                        boxShadow: `0 0 ${5 * scale}px color-mix(in srgb, var(--lamp) 65%, transparent)`,
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
                          "linear-gradient(to right, color-mix(in srgb, var(--lamp) 48%, transparent), transparent)",
                        mixBlendMode: "screen",
                      }}
                    />
                  </>
                )}
                {/* Monitor bleed: back faces camera, so light escapes BEHIND
                    the monitor (upward, onto desk-rear). Awake (working or
                    just-finished) uses outcome afterglow, pending = cool,
                    asleep = nothing. */}
                {(isAwakeAtDesk || deskPose === "seat") && (
                  <>
                    <div
                      className={`absolute ${isWorkingAtDesk ? "monitor-spill-working" : ""}`}
                      style={{
                        left: monX - 12 * scale,
                        top: monY - 18 * scale,
                        width: 40 * scale,
                        height: 30 * scale,
                        background: `radial-gradient(ellipse at 50% 82%, color-mix(in srgb, ${monitorGlowColor} ${isAwakeAtDesk ? 42 : 30}%, transparent) 0%, transparent ${isAwakeAtDesk ? 72 : 75}%)`,
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
                        backgroundColor: monitorGlowColor,
                        opacity: isAwakeAtDesk ? 0.85 : 0.55,
                        boxShadow: `0 0 ${(isAwakeAtDesk ? 4 : 3) * scale}px ${monitorGlowColor}`,
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
                        backgroundColor: monitorGlowColor,
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
                        background: `radial-gradient(ellipse at center, color-mix(in srgb, ${monitorGlowColor} ${isAwakeAtDesk ? 15 : 10}%, transparent) 0%, transparent 70%)`,
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
          const busyCount = actorActiveWorkCount(activity, actor.actorId);
          // Nameplate pinned on the desk front — never collides with the row
          // above, at any room height. Screen-space font, desk-width plate.
          const fs = 10 / netZoom;
          const lw = Math.min(120 / netZoom, 46 * scale);
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
                color: busyCount > 1 ? "var(--working)" : "var(--text)",
                textShadow: `0 0 ${o}px var(--canvas), ${o}px ${o}px 0 var(--canvas), ${-o}px ${-o}px 0 var(--canvas), ${o}px ${-o}px 0 var(--canvas), ${-o}px ${o}px 0 var(--canvas)`,
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
                color: "var(--waiting)",
                textShadow: `0 0 ${o}px var(--canvas), ${o}px ${o}px 0 var(--canvas)`,
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
