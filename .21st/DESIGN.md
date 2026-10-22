# Memory Box design context

The authoritative structured context is [design.json](./design.json). The user authorized the pixel toybox refinement on2026-10-22.

Memory Box is a collaborative canvas containing shared pixels, authored notes and photos, build-on relationships, live cursors, and source-backed Find/Ask. The canvas is the experience; controls must help someone contribute and discover without surrounding it with promotional copy.

## Visual decisions

- Warm white/pastel canvas with plum ink. Pixelify for the wordmark and short control labels; Schibsted for forms and readable longer text; Caveat for handwritten notes.
- Original32px colored pixel objects for the six main tools. Installed Pixelarticons for smaller utility controls. Reuse Base UI Tooltip on native buttons.
- Soft raised surfaces and clear active states. Stationary hit targets, visible labels, keyboard focus, reduced motion and safe-area spacing.
- Hovering the dock changes only artwork: at most2px travel and6% magnification. No idle loops. No added animation runtime.
- Compact pixel chrome: a56px header,344×58px dock,316px desktop panels, butter-yellow stepped primary actions and lilac tabs. Keep six tool labels visible and mobile targets at least44px. Mobile editors use bounded, scrollable sheets; the draw kit is shorter to preserve drawing space. Empty paint controls and persistent gesture instructions do not cover the canvas.
- Authored pixels, text, images, colors, positions and relationships stay intact. Presence and activity reflect actual events.

## Living mosaic

The 2026-10-22 extension makes discovery part of the actual mosaic. Papers, photos, image frames and body snippets keep their physical world sizes at every zoom; distance never replaces them with generic pins or screen-sized title tiles. The initial campus overview uses 0.4 zoom on phones and 0.45 on desktop while preserving the campus center. Whole patch, Wander and Up close change distance around the current place; Explore frames all occupied content.

Wander selects real stored originals absent from its recent visit history when available, preferring non-starters within that unseen pool. It frames a nearby neighborhood and opens a compact spatial preview with Read, Build on and Next actions. Canvas clicks use the same preview. Read and search citations retain the full reader; returning to search restores the camera, results position and focus. Closing a preview restores its visible invoker or the Wander control.

Build on reuses the controlled text/photo/link composer beside its actual source on desktop. On phones, the scrollable reply sheet stays above the dock and is bounded to 60dvh and 440px; neighborhood framing leaves the source visible above it, including on short screens. Mobile preview controls retain 44px targets. Resuming a build-on draft restores its controlled content and, while the parent exists, its actual parent neighborhood. Source labels use authored title/body text or factual type-and-author fallbacks, including untitled photos. A saved child returns to its spatial preview; visible threads represent explicit stored build-on links and emphasize the selected relationship.

Only originals newly received or changed after the initial snapshot receive an arrival outline, limited to 12 at once for 1800ms. Initial content does not animate; reduced motion uses a static outline. Real cursors and painting keep their existing separate canvas layers. Preserve the white/pastel pixel materials, compact chrome and authored positions without fabricated participants, stories, activity or relationships. This extension adds no rendering or motion library and no database migration.

## Open builds

Open builds reuse authored text, photos and links within the existing white/pastel pixel materials. The optional native checkbox, “Invite people to build here”, sits below the writing artifact inside a label with a 44px minimum height. Selecting it changes the writing prompt to ask what people can help make and shows the Together/closure helper. Together's “Start a build here” opens that same controlled composer with the invitation selected; the existing placement confirmation publishes it.

Together shows actual current invitations, newest first, before the preset patches. A live-painter shortcut appears only when a live painter exists. Canvas invitations carry a small lilac “Open build” pixel badge, and result metadata identifies them as open builds. Previews and full readers offer “Join this build” for invitations while ordinary originals retain Build on.

Joining opens a compact workbench anchored to the actual original. It shows the source label, author, request and reference photo when present, with a full-width butter Paint here action, secondary note/photo actions, and Read original, Meet here and Other builds links. Pixelify headings and labels, readable body type, lilac surfaces and existing stepped buttons extend the incumbent controls. On phones at widths up to 700px, the floating workbench and reply sheets reserve 82px for the dock, retain the source above them, scroll within the existing 60dvh/440px bound and keep mobile actions at least 44px tall.

Paint uses the real shared pixel plane and existing preview, save, cooldown and undo behavior, with a compact Back to build action. Each accepted paint save captures its actual build source; a later attached memory uses that saved source while it still exists, rather than whichever build is currently open. Notes and photos reuse the controlled source-linked composer and explicit stored build-on relationships with their own authorship. Joining indicates navigation to tools, without implying membership, completion or contributor counts.

A closed invitation shows its closed status and can still open the original. A removed source shows that it is unavailable. Both offer Other builds and leave the shared canvas and other authors' contributions intact; unavailable workbenches cannot start new responses. The extension adds no library, font, art asset or replacement design system.

## Sources

Visual tokens: `src/app/compact-ui.css` owns the compact controls, on top of `toybox.css`, `globals.css`, `living-mosaic.css`, and `poppy-canvas.css`.

Spatial materials, visible threads, story overlays and bounded arrival feedback: `src/app/spatial-mosaic.css`.

Components: `canvas-dock.tsx`, `pixel-tool-icon.tsx`, `tool-button.tsx`, `box-mark.tsx`, `memory-card.tsx`, `story-peek.tsx`, `build-workbench.tsx`, and `memory-composer.tsx`.

Spatial behavior: `src/components/world-canvas.tsx`, `src/components/memory-box-app.tsx`, `src/lib/client/story-neighborhood.ts`, `src/lib/client/canvas-levels.ts`, `src/lib/client/story-discovery.ts`, and `src/lib/client/memory-presentation.ts`.

Open-build materials and discovery: `src/app/open-builds.css` extends the compact/spatial controls; `src/lib/client/build-invitations.ts` selects actual current invitations. `src/components/memory-box-app.tsx` owns the anchored workbench, existing contribution flows and saved-paint source, while `src/lib/client/story-neighborhood.ts` owns the shared mobile dock clearance.

Assets: `public/favicon.svg`, `public/cursors/*.svg` and self-hosted fonts.

Creation materials: `paint-kit.tsx`, `memory-composer.tsx`, `playground.css`, and `composer-kit.css`. Draw/Stamps has named pigment tiles and accurate pixel previews; text is composed on the selected paper and photos share a frame with their captions. Keep optional prompts separate from authored content. Accepted saves alone receive bounded world-positioned confirmation; reduced motion uses a static check. The mobile drawing kit is shorter than the stamp browser so the user retains drawing space.

Research, reference comparisons, tradeoffs and the motion contract: [Pixel toybox](../docs/specs/2026-10-22-pixel-toybox.md).

Creation-surface research and motion decisions: [Creative kit research](../docs/research/2026-10-22-creative-kit.md) and [implementation contract](../docs/specs/2026-10-22-creative-kit.md).

Living mosaic contract and implementation plan: [Living mosaic discovery](../docs/superpowers/specs/2026-10-22-living-mosaic-design.md) and [implementation plan](../docs/superpowers/plans/2026-10-22-living-mosaic.md).

Open-build direction contract: [Open builds on the shared canvas](../docs/superpowers/specs/2026-10-22-open-builds-design.md).
