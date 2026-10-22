# Living Mosaic Implementation Plan

> **For agentic workers:** Implement in this session using the approved scope. Check each task and obtain one fresh review before release.

**Goal:** Reveal the actual shared mosaic at a distance, land Wander among originals, and anchor build-on to its source.

**Architecture:** Keep React DOM originals and the existing Canvas2D pixel/cursor layers. Add pure camera/overlay geometry, a compact story preview and a positioned wrapper around the existing composer. Keep all authored data and publication APIs intact.

**Tech Stack:** Existing Next.js, React, CSS, Vitest and Playwright.

**Spec:** ../specs/2026-10-22-living-mosaic-design.md

## Global Constraints

Preserve white/pastel pixel styling, real positions and authorship. No fabricated activity, new motion runtime or database migration. Preserve search citations, draft recovery, touch targets and reduced motion.

## Review Focus

- Tiny or signed-coordinate worlds: the chosen original stays visible and the overlay stays inside the viewport.
- Removed parents: drafts remain recoverable and publication cannot invent a missing relationship.
- Full reader/source return: existing camera, query, focus and scroll restoration remain intact.
- Busy/offline states: previews remain recoverable and controls cannot double-publish.
- Realtime cursor movement: the change must not redraw all artwork on every cursor message.

### Task 1: Spatial discovery geometry

- [x] Add failing tests for `neighborhoodCamera` and `floatingStoryPosition` in `tests/story-neighborhood.test.ts`, including outliers, narrow screens and signed coordinates.
- [x] Implement pure geometry in `src/lib/client/story-neighborhood.ts`.
- [x] Run focused tests and record the result.

### Task 2: World and contribution flow

- [x] Add the story preview and anchored overlay to WorldCanvas. Preserve input exclusions and full-reader behavior.
- [x] Route Wander and ordinary canvas clicks through the preview; route Build on to the existing spatially anchored composer. Save children back into the preview.
- [x] Replace distant icon-map CSS with actual paper/photo content. Start at overview; add a bounded real-update highlight.
- [x] Verify focused tests and the complete unit/type/build checks.

### Task 3: Interaction, review and release

- [x] Verify desktop/mobile mosaic, wandering, source reading, notes/photos, draft cancellation and real two-visitor building through the existing browser fixture.
- [x] Batch visual inspection, one corrective batch and confirmation. Run the design detector once.
- [x] Obtain a fresh branch review, address material findings and update design context.

## Verification before release

The final built app passed 286 unit tests across 33 files, type checking, the production build, and all 34 browser scenarios with one worker. The browser suite covered both desktop and mobile, real notes/photo replies and ownership, painting/undo, live cursors, provider-backed Ask, source return, draft recovery, preview focus and the three canvas distances. Test resources were withdrawn with the existing exact-owner/revision fixture cleanup.

The independent reviewer scored all four correction findings resolved: parked reply neighborhood, preview focus return, factual untitled-photo source labels and short-phone writing space. The 320×640 capture exposed 155px of the textarea with the complete source above the sheet. Twelve local captures are retained in the ignored `.impeccable/review/` directory. The design detector ran once and returned no findings.

An earlier parallel hosted test run encountered database statement timeouts. No blocking query was observed. Reads recovered after stopping that run, and exact fixture recovery completed. The final complete suite above passed sequentially; this is functional verification, not a load-capacity measurement. No database migration or timeout workaround was added.

The release sequence is push, create and attach the PR, wait for CI and the preview deployment, squash merge the exact tested head, then verify production alias/commit parity, health and the key public interactions. GitHub checks and deployment state record those external gates.
