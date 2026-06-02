# Organisation Governance Access Design

Date: 2026-06-03

## Purpose

Clarify and extend the organisation governance workflow so it matches real operating needs without merging it into asset editing or global user administration.

The design keeps two lanes separate:

- Direct asset access controls operational work on places and offerings.
- Organisation access controls governance documentation, agreement coverage, and organisation context.

## Current Baseline

- Super Admin can create organisations and currently acts as the strongest governance operator.
- Organisation access has two roles: Admin and Staff.
- Organisation access does not grant asset edit rights by itself.
- Direct asset Owner/Staff access controls who can manage assigned places, standalone offerings, and hosted/linked offering surfaces.
- Audit Trail Phase 1 allows Super Admins to see all audit rows and Organisation Admins to see organisation-linked audit rows.
- Archived and Paused organisations block new access, resource links, and agreement records until set back to Active or Draft.

## Approved Role Rules

### Super Admin

- Creates an organisation.
- Assigns the first Organisation Admin.
- Can manage any organisation and any asset access.
- Can still act as emergency recovery if an organisation is misconfigured.

### Organisation Admin

Organisation Admin is a governance manager for one organisation.

Allowed:

- Add Organisation Admins.
- Remove Organisation Admins, except the final active Organisation Admin.
- Add and remove Organisation Staff.
- Edit the organisation profile and governance status.
- Manage data contact details and notes.
- Create, update, and revoke agreement records.
- Link and unlink eligible assets to the organisation.
- View the organisation-scoped Audit Trail.

Not allowed:

- Change a user's global account role.
- Grant Region Admin or Super Admin role.
- Edit linked assets unless they also have direct asset Owner/Staff access.
- Add a user who is already actively assigned to another organisation.
- Remove the last active Organisation Admin.

### Organisation Staff

Organisation Staff has read-only organisation context.

Allowed:

- View organisation profile/context.
- View Organisation Admins and Staff.
- View linked places and linked offerings.
- View offerings covered through linked places.
- View agreement records and coverage status.

Not allowed:

- Add or remove organisation users.
- Link or unlink assets.
- Create, update, or revoke agreements.
- Edit organisation profile/status.
- Edit assets unless they also have direct asset Owner/Staff access.
- View Audit Trail unless a future phase explicitly grants it.

## Region Admin Asset Creator Ownership

When a Region Admin creates a resource that supports direct ownership, the creator should automatically become the first direct Owner.

Rules:

- New places created by a Region Admin automatically grant that Region Admin direct Owner access to the new place.
- New standalone offerings created by a Region Admin automatically grant that Region Admin direct Owner access to the new standalone offering.
- Hosted or linked offerings continue to inherit operational access from their host/link place; no duplicate direct Owner grant is created for those offerings.
- The automatic Owner grant is recorded as an access audit event with a clear creator-default-owner reason.
- The Region Admin can later be removed by another Owner, but the final active Owner cannot be removed.

This does not make Region Admins Owners of all assets in their region. It only applies to assets they create.

## Organisation Asset Linking

Organisation Admins can link assets to their own organisation when the asset operators are already covered by the same organisation.

### Candidate Rules

- Assets with no active direct Owner/Staff are not selectable for organisation linking.
- Assets already linked to another active organisation are blocked.
- If an asset has direct Owners/Staff, every active operator must already have access to the same organisation.
- If any operator is missing, linking is blocked with a clear follow-up message naming the missing user or users.
- Missing users are not added automatically.

Example block message:

`Cannot link this asset yet. Add Hyqel Zainudin to this organisation first.`

### Places

- A place can be linked when all active direct place Owners/Staff belong to the organisation.
- Linking a place automatically covers all offerings hosted by or linked to that place.
- The UI should explain this in plain language: `Programmes and services hosted here are covered too.`
- The implementation may store this as inherited coverage rather than creating duplicate visible links for every offering.

### Standalone Offerings

- A standalone offering can be linked when all active direct offering Owners/Staff belong to the organisation.
- Standalone offering links are shown as direct linked offerings.

### Hosted Or Linked Offerings

- Organisation Admins can link an individual hosted/linked offering separately when the host/link place is not linked.
- The operator check uses the host/link place Owners/Staff, because those are the people who operate the offering.
- If the place is already linked, the offering should appear as covered through that place and should not need a duplicate direct link in normal use.

