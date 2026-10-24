# Offline Export zoom fixture

Public map metadata fetched 23 October 2026, retained byte-for-byte as deterministic gzip. No map raster, private resource, authentication, or production API data is included. Browser tests serve a synthetic one-pixel image for every chunk.

- Native index: https://maps.carearound.sg/v2/native-scale-20260722/default/manifest.json
- Native W01: https://maps.carearound.sg/v2/native-scale-20260722/default/surfaces/W01/manifest.json
- Overview index: https://maps.carearound.sg/v3/zoom14-atlas-20260730/default/manifest.json
- Overview SG14: https://maps.carearound.sg/v3/zoom14-atlas-20260730/default/surfaces/SG14/manifest.json

The same geometry is used for both colour scenarios. This checks camera synchronization, tier selection, and the renderer's algorithmic decoded-byte budget. Synthetic image bytes cannot prove actual browser heap use, map image quality, network throughput, physical-device behaviour, or authenticated production acceptance. Existing OneMap/Singapore Land Authority attribution is retained.

Run from the repository root after installing lockfile dependencies:

```sh
node tests/browser/care-map-export-zoom.mjs --rounds=10 --out=/private/tmp/caremap-export-default
node tests/browser/care-map-export-zoom.mjs --gray --rounds=10 --out=/private/tmp/caremap-export-gray
```

The fixture mounts the actual owner page with intercepted fictional APIs. It checks cold native entry, expanded-frame containment, stale camera echoes, first small outward/inward wheel actions at the native budget boundary, one raw half step per Export button action and matching decimal desktop/mobile readouts, including 15.5 → 15 → 14.5 and inward native recovery, cancel/no-op recovery, pan, emulated trackpad input, preview/hidden camera and tier parity, PNG/PDF signatures, Back and Studio's existing half-step control. No write request is permitted.

Reset setup uses the actual button's keyboard handler. A separate baseline/candidate comparison found that this oversized emulated frame can move the same connected Reset button during pointerdown, so pointerup lands on the canvas; this pre-existing pointer/focus issue is not fixed or counted as mouse Reset acceptance here. Keyboard Reset must clear the temporary scale preference and reach ready hidden capture before each repeated input.
