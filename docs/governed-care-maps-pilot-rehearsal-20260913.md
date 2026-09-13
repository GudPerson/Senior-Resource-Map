# Governed Care Maps staged pilot rehearsal

Date: 2026-09-13 (Asia/Singapore)
Status: local technical rehearsal passed; production release prerequisites remain open.

## Scope and authorization

The user authorized the staged runbook rehearsal and deployment after completion.
This supersedes the earlier local-only authorization notes. Production execution
still depends on the go-live prerequisites in the runbook; this rehearsal does
not replace qualified review, current provider recovery evidence, or confirmation
of production recovery operators.

Work remains in `codex/governed-care-maps-pilot-20260913`, in the isolated
`/Users/sweetbuns/CareAroundSG-worktrees/governed-care-maps-pilot` checkout. The
implementation baseline was `7a03836f`; production/main was checked at
`3c26c8c7aba81afd7f22a0600b31701cefb2855b`. The unrelated primary checkout was
preserved. No push, merge, production migration, production access switch,
Worker deployment or Pages deployment was performed.

## Defects found and corrected

- Public governed share responses permitted 60 seconds of browser caching.
  They now use `no-store`, so a subsequent request observes withdrawal or retirement.
  This does not remotely erase content already displayed in an open browser tab.
- Restore reactivated an old publication without rebuilding it. Restore now
  verifies current agreement/asset-pack coverage and the 30-day deadline, rebuilds
  the snapshot from current resources, and commits the publication, map state,
  event and notifications atomically. The original share token is retained.
- Participant notifications were recorded but had no client display. An isolated
  Care Map updates panel now shows the map, action, actor name, time and reason,
  with recipient-scoped mark-as-read. It does not alter the existing general inbox.

## Executed rehearsal

`server/test/governedPilotRehearsal.test.js` drives the actual application routes,
password login, session cookies, live membership hydration and PostgreSQL SQL.
There is no authentication override or remote database connection.

| Stage | Evidence |
| --- | --- |
| Organisation onboarding | Two fictional applications, HTTPS asset packs and terms/permission records; Super Admin approval; pending first-admin accounts cannot sign in; subsequent staff approved by Organisation Admin |
| Recovery actors | Two fictional Super Admins authenticate; the second reverses the access setting through its audited API |
| Map creation and design | Resources from two linked organisations in one region; saved presentation; stale metadata revision rejected with 409 |
| Public publishing | Empty origin list leaves direct sharing available and embedding unavailable; exact HTTPS frame allowlist; approved logos retained; preloaded branding and provider links suppressed |
| Creator departure and replacement | Existing creator session loses access after membership revocation; ordinary staff cannot access the map until assigned the resource Owner role; no Super Admin privilege is used for that owner proof |
| Withdrawal | Partner B cannot withdraw A; A's replacement owner can; subsequent public share/embed reads drop the resource; recipient sees actor and reason; another user cannot mark that notice read |
| Retirement and restore | Share/embed return unavailable during retirement; withdrawal during retirement stays removed after restore; changed resource facts appear; revoked asset permission blocks restore; original token resumes |
| Restricted access and rollback | Guest resource routes/caches/Guide search are denied; general public login is denied; organisation login succeeds; unmatched domain returns organisation-registration guidance; governed and existing personal sharing remain available; recovery Super Admin restores open modes |
| Archival | Expired restoration rejected even before scheduler execution; controlled future time produces one archive; second finalizer run does nothing; personal map and personal share survive |

The fixture establishes Region Group and organisation-resource links directly in
its disposable database. It models the existing governance setup; it does not
claim a fresh browser test of every legacy governance editor or a real applicant
verification exercise.

## Browser evidence

An isolated Chromium session exercised a compiled local client with `/api`
transport, the full application and fictional database at loopback port 5183.
The production-configured build was validated separately; the local API build
is not a deployable production artifact.

- Partner password sign-in and the organisation-governed map directory render.
- Map colour/pin size saves; participant updates render with actor names and can
  be marked read.
- Retirement confirmation makes public access return 404; restore returns 200
  on the same token.
- Desktop 1440 x 1000 and phone 390 x 844 have no horizontal overflow.
- A fictional organisation request was submitted and approved through the UI.
- The Super Admin Pilot Access control activates the restricted setting through
  the real API; signed-out Discover shows the pilot notice.
