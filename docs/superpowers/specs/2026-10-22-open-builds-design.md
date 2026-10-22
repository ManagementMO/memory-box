# Open builds on the shared canvas

The user approved making Together an invitation to help with a specific creation. Existing Together visits preset patches or follows a live painter; existing Build on creates an authored response. This extension connects those working flows with persistent, visitor-authored invitations.

## Contribution and discovery

An invitation is an ordinary text, image or link memory with `isBuildInvitation: true`. Its body must say what others can help make; its optional title and image remain authored content. The composer offers a native checkbox, “Invite people to build here”. Together offers “Start a build here” using that same composer with the checkbox selected. A placed invitation is not published until the existing placement confirmation succeeds.

Together lists current invitations, newest first, ahead of the existing preset patches and a factual live-painter shortcut when available. No fabricated invitations, members, completion, or activity. Existing originals remain unchanged unless their author explicitly opens an invitation. A compact pixel badge distinguishes open invitations on canvas cards and in previews. Search continues to retrieve the authored words and photos through the existing indexing path.

## Join and contribute in place

“Join this build” on a preview or full reader opens a small workbench anchored to that exact original. Together entries open the same workbench. It shows the actual invitation, its author, and Paint here / Add a note / Leave a photo. The source stays visible above the bounded sheet on mobile. Joining is navigation into shared tools; it is not membership or a new access boundary.

Paint uses the existing shared pixel plane, real cursors/previews, confirmation, cooldown and undo. The paint kit retains a compact return-to-build action. Painting is spatial collaboration, not a counted reply; only authored notes/photos link with the existing `inspiredBy` relationship. Notes and photos start the existing controlled composer beside their source; placement is suggested nearby but remains adjustable. Their authors retain ownership. No artificial contributor counts or inferred pixel attribution.

Invitations can be shared through existing exact-original links. The full reader reached from that link also offers Join. Existing normal Build on, wandering, drafts, Find/Ask, source returns and exact-place sharing continue to work.

## Ownership, lifecycle and compatibility

Only an owner or existing operator may edit the invitation flag, through the existing optimistic version check. An omitted edit flag preserves the current value, including requests from the older deployed app. Setting it false closes the invitation and keeps its memory, pixels and responses. Existing deletion/moderation removes the source from current invitation discovery; other authors' contributions remain. A workbench whose invitation closes or disappears explains that and offers a return to Together; it never starts a response to a missing source. An already-written draft remains recoverable and uses the existing source validation at publish.

The database adds `memories.is_build_invitation boolean not null default false`, preserves all current mutation authorization, idempotency, index leases and cleanup behavior, and includes the flag in the shared JSON representation. A database constraint enforces nonempty invitation text. RPC functions remain invoker-security and executable only by `service_role`. Deploy the additive migration before the new application; old requests and old memories remain valid.

## Global constraints

- Keep the white/pastel pixel identity, existing self-hosted fonts and compact chrome.
- No new rendering, motion, UI or backend dependency.
- All six existing dock actions and all three zoom levels remain available.
- Mobile controls retain at least 44px hit targets; sheets scroll and remain clear of the dock.
- Presence, authored content, pixel saves and lineage reflect real stored or live activity.
- Anyone can contribute; Waterloo is only the first neighborhood.
- Scope excludes corner-following, notifications, replay, membership, completion tracking and scoring.

## Acceptance evidence

Focused validation and UI tests cover invitation persistence, missing-field compatibility, author closure, unavailable sources and the normal-memory path. A real two-visitor desktop/mobile scenario publishes an invitation, discovers and joins it from the other browser, paints, leaves text and a photo linked to the original, and verifies another visitor receives those changes. It also checks unauthorized editing, old-client edits, closure, and source removal while a workbench is open. Disposable fixtures clean only their own resources and preserve others' later pixels. Final release checks include unit tests, TypeScript, production build, relevant browser regression suite, CI and the live deployed flow.
