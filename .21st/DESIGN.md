# Memory Box design context

The authoritative structured context is [design.json](./design.json). The user authorized the pixel toybox refinement on2026-10-22.

Memory Box is a collaborative canvas containing shared pixels, authored notes and photos, build-on relationships, live cursors, and source-backed Find/Ask. The canvas is the experience; controls must help someone contribute and discover without surrounding it with promotional copy.

## Visual decisions

- Warm white/pastel canvas with plum ink. Pixelify for the wordmark and short control labels; Schibsted for forms and readable longer text; Caveat for handwritten notes.
- The literal canvas background keeps a gentle butter, blush, lilac and pale-blue gradient wash beneath the pixel dots and authored work, including open ground away from occupied places. Keep it static, viewport-sized and non-interactive at every zoom; forced-color mode uses the system canvas color. The color is atmosphere, never saved artwork or activity.
- Original32px colored pixel objects for the six main tools. Installed Pixelarticons for smaller utility controls. Reuse Base UI Tooltip on native buttons.
- Soft raised surfaces and clear active states. Stationary hit targets, visible labels, keyboard focus, reduced motion and safe-area spacing.
- Hovering the dock changes only artwork: at most2px travel and6% magnification. No idle loops. No added animation runtime.
- Compact pixel chrome: a56px header,344×58px dock,316px desktop panels, butter-yellow stepped primary actions and lilac tabs. Keep six tool labels visible and mobile targets at least44px. Mobile editors use bounded, scrollable sheets; the draw kit is shorter to preserve drawing space. Empty paint controls and persistent gesture instructions do not cover the canvas.
- Authored pixels, text, images, colors, positions and relationships stay intact. Presence and activity reflect actual events.

## Living mosaic

The 2026-10-22 extension makes discovery part of the actual mosaic. Papers, photos and image frames keep their physical world sizes at every zoom; distance never replaces them with generic pins or screen-sized title tiles. World view hides paper lettering and small metadata while preserving actual paper/photo/pixel footprints; Nearby and Close-up restore readable details. The desktop arrival frames occupied places without letting distant outliers shrink the nearby cluster. First-time phones arrive at a readable original in an occupied place, preferring community stories with authored context. Empty and pixel-only worlds use bounded fallbacks. World, Nearby and Close-up change distance around the current place; Explore opens the map and frames occupied content.

The phone's single View controls disclosure shows the current distance and percentage. It contains the three distance presets, zoom, pan and fit; closed tools have no keyboard targets. Escape or choosing a preset restores disclosure focus. Map, Meet here and presence share one compact top row with 44px targets. A debounced local return view stores only public center/scale scoped to the world and epoch; corrupt or blocked storage is harmless, and a shared place link wins over that saved location.

Wander selects real stored originals absent from its recent visit history when available, preferring non-starters within that unseen pool. It frames a nearby neighborhood and opens a compact spatial preview with Read, Build on and Next actions. Canvas clicks use the same preview. Read and search citations retain the full reader; returning to search restores the camera, results position and focus. Closing a preview restores its visible invoker or the Wander control.

Build on reuses the controlled text/photo/link composer beside its actual source on desktop. On phones, the scrollable reply sheet stays above the dock and is bounded to 60dvh and 440px; neighborhood framing leaves the source visible above it, including on short screens. Mobile preview controls retain 44px targets. Resuming a build-on draft restores its controlled content and, while the parent exists, its actual parent neighborhood. Source labels use authored title/body text or factual type-and-author fallbacks, including untitled photos. A saved child returns to its spatial preview; visible threads represent explicit stored build-on links and emphasize the selected relationship.

Only originals newly received or changed after the initial snapshot receive an arrival outline, limited to 12 at once for 1800ms. Initial content does not animate; reduced motion uses a static outline. Real cursors and painting keep their existing separate canvas layers. Preserve the white/pastel pixel materials, compact chrome and authored positions without fabricated participants, stories, activity or relationships. This extension adds no rendering or motion library and no database migration.

## Open builds

Open builds reuse authored text, photos and links within the existing white/pastel pixel materials. The optional native checkbox, “Invite people to build here”, sits below the writing artifact inside a label with a 44px minimum height. Selecting it changes the writing prompt to ask what people can help make and shows the Together/closure helper. Together's “Start a build here” opens that same controlled composer with the invitation selected; the existing placement confirmation publishes it.

Together shows actual current invitations, newest first, before the preset patches. A live-painter shortcut appears only when a live painter exists. Canvas invitations carry a small lilac “Open build” pixel badge, and result metadata identifies them as open builds. Previews and full readers offer “Join this build” for invitations while ordinary originals retain Build on.

