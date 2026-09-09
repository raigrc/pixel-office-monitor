import { NextRequest, NextResponse } from "next/server";
import { getSnapshot, deleteFloor } from "@/lib/monitor-store";

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionID: string }> }
) {
  try {
    const token = extractToken(req);
    const expected = getExpectedToken();

    if (!token || token !== expected) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 }
      );
    }

    const { sessionID } = await params;

    // Check the full snapshot (includes closed floors) so re-closing is idempotent.
    const snapshot = getSnapshot();
    const floorExists = snapshot.floors.some((f) => f.floorId === sessionID);

    if (!floorExists) {
      return NextResponse.json(
        { ok: false, error: "floor not found" },
        { status: 404 }
      );
    }

    // Delete floor from store and emit floor.deleted event for SSE clients
    deleteFloor(sessionID);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[floor close] unexpected error", err);
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