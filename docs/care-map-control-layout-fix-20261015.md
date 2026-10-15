# Care Map control placement regression — 15 October 2026

Base: public application `a16c940e9fee34808d73f53569e6372b7f655e49`, accepted paired build `f52daca8fe8e33ede389161473886a807d26cff7`. Candidate: `codex/care-map-control-layout-fix-20261015` in the maintained release checkout. The dirty primary and original personal-place retry candidate remain preserved.

## Symptoms and diagnosis

The user reported a missing desktop North control and mobile North/expand buttons covering zoom out. A fresh read-only owner visit to map358 found North in the DOM but outside the map's clipped edge. The old CSS still absolutely positioned the control at top/left coordinates after its Leaflet corner had moved to bottomright. The earlier desktop replay checked presence without testing reachability. Short mobile maps with multiple pins also expose the existing fit-to-pins button, making the upper rail taller than the one-pin fixture covered.

The ranked checks were obsolete corner positioning, trackpad axis handling, and insufficient vertical space for both control groups. Native Shift-scroll on both axes passed in production and in the replay. The user clarified they were twisting the desktop trackpad without Shift. Desktop rotation remains Shift plus two-finger scrolling; touchscreen rotation remains two-finger twist. No gesture engine change is required. The North tooltip now includes the existing localized gesture instructions in all four locales.

Reproduction: `node tests/browser/care-map-view-controls.mjs --layout-controls-only --out=<evidence-directory>`. With the exact production flag representation and two fictional pins, six of eighteen assertions failed: North was clipped in balanced/beside/full-map desktop layouts and controls collided on three short/compact mobile layouts. The same loop passed all eighteen after the targeted fix.

## Scoped correction

Remove the obsolete top-left CSS override and retain Leaflet's normal bottomright positioning above attribution. Desktop/Export North stays 44px. Owner mobile North and expand/return become fixed 32px controls, North above the toggle, in a separate lane 56px from the right edge. That lane clears zoom even at the compact 220px map height with the full settings/fit/zoom rail; reducing size alone cannot guarantee separation. This explicitly supersedes the earlier owner-mobile 44px requirement at the user's request. Guest 30px toggle placement, source geometry, camera ownership, pan/zoom/rotation handlers, Studio persistence, map notes/images and sharing remain unchanged.

## Verification and release

The final actual-page replay passes 117 assertions with exact production map flags, native trackpad axes, North hit testing/reset and unchanged camera, phone/tablet scales 0.9/1/1.4, two-pin compact layouts, fullscreen touch/pan/header behavior and actual PNG/PDF downloads. No page errors or unexpected writes occurred. Fixture APIs and imagery are fictional; this is distinct from physical Android/PWA assessment.

The original loopback sandbox initialization error, initial fixture flag-type correction, failing reproductions and old source-position assertion are retained. The source assertion was updated to the requested owner lane while retaining guest placement. Quality/build and map-lockdown results, release identities and independent live acceptance are recorded in primary `output/care-map-control-layout-fix-20261015/`.

This is a narrow correction to the previously approved control cleanup. Release follows the existing protected paired workflow and exact-source CI, with no authored Help, credential, schema or binding changes. Require immutable snapshot/receipt, unchanged authored library, normal owner promotion/cleared lock, exact Worker/Pages provenance and complete custom-domain MIME/byte/SHA parity before recording production completion.