Joining opens a workbench anchored to the actual original. Its full state shows the source label, author, request and reference photo when present, with a full-width butter Paint here action, secondary note/photo actions, and Read original, Meet here and Other builds links. Collapse build details keeps the real source title and three short Paint/Note/Photo actions; Expand build details restores the request. The choice survives same-source Paint/Back to build and resets for a different request. An unfinished linked Note or Photo resumes before another build tool can replace its text, selected image or source. Pixelify labels, readable body type, lilac surfaces and existing stepped buttons extend the incumbent controls. On phones up to 700px, the workbench reserves 82px for the dock, retains the source above it and scrolls within min(50dvh, 380px); compact mode occupies about 110px. Reply sheets retain their 60dvh/440px bound. Mobile actions remain at least 44px tall.

Paint uses the real shared pixel plane and existing preview, save, cooldown and undo behavior, with a compact Back to build action. Each accepted paint save captures its actual build source; a later attached memory uses that saved source while it still exists, rather than whichever build is currently open. Notes and photos reuse the controlled source-linked composer and explicit stored build-on relationships with their own authorship. Joining indicates navigation to tools, without implying membership, completion or contributor counts.

A closed invitation shows its closed status and can still open the original. A removed source shows that it is unavailable. Both offer Other builds and leave the shared canvas and other authors' contributions intact; unavailable workbenches cannot start new responses. The extension adds no library, font, art asset or replacement design system.

## Continuous world of places

The atlas extends one continuous finite sparse plane, from -60000 to 59999 world units, within the existing white/pastel pixel identity. Places describe actual geographic occupancy. Existing landmarks appear only while nearby stored originals or pixels exist; occupied cells elsewhere take a factual name from an original or the pixel-only fallback. Each original or pixel belongs to one place. Surviving pixels keep a place visible after its last original is removed, and an empty world has no invented destinations.

Geography is a faint layer beneath the authored pixels, papers and photos: irregular stepped pastel contours, fine dotted edges and restrained dotted travel trails. Small original pixel emblems identify places without becoming saved artwork. These geographic marks convey wayfinding, not build-on relationships. Place labels retain a readable screen size at world and neighborhood distances, declutter against one another and the controls, and hide up close or while reading, painting, placing or using a panel. The three existing distance controls keep the current place centered and preserve the actual materials.

Authored notes and photos retain click and drag priority over geographic wayfinding on desktop and mobile. The transformed authored layer sits above place labels (z-index 1 versus 0), so wayfinding cannot intercept a paper/photo click or drag. Label lettering also requires clear space: a bounded search tries at most 10 nearby screen-space positions, respects viewport/control margins and spacing around accepted labels, and rejects projected paper, photo or shared-pixel occupancy. If no clear position exists, the label hides. The Map control remains at z-index 15; the transparent cursor layer remains at 11 with pointer events disabled.

Explore opens the compact World map and frames the occupied world. A miniature shows actual shared pixels and paper/photo footprints, with a dashed lilac rectangle for the current viewport. Its base artwork redraws only when content or map size changes; camera updates use a separate transparent viewport canvas. The destination list is the keyboard/touch alternative to miniature travel, with wrapping Pixelify place names, stepped pastel emblems and factual original/open-build metadata. Pixel-only places say Pixel artwork. Visiting closes the map, frames the actual place and returns focus to the small Map control.

The Map control uses an original map emblem, Pixelify label and the current place in readable body type on desktop. On phones it keeps only the emblem and Map label in a compact 44px-high target at the left, in the same row as Meet here and presence. The desktop map is 318px wide with a 185px miniature. At widths up to 700px, the map becomes a bounded sheet above the dock with an 82px bottom reservation, a maximum height of min(68dvh, 490px), and a 150px miniature. List rows are at least 56px high on mobile; Start a place and all mobile panel actions retain at least 44px targets. Preserve visible keyboard focus and the inherited reduced-motion camera behavior.

At most six occupied places show real activity. Initial history, unchanged polling, older snapshots and epoch resets are quiet. A later accepted original/version or pixel revision creates a New original or New pixels signal for 12 seconds. Painting requires a real fresh drawing gesture, expires within the existing two-second stroke lifetime and points to an actual stroke cell; hovering, panning or returning to a retained preview cannot renew it. Compact coral-on-blush marks appear on the map, as independent list actions and in clear-space geographic labels. They lead to the actual original or painted point, and closing an original preview returns focus to Map. Marker arrival has one 420ms animation and no idle loop; reduced motion is static. Activity changes do not invalidate the miniature artwork cache.

Start a place uses the existing butter stepped primary action. It suggests nearby empty ground inside the write plane, frames it and opens the existing invitation composer without publishing. The visitor authors the name/request and explicitly chooses and confirms placement. A pristine empty unlinked draft may be replaced by that explicit action; drafts containing text, a URL, an image/file/preview, an edit, a build-on source or a saved-paint link resume instead. Staged paint returns to the paint tool to be added or cleared. Travel and discovery preserve parked drafts, authored positions and ownership.

