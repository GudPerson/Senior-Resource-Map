# Care Map gesture integration — 10 October 2026

Approved: integrate the accepted local pinch/rotation prototype, including mouse
and trackpad input, then validate, commit, push and deploy.

Baseline: current production `eb2b470a`; accepted prototype branch
`codex/care-map-gestures-prototype-20261010` at `7aae7464`. The dirty primary
checkout and prototype branch remain preserved.

## Architecture and blast radius

DirectoryMap is shared by owner browsing, print/export, shared maps and embeds.
Its Leaflet camera must retain geographic anchors and existing fullscreen focus
acknowledgement. The reviewed pinned rotation extension modifies Leaflet methods
globally; rotation therefore stays explicitly opt-in. Unrotated maps require
regression checks, including shared/embed and north-up export captures.

Enable gestures only for owner Care Map browsing, with a small modular control
and temporary per-map/per-view bearing. Saved viewport and annotation schemas,
resource identities and coordinates remain unchanged. Retained mobile maps
follow the visible map without publishing bearing or camera back during live
gestures. North reset changes only bearing; resource focus/recenter remain
explicit actions. Pause rotation and use north-up during annotation editing,
personal-place placement and exports.

Preserve the accepted prototype fixes: custom geographic SVG/image panes rotate
with the surface while marker/text siblings remain upright; refresh SVG geometry
after live zoom; viewport selection follows bearing; publish camera/bearing after
gestures settle; disable decorative rotation inertia. Shift-scroll uses both
axes with the accepted sensitivity. Normal wheel and Ctrl-wheel pinch zoom the
map without page zoom. Provide accessible left/right rotation and North controls.

## Required checks and release

Use the approved KML's 3,266 exact coordinates, multipart rings and holes, private
images, resource pins and the 20,000-point sample. Verify native touch, mouse,
wheel traces, combined gestures, cancellation, repeated panning, focus, fullscreen
reopen, editing/placement pause, Default/Gray Detailed alignment, resize and
north-up PNG/PDF capture. Use fictional APIs for mutations. Keep automated,
physical-device and production proof separate.

Update four locales and runtime Guide evidence while preserving the approved
authored Help library. Run quality, client build, server/client suites, locked-map
gates and scoped browser checks. Preserve prior failed timing and tiny-hole
observations. Review the final patch before pushing. Deploy through the normal
protected publisher with the latest private library; independently verify exact
public artifacts, publication/provenance and unchanged Worker bindings. Perform
read-only signed-in production gesture checks and record the remaining physical
Android PWA acceptance step.
