# Personal-place import retry candidate

## Reviewed integration — 12 October 2026

The user explicitly authorized reviewing this candidate, integrating it into current source, and committing, pushing and deploying both client and server through the protected workflow. The candidate was integrated without runtime changes onto accepted source `b29abb7b7685b1ecba3c035ac4f6916bb2b13171`, branch `codex/personal-place-import-retry-release-20261012`, in the maintained release checkout `output/care-map-labels-release-20261007`. The original candidate and primary dirty checkout are preserved. The fullscreen seam and Export View release entries remain intact.

Review confirmed owner authentication precedes upstream lookup, exact postal/coordinate validation remains shared, retries are bounded and confined to lookup, cancelled previews cannot update stale sessions, and the final mutating POST is never automatically replayed. All final postal verification precedes the existing owner-locked atomic batch. No schema or authored Help content change is required.

Fresh integration checks pass: `npm run verify:quality` (server 1,203; client 1,009; environment 5; Help CMS 73; static/module graph 634 modules / 1,919 edges without cycles; production client build) and `npm run verify:map-lockdown` (112 tests and build). Five actual-modal fictional browser scenarios pass with zero save requests. The first browser attempt was blocked by localhost sandbox permissions; the authorized retry passed and both logs are retained. These are local checks, not a physical-device or production bulk-save claim.

Integration proof is under `output/personal-place-import-retry-integration-20261012`; scratch fixtures/logs are excluded from the source commit. Paired publication remains gated on exact public-source CI, a fresh unchanged owner workspace, source-pin checks, all four private publisher gates, full custom-domain artifact parity, Worker control-plane provenance and read-only live acceptance. The final release proof will be recorded in the output handoff without a second documentation-only production push.

## Original side-conversation handoff

The following records the candidate before this explicit integration/release request. Its earlier lack of commit/deploy authority is historical.

The user's spreadsheet parses as 89 valid rows. The observed preview failure is not sufficient evidence of an incorrect postal code: Block 503 resolves on a manual retry. A later screenshot shows all 89 preview rows ready, followed by a separate final-verification service-unavailable error stating that no places were saved. The subsequent immediate-error screenshot was from the unchanged live client while this candidate was still local. The exact transient upstream cause was not captured in those sessions.

## Scope and isolation

- Base: `fe0e83f8322c5d3037c627b6261f65288020766b`.
- Branch: `codex/personal-place-lookup-retries-20261012`.
- Worktree: `/Users/sweetbuns/CareAroundSG/output/personal-place-lookup-retries-20261012`.
- The primary dirty checkout, parent's release source, active browser/import, spreadsheet and production records remain untouched by this fix.
- No commit, push, deployment, schema or credential change. These require a separate explicit request in this side conversation.

## Resulting behavior

Preview lookups run through a new authenticated GET endpoint scoped to an owned map. The endpoint is read-only and sends `Cache-Control: no-store`. Guests and non-owners cannot reach the location service. Single-place/manual geocoding stays unchanged.

The import-only resolver allows three attempts, five-second attempt timeouts, one/two-second backoff, and bounded Retry-After handling. Temporary network, rate-limit, upstream-service, malformed payload and incomplete coordinate responses retry. An actual permanent provider rejection returns a service/configuration failure. Successful empty/mismatched responses are reconfirmed; one empty response following transport failures does not falsely blame the postal code. A complete exact result is retained even if a successful response carries provider warning metadata. A failed provider payload without an exact result remains a service error.

The client requests one postal code at a time, deduplicates postal codes and spaces requests by 600ms. A narrow second client attempt covers API transport/gateway failure; an exhausted backend lookup is not restarted. Processing feedback remains visible while these attempts run. Row/category edits survive recovery. Closing or selecting a new file cancels stale lookup results. No intermediate red error, Retry button, or disabled Add-zero label appears during processing. Instructions only suggest correcting rows when actual attention is required.

Final verification uses the same backend resolver and spacing before the existing atomic write. Retry never replays the mutating POST after an uncertain response. Exact matching, finite/range-checked coordinates, leading zeroes, private owner scope, 25-row batches, category/conflict checks, owner lock, duplicate reuse and saved-result reconciliation stay intact.

The terminal messages distinguish a reconfirmed unmatched postal code from an unavailable location service. A permanent outage still needs a clear recoverable message after bounded retries; retries cannot guarantee availability.

## Local evidence

| Check | Result |
| --- | --- |
| Full server suite | 1,203 passed |
| Full client suite | 1,009 passed |
| Client environment suite | 5 passed |
| Locked-map checks | 112 passed |
| Static/module graph | Pass; 634 modules, 1,919 relative import edges, no cycles |
| Production client build | Pass |
| Actual-modal headless browser | 5 fictional scenarios passed |

New focused cases cover transport/rate-limit recovery, exact matching across multiple results, leading zeroes, reconfirmed no-match vs unavailable service, malformed payloads, provider warnings, timeout/cancellation, authenticated owner-scoped lookup, no-store, and recovery/pacing before one atomic write. Existing import tests still use disposable PostgreSQL to check replay, conflicts, privacy, categories and atomicity.

Browser scenarios use the real React modal and Hono lookup handler with an injected fictional map owner, synthetic OneMap responses and one CSV row. They cover desktop/mobile automatic recovery, no-match, unavailable service and closing during lookup. External requests are blocked; there are no persistence requests or page exceptions. This is local browser evidence, not physical Android/tablet or production UAT.

Local scratch fixture, screenshots and JSON report: `output/playwright/import-retries/`. Replay: `node output/playwright/import-retries/verify.mjs`. Logs are retained under that fixture's `logs/` directory. Do not publish private scratch files as product assets.

The first full client run failed because the fresh checkout lacked the ignored generated Help seed. The existing Help check bootstrapped that seed, then full client tests passed. Early browser checks failed from sandbox localhost restrictions and a duplicate React fixture runtime; the fixture was corrected and the final browser run passed. A later server repeat exposed missing root-level PGlite resolution after removing a task-created nested dependency link; the exact locked PGlite 0.5.8 dependency was linked at the correct local resolution path and the suite rerun. Prior logs remain preserved; none of those failures established an import product defect.

## Release and acceptance

The candidate needs current-source integration and an explicitly authorized paired Worker/client publication. At final inspection `origin/main` was one unrelated fullscreen correction ahead, `b29abb7b`; source import files were unchanged, but the new local ledger/handoff entries must be integrated without dropping that release's documentation. Publishing only the client would leave the new endpoint unavailable; publishing only the Worker would retain the old browser behavior. Follow the existing protected publisher, release checklist, authored Help preservation and provenance requirements. Do not change the user's open session or write production test places.

After authorized delivery, verify the client requests the private lookup endpoint, retains Processing during temporary failures, and receives distinct terminal messages. Real bulk-save and physical-device behavior remain separate acceptance evidence. Never call this already deployed or production accepted.
