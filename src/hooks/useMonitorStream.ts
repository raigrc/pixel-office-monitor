"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SnapshotEnvelope, DeltaEnvelope, MonitorEvent } from "@/lib/monitor-types";

type MonitorStreamCallbacks = {
  onSnapshot?: (snapshot: SnapshotEnvelope) => void;
  onDelta?: (delta: DeltaEnvelope) => void;
  onEvent?: (event: MonitorEvent) => void;
  onStatusChange?: (status: "connecting" | "live" | "reconnecting" | "offline") => void;
};

export function useMonitorStream(callbacks: MonitorStreamCallbacks = {}) {
  const [status, setStatus] = useState<"connecting" | "live" | "reconnecting" | "offline">("connecting");
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  // Last wall-clock time real stream data arrived (snapshot/delta/reset).
  // Socket open alone never touches this — it measures data, not connection.
  const [lastEventAt, setLastEventAt] = useState(0);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const connectSSERef = useRef<() => void>(() => {});
  const cursorRef = useRef<{ epoch: string; sequence: number } | null>(null);

  const { onSnapshot, onDelta, onEvent, onStatusChange } = callbacks;

  useEffect(() => {
    isMountedRef.current = true;
    try {
      const stored = localStorage.getItem("pixel:monitorCursor");
      if (stored) {
        cursorRef.current = JSON.parse(stored);
      }
    } catch {}
    return () => {
      isMountedRef.current = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (eventSourceRef.current) eventSourceRef.current.close();
    };
  }, []);

  const connectSSE = useCallback(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      setStatus("offline");
      onStatusChange?.("offline");
      return;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setStatus("connecting");
    onStatusChange?.("connecting");

    try {
      const baseToken = process.env.NEXT_PUBLIC_PIXEL_MONITOR_TOKEN || "";
      const url = "/api/events";
      const params = new URLSearchParams();
      if (cursorRef.current) {
        params.set("lastEventId", `${cursorRef.current.epoch}:${cursorRef.current.sequence}`);
      }
      if (baseToken) {
        params.set("token", baseToken);
      }
      const qs = params.toString();
      const connectUrl = qs ? `${url}?${qs}` : url;
      const es = new EventSource(connectUrl);
      eventSourceRef.current = es;

      es.onopen = () => {
        if (!isMountedRef.current) {
          es.close();
          return;
        }
        setStatus("live");
        setReconnectAttempt(0);
        onStatusChange?.("live");
      };

      es.addEventListener("snapshot", (e) => {
        if (!isMountedRef.current) return;
        try {
          const snapshot = JSON.parse(e.data) as SnapshotEnvelope;
          cursorRef.current = { epoch: snapshot.epoch, sequence: snapshot.sequence };
          localStorage.setItem("pixel:monitorCursor", JSON.stringify(cursorRef.current));
          setLastEventAt(Date.now());
          onSnapshot?.(snapshot);
        } catch {}
      });

      es.addEventListener("delta", (e) => {
        if (!isMountedRef.current) return;
        try {
          const delta = JSON.parse(e.data) as DeltaEnvelope;
          cursorRef.current = { epoch: delta.epoch, sequence: delta.sequence };
          localStorage.setItem("pixel:monitorCursor", JSON.stringify(cursorRef.current));
          setLastEventAt(Date.now());
          onDelta?.(delta);
        } catch {}
      });

      es.addEventListener("reset", (e) => {
        if (!isMountedRef.current) return;
        try {
          const payload = JSON.parse(e.data) as { epoch: string; sequence: number; reason: string };
          cursorRef.current = { epoch: payload.epoch, sequence: payload.sequence };
          localStorage.setItem("pixel:monitorCursor", JSON.stringify(cursorRef.current));
          setLastEventAt(Date.now());
          onEvent?.({
            eventId: `reset-${payload.sequence}`,
            epoch: payload.epoch,
            sequence: payload.sequence,
            type: "reset",
            causeEventId: null,
            timestamp: Date.now(),
            payload,
          });
        } catch {}
      });

      es.onerror = () => {
        if (!isMountedRef.current) return;
        es.close();
        eventSourceRef.current = null;

        if (reconnectAttempt >= 5) {
          setStatus("offline");
          onStatusChange?.("offline");
          return;
        }

        setStatus("reconnecting");
        onStatusChange?.("reconnecting");
        const nextAttempt = reconnectAttempt + 1;
        setReconnectAttempt(nextAttempt);

        const baseDelay = Math.min(1000 * Math.pow(2, reconnectAttempt), 30000);
        const jitter = Math.random() * 400 - 200;
        const delay = Math.max(0, baseDelay + jitter);

        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            connectSSERef.current();
          }
        }, delay);
      };
    } catch {
      if (reconnectAttempt >= 5) {
        setStatus("offline");
        onStatusChange?.("offline");
      } else {
        setStatus("reconnecting");
        onStatusChange?.("reconnecting");
        const baseDelay = Math.min(1000 * Math.pow(2, reconnectAttempt), 30000);
        const jitter = Math.random() * 400 - 200;
        const delay = Math.max(0, baseDelay + jitter);
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) connectSSERef.current();
        }, delay);
      }
    }
  }, [reconnectAttempt, onStatusChange]);

  useEffect(() => {
    connectSSERef.current = connectSSE;
  }, [connectSSE]);

  useEffect(() => {
    connectSSERef.current();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (eventSourceRef.current) eventSourceRef.current.close();
    };
  }, []);

  const retry = useCallback(() => {
    setReconnectAttempt(0);
    connectSSERef.current();
  }, []);

  return { status, reconnectAttempt, retry, lastEventAt };
}

