# Poppy Canvas Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement the checked tasks in sequence. Request an independent code review before release.

**Goal:** Bring the approved white/pastel pixel mockup into the actual desktop/mobile app with readable zoom levels and genuine collaboration.

**Architecture:** Retain the existing signed sparse world, private uploads, original/build-on relationships, realtime cursor hints and server paint turns. Add camera presets and zoom-dependent memory presentation without moving persisted originals. Add a small versioned insert-only starter cluster and pixel accents, using the existing trusted starter asset path; it is labeled fictional and never creates live participants.

**Tech Stack:** Existing Next.js/React, CSS, native canvas and Supabase. No new runtime dependencies or database schema changes expected.

**Spec:** User-approved `memory-box-poppy-patch.html` in this chat's visualization directory, plus the explicit implementation request. The simulated collaborators and example Ask answer are not production features.

## Tasks

- [x] Add tested camera presets (`Whole patch`, `Wander`, `Up close`) that retain the current world center; closer campus arrival requires its persisted anchor. Keep global World, free pan/pinch, keyboard controls and source/camera return.
- [x] Add stable expressive text/photo/link materials and a readable title/fragment/pixel hierarchy across overview, wandering and close views. Keep original bodies, authors, ownership and source links unchanged.
- [x] Carry the approved warm-white, pink/coral/lilac/yellow/cobalt system into controls, readers, paint tools and actual cursor labels. Keep drawing and note/photo composition usable at320px.
- [x] Prepare and independently review a separately versioned six-original/photo starter cluster plus small editable pixel accents. Preserve every preexisting row, enforce provenance and make repeat imports no-ops. All new stories/photo are illustrative, labeled starters.
- [x] Verify unit/type/build, then one batched desktop/mobile browser/visual pass with real independent visitors: zoom/pan, cursor/paint preview and save, private photo, notes, build-on, search/Ask/source return. Clean exact fixtures; fix the findings together and confirm once.
- [x] Independent review, source/CI checks, staged production deployment, controlled additive import and indexing, promotion, final public health and representative desktop/mobile behavior. Record exact release evidence and screenshots.

## Invariants

- A displayed pixel's color is its stored color. Do not recolor or cover visitors' shared work with decorative canvas art.
- Presentation does not move, rewrite or reattribute originals. Presets alter camera scale around a fixed center.
- Membership and cursors come from actual connected sessions. Preview hints never authorize durable writes.
- Keep15-second/144-cell painting rules, retries, partial undo, upload privacy, source lifecycle and grounded answers.
- The new campus photo is an illustrative generated asset, explicitly disclosed as a fictional starter; existing starter payloads/hashes are immutable.
- All external service checks use supported auth; secrets stay in ignored local files or browser sessions. No personal browser storage is exported.
