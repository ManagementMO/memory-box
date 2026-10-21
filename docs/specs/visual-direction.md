# Memory Box production design direction

The approved mockup is the product's visual foundation: a shared picture is surrounded by people’s words and keepsakes. Keep its cassette, pond, garden, pixel scale, mixed media, and spatial positions. Refine its controls and hierarchy rather than adding a marketing page or turning the canvas into a generic dashboard.

## Identity: a public worktable

Use flat colors. The brand blue becomes a more substantial denim; the work surface gets a barely green cast that makes the paper colors feel collected rather than neon. No purple/blue gradients, glows, glass panels, black-and-acid default, or beige/serif/terracotta default.

Core tokens:

| Role | Color | Use |
| --- | --- | --- |
| Ink | `#263633` | Body, icons, strong text |
| Denim | `#354FB2` | One primary action, selected contribution, source links |
| Worktable | `#E8EEEA` | World background |
| Porcelain | `#FBFCF7` | Opaque chrome and panels |
| Hairline | `#CBD5D0` | Structural borders and dot grid |
| Quiet ink | `#64736F` | Secondary labels with readable contrast |

Paper/material palette: butter `#F0DE8E`, orchid `#CDBEE4`, salmon `#E5B4B4`, sage `#BDCFAB`, mist `#BED5DE`. These color choices distinguish actual material types or user choices, not arbitrary metrics. Seed art can use richer shades of these colors. Give free painting a curated 10-color palette including dark ink and light paper.

Type: **DM Sans** remains the comfortable reading face; **Space Mono** stays for dates, revision labels, and compact author metadata. Use 14–16px interface/body text, 12px metadata, 21–25px panel headings. A tight, 600-weight `memorybox` wordmark with the tilted pixel-square icon is sufficient personality. Avoid adding a third decorative typeface or handwritten UI.

Signature: the **memory thread**. A fine denim connection appears only when a contribution or its descendants are selected. The original and reply retain their own authors. The new card's tiny `↳ from @name` tab and the inspector's original reference make collaboration visible. No permanent graph hairball.

## Desktop layout

```
memorybox     [ Find a memory / Ask the box              ]  [Leave something]
The commons       A picture made by everyone.               status / you
┌─────────────────────────────────────────────────┬─────────────────────┐
│ [scene invitation]                             │ one contextual      │
│                                                 │ panel: scene,       │
│     the shared world, media, selected source     │ composer, original, │
│                                                 │ Find, or Ask        │
│ [paint / shapes / colors]          [pan / zoom]   │                     │
└─────────────────────────────────────────────────┴─────────────────────┘
             Recent real change · contributor · time
```

The canvas owns the screen. Prefer a generous 64–68px header and a slim scene/status row. No permanent numbered tour bar in production. The prototype's order becomes the contextual next action, not an always-visible onboarding checklist. Default to an inviting populated view; seed examples must be identified as examples in their details and must never appear as active visitors.

At ≥1100px, a 350–380px panel leaves the world visible. At tablet width, the panel can overlay the world without compressing it into a sliver. Show only one panel at a time. The canvas may have bounded native overflow because it is the actual spatial editor, but page controls and forms should not acquire horizontal scrolling.

## Actual contribution loop

1. **Enter:** brief scene invitation, e.g. “Finish the other speaker. Leave a song or something it reminds you of.” Primary “Help build”; secondary “Explore memories.” A person may leave anything.
2. **Paint:** select brush/stamp and palette, show a ghost preview with affected cells, click/tap a location, then explicit “Paint here.” Keep pending pixels visually separate from accepted ones. A rejected write restores confirmed pixels and retains the draft. Repaint means repainting shared cells, not adding an independent sticker.
3. **Memory:** text/image/link are 3 plainly labeled choices. Textarea first; title optional. Images have a real preview plus “What is this, or why are you leaving it?” Caption and indexing state remain distinct. Public label stays visible. “Choose its place” → location preview → “Leave it here.” Do not force every memory onto a paint operation.
4. **Build on:** open original → “Build on this” → composer includes the original's author/title and a removable? **No: keep the reference during this flow; use ordinary Leave something if a standalone contribution is intended.** New author writes/uploads their own work. Preserve the reference wherever they place it.
5. **Success:** one short accepted-state message, authored content, and the most useful next action. “Find this memory” or “Explore what grew from this.” Avoid two competing blue primary buttons.
6. **Return:** actual activity history and descendants of the person's own memories. No looping fake visitors or fabricated collaborator events.

