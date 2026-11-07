# Regional Discovery implementation review — 7 November 2026

## 7 November 2026 — Regional Discovery final-review fixes — LOCAL, SCOPED REVIEW PENDING

The uncommitted candidate remains on `codex/mini-curated-discovery-integration-20261107`, base `71a9a064f19198e5d6a9030146c5a7d650718c06`, in `/private/tmp/carearound-regional-integration-20261107`. Independent whole-branch review identified I1/I2; this single C26 fix wave restores explicit Reset to the current plotted-result extent (max zoom16), with zero-pin regional fallback, and replaces per-owner staff reads with request-local scoped membership batches. Existing permission predicates and shared staff helpers remain unchanged. Save success now survives a failed approval-availability refresh with a separate warning; Escape clears a row's map-only lock while leaving coarse map Done/Escape ownership intact.

Reproduce with the regional serializer in verify-only mode; `node --test client/test/regionalDiscoverySettings.test.js client/test/regionalDiscoverySelection.test.js client/test/regionalDiscoveryPresentation.test.js server/test/regionalDiscoveryCoverage.test.js server/test/regionalDiscoveryEvaluation.test.js server/test/regionalDiscoveryController.test.js server/test/regionalDiscoveryGovernance.test.js`; the regional and selected-venue projection browser commands; then `npm run verify:quality` and `npm run verify:map-lockdown`. Fresh results: focused75/75, actual-App regional38/38, selected-venue projections4/4, supplemental2/2. Quality passes server1367/client1261 plus1 disclosed optional compiled-matcher skip/CMS73/address51/environment5/compiler17; configured build5.97s. Map-lockdown116/compiler17 and its distinct build5.21s pass. Both113-file build trees are preserved. These overlapping cohorts are not summed.

The new real disposable-database regression reproduces1006 reads for500 approved-zone owners before repair, then bounds shared reads at6 and hard-local reads at7; partner-local500-owner reads fall from1502 to at most6. Withdrawal, missing owner, deleted places, real staff roles and no fabricated host authority remain covered. This is local query-count evidence, not deployed latency. Mounted regressions establish filtered Reset, row Escape/hover recovery and successful saved-revision Preview after availability503. Reduced motion, map identity, no filter/Back/hover autofit, zero-pin Reset, read-only network behavior and coarse Done/Escape remain covered.

C27 provenance refresh followed the stale exact evaluation-source guard. The unchanged actual producer ran in a new isolated capture with90 exact dependencies; all12 genuine DTOs were compared before copying. Only fresh publication UUIDs and disposable-record creation/update/share/addedAt timestamps differ; framing bytes and all domain/membership/recipient/privacy values are unchanged. The manifest truthfully names base71a9 and uncommitted source. Prior bytes remain preserved, and the selected-venue projection fixtures remain unchanged. All1164 frozen runtime/test/config inputs stayed exact through successful checks; generated Help seed output is recorded separately. No dependency update or private-content inspection occurred.

Current receipt: `/Users/sweetbuns/.codex/worktrees/carearound-regional-discovery-plan/CareAroundSG/.superpowers/sdd/2026-11-06-mini-curated-discovery-implementation-plan/final-fix/verification-receipt.json` (SHA256 `6b151e2b121042a7121578270a92ee8c16a215dcb86466e163a6ef60826ab3e4`). The prior evidence below is historical. Two loopback-EPERM attempts and fictional setup failures are retained; corrected behavioral REDs and green evidence are separately labelled. **Inspector390×500 remains OPEN**, identically reproduced on clean71a9; it was not rerun, weakened, fixed or waived here. M2 structural-verifier hardening is deferred with exact-DDL/rehearsal release gates; M4 voluntary Discovery/full-view recovery links are an explicit deferred design gap; M5 historical proof labels/tooling remain deferred. No native-language, physical-device, steward, recipient-permission, configured-schema, production-health, protected CMS/source-pin or paired-release proof is claimed. Five parked security findings remain KIV.

Next: one independent scoped re-review of the immutable final fix delta and corrected100-file package. Source acceptance, exact-source CI and the protected schema/backup/restore/interruption/source-pin/Worker→Pages release gates remain separate. No stage, commit, push, schema apply, real-data write, publication or deployment occurred.

## Historical implementation and integration evidence


