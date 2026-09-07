# CareAround Guide, inbox, and notification sequence

Status: active implementation goal; not released.
Current checkpoint: all three feature phases and the shared privacy/map-behavior
checks have local proof. The [release review candidate](guide-inbox-notifications-release-candidate.md)
records the source fingerprint, four proposed migrations, shared-map UI observations
and the completed local-commit/read-only-preflight checkpoint. Cloudflare checks
are recorded. The [Neon preflight](neon-read-only-preflight-20260907.md) resolved
console access and verified backups, but found baseline drift and no migration
journal. The [local adoption rehearsal](guide-inbox-migration-adoption-plan-20260907.md)
now has production-version Neon proof: exact four migrations, unchanged existing
schema, all 47 invalid-state checks and synthetic map/Calendar retention pass.
All synthetic records were rolled back. Full server checks pass 720/720;
36 actual-controller checks also pass against the captured production shape.
The user authorized continuing the scoped goal through necessary release gates.
The operational ledger still requires adoption review, and runtime database
identity and deployed verification are not yet certified. Fresh schema/core-count
snapshot recovery now passes. No production app/schema change occurred. Dated progress
entries below are historical; the latest checkpoint supersedes their pending notes.
Baseline: `13f50a6c9` on `origin/main`, verified 2026-09-07.
Branch: `codex/guide-inbox-notifications-20260907`.

## Goal and acceptance contract

Deliver the sequence agreed in the product discussion:

1. CareAround Guide, real resource search, a persistent private inbox, human
   support replies, and verified fix updates with human approval.
2. Calendar and saved-resource change notifications in that inbox.
3. Optional saved-search alerts, with preferences, grouping, and unfollow.

The goal is not complete when only a plan, UI mock, or one phase exists. Every
phase needs working server and client behavior, meaningful automated checks,
and browser verification. Production migration/deployment is a separate release
decision requiring the exact candidate and migration to be ready for review.

## Architecture decisions

- Integrate into the current React/Cloudflare Worker/Neon application. Reuse
  current resource visibility, saved-resource, Calendar, and navigation rules.
- Restore the useful patterns from the July CareAround Guide selectively;
  do not merge its old branch wholesale. Knowledge must match today's routes,
  controls, permissions, bulk-unsave rules, and Care Calendar behavior.
- Guide answers use verified knowledge and real resource results. Approved
  actions are explicit buttons, validated again by the app/server. No model may
  invent resource facts, determine permissions, or announce a fix from prose.
- Guide may explain, find, open, and draft a report. Changing a map, saved item,
  or plan continues through its existing user-confirmed workflow.
- Persistent conversations/messages are separate from product notifications.
  Both appear through one inbox entrypoint. Message authors are clearly marked
  as user, CareAround Guide, support team, or system update.
- The user owns their conversation. Super Admin is the initial support reviewer;
  ordinary regional/organisation access does not silently grant transcript
  access. Impersonation does not grant support-review authority.
- Guests retain help and resource search. Guest reports for sign-in problems
  need a narrowly scoped random recovery credential, stored hashed server-side,
  never placed in a URL or reused as an account session.
- Reports contain user-reviewed text and selected diagnostic context. Strip
  query parameters, share tokens, credential-like values, and private payloads.
  No automatic screenshot capture or unrestricted diagnostic upload.
- A proposed fix records its exact source revision and verification evidence.
  Human approval binds to that revision. Later edits invalidate approval.
  A release verifier checks the approved revision against production evidence
  before creating the fix-available update. Merge/approval alone is insufficient.
- The initial repair process is developer-managed. An autonomous coding runner,
  external messaging, push notifications, medical recommendations, and bookings
  are not part of the accepted notification sequence.

## Phase 1: Guide, search, and support

- [x] Versioned knowledge catalog and permission-aware navigation actions.
- [x] Resource search returns actual visible Places/Offerings and working detail
      and Discover links; unknown/no-result states are explicit.
