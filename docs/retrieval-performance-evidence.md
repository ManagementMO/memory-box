# Retrieval and performance evidence

These tools separate reproducible QA, bounded reads of a deployment and real adoption. They do not recruit anyone, add content, simulate people or send PostHog events. Neither a full index nor a green fixture suite proves that a real community’s questions retrieve useful originals.

## Snapshot refresh

The public world route reads the current authorized public snapshot before checking `If-None-Match`. Its weak ETag hashes the entire JSON representation, including world identity, epoch, revision, originals, derived image descriptions, index status, events and painting state. Revision alone would miss some indexing changes. `Cache-Control: no-store` remains: the hook retains one receipt in memory and explicitly revalidates it.

A matching 304 has no body and reuses the exact retained snapshot. An unsolicited/mismatched 304 is an error. A successful changed body and its validator install together only after the hook’s existing generation and monotonic checks. Cancelled requests cannot replace the receipt. Failed fresh reads do not fall back to withdrawn originals. This saves response transfer and client parsing when nothing changed; it does not skip fresh database metadata reads, snapshot assembly or hashing. It is not spatial paging.

Preview the bounded performance command without networking:

```sh
npx tsx scripts/pilot-performance.ts
```

Run against a local server or the canonical public deployment:

```sh
npx tsx scripts/pilot-performance.ts --run --origin http://127.0.0.1:3007
npx tsx scripts/pilot-performance.ts --run --origin https://memory-box-commons.vercel.app
```

Default: at most eight GETs, two simultaneous, half-second gaps between batches, 15-second request deadlines and a five MiB decoded body limit. Without an advertised validator, conditional batches are skipped. `--rounds 2` permits at most fourteen requests. Other hosts, credentials in URLs and preview/query/hash paths are rejected. Errors and throttling stop further batches with no retries. Reports contain counts/timing/byte sizes, not original content or author identities. Save local output under ignored `auth/` when needed.

The report measures headers latency, total response time, decoded body bytes and the server’s Content-Length/Content-Encoding when present. Fetch can decode compression automatically; decoded bytes are not wire bytes. Small batches cannot establish p95 latency, production capacity, mobile interaction performance or realtime fan-out. Use a controlled environment with explicit load budgets before larger concurrency testing.

### Baseline observed on October 27, 2026

Four public GETs of the unchanged deployment, ending **16:38:31 UTC**, returned revision 1975, 125 originals and 17,643 occupied pixel cells. Every response decoded to **968,328 bytes**. Brotli was advertised, Content-Length was absent and no ETag was advertised. Full responses ranged from **654 to 2,411 ms** in this tiny client-side sample. This is a pre-change deployment baseline, not a claim about users’ page load or current capacity. The ignored raw report is `auth/pilot-performance-production-before-2026-10-27.json`.

The new conditional path must also be verified after deployment. Local unit and local-server results do not establish that a CDN preserves the validator. Keep large spatial/delta loading as a measured follow-up: after the initial payload, unchanged 304s help idle browsing, while a busy world still returns the changed full representation.

A local development-server run ending **16:44:33 UTC** used eight GETs against the same live public snapshot. Its four unchanged conditional responses each returned **304 with zero body bytes**; full responses remained 968,328 decoded bytes. Conditional responses took **395–537 ms** in that small local run. The server still read current public metadata before validating. This proves the local route/validator path, not production CDN behavior or a throughput guarantee. Raw local evidence is ignored at `auth/pilot-performance-local-after-2026-10-27.json`.

## Retrieval regressions

The committed [case set](../scripts/fixtures/retrieval-cases.json) contains labelled starter regressions for exact wording, a paraphrase, a Waterloo joke, an image description, a recorded build-on and a question the initial corpus cannot answer. Missing originals or image descriptions skip that case, rather than silently substituting another original. Fictional starter coverage is not representative real-user relevance.

Run the scorer, runner boundary and existing source/answer authority checks offline:

```sh
npm test -- tests/retrieval-evaluation.test.ts tests/retrieval-runner.test.ts tests/retrieval.test.ts tests/ai.test.ts
npx tsx scripts/evaluate-retrieval.ts
```

