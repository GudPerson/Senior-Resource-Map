# Closed ICCP pilot Gate 4 — lifecycle and activation boundary

Date: 2026-09-15 (Asia/Singapore)
Validation checkpoint: local and inactive; commit, push, deploy and activation
had not yet occurred
Stage: `lifecycle`

## Outcome

Gate 4 is a separate cumulative release candidate for the Governed Care Map
lifecycle. It adds no new production activation. The existing cumulative
implementation already meets the reviewed lifecycle design, so this gate
preserves the Gate 3 code and supplies an independent lifecycle rehearsal and
evidence boundary.

A current steward of any included resource can request retirement with a
reason. Retirement changes the map to `retirement_pending`, freezes ordinary
map editing, records the actor and reason, notifies current resource
participants and immediately makes the governed share and embed unavailable to
anonymous visitors. It does not revoke or replace the publication token during
the 30-day recovery window.

Any current included-resource steward can restore the map with a reason before
the deadline. Restoration rechecks the current Gate 2 permissions for the
share and, when configured, embed uses. It rebuilds the publication from
current resources and provider permissions and resumes the original share
token. Missing, expired or withdrawn permission blocks restoration.

After the deadline, the lifecycle-only scheduled sweep archives each due map,
revokes its publication and writes the participant notifications and audit
entry atomically. A repeated sweep does no additional work. Personal My Maps
and their existing direct share links remain separate from this lifecycle.

## Gate 2 security remediation

The cumulative candidate closes the reviewed Gate 2 ownership race before any
release. Claim resubmission now serializes on the underlying resource and
rechecks global claim/link availability inside the atomic batch. Owner
verification performs the same post-lock cross-organisation link check before
creating the link, Owner membership, verification state and audit record.
Stale resubmission revisions are rejected before the batch and cannot leave a
misleading audit event. The final controlled race produces one successful
verification, one `409`, and exactly one active link, Owner, verified claim and
verification audit record.

Publication approval also locks and validates the selected organisation
agreement inside the atomic batch. Effective and expiry dates are compared by
PostgreSQL, preventing a Singapore/UTC conversion from accepting an expired
agreement or writing a publication-approval audit for a rejected action.

## Verification

- Formal `npm run verify:quality`: exit code 0.
- Static gate: 11 ordered migrations, 509 source modules, 1,538 relative import
  edges, no cycles and a clean diff check.
- Full server suite: 780/780 passed.
- Focused resource-claim, publication-policy and atomic-write checks: 17/17
  passed.
- Full client suite: 810/810 plus 5/5 release-environment checks passed.
- Map lockdown: 104/104 plus its exact client build passed.
- Focused lifecycle, access, publication-policy and embed suite: 27/27 passed.
- Exact isolated `lifecycle` client artifact: 2,498 modules transformed.
- The server-side eight-phase fictional pilot rehearsal passed with no
  production connection. It covered retirement, permission-blocked restore,
  safe restore with the same token, closed public access, audited recovery and
  idempotent archival after the 30-day deadline.

The compiled loopback browser rehearsal used `localhost:5183`, local fictional
PostgreSQL data and two fictional partner organisations. It confirmed:

1. Partner A can submit a reasoned retirement request;
2. the governed share API, browser route and embed stop immediately;
3. Partner B receives the retirement notification with actor and reason;
4. Partner B can restore with a reason;
5. the same share token and exact-origin embed resume after restoration;
6. the embed permits only `https://partner.fixture.example` and sends no
   `X-Frame-Options` header;
7. the 390 by 844 pending and restored views have a 390-pixel scroll width; and
8. the tested CareAround pages produced zero browser or page errors.

Browser evidence is stored under
`output/playwright/governed-pilot-rehearsal/` as
`gate4-before-retirement-desktop.png`,
`gate4-retirement-pending-desktop.png`, `gate4-public-suspended.png`,
`gate4-partner-notification-mobile.png` and `gate4-restored-mobile.png`.

The first viewport capture used an unsupported Playwright option and was
discarded during visual review. The final evidence uses Playwright's `viewport`
option and asserts the actual 390-pixel client and scroll widths. Token
continuity is checked through the authenticated map record and the original
public URL; the public-safe payload is not expected to expose the token.

## Release boundary

No commit, push, migration, Cloudflare deployment, production release-stage
change, public-access change, secret access or production-data action occurred.
The checked-in client and Worker defaults remain `off`. Installing this
candidate with stage `off` opens no pilot feature.

All four gates now have separate local release candidates. The overall goal
remains active because Gate 4 has not passed production release checks or a
closed-pilot UAT with named, approved pilot organisations. A later release
decision must keep the client and Worker stage aligned and keep discovery,
public registration and public sign-in restricted. General public reopening is
outside this goal.
