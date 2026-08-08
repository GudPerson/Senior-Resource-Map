# Release Manifest: Embedded-map Contacts and Group Filters

- Date: 2026-08-08
- Branch: `codex/map-only-embed-v1`
- Released implementation commit: `ce37a5954ae20271d7bcd6c1fef3fdf8da40d52d`
- Status: production release verified on 2026-08-08.

## Released outcome

- A selected one-resource pin shows the resource name and address once. The
  duplicate inner name/category block is removed while hosted and
  multi-resource pins retain the labels needed to distinguish their rows.
- The compact preview keeps its resource logo/fallback and `Open resource`
  link. Newly updated share snapshots may also expose a compact website icon,
  visible tap-to-call number, and recognizable Facebook, Instagram, TikTok,
  YouTube, or LinkedIn icons in the embed only.
- Selecting a Group category retains mapped public Group members already in
  the frozen shared map. It does not add out-of-map members or unrelated
  resources at the same coordinates.

## Privacy and compatibility

Contact fields and exact Group-member asset keys are sanitized and frozen only
when the owner intentionally uses `Update shared link`. Existing tokens remain
on their prior frozen snapshot until that action. The ordinary Shared Map
response remains contact-free, and email, WhatsApp, private notes, personal
places, owner tools, and live resource reads are excluded. The snapshot fields
are optional, so older snapshots remain compatible. No database schema, route,
authentication, permission, framing, R2, Print View, annotation, export, or
map-membership contract changed.

## Deployment record

1. `codex/map-only-embed-v1` and `main` were fast-forwarded to `ce37a5954` and
   pushed.
2. The guarded clean-`main` Worker release deployed version
   `1971d14c-54f0-4d0c-8f61-0eab30722cc8` before Pages.
3. API health, the ordinary shared-map endpoint, and the embed endpoint
   returned 200. The ordinary payload contained no website, contact-phone, or
   social fields.
4. The exact production API URL and six locked Detailed-map roots built and
   deployed to `https://b8dc25b5.senior-resource-map.pages.dev`.
5. All 81 public files matched local `client/dist`, the immutable Pages URL,
   and `https://app.carearound.sg` byte-for-byte with aggregate SHA-256
   `972a4e186846edb5afed7b43333b6fa317458605f542111020b42f3f3de667e0`.

## Verification

- Focused client/server regression coverage: 9/9.
- Full Worker/server suite: 520/520.
- Full client/source suite: 574/574.
- Locked map/print aggregate: 84/84.
- Exact six-root production build: pass.
- Production public smoke: 1/1. Five authenticated cases were not run because
  their configured credentials were absent.
- Production Playwright at 400x520: 4 mapped resources; selecting the ICCP
  Group retained all 4 mapped member pins; selecting Fei Yue Sunshine Court
  showed its name/address once and preserved `Open resource`.
- Existing map 25 and its frozen share snapshot were not mutated during UAT.
  Website, phone, social-icon, and exact new member-key presentation had
  already passed the built-app 400x520 fixture before deployment; production
  map 25 requires one intentional `Update shared link` before those new frozen
  fields can appear.

## Rollback

1. Roll back Pages first to the previous verified embedded-map deployment.
2. If necessary, redeploy the preceding Worker after the client rollback.
   Optional snapshot fields make either version tolerant during the transition.
3. Do not delete or rewrite existing shared snapshots. No database or R2
   rollback is required.
4. Do not mutate an owner map merely to verify rollback; use a disposable map
   only when authenticated UAT is explicitly authorized and cleanup is assured.
