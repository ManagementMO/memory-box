# Memory Box: product next steps

Research date: 22 October 2026. Proposal status: review through an unmerged PR. The existing pixel toybox release remains the production baseline. This research did not publish new communities, participants, memories, or prototype content.

## Product hypothesis

Memory Box should make it easy to invite someone into a specific thing people are making. The intended experience is a large, messy collective canvas with small personal reasons to participate: finish a ridiculous goose, add a photo beside a friend's memory, or carry a joke into another drawing. Search and Ask help someone find original contributions; they do not replace encountering those contributions.

The most concrete gap is the existing People panel's invite action: it copies `window.location.origin`. It drops the location, original, and context that made the sender want to invite someone. Meanwhile, the app already has real cursors, painting, notes/photos, build-on relationships, several canvas distances, and source-backed discovery. A new invitation path can connect these working pieces without introducing another large subsystem.

**Hypothesis:** an exact place, visible context, and an obvious next action will make first participation easier and give a contributor a useful reason to invite a friend. This is a hypothesis to test, not an established adoption result.

## Evidence and interpretation

### Share the creation and its location

[Reddit's r/place sharing engineering report](https://www.reddit.com/r/RedditEng/comments/wlu1ub/how_we_built_rplace_2022_share/) describes deep links into canvas locations, visual representations of the canvas, and native-share/clipboard fallbacks. Reddit reported 3,446,026 shares and 512,864 followed links. These historical counts show that sharing was used during that event. They do not isolate a causal effect or predict Memory Box conversion.

[Reddit's 2023 community coordination announcement](https://www.reddit.com/r/modnews/comments/153xozj/a_place_in_rplace_for_your_community/) added pinned coordinates as entry points from communities to the canvas. Community flags also made the associated group discoverable. The relevant lesson is practical: people coordinating a shared artifact need to reach the same location.

[Kinopio's Card Links](https://kinopio.club/blog/posts/card-links/) gives each card an ordinary URL for referencing a thought or starting a conversation around an idea. The creator deliberately avoided specialized terminology. For Memory Box, a place link and an original link should remain recognizable links, usable in the communication tools people already have.

**Inference:** the smallest useful acquisition loop is contribution → specific invitation → contextual arrival → another contribution. Copying the homepage interrupts that loop. The available evidence supports building and testing the mechanism, not promising growth.

### Canvas-first still needs context

In [Kinopio's October 2025 About Page retrospective](https://kinopio.club/blog/about-page), its creator says immediate canvas entry suited people who understood the product, while newcomers had to discover its purpose and learn an unfamiliar interface simultaneously. Kinopio introduced an explanatory page that retained the app's visual language and demonstrated real interactions. Its earlier [editable Hello Space](https://kinopio.club/blog/posts/updated-hello-space/) used demonstrations and community examples.

Memory Box's established brief favors entering the world directly. A mandatory landing page or tutorial would be a substantial change in direction. A small arrival cue at the shared location can supply enough context while preserving exploration. It should identify what was shared and offer a relevant action, then disappear when dismissed.

[Wplace's play guide](https://wplace.live/how-to-play) recommends a small first drawing, zooming close enough for precise placement, and reviewing a prepared selection before publishing. Its collaborative guidance starts with agreeing on location, design, and colors. Memory Box already stages paint before publication; the next task is to make a newcomer's first decision understandable.

**Inference:** a local invitation is more useful than a generic tour because it combines orientation with an actual reason to act. Whether the wording and actions are sufficient requires observing newcomers.

### Support coordination without prescribing every outcome

[Wplace's overlay guide](https://wplace.live/guides/overlays) documents anchored references, opacity, and missing-pixel markers. The reference does not publish pixels itself. Its [alliance guide](https://wplace.live/guides/alliances) documents shared plans, roles, and access rules. These illustrate a progression from a place to a coordinated project, but a full alliance system would add membership, permissions, moderation, and organizational overhead.

[Israeli, Kremiansky, and Tsur's r/place study](https://arxiv.org/html/2201.05334) models participation by existing communities using language, community metadata, and structure. Existing identity and engagement are part of that setting. It is not evidence that a decorative canvas creates a community from nothing.

[Wu and Silva's cross-edition study, revised July 2026](https://arxiv.org/html/2408.13236v3), discusses coordination costs and accessible coordination tools. Its coalitions are inferred from behavioral traces, and detailed conflict analysis is limited to the 2017 event. Its findings do not establish that stronger competitive pressure or a longer cooldown would help this small pilot.

**Inference:** begin with a few people who already share jokes and relationships. Give them a meeting place before building guilds, rankings, or territorial rules. Keep the current paint cadence until actual use reveals a specific problem.

### Extend the current identity

[Kinopio's creator's design principles](https://pketh.org/design-principles.html) emphasize small dependencies, plain text, a consistent mobile/desktop interaction model, pruning, and playful details that preserve precision. For example, its sticky-card behavior stops near clickable targets.

That supports Memory Box's current white/pastel pixel system and stable controls. The next distinctive detail should help someone understand sharing or arrival: a small pixel location marker, a compact preview, and a clear successful copy state. Additional idle motion or a new component library would not by itself resolve a product gap.

Waterloo is a plausible starting context. The university documents [the Pink Tie tradition](https://uwaterloo.ca/math/about/our-history/legend-pink-tie) and [campus goose culture](https://cs.uwaterloo.ca/news/new-website-help-you-duck-duck-goose-campus). These establish recognizable references, not demand for Memory Box. Existing fictional starter examples must remain distinguishable from real participation.

## Priority and focused PR: Meet here

| Priority | Change | Why now |
| --- | --- | --- |
| 1 | Exact-place and original links with contextual arrival | Repairs an observed gap using existing collaboration and content flows. |
| 2 | Observe and simplify the first contribution | Determines where actual newcomers hesitate before adding more tools. |
| 3 | Return to places and coordinate small builds | Depends on people first finding value in a shared session. |

The current implementation proposal is deliberately bounded:

- **Share this spot:** represent a validated world center and viewing distance, independent of the sender's screen dimensions.
- **Share original:** target a durable memory ID and its surrounding canvas. Show the current original rather than embedding stale text in the link.
- **Contextual arrival:** identify the shared destination and offer relevant existing actions, such as painting nearby, opening an original, or building on it. Preserve the option to explore immediately.
- **Current-content miniature:** show a local preview derived from currently available canvas content. It is an orientation aid inside the app, not an exported image, stored postcard, or Open Graph promise.
- **Usable sharing:** support a copy action, supported native sharing, and a selectable URL fallback. Treat native-share cancellation quietly.

The UI must not imply that the sender is currently present, that a group owns a region, or that a recipient has joined a private room. Links carry public navigation context, not identities, guest credentials, drafts, or generated answers. Opening a link never publishes anything.

Acceptance covers malformed and extreme destinations, desktop/mobile framing, deleted originals, unavailable clipboard/native sharing, keyboard operation, narrow screens, reduced motion, and preservation of drafts and source-return state. Navigation must not repeatedly pull a person back after they begin exploring. Two-browser tests can verify collaboration mechanics; they cannot establish adoption.

## Staged roadmap and decision gates

**After review: run a small invitation pilot.** Keep the production release separate until the PR is approved. Use the pilot to decide whether the next constraint is comprehension, drawing precision, finding one another, or motivation. Do not solve all four by adding unrelated features.

**If people want to coordinate larger drawings:** test a lightweight shared plan or optional reference anchored to an existing place. Keep it clearly separate from published pixels. Decide how authors revise or remove it before introducing progress indicators. Full alliances, ownership, roles, and private headquarters remain deferred.

**If people want to return:** consider locally saved places and actual subsequent changes nearby. A useful return cue is what happened to the thing someone helped make. Notifications, streaks, and scarcity mechanics require separate evidence and consent decisions.

**If links are used but fail to communicate outside the app:** evaluate generated share imagery and Open Graph previews. Those require decisions about current versus historical content, deleted originals, caching, asset lifetime, and moderation. Stored postcards and outbound preview rendering are deferred from Meet here.

**If the community grows:** revisit snapshot paging, moderation capacity, abuse controls, and index reliability using observed load and incidents. Growth claims must not come from fixture counts, seeded originals, or automated browser sessions.

## Pilot: 5–8 Waterloo friends

After approval, invite a small set of willing people who have not been coached through the interface. Do not publish invitations or contact participants automatically as part of this PR.

Ask one pair to send a link to a drawing, another to share an original and build on it, and let the remaining participants explore naturally. Record manual observations: whether recipients understand where they arrived, what they can do, time to first intentional contribution, moments of hesitation, and whether they interact with one another's work. Ask what they would want to revisit and what they would describe to another friend.

Separate usability failures from lack of interest. If someone cannot find Paint, fix navigation. If they understand the controls but do not care to contribute, investigate the premise and shared activity rather than adding animation. A small session supplies directional evidence; it does not establish retention, conversion rates, or product-market fit. No analytics claims or fabricated participant activity should be added to the interface.