export function useMonitorState() {
  const [floors, setFloors] = useState<SnapshotEnvelope["floors"]>([]);
  const [sessions, setSessions] = useState<SnapshotEnvelope["sessions"]>([]);
  const [actors, setActors] = useState<SnapshotEnvelope["actors"]>([]);
  const [invocations, setInvocations] = useState<SnapshotEnvelope["invocations"]>([]);
  const [epoch, setEpoch] = useState<string>("");
  const [sequence, setSequence] = useState<number>(0);
  const [isHydrated, setIsHydrated] = useState(false);

  const applySnapshot = useCallback((snapshot: SnapshotEnvelope) => {
    // Closed floors never render (close API only flags; prune reaps later).
    setFloors(snapshot.floors.filter((f) => !f.closed));
    setSessions(snapshot.sessions);
    setActors(snapshot.actors);
    setInvocations(snapshot.invocations);
    setEpoch(snapshot.epoch);
    setSequence(snapshot.sequence);
    setIsHydrated(true);
  }, []);

  const applyDelta = useCallback((delta: DeltaEnvelope) => {
    setFloors((prev) => {
      let next = [...prev];
      if (delta.upserts.floors) {
        for (const floor of delta.upserts.floors) {
          // A closed flag on upsert acts as removal (close API only flags).
          if (floor.closed) {
            next = next.filter((f) => f.floorId !== floor.floorId);
            continue;
          }
          const idx = next.findIndex((f) => f.floorId === floor.floorId);
          if (idx >= 0) next[idx] = floor;
          else next.push(floor);
        }
      }
      if (delta.removals.floors) {
        next = next.filter((f) => !delta.removals.floors?.includes(f.floorId));
      }
      return next;
    });
    if (delta.upserts.sessions) {
      setSessions((prev) => {
        const next = [...prev];
        for (const session of delta.upserts.sessions!) {
          const idx = next.findIndex((s) => s.sessionId === session.sessionId);
          if (idx >= 0) next[idx] = session;
          else next.push(session);
        }
        return next;
      });
    }
    if (delta.upserts.actors) {
      setActors((prev) => {
        const next = [...prev];
        for (const actor of delta.upserts.actors!) {
          const idx = next.findIndex((a) => a.actorId === actor.actorId);
          if (idx >= 0) next[idx] = actor;
          else next.push(actor);
        }
        return next;
      });
    }
    if (delta.upserts.invocations) {
      setInvocations((prev) => {
        const next = [...prev];
        for (const inv of delta.upserts.invocations!) {
          const idx = next.findIndex((i) => i.invocationId === inv.invocationId);
          if (idx >= 0) next[idx] = inv;
          else next.push(inv);
        }
        return next;
      });
    }
    if (delta.removals.actors) {
      setActors((prev) => prev.filter((a) => !delta.removals.actors?.includes(a.actorId)));
    }
    if (delta.removals.sessions) {
      setSessions((prev) => prev.filter((s) => !delta.removals.sessions?.includes(s.sessionId)));
    }
    if (delta.removals.invocations) {
      setInvocations((prev) => prev.filter((i) => !delta.removals.invocations?.includes(i.invocationId)));
    }
    setEpoch(delta.epoch);
    setSequence(delta.sequence);
  }, []);

  const { status, reconnectAttempt, retry, lastEventAt } = useMonitorStream({
    onSnapshot: applySnapshot,
    onDelta: applyDelta,
  });

  return { floors, sessions, actors, invocations, epoch, sequence, isHydrated, status, reconnectAttempt, retry, lastEventAt };
}
