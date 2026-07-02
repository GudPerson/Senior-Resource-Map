# Group Asset Discover V1 Design

Date: 2026-06-20
Status: Approved design draft for review

## Purpose

Add a public-facing Group asset type for curated collections of CareAround SG resources. A Group helps staff present a bundle of related Places, Programmes, Services, and Promotions as one public Discover result without changing the existing meaning of Place cards, hosted offerings, saved assets, or My Map pins.

## Product Model

Group is a collection asset. It is technically stored as a soft asset, but it is not a Programme, Service, Promotion, generated child offering, governance Org Group, or governance Region Group.

The intended public model is:

- Group groups Places, Programmes, Services, and Promotions.
- Place groups its hosted or linked Programmes, Services, and Promotions.
- Place does not host Groups.
- Group does not become part of a Place's existing Programme, Service, or Promotion counts.

## Locked V1 Decisions

- Group is public-facing.
- Group is technically a soft asset with `assetMode = "group"`.
- Group members are exact manual links only.
- A Group can include public-visible hard assets and public-visible non-group soft assets.
- A Group cannot include another Group in V1.
- Adding a Place to a Group does not automatically add the Place's hosted or linked offerings.
- Hidden, deleted, member-only, restricted, or otherwise non-public members are excluded from the public Group payload.
- A Group with zero public-visible members is excluded from public Discover.
- Existing member cards do not show "part of Group" badges in V1.
- Saving a Group saves only the Group, not its members.
- Group does not create persistent Discover map pins.
- Groups are created and managed from a separate Dashboard Resources `Groups` tab.

## Dashboard Workflow

Staff create and manage Groups from a dedicated `Groups` tab in Dashboard Resources. This keeps curated public collections separate from normal Offerings and from governance groups.

The Group editor should support:

- Group name.
- Public description.
- Optional logo, banner, and tags.
- Existing visibility controls such as hidden status.
- Region or audience context only where it follows existing soft-asset visibility rules.
- Manual member selection for Places, Programmes, Services, and Promotions.

The member picker should:

- Search existing hard and soft assets.
- Exclude other Groups from V1 selection.
- Block or omit assets that are not eligible for public inclusion.
- Preserve exact selected members instead of inferring children from selected Places.
- Show existing linked members that later became non-public as a review issue in Dashboard, while excluding them from public payloads.

Dashboard readiness states:

- `Ready for Discover`: Group is public-visible and has at least one public-visible member.
- `Needs members`: Group has no public-visible members.
- `Hidden`: Group itself is hidden.
- `Review members`: one or more selected members no longer qualify for public display.

## Data Model

Reuse `soft_assets` for the Group record and add a dedicated member table.

Conceptual table:

```text
soft_asset_group_members
- id
- group_soft_asset_id
- member_resource_type
- member_resource_id
- sort_order
- added_by_user_id
- added_at
```

Constraints and rules:

- `group_soft_asset_id` references a `soft_assets` row whose `assetMode` is `group`.
- `member_resource_type` is `hard` or `soft`.
- `member_resource_id` points to the matching hard or soft asset table.
- Duplicate active member links are blocked per Group.
- A Group cannot include itself.
- A Group cannot include another soft asset whose `assetMode` is `group`.
- Public reads filter members by public visibility at read time.

The existing `bucket` field remains for ordinary soft assets. Group should not be modelled as a fourth Programme/Service/Promotion bucket.

## API Shape

Keep Group APIs close to the existing soft asset surface:

- Create and update Group public content through the existing soft asset create/update path with `assetMode = "group"`; the Dashboard `Groups` tab is the user-facing wrapper.
- Manage members through a focused sub-route such as `/soft-assets/:id/group-members`.
- Public `GET /soft-assets/:id` includes Group-specific member summary and public members when `assetMode = "group"`.
- Public Discover data includes ready Groups as soft assets with Group-specific collection metadata.