Status: local implementation and integration candidate; independent Task 10 and whole-branch review remain required. No feature deployment, configured database migration, real directory publication, contact approval or pilot activation occurred in this work.

The branch is `codex/mini-curated-discovery-plan-20261106`, based on `07d4ed0489cb15cf7f906c7097c8b73e690ba3c8`. The implementation is uncommitted: the base identifies ancestry, not a commit containing these changes. Exact working-tree bytes are bound in the evidence below. The primary checkout and unrelated changes were preserved; 186 tracked generated dependency deltas are excluded from the intended source package.

## Result and architecture

The new opt-in `/embed/maps/:token/regional-discovery` route presents a curated directory beside a map. Postal evaluation is read-only and uses only the explicitly entered senior context. The regional route lives outside persistent preference providers; ordinary Discovery and compact/governed/fallback embed routes retain their existing provider behavior.

Owner settings are revisioned and separate from publication. Both existing Share mounts inject the optional editor through one publication/completion path. Save and Preview do not publish. Preview uses the same regional view and epoch-safe hook with the current saved revision and an owner evaluator. Studio and annotation flush failures prevent publication. Published regional URLs come only from current server readback.

The server freezes membership, selected venues, presentation, contact intent and approved Original values, then evaluates current visibility, coverage, public-field permissions and recipient approvals. The public DTO is an explicit allowlist, checked atomically by one shared policy-free validator. No private notes, files, home coordinates, internal geography IDs or regional publication namespace enter ordinary/compact responses. Recommendation changes order, never visibility. Intentional no-pin services remain full directory members.

## Evidence and reproducibility

Run from the selected worktree using its installed Node, Playwright, Chromium and Vite. No install or real API is needed:

```sh
node tests/fixtures/regional-discovery/serialize.mjs
node tests/browser/regional-discovery.mjs --out=ABS_OUTPUT_DIRECTORY
node tests/browser/care-map-area-resource-projections.mjs --out=ABS_OUTPUT_DIRECTORY
npm run verify:quality
npm run verify:map-lockdown
```

The regional serializer command without `--write` validates 12 frozen controller artifacts and 90 producer bindings. It never regenerates them. Browser startup validates those bytes before launching. S1 and S2 share one frozen publication revision. Owner transitions use disposable PGlite and actual settings, preview, publisher, Studio, annotation and compact controllers. Ancillary owner endpoints and the two-row ordinary Discovery comparison are explicitly synthetic transport fixtures, not frozen controller artifacts.

The browser harness mounts actual `main.jsx` → `EmbeddedApp` and separate actual `App` owner branches (`ui=stable` and `ui=v2`); no historical owner source is substituted. In-memory observers record map identity, events, hook references, publication options and storage access without replacing behavior. It rejects unlisted API traffic and external requests. Known map pixels/font CSS are synthetic; Print/Export's bounded asset fetches are also intercepted. It never launches contact applications, writes a profile or accesses real services.

Final receipts below record completed local checks; independent final review remains outstanding. Earlier component/SSR/controller/effect checks remain evidence at their original layer and source revision; they are not relabelled as actual-App or physical-device proof. Test cohorts overlap and their counts must not be summed.

Browser acceptance covers:

