# Waterloo Commons Implementation Plan

> User authority: the user explicitly requested research and implementation of a Waterloo starting community, with funny collaborative r/place energy, miscellaneous contributions and meaningful painting stakes. Earlier autonomous implementation/release authorization remains in effect. Builder choices below are defaults to test, not user-specified timing values.

**Goal:** Make the first visit a recognizably Waterloo shared mess, with scarce painting turns and personal originals mixed into the same world.

**Architecture:** Preserve the existing signed sparse world, attributed originals, ephemeral presence and grounded Find/Ask. Add one separately versioned, insert-only campus import and spatial arrival metadata. Enforce a 15-second paint cadence atomically in the existing Postgres paint transaction, including its receipt/retry semantics, with accurate client timing.

**Tech Stack:** Existing Next.js/React, Supabase, canvas and DOM originals; no new runtime dependency.

## Design and constraints

- Keep white/pastel paper, existing pixel display/body fonts, quiet cobalt controls; spend black/gold in small campus artifacts and context.
- Make an unfinished goose/tie/maze/sauce/commute corner the signature. Let participants add current memes and arbitrary nonsense; no required faculties, rigid topic categories or invented popularity.
- Research sources: UW Pink Tie history and current orientation, UW CS goose reporting, EngSoc traditions, mathNEWS, Imprint, campus transportation/Turnkey; source links in the research deliverable.
- Keep all94 existing originals and9930 cells unchanged by import. Do not modify the successful old seed payload/hash.
- Starter content is original fictional material with explicit seed provenance. Do not copy student posts, create fake live users or imply University endorsement.
- Initial arrival frames the Waterloo patch only when its persisted anchor exists. World still fits everything; Wander still reaches all originals.
- A painting turn saves at most144 cells. A successful new forward paint starts15seconds of cooldown. Invalid requests and idempotent retries do not spend another turn. Different actors have independent turns.
- One immediate undo may repair a mistake; undo receipts cannot be undone to bypass cadence. Later edits retain existing partial-undo protection.
- Timer comes from server timing; changes in device wall clock, reload, another tab or an API call cannot bypass server enforcement. Preserve drafts/previews/idempotency keys on rejection.
- Notes, photos, build-on, wandering and search remain available while paint refills. Never auto-publish a staged preview when the timer expires.

## Tasks

- [ ] Server turn transaction, authenticated timing endpoint, exact429 response, max144 validation and undo bypass fix; focused HTTP and rollback database/concurrency tests.
- [ ] Original Waterloo content, authored SVGs, editable unfinished pixel motifs, safe insert-only import and repeat/provenance tests.
- [ ] Client monotonic timer and error handling; both brush buttons and shape placement; initial campus framing and dynamic invitation; campus discovery prompts and compact mobile feedback.
- [ ] Unit/type/build and focused real-browser verification on desktop/mobile: paint/save/wait, preview preservation, independent visitor/reload, continued note composition, existing collaboration/Find/Ask.
- [ ] Independent change review; apply narrowly reviewed migration/import; deploy verified build; confirm live behavior, preservation hashes, no-op import, indexing status, CI/source parity and actual captures.

## Review focus

- Same-operation replay during cooldown, races across tabs, undo-of-undo and invalid writes.
- Late GET timing must not clear a newer accepted turn; timers cannot trust device Date.now.
- Campus import marker collisions and all preexisting rows; anchor absent/removed gracefully falls back to original occupied arrival.
- Timer labels/actions must fit320px; drawing remains enabled; source reader and placement controls stay usable.
- Distinguish current official facts, student-publication vernacular, fictional seed writing and actual live participation in the handoff.
