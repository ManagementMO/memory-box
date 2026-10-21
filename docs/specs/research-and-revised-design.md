# Memory Box: research and revised design

Research checked 20 October 2026. This document replaces the earlier MVP blueprint as the current proposal. It is a researched design, not an implementation, benchmark, or report of real user adoption. Recommendations below are our calls for this project; vendor capabilities, historical examples, research findings, and untested hypotheses are distinguished.

## Recommendation

Build a small public world that people can change together and fill with things worth remembering. Keep the approved pixel-art, pastel-paper, cobalt-control aesthetic. Make a scene the unit of participation, an original contribution the unit of memory, and a cited source the unit of an answer.

The distinctive loop is:

**See an invitation → change a shared picture or leave something → encounter another person's contribution → build on it → find the resulting connections later.**

Use a shared mutable grid with independently attributed text, images, and links. Add a lightweight “Build on this” relationship between contributions. Search highlights originals in their existing locations. Ask explains a bounded selection of originals and brings readers back to them.

The first technical choice remains Next.js + TypeScript, a Canvas 2D drawing layer with HTML/React memory overlays, and Supabase Postgres/Auth/Storage/Realtime with pgvector. This choice is conditional on a small realtime and retrieval evaluation, not a claim that this stack is universally best. Convex is the strongest alternative for reducing reactive application plumbing. PartyServer on Cloudflare Durable Objects is the alternative if frequent live motion or a much larger public room becomes central.

## What the research changes

| Earlier assumption | Revised decision | Why |
| --- | --- | --- |
| A communal canvas will produce collaboration | Give each initial scene a specific, optional invitation and a visible next contribution | r/place research concerns communities, coordination, and contested shared artifacts; infrastructure alone does not create these |
| Live cursors are an essential sign of collaboration | Start with real committed-change highlights and scene presence; treat continuous cursors as an optional, measured feature | Fanout multiplies traffic; meaningful visible edits already establish that others are here |
| All questions go through one RAG pipeline | Separate original retrieval, cited synthesis, and structured activity/count questions | Similarity search cannot establish complete statistics or represent the whole community |
| Image descriptions are the only image search path | Establish caption/OCR retrieval as a baseline, then compare native multimodal embeddings | Text descriptions can miss visual details; newer models accept images directly |
| Vector search requires an approximate index immediately | Start with filtered exact vector search on a small corpus; add HNSW when measurement warrants it | Exact search provides a useful reference; approximate filtering can reduce recall |
| A stamp and a pixel can consume the same contribution allowance | Rate limits must account for changed cells as well as operation count | Large stamps otherwise let one participant dominate the shared surface |
| “Memory” suggests an agent-memory framework | Keep originals and explicit relationships in our own records | The product depends on attribution, source inspection, ownership, and deletion |
| The earlier numerical defaults were a settled design | Canvas size, stamp sizes, cooldowns, and preview density remain playtest parameters | Documentation cannot establish which settings are enjoyable |

## 1. What people are collaborating on

Three directions were considered.

| Direction | Strength | Main failure mode | Decision |
| --- | --- | --- | --- |
| Pure pixel mural | Immediate shared consequences; easy to understand small contributions | Text and memories become peripheral; conflict can dominate | Keep its shared surface and limited visual vocabulary |
| Open scrapbook of cards | Rich content and straightforward semantic search | People leave independent objects without making anything together | Keep its original media and attribution |
| Shared scenes with attached memories | Gives visual work a common context while retaining personal sources | Could become a collage with too many mechanics | Recommended, with only three main verbs: Build, Leave, Explore |

The user’s “literally anything” remains important. Scenes are invitations, not content categories enforced by AI. A strange, unrelated idea can still be left on the commons. The first scenes help people get started; they do not define which interests are permitted.

### What to learn from r/place

