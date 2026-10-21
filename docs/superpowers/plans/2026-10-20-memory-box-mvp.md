# Memory Box MVP Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement the tasks below. The user explicitly authorized autonomous execution of the approved research and mockup; no new design approval is pending.

**Goal:** Ship a real collaborative public memory world with paint, text/image/link originals, explicit inspired-by links, hybrid retrieval, and grounded answers.

**Architecture:** Next.js owns validated writes, source delivery, and AI calls. Supabase owns guest identity, transactional canvas state, originals, private assets, indexing jobs, and metadata-only realtime notices. The browser renders a finite Canvas 2D world and accessible HTML memories.

**Tech Stack:** Next.js 16.4.2, React 19.3.1, TypeScript, Supabase, pgvector, native GTE-small embeddings, Anthropic structured generation, Sharp, Vitest, Playwright.

**Spec:** [Research and revised design](../../specs/research-and-revised-design.md) and the approved memory-box-shared-stories mockup. [Visual tokens](../../specs/visual-direction.md) preserve the accepted direction.

## Global constraints

- Preserve the cassette, pond, garden, paper memories, and explicit source navigation. Flat denim, green-gray, porcelain, muted paper colors; no gradients.
- Public grid is shared. Authored memory ownership is independent of overwritten pixels.
- Anonymous guest auth grants identity, never ownership of another memory. Only server mutations can publish accepted edits.
- Never ship provider or service-role secrets in client code or Git.
- Real people/counts and durable events only. Seed content is labeled. No simulated collaboration or canned answers.
- Search remains useful if embedding service fails, with an accurate degraded state. Unsupported answers abstain.
- Images are decoded and reencoded, bounded to 5 MB and 16 million pixels, staged privately, finalized with ownership validation.
- MVP world is 1200 × 720 world units; 200 × 120 shared pixels at 6 units per cell. Memories use world-unit coordinates.

## Review focus

- Concurrent retries and disconnected clients: unique operation IDs, ordered revisions, fresh snapshot recovery.
- Cross-user mutation and uploads: ownership predicates and inaccessible service-only mutation RPCs.
- Deleted/changed sources: read/search eligibility and old-answer invalidation.
- Bad files and links: decoded image validation and http/https protocols only.
- AI failure or source prompt injection: no fabricated citations, no provider secrets in errors, no canned answers.

### Task 1: Durable world and identity

Files: supabase migrations, SQL tests, src/lib/server/database.ts, seed script.

Interfaces: snapshot RPC returns WorldSnapshot from src/lib/types.ts. Mutation RPCs are service-only and accept a verified actor UUID. Public realtime topic is world:commons, metadata notices only, read permission for authenticated guests.

- [x] Add schema, RLS/grants, serialized idempotent paint, owner memory lifecycle, reports, budgets, index jobs, search.
- [x] Seed labeled fictional memories and original pixel landmarks.
- [x] Verify paint ordering/idempotency, ownership, deletion filtering, undo preserving later edits, and guest read policies against a real database.

### Task 2: Browser application and collaboration

Files: src/app/layout.tsx, src/app/page.tsx, src/app/globals.css, src/components/*, src/lib/client/*, src/lib/scenes.ts.

Interfaces: GET /api/world returns WorldSnapshot. POST /api/paint accepts {opId,cells,sceneId}; POST /api/paint/undo accepts {operationId}. POST /api/memories accepts NewMemory. PATCH/DELETE /api/memories/:id use owner authorization. API calls carry the current Supabase access token in Authorization: Bearer. Browser guest login uses NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Realtime private channel world:commons receives event changed with WorldNotice; refetch access-checked snapshot on notices and reconnect.

- [x] Implement pan/zoom, click/tap/keyboard placement, shape paint, pending/accepted/rejected state, and snapshot recovery.
- [x] Implement real composer, source inspector, build-on links, accessible list, activity, guest profile naming, connection state, source invalidation, and responsive panels.
- [x] Preserve actual input on errors; provide upload/indexing state and source-first Find/Ask.

### Task 3: Uploads, retrieval, and answers

Files: src/app/api/*, src/lib/server/*, tests/*.

Interfaces: POST /api/uploads accepts {name,mime,size} and returns {assetId,path,token}; uploadToSignedUrl uses bucket memory-staging. Publishing an image validates/finalizes assetId. POST /api/search accepts {query,sceneId?} and returns SearchResponse. POST /api/ask accepts {query,sceneId?} and returns AnswerResponse. GET /api/assets/:id serves only currently published sanitized media. POST /api/profile accepts {name}. POST /api/reports accepts {memoryId?,bounds?,reason}. All writes and search/ask require guest identity.

- [x] Add server input validation, origin checks, auth checks, quotas, sanitized private assets, and owner delete/edit.
- [x] Add durable embedding jobs, normalized native vectors padded to the 1536-dimensional contract, full-text/vector reciprocal-rank fusion, and provider timeouts.
- [x] Generate structured claims with source IDs, reject unknown citations, return source versions, abstain when retrieval is weak, preserve failures accurately.
- [x] Verify new text/image caption retrieval and nonliteral semantic query with actual embeddings; verify generated answer source IDs and an unrelated no-evidence query.

### Task 4: Verify and release

Files: scripts/test-live.ts, e2e/*, README.md, deployment configuration, parent outputs delivery report.

- [x] Run typecheck, focused unit/integration tests, production build.
- [ ] Test two independent browser contexts for realtime paint, memory creation, upload, build-on relation, reconnect, search, citation navigation, ownership, and source deletion.
- [x] Inspect 320/390/1024+ layouts and keyboard/reduced-motion behavior, fix visual defects.
- [ ] Create/push the repository, deploy with server-only secrets, rerun key live flows, and record exact local/deployed evidence and any remaining gate.
