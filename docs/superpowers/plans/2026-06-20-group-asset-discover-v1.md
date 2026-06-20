# Group Asset Discover V1 Implementation Plan

Date: 2026-06-20
Branch: codex/my-map-category-bubbles

## Guardrails

- Work only in `/Users/sweetbuns/CareAroundSG`.
- Preserve the stable My Map/Shared Map category-bubble contracts and Discover search/camera contracts from `docs/regression-ledger.md`.
- Do not change auth/session, postal validation, Gmail/email, GudAuth, secrets, production data, or existing Discover ranking/visibility for non-Group assets.
- Group is a public-facing soft asset mode, not a fourth Programme/Service/Promotion bucket and not a Place-hosted child.
- Commit locally after validation. Do not push or deploy.

## Task 1: Lock Server Group Rules With Tests

- Add focused tests for a pure Group helper module.
- Cover:
  - `assetMode = "group"` detection.
  - grouping member summaries into Places, Programmes, Services, Promotions.
  - excluding hidden, deleted, member-only, restricted, and nested Group members from public payload helpers.
  - Area/search helper data from exact public members only.
  - zero-public-member Groups marked not Discover-ready.
- Run the new test first and confirm it fails before implementation.

## Task 2: Add Group Data Model And Schema Bootstrap

- Extend `SOFT_ASSET_MODES` with `GROUP`.
- Add `soft_asset_group_members` to `server/src/db/schema.js`.
- Add boundary bootstrap SQL for the table and indexes in `server/src/utils/boundarySchema.js`.
- Keep `soft_assets.bucket` unchanged.
- Add cleanup ordering to clean-slate helpers if required.
- Run schema/source tests.

## Task 3: Add Server Group Payload And Member APIs

- Add a server utility for Group member validation, summaries, public filtering, and DTO shaping.
- Extend soft asset list/detail relations to include Group members.
- Allow Dashboard-created `assetMode="group"` soft assets through the existing soft asset create/update path without requiring linked Place locations.
- Add focused routes:
  - `GET /soft-assets/:id/group-members`
  - `PUT /soft-assets/:id/group-members`
- Validate:
  - Group can include hard assets and non-group soft assets.
  - Group cannot include itself or another Group.
  - duplicate member links collapse or fail deterministically.
  - public payload excludes non-public members.
  - Groups with zero public members are not Discover-ready.
- Run server tests.

## Task 4: Expose Group In Discover Without Pins

- Extend public cache/list payloads with Group rows as soft list-only resources.
- Add member counts, member search text, and public member location hints.
- Update client cache normalization and Discover helpers:
  - Group has no persistent map locations.
  - saving a Group does not create pins.
  - Area filtering can use public member location hints.
  - search can match Group own fields and public member fields.
- Add focused client tests for Group cache/search/Area/no-pin behavior.

## Task 5: Add Public Group Card And Detail View

- Render Group cards as collection cards with a `Group` label and compact member counts.
- Add Group detail rendering under `/resource/soft/:id` with grouped public members and links to existing resources.
- Preserve existing Place related-offering buckets and existing member card behavior.
- Add source or unit tests for detail/card behavior.

## Task 6: Add Dashboard Resources Groups Tab

- Add a separate `Groups` tab in Dashboard Resources.
- Keep Groups out of Offerings buckets.
- Provide create/edit flow for Group basics plus a manual member picker.
- Show readiness states:
  - Ready for Discover
  - Needs members
  - Hidden
  - Review members
- Use existing soft asset staff/owner access patterns and do not grant member edit rights.
- Add source tests for tab separation and API usage.

## Task 7: Ledger And Validation

- Update `docs/regression-ledger.md` with the Group V1 contract and verification evidence.
- Run:
  - focused server tests for Groups/schema/cache
  - focused client tests for Discover/cache/detail/dashboard
  - `npm run test:server`
  - `VITE_API_URL=https://api.carearound.sg/api npm run build:client`
  - `git diff --check`
- Stage only intended files and exclude generated Playwright output.
- Commit locally with a Group V1 message. Do not push or deploy.
