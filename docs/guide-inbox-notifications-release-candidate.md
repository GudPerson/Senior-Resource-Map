# Guide, inbox and notifications — local release review

Date: 2026-09-07 (Asia/Singapore).
Status: implemented and locally verified; user approved a scoped local commit
and read-only production preflight. Push, migrations and deployment are not
approved. This document is a review candidate, not a release certificate.

## Candidate identity

- Branch: `codex/guide-inbox-notifications-20260907`.
- Worktree: `/Users/sweetbuns/CareAroundSG-worktrees/guide-inbox-notifications-20260907`.
- Base: `13f50a6c9e359e859923c1a0cbbaf20fa2615cc3`; remote `main` was rechecked
  at this exact revision during this checkpoint.
- The primary documentation checkout remains dirty and separate. Do not stage,
  build or deploy it for this feature.
- Review fingerprint for the 80 changed/new source, configuration, migration,
  dependency and test files:
  `ed2a8e5146919054fe909d340fc202bb61d132a19918623673489408997ce5cd`.
  This is SHA-256 of sorted `SHA256(file)  relative-path` lines, each ending in
  a newline. The input set is the union of `git diff --name-only HEAD` and
  untracked non-ignored files, excluding `node_modules/`, `output/`, `docs/`,
  and dot-prefixed paths. It identifies the local implementation, not a Git
  release revision; documentation, ignored caches and screenshot evidence are
  deliberately outside that fingerprint.
- The implementation fingerprint was rechecked unchanged before the approved
  local commit. The earlier uncommitted build correctly reported
  `sourceClean: false`; release artifacts must be rebuilt from the exact clean
  reviewed commit. No local build authorizes a fix-available announcement.

## Approved commit and read-only preflight checkpoint

- The user's approval covers the reviewed local candidate and read-only checks
  only. The commit includes the 80 implementation files, four feature/evidence
  documents, two graph-ignore files and 15 synthetic browser screenshots.
  Generated installed dependencies and the unrelated primary checkout are excluded.
- Remote `main` remains `13f50a6c9e359e859923c1a0cbbaf20fa2615cc3`.
  Cloudflare Pages project `senior-resource-map` owns `app.carearound.sg`;
  its successful production deployment is `5686ee8f-5339-4239-887a-91a3f41f4c85`,
  at that same clean revision, created 2026-09-06 13:02:48 UTC.
- Pages production auto-deployment from `main` is enabled. Its production
  `VITE_SUPPORT_INBOX_ENABLED` variable is absent. The dashboard build command
  delegates to the client workspace build; retain the repository's exact
  ten-root derivative build contract when preparing any future release.
- Worker `senior-resource-map-api` has version
  `8567e09a-73aa-48d7-8a4d-76540d967525` at 100 percent, deployed
  2026-09-06 11:37:52 UTC. `SUPPORT_INBOX_ENABLED` and `CF_VERSION_METADATA`
  bindings are absent and it has no Cron Triggers. The database binding's
  presence was checked without displaying its value; this does not identify
  or validate the Neon branch or schema.
- Public API health returned HTTP 200 with `status: ok`. The existing client's
  `/release.json` returned the HTML app fallback, not release metadata; this is
  expected for the old release and is not proof of the new verifier.
- Neon preflight is **incomplete**: no Neon connector, authenticated database
  tool or installed Neon CLI was available. No environment file, database
  credential, personal record, schema, journal or backup setting was read.
  The primary checkout's recovery runbook records an August 29 rehearsal;
  that historical evidence does not establish a current backup/restore point.
- Next database checks require the exact CareAround Neon project/production
  branch, credential-safe read-only schema/journal inspection and current
  backup evidence. Do not infer baseline registration or run any migration.
- The legacy Worker release-line guard still requires fully clean tracked
  files on `main` matching `origin/main`. Generated tracked `node_modules`
  changes remain in this local worktree; future release preparation needs a
  compliant clean checkout. The guard was not weakened or bypassed.

## Delivered scope

1. Versioned Guide answers and real public resource search; explicit navigation;
   optional reviewed private question history; account/guest support reports;
   persistent replies; human approval tied to an exact fix revision; independent
   release evidence plus human production testing before notifying the reporter;
   reporter resolve/reopen with history.
