import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  adminClient, applyPaint, createMemory, deleteMemory, getSnapshot,
  getProfile, undoPaint, updateMemory, searchMemories, completeIndexJob,
  createAsset, markAssetReady, getReadableAsset,
} from "../src/lib/server/database";

// Real database tests: no in-memory repository or mocked Supabase responses.
// This script deliberately fails when infrastructure isn't configured.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
async function main() {
  const db = adminClient();
  const users: string[] = [];
  const memories: string[] = [];
  const assets: string[] = [];
  const operations: { id: string; revision: number }[] = [];
  const runId = randomUUID();
  const ledgerPath = resolve("..", "work", `db-test-${runId}.json`);
  mkdirSync(resolve("..", "work"), { recursive: true });
  const { data: beforeCells, error: beforeError } = await db.from("cells").select("*").eq("world_id", "commons").eq("y", 116).in("x", [194, 195]);
  assert.ifError(beforeError);
  const ledger = (cleaned = false) => writeFileSync(ledgerPath, JSON.stringify({ runId, users, memories, assets, operations, beforeCells, cleaned }, null, 2));
  ledger();
  try {
    const publicDb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const publicRead = await publicDb.from("cells").select("x,y,color").limit(1);
    assert.ifError(publicRead.error);
    assert.ok((await publicDb.from("cells").insert({ world_id: "commons", x: 0, y: 0, color: "#000000", updated_revision: 0 })).error, "browser key cannot write cells directly");
    assert.ok((await publicDb.from("memories").select("request_hash").limit(1)).error, "request hashes are not browser-readable");
    for (let i = 0; i < 2; i++) {
      const password = randomUUID() + randomUUID();
      const { data, error } = await db.auth.admin.createUser({
        email: `memory-box-db-${randomUUID()}@example.invalid`,
        password, email_confirm: true,
      });
      assert.ifError(error);
      assert.ok(data.user);
      users.push(data.user.id);
      ledger();
      await getProfile(data.user.id);
      if (i === 0) {
        assert.ifError((await publicDb.auth.signInWithPassword({ email: data.user.email!, password })).error);
        assert.ok((await publicDb.rpc("mb_apply_paint", { p_actor: data.user.id, p_client_id: randomUUID(), p_cells: [{ x: 194, y: 116, color: "#3158ED" }], p_scene_id: "garden" })).error, "even an authenticated guest cannot invoke service-only mutations");
      }
    }
    const [alice, bob] = users;
    const initial = await getSnapshot();
    assert.equal(initial.width, 1200);
    assert.equal(initial.height, 720);
    assert.equal(initial.gridSize, 6);

    const opId = randomUUID();
    const first = await applyPaint(alice, opId, [
      { x: 194, y: 116, color: "#C55D4A" },
      { x: 195, y: 116, color: "#C55D4A" },
    ], "garden");
    assert.ok(first.status === "accepted", "first forward paint starts an authoritative turn");
    operations.push({ id: first.operationId, revision: first.revision }); ledger();
    const duplicate = await applyPaint(alice, opId, [
      { x: 194, y: 116, color: "#C55D4A" },
      { x: 195, y: 116, color: "#C55D4A" },
    ], "garden");
    assert.ok(duplicate.status === "accepted", "same-operation replay succeeds while cooling");
    assert.equal(duplicate.operationId, first.operationId, "retry must return the existing operation");
    assert.equal(duplicate.revision, first.revision, "retry must not advance revision");
    await assert.rejects(() => applyPaint(alice, opId, [{ x: 194, y: 116, color: "#3158ED" }], "garden"));
    await assert.rejects(() => applyPaint(alice, randomUUID(), [{ x: 10000, y: 0, color: "#3158ED" }], "garden"));
    await assert.rejects(() => applyPaint(alice, randomUUID(), [{ x: 1, y: 1, color: "url(javascript:bad)" }], "garden"));

    const second = await applyPaint(bob, randomUUID(), [{ x: 194, y: 116, color: "#3158ED" }], "garden");
    assert.ok(second.status === "accepted", "another actor has an independent turn");
    operations.push({ id: second.operationId, revision: second.revision }); ledger();
    assert.ok(second.revision > first.revision);
    const undone = await undoPaint(alice, first.operationId);
    operations.push({ id: undone.operationId, revision: undone.revision }); ledger();
    assert.equal(undone.restored, 1, "undo must restore the untouched cell");
    assert.equal(undone.skipped, 1, "undo must preserve Bob's later edit");
    const afterUndo = await getSnapshot();
    assert.equal(afterUndo.pixels.find(p => p.x === 194 && p.y === 116)?.color, "#3158ED");

    const text = await createMemory(alice, {
      clientId: randomUUID(), type: "text", title: "Integration lighthouse memory",
      body: "A lighthouse picnic with my sister and the sea wind.",
      color: "#F5D77D", x: 1120, y: 660, sceneId: "garden", paintOperationId: first.operationId,
    });
    memories.push(text.id);
    ledger();
    assert.equal(text.authorId, alice);
    const retry = await createMemory(alice, {
      clientId: randomUUID(), type: "text", title: "Integration response",
      body: "This made me remember another afternoon by the ocean.",
      color: "#D8C8EC", x: 1110, y: 640, sceneId: "garden", inspiredBy: text.id,
    });
    memories.push(retry.id);
    ledger();
    assert.equal(retry.inspiredBy, text.id);
    await assert.rejects(() => updateMemory(bob, text.id, text.version, { body: "stolen" }));
    await assert.rejects(() => deleteMemory(bob, text.id));
    const fixtureAsset = await createAsset(alice, { name: `db-test-${runId}.png`, mime: "image/png", size: 256 });
    assets.push(fixtureAsset.id); ledger();
    await assert.rejects(() => markAssetReady(bob, fixtureAsset.id, { path: `${bob}/bad.webp`, mime: "image/webp", width: 8, height: 8, size: 256 }));
    await markAssetReady(alice, fixtureAsset.id, { path: `${alice}/${fixtureAsset.id}.webp`, mime: "image/webp", width: 8, height: 8, size: 256 });
    assert.equal(await getReadableAsset(fixtureAsset.id), null, "an unattached upload remains private");
    assert.equal(await getReadableAsset(fixtureAsset.id, bob), null, "another guest cannot read an unattached upload");
    assert.equal((await getReadableAsset(fixtureAsset.id, alice))?.id, fixtureAsset.id);

    // Deliberate test vectors verify SQL namespace and relevance gates, not model quality.
    const basis = Array.from({ length: 1536 }, (_, i) => i === 0 ? 1 : 0);
    const orthogonal = Array.from({ length: 1536 }, (_, i) => i === 1 ? 1 : 0);
    const fixtureNamespace = `test/${runId}`;
    const { data: job, error: jobError } = await db.from("index_jobs").select("id").eq("memory_id", text.id).eq("source_version", text.version).single();
    assert.ifError(jobError); assert.ok(job);
    assert.ifError((await db.from("index_jobs").update({ status: "processing" }).eq("id", job.id)).error);
    assert.equal(await completeIndexJob(job.id, text.version, text.body, basis, fixtureNamespace), true);
    assert.ok((await searchMemories("xyzzynonword", basis, "garden", 12, fixtureNamespace)).results.some(r => r.memory.id === text.id));
    assert.ok(!(await searchMemories("xyzzynonword", orthogonal, "garden", 12, fixtureNamespace)).results.some(r => r.memory.id === text.id), "low cosine similarity is not retrieved");
    assert.ok(!(await searchMemories("xyzzynonword", basis, "garden", 12, "other/namespace")).results.some(r => r.memory.id === text.id), "embedding model namespaces cannot mix");
    const changed = await updateMemory(alice, text.id, text.version, { body: "A lighthouse picnic with my sister, wind, and marmalade." });
    assert.equal(changed.version, text.version + 1);
    assert.equal(await completeIndexJob(job.id, text.version, "stale old text", basis, fixtureNamespace), false, "a stale index job cannot republish an old version");
    const conflictStarted = performance.now();
    await assert.rejects(() => updateMemory(alice, text.id, text.version, { body: "stale overwrite" }), (error: unknown) => error instanceof Error && "code" in error && error.code === "PT409");
    assert.ok(performance.now() - conflictStarted < 10_000, "application version conflicts return promptly rather than retry as serialization failures");
    const found = await searchMemories("marmalade lighthouse", null, "garden");
    assert.ok(found.results.some(r => r.memory.id === text.id), "new authored words must be lexically searchable");
    await deleteMemory(alice, text.id);
    const removed = await searchMemories("marmalade lighthouse", null, "garden");
    assert.ok(!removed.results.some(r => r.memory.id === text.id), "deleted source must disappear immediately");
    const final = await getSnapshot();
    assert.ok(!final.memories.some(m => m.id === text.id));
    assert.ok(final.memories.some(m => m.id === retry.id && m.inspiredBy === text.id), "response identity remains stable when original is removed");
    console.log("PASS: real database browser write denial, idempotency, validation, ordering, partial undo, ownership, asset privacy, model namespaces, semantic cutoff, stale indexing, version conflicts, inspired-by persistence, lexical freshness, and deletion filtering");
  } finally {
    // Restore only cells still carrying one of this run's revisions. A later visitor
    // edit is never overwritten. Every identifier was recorded before the next step.
    for (const x of [194, 195]) {
      const { data: cell, error } = await db.from("cells").select("*").eq("world_id", "commons").eq("x", x).eq("y", 116).maybeSingle();
      assert.ifError(error);
      if (!cell || !operations.some(o => o.revision === cell.updated_revision)) continue;
      const before = beforeCells?.find(c => c.x === x);
      const filter = before ? db.from("cells").update({ color: before.color, operation_id: before.operation_id, updated_revision: before.updated_revision }) : db.from("cells").delete();
      assert.ifError((await filter.eq("world_id", "commons").eq("x", x).eq("y", 116).eq("updated_revision", cell.updated_revision)).error);
    }
    if (memories.length) {
      assert.ifError((await db.from("world_events").delete().in("memory_id", memories)).error);
      assert.ifError((await db.from("memories").update({ inspired_by: null }).in("id", memories)).error);
      assert.ifError((await db.from("memories").delete().in("id", memories)).error);
    }
    if (assets.length) assert.ifError((await db.from("assets").delete().in("id", assets)).error);
    if (operations.length) {
      const ids = operations.map(o => o.id);
      assert.ifError((await db.from("world_events").delete().in("operation_id", ids)).error);
      assert.ifError((await db.from("paint_operations").update({ undone_by: null }).in("id", ids)).error);
      assert.ifError((await db.from("paint_operations").delete().in("id", ids)).error);
    }
    for (const id of users) {
      assert.ifError((await db.from("rate_budgets").delete().eq("actor_id", id)).error);
      assert.ifError((await db.auth.admin.deleteUser(id)).error);
    }
    ledger(true);
    // A metadata notice causes connected clients to reload the authoritative snapshot.
    const snapshot = await getSnapshot();
    await db.channel("world:commons", { config: { private: true } }).httpSend("changed", { revision: snapshot.revision, epoch: snapshot.epoch, kind: "resync" });
    console.log("CLEAN: this run's exact fixture records and untouched fixture cells were removed; later visitor edits preserved");
  }
}

main().catch(error => { console.error(error instanceof Error ? error.message : "Database tests failed"); process.exitCode = 1; });
