# Organisation Governance Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved Organisation Governance Access design while keeping organisation governance separate from direct asset editing.

**Architecture:** Add small server-side governance helpers first, then wire controllers and UI onto those helpers. Direct asset Owner/Staff access remains the only source of resource edit power; organisation access controls governance context, agreement records, eligible resource linking, and organisation-scoped audit visibility.

**Tech Stack:** Node test runner, Hono Worker controllers, Drizzle ORM schema, React, React Router, existing dashboard components, existing `api` client, existing translation dictionary.

---

## Source Documents

- `/Users/sweetbuns/CareAroundSG/AGENTS.md`
- `/Users/sweetbuns/CareAroundSG/docs/regression-ledger.md`
- `/Users/sweetbuns/CareAroundSG/docs/superpowers/specs/2026-06-03-organisation-governance-access-design.md`

## Scope And Blast Radius

This plan touches access control, organisation governance, resource link eligibility, audit visibility, and dashboard navigation. The safe path is to implement it in small commits, with tests before controller behavior changes.

Do not change:

- production auth, Gmail/email, GudAuth, secrets, or environment files
- public Discover visibility, ranking, sorting, filtering, saved maps, or shared maps
- global role assignment rules except the existing Super Admin and Region Admin rules already in place
- direct resource edit permissions except the approved Region Admin creator default Owner grant
- the rule that organisation access does not grant resource edit rights

## File Map

- Modify: `/Users/sweetbuns/CareAroundSG/server/src/utils/governance.js`
  - Add pure helpers for organisation access management, final-admin protection, and resource-link decisions.
- Modify: `/Users/sweetbuns/CareAroundSG/server/src/utils/organizationGuardrails.js`
  - Add non-throwing resource-link eligibility evaluation and covered-offering lookup helpers.
- Modify: `/Users/sweetbuns/CareAroundSG/server/src/controllers/governanceController.js`
  - Allow Organisation Admins to manage organisation Admin/Staff membership.
  - Filter resource-link candidates to eligible assets only.
  - Return offerings covered through linked places.
- Create: `/Users/sweetbuns/CareAroundSG/server/src/utils/assetCreatorOwnership.js`
  - Small helper module for Region Admin creator default Owner rules.
- Modify: `/Users/sweetbuns/CareAroundSG/server/src/controllers/hardAssetsController.js`
  - Grant Region Admin creator default Owner membership after successful place creation.
- Modify: `/Users/sweetbuns/CareAroundSG/server/src/controllers/softAssetsController.js`
  - Grant Region Admin creator default Owner membership after successful standalone offering creation.
- Modify: `/Users/sweetbuns/CareAroundSG/server/src/utils/auditTrail.js`
  - Resolve organisation audit coverage for direct resource links and offerings covered through linked places.
- Modify: `/Users/sweetbuns/CareAroundSG/client/src/lib/roles.js`
  - Add organisation workspace access helper.
- Modify: `/Users/sweetbuns/CareAroundSG/client/src/App.jsx`
  - Add a protected Organisation Workspace route.
- Create: `/Users/sweetbuns/CareAroundSG/client/src/pages/dashboard/OrganizationWorkspacePage.jsx`
  - Reuse the governance organisation panel for users with organisation access.
- Modify: `/Users/sweetbuns/CareAroundSG/client/src/components/dashboard/DashboardNavigation.jsx`
  - Add Organisation Workspace navigation for Organisation Admin and Staff.
- Modify: `/Users/sweetbuns/CareAroundSG/client/src/components/admin/GovernanceOrganizationsPanel.jsx`
  - Add Admin Tools mode and Organisation Workspace mode.
  - Add read-only Staff mode.
- Modify: `/Users/sweetbuns/CareAroundSG/client/src/lib/governanceOrganizationUi.js`
  - Add small presentation helpers for read-only controls and covered-offering copy.
- Modify: `/Users/sweetbuns/CareAroundSG/client/src/lib/i18n.js`
  - Add navigation and panel copy keys.
- Modify tests:
  - `/Users/sweetbuns/CareAroundSG/server/test/governance.test.js`
  - `/Users/sweetbuns/CareAroundSG/server/test/auditTrail.test.js`
  - `/Users/sweetbuns/CareAroundSG/server/test/hardAssetStaff.test.js`
  - `/Users/sweetbuns/CareAroundSG/server/test/softAssetAccess.test.js`
  - `/Users/sweetbuns/CareAroundSG/client/test/governanceOrganizationUi.test.js`
  - `/Users/sweetbuns/CareAroundSG/client/test/dashboardNavigationRecovery.test.js`
  - `/Users/sweetbuns/CareAroundSG/client/test/auditTrailPresentation.test.js`
- Modify after verification:
  - `/Users/sweetbuns/CareAroundSG/docs/regression-ledger.md`

## Task 1: Organisation Permission Helpers

**Files:**
- Modify: `/Users/sweetbuns/CareAroundSG/server/src/utils/governance.js`
- Test: `/Users/sweetbuns/CareAroundSG/server/test/governance.test.js`

- [ ] **Step 1: Write failing helper tests**

Add these assertions to the existing organisation governance helper section in `/Users/sweetbuns/CareAroundSG/server/test/governance.test.js`:

