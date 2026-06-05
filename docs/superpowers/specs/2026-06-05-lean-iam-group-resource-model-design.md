# Lean IAM Group And Resource Model Design

Date: 2026-06-05

## Purpose

Clarify the next CareAround SG access model before adding more group concepts, so the platform stays easy for lean organisations while preserving the stable resource-management rules.

The design keeps one core rule:

- Group roles organise work.
- Resource roles control resources.

This prevents Org Groups and Region Groups from accidentally becoming broad ownership, approval, or publishing systems.

## Current Baseline

- Super Admins can administer the platform and recover misconfigured governance records.
- Organisation access has Admin and Staff roles for organisation governance context.
- Organisation access does not grant resource editing by itself.
- Direct resource Owner/Staff access controls who can create, edit, publish, and manage places and offerings.
- Linked organisation resources provide governance and agreement context, not automatic edit rights.
- Restricted resource notes/files are protected by dedicated permission checks. Extra read-only access is explicit.
- Audit Trail Phase 1 is scoped and should not be broadened by this design.

## Approved V1 Principles

- Keep adoption light. Do not make approval and accountability workflows the centre of V1.
- Allow one person to hold multiple roles when an organisation is lean.
- Do not silently inherit powers across roles. A user may wear multiple hats, but each hat must be assigned intentionally.
- Keep cross-organisation collaboration as coordination metadata for now.
- Keep publishing and resource control with the existing resource Owner/Staff model.
- Keep phone calls, text messages, and offline coordination outside the platform for now.
- Do not add email, WhatsApp, SMS, Gmail, GudAuth, auth, or secret changes in this work.

## Role Boundaries

### Super Admin

Super Admin remains the platform-level recovery and setup role.

Allowed:

- Create organisations, Org Groups, and Region Groups when supported.
- Assign initial admins where the platform needs recovery or setup.
- Manage platform-wide governance records.

Not changed:

- This design does not expand public visibility, auth behavior, or private content access.

### Organisation Admin

Organisation Admin remains the governance manager for one organisation.

Allowed:

- Manage organisation profile, organisation access, linked-resource context, and agreement records.
- Oversee all Org Groups inside the organisation.
- Assign or remove Org Group Admins when that feature exists.
- Continue to use existing resource Owner/Staff rights when separately granted.

Not allowed by organisation access alone:

- Edit, publish, archive, or transfer ownership of every organisation-linked resource.
- Grant Super Admin or platform-level roles.
- Grant resource Owner/Staff access unless existing rules already allow it.

### Organisation Staff

Organisation Staff remains read-only organisation context.

Allowed:

- View organisation profile, access list, linked resources, covered offerings, and agreement records.

Not allowed:

- Manage organisation access, group membership, agreements, or linked resources.
- Edit resources unless separately assigned resource Owner/Staff access.

### Org Group Admin

Org Group Admin is an internal coordination role inside one organisation.

Allowed:

- Coordinate a defined group of organisation users and resources.
- Manage group Staff membership for existing organisation users. This is coordination membership only, not resource Staff access.
- Prepare drafts and internal planning work where the resource workflow permits it. Draft preparation must not publish or alter a resource unless the user also has the required resource access.
- Be assigned as Organisation Admin too, if the same person needs both roles.

Not allowed by Org Group Admin alone:

- Invite brand-new users into the organisation.
- Grant or remove resource Owner access.
- Pull unrelated resources into the group without the required organisation-level or resource-level permission.
- Edit, publish, unpublish, archive, or transfer an organisation-owned resource unless also assigned resource Owner/Staff access.
- View restricted resource notes/files unless separately permitted by existing restricted-content rules.

### Region Group Admin

Region Group Admin is a generic cross-organisation coordination role. In Singapore, an ICCP SR can be represented as a type of Region Group, but the platform should not hard-code the admin name to ICCP.

Allowed:

- Coordinate Region Group metadata and membership context.
- Support reporting, filtering, coordination notes, and public optional partnership copy.
- Create or manage resources only when separately assigned the required resource Owner/Staff access.
- Be the same person as a resource Owner/Staff user when the operating reality requires it.

Not allowed by Region Group Admin alone:

- Become Owner/Staff of linked resources automatically.
- Edit, publish, unpublish, archive, or transfer resources owned by participating organisations.
- Approve or reject inter-organisation publishing.
- Override Organisation Admins or resource Owners/Staff.
- View restricted resource notes/files unless separately granted under existing restricted-content rules.

### Resource Owner/Staff

Resource Owner/Staff remains the operational control lane.

Allowed:

- Create, edit, publish, unpublish, archive, and manage resources according to existing resource rules.
- Manage restricted resource content according to existing restricted-content rules.
- Decide what public provider, venue, contact, and partnership information is shown on a resource.

Not changed:

- Group context does not weaken or override direct resource ownership.

## Org Groups

Org Groups are internal to one organisation.

V1 use:

- Group internal staff, programmes, places, or service lines for coordination.
- Help an Organisation Admin delegate light group coordination without making every coordinator an Organisation Admin.
- Support lean organisations where the same person may be Organisation Admin, Org Group Admin, and resource Owner/Staff.
- Treat group Staff as coordination membership only. It is not the same as resource Staff.

V1 limits:

