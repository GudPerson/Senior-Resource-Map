# Embedded Resource Preview Design QA

## Sources and implementation evidence

- Product reference: `/Users/sweetbuns/Desktop/Screenshot 2026-08-08 at 4.02.09 PM.png`
- Resource-detail reference: `/Users/sweetbuns/Desktop/Screenshot 2026-08-08 at 4.01.44 PM.png`
- Compact implementation: `/Users/sweetbuns/CareAroundSG/output/playwright/map-only-embed-v1/embed-resource-complete-preview-400x520.png`
- Desktop implementation: `/Users/sweetbuns/CareAroundSG/output/playwright/map-only-embed-v1/embed-resource-complete-preview-1280x900.png`

## Viewports and states tested

- 400x520 approved iframe minimum with a selected mapped Place.
- 1280x900 full-browser embed with a selected mapped Place.
- Complete optional-data fixture containing operating hours, website, contact number, Facebook, Instagram, and four open-to-all programmes/services.
- Existing frozen data path without newly added fields remains supported because every enrichment is optional.

## Findings

- The selected Place uses one identity block: logo, name, and address. The former repeated name/category block is absent.
- Public programme/service availability is a compact count pill and does not compete with the resource identity.
- Operating hours use a compact single-line treatment at 400 pixels and retain the labelled detail treatment on larger screens.
- Website and social destinations use recognizable platform icons; the phone number stays visible and tap-to-call; the explicit resource link remains available.
- Website, phone, social, and resource actions share one wrapping action row. Touch targets remain at least 44 pixels and retain visible focus styling.
- The popup uses 4/8-pixel spacing increments and reduced small-screen padding. At 400x520 its `clientHeight` and `scrollHeight` are both 204 pixels, so no requested content is clipped or requires internal scrolling.
- The mobile footer removes its redundant second-line powered-by label when the list-only notice is present; CareAround branding remains in the header and the full label remains at larger widths.
- Leaflet controls no longer overlap the preview close action because the preview is explicitly above the map control layer.
- No P0, P1, or P2 visual, accessibility, or content-hierarchy issue remains in the tested states.

final result: passed
