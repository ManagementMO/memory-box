# Creative kit verification

This refinement turns the existing Paint and contribution forms into material editing tools. It adds no runtime dependency, database change, generated contribution, or invented presence. Research decisions and primary sources are in [the research report](../research/2026-10-22-creative-kit.md).

## Implemented

- Draw/Stamps selector, 12 individually labeled pixel stamps with an accurate selected preview, named pigment tiles, and custom color access in either mode. Stamp previews now use the same ink/white/yellow palette as saved pixels.
- Text editing directly on the chosen paper; photo preview and caption in one frame. Five paper samples keep native 44px targets. Optional manually written prompts are displayed only on request for a blank new note and never become authored text.
- One temporary confirmation at the actual accepted contribution position. Eight local rays last 550ms; the label lasts 2.1 seconds; the node is removed at 2.2 seconds. World coordinates follow the camera while the label counter-scales. Reduced motion shows a static check, with no particles.
- Compact mobile Draw panel preserves canvas gesture space; Stamps has a larger scrollable shelf and a sticky placement action. Obsolete validation clears when editing resumes; cancelled placement clears its old instruction message.

## Evidence

- `npm test`: **226 tests / 29 files passed**.
- `npm run typecheck`, `npm run build`, and `git diff --check`: passed.
- **14 distinct desktop/mobile browser scenarios passed in targeted runs**: the three zoom distances, authentic idle presence/cursors, wandering and original interaction, two visitors publishing notes and uploaded photo build-ons with ownership checks, accepted brush delivery and undo preserving another visitor's later pixel, provider-backed Ask and source return, and preview/pinch/cancel recovery. Tests use disposable real identities and the configured live backend except explicitly synthetic preview/source cases.
- Existing real publish tests now assert the correct note/photo/pixel confirmation label. Brush assertions check the feedback's world center against the accepted cells and that the effect is removed. Preview coverage asserts no success mark exists before acceptance.
- **25 browser UI assertions** passed across 1440px desktop, 390px mobile, and 320px mobile: selected art/color, explicit placement, optional prompt behavior, paper content preservation, parent lineage, 44px targets, no horizontal overflow, usable painting area, and dynamic reduced-motion preference. Previews produced no mutation API requests.
- **7 controlled failure/short-screen assertions** passed: an intercepted 503 paint response has no success mark, retains placement/retry and stamp choice, cancellation removes obsolete instructions, editing clears stale empty-body validation, and a 390×430 viewport can reach placement. This rejection was synthetic; it did not create a hosted paint operation.
- The optimized production build was rendered through `next start` and checked for CSS ordering, 44px paint targets, and horizontal overflow. Included screenshots show real stored world content and unpublished QA drafts; they are not evidence of organic participation.
- Independent code and screenshot reviews found no release-blocking issues. Minimum text contrast across the composer paper colors is 8.89:1 for body, 4.87:1 for placeholders, 5.73:1 for labels, and 4.83:1 for counters.

## Corrections made during verification

The first mobile paint drawer consumed too much room on a short phone. Draw is now capped at `min(34dvh, 280px)` while Stamps keeps `min(48dvh, 410px)`; the real mobile brush test passed after correction. An older preview test counted the read-only paint-turn GET as a mutation; its route guard now distinguishes reads from write attempts. No checks were weakened for actual publication.

The Impeccable detector reported one aesthetic warning for the existing `--toy-spring` easing used by the 220ms stamp selection. The small response is intentional within the approved playful pixel direction, is not an idle animation, does not move its hit target, and is removed by reduced motion. No accessibility or correctness finding was suppressed.

## Limits

These are controlled functional and visual checks, not adoption measurements or a human usability study. Mobile checks use Chromium mobile emulation and resized viewports, not physical iOS/Safari hardware or a native keyboard. Increased participation is a design hypothesis. The product's existing indexing backlog and provider behavior are outside this UI change.

Real test records are tracked by the existing fixture ledger and cleaned with exact actor/operation ownership guards, preserving other visitors' later edits. Manual UI sessions make no public contributions; their guest identities are removed after the final deployed check.
