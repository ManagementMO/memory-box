import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IndexJob } from "../src/lib/server/database";
import type { Memory } from "../src/lib/types";

const deps = vi.hoisted(() => ({ lease: vi.fn(), complete: vi.fn(), fail: vi.fn(), embed: vi.fn(), describe: vi.fn(), admin: vi.fn(), rows: vi.fn(), scopedLease: vi.fn() }));
vi.mock("../src/lib/server/database", () => ({
  getIndexJobs: deps.lease, completeIndexJob: deps.complete, failIndexJob: deps.fail,
  getReadableAsset: vi.fn(), adminClient: deps.admin,
}));
vi.mock("../src/lib/server/ai", async importOriginal => ({
  ...await importOriginal<typeof import("../src/lib/server/ai")>(),
  embedText: deps.embed, describeImage: deps.describe, getAIModels: () => ({ embedding: "test/versioned-model" }),
}));
import { processIndexJobs, processLeasedIndexJobs } from "../src/lib/server/indexing";
import { AIServiceError } from "../src/lib/server/ai";
import { indexWaterlooSeed, validateWaterlooSeedRows } from "../scripts/index-waterloo-seed";
import { WATERLOO_MEMORIES, WATERLOO_SEED_MARKER } from "../src/lib/waterloo-world";
import { waterlooSeedHash } from "../scripts/seed-waterloo-world";

function job(overrides: Partial<Memory> = {}): IndexJob {
  return { id: "job-1", memory_id: "source-1", source_version: 3, attempts: 1, memory: {
    id: "source-1", authorId: null, authorName: "Starter", type: "text", title: "A campus goose",
    body: "Territorial stakeholder management.", color: "#FFF3BF", x: 4000, y: 600, sceneId: "garden",
    url: null, imageUrl: null, inspiredBy: null, paintOperationId: null, createdAt: "2026-10-21T00:00:00Z",
    updatedAt: "2026-10-21T00:00:00Z", version: 3, indexStatus: "pending", isSeed: true, ...overrides,
  } };
}
beforeEach(() => {
  vi.clearAllMocks(); deps.lease.mockResolvedValue([]); deps.complete.mockResolvedValue(true);
  deps.fail.mockResolvedValue(undefined); deps.embed.mockResolvedValue([.2,.3]); deps.describe.mockResolvedValue("A white goose wearing a pink tie.");
  deps.rows.mockReset(); deps.scopedLease.mockReset();
  deps.admin.mockReturnValue({ from: () => ({ select: () => ({ in: deps.rows }) }), rpc: deps.scopedLease });
});

function seedRows() {
  return WATERLOO_MEMORIES.map(memory => ({
    id: memory.id, world_id: "commons", is_seed: true, author_id: null, visibility: "published",
    client_id: `${WATERLOO_SEED_MARKER}:${memory.id}`, request_hash: waterlooSeedHash(), index_status: "ready", version: 1,
  }));
}
describe("exact Waterloo operator scope", () => {
  it("requires every one of the 24 exact persisted starter identities", () => {
    const rows = seedRows(); expect(validateWaterlooSeedRows(rows)).toHaveLength(24);
    expect(() => validateWaterlooSeedRows(rows.slice(1))).toThrow("seed_source_mismatch");
    expect(() => validateWaterlooSeedRows([...rows.slice(1),rows[1]])).toThrow("seed_source_mismatch");
    for (const patch of [
      { id: "other-original" }, { world_id: "other-world" }, { is_seed: false }, { author_id: "a-visitor" },
      { visibility: "hidden" }, { client_id: "another-seed" }, { request_hash: "another-payload" }, { version: 0 },
    ]) expect(() => validateWaterlooSeedRows([{...rows[0],...patch},...rows.slice(1)])).toThrow("seed_source_mismatch");
  });
  it("aborts a source mismatch before leasing or processing any job", async () => {
    const rows = seedRows(); deps.rows.mockResolvedValue({ data: [{...rows[0],author_id:"visitor"},...rows.slice(1)], error: null });
    await expect(indexWaterlooSeed()).rejects.toThrow("seed_source_mismatch");
    expect(deps.scopedLease).not.toHaveBeenCalled(); expect(deps.embed).not.toHaveBeenCalled();
  });
  it("uses only the separate 24/day allowance and exact ID filter, sharing the version-fenced processor", async () => {
    const rows = seedRows();
    deps.rows.mockResolvedValueOnce({ data: [{...rows[0],index_status:"pending"},...rows.slice(1)], error: null }).mockResolvedValueOnce({data:rows,error:null});
    const leased = { ...job(), memory_id: rows[0].id, source_version: 1, memory: {...job().memory,id:rows[0].id,version:1} };
    deps.scopedLease.mockResolvedValueOnce({data:[leased],error:null}).mockResolvedValueOnce({data:[],error:null});
    expect(await indexWaterlooSeed()).toMatchObject({status:"complete",checked:24,leased:1,completed:1,failed:0,ready:24,pending:0,indexFailed:0});
    for (const call of deps.scopedLease.mock.calls) expect(call).toEqual(["mb_lease_index_jobs_budget",{
      p_limit:4,p_budget_actor:"00000000-0000-0000-0000-000000000000",p_budget_kind:"waterloo_seed_index",p_daily_limit:24,p_memory_ids:WATERLOO_MEMORIES.map(memory=>memory.id),
    }]);
    expect(deps.lease).not.toHaveBeenCalled(); expect(deps.complete).toHaveBeenCalledTimes(1);
  });
  it("refuses a returned lease outside the validated seed instead of sending it to a provider", async () => {
    deps.rows.mockResolvedValue({data:seedRows(),error:null});deps.scopedLease.mockResolvedValue({data:[job()],error:null});
    await expect(indexWaterlooSeed()).rejects.toThrow("lease_scope_mismatch");
    expect(deps.embed).not.toHaveBeenCalled();expect(deps.complete).not.toHaveBeenCalled();
  });
});

