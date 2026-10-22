import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  actor: "53219ac5-08c8-4461-a448-b7e688571fa7", admitted: true,
  reads: [] as string[], writes: [] as unknown[][],
  undoError: "",
  result: {} as Record<string, unknown>,
}));
vi.mock("@/lib/server/auth", async () => {
  const { ApiError } = await import("../src/lib/server/http");
  return { requireActor: async () => {
    if (!state.admitted) throw new ApiError(401, "Join the live box to continue.", "sign_in_required");
    return { id: state.actor };
  } };
});
vi.mock("@/lib/server/database", () => ({
  getPaintTurn: async (actor: string) => { state.reads.push(actor); return timing; },
  applyPaint: async (...args: unknown[]) => { state.writes.push(args); return state.result; },
  undoPaint: async () => {
    if (state.undoError) throw new Error(state.undoError);
    return { operationId: "9554577e-54dd-48f0-8855-b4ea998f4a90", revision: 33, restored: 1, skipped: 1 };
  },
}));
vi.mock("@/lib/server/http", async () => import("../src/lib/server/http"));
vi.mock("@/lib/server/validation", async () => import("../src/lib/server/validation"));

import { GET, POST } from "../src/app/api/paint/route";
import { POST as undo } from "../src/app/api/paint/undo/route";

const timing = { serverTime: "2026-10-22T04:00:00.000Z", nextPaintAt: "2026-10-22T04:00:15.000Z", cooldownSeconds: 15 };
const cells = [{ x: 5, y: -3, color: "#BDA9E9" }];
const input = { opId: "e6247436-ce05-48ce-913c-a1f0908350da", sceneId: "garden", cells };
const request = (body: unknown = input, origin = "https://box.example") => new Request("https://box.example/api/paint", {
  method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body),
});
beforeEach(() => {
  state.admitted = true; state.reads.length = 0; state.writes.length = 0; state.undoError = "";
  state.result = { status: "accepted", operationId: "9554577e-54dd-48f0-8855-b4ea998f4a90", revision: 32, epoch: 1, pixels: cells, ...timing };
});

describe("authoritative paint-turn transport", () => {
  it("reads timing for the verified actor only and never caches it", async () => {
    const response = await GET(new Request("https://box.example/api/paint?actor=someone-else"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual(timing);
    expect(state.reads).toEqual([state.actor]);
  });
  it("requires admission before returning a turn", async () => {
    state.admitted = false;
    const response = await GET(new Request("https://box.example/api/paint"));
    expect(response.status).toBe(401); expect(state.reads).toEqual([]);
  });
  it("returns the accepted receipt and exact server timing", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200); expect(await response.json()).toEqual(state.result);
    expect(state.writes).toEqual([[state.actor, input.opId, cells, "garden"]]);
  });
  it("preserves a precise cooldown without pretending the preview was saved", async () => {
    state.result = { status: "cooldown", ...timing, retryAfterMs: 12450 };
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("13");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ ...state.result, code: "paint_cooldown", error: "Your next paint turn is almost ready. Your preview is still here." });
  });
  it("rounds a fractional last second up for HTTP backoff", async () => {
    state.result = { status: "cooldown", ...timing, retryAfterMs: 1 };
    expect((await POST(request())).headers.get("Retry-After")).toBe("1");
  });
  it("rejects invalid and cross-origin writes before touching authoritative timing", async () => {
    const invalid = await POST(request({ ...input, cells: Array.from({ length: 145 }, (_, x) => ({ x, y: 0, color: "#FFFFFF" })) }));
    expect(invalid.status).toBe(400);
    expect((await POST(request(input, "https://other.example"))).status).toBe(403);
    expect(state.writes).toEqual([]); expect(state.reads).toEqual([]);
  });
  it("returns a useful conflict for an unavailable undo instead of a service failure", async () => {
    state.undoError = "UNDO_UNAVAILABLE";
    const response = await undo(request({ ...input, operationId: input.opId }));
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("undo_unavailable");
    expect(state.reads).toEqual([]); expect(state.writes).toEqual([]);
  });
});