- [x] Persistent account support conversations and messages; reload/cross-session
      continuity, pagination, read state, and private access checks.
- [x] Optional private Guide question history across navigation and reload,
      with explicit review/save, update and deletion. Help answers are refreshed
      from current guidance; historical resource results are not retained.
- [x] Guest report submission and secure recovery for sign-in failures.
- [x] Report draft/review/submit, acknowledgement, staff queue and reply.
- [x] Proposed fix, human approval, production verification, user update,
      user-confirmed resolution, and reopen with history.
- [x] Desktop/mobile Guide and inbox; an unobtrusive unread indicator;
      accessible labels, focus management, and safe account transitions.
- [x] Database migration, upgrade and clean-install tests on disposable data;
      no production database is used for development.
- [x] End-to-end proof: submit report, leave, staff reply, approve exact fix,
      reject mismatched deployment, verify matching release, return and reopen.

## Phase 2: Calendar and saved-resource changes

- [x] Explicit category preferences for schedule and saved-resource changes.
- [x] Use authoritative schedule revisions; preserve existing personal plans
      and review acknowledgements. One source change produces one update.
- [x] Detect supported public-field changes to saved resources against a
      recorded baseline. Initial subscription creates no historical flood.
- [x] Recheck visibility when generating and reading notifications; withdrawn
      access never leaves private details or usable stale actions exposed.
- [x] Group repeated changes; support read/unread, dismissal and mute.
- [x] Reliable server processing with persisted progress, retry safety, and
      duplicate prevention. Closing the browser does not lose updates.
- [x] Browser and server proof for changes, cancellation, unavailable source,
      repeated processing, permissions changing, and user opt-out.

## Phase 3: Optional saved-search alerts

- [x] User reviews and explicitly saves search criteria and alert preference.
- [x] Search runs through the same visibility/filtering rules as Guide search.
- [x] Baseline existing matches; notify on genuinely new matches afterward.
- [x] Group matches into a digest with a current-results link; prevent repeats.
- [x] Edit, pause, resume, delete/unfollow; enforce per-user limits.
- [x] Verify consent, no-match, new-match, duplicate, unavailable-result, retry,
      pause/resume and cross-account cases.

## Shared implementation and release gates

Additive tables and ordered migrations; no runtime DDL on API traffic. Use
server-side authorization, bounded inputs/lists, plain-text rendering, no-store
responses, per-user write limits, and safe error messages. Separate support
state from notification read state and from existing Calendar acknowledgements.
Keep delivery preferences authoritative and distinguish in-app availability
from device push while the app is closed.

Run focused behavior/integration tests, full server/client suites, module graph,
migration ownership validation, production-configured client build, map-lockdown,
and browser flows. Verify guest and signed-in Discover, My Directory bulk
unsave, Detailed map tiers, Calendar, and shared/embed isolation. Record evidence
and outstanding work here and in the regression ledger before release review.

## Progress log

- 2026-09-07: shared runtime checkpoint completed on disposable data. Map-use
  filters, protected bulk removal, Calendar warning and personal-plan retention,
  Discover native/overview/live tier round trips, Gray, frozen shared membership,
  private content exclusion and credential-free mobile embed were verified.
  Actual Pages-handler framing was browser-tested with a separate labelled probe:
  approved parent loaded, unapproved parent was blocked, and disablement failed
  closed without removing the ordinary shared map. Source-unchanged shared-card
  nested-link diagnostics and 16 px overflow at 320 px are recorded, not fixed or
  hidden. Current server 702/702, client 765/765, static checks, exact feature-enabled
  client and map-lockdown/configured builds pass. See the release review candidate
  for evidence scope and remaining approval gates. No production state changed.

- 2026-09-07: active goal confirmed; current production source and dirty primary
  checkout verified. Created an isolated feature worktree from current main and
  recorded the full acceptance contract before application edits.
