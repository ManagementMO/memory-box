# Pilot Participation Implementation Plan

> **For agentic workers:** Use focused test-first implementation; independent operator, saved-place and quality work can proceed in parallel. Integrate and review the complete branch before release.

**Goal:** Protect contribution effort and make collaborative places easier to join and revisit.

**Architecture:** Versioned local recovery and bookmark helpers sit beside existing creation flows. Server-authorized operator tools reuse moderation transactions. Content-derived HTTP validators reduce repeated snapshot transfer without hiding indexing changes.

**Tech Stack:** Existing Next.js 16 / React 19, TypeScript, Supabase, browser storage, Vitest and Playwright.

**Spec:** [Pilot participation design](../specs/2026-10-26-pilot-participation-design.md).

## Global constraints

- Preserve white/pastel pixel materials, canvas geography and guest authorization.
- No experiment settings, allocations, metrics or analytics payload changes.
- No published prompts or external outreach; previews and fixtures are not adoption.
- New controls remain compact, readable and usable on desktop/mobile.

## Review focus

- Reload during a failed save retains stable operation IDs and complete authored work.
- A second tab cannot overwrite another tab's recovery or acknowledge unseen bookmark changes.
- Storage denial and missing local photo files produce honest recovery states.
- Index-only changes invalidate world validators despite an unchanged revision.
- A guest cannot read reports, hidden originals or operator image previews.

## Tasks

- [x] Recovery: test serialization, malformed records, world/guest scope and independent recovery IDs; implement local text/paint persistence and IndexedDB photo storage; integrate explicit restore/discard and accepted-save cleanup.
- [x] Contribution clarity: test that every creation entry preserves a parked draft; add unpublished build prompts and save-state labels, keep existing two-stage placement.
- [x] Return loop: test real snapshot baselines and removals; integrate saved places, save-current-place and explicit visit acknowledgement with no forced arrival movement.
- [x] Distance refinement: reduce distant lettering using readable thresholds while retaining material silhouettes, photos, accessible original labels and selected content.
- [x] Operator queue: test authorization and failures, implement protected source context, hide/restore, and separate private report-resolution transactions with revocation/concurrency tests.
- [x] Quality tooling: test content validators, transport 304 handling and evaluation scoring; run a bounded snapshot benchmark and document an uncoached pilot protocol. Larger-scale capacity and real community relevance remain separate evidence gates.
- [x] Integration: run full tests/typecheck/build, desktop/mobile recovery/build/search checks, detector and fresh code review; fix material findings and record evidence in [the verification record](../../review/2026-10-27-pilot-participation.md).

Release through the project’s existing GitHub PR/CI and Vercel production-branch workflow. Verify the production commit, health, private operator denial, actual recovery and conditional snapshot behavior before calling the batch shipped. Release status belongs to the PR, deployment metadata and final live check, not the presence of a local implementation checkbox.