- Desktop 1280/1470, phone 390×844, landscape 844×390, coarse pointers, 200% text and reduced motion; bounded controls and no document horizontal overflow.
- Actual grouped Leaflet Enter/Space, repeat suppression, hover/immediate leave to both blank map and outside map, locked-detail immunity, list-retaining row activation, unpinned service keyboard access, chooser Back, list focus/scroll and map-camera retention. Actual drag does not filter or re-evaluate services; zero-pin Reset retains the region basemap.
- Post-commit map focus, Done/Escape return, emulated touch swipe and host scrolling. These are Chromium inputs, not physical-device evidence.
- Four locale contact headings with unchanged exact hrefs; unavailable channels have no actions. The uninjected exact server-label fallback remains covered by the existing Detail rendering tests in the aggregate suite.
- Zero regional storage access, auth/profile/Home/geolocation/save/live-detail calls; only the exact read-only evaluation POST. Locked-detail multi-character typing preserves draft/focus and removes the old recipient before any response.
- Same-publication delayed responses, Clear/Retry/token retirement, full DTO validation, current withdrawn membership and restored publication order. Invalid payloads and transport errors are expressly labelled fault injection. Aborted browser transport and previously accepted controller tests together cover stale-result safety; the browser does not claim an aborted request successfully delivered a stale payload to JavaScript.
- Owner Save/Preview isolation, saved-revision evaluation and stable injected references, CAS conflict/reload, cancellation, unavailable readback, publish intent after flush, exact legacy options without `embeddedView`, current publication copy, disable/re-enable/unpublish and distinct regional/compact embed code. Empty-context retry is an actual mounted-hook callback exercised imperatively, not an additional UI button after Clear. The unchanged compact preview iframe's guest GET is distinguished by frame URL from forbidden regional guest Preview requests.
- Compact search/provider/marker behavior, ordinary Discovery's synthetic default order/search, actual owner Print/Export route and selected-venue projections. Print-route inspection is not PNG pixel or physical-print certification.
- Actual Chromium frame-ancestor enforcement with the current Pages response builder, intercepted HTTPS host origins and a sentinel asset shell: approved host succeeds, wrong host/disabled/error responses cannot expose the shell. This is separate from mounted-App checks, earlier Wrangler-compiled matcher GET/HEAD tests, workerd and deployed Pages proof.

## Technical decisions, reasons and costs

These are public-safe summaries of the reviewed implementation decisions. Costs for C1, C2, C4, C8, C9, C13 and C15, startup/provenance and the deferred schema verifier were assessed on 7 November 2026; they are not invented historical quotations.

| Decision | Chosen boundary and reason | Cost if wrong |
| --- | --- | --- |
| Startup | Isolated worktree; immutable task deltas; explicit owned paths and final package excluding generated dependencies. | Dirty primary work or unreviewed bytes could be overwritten or released. |
| C1 | New owner GET publication metadata derives only from valid active frozen publication and current enable/origin state, never draft. | Draft, disabled or stale URLs could be offered as published. |
| C2 | Available contacts require label/value/server-derived href; unavailable contacts forbid all three. | Destination leakage or malformed actions. |
| C3 | One pure shared contact-value helper, with no permission policy or ordinary Discovery dependency. | Client/server canonicalisation and compatibility drift. |
| C4 | Trim surrounding email whitespace; preserve exact case; compare live/frozen/granted values and hashes. | A valid mailbox could be changed or a different destination silently approved. |
| C5 | Decision actors are historical positive IDs; new decisions still require current Super Admin and atomic audit. Target FKs remain. | Account deletion regressions or lost decision history. |
| C6 | Distance source is independent of pin placement and restricted to deliberately frozen public points. | Fabricated distance, private location exposure or loss of a legitimate selected distance point. |
| C7 | Soft-service area fallback uses explicit coverage rows, not host/admin-derived direct area. Configured invalid/nonmatching zones never fall back. | False geographical recommendations. |
| C8 | Effective-zone authority uses existing per-resource ownership/shared-zone policy, not blanket approval or mere matching. | Borrowed authority could recommend incorrectly, or legitimate service coverage be missed. |
| C9 | Original phone stays the permitted frozen scoped projection; replacement lookup is bounded to confirmed inside-region home context. Unknown modes fail closed. | Wrong-area recipients, unrelated registry reads or venue fallback. |
| C10 | Publication/evaluation utilities are separate; existing publisher imports a utility, not a new controller. | Cycles and shared-publisher regressions. |
| C11 | Local-zone use needs a real current effective principal and actual scope; host links grant no authority. | Fabricated staff/owner rights and borrowed-zone recommendations. |
| C12 | Visitor view and request hook preceded owner integration; owner Preview reuses both with current saved revision. | Divergent UI, stale contacts or published data masquerading as a draft. |
| C13 | Existing approved shared-zone policy can work without a personal owner; ownerless unapproved local zones remain invalid. | Incorrect exclusion or false local authority. |
| C14 | Shared strict public DTO/text validation; client facade preserves its interface. Implicit stable publishing stays independent of regional governance availability. | Producer/client drift, atomic directory rejection or legacy publish regression. |
| C15 | Genuine controller serialization, same-publication S1/S2 and exact source/response hashes; no automatic fixture refresh or self-hash cycle. | Handwritten, stale or cross-publication fixtures could falsely support safety. |
| C16 | Only the exact read-only evaluation POST is exempted from cookie CSRF; early no-store covers the exact new routes and errors. | Broader CSRF exemption or cached sensitive error responses. |
| C17 | Regional mode has one camera owner; default internal renderer behavior remains intact. | Camera resets/animation after Back or loss of necessary shared initialization. |
| C18 | Regional route uses temporary locale outside persistent providers; legacy routes retain their wrappers. Handoff deliberately omits unsupported category `q`. | Storage access, missing translations, changed legacy preferences or misleading search. |
| C19 | Optional translated headings only for available contacts, exact fallback to the server label; values/status/authority unchanged. | Mislabelled purpose or hidden-action regression. |
| C20 | Both Share mounts inject the optional editor; ordinary and explicit actions share one completion/error path and retain exact annotation/image options. | Missing editor, bypassed flush or altered compact semantics. |
| C21 | Regional-only decorative marker descendants ignore pointer events; the stable outer Leaflet icon remains the target. Native hover revealed replaced children swallowing mouseout. | Future actionable marker children could be suppressed; CSS must remain regional. |
| C22 | Regenerate old selected-venue artifacts through the unchanged genuine producer when accepted source hashes change, then compare semantics before updating provenance. | A stale-hash bypass could mask scope regressions or false evidence. |
| C23 | Apply deliberate activation only to coarse primary pointers. Fine-pointer hover, click and keyboard work on first use without autofocus; wheel input still scrolls the host. | Desktop scrolling/keyboard regression or touch gestures trapping the host. |
| C24 | Capture only regional marker left-mousedown, stop propagation without preventing default, and let the existing real-click callback activate after mouse-up. No delay or shared renderer change. | Overbroad interception could suppress native focus, blank-map drag or touch activation. |

