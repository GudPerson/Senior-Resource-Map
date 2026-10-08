# Care Map hover and annotation appearance

The user requests hover activation for all linked annotation behaviours, a glow matching the selected map pins with a custom colour option, and images without a border unless explicitly enabled. This follows released public source `7e58813713a853aaf04af3ed8c1b1f66af482c94`. Work is isolated on `codex/care-map-hover-appearance-20261008` in the current clean release checkout; preserve the unrelated dirty primary.

## Narrow integration

- Pointer hover and keyboard focus activate linked effects in both directions; matching leave/blur clears only its own activation. Touch retains deliberate tap because touch has no hover. Ordinary card/pin clicks, map focus, navigation and editor selection/drawing remain separate. Hover never pans, filters, reorders or saves.
- Per-input activation slots protect rapid pointer transitions and simultaneous keyboard focus. Brief pulse then steady glow, reduced motion, hidden saved views, map/view changes and transient-export exclusion remain.
- Default glow is source-confirmed pin orange `#f97316`. Optional `resourceGlowColor` is a strict six-digit hex string associated with nonempty private resource links. The picker offers Glow colour and Use pin orange. Multiple linked annotations choose a deterministic card colour by document order.
- Optional top-level `imageBorder` is a boolean for images only; absent/false means borderless, including earlier images. Only true is serialized. Show border exposes the existing colour/line controls. Temporary editing outlines and handles remain separate from the saved border.
- JSON schema version 1 and the immutable image asset descriptor stay unchanged; no migration or media refetch for appearance edits. Server/client normalization agrees. Removing the last link strips private glow metadata; shared geometry strips it alongside existing links/behaviours. Images remain excluded from Shared Maps/embeds.
- New controls/help and Guide feature instructions are aligned in English, Chinese, Malay and Tamil. Authored CMS/canonical/generated Help library, request aliases, history, AI budget and private release workflow remain protected.

## Acceptance and release

Run focused model, interaction, card, Guide and appearance checks; full quality/client build/server and locked-map gates. Use actual fictional browser interactions to prove hover entry/exit in both directions, all three behaviours, keyboard/touch, rapid transitions, custom colour/reset/save/reload, default/explicit image border and static export. Distinguish local browser evidence from read-only live interface verification; do not create production test media/resources or submit live Guide questions.

After acceptance, the existing explicit commit/push/deploy authority covers this scoped update. Use the normal private paired publisher with the latest unchanged authored library, preserving source/runtime/44 bindings. Verify accepted receipt, cleared lock, exact Worker/Pages identities and complete fresh custom-domain MIME/byte/SHA parity. Record failures and final production receipts separately.

## Known-good prior release

The accepted reference is public `7e58813713a853aaf04af3ed8c1b1f66af482c94`, hydrated private build `dc113ea54785ea429d4ee0a79225b02d277d1f86`, normal run `37752110569`, Worker `1b7b9028-0d6a-458a-ac30-504675d3d4c8` and Pages `ea5b7cdc-de6a-41a0-a790-c4ff5294e8f7`. Its content version is `2026-10-08.help-cms.1791449204083`; authored Help remains 48 articles/11 categories. The accepted private summary is `/private/tmp/care-map-annotation-media-20261008/release/final-production-release-seal-accepted.json`. It proves 102 assets and six ordinary HTML response cases across two routes, not six routes. These are prior identities; capture a fresh current baseline before the next source-pin operation.

## Verification checkpoint

- Passed: focused model/normalization 51/51, hover/card adapters 43/43, fictional hover browser 15/15, direct Guide route/history 10/10, independent architecture/privacy/lifecycle review and diff whitespace check.
- Hover browser covers both directions, all behaviours, no pan/filter/reorder/save, rapid transitions, pointer/focus overlap, mouse-down/leave/focus, repeat pulse, reduced motion, hidden views, delayed image decode, failed-media Retry and 390 px deliberate touch fallback. Report: `/private/tmp/care-map-hover-appearance-20261008/hover-browser-report-final-keyboard.json`; adapters: `focused-keyboard-fallback-final.log`.
- Guide proof covers four locales and exact Glow colour/Use pin orange/Show border labels, existing owner/guest/impersonation boundaries, reviewed sharing answer/citations and question-only history with no interaction metadata. Proof: `/private/tmp/care-map-hover-appearance-20261008/guide-and-independent-review-final.json`.
- Passed final appearance acceptance: 11/11, zero errors/unexpected writes; legacy borderless image, explicit border save/reload/removal without media refetch, buffered custom colour commit, map/card purple glow, pin-orange reset with one saved undo step and undo/redo, all four locale controls, actual decoded static PNG/PDF without transient glow. Evidence: `/private/tmp/care-map-hover-appearance-20261008/appearance-browser-report.json` (final run 4); earlier reports/logs remain retained.
- Passed frozen quality: compiler 17/17, CMS 73/73, server 1,177/1,177, client 965/965, environment 5/5, static checks and production build (5.57 s), recorded in `/private/tmp/care-map-hover-appearance-20261008/quality-source-frozen.log`. Locked-map checks pass 112/112 plus the required fixed-surface bundle build (4.85 s), recorded in `map-lockdown-source-frozen.log`. Graft build passes. Documentation-only closeout follows this accepted runtime source; no further runtime changes are included.
- Retain earlier failed hover/renderer and appearance attempts, reset/blur findings and corrected harness probes. Passing reruns apply only to their exact corrected source/harness; they do not erase failures. All browser evidence uses fictional intercepted APIs and private local assets. No production fixture content/media write, live Guide question or physical-device claim belongs to this acceptance.

## Frozen publication and pending delivery proof

Reuse the already reviewed private workflow `330420711969ff4978bbbd1300aee99eadc39705` and unchanged frozen proof helpers only after root review. The private preparation is `/private/tmp/care-map-hover-appearance-20261008/release-reuse-review.md`; do not copy any owner body, credential or header into source. Capture fresh safe owner publication/workspace metadata and ETag with no active lock, then stage only the approved public source pin while preserving all 44 bindings, exact code/runtime and truthful Worker tag. Review the immutable unchanged-library snapshot and use the real owner's normal Review & publish path. Version metadata may advance; authored content must match the approved baseline.

- Final public source SHA: **pending**.
- Frozen full quality/build/map evidence: **passed locally** as recorded above; private normal-job gates remain a separate production gate.
- Final appearance/export browser evidence: **passed locally**, final run 4 `appearance-browser-report.json`, 11/11.
- Approved content version, release ID, job ID and normal run ID: **pending**.
- Hydrated build SHA and compiled content digest: **pending**.
- Worker version and canonical Pages deployment: **pending**.
- Four normal-job gates, accepted published receipt, workspace promotion and cleared lock: **pending**.
- Fresh complete custom-domain MIME/byte/SHA parity and six ordinary HTML response cases across `/` and `/offline`: **pending**. Derive the expected artifact count from the validated candidate build and reviewed inventory difference, not the previous 102 or helper default 101.
- Live read-only owner/Directory/Guide controls and four locale labels: **pending**. A live Guide question is not required; prior automatic approval review blocked possible paid-model/history mutation, and no submission is authorized by this proof plan.

Recommended next step: freeze the accepted source, execute the already authorized normal unchanged-library paired release and replace the production pending fields with its independently verified receipt/proof.