The API must not expose hidden, deleted, member-only, restricted, or non-public member assets in public Group payloads.

## Discover Contract

Discover shows each ready Group as one public collection card.

Card behavior:

- The card is labelled as `Group`.
- The card shows Group name, description excerpt, visual identity, tags where appropriate, and compact member counts.
- Member counts are grouped as Places, Programmes, Services, and Promotions.
- Existing Place, Programme, Service, and Promotion cards remain unchanged.

Search behavior:

- Search matches Group name, description, tags, and public member fields.
- Group own-field matches rank higher than member-only matches.
- Member-only matches should not overpower direct member results that match strongly.

Area behavior:

- A Group passes Area filtering when at least one public-visible exact member location is inside the selected Area.
- Non-public members never help a Group pass Area filtering.

Map behavior:

- A Group does not create persistent Discover map pins in V1.
- Saving a Group does not save member assets.
- Member locations may be used only for non-pin context, such as Area eligibility or optional location-summary copy on the Group card/detail.

Detail behavior:

- `/resource/soft/:id` detects `assetMode = "group"` and renders a Group detail view.
- The detail view shows the Group overview and full public member list grouped by Places, Programmes, Services, and Promotions.
- Each member links to its existing resource detail page.
- Each member can be saved independently through existing save behavior.

## Permissions And Privacy

Groups follow existing resource-operator rules for soft assets, with stricter member validation.

V1 must preserve these boundaries:

- Organisation governance access does not grant Group editing by itself.
- Group membership does not grant edit access to member assets.
- Group membership does not grant restricted notes or files access.
- Group membership does not make a hidden or private member public.
- Group membership does not create organisation/resource governance links.
- Group membership does not alter member resource visibility, ranking, saved status, or card presentation.

Public payloads must not include internal member eligibility reasons, private postal context, saved-profile details, restricted notes/files, governance-only labels, or hidden member facts.

## Out Of Scope For V1

- Groups inside Places.
- Groups as Group members.
- Auto-generated Groups by tag, category, Area, organisation, AI, or import.
- Implicit inclusion of a Place's hosted or linked offerings.
- Member-card badges such as "part of Group".
- Group map pins.
- Workbook/import support for Groups.
- My Map expansion behavior beyond safely saving the Group as one asset.
- Governance Org Group or Region Group changes.

## Regression Risks

This feature touches public visibility and several locked surfaces. The implementation must avoid changing:

- Discover ranking, filtering, and visibility for existing hard and soft assets.
- Existing Place card Programme/Service/Promotion counts.
- Saved asset behavior for hard and normal soft assets.
- My Directory and My Maps member presentation.
- Shared map snapshots.
- Auth/session, schema bootstrap discipline, postal validation, Gmail/email, GudAuth, and secrets.

## Verification Plan

Server coverage:

- Group member validation blocks duplicates, self-membership, nested Groups, invalid refs, and non-public member inclusion.
- Public Group payload filters out hidden, deleted, member-only, restricted, and non-public members.
- Groups with zero public-visible members are excluded from Discover.
- Saving a Group saves only the Group.
- Resource detail payload groups public members into Places, Programmes, Services, and Promotions.

Client coverage:

- Dashboard Resources shows a separate Groups tab and readiness states.
- Group editor allows manual public-safe member selection.
- Discover renders Group cards as collection cards with compact member counts.
- Search tests cover own-field matches, member-field matches, and own-field priority.
- Area filtering includes Groups only through public-visible exact member locations.
- Place cards still summarize only Programmes, Services, and Promotions.
- Existing member cards do not show Group badges in V1.

Release coverage:

- `npm run test:server`
- Focused client/source tests for Discover, Dashboard Resources, saved assets, and resource detail.
- `VITE_API_URL=https://api.carearound.sg/api npm run build:client`
- `git diff --check`
- Production smoke only from a credentialed shell and without printing secrets if release is requested.