C21, C23 and C24 are the regional-map application-source corrections made during final browser QA and scoped review fixes. The shared `DirectoryMap` source remains at its accepted Task 8 version. A browser-only injected-CSS experiment is retained separately from the final no-injection source proof. C22's owner-selected bytes are identical; the other three artifacts differ only in fictional generated publication token/derived paths and timestamps. Membership, selected venues, privacy, coordinates and both presentation modes are unchanged.

## Limits, deferred items and release gates

The existing Browserslist dataset notice and Babel large-dependency note remain disclosed; no dependency refresh was introduced. Task 7's Save-succeeded/metadata-refresh-failed wording was deferred at this historical checkpoint and is corrected by the C26 final-review fix above. Task 8's original static/effect checks retain their limited labels. The schema installation verifier is intentionally shallow: named constraints and basic shape are not proof of complete PK/FK/CHECK structure. Exact DDL comparison and realistic rehearsal remain necessary.

Physical devices, actual coverage, recipient authority, real content permission, a configured database, protected release metadata and production acceptance remain unpassed. Frozen fictional fixtures are not an operational routing dataset. Software may be released inert only after independent final review and project release gates; real publication and steward activation remain separate.

Before release: freeze the explicit source allowlist; complete whole-branch review and exact PR/main CI; verify the selected environment/migration authority, current schema and adoption state, backup/restore and realistic interruption rehearsal; retain the feature-capable API and apply only the reviewed additive schema through the approved process. Migration 0000 is never a repair for an existing database. A new-store bootstrap does not establish migration-journal enrollment.

The protected existing paired publisher must use fresh source/content/configuration metadata and approved source pin, then compatible Worker before Pages. Do not reuse historical helpers or approvals. The 7 November metadata-only preflight observed Worker version 394 at 100%; public health/release requests returned 403 and Pages metadata was not fetched within that narrow scope. Those observations do not establish current application source, content parity, health or Pages identity. Earlier production identities in the ledger are historical until independently refreshed.

Rollback must preserve BOTH selected-venue scope and strict stripping/handling of the private `embeddedRegionalDiscovery` namespace. An older API being “scope-aware” is insufficient. Prefer approved disable or UI rollback while retaining the capable API, additive stores and audit history. Never downgrade to an API that widens membership or exposes the namespace; never erase approval history as rollback.

Recommended next step: independently review the final task delta and whole branch, then complete the existing protected schema/recovery/source-pin and paired-release gates. No commit, push, migration, deployment or real activation is performed by these local receipts.

