# Discovery Saved-Pin Layer Design QA

- Source visual truth: `/var/folders/gc/xhshpq5n5xd9pjtvv1x7bry00000gn/T/codex-clipboard-e6aa63f5-a7db-46a2-9b21-cfb4441bce7b.png`
- Source pixels: `572 x 572`
- Desktop implementation: `.playwright-cli/page-2026-09-09T03-15-56-791Z.png` at `1920 x 1080`
- Mobile populated state: `.playwright-cli/page-2026-09-09T03-12-41-419Z.png` at `390 x 844`
- Mobile empty state: `.playwright-cli/page-2026-09-09T03-14-54-255Z.png` at `390 x 844`
- Side-by-side comparison: `.playwright-cli/page-2026-09-09T03-18-01-392Z.png`
- State: saved map-pin category control, populated and no-saved-pin variants

## Full-view comparison evidence

PASS. The supplied visual's stacked-layers plus saved-pin meaning is preserved,
while the artwork is normalized to the existing CareAround map-control system:
`34 x 34` on desktop, `30 x 30` on compact controls, teal active treatment, and
the same rounded white surface as Map settings. The full desktop capture confirms
the control sits in the map dock instead of the already-busy search panel.

## Focused region comparison evidence

PASS. At `1920 x 1080`, Map settings occupies `x=1832..1866` and the category
control occupies `x=1874..1908`, leaving an 8-pixel gap with no overlap. The
popover is `320 x 354`, right-aligned to the trigger at `x=1588..1908`, and stays
inside the viewport. At `390 x 844`, the populated bottom sheet is `358 x 240`
within 16-pixel side margins and has no horizontal overflow. The empty state uses
the same sheet and the requested `No saved pins to filter yet.` copy.

## Interaction and accessibility evidence

- One category showed one saved place; adding a second showed the two-category
  union; `All saved pins` restored all three fictional saved pins.
- The Discovery result list remained `Showing 20 of 3481 results` throughout the
  desktop layer changes.
- Escape closes the desktop popover and mobile sheet and returns focus to the
  category-layer trigger. Map settings remains independently operable.
- Desktop and mobile document widths matched their viewports; no horizontal
  overflow was introduced.
- The browser fixture used a separate Chrome session, fictional authentication,
  and mocked saved-resource responses. It did not alter a real user's saved data.
- The only console errors encountered were OneMap's expected localhost CORS
  rejection while exercising the fictional home-postal empty-state fixture; the
  populated no-postal fixture had no application errors.

## Comparison history

- Initial pass: blocked before browser permission was available.
- Approved pass: captured populated desktop, populated mobile, and empty mobile
  states in a separate browser session.
- Post-test refinement: routed mobile sheet dismissal through the same
  close-and-refocus path as desktop; the repeated Escape check then restored the
  trigger focus.

## Automated evidence

- Saved-pin layer and source-contract checks: `8/8` passed after the focus patch.
- Earlier focused Discovery/map/i18n coverage: `19/19` passed.
- Earlier full client tests: `797/797` plus `4/4` production-environment checks.
- Earlier locked-map verification: `104/104` plus its production map build.
- Earlier production-configured client build: passed with `2487` modules.

## Final result

final result: pass