- Org Groups are not cross-organisation collaboration containers.
- Org Groups do not publish resources.
- Org Groups do not approve resource changes.
- Org Groups do not automatically grant resource edit access.
- Dedicated Org Group Admin assignment is optional. A lean organisation can start with only Organisation Admins.

## Region Groups

Region Groups are coordination context across organisations and resources.

V1 use:

- Represent a regional collaboration context such as an ICCP SR.
- Link participating organisations, resources, and optional group-level notes for coordination.
- Support reporting and filtering by collaboration context.
- Allow group-created or group-coordinated programmes to be represented without changing who controls the underlying resource.

V1 limits:

- Region Groups are metadata and coordination context only.
- Region Groups do not own resources.
- Region Groups do not approve publishing.
- Region Groups do not grant resource editing rights.
- Region Groups do not expose private resource notes/files.
- Region Groups do not create a partner correction or approval notification process in V1.

## Resource Ownership And Publishing

Publishing remains simple:

- Whoever has the required direct resource Owner/Staff access can control and publish the resource. Group Staff does not count as resource Staff.
- Group assignment does not create a separate publishing gate.
- Publicly named providers, hosts, venues, partners, and contacts are controlled through the normal resource edit flow.
- If a partner needs correction or review, teams can coordinate outside the platform for now.

Primary host approval, partner approval, correction queues, expiry reminders, and inter-organisation publishing rights are out of scope for V1.

## Public Display

The public experience should stay service-facing. Public users should not see internal governance labels.

Avoid public labels such as:

- Region Group
- ICCP SR
- Org Group
- Approval status
- Internal boundary
- Governance admin

Allowed optional public copy:

- Supported by multiple providers
- Part of a local care network
- Delivered with community partners
- Community care programme

These phrases are editable public copy, not system-generated governance labels. Region Group programmes should appear as normal Discover listings once public, using existing public categories and visibility rules.

Only provider names, venue names, contacts, and partner details intentionally entered for public display should be shown publicly.

## Restricted Notes And Files

Restricted notes/files remain private resource content.

Rules:

- Resource Owner/Staff and existing authorised restricted-content viewers keep the current access model.
- Organisation, Org Group, or Region Group context does not automatically grant restricted-content access.
- Region Group Admin and Org Group Admin may view restricted notes/files only if separately permitted by the existing restricted-content rules.
- Public snapshots, Discover cards, saved maps, and shared maps must not expose restricted notes/files.

## Conceptual Data Shape

This design does not require a schema commitment yet. The implementation plan should choose the smallest compatible storage model after inspecting existing tables.

Conceptually:

- Organisation remains the legal or governance entity.
- Org Group belongs to exactly one organisation.
- Region Group can include multiple organisations and resources.
- Group membership stores coordination roles, not resource permissions.
- Resource access remains stored through existing Owner/Staff access records.
- Public partnership wording remains editable resource metadata, not an internal role label.

## Explicitly Out Of Scope For V1

- Inter-organisation approval workflow.
- Pending approval queue.
- Partner correction request workflow.
- Automatic partner notifications.
- Primary-host approval gate.
- Email, WhatsApp, SMS, Gmail, GudAuth, auth, or secret changes.
- Broad migration that renames every Region Admin into Region Group Admin.
- Public Discover redesign.
- Public exposure of group governance terms.
- Automatic restricted-content access from group roles.
- New audit-trail expansion beyond the approved Phase 1 scope.

## Guardrails And Blast Radius

This work touches sensitive access concepts. Implementation should be narrow and staged.

Protect these stable surfaces:

- Existing resource Owner/Staff management.
- Organisation Admin/Staff governance model.
- Dashboard Resources and Admin resource loading resilience.
- Restricted notes/files permission checks.
- Discover visibility, ranking, filtering, saved maps, and shared maps.
- Auth session behavior and GudAuth integration.

Risk controls:

- Add group concepts as additive metadata first.
- Do not replace existing Region Admin behavior in the first implementation.
- Do not change public visibility rules while adding group context.
- Do not let group-role checks appear in resource edit or publish permission checks unless explicitly approved later.
- Do not broaden restricted-content viewer eligibility.

## Acceptance Criteria

- The product has clear definitions for Org Group and Region Group.
- Org Group Admin can exist as an optional internal coordination role.
- Region Group Admin can exist as an optional cross-organisation coordination role.
- Organisation Admin can still operate leanly without creating Org Group Admins.
- One person can hold multiple roles when assigned explicitly.
- Group roles do not automatically grant resource Owner/Staff access.
- Direct resource Owner/Staff remains the ordinary operational lane for resource control and publishing.
- Region Groups can represent ICCP SR coordination without hard-coding the admin label to ICCP.
- Public Discover copy avoids internal governance terms.
- Restricted notes/files remain protected from group-role inheritance.
- V1 avoids approval queues, correction workflows, and automated partner notifications.

## Verification Plan

For the later implementation plan:

- Add server tests proving Org Group roles do not grant resource edit/publish access.
- Add server tests proving Region Group roles do not grant resource edit/publish access.
- Add server tests proving group roles do not grant restricted-content access.
- Add client tests for any new group-management views and read-only states.
- Add client tests that public labels do not expose Region Group, ICCP SR, Org Group, approval, or internal boundary wording.
- Keep existing organisation governance, resource-list loading, restricted-content, Discover, and smoke tests in the release gate.
