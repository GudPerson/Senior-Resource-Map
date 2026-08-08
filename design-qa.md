# Embedded Resource Preview Design QA

## WWW and label refinement (production release)

- Icon reference: `/var/folders/gc/xhshpq5n5xd9pjtvv1x7bry00000gn/T/codex-clipboard-067c890d-8dc7-4ff9-a0a7-711a82db8342.png`
- 400x520 implementation: `/Users/sweetbuns/CareAroundSG/output/chrome/embed-preview-www-refinement/embed-preview-www-400x520.png`
- Combined comparison input: `/Users/sweetbuns/CareAroundSG/output/chrome/embed-preview-www-refinement/reference-comparison.png`
- Production 400x520 verification: `/Users/sweetbuns/CareAroundSG/output/release-logs/embed-www-production-400x520.png`
- The Website action follows the supplied globe-plus-WWW concept using the existing Lucide globe icon and a compact `WWW` wordmark. The watermarked stock reference itself is not shipped.
- The mark stays inside a 52x44-pixel platform-styled action, preserving the 44-pixel touch target, focus treatment, and the existing CareAround palette.
- The availability pill now reads `4 Programmes / Services`; supported translations use the same slash construction.
- At the 400x520 minimum, Website, phone, Facebook, Instagram, and `Open resource` remain on one row. The selected-resource preview reports `clientHeight: 204` and `scrollHeight: 204`, so there is no clipping or internal scroll.
- The supplied source is an icon reference rather than a full-screen layout. The comparison therefore checks the requested globe-plus-WWW visual language inside the existing approved preview state instead of treating the stock image as a screen to clone.
- Production Chrome verification on `https://app.carearound.sg/embed/maps/LiHr0nVxXnroOQ1oXaD61MqH5mRv9wiV` confirms the requested mark and slash label, a 204-pixel card with equal client and scroll heights, and one aligned action row at 400x520.

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
