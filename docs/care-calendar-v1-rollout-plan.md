# Care Calendar V1 Rollout Plan

Date: 2026-07-16 (Asia/Singapore)

## Goal

Add a private Care Calendar that turns reviewed schedules for saved activities
into an Upcoming-first planning view. Users can plan an individual session,
create a private calendar item from a My Map note, and see when a saved
activity's structured schedule has changed.

Care Calendar is a planning layer. It is not booking, attendance monitoring,
clinical follow-up, or an external notification service.

## V1 Scope

- One reviewed structured schedule per Offering.
- One-time and weekly recurrence.
- Optional weekly repeat-until date.
- Active or cancelled whole-schedule status.
- Asia/Singapore as the V1 schedule timezone.
- Upcoming agenda for the next 60 days, with a selectable date range.
- Saved scheduled activities appear as passive calendar options.
- A user can promote one occurrence to `Planned`.
- A user can remove a planned occurrence.
- A My Map owner can create a private calendar item from a saved Map note.
- Source revision tracking and an in-app `Schedule changed` state.
- A user can acknowledge the current schedule revision.

## Explicitly Out Of Scope

- Booking, registration completion, payment, referrals, or provider
  confirmation.
- Attendance history or care-compliance monitoring.
- Medication, medical, emergency, or clinical reminders.
- Email, WhatsApp, SMS, browser push, or device push delivery.
- Shared Map calendar exposure or caregiver collaboration.
- Automatic AI or free-text parsing into calendar dates.
- Calendar import, two-way sync, or public calendar feeds.
- Per-occurrence provider exceptions; V1 supports whole-schedule cancellation.

## Product Rules

1. `Saved` means interested; it must not imply attendance.
2. `Planned` is a private user state; it must not imply a confirmed booking.
3. Only reviewed structured schedules are plotted.
4. Existing free-text schedule copy remains canonical public information and is
   preserved for compatibility.
5. A schedule update changes the live saved-schedule layer. Existing planned
   items are not silently rewritten; they show `Needs review` when their source
   revision is older.
6. Cancelled source schedules remain visible as cancelled instead of silently
   disappearing.
7. Calendar data follows the same authenticated visibility result as Saved
   Resources. It must not reveal a currently inaccessible resource.
8. My Map note-linked items are private to the map owner and are never included
   in Shared Map payloads or snapshots.

## Data Design

### Offering schedule fields

Extend `soft_assets` with:

- calendar enabled flag
- start and end timestamps
- recurrence type (`once` or `weekly`)
- weekly day numbers
- optional repeat-until timestamp
- timezone
- status (`active` or `cancelled`)
- monotonic revision
- calendar-specific updated timestamp

The existing `schedule` text field remains unchanged.

### Private user calendar items

Add `user_calendar_items` for:

- planned source occurrences
- My Map note-linked private items
- the user's private title/time snapshot
- source revision for change review

### Change acknowledgment

Add `user_calendar_schedule_states` keyed by user and Offering. It records only
the latest acknowledged revision. Missing state is interpreted against the
favorite creation time so a schedule is not falsely reported as changed when
the user saved it after the latest update.

## API Design

- `GET /api/calendar?from=&to=` returns visible saved occurrences, private
  items, and changed-source summaries for a maximum 180-day range.
- `POST /api/calendar/items` plans a source occurrence or creates a private
  My Map note item.
- `PATCH /api/calendar/items/:id` edits a private item.
- `DELETE /api/calendar/items/:id` removes a private item or plan.
- `POST /api/calendar/sources/:softAssetId/acknowledge` acknowledges the latest
  visible schedule revision.
- `GET /api/calendar/map-notes/:noteId` returns a private, owner-scoped note
  context for the Add-to-calendar handoff.

## UI Design

- Add `My Calendar` to the shared dashboard navigation.
- Add `/dashboard/calendar` inside the protected dashboard shell.
- Default to an accessible Upcoming agenda rather than a dense month grid.
- Separate `Saved activity`, `Planned`, `Map note`, `Changed`, and `Cancelled`
  states visually and in text.
- Add `Plan this session`, `Remove plan`, `View details`, and `Mark reviewed`
  actions.
- Add `Add to calendar` beside a persisted My Map note. It opens the calendar
  creation form through a note-scoped link.
- Keep large-text behavior, keyboard focus, mobile stacking, loading, empty,
  and error states consistent with existing dashboard surfaces.

## Blast Radius And Locked Surfaces

- **My Directory saved assets:** keep the existing favorite payload and cards
  unchanged; the calendar uses a separate authenticated endpoint.
- **Private My Maps:** add only an explicit link beside a persisted note; do not
  change autosave, note visibility, map camera, cards, print, or share.
- **Shared Maps:** no calendar routes or data in shared payloads.
- **Visibility and eligibility:** calendar source resolution reuses current
  saved-resource visibility checks.
- **Managed Offerings:** add structured schedule controls inside the existing
  Schedule step without changing free-text schedule behavior.
- **Notifications:** use only an in-calendar changed state; external delivery
  remains disabled.
- **Schema:** requires explicit production bootstrap before Worker deployment.

## Verification Gates

### Focused

- structured schedule normalization and occurrence expansion tests
- calendar authorization and private note ownership tests
- managed Offering schedule-source checks
- Calendar route/navigation/source checks
- My Map Add-to-calendar link checks

### Full

- full server suite
- full client/source suite
- production-configured client build with all required W01 variables
- `git diff --check`
- pre-deploy production smoke

### Release

1. Apply the explicit production boundary-schema bootstrap.
2. Deploy the Worker and record its version.
3. Deploy the exact validated client build to Pages and record the deployment.
4. Confirm API health.
5. Confirm the production bundle retains PWA and Detailed W01 build markers.
6. Run post-deploy production smoke.
7. Perform focused signed-in Calendar UAT when the production session is
   available.
8. Update the regression ledger and session handoff with exact evidence.

## Rollback

- Client rollback: publish the previous verified Pages build.
- Worker rollback: redeploy the prior Worker version.
- The new nullable columns and private calendar tables can remain dormant.
- Do not delete production calendar data during rollback unless separately
  reviewed and explicitly approved.

## Release Completion

- Status: deployed and verified on 2026-07-16.
- Implementation commit: `46f5d3b33`.
- Production Worker:
  `e50b14ed-b1dd-4838-b10b-2b32ec9574c1`.
- Production Pages:
  `https://6b38360d.senior-resource-map.pages.dev`.
- Production bundle: `assets/index-7RjEQA7D.js`.
- Calendar chunk: `assets/CareCalendarPage-CwW43iXx.js`.
- Full server 411/411, full client/source 417/417, production build, schema
  bootstrap, API health/auth probes, responsive browser QA, and production
  smoke 5/5 passed.
- No real activity schedule or personal calendar item was seeded as part of
  deployment. Controlled internal-data UAT is the next rollout gate.
- Release documentation commit `37ae26c03` was fast-forwarded to and pushed on
  `main`; the exact validated client output was republished after that push.
