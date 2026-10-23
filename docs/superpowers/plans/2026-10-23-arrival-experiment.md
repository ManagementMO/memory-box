# Arrival experiment implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Ship two real arrivals and trustworthy PostHog contribution/return measurement.

**Architecture:** Pure camera functions select views of the existing world. A small analytics controller owns SDK setup, bounded flag resolution, anonymous session lifecycle, privacy filtering and success deduplication. The canvas reports actual initialization; the app reports explicit accepted actions. No database change.

**Tech Stack:** Existing Next.js 16.4, React 19, TypeScript, Vitest, Playwright; pinned posthog-js.

**Spec:** `docs/superpowers/specs/2026-10-23-arrival-experiment-design.md`

## Global constraints
- Preserve the white/pastel pixel style, authored positions and real presence.
- Shared links and saved views precede experiment arrivals.
- Maximum flag wait 1000ms; no late camera jump or fabricated exposure.
- No content, queries, coordinates, auth identifiers or URLs in analytics.
- Production canonical hostname only; QA/developer/automation excluded.
- Accepted saves only; browser-storage failures cannot break the canvas.

## Review focus
- Slow/blocked flags must not change an already displayed camera.
- Strict Mode and retries must not double count exposures or accepted saves.
- SDK events must be rejected; explicit capture passes the content allowlist.
- Shared links, corrupt storage and pixel-only/empty worlds need working arrivals.
- New sessions in another tab must not manufacture return/first-arrival events.

### Task 1: Camera and analytics contracts
- [x] Write failing tests in `tests/arrival-experiment.test.ts` and `tests/product-analytics.test.ts` for both cameras, empty worlds, exposure precedence, bounded flags, session boundaries, allowed payloads and success deduplication; run them red.
- [x] Implement `arrivalCamera(world, areas, viewport, variant)` alongside established camera behavior in `src/lib/client/canvas-arrival.ts`.
- [x] Implement `src/lib/client/product-analytics.ts` and `src/lib/client/use-arrival-experiment.ts`, with a testable SDK adapter, transport allowlist, opt-out and stable lifecycle.
- [x] Pin posthog-js; run focused tests green and typecheck.

### Task 2: Real app integration and design
- [x] Add regression coverage for actual first canvas initialization, links and saved views.
- [x] Wire arrival selection/reporting into `world-canvas.tsx`; wire accepted saves, discovery, return visits, shares and profile measurement settings into `memory-box-app.tsx` and the existing share panel.
- [x] Preserve the existing controls/materials; keep actual photos and paper silhouettes legible at overview distance and the readable neighborhood at nearby distance.
- [x] Add desktop/mobile browser tests for both previews and intercepted PostHog events, including accepted text/photo/painting/build-on, failed saves, opt-out and analytics unavailable.

### Task 3: Configure, verify and release
- [x] Configure PostHog project/flag/experiment and contribution/retention dashboard using available authorized account access; set Vercel public project token/host without committing secrets.
- [x] Run unit suite, typecheck, production build and relevant existing desktop/mobile regression tests; inspect batched screenshots and fix actual defects.
- [x] Review the whole diff with a fresh reviewer and address actionable issues.
- [ ] Push branch and open/attach PR; wait for CI and preview.
- [ ] Merge authorized PR, verify Git parity, production readiness and both live arrivals. Start the experiment after live measurement checks, excluding QA traffic; document actual evidence and remaining limits.

Release completion is recorded on the merged pull request so its final merge SHA, CI and deployment can be verified after this source document is committed.
