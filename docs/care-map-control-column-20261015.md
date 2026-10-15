# Care Map right-aligned mobile controls — 15 October 2026

Base: accepted application `8be501f1b3b155ff7fea27fd77581c0280a129a3`. Follow-up branch: `codex/care-map-control-column-20261015`, in the maintained release checkout. Preserve the dirty primary and original personal-place retry candidate.

## Request and blast radius

The user wants North and expand/return aligned with the existing right-hand settings, fit and zoom controls. This supersedes the separate lane introduced in the preceding correction; the requested compact 32px pair and North-above-toggle order remain. They also asked whether a desktop trackpad can rotate by twisting without Shift.

Only owner mobile control presentation changes. The existing `DirectoryMap` frame has an explicit normal/fullscreen height and already accepts `surfaceOverlay`. Render the existing actions through that slot, preserving its prior contents, and scope a named size container to this frame. Right/bottom offsets are fixed at 12px. Below 260px frame height, reduce vertical gaps and hide only the numeric zoom counter; settings, fit, plus/minus, North and toggle remain available in one column. Camera callbacks, frame dimensions, geographic projection, touch/pinch/rotation engine, Studio state, annotations, notes/images, export and guest controls remain intact. Desktop/Export North keeps its existing 44px presentation.

No server, schema, binding, credential, authored Help, translation, visibility or privacy change is required. Existing four-language labels are reused.

## Desktop trackpad feasibility

A genuine trackpad twist requires rotation information from the browser. Apple's [GestureEvent documentation](https://developer.apple.com/documentation/webkitjs/gestureevent) exposes rotation in degrees. The [browser compatibility source](https://github.com/mdn/browser-compat-data/blob/main/api/GestureEvent.json), checked on 15 October 2026, records GestureEvent/rotation support in Safari and no support in Chrome, Edge or Firefox. WebKit's [input guidance](https://webkit.org/blog/10247/new-webkit-features-in-safari-13-1/) also explains that trackpads do not deliver touchscreen touch events.

For the user's desktop Chrome setup, do not infer a twist from wheel deltas: those represent scrolling/pinch, not the two finger positions or angle. Such a heuristic would interfere with working zoom and would not preserve accurate input. Keep the existing Shift-scroll/right-drag controls and ordinary pinch/scroll zoom. Safari-specific native gesture support could be implemented and device-tested separately; this change does not claim to add it. Touchscreen two-finger rotation is unchanged.

## Reproduction and acceptance

Use the actual owner-page browser fixture with production controls and two fictional pins. Require both actions' right edge to align within 2px of zoom, fixed 32px targets, North above toggle, hit-test reachability, no overlap with existing controls and containment within the map. Cover short/compact phones, tablet, normal/fullscreen, text scales 0.9/1/1.4, and the wider tablet breakpoint which uses desktop controls. Preserve desktop North reset and camera, native Shift-wheel on both axes, fullscreen header/menu, touch pan/pinch/rotation, separate Export angle and actual PNG/PDF downloads.

The first enhanced loop failed all 18 phone/tablet alignment assertions against the previous released source while existing gestures remained green. The initial loopback sandbox launch failure is retained separately. The first corrected loop passed 39 checks. An additional landscape-tablet scenario initially expected a mobile column above the application's desktop breakpoint; that fixture classification failure is retained and corrected to test the desktop layout. The complete replay then passed 121 cases without browser errors or unexpected writes. It uses fictional/intercepted data and synthetic imagery, not physical Android/PWA UAT.

Initial full quality failed five legacy source-harness checks after the shared action renderer was extracted. The camera harness did not parse new inline JSX in clone arguments. Hoisting the identical surface overlays out of those argument objects and supplying empty visual slots to that camera-only test preserves its existing camera assertions; close-action source expectations were updated to the shared toggle. The initial failures and corrected checks remain distinct in the evidence bundle.

Final quality passes compiler17/CMS73/server1,235/client1,030/environment5/static checks and the production client build. Locked-map checks pass112. The final-source browser rerun also passes121 with no errors/writes. Source/evidence hashes and subsequent protected publication acceptance are recorded in primary `output/care-map-control-column-20261015/`. Follow the existing protected paired workflow and independently verify the immutable receipt/snapshot, exact-source CI, Worker/Pages provenance, all-artifact MIME/byte/SHA parity, unchanged authored content/bindings and cleared publication lock before declaring deployment complete.
