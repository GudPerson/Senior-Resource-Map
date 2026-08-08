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

---

# Design QA: owner mobile focus-card surface refinement

- Source visual truth: `/Users/sweetbuns/Downloads/WhatsApp Image 2026-08-08 at 22.54.06.jpeg`
- Requested delta: remove the category badge/label above the focused resource and remove the tinted outer tray so the resource preview card becomes the visible surface.
- Browser-rendered implementation evidence: `/Users/sweetbuns/CareAroundSG/output/design-qa/owner-mobile-focus-card-local-auth-blocked.png`
- Target viewport: 390 × 844 CSS pixels.
- Source pixels: 945 × 2048. The source is a higher-density Android capture and was assessed as a mobile reference, not resampled for pixel comparison.
- Implementation pixels: 390 × 844 at the browser viewport's native capture density.
- Target state: signed-in owner My Map with one selected mapped resource in the mobile focus tray.
- Captured implementation state: local sign-in screen. The protected owner map redirected to `/login`, so the requested focused-resource state could not be rendered without a new authentication action.

## Full-view comparison evidence

The source clearly shows the redundant category header and tinted rounded tray around the complete resource preview. The implementation capture does not reach the owner map, so a visual before/after comparison of the requested state is unavailable. Source-level regression coverage confirms that the complete-preview variant now omits `DirectoryCategoryPill`, uses a visually neutral outer section, and stretches a single compact resource card to the available tray width, but this is not a substitute for rendered visual evidence.

## Focused-region comparison evidence

Blocked for the same authentication reason: the local browser could not render the mobile focus-card region. No typography, spacing, token, asset, or copy fidelity claim is made from the sign-in capture.

## Findings

- [P2] Protected focus-card state is not visually verified.
  - Location: owner My Map mobile focus tray, normal and full-map modes.
  - Evidence: the source visual contains the target region, while the local implementation capture is the sign-in screen.
  - Impact: automated source and build checks cannot rule out a responsive spacing or overflow mismatch in the final rendered state.
  - Fix: complete authenticated mobile UAT at 390 × 844, select a mapped resource, and capture both normal and full-map focus-card states.

## Required fidelity surfaces

- Fonts and typography: blocked in the target state.
- Spacing and layout rhythm: code contract updated; rendered comparison blocked.
- Colors and visual tokens: the complete-preview wrapper is neutral by contract; rendered comparison blocked.
- Image quality and asset fidelity: existing resource logo behavior is unchanged; rendered comparison blocked.
- Copy and content: the category label is removed by contract; resource-preview copy is unchanged; rendered comparison blocked.

## Comparison history

- Initial comparison: blocked because the protected local owner route redirected to sign-in. No visual fix iteration was possible without an authenticated target-state capture.

## Implementation checklist

- Authenticate the local owner route through the normal supported flow.
- Select a mapped resource at 390 × 844.
- Confirm there is no category badge/label and no tinted outer tray.
- Confirm the resource preview card spans the focus area without horizontal overflow.
- Repeat in full-map mode and check note and `Open resource` actions.

final result: blocked
