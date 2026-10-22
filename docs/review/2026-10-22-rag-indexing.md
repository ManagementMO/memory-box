# RAG and indexing reliability review

Review date: 22 October 2026. Scope: source evidence, leased index completion/failure, private-image indexing, and the matching database lifecycle. The approved product and visual design are unchanged. This document records local evidence and deployment requirements, not a completed hosted rollout.

## Confirmed failures and corrections

### P2: a transient image download failure permanently completed a partial index

`imageForMemory()` returned null when a private Storage download returned an error or no object. The worker then embedded only the title/body and completed the job as ready. A temporary failure therefore removed visual discovery from the normal retry path. A mocked Storage failure against the pre-fix implementation returned `{completed:1,failed:0}`.

The worker now fails that attempt and uses the existing bounded retry path. A required image that is unavailable never produces a ready text-only index. The new SQL completion function also requires a nonempty description for an image. Ordinary authored-text search remains available while indexing retries.

### P2: an old worker could poison a reclaimed lease

The former completion/failure RPCs accepted a job ID and source version but no lease generation. Source version did not distinguish two workers processing the same source after lease expiry. Reproduced in local Postgres: lease attempt 1; expire it; lease attempt 2; deliver attempt 1's delayed failure; then complete attempt 2. The delayed failure set the active job to failed, and the valid completion returned false and changed it to obsolete.

New RPCs require the monotonic `attempts` value returned by the lease function. They accept only a matching, processing, unexpired lease. Stale calls are no-ops; duplicate completion preserves completed status. Completion still checks source version and visibility, while failure uses the same world/job/memory lock order as completion and mutation. Existing attempts, global reservation limits, backoff, and maximum retry count remain unchanged.

### P2: an exact quotation could disagree with its current image source

Index workers previously wrote generated descriptions directly to shared `assets.description` before fenced completion. Concurrent jobs for originals sharing an asset could overwrite that description without changing any source version. Both server revalidation and open-answer invalidation compared versions alone.

The pre-fix regression retrieved “A red bicycle.”, then returned a current snapshot containing “A blue bicycle.” at the same ID/version. Ask still returned an answered red quotation beside the blue source. No model call was needed to reproduce the missing guard.

New workers store the description atomically with the accepted, source-version-fenced embedding in `memory_embeddings.image_description`. They do not mutate shared asset captions. Source serialization prefers that versioned description. Existing private-image descriptions retain a compatibility fallback; no historical descriptions are inferred or rewritten. Server revalidation and client invalidation also compare the source fields supplied to selection or used in attribution, including the description, words, title, author name, and recorded parent.

### Seed visual-evidence boundary

Previously, trusted seed captions could inform an embedding and search document while public source JSON exposed no caption because seeds have no asset record. Newly accepted seed indexing now uses the same versioned caption field, so its visual evidence reaches verified Ask. Existing seed indexes are not automatically reprocessed or backfilled. Their caption coverage remains an explicitly separate data-review task.

## Local verification

The focused red run had nine failures across indexing, retrieval, and client source-state tests. After the changes:

```sh
npm test -- tests/indexing.test.ts tests/retrieval.test.ts tests/source-state.test.ts tests/ai.test.ts
npm run typecheck
node --import tsx scripts/test-reliability-local.ts
```

The focused suite passed 79 tests, and TypeScript passed. The SQL runner applies both `20261022092000_retry_ready_asset_staging.sql` and `20261022092100_index_lease_fencing.sql` inside a local BEGIN/ROLLBACK, then runs both corresponding SQL fixtures. It verifies actor and added-column absence after rollback. The combined local log is `../work/reliability-local.log`.

The task-owned PostgreSQL 15 lab uses socket directory `/Users/mo/Documents/Codex/2026-10-20/hel/work`, port 55437, user `memory_box_test`, database `postgres`, and data directory `../work/world-bounds-local-pg`. Its existing vector type is a double-precision-array compatibility domain, so the runner removes only the unsupported vector dimension modifier from its local migration copy. This validates actual Postgres transaction, role, lease, and source-provenance behavior. It does not validate hosted pgvector distance calculations, production permissions, network behavior, or actual provider quality.

The staging fixture verifies three-hour raw-upload expiry, exact staging paths, token fencing, retry, canonical-image retention, and service-only access. The index fixture verifies expired/reclaimed leases, stale completion/failure, duplicate no-op, source changes, retry backoff, role grants, required captions, isolation between originals sharing an asset, legacy-caption compatibility, and seed-event provenance. No Storage API, provider request, hosted mutation, or historical reindex was performed by these checks.

## Deployment order and operational window

1. Inspect current index-job states and attempts before rollout. Drain in-flight work where practical; specifically avoid revoking completion while a fourth/final attempt is active. A denied final attempt has no automatic fifth retry.
2. Apply the additive database migrations before deploying the matching application. The index migration creates and grants the new fenced functions, then revokes the old unfenced completion/failure functions from PUBLIC, anon, authenticated, and service_role. The new functions remain security invoker and are executable only by service_role.
3. Deploy the matching worker promptly. During the short DB-first window, old workers cannot acknowledge or fail their leases. Those leases stay processing until expiry and can be reclaimed if attempts remain. Old workers can otherwise consume additional attempts if the old application is left running; this is a bounded transition window, not a permanently supported mixed-version state.
4. Verify the deployed worker uses `mb_complete_index_job_leased` / `mb_fail_index_job_leased`, that legacy execution stays denied, and that no unexpected final-attempt failures appeared. Treat any recovery/reindex as a separately scoped operator action after reviewing the exact affected IDs.

Do not restore legacy execution grants as an application-only rollback: that reintroduces the race. A rollback needs an application build compatible with the fenced RPCs or temporarily stopped indexing while the rollout is corrected. No automatic reset of attempts, index budgets, existing descriptions, or seed data is part of this migration.

The remaining quality boundaries still apply: selected excerpt relevance, authored truth, machine description accuracy, English-oriented embeddings, provisional semantic calibration, and incomplete historical seed caption coverage. Passing these regressions does not prove universal answer quality or production-scale retrieval performance.
