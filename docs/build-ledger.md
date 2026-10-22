# Memory Box build ledger

## Living mosaic, 21 October 2026

- Authority: the user approved the desktop/mobile living-mosaic preview, then explicitly requested this direction in the actual app with more chaos, collaborative pixel art, real cursors, notes/photos and wandering. The implementation preserves the existing private upload, attributed original/build-on, server paint/undo, and grounded Find/Ask systems.
- Replaced the category-led entry with an occupied mosaic, serendipitous visits to stored originals, editable absurd landmarks and quiet secondary search. Desktop readers float beside the chosen place; mobile readers are bottom sheets. Distant contributions remain reachable without making the initial view empty. Notes retain their actual bodies, authors and positions.
- Actual tab membership is separate from actual pointer locations. A separate private Realtime topic carries bounded cursor/stroke hints; none can authorize a durable write or publish a server revision. Idle membership is real, hints expire, hidden/closed tabs leave, and there are no scripted visitors or activity generators in the app.
- The additive expansion defines 84 fictional originals, eight original static illustrations and 5,081 editable cells. Its reviewed transaction inserts only absent originals/cells, records exact new cells, locks the world row and makes repeat imports no-ops. The image allowlist and indexing path support only explicitly labeled trusted starters. Production import/health observations are recorded in the final release evidence.
- Fresh independent review found and fixed four regressions: a distant mark collapsing first arrival, the floating reader covering focused originals at tablet widths, train/scope metadata disagreement, and late Ask responses moving someone away from a wandered story. Regression tests cover all four.
- Final local verification: 134 tests across18 files, TypeScript and optimized production build passed. All22 desktop/mobile browser checks passed in one clean single-worker run, including real two-session cursors and canvas RGB, idle membership/departure, paper drag/click/keyboard, real paint/partial undo, independent note/photo authors, private image upload and source deletion, build-on ownership, query/camera/scroll/citation return, delayed-answer navigation, and two real provider-backed Ask requests.
- The first combined run reached the upstream anonymous-signup allowance. Safe diagnostics established HTTP429/over_request_rate_limit, rather than a cursor or lifecycle failure. One reviewed temporary config update changed only anonymous signup allowance30→120 for verification; a `finally` block restored30 after the clean run, and read-only config diff confirmed0 declared updates. No other Auth properties or secrets were sent.
- Two supported additive migrations are installed on the authorized pilot: private cursor Broadcast policies and the narrow starter-image path constraint. Security advisors reported no errors; warnings reflect the intentional anonymous Realtime access and preexisting password-protection configuration. Snapshot spatial paging, anonymous-abuse resistance and verified participant identity remain pilot limits.

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
- The deployed HTTP/live Supabase test passed 14 checks: two guest identities, real private Realtime delivery, idempotent painting, separate build-on authorship, private staging/sanitized image publication, immediate authored-text search, a visual detail absent from author text found through the actual image description, nonliteral semantic retrieval, real cited generation, unrelated-question abstention, version conflicts, image revocation, source deletion with child survival, and undo. Exact fixtures cleaned afterward.
- Browser testing published real text/image contributions, followed inspired-by threads, verified semantic Find and actual Ask, edited/removed sources while an answer or another tab was open, painted/undid, and recovered after offline/online. Viewports 1440/1024/390/320 checked. Exact design fixtures removed; the clean world has ten starters and zero community memories.
- Independent review findings were fixed with red/green regressions: delayed Ask source-body removal, current-source UI projection, late query response rejection, edit/query/upload/index global ceilings, shared-image deletion, exhausted lease state, and finalization/cleanup races.
- A real Storage cleanup proof removed both staging and canonical private objects and recorded completion, then removed its exact fixture account/metadata. Daily batches can claim100, exceeding60 maximum new upload reservations. SQL rollback regressions verify61 claims in one batch, hidden-reference retention, and publication fencing.
- Deployment input inventory and generated browser bundle were scanned against the actual configured secret values: zero matches. Explicit .vercelignore excludes private auth files, environment files, and browser test state; Git ignores them independently.
- Two live DB issues were fixed with migrations: lifecycle checks preventing content scrubbing, and retryable SQLSTATE 40001 causing stale edits to hang. Stale edits now return PT409 promptly.
- Supabase advisors found no schema/function/index warnings. Guest access to the public collaboration topic is intentional; password-leak protection is inapplicable to the current anonymous-only flow.
- Public source: https://github.com/ManagementMO/memory-box on codex/memory-box-mvp. Initial implementation commit503e892 passed GitHub Actions unit/typecheck/build CI.
- Public deployment: https://memory-box-commons.vercel.app. Vercel production is Ready; runtime functions verified in sfo1 alongside Supabase us-west-1. Production health reports10 originals/10 indexed after fixture cleanup.
- Six browser tests also passed against the production URL. The denied-admission and delayed-response cases deliberately intercept only their tested request; the normal browsing/Find checks use actual production services.
- Actual 30-client load and long-term community participation are not measured. Search cutoff calibration remains a tiny English seed probe. Citation membership is enforced; sentence-level semantic support is still a model-quality limit. Guest ownership has no cross-device recovery yet.

