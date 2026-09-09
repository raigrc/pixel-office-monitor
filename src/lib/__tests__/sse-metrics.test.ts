import { describe, it, expect, beforeEach } from "vitest";
import { upsert, getSSEMetrics, _clearStore } from "../monitor-store";
import type { IngestPayloadV2 } from "../schema";

// ---------------------------------------------------------------------------
// SSE metrics — every emitted event must feed /api/health data so the
// connection badge can distinguish live data from a merely open socket.
// ---------------------------------------------------------------------------

describe("sse-metrics", () => {
  beforeEach(() => {
    _clearStore();
  });

  it("records lastEventAt when events are emitted", () => {
    const before = Date.now();
    upsert({
      v: 2,
      eventId: `evt-metrics-${before}`,
      projectId: "pixel-office-monitor",
      sessionId: "ses_metrics_001",
      rootSessionId: "ses_metrics_001",
      parentSessionId: null,
      occurredAt: before,
      kind: "session.upsert",
      detail: { agentKey: "orchestrator" },
    } satisfies IngestPayloadV2);
    const metrics = getSSEMetrics();
    expect(metrics.lastEventAt).toBeGreaterThanOrEqual(before);
    expect(metrics.sampleCount).toBeGreaterThan(0);
  });
});