## Historical initial local verification receipt (before scoped review fixes)

Evidence directory: `/Users/sweetbuns/.codex/visualizations/2026/11/06/01a1aefd-c0a9-7b41-b4da-c8ee48d19dd4/regional-discovery-20261107`. `task10-verification-receipt.json` binds 683 final relevant source files and the report/build/log hashes without a self-hash cycle.

| Check | Result | Evidence |
| --- | --- | --- |
| Actual current App canonical browser | 29/29 pass; zero page errors/unexpected API writes or external requests; exact source unchanged | `browser-final-clean/report.json`, SHA-256 `ff59e52495891fb8f7627793df24f0d2aaee5251f46277441302c4ded9fb6690` |
| Existing genuine selected-venue browser cohort | 4/4 pass after authorised genuine refresh | `projections/report.json`, SHA-256 `e5cf513952a77fe456c29d8fab30a6eba6b53412763aaae49565dde5cda0bbbc` |
| Supplemental current App | 2/2 pass: host scroll stays exactly 100 pixels through Activate/Done/Activate/Escape with controls already visible; email and phone reached by Tab and visible at 200% text | `supplemental/report.json`, SHA-256 `4712e120dacef659b1217452da0122e17ef5a58aa740dbc74c78c062b8a5f954` |
| Final quality aggregate | Exit 0: compiler 17, migration ownership 12, module graph 720/2172 with no cycles, CMS 73, server 1365, address 51, client 1242 pass/1 skip, environment 5, compiler 17 and configured build 5.62 seconds | `logs/regional-task10-quality-final.log` |
| Map lockdown | Exit 0: 116 tests, compiler 17 and separate configured build 19.80 seconds | `logs/regional-task10-map-lockdown.log`; `map-lockdown-build-artifacts.json` |

Both configured builds have separate 113-artifact hash inventories. The map build byte tree was not preserved: the later quality build replaced it (33 map hashes still match current dist, 2 differ, 78 are absent). Its log and captured inventory establish the distinct build, not retained downloadable bytes. The quality inventory matches all 113 current artifacts. Independent gate verification checked 40/40 applicable assertions, all 683 current source bindings and eight evidence hashes; the supplemental script/import boundary also matches. Map build completed while the quality aggregate remained in server tests; the build stages did not overlap. The sole client skip is the optional Wrangler-compiled matcher case already exercised separately in Task 6; it is not counted as a pass here. Cosmetic browser-harness whitespace cleanup happened after aggregates, outside their inputs; the final canonical browser receipt binds the cleaned harness. The supplemental check binds unchanged application/runtime source and the preceding canonical harness (which it does not import).

Retained failures include initial loopback EPERM, explicit fixture/selector setup corrections, the real hover regression and separate injected-CSS diagnostic, stale projection provenance stopping before browser launch, the first quality aggregate's stale exact Pages inventory assertion, Print/Export static-asset transport allowlisting and subpixel camera equality (about 1.7e-11 degrees). The final harness requires identical map identity/zoom and less than 1e-8 degrees of coordinate drift. No application camera tolerance or production behavior changed. The Pages inventory correction adds only the exact new function path; route include/exclude expectations remain intact.

The first quality aggregate failed with server 1365/address 51 passing, client 1241 pass/1 fail/1 skip and no quality build reached. The focused inventory correction then passed 5/5 before the complete successful retry. Prior accepted browser29 and its exact harness remain under `browser-accepted/`; final29 is `browser-final-clean/`, not an amended old receipt. The corrected independent C22 lineage receipt passes 50/50 applicable checks; its initial verifier's extra timestamp-equality assumption failed on both old/new fixtures and is not a product regression.

Inspected screenshots include desktop grouped/map-list behavior, 390-pixel phone detail, 844-pixel landscape, Tamil at 200% text, both owner flows and supplemental keyboard-focused contacts. Synthetic blue map tiles are intentional. Small-height and enlarged-text panes scroll internally; screenshots alone are not contact reachability evidence. Physical devices and real operational/production acceptance remain unpassed.


## Scoped review fixes: first-use interaction and missing acceptance

