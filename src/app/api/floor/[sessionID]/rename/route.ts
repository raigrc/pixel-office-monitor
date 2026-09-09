import { NextRequest, NextResponse } from "next/server";
import { getState, renameFloor } from "@/lib/monitor-store";

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

export async function PATCH(
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

    // Parse and validate body
    const body = await req.json().catch(() => ({}));
    const title = body?.title;

    if (typeof title !== "string" || !title.trim()) {
      return NextResponse.json(
        { ok: false, error: "title required" },
        { status: 400 }
      );
    }

    // Get current state to verify floor exists
    const state = getState();
    const floorExists = state.floors.some((f) => f.sessionID === sessionID);

    if (!floorExists) {
      return NextResponse.json(
        { ok: false, error: "floor not found" },
        { status: 404 }
      );
    }

    // Rename floor in store and emit floor.updated event for SSE clients
    const updatedFloor = renameFloor(sessionID, title);

    if (!updatedFloor) {
      return NextResponse.json(
        { ok: false, error: "floor not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, floor: updatedFloor }, { status: 200 });
  } catch (err) {
    console.error("[floor rename] unexpected error", err);
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