"use client";
/* eslint-disable react-hooks/set-state-in-effect -- intentional sync from SWR/store + localStorage hydration */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Header from "@/components/Header";
import FloorSwitcher from "@/components/FloorSwitcher";
import MultiSessionCompare from "@/components/MultiSessionCompare";
import NotificationCenter from "@/components/NotificationCenter";
import ErrorBoundary from "@/components/ErrorBoundary";
import AgentInspector from "@/components/AgentInspector";
import OfficeScene from "@/components/scene/OfficeScene";
import SceneViewport from "@/components/scene/SceneViewport";
import { useMonitorState } from "@/hooks/useMonitorStream";
import { monitorToWorld } from "@/lib/world/monitor-to-world";
import { monitorToActivity } from "@/lib/activity/monitor-to-activity";
import type { ActivityModel } from "@/lib/activity/activity-model";
import { PresentationController } from "@/lib/scene/presentation";
import type { VisualActorPoseState, VisualHandoffState } from "@/lib/scene/presentation";
import type { FloorDTO, CubicleDTO, SnapshotEnvelope } from "@/lib/monitor-store";
import { buildMultiSessionModel, chooseFollowTarget } from "@/lib/multi-session/multi-session-model";
import { transitionSessionNotifications, type SessionNotificationState } from "@/lib/multi-session/session-notifications";
import { closeFloor as requestFloorClose, renameFloor as requestFloorRename } from "@/lib/client/monitor-api";

function redactPathsInPrompt(prompt: string): string {
  let out = prompt.replace(/(?:\/[\w.\-]+)+(?:\/)?/g, "[…]");
  out = out.replace(/[A-Za-z]:\\[^\s]*/g, "[…]");
  return out;
}

function convertV2ToLegacy(
  floors: SnapshotEnvelope["floors"],
  actors: SnapshotEnvelope["actors"],
  invocations: SnapshotEnvelope["invocations"],
  activity: ActivityModel,
): FloorDTO[] {
  return floors.filter((floor) => !floor.closed).map((floor) => {
    // System actors (session-level signals) stay out of desks, lists, and counts.
    const floorActors = actors.filter(
      (a: SnapshotEnvelope["actors"][0]) => a.floorId === floor.floorId && a.role !== "system"
    );
    const cubicles: CubicleDTO[] = floorActors.map((actor: SnapshotEnvelope["actors"][0]) => {
      const activeInv = invocations
        .filter(
          (inv: SnapshotEnvelope["invocations"][0]) =>
            (inv.senderActorId === actor.actorId || inv.recipientActorId === actor.actorId) &&
            (inv.executionStatus === "requested" || inv.executionStatus === "started")
        )
        .sort((a, b) => (b.startedAt ?? b.requestedAt ?? 0) - (a.startedAt ?? a.requestedAt ?? 0))[0];
      const semanticPose = activity.actors.find((entry) => entry.actor.actorId === actor.actorId)?.pose ?? "idle";
      const state = activeInv
        ? actor.agentKey === "orchestrator"
          ? activeInv.senderActorId === actor.actorId
            ? "delegating"
            : "thinking"
          : "working"
        : semanticPose === "success"
          ? "celebrating"
          : semanticPose === "error"
            ? "blocked"
          : semanticPose === "work" ? "working" : "idle";

      return {
        agent: actor.agentKey,
        kind: "agent.status",
        status: state === "idle" ? "idle" : "working",
        since: actor.lastObservedAt,
        taskCategory: activeInv?.taskCategory ?? undefined,
        prompt: activeInv?.promptPreview ?? undefined,
        todos: [],
        state,
        lastStateChange: actor.lastObservedAt,
      };
    });

    return {
      sessionID: floor.floorId,
      title: floor.title,
      project: floor.projectId,
      status: cubicles.some((c) => c.status === "working") ? "working" : "idle",
      updatedAt: floor.updatedAt,
      cubicles: cubicles.sort((a, b) => a.agent.localeCompare(b.agent)),
    };
  });
}

