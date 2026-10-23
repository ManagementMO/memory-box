# Three database errors: causes and verification

The three generic errors from the PR15 browser run were recovered in the historical Postgres logs. At 2026-10-23 01:35:22 UTC, two `mb_snapshot()` statements exceeded the database statement timeout. At 01:36:38 UTC, a background `mb_paint_turn()` request attempted to recreate a profile after Auth deletion had cascaded its parent away. That actor belongs to the mobile pending-answer test, whose teardown completed at the same time. Deliberate NOT_OWNER and blank-invitation rejections are separate asserted negative cases.

## Snapshot work

Every snapshot read previously rebuilt the JSON for all 17,643 stored pixels. Historical statement statistics showed 10,662 calls, 203.57ms mean execution and 7909.64ms maximum, against an inherited 8-second statement limit. A live expanded EXPLAIN measured 266.38ms overall, including 197.251ms in pixel aggregation. Existing visible-memory and recent-event indexes were in use; an arbitrary new index would not remove repeated full-pixel serialization.

`mb_snapshot_head()` now returns fresh public originals, events and world version without the pixel array. `getSnapshot()` reads this on every call, then reuses a per-instance pixel result only when its world/epoch/revision satisfies that caller's observed version. One full serialization is in flight at a time. An older in-flight load cannot answer a reader that arrived after a mutation; rejected loads release their slot, and a failed metadata read never serves cached content. Same-revision metadata changes, such as index failure, remain fresh. Results are cloned to prevent one consumer mutating another's response. Pixel reuse expires after 60 seconds as an additional bound.

The existing full `mb_snapshot()` and HTTP wire format remain available. Only the new head RPC is added, with execution granted to `service_role` and revoked from public/anon/authenticated. No client, visual component, CSS, font, artwork or position changes are part of this fix. Clients still receive full snapshots: this is not tiled delivery or a population-scale performance claim.

In an actual eight-reader probe (two batches of four), full snapshot RPC calls fell from eight to one; the updated path made eight fresh metadata reads. Timing samples are recorded locally rather than presented as a controlled latency benchmark.

## Account lifetime

`mb_profile()` previously performed INSERT ON CONFLICT on every call. An in-flight browser poll could outlive fixture cleanup: Auth deletion removed the user, and the paint-turn RPC then tried to insert its profile again.

The invoker function now reads an existing profile without an unnecessary insert. If deletion won first, only the exact `profiles_id_fkey` condition becomes AUTH_REQUIRED/PT401, which the HTTP layer returns as an invalid session. A disappearing profile during rename is rejected as well. The legacy exact constraint is also recognized during deployment transitions; unrelated integrity failures remain server errors. No SELECT on `auth.users`, SECURITY DEFINER, new Auth grants, or relaxed foreign key is introduced.

The final function deliberately avoids holding a child profile lock: Auth deletion locks the parent first, while a contribution subsequently checks that parent through its ownership foreign key. Review caught that a child-only KEY SHARE in the initial migration could invert that order. The corrective migration removes it without rewriting applied migration history. A deterministic local two-session regression executes the actual migrated profile function, concurrent Auth deletion and an asset ownership insert. It fails with a real 40P01 deadlock against the initial migration and passes against the final function; deletion completes and the foreign key rejects the deleted actor's asset. The disposable Postgres cluster uses a private Unix socket and is removed afterward. Run it with `node supabase/tests/profile-revocation-concurrency.mjs` and local PostgreSQL binaries (`PG_BIN` can select their directory).

A rollback-only hosted SQL regression reproduces the original 23503 failure and verifies the final invalid-session result, metadata equivalence and RPC privileges. These checks establish expected revocation handling, not transaction-wide lifetime guarantees for every contribution RPC.

The browser fixture now closes all its contexts, including the primary page, before deleting identities. Direct fixture pixel restoration advances the world revision with a compare-and-swap before resync notification, preserving revision-checked readers and concurrent contributors' revision increments.

## Diagnostics and release gates

Unexpected database errors retain bounded operation and SQLSTATE fields in server diagnostics. Messages, SQL, arguments, request headers, identities and credentials are excluded. Recognized revocation is an authentication outcome; unrelated database errors are not silenced or relabeled.

Focused HTTP/cache regressions pass, and the complete unit suite passes 379 tests. The migration passed its rollback test before application and its SQL lifecycle test after application. Database advisors show the same two pre-existing anonymous-admission/password-protection warnings, with no new findings. The concurrency regression also runs in CI using an isolated local Postgres cluster, without hosted credentials.

Two desktop/mobile runs each passed 45/46 and exposed separate test timing assumptions: the map keyboard test raced the preview's scheduled focus restoration, and a 320px check sampled bounds before resized layout settled. Tests now wait for those existing behaviors; the same focus and onscreen-bounds requirements remain. The mobile resize scenario passed three targeted repetitions. No production UI change is involved. Final desktop/mobile, exact-head CI and deployment checks are recorded with the release PR.
