import { afterEach, describe, expect, it, vi } from "vitest";
import { closeFloor, renameFloor } from "../monitor-api";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_PIXEL_MONITOR_TOKEN;
});

describe("monitor API client", () => {
  it("sends close request with encoded ID and monitor token", async () => {
    process.env.NEXT_PUBLIC_PIXEL_MONITOR_TOKEN = "secret";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(closeFloor("project:root/id")).resolves.toEqual({
      ok: true,
      status: 200,
      message: "Floor closed",
      data: null,
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/floor/project%3Aroot%2Fid/close", {
      method: "POST",
      headers: { "content-type": "application/json", "x-monitor-token": "secret" },
    });
  });

  it("returns server status and error message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }),
    ));

    await expect(closeFloor("one")).resolves.toEqual({ ok: false, status: 401, message: "unauthorized" });
  });

  it("sends rename payload and returns renamed floor", async () => {
    const floor = {
      floorId: "one",
      rootSessionId: "one",
      projectId: "project",
      title: "New title",
      createdAt: 1,
      updatedAt: 2,
      closed: false,
      closedAt: null,
      sessionId: "one",
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, floor }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(renameFloor("one", "New title")).resolves.toEqual({
      ok: true,
      status: 200,
      message: "Floor renamed",
      data: floor,
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/floor/one/rename", {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-monitor-token": "" },
      body: JSON.stringify({ title: "New title" }),
    });
  });

  it("does not throw network or malformed success errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(closeFloor("one")).resolves.toEqual({ ok: false, status: 0, message: "offline" });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not json", { status: 200 })));
    await expect(renameFloor("one", "Title")).resolves.toEqual({
      ok: false,
      status: 200,
      message: "Rename response did not include floor",
    });
  });
});
