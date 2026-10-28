# Arrival experiment operations

The production experiment is [Memory Box: world first vs inside the world](https://us.posthog.com/project/683373/experiments/508782), in PostHog project **683373 / Memory Box**. The linked flag is [`arrival-experience-v1`](https://us.posthog.com/project/683373/feature-flags/987655): **world-first / inside-world**, equal 50/50 allocation. World-first is the baseline. The [engagement dashboard](https://us.posthog.com/project/683373/dashboard/2250466) shows unique daily visitors/contributors and day-zero through day-seven return visits, excluding installation fixtures. Configure and inspect the experiment in PostHog; no personal API credential is needed by the application.

## What changes

- **World-first:** frames bounded occupied geography on desktop and mobile, with actual papers, photos, pixels and entrances.
- **Inside-world:** chooses a meaningful original in a dense occupied area and frames it at readable scale beside neighboring work.
- Both have identical data, tools, live collaboration, typography and pastel pixel materials. No simulated people or artificial content inflation.

Preview production with `/?arrival=world-first` or `/?arrival=inside-world`. These links do not enroll or emit analytics and do not replace the saved view. A shared `#at=` link still wins. A normal returning visit uses its saved view. Only a first-time browser without a shared link or valid saved view can receive experimental exposure.

## Outcomes

Exposure is the custom event **arrival_shown**, sent after the chosen canvas is connected and visible. Reading a flag does not count as seeing the arrival. Every later measured event carries the originally exposed `arrival_variant` and `$feature/arrival-experience-v1`.

| Metric | Definition |
| --- | --- |
| Primary | Unique exposed browser completes an accepted **contribution_saved** within five minutes. |
| Discovery | Unique exposed browser opens an original within five minutes. |
| Collaboration | Unique exposed browser saves a contribution with **build_on = true** within five minutes. |
| Day-one return | **visit_started** on day one after first exposure. |
| Day-seven return | **visit_started** on day seven after first exposure. |

Completed conversion/retention windows are required. The custom exposure excludes **is_test = true** and the experiment excludes participants seen in multiple variants. Inspect desktop/mobile exposure separately before generalizing. Let both retention windows mature; do not stop because an early number looks favorable. The five-minute primary metric is the decision metric; secondary metrics help explain it, not a set of independent winner searches.

## Events and boundaries

`visit_started` represents a visible canvas visit after 30 minutes of inactivity, not each reload or presence refresh. The persisted anonymous browser ID and session markers coordinate tabs through Web Locks where supported. `original_opened` and `place_explored` deduplicate discoveries per loaded app; panning into an actual area requires a short visible dwell. `contribution_saved` runs only after an accepted note/photo/link/paint API response, before snapshot refresh. Locally bounded accepted IDs prevent retry double counting and are never transmitted. Undo and edits are not new contributions. `place_shared` requires successful clipboard or native sharing.

The PostHog SDK only evaluates the first arrival flag. A one-second deadline includes its lazy import and flag response; a timeout keeps the established camera and emits no exposure. Late results cannot jump the view. All SDK captures are rejected; explicit events pass a second allowlist and use the public PostHog `/batch/` API with credentials omitted and no referrer. Remote refresh is disabled after resolution. Opt-out stops subsequent events and aborts pending event requests; re-enable takes effect after reload. An already-issued flag request may finish, but cannot change the displayed arrival. Slow browser initialization locks are checked before writing state and again before SDK startup.

No Supabase identity, email, name, text, photos, file names, queries, URLs, coordinates or drafts are included. Person profiles, autocapture, replay, exceptions, pageviews, performance/heatmaps, surveys and external SDK dependencies are disabled. DNT, GPC, automation, QA links and noncanonical hosts are excluded. Storage/analytics failures leave the normal canvas available.

## Configuration

Set the three public build-time values from `.env.example`: `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, `NEXT_PUBLIC_POSTHOG_HOST` and `NEXT_PUBLIC_ANALYTICS_HOST`. The public write-only project token is expected in browser code; personal PostHog API secrets are not. The production canonical hostname is `memory-box-commons.vercel.app` and the US ingestion host is `https://us.i.posthog.com`. Credentials stay in ignored local environment and Vercel configuration.

To pause the experiment, stop it in PostHog or deactivate its flag. Unassigned visitors fall back to the established arrival; saved views still restore. Removing the public token and redeploying also disables measurement. Stopping the experiment does not delete existing analytics or change authored canvas data.

Six synthetic installation events registered the event schema, under distinct ID `memory-box-install-verification-2026-10-23` with **is_test:true**. They contain no user content and are not adoption evidence. Browser test event requests go to an intercepted fake host. Never add those fixtures to experiment conversion or retention totals.

## Interpretation limits

The October 27 pilot participation release adds local contribution recovery, saved places with real change comparisons, compact unpublished build prompts, distant-label refinement, a protected operator queue and conditional world refreshes. These are shared by both arrivals; this release does not change flag allocation, exposure eligibility, event payloads or metric definitions. Record the common product release when interpreting enrollment over time; it is not a new experiment or a winner decision.

This is an anonymous-browser experiment. Clearing storage, opting out or using another device breaks continuity. Best-effort delivery and blockers can undercount events. The accepted-save boundary measures a completed contribution, not its quality or whether someone loved the experience. Returning sessions use custom visit events; native SDK session metrics are not authoritative here. The shared world's content and occupancy evolve during the test. Synthetic successful tests prove instrumentation and behavior, not real engagement, statistical power or an A/B winner.
