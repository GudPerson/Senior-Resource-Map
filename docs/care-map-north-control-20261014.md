# Care Map North control — 14 October 2026

Candidate: `codex/care-map-north-control-20261014`, based on accepted application source `087ef4191570572acbad73818b2df512af4a66a9`. The user confirmed the previous Map Notes release works perfectly. The maintained release checkout is current; the dirty primary and lookup-retry candidate are preserved.

## Requested behavior

Remove both 45-degree rotation buttons. On owner mobile maps, place Reset to north directly above the Full map / Back to list button in one lower-right column. Use fixed 44px targets at all text sizes. Desktop and Export View retain one North control at the lower right. Touch twist, pinch, mouse wheel/right-drag and trackpad pinch/Shift-scroll remain available.

`CareMapNorthButton.jsx` isolates the localized button and direction indicator. Mobile uses the existing session-bearing callback to reset to zero, with touch propagation blocked so the button does not initiate fullscreen dismissal. `CareMapGestureControl.jsx` retains all gesture/projection/camera synchronization and removes only the left/right UI actions. Its optional `showNorthControl` flag suppresses the native copy where the mobile column renders North; inactive inline maps remain unable to publish the fullscreen camera. Desktop/Export use the native imperative reset path. These flags are transient React configuration, not saved Studio fields.

The existing mobile expand/return handlers, header seam and map lifecycle stay intact. Guest Shared Map toggle size/placement remains unchanged and has no North button. Static captures/embeds remain opted out; source coordinates, annotations, notes/image persistence/sharing, exports, geometry limits, schema, bindings and credentials are unchanged. Runtime Guide procedures cover all four locales and no longer advertise Rotate left/right. The authored Help library is unchanged.

## Reproduction and evidence

On an owned map, verify no Rotate left/right buttons; rotate through touch, mouse and trackpad, then reset North. At phone/tablet widths and text sizes 0.9/1/1.4, require North centred immediately above expand/return, both controls reachable and North at least 44px. Expand, pan, twist with two native touches, tap North, open the menu and return: the angle resets without changing zoom/centre or dismissing fullscreen; the menu/name row and seam remain intact. Export View must inherit browsing angle, rotate independently, download PNG/PDF at its angle and return to the original browsing pose.

Local quality passes compiler17/CMS73/server1,235/client1,030/environment5/static/build; locked-map112/build passes. Final actual-owner-page replay passes 78 cases across desktop, phone/tablet and three text sizes, with native pan/two-finger twist/tap, wheel/trackpad input and actual downloads. The latest notes navigation replay passes all 18. All browser data/APIs/imagery are fictional/intercepted; no physical Android PWA or production assessment is claimed.

Retained earlier failures: an existing source assertion failed before guest 30px toggle styling was retained; the first complete replay passed the gesture/export contracts but found four owner touch targets below 44px at text scale0.9. Fixed pixel dimensions resolved those four failures. Initial72 and corrected72 reports remain distinct from the final78 replay.

Evidence: primary `output/care-map-north-control-20261014/`. Commit/push/deployment require explicit authorization and the existing protected paired workflow: exact source CI, unchanged owner authored library, all 44 bindings/runtime preserved, immutable snapshot/receipt, normal owner promotion/cleared lock and independent Worker/Pages provenance plus complete custom-domain byte/MIME/SHA parity. No real map/note/image write is needed for acceptance.

The user explicitly approved commit, push and deployment of both client and server on 15 October 2026. The protected paired publication and independent acceptance checks are authorized. Final release identities and production evidence will be recorded in the output handoff after acceptance.
