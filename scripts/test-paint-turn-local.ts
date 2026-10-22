import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";

// Local compatibility lab only: no .env file, cloud URL, remote credentials or
// published writes. The migration and every fixture are enclosed in a rollback.
const dir = resolve("../work");
const psql = ["-X", "-qAt", "-h", dir, "-p", "55437", "-U", "memory_box_test", "-d", "postgres", "-v", "ON_ERROR_STOP=1"];
const actor = "00000000-0000-4000-8000-000000000815";
const other = "00000000-0000-4000-8000-000000000816";
const sql = `begin;
${readFileSync("supabase/migrations/20261022040229_paint_turn_cooldown.sql", "utf8")}
insert into auth.users(id) values('${actor}'),('${other}');
select set_config('memory_box.test_actor','${actor}',true);
select set_config('memory_box.test_other_actor','${other}',true);
${readFileSync("supabase/tests/paint-turn.sql", "utf8")}
rollback;
`;
const file = resolve(dir, "paint-turn-local.sql");
writeFileSync(file, sql);
const output = execFileSync("psql", [...psql, "-f", file], { encoding: "utf8", maxBuffer: 200_000 });
writeFileSync(resolve(dir, "paint-turn-local.log"), output);
assert.match(output, /PASS: authoritative paint turns/);
const remaining = execFileSync("psql", [...psql, "-c", `select count(*) from auth.users where id in ('${actor}','${other}');`], { encoding: "utf8" }).trim();
assert.equal(remaining, "0", "local authors rolled back");
console.log("PASS: actual local Postgres migration and turn SQL regression; fixture and schema changes rolled back. No hosted mutation occurred.");

const boundsSql = `begin;
${readFileSync("supabase/migrations/20261022040229_paint_turn_cooldown.sql", "utf8")}
insert into auth.users(id) values('${actor}'),('${other}');
select set_config('memory_box.test_actor','${actor}',true);
select set_config('memory_box.test_other_actor','${other}',true);
${readFileSync("supabase/tests/world-bounds.sql", "utf8")}
rollback;
`;
const boundsFile = resolve(dir, "paint-turn-world-bounds-local.sql");
writeFileSync(boundsFile, boundsSql);
const boundsOutput = execFileSync("psql", [...psql, "-f", boundsFile], { encoding: "utf8", maxBuffer: 200_000 });
writeFileSync(resolve(dir, "paint-turn-world-bounds-local.log"), boundsOutput);
assert.match(boundsOutput, /PASS: sparse signed world/);
console.log("PASS: existing signed-world/partial-undo/source/moderation SQL suite with the turn migration; all rolled back.");

async function concurrentProof() {
  const run = randomUUID().replaceAll("-", "").slice(0, 16);
  const database = `paint_turn_${run}`;
  const args = psql.map((value, index) => psql[index - 1] === "-d" ? database : value);
  const baseQuery = (statement: string) => execFileSync("psql", [...psql, "-c", statement], { encoding: "utf8" }).trim();
  const localQuery = (statement: string) => execFileSync("psql", [...args, "-c", statement], { encoding: "utf8" }).trim();
  const execute = promisify(execFile);
  let created = false;
  try {
    // Clone only this task-owned local compatibility database. An isolated copy
    // lets two real transactions commit while the original lab stays unchanged.
    baseQuery(`create database ${database} template postgres;`); created = true;
    localQuery(readFileSync("supabase/migrations/20261022040229_paint_turn_cooldown.sql", "utf8"));
    localQuery(`insert into auth.users(id) values('${actor}');`);
    const forward = (id: string) => `select public.mb_apply_paint('${actor}','${id}','[{"x":-9988,"y":-9988,"color":"#BDA9E9"}]','pond');`;
    const answers = await Promise.all([
      execute("psql", [...args, "-c", forward(randomUUID())], { encoding: "utf8", timeout: 15_000 }),
      execute("psql", [...args, "-c", forward(randomUUID())], { encoding: "utf8", timeout: 15_000 }),
    ]);
    const results = answers.map(answer => JSON.parse(answer.stdout.trim()));
    assert.equal(results.filter(result => result.status === "accepted").length, 1, "only one concurrent request accepts the shared actor's turn");
    assert.equal(results.filter(result => result.status === "cooldown").length, 1, "the other request observes the committed next-paint time");
    assert.equal(localQuery(`select count(*) from public.paint_operations where actor_id='${actor}';`), "1", "concurrent denial has no receipt");
    writeFileSync(resolve(dir, "paint-turn-local-concurrency.json"), JSON.stringify({ accepted: 1, cooldown: 1, localOnly: true, operationCount: 1 }, null, 2));
    console.log("PASS: two concurrent real local Postgres requests accepted one forward turn and denied the other.");
  } finally {
    if (created) baseQuery(`drop database ${database};`);
  }
}
concurrentProof().catch(() => {
  console.error("Local paint-turn concurrency proof failed; inspect the local compatibility lab. No hosted connection was used.");
  process.exitCode = 1;
});