The initial 29-case receipt is retained, but its desktop test clicked through the guard. Review identified a real first-use defect and two acceptance gaps. The regional map now observes the primary coarse-pointer media query: fine pointers are interactive on initial mount, while coarse pointers retain Tap to interact, committed focus, Done and Escape. A capability change resets only the coarse interaction permission without unsolicited focus. Browserless rendering with no media API has no coarse guard; the static test explicitly checks that fallback and both pointer modes. Hybrid hardware and physical devices remain separate UAT.

Real mouse testing exposed another defect: the shared renderer activates on mouse-down, and regional selection immediately moves the camera. Mouse-up then lands on blank map and dismisses the selection. The regional wrapper captures only left-mousedown within its marker subtree, stopping propagation without preventing default. The existing completed click now performs activation. Keyboard and grouped callback metadata remain unchanged; no shared renderer change, delay, polling or duplicate-activation bypass was introduced. The unrelated existing 300ms mousedown/click deduplication also affected an early rapid test sequence; initial keyboard and mouse cases are now independent and that diagnostic remains distinct.

Compact acceptance uses unchanged controllers and rendering. The original one-place/two-resource default category-bubble fixture checks filtered mapped results, restoration, resource preview, real drag and reset to the initial camera with cleared selection. A separate compact-only disposable database adds a second selected public place at fictional postal 000001, saves the supported category-icon Studio presentation and publishes it through the genuine controller. Assertions verify the two selected places, shared postal/coordinates and private-place exclusion before the actual native internal chooser, member selection, drag and reset checks. This is a saved presentation branch, not the default compact view; frozen regional and projection artifacts are unchanged.

Studio load-error acceptance is accurately named. Two additional cases edit the actual mounted Studio view name, hold its real PUT, request explicit regional publication, and assert no share request while pending. A 503 response prevents publication; a genuine successful Studio revision 2 response completes before the share request for saved regional revision 1. The fixture records request/response completion order and reads the actual stored Studio revision immediately before the genuine publisher. Annotation ordering remains separately covered; no publisher source changed.

The new QA files use readable statements and focused search/reset helpers. Regional guest contexts have a seeded fictional ambient cookie: both catalogue GET and evaluation POST assert absent Cookie and Authorization, recording presence booleans only. An explicit negative case sends an allowed pathname to a fictional unexpected origin and verifies it is aborted before an allowed response or network access. That deliberate blocked request is separately labelled and exactly matched; ordinary cases still reject every unexpected request. Normal owner/compact page navigation remains outside the widget-specific privacy claim.

### Final fix-round local receipt

Evidence root: `/Users/sweetbuns/.codex/visualizations/2026/11/06/01a1aefd-c0a9-7b41-b4da-c8ee48d19dd4/regional-discovery-20261107/fix1`. `verification-receipt.json` SHA256 `ed71d70f8c3468963b766878a25fa60c5f71aae50b47745c961f15d8524d28ca` binds the final reports, scripts, logs and both configured-build inventories. `final-source-freeze.json` binds 687 runtime/browser/test/package inputs; all remain unchanged after validation. Each browser report separately binds its before/after source. This supersedes the historical 29-case receipt for current acceptance; it does not alter that receipt.

| Gate | Current result | Receipt |
| --- | --- | --- |
| Canonical actual-App browser | 35/35, exit0 | `browser-final/report.json` SHA256 `0ce4539f7ecfae2ca4673f177dcea4fdc976951bfd60804606dcc2a43616a30a` |
| Existing selected-venue projections | 4/4, exit0 | `projections/report.json` SHA256 `3fa5ad0778e67488010cd841d300426b92baff31a45e3b970d0f02d711051fe1` |
| Supplemental actual-App host scroll / 200% contact Tab reachability | 2/2, exit0; separate from35 | `supplemental/report.json` SHA256 `2617a34ab9137334ab8bd72fed58666ef742c31dbd2088187f382079842c26c5` |
| Presentation boundary test | 13/13 after focused12/13 RED | `logs/regional-task10-fix1-presentation-green.log` |
| Final quality | Exit0: compiler17, migrations12, module graph720/2172/no cycles, CMS73, server1365, address51, client1242 pass/1 optional skip, environment5, compiler17, build6.08s | `logs/regional-task10-fix1-quality.log` |
| Final map-lockdown | Exit0:116 tests, compiler17, build5.07s | `logs/regional-task10-fix1-map-lockdown.log` |