## Organisation Workspace UI

The current Admin Tools area does not clearly expose the organisation workflow to Organisation Admins or Staff. Add a dedicated Organisation Workspace entry for users with organisation access.

### Organisation Admin View

The workspace should show:

- Organisation profile and status controls.
- Organisation access list with Admin/Staff badges.
- Add access controls for Admin and Staff.
- Linked places and directly linked offerings.
- Inherited offering coverage from linked places.
- Agreement records and coverage status.
- Link/unlink controls for eligible assets.
- Link blocking details for missing operators.
- Link to the organisation-scoped Audit Trail.

### Organisation Staff View

The workspace should show the same context read-only:

- Organisation profile.
- Organisation Admins and Staff.
- Linked places.
- Directly linked offerings.
- Offerings covered through linked places.
- Agreement records and coverage status.

Staff controls for editing, linking, adding access, or agreement changes should be absent or disabled with plain-language guidance.

## Audit Expectations

Audit rows should be written for:

- Region Admin creator default Owner grants.
- Organisation Admin/Staff access additions.
- Organisation Admin/Staff access removals.
- Organisation profile/status updates.
- Agreement create/update/revoke.
- Organisation resource link/unlink.
- Edits and operational changes to resources covered by the organisation.

Organisation resource edit/change logs include:

- Directly linked place updates.
- Directly linked standalone offering updates.
- Hosted/linked offering updates when the offering is covered through a linked place.
- Visibility changes, availability/freshness changes, and direct asset access changes for covered resources.

Resource-change audit rows should store plain-language summaries such as changed field names, resource type, resource name, and action type. They should not store raw request bodies, secrets, private public-user activity, or unnecessary internal IDs in the user-facing presentation.

Organisation Admin audit visibility remains scoped:

- Organisation Admin sees rows tied to their organisation.
- Super Admin sees all rows.
- Organisation Staff does not receive Audit Trail access in this phase.

## Non-Goals

- No production auth changes.
- No Gmail, email, GudAuth, or secret changes.
- No public Discover visibility changes.
- No change to saved maps or shared maps.
- No automatic adding of asset operators to organisations.
- No global user-role changes by Organisation Admins.
- No broad Region Admin control over all regional assets.
- No AI audit chat in this phase.

## Acceptance Criteria

- Super Admin can create an organisation and assign the first Organisation Admin.
- Organisation Admin can add and remove Organisation Admins and Staff for their own organisation.
- Organisation Admin cannot remove the final active Organisation Admin.
- Organisation Admin cannot assign users already active in another organisation.
- Organisation Staff can view organisation context but cannot manage it.
- Region Admin-created places automatically grant the creator direct Owner access.
- Region Admin-created standalone offerings automatically grant the creator direct Owner access.
- Hosted/linked offerings continue to inherit operational access from their place.
- Organisation Admin can link eligible places and offerings.
- Assets with no active direct operators are not selectable for linking.
- Assets with missing organisation-covered operators are blocked with clear user details.
- Linking a place covers hosted/linked offerings in the organisation workspace.
- Linked assets do not become editable through organisation access alone.
- Organisation Admin audit view includes edit/change logs for resources directly linked to, or covered through, their organisation.
- Organisation resource change logs explain what changed in plain language without exposing raw request bodies, secrets, or unrelated private user activity.

## Verification Plan

- Add server tests for Organisation Admin add/remove Admin/Staff, including final-admin protection.
- Add server tests for organisation asset-link eligibility with no operators, all covered operators, missing operators, and conflicting organisation links.
- Add server tests that place links produce effective coverage for hosted/linked offerings.
- Add server tests that resource edit/change audit rows are associated with directly linked resources and offerings covered through linked places.
- Add server tests that Organisation Admin audit queries include covered-resource change logs and exclude unrelated resource change logs.
- Add server tests for Region Admin creator default Owner grants on places and standalone offerings.
- Add client tests for Organisation Workspace visibility and read-only Staff behavior.
- Add client tests for plain-language resource-change audit presentation in organisation scope.
- Run focused governance/access tests first.
- Run `npm run test:server`.
- Run relevant client tests.
- Run `npm run build:client`.
- Run `git diff --check`.
- Update `docs/regression-ledger.md` only after behavior is implemented and verified.