Wander gives occupied places a turn before a dense place dominates: it prefers unseen originals, community originals within that pool, and another eligible place before revisiting the current one. It opens an actual original through the existing spatial preview. The main pixel layer queries a cached sparse index for the visible region; temporary paint previews and real cursors retain their own redraw behavior. Label occupancy reuses that pixel index and a cached paper/photo-bounds index padded for tilt. Occupancy checks stop at the first hit, while ordinary index queries retain their complete results. The pilot still receives full snapshots. This extension establishes no population-scale claim, new topic categories, fabricated activity, dependency, font or database migration.

## Sources

Pilot participation keeps the same materials and canvas geometry. At World distance, unselected originals lead with paper/photo silhouettes; selecting still reveals an original through its existing readable preview. The compact pin in the header opens **Your places**, with a blank visitor-authored name field, actual local change comparisons and explicit return acknowledgement. Unfinished work appears only when recoverable work exists. Creation tools distinguish local browser recovery, a pending local image copy and storage failure. Together offers editable unpublished starter prompts when no open invitations exist; it never invents an active build. See `participation.css`, `saved-places.css`, the recovery/saved-place components and the pilot participation design.

Visual tokens: `src/app/compact-ui.css` owns the compact controls, on top of `toybox.css`, `globals.css`, `living-mosaic.css`, and `poppy-canvas.css`.

Spatial materials, visible threads, story overlays and bounded arrival feedback: `src/app/spatial-mosaic.css`.

Components: `canvas-dock.tsx`, `pixel-tool-icon.tsx`, `tool-button.tsx`, `box-mark.tsx`, `memory-card.tsx`, `story-peek.tsx`, `build-workbench.tsx`, and `memory-composer.tsx`.

Spatial behavior: `src/components/world-canvas.tsx`, `src/components/memory-box-app.tsx`, `src/lib/client/story-neighborhood.ts`, `src/lib/client/canvas-levels.ts`, `src/lib/client/story-discovery.ts`, and `src/lib/client/memory-presentation.ts`.

Arrival, validated local return views and actual activity: `src/lib/client/canvas-arrival.ts`, `src/lib/client/world-activity.ts`, `src/lib/client/use-world-activity.ts` and the existing `src/lib/client/presence-state.ts`. Activity marks reuse `--ui-live-ink` and `--ui-live-paper` in `src/app/compact-ui.css`.

Open-build materials and discovery: `src/app/open-builds.css` extends the compact/spatial controls; `src/lib/client/build-invitations.ts` selects actual current invitations. `src/components/memory-box-app.tsx` owns the anchored workbench, existing contribution flows and saved-paint source, while `src/lib/client/story-neighborhood.ts` owns the shared mobile dock clearance.

Continuous-world materials and controls: `src/app/world-atlas.css`, `src/components/world-geography.tsx` and `src/components/world-map.tsx` own the stepped geographic ground, move-or-hide distance labels, map emblem, bounded map panel, destination list and separate miniature/viewport canvases. `src/components/world-canvas.tsx` layers geography beneath authored materials and supplies cached pixel and padded paper/photo occupancy queries through `src/lib/client/spatial-index.ts`; the index supports an optional result limit for bounded occupancy checks. `src/lib/client/world-atlas.ts` derives occupied places, open-ground suggestions and place-aware Wander choices. `src/components/memory-box-app.tsx` owns travel, focus return, draft/paint guards and the unpublished invitation flow. `src/lib/client/canvas-levels.ts` and `src/lib/world-bounds.ts` define the existing distance presets and finite write plane.

Assets: `public/favicon.svg`, `public/cursors/*.svg` and self-hosted fonts.

Creation materials: `paint-kit.tsx`, `memory-composer.tsx`, `playground.css`, and `composer-kit.css`. Draw/Stamps has named pigment tiles and accurate pixel previews; text is composed on the selected paper and photos share a frame with their captions. Keep optional prompts separate from authored content. Accepted saves alone receive bounded world-positioned confirmation; reduced motion uses a static check. The mobile drawing kit is shorter than the stamp browser so the user retains drawing space.

Research, reference comparisons, tradeoffs and the motion contract: [Pixel toybox](../docs/specs/2026-10-22-pixel-toybox.md).

Creation-surface research and motion decisions: [Creative kit research](../docs/research/2026-10-22-creative-kit.md) and [implementation contract](../docs/specs/2026-10-22-creative-kit.md).

Living mosaic contract and implementation plan: [Living mosaic discovery](../docs/superpowers/specs/2026-10-22-living-mosaic-design.md) and [implementation plan](../docs/superpowers/plans/2026-10-22-living-mosaic.md).

Open-build direction contract: [Open builds on the shared canvas](../docs/superpowers/specs/2026-10-22-open-builds-design.md).

Continuous-world direction contract: [A continuous world of places](../docs/superpowers/specs/2026-10-22-world-atlas-design.md).

Finishing direction contract: [Canvas finishing](../docs/superpowers/specs/2026-10-22-canvas-finishing-design.md).