- 2026-09-07: first local support milestone implemented. Additive migration
  `0003_support_inbox` adds private reports, ordered messages, and immutable fix
  proposals. Reports use optimistic revisions and atomic status/message writes;
  retries cannot duplicate acknowledgements, replies, approval, or fix notices.
  Super Admin review is server-scoped and unavailable through impersonation.
- Guest recovery is a 256-bit random bearer credential hashed at rest, scoped
  to one report, and expiring after 30 days. The UI requires the guest to confirm
  they saved it before sending; remembering it in the current tab is optional.
  Recovery uses a header, never a URL or an account session. A signed-in user
  must explicitly recover a guest report; it is not silently attached to them.
- Added a versioned deterministic Guide and public resource search. Search
  delegates to the existing guest-visible Place/Offering list controllers and
  returns an allowlist of display fields and detail routes; no caller role,
  managed scope, private profile, or membership is forwarded. The Guide can
  recognise explicit keyword requests such as `Find Havelock`. Unknown help
  topics and unavailable searches do not fabricate answers or results.
- Added the Help/inbox navigation entry, responsive help hub, report preview,
  account/guest inbox, unread count, staff replies, and human review controls.
  Recognisable credentials, links, identity numbers, and phone numbers are
  removed server-side; preview shows the text that will actually be submitted.
  Guide answers and report messages are plain text. These are not translations
  or a clinical assistant; the new help area is currently English.
- Fix notification now requires both human approval of the exact revision and
  a later explicit human production-test statement, paired with an independent
  server-observed matching release. Approval alone cannot send a fix update.
  The release-observation adapter now checks generated client entry-file integrity
  and the API Worker's compiled revision plus platform version. This has local
  automated/build proof, not a production deployment or proof that any production
  bug was fixed. Human production testing remains mandatory.
- 2026-09-07: added optional owner-only Guide history in ordered migration
  `0004_guide_history`. The user explicitly reviews and saves a bounded snapshot
  of questions/topic references; new questions are not automatically persisted.
  Unique bounded slots enforce 20 saved conversations per account, each with
  at most 20 questions. Saves are revision-checked and retry-idempotent; deletion
  requires confirmation and rejects a stale revision. Other users, support
  reviewers, guest credentials and impersonation cannot grant history access.
  No old resource payloads, arbitrary generated answers or action URLs are
  persisted. Reopening uses current verified help and asks the user to rerun
  directory searches for current visible resources.
- Added an explicit question-to-report handoff. Only the selected question is
  copied into an editable draft held in page state, not URL parameters or a
  support record. The existing server-sanitised preview and explicit Send action
  remain mandatory. Other Guide questions and search result payloads are not
  attached. Private-detail questions flagged by the Guide cannot be saved or
  handed off by this action.

## Local verification checkpoint — 2026-09-07

- `npm run test:server`: **636/636 passed**. Run the workspace script: one existing
  source test assumes its working directory is `server`, so invoking every
  server test directly from the repository root gives an unrelated path error.
- `npm run test:client`: **757/757 passed**. Focused new server/client support and
  Guide checks: **27/27 passed**. PostgreSQL behaviour is tested in a disposable
  PGlite database, including all eight support CHECK constraints, upgrade data
  preservation, cross-account access, guest expiry, pagination ties, optimistic
  write conflicts, retry deduplication, and replaced approval rejection.
- `npm run check:static`: migration ownership, module graph, and diff checks
  passed. Five ordered migrations, 451 source modules and 1,332 relative edges;
  no source import cycles. History adds three enforced CHECK constraints.
- `VITE_SUPPORT_INBOX_ENABLED=true npm run build:client`: passed with the current
  Discover derivative production configuration. `npm run verify:map-lockdown`:
  **103/103 passed**, including its configured build. The existing Browserslist
  age advisory remains; dependencies were not upgraded to silence it.