```js
test('organisation admins can manage org admins and staff without becoming global admins', () => {
    const organization = { id: 7, name: 'Entrust Healthcare Group' };
    const orgAdmin = { id: 31, role: 'standard' };
    const orgStaff = { id: 32, role: 'standard' };
    const regionAdmin = { id: 33, role: 'regional_admin' };
    const accessRows = [
        { organizationId: 7, userId: 31, accessRole: 'admin', revokedAt: null },
        { organizationId: 7, userId: 32, accessRole: 'staff', revokedAt: null },
    ];

    assert.equal(canManageOrganizationAccessRole(orgAdmin, organization, accessRows, 'admin'), true);
    assert.equal(canManageOrganizationAccessRole(orgAdmin, organization, accessRows, 'staff'), true);
    assert.equal(canManageOrganizationAccessRole(orgStaff, organization, accessRows, 'admin'), false);
    assert.equal(canManageOrganizationAccessRole(regionAdmin, organization, accessRows, 'admin'), false);
});

test('organisation access revocation protects the final active organisation admin', () => {
    const organization = { id: 7, name: 'Entrust Healthcare Group' };
    const actor = { id: 31, role: 'standard' };

    assert.deepEqual(canRevokeOrganizationAccessRole(actor, organization, [
        { organizationId: 7, userId: 31, accessRole: 'admin', revokedAt: null },
        { organizationId: 7, userId: 32, accessRole: 'admin', revokedAt: null },
    ], { userId: 32, accessRole: 'admin' }), { allowed: true, reason: null });

    const finalAdminDecision = canRevokeOrganizationAccessRole(actor, organization, [
        { organizationId: 7, userId: 31, accessRole: 'admin', revokedAt: null },
    ], { userId: 31, accessRole: 'admin' });

    assert.equal(finalAdminDecision.allowed, false);
    assert.match(finalAdminDecision.reason, /at least one active Organisation Admin/);
});
```

Update the import list in that test file:

```js
import {
    canManageOrganizationAccessRole,
    canRevokeOrganizationAccessRole,
} from '../server/src/utils/governance.js';
```

Preserve the existing imports; add only the new names.

- [ ] **Step 2: Run failing test**

Run:

```bash
node --test server/test/governance.test.js
```

Expected: FAIL because `canManageOrganizationAccessRole` and `canRevokeOrganizationAccessRole` are not exported.

- [ ] **Step 3: Implement helpers**

Add this code near `canManageOrganizationGovernance` in `/Users/sweetbuns/CareAroundSG/server/src/utils/governance.js`:

```js
function countActiveOrganizationAdmins(accessRows = [], organizationId) {
    const targetId = Number(organizationId);
    if (!targetId) return 0;
    return (accessRows || []).filter((row) => (
        Number(row?.organizationId) === targetId
        && isActiveRow(row)
        && normalizeOrganizationAccessRole(row?.accessRole) === 'admin'
    )).length;
}

export function canManageOrganizationAccessRole(actor, organization, accessRows = [], targetRole) {
    if (!normalizeOrganizationAccessRole(targetRole)) return false;
    return canManageOrganizationGovernance(actor, organization, accessRows);
}

export function canRevokeOrganizationAccessRole(actor, organization, accessRows = [], membership) {
    if (!canManageOrganizationGovernance(actor, organization, accessRows)) {
        return { allowed: false, reason: 'Organisation governance is outside your access.' };
    }

    const membershipRole = normalizeOrganizationAccessRole(membership?.accessRole);
    if (!membershipRole) {
        return { allowed: false, reason: 'Organisation access role is invalid.' };
    }

    if (
        membershipRole === 'admin'
        && countActiveOrganizationAdmins(accessRows, organization?.id) <= 1
    ) {
        return {
            allowed: false,
            reason: 'Every organisation needs at least one active Organisation Admin.',
        };
    }

    return { allowed: true, reason: null };
}
```

- [ ] **Step 4: Verify Task 1**

Run:

```bash
node --test server/test/governance.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add server/src/utils/governance.js server/test/governance.test.js
git commit -m "Add organisation access permission helpers"
```

## Task 2: Organisation Admin Access Management

**Files:**
- Modify: `/Users/sweetbuns/CareAroundSG/server/src/controllers/governanceController.js`
- Test: `/Users/sweetbuns/CareAroundSG/server/test/governance.test.js`

- [ ] **Step 1: Import helpers in controller**

In `/Users/sweetbuns/CareAroundSG/server/src/controllers/governanceController.js`, extend the governance import:

```js
import {
    canManageOrganizationAccessRole,
    canRevokeOrganizationAccessRole,
} from '../utils/governance.js';
```

Keep the existing imported names in the same import block.

- [ ] **Step 2: Allow Organisation Admins to add Admin or Staff**

Inside `addOrganizationAccess`, change:

```js
const { organization } = await loadManageableOrganization(db, actor, organizationId);
```

to:

```js
const { organization, accessRows } = await loadManageableOrganization(db, actor, organizationId);
```

Replace the current Super Admin-only organisation-admin guard with:

```js
if (!canManageOrganizationAccessRole(actor, organization, accessRows, accessRole)) {
    throw httpError('Only Organisation Admins and Super Admins can manage organisation access.', 403);
}
```

