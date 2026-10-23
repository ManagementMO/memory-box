# Arrival experiment verification

## Local evidence, 2026-10-23

- 399 unit tests across 47 files pass; TypeScript and the optimized production build pass. The pinned PostHog SDK installation reports zero npm audit findings.
- Ten arrival browser cases pass across desktop/mobile with real, disposable Supabase identities. Accepted note, linked photo and brush saves are exercised; failed saves emit no contribution event. Intercepted PostHog payloads prove exposure, stable enrollment, saved-view precedence, a later return session, opt-out and re-enable. Decoding includes the SDK's encoded flag requests. No live PostHog event endpoint receives this browser test traffic.
- The production-build regression set verifies desktop/mobile navigation, all three distances, shared/saved views, source return, real two-visitor painting/cursors, notes/photos/build-on, partial undo and publish-key ownership. Of 42 selected checks, eight isolated-analytics cases and two optional live-provider cases are intentionally excluded in this run; the 32 other checks passed across the main run and a focused mobile cursor rerun. One cursor RGB assertion failed in the main run while another test process was adding/removing world fixtures; the isolated rerun passed. This is a recorded test limitation, not evidence that every live network condition is covered.
- Batched screenshots cover both entrances at 1440px desktop and 390px mobile. Existing mobile layout checks also exercise 320px width. The pastel paper/photos/pixel style and compact controls are preserved.

## Review corrections

A separate code review found and reproduced four lifecycle defects before release: a pre-issued shared-place command could miss the visible-arrival callback; SDK opt-out could persist independently of our setting; SDK remote flags could refresh after capture opt-out; and an initialization lock could resume after the deadline and recreate measurement state after opt-out. Regression cases were made to fail before correcting them. SDK capture is now completely rejected, explicit capture uses an allowlisted cancellable transport, flags pause after their first resolution, and both sides of the queued initialization lock recheck eligibility. The focused final lifecycle reproduction reports zero late SDK requests and absent identity state.

A mobile repeat check then exposed a provisional unchecked setting before its mount effect read the stored preference. Synchronous initialization removes that incorrect first render. Tests now assert the stored opt-out immediately, and three focused mobile repeats plus the full ten-case arrival suite pass after the fix.

## External configuration and limits

PostHog project 683373 contains the 50/50 draft experiment, one primary five-minute contribution metric, four secondary metrics (day-one/day-seven return, original discovery, build-on), custom visible exposure with `is_test=false`, and completed-window filtering. The engagement dashboard uses explicit visits/saved contributions and visit-to-visit retention. Production public build configuration is set in Vercel, with private credentials excluded from Git. Launch follows deployment verification; the merged PR records its final live state.

Six labeled synthetic installation events registered event names and property types in PostHog. They are excluded from the experiment and dashboard. They are not real adoption, return visits or evidence of an A/B winner. Browser tests exercise actual saves against the authorized pilot and clean their own records; the analytics destination is intercepted. The unit/fixture evidence does not establish statistical power, genuine retention or universal delivery reliability. Anonymous identity and best-effort delivery limits are detailed in [operations](arrival-experiment.md).