- Headed browser checks on synthetic accounts and resources: Guide topic,
  directory-search results, and two real fixture result links from the chat
  request `Find Havelock`; 320 px navigation without horizontal overflow;
  sanitised report preview; submit/acknowledge; reload; staff reply; exact-version
  human approval; reject mismatched fixture release without notification;
  matching fixture release sends exactly one update; reporter return/reopen
  preserves all messages; guest submit and opt-in tab recovery; explicit guest
  recovery while signed in; another account has an empty inbox and no reviewer
  controls; and impersonation is blocked without exposing report titles. The
  support UI considers both the local User View flag and the hydrated server
  claim, so an inconsistent client flag cannot retain private report state.
  These used the real support routes and database statements, with
  injected fixture authentication, catalog controllers, and release observation.
- Additional history browser proof: consent is required; save/reload/reopen;
  append a help question and explicitly update the same saved conversation;
  reload restores both questions without stale search-result links; another
  account and Super Admin have no access to the owner's history; impersonation
  hides private-history controls; a selected question opens an editable report
  draft and remains unsubmitted through preview; 320 px history has no horizontal
  overflow; confirmed deletion remains absent after reload. Only a synthetic
  test history record was removed; no real user data was used. The current fixture browser console contains only React development
  information, not app warnings/errors. Screenshot:
  `output/playwright/support-guide-history-mobile.png`.
- Local browser harness: `server/test/fixtures/supportBrowserServer.mjs`, gated
  by `CAREAROUND_SUPPORT_FIXTURE=true`, binds only `127.0.0.1:8791`; Vite uses
  `127.0.0.1:5179`. This is not an authenticated production-data UAT environment
  and must not be used to claim Discover/My Map/Calendar runtime UAT coverage.
- Current implementation is **local only and incomplete**. Both
  `SUPPORT_INBOX_ENABLED` (server) and `VITE_SUPPORT_INBOX_ENABLED` (client) remain
  off unless explicitly enabled. No production migration, commit, push, or deployment has
  been performed for this goal. Existing primary-checkout edits are untouched.

## Next implementation steps

1. Complete cross-surface Discover/My Directory/Detailed-map/shared/embed browser
   checks. Phase 1 lifecycle/accessibility, Phase 2 provider-publication/Calendar
   handoff and Phase 3 saved-search journeys now have local proof. The Worker
   dry run has been refreshed after the schedule-history correction.
2. Prepare a concrete migration/client/Worker release candidate for the separately
   authorised production gate.
   Live release verification belongs to that gate; do not block further local
   work or claim a production fix from synthetic release fixtures.

## Release provenance and actual resource integration — 2026-09-07

- Added generated client `release.json` with the clean Git revision, shell hash,
  and byte counts/SHA-256 hashes for the actual entry JavaScript/CSS/recovery files.
  Dirty or unidentified local source is explicitly unverified; Pages builds reject
  a mismatched provider commit. Evidence is written only after successful bundle
  output, not during failed-build cleanup. Existing production build aliases and
  Detailed-map environment roots are unchanged.
- Added `/api/release` and the `CF_VERSION_METADATA` binding declaration. The API
  exposes a verified identity only when the compiled source revision matches the
  platform version tag and valid version metadata. The guarded Worker release
  command retains the existing clean-main/origin-main gate, rejects untracked
  source changes and command overrides, and supplies that revision and tag.
  No Worker was deployed or production binding changed.
- Support verification checks the live client's shell/entry bytes at the fixed
  app origin. For API fixes it observes the currently executing production-origin
  Worker directly, avoiding a public HTTP call back into itself. Missing metadata,
  a preview origin, invalid paths, redirects, fallback HTML, altered bytes or
  oversized bodies fail closed. This proves entry integrity/version provenance,
  not every lazy-loaded chunk, every user journey, or a full rollout percentage.
  Exact-version human approval and explicit production-test evidence remain required.