Keep `assertOrganizationUserAssignment(db, organizationId, body.userId)` unchanged so one-active-organisation-per-user remains enforced.

- [ ] **Step 3: Protect final Organisation Admin on revoke**

Inside `revokeOrganizationAccess`, change:

```js
await loadManageableOrganization(db, actor, organizationId);
```

to:

```js
const { organization, accessRows } = await loadManageableOrganization(db, actor, organizationId);
```

After loading `membership`, replace the current Super Admin-only admin revoke guard with:

```js
const revokeDecision = canRevokeOrganizationAccessRole(actor, organization, accessRows, membership);
if (!revokeDecision.allowed) {
    throw httpError(revokeDecision.reason, 403);
}
```

- [ ] **Step 4: Verify Task 2**

Run:

```bash
node --test server/test/governance.test.js
npm run test:server
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```bash
git add server/src/controllers/governanceController.js server/test/governance.test.js
git commit -m "Allow organisation admins to manage organisation access"
```

## Task 3: Organisation Resource Link Eligibility

**Files:**
- Modify: `/Users/sweetbuns/CareAroundSG/server/src/utils/governance.js`
- Modify: `/Users/sweetbuns/CareAroundSG/server/src/utils/organizationGuardrails.js`
- Modify: `/Users/sweetbuns/CareAroundSG/server/src/controllers/governanceController.js`
- Test: `/Users/sweetbuns/CareAroundSG/server/test/governance.test.js`

- [ ] **Step 1: Write failing link eligibility tests**

In `/Users/sweetbuns/CareAroundSG/server/test/governance.test.js`, add cases for no operators and multiple missing operators:

```js
test('resource organisation linking requires active covered operators', () => {
    const noOperators = evaluateResourceOrganizationLink({
        targetOrganizationId: 7,
        existingResourceLinks: [],
        activeOperators: [],
    });
    assert.equal(noOperators.allowed, false);
    assert.match(noOperators.reason, /active Owner or Staff/);

    const missingOperators = evaluateResourceOrganizationLink({
        targetOrganizationId: 7,
        existingResourceLinks: [],
        activeOperators: [
            { userName: 'Hyqel Zainudin', organizationMemberships: [] },
            { userName: 'Joshua Chua', organizationMemberships: [] },
        ],
    });
    assert.equal(missingOperators.allowed, false);
    assert.match(missingOperators.reason, /Hyqel Zainudin/);
    assert.match(missingOperators.reason, /Joshua Chua/);

    const coveredOperator = evaluateResourceOrganizationLink({
        targetOrganizationId: 7,
        existingResourceLinks: [],
        activeOperators: [
            {
                userName: 'Hyqel Zainudin',
                organizationMemberships: [{ organizationId: 7, organizationName: 'Entrust Healthcare Group', revokedAt: null }],
            },
        ],
    });
    assert.deepEqual(coveredOperator, { allowed: true, reason: null });
});
```

- [ ] **Step 2: Update pure link decision**

In `/Users/sweetbuns/CareAroundSG/server/src/utils/governance.js`, update `evaluateResourceOrganizationLink` after the conflicting-link check:

```js
if (!Array.isArray(activeOperators) || activeOperators.length === 0) {
    return {
        allowed: false,
        reason: 'This asset needs at least one active Owner or Staff before it can be linked to an organisation.',
    };
}

const missingOperators = [];
const crossOrganizationOperators = [];

for (const operator of activeOperators) {
    const activeMembership = (operator?.organizationMemberships || []).find((row) => (
        isActiveRow(row)
        && Number(row?.organizationId)
    ));

    if (!activeMembership) {
        missingOperators.push(userLabel(operator));
    } else if (Number(activeMembership.organizationId) !== targetId) {
        crossOrganizationOperators.push(`${userLabel(operator)} is assigned to ${organizationLabel(activeMembership)}`);
    }
}

if (missingOperators.length) {
    return {
        allowed: false,
        reason: `Cannot link this asset yet. Add ${missingOperators.join(', ')} to this organisation first.`,
    };
}

if (crossOrganizationOperators.length) {
    return {
        allowed: false,
        reason: `${crossOrganizationOperators.join('; ')}. Remove the cross-organisation access before linking this resource.`,
    };
}
```

Remove the old single-operator early returns so all missing names can be shown.

- [ ] **Step 3: Add non-throwing candidate evaluation helper**

In `/Users/sweetbuns/CareAroundSG/server/src/utils/organizationGuardrails.js`, add:

```js
export async function evaluateResourceOrganizationLinkEligibility(db, organizationId, resourceType, resourceId) {
    const [existingResourceLinks, activeOperators] = await Promise.all([
        loadRelatedResourceLinks(db, resourceType, resourceId),
        loadActiveOperatorsForResource(db, resourceType, resourceId),
    ]);

    return evaluateResourceOrganizationLink({
        targetOrganizationId: organizationId,
        existingResourceLinks,
        activeOperators,
    });
}

