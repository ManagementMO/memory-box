# Open world commons

Approved direction: the 21 October white/pastel open-world mockup, followed by the user's explicit request to bring it into the actual desktop/mobile app.

Memory Box remains a shared pixel picture with independently authored text, images and links. People can paint the same cells, leave originals, explicitly build on an original, and retrieve or ask about eligible originals. Source authority, ownership, version checks, moderation, guest identity and existing data must survive the redesign.

Use white paper, dark neutral ink, cobalt controls and butter/lilac/blush/peach/ice memory surfaces. Pixelify supplies the wordmark and a few place headings; Schibsted supplies readable UI and originals. Existing community artwork is preserved. Labeled starter artwork may be refreshed only where exact seed-operation ownership remains, with a recorded reversible diff; visitor-owned cells are skipped. Real events identify contributions; fictional starters remain labeled. No scripted visitors, cursors or model answers enter production.

Canvas navigation pans freely and supports anchored zoom, two-finger pinch, keyboard-accessible movement, focus and return. Saving is supported on a sparse pilot plane: world-pixel coordinates -60000 through59999; grid size6; paint-cell coordinates -10000 through9999. The old1200×720 dimensions describe the starter-place view, not a bitmap allocation or write boundary. Coordinates outside the pilot safety range produce clear feedback. Viewport-sized rendering avoids a giant bitmap. Larger data-volume paging remains separate future scaling work.

Freehand paint stages at most144 unique cells per operation. A preview is visibly pending; Add my pixels calls the existing durable idempotent endpoint. Stamp placement and partial undo remain available. Pan/pinch must never inadvertently paint or publish. Offline/busy states preserve drafts and prevent false acceptance.

Text/photo/link drafts retain their explicit parent and independent author. Placement preview and accepted anchor agree, including negative/zero coordinates. Images retain private staging/sanitization and existing limits. Opening the parent during drafting must offer a route back to that draft.

Find and Ask use real APIs. Source numbering follows the displayed result ordering; cited-source count is distinct from retrieved-candidate count. Opening originals, showing them on the canvas, and returning preserve query/mode/scope/result state and camera. Changed/removed originals still invalidate answers. Ask interprets originals/image descriptions, not arbitrary painted pixels.

Desktop uses a readable side panel. Mobile keeps a usable canvas, readable inputs and an accessible panel below it; Show in canvas reveals the source, and Back restores context. No horizontal page overflow at320px.

Release requires unit/type/build checks, desktop/mobile browser coverage, two independent visitors observing real shared paint, real upload/build-on/retrieval/provider checks, exact-fixture cleanup, independent review and deployed verification. Public budgets are honored. No destructive seed reset or broad clearing is authorized by this redesign.
