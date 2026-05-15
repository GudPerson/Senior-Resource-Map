# Overlapping Regions and Asset Access Design

## Purpose

CareAround SG needs Region boundaries that can overlap. A postal code may belong to multiple Regions because different organisations may serve different pockets of residents across intersecting service areas.

The current implementation stores overlapping postal-code rows, but much of the business logic still treats a resource as belonging to one selected `subregion_id`. This design changes the mental model:

- Regions decide relevance and coverage.
- Direct asset access decides edit authority.
- Super Admins retain global override rights.

## Current Problem

Today, many access checks rely on `hard_assets.subregion_id` or `soft_assets.subregion_id`. This makes Regions behave like mutually exclusive territories. When a postal code belongs to multiple valid service areas, the system either selects one Region, reports ambiguity, or hides the resource from another Region even though its postal code belongs there.

This conflicts with the intended operating model. A hard asset at postal code `8` should be relevant to Region A, B, and C if all three Region boundaries include that postal code.

## Target Model

### Region Boundaries

Regions are dynamic postal-code boundaries. They may overlap freely.

The existing `subregions` and `subregion_postal_codes` tables can remain the storage base for now, but UI and docs should continue moving toward the term `Region`.

A postal code can belong to zero, one, or many Regions.

### Resource Relevance

A hard asset is relevant to a Region when its `postalCode` appears in that Region's boundary.

A linked or hosted offering is relevant to a Region when any linked hard asset is relevant to that Region.

A standalone soft asset is a locationless service offering. Examples include home nursing, home medical, and other onsite services carried out at the resident's location. It does not need a place postal code. Its relevance comes from explicit service coverage, such as assigned Regions, Audience Zones, or both.

### Edit Authority

Edit authority is not granted by Region overlap.

Only these actors can edit a hard asset:

- Super Admins, globally.
- Active asset Owners.
- Active asset Staff.

Only these actors can edit a standalone soft asset:

- Super Admins, globally.
- Active standalone soft-asset Owners.
- Active standalone soft-asset Staff.

Linked or hosted offerings can inherit edit authority from the linked hard asset's Owners and Staff. Standalone offerings need direct soft-asset access because they are not bound to a place.

Region Admins can be assigned as asset Owners or Staff. They do not get edit rights merely because the asset falls inside their Region boundary.

### Ownership Lifecycle

Super Admin performs the first Owner assignment for an asset.

After an asset has at least one active Owner:

- Owners can add more Owners.
- Owners can remove Owners.
- Owners can add or remove Staff.
- Owners can hand over ownership immediately.
- New Owners become active immediately.
- The system must block removal of the last active Owner.

Staff can edit the assigned asset and linked or hosted offerings, but cannot manage access.

Every ownership and staff-access change should be audited.

### Region Admin Scope

Region Admins remain useful for governance, review, and regional operations. They can view and work with resources relevant to their assigned Regions, but write access requires explicit asset access.

Expected Region Admin abilities:

- View resources whose postal codes match their assigned Region boundaries.
- Review coverage gaps and boundary conflicts.
- Manage users within their Region scope, subject to existing user-management rules.
- Approve or review globally shared Audience Zones if allowed by policy.
- Be assigned as asset Owner or Staff by a Super Admin or existing Owner.

Region Admins should not self-claim asset ownership.

## Data Model Direction

### Keep During Transition

- `subregions`
- `subregion_postal_codes`
- `user_subregions`
- `hard_assets.subregion_id`
- `soft_assets.subregion_id`
- `hard_asset_staff_memberships`

### Add During Transition

Add explicit coverage links for standalone soft assets:

- `soft_asset_region_coverages`: `softAssetId`, `subregionId`, audit fields.
- Reuse existing Audience Zone links for postal-code or target-area coverage.

Add direct access links for standalone soft assets:

- `soft_asset_staff_memberships`: `softAssetId`, `userId`, `role = owner|staff`, `revokedAt`, audit fields.

Linked or hosted soft assets should continue to inherit access from their linked hard asset unless there is a clear future need for offering-level overrides.

### Reinterpret During Transition

`hard_assets.subregion_id` becomes a primary/default Region used for import routing, cache compatibility, and legacy screens. It must no longer be the only source of read relevance or edit authority.

`soft_assets.subregion_id` remains a primary/default Region for legacy compatibility and reporting. For standalone soft assets, it must not be the only coverage source.

`user_subregions` remains the assignment of users to Regions, but matching assets should use Region postal-code membership, linked hard-asset relevance, or standalone soft-asset coverage links as appropriate.

### Helper Layer

Add a shared Region scope service before modifying many controllers directly.

Suggested helper responsibilities:

- `findRegionsForPostal(postalCode)`
- `findActorRegionIds(actor)`
- `postalMatchesActorRegions(actor, postalCode)`
- `hardAssetMatchesActorRegions(actor, asset)`
- `softAssetMatchesActorRegions(actor, offering)`
- `standaloneSoftAssetMatchesActorRegions(actor, offering)`
- `actorCanEditHardAsset(actor, asset)`
- `actorCanEditSoftAsset(actor, offering)`
- `actorCanManageAssetAccess(actor, asset)`
- `actorCanManageSoftAssetAccess(actor, offering)`