Both fresh builds retain all113 artifact bytes under `quality-dist/` and `map-lockdown-dist/`, with separate SHA inventories. Build stages did not overlap. These are local evidence copies, not deployment inputs; the protected release pipeline must rebuild privately. The optional compiled-matcher skip and original tooling notices remain disclosed.

New/renamed cases are `fine_pointer_initial_keyboard_without_activation`, `coarse_marker_tap_activates_after_guard`, `fixture_rejects_unexpected_api_origin`, `compact_default_multiresource_preview_baseline`, `compact_saved_category_icon_internal_chooser_reset`, `owner_studio_load_failure_blocks_publication`, `owner_studio_pending_write_failure_blocks_publication`, and `owner_studio_pending_write_success_precedes_publication`. The existing marker case now starts untouched, records native down/up/click at the same coordinate/outer target, and checks wheel host scrolling, immediate leave, actual click lock, blank-map dismissal, keyboard and pan retention.

Focused9/9 preceded the final35. Retained RED includes the initial blocked desktop guard, historical compact/Studio evidence-gap checks, real camera-before-mouseup dismissal, a separate rapid300ms dedup test-order effect, the compact one-group/default-member assumptions, the corrected Studio response-observer shape, and the stale unconditional SSR guard assertion. None is silently counted as passing. Final emulated touch remains locked after camera zoom15 and settling; successful Studio response completion order28 precedes share request29, with actual stored Studio revision2 and explicit regional revision1. Screenshots inspected include the touch chooser, successful Studio publication, compact reset view, and supplemental contact/host-scroll evidence. Physical-device, real authority/schema and production gates remain unpassed.


## 7 November 2026 — Regional Discovery integration onto current main — LOCAL, REVIEW PENDING

The accepted regional candidate is now integrated in `/private/tmp/carearound-regional-integration-20261107`, branch `codex/mini-curated-discovery-integration-20261107`, on `71a9a064f19198e5d6a9030146c5a7d650718c06`. This is uncommitted source; the base identifies upstream ancestry. The original07d feature checkout and its accepted Tasks1–10 evidence remain preserved. The older regional entry below describes that historical candidate, including its then-pending review statements.

Exactly100 feature paths were carried forward. The four overlaps preserve upstream owner secondary-button handling, passive layer inspection, sea fill, owner exploration no-op behavior and all upstream documentation. Regional external selection/camera and C21/C23/C24 wrapper behavior remain scoped; all26 disjoint upstream paths remain exact. No additional product behavior or operational activation was added.

Fresh local checks: actual-App regional35/35, genuine selected-venue projections4/4, supplemental2/2, focused42/42, floating-menu11/11 and ordered owner workspace36/36. Inspector7/8 cases pass across the full run and three targeted continuations. Its narrow390×500 case remains **open**: the map loads at zoom14 while the upstream harness expects≥15.5; the unchanged case fails identically on a separate exact71a9 baseline. No source fix, assertion weakening or release waiver is claimed.

`verify:quality` passes server1365/client1261 with1 known optional compiled-Pages-matcher skip/address51/CMS73/environment5/compiler17 and configured build5.41s. `verify:map-lockdown` passes116/compiler17 and its distinct build5.47s. Both113-file build trees are preserved separately. All1,164 frozen inputs retain exact bytes; quality additionally creates one ignored compiler output, `server/src/generated/helpCmsSeed.js`, recorded separately after the broad file-set equality check correctly detected growth. Earlier loopback-EPERM attempt, upstream failure and inventory-growth assertion remain retained. No fixture/producer manifest regeneration.

Local evidence receipt: `/Users/sweetbuns/.codex/worktrees/carearound-regional-discovery-plan/CareAroundSG/.superpowers/sdd/2026-11-06-mini-curated-discovery-implementation-plan/integration-71a9/verification-receipt.json`, SHA256 `681745a35843a760095d0a67f2de70846e8dc8deae0d91f7941f435eeb669307`. This is controlled local proof, not physical-device or production acceptance. Final whole-branch review must assess the open upstream QA item before source/CI/release decisions. No stage, commit, push, schema apply, private-content write, source pin or deployment occurred; steward/contact activation and protected paired-release gates remain separate.