export async function filterOrganizationResourceLinkCandidates(db, organizationId, resourceType, candidates) {
    const evaluated = [];
    for (const candidate of candidates || []) {
        const decision = await evaluateResourceOrganizationLinkEligibility(
            db,
            organizationId,
            resourceType,
            candidate.id,
        );
        if (decision.allowed) {
            evaluated.push(candidate);
        }
    }
    return evaluated;
}
```

Update `assertResourceOrganizationLinkEligibility` to call `evaluateResourceOrganizationLinkEligibility` and throw `guardrailError(result.reason)` when blocked.

- [ ] **Step 4: Filter organisation resource candidates**

In `/Users/sweetbuns/CareAroundSG/server/src/controllers/governanceController.js`, import `filterOrganizationResourceLinkCandidates` from `organizationGuardrails.js`.

Inside `getOrganizationResourceCandidates`, replace the response mapping with:

```js
const eligibleRows = await filterOrganizationResourceLinkCandidates(
    db,
    organizationId,
    resourceType,
    rows,
);

return c.json({
    candidates: eligibleRows
        .map((row) => formatResourceCandidate(row, resourceType))
        .filter(Boolean),
});
```

Keep the existing query limits and resource-type filtering.

- [ ] **Step 5: Verify Task 3**

Run:

```bash
node --test server/test/governance.test.js
npm run test:server
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add server/src/utils/governance.js server/src/utils/organizationGuardrails.js server/src/controllers/governanceController.js server/test/governance.test.js
git commit -m "Enforce organisation resource link eligibility"
```

## Task 4: Inherited Offering Coverage From Linked Places

**Files:**
- Modify: `/Users/sweetbuns/CareAroundSG/server/src/utils/organizationGuardrails.js`
- Modify: `/Users/sweetbuns/CareAroundSG/server/src/controllers/governanceController.js`
- Test: `/Users/sweetbuns/CareAroundSG/server/test/governance.test.js`

- [ ] **Step 1: Add helper for covered offerings**

In `/Users/sweetbuns/CareAroundSG/server/src/utils/organizationGuardrails.js`, add this exported helper below `loadSoftAssetLocationIds`:

```js
export async function loadOfferingsCoveredByHardAssetLinks(db, hardAssetIds = []) {
    const ids = [...new Set((hardAssetIds || []).map(Number).filter(Boolean))];
    if (!ids.length) return [];

    const hostedRows = await db.select({
        id: softAssets.id,
        name: softAssets.name,
        hostHardAssetId: softAssets.hostHardAssetId,
    })
        .from(softAssets)
        .where(inArray(softAssets.hostHardAssetId, ids));

    const linkedRows = await db.select({
        id: softAssets.id,
        name: softAssets.name,
        hardAssetId: softAssetLocations.hardAssetId,
    })
        .from(softAssetLocations)
        .innerJoin(softAssets, eq(softAssetLocations.softAssetId, softAssets.id))
        .where(inArray(softAssetLocations.hardAssetId, ids));

    const byId = new Map();
    for (const row of hostedRows) {
        byId.set(Number(row.id), {
            id: row.id,
            resourceType: 'soft',
            resourceId: row.id,
            resourceName: row.name,
            coveredByHardAssetId: Number(row.hostHardAssetId),
            coverageSource: 'linked_place',
        });
    }
    for (const row of linkedRows) {
        byId.set(Number(row.id), {
            id: row.id,
            resourceType: 'soft',
            resourceId: row.id,
            resourceName: row.name,
            coveredByHardAssetId: Number(row.hardAssetId),
            coverageSource: 'linked_place',
        });
    }
    return [...byId.values()];
}
```

- [ ] **Step 2: Return covered offerings in organisation details**

In `/Users/sweetbuns/CareAroundSG/server/src/controllers/governanceController.js`, import `loadOfferingsCoveredByHardAssetLinks`.

Inside `listOrganizationDetails`, after direct `hardLinks` and `softLinks` are loaded, build a map of linked hard-asset IDs by organisation:

```js
const hardIdsByOrganization = new Map();
for (const link of hardLinks) {
    const organizationKey = Number(link.organizationId);
    if (!hardIdsByOrganization.has(organizationKey)) hardIdsByOrganization.set(organizationKey, []);
    hardIdsByOrganization.get(organizationKey).push(Number(link.resourceId));
}

const coveredOfferingRows = [];
for (const [organizationId, hardAssetIds] of hardIdsByOrganization.entries()) {
    const coveredOfferings = await loadOfferingsCoveredByHardAssetLinks(db, hardAssetIds);
    for (const offering of coveredOfferings) {
        coveredOfferingRows.push({ ...offering, organizationId });
    }
}
```

Return `coveredOfferings: groupByOrganization(coveredOfferingRows)` from `listOrganizationDetails`.

In `formatOrganization`, add:

```js
const coveredOfferings = grouped.coveredOfferings?.get(Number(row.id)) || [];
```

and include:

```js
coveredOfferings: coveredOfferings.map(formatResourceLink),
```

- [ ] **Step 3: Verify Task 4**

Run:

```bash
node --test server/test/governance.test.js
npm run test:server
```

Expected: PASS.

- [ ] **Step 4: Commit Task 4**

```bash
git add server/src/utils/organizationGuardrails.js server/src/controllers/governanceController.js server/test/governance.test.js
git commit -m "Show offerings covered through linked places"
```

## Task 5: Region Admin Creator Default Owner Grants

**Files:**
- Create: `/Users/sweetbuns/CareAroundSG/server/src/utils/assetCreatorOwnership.js`
- Modify: `/Users/sweetbuns/CareAroundSG/server/src/controllers/hardAssetsController.js`
- Modify: `/Users/sweetbuns/CareAroundSG/server/src/controllers/softAssetsController.js`
- Test: `/Users/sweetbuns/CareAroundSG/server/test/hardAssetStaff.test.js`
- Test: `/Users/sweetbuns/CareAroundSG/server/test/softAssetAccess.test.js`

- [ ] **Step 1: Add helper module**

Create `/Users/sweetbuns/CareAroundSG/server/src/utils/assetCreatorOwnership.js`:

```js
import { normalizeRole } from './roles.js';

