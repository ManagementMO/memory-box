# Living Mosaic Implementation Plan

> **For agentic workers:** Use the existing approved interactive mockup and the user's request to implement this in the actual app. Independent canvas, presence and starter-content tasks run in parallel; the primary agent integrates and verifies the experience.

**Goal:** Make Memory Box a sprawling white/pastel world of original fragments and collaboratively editable pixel art, with real nearby cursors and serendipitous wandering on desktop and mobile.

**Architecture:** Preserve the existing authoritative Postgres pixel operations, original-memory ownership, image pipeline and grounded search/Ask. Add a separate private ephemeral channel for presence, cursors and temporary paint previews. Render the occupied world as the entry experience, with floating original readers and compact contribution controls.

**Tech Stack:** Existing Next.js 16 / React 19, canvas and transformed DOM originals, Supabase Realtime/Postgres/Storage, self-hosted fonts. No new runtime framework.

**Spec:** User-approved living-mosaic interactive preview and current request; existing `docs/specs/open-world-commons.md` remains the persistence/ownership contract.

## Global Constraints

- Preserve every existing user memory and painted cell when adding starter material.
- Starter stories and authored illustrations are explicitly fictional examples; online people/cursors/counts come only from actual connected sessions.
- Original notes/photos keep their authors. Building on one creates another attributed original.
- Pixel commits remain server-authorized, idempotent, limited to 144 cells, and undo respects later edits.
- Search and Ask remain functional and secondary to exploration; no fabricated live search or model result.
- White canvas, cobalt controls, lilac/butter/blush/ice fragments, Pixelify accents and readable body text.
- No credentials in client bundles, logs or delivered evidence.

## Review Focus

- Separate browser sessions must see cursors in world coordinates despite different zoom levels, and disappear after leaving.
- Invalid/oversized ephemeral payloads must not render arbitrary coordinates or strokes, nor trigger authoritative snapshot updates.
- Mobile readers and drawing controls must leave usable canvas space and remain reachable at 320px and with the keyboard open.
- Wandering must reach actual originals and handle an empty, single-item or recently exhausted world.
- Idempotent starter import must not overwrite existing cells, edited starters, hidden/deleted originals or visitor content.

### Task 1: Presence and transient drawing previews

Files: new `src/lib/client/presence-state.ts`, `use-presence.ts`, focused unit tests, and narrow `world:commons:presence` broadcast migration.

- [x] Validate bounded peer payloads and stale membership with focused tests.
- [x] Implement throttled broadcasts, membership heartbeat, tab-scoped identities and cleanup.
- [x] Confirm private cursor channel cannot send `world:commons` revision notices.

### Task 2: Occupied mosaic and spatial navigation

Files: `world-canvas.tsx`, geometry helpers/tests, `memory-card.tsx`, `living-mosaic.css`.

- [x] Frame actual occupied content, preserve all gestures, and animate programmatic moves with reduced-motion support.
- [x] Render screen-space peer cursors and translucent remote previews without persisting them.
- [x] Retain paper/photos at far scale; remove category signs and pin-only archive presentation.
- [x] Make desktop floating readers and mobile bottom sheets preserve context.

### Task 3: Chaotic collaborative starter world

Files: new `living-world.ts`, original `public/starter-world/*` illustrations, idempotent seed script and tests.

- [x] Add varied fictional originals, explicit responses, absurd editable pixel landmarks and an unfinished train.
- [x] Review and run the additive import, preserving occupied cells and all existing originals.
- [x] Verify repeat import produces no changes; expose honest starter counts.

### Task 4: Product integration and wandering

Files: `memory-box-app.tsx`, new discovery helper/tests, contribution styles, README and release ledger.

- [x] Open on the mosaic with Wander, Build together, Paint, note/photo actions and secondary Find/Ask.
- [x] Wire real presence roster, peer visits and actual activity signals; no simulated visitors.
- [x] Preserve uploads, placement, editing, build-on, search results and source return.
- [x] Test desktop and mobile plus two isolated sessions: cursor movement, paint persistence, note/photo and build-on arrival, wandering and grounded search.
- [x] Run unit tests, typecheck, production build and review. Apply required narrow migrations, publish the verified app and recheck live behavior.

Release: application commit `7ffc22177257d03e48cbe714fe35ce4f8ca1a0a8`, production deployment `dpl_Hbyzhzmd4h3pa5o2Yd1Lb4sZzrNm`. See the build ledger for import, CI and live verification evidence. Semantic indexing respects its normal daily allowance; 82/94 fragments were ready at handoff, with 12 queued and immediate authored-word search available for all originals.
