import type { FloorInfo } from "@/lib/monitor-types";

export type MonitorApiResult<T> =
  | { ok: true; status: number; message: string; data: T }
  | { ok: false; status: number; message: string };

function responseMessage(body: unknown, fallback: string): string {
  if (body !== null && typeof body === "object") {
    if ("message" in body && typeof body.message === "string" && body.message.trim()) return body.message;
    if ("error" in body && typeof body.error === "string" && body.error.trim()) return body.error;
  }
  return fallback;
}

async function readBody(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function isFloorInfo(value: unknown): value is FloorInfo {
  return value !== null
    && typeof value === "object"
    && "floorId" in value && typeof value.floorId === "string"
    && "rootSessionId" in value && typeof value.rootSessionId === "string"
    && "projectId" in value && typeof value.projectId === "string"
    && "title" in value && typeof value.title === "string"
    && "createdAt" in value && typeof value.createdAt === "number"
    && "updatedAt" in value && typeof value.updatedAt === "number"
    && "closed" in value && typeof value.closed === "boolean"
    && "closedAt" in value && (value.closedAt === null || typeof value.closedAt === "number")
    && "sessionId" in value && typeof value.sessionId === "string";
}

function authorizationHeaders(): HeadersInit {
  return {
    "content-type": "application/json",
    "x-monitor-token": process.env.NEXT_PUBLIC_PIXEL_MONITOR_TOKEN ?? "",
  };
}

export async function closeFloor(floorId: string): Promise<MonitorApiResult<null>> {
  try {
    const response = await fetch(`/api/floor/${encodeURIComponent(floorId)}/close`, {
      method: "POST",
      headers: authorizationHeaders(),
    });
    const body = await readBody(response);
    if (!response.ok) {
      return { ok: false, status: response.status, message: responseMessage(body, "Unable to close floor") };
    }
    return { ok: true, status: response.status, message: responseMessage(body, "Floor closed"), data: null };
  } catch (error) {
    return { ok: false, status: 0, message: error instanceof Error ? error.message : "Network request failed" };
  }
}

export async function renameFloor(floorId: string, title: string): Promise<MonitorApiResult<FloorInfo>> {
  try {
    const response = await fetch(`/api/floor/${encodeURIComponent(floorId)}/rename`, {
      method: "PATCH",
      headers: authorizationHeaders(),
      body: JSON.stringify({ title }),
    });
    const body = await readBody(response);
    if (!response.ok) {
      return { ok: false, status: response.status, message: responseMessage(body, "Unable to rename floor") };
    }
    if (body === null || typeof body !== "object" || !("floor" in body) || !isFloorInfo(body.floor)) {
      return { ok: false, status: response.status, message: "Rename response did not include floor" };
    }
    return { ok: true, status: response.status, message: responseMessage(body, "Floor renamed"), data: body.floor };
  } catch (error) {
    return { ok: false, status: 0, message: error instanceof Error ? error.message : "Network request failed" };
  }
}