2. Opt-in Calendar and saved-resource changes, durable retry-safe processing,
   grouped Updates, read/unread, dismissal and mute. Reading a notice does not
   acknowledge a schedule change or move an existing Calendar plan.
3. Reviewed saved-search subscriptions, public-visibility search, initial
   baselines without historical alerts, new-match digests, preferences,
   edit/pause/resume/delete and account isolation.

The [implementation plan](guide-inbox-notifications-plan.md) records the full
acceptance contract and the earlier phase-specific browser/integration evidence.
The Guide is currently English and deterministic, not an open-ended generative
assistant. Device push, email, SMS, WhatsApp, autonomous code repair, bookings
and clinical recommendations are not included.

## Current validation

| Gate | Result and scope |
| --- | --- |
| Full server suite | 702 passed, zero failed/skipped; disposable PostgreSQL integration included |
| Full client suite | 765 passed, zero failed/skipped |
| Static gate | Seven ordered migrations; 471 source modules / 1,393 edges; no import cycles; diff check passed |
| Feature-enabled exact client build | Passed with all ten locked map roots and Discover derivative flags |
| Map-lockdown plus configured build | Passed; its diagnostic build is not the final Discover release artifact |
| Worker compilation | Previous checkpoint after the last application change passed: Wrangler 4.129.0, 3,311.79 KiB / 665.57 KiB gzip; no Worker application source changed in this checkpoint |
| Shared-surface browser checks | Results below; no production data was used |
| Credentialed release smoke | Not run against a release target; local fixture journeys do not replace partner-login/import smoke |
| Production migration/deployment | Not authorized or performed |

### Shared-surface evidence added at this checkpoint

- My Directory's All/Used/Not used filters distinguished owner use from another
  account's private map. Both a mapped Place and a list-only Offering were used
  and protected. The used-only view disabled bulk selection.
- Cancelled bulk removal retained all four saves. Confirmed removal deleted
  only the two unused synthetic saves. The dialog included the Offering/Care
  Calendar warning. The server rejected a direct bulk attempt against the two
  protected saves, returning zero removed and two protected. Another account's
  save was unchanged.
- Unsaving the synthetic scheduled Offering removed its saved occurrence source,
  while the existing personal planned-session row and its original start time
  remained unchanged. Both map memberships remained present.
- Signed-in Discover rendered four visible fixture resources, excluding hidden
  and restricted fixtures. With Help/unread enabled, the 15 -> 14 -> 13 -> 14 -> 15
  round trip loaded 20/20 native Default images at 15, 64/64 overview images at
  14, and 25/25 live tiles with no fixed images at 13. Gray at 15 loaded 20/20
  matching native images. Every fixed-surface sample had zero live tiles.
  Guest Discover also returned the four visible resource results.
- Shared Map retained its two-resource frozen snapshot after the owner added a
  third saved resource. Private support-report text, a private map note and a
  personal place were present in owner data but absent from the guest snapshot
  and embed. Mapped and list-only membership remained represented.
- At 320 px, the actual embedded app fit exactly within the viewport, showed
  mapped/list-only disclosure, had no account navigation or Help link, and made
  only one API request: the embed endpoint. Its request had no Cookie header;
  the API payload was structurally identical with and without a member cookie.
  Final actual-embed console: zero errors/warnings.
- The real Pages handler, using the disposable API's actual embed-config route,
  produced exact approved-origin framing headers, no-store, no X-Frame-Options,
  and a 404/no-store response for an unknown token. A separate labelled static
  framing probe loaded inside approved origin 5180 and was blocked by browser
  CSP inside origin 5181. Disabling embedding immediately rendered unavailable
  inside the approved parent while the ordinary shared map remained readable.
  The probe tests framing, not the app UI; the actual UI was tested separately.
  Probe favicon 404s and the intentional denied-frame console error are not
  application errors. Synthetic embedding was restored after the check.

Inspected screenshots:

- `output/playwright/guide-discover-detailed-gray-regression.png`
- `output/playwright/support-embed-isolation-mobile.png`

The disposable harness now uses actual map/share/embed/personal-place read,
public cache and discovery-location handlers. It seeds a valid list-only
Offering; the earlier invalid Place-with-null-coordinates seed was corrected
without relaxing the schema. Its identities are synthetic; it does not prove
production authentication. `supportEmbedBrowserServer.mjs` is test-only and
serves the separate framing probe on loopback ports 5180–5182.

