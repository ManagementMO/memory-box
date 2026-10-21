import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { adminClient, getProfile } from "../src/lib/server/database";

// Linked-project test only after the forward migration is approved and applied.
// No image bytes, model requests, permanent contributions, or global AI budget use.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const exec = promisify(execFile);
async function main() {
  const db = adminClient(), run = randomUUID(), actors: string[] = [];
  mkdirSync(resolve("..", "work"), { recursive: true });
  const ledger = resolve("..", "work", `db-world-bounds-${run}.json`);
  try {
    for (let i=0;i<2;i++) {
      const created=await db.auth.admin.createUser({email:`memory-box-bounds-${run}-${i}@example.invalid`,password:randomUUID()+randomUUID(),email_confirm:true});
      assert.ifError(created.error); assert.ok(created.data.user);
      actors.push(created.data.user.id);
      writeFileSync(ledger,JSON.stringify({run,actors,cleaned:false}));
      await getProfile(created.data.user.id);
    }
    const sql=`begin;\nselect set_config('memory_box.test_actor','${actors[0]}',true);\nselect set_config('memory_box.test_other_actor','${actors[1]}',true);\n${readFileSync("supabase/tests/world-bounds.sql","utf8")}\nrollback;\n`;
    const file=resolve("..","work",`db-world-bounds-${run}.sql`);
    writeFileSync(file,sql);
    const result=await exec("supabase",["db","query","--linked","--file",file],{cwd:process.cwd(),timeout:45_000,maxBuffer:200_000});
    assert.match(result.stdout,/PASS: sparse signed world/);
    console.log("PASS: rollback-only real-DB signed world suite; no inference or Storage objects");
  } finally {
    const cleanupErrors: unknown[]=[];
    for (const actor of actors) {
      try {
        assert.ifError((await db.from("rate_budgets").delete().eq("actor_id",actor)).error);
        assert.ifError((await db.auth.admin.deleteUser(actor)).error);
      } catch(error) {cleanupErrors.push(error);}
    }
    writeFileSync(ledger,JSON.stringify({run,actors,cleaned:cleanupErrors.length===0}));
    assert.equal(cleanupErrors.length,0,"Disposable authors require cleanup; inspect exact-ID ledger.");
    console.log("CLEAN: disposable authors removed; all SQL fixture state rolled back");
  }
}
main().catch(()=>{console.error("Signed world DB test failed; inspect the exact-ID ledger and local SQL file in ../work. Credentials were not printed.");process.exitCode=1;});
