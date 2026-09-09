# Discovery Saved-Pin Layer Icon Alignment Design QA

- Source UI truth: `/Users/sweetbuns/Desktop/Screenshot 2026-09-09 at 12.31.07 PM.png`
- Source icon truth: `/var/folders/gc/xhshpq5n5xd9pjtvv1x7bry00000gn/T/codex-clipboard-1d8ccd09-aff0-4654-aeec-893539b474ed.png`
- Desktop implementation: `output/playwright/discovery-category-layer-icon-local-desktop-aligned.png`
- Desktop focused region: `output/playwright/discovery-category-layer-icon-desktop-focused.png`
- Desktop open state: `output/playwright/discovery-category-layer-icon-local-desktop-open.png`
- Mobile implementation: `output/playwright/discovery-category-layer-icon-local-mobile-aligned.png`
- Mobile focused region: `output/playwright/discovery-category-layer-icon-mobile-focused.png`
- Mobile open state: `output/playwright/discovery-category-layer-icon-local-mobile-open.png`
- State: fictional signed-in user with three saved, mappable resources

## Viewport and normalization

- Source UI pixels: `548 x 1002`; source icon pixels: `572 x 572`.
- Desktop implementation: `1440 x 900` pixels at a `1440 x 900` CSS viewport,
  `deviceScaleFactor=1`.
- Mobile implementation: `390 x 844` pixels at a `390 x 844` CSS viewport,
  `deviceScaleFactor=1`.
- The source UI is a focused browser crop, so overall page composition was not
  compared at false pixel precision. Full-view captures checked placement and
  responsive behavior; focused `76 x 34` desktop and `68 x 31` mobile captures
  checked the icon scale and adjacent-control alignment.

## Findings

No actionable P0, P1, or P2 mismatch remains.

- Fonts and typography: no type or copy change was introduced; accessible names
  remain `Map settings` and `Map pin categories: All saved pins`.
- Spacing and layout rhythm: both desktop triggers measure `34 x 34` at `y=77`;
  both mobile triggers measure `30 x 30` at `y=161.59375`. The gaps remain eight
  pixels. The category button retains the shared map-control radius and border.
- Colors and visual tokens: the icon continues to use the existing slate layer
  strokes and CareAround teal saved-pin accent against the shared white control.
- Image and icon fidelity: the closest existing Lucide layer, pin, and heart
  icons preserve the supplied stacked-layer/saved-pin meaning without stretching.
  The glyph now measures `30 x 30` in the `34 x 34` desktop button and `26 x 26`
  in the `30 x 30` compact button, giving the requested two-pixel visual buffer.
- Copy and content: the category choices and empty-state copy are unchanged.

## Full-view comparison evidence

The control remains in the top-right map dock beside Map settings, rather than
returning to the busy search area. Desktop and mobile captures show the two
triggers sharing one row and one vertical centre. The mobile viewport has zero
horizontal overflow, and the map, zoom rail, and fullscreen control remain
available.

## Focused region comparison evidence

The initial implementation matched the supplied symbol but rendered the glyph
at `20 x 20`, leaving substantially more white space than the source. It also
allowed the category wrapper's text baseline to lift its `34 x 34` button to
`y=74.453125` while Map settings remained at `y=77`.

The revised implementation expands the glyph to the measured two-pixel inset
and changes only the wrapper alignment. Post-fix measurements show the desktop
buttons at identical `y=77`, `height=34`, and bottom `111`, with the category
glyph at `x=1396`, `y=79`, `30 x 30`. On mobile, both buttons share
`y=161.59375`, `height=30`, and bottom `191.59375`, with the glyph at
`x=350`, `y=163.59375`, `26 x 26`. Their right edge remains aligned with the
map rail to within one rendered pixel.

## Interaction, responsiveness, and accessibility

- The desktop popover and mobile bottom sheet both open from the revised trigger.
- Escape closes each surface and returns focus to the category trigger.
- The `390 x 844` viewport reports zero horizontal overflow.
- The separate browser session reported zero console errors and warnings.
- Fictional authentication and mocked favourites avoided changing real saved data.

## Comparison history

1. Initial comparison: blocked by a P2 scale mismatch and P2 vertical
   misalignment visible in the supplied close-up and confirmed by measurements.
2. Fix: enlarged the responsive glyph from `20 x 20` to `26 x 26`/`30 x 30`
   and vertically centred its wrapper inside the shared map-control dock.
3. Post-fix comparison: the focused desktop/mobile captures and exact DOM
   measurements show the intended small buffer, undistorted proportions, and
   matching button geometry. No further P0/P1/P2 issue was found.

## Automated evidence

- Focused Discovery/map-control coverage: `12/12` passed.
- Locked-map verification: `104/104` passed plus its production-configured map
  build with `2487` modules.
- Complete `npm run verify:quality` gate: passed, covering eight migrations,
  `481` source modules and `1,421` relative-import edges, server `729/729`,
  client `797/797`, four production-environment checks, and the exact
  production-configured client build with `2487` modules.

## Final result

final result: passed
