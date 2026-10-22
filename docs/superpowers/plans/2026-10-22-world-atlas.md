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

### Task 1: Geographic model and indexed artwork

**Files:** Create `src/lib/client/world-atlas.ts`, `src/lib/client/spatial-index.ts`; test `tests/world-atlas.test.ts`, `tests/spatial-index.test.ts`; modify `src/components/world-canvas.tsx` and rendering regression tests.

**Interfaces:** `worldAreas(memories,pixels):WorldArea[]`; `areaAtPoint(areas,point):WorldArea|null`; `newPlaceGround(areas,memories,pixels,anchor):FramePoint|null`; `chooseWorldStory(memories,areas,visited,current,random):Memory|null`; `spatialIndex(items,bounds,bucketSize).query(bounds)`.

- [x] Write RED tests for real-only/unique area assignment, distant and negative cells, named roots, deletion with surviving pixels, safe open-ground search and balanced unseen discovery.
- [x] Implement pure geographic functions and bounded queries, preserving original object coordinates; show GREEN.
- [x] Use cached pixel buckets in the artwork draw path; assert distant cells are excluded and all cursor/preview redraw regressions stay green.
- [x] Commit the independently tested model/index slice.

### Task 2: World map, geographic landscape and travel

**Files:** Create `src/components/world-map.tsx`, `src/components/world-geography.tsx`, `src/app/world-atlas.css`; modify app/canvas and layout CSS import; test app handlers and browser navigation.

**Interfaces:** `WorldArea` carries real bounds, source IDs, colors/emblem and exact content counts. Map receives current snapshot, areas/camera and onVisit/onPoint/onStart callbacks. World geography receives the same areas and camera and adds no writes.

- [x] Write failing app-handler tests for map travel, new-place draft safety and persisted-coordinate placement; add the real two-visitor world scenario before implementation.
- [x] Extend Explore/location affordances with compact map and real content miniature, place list and safe Start a place; keep the existing contribution pipelines and drafts.
- [x] Add faint geographic contours and readable decluttered area labels over the actual shared world; preserve the zoom center and reading/painting hit targets.
- [x] Distribute Wander across actual occupied places, maintaining actual-source previews and unseen history.
- [x] Verify desktop/mobile/320px geometry and functional navigation, two-visitor creation/paint/text/photo and reload; commit.

### Task 3: Verify and release

**Files:** Browser suites, direction/design context and this execution record; no broad implementation cleanup.

- [ ] Run final units/typecheck/build and the relevant existing browser suites sequentially with disposable fixtures.
- [x] Capture the world, one neighborhood and close contribution flow on desktop/mobile together; inspect, batch material fixes and confirm at most once. Run detector once; obtain fresh code/visual review and resolve material findings.
- [ ] Document ground-truth design, open/attach PR, verify exact-head CI, merge to `codex/memory-box-mvp`, verify exact production SHA and public desktop/mobile flow, then audit fixture cleanup and Git parity. Post-merge release evidence belongs on the PR.

## Execution record

User approval: latest explicit request approves the previously described world/neighborhood/close experience and authorizes push/merge. Native implementation reuses this dedicated checkout on a feature branch. Existing `.21st` context is the visual authority; PRODUCT.md records already-confirmed user facts. Morph exploration returned402, so source exploration used targeted local reads; Fast Apply fallback is available if its editor also fails.

Task1: geographic/index tests pass, and a camera-motion regression first measured20,002 reads of distant pixel coordinates before the bucket index made it pass below100. The initial indexed slice is committed as222a5e7. The fresh builder check returned nothing important left.

Task2: app-handler tests and a real browser assertion first failed on the missing map/start-place flow. The clearing search initially found ground still classed as Waterloo; the regression now proves an entirely empty geographic cell and a distinct new place. Community-first wandering is preserved before balancing discovery across places. Two development-server phone runs failed because Next's developer overlay intercepted Explore, so all release verification uses a production build.

Final author visual pass: eight views were captured and opened together. One correction batch made labels quieter, separated World from sharing on phones, framed complete nearby places, and returned keyboard focus to World after travel. The phone overlap and inactive keyboard destination were independently reproduced as failing browser assertions before the fix. The second complete desktop/mobile capture pass passes all four new browser scenarios(33.9s), including320px geometry. Every capture was opened and validated; author polishing is finished. The detector ran once and returned[]. The fresh visual reviewer returned SHIP at screenshot/source scope. The initial broad34-scenario production-build regression passed.

The fresh code review found two Important/P2 issues: an untouched ordinary note blocked Start a place, and camera-only miniature updates traversed all persisted pixels. Both were reproduced RED and fixed in one batch. Substantive/source-linked drafts remain preserved; the miniature now keeps cached artwork separate from its moving viewport. Full units322/38, typecheck/build and exact-head CI atf985c5e pass. The final broad run and post-merge public proof remain release gates. A repeated browser run reached the existing daily upload guard; only this task's12 verified, withdrawn fixture uploads were credited back, using an exact-bucket compare-and-swap and a private idempotent receipt. No public limit or unrelated usage was reset. The source-backed design record was merged into the incumbent .21st files after the correction.
