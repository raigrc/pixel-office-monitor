import { NextRequest, NextResponse } from "next/server";
import { anyIngestPayloadSchema, isV1Payload, isV2Payload } from "@/lib/schema";
import { upsert, getLatestEvent, setDedupe, checkDedupe, getSnapshot } from "@/lib/monitor-store";

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

export async function POST(req: NextRequest) {
  try {
    const token = extractToken(req);
    const expected = getExpectedToken();

    if (!token || token !== expected) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "invalid json" },
        { status: 400 }
      );
    }

    const parsed = anyIngestPayloadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid payload",
          issues: parsed.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
            code: i.code,
          })),
        },
        { status: 400 }
      );
    }

    const payload = parsed.data;

    if (isV2Payload(payload)) {
      const existingSeq = checkDedupe(payload.eventId);
      if (existingSeq !== undefined) {
        const latest = getLatestEvent();
        return NextResponse.json(
          {
            ok: true,
            accepted: false,
            duplicate: true,
            epoch: latest.epoch,
            sequence: existingSeq,
            eventId: payload.eventId,
          },
          { status: 200 }
        );
      }

      upsert(payload);

      setDedupe(payload.eventId, getLatestEvent().sequence);

      const latest = getLatestEvent();
      return NextResponse.json(
        {
          ok: true,
          accepted: true,
          duplicate: false,
          epoch: latest.epoch,
          sequence: latest.sequence,
          eventId: payload.eventId,
        },
        { status: 200 }
      );
    }

    if (isV1Payload(payload)) {
      upsert(payload);

      const latest = getLatestEvent();
      return NextResponse.json(
        {
          ok: true,
          accepted: true,
          duplicate: false,
          epoch: latest.epoch,
          sequence: latest.sequence,
          eventId: `v1-${payload.sessionID}-${payload.agent}-${payload.ts}`,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { ok: false, error: "unsupported payload version" },
      { status: 400 }
    );
  } catch (err) {
    console.error("[ingest] unexpected error", err);
    return NextResponse.json(
      { ok: false, error: "internal" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { ok: false, error: "method not allowed" },
    { status: 405 }
  );
}