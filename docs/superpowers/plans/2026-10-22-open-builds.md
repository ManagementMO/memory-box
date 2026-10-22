# Open Builds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any visitor publish, discover and join an invitation attached to a real canvas creation.

**Architecture:** Add an optional invitation flag to the existing memory API and a default-false database column. Reuse memory placement, ownership, indexing, source relationships and painting; small dedicated build components integrate with Together and the spatial preview.

**Tech Stack:** Existing Next.js 16.4.2, React 19.3.1, Zod, Supabase Postgres, Vitest and Playwright.

**Spec:** [Open builds design](../specs/2026-10-22-open-builds-design.md)

## Global Constraints

- Keep the white/pastel pixel identity, existing self-hosted fonts and compact chrome.
- No new rendering, motion, UI or backend dependency.
- All six existing dock actions and all three zoom levels remain available.
- Mobile controls retain at least 44px hit targets; sheets scroll and remain clear of the dock.
- Presence, authored content, pixel saves and lineage reflect real stored or live activity.
- Anyone can contribute; Waterloo is only the first neighborhood.
- Scope excludes corner-following, notifications, replay, membership, completion tracking and scoring.

## Review Focus

- An older client omits the flag during edit: retain it and enforce invitation text at the database boundary (Task 1).
- An invitation closes or is removed while a visitor is joining: stop new invitation actions, preserve their existing draft (Task 2/3).
- A parked response or painting kit is revisited: retain source context without linking an unrelated note or moving a parked pixel preview (Task 2/3).
- An image invitation has no caption: reject it with an actionable error, while normal captionless photos still work (Task 1/2).
- Mobile 320px wide and short viewports: source, join tools, writing area and dock stay usable with no horizontal overflow (Task 3).

### Task 1: Persistent invitation contract

**Files:** `src/lib/types.ts`, `src/lib/server/validation.ts`, `src/lib/server/database.ts`, a CLI-generated Supabase migration, `tests/validation.test.ts`, transaction-scoped SQL verification.

**Interfaces:** `Memory.isBuildInvitation?: boolean`, `NewMemory.isBuildInvitation?: boolean`, optional validated patch field; `mb_memory_json` emits the boolean. Omitted creation is false, omitted edit preserves it.

- [ ] Add failing validation tests for true/false/omitted flags, invalid values and blank invitation text.
- [ ] Run `npm test -- tests/validation.test.ts`; confirm failures represent missing validation.
- [ ] Extend the API contract and existing SQL functions without weakening authorization, idempotency, locking or indexing. Add the nonblank-body constraint.
- [ ] Run focused tests and rollback-only linked SQL assertions for persistence, exact retry, legacy edit, unauthorized edit, closure, constraint and service-only grants.
- [ ] Commit named contract/migration/test paths.

### Task 2: Invitation contribution and spatial joining

**Files:** `src/components/memory-box-app.tsx`, `memory-composer.tsx`, `memory-card.tsx`, `story-peek.tsx`, new `build-workbench.tsx`, `src/lib/client/build-invitations.ts`, `src/app/open-builds.css`, `src/app/layout.tsx`, focused component/domain tests.

**Interfaces:** `openBuildInvitations(memories: Memory[]): Memory[]` sorts current invitations; `BuildWorkbench` accepts an optional current memory plus paint/note/photo/read/share/return callbacks. `MemoryDraft.isBuildInvitation` is controlled and survives preview/resume/edit. The application holds the joined original ID; missing/closed sources disable joining actions.

- [ ] Add failing tests for invitation discovery, preview Join vs ordinary Build on, unavailable workbench, and composer toggle/error behavior.
- [ ] Run the tests and confirm expected RED results.
- [ ] Implement the flag control, real Together list and anchored workbench using current tokens. Carry the flag through create/edit requests; keep a compact return action in the paint kit. Preserve existing source, draft and search return flows.
- [ ] Run unit tests, `npm run typecheck` and `npm run build`.
- [ ] Commit named implementation/test paths.

### Task 3: Two-visitor evidence and release

**Files:** Extend `tests/e2e/poppy-canvas.pw.ts`; update `.21st` design context and release evidence.

**Interfaces:** Existing `WorldFixture`, same-origin requests and camera helpers; no new production dependencies or fixture bypass of app mutations.

- [ ] Add an end-to-end test using two disposable visitors: create a real invitation through the UI, join from Together, paint, publish note/photo responses, verify real-time visibility, reject foreign edit, preserve omitted flag, close and remove source. Include draft retention and 320px layout checks.
- [ ] Run the scenario before UI implementation is complete if practical to demonstrate RED, then run it against the completed production build and linked additive migration. Run existing relevant browser suites sequentially.
- [ ] Capture desktop/mobile workbench and composer together, inspect once, batch corrections, confirm at most once; run the Impeccable detector once. Have a fresh reviewer check the whole branch and render evidence; fix material findings with regression tests.
- [ ] Run the final unit suite, typecheck and build; open and attach a PR, verify CI, merge into `codex/memory-box-mvp`, confirm Vercel READY and live behavior at that exact commit.

## Execution record

Native implementation follows the user's approval to proceed and prior push/merge authorization. Context7 quota is exhausted; current official Supabase Markdown documentation and installed Next.js documentation were read instead. Morph search/edit tools returned quota errors earlier in this session; use targeted `rg` reads and `apply_patch` as the documented fallback.