- New real PostgreSQL integration proof: failed entry verification does not change
  the report revision or create a fix message; valid client/Worker evidence is
  stored with the human test statement and a retried request creates one update.
  Focused release/support/release-line checks: **42/42 passed**.
- Added a test-only Neon HTTP transport backed by disposable PGlite. It runs the
  existing controllers, Drizzle SQL and driver parsers, requires an exact fake
  database address, performs no network I/O, and restores the driver configuration
  after testing. No database injection option was added to application code.
  Actual-controller Guide integration: **5/5 passed**, covering public search,
  pagination, directory parity, detail links, restricted/hidden/deleted resources,
  unavailable hosts, staff privilege isolation and changed visibility. Search and
  detail generated SELECTs only; no runtime schema bootstrap or data writes.
- Browser fixture now uses those actual resource controllers and SQL rather than
  resource-handler mocks. At 320 px, guest chat search opens both real Place and
  Offering detail pages; the Offering page has no horizontal overflow. At 1280 px,
  staff search still excludes hidden/restricted fixture rows. Continue in Discover
  preserves `q=Havelock`, pre-fills the search box and shows the two visible resources.
  Help/resource flows had no console errors or warnings. Discover's fixture cache
  and location-indicator endpoints are intentionally unimplemented and returned
  404; this is navigation/search proof, not Detailed-map/location-indicator UAT.
  Inspected screenshots: `output/playwright/support-real-resource-search-desktop.png`
  and `output/playwright/support-real-resource-detail-mobile.png`.
- Current validation: server **669/669**, client **757/757**, static migration/module/
  diff gates, feature-enabled production-configured client build, map-lockdown with
  its configured build, Worker dry run, and generated Worker binding types pass.
  The feature-enabled local manifest correctly recorded `sourceClean: false`,
  `sourceRevision: null`; all three entry files and the shell matched their hashes.
  The dry-run bundle contains the synthetic compiled revision and correctly declares
  the platform metadata binding. These artifacts are local test evidence only.
- At that checkpoint, Phases 2 and 3 were still unimplemented. No commit,
  push, production migration, Pages deployment or Worker deployment occurred.

## Durable resource notifications — local checkpoint 2026-09-07

- Phase 2 core now works locally. Added ordered migration `0005_notification_updates`:
  durable per-owner scan jobs, saved-item watches and grouped private notifications.
  Existing general Profile preferences remain authoritative; `calendar` and
  `resources` categories default off and never enable an external channel.
- The scheduled Worker handler performs at most two 25-item batches per tick.
  Leases, cursor progress, baselines and notices commit atomically. Expired
  workers are fenced out, failed batches retry from committed progress, consent
  changes invalidate in-flight batches, and repeat processing creates no duplicates.
  The declared minute trigger has not been deployed. The rollout flag remains off
  by default; the disabled handler does not connect to a database.
- Strict batched source lookup reuses existing saved-resource visibility rules
  without snapshot fallback. Lookup errors are retried, not treated as removals.
  Only field hashes and typed schedule state are retained. Reads reload current
  visible summaries; unavailable sources have a generic title and no resource
  details or links. Unsave cascades the new watch/notice only; re-save and newly
  enabled categories begin with a current baseline. Calendar plans and existing
  review acknowledgements are not changed by read, dismiss, mute, or processing.
- The existing inbox now separates Messages and Updates. It includes explicit
  category choices, paginated groups, read/unread, dismiss, mute/unmute, and a
  combined unread indicator. A schedule notice offers current programme details
  and a separate Calendar navigation link; it does not acknowledge or move a plan.
  Private UI remains keyed to account/role/impersonation changes. Failed reads do
  not render stale notification cards alongside the error.
- Current verification: **683/683 server**, **760/760 client**, six ordered
  migrations, 463 source modules / 1,362 edges with no cycles, and diff checks pass.
  Feature-enabled production-configured client build and map-lockdown with its
  configured build pass. Worker dry run and generated types pass; local Workers
  runtime returned `outcome: ok` for the disabled scheduled handler and HTTP 200
  for health. Enabled processing uses the actual Neon driver, SQL, live identity
  hydration and source resolvers against disposable PostgreSQL, not production.
