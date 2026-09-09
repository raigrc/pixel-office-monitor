"use client";
/* eslint-disable react-hooks/set-state-in-effect -- intentional sync from SWR/store + localStorage hydration */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Header from "@/components/Header";
import FloorSwitcher from "@/components/FloorSwitcher";
import ErrorBoundary from "@/components/ErrorBoundary";
import AgentInspector from "@/components/AgentInspector";
import OfficeScene from "@/components/scene/OfficeScene";
import SceneViewport from "@/components/scene/SceneViewport";
import { useMonitorState } from "@/hooks/useMonitorStream";
import { PresentationController } from "@/lib/scene/presentation";
import type { VisualHandoffState } from "@/lib/scene/presentation";
import { AWAKE_WINDOW_MS } from "@/lib/scene/actor-pose";
import type { FloorDTO, CubicleDTO, SnapshotEnvelope } from "@/lib/monitor-store";

function redactPathsInPrompt(prompt: string): string {
  let out = prompt.replace(/(?:\/[\w.\-]+)+(?:\/)?/g, "[…]");
  out = out.replace(/[A-Za-z]:\\[^\s]*/g, "[…]");
  return out;
}

function convertV2ToLegacy(
  floors: SnapshotEnvelope["floors"],
  actors: SnapshotEnvelope["actors"],
  invocations: SnapshotEnvelope["invocations"]
): FloorDTO[] {
  return floors.filter((floor) => !floor.closed).map((floor) => {
    // System actors (session-level signals) stay out of desks, lists, and counts.
    const floorActors = actors.filter(
      (a: SnapshotEnvelope["actors"][0]) => a.floorId === floor.floorId && a.role !== "system"
    );
    const cubicles: CubicleDTO[] = floorActors.map((actor: SnapshotEnvelope["actors"][0]) => {
      const activeInv = invocations.find(
        (inv: SnapshotEnvelope["invocations"][0]) =>
          (inv.senderActorId === actor.actorId || inv.recipientActorId === actor.actorId) &&
          (inv.executionStatus === "requested" || inv.executionStatus === "started")
      );
      // Just-finished success beat: monitor stays ON (celebrating) briefly.
      const lastFinish = invocations
        .filter(
          (inv: SnapshotEnvelope["invocations"][0]) =>
            (inv.senderActorId === actor.actorId || inv.recipientActorId === actor.actorId) &&
            inv.finishedAt != null &&
            (inv.outcome === "succeeded" || inv.outcome === "unknown")
        )
        .reduce<number | null>(
          (m, inv) => (inv.finishedAt != null && (m == null || inv.finishedAt > m) ? inv.finishedAt : m),
          null
        );
      const justFinished = lastFinish != null && Date.now() - lastFinish < AWAKE_WINDOW_MS;
      const state = activeInv
        ? actor.agentKey === "orchestrator"
          ? activeInv.senderActorId === actor.actorId
            ? "delegating"
            : "thinking"
          : "working"
        : justFinished
          ? "celebrating"
          : "idle";

      return {
        agent: actor.agentKey,
        kind: "agent.status",
        status: state === "idle" ? "idle" : "working",
        since: actor.lastObservedAt,
        prompt: undefined,
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

  const [promoteToast, setPromoteToast] = useState<{ floor: FloorDTO; timeout: NodeJS.Timeout } | null>(null);

  const [selectedCubicle, setSelectedCubicle] = useState<CubicleDTO | null>(null);

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

  const latestActorsRef = useRef(v2Actors);
  const latestFloorsRef = useRef(v2Floors);
  const latestInvocationsRef = useRef(v2Invocations);
  const presentationControllerRef = useRef<PresentationController | null>(null);
  const enqueuedInvocationIdsRef = useRef<Set<string>>(new Set());
  const hasHandoffStatesRef = useRef(false);
  const [handoffStates, setHandoffStates] = useState<VisualHandoffState[]>([]);

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

  const floors = useMemo(() => convertV2ToLegacy(v2Floors, v2Actors, v2Invocations), [v2Floors, v2Actors, v2Invocations]);

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

  const suggestedActiveId = useMemo(() => {
    if (!displayedFloors.length) return null;
    const busy = displayedFloors.find((f) => f.status === "working");
    return (busy ?? displayedFloors[0]).sessionID;
  }, [displayedFloors]);

  useEffect(() => {
    if (!pinnedHydrated || !activeHydrated) return;

    if (!displayedFloors.length) {
      if (activeId !== null) setActiveId(null);
      return;
    }
    if (activeId === null) {
      setActiveId(suggestedActiveId);
      return;
    }
    const exists = displayedFloors.some((f) => f.sessionID === activeId);
    if (!exists) {
      setActiveId(suggestedActiveId);
      return;
    }
    if (followActivity && suggestedActiveId && suggestedActiveId !== activeId) {
      const activeFloor = displayedFloors.find((f) => f.sessionID === activeId);
      const suggestedFloor = displayedFloors.find((f) => f.sessionID === suggestedActiveId);
      if (suggestedFloor?.status === "working" && activeFloor?.status !== "working") {
        setActiveId(suggestedActiveId);
      }
    }
  }, [displayedFloors, activeId, suggestedActiveId, pinnedHydrated, activeHydrated, followActivity]);

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
    if (!displayedFloors.length) return;
    const currentFloor = displayedFloors.find((f) => f.sessionID === activeId);
    const busyFloor = displayedFloors.find((f) => f.status === "working" && f.sessionID !== activeId);

    if (busyFloor && currentFloor?.status !== "working" && !promoteToast && !followActivity) {
      const timeout = setTimeout(() => setPromoteToast(null), 5000);
      setPromoteToast({ floor: busyFloor, timeout });
    }

    return () => {};
  }, [displayedFloors, activeId, promoteToast, followActivity]);

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
    try {
      await fetch(`/api/floor/${sessionID}/close`, { method: "POST" });
    } catch {}
  }, []);

  const handleRename = useCallback(async (sessionID: string, title: string) => {
    try {
      await fetch(`/api/floor/${sessionID}/rename`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
    } catch {}
  }, []);

  const handleSelect = useCallback((id: string) => {
    setActiveId(id);
    channelRef.current?.postMessage({ type: "FLOOR_SWITCH", sessionID: id });
    setIsBottomSheetOpen(false);
  }, []);

  const handleOpenFloorSwitcher = useCallback(() => {
    setIsBottomSheetOpen(true);
  }, []);

  const handleCubicleClick = useCallback((cubicle: CubicleDTO) => {
    setSelectedCubicle(cubicle);
  }, []);

  const handleInspectorClose = useCallback(() => {
    setSelectedCubicle(null);
  }, []);

  const activeFloor = useMemo(() => {
    return displayedFloors.find(f => f.sessionID === activeId) ?? displayedFloors[0] ?? null;
  }, [displayedFloors, activeId]);

  // Roster room: desks are permanent, so no exit animations — a finished
  // agent rests in place (success beat, monitor-ON idle, then sleep).
  const activeFloorActors = useMemo(() => {
    if (!activeFloor) return [];
    return v2Actors.filter(a => a.floorId === activeFloor.sessionID);
  }, [activeFloor, v2Actors]);

  const activeFloorInvocations = useMemo(() => {
    if (!activeFloor) return [];
    return v2Invocations.filter(inv => inv.floorId === activeFloor.sessionID);
  }, [activeFloor, v2Invocations]);

  useLayoutEffect(() => {
    latestActorsRef.current = v2Actors;
    latestFloorsRef.current = v2Floors;
    latestInvocationsRef.current = v2Invocations;
  }, [v2Actors, v2Floors, v2Invocations]);

  useEffect(() => {
    if (presentationControllerRef.current) return;
    presentationControllerRef.current = new PresentationController(
      () => latestActorsRef.current,
      () => latestFloorsRef.current,
      () => latestInvocationsRef.current
    );
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
    for (const invocation of activeFloorInvocations) {
      if (
        (invocation.executionStatus !== "requested" && invocation.executionStatus !== "started") ||
        enqueuedInvocationIdsRef.current.has(invocation.invocationId)
      ) {
        continue;
      }

      const sender = activeFloorActors.find(
        (actor) => actor.actorId === invocation.senderActorId
      );
      const recipient = activeFloorActors.find(
        (actor) => actor.actorId === invocation.recipientActorId
      );
      if (!sender || !recipient || sender.actorId === recipient.actorId) continue;

      const job = presentationControllerRef.current?.enqueueHandoff(
        invocation,
        sender,
        recipient
      );
      if (job) enqueuedInvocationIdsRef.current.add(invocation.invocationId);
    }
  }, [activeFloorInvocations, activeFloorActors]);

  useEffect(() => {
    let animationFrameId = 0;
    let lastUpdateTime = performance.now();

    const animate = (now: number) => {
      const deltaTime = now - lastUpdateTime;
      lastUpdateTime = now;
      const states = presentationControllerRef.current?.update(deltaTime) ?? [];
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
        liveCount={displayedFloors.length}
        sseStatus={displaySseStatus}
        reconnectAttempt={reconnectAttempt}
        sseFailedPermanently={sseStatus === "offline"}
        onSseRetry={handleSseRetry}
        onOpenFloorSwitcher={handleOpenFloorSwitcher}
        showFloorSwitcherTrigger={true}
        latencyMs={healthMetrics?.sseMetrics?.avgLatencyMs}
        followActivity={followActivity}
        onFollowActivityChange={setFollowActivity}
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
        <AnimatePresence>
          {promoteToast && (
            <motion.div
              className="fixed top-16 left-1/2 -translate-x-1/2 z-40"
              initial={{ opacity: 0, transform: "translateY(-20px)" }}
              animate={{ opacity: 1, transform: "translateY(0px)" }}
              exit={{ opacity: 0, transform: "translateY(-20px)" }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            >
              <div
                className="bg-[#1E293B] border-2 px-4 py-2 rounded-[6px] flex items-center gap-3"
                style={{ borderColor: "#3B82F6" }}
                role="alert"
                aria-live="polite"
              >
                <span className="text-sm text-[#F1F5F9]">
                  Floor <strong>{promoteToast.floor.title || promoteToast.floor.project}</strong> is active
                </span>
                <button
                  onClick={() => {
                    setActiveId(promoteToast.floor.sessionID);
                    channelRef.current?.postMessage({ type: "FLOOR_SWITCH", sessionID: promoteToast.floor.sessionID });
                    clearTimeout(promoteToast.timeout);
                    setPromoteToast(null);
                  }}
                  className="px-3 py-1 text-xs font-bold text-[#3B82F6] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F172A] rounded cursor-pointer"
                  style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}
                >
                  Switch
                </button>
                <button
                  onClick={() => {
                    clearTimeout(promoteToast.timeout);
                    setPromoteToast(null);
                  }}
                  className="px-2 text-sm text-[#94A3B8] hover:text-[#F1F5F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F172A] rounded cursor-pointer"
                  style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}
                  aria-label="Dismiss"
                >
                  ✕
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <section aria-label="Office grid" className={`min-h-0 flex-1 overflow-hidden ${isSidebarOpen ? "lg:ml-64" : ""}`}>
          <SceneViewport className="h-full w-full">
            {displayedFloors.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center bg-transparent">
                <p
                  className="text-center text-[#64748B]"
                  style={{ fontFamily: "var(--font-vt), VT323, monospace", fontSize: "16px" }}
                >
                  ◧ no active floor
                </p>
              </div>
            ) : (
              <OfficeScene
                floors={v2Floors}
                actors={activeFloorActors}
                invocations={activeFloorInvocations}
                activeFloorId={activeId}
                handoffStates={handoffStates}
                onCubicleClick={(actor) => {
                  const cubicle = activeFloor?.cubicles.find(
                    (candidate) => candidate.agent === actor.agentKey
                  );
                  if (cubicle) handleCubicleClick(cubicle);
                }}
              />
            )}
          </SceneViewport>
        </section>

        <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex items-center justify-center gap-3 px-3 py-1">
          <p
            className="text-center text-[11px] tracking-widest text-[#475569]"
            style={{ fontFamily: "var(--font-inter), Inter, sans-serif", textShadow: "0 1px 0 rgba(11,18,32,0.8)" }}
          >
            {displayedFloors.length} floor{displayedFloors.length !== 1 ? "s" : ""} •{" "}
            {displayedFloors.reduce((acc, f) => acc + f.cubicles.length, 0)} cubicles
            {crtEnabled ? " • CRT on" : ""}
          </p>
          <a
            href="/settings"
            className="pointer-events-auto text-[11px] tracking-widest text-[#475569] underline-offset-4 hover:text-[#94A3B8] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F172A] rounded px-1 py-0.5"
            style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}
          >
            ⚙ settings
          </a>
        </footer>

        {devPanelOpen && (
          <motion.div
            className="fixed bottom-4 right-4 z-50 max-h-[60vh] w-[calc(100vw-2rem)] max-w-[400px] overflow-auto rounded-[6px] border-2 bg-[#0F172A] p-3 shadow-xl"
            style={{ borderColor: "#334155" }}
            initial={{ opacity: 0, transform: "translateY(20px) scale(0.98)" }}
            animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
            exit={{ opacity: 0, transform: "translateY(20px) scale(0.98)" }}
            transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-bold text-[#F1F5F9]" style={{ fontFamily: "var(--font-vt), VT323, monospace" }}>
                DEV PANEL
              </h3>
              <button onClick={() => setDevPanelOpen(false)} className="text-[#94A3B8] hover:text-[#F1F5F9]">
                ✕
              </button>
            </div>
            <div className="space-y-2 text-xs text-[#94A3B8]" style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}>
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
          floors={displayedFloors}
          activeId={activeId}
          onSelect={handleSelect}
          pinnedFloors={pinnedFloors}
          onPin={handlePin}
          onClose={handleClose}
          onRename={handleRename}
          sseStatus={sseStatus}
          isBottomSheetOpen={isBottomSheetOpen}
          onBottomSheetChange={setIsBottomSheetOpen}
          followActivity={followActivity}
          onFollowActivityChange={setFollowActivity}
          desktopOpen={isSidebarOpen}
          onDesktopClose={() => setIsSidebarOpen(false)}
        />
        {!isSidebarOpen && (
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="absolute left-2 top-16 z-30 hidden rounded-[4px] border-2 border-[#334155] bg-[#0F172A]/95 px-3 py-1.5 text-[10px] font-bold tracking-widest text-[#F1F5F9] hover:bg-[#1E293B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] cursor-pointer lg:block"
            style={{ fontFamily: "var(--font-pixel), monospace" }}
            aria-label="Show floor panel"
          >
            ☰ FLOORS
          </button>
        )}
      </div>
    </ErrorBoundary>
  );
}
