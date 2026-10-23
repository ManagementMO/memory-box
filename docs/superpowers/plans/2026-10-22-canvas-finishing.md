# Canvas Finishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make arrival, distance, building and actual activity clearer while giving the shared canvas more room.

**Architecture:** Extend existing client geometry/state and React surfaces. Pure arrival/storage and activity functions isolate decisions; the canvas and map reuse their cached rendering and actual hosted snapshots/presence. Keep existing contribution pipelines.

**Tech Stack:** Existing Next.js/React/TypeScript, CSS, Vitest and Playwright.

**Spec:** docs/superpowers/specs/2026-10-22-canvas-finishing-design.md (user-approved chat direction).

## Global Constraints

- Preserve existing pastel pixel identity, authored coordinates, drafts, ownership, links, collaboration, search/Ask and cooldowns.
- Touch targets >=44px at widths <=700px; support 320px, keyboard focus and reduced motion.
- No new dependency, font, seed contribution, schema migration or API contract.
- No invented activity; baseline/epoch changes are quiet, saved-change markers expire after 12 seconds, current painting requires fresh real strokes.
- Persist public center/scale only, scoped to world/epoch; shared links take precedence.

## Review Focus

- Corrupt or blocked storage and resize/reload must never lose the legal camera or override a shared link (Task 1).
- Hidden view tools must leave no keyboard targets; Escape and preset selection must restore the disclosure's focus (Task 1).
- Switching tools and source deletion/closure must preserve compact-build state safely without losing drafts or paint attribution (Task 2).
- Polling, initial history, out-of-order snapshots and epoch resets must not fabricate activity; stale or cursor-only presence cannot count as painting (Task 3).
- New presence/marker/camera updates must not invalidate the 17,000-pixel miniature cache; nearby places and overlapping authored material remain operable (Tasks 1/3).

### Task 1: Arrival, saved views and distance controls

**Files:** new src/lib/client/canvas-arrival.ts; modify canvas-levels.ts, world-canvas.tsx, world-geography.tsx and CSS; tests/canvas-arrival.test.ts, canvas-levels.test.ts and world-canvas-rendering.test.ts.

**Interfaces:** consumes actual WorldSnapshot/WorldArea/CameraView; produces initialWorldCamera(world,areas,viewport), encodeCanvasView(world,camera), decodeCanvasView(raw,world,viewport), CANVAS_VIEW_KEY. Existing distance IDs and commands remain stable.

- [ ] Write/run failing regressions for readable phone arrival, desktop overview, empty/pixel-only fallback, validated scoped saved center, malformed storage and explicit-link precedence. Assert visible labels and center-preserving presets.
- [ ] Implement pure helpers and guarded/debounced local persistence; integrate one mobile view disclosure, focus/Escape and a single top map/social row. Simplify far-distance paper detail through scoped CSS.
- [ ] Run focused tests, full units/typecheck, then commit named paths.

### Task 2: Compact build workbench

**Files:** modify memory-box-app.tsx, build-workbench.tsx, open-builds.css; extend tests/build-flow.test.ts and story-neighborhood tests if geometry changes.

**Interfaces:** consumes existing joinedBuild/source state; adds controlled compact:boolean and source-specific header disclosure, retaining existing Paint/Note/Photo callback names and source IDs.

- [ ] Write/run failing real-handler tests for collapse/expand, title/tool visibility, same-source tool round trips, different-source reset, closed/removed source and retained drafts.
- [ ] Implement compact layout and appropriate camera reframing, preserving request access and tool attribution.
- [ ] Run focused/full tests and typecheck; commit named paths.

### Task 3: Spatial live activity and release

**Files:** new src/lib/client/world-activity.ts and use-world-activity.ts; modify memory-box-app.tsx, world-map.tsx, world-geography.tsx, world-canvas.tsx and CSS; add activity/browser regressions and extend map cache tests.

**Interfaces:** activityChanges(previous,next,areas,now) yields actual location-based changes; placeSignals(changes,peers,areas,now) yields <=6 fresh actual place signals; hook owns baseline/expiry. Components accept readonly signals and navigate via actual memory/point.

- [ ] Write/run failing baseline/diff/epoch/expiry/stale-presence tests and marker cache/travel regressions.
- [ ] Implement bounded signals, map markers/list badges and quiet on-canvas label accents without rebuilding miniature artwork for peer or timer changes.
- [ ] Build and run desktop/mobile browser flows, including 320px, reload/shared links, compact building, actual two-person updates/painting/text/photo, cursor expiry and cited Ask. Capture/review one paired matrix, correct in one batch, confirm once and run detector once.
- [ ] Get one whole-branch code review; fix material findings with reproduced regressions. Refresh .21st design records from final source.
- [ ] Push PR, verify exact-head CI/preview, merge into codex/memory-box-mvp, verify exact public deployment and key anonymous flows. Audit and clean only owned fixtures; report release proof.
