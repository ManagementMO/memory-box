import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { adminClient, type IndexJob } from "../src/lib/server/database";
import { processLeasedIndexJobs } from "../src/lib/server/indexing";
import { POPPY_MEMORIES, POPPY_SEED_MARKER } from "../src/lib/poppy-world";
import { poppySeedHash } from "./seed-poppy-world";

const EXPECTED_COUNT = 6;
const BUDGET_ACTOR = "00000000-0000-0000-0000-000000000000";
const BUDGET_KIND = "poppy_seed_index";
const ids = POPPY_MEMORIES.map(memory => memory.id);
const allowed = new Set(ids);
const hash = poppySeedHash();
class OperatorError extends Error {}
type SeedRow = { id: string; world_id: string; is_seed: true; author_id: null; visibility: "published"; client_id: string; request_hash: string; index_status: "pending" | "ready" | "failed"; version: number };

export function validatePoppySeedRows(rows: unknown): SeedRow[] {
  if (ids.length !== EXPECTED_COUNT || allowed.size !== EXPECTED_COUNT || !Array.isArray(rows) || rows.length !== EXPECTED_COUNT) throw new OperatorError("seed_source_mismatch");
  const seen = new Set<string>();
  for (const item of rows) {
    if (!item || typeof item !== "object") throw new OperatorError("seed_source_mismatch");
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string" || !allowed.has(row.id) || seen.has(row.id)
      || row.world_id !== "commons" || row.is_seed !== true || row.author_id !== null || row.visibility !== "published"
      || row.client_id !== `${POPPY_SEED_MARKER}:${row.id}` || row.request_hash !== hash
      || !["pending", "ready", "failed"].includes(String(row.index_status)) || !Number.isInteger(row.version) || Number(row.version) < 1) throw new OperatorError("seed_source_mismatch");
    seen.add(row.id);
  }
  return rows as SeedRow[];
}

function validateLeases(value: unknown): IndexJob[] {
  if (!Array.isArray(value) || value.length > 4) throw new OperatorError("lease_scope_mismatch");
  const seen = new Set<string>();
  for (const job of value) {
    if (!job || typeof job !== "object" || typeof job.id !== "string" || seen.has(job.id)
      || !allowed.has(job.memory_id) || job.memory?.id !== job.memory_id
      || job.memory?.isSeed !== true || job.memory?.authorId !== null
      || !Number.isInteger(job.source_version) || job.source_version < 1 || job.memory?.version !== job.source_version) throw new OperatorError("lease_scope_mismatch");
    seen.add(job.id);
  }
  return value as IndexJob[];
}

/** Explicit, bounded operator initialization. Ordinary public indexing keeps
 * using its existing 80/day global allowance and default lease RPC. */
export async function indexPoppySeed() {
  const db = adminClient();
  const read = async () => {
    const result = await db.from("memories").select("id,world_id,is_seed,author_id,visibility,client_id,request_hash,index_status,version").in("id", ids);
    if (result.error) throw new OperatorError("seed_read_failed");
    return validatePoppySeedRows(result.data);
  };
  await read(); // Prove the exact persisted seed identity before spending a lease.
  let leased = 0, completed = 0, failed = 0;
  const batches: Array<{ leased: number; completed: number; failed: number }> = [];
  for (let batch = 0; batch < 3; batch++) {
    const response = await db.rpc("mb_lease_index_jobs_budget", {
      p_limit: 4, p_budget_actor: BUDGET_ACTOR, p_budget_kind: BUDGET_KIND,
      p_daily_limit: EXPECTED_COUNT, p_memory_ids: ids,
    });
    if (response.error) throw new OperatorError("seed_lease_failed");
    const jobs = validateLeases(response.data);
    if (leased + jobs.length > EXPECTED_COUNT) throw new OperatorError("lease_scope_mismatch");
    const result = await processLeasedIndexJobs(jobs);
    batches.push(result); leased += result.leased; completed += result.completed; failed += result.failed;
    if (!jobs.length) break;
  }
  const current = await read();
  const ready = current.filter(row => row.index_status === "ready").length;
  const pending = current.filter(row => row.index_status === "pending").length;
  const indexFailed = current.filter(row => row.index_status === "failed").length;
  return { status: ready === EXPECTED_COUNT ? "complete" : "pending", checked: EXPECTED_COUNT, leased, completed, failed, ready, pending, indexFailed, batches };
}

const help = `Memory Box Poppy starter semantic initialization

  npx tsx scripts/index-poppy-seed.ts --help
  npx tsx scripts/index-poppy-seed.ts --run

Run only after reviewing the exact Poppy seed and deploying its local assets.
--run loads the ignored .env.local configuration and validates all 6 persisted
starter identities. It uses the service-only lease RPC with an exact-ID filter
and a separate, bounded 6/day operator allowance. Public 80/day indexing limits
are unchanged. Source-version completion and ordinary retry rules stay in force.
Only aggregate counts/status are printed; keys, bodies and sessions are not.
`;
async function main(args: string[]) {
  if (!args.length || (args.length === 1 && ["--help", "-h"].includes(args[0]))) { console.log(help); return; }
  if (args.length !== 1 || args[0] !== "--run") throw new OperatorError("invalid_command_use_help");
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  console.log(JSON.stringify(await indexPoppySeed(), null, 2));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(error => {
    console.error(error instanceof OperatorError ? error.message : "poppy_seed_index_failed_check_private_configuration");
    process.exitCode = 1;
  });
}