describe("shared version-fenced index processing", () => {
  it("keeps the public worker on its normal lease getter with the existing default and four-job cap", async () => {
    expect(await processIndexJobs()).toEqual({ completed: 0, failed: 0, leased: 0 });
    expect(await processIndexJobs(100)).toEqual({ completed: 0, failed: 0, leased: 0 });
    expect(deps.lease.mock.calls).toEqual([[2],[4]]);
    expect(deps.embed).not.toHaveBeenCalled();
  });
  it("processes explicit leased jobs without making another lease or spending a public reservation", async () => {
    expect(await processLeasedIndexJobs([job()])).toEqual({ completed: 1, failed: 0, leased: 1 });
    expect(deps.lease).not.toHaveBeenCalled();
    expect(deps.embed).toHaveBeenCalledWith("A campus goose\nTerritorial stakeholder management.");
    expect(deps.complete).toHaveBeenCalledWith("job-1",3,"Title: A campus goose\nAuthor's words: Territorial stakeholder management.\nScene: garden",[.2,.3],"test/versioned-model");
  });
  it("does not count a withdrawn or superseded completion as an accepted index", async () => {
    deps.complete.mockResolvedValue(false);
    expect(await processLeasedIndexJobs([job()])).toEqual({ completed: 0, failed: 0, leased: 1 });
    expect(deps.complete.mock.calls[0][1]).toBe(3); expect(deps.fail).not.toHaveBeenCalled();
  });
  it("uses the existing safe retry code for provider failure and suppresses arbitrary error detail", async () => {
    deps.embed.mockRejectedValueOnce(new AIServiceError("timed_out",true)).mockRejectedValueOnce(new Error("private provider detail"));
    const other = { ...job(), id: "job-2" };
    expect(await processLeasedIndexJobs([job(),other])).toEqual({ completed: 0, failed: 2, leased: 2 });
    expect(deps.fail.mock.calls).toEqual([["job-1","timed_out"],["job-2","indexing_failed"]]);
    expect(deps.complete).not.toHaveBeenCalled();
  });
  it("retains trusted starter rasterization, captioning and version-fenced image completion", async () => {
    const image = job({ type: "image", imageUrl: "/starter-world/uw-goose.svg", body: "An original drawing." });
    expect(await processLeasedIndexJobs([image])).toEqual({ completed: 1, failed: 0, leased: 1 });
    expect(deps.describe).toHaveBeenCalledTimes(1);
    const [bytes,mime] = deps.describe.mock.calls[0]; expect(bytes.byteLength).toBeGreaterThan(0); expect(mime).toBe("image/webp");
    expect(deps.embed).toHaveBeenCalledWith("A campus goose\nAn original drawing.\nA white goose wearing a pink tie.");
    expect(deps.complete.mock.calls[0][2]).toContain("Machine-derived visual description: A white goose wearing a pink tie.");
    expect(deps.lease).not.toHaveBeenCalled();
  });
});
