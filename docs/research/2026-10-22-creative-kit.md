# Creative kit: visual and interaction research

Research date: 22 October 2026. Scope: creation controls, editable materials, contribution feedback, narrow mobile usability, and motion. This work follows the approved Meet Here change; it does not propose another invitation or adoption feature. The references inform design choices. They do not establish that these changes will increase participation, retention, or conversion.

## Observed design gap

The existing interface already has an original pixel box mascot, illustrated tool dock, white/pastel surfaces, readable sans-serif controls, stationery details, and restrained hover responses. `src/app/toybox.css` and `.21st/DESIGN.md` describe that foundation. More dock magnification or slightly different colors would add little to the requested design improvement.

The larger opportunity is visible in `renderPaint()` in `src/components/memory-box-app.tsx` and in `src/components/memory-composer.tsx`. Paint uses conventional mode buttons, swatches, and a rectangular shape grid. Notes use a stack of labeled fields. Those surfaces can better express what someone is making without changing the existing canvas, live data, permissions, or publication workflow.

**Design recommendation:** make the creation interface feel like a small set of creative materials. Show a large, accurate stamp preview; identify the selected pigment by name; let someone compose directly on the selected paper; frame a photo and its caption together. Give successfully saved contributions a small local response at their actual position.

## Primary references and decisions

| Source | Observed source guidance or behavior | What this project borrows | What it skips |
| --- | --- | --- | --- |
| [Kinopio's Design Principles](https://pketh.org/design-principles.html) | The creator describes pointer-rest gating of about 200ms, suppressing sticky movement near interactive controls, full mobile capability, and small dependencies. | Bounded physicality, stationary targets, touch parity, and pruning redundant UI. | Recreating sticky physics throughout the canvas or adding a persistent minimap for decoration. |
| [Kinopio Help](https://kinopio.club/help/) | Creation and connections are direct spatial actions. | Editing material that visually belongs to the canvas, with an understandable relation to an original contribution. | Importing Kinopio's full editor model or its branding. |
| [React Bits Click Spark](https://reactbits.dev/animations/click-spark) | A localized burst can use dots, dashes, or stars around a click. | The visual idea of a short square-pixel response after an accepted save. | A burst on every click, brush sample, or unconfirmed preview. |
| [React Bits Sticker Peel](https://reactbits.dev/animations/sticker-peel) | A die-cut sticker has material edges and can peel, swing, and be thrown. | Modest paper edges, frames, and tactile selection details. | Full peel/throw physics that conflict with navigation, reading, and placement. |
| [21st Animated Tabs](https://preview.21st.dev/%40kuratlielia/components/tabs) | The component uses a moving selection highlight and continuity between panels. | Clear selected modes and compact transitions in Draw/Stamps and content-type controls. | Its Motion, Lucide, and Radix dependency bundle; the existing controls suffice. |
| [21st React Tabs guidance](https://mcp.21st.dev/blog/react-tabs-components) | Indicator geometry follows the active element; label and keyboard behavior need deliberate treatment. | Selection indicators that remain accurate at narrow sizes, with accessible names and semantics. | Hidden labels that make mobile contribution choices ambiguous. |
| [21st Bento](https://docs.21st.dev/blog/introducing-21st-bento) | A coherent control surface changes between modes; the article describes CSS-based motion and FLIP. | State continuity without requiring a new animation runtime. | A bento layout or dashboard replacing the spatial world. |
| [21st Changelog](https://preview.21st.dev/changelog) | Animated icons wait for pointer intent and animate only the relevant hovered item. | Intentional, local preview responses if hover movement is used. | Animating every stamp crossed by the pointer or leaving the whole shelf in motion. |
| [Emil Kowalski: You Don't Need Animations](https://emilkowal.ski/ui/you-dont-need-animations) | Repeated interactions should feel immediate; rare feedback can support delight; excessively long UI transitions become friction. | Short ordinary transitions and a distinct occasional contribution response. | Delayed typing, drawing, keyboard commands, or decorative transitions on every operation. |
| [tldraw UI Components](https://tldraw.dev/sdk-features/ui-components) | Tool-specific styles are contextual; desktop and mobile place controls differently while retaining editor actions. | Relevant controls near the creation task and responsive presentation. | Replacing the existing canvas engine or importing another editor framework. |
| [W3C C39: prefers-reduced-motion](https://www.w3.org/WAI/WCAG22/Techniques/css/C39) | Nonessential interaction motion can be suppressed according to the user's preference. | Static state confirmation and suppressed displacement/particles under reduced motion. | Treating reduced motion as merely slowing animation. |
| [web.dev: High-performance CSS animations](https://web.dev/articles/animations-guide) | Transform and opacity are preferred; layout/paint work and unnecessary layer promotion need scrutiny. | Small bounded effects, composited transitions where practical, and rendered verification. | Animated blur, canvas-wide filters, blanket `will-change`, and persistent decorative frame loops. |

[Excalidraw Libraries](https://libraries.excalidraw.com/) is an additional reference for visually browsing reusable expressive objects. It supports the readability of a stamp shelf, not importing a generic diagram marketplace.

## Bounded design package

1. **Paint kit.** Rename the shape mode to Stamps. Give the existing stamps larger previews in the actual selected color, a clear selected state, and readable names. Make the current color explicit in text as well as visually. Keep Draw, preview, save, clear, and cooldown behavior recognizable.
2. **Paper and photo composition.** Place editable title/body fields on the chosen paper surface. Keep one editable representation rather than duplicate editor and preview text. Frame a selected image with its caption. Retain real labels, public visibility, upload feedback, and existing limits. Use the actual parent contribution to explain build-on.
3. **Accepted-only contribution feedback.** A small local response follows a successful save at the saved world location. Failed requests and previews do not receive success decoration. Any pixels/objects shown as real still come from the existing accepted-data path.
4. **Narrow mobile and reduced motion.** Keep the same tasks possible on a phone. Labels, save/clear actions, focus, safe-area spacing, and the keyboard take precedence over hover decoration.

## Proposed motion values, not sourced requirements

The source facts above support restraint and purpose. The exact values below are this project's proposed tuning values and should be checked in the rendered interface:

| Interaction | Proposed duration and bounds |
| --- | --- |
| Press response | 100–120ms; artwork/base compression of about 1px. |
| Mode or stamp selection | 160–240ms; restrained transition with stationary control targets. |
| Optional fine-pointer stamp response | Start after 150–200ms of intent; no more than 3px lift or 3 degrees of tilt. |
| Panel entrance | 160–200ms; opacity and no more than 6px translation. |
| Accepted contribution | 320–420ms settle/burst; 6–8 square particles within about 40px, bounded and removed after completion. |
| Paper color, typing, drawing, keyboard actions | Immediate state change; no decorative input delay. |
| Reduced motion | No nonessential translation, scale, tilt, or particles; retain an understandable static success state. |

These values are an implementation starting point. Do not claim they are usability findings, benchmark results, or proof of greater contribution.

## Tool and dependency provenance

The 21st service/CLI was unavailable during this design work (401); public official catalog and documentation pages supplied references. Context7 was attempted for current library guidance but returned a monthly quota error. Morph search/edit services were unavailable (402); a direct edit attempt for this document also returned 402, so ordinary local file tooling was used. These service failures did not require a subscription, account change, or unrelated plugin installation.

No runtime dependency is required for this package. The implementation uses the existing React/native-control stack, original pixel assets, and bounded CSS/DOM effects. The references provide interaction inspiration; their component source is not copied into this plan.

The implementation contract and verification boundaries are in [the creative kit specification](../specs/2026-10-22-creative-kit.md).
