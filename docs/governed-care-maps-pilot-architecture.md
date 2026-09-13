# Governed Care Maps pilot architecture

Status: implemented and verified locally, not deployed  
Owner: CareAround SG product owner  
Last updated: 2026-09-13 (Asia/Singapore)

## Objective

Prepare CareAround SG for a closed, organisation-led pilot by introducing
additive Governed Care Maps, controlled public access, resource-derived
stewardship, safe public sharing, and auditable retirement without migrating or
disrupting existing personal My Maps.

## Non-negotiable invariants

1. Existing personal My Maps keep their required individual owner and current
   authorization, personal-place, private-note, Map Studio, export, sharing,
   embed, duplication, and deletion behavior.
2. Governed Care Maps are independent records. A creator is retained only as
   nullable audit information and never becomes the durable owner.
3. Current access is derived from active organisation and resource assignments.
   Historical participant records provide audit and notification context but
   never preserve a revoked permission.
4. Map permissions do not grant permission to edit an underlying resource.
5. A resource may be withdrawn immediately by an authorized steward of that
   resource without granting control over another partner's resource.
6. Guest Shared Maps and approved-origin embeds remain usable while general
   public discovery, registration, login, and direct resource details are
   restricted.
7. Withdrawing a resource must remove it from the live map and every public
   representation synchronously. A failed public snapshot update fails closed.
8. Governed maps do not contain personal places, private notes, or personal
   handoff notes during the pilot.
9. Retirement is reversible for 30 days, records the actor and reason, suspends
   guest access immediately, and archives rather than hard-deletes the map.
10. No production schema migration, data mutation, push, or deployment occurs
    without its separate release gate.

## Product modes

### Platform access mode

The server owns a database-backed singleton setting. The client may use its
public projection to present the correct route, but client state is never an
authorization control.

| Setting | Values | Pilot value |
| --- | --- | --- |
| `public_directory_mode` | `open`, `authenticated`, `closed` | `authenticated` |
| `public_registration_mode` | `open`, `organization_only`, `closed` | `organization_only` |
| `public_login_mode` | `open`, `organization_only`, `closed` | `organization_only` |

The legacy-compatible default is `open`. Changing the setting is restricted to
Super Admin, audited, and reversible. Shared-map and embed token routes, legal
pages, health checks, and the organisation application pathway are explicit
exceptions to public-directory closure.

### Map governance mode

Existing `my_maps` rows remain personal. Governed maps use additive records and
an explicit `governance_mode = resource_stewarded` discriminator. No existing
row is converted during the pilot.

## Organisation onboarding

An organisation must have:

- an approved organisation record;
- at least one verified email domain;
- an accepted agreement version covering supplied content and digital assets;
- at least one active Organisation Admin;
- explicit resource links for the resources it represents.

An applicant using a verified domain creates a pending join request. No active
session or organisation access is issued until an Organisation Admin approves
the request. An unmatched domain is routed to an organisation-registration
request. Domain matching is case-insensitive and exact after email
normalization; consumer email domains and suffix matching are not accepted.

## Governed-map capabilities

All map commands ask one server-side capability resolver. Client controls mirror
the result but never infer access locally.

| Capability | Initial pilot rule |
| --- | --- |
| View partner map | Active staff/owner of an included resource, or Admin of its linked organisation |
| Create map | Active resource owner or Organisation Admin with at least one eligible in-scope resource |
| Edit map content/layout | Active owner of an included resource or Admin of its linked organisation |
| Publish/update sharing | Active owner of an included resource or Admin of its linked organisation |
| Change embed origins | Active Admin of an included resource's linked organisation |
| Withdraw a resource | Active staff/owner of that resource or Admin of its linked organisation |
| Request/cancel retirement | Any current participant, with a required reason |
| View audit history | Any current participant |

Every mutable governed-map command uses optimistic revision checking. A stale
revision returns a conflict and never silently overwrites another partner's
work.

## Participant and lifecycle model

Current authorization is calculated from:

- active map-resource membership;
- active hard/soft resource staff membership and role;
- active organisation-resource links;
- active organisation access membership and role.

Participant organisations are materialized separately for directory discovery,
deduplicated notification recipients, and historical audit. Those rows are not
authorization grants.

Governed maps use these lifecycle states:

```text
draft -> published -> retirement_pending -> archived
                     ^                  |
                     +------ restore ---+
```

`retirement_pending` disables Shared Map and embed delivery immediately but
keeps the existing token reserved. Cancellation restores the same token after
a fresh safe snapshot is produced. A scheduled, idempotent finalizer archives
unchallenged requests after 30 days. An empty governed map automatically enters
retirement review.

## Public sharing and withdrawal

Publishing creates a sanitized frozen snapshot and records its map revision.
Before delivery, the server also checks that the map is active and that every
snapshot resource remains a current map member. Resource withdrawal updates
membership, records an event, replaces the snapshot, writes participant
notifications, and records the audit entry through one Neon HTTP atomic batch.
The operation fails closed if that batch cannot complete.

Guest Shared Maps and embeds must not navigate into unrestricted direct resource
routes. Resource details required by the public map are delivered only from the
sanitized token-bound snapshot.

## Content provenance

Organisation onboarding records the supplying organisation, accepted terms
version, supplied logo and banner URLs, permission time, agreement, and any
later revocation. Governed-map publication requires an active owner-supplied
asset pack whose agreement covers both public listing and external sharing.
Every preloaded logo and banner is discarded from the public snapshot and only
the approved organisation-pack logo may replace it. Provider website, source,
grounding, external, detail, and social links are suppressed from governed
public delivery until a resource-specific content approval model is added.
Existing database content remains available inside the approved organisation
workspace for review. During a non-open directory mode, legacy personal share
snapshots also suppress corporate branding and external provider links without
changing their stored records.

## Release boundaries

### 1. Public access and content containment

- Introduce the server-authoritative access setting and Super Admin control.
- Restrict guest Discover, public caches, direct resource APIs, registration,
  and general login while preserving the explicit exceptions.
- Suppress unapproved public resource content.
- Validate authenticated organisation access and guest Shared Map/embed access.

### 2. Governed-map schema and capability model

- Add governed-map, participant-history, event, and lifecycle records.
- Implement and exhaustively test the capability resolver.
- Keep personal-map paths unchanged and add contract tests proving separation.

### 3. Private partner creation and editing

- Add the partner map directory, eligible resource selection, creation, editing,
  Map Studio, and conflict handling.
- Exclude private personal content.

### 4. Safe publishing, embedding, and resource withdrawal

- Publish sanitized revision-bound snapshots.
- Apply exact embed origin controls.
- Implement resource-scoped withdrawal and fail-closed snapshot replacement.

### 5. Retirement, notifications, and archival

- Add reasoned retirement/restore actions, in-app participant notifications,
  event history, and the idempotent 30-day archival job.

### 6. Controlled pilot validation

- Use fictional or explicitly consenting organisations and resources.
- Exercise staff departure, owner reassignment, concurrent edits, withdrawal,
  retirement, restoration, public share, embed, and archival.
- Complete the server, client, map-lockdown, migration, privacy, role-matrix,
  and authenticated UAT gates before any broader onboarding.

## Release ordering and rollback

Each schema change is additive and deployed before compatible Worker code. New
server behavior remains disabled until its schema and tests are verified. Each
client release follows the exact repository release build. Rollback disables
the new behavior and retains its records; it never converts, deletes, or rewrites
personal My Maps.

The operational sequence, pilot evidence checklist, and rollback actions are in
`docs/governed-care-maps-pilot-runbook.md`.