## Find and Ask

One entry, explicit `Find / Ask`, optional `Whole box / This scene` scope.

Find shows thumbnail, title/first line, author, short excerpt, and date. It highlights the original locations without rearranging or automatically moving the canvas. `Show on canvas` explicitly frames results. Opening an original preserves the query and back path.

Ask shows the real retrieved source list first and then a short synthesis with inline citation buttons. Label `Based on N contributions`; the number comes from the retrieval response. A citation opens the exact original with author, type, date, and place. Unknown/insufficient evidence is a useful state; no confident free answer should appear. Related results remain inspectable.

Do not show vector scores, embedding models, provider names, database jargon, or artificial “AI is thinking” prose in the product flow. Use real states such as “Finding memories…”, “Reading these contributions…”, and “The box doesn’t have enough here to answer that yet.” If a model call fails, retain sources and question and offer Retry.

## Mobile and accessibility

- The world remains a real view, not a squeezed desktop screenshot. Fit the selected scene initially; 44px touch controls, labeled pan/zoom, tap-to-position and separate confirm.
- A bottom sheet presents detail/search; composer becomes nearly full-height to keep the keyboard from covering Publish. Preserve a compact scene peek and explicit back/close. Do not depend on swiping the sheet.
- `Browse as a list` provides actual memory buttons and all inspector/build-on actions outside the canvas.
- Native buttons, input/textarea labels, visible focus. Escape closes the top layer; arrow keys nudge a pending placement; Enter confirms only outside editable fields.
- A remote accepted update highlights its area once, never steals focus or pans the camera. Offline/reconnecting status is persistent and factual. Retain drafts through failure. All live reader sessions need source invalidation before showing fresh Ask answers.
- Avoid hover-only instructions and interactions. Respect reduced motion. Paper note rotation stays within 1–3° and selected originals are straightened/readable in the inspector.

## Motion and state polish

- Button press: 100–140ms transform to `.98`; no animation that delays the request.
- Panel entry: 180–220ms translate 8px + opacity with `cubic-bezier(.23,1,.32,1)`; no scale from zero.
- Accepted local note: settle once from 2px above; remote changed area gets a ~500ms outline, no repeating pulses.
- Canvas panning and pointer position update directly. Camera movement from explicit `Show on canvas` can be ~220ms and disabled under reduced motion.
- No animation for keyboard-repeat movement or every search keystroke. No continuous bobbing art, cursor trails, floating particles, or ambient gradient.

## Research refresh and what it changes

- Figma's July 2026 canvas accessibility engineering describes a synchronized mirror DOM because canvas rendering loses browser accessibility. For this MVP, use ordinary HTML memory controls/list and Canvas 2D only for shared pixels. https://www.figma.com/blog/building-accessibility-into-a-canvas-based-product/
- Figma's multiplayer design explains the contextual value of other people's activity. Our constrained public world uses real low-frequency presence and committed-change highlights; continuous global cursors are unnecessary to prove collaboration. https://www.figma.com/blog/multiplayer-editing-in-figma/
- W3C SC 2.5.7 explicitly distinguishes keyboard support from a single-pointer alternative to dragging. Click/tap placement plus confirm and labeled pan buttons are required alongside keyboard movement. https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements

## Critique against the user's brief

The first instinct was simply a nicer cobalt SaaS shell. Revised: the chrome is quieter and the shared world provides the hero; denim/worktable/paper colors derive from cassette sleeves, stationery, and a shared desk. The risk is retaining enough handmade asymmetry in a functional editor. The memory thread is the single emphasized visual gesture. Everything else uses restrained, consistent controls.

Implementation can proceed with React + plain CSS tokens and Canvas 2D; a heavyweight canvas design/editor package is not needed. Freeze the API/types before component wiring. Browser-check desktop, 390px, 320px, reduced motion, focus, image placement, remote update, failure state, and source/back navigation.