A recent cross-edition analysis, revised July 2026, reports concentrated participation and advantages accruing to larger coalitions despite individual rate limits. It also describes coordination inefficiencies and uncertain outcomes. This is observational evidence about r/place, not proof that a new small community will behave the same way. The useful inference is to design for coordination and unequal participation instead of assuming an empty grid will organize itself. [Wu and Silva, How Millions Coordinate at Scale](https://arxiv.org/abs/2408.13236)

A separate study examines community success through the dynamics of existing Reddit communities. It reinforces the distinction between a successful social event and a reusable canvas component. [Israeli and Tsur, With Flying Colors](https://arxiv.org/abs/2307.09650)

For Memory Box, start with three unfinished scenes, such as:

- **The mixtape:** add something to the room and leave a song, object, or memory associated with it.
- **The pond:** add a creature, bench, or small detail and leave something you associate with quiet places.
- **The garden:** extend a plant or path and leave an idea you would like someone else to grow.

Invite a small cohort to contribute during the same initial session. Let later visitors participate asynchronously. Do not manufacture people, activity, or contribution counts. Seed examples remain labeled.

The participation hypothesis is that a small shared task makes first contributions easier and that attributed responses encourage return visits. Test it; do not present it as established engagement science.

### What to learn from Are.na and Cosmos

Are.na treats contributions as distinct blocks and gives collections meaning through their relationships. Its guidance emphasizes attribution and context. Its open channels allow anyone to add material. These are useful precedents for keeping original contributions identifiable while allowing collective assembly. [Handling blocks with care](https://help.are.na/docs/guides/handling-blocks-with-care), [Channels](https://help.are.na/docs/getting-started/channels)

Cosmos supports images, video, and notes organized into collections, including collaboration. It is a useful reference for media-first inspection and browsing, rather than evidence for how our public drawing should synchronize. [Cosmos saving and organizing](https://help.cosmos.so/en/articles/17508514-saving-and-organizing)

Our addition is an explicit **Build on this** action. It starts a new contribution with a source reference and suggests a nearby spot. The original author’s work is unchanged. A small attribution such as “Inspired by this memory” links the two. This creates a meaningful connection even when the two users are never online together.

Start with one relation type, inspired_by, stored as ordinary relational data. A graph database is unnecessary for traversing these references. Suggested semantic similarity remains separate from an intentional human link.

### Ownership and conflict

Anyone with contribution access can repaint the public grid. Only the author or an operator can edit or remove an authored memory. Nobody needs to become an artist to participate: leaving words or an image is a complete contribution.

Overpainting a mark does not erase its attached memory. Replacing artwork never implies agreement with the memories around it. Members do not own territory in the first release. Scene names and invitations are operator-curated for the pilot; formal group ownership, scene voting, and user-created scene administration are deferred.

Public paint undo restores only cells still last-written by the selected operation. It preserves subsequent edits by others. An operator can deliberately clear a selected area as a new moderation operation and redact offending original-mark previews. This is a different operation from an author’s undo.

## 2. The visual and interaction design

Preserve the liked mockup’s cool gray dot grid, cobalt primary action, soft lilac/yellow/pink/green notes, mixed media, and pixel landmarks. Use ordinary readable type for memories; reserve monospaced labels for compact metadata. The playful artwork supplies personality, while controls stay quiet and consistent.

Avoid presenting every contribution as a permanently expanded sticky note. At a distance, the shared composition should be legible. Closer views reveal selected notes and media. Dense anchors collapse into a count or small stack with an accessible list.

Historical work on Data Mountain found benefits from spatial organization in its specific document-management study. It is a useful rationale for preserving recognizable locations, not proof that a spatial UI is universally better. Our inference: semantic search should highlight and navigate the existing world instead of moving everybody’s contributions into a new AI arrangement. [Data Mountain](https://www.microsoft.com/en-us/research/publication/data-mountain-using-spatial-memory-for-document-management/)

### Main screen

- Top: Memory Box, a compact search entry, and **Leave something**.
- Main surface: shared scene artwork with restrained memory previews.
- Bottom: build tools, color, undo, zoom, and a route back to the whole world.
- One contextual panel: contribution details, composer, search results, or an answer.
- Scene entry: short invitation, a few recent actual changes, and **Help build this**.
- Returning visitor: an in-app path to actual changes around their contributions. No push/email notification system in the first release.

The page initially fits a meaningful scene. The user can zoom out to the commons. Search is always available, but does not occupy the center of the first visit.

### Contribution flows

**Paint:** choose a small brush or stamp → preview its affected cells → place → receive accepted/pending feedback → optionally attach a memory.

**Text:** write immediately → preview the note → choose a spot or accept a suggested spot → publish.

**Image:** upload → see a preview → optionally explain “What is this, or why are you leaving it?” → choose a spot → publish. Description generation and search indexing have their own status.

**Link:** paste a validated HTTP(S) URL and write context. The MVP does not crawl the destination or pretend to know its contents.

**Build on this:** inspect an original → choose the action → create a new note/image/link with an explicit source reference → preview its location → publish. The reference is preserved if the contribution is placed elsewhere.

The composer has a visible Public label, reversible draft state, and one clear publish action. Title and tags are optional. Do not force a memory to attach to a paint operation.

### Search and answer flows

Use a unified entry with explicit Find and Ask modes, plus Whole box / This scene scope.

Find displays real thumbnails and excerpts. Numbered markers identify the same sources in the world. Opening one preserves the query and results. A **Show on canvas** action lets people choose camera movement instead of unexpectedly moving their view after every keystroke.

Ask first shows the selected sources, then a short answer. Citations open the original, including author, source type, date, and location. A visible “Based on these 6 contributions” explains the answer’s scope. On mobile, opening a citation partially collapses the bottom sheet, highlights the source, and preserves **Back to answer**.

When evidence is insufficient, show that state and useful near-matches without presenting them as an answer. **Leave this as a question** creates a draft only on the person’s explicit action.

### Motion, accessibility, and density

A local accepted mark settles once. A remote committed change gets one brief outline. Avoid constant pulses, floating names over every object, or artificial presence. Respect reduced motion, maintain focus when panels change, and use text labels as well as color.

Support click/tap to select a location and a second click/tap to place. Add keyboard movement and explicit zoom/pan buttons. Keyboard support alone does not provide a single-pointer alternative to dragging; W3C’s guidance distinguishes these requirements. [Dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements)

Provide an HTML list of contributions with the same source details and actions. Pixel rendering cannot be the only way to browse, search, or contribute.

## 3. Which real-time approach fits

Synchronization is a product contract: what changes can conflict, who is allowed to make them, and what happens after a disconnect. A WebSocket library does not decide these rules.

| Option | Verified capability | Fit and tradeoff | Recommendation |
| --- | --- | --- | --- |
| Supabase | Postgres, Auth, Storage, Realtime Broadcast, channel authorization, vector extension | One durable source for originals and search eligibility; we implement accepted-operation ordering and recovery | Preferred for the bounded pilot |
| Convex | Reactive queries and transactional mutations; full-text and vector search | Less reactive application plumbing; different database/query model from Postgres | Strongest alternative |
| Liveblocks | Persistent collaborative Storage with conflict resolution; ephemeral Presence | Very convenient for collaborative objects, but room limits and pricing matter for one public canvas; search data still needs a clear authority | Good for small collaborative rooms; weaker default here |
| Yjs + a provider | Shared data types merge concurrent updates; network and persistence are separate integrations | Valuable for shared text and offline work; application permissions, abuse controls, and durable source handling remain ours | Add only if co-editing the same document becomes a requirement |
| PartyServer + Cloudflare Durable Objects | Programmable room servers, durable state, WebSockets, hibernation support | Strong control over batching, fanout, and server rules; adds operational and cross-service consistency work if memories stay in Postgres | Alternative for richer live interaction or larger rooms |
| tldraw SDK + sync | Canvas editing SDK and production sync deployment path | Saves editor work but adds a broad editor model and production-license requirements | Only if a full canvas editor becomes the actual product |
| Excalidraw package | Embeddable editor; host applications implement collaboration | Its editor behavior/style would need adaptation; package installation alone does not add multiplayer | Useful reference, not our starting renderer |

Sources: [Supabase Broadcast](https://supabase.com/docs/guides/realtime/broadcast), [Convex realtime](https://docs.convex.dev/realtime), [Convex transactions](https://docs.convex.dev/database/advanced/occ), [Convex vector search](https://docs.convex.dev/search/vector-search), [Liveblocks Storage](https://liveblocks.io/docs/products/sync/storage), [Yjs](https://github.com/yjs/docs), [Cloudflare WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/), [tldraw sync](https://tldraw.dev/docs/sync), [Excalidraw package FAQ](https://github.com/excalidraw/excalidraw/blob/master/dev-docs/docs/%40excalidraw/excalidraw/faq.mdx).

### Current details that change the comparison

As checked on 20 October 2026, Liveblocks documents 10 simultaneous connections per room on Free and Pro, and 50 on Team. Its pricing page lists Pro at $30/month and Team from $600/month on monthly billing. Account-specific arrangements may differ. A 30-person single-room pilot therefore does not fit the listed Free/Pro room limit. [Limits](https://liveblocks.io/docs/pricing/limits), [Plans](https://liveblocks.io/docs/pricing/plans)

The tldraw SDK is source-available under its own license. Production use requires a valid trial, commercial, or discretionary hobby license; hobby use includes a watermark. Do not treat the SDK as an unrestricted MIT dependency. [tldraw license](https://tldraw.dev/community/license)

PartyKit’s managed platform is winding down: the official migration guide says new projects stopped on 9 October 2026, deploys stopped on 16 October, and shutdown is scheduled for 23 October. It directs new work to PartyServer deployed into the developer’s own Cloudflare account. This is a specific reason not to start from an old hosted-PartyKit tutorial. [Migration guide](https://docs.partykit.io/guides/migrate-to-partyserver/)

Convex vector search is documented as consistent and immediately reflecting writes, but is called from actions rather than ordinary reactive queries. It does support full-text search too. The reason to prefer Supabase is relational control and our proposed data model, not a claim that Convex lacks search. [Vector search](https://docs.convex.dev/search/vector-search), [Full-text search](https://docs.convex.dev/search/text-search)

### CRDTs are optional for these product rules

Figma’s 2019 engineering account describes property-level server ordering and immediate local updates. It illustrates why conflict handling should match the edited data; it is a historical account, not a statement about all of Figma’s current internals. [Figma multiplayer](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/)

Our shared pixels use later-server-accepted-write wins. Authored memories use owner edits with version checks. This does not require character-by-character merging. Yjs becomes more compelling if several people must type into the same scene description or compose one text together while offline.

For the pilot, disconnected drawing stops committing; authored drafts remain locally recoverable. Reconnect reloads current state before further placement. Do not silently apply a long backlog of offline paint over somebody else’s work.

### Fanout matters more than the socket count

Supabase counts a sent Broadcast plus its deliveries to subscribed clients. Its listed limits currently include 200 connections/100 messages per second on Free and 500 connections/500 messages per second on ordinary Pro. Limits vary by plan and configuration. [Message accounting](https://supabase.com/docs/guides/platform/manage-your-usage/realtime-messages), [Realtime limits](https://supabase.com/docs/guides/realtime/limits)

Illustration, not a benchmark: if 30 participants each send 5 cursor updates/second, and each update reaches the other 29 participants, that is approximately:

**30 × 5 × (1 + 29) = 4,500 message events/second, or 16.2 million/hour.**

This excludes other activity. Throttling each cursor to 5 Hz does not make a global room automatically inexpensive.

The MVP should show accepted edit highlights and low-frequency scene presence. Continuous cursors are disabled by default. If introduced, they must be scene/viewport-scoped, visibility-aware, rate-limited, and evaluated against actual fanout.

A target of 30 live visitors is a load-test scenario, not a launch promise or a Free-plan claim. Test typical and worst-case writers separately; derive the admitted load from measured latency and quota headroom.

Cloudflare’s billing model differs: its documentation says outgoing WebSocket messages have no request charge and incoming messages get a 20:1 billing ratio. Compute/storage and always-active rooms still cost money; hibernation helps only when idle. This makes a room server worth evaluating for chatty interaction, without proving it is cheaper for our eventual workload. [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [Hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)

## 4. Search, RAG, and what “memory” means here

### Preserve originals

A memory is an authored artifact with a stable ID, version, attribution, location, visibility state, and optional media. Its embedding, OCR, generated description, and suggested related items are derived representations.

Agent-memory products can be useful elsewhere. For example, Mem0’s default add flow extracts facts or preferences from messages, with a raw-storage alternative. That is not the primitive we need for a communal archive. We need originals people can inspect and remove, plus relationships they intentionally create. This is a fit decision, not a claim that an agent-memory tool cannot store raw material. [Mem0 add flow](https://docs.mem0.ai/core-concepts/memory-operations/add)

Keep authors’ recollections distinct even when they disagree. Similarity does not establish identity, consent, agreement, or factual truth. A drawing near a note does not prove its meaning.

### Different questions need different evidence

| User intent | Evidence and operation | Display |
| --- | --- | --- |
| “That photo of a red bicycle” | Keyword, semantic, and potentially native image retrieval | Original matches |
| “Memories about music and parents” | Hybrid retrieval with distinct sources | Sources plus optional cited synthesis |
| “What did people add here today?” | Time-filtered activity records and current originals | Activity list; optional grounded explanation |
| “How many people contributed?” | Database aggregate with a stated time/scope | Exact count and scope |
| “What themes connect these five notes?” | The five explicitly selected originals | Bounded synthesis |
| “What does the whole community think?” | Not established by top-k nearest matches | Explain the limitation; offer scoped examples |

An activity view uses ordinary application queries. The model never receives unrestricted SQL access. Ask may use a small validated intent classification, then application code selects one of these fixed paths. Unsupported global-statistics questions get a scope clarification or a factual limitation.

### Retrieval baseline

Start with PostgreSQL full-text search plus vector similarity, fused using reciprocal rank fusion. PostgreSQL’s built-in text ranking is not BM25; the Supabase example uses ts_rank_cd. Label the implementation accurately. [Supabase hybrid search](https://supabase.com/docs/guides/ai/hybrid-search)

The BEIR paper found BM25 a strong baseline across its evaluated datasets and found benefits and costs from more complex retrieval approaches. It does not establish which current model will win on Memory Box. The implication is to preserve a lexical baseline and evaluate several retrieval paths on our own material. [BEIR](https://arxiv.org/abs/2104.08663)

For a small corpus, use exact vector distance over eligible records. pgvector defaults to exact search; approximate indexes trade recall for speed, and filtering can cause too few candidates. Add HNSW after measuring latency and filtered recall against the exact baseline. [pgvector documentation](https://github.com/pgvector/pgvector)

Each short memory stays intact. Build retrieval text from explicit fields: author text, optional title, selected scene/invitation, linked original ID, and separately labeled machine-derived text. Do not attach invented personal context. Anthropic’s contextual-retrieval work highlights context loss when splitting documents; for our small notes, preserving their real context is a simpler first response than generating a contextual paragraph for every fragment. [Contextual retrieval](https://www.anthropic.com/engineering/contextual-retrieval)

Initial tuning proposal: up to 20 lexical and 20 vector candidates, deduplicate by original, and select up to 8 relevant originals for an answer. Consider author/source diversity among relevant candidates so one prolific person does not occupy every slot. Do not force diversity by including irrelevant material. These are defaults for evaluation, not proven optimal values.

### Images deserve an actual comparison

There are three useful retrieval experiments:

| Candidate | Representation | What it tests |
| --- | --- | --- |
| Text baseline | Human caption + separate OCR/visual description, embedded with text-embedding-3-small | Cost, simplicity, inspectable textual evidence |
| Gemini Embedding 2 | Native image/text embeddings in its supported shared space | Whether visual details absent from captions become findable |
| Cohere Embed 5 | Native text/image or mixed input; documented compatible Pro/Fast variants | Another multimodal retrieval approach |

Current official docs identify Gemini Embedding 2 as a stable multimodal embedding model. Cohere announced Embed 5 on 30 September 2026. These are candidates to test, not automatic quality winners. OpenAI’s text embedding models are text-only, so that baseline requires textual image representations. [Gemini model](https://ai.google.dev/gemini-api/docs/models/gemini-embedding-2), [Cohere release](https://docs.cohere.com/changelog/embed-v5), [OpenAI embeddings](https://developers.openai.com/api/docs/guides/embeddings)

Use separate indexes/columns for incompatible model spaces and record model/version/dimensions/normalization. A query must use the compatible model and preprocessing. Do not merge raw cosine scores from unrelated models. If comparing outputs, fuse ranks and deduplicate sources.

Native embeddings retrieve an image; they do not explain or prove its contents. If an answer needs a visual claim, give the answer model the original image through a supported vision path, or restrict the claim to the available labeled caption/OCR. Never manufacture visual evidence from a similarity score.

For the default pilot, begin with the text baseline. Promote a native-image route only if it materially improves the image subset without unacceptable text regressions, latency, or cost. Image retrieval remains useful through human captions if generation is unavailable.

### What to defer

GraphRAG addresses questions that need broader corpus structure through graph-derived summaries. That can be useful, but it adds extraction, freshness, and deletion work. We do not yet have evidence that our small, frequently changing memories need it. Explicit human links and scoped retrieval are sufficient to test the idea. [GraphRAG global search](https://microsoft.github.io/graphrag/query/global_search/)

Similarly, start with a small typed retrieval service and a model adapter. An AI orchestration framework or autonomous multi-agent workflow is not required to fetch records, rank them, and generate one answer.

### Citation quality is a separate test

A valid source ID does not mean the claim is supported. ALCE evaluates correctness and citation quality separately; its historical results should not be treated as measurements of today’s models. It provides a useful evaluation principle. [ALCE](https://arxiv.org/abs/2305.14627)

For each answer, preserve source ID/version, excerpt or representation kind, author, scene, and anchor. Show the bounded source set. Validate IDs against it. Evaluate support claim by claim. Show disagreements instead of flattening them into consensus.

Retrieved material is untrusted data. The answer path has no write tools and no ability to follow instructions in contributed notes. Generated answers are not inserted into the public memory corpus. Saving a generated idea later would require an explicit, labeled human publishing action.

## 5. Proposed architecture

### Small dependency set

- **Next.js + TypeScript:** interface, server mutations, retrieval, and streaming endpoints.
- **Canvas 2D + React/HTML overlays:** finite pixel surface and accessible media controls.
- **Supabase:** Postgres, Auth, Storage, Realtime, Queues, and Edge Functions.
- **pgvector + native full-text search:** search representations beside source records.
- **AI SDK, optionally:** provider adapters and structured streaming. Our source IDs and claim checks remain application logic.
- **One active embedding model and one answer-model configuration:** pinned and evaluated before launch.

Next.js supports request/response Route Handlers. AI SDK provides structured generation and streaming, but its source fields do not automatically create valid citations for our private application records. [Next.js handlers](https://nextjs.org/docs/app/getting-started/route-handlers), [AI SDK structured output](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)

Use plain Canvas 2D first because the board is a bounded grid, rather than a general vector editor. Konva becomes useful if draggable/transformable object behavior grows; PixiJS if measured rendering needs justify its scene graph. Both still require deliberate accessibility work. Konva’s guidance emphasizes actual rendering, redraw, and hit-detection measurements; Pixi’s accessible overlays are opt-in. [Konva performance](https://konvajs.org/docs/posts/canvas-performance.html), [Pixi accessibility](https://pixijs.com/8.x/guides/components/accessibility)

### Durable records

| Record | Purpose |
| --- | --- |
| World / scene | Bounds, invitation, public state, revision |
| Cell and paint operation | Current color; author, operation ID, revision, changed cells |
| Memory | Owner, type, content version, anchor, scene, visibility/index state |
| Asset | Storage reference, validated media metadata, lifecycle |
| Representation | Author text vs OCR vs AI description, model/version, embedding |
| Memory link | Explicit source and destination IDs with inspired_by type |
| Event | Durable references for public activity and recovery |
| Report / moderation action | Memory or paint target, operator resolution |
| Queue job | Source/version, attempts, lease, next attempt, status |

No embedding or model summary owns a source. It must be possible to rebuild the index from eligible originals.

### Accepted edits

The browser previews a paint operation immediately. A server transaction validates identity, permissions, current canvas state, cell count, and limits; assigns an ordered revision; writes changed cells and an operation record; and emits a committed event.

Use a unique client operation ID so a retry returns the earlier result. For a small world, serialize paint acceptance through a revision record. This is a simplicity choice whose contention must be measured. It is not an unbounded-scale design.

Separate the confirmed canvas from pending local previews. An older incoming operation must not flicker over a newer pending preview. Rejected operations remove their preview and restore confirmed state without deleting a memory draft.

Subscribe and buffer update notices before loading a consistent snapshot. Each response carries a canvas revision and public-history epoch. Fetch accepted cell changes after the known revision, coalescing nearby notices into one request; apply a response only if its epoch and revision are valid. On gaps, request a fresh snapshot. The server's raw operation log is private. Public recovery is a checked projection of it, never a raw log download.

Public committed broadcasts carry only allowlisted update notices: world ID, revision, public-history epoch, eligible target IDs/versions, changed-region bounds, and publication/removal action. They contain no pixel colors, memory bodies, hidden asset references, or before/after diffs. Clients fetch current permitted cell deltas or originals through access-checked endpoints. This adds a read round trip, which the realtime experiment must measure. Coalescing and shared current-revision results can reduce redundant public canvas reads without caching hidden source content. Mutation acknowledgements can immediately return the accepted caller's operation. Processing details belong to owner-authorized status.

Any operator paint clear/redaction starts a new public-history epoch. Recovery requests from an older epoch receive a resync instruction and a current snapshot; they never receive the old cell diffs. Public snapshots and original-mark previews from prior epochs are withdrawn. Browsers discard buffered changes on an epoch change. Fresh public delta responses cannot include redacted operations or historical pixels from before the current epoch; the operator-only log can retain the audit trail. Provider replay can at most repeat these metadata notices, not reconstruct removed pixels. Public activity remains a list of permitted references and moderation events. This prevents new delivery of removed historical representations, while already viewed or downloaded copies remain outside the application's ability to recall.

### Ingest and index

Save and validate original → publish eligible content → transactionally enqueue its current version → worker produces derived representations → worker writes only if the source still exists, is eligible, and has that version.

Supabase documents a queue/trigger/Edge Function architecture using pgmq, pg_net, and pg_cron. Use bounded batches, a prompt processing wake-up, and scheduled retries as a backstop. The queue provides durability; application version checks and idempotency prevent stale jobs from restoring old content. No untracked background promise after returning an HTTP response. [Automatic embeddings](https://supabase.com/docs/guides/ai/automatic-embeddings)

Indexing state is visible: “On the canvas · finding connections…” A failure leaves the published original and its human-text search available, with a retry state. The system must not block painting because an embedding provider is down.

### Source lifecycle

Author edits create a new content version and invalidate old representations. New queries only use current eligible versions. Old answers show that a source has changed when opened.

Deletion or moderation immediately makes a source ineligible for reads/search, then queues asset/index cleanup. Stale workers cannot resurrect it. Hide and restore respect the same rules; restoration reindexes the current version.

Generated answers remain session-local in the pilot, with no persistent shared answer cache. On source removal, an affected open answer is cleared. Reconnecting clients revalidate answer sources before redisplaying them. Already viewed or downloaded material cannot be recalled.

Use private asset storage and access-checked short-lived delivery. Pending uploads remain private. Immediate deletion blocks new access; previously issued URLs or local browser copies have an explicit expiry/cache limitation. Do not claim instantaneous revocation of already delivered bytes.

### Public access and operator controls

The initial public landing view is a labeled static snapshot with no realtime subscription. Entering the live view, opening an original, using Find, or using Ask automatically creates/resumes a guest reader session and joins the public update-notice channel; no account form is required. Painting and publishing use that same identity. A person need not contribute to search or ask. All these live readers count toward the admitted live population and tested fanout. Offer identity linking after the first contribution for cross-device ownership.

If live admission or guest setup is unavailable, retain the clearly labeled snapshot view and explain that live exploration is temporarily unavailable. Do not silently run Ask without its source-invalidation channel. On connection loss, mark source views stale and temporarily hide generated answers until their sources are revalidated after reconnect; retain the question so this is recoverable. Do not imply live freshness. This explicitly scopes source-removal handling to admitted interactive sessions, rather than promising to update disconnected browsers or screenshots.

All mutations are server validated; ownership is separate from being signed in. Exposed tables need deliberate grants and RLS. Supabase’s 2026 changes make these grants explicit and protect its realtime schema from custom objects. Keep application data/functions in application schemas and use supported authorization policies. [Data API grants change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically), [Realtime schema change](https://supabase.com/changelog/realtime-schema-locked-down-against-modification)

Before a public pilot, support:
- Validated images and HTTP(S) links; upload limits; metadata stripping.
- Report/hide/restore/delete for memories.
- Area reporting, operator clear, redacted previews, contributor suspension, and server-enforced painting pause.
- Per-session/IP and global operation limits, with changed-cell cost so stamps are not a loophole.
- Ask quotas, request timeouts, queue retry limits, and an operator model-spending ceiling.

These controls implement a public contribution surface. They are not additional social features.

## 6. The smallest useful pilot

Ship:

1. One world with three seeded invitations; no compulsory topic.
2. Shared paint/stamps, low-frequency presence, accepted-change highlights, recovery.
3. Text, static image, and link memories with owner controls.
4. Source inspector and one explicit Build on this relation.
5. Find with keyword and semantic retrieval.
6. Ask with citations and bounded scope; all interactive readers receive source-invalidation notices.
7. Structured scene activity and actual return-visit changes.
8. Operator moderation and usage controls.

Audio stays the first media follow-up. Full-text co-editing, private rooms, automated webpage crawling, video/PDF ingestion, AI-generated public murals, global theme dashboards, GraphRAG, continuous global cursors, and scene governance stay outside the pilot.

The 96 × 64 grid, stamp patterns, and cooldown from the first blueprint are provisional prototype settings. Compare layouts at the same viewport and observe whether additions are visible and whether anyone can dominate. Treat changed-cell budget, operation cooldown, and memory-posting quota separately. Refill/cooldown constants are builder-tuned within the measured public-load envelope.

Do not reset or archive a live world automatically. A future “chapter” event with a visible closing time and preserved archive is a separate product experiment. It may suit build-in-public, but research does not establish that a timer is necessary for this community.

## 7. Evidence to collect before committing the full build

### Interaction study

Use the liked prototype to test roughly 5–8 people, including people who do not identify as designers. This is directional usability work, not a statistically representative retention study.

Tasks: arrive without explanation; add something; build on another person’s original; find an earlier memory; follow an answer citation; return to the previous view.

Observe:
- Can they explain what can be changed by others?
- Do they understand both painting and leaving media?
- Do they voluntarily extend another person's contribution?
- Can they find an original without knowing its wording?
- Does Ask cause exploration, or end the visit?
- Where does the canvas become crowded or confusing?

### Realtime experiment

Before broad implementation, test two sessions, then 10 and 30 clients with explicit viewer/writer mixes. Record commit latency, remote-visible p50/p95, message rate, retries, reconnect time, database contention, and per-session resource cost.

Required failures: same-cell race, duplicate request, lost connection, missed event, suspension during a session, provider outage, partial undo, and deletion while another user is viewing a cited source.

Initial targets remain immediate local preview and remote committed changes within roughly one second under the agreed pilot workload. They are targets to measure. If Supabase cannot meet them with quota headroom and acceptable cost, evaluate a room-server implementation before migrating anything.

### Retrieval experiment

Assemble about 100 varied, clearly labeled evaluation originals and 60 human-reviewed queries. Include short notes, proper names, paraphrases, images with and without captions, cross-scene connections, conflicting recollections, irrelevant questions, multilingual examples if likely for the cohort, and deleted/hidden records.

Compare:
- Lexical only.
- Vector only.
- Hybrid.
- Hybrid plus a reranker if needed.
- Caption/OCR images versus native multimodal retrieval.

Measure source Recall@5/10, ranking quality, image-subset performance, citation support, appropriate abstention, source-opening success, latency, and cost. Human judgments establish expected sources. LLM judging may help triage, but does not define its own correctness.

Suggested promotion rule: prefer the simplest path unless a more complex one materially improves the relevant subset without unacceptable regressions. Predeclare the decision criteria before viewing the comparison. No provider was benchmarked during this research.

### Public experiment

Run the first session with a small invited cohort, then leave the world open asynchronously within its tested capacity. Capture actual events such as contribution_created, inspired_link_created, source_opened, search_completed, answer_citation_opened, and return_to_scene. Avoid logging private drafts or raw search content by default.

Distinguish simultaneous activity from collaboration. More than one person being online is insufficient; look for multi-author extensions of the same scene, explicit source relationships, and successful discovery of someone else’s memory.

The strongest first demonstration remains two independent participants changing one picture, leaving attributed memories, discovering a source with different wording, and inspecting a cited connection. Add a reconnect and deletion case to demonstrate that it is real.

## 8. Confidence and unresolved decisions

High confidence from current documentation: the shortlisted systems offer the stated primitives; licensing/room-limit/platform-shutdown caveats are real; full-text and vector retrieval can coexist in Postgres.

Reasoned recommendation: scenes plus attributed originals are the best fit for the user’s current direction; Supabase is the most balanced initial architecture under the bounded interaction contract.

Unproven: that strangers will return, that painting and remembering reinforce each other, that a particular embedding model wins, or that the proposed stack meets the target workload. Those are the purpose of the experiments.

Still open to iteration: how prominent painting is relative to media, which scene invitation works first, exact density and canvas dimensions, contribution allowance, native-image retrieval adoption, and the final answer model. These are explicit product/tuning choices, not hidden claims of completed design validation.

The next useful artifact is an updated interaction storyboard showing arrival, a joint build, text/image insertion, related discovery, and source-grounded Ask. Follow that with narrow technical experiments once building is authorized. This research does not authorize a cloud purchase, production deployment, or an app implementation.
