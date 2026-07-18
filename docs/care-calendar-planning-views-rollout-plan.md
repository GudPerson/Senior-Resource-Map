# Care Calendar Planning Views Rollout Plan

Date: 2026-07-18 (Asia/Singapore)

## Outcome

Care Calendar will separate three user jobs without changing the underlying
meaning of saved resources or bookings:

- **My Plans** is an upcoming agenda of exact sessions the user has starred,
  plus private My Map calendar notes.
- **Calendar** shows saved activity schedules and personal items in accessible
  Day, Week, and Month views so the user can compare dates before starring a
  session.
- **Updates** holds changed, cancelled, or removed starred sessions until the
  user reviews the latest schedule revision.

Starring a session remains a private planning intention. It is not a booking,
registration, attendance record, capacity reservation, or organiser
notification.

## State Rules

1. Saving an Offering keeps it in My Directory and allows its reviewed active
   schedules to appear in Calendar.
2. Starring one occurrence creates the existing private `planned_session`
   item for that exact schedule row and start time.
3. My Plans shows upcoming starred occurrences and private map-note items.
4. A planned item leaves Upcoming after its end. When no end exists, it leaves
   after the end of its Singapore calendar day. It remains available in a
   collapsed 30-day Past and archived section; it is not automatically deleted.
5. A source revision change never silently moves, deletes, or restars a
   personal plan.
6. Changed or cancelled starred items remain visibly labelled until the user
   acknowledges the latest Offering revision.
7. Acknowledgement records only that the update was seen. It does not accept a
   replacement time.
8. View new sessions navigates to current active occurrences for the same
   Offering. The user explicitly stars a replacement after checking the
   calendar.
9. When the current schedule does not provide a reliable one-to-one
   replacement, CareAround shows several upcoming options and does not guess.
10. Conflict guidance compares the proposed session with the user's starred
    sessions and private calendar items. Saved-but-unstarred activities are not
    treated as conflicts.

## User Experience

### My Plans

- Default Care Calendar section.
- Uses the approved Upcoming agenda composition as its visual reference.
- Groups upcoming plans by Singapore date.
- Uses `Add to My Plans` and `In My Plans` star controls.
- Keeps Past and archived plans collapsed below Upcoming.
- Shows compact counts and links for schedule updates and saved activities
  without schedules instead of a long competing sidebar list.

### Calendar

- Day retains the existing hourly rail and seven-day navigator.
- Week uses seven responsive day columns on desktop and stacked days on small
  screens.
- Month uses a conventional Sunday-first grid on desktop and a dated agenda on
  small screens.
- Month cells summarize a bounded number of items and expose a clear path to
  the Day view when density is higher.
- Day, Week, and Month share the same selected Singapore date and event action
  contract.

### Updates

- Groups affected personal plans by Offering.
- Shows the old personal plan as changed or cancelled instead of silently
  removing it.
- Offers View new sessions when current active options exist.
- Offers Acknowledge update as a separate action.
- A single Offering-level acknowledgement is shown only after all affected
  starred sessions for that Offering are summarized together.

## API And Performance

- Keep the existing authenticated `GET /api/calendar` route and 180-day range
  cap.
- Add an optional `scope=plans` query. It returns the same response contract
  but expands occurrences only for Offerings referenced by personal planned
  items in the requested range. This keeps the broad My Plans and Updates
  reads bounded under Cloudflare limits.
- The default scope remains unchanged for Day, Week, and Month.
- Enrich personal planned-item responses with current source revision,
  current-source change state, address, and detail path. Do not expose new
  private data.
- Add no schema, auth, permission, visibility, eligibility, notification, or
  booking changes.

## Blast Radius

Touched:

- Care Calendar client page and calendar-only components/helpers.
- Calendar response serialization and occurrence-expansion selection.
- Calendar translations and regression coverage.

Locked and unchanged:

- Saved Resources hydration and favorite payloads.
- Offering schedule publication, immutable revisions, and compare-and-swap
  protection.
- My Map note ownership and Shared Map privacy.
- Discover ranking, visibility, eligibility, and distance behavior.
- Authentication, GudAuth, email, WhatsApp, secrets, booking, availability,
  and external notifications.

## Verification Gates

- Focused Singapore Day/Week/Month range and layout-helper tests.
- Focused My Plans expiry/history, star, conflict, replacement, and Updates
  state tests.
- Focused calendar API scope and source-revision serialization tests.
- Existing calendar schedule, multi-session, auth, My Map privacy, and
  schedule-publish guard coverage.
- Full server suite and full client/source suite.
- Exact production-configured client build with all four required map values.
- `git diff --check`, secret review, and production smoke.
- Browser visual QA at desktop and 390 x 844, including section navigation,
  Day/Week/Month navigation, star/unstar, conflict confirmation, Updates, text
  scaling/overflow, and console health.

## Release Order

1. Validate on `codex/care-calendar-planning-views`.
2. Record the new locked behavior in the regression ledger.
3. Commit and push the feature branch.
4. Fast-forward clean pushed `main` after all gates pass.
5. Deploy the Worker first, then the exact validated Pages build.
6. Verify API health, custom-domain bundles, production smoke, and signed-in
   Care Calendar behavior.