Controllers and UI should call these helpers rather than reimplementing scope checks.

## Request Semantics

### Read/List Requests

For managed dashboards, resource lists should include resources that match the actor's Region boundaries by postal code. This is read relevance, not edit authority.

For standalone soft assets, managed dashboards should include offerings whose explicit service coverage intersects the actor's assigned Regions or approved Audience Zones.

Rows should expose per-resource permissions:

- `canEdit`
- `canManageAccess`
- `canDelete`
- `canHide`
- `matchingRegionIds`
- `matchingAudienceZoneIds`
- `primaryRegionId`

The UI can show resources that are region-relevant but keep edit controls disabled unless `canEdit` is true.

### Create/Edit Hard Asset

When creating or importing a hard asset:

- If the postal code matches one writable Region, set that as primary/default Region.
- If the postal code matches multiple Regions, the creator must choose the primary/default Region when the choice matters.
- The asset is still relevant to every Region whose boundary includes the postal code.

The first Owner assignment remains a Super Admin-controlled action. If creation/import later offers inline ownership assignment, that option must be available only to Super Admins.

### Soft Assets

Hosted or linked offerings inherit Region relevance from their linked hard assets.

Standalone offerings are coverage-based services. They should support:

- One or more service Regions.
- One or more Audience Zones.
- Public, member-only, or restricted visibility.
- Explicit Owner and Staff access through direct soft-asset access, separate from Region coverage.

If a standalone offering has no linked hard asset and no coverage assignment, it should be treated as incomplete for managed discovery and should be visible only to Super Admins and explicit Owners/Staff until coverage is added.

## Audience Zones

Audience Zones should remain separate from Region boundaries.

Asset Owners can create local Audience Zones for their own asset content. A zone can overlap Regions and other zones. Global reuse requires Region Admin or Super Admin approval.

## Migration Phases

### Phase 1: Audit and Visibility

Add audit tools and admin visibility before behavior changes.

- Report assets whose postal code matches multiple Regions.
- Report assets whose primary `subregion_id` does not match any postal-code Region.
- Report valid Singapore postal codes that are missing from all Regions.
- Report overlapping Region pairs and overlap counts.
- Report standalone soft assets without service Regions or Audience Zones.
- Show matching Regions in the admin/resource UI.

### Phase 2: Shared Scope Service

Introduce helper functions for overlap-aware Region matching and explicit asset edit permissions.

Keep old behavior in place where needed, but route new logic through the helper layer.

### Phase 3: Dashboard Read Scope

Update dashboard resource list counts and rows to use postal-code Region overlap for read relevance.

Update standalone soft-asset list counts and rows to use explicit service coverage for read relevance.

Disable edit/access controls unless explicit asset access allows them.

### Phase 4: Access Management

Update the Asset Access panel:

- Super Admin can perform first Owner assignment.
- Owners can add/remove Owners and Staff after ownership exists.
- Staff cannot manage access.
- Last Owner removal is blocked.
- Region Admins can appear as assignable users like any other real user.

Apply the same access lifecycle to standalone soft assets through a Soft Asset Access panel or a shared Asset Access component that supports hard and standalone-soft assets.

### Phase 5: Create and Import Routing

Update hard-asset create/import flows to handle multiple matching Regions.

The UI should ask for a primary/default Region only when there is ambiguity and the value is needed for compatibility.

Update standalone soft-asset create/edit flows to require at least one service Region or Audience Zone before the offering can be treated as region-relevant.

### Phase 6: Legacy Cleanup

Once overlapping behavior is stable, progressively reduce reliance on `subregion_id` as an authority field.

Do not remove the column until caches, imports, reports, and historical data paths no longer depend on it.

## Test Plan

- A postal code in Regions A, B, and C appears in all three Region Admin dashboards.
- Region Admins cannot edit a matching asset unless assigned Owner or Staff.
- A Region Admin assigned as Owner can edit that asset.
- A Region Admin assigned as Staff can edit that asset but cannot manage access.
- Super Admin can edit and manage all assets without assignment.
- Super Admin can assign the first Owner.
- Existing Owners can add additional Owners immediately.
- Existing Owners can remove Owners unless it would remove the last active Owner.
- Existing Owners can add and remove Staff.
- Staff cannot add Owners, remove Owners, or add/remove Staff.
- Standalone soft-asset Owners can add/remove other standalone soft-asset Owners and Staff after first assignment.
- Standalone soft-asset Staff can edit the offering but cannot manage access.
- Asset list counts match the rows after overlap filtering.
- A hard asset with a postal code matching multiple Regions does not cause create/import to fail solely due to overlap.
- A standalone offering assigned to Regions A and C appears in Region A and C dashboards, but not Region B.
- A standalone offering assigned to an Audience Zone appears for users covered by that zone according to visibility rules.
- A standalone offering without service coverage is flagged as incomplete and does not appear as region-relevant to normal Region Admin dashboards.

## Open Risk

The largest risk is changing read scope and write authority at the same time. The implementation should keep these separate:

- First make overlap-aware read scope observable and testable.
- Then shift edit controls to explicit asset permissions.
- Then update create/import routing.

This staged approach avoids silently granting write access because of overlapping boundaries.
