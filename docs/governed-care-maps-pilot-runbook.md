# Governed Care Maps pilot runbook

Status: limited deployment authorized; real-organisation activation deferred
Last updated: 2026-09-14 (Asia/Singapore)

The [13 September staged rehearsal](governed-care-maps-pilot-rehearsal-20260913.md)
records the local evidence, corrected defects, migration plan, and outstanding
production prerequisites. Earlier local-only authorization notes are historical.

## Purpose

This runbook activates the closed, organisation-led pilot without converting or
rewriting any personal My Map. It separates code release, database migration,
organisation approval, content approval, and the final access switch so each can
be reviewed and reversed independently.

## Pilot boundaries

- Use fictional organisations in rehearsal. Use a real organisation only after
  its authorised representative has explicitly consented.
- Keep existing personal My Maps independent. Do not migrate them into governed
  maps or assign organisation ownership to them.
- Treat a governed map creator as an audit fact. Current map authority comes
  from active roles on its included resources and linked organisations.
- Keep preloaded resource records private for partner review. Governed public
  snapshots use only the approved organisation-pack logo and suppress provider
  website, source, social, grounding, external, and direct-detail links.
- A direct governed share remains public by token. An embed additionally needs
  at least one exact approved HTTPS origin.
- A resource steward can remove only their own resource. Retirement and restore
  require a reason and notify current participants.

## Limited production release

Deploying inactive code and opening an organisation pilot are separate decisions.
The earlier requirement to complete every operational-pilot item before any
production deployment was too broad for the limited release discussed with the
user. This release retains the existing Terms text, disables new organisation
onboarding and all governed-map routes and scheduled archive work, and leaves
public access settings unchanged during rollout.

Required before deployment:

- Reviewed clean release commit, regression checks, and exact migration plan.
- Current production backup plus recorded restore evidence. The user supplied a
  completed 96.47 MB manual snapshot created at 2026-09-13 16:41:09 UTC with no
  expiry. Reuse the 7 September non-production restore exercise; it did not test
  live connection cutover or non-Postgres recovery.
- One verified production Super Admin plus application rollback access. The user
  demonstrated the live Super Admin dashboard and loaded Admin Tools. Cloudflare
  and GitHub operator authentication were separately checked. A second operator
  remains recommended for partner operations, not a requirement for installing
  this inactive release.
- Fictional rehearsal of closed public access, Super Admin email/password
  recovery, reopening access, and continued personal My Map sharing.

See [operator evidence](evidence/governed-pilot-operator-checks-20260914.json).

`GOVERNED_PILOT_ENABLED=false` is explicit in Worker configuration. Absence or
any value other than the string `true` also disables it. The production build
pins `VITE_GOVERNED_PILOT_ENABLED=false`. Both require an intentional reviewed
change before real onboarding. A database public-access toggle cannot enable
these release flags.

The limited Admin panel can separately set directory, registration and login to
`closed` (Super Admin recovery remains available). This restricts the legacy
public database while preserving existing personal share/embed paths. The UI
requires confirmation; installation alone does not change the access row.

## Organisation-pilot activation prerequisites

Complete these before enabling the release flags and accepting real applicants:

1. The release commit is reviewed from a clean branch and the release checklist
   passes against that exact commit.
2. Neon scheduled backup or snapshot coverage is confirmed and a non-production
   restore rehearsal has succeeded.
3. Migrations `0008_platform_access_settings` and
   `0009_governed_care_maps` have an approved execution and rollback plan.
4. The updated Terms and Privacy text, legal contact, organisation permission
   wording, retention wording, and pilot operating entity have been reviewed by
   a suitably qualified adviser.
5. A manual organisation-verification procedure exists. At minimum, confirm the
   applicant through an independently obtained organisation contact and confirm
   control of the stated email domain. Do not rely only on a submitted form.
6. Confirm a second recovery operator or explicitly document the accepted
   single-operator arrangement and tested fallback.
7. Authenticated UAT credentials and fictional test organisations are ready.

## Safe release order

### 1. Release the additive database schema

- Confirm the production schema fingerprint and approved backup/restore evidence.
- Apply migration `0008` before `0009` through the reviewed migration procedure.
- Use `server/scripts/generate_governed_pilot_release.mjs` to generate the atomic
  batch. It validates both immutable hashes, target branch/database/role/major,
  existing catalog fingerprints and history, 2-second lock and 15-second
  statement timeouts, and exactly-once installation. It does not connect or
  execute SQL itself. The only approved production target is branch
  `br-green-union-ailxs0g3`, database `neondb`, role `neondb_owner`, PostgreSQL 17.
- Re-run migration validation and confirm both migrations are recorded exactly
  once.
- Do not enable the pilot access modes yet. The access row defaults to the
  legacy-compatible open values.

Stop if migration verification differs from the reviewed plan. Do not attempt a
destructive down migration; retain the additive tables and restore application
behavior through the access settings and compatible code.

### 2. Release the Worker and client

