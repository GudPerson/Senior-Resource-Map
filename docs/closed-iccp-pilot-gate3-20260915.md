# Closed ICCP pilot Gate 3 — collaborative Care Maps

Date: 2026-09-15 (Asia/Singapore)
Validation checkpoint: local and inactive; commit, push, deploy and activation
had not yet occurred
Stage: `maps`

## Outcome

Gate 3 is a separate cumulative release candidate for collaborative ICCP Care
Maps. An approved Organisation Admin can create a region map when the
organisation has at least one provider-approved resource in that region. Every
current participating resource steward can then see and update the common map.
The creator account carries no permanent ownership right.

Region candidates now come from current resource publication permissions and
current organisation-resource links. A manual governance-group resource link is
no longer required. Legacy organisation-wide staff records grant neither map
authority nor map notifications. Current direct resource staff or owners and
current Organisation Admins receive the relevant stewardship and notification
rights.

Publication checks every included resource against the Gate 2 permission for
the requested public use. A shared link requires `sharedMaps`; a publication
with one or more embed origins also requires `embeds`. Provider fields are
filtered again on every anonymous response, so a later field/use withdrawal is
visible immediately without relying on a stored snapshot or cache expiry.
Names, addresses and other care facts remain as unverified reference data when
provider content permission is absent. Embed origins remain exact normalized
HTTPS origins.

## Regression correction

The direct integration rehearsal exposed a Singapore timezone conversion risk
for organisation agreement effective and expiry timestamps. Publication now
performs those comparisons against `CURRENT_TIMESTAMP` inside PostgreSQL. This
avoids an eight-hour application-side shift without changing the schema or any
stored record. Future and expired agreements have explicit regression coverage.

## Verification

- Formal `npm run verify:quality`: exit code 0.
- Static gate: 11 ordered migrations, 509 source modules, 1,538 relative import
  edges, no cycles and a clean diff check.
- Full server suite: 778/778 passed.
- Full client suite: 810/810 plus 5/5 release-environment checks passed.
- Map lockdown: 104/104 plus its exact client build passed.
- Focused governed-map, publication-policy and cumulative Gate 2 checks: 29/29
  passed; the final governed-map/policy subset passed 17/17.
- Exact isolated `maps` client artifact: 2,498 modules transformed.

The compiled loopback browser rehearsal used `localhost:5188`, local fictional
PostgreSQL data and two fictional partner organisations. It confirmed:

1. both partner admins see and edit the same published map;
2. each partner can remove only its own resource;
3. an Organisation Admin cannot change platform-wide public access;
4. a Super Admin can keep discovery, registration and public sign-in restricted;
5. the anonymous governed-map share remains available while discovery is
   restricted;
6. the embed response allows only `https://partner.fixture.example`;
7. the 390 by 844 partner view has no horizontal overflow; and
8. the tested CareAround pages produced no unexpected browser or page errors.

Browser evidence is stored under
`output/playwright/governed-pilot-rehearsal/` as
`gate3-governed-maps-desktop.png`, `gate3-partner-b-mobile.png` and
`gate3-public-share-restricted-mode.png`.

## Release boundary

No commit, push, migration, Cloudflare deployment, production release-stage
change, public-access change, secret access or production-data action occurred.
The checked-in client and Worker defaults remain `off`. Installing this
candidate with stage `off` opens no pilot feature. Advancing both deployments to
`maps` is a later explicit release decision after Gates 1–3 are reviewed.

Gate 4 remains separate. It covers retirement, restoration, notifications,
30-day archival and the final closed-pilot activation rehearsal. General public
reopening remains outside the four-gate goal.