export default function Home() {
  const {
    floors: v2Floors,
    actors: v2Actors,
    invocations: v2Invocations,
    status: sseStatus,
    reconnectAttempt,
    retry: handleSseRetry,
    lastEventAt: streamLastEventAt,
    isHydrated: streamHydrated,
  } = useMonitorState();

  const [showPromptPreview, setShowPromptPreview] = useState<boolean>(true);
  const [redactPaths, setRedactPaths] = useState<boolean>(false);
  const [crtEnabled, setCrtEnabled] = useState<boolean>(false);
  const [settingsHydrated, setSettingsHydrated] = useState(false);
  const [followActivity, setFollowActivity] = useState<boolean>(false);

  const [pinnedFloors, setPinnedFloors] = useState<Set<string>>(new Set());
  const [pinnedHydrated, setPinnedHydrated] = useState(false);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeHydrated, setActiveHydrated] = useState(false);

  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [devPanelOpen, setDevPanelOpen] = useState(false);
  const [healthMetrics, setHealthMetrics] = useState<{
    activeSSEConnections?: number;
    sseMetrics?: {
      avgLatencyMs: number;
      p95LatencyMs: number;
      lastEventAt: number;
    };
  } | null>(null);

  const channelRef = useRef<BroadcastChannel | null>(null);

  const [selectedActorId, setSelectedActorId] = useState<string | null>(null);
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [notificationState, setNotificationState] = useState<SessionNotificationState | null>(null);
  const [unreadNotificationIds, setUnreadNotificationIds] = useState<Set<string>>(new Set());
  const [commandMessage, setCommandMessage] = useState<string | null>(null);
  const notificationStateRef = useRef<SessionNotificationState | null>(null);
  const inspectorTriggerRef = useRef<HTMLElement | null>(null);

  // Data-freshness clock: "live" socket means nothing if no events arrive
  // (e.g. broken/dead plugin). Re-evaluate every 5s.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);
  // Stream-measured freshness: set on every real SSE message, independent of
  // the dev-panel-gated /api/health poll (which never runs in normal use).
  const lastEventAt = streamLastEventAt;
  const displaySseStatus: typeof sseStatus | "waiting" | "quiet" =
    sseStatus === "live" && lastEventAt === 0
      ? "waiting"
      : sseStatus === "live" && nowTick - lastEventAt > 30_000
        ? "quiet"
        : sseStatus;

  const presentationControllerRef = useRef<PresentationController | null>(null);
  const hasHandoffStatesRef = useRef(false);
  const [handoffStates, setHandoffStates] = useState<VisualHandoffState[]>([]);
  const [actorPoseStates, setActorPoseStates] = useState<VisualActorPoseState[]>([]);

  const syncSettingsFromStorage = useCallback(() => {
    try {
      const v1 = localStorage.getItem("pixel:showPromptPreview");
      if (v1 !== null) setShowPromptPreview(v1 === "true");
      const v2 = localStorage.getItem("pixel:redactPaths");
      if (v2 !== null) setRedactPaths(v2 === "true");
      const v3 = localStorage.getItem("pixel:crt");
      if (v3 !== null) setCrtEnabled(v3 === "true");
      const v4 = localStorage.getItem("pixel:followActivity");
      if (v4 !== null) setFollowActivity(v4 === "true");
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("pixel:pinnedFloors");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setPinnedFloors(new Set(parsed));
        }
      }
    } catch {}
    setPinnedHydrated(true);
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("pixel:activeFloor");
      if (stored) {
        setActiveId(stored);
      }
    } catch {}
    setActiveHydrated(true);
  }, []);

  const persistPinnedFloors = useCallback((newPinned: Set<string>) => {
    try {
      localStorage.setItem("pixel:pinnedFloors", JSON.stringify(Array.from(newPinned)));
    } catch {}
  }, []);

  const persistActiveFloor = useCallback((id: string | null) => {
    try {
      if (id) {
        localStorage.setItem("pixel:activeFloor", id);
      } else {
        localStorage.removeItem("pixel:activeFloor");
      }
    } catch {}
  }, []);

  useEffect(() => {
    syncSettingsFromStorage();
    setSettingsHydrated(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith("pixel:")) syncSettingsFromStorage();
    };
    const onCustom = () => syncSettingsFromStorage();
    window.addEventListener("storage", onStorage);
    window.addEventListener("pixel-settings", onCustom as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pixel-settings", onCustom as EventListener);
    };
  }, [syncSettingsFromStorage]);

  useEffect(() => {
    const touchStartRef = { current: null as number | null };

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch.clientY > window.innerHeight - 20) {
        touchStartRef.current = touch.clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartRef.current === null) return;
      const touch = e.touches[0];
      if (touch.clientY < touchStartRef.current - 50) {
        setIsBottomSheetOpen(true);
        touchStartRef.current = null;
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  const activity = useMemo(
    () => monitorToActivity({ floors: v2Floors, actors: v2Actors, invocations: v2Invocations }, nowTick),
    [v2Floors, v2Actors, v2Invocations, nowTick]
  );
  const sessionModel = useMemo(
    () => buildMultiSessionModel({
      floors: v2Floors,
      actors: v2Actors,
      invocations: v2Invocations,
      activity,
      pinnedFloorIds: pinnedFloors,
    }),
    [v2Floors, v2Actors, v2Invocations, activity, pinnedFloors],
  );
  const openSessionFloors = useMemo(
    () => [...sessionModel.working, ...sessionModel.quiet],
    [sessionModel],
  );
  const floors = useMemo(
    () => convertV2ToLegacy(v2Floors, v2Actors, v2Invocations, activity),
    [v2Floors, v2Actors, v2Invocations, activity]
  );

  const world = useMemo(
    () => monitorToWorld({ floors: v2Floors, actors: v2Actors, invocations: v2Invocations }, nowTick),
    [v2Floors, v2Actors, v2Invocations, nowTick]
  );

  const displayedFloors = useMemo(() => {
    if (!settingsHydrated) return floors;
    if (showPromptPreview === false) {
      return floors.map((f) => ({
        ...f,
        cubicles: f.cubicles.map((c) => ({ ...c, prompt: undefined })),
      }));
    }
    if (redactPaths) {
      return floors.map((f) => ({
        ...f,
        cubicles: f.cubicles.map((c) => {
          if (!c.prompt) return c;
          return { ...c, prompt: redactPathsInPrompt(c.prompt) };
        }),
      }));
    }
    return floors;
  }, [floors, showPromptPreview, redactPaths, settingsHydrated]);

  const suggestedActiveId = chooseFollowTarget(sessionModel, activeId)
    ?? openSessionFloors[0]?.floorId
    ?? null;

  useEffect(() => {
    if (!pinnedHydrated || !activeHydrated) return;

    if (!openSessionFloors.length) {
      if (activeId !== null) setActiveId(null);
      return;
    }
    if (activeId === null) {
      setActiveId(suggestedActiveId);
      return;
    }
    const exists = openSessionFloors.some((floor) => floor.floorId === activeId);
    if (!exists) {
      setActiveId(suggestedActiveId);
      return;
    }
    if (followActivity && suggestedActiveId && suggestedActiveId !== activeId) {
      setSelectedActorId(null);
      setActiveId(suggestedActiveId);
    }
  }, [openSessionFloors, activeId, suggestedActiveId, pinnedHydrated, activeHydrated, followActivity]);

  useEffect(() => {
    if (activeHydrated && activeId !== null) {
      persistActiveFloor(activeId);
    }
  }, [activeId, activeHydrated, persistActiveFloor]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    channelRef.current = new BroadcastChannel("pixel-office-sync");

    channelRef.current.onmessage = (event) => {
      if (event.data.type === "FLOOR_SWITCH") {
        if (event.data.sessionID !== activeId) {
          setSelectedActorId(null);
          setFollowActivity(false);
          setActiveId(event.data.sessionID);
        }
      }
    };

    return () => channelRef.current?.close();
  }, [activeId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "P") {
        e.preventDefault();
        setDevPanelOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!devPanelOpen) return;
    const fetchHealth = async () => {
      try {
        const res = await fetch("/api/health");
        const data = await res.json();
        setHealthMetrics(data);
      } catch {}
    };
    fetchHealth();
    const id = setInterval(fetchHealth, 5000);
    return () => clearInterval(id);
  }, [devPanelOpen]);

  useEffect(() => {
    const previous = notificationStateRef.current;
    const next = transitionSessionNotifications(previous, {
      model: sessionModel,
      followedFloorId: followActivity ? activeId : null,
    });
    notificationStateRef.current = next;
    setNotificationState(next);
    if (previous) {
      const known = new Set(previous.notifications.map((notification) => notification.id));
      const additions = next.notifications.filter((notification) => !known.has(notification.id));
      if (additions.length > 0) {
        setUnreadNotificationIds((current) => new Set([...current, ...additions.map((notification) => notification.id)]));
      }
    }
  }, [sessionModel, followActivity, activeId]);

  const handlePin = useCallback((sessionID: string) => {
    setPinnedFloors((prev) => {
      const next = new Set(prev);
      if (next.has(sessionID)) {
        next.delete(sessionID);
      } else {
        next.add(sessionID);
      }
      persistPinnedFloors(next);
      return next;
    });
  }, [persistPinnedFloors]);

  const handleClose = useCallback(async (sessionID: string) => {
    const floor = v2Floors.find((candidate) => candidate.floorId === sessionID);
    if (!floor || !window.confirm(`Complete ${floor.title}? It will leave the active office.`)) return;
    const result = await requestFloorClose(sessionID);
    setCommandMessage(result.message);
  }, [v2Floors]);

  const handleRename = useCallback(async (sessionID: string, title: string) => {
    const result = await requestFloorRename(sessionID, title);
    setCommandMessage(result.message);
  }, []);

  const handleSelect = useCallback((id: string) => {
    setFollowActivity(false);
    setSelectedActorId(null);
    setComparisonIds([]);
    setUnreadNotificationIds((current) => new Set([...current].filter((notificationId) => {
      const notification = notificationStateRef.current?.notifications.find((candidate) => candidate.id === notificationId);
      return notification?.floorId !== id;
    })));
    setActiveId(id);
    channelRef.current?.postMessage({ type: "FLOOR_SWITCH", sessionID: id });
    setIsBottomSheetOpen(false);
  }, []);

  const handleOpenFloorSwitcher = useCallback(() => {
    setIsBottomSheetOpen(true);
  }, []);

  const handleActorSelect = useCallback((actorId: string) => {
    if (document.activeElement instanceof HTMLElement) inspectorTriggerRef.current = document.activeElement;
    setSelectedActorId(actorId);
  }, []);

  const handleInspectorClose = useCallback(() => {
    setSelectedActorId(null);
    requestAnimationFrame(() => inspectorTriggerRef.current?.focus());
  }, []);

  const activeFloor = useMemo(() => {
    return displayedFloors.find(f => f.sessionID === activeId) ?? displayedFloors[0] ?? null;
  }, [displayedFloors, activeId]);
  const selectedCubicle = useMemo(() => {
    if (!selectedActorId) return null;
    const actor = v2Actors.find((candidate) => candidate.actorId === selectedActorId);
    if (!actor || actor.floorId !== activeFloor?.sessionID) return null;
    return activeFloor.cubicles.find((candidate) => candidate.agent === actor.agentKey) ?? null;
  }, [selectedActorId, v2Actors, activeFloor]);
  const allSessionFloors = useMemo(
    () => [...sessionModel.working, ...sessionModel.quiet, ...sessionModel.completed],
    [sessionModel],
  );
  const comparedFloors = comparisonIds
    .map((id) => allSessionFloors.find((floor) => floor.floorId === id))
    .filter((floor) => floor !== undefined);
  const unreadByFloorId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const notification of notificationState?.notifications ?? []) {
      if (!unreadNotificationIds.has(notification.id)) continue;
      counts.set(notification.floorId, (counts.get(notification.floorId) ?? 0) + 1);
    }
    return counts;
  }, [notificationState, unreadNotificationIds]);
  const handleCompare = useCallback((id: string) => {
    setComparisonIds((current) => {
      if (current.includes(id)) return current.filter((candidate) => candidate !== id);
      if (current.length === 0 && activeId && activeId !== id) {
        setFollowActivity(false);
        return [activeId, id];
      }
      if (current.length >= 2) {
        setCommandMessage("Comparison already contains two sessions");
        return current;
      }
      setFollowActivity(false);
      return [...current, id];
    });
  }, [activeId]);

  useEffect(() => {
    if (selectedActorId && !selectedCubicle) setSelectedActorId(null);
  }, [selectedActorId, selectedCubicle]);

  // Roster room: desks are permanent, so no exit animations — a finished
  // agent rests in place (success beat, monitor-ON idle, then sleep).
  const activeFloorActors = useMemo(() => {
    if (!activeFloor) return [];
    return v2Actors.filter(a => a.floorId === activeFloor.sessionID);
  }, [activeFloor, v2Actors]);

  useEffect(() => {
    if (presentationControllerRef.current) return;
    presentationControllerRef.current = new PresentationController();
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncReducedMotion = () => {
      presentationControllerRef.current?.setReducedMotion(mediaQuery.matches);
    };

    syncReducedMotion();
    mediaQuery.addEventListener("change", syncReducedMotion);
    return () => mediaQuery.removeEventListener("change", syncReducedMotion);
  }, []);

  useEffect(() => {
    presentationControllerRef.current?.reconcile(activity);
  }, [activity]);

  useEffect(() => {
    let animationFrameId = 0;
    let lastUpdateTime = performance.now();

    const animate = (now: number) => {
      const deltaTime = now - lastUpdateTime;
      lastUpdateTime = now;
      const states = presentationControllerRef.current?.update(deltaTime) ?? [];
      const poses = presentationControllerRef.current?.getActorPoseStates(Date.now()) ?? [];
      setActorPoseStates((previous) => {
        const previousKey = previous.map((state) => `${state.actorId}:${state.pose}:${state.expiresAt}`).join("|");
        const nextKey = poses.map((state) => `${state.actorId}:${state.pose}:${state.expiresAt}`).join("|");
        return previousKey === nextKey ? previous : poses;
      });
      if (states.length > 0) {
        hasHandoffStatesRef.current = true;
        setHandoffStates(states);
      } else if (hasHandoffStatesRef.current) {
        hasHandoffStatesRef.current = false;
        setHandoffStates([]);
      }
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return (
    <ErrorBoundary>
      <div className="relative flex h-dvh min-h-0 flex-col overflow-hidden">
        <div className="absolute inset-x-0 top-0 z-40">
        <Header
        liveCount={openSessionFloors.length}
        workingCount={sessionModel.working.length}
        quietCount={sessionModel.quiet.length}
        activeTaskCount={sessionModel.working.reduce((count, floor) => count + floor.activeInvocationCount, 0)}
        unreadNotificationCount={unreadNotificationIds.size}
        sseStatus={displaySseStatus}
        reconnectAttempt={reconnectAttempt}
        sseFailedPermanently={sseStatus === "offline"}
        onSseRetry={handleSseRetry}
        onOpenFloorSwitcher={handleOpenFloorSwitcher}
        showFloorSwitcherTrigger={true}
        latencyMs={healthMetrics?.sseMetrics?.avgLatencyMs}
        followActivity={followActivity}
        onFollowActivityChange={setFollowActivity}
        onOpenNotifications={() => setNotificationCenterOpen(true)}
        onToggleComparison={() => {
          if (comparisonIds.length === 2) setComparisonIds([]);
          else {
            if (activeId) setComparisonIds((current) => current.length === 0 ? [activeId] : current);
            setIsSidebarOpen(true);
            setIsBottomSheetOpen(true);
          }
        }}
        comparisonActive={comparisonIds.length > 0}
        navigatorOpen={isBottomSheetOpen}
        />
        </div>

        <main
          className={[
          // pt-14 clears the overlaid HUD header so the full room (row 1
          // desks + admin spot) is never hidden underneath it.
          "relative z-[1] flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden pt-14",
          crtEnabled ? "crt" : "",
        ].join(" ")}
        >
        <div className="sr-only" role="status" aria-live="polite">
          {notificationState?.notifications[0]
            ? `${notificationState.notifications[0].title} ${notificationState.notifications[0].kind.replaceAll("-", " ")}`
            : ""}
        </div>
        {commandMessage && (
          <div className="fixed left-1/2 top-16 z-40 flex min-h-11 -translate-x-1/2 items-center rounded-[4px] border-2 border-[var(--strong-border)] bg-[var(--canvas)] px-4 text-sm text-[var(--text)] shadow-[3px_3px_0_var(--surface)]" role="status">
            {commandMessage}
            <button type="button" onClick={() => setCommandMessage(null)} className="ml-3 min-h-11 cursor-pointer text-[var(--selection)]" aria-label="Dismiss message">Dismiss</button>
          </div>
        )}

        <section aria-label="Office grid" className={`min-h-0 flex-1 overflow-hidden ${isSidebarOpen ? "lg:ml-[18rem]" : ""}`}>
          <SceneViewport
            className="h-full w-full"
            world={world}
            activity={activity}
            activeSessionId={activeId}
            selectedActorId={selectedActorId}
            streamHydrated={streamHydrated}
            sidebarOpen={isSidebarOpen}
            onAgentClick={(actorId) => {
              handleActorSelect(actorId);
            }}
          >
            {displayedFloors.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center bg-transparent">
                <p
                  className="text-center text-[var(--muted)]"
                  style={{ fontFamily: "var(--font-vt), VT323, monospace", fontSize: "16px" }}
                >
                  No active floor
                </p>
              </div>
            ) : (
              <OfficeScene
                floors={v2Floors.filter((floor) => !floor.closed)}
                actors={activeFloorActors}
                activeFloorId={activeId}
                handoffStates={handoffStates}
                actorPoseStates={actorPoseStates}
                activity={activity}
                onCubicleClick={(actor) => {
                  handleActorSelect(actor.actorId);
                }}
              />
            )}
          </SceneViewport>
        </section>

        <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex items-center justify-center gap-3 px-3 py-1">
          <p
            className="rounded-[3px] bg-[var(--canvas)] px-2 text-center text-[11px] tracking-widest text-[var(--muted)]"
            style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}
          >
            {displayedFloors.length} floor{displayedFloors.length !== 1 ? "s" : ""} •{" "}
            {displayedFloors.reduce((acc, f) => acc + f.cubicles.length, 0)} cubicles
            {crtEnabled ? " • CRT on" : ""}
          </p>
          <a
            href="/settings"
            className="pointer-events-auto inline-flex min-h-11 items-center gap-1.5 rounded-[4px] border border-[var(--border)] bg-[var(--canvas)] px-3 text-[11px] tracking-widest text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--selection)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas)]"
            style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}
          >
            <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></svg>
            Settings
          </a>
        </footer>

        {devPanelOpen && (
          <motion.div
            className="fixed bottom-4 right-4 z-50 max-h-[60vh] w-[calc(100vw-2rem)] max-w-[400px] overflow-auto rounded-[4px] border-2 border-[var(--strong-border)] bg-[var(--canvas)] p-3 shadow-[4px_4px_0_var(--surface)]"
            initial={{ opacity: 0, transform: "translateY(20px) scale(0.98)" }}
            animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
            exit={{ opacity: 0, transform: "translateY(20px) scale(0.98)" }}
            transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-bold text-[var(--text)]" style={{ fontFamily: "var(--font-vt), VT323, monospace" }}>
                DEV PANEL
              </h3>
              <button type="button" onClick={() => setDevPanelOpen(false)} className="flex h-11 w-11 cursor-pointer items-center justify-center text-[var(--muted)] hover:bg-[var(--raised)] hover:text-[var(--text)]" aria-label="Close developer panel">
                <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-2 text-xs text-[var(--muted)]" style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}>
              <div><strong>SSE Connections:</strong> {healthMetrics?.activeSSEConnections ?? "—"}</div>
              <div><strong>Avg Latency:</strong> {healthMetrics?.sseMetrics?.avgLatencyMs ?? "—"}ms</div>
              <div><strong>P95 Latency:</strong> {healthMetrics?.sseMetrics?.p95LatencyMs ?? "—"}ms</div>
              <div><strong>Last Event:</strong> {healthMetrics?.sseMetrics?.lastEventAt ? new Date(healthMetrics.sseMetrics.lastEventAt).toLocaleTimeString() : "—"}</div>
            </div>
          </motion.div>
        )}

        <AnimatePresence>
          {selectedCubicle && (
            <AgentInspector
              cubicle={selectedCubicle}
              onClose={handleInspectorClose}
              showPromptPreview={showPromptPreview}
              redactPaths={redactPaths}
            />
          )}
        </AnimatePresence>
        </main>

        <FloorSwitcher
          model={sessionModel}
          floorDetails={displayedFloors}
          activeId={activeId}
          onSelect={handleSelect}
          pinnedFloors={pinnedFloors}
          onPin={handlePin}
          onClose={handleClose}
          onRename={handleRename}
          onCompare={handleCompare}
          comparisonIds={comparisonIds}
          unreadByFloorId={unreadByFloorId}
          sseStatus={sseStatus}
          isBottomSheetOpen={isBottomSheetOpen}
          onBottomSheetChange={setIsBottomSheetOpen}
          followActivity={followActivity}
          onFollowActivityChange={setFollowActivity}
          desktopOpen={isSidebarOpen}
          onDesktopClose={() => setIsSidebarOpen(false)}
        />
        {comparedFloors.length === 2 && (
          <MultiSessionCompare
            left={comparedFloors[0]}
            right={comparedFloors[1]}
            onClose={() => setComparisonIds([])}
            onOpenFloor={handleSelect}
          />
        )}
        <NotificationCenter
          notifications={notificationState?.notifications ?? []}
          unreadIds={unreadNotificationIds}
          open={notificationCenterOpen}
          onClose={() => setNotificationCenterOpen(false)}
          onMarkAllRead={() => setUnreadNotificationIds(new Set())}
          onSelectFloor={(id) => {
            const floor = allSessionFloors.find((candidate) => candidate.floorId === id);
            if (floor?.lifecycle === "completed") handleCompare(id);
            else handleSelect(id);
            setUnreadNotificationIds((current) => new Set([...current].filter((notificationId) => {
              const notification = notificationStateRef.current?.notifications.find((candidate) => candidate.id === notificationId);
              return notification?.floorId !== id;
            })));
          }}
        />
        {!isSidebarOpen && (
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="absolute left-2 top-16 z-30 hidden min-h-11 cursor-pointer items-center gap-2 rounded-[4px] border-2 border-[var(--strong-border)] bg-[var(--canvas)] px-3 text-[10px] font-bold tracking-widest text-[var(--text)] hover:bg-[var(--surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--selection)] lg:flex"
            style={{ fontFamily: "var(--font-pixel), monospace" }}
            aria-label="Show floor panel"
          >
            <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
            FLOORS
          </button>
        )}
      </div>
    </ErrorBoundary>
  );
}
