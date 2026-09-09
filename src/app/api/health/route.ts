import { NextResponse } from "next/server";
import {
  getFloorsCount,
  getUptimeMs,
  getActiveSSEConnections,
  getSSEMetrics,
} from "@/lib/monitor-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const floorsCount = getFloorsCount();
    const uptime = getUptimeMs();
    const activeSSEConnections = getActiveSSEConnections();
    const sseMetrics = getSSEMetrics();
    return NextResponse.json(
      {
        status: "ok",
        uptimeMs: uptime,
        floors: floorsCount,
        activeSSEConnections,
        sseMetrics,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch (err) {
    console.error("[health] error", err);
    return NextResponse.json(
      { status: "error", error: "internal" },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}