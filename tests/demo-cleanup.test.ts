import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanupLedger, finalizeDemo } from "../scripts/demo-memory-box";

// This adapter models persisted server state, deliberately independent from the
// response ledger. It exercises lost-response recovery without Auth/AI/network.
type Row = Record<string, any>;
class PersistedService {
  rows: Record<string, Row[]> = {
    memories: [{ id: "visitor-note", author_id: "visitor", visibility: "published", title: "Keep this", body: "Visitor original" }],
    assets: [{ id: "visitor-image", owner_id: "visitor", status: "ready", path: "visitor/picture.png", staging_path: "visitor/upload" }],
    cells: [], paint_operations: [], world_events: [], rate_budgets: [], worlds: [{ id: "commons", revision: 10, public_epoch: 2 }],
  };
  users = new Set(["demo-actor", "visitor"]);
  objects = new Set(["memory-assets:visitor/picture.png", "memory-staging:visitor/upload"]);
  removedUsers: string[] = [];
  failRemove = false;
  failReconciliation = false;
  client = this as unknown as SupabaseClient;
  from(table: string) { return new Query(this, table); }
  async rpc(name: string, args?: Row) {
    if (name === "mb_snapshot") return { data: { memories: this.rows.memories.filter(row => row.visibility === "published") }, error: null };
    if (name === "mb_delete_memory") {
      const memory = this.rows.memories.find(row => row.id === args?.p_id && row.author_id === args?.p_actor);
      if (!memory) return { data: null, error: { message: "NOT_OWNER" } };
      memory.visibility = "deleted"; memory.title = ""; memory.body = "";
      const asset = this.rows.assets.find(row => row.id === memory.asset_id);
      if (asset && !this.rows.memories.some(row => row.asset_id === asset.id && ["published", "hidden"].includes(row.visibility))) asset.status = "deleted";
      this.rows.world_events.push({ id: `delete-${memory.id}`, memory_id: memory.id });
      return { data: { assetId: memory.asset_id }, error: null };
    }
    throw Error(`Unexpected RPC ${name}`);
  }
  storage = { from: (bucket: string) => ({
    remove: async (paths: string[]) => {
      if (this.failRemove) return { error: { message: "disposable storage failure" } };
      paths.forEach(path => this.objects.delete(`${bucket}:${path}`)); return { error: null };
    },
    list: async (dir: string, options: { search: string }) => ({ error: null, data: this.objects.has(`${bucket}:${dir}/${options.search}`) ? [{ name: options.search }] : [] }),
  }) };
  channel() { return { httpSend: async () => ({ success: true }) }; }
  auth = { admin: {
    deleteUser: async (id: string) => {
      // A call here before source/asset revocation loses recovery authority.
      expect(this.rows.memories.filter(row => row.author_id === id).every(row => row.visibility === "deleted")).toBe(true);
      expect(this.rows.assets.filter(row => row.owner_id === id).every(row => row.status === "deleted")).toBe(true);
      this.users.delete(id); this.removedUsers.push(id);
      this.rows.memories.filter(row => row.author_id === id).forEach(row => row.author_id = null);
      this.rows.assets.filter(row => row.owner_id === id).forEach(row => row.owner_id = null);
      return { error: null };
    },
    getUserById: async (id: string) => this.users.has(id) ? { data: { user: { id } }, error: null } : { data: { user: null }, error: { status: 404 } },
  } };
}
class Query {
  predicates: Array<(row: Row) => boolean> = [];
  head = false;
  action = "select";
  values: Row = {};
  one = false;
  slice?: [number, number];
  constructor(private service: PersistedService, private table: string) {}
  select(_columns?: string, options?: { count?: string; head?: boolean }) { this.head = !!options?.head; return this; }
  eq(key: string, value: unknown) { this.predicates.push(row => row[key] === value); return this; }
  neq(key: string, value: unknown) { this.predicates.push(row => row[key] !== value); return this; }
  in(key: string, values: unknown[]) { this.predicates.push(row => values.includes(row[key])); return this; }
  order(_key: string) { return this; }
  range(start: number, end: number) { this.slice = [start, end + 1]; return this; }
  maybeSingle() { this.one = true; return this; }
  single() { this.one = true; return this; }
  delete() { this.action = "delete"; return this; }
  update(values: Row) { this.action = "update"; this.values = values; return this; }
  async then(resolve: (result: Row) => unknown, reject?: (error: unknown) => unknown) {
    try {
      const all = this.service.rows[this.table] || [], matched = all.filter(row => this.predicates.every(predicate => predicate(row)));
      if (this.service.failReconciliation && this.table === "memories" && this.action === "select" && !this.head && !this.one) return resolve({ data: null, count: null, error: { message: "read failure" } });
      if (this.action === "delete") this.service.rows[this.table] = all.filter(row => !matched.includes(row));
      if (this.action === "update") matched.forEach(row => Object.assign(row, this.values));
      const data = this.slice ? matched.slice(...this.slice) : matched;
      return resolve({ data: this.head ? null : this.one ? data[0] || null : data.map(row => ({ ...row })), count: matched.length, error: null });
    } catch (error) { if (reject) return reject(error); throw error; }
  }
}