## Known issues and limits to review

- The existing Shared Map list-only card emitted React nested-anchor diagnostics
  at desktop width, and the shared page measured 336 px wide in a 320 px viewport.
  `SharedMapPage.jsx`, `SharedMapDirectoryList.jsx`, `EmbeddedApp.jsx` and
  `EmbeddedMapPage.jsx` are identical to the candidate base. The added global CSS
  is scoped to `.navbar-support-enabled`, which is absent from the guest shared
  shell. No map repair was made and a clean Shared Map UI pass is not claimed.
  Review/accept these observations separately; exact live-baseline visual parity
  has not been established by this checkpoint.
- Small disposable fixtures and bounded batch tests do not establish production
  throughput, delivery latency, support staffing or retention operations. Saved
  search scan intervals are not promised delivery deadlines.
- Guest recovery expires after 30 days. That access expiry is not evidence that
  stored report records are automatically deleted. Review production retention
  and support operating responsibility before enabling the feature.
- Real production sign-in, the general credentialed smoke suite, a production
  fix/reporter loop and deployed artifact parity remain release-stage evidence.
- Existing five parked security findings were not reopened or certified fixed.

## Exact proposed database scope

Four additive migrations create ten feature tables. They do not backfill or
rewrite existing resources, maps or Calendar plans. Existing-environment schema
alignment and constraint/index effects still require a target-specific preflight.

| Ordered migration | SQL SHA-256 |
| --- | --- |
| `0003_support_inbox` | `8f9d98ce7658ea55676c1135d84c8fb9f5ba4861344f7a6a1bb8dab6a26f37e0` |
| `0004_guide_history` | `4560f722eca19af9190f01399fee7ad321daa0ff439cc9316ebd6d6f143ab75f` |
| `0005_notification_updates` | `1aac87349b0cba62b75522164f2205c3974f1e6fd2c95a47cad05012a0170a51` |
| `0006_saved_search_alerts` | `7a94c7be9da426b29c6dc4e128e96af7dafd247d5a905c431458cc5e36ba6de5` |

Ownership, snapshot hashes, checks and forward-only rollback strategies are in
`server/drizzle/migration-manifest.json`. Never apply migration `0000` to an
existing database. Do not assume production is enrolled in the ordered migration
journal or silently rerun migrations `0001`/`0002`.

## Remaining release decisions and sequence

1. Scoped local commit is approved. Push/merge remains unapproved. Review the
   known shared-map observations, support operations and retention before rollout.
2. Read-only production preflight is approved; Cloudflare checks are recorded
   above, but Neon access and verification remain outstanding. Confirm
   schema/journal alignment, the migration application method, and a fresh
   verified backup/restore point. Approval for preflight alone is not approval
   to apply the four migrations.
3. Approve the exact commit, environment, migrations `0003`–`0006` and release
   window. Keep API/UI rollout flags off during preparation. A push/merge to
   `main` can trigger Pages, so confirm its feature flag remains off beforehand.
4. Apply only the approved migrations, verify them, and ship the compatible Worker
   with the rollout flag still off. The release wrapper requires clean `main`
   matching fetched `origin/main`; never bypass it from this dirty feature branch.
5. Run approved-target authenticated smoke checks. Build the exact derivative
   client with `VITE_SUPPORT_INBOX_ENABLED=true`; enable the approved Worker
   `SUPPORT_INBOX_ENABLED` rollout only after schema/permission verification.
   Confirm scheduled processing, then publish the matching client including
   Pages Functions. Preserve all ten map roots and current auth/secret settings.
6. Verify Worker version/revision, client entry integrity and complete preview/
   custom-domain artifact parity. Repeat the three feature journeys and shared
   regression probes against the approved release target. No fix notification
   may be generated merely because this feature was deployed.
7. On failure, disable the rollout and restore the prior compatible client/Worker
   while retaining the additive feature tables and private records. Destructive
   cleanup or a database restore needs separate approval.

Recommended next step: establish credential-safe read-only access to the exact
CareAround Neon production branch and complete schema/journal and backup checks.
Production mutation/deployment remains a separate gate;
the earlier bulk-unsave/map release approval does not authorize this feature.
