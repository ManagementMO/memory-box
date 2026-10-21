import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  actorId: "53219ac5-08c8-4461-a448-b7e688571fa7",
  rejectedKind: "",
  used: new Map<string, number>(),
  effects: [] as string[],
  reservations: [] as Array<{ actor: string; kind: string; limit: number; seconds: number }>,
  afterCallbacks: [] as Array<() => unknown>,
}));

vi.mock("@/lib/server/auth", () => ({
  requireActor: async () => ({ id: state.actorId }),
}));
vi.mock("@/lib/server/http", async () => import("../src/lib/server/http"));
vi.mock("@/lib/server/validation", async () => import("../src/lib/server/validation"));
vi.mock("@/lib/server/database", () => ({
  consumeBudget: async (actor: string, kind: string, limit: number, seconds: number) => {
    state.reservations.push({ actor, kind, limit, seconds });
    const key = actor + ":" + kind;
    const next = (state.used.get(key) ?? 0) + 1;
    if (state.rejectedKind === kind || next > limit) throw new Error("RATE_LIMITED");
    state.used.set(key, next);
    return next;
  },
  createAsset: async () => {
    state.effects.push("create-asset");
    return { id: "9d1747d0-6be6-4ef4-8e02-d3611c0018eb", staging_path: "owned/image.upload" };
  },
  adminClient: () => ({
    storage: { from: () => ({ createSignedUploadUrl: async () => {
      state.effects.push("issue-upload-token");
      return { data: { token: "fixture-upload-token" }, error: null };
    } }) },
  }),
  updateMemory: async () => { state.effects.push("update-memory"); return { id: state.actorId, version: 2 }; },
  deleteMemory: async () => undefined,
}));
vi.mock("@/lib/server/retrieval", () => ({
  retrieve: async () => { state.effects.push("query-embedding"); return { mode: "hybrid", results: [] }; },
  ask: async () => { state.effects.push("query-and-answer"); return { mode: "hybrid", results: [], status: "insufficient", claims: [], summary: "No originals.", sourceVersions: {} }; },
}));
vi.mock("@/lib/server/indexing", () => ({
  processIndexJobs: async () => { state.effects.push("index-work"); return { completed: 0 }; },
}));
vi.mock("next/server", () => ({
  after: (callback: () => unknown) => { state.afterCallbacks.push(callback); },
}));

import { POST as search } from "../src/app/api/search/route";
import { POST as ask } from "../src/app/api/ask/route";
import { POST as upload } from "../src/app/api/uploads/route";
import { PATCH as edit } from "../src/app/api/memories/[id]/route";

const globalActor = "00000000-0000-0000-0000-000000000000";
const query = { query: "music and family" };
const image = { name: "memory.png", mime: "image/png", size: 500 };
const patch = { expectedVersion: 1, title: "A memory", body: "New words." };
const request = (path: string, body: unknown, method = "POST") => new Request("https://box.example" + path, {
  method, headers: { Origin: "https://box.example", "Content-Type": "application/json" }, body: JSON.stringify(body),
});
const context = () => ({ params: Promise.resolve({ id: state.actorId }) });

beforeEach(() => {
  state.actorId = "53219ac5-08c8-4461-a448-b7e688571fa7";
  state.rejectedKind = "";
  state.used.clear();
  state.effects.length = 0;
  state.reservations.length = 0;
  state.afterCallbacks.length = 0;
});

describe("public route spending boundaries", () => {
  it.each([
    ["Search", search],
    ["Ask", ask],
  ] as const)("stops %s before inference or index scheduling when the shared native-query allowance is exhausted", async (_name, handler) => {
    state.rejectedKind = "global_native_query";
    const response = await handler(request("/api/search", query));
    expect(response.status).toBe(429);
    expect((await response.json()).code).toBe("rate_limited");
    expect(state.effects).toEqual([]);
    expect(state.afterCallbacks).toHaveLength(0);
    expect(state.reservations).toContainEqual({ actor: globalActor, kind: "global_native_query", limit: 2000, seconds: 86400 });
  });

  it("shares one native-query allowance across Search, Ask, and different guest identities", async () => {
    state.used.set(globalActor + ":global_native_query", 1999);
    expect((await search(request("/api/search", query))).status).toBe(200);
    state.actorId = "9d1747d0-6be6-4ef4-8e02-d3611c0018eb";
    expect((await ask(request("/api/ask", query))).status).toBe(429);
    expect(state.effects).toEqual(["query-embedding"]);
    expect(state.afterCallbacks).toHaveLength(1);
  });

  it("does not create an asset or issue a signed upload token after the global upload allowance is exhausted", async () => {
    state.rejectedKind = "global_upload";
    const response = await upload(request("/api/uploads", image));
    expect(response.status).toBe(429);
    expect(state.effects).toEqual([]);
    expect(state.reservations).toContainEqual({ actor: globalActor, kind: "global_upload", limit: 60, seconds: 86400 });
  });

  it("does not update or schedule reindexing after an author's edit allowance is exhausted", async () => {
    state.rejectedKind = "memory_edit";
    const response = await edit(request("/api/memories/" + state.actorId, patch, "PATCH"), context());
    expect(response.status).toBe(429);
    expect(state.effects).toEqual([]);
    expect(state.afterCallbacks).toHaveLength(0);
    expect(state.reservations).toContainEqual({ actor: state.actorId, kind: "memory_edit", limit: 30, seconds: 600 });
  });

  it.each([
    ["search", () => search(request("/api/search", query))],
    ["ask", () => ask(request("/api/ask", query))],
    ["upload", () => upload(request("/api/uploads", image))],
  ] as const)("preserves the existing per-guest %s guard before any downstream work", async (kind, invoke) => {
    state.rejectedKind = kind;
    const response = await invoke();
    expect(response.status).toBe(429);
    expect(state.effects).toEqual([]);
    expect(state.afterCallbacks).toHaveLength(0);
  });

  it("preserves the global answer allowance before generation", async () => {
    state.rejectedKind = "global_ask";
    const response = await ask(request("/api/ask", query));
    expect(response.status).toBe(429);
    expect(state.effects).toEqual([]);
    expect(state.afterCallbacks).toHaveLength(0);
  });

  it("allows a reserved upload and edit to reach their actual application boundaries", async () => {
    expect((await upload(request("/api/uploads", image))).status).toBe(200);
    expect((await edit(request("/api/memories/" + state.actorId, patch, "PATCH"), context())).status).toBe(200);
    expect(state.effects).toEqual(["create-asset", "issue-upload-token", "update-memory"]);
    expect(state.afterCallbacks).toHaveLength(1);
  });
});
