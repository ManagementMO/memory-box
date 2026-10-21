# Memory Box build ledger

## Authority and scope

The user approved the researched design and interactive mockup, then explicitly requested autonomous end-to-end implementation, research, cloud service setup, deployment, and verification while asleep. Routine choices are delegated to the builder. No social/email messages are authorized.

## Decisions

- Next.js + Supabase + Vercel implements the existing public-canvas design; source at this task's new memory-box repository on codex/memory-box-mvp.
- Shared finite pixels, independently owned originals, explicit inspired_by relations, private sanitized image storage, metadata-only realtime, lexical/vector hybrid retrieval, structured cited answers.
- Flat denim/green-gray/porcelain shell and muted paper memories; preserve pixel landmarks.
- Vercel AI Gateway OIDC was attempted but provider access required customer verification. The working path uses private Supabase Edge GTE-small embeddings and direct Anthropic structured answers/image descriptions. No provider key reaches the browser; no billing subscription or credit purchase was made.
- Context7 was attempted for Supabase and Next.js but monthly quota is exhausted. Current official docs and installed types are the fallback.
- Morph editing returned 402 during mockup work. Native apply_patch is the working fallback.
- New app scaffold pinned current production packages. Initial old Vitest pin had a critical advisory; updated Vitest to 5.0.5 and Playwright to 1.64.1. npm audit now reports 0 vulnerabilities.

## Work ownership

- Root: cloud provisioning, API routes, auth/origin/input validation, uploads, index orchestration, integration and release.
- mvp_architecture: Supabase schema/RPCs/RLS, database adapter, seed, database checks.
- mvp_design: frontend UI, client auth/realtime/API, static seed illustrations.
- mvp_rag: native embeddings/image caption/structured synthesis, focused tests, independent integration review.

## Evidence so far

- Vercel CLI authenticated as managementmo; new project memory-box-commons linked in managementmos-projects. Local OIDC token is in ignored .env.local.
- GitHub CLI authenticated as ManagementMO.
- Supabase CLI authenticated using the supported CLI browser sign-in. Dedicated new project mmxtgfnxfwsgxxorystb is healthy in us-west-1. Eight applied migrations, guest auth, private storage, private authenticated embedding function, and ten indexed fictional starters are ready. Other preexisting projects were inspected read-only and remain unchanged.
- Supabase CLI2.117.0, Node22.22.3, Next16.4.2, React19.3.1, SupabaseJS2.118.0, AI SDK7.0.148.
- 71 focused unit tests, six desktop/mobile browser tests, typecheck, optimized production build, and npm audit (zero findings) passed.
- Expanded hosted database tests passed and cleaned their exact fixtures. Covered browser write denial, ordering, retries, partial undo, asset privacy, model namespace filtering, indexing freshness, ownership, and deletion.
- Full HTTP/live Supabase test passed 13 checks: two guest identities, real private Realtime delivery, idempotent painting, separate build-on authorship, private staging/sanitized image publication, actual semantic retrieval, real cited generation, unrelated-question abstention, version conflicts, image revocation, source deletion with child survival, and undo. Exact fixtures cleaned afterward.
- Browser testing published real text/image contributions, followed inspired-by threads, verified semantic Find and actual Ask, edited/removed sources while an answer or another tab was open, painted/undid, and recovered after offline/online. Viewports 1440/1024/390/320 checked. Exact design fixtures removed; the clean world has ten starters and zero community memories.
- Independent review findings were fixed with red/green regressions: delayed Ask source-body removal, current-source UI projection, late query response rejection, edit/query/upload/index global ceilings, shared-image deletion, exhausted lease state, and finalization/cleanup races.
- A real Storage cleanup proof removed both staging and canonical private objects and recorded completion, then removed its exact fixture account/metadata. Daily batches can claim100, exceeding60 maximum new upload reservations. SQL rollback regressions verify61 claims in one batch, hidden-reference retention, and publication fencing.
- Deployment input inventory and generated browser bundle were scanned against the actual configured secret values: zero matches. Explicit .vercelignore excludes private auth files, environment files, and browser test state; Git ignores them independently.
- Two live DB issues were fixed with migrations: lifecycle checks preventing content scrubbing, and retryable SQLSTATE 40001 causing stale edits to hang. Stale edits now return PT409 promptly.
- Supabase advisors found no schema/function/index warnings. Guest access to the public collaboration topic is intentional; password-leak protection is inapplicable to the current anonymous-only flow.

## Remaining

- Deploy with configured server-only secrets; recheck the same real flow on production and clean fixtures.
- Commit/push exact source and save a user-facing delivery report with proof and any unresolved gate.