const folders: string[] = [];
function fixture(service = new PersistedService()) {
  const folder = mkdtempSync(resolve(tmpdir(), "memory-box-demo-cleanup-test-")); folders.push(folder);
  const ledger: Parameters<typeof cleanupLedger>[1] = {
    format: "memory-box-live-demo-v1", runId: "deterministic-test", mode: "mobile", origin: "http://localhost:3007", output: folder,
    actors: ["demo-actor"], memories: [], assets: [], operations: [], baselineCells: [], baselineMemories: structuredClone(service.rows.memories) as any,
    startedAt: "2026-10-21T00:00:00Z", chapters: [], cleaned: false,
  };
  return { service, ledger, path: resolve(folder, "ledger.json") };
}
function untrackedAsset(service: PersistedService, id: string, status: "staging" | "ready") {
  service.rows.assets.push({ id, owner_id: "demo-actor", status, path: status === "ready" ? `demo-actor/${id}.png` : null, staging_path: `demo-actor/${id}.upload` });
  service.objects.add(`memory-staging:demo-actor/${id}.upload`);
  if (status === "ready") service.objects.add(`memory-assets:demo-actor/${id}.png`);
}
afterEach(() => folders.splice(0).forEach(folder => rmSync(folder, { recursive: true, force: true })));

describe("exact demo recovery after lost server responses", () => {
  it("discovers committed originals and unpublished staging/ready uploads while preserving visitor resources", async () => {
    const { service, ledger, path } = fixture();
    service.rows.memories.push({ id: "lost-note", author_id: "demo-actor", visibility: "published", title: "Untracked commit" }, { id: "lost-hidden-note", author_id: "demo-actor", visibility: "hidden" });
    untrackedAsset(service, "lost-staging", "staging"); untrackedAsset(service, "lost-ready", "ready");
    await cleanupLedger(service.client, ledger, path);
    expect(ledger.cleaned).toBe(true);
    expect(ledger.cleanup).toMatchObject({ discoveredMemories: 2, discoveredAssets: 2, authoritativeOwnersVerified: true, actorsRemoved: 1, actorsRetained: 0 });
    expect(service.rows.memories.find(row => row.id === "visitor-note")).toMatchObject({ visibility: "published", title: "Keep this" });
    expect(service.objects).toEqual(new Set(["memory-assets:visitor/picture.png", "memory-staging:visitor/upload"]));
    expect(service.users).toEqual(new Set(["visitor"]));
    expect(JSON.parse(readFileSync(path, "utf8")).assets).toContain("lost-staging");
  });
  it("retains Auth and the reconciled ledger after storage failure, then retries only exact resources", async () => {
    const { service, ledger, path } = fixture(); untrackedAsset(service, "lost-ready", "ready"); service.failRemove = true;
    await expect(cleanupLedger(service.client, ledger, path)).rejects.toThrow("Exact demo cleanup incomplete");
    expect(service.removedUsers).toEqual([]); expect(service.users.has("demo-actor")).toBe(true);
    expect(ledger.cleaned).toBe(false); expect(ledger.cleanup?.actorsRetained).toBe(1); expect(ledger.assets).toEqual(["lost-ready"]);
    service.failRemove = false; await cleanupLedger(service.client, ledger, path);
    expect(ledger.cleaned).toBe(true); expect(service.removedUsers).toEqual(["demo-actor"]);
  });
  it("removes the canonical object from an upload interrupted before its ready path was persisted", async () => {
    const { service, ledger, path } = fixture(); untrackedAsset(service, "interrupted", "staging");
    service.objects.add("memory-assets:demo-actor/interrupted.webp");
    await cleanupLedger(service.client, ledger, path);
    expect(service.objects.has("memory-assets:demo-actor/interrupted.webp")).toBe(false);
    expect(service.objects.has("memory-staging:demo-actor/interrupted.upload")).toBe(false);
    expect(ledger.cleaned).toBe(true);
  });
  it("protects an asset referenced by another current source and retains recovery identity", async () => {
    const { service, ledger, path } = fixture(); untrackedAsset(service, "protected-ready", "ready");
    service.rows.memories[0].asset_id = "protected-ready"; ledger.baselineMemories = structuredClone(service.rows.memories) as any;
    await expect(cleanupLedger(service.client, ledger, path)).rejects.toThrow("Exact demo cleanup incomplete");
    expect(service.rows.assets.find(row => row.id === "protected-ready")?.status).toBe("ready");
    expect(service.objects.has("memory-assets:demo-actor/protected-ready.png")).toBe(true);
    expect(service.removedUsers).toEqual([]);
  });
  it("preserves a later visitor repaint while recovering an operation missing from the response ledger", async () => {
    const { service, ledger, path } = fixture();
    service.rows.paint_operations.push({ id: "lost-paint", actor_id: "demo-actor", revision: 3, before_cells: [{ x: 3, y: 4, color: "#FFFFFF", operationId: null }] });
    service.rows.cells.push({ world_id: "commons", x: 3, y: 4, color: "#112233", operation_id: "visitor-paint", updated_revision: 4 });
    await cleanupLedger(service.client, ledger, path);
    expect(ledger.operations).toContainEqual(["lost-paint", "demo-actor"]);
    expect(ledger.cleanup).toMatchObject({ restored: 0, preservedLater: 1, actorsRemoved: 1 });
    expect(service.rows.cells[0]).toMatchObject({ color: "#112233", operation_id: "visitor-paint" });
  });
  it("keeps Auth authority when authoritative reconciliation is unavailable", async () => {
    const { service, ledger, path } = fixture(); service.failReconciliation = true;
    await expect(cleanupLedger(service.client, ledger, path)).rejects.toThrow("Exact demo cleanup incomplete");
    expect(service.removedUsers).toEqual([]); expect(service.users.has("demo-actor")).toBe(true);
  });
  it("attempts exact cleanup even when recording finalization and browser close both reject", async () => {
    const calls: string[] = [];
    const failures = await finalizeDemo({
      videos: async () => { calls.push("videos"); throw Error("video failure"); },
      browser: async () => { calls.push("browser"); throw Error("browser failure"); },
      cleanup: async () => { calls.push("cleanup"); },
    });
    expect(calls).toEqual(["videos", "browser", "cleanup"]);
    expect(failures).toEqual(["videos", "browser"]);
  });
});
