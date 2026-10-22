# Pixel toybox refinement

The user asked for a more distinctive, bubbly and animated interface while retaining the white/pastel pixel canvas and keeping it usable. The product remains a shared world of actual pixels, notes and photos. Authored content and people are the focal point; interface personality comes from a small family of tools and materials. No marketing slogan or fictional activity was added.

## Research and decisions

| Reference | What was useful | Implementation decision |
|---|---|---|
| [21st: dock interaction guidance](https://preview.21st.dev/blog/react-dock-components) | Distance from the pointer makes a row feel physical; touch, labels and keyboard focus need separate consideration. | One container pointer handler changes six glyph transforms. Button bounds and labels remain stationary. All six labels stay visible on mobile, with targets at least44px. |
| [Motion Primitives Dock on21st](https://21st.dev/@ibelick/components/dock) | A composed dock separates items, icon artwork and labels. Its catalog license is MIT. | Adapt the interaction concept to the existing native-button/Base UI stack. Implement original artwork and a compact CSS response, with no dependency on its Lucide/Tailwind/Motion demo. No component source was copied. |
| [HextaUI Animated Dock on21st](https://21st.dev/@preetsuthar17/components/animated-dock) and [React Bits Dock](https://reactbits.dev/components/dock) | Alternatives establish how much scale and motion are possible. | Keep maximum artwork magnification to12% and travel to5px. No launch bounce, badges, context menus or moving hit targets. |
| [21st mobile navigation](https://preview.21st.dev/blog/react-mobile-navigation-components) | Safe areas and visible destinations matter more than a desktop hover trick. | The tray stays above the safe area; mobile has a fixed row of labeled tools. Pointer magnification requires a fine mouse pointer. |
| [Kinopio cards and connections](https://kinopio.club/help/posts/creating-cards-and-connections/?hidden=true) | Contributions can remain expressive while spatial relationships stay tangible. | Keep actual note colors, photographs, positions, authors and build-on links. Improve tape, folds, photo borders and selected edges without importing extra content. |
| [tldraw custom styles and themes](https://tldraw.dev/features/customization/custom-styles-and-themes) | Canvas overlays, pointers and controls are separate presentation layers. | Change the cursor assets and chrome without replacing the working canvas/realtime engine. |
| [Base UI Tooltip](https://base-ui.com/react/components/tooltip) and [Radix Toolbar](https://www.radix-ui.com/primitives/docs/components/toolbar) | Native semantics, composition and keyboard access need to survive styling. | Reuse installed Base UI1.9 tooltips on native buttons. Preserve tab navigation, focus outlines, accessible names and Escape. No second primitive framework. |
| [Emil Kowalski: You Don't Need Animations](https://emilkowal.ski/ui/you-dont-need-animations) | Frequent interactions should feel immediate; animation has a cost even when beautiful. | No idle choreography. Panels arrive in180ms, controls respond in120ms, glyphs settle in210ms. No delay before painting, typing or search. |
| [Motion bundle guidance](https://motion.dev/docs/react-reduce-bundle-size) | Even small visual effects should justify their runtime. | CSS is sufficient for this bounded effect. No new runtime dependency. |
| [MDN cursor](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/cursor) | Custom images need explicit hotspots and a required keyword fallback. |32px open/closed glove and pencil SVGs have explicit hotspots and grab/grabbing/crosshair fallbacks. No element follows the local pointer. |

21st's installed CLI returned401 for catalog search; its public catalog, component pages and documentation provided the references. Context7 was attempted first for current library guidance but its monthly quota was exhausted, so current official documentation and installed types were used. Morph search/edit returned402; normal local file tools completed the work. No subscription or unrelated plugin was installed.

## Visual system

- Warm porcelain canvas, plum ink, lilac controls, butter paper, peach dice, blush brush and pale blue photo tool. Existing shared pixels retain their exact colors.
- Original32px pixel objects for Explore, Wander, Together, Paint, Note and Photo. Utility controls retain the installed Pixelarticons family. The existing box mascot is rendered inline and responds once on hover.
- A raised rounded tray keeps six stationary targets. The pointer affects only the artwork, so clicking does not become a moving-target task.
- The note editor takes a light tint from the chosen paper. The image uploader uses the same illustrated photo tool. Text remains a readable sans serif.
- Close controls, segmented zoom buttons, Find/Ask and presence use the same curves, colors and focus treatment. Live membership still comes from connected sessions.
- A compact two-row mobile painting bar gives turn status room and gives color, publish and clear controls44px targets.

## Motion contract

The focal interaction is picking up a tool from the tray. Labels and buttons do not move; artwork rises at most5px and scales at most1.12. The mild overshoot is deliberate for the requested bubbly character, is confined to six tiny objects and has no idle loop. The Impeccable detector flags this easing as a generic warning; it is retained intentionally. All other motion serves a state change or hover response.

Reduced motion disables dock movement, the mascot blink, panel entrance, card displacement and swatch movement. Changing the preference while the page is open immediately resets the dock. Existing camera motion already respects that preference. No sound, confetti, WebGL, continuous local-pointer animation or background timer was added.

## Verification

First batched render inspection:1440px desktop,900px tablet,390px mobile and320px narrow mobile; all three zoom levels plus note/photo/Find/paint panels. No document overflow or page errors; all six labels visible. Dock target dimensions are70×71px on desktop,58.5×65px at390px, and48×65px at320px. The same button bounding box is unchanged before and after hover. Keyboard hint and Escape, pointer departure reset and live reduced-motion changes passed.

The single corrective batch improves the narrow painting bar, darkens primary-button and hint colors, and reserves30px below note text so the character counter cannot cover the last line. The source review found no collaboration logic regression. Existing automated coverage is used for actual shared-service behavior; release evidence is recorded in the build ledger and user-facing release notes.

This change introduces no database migration, auth policy, provider configuration, generated community content or additional runtime package.
