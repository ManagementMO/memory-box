# World Atlas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing shared canvas feel like a continuous explorable world whose places come from real contributions.

**Architecture:** Pure geography derives places and safe new-ground destinations from the current snapshot. A compact map/area panel and background geographic layer integrate with the existing camera and invitation/composer flows; a pixel bucket index bounds artwork draw work. No data migration or new dependency.

**Tech Stack:** Existing Next.js16, React19, TypeScript, Canvas2D, CSS, Supabase Realtime and persisted originals/pixels.

**Spec:** `docs/superpowers/specs/2026-10-22-world-atlas-design.md`

## Global Constraints

- Keep the white/pastel cute pixel identity, all existing zoom levels and small canvas controls.
- Only actual stored originals/pixels and live presence determine content/activity; scenery is wayfinding only.
- Preserve authored positions, ownership, drafts, real painting/undo/turns, uploads and source-backed Find/Ask.
- Mobile controls are at least44px; sheets remain clear of the dock; reduced motion remains supported.
- No new dependency, font, seed contribution, database migration or population claim.

## Review Focus

- Negative and extreme world coordinates must remain reachable without huge iteration or cross-world area hulls.
- An empty world must have no invented occupied areas; surviving pixels must keep a place discoverable after source deletion.
- Starting a new place must not silently replace a draft/pixel preview or publish before explicit confirmation.
- Source-linked responses and exact-place links must retain their actual coordinates after travel between areas.
- Index caching must refresh on real artwork changes without redrawing it for cursor movement or dropping edge cells.

### Task1: Geographic model and indexed artwork

**Files:** Create `src/lib/client/world-atlas.ts`, `src/lib/client/spatial-index.ts`; test `tests/world-atlas.test.ts`, `tests/spatial-index.test.ts`; modify `src/components/world-canvas.tsx` and rendering regression tests.

**Interfaces:** `worldAreas(memories,pixels):WorldArea[]`; `areaAtPoint(areas,point):WorldArea|null`; `newPlaceGround(areas,memories,pixels,anchor):FramePoint|null`; `chooseWorldStory(memories,areas,visited,current,random):Memory|null`; `spatialIndex(items,bounds,bucketSize).query(bounds)`.

- [ ] Write RED tests for real-only/unique area assignment, distant and negative cells, named roots, deletion with surviving pixels, safe open-ground search and balanced unseen discovery.
- [ ] Implement pure geographic functions and bounded queries, preserving original object coordinates; show GREEN.
- [ ] Use cached pixel buckets in the artwork draw path; assert distant cells are excluded and all cursor/preview redraw regressions stay green.
- [ ] Commit the independently tested model/index slice.

### Task2: World map, geographic landscape and travel

**Files:** Create `src/components/world-map.tsx`, `src/components/world-geography.tsx`, `src/app/world-atlas.css`; modify app/canvas and layout CSS import; test app handlers and browser navigation.

**Interfaces:** `WorldArea` carries real bounds, source IDs, colors/emblem and exact content counts. Map receives current snapshot, areas/camera and onVisit/onPoint/onStart callbacks. World geography receives the same areas and camera and adds no writes.

- [ ] Write failing app-handler tests for map travel, new-place draft safety and persisted-coordinate placement; add the real two-visitor world scenario before implementation.
- [ ] Extend Explore/location affordances with compact map and real content miniature, place list and safe Start a place; keep the existing contribution pipelines and drafts.
- [ ] Add faint geographic contours and readable decluttered area labels over the actual shared world; preserve the zoom center and reading/painting hit targets.
- [ ] Distribute Wander across actual occupied places, maintaining actual-source previews and unseen history.
- [ ] Verify desktop/mobile/320px geometry and functional navigation, two-visitor creation/paint/text/photo and reload; commit.

### Task3: Verify and release

**Files:** Browser suites, direction/design context and this execution record; no broad implementation cleanup.

- [ ] Run final units/typecheck/build and the relevant existing browser suites sequentially with disposable fixtures.
- [ ] Capture the world, one neighborhood and close contribution flow on desktop/mobile together; inspect, batch material fixes and confirm at most once. Run detector once; obtain fresh code/visual review and resolve material findings.
- [ ] Document ground-truth design, open/attach PR, verify exact-head CI, merge to `codex/memory-box-mvp`, verify exact production SHA and public desktop/mobile flow, then audit fixture cleanup and Git parity. Post-merge release evidence belongs on the PR.

## Execution record

User approval: latest explicit request approves the previously described world/neighborhood/close experience and authorizes push/merge. Native implementation reuses this dedicated checkout on a feature branch. Existing `.21st` context is the visual authority; PRODUCT.md records already-confirmed user facts. Morph exploration returned402, so source exploration used targeted local reads; Fast Apply fallback is available if its editor also fails.