export function shouldGrantCreatorDefaultHardAssetOwner(actor) {
    return normalizeRole(actor?.role) === 'regional_admin';
}

export function shouldGrantCreatorDefaultSoftAssetOwner(actor, { linkedHardAssetIds = [], hostHardAssetId = null } = {}) {
    return normalizeRole(actor?.role) === 'regional_admin'
        && !Number(hostHardAssetId)
        && (!Array.isArray(linkedHardAssetIds) || linkedHardAssetIds.length === 0);
}
```

- [ ] **Step 2: Add failing helper tests**

In `/Users/sweetbuns/CareAroundSG/server/test/hardAssetStaff.test.js`:

```js
test('region admin creator default owner applies to new places', () => {
    assert.equal(shouldGrantCreatorDefaultHardAssetOwner({ role: 'regional_admin' }), true);
    assert.equal(shouldGrantCreatorDefaultHardAssetOwner({ role: 'super_admin' }), false);
    assert.equal(shouldGrantCreatorDefaultHardAssetOwner({ role: 'standard' }), false);
});
```

In `/Users/sweetbuns/CareAroundSG/server/test/softAssetAccess.test.js`:

```js
test('region admin creator default owner applies only to standalone offerings', () => {
    assert.equal(shouldGrantCreatorDefaultSoftAssetOwner(
        { role: 'regional_admin' },
        { linkedHardAssetIds: [], hostHardAssetId: null },
    ), true);
    assert.equal(shouldGrantCreatorDefaultSoftAssetOwner(
        { role: 'regional_admin' },
        { linkedHardAssetIds: [10], hostHardAssetId: null },
    ), false);
    assert.equal(shouldGrantCreatorDefaultSoftAssetOwner(
        { role: 'regional_admin' },
        { linkedHardAssetIds: [], hostHardAssetId: 10 },
    ), false);
});
```

Import the helpers from `../server/src/utils/assetCreatorOwnership.js`.

- [ ] **Step 3: Grant default Owner on Region Admin-created places**

In `/Users/sweetbuns/CareAroundSG/server/src/controllers/hardAssetsController.js`, import:

```js
import { hardAssetStaffMemberships } from '../db/schema.js';
import { shouldGrantCreatorDefaultHardAssetOwner } from '../utils/assetCreatorOwnership.js';
```

If `hardAssetStaffMemberships` is already imported from `../db/schema.js`, add only the missing name.

After the hard asset is inserted and before cache/tag sync finishes, add:

```js
if (shouldGrantCreatorDefaultHardAssetOwner(user)) {
    await db.insert(hardAssetStaffMemberships).values({
        hardAssetId: asset.id,
        userId: user.id,
        staffRole: 'owner',
        createdByUserId: user.id,
        updatedByUserId: user.id,
    }).onConflictDoNothing();
}
```

Do not grant this for Super Admin or standard users.

- [ ] **Step 4: Grant default Owner on Region Admin-created standalone offerings**

In `/Users/sweetbuns/CareAroundSG/server/src/controllers/softAssetsController.js`, import:

```js
import { softAssetStaffMemberships } from '../db/schema.js';
import { shouldGrantCreatorDefaultSoftAssetOwner } from '../utils/assetCreatorOwnership.js';
```

If `softAssetStaffMemberships` is already imported from `../db/schema.js`, add only the missing name.

After the soft asset is inserted and after location rows are successfully synced, add:

```js
if (shouldGrantCreatorDefaultSoftAssetOwner(user, { linkedHardAssetIds: linkedIds, hostHardAssetId: asset.hostHardAssetId })) {
    await db.insert(softAssetStaffMemberships).values({
        softAssetId: asset.id,
        userId: user.id,
        staffRole: 'owner',
        createdByUserId: user.id,
        updatedByUserId: user.id,
    }).onConflictDoNothing();
}
```

Do not grant this for linked or hosted offerings.

- [ ] **Step 5: Verify Task 5**

Run:

```bash
node --test server/test/hardAssetStaff.test.js
node --test server/test/softAssetAccess.test.js
npm run test:server
```

Expected: PASS.

- [ ] **Step 6: Commit Task 5**

```bash
git add server/src/utils/assetCreatorOwnership.js server/src/controllers/hardAssetsController.js server/src/controllers/softAssetsController.js server/test/hardAssetStaff.test.js server/test/softAssetAccess.test.js
git commit -m "Grant region admin creators default owner access"
```

## Task 6: Organisation-Scoped Resource Audit Coverage

**Files:**
- Modify: `/Users/sweetbuns/CareAroundSG/server/src/utils/auditTrail.js`
- Test: `/Users/sweetbuns/CareAroundSG/server/test/auditTrail.test.js`
- Test: `/Users/sweetbuns/CareAroundSG/client/test/auditTrailPresentation.test.js`

- [ ] **Step 1: Add pure audit coverage helper tests**

In `/Users/sweetbuns/CareAroundSG/server/test/auditTrail.test.js`, add:

```js
test('audit organisation ids dedupe direct and inherited resource coverage', () => {
    assert.deepEqual(resolveEffectiveAuditOrganizationIds({
        directOrganizationId: 7,
        inheritedOrganizationIds: [],
    }), [7]);
    assert.deepEqual(resolveEffectiveAuditOrganizationIds({
        directOrganizationId: null,
        inheritedOrganizationIds: [8, 8, null],
    }), [8]);
    assert.deepEqual(resolveEffectiveAuditOrganizationIds({
        directOrganizationId: 7,
        inheritedOrganizationIds: [8],
    }), [7, 8]);
});
```

Import `resolveEffectiveAuditOrganizationIds` from `../server/src/utils/auditTrail.js`.

- [ ] **Step 2: Add pure audit coverage helper**

In `/Users/sweetbuns/CareAroundSG/server/src/utils/auditTrail.js`, add:

```js
export function resolveEffectiveAuditOrganizationIds({ directOrganizationId = null, inheritedOrganizationIds = [] } = {}) {
    const ids = [
        toPositiveInt(directOrganizationId),
        ...(inheritedOrganizationIds || []).map(toPositiveInt),
    ].filter(Boolean);
    return [...new Set(ids)].sort((left, right) => left - right);
}
```

- [ ] **Step 3: Resolve inherited organisation coverage for soft assets**

In `/Users/sweetbuns/CareAroundSG/server/src/utils/auditTrail.js`, update `loadResourceAuditOrganizationId` so it:

1. Loads direct active `organizationResourceLinks` for the resource as it does today.
2. For `resourceType === 'soft'`, loads `softAssets.hostHardAssetId` and `softAssetLocations.hardAssetId`.
3. Loads active `organizationResourceLinks` for those hard-asset IDs.
4. Builds distinct IDs with `resolveEffectiveAuditOrganizationIds`.
5. Returns the single ID when exactly one distinct organisation covers the resource.
6. Returns `null` when there are zero IDs or multiple distinct IDs.

The return contract stays compatible with current audit writing code: one `organizationId` or `null`.

- [ ] **Step 4: Add client presentation test for useful resource-change wording**

In `/Users/sweetbuns/CareAroundSG/client/test/auditTrailPresentation.test.js`, add a case using the existing audit presentation helper:

```js
test('resource change audit summaries show resource name and changed fields', () => {
    const summary = buildAuditPlainSummary({
        actionType: 'resource_updated',
        resource: { name: 'Precious Active Ageing Centre (Sunshine Gardens)', type: 'Place' },
        actor: { name: 'GudPerson' },
        metadata: { changedFields: ['phone', 'hours'] },
    });

    assert.match(summary, /GudPerson/);
    assert.match(summary, /Precious Active Ageing Centre/);
    assert.match(summary, /phone/);
    assert.match(summary, /hours/);
});
```

Import `buildAuditPlainSummary` from `/Users/sweetbuns/CareAroundSG/client/src/lib/auditTrailPresentation.js`.

- [ ] **Step 5: Verify Task 6**

Run:

```bash
node --test server/test/auditTrail.test.js
node --test client/test/auditTrailPresentation.test.js client/src/lib/*.test.js
npm run test:server
```

Expected: PASS.

- [ ] **Step 6: Commit Task 6**

```bash
git add server/src/utils/auditTrail.js server/test/auditTrail.test.js client/test/auditTrailPresentation.test.js
git commit -m "Associate resource audits with organisation coverage"
```

## Task 7: Organisation Workspace Route And Navigation

**Files:**
- Modify: `/Users/sweetbuns/CareAroundSG/client/src/lib/roles.js`
- Modify: `/Users/sweetbuns/CareAroundSG/client/src/App.jsx`
- Create: `/Users/sweetbuns/CareAroundSG/client/src/pages/dashboard/OrganizationWorkspacePage.jsx`
- Modify: `/Users/sweetbuns/CareAroundSG/client/src/components/dashboard/DashboardNavigation.jsx`
- Modify: `/Users/sweetbuns/CareAroundSG/client/src/lib/i18n.js`
- Test: `/Users/sweetbuns/CareAroundSG/client/test/dashboardNavigationRecovery.test.js`
- Test: `/Users/sweetbuns/CareAroundSG/client/test/i18nCoverage.test.js`

- [ ] **Step 1: Add role helper**

In `/Users/sweetbuns/CareAroundSG/client/src/lib/roles.js`, add below `hasOrganizationAdminAccess`:

```js
export function canAccessOrganizationWorkspace(user) {
    return getOrganizationAccess(user).length > 0;
}
```

- [ ] **Step 2: Add protected route**

In `/Users/sweetbuns/CareAroundSG/client/src/App.jsx`, import `canAccessOrganizationWorkspace`, add support for a `requireOrganizationAccess` prop in `ProtectedRoute`, and use:

```jsx
if (requireOrganizationAccess && !canAccessOrganizationWorkspace(user)) {
    return <Navigate to="/dashboard" replace />;
}
```

Create the lazy import:

```js
const OrganizationWorkspacePage = lazy(() => import('./pages/dashboard/OrganizationWorkspacePage.jsx'));
```

Add the route under `/dashboard`:

```jsx
<Route
    path="organization"
    element={(
        <ProtectedRoute requireOrganizationAccess>
            <OrganizationWorkspacePage />
        </ProtectedRoute>
    )}
/>
```

- [ ] **Step 3: Create page wrapper**

Create `/Users/sweetbuns/CareAroundSG/client/src/pages/dashboard/OrganizationWorkspacePage.jsx`:

```jsx
import GovernanceOrganizationsPanel from '../../components/admin/GovernanceOrganizationsPanel.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { getOrganizationAccess } from '../../lib/roles.js';

export default function OrganizationWorkspacePage() {
    const { user } = useAuth();
    const canManage = getOrganizationAccess(user)
        .some((entry) => String(entry?.accessRole || '').trim().toLowerCase() === 'admin');

    return (
        <main className="max-w-7xl mx-auto px-4 py-10 sm:px-6 lg:px-8">
            <GovernanceOrganizationsPanel
                workspaceMode="organization"
                readOnly={!canManage}
                showCreateControls={false}
            />
        </main>
    );
}
```

- [ ] **Step 4: Add dashboard navigation link**

In `/Users/sweetbuns/CareAroundSG/client/src/components/dashboard/DashboardNavigation.jsx`, import `Building2` from `lucide-react` and `canAccessOrganizationWorkspace` from `../../lib/roles.js`.

Add:

```js
const canShowOrganizationWorkspace = canAccessOrganizationWorkspace(user);
```

Render the link:

```jsx
{canShowOrganizationWorkspace ? (
    <SidebarLink
        to="/dashboard/organization"
        icon={Building2}
        label={t('organisationWorkspaceTitle')}
        id="dash-organization"
        onNavigate={onNavigate}
    />
) : null}
```

Update section labeling so `/dashboard/organization` resolves to `organisationWorkspaceTitle`.

- [ ] **Step 5: Add translation key**

In `/Users/sweetbuns/CareAroundSG/client/src/lib/i18n.js`, add:

```js
organisationWorkspaceTitle: 'Organisation',
```

Add the equivalent key to each existing locale object. Use the English value for locales where the project already uses English fallbacks.

- [ ] **Step 6: Verify Task 7**

Run:

```bash
node --test client/test/dashboardNavigationRecovery.test.js client/test/i18nCoverage.test.js client/src/lib/*.test.js
npm run build:client
```

Expected: PASS, with only the existing large chunk warning if it still appears.

- [ ] **Step 7: Commit Task 7**

```bash
git add client/src/lib/roles.js client/src/App.jsx client/src/pages/dashboard/OrganizationWorkspacePage.jsx client/src/components/dashboard/DashboardNavigation.jsx client/src/lib/i18n.js client/test/dashboardNavigationRecovery.test.js client/test/i18nCoverage.test.js
git commit -m "Add organisation workspace route"
```

## Task 8: Governance Panel Modes

**Files:**
- Modify: `/Users/sweetbuns/CareAroundSG/client/src/components/admin/GovernanceOrganizationsPanel.jsx`
- Modify: `/Users/sweetbuns/CareAroundSG/client/src/lib/governanceOrganizationUi.js`
- Test: `/Users/sweetbuns/CareAroundSG/client/test/governanceOrganizationUi.test.js`

- [ ] **Step 1: Add panel mode props**

Change the component signature:

```jsx
export default function GovernanceOrganizationsPanel({
    workspaceMode = 'admin',
    readOnly = false,
    showCreateControls = true,
} = {}) {
```

Add derived booleans near other state setup:

```js
const isOrganizationWorkspace = workspaceMode === 'organization';
const canCreateOrganization = showCreateControls && !readOnly;
const canManageOrganization = !readOnly;
```

- [ ] **Step 2: Hide create controls outside Admin Tools**

Use `canCreateOrganization` for the New button, create form, and delete-empty-draft control.

Expected behavior:

- Super Admin in Admin Tools keeps create/delete-empty-draft behavior.
- Organisation Admin in Organisation Workspace does not see New organisation.
- Organisation Staff in Organisation Workspace does not see New organisation.

- [ ] **Step 3: Guard management controls**

Use `canManageOrganization` to hide or disable:

- save profile
- archive organisation
- add access
- remove access
- link resource
- unlink resource
- create agreement
- update agreement
- revoke agreement

Keep visible in read-only mode:

- organisation profile values
- organisation access list
- linked resources
- covered offerings
- agreement records and coverage status

- [ ] **Step 4: Show covered offerings separately**

Render `selectedOrganization.coveredOfferings` below direct links with plain-language copy:

```jsx
{selectedOrganization.coveredOfferings?.length ? (
    <section>
        <h4>Programmes and services covered through linked places</h4>
        <p>These are covered because their place is linked to this organisation.</p>
        {selectedOrganization.coveredOfferings.map((resource) => (
            <div key={`covered-${resource.resourceType}-${resource.resourceId}`}>
                <strong>{resource.resourceName}</strong>
            </div>
        ))}
    </section>
) : null}
```

- [ ] **Step 5: Add UI tests**

In `/Users/sweetbuns/CareAroundSG/client/src/lib/governanceOrganizationUi.js`, add:

```js
const READ_ONLY_HIDDEN_CONTROLS = new Set([
    'saveProfile',
    'archiveOrganization',
    'deleteEmptyDraft',
    'addAccess',
    'revokeAccess',
    'linkResource',
    'unlinkResource',
    'saveAgreement',
    'revokeAgreement',
]);

export function isGovernanceControlVisible({ readOnly = false, control = '' } = {}) {
    return !(readOnly && READ_ONLY_HIDDEN_CONTROLS.has(control));
}

export function formatCoveredOfferingExplanation(count = 0) {
    const total = Number(count) || 0;
    if (total <= 0) return '';
    return `${total} programme${total === 1 ? '' : 's'} and service${total === 1 ? '' : 's'} are covered because their places are linked.`;
}
```

In `/Users/sweetbuns/CareAroundSG/client/test/governanceOrganizationUi.test.js`, add:

```js
assert.equal(isGovernanceControlVisible({ readOnly: true, control: 'addAccess' }), false);
assert.equal(isGovernanceControlVisible({ readOnly: false, control: 'addAccess' }), true);
assert.equal(formatCoveredOfferingExplanation(2), '2 programmes and services are covered because their places are linked.');
```

Use `isGovernanceControlVisible` inside `GovernanceOrganizationsPanel.jsx` for the management controls listed above, and use `formatCoveredOfferingExplanation` for the covered-offerings explanatory text.

- [ ] **Step 6: Verify Task 8**

Run:

```bash
node --test client/test/governanceOrganizationUi.test.js client/src/lib/governanceAgreementUi.test.js
npm run build:client
```

Expected: PASS.

- [ ] **Step 7: Commit Task 8**

```bash
git add client/src/components/admin/GovernanceOrganizationsPanel.jsx client/src/lib/governanceOrganizationUi.js client/test/governanceOrganizationUi.test.js
git commit -m "Add organisation governance panel modes"
```

## Task 9: Final Verification And Regression Ledger

**Files:**
- Modify: `/Users/sweetbuns/CareAroundSG/docs/regression-ledger.md`

- [ ] **Step 1: Run focused server tests**

```bash
node --test server/test/governance.test.js
node --test server/test/auditTrail.test.js
node --test server/test/hardAssetStaff.test.js
node --test server/test/softAssetAccess.test.js
```

Expected: PASS.

- [ ] **Step 2: Run full server tests**

```bash
npm run test:server
```

Expected: PASS.

- [ ] **Step 3: Run client tests and build**

```bash
node --test client/test/*.test.js client/src/lib/*.test.js
npm run build:client
```

Expected: PASS, with only the existing large chunk warning if it still appears.

- [ ] **Step 4: Check formatting**

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 5: Manual local UAT**

Use the existing safe local environment when available. Verify:

- Super Admin can create an organisation and assign the first Organisation Admin.
- Organisation Admin can add and remove Organisation Admins and Staff.
- Organisation Admin cannot remove the final active Organisation Admin.
- Organisation Staff can open Organisation Workspace read-only.
- Organisation Staff cannot see Audit Trail.
- Organisation Admin can link an eligible place.
- Linked place shows covered offerings.
- Organisation Admin can link a standalone offering.
- Asset with no direct operators is not selectable.
- Asset with missing operator organisation membership is blocked with the missing user's name.
- Region Admin-created place shows the Region Admin as Owner.
- Region Admin-created standalone offering shows the Region Admin as Owner.
- Direct asset Staff/Owner scoped resource lists still behave like the 2026-06-02 locked baseline.

- [ ] **Step 6: Update regression ledger**

Add a dated ledger row for Organisation Governance Access with:

- current behavior
- known-good reference
- reproduction steps
- acceptance criteria
- verification result and command list

- [ ] **Step 7: Commit Task 9**

```bash
git add docs/regression-ledger.md
git commit -m "Record organisation governance access baseline"
```

## Execution Order

Implement in this order:

1. Task 1: pure permission helpers.
2. Task 2: Organisation Admin access management.
3. Task 3: organisation resource link eligibility.
4. Task 4: inherited offering coverage.
5. Task 5: Region Admin creator default Owner grants.
6. Task 6: organisation-scoped resource audit coverage.
7. Task 7: Organisation Workspace route and navigation.
8. Task 8: governance panel modes.
9. Task 9: final verification and ledger.

Commit after each task. Do not deploy until all tests pass, the ledger is updated, and the user explicitly approves deployment.

## Self-Review Notes

- Spec coverage: all approved Organisation Admin, Organisation Staff, Region Admin creator default Owner, asset link eligibility, inherited offering coverage, and audit expectations are assigned to tasks.
- Regression protection: direct asset edit permissions remain separate; organisation access remains governance-only.
- Privacy protection: public Discover, saved maps, shared maps, auth, Gmail/email, GudAuth, and secrets remain untouched.
- Verification: focused server and client checks run before the broader suite and build.
