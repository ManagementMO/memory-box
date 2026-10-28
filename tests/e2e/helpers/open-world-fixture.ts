import { expect, type Browser, type BrowserContext, type Page, type TestInfo } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import type { Memory, WorldSnapshot } from "../../../src/lib/types";

/** Explicit opt-in: a browser visit creates a real anonymous Supabase identity. */
export const browserEnabled = process.env.MB_E2E_OPEN_WORLD === "1";
export const writesEnabled = process.env.MB_E2E_WRITE === "1";

export async function sameOrigin<T>(page: Page, path: string, body?: unknown, method = "POST") {
  return page.evaluate(async ({ path, body, method }) => {
    // The session and bearer header stay inside this browser. Only application
    // responses (never the session object) cross the Playwright boundary.
    const key = Object.keys(localStorage).find(key => /^sb-.+-auth-token$/.test(key));
    const session = key ? JSON.parse(localStorage.getItem(key) || "null") : null;
    if (!session?.access_token) throw new Error("The test guest has no active session.");
    const response = await fetch(path, { method, headers: {
      Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json",
    }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json(), requestId:response.headers.get("X-Memory-Box-Request-Id") };
  }, { path, body, method }) as Promise<{ status: number; body: T; requestId:string|null }>;
}

export class WorldFixture {
  readonly runId = randomUUID();
  readonly actors = new Set<string>();
  readonly memories = new Map<string, string>();
  readonly assets = new Set<string>();
  readonly operations = new Map<string, string>();
  readonly cleanupCounts = { pixelsRestored: 0, pixelsPreserved: 0, publicEventsRemoved: 0 };
  private pending: Promise<void>[] = [];
  private contexts: BrowserContext[] = [];
  private knownActors = new WeakMap<Page, string>();
  private db: SupabaseClient;
  private ledgerPath: string;

  constructor(private info: TestInfo) {
    if (existsSync(".env.local")) process.loadEnvFile(".env.local");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Disposable browser tests require the configured cleanup service.");
    this.db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    mkdirSync("auth", { recursive: true });
    this.ledgerPath = `auth/open-world-${this.runId}.json`;
    this.ledger(false);
  }

  private ledger(cleaned: boolean) {
    writeFileSync(this.ledgerPath, JSON.stringify({ runId: this.runId, test: this.info.title,
      project: this.info.project.name, actors: [...this.actors], memories: [...this.memories],
      assets: [...this.assets], operations: [...this.operations], cleanupCounts: this.cleanupCounts, cleaned }, null, 2));
  }

  /** Optional integration-test admission, not a public-signup test. Real Auth
   * sessions avoid spending the anonymous-IP bucket on every scenario. */
  private async provision(page: Page) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Provisioned browser tests require the public Supabase configuration.");
    const email = `memory-box-e2e-${randomUUID()}@example.invalid`;
    const password = randomUUID() + randomUUID();
    const created = await this.db.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw new Error("Could not provision the disposable test identity.");
    this.actors.add(created.data.user.id);
    this.ledger(false); // Retain ownership even if login/navigation fails.
    // A same-origin static document avoids starting anonymous admission first.
    await page.goto("/favicon.svg");
    const id = await page.evaluate(async ({ url, key, email, password }) => {
      const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: "POST", headers: { apikey: key, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) throw new Error(`Disposable test login failed (${response.status}).`);
      const session = await response.json();
      if (!session.access_token || !session.refresh_token || !session.user?.id) throw new Error("Incomplete disposable test session.");
      session.expires_at ??= Math.floor(Date.now() / 1000) + session.expires_in;
      if (!Number.isFinite(session.expires_at) || session.expires_at <= Date.now() / 1000) throw new Error("Invalid disposable test session expiry.");
      // Matches the installed Supabase client's default storage key. Tokens
      // remain in this isolated browser; no service key enters the page.
      localStorage.setItem(`sb-${new URL(url).hostname.split(".")[0]}-auth-token`, JSON.stringify(session));
      return session.user.id as string;
    }, { url, key, email, password });
    expect(id).toBe(created.data.user.id);
  }

  async connect(page: Page,path="/") {
    if(!this.contexts.includes(page.context()))this.contexts.push(page.context());
    if (process.env.MB_E2E_PROVISIONED === "1") await this.provision(page);
    page.on("response", response => {
      if (response.request().method() !== "POST" || !response.ok()) return;
      if (response.headers()["x-memory-box-e2e-synthetic"] === "1") return;
      const path = new URL(response.url()).pathname;
      if (!["/api/memories", "/api/uploads", "/api/paint"].includes(path)) return;
      const actor = this.knownActors.get(page);
      const clientId = path === "/api/paint" ? response.request().postDataJSON()?.opId : undefined;
      const operation = (async () => {
        // Reload can destroy the page execution context and response body as
        // soon as the UI accepts a save. Reconcile paint by the exact owned
        // actor/client receipt, captured before any asynchronous browser read.
        if (path === "/api/paint" && actor && typeof clientId === "string") {
          const committed = await this.db.from("paint_operations").select("id")
            .eq("actor_id", actor).eq("client_id", clientId).single();
          if (committed.error || !committed.data) throw new Error("Could not track the exact owned paint receipt.");
          this.operations.set(committed.data.id, actor);
          this.ledger(false);
          return;
        }
        const value = await response.json();
        if (path === "/api/memories") this.memories.set(value.id, value.authorId);
        if (path === "/api/uploads") this.assets.add(value.assetId);
        if (path === "/api/paint") {
          const actor = await this.actor(page);
          this.operations.set(value.operationId, actor);
        }
        this.ledger(false);
      })();
      void operation.catch(() => {}); // allSettled below reports it after safe cleanup.
      this.pending.push(operation);
    });
    await page.goto(path);
    try {
      await expect(page.getByRole("region", { name: "The shared Memory Box world" })).toBeVisible();
      await expect(page.locator(".connection-state")).toHaveText("Live", { timeout: 30_000 });
    } finally {
      // A UI/realtime failure can happen after guest creation; still retain its
      // exact identity for teardown instead of losing it with the assertion.
      try { this.actors.add(await this.actor(page)); } catch { /* No completed guest session. */ }
      this.ledger(false);
    }
  }

  async actor(page: Page) {
    const id = await page.evaluate(() => {
      const key = Object.keys(localStorage).find(key => /^sb-.+-auth-token$/.test(key));
      const id = key && JSON.parse(localStorage.getItem(key) || "null")?.user?.id;
      if (typeof id !== "string") throw new Error("The disposable guest identity is unavailable.");
      return id;
    });
    this.knownActors.set(page, id);
    return id;
  }

  async visitor(browser: Browser, baseURL: string, reference: Page, beforeConnect?: (page: Page) => void) {
    const mobile = this.info.project.name === "mobile";
    const context = await browser.newContext({ baseURL, viewport: reference.viewportSize(),
      isMobile: mobile, hasTouch: mobile, reducedMotion: "reduce" });
    this.contexts.push(context);
    const page = await context.newPage();
    beforeConnect?.(page);
    await this.connect(page);
    return page;
  }

  async snapshot(page: Page): Promise<WorldSnapshot> {
    return page.evaluate(async () => {
      const response = await fetch("/api/world", { cache: "no-store" });
      if (!response.ok) throw new Error("World snapshot failed.");
      return response.json();
    });
  }

  async cleanup() {
    const failures: string[] = [];
    const check = (error: unknown, step: string) => { if (error) failures.push(step); };
    const tracked = await Promise.allSettled(this.pending);
    if (tracked.some(result => result.status === "rejected")) failures.push("track application response");
    // Stop every owned browser (including the primary page) before revoking
    // identities. Otherwise a background paint-turn poll can recreate a
    // profile while Auth cascades its parent away during teardown.
    const closed=await Promise.allSettled(this.contexts.map(context=>context.close()));
    if(closed.some(result=>result.status==="rejected"))failures.push("stop owned browsers before revocation");
    this.contexts=[];
    const paintIds = new Set(this.operations.keys());
    // Read actual committed before-cells, not a pre-request screenshot that can
    // race another visitor. Include undo revisions: undoing B may reveal A's
    // already-undone pixel. Restore only coordinates and revisions owned by this
    // run, with a second revision predicate protecting a concurrent later edit.
    if (this.actors.size && this.operations.size) {
      const owned = await this.db.from("paint_operations").select("id,revision,before_cells")
        .in("actor_id", [...this.actors]).order("revision");
      check(owned.error, "read committed own paint");
      const revisions = new Set<number>();
      const baselines = new Map<string, { x: number; y: number; color: string; operationId: string | null }>();
      for (const operation of owned.data || []) {
        paintIds.add(operation.id);
        revisions.add(operation.revision);
        if (!this.operations.has(operation.id)) continue;
        for (const cell of operation.before_cells) {
          const key = `${cell.x},${cell.y}`;
          if (!baselines.has(key)) baselines.set(key, cell);
        }
      }
      for (const before of baselines.values()) {
        const current = await this.db.from("cells").select("updated_revision")
          .eq("world_id", "commons").eq("x", before.x).eq("y", before.y).maybeSingle();
        check(current.error, "inspect exact fixture pixel");
        if (!current.data || !revisions.has(current.data.updated_revision)) { this.cleanupCounts.pixelsPreserved++; continue; }
        // An absent pixel is represented by this color/null pair in the paint
        // RPC. Removing its sparse row restores the same world state.
        const change = before.operationId == null && before.color === "#FFFFFF"
          ? this.db.from("cells").delete({ count: "exact" })
          : this.db.from("cells").update({ color: before.color, operation_id: before.operationId }, { count: "exact" });
        const restored = await change.eq("world_id", "commons").eq("x", before.x).eq("y", before.y)
          .eq("updated_revision", current.data.updated_revision);
        check(restored.error, "restore exact fixture pixel");
        this.cleanupCounts.pixelsRestored += restored.count ?? 0;
        if (!restored.error && restored.count === 0) this.cleanupCounts.pixelsPreserved++;
      }
    }
    // Reverse creation order removes our children before their originals.
    for (const [id, actor] of [...this.memories].reverse()) {
      const result = await this.db.rpc("mb_delete_memory", { p_actor: actor, p_id: id });
      check(result.error, "withdraw own memory");
    }
    for (const id of this.assets) {
      const asset = await this.db.from("assets").select("path,staging_path,status").eq("id", id).maybeSingle();
      check(asset.error, "inspect own asset");
      // Publication has been withdrawn above. Do not remove an asset whose
      // deletion failed or which still protects another current original.
      if (asset.data?.status !== "deleted") { failures.push("asset was not withdrawn"); continue; }
      if (asset.data.path) check((await this.db.storage.from("memory-assets").remove([asset.data.path])).error, "remove own raster");
      if (asset.data.staging_path) check((await this.db.storage.from("memory-staging").remove([asset.data.staging_path])).error, "remove own staging");
    }
    // Remove only this run's visible test activity. Keep operation diffs and
    // withdrawn-source tombstones: another person's undo/lineage can need them.
    if (paintIds.size) {
      const removed = await this.db.from("world_events").delete({ count: "exact" }).in("operation_id", [...paintIds]);
      check(removed.error, "remove exact own paint events");
      this.cleanupCounts.publicEventsRemoved += removed.count ?? 0;
    }
    if (this.memories.size) {
      const removed = await this.db.from("world_events").delete({ count: "exact" }).in("memory_id", [...this.memories.keys()]);
      check(removed.error, "remove exact own memory events");
      this.cleanupCounts.publicEventsRemoved += removed.count ?? 0;
    }
    if (paintIds.size || this.memories.size) {
      let world = await this.db.from("worlds").select("revision,public_epoch").eq("id", "commons").single();
      check(world.error, "read cleanup revision");
      // Direct fixture restoration must invalidate revision-checked public
      // pixel reuse too. CAS preserves any intervening real contributor's
      // revision rather than writing an older counter over it.
      if(this.cleanupCounts.pixelsRestored>0&&world.data){
        let advanced=false;
        for(let attempt=0;attempt<5&&world.data;attempt++){
          const next=await this.db.from("worlds").update({revision:world.data.revision+1}).eq("id","commons").eq("revision",world.data.revision).select("revision,public_epoch").maybeSingle();
          if(next.error){check(next.error,"advance restored pixel revision");break;}
          if(next.data){world={...world,data:next.data};advanced=true;break;}
          world=await this.db.from("worlds").select("revision,public_epoch").eq("id","commons").single();
          if(world.error){check(world.error,"reread cleanup revision");break;}
        }
        if(!advanced)failures.push("fence restored pixel revision");
      }
      if (world.data) {
        const notice = await this.db.channel("world:commons", { config: { private: true } }).httpSend("changed", {
          revision: world.data.revision, epoch: world.data.public_epoch, kind: "resync",
        });
        check(!notice.success, "notify exact resource cleanup");
      }
    }
    for (const actor of this.actors) {
      check((await this.db.from("rate_budgets").delete().eq("actor_id", actor)).error, "remove own guest budget");
      check((await this.db.auth.admin.deleteUser(actor)).error, "remove own guest identity");
    }
    this.ledger(!failures.length);
    expect(failures, `Cleanup incomplete; recover exact IDs from ${this.ledgerPath}`).toEqual([]);
  }
}

export async function readMemory(page: Page, memory: Pick<Memory, "title">) {
  await page.getByRole("button", { name: "Browse", exact: true }).click();
  await page.locator(".context-panel .memory-result").filter({ hasText: memory.title }).click();
  await expect(page.locator(".original-title")).toHaveText(memory.title);
}

export async function cameraState(page: Page) {
  return page.getByRole("region", { name: "The shared Memory Box world" }).evaluate(element => {
    const read = (attribute: string) => {
      const value = element.getAttribute(attribute);
      if (value === null || !Number.isFinite(Number(value))) throw new Error(`Missing or invalid ${attribute}.`);
      return Number(value);
    };
    return { x: read("data-camera-x"), y: read("data-camera-y"), zoom: read("data-camera-zoom") };
  });
}

/** Phone controls are disclosed on demand; desktop controls stay in place. */
export async function openViewTools(page:Page){
  const toggle=page.getByRole("button",{name:"View controls",exact:true});
  if(await toggle.isVisible()&&await toggle.getAttribute("aria-expanded")==="false")await toggle.click();
}
