# My Map Unmapped Resource Layout Design

Date: 2026-05-31

## Purpose

Make resources that are not shown on the map feel like normal My Map cards instead of a large separate section. The refinement applies to My Map and shared map directory views without changing map pins, clustering, note visibility, saved resources, sharing permissions, ranking, sorting, or data access.

## Current Behavior

Mapped resources are shown in left and right card lanes on desktop, with the map and Map notes in the middle. Resources that cannot be shown on the map are rendered later as a full-width section with a large heading, explanatory copy, and heavier spacing. On mobile, the same section appears after mapped cards and takes more space than normal resource cards.

## Approved Behavior

### Card Style

- List-only resources use compact cards that align visually with normal My Map asset cards.
- They do not receive map pin numbers.
- They use a small marker such as `List only` or `Not shown on map`.
- Large explanatory copy is removed from the default view.
- Existing note badges and allowed actions remain available.

### Mobile Placement

Mobile remains a single-column flow:

1. Map
2. Map notes
3. Mapped resources
4. List-only resources

List-only resources appear after mapped resources as compact cards.

### Desktop Placement

Mapped resources keep the existing balanced left/right distribution and pin-number order.

When the mapped resource list is not dense:

- List-only resources appear after the mapped cards inside the same left/right card lanes.
- Each list-only card is placed into the shorter side lane, alternating as needed.
- Mapped cards always remain first in each lane.

When the mapped resource list is dense:

- Mapped resources stay in the left/right lanes.
- List-only resources move into a compact section under Map notes.
- The compact section aligns to the map/notes column width.

Use a stable count-based density rule rather than live DOM height measurement. This avoids jumpy layout behavior across mobile, tablet, and desktop.

## Non-Goals

- No map pin numbering change.
- No clustering change.
- No map zoom/framing change.
- No saved resource or note permission change.
- No shared-map visibility change.
- No sorting or ranking change.
- No production auth, Gmail, email, GudAuth, or secret changes.

## Acceptance Criteria

- Mobile shows mapped cards first and compact list-only cards after them.
- Desktop with few mapped resources distributes compact list-only cards into the left/right card lanes after mapped cards.
- Desktop with many mapped resources shows list-only cards under Map notes, aligned to the map width.
- List-only resources never look like numbered map pins.
- Existing map notes, note badges, remove actions, sharing behavior, and detail navigation continue to work.
- Shared maps and private My Maps remain in sync for mapped and list-only resource counts.

## Verification Plan

- Add or update focused presentation/layout tests for list-only placement.
- Run relevant client tests for directory presentation and shared map directory UI.
- Run `npm run build:client`.
- Run `git diff --check`.
- Update `docs/regression-ledger.md` with the stabilized My Map/shared map behavior and verification results.
