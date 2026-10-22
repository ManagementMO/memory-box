# Reliability and code review — 22 October 2026

Reviewed the publication and image lifecycle, ownership and API boundaries, index leases and answer evidence, browser connection lifecycle, canvas rendering, and desktop/mobile contribution flows. Fixes target reproduced failures and measured redundant work; the approved visual design is preserved.

## Corrected behavior

| Area | Failure | Correction |
| --- | --- | --- |
| Publishing/editing | Escape, presence, dock or canvas navigation could abandon an in-flight save; its late response could erase a newer draft. | All conflicting navigation is blocked while a mutation is pending; composer inputs/file drops are frozen. Late upload assignment checks the draft client ID. |
| Accepted writes | A committed save followed by a failed snapshot opened an inspector claiming the original was missing. | Publication remains successful, its draft clears, and the UI says “Saved. Reconnecting to show it.” until current world data is available. |
| Reconnect | A hanging old snapshot kept the new connection waiting on the same promise. | Generation-scoped cancellation, stale-response/finalizer guards, and immediate settlement of active/queued callers on teardown. |
| Busy world | Continuous notices extended one refresh promise forever, keeping accepted contributions in their saving state. | One active fetch plus one queued fetch; each caller gets a finite freshness horizon while later work continues separately. |
| Guest identity | A null auth session left the previous contributor identity and live admission displayed. | Clear identity, remove the old channel/listener, retain public browsing, and require explicit reconnect for new admission. |
| Cursor rendering | One remote cursor movement and every 500ms aging tick repainted the full pixel world. | Cursor-only changes redraw the existing cursor canvas. Artwork still redraws for paint previews, persisted pixels, camera/viewport/DPR changes. |
| JSON requests | Missing/misleading Content-Length bypassed the 100KB request limit. | Enforce actual stream bytes, cancel over-limit bodies, preserve split UTF-8 and schema errors. |
| Error semantics | SQL account suspension was surfaced as an infrastructure outage. | Return 403 with `session_suspended`. |
| Cron auth | Equal JavaScript string lengths could have unequal UTF-8 buffer lengths and throw inside timingSafeEqual. | Validate scheme and actual byte lengths before constant-time comparison. |
| Image decoding | Repeated retries of one malformed staging object could decode without a publication budget charge. | Charge at most 24 staging-finalization attempts per actor/hour before download/decode; already-ready assets bypass the allowance. |
| Raw image cleanup | A failed immediate staging deletion could retain the raw original indefinitely for a published photo. | Separate service-only token-fenced sweep after upload-token expiry; never remove the delivered canonical image. |
| Image indexing | A temporary image download failure completed a captionless index as ready. | Fail/retry the attempt; completion requires an image caption. |
| Index concurrency | Delayed workers could fail/obsolete a newer worker's attempt. | Require matching attempt, unexpired lease, current source version and visibility. Revoke legacy unfenced RPC execution. |
| Ask evidence | Shared image descriptions could change without a source-version increment, leaving an old quote beside a new description. | Commit captions with accepted versioned embeddings; revalidate evidence fields on the server and invalidate changed open answers. |

Detailed SQL/RAG reproduction, compatibility behavior and rollback restrictions are in [the indexing review](2026-10-22-rag-indexing.md).

## Verification before publication

- Full suite: **273 tests across 32 files passed**; TypeScript and optimized Next production build passed.
- Six new browser regressions passed across 1440px desktop and Chromium iPhone emulation: delayed publish, delayed edit, accepted save with failed snapshot followed by recovery. Requests are synthetic; disposable anonymous guest admission is real.
- Existing original browsing, failed admission, late-answer rejection, source return, previews, pinch and draft cancellation checked on both projects. Stale headings in older test selectors were corrected to the current UI, and the source-return test now waits for the inspector to close before locating its canvas return control.
- Real React lifecycle tests cover stale completions, coalescing, continuous notifications, monotonic snapshots, Strict Mode, teardown and sign-out. The only added package is pinned dev-only `jsdom`; production dependencies are unchanged.
- Real React canvas instrumentation with **17,000 visible cells** measured 17,000 artwork fills per remote cursor update before the fix and **0** afterward. This is a redraw-count measurement, not a frame-rate or large-scale capacity claim. Remote strokes, erasure/fading, local previews, camera changes and DPR still redraw correctly.
- Both additive migrations and SQL fixtures passed first on the local Postgres compatibility lab, then unmodified on hosted Supabase with native pgvector in a **BEGIN/ROLLBACK** preflight. Hosted verification afterward found zero fixture actors, zero uncommitted migration columns, and no active index jobs. Fixtures claim only their own exact IDs.
- Supabase migration dry run selected exactly the two new migrations, no seed/role changes. Security advisors reported the existing intentional anonymous realtime policies and disabled leaked-password protection; this app uses anonymous guest admission rather than password login. No new policy grant to browser roles was introduced.
- An independent final review found the continuous-refresh starvation issue and re-reviewed the corrected implementation; no further actionable finding remained in the reviewed changes.

## Rollout and limits

Apply the DB migration before deploying the worker, and recheck that no final-attempt lease is active immediately beforehand. New code needs the new RPCs; old workers are deliberately denied unfenced completion. No automatic historical reindex, budget increase, or seed rewrite is included. Final release IDs and post-deploy checks are recorded separately after deployment.

Mobile verification uses Chromium emulation, not physical Safari devices. These checks do not prove r/place-scale traffic capacity, universal answer relevance, or absence of every possible defect. The existing daily inference cap and historical indexing backlog remain explicit operational limits.

Reference checks used the [Supabase migration guide](https://supabase.com/docs/guides/deployment/database-migrations), [CLI reference](https://supabase.com/docs/reference/cli/supabase-db-push), current CLI help, installed Next documentation, and the [signed-upload URL contract](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl). Context7 was unavailable due to its monthly quota; official documentation and local package source were used instead.
