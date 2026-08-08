# Embedded Preview WWW Refinement Release Manifest

Date: 2026-08-08 (Asia/Singapore)

## Release scope

- Replace the embedded resource Website globe-only control with a compact
  globe-plus-`WWW` mark based on the supplied visual reference.
- Change the guest-open offering pill from `Programmes and services` to
  `Programmes / Services`, retaining the slash construction in all supported
  locales.
- Preserve the approved 400x520 preview density, 44-pixel touch targets,
  Website/phone/social/resource actions, Detailed map roots, and all existing
  frozen-map privacy and filtering contracts.

## Architecture and blast radius

- Client-only presentation and translation change.
- No Worker, schema, auth, permission, map membership, Group filtering,
  annotation, Print View, export, R2, framing, or snapshot-data change.
- The supplied watermarked stock image is reference-only and is not included
  in Git or the deployed client.

## Source and verification

- Implementation commit: `651692289c7e941e47ee68bd3104d11e3b1705ba`
- Branches: `codex/embed-preview-www-refinement` and `main`
- Focused embed/i18n tests: 8/8 passed.
- Full client/source tests: 575/575 passed.
- Full server tests: 521/521 passed.
- Map lockdown: 84/84 passed, followed by the exact six-root production build.
- Ordinary client build and `git diff --check` passed. The only build advisory
  was the established stale browsers-data notice.
- Local 400x520 Chrome QA: 204-pixel client and scroll heights, no clipping,
  and all complete-fixture actions on one row.

## Deployment

- Git-triggered production deployment:
  `f5fb4336-a457-49a9-9f74-92d18cb23886`.
- First controlled six-root publication:
  `48f7b2c2-c661-4cb1-91ce-07f6785446d2`.
- Accepted controlled publication after custom-domain propagation:
  `d76c9bf4-1a2b-48b2-944a-b0b77816752b`.
- Immutable URL: `https://d76c9bf4.senior-resource-map.pages.dev`.
- Production URL: `https://app.carearound.sg`.
- No Worker deployment was performed because the server and public snapshot
  contracts did not change.

## Production evidence

- All 81 public files match local, immutable Pages, and the custom domain by
  MIME type, byte length, and SHA-256.
- Aggregate manifest SHA-256:
  `c22921fb7de1ebb023bdab3c637036445adb23b00c60de7399856fc03a6fb023`.
- `assets/EmbeddedMapPage-Bw36sde0.js` returns
  `application/javascript` and contains the WWW and
  `Programmes / Services` release markers.
- All six locked Detailed-map roots and required/forbidden map markers remain
  present in the deployed JavaScript.
- `https://api.carearound.sg/api/health`, the frozen public embed API, the
  production embed document, and `/discover` return 200.
- Production Chrome UAT at 400x520 selected Fei Yue Active Ageing Centre
  (Brickland) and confirmed its logo, name, address, `1 Programmes / Services`,
  operating hours, WWW action, tap-to-call number, and `Open resource`. The card
  remained 204/204 pixels with one action row.
- Production smoke: the public case passed. Five authenticated cases were not
  runnable because `SMOKE_PARTNER_USERNAME` and `SMOKE_PARTNER_PASSWORD` were
  absent; they are not claimed as passed.

## Rollback

Rebuild prior source `b8b01328b` with the exact six production map roots and
republish that validated `client/dist` to Pages `main`. Do not roll back the
Worker, database, or map assets because this release changed none of them.
