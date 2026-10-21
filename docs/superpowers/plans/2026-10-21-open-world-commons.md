# Open world commons implementation plan

> **For agentic workers:** Execute the approved redesign continuously, with independent work on bounds, visual styling and browser tests. Root integrates behavior and obtains whole-branch review.

**Goal:** Ship the approved white/pastel pixel interface with real sparse-world collaboration, authored contributions and Find/Ask on desktop and mobile.

**Architecture:** Retain Next/React and the existing Supabase security/retrieval/data pipeline. Widen signed sparse coordinates through an additive migration. Render pixels into a viewport-sized Canvas2D surface and transform HTML originals with a camera; stage freehand cells through the existing paint endpoint.

**Tech Stack:** Existing pinned Next16.4.2/React19.3.1, Supabase, Postgres/pgvector, custom CSS, Vitest and Playwright; no whiteboard framework.

**Spec:** docs/specs/open-world-commons.md

## Global constraints

- Preserve existing authored bodies, coordinates, paint, ownership, revision ordering and moderation.
- Sparse worldpx -60000..59999; grid6; cell -10000..9999; at most144 unique paint cells per operation.
- No fake participants/provider responses in production. Keep fictional starter labels.
- Guest writes remain server-authorized; existing upload, query and provider allowances remain in force.

## Review focus

- Touch cancel/pinch while a brush is active must not create unintended paint.
- Offline/ambiguous POST completion must retain an idempotent retry and the user's preview.
- Negative/zero coordinates must agree through UI, validation, database, undo and moderation.
- Source edits/deletions and navigation must not expose stale originals or lose the question/draft.
- Mobile overlays, keyboard and narrowed canvas must retain readable controls and an actual route back.

## Tasks

### 1. Expand the sparse plane safely

Files: new world-bounds.ts and forward migration; validation.ts, scenes.ts, operator.ts and focused bounds tests. Shared constants are WORLD_MIN=-60000, WORLD_MAX=59999, GRID_SIZE=6, CELL_MIN=-10000, CELL_MAX=9999. Existing snapshot dimensions remain entry-view metadata.

- [x] Test signed/edge/invalid coordinates and shaped paint clipping.
- [x] Widen constraints/functions and keep idempotence/undo/operator authorization unchanged.
- [x] Prepare and review migration; apply only after local checks, then run database/HTTP checks with exact fixture cleanup.

### 2. Camera and real freehand collaboration

Files: new canvas-geometry.ts and its tests; world-canvas.tsx; memory-box-app.tsx.

- [x] Write failing tests for anchored zoom, signed point conversion, framing and bounded stroke merging.
- [x] Implement viewport rendering, pan/pinch/zoom, coordinates, local-map view and camera save/restore.
- [x] Implement staged Draw pixels and existing Place a shape,144-cell cap, explicit acceptance and partial undo through real endpoints.
- [x] Check independent visitor delivery and changed-cell repaint without seed resets.

### 3. Approved visual system and complete contribution flow

Files: globals.css, layout.tsx/fonts/favicon, memory-card.tsx, memory-composer.tsx and app shell/source navigation.

- [x] Apply white/cobalt/pastel tokens, pixel accents, readable material-specific originals and responsive panels.
- [x] Preserve text/image/link drafts and parent; reveal placed sources and restore query/camera/focus on return.
- [x] Show actual recent changes and seed provenance; retain ownership, errors, loading and moderation controls.
- [x] Capture and inspect desktop/mobile renders including source reader, paint, upload and Ask.

### 4. Verify and release

Files: new open-world browser coverage, README/build-ledger and release evidence.

- [x] Run unit tests, typecheck, production build and existing/new browser tests.
- [x] Run bounded real collaboration/upload/build-on/search/Ask checks and clean exact fixtures.
- [x] Obtain independent whole-branch review, fix material findings and repeat affected verification.
- [x] Commit named files, publish branch/PR, deploy authorized app and recheck Git/CI/health/key live behaviors.

## Execution notes

The user already approved the visual prototype and explicitly requested implementation; no additional design approval gate is needed. Work is isolated on codex/open-world-commons. Morph search/edit returned402 and Context7 returned quota exhaustion; rg/native edits and primary official/local documentation are the fallbacks. Progress and decisions are recorded in docs/build-ledger.md.

Ruling: Refresh the labeled starter radio only under exact seed ownership guards, with an auditable before/after operation and idempotent marker. This matches the approved cute radio while preserving every visitor-owned cell; a missed guard would damage shared work, so transaction, overlap and repeat-run checks are required.
