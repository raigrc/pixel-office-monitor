import { NextRequest, NextResponse } from "next/server";
import { getSnapshot, getState } from "@/lib/monitor-store";

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
  try {
    const acceptHeader = req.headers.get("accept") ?? "";
    const wantsV2 = acceptHeader.includes("application/vnd.pixel-monitor.v2+json");

    if (wantsV2) {
      const token = extractToken(req);
      const expected = getExpectedToken();
      if (!token || token !== expected) {
        return NextResponse.json(
          { ok: false, error: "unauthorized" },
          { status: 401 }
        );
      }
      const snapshot = getSnapshot();
      const sanitized = {
        ...snapshot,
        invocations: snapshot.invocations.map((inv) => ({
          ...inv,
          promptPreview: inv.promptPreview ? "[REDACTED]" : null,
        })),
      };
      return NextResponse.json(sanitized, {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      });
    }

    const state = getState();
    const sanitized = {
      floors: state.floors.map((f) => ({
        ...f,
        cubicles: f.cubicles.map((c) => ({
          ...c,
          prompt: c.prompt ? "[REDACTED]" : undefined,
        })),
      })),
    };
    return NextResponse.json(sanitized, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (err) {
    console.error("[state] error", err);
    return NextResponse.json(
      { ok: false, error: "internal" },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}