Fixture tests use controlled responses and a deterministic model boundary. They validate scoring, scope/citation enforcement, quotation checks, changed/deleted originals and safe failures. They do not benchmark the live embedding model, database ranking, caption accuracy or model selection relevance. The dry run sends zero requests and clearly reports that limit.

Live evaluation is an explicit operator action. Provide an existing test guest session’s access token locally as `MEMORY_BOX_EVAL_ACCESS_TOKEN`; the runner neither creates a guest nor extracts browser credentials. Keep tokens out of command text, shell history, Git and reports. Use a test account that is excluded from analytics. Then:

```sh
npx tsx scripts/evaluate-retrieval.ts --live --origin http://127.0.0.1:3007
npx tsx scripts/evaluate-retrieval.ts --live --with-answers --origin http://127.0.0.1:3007
```

The canonical production origin is also allowed. At most twelve labelled searches and four explicitly enabled answer requests run sequentially, with pauses and no retries. The standard search/ask routes reserve session/global budgets and may retry pending index jobs; answer calls can incur model costs. This is not a database-mutation-free capacity probe. No memories, paint, participants or analytics events are created. A failure/throttle stops the run. The default set uses six searches and, when enabled, four answers plus one public snapshot.

Reports show top-five hits, reciprocal rank, recall over the supplied relevant labels, meaningful semantic matches versus keyword fallback and citation/version/status failures. Unlabelled returned originals are not automatically irrelevant; no precision claim is made. Citation validity is structural, not proof that a passage answers the question or that an authored assertion is true. For images, manually compare the derived description with the image and check that a visually relevant result is not simply matching its authored caption.

For community coverage, create an ignored JSON case file with generic case IDs, consented questions and independently judged relevant original IDs, then pass `--cases-file auth/retrieval-community-cases.json`. Use the committed file’s shape. Include ambiguous slang, misspellings, multiple relevant originals, removed/edited sources, image-only details and genuinely unanswerable requests. Judge relevance before looking at the ranking. Keep the judged set stable across changes; add cases from real observed failures rather than repeatedly tuning one successful example. Do not include personal details or claim these manually selected cases measure community-wide satisfaction.

The same runner can use the existing disposable browser fixture without exporting a session token. The transport delegates to the supported same-origin helper; credentials and Supabase handshakes remain inside the isolated browser. This explicitly opted-in run creates and cleans up a test identity, sends up to six searches and four answer requests, and writes an aggregate report only when `MB_E2E_REVIEW=1`:

```sh
MB_E2E_OPEN_WORLD=1 MB_E2E_PROVISIONED=1 MB_E2E_RELEVANCE=1 MB_E2E_AI=1 MB_E2E_REVIEW=1 \
  npm run test:e2e -- tests/e2e/retrieval-quality.pw.ts --project desktop --workers=1
```

### Provider-backed starter check on October 27, Pacific time

A bounded run against the local production build and hosted retrieval/model services completed at **2026-10-28 06:24:48 UTC**. The public corpus contained 125 indexed originals. Four available positive cases (exact phrase, childhood-road-trip paraphrase, campus joke and recorded build-on) all included their labelled relevant originals in the top five; labelled recall was 1.0 for each, with mean reciprocal rank **0.75**. The paraphrase included a semantic match. Three answer requests produced two source-checked answers and an `insufficient` response for the out-of-corpus question, with no structural citation/version failures. The run used nine requests including its public snapshot; it was not an adoption observation.

**One image case was skipped**, because the labelled goose starter is an illustration with no derived visual description. It is not a passed photo-description test. The one described image elsewhere in the snapshot was not substituted into the labels. Uploaded-photo creation is covered separately by real browser integration, but neither that nor this tiny fixed starter set establishes community photo relevance or caption accuracy. The ignored aggregate report is `auth/retrieval-live-starters.json`. Keep the community-question and visual-relevance evidence gates open; do not tune a semantic threshold around these successful examples.
