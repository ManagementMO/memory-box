import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { adminClient, getProfile } from "../src/lib/server/database";

// Uses the linked project's Management API via the CLI, with a rollback-only SQL
// transaction and one disposable Auth actor. No model or Storage calls occur.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const exec = promisify(execFile);
async function main() {
  const db = adminClient();
  const run = randomUUID();
  mkdirSync(resolve("..", "work"), { recursive: true });
  const ledger = resolve("..", "work", `db-lifecycle-${run}.json`);
  let actor: string | undefined;
  try {
    const created = await db.auth.admin.createUser({ email: `memory-box-lifecycle-${run}@example.invalid`, password: randomUUID() + randomUUID(), email_confirm: true });
    assert.ifError(created.error); assert.ok(created.data.user);
    actor = created.data.user.id;
    writeFileSync(ledger, JSON.stringify({ run, actor, cleaned: false }));
    await getProfile(actor);
    const sql = `begin;\nselect set_config('memory_box.test_actor','${actor}',true);\n${readFileSync("supabase/tests/lifecycle.sql", "utf8")}\nrollback;\n`;
    const file = resolve("..", "work", `db-lifecycle-${run}.sql`);
    writeFileSync(file, sql);
    const result = await exec("supabase", ["db", "query", "--linked", "--file", file], { cwd: process.cwd(), timeout: 45_000, maxBuffer: 200_000 });
    assert.match(result.stdout, /PASS: isolated real-DB/);
    console.log("PASS: rollback-only live SQL lifecycle suite; no production indexing allowance was consumed");
  } finally {
    if (actor) {
      assert.ifError((await db.from("rate_budgets").delete().eq("actor_id", actor)).error);
      assert.ifError((await db.auth.admin.deleteUser(actor)).error);
      writeFileSync(ledger, JSON.stringify({ run, actor, cleaned: true }));
      console.log("CLEAN: disposable lifecycle actor removed; all SQL fixture state rolled back");
    }
  }
}
main().catch(() => { console.error("Database lifecycle test failed; inspect the local SQL fixture and exact-ID ledger in ../work. Credentials were not printed."); process.exitCode = 1; });
