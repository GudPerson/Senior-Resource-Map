# Governed Care Maps limited production release

Status: historical limited-release evidence; activation instructions superseded
by `docs/closed-iccp-pilot-goal.md`.

## Scope and evidence

The user requested the staged rehearsal followed by deployment, then asked which
human prerequisites could be deferred. The limited release separates installation
from real-organisation onboarding. Subsequent user screenshots demonstrate a
completed production snapshot and working production Super Admin access.

- Snapshot: `production at 2026-09-13 16:41:09 UTC (manual)`, 96.47 MB, no expiry,
  on branch `br-green-union-ailxs0g3`. Prior non-production restore proof is dated
  7 September; a fresh restore/cutover was not performed this session.
- Live dashboard identifies the account as Super Admin. Admin Tools loads real
  resource rows. This is one operator's existing access, not post-deployment
  pilot recovery or two-operator proof.
- A fresh read-only Neon transaction matches all 74 existing table fingerprints,
  enums and the recorded baseline plus migrations 0003–0007. No migration 0000,
  historic replay, role repair or data conversion is required.
- Cloudflare and GitHub authentication work. The deployed Worker has a
  `DATABASE_URL` secret binding. Its value was neither read nor changed.

See `docs/evidence/governed-pilot-operator-checks-20260914.json` and
`docs/evidence/governed-pilot-preflight-20260914.json`.

## Release boundary

`GOVERNED_PILOT_RELEASE_STAGE` now controls the Worker in the reviewed order
`off`, `onboarding`, `claims`, `maps`, then `lifecycle`. The matching client
variable is `VITE_GOVERNED_PILOT_RELEASE_STAGE`. Both production defaults are
explicitly `off`; absent, legacy, unknown or misspelled values also resolve to
`off`. Advancing to `onboarding` does not enable governed-map routes, public
governed reads, publication, restoration or scheduled archival. Disabled
requests receive `503` and `no-store`, and no browser stage or access-setting
value bypasses the Worker stage.

The stage-off production build hides new application forms, governed-map
navigation and the draft organisation content grant, retaining the prior
Terms/date. Both Worker and client remain off pending the separately reviewed
gate activation. This is not a declaration of legal compliance; the earlier
public legal baseline and existing personal-data obligations still apply.

Admin → Pilot Access remains usable without onboarding. It can separately close
public directory, registration and login, with a confirmation explaining Super
Admin recovery and continued personal My Map sharing. Installation does not
change those access settings. Existing personal maps are not converted, deleted,
or assigned new ownership. Wider provider recruitment remains deferred.

## Validation

- Full server: 762 passed. Full client: 808 passed, plus 4 environment checks.
- Map lockdown: 104 passed. Static: 10 migrations, 504 modules, 1,513 edges,
  no cycles. The production client build passed with all required map roots.
- Disabled-route tests require rejection before database access or request-body
  parsing. An authenticated Super Admin also cannot bypass the release stage.
- Full HTTP rehearsal verifies no alternate registration writes, preserved
  personal sharing, removal of unapproved branding under restricted access,
  fresh Super Admin login after closure, ordinary-user denial, and reopening.
- Generated migration batch rejects wrong targets and schema/history drift;
  interruption after 0008 rolls back both schema and history. Retry installs ten
  tables and two journal entries once, preserves old fingerprints/history, and
  leaves the access-settings table empty. The local PGlite engine is PostgreSQL
  18.3; production SQL is separately pinned to PostgreSQL 17 and validates its
  own catalog inside the atomic batch. This is not a new live-Neon restore or
  lock-contention rehearsal.
- Separate Chromium session on `localhost:5185`: disabled organisation form,
  Admin controls without onboarding, confirmed private-mode activation, public
  notice without application links, and 390×844 / 1440×1000 layout checks pass.
  Local Google sign-in reports its expected unapproved test origin; the
  rehearsal uses fictional email/password authentication, not Google.
- Original user sessions on 5173/8787 and the earlier 5183 fixture are preserved.
  The 5185 diagnostic build is not a production deployment artifact.

## Rollout procedure

1. Commit the reviewed changes and preserve the exact source in a release PR.
2. Apply only generated 0008/0009 SQL to the verified Neon production target,
   using the reviewed 2-second lock/15-second statement limits and one atomic
   batch. Verify all ten new tables, old fingerprints, unchanged prior history,
   and exactly one row for each new migration. Do not change public access.
3. Prevent automatic Pages production deployment from racing ahead of the API;
   preserve its prior setting and restore it after this ordered release.
4. Merge to main, update the clean dedicated release checkout, deploy Worker
   through the repository wrapper, then the exact validated Pages client.
5. Verify Worker provenance, health, installed platform-access schema with pilot
   disabled, disabled routes, and custom-domain byte/MIME/hash parity. Record
   authenticated post-deployment limits separately from these public probes.

For rollback, retain additive schema and return to the compatible known-good
Worker/client. No destructive down migration or production snapshot restore is
part of an ordinary application rollback.
