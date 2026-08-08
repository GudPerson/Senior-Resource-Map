# Care Calendar Planning Views Design QA

## Comparison target

- Source visual truth:
  `/Users/sweetbuns/Desktop/Screenshot 2026-07-17 at 9.22.13 AM.png`
- Browser-rendered production My Plans:
  `/Users/sweetbuns/CareAroundSG/output/care-calendar-planning-views/production-desktop-my-plans.png`
- Browser-rendered production Week:
  `/Users/sweetbuns/CareAroundSG/output/care-calendar-planning-views/production-desktop-week.png`
- Browser-rendered production Month:
  `/Users/sweetbuns/CareAroundSG/output/care-calendar-planning-views/production-desktop-month.png`
- Browser-rendered production Updates:
  `/Users/sweetbuns/CareAroundSG/output/care-calendar-planning-views/production-desktop-updates.png`
- Mobile production My Plans:
  `/Users/sweetbuns/CareAroundSG/output/care-calendar-planning-views/production-mobile-my-plans-390x844.png`
- Desktop viewport: live signed-in Chrome production session.
- Mobile viewport: 390 x 844.
- State: signed-in GudPerson on `https://app.carearound.sg/dashboard/calendar`
  after the production Pages and Worker deployment.

## Findings

No actionable P0, P1, or P2 findings remain.

- P3: The previous right-rail saved-without-schedule list is now summarized as
  a compact helper panel. This is intentional for the new structure: My Plans
  should stay focused on starred sessions and private notes, while unscheduled
  saved resources route back to My Directory.
- P3: Updates shows an empty state when there are no changed or cancelled
  planned sessions to acknowledge. This is the intended safe default and avoids
  inventing schedule movement when the user has not explicitly accepted a new
  session.

## Required fidelity surfaces

- Fonts and typography: passed. The implementation keeps the existing
  CareAround product type stack, section labels, older-adult-friendly body
  sizing, and high-contrast button hierarchy.
- Spacing and layout rhythm: passed. The hero, section tabs, Day/Week/Month
  controls, plan cards, calendar grids, and compact helper rail use the existing
  dashboard spacing system. The mobile capture has no horizontal overflow.
- Colors and visual tokens: passed. Existing teal, slate, border, private-note
  violet, warning amber, danger red, radius, and shadow tokens are preserved.
- Image quality and asset fidelity: passed. No new raster assets were needed.
  The unchanged production shell keeps the existing logo and Lucide icon
  system.
- Copy and content: passed. My Plans, Calendar, Updates, private map note,
  saved-without-schedule, plan/removal, and schedule-change acknowledgement
  semantics are visible and consistent with the approved product direction.

## Interaction and responsive evidence

- My Plans is available as the default planning surface and shows only starred
  sessions plus private My Map calendar notes.
- Calendar switches between Day, Week, and Month views on production.
- Updates opens separately and shows the up-to-date empty state when there are
  no schedule changes awaiting acknowledgement.
- Calendar URLs preserve `section`, `view`, and `date`, so deep links and
  refreshes return to the same planning context.
- Mobile 390 x 844 production capture showed the new tabs and no horizontal
  overflow.
- Live production browser inspection confirmed the route contains
  `Plan your care activities`, `My Plans`, `Calendar`, `Updates`, and
  `Day / Week / Month`.

## Comparison history

1. The previous Day View release intentionally deferred Week and Month behind
   disabled controls. This release completes that second phase and promotes the
   calendar into three user jobs: My Plans, Calendar, and Updates.
2. Production desktop QA captured My Plans, Week, Month, and Updates after the
   Pages deployment.
3. Production mobile QA captured the My Plans route at 390 x 844 and confirmed
   no horizontal overflow.
4. Production smoke passed 6/6 after deployment.

## Implementation checklist

- [x] Make My Plans the bookmark/star-style personal planning list.
- [x] Keep starred sessions separate from broadly saved-but-unplanned
      schedules.
- [x] Add live Day, Week, and Month calendar views.
- [x] Keep schedule-change acknowledgement in Updates.
- [x] Prevent acknowledgement from automatically moving, deleting, or re-starring
      a user's plan.
- [x] Preserve private My Map note privacy and Shared Map separation.
- [x] Verify desktop and mobile production layouts in the browser.
- [x] Run production smoke after deploy.

## Follow-up polish

- Add a controlled internal test Offering to exercise changed, cancelled, and
  replacement-session Updates without using a real public programme.
- Consider an optional future conflict helper that compares only current My
  Plans and private notes, not every saved resource.

final result: passed