## Release handoff

The app is deployed and source is public. The final user-facing handoff records screenshots, production check evidence, source/CI links, run/operation commands, and the accepted pilot limits. No runtime feature or provider activation gate remains.

## Open-world upgrade, 21 October 2026

Authority: the user approved the white/pastel pixel mockup and requested the actual app with real collaborative painting, notes/photos, build-on and Find/Ask on desktop/mobile. Work is isolated on `codex/open-world-commons` from `9b9c3b6`.

- Replaced the finite-board bitmap with viewport rendering over a sparse signed plane, free pan, pointer-anchored zoom, mobile pinch, center coordinates, entry minimap, accessible movement and source/camera return. The pilot accepts world-pixel coordinates -60000..59999 and 6px paint cells -10000..9999. Snapshot network paging remains future work.
- Added staged freehand paint with a 144-cell cap and explicit durable acceptance; retained shapes, ownership, moderation and partial undo. No fictional live participants or scripted answers were added.
- Applied white/cobalt chrome, pastel contribution materials, self-hosted Pixelify/Schibsted/IBM Plex Mono fonts with licenses, compact readable originals and responsive below-canvas mobile panels. Existing original bodies, colors and coordinates are preserved.
- Find/Ask intent selection does not submit a model request. Sources can be shown on the canvas and returned to with the same question, mode, camera, actual panel/page scroll and focus. Parent inspection retains its draft. Images continue through the existing private sanitization/indexing pipeline.
- Context7 returned quota exhaustion; current primary documentation and installed package types were used. Morph search/edit returned402; rg, apply_patch and exact local edits were the fallback.
- Signed-bounds migration `20261021220230` was privately matched to the linked authorized pilot. Dry-run showed it as the only pending migration. Hosted rollback SQL passed and exact disposable Auth/profile fixtures were removed. Before/after public state remained revision106, epoch1, cells4825, published originals10, indexed10.
- Fresh unit suite:87 passed. Typecheck and optimized production build passed. Four opt-in UI transport cases passed across desktop/mobile, using explicitly synthetic Find/Ask payloads; these do not establish provider output quality. They cover camera/query return, citation focus/mobile visibility, staged-only brush, anchored zoom/pinch, cancellation and layout.
- Independent whole-change review identified and checked fixes for extreme-spread result framing (screen-sized overview pins), actual scroll-container restoration and stale draft-return state. Focused independent test rerun:18 passed. Browser regressions and final deployment checks are recorded below when complete.

- Real browser contribution checks passed on both desktop and mobile: independent note/photo authors, private upload/public sanitized delivery, parent overwrite denial, child lineage surviving parent removal, image revocation, real binary revision Broadcast and second-browser rendered RGB, and partial undo preserving the second visitor's repaint. Two provider-backed Ask checks passed, one per viewport, each opening the actual cited original and returning without another generation. Testing consumed normal public allowances; two image publications also scheduled their usual caption/index jobs.
- Exact contribution cleanup audit: revision106→125; all4825 original pixel rows including revisions and all10 public memories matched their full pre-test hashes;16 disposable Auth identities absent, two fixture assets deleted, test-owned public events removed. Five withdrawn source tombstones and six paint/undo audit records remain to preserve historical references. No outsider cells were cleared.
- Guarded starter-radio refresh passed separate independent review and an isolated local Postgres execution suite for stale-plan rejection, nonseed/null-white preservation, repeat stability, exact recovery, later visitor edits and restore-marker conflicts. Hosted forward application then moved revision125→126/epoch1, replaced exactly2946 seed100-owned cells and inserted24 opaque art cells. All1879 other preexisting rows, all69 protected nonseed/null-owner rows, and the full stored-originals hash stayed unchanged. Repeat apply returned already-applied with identical state. Before/after/recovery/audit files are retained in this task's private work folder; hosted recovery was not run.

- All10 distinct UI/search/fallback browser cases are verified across focused runs, in addition to the six distinct live contribution/provider cases. The last older mobile delayed-answer test initially hit Supabase signup HTTP429 before reaching its assertion; it passed against the public production URL after the admission allowance recovered. No production authentication limits were weakened. Public browsing stayed available during admission failure.
- Final visual review passed1440/390/320px including the updated radio, readable photo/title layouts, source auto-reveal, mobile return to the canvas and finite readable map markers at0.1% zoom. No browser console errors were seen in that isolated review.
- Candidate commit7f57dea passed both GitHub Checks runs (unit/type/build), a fresh production dependency audit reported0 findings, and scans of109 tracked files plus10 browser chunks against five configured private values found0 matches. Deployment input inventory excluded auth/environment/browser-state files.
- The candidate was deployed to the production environment without switching the public domain, checked through Vercel's authenticated access path (healthy126/10/10 plus current CSS/fonts), and then promoted as the same tested deployment `dpl_qmP67oZz22yBJscqfEaQR1u1MknR`. Public health immediately returned126/10/10; the public mobile delayed-answer case passed afterward. PR: https://github.com/ManagementMO/memory-box/pull/1.
