# Care Map Map Notes navigation — 14 October 2026

Candidate branch: `codex/care-map-note-navigation-20261014`. Base: accepted public source `5459d7f377c7c05ebc50d328fd86ec9170995323`, freshly matched to `origin/main`. Work uses the maintained clean release checkout under `output/care-map-labels-release-20261007`; the dirty primary and original lookup-retry candidate are preserved.

## Behavior and integration

The selected-pin preview has a labelled, at least 44px Map notes action for every owned resource, including personal places and resources without existing notes. It uses the exact typed resource displayed on the card and stops the card's focus action from running. Both normal and fullscreen mobile previews use the same extension seam; the shared preview retains its prior note-presence rules.

Map Notes search matches names, addresses, postal codes, categories and map context, preserving resource order and identities. Search remains when Back returns from an editor and resets when the notes dialog closes. Recent pins shows the five most recently selected unique pins during the current map visit. Multi-resource pins offer each resource separately. History stores only pin identities in component memory, scopes them by account/map/route and resolves against current allowed rows; removal cannot resurrect stale resource data. Leaving/reloading the map resets history. No browser storage, server activity history or public payload is added.

`MapNotesResourceList.jsx` and `mapNotesNavigation.js` isolate list presentation/search/history helpers. All five existing layout branches pass the recent-pin choices. The text editor, save/flush/retry behavior, image gallery, geometry, pin positions, camera, gestures, exports, sharing and storage APIs retain their contracts. UI labels and runtime Guide instructions cover English, Chinese, Malay and Tamil. The authored Help library is unchanged.

## Acceptance and verification

Open an owned map with a long resource list. Select a personal-place pin and use the preview Map notes action: its precise note must open even when empty. Repeat for a saved resource, a pin with several resources, normal map and Full map. Select seven distinct pins, open the notes list and require only the newest five, in descending recency order. Search name/address/postal/category, clear the search, enter an unmatched query and require an empty-result message. Open a result and return: keep the query. Close/reload: clear query/history. Changes of account/map and removed rows must not reuse stale choices.

Recheck personal-place text Close/Back, reload persistence, failed-save Retry, image upload preserving the active draft and exact image downloads. Recheck saved-resource notes and explicit image sharing. Shared-map search must only operate on its existing visible note rows; owner recents must not appear there.

Evidence is under `output/care-map-note-navigation-20261014/` in the primary workspace. Browser replay uses actual owner components and Leaflet markers, fictional maps/accounts, intercepted HTTP APIs and synthetic images. It is separate from physical Android PWA/tablet UAT or production user-data writes. Initial browser failures (incorrect existing Back label, missing recent prop wiring) and two intermediate JSX extraction/build failures are retained, alongside the corrected attempts. An initial Guide negative test also caught a too-broad navigation intent, corrected without changing existing image instructions.

Release remains a separate protected paired publication with exact source CI, unchanged authored owner content, existing Worker bindings, immutable release receipt, independently verified Worker source and Pages byte/MIME/SHA parity. No schema, binding or secret change is required. Generic credentialed smoke is not claimed.

The user explicitly authorized this feature’s commit, push and protected paired client/server deployment on 14 October 2026. Preserve the authored Help snapshot and bindings; independently accept exact-source CI, Worker provenance and complete custom-domain parity before recording production completion.

