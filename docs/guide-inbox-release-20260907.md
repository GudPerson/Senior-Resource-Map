# CareAround Guide, inbox and opt-in updates — 2026-09-07 release

## Released

The approved sequence is deployed: reviewed English app guidance and real
public-resource search/navigation; private account and recoverable guest support
reports; staff replies; exact-revision human fix approval with production release
verification; and opt-in saved-schedule, resource-change and saved-search updates.
This is not an open-ended generative care assistant or an autonomous repair agent.

- App: <https://app.carearound.sg/help>
- Updates: Help → Inbox → Updates → Notification preferences.
- Production source, committed and pushed to `main`:
  `c1f1c15d74d6930a8ec5cb698a7b270a43d73544`.
- Worker version: `adb0a5a9-a293-4a5c-9b8d-c0acbfb81cbb`.
- Pages: `ffe1e5c6-c214-4576-ac83-0df99494f702`,
  <https://ffe1e5c6.senior-resource-map.pages.dev>. Functions and routes uploaded.
- [Machine-readable release proof](evidence/guide-inbox-production-release-20260907.json).

## Verified

- Latest server suite: 722 passed. Client suite: 772 passed. Static migration,
  module/dependency and diff checks passed; map-lockdown passed. The final
  feature-enabled production client was built from clean `main`.
- Preview and custom domain match the exact local HTML, release metadata,
  entry JS/CSS/recovery script and map-contract chunks byte-for-byte, with
  correct MIME types. All ten locked versioned map roots are retained.
- Live Guide save/unsave wording, Calendar consequence warning, three real
  Havelock place results and navigation to the actual resource page passed.
- Anonymous private routes return 401. Existing authenticated account/reviewer
  inbox, history, settings and saved-search reads return 200. Account collections
  remained empty and notification categories stayed off.
- Guest recovery UI and report review render correctly. Sending remains blocked
  until the recovery-code acknowledgement; no production report was submitted.
- Saved-search alerts default off and saving requires explicit review consent.
  The empty test form was cancelled; user preferences/searches were unchanged.
- Desktop and 390px mobile Guide/search screens were visually reviewed. No
  horizontal overflow or Guide/search page exceptions were observed.
- The deployed minute scheduler returned `ok`, zero exceptions and zero error
  logs on the final Worker version. This proves idle/opt-out execution, not a
  fabricated live change notification.

## Database and recovery

Approved exact `0003`–`0006` were atomically applied at 04:06:14 UTC to
`br-green-union-ailxs0g3` / `neondb`, with independently verified runtime role
`neondb_owner`. All original 60 table definitions and enums were preserved;
70 public tables and five exact adoption records were independently verified.
This does not assert frozen row counts while real users continued working.

The fresh manual snapshot `production at 2026-09-07 04:01:44 UTC (manual)` is
72.51 MB and retained without expiry. An earlier snapshot was successfully
restored into a separate branch as a non-destructive recovery rehearsal.
Never rerun baseline migrations, forge Drizzle history or restore over production
automatically. For an app rollback, disable the support flags and redeploy a
compatible release; retain the additive tables and private conversations.

## Unchanged and limits

Existing saving, My Maps, Calendar plans/review decisions, auth and resource
visibility logic were not rewritten. The latest Manage Resources changes were
preserved. The primary dirty checkout and generated dependency changes remain
untouched. No CareAround production credential was read or rotated.

Fresh-password login/full partner-import smoke was unavailable; existing-session
checks are explicitly separate. Human proposal/approval/release-verification
and synthetic notification delivery were tested in isolated suites, not with a
fake production issue or fix-available message. The guest Discover sign-in
boundary and authenticated live basemap were observed; an authenticated Detailed
zoom round-trip was not verified in this session. No map regression diagnosis
or map code change is implied by unsuccessful synthetic control attempts.

No device push, email, SMS or WhatsApp notifications are included. Notifications
remain user opt-in. The Guide does not provide medical advice or book services.

## Next step

Run one owner-reviewed pilot report through staff reply, exact-revision approval,
actual fix verification and the user's confirmation. Keep notification choices
opt-in, and include the outstanding fresh-login and map-control UAT in that pilot.

This post-deploy evidence is committed and pushed on the feature branch separately
from production `main`, avoiding an unnecessary docs-only production rebuild.
