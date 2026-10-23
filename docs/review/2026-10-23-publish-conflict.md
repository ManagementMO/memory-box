# Publish conflict investigation

The single mobile build-on POST that returned 409 during PR16 remains historically unattributed. Its test discarded the response body before failing. The retained creation window contains only the source original, including withdrawn tombstones; there is no earlier note supporting an idempotency conflict. Repeating the flow successfully does not recover that missing evidence.

## What the investigation establishes

Text creation authorizes the visitor, reads their profile, validates the input and calls `mb_create_memory`. It does not read a snapshot or supply an expected version. The hosted function matches the migration: a genuine creation conflict requires an existing original for the same author and client ID with a different request hash. Canvas revisions, another visitor's painting and indexing do not create that conflict.

Six locally traced desktop/mobile collaboration scenarios produced 18 successful create RPCs and 18 HTTP 201 responses. Each scenario painted, published text and uploaded a photo using two disposable accounts. Authentication and profile calls succeeded. This establishes the observed baseline, not the cause of the historical failure.

The original gateway log window shows successful authentication, profile and source creation calls, without a recorded second create call or gateway 409. Absence from those logs cannot prove which transport or application layer failed.

There is a reproducible pre-insert false-conflict mechanism. The installed Supabase SDK copies a non-JSON gateway response into its error message. An XML response containing `version="1.0"` therefore matched the former broad `/version|conflict|changed.since|client_id_reused/i` classifier. The existing exact identifier classifier, merged in PR16, correctly returns 503 for that response. A route regression now exercises the actual SDK, authorization and RPC wrapper with an isolated synthetic 502 response from `mb_profile`: no create call occurs. It also exercises a real-shaped database idempotency rejection separately. This does not establish that the historical request received XML, HTML or a 502.

## Diagnostic gap repaired

Recognized conflicts previously returned before any server diagnostic. Every memory POST now receives a server-generated `X-Memory-Box-Request-Id`, also attached to unexpected-failure and recognized-conflict diagnostics. Incoming request-ID values are ignored. The current phase distinguishes authorization, input validation, image finalization, creation and scheduling background work. RPC errors retain the SDK's numeric upstream status, including zero for a transport failure, without forwarding an upstream body to the browser or logs.

Conflict diagnostics contain an allowlisted identifier, bounded database operation and code, upstream status, phase and request ID. They do not contain stories, identities, client contribution IDs, request URLs, headers, cookies, tokens, SQL or raw upstream responses. The response body and existing user-facing behavior remain unchanged. Successful requests do not log their contents.

The collaboration browser helper includes this request ID alongside its bounded, disposable-fixture response evidence if a future publish fails. There are no production retries, rotated contribution keys, relaxed conflict checks or database migrations. No component markup, CSS, colors, fonts, icons or canvas behavior changes.

## Verification

- Three route regressions failed on missing correlation before implementation and pass afterward, exercising the installed SDK behind a replaced network boundary. These are synthetic transport checks, not provider incident evidence.
- All 386 unit tests across 44 files pass. TypeScript and the production build pass.
- A real-backend browser regression checks concurrent identical requests return the same original; changing a reused request rejects with 409 without altering it; another visitor can independently use the same client ID; every HTTP attempt has a distinct request ID. It failed against the earlier build on the missing headers, while the underlying database semantics already passed.
- The full desktop/mobile run passed 46 scenarios; two provider-generation checks were deliberately reserved for the production release check. Both viewport projects passed the new real-backend contract. The server recorded only the two intentional idempotency warnings, with no unexpected request failures.
- The isolated PostgreSQL profile-revocation concurrency regression passes. Independent code review found no correctness or privacy issues.
- All 56 local fixture ledgers were cleaned: 50 originals withdrawn, 14 image assets deleted, 78 disposable actors removed, and no owned originals or activity left public. Only verified test uploads are credited back to the application's upload allowance using the existing idempotent journal and compare-and-swap; provider usage is not refunded.
- Exact-head CI and final deployment checks are recorded with the release PR. The historical 409 is not declared solved by these checks.
