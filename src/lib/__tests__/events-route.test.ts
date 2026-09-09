import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../../app/api/events/route";
import { _clearStore, getSnapshot, upsert } from "../monitor-store";
import type { SnapshotEnvelope } from "../monitor-types";
import type { IngestPayloadV2 } from "../schema";

async function readChunk(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
  const { done, value } = await reader.read();
  expect(done).toBe(false);
  return new TextDecoder().decode(value);
}

describe("GET /api/events", () => {
  beforeEach(() => {
    _clearStore();
    process.env.MONITOR_TOKEN = "dev-token";
  });

  it("emits a sanitized current snapshot after a live store event", async () => {
    const projectId = "project";
    const rootSessionId = "root";
    const senderActorId = `${projectId}:${rootSessionId}:orchestrator`;
    const recipientActorId = `${projectId}:child:senior-engineer`;

    const actorEvent = (
      eventId: string,
      sessionId: string,
      agentKey: string
    ): IngestPayloadV2 => ({
      v: 2,
      eventId,
      projectId,
      sessionId,
      rootSessionId,
      parentSessionId: sessionId === rootSessionId ? null : rootSessionId,
      occurredAt: Date.now(),
      kind: "actor.activity",
      detail: { agentKey },
    });

    upsert(actorEvent("actor-1", rootSessionId, "orchestrator"));
    upsert(actorEvent("actor-2", "child", "senior-engineer"));

    const abortController = new AbortController();
    const response = await GET(
      new NextRequest("http://localhost/api/events?token=dev-token", {
        signal: abortController.signal,
      })
    );
    expect(response.status).toBe(200);

    const reader = response.body!.getReader();
    await readChunk(reader); // retry directive
    await readChunk(reader); // initial snapshot

    const invocationEvent: IngestPayloadV2 = {
      v: 2,
      eventId: "invocation-1",
      projectId,
      sessionId: rootSessionId,
      rootSessionId,
      parentSessionId: null,
      occurredAt: Date.now(),
      kind: "invocation.requested",
      detail: {
        agentKey: "orchestrator",
        callId: "call-1",
        senderActorId,
        recipientActorId,
        promptPreview: "sensitive local path",
      },
    };
    upsert(invocationEvent);

    const liveEvent = await readChunk(reader);
    const snapshot = getSnapshot();
    expect(liveEvent).toContain(`id: ${snapshot.epoch}:${snapshot.sequence}\n`);
    expect(liveEvent).toContain("event: snapshot\n");

    const data = liveEvent
      .split("\n")
      .find((line) => line.startsWith("data: "))
      ?.slice(6);
    expect(data).toBeDefined();
    const streamedSnapshot = JSON.parse(data!) as SnapshotEnvelope;
    expect(streamedSnapshot.invocations).toHaveLength(1);
    expect(streamedSnapshot.invocations[0].executionStatus).toBe("requested");
    expect(streamedSnapshot.invocations[0].promptPreview).toBe("[REDACTED]");

    abortController.abort();
  });

  it("replays missed events from the reconnect query cursor", async () => {
    const projectId = "project";
    const rootSessionId = "root";
    const actorEvent = (eventId: string, activity: "working" | "idle"): IngestPayloadV2 => ({
      v: 2,
      eventId,
      projectId,
      sessionId: rootSessionId,
      rootSessionId,
      parentSessionId: null,
      occurredAt: Date.now(),
      kind: "actor.activity",
      detail: { agentKey: "orchestrator", activity },
    });

    upsert(actorEvent("actor-working", "working"));
    const cursor = getSnapshot();
    upsert(actorEvent("actor-idle", "idle"));
    const latest = getSnapshot();

    const abortController = new AbortController();
    const cursorValue = encodeURIComponent(`${cursor.epoch}:${cursor.sequence}`);
    const response = await GET(
      new NextRequest(
        `http://localhost/api/events?token=dev-token&lastEventId=${cursorValue}`,
        { signal: abortController.signal }
      )
    );
    expect(response.status).toBe(200);

    const reader = response.body!.getReader();
    await readChunk(reader); // retry directive
    const replayedEvent = await readChunk(reader);
    expect(replayedEvent).toContain(`id: ${latest.epoch}:${latest.sequence}\n`);
    expect(replayedEvent).toContain("event: actor.activity\n");

    const initialSnapshot = await readChunk(reader);
    expect(initialSnapshot).toContain("event: snapshot\n");
    abortController.abort();
  });
});