- Chromium displays the governed embed at the exact approved HTTPS origin and
  blocks it at another origin through `frame-ancestors`. The expected CSP refusal
  is an intentional browser error in this denial test.

The fictional HTTPS hosts resolve through Playwright request routing to the local
server and its actual Pages embed response function. No public DNS, hosting,
provider website, consent grant or organisation onboarding was created.

Screenshots and the local compiled browser artifact are in
`output/playwright/governed-pilot-rehearsal/` (not part of the source commit).

## Migration rehearsal and execution plan

`server/test/governedPilotMigrationRehearsal.test.js` verifies both the captured
legacy schema and a schema already carrying feature migrations 0003–0007.
It checks interruption after 0008 rolls back DDL/history, retry succeeds,
unchanged existing table fingerprints and synthetic personal-map records,
exact-once migration history, and an empty access-settings table after upgrade.
The incremental pilot upgrade adds ten tables. This is local PGlite compatibility
evidence, not a current Neon restore, production lock test or approved live journal.

The reviewed migration bytes remain unchanged:

| Migration | SHA-256 |
| --- | --- |
| 0008_platform_access_settings | `8e7662a0b0791f7d9b8c7eb3acab415eb3924f45f70d434d10ca8992176021b1` |
| 0009_governed_care_maps | `36742b97b8c40f112067f4b0fd458cd866f6dc23125adc63ccf84d1d5c0c4688` |

Before execution, verify the actual Worker database target, current schema and
existing migration authority. Do not replay 0000 or forge historical migration
entries. Confirm a fresh recovery point, compare the two hashes, and execute 0008
then 0009 through the reviewed runner with bounded lock/statement timeouts. Verify
the ten new tables, constraints, indexes, unchanged legacy objects and exactly one
history record per migration before releasing compatible Worker/client code.
Leave access modes open until the runbook's final audited activation. For rollback,
retain additive tables and revert compatible application/access behavior; do not
run destructive down migrations or replace production with the fictional fixture.

## Validation and release decision

- Full server: 759 passed, no failures/skips.
- Full client: 805 passed; production environment checks: 4 passed.
- Map lockdown: 104 passed.
- Static: 10 migrations, 500 source modules, 1,499 import edges, no cycles.
- Repository production build: 2,494 transformed modules, passed.
- Focused HTTP and migration rehearsals are included in the server total.

Cloudflare and GitHub authentication are available. Read-only production health
returned 200; Worker release reported `3c26c8c7` and deployment
`5c7218c4-9221-4756-9b6b-f4211f9bccc7`. The new platform-access route is not deployed
(404). No authenticated production smoke or deployed artifact parity is claimed.

At 14:37:48 UTC, a read-only transaction using the existing local server
configuration confirmed database `neondb`, branch `br-green-union-ailxs0g3`, role
`neondb_owner`, and `transaction_read_only=on`. The 74 table fingerprints and
enums match the rehearsed pre-pilot schema exactly. The operational journal
contains the observed baseline and exact migration hashes for 0003–0007; the
pilot tables are absent. A separate aggregate query found two Super Admin
accounts. Their actual recovery sign-ins were not tested. No personal records
or credential values were read into tool output.

See `docs/evidence/governed-pilot-preflight-20260913.json` and
`docs/evidence/governed-pilot-preflight-comparison-20260913.json`. This verifies
the configured connection's target; it does not independently attest the
currently deployed Worker's database binding or provider backup state.

Deployment is held at these runbook prerequisites:

1. A fresh Neon recovery point and independent Worker database-binding check.
   Current schema/journal verification passed using the existing connection.
   Saved snapshot/restore evidence is dated 7 September; current provider backup
   state was not accessible through an authenticated Neon management tool.
2. Qualified review of the Terms/Privacy, contact, permission/retention wording
   and operating entity. Evidence was requested from the user and is pending.
3. Confirmation of two actual production Super Admin recovery operators and an
   available authenticated production smoke path. The two fictional operators
   prove the flow only.

The next action is to resolve those recorded prerequisites, refresh the release
branch against main, then follow the runbook's schema → Worker → client → verified
pilot → access-switch ordering using the user's existing deployment authorization.
