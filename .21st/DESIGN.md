# Memory Box design context

The authoritative structured context is [design.json](./design.json). The user authorized the pixel toybox refinement on2026-10-22.

Memory Box is a collaborative canvas containing shared pixels, authored notes and photos, build-on relationships, live cursors, and source-backed Find/Ask. The canvas is the experience; controls must help someone contribute and discover without surrounding it with promotional copy.

## Visual decisions

- Warm white/pastel canvas with plum ink. Pixelify for the wordmark and occasional authored captions; Schibsted for readable interface text; Caveat for handwritten notes.
- Original32px colored pixel objects for the six main tools. Installed Pixelarticons for smaller utility controls. Reuse Base UI Tooltip on native buttons.
- Soft raised surfaces and clear active states. Stationary hit targets, visible labels, keyboard focus, reduced motion and safe-area spacing.
- Hovering the dock changes only artwork: at most5px travel and12% magnification. No idle loops. No added animation runtime.
- Authored pixels, text, images, colors, positions and relationships stay intact. Presence and activity reflect actual events.

## Sources

Visual tokens: `src/app/toybox.css`, on top of the established `globals.css`, `living-mosaic.css`, `poppy-canvas.css`.

Components: `canvas-dock.tsx`, `pixel-tool-icon.tsx`, `tool-button.tsx`, `box-mark.tsx`, `memory-card.tsx`.

Assets: `public/favicon.svg`, `public/cursors/*.svg` and self-hosted fonts.

Creation materials: `paint-kit.tsx`, `memory-composer.tsx`, `playground.css`, and `composer-kit.css`. Draw/Stamps has named pigment tiles and accurate pixel previews; text is composed on the selected paper and photos share a frame with their captions. Keep optional prompts separate from authored content. Accepted saves alone receive bounded world-positioned confirmation; reduced motion uses a static check. The mobile drawing kit is shorter than the stamp browser so the user retains drawing space.

Research, reference comparisons, tradeoffs and the motion contract: [Pixel toybox](../docs/specs/2026-10-22-pixel-toybox.md).

Creation-surface research and motion decisions: [Creative kit research](../docs/research/2026-10-22-creative-kit.md) and [implementation contract](../docs/specs/2026-10-22-creative-kit.md).