- Tests cover grouping, repeat scans, stale read revisions, cross-owner writes,
  privacy withdrawal, failed lookups, opt-out during a scan, master opt-out,
  idempotent consent, lease replacement, mute/resume, unsave/re-save, atomic failure,
  62 saved resources processed across persisted batches, and tied-time pagination.
  A populated upgrade test preserves all pre-existing rows and proves all seven
  new CHECK constraints; unsave leaves seeded plans/acknowledgements unchanged.
- Browser proof: choose both categories; leave the app; establish baseline and
  produce controlled source changes; return to two persisted updates and a badge;
  mark read; mute/unmute; hide a source and lose its identifying details/links;
  opt out of schedule changes (the next controlled change creates no new notice);
  and switch accounts without retaining another owner's updates. The current
  programme link opens its actual detail controller. At 320 px, content width is
  320 px with no overflow. Inspected screenshots are
  `output/playwright/notifications-desktop.png` and
  `output/playwright/notifications-private-mobile.png`. Final browser check had
  zero console errors/warnings. A mounted-list trailing-slash mismatch found by
  browser testing was fixed and regression-tested.
- Remaining evidence: the full provider schedule-editor -> canonical published
  schedule -> Calendar review journey is not yet browser-tested in this harness.
  Its source changes are controlled SQL, and its legacy favorites response remains
  a fixture stub. Do not present these tests as production or full Calendar UAT.
  At this earlier checkpoint, saved-search subscriptions were unimplemented. The full goal stays
  active; no commit, push, production migration, or deployment has occurred.

## Saved-search alerts — local checkpoint 2026-09-07

- Phase 3 is implemented locally. From Guide search or the Updates inbox, users
  review public keywords, resource type and an explicit alert choice before saving.
  New alert choices default off. Up to ten searches per account are enforced by
  database slots and unique criteria. Guest credentials, other accounts, support
  reviewer roles and impersonation cannot grant access to private search criteria.
- Added ordered migration `0006_saved_search_alerts`: private searches, match-key
  records and one grouped digest per search. All nine declared checks are enforced
  in SQL. Populated upgrade testing preserves existing notifications, saved items,
  plans and review acknowledgements. Deleting a search cascades only its own match
  keys/digest; it never unsaves resources or changes Calendar/My Map data.
- Background processing reuses the actual Guide public controllers and their
  visibility/filtering. A server-only keyset context traverses stable resource IDs
  rather than page offsets that can shift under edits/deletion. Ordinary Guide and
  public resource ordering remain unchanged; callers cannot turn on scan context
  through query parameters or headers. Each scheduled invocation scans at most two
  pages of up to 50 matches per resource type, with committed cursors and leases.
  Completed searches become due after 15 minutes; this is a scheduling interval,
  not a guaranteed delivery deadline under backlog. Production capacity remains
  part of the release review, not established by the small local fixture.
- First scans baseline existing matches. Later unseen match keys create/update one
  digest; repeat scans, returning matches and retries do not duplicate it. Edits,
  pause/resume and changed Profile master consent invalidate old work and establish
  a new baseline without catch-up alerts. Consent/version checks and epoch-scoped
  keys/digests prevent stale scan results from resurfacing. Each new digest lifetime
  has a distinct notice ID so an old screen cannot read/dismiss a replacement even
  when its revision starts again at one.
- Digests retain no resource names, addresses or historical result links. They say
  a search found matches, not that those matches remain available. The current-results
  link reruns public search with private stored criteria; its URL contains only an
  owner-authorized search reference, not the query. Repeated clicks refresh an
  already-open result panel. Withdrawn resources are absent from fresh results and
  the empty state explicitly explains that availability can change.