- Deploy the Worker from the reviewed clean release commit.
- Verify health, platform-access read, existing personal My Map APIs, existing
  personal share/embed routes, and the scheduled-handler registration.
- Deploy the exact validated client artifact and verify custom-domain byte and
  MIME parity under the standard release checklist.
- Keep directory, registration, and login modes open while these checks run.
- For the limited release, keep both release flags off. Require direct
  onboarding, governed share/embed, publication, and restore requests to reject
  without a write. Check that Admin access controls still load with onboarding
  disabled and that the new agreement section is absent from Terms.
- Confirm the deployed platform-access response sees the installed schema.
  The Cloudflare settings API exposes the DATABASE_URL binding name/type, not
  its secret value. The migration target is verified against the user's Neon
  production branch and a read-only query; do not claim the secret was inspected.
- Finish the limited release here. Steps 3–6 are for a later organisation pilot,
  after its operational prerequisites are complete. Continue demonstrations in
  the separate fictional environment.

### 3. Rehearse with fictional organisations

- Submit one fictional organisation registration with HTTPS asset URLs and the
  pilot Terms acceptance.
- As Super Admin, independently verify the fictional fixture, inspect the exact
  website/logo/banner links, and approve the organisation.
- Have the proposed first Organisation Admin submit a staff access request.
  A Super Admin must approve that first account with the Admin role. Later staff
  requests can be decided by that Organisation Admin; only a Super Admin may
  create another Organisation Admin through this pilot flow.
- Assign the organisation to the agreed region group and link only the fictional
  resources it is authorised to steward.

### 4. Rehearse a governed map

- Create a map from a user who currently stewards at least one eligible resource.
- Add resources from two fictional partner organisations in the same region
  group and save map presentation changes.
- Publish once with no origins. Confirm the direct share works and the admin UI
  reports that embedding is inactive.
- Add one exact fictional HTTPS website origin, republish, and confirm that origin
  can frame the map while another origin cannot.
- Inspect the public payload: approved pack logos may appear; preloaded logos,
  banners, websites, social links, source links, and detail paths must not.

### 5. Exercise stewardship and lifecycle

- Remove the creator's current staff/owner role and confirm the account loses map
  access unless it still holds another current included-resource role.
- Assign a replacement owner to the organisation resource.
- From partner B, attempt to remove partner A's resource and require denial.
- From an authorised partner A resource steward, remove partner A's resource with
  a reason. Confirm it disappears immediately from share and embed and all current
  participants receive notifications.
- Retire the map with a reason and confirm share/embed become unavailable.
- Restore it with a reason during the 30-day window and confirm the same token
  resumes with a freshly built safe snapshot.
- Retire it again in the fictional database, advance the controlled test clock,
  run the finalizer twice, and confirm one idempotent archive result.
- Confirm the existing personal My Map and its personal share behavior are intact.

### 6. Enable the closed pilot last

Only after the prior evidence is reviewed, set all three values in one audited
Super Admin action:

| Setting | Pilot value |
| --- | --- |
| Public directory | Approved organisation users |
| Public registration | Organisation only |
| Public login | Organisation only |

Then verify:

- a signed-out visitor sees the pilot notice on Discover and cannot use direct
  resource list/detail, public caches, location indicators, or Guide search;
- a general public account cannot sign in through the public pathway;
- an approved organisation account can sign in through Organisation sign-in and
  use its permitted workspace;
- an unmatched organisation email is directed to organisation registration;
- a matched organisation email creates a pending request and receives no session
  before approval;
- direct governed share links and approved-origin embeds remain available without
  a CareAround account.

## Rollback

If authentication or organisation access fails, use the Super Admin control to
restore directory, registration, and login to open in one audited revision. If
the control cannot be reached, redeploy the last compatible Worker only through
the standard incident procedure; do not edit the database row manually without
an approved incident plan.

If governed publishing fails, retire the affected governed map or withhold its
token while leaving personal My Maps untouched. Revoke an organisation asset pack
or agreement to block the next publication when permission is withdrawn.

If the Worker or client release regresses an existing surface, roll back that
artifact to its known-good release. Keep migrations `0008` and `0009` in place;
they are additive and the older application does not depend on their records.

## Pilot operations

- Review pending organisation applications through an independent contact before
  approval. Record a rejection reason when verification fails.
- Review resource facts with the organisation before linking the resource to it.
- Use the audit trail for access-setting, onboarding, join, map, withdrawal, and
  lifecycle decisions. Do not treat notifications as authorization grants.
- Replace or revoke an asset pack when its permission ends. Republish affected
  maps only after agreement coverage is active again.
- Monitor scheduled archive failures, publication conflicts, access-setting
  conflicts, and repeated rejected join attempts.
- Export and review pilot feedback without adding personal or client case data to
  a governed map.

## Wider-public gate

The closed pilot can proceed only after the release prerequisites and fictional
UAT pass. Opening public discovery or onboarding more providers is a later
decision. It requires current legal/privacy review, verified content provenance,
support ownership, incident response, retention rules, and explicit resolution
of the user's AIC employment guidance before any provider recruitment connected
to that role.
