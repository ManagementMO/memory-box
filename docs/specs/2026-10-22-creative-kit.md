# Creative kit implementation contract

Date: 22 October 2026. This document specifies the next visual/interaction pass; it is not a claim that the work is complete. Research and primary-source provenance are recorded in [the creative kit research](../research/2026-10-22-creative-kit.md).

## Intent and scope

Make painting, writing, adding a photo, and building on an original feel more tangible and expressive within the existing white/pastel pixel world. Preserve a readable, usable interface on desktop and narrow mobile. The canvas and contributions remain the main visual content.

Implement only:

- A Paint kit with Draw/Stamps modes, larger accurate stamp previews, readable stamp labels, named selected colors, and clear selection states.
- A paper/photo composer that visually resembles the object being placed and shows the actual build-on relationship.
- Small world-positioned feedback after a contribution has been accepted.
- Responsive, keyboard, focus, reduced-motion, and cleanup behavior for those changes.

This pass adds no new invitation loop, onboarding campaign, ranking, streak, economy, territorial rule, collaboration permission, or generated community content. It does not alter cooldowns or increase the painting allowance. There are no adoption or conversion claims.

## Visual language

Retain the warm white canvas, light pastel materials, plum ink, original pixel tools, and existing readable typography. Keep green out of new interface accents. Shared artwork retains its authored colors, including any green users paint. Avoid broad decorative gradients, glass effects, animated backgrounds, and new icon families.

Use material distinctions deliberately: paper for text, a photo frame for images, compact object previews for stamps, and small pigment tiles for paint. The main call to action remains legible through text, contrast, and position. Selected state must not rely on hue alone. Do not add promotional slogans or fictional activity.

## Paint kit

- Use the existing paint modes and shape definitions. The user-facing shape mode is named **Stamps**. A visual rename must not change stored shape IDs or placement behavior.
- Show a large current stamp preview and individually labeled stamp options. Render previews with the actual selected paint color and existing pixel geometry. Keep pixel edges crisp.
- Identify the selected color by its existing human-readable name. Every swatch retains an accessible name and a visible selection marker/focus treatment.
- Mode, stamp, and color controls use native buttons with correct selected-state semantics. Preserve existing keyboard reachability; do not add tab roles without implementing their keyboard contract.
- Keep brush count, preview-versus-published distinction, save, clear, turn status, and errors available. Decoration cannot imply that a staged stroke has already been saved.
- Preserve the existing 144-pixel save limit, turn checking, 15-second cadence, server enforcement, and recovery behavior. The Paint kit is presentation, not a second source of paint eligibility.
- Touch users can perform every action without hover. Keep targets at least 44px where practical and prevent horizontal document overflow at 320px.

## Paper/photo composer

- Present title and body as real, editable inputs within one material surface. Avoid a duplicate live text preview that consumes scarce mobile space.
- Apply the chosen paper color to text composition. Keep title/body labels, counters, errors, and focus styles readable against every available paper.
- Image composition retains file selection, drag/drop where already supported, image preview, caption, filename/status feedback, and the existing file constraints. A frame must not crop away essential upload actions.
- Preserve public visibility disclosure, content-type choices, URL validation, existing draft recovery, and edit/version behavior.
- When building on an original, show the actual parent author and snippet with a working action to the original. Use a small visual connector into the current composition without changing the recorded lineage.
- Keep the existing placement step. The primary action describes what happens next; editing an existing contribution still uses the existing save behavior.

## Accepted-only feedback

- Trigger success decoration only after the existing publication promise returns an accepted result. Never trigger from pointer-down, a locally staged preview, request start, upload alone, or a rejected response.
- Place the effect at the saved world position using the same camera/world mapping as the contribution. It must not drift to an unrelated screen position after pan or zoom.
- Feedback is visual acknowledgment, not persisted collaboration state. It must not add fake pixels, notes, authors, activity entries, or presence events.
- Keep effects noninteractive and hidden from assistive technology. Existing meaningful success/status announcements remain the accessible confirmation.
- Bound both the particle count and simultaneous effects, cancel/clean up completed effects, and avoid a permanent animation loop. An unmounted view must not retain timers or state updates.
- A failed save keeps its current error/draft recovery and receives no success effect. Retrying an operation must not create duplicate persistent content or unbounded effects.
- Use the existing paint cooldown/publish state to govern the action; animation completion never gates further input.

## Motion and accessibility

These are proposed design tuning values, not externally mandated timings:

| Response | Budget |
| --- | --- |
| Press | 100–120ms; about 1px displacement. |
| Mode/selection | 160–240ms; stable target bounds. |
| Optional stamp hover | Intent delay of 150–200ms; maximum 3px/3 degrees. |
| Accepted contribution | About 320–420ms, 6–8 local square particles, approximately 40px radius. |
| Typing/drawing/paper-color state | Immediate. |

Use transform/opacity for motion where practical. No animated large blur/shadow/filter surfaces or blanket layer promotion. Focus rings and controls cannot move away from the pointer or keyboard focus.

Respect `prefers-reduced-motion` at initial render and when the preference changes during a session. Suppress optional movement and particles, preserving static selection and confirmation. Do not substitute a slower animation. Hover-only embellishment is optional; information and functionality are not.

## Responsive acceptance checks

- Inspect at 1440px desktop, 390px mobile, and 320px narrow mobile, including the existing three canvas zoom levels.
- Check Paint Draw, Paint Stamps, text composition, photo composition, and build-on with a real parent fixture. Verify labels, controls, previews, and primary actions are visible or reachable without page overflow.
- Confirm the bottom controls clear safe areas and remain usable when the composer has long text or the on-screen keyboard reduces the visible area.
- Verify keyboard focus, button names/states, Escape where the existing panel supports it, and selected color/shape information without relying on color alone.
- Verify reduced motion removes the new optional displacement and particle effects, including a live preference change.
- Check that changing paint color updates the actual stamp preview, selected stamp survives mode changes as intended, and touch interaction does not depend on hover.

## Functional and performance verification

- Exercise an accepted paint save and accepted note/photo contribution; verify the effect corresponds to the saved location and disappears after completion.
- Exercise rejection/offline or equivalent controlled failure; verify no accepted-success effect and that preview/draft recovery remains available.
- Verify the existing build-on ID and original-opening path survive the new composer presentation.
- Verify painting limits, cooldown UI, save/clear, placement, and existing collaboration behavior through appropriate existing tests. Do not fabricate a real-user observation from a controlled test.
- Pan/zoom while feedback exists and inspect cleanup after close/unmount. Ensure decorative effects do not intercept pointer input or create a continuous repaint workload.
- Run the relevant type/build/lint checks and focused behavior coverage. Record actual evidence separately from this proposed contract; do not label production or multiplayer behavior verified from a screenshot alone.

## Tool and dependency boundary

21st services/CLI, Context7, and Morph were unavailable during this pass (401, monthly quota, and 402 respectively). Research therefore used official public source pages and installed/local code. This does not authorize account changes or a new paid dependency.

No new runtime package, animation engine, component framework, database migration, auth policy, or provider configuration is required. Small original CSS/DOM effects and the existing controls are sufficient. Reference demos inform the design; importing their source or dependency trees is outside this contract.