- Verification: **695/695 server**, **761/761 client**, seven ordered migrations,
  **470 source modules / 1,392 edges** without cycles, diff checks, feature-enabled
  exact production-configured client build and Worker dry run pass. Worker bundle:
  3,311.67 KiB / 665.54 KiB gzip. Map-lockdown with its configured build passed
  before the final isolated digest-identity/read-action patch; no map code changed.
  Focused saved-search/database upgrade checks: **12/12**. Tests include 63 initial
  matches across durable pages, mid-scan reorder/deletion, no-match searches,
  unavailable results, grouping, retry/atomic failure, consent races, expired lease
  replacement, per-account limits, stale notices and unchanged existing data.
- Browser proof on synthetic accounts/resources: reviewed save from Guide, alerts
  off until chosen, leave app, baseline without alert, add match, return to persistent
  unread digest and combined badge, open actual resource detail, withdrawn-result
  empty state, repeat current-results refresh, read, pause, new match during pause,
  resume without catch-up, edit/reload, cross-account empty list, confirmed deletion
  and reload. After the final notice-ID patch, the fixture was intentionally
  restarted and save/baseline/new-match/current-results/read/badge were rerun.
  At 320 px content width is 320 px. The final browser console after the restart
  and read flow has zero warnings/errors. Inspected images:
  `output/playwright/saved-search-alert-desktop.png` and
  `output/playwright/saved-search-unavailable-mobile.png`.
- The full goal is still incomplete: Phase 1 remaining lifecycle/accessibility,
  Phase 2 provider-publication/Calendar review and shared cross-surface gates remain.
  There was no production database access, commit, push, migration or deployment.
  Both rollout flags remain off by default. Do not treat this local checkpoint as
  evidence that a production fix was deployed or verified.

## Provider publication to inbox and Calendar — local checkpoint 2026-09-07

- The Phase 2 end-to-end gate now passes locally. The browser harness mounts the
  actual favorites, Offering update and Calendar controllers, backed by disposable
  PostgreSQL. Initial sessions are published through the real guarded save path,
  not written as calendar columns. The Neon fixture now supports atomic HTTP
  batches through PostgreSQL transactions, with an explicit late-failure rollback
  test. Authentication identities and optional editor picker collections remain
  synthetic; this is not production, full resource-management, or map UAT.
- This stronger test exposed a pre-existing publication defect: the second manual
  schedule save inserted both the old and new history revisions without handling
  the already-recorded old revision. The unique history constraint rolled back
  the save. The narrow correction in `updateSoftAsset` ignores only an existing
  `(soft_asset_id, revision)` history key, matching the existing import/create
  behaviour without overwriting history. Schedule revision compare-and-swap and
  atomic resource/history writes remain in place. Concurrent editor tests prove
  one save succeeds, the other returns 409, and the winning revision and history
  agree; the first publication record remains byte-for-byte unchanged.
- Seven focused checks use actual controllers/SQL to publish, plan, subscribe,
  change timing, notify once, read/unread/dismiss, explicitly acknowledge, cancel,
  hide, opt out and unpublish. Notifications never modify the existing plan or
  review acknowledgement. Cancelled sessions reject new plans. Stale editors and
  non-editor users cannot change the schedule; another account has no notice.
- Browser proof: add a session through Calendar and enable schedule notifications;
  edit its time in the normal Offering wizard and save; process a baseline/change
  and repeated tick; return to one unread inbox update; mark read; follow Open
  calendar and find the old time still awaiting review. At 390 px, Updates shows
  the old choice beside the new unstarred session. Explicit acknowledgement clears
  the Calendar notice only. Changing Status to Cancelled in the Offering wizard
  produces a new inbox update and no active replacement to star. A visibility
  change through the guarded Offering API removes notification details/actions;
  turning off the category through the UI removes its notices. Another synthetic
  account has an empty inbox. Guest Calendar/favorites return 401; Guide remains 200.
