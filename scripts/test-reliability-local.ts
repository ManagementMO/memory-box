import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Task-owned local Postgres compatibility lab only. No env loading, remote URL,
// auth creation API, provider call or committed fixture/migration is permitted.
const dir = resolve("../work");
const actor = "00000000-0000-4000-8000-000000000921";
const migration = readFileSync("supabase/migrations/20261022092100_index_lease_fencing.sql", "utf8");
const stagingMigration = readFileSync("supabase/migrations/20261022092000_retry_ready_asset_staging.sql", "utf8");
// This existing lab models vector storage with a double[] domain; it does not
// test pgvector distance behavior. The lease/provenance SQL itself is unchanged.
const localMigration = migration.replaceAll("extensions.vector(1536)", "extensions.vector");
const sql = `begin;
${stagingMigration}
${localMigration}
insert into auth.users(id) values('${actor}');
select set_config('memory_box.test_actor','${actor}',true);
${readFileSync("supabase/tests/ready-staging-cleanup.sql", "utf8")}
${readFileSync("supabase/tests/index-lease-fencing.sql", "utf8")}
rollback;
`;
const file = resolve(dir, "reliability-local.sql");
writeFileSync(file, sql);
const args = ["-X", "-qAt", "-h", dir, "-p", "55437", "-U", "memory_box_test", "-d", "postgres", "-v", "ON_ERROR_STOP=1"];
const output = execFileSync("psql", [...args, "-f", file], { encoding: "utf8", maxBuffer: 200_000 });
writeFileSync(resolve(dir, "reliability-local.log"), output);
assert.match(output, /PASS: ready staging expiry/);
assert.match(output, /PASS: fenced attempts/);
const remaining = execFileSync("psql", [...args, "-c", `select count(*) from auth.users where id='${actor}';`], { encoding: "utf8" }).trim();
assert.equal(remaining, "0", "local actor and all fixtures rolled back");
const schemaChanges = execFileSync("psql", [...args, "-c", "select count(*) from information_schema.columns where table_schema='public' and ((table_name='memory_embeddings' and column_name='image_description') or (table_name='assets' and column_name='staging_cleanup_token'));"], { encoding: "utf8" }).trim();
assert.equal(schemaChanges, "0", "both additive schema changes rolled back");
console.log("PASS: local Postgres staging cleanup and index lease/provenance regressions; both migrations and fixtures rolled back. Vector distance and hosted services were not tested.");
