import { getSnapshot, getEventsSince, subscribeToSSEEvents, incrementSSEConnections, decrementSSEConnections, checkAndIncrementIPConnection, decrementIPConnection } from "@/lib/monitor-store";
import type { SnapshotEnvelope } from "@/lib/monitor-types";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getExpectedToken(): string {
  return (
    process.env.MONITOR_TOKEN ||
    process.env.PIXEL_MONITOR_TOKEN ||
    "dev-token"
  );
}

function extractToken(req: NextRequest): string | null {
  const h1 = req.headers.get("x-monitor-token");
  if (h1) return h1.trim();
  const h2 = req.headers.get("x-token");
  if (h2) return h2.trim();
  const auth = req.headers.get("authorization");
  if (auth) {
    const bearer = auth.trim();
    const match = bearer.match(/^Bearer\s+(.+)$/i);
    if (match) return match[1].trim();
    if (bearer) return bearer;
  }
  return null;
}

export async function GET(req: NextRequest) {
  const token = extractToken(req);
  const expected = getExpectedToken();
  const urlToken = req.nextUrl.searchParams.get("token");
  if ((!token && !urlToken) || (urlToken !== expected && token !== expected)) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const forwardedFor = req.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() ?? "unknown";
  if (!checkAndIncrementIPConnection(ip)) {
    return new Response("Too many SSE connections from this IP", {
      status: 429,
      headers: {
        "Content-Type": "text/plain",
        "Retry-After": "30",
      },
    });
  }

  // Native EventSource sends Last-Event-ID while reconnecting the same
  // instance. Our client creates a new instance after backoff, so it carries
  // the persisted cursor in this query parameter instead.
  const lastEventIdHeader =
    req.headers.get("last-event-id") ?? req.nextUrl.searchParams.get("lastEventId");
  let resumeEpoch: string | null = null;
  let resumeSequence = 0;
  if (lastEventIdHeader) {
    const parts = lastEventIdHeader.split(":");
    if (parts.length === 2) {
      resumeEpoch = parts[0];
      resumeSequence = parseInt(parts[1], 10) || 0;
    }
  }

  const encoder = new TextEncoder();
  incrementSSEConnections();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode("retry: 3000\n\n"));

      if (resumeEpoch && resumeSequence > 0) {
        const missedEvents = getEventsSince(resumeEpoch, resumeSequence);
        for (const event of missedEvents) {
          const eventLine = `id: ${event.epoch}:${event.sequence}\n`;
          const typeLine = `event: ${event.type}\n`;
          const sanitizedPayload = sanitizeEventPayload(event.payload);
          const dataLine = `data: ${JSON.stringify(sanitizedPayload)}\n\n`;
          controller.enqueue(encoder.encode(eventLine + typeLine + dataLine));
        }
      }

      const initialSnapshot = getSnapshot();
      const sanitizedSnapshot = sanitizeSnapshot(initialSnapshot);
      const snapId = `${sanitizedSnapshot.epoch}:${sanitizedSnapshot.sequence}`;
      controller.enqueue(
        encoder.encode(`id: ${snapId}\nevent: snapshot\ndata: ${JSON.stringify(sanitizedSnapshot)}\n\n`)
      );

      let closed = false;

      const unsubscribe = subscribeToSSEEvents((event) => {
        if (closed) return;
        try {
          const eventId = `${event.epoch}:${event.sequence}`;
          const snapshot = sanitizeSnapshot(getSnapshot());
          controller.enqueue(
            encoder.encode(`id: ${eventId}\nevent: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`)
          );
        } catch {
        }
      });

      const heartbeatId = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
        }
      }, 15_000);

      const cleanup = () => {
        closed = true;
        clearInterval(heartbeatId);
        unsubscribe();
        decrementSSEConnections();
        decrementIPConnection(ip);
        try {
          controller.close();
        } catch {
        }
      };

      if (req.signal) {
        if (req.signal.aborted) {
          cleanup();
        } else {
          req.signal.addEventListener("abort", cleanup, { once: true });
        }
      }
    },
    cancel() {
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function sanitizeEventPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return payload;
  const p = payload as Record<string, unknown>;
  const sanitized = { ...p };
  if (Array.isArray(p.invocations)) {
    sanitized.invocations = p.invocations.map(sanitizeInvocation);
  }
  if (p.invocation && typeof p.invocation === "object") {
    sanitized.invocation = sanitizeInvocation(p.invocation);
  }
  if (p.cubicle && typeof p.cubicle === "object" && "prompt" in p.cubicle) {
    sanitized.cubicle = { ...p.cubicle as Record<string, unknown>, prompt: "[REDACTED]" };
  }
  return sanitized;
}

function sanitizeInvocation(invocation: unknown): unknown {
  if (!invocation || typeof invocation !== "object") return invocation;
  const record = invocation as Record<string, unknown>;
  return {
    ...record,
    promptPreview: record.promptPreview ? "[REDACTED]" : null,
  };
}

function sanitizeSnapshot(snapshot: SnapshotEnvelope): SnapshotEnvelope {
  return {
    ...snapshot,
    invocations: snapshot.invocations.map((invocation) => ({
      ...invocation,
      promptPreview: invocation.promptPreview ? "[REDACTED]" : null,
    })),
  };
}