- Current verification: **702/702 server**, **761/761 client**, seven-migration
  validation, 470-module/1,392-edge checks, diff checks, feature-enabled exact
  client build, and map-lockdown with its configured build pass. The final browser
  console has zero errors/warnings. Earlier missing fixture picker routes were
  corrected; no application validation was bypassed. Inspected screenshots:
  `output/playwright/provider-schedule-notification-desktop.png` and
  `output/playwright/calendar-review-after-inbox-read-mobile.png`; mobile document
  and viewport are both 390 px wide. The last Worker dry-run evidence precedes
  this narrow controller correction and must be refreshed at the release gate.
- The goal remains active for Phase 1 guest/lifecycle/accessibility and shared
  Discover/My Directory/Detailed-map/shared/embed checks. No commit, push, external
  delivery, production database access, migration or deployment occurred.

## Support lifecycle and keyboard navigation — local checkpoint 2026-09-07

- Phase 1's remaining local acceptance checks now pass. This supersedes the
  earlier Phase 1 pending notes above, not the shared regression or production
  release gates. Release verification was simulated against a controlled adapter;
  it does not prove that a production bug was fixed or that this feature is live.
- Browser reproduction found focus returning to the page body after report
  preview, staff fix decisions, guest recovery transitions, Guide answers and
  resource search. Narrow support-only changes add focusable response/error
  headings, restore the title input on Edit, restore the selected report on Back,
  and focus a conversation after opening or changing its status. Refresh/reply
  reads do not repeatedly refocus the conversation. Guide response focus respects
  a user who has moved to another control while waiting. Aborted proposal reads
  can no longer replace the current review panel with a late response.
- Current synthetic browser journey: submit a member report; leave; reply as
  support; propose and replace a fix; approve the exact revision; reject two
  mismatched release observations with no fix event; accept matching evidence;
  return as reporter to exactly one fix-available message; reopen, resolve and
  reopen again, retaining all ten conversation events. Keyboard focus after
  preview/edit/submit, refresh/back, proposal/approval/error/success, resolve and
  reopen was checked directly. The expected mismatch responses are 409 errors;
  they are not unhandled application exceptions.
- Guest proof covers saved-code confirmation, opt-in tab recovery after reload,
  close/forget, manual recovery without storage, and explicit recovery/reply while
  signed in without attaching the guest report to that account. A second report
  submitted with tab storage off stores no recovery code; after reload its content
  is absent until the code is manually supplied. Recovery codes stay out of URLs.
  Other-account and User View checks expose neither report titles nor reviewer
  controls. PostgreSQL tests additionally prove hashed credentials, wrong-code
  rejection, one-report scope and expiry.
- At 320 px, Guide answers and real search results focus their visible headings;
  Tab/Enter opens the actual Place detail route. The focused answer is below the
  navigation bar. Conversation, Guide/search and detail content fit the viewport.
  Inspected screenshot: `output/playwright/support-lifecycle-reopened-mobile.png`.
  Final browser console has zero errors/warnings. All data and actors are synthetic.
- Final checks: **702/702 server**, **765/765 client**, eight focused support
  client checks (including four focus guards), seven-migration validation,
  **471 modules / 1,393 relative edges**, and diff checking pass. The focus wiring
  source guards supplement, rather than replace, the actual browser checks.
  `VITE_SUPPORT_INBOX_ENABLED=true npm run build:client` and the subsequently
  refreshed feature-enabled map-lockdown/configured build pass. Wrangler 4.129.0
  dry run passes after the schedule-history correction: **3311.79 KiB**, gzip
  **665.57 KiB**. It exited without deploying. The known Browserslist age advisory
  remains; no dependency upgrade was made for it.
- The full goal remains active for shared Discover/My Directory/bulk-unsave,
  Detailed-map and shared/embed runtime checks, then exact release-candidate
  preparation. No commit, push, production migration or deployment occurred.
