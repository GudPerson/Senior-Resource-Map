# Overlapping Regions and Asset Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Region boundaries overlap-aware while keeping edit authority tied to explicit hard-asset or standalone-soft-asset Owner/Staff access.

**Architecture:** Add a shared Region scope layer that derives read relevance from postal-code or standalone-service coverage. Keep legacy `subregion_id` as primary/default metadata during transition, but move write authority to explicit access memberships. Implement in phases so read scope, access lifecycle, standalone coverage, UI controls, and create/import routing can be tested independently.

**Tech Stack:** Hono Worker API, Drizzle ORM, Neon Postgres, React/Vite client, Node test runner, Cloudflare Worker runtime.

---

## Scope Notes

- Do not remove `subregion_id` columns in this plan.
- Do not grant Region Admin edit rights from Region overlap.
- Do not merge standalone soft assets into hard asset access; standalone offerings need direct soft-asset access.
- Keep Super Admin global override behavior.
- Keep linked and hosted soft assets inheriting edit authority from linked hard assets.

## File Structure

- Create `server/src/utils/regionScope.js`: overlap-aware Region matching and permission helper entry points.
- Create `server/test/regionScope.test.js`: focused tests for overlapping postal coverage and read relevance.
- Modify `server/src/utils/ownership.js`: route asset edit checks through explicit access helpers.
- Modify `server/src/utils/hardAssetStaff.js`: ownership lifecycle rules for first owner, owner handover, and last-owner guard.
- Modify `server/src/controllers/hardAssetStaffController.js`: enforce new Owner/Staff lifecycle and messages.
- Modify `server/src/middleware/auth.js`: expose direct resource-operator authorization instead of Partner-role gates for dashboard resource routes.
- Modify `server/src/routes/hardAssets.js`, `server/src/routes/softAssets.js`, `server/src/routes/softAssetParents.js`, `server/src/routes/audienceZones.js`, and `server/src/routes/upload.js`: use direct resource-operator authorization for dashboard resource workflows.
- Modify `client/src/pages/dashboard/AdminPage.jsx`: remove Partner from the user-type dropdown.
- Modify `server/src/controllers/hardAssetsController.js`: overlap-aware read scope and row permission metadata.
- Modify `server/src/controllers/softAssetsController.js`: standalone coverage-aware read scope and direct soft access permissions.
- Modify `server/src/db/schema.js`: add standalone soft-asset coverage and staff membership tables.
- Modify `server/src/utils/boundarySchema.js`: explicit schema bootstrap for new tables.
- Create `server/src/utils/softAssetAccess.js`: direct standalone soft-asset Owner/Staff lifecycle helpers.
- Create `server/src/controllers/softAssetAccessController.js`: standalone soft-asset access API.
- Modify `server/src/routes/softAssets.js`: add standalone soft-asset access routes.
- Modify `client/src/lib/api.js`: add soft-asset access and coverage endpoints.
- Modify `client/src/components/AssetAccessPanel.jsx`: generalize the existing panel through an `assetType` API adapter.
- Modify `client/src/pages/dashboard/ResourcesPage.jsx`: use `canEdit`/`canManageAccess` row permissions and show coverage controls for standalone offerings.
- Create `server/test/softAssetAccess.test.js`: standalone soft-asset access lifecycle tests.
- Create `server/test/overlappingRegionResourceLists.test.js`: endpoint-level count and permission tests.

---

### Task 1: Add Overlap-Aware Region Scope Helper

**Files:**
- Create: `server/src/utils/regionScope.js`
- Test: `server/test/regionScope.test.js`

- [ ] **Step 1: Write failing tests for overlapping postal-code read relevance**

Create `server/test/regionScope.test.js` with:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    getActorRegionIds,
    hardAssetMatchesActorRegions,
    standaloneSoftAssetMatchesActorRegions,
    summarizeMatchingRegions,
} from '../src/utils/regionScope.js';

function actor(overrides = {}) {
    return {
        id: 1,
        role: 'regional_admin',
        subregionIds: [10],
        ...overrides,
    };
}

test('hard asset read relevance follows overlapping postal-code regions', () => {
    const asset = {
        id: 99,
        postalCode: '680153',
        matchingRegionIds: [10, 20, 30],
        subregionId: 20,
    };

    assert.equal(hardAssetMatchesActorRegions(actor({ subregionIds: [10] }), asset), true);
    assert.equal(hardAssetMatchesActorRegions(actor({ subregionIds: [30] }), asset), true);
    assert.equal(hardAssetMatchesActorRegions(actor({ subregionIds: [40] }), asset), false);
});

test('super admin is region-relevant for every hard asset', () => {
    const asset = {
        id: 99,
        postalCode: '680153',
        matchingRegionIds: [],
        subregionId: null,
    };

    assert.equal(hardAssetMatchesActorRegions(actor({ role: 'super_admin', subregionIds: [] }), asset), true);
});

test('standalone soft asset read relevance follows explicit service region coverage', () => {
    const offering = {
        id: 501,
        assetMode: 'standalone',
        coverageRegionIds: [10, 30],
    };

    assert.equal(standaloneSoftAssetMatchesActorRegions(actor({ subregionIds: [10] }), offering), true);
    assert.equal(standaloneSoftAssetMatchesActorRegions(actor({ subregionIds: [20] }), offering), false);
});

test('hard asset direct owner or staff access grants relevance without a region match', () => {
    const asset = {
        id: 77,
        matchingRegionIds: [],
    };

    assert.equal(hardAssetMatchesActorRegions(actor({
        subregionIds: [],
        hardAssetStaffAccess: [{ hardAssetId: 77, staffRole: 'staff' }],
    }), asset), true);
});

test('matching region summary is stable and numeric', () => {
    assert.deepEqual(summarizeMatchingRegions([
        { id: '30' },
        { id: 10 },
        { id: 10 },
        { id: 'bad' },
    ]), [10, 30]);
});

test('actor region ids are normalized from session payload', () => {
    assert.deepEqual(getActorRegionIds(actor({ subregionIds: ['20', 10, 'bad', 20] })), [10, 20]);
});
```

- [ ] **Step 2: Run the tests to verify the helper is missing**

Run:

```bash
node --test test/regionScope.test.js
```

Expected: failure with `ERR_MODULE_NOT_FOUND` for `server/src/utils/regionScope.js`.

- [ ] **Step 3: Implement minimal helper**

Create `server/src/utils/regionScope.js`:

```js
import { hasHardAssetStaffAccess } from './hardAssetStaff.js';
import { normalizeRole } from './roles.js';

function toInteger(value) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isInteger(parsed) ? parsed : null;
}

function uniqueSortedIntegers(values = []) {
    return [...new Set(
        values
            .map(toInteger)
            .filter(Number.isInteger)
    )].sort((left, right) => left - right);
}

export function getActorRegionIds(actor) {
    return uniqueSortedIntegers(Array.isArray(actor?.subregionIds) ? actor.subregionIds : []);
}

export function summarizeMatchingRegions(regions = []) {
    return uniqueSortedIntegers(regions.map((region) => region?.id ?? region));
}

export function getAssetMatchingRegionIds(asset) {
    return uniqueSortedIntegers([
        ...(Array.isArray(asset?.matchingRegionIds) ? asset.matchingRegionIds : []),
        ...(Array.isArray(asset?.coverageRegionIds) ? asset.coverageRegionIds : []),
    ]);
}

export function actorMatchesAnyRegion(actor, regionIds = []) {
    if (normalizeRole(actor?.role) === 'super_admin') return true;
    const actorRegionIds = new Set(getActorRegionIds(actor));
    return uniqueSortedIntegers(regionIds).some((regionId) => actorRegionIds.has(regionId));
}

export function hardAssetMatchesActorRegions(actor, asset) {
    if (normalizeRole(actor?.role) === 'super_admin') return true;
    if (hasHardAssetStaffAccess(actor, asset?.id, ['owner', 'staff'])) return true;
    return actorMatchesAnyRegion(actor, getAssetMatchingRegionIds(asset));
}

export function standaloneSoftAssetMatchesActorRegions(actor, offering) {
    if (normalizeRole(actor?.role) === 'super_admin') return true;
    return actorMatchesAnyRegion(actor, offering?.coverageRegionIds || []);
}
```

- [ ] **Step 4: Run helper tests**

Run:

```bash
node --test test/regionScope.test.js
```

Expected: all tests in `regionScope.test.js` pass.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git add server/src/utils/regionScope.js server/test/regionScope.test.js
git commit -m "feat: add overlap-aware region scope helpers"
```

---

### Task 2: Add Region Match Loading for Hard Assets

**Files:**
- Modify: `server/src/controllers/hardAssetsController.js`
- Modify: `server/src/utils/regionScope.js`
- Test: `server/test/overlappingRegionResourceLists.test.js`

- [ ] **Step 1: Write failing endpoint-style tests for hard asset region overlap**

Create `server/test/overlappingRegionResourceLists.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    attachHardAssetRegionMatches,
    filterHardAssetsByRegionRelevance,
} from '../src/utils/regionScope.js';

function actor(overrides = {}) {
    return {
        id: 7,
        role: 'regional_admin',
        subregionIds: [10],
        hardAssetStaffAccess: [],
        ...overrides,
    };
}

test('hard asset list relevance uses matchingRegionIds instead of primary subregion only', () => {
    const rows = [
        { id: 1, postalCode: '111111', subregionId: 20, matchingRegionIds: [10, 20] },
        { id: 2, postalCode: '222222', subregionId: 20, matchingRegionIds: [20] },
        { id: 3, postalCode: '333333', subregionId: 10, matchingRegionIds: [10] },
    ];

    const scoped = filterHardAssetsByRegionRelevance(rows, actor({ subregionIds: [10] }));

    assert.deepEqual(scoped.map((asset) => asset.id), [1, 3]);
});

test('attachHardAssetRegionMatches maps postal-code rows onto matchingRegionIds', () => {
    const assets = [
        { id: 1, postalCode: '111111' },
        { id: 2, postalCode: '222222' },
    ];
    const regionRows = [
        { postalCode: '111111', subregionId: 10 },
        { postalCode: '111111', subregionId: 20 },
        { postalCode: '222222', subregionId: 30 },
    ];

    const attached = attachHardAssetRegionMatches(assets, regionRows);

    assert.deepEqual(attached.map((asset) => [asset.id, asset.matchingRegionIds]), [
        [1, [10, 20]],
        [2, [30]],
    ]);
});
```

- [ ] **Step 2: Run the new tests to verify missing exports**

Run:

```bash
node --test test/overlappingRegionResourceLists.test.js
```

Expected: failure mentioning `attachHardAssetRegionMatches` or `filterHardAssetsByRegionRelevance` is not exported.

- [ ] **Step 3: Add pure mapping helpers**

Append to `server/src/utils/regionScope.js`:

```js
export function attachHardAssetRegionMatches(assets = [], regionRows = []) {
    const regionsByPostalCode = new Map();
    for (const row of regionRows) {
        const postalCode = String(row?.postalCode || '').trim();
        const subregionId = toInteger(row?.subregionId);
        if (!postalCode || !subregionId) continue;
        if (!regionsByPostalCode.has(postalCode)) regionsByPostalCode.set(postalCode, []);
        regionsByPostalCode.get(postalCode).push(subregionId);
    }

    return assets.map((asset) => ({
        ...asset,
        matchingRegionIds: uniqueSortedIntegers(regionsByPostalCode.get(String(asset?.postalCode || '').trim()) || []),
    }));
}

export function filterHardAssetsByRegionRelevance(assets = [], actor) {
    if (normalizeRole(actor?.role) === 'super_admin') return assets;
    return assets.filter((asset) => hardAssetMatchesActorRegions(actor, asset));
}
```

- [ ] **Step 4: Run the mapping tests**

Run:

```bash
node --test test/regionScope.test.js test/overlappingRegionResourceLists.test.js
```

Expected: both test files pass.

- [ ] **Step 5: Wire hard asset controller read scope**

In `server/src/controllers/hardAssetsController.js`, import:

```js
import { attachHardAssetRegionMatches, filterHardAssetsByRegionRelevance } from '../utils/regionScope.js';
import { subregionPostalCodes } from '../db/schema.js';
```

In `getHardAssets`, after loading `candidateAssets`, add:

```js
const candidatePostalCodes = [...new Set(candidateAssets.map((asset) => asset.postalCode).filter(Boolean))];
const regionRows = candidatePostalCodes.length > 0
    ? await db.select({
        postalCode: subregionPostalCodes.postalCode,
        subregionId: subregionPostalCodes.subregionId,
    })
        .from(subregionPostalCodes)
        .where(inArray(subregionPostalCodes.postalCode, candidatePostalCodes))
    : [];
const candidateAssetsWithRegions = attachHardAssetRegionMatches(candidateAssets, regionRows);
```

Then replace the hard asset region-admin list filter source:

```js
const regionRelevantAssets = listScope === 'managed'
    ? filterHardAssetsByRegionRelevance(candidateAssetsWithRegions, user)
    : candidateAssetsWithRegions;
const scopedAssets = filterHardAssetsForResourceList(regionRelevantAssets, user, {
    scope: listScope,
    isVisible: (asset) => isAssetVisible(asset, user, { ownerPartner: asset.partner }),
});
```

When hydrating the paged assets, reattach matching IDs:

```js
const matchIdsByAssetId = new Map(pagedAssetSummaries.map((asset) => [asset.id, asset.matchingRegionIds || []]));
const pagedAssets = assets
    .sort((left, right) => (assetOrder.get(left.id) ?? 0) - (assetOrder.get(right.id) ?? 0))
    .map((asset) => ({
        ...asset,
        matchingRegionIds: matchIdsByAssetId.get(asset.id) || [],
    }));
```

- [ ] **Step 6: Run targeted tests and server tests**

Run:

```bash
node --test test/regionScope.test.js test/overlappingRegionResourceLists.test.js
npm run test --workspace=server
```

Expected: targeted tests pass, then full server test suite passes.

- [ ] **Step 7: Commit Task 2**

Run:

```bash
git add server/src/utils/regionScope.js server/src/controllers/hardAssetsController.js server/test/overlappingRegionResourceLists.test.js
git commit -m "feat: scope hard asset lists by overlapping regions"
```

---

### Task 3: Correct Hard Asset Owner Lifecycle

**Files:**
- Modify: `server/src/utils/hardAssetStaff.js`
- Modify: `server/src/controllers/hardAssetStaffController.js`
- Test: `server/test/hardAssetStaff.test.js`

- [ ] **Step 1: Add failing lifecycle tests**

Append to `server/test/hardAssetStaff.test.js`:

```js
test('super admin can assign first owner but region admin cannot self-claim ownership', () => {
    const emptyAsset = { id: 12, subregionId: 4, activeOwnerCount: 0 };
    const superAdmin = actor({ role: 'super_admin' });
    const regionAdmin = actor({ role: 'regional_admin', subregionIds: [4] });

    assert.equal(canAssignHardAssetStaffRole(superAdmin, emptyAsset, 'owner'), true);
    assert.equal(canAssignHardAssetStaffRole(regionAdmin, emptyAsset, 'owner'), false);
});

test('active owners can add additional owners and staff after first owner exists', () => {
    const ownedAsset = { id: 12, subregionId: 4, activeOwnerCount: 1 };
    const owner = actor({
        hardAssetStaffAccess: [{
            hardAssetId: 12,
            staffRole: 'owner',
            subregionId: 4,
        }],
    });

    assert.equal(canAssignHardAssetStaffRole(owner, ownedAsset, 'owner'), true);
    assert.equal(canAssignHardAssetStaffRole(owner, ownedAsset, 'staff'), true);
});

test('last owner cannot be revoked by owner or super admin', () => {
    const ownedAsset = { id: 12, subregionId: 4, activeOwnerCount: 1 };
    const owner = actor({
        hardAssetStaffAccess: [{
            hardAssetId: 12,
            staffRole: 'owner',
            subregionId: 4,
        }],
    });
    const superAdmin = actor({ role: 'super_admin' });

    assert.equal(canRevokeHardAssetStaffMembership(owner, ownedAsset, { staffRole: 'owner' }), false);
    assert.equal(canRevokeHardAssetStaffMembership(superAdmin, ownedAsset, { staffRole: 'owner' }), false);
});
```

- [ ] **Step 2: Run lifecycle tests to verify failure**

Run:

```bash
node --test test/hardAssetStaff.test.js
```

Expected: failure where Region Admin can still add Owner or owner cannot add Owner.

- [ ] **Step 3: Add owner-count helper and revise assignment rules**

In `server/src/utils/hardAssetStaff.js`, add:

```js
export function countActiveOwners(rows = []) {
    return rows.filter((row) => normalizeHardAssetStaffRole(row?.staffRole) === 'owner' && !row?.revokedAt).length;
}

function getActiveOwnerCount(hardAsset) {
    const parsed = toInteger(hardAsset?.activeOwnerCount);
    return parsed || 0;
}
```

Replace `canAssignHardAssetStaffRole` with:

```js
export function canAssignHardAssetStaffRole(actor, hardAsset, staffRole) {
    const actorRole = normalizeRole(actor?.role);
    const nextRole = normalizeHardAssetStaffRole(staffRole);
    if (!actor || !hardAsset || !nextRole) return false;

    const hasOwner = getActiveOwnerCount(hardAsset) > 0;
    if (actorRole === 'super_admin') return true;

    if (hasHardAssetStaffAccess(actor, hardAsset.id, ['owner'])) {
        return hasOwner;
    }

    return false;
}
```

Replace `canRevokeHardAssetStaffMembership` with:

```js
export function canRevokeHardAssetStaffMembership(actor, hardAsset, membership) {
    const actorRole = normalizeRole(actor?.role);
    const membershipRole = normalizeHardAssetStaffRole(membership?.staffRole);
    if (!actor || !hardAsset || !membershipRole) return false;

    if (membershipRole === 'owner' && getActiveOwnerCount(hardAsset) <= 1) {
        return false;
    }

    if (actorRole === 'super_admin') return true;
    return hasHardAssetStaffAccess(actor, hardAsset.id, ['owner']);
}
```

- [ ] **Step 4: Update controller to provide activeOwnerCount**

In `server/src/controllers/hardAssetStaffController.js`, after `loadHardAssetForAccess`, load staff rows before permission checks where owner count is needed:

```js
const staffRows = await loadHardAssetStaffRows(db, hardAsset.id);
const hardAssetWithOwnerCount = {
    ...hardAsset,
    activeOwnerCount: staffRows.filter((row) => normalizeRole(row.staffRole) === 'owner').length,
};
```

Use `hardAssetWithOwnerCount` for:

```js
buildAccessPermissions(actor, hardAssetWithOwnerCount)
canAssignHardAssetStaffRole(actor, hardAssetWithOwnerCount, staffRole)
canRevokeHardAssetStaffMembership(actor, hardAssetWithOwnerCount, membership)
```

Keep `hardAsset.id`, `hardAsset.name`, and DB mutation references unchanged.

- [ ] **Step 5: Update user-facing messages**

In `addHardAssetStaff`, replace the Owner denial message with:

```js
error: staffRole === 'owner'
    ? 'Only Super Admins can assign the first Owner. Existing Owners can add more Owners after ownership is established.'
    : 'Only asset Owners can add asset Staff after ownership is established.',
```

In revoke handling, when last owner is blocked, return:

```js
return c.json({ error: 'An asset must keep at least one active Owner.' }, 400);
```

- [ ] **Step 6: Run tests**

Run:

```bash
node --test test/hardAssetStaff.test.js
npm run test --workspace=server
```

Expected: hard asset staff tests pass, then full server suite passes.

- [ ] **Step 7: Commit Task 3**

Run:

```bash
git add server/src/utils/hardAssetStaff.js server/src/controllers/hardAssetStaffController.js server/test/hardAssetStaff.test.js
git commit -m "feat: enforce asset owner lifecycle rules"
```

---

### Task 4: Add Standalone Soft Asset Coverage and Access Schema

**Files:**
- Modify: `server/src/db/schema.js`
- Modify: `server/src/utils/boundarySchema.js`
- Test: `server/test/softAssetAccess.test.js`

- [ ] **Step 1: Add failing schema shape tests**

Create `server/test/softAssetAccess.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    softAssetRegionCoverages,
    softAssetStaffMemberships,
} from '../src/db/schema.js';

test('standalone soft asset coverage schema exposes soft asset and region ids', () => {
    assert.equal(softAssetRegionCoverages.softAssetId.name, 'soft_asset_id');
    assert.equal(softAssetRegionCoverages.subregionId.name, 'subregion_id');
});

test('standalone soft asset staff schema exposes owner and staff fields', () => {
    assert.equal(softAssetStaffMemberships.softAssetId.name, 'soft_asset_id');
    assert.equal(softAssetStaffMemberships.userId.name, 'user_id');
    assert.equal(softAssetStaffMemberships.staffRole.name, 'staff_role');
    assert.equal(softAssetStaffMemberships.revokedAt.name, 'revoked_at');
});
```

- [ ] **Step 2: Run schema tests to verify missing exports**

Run:

```bash
node --test test/softAssetAccess.test.js
```

Expected: failure that the schema exports are missing.

- [ ] **Step 3: Add Drizzle schema tables**

In `server/src/db/schema.js`, add after `hardAssetStaffMemberships`:

```js
export const softAssetRegionCoverages = pgTable('soft_asset_region_coverages', {
  softAssetId: integer('soft_asset_id').references(() => softAssets.id, { onDelete: 'cascade' }).notNull(),
  subregionId: integer('subregion_id').references(() => subregions.id, { onDelete: 'cascade' }).notNull(),
  createdByUserId: integer('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  updatedByUserId: integer('updated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.softAssetId, table.subregionId] }),
  softAssetIdx: index('soft_asset_region_coverages_soft_asset_idx').on(table.softAssetId),
  subregionIdx: index('soft_asset_region_coverages_subregion_idx').on(table.subregionId),
}));

export const softAssetStaffMemberships = pgTable('soft_asset_staff_memberships', {
  id: serial('id').primaryKey(),
  softAssetId: integer('soft_asset_id').references(() => softAssets.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  staffRole: varchar('staff_role', { length: 40 }).notNull().default('staff'),
  revokedAt: timestamp('revoked_at'),
  createdByUserId: integer('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  updatedByUserId: integer('updated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  activeUserUnique: uniqueIndex('soft_asset_staff_memberships_active_user_unique')
    .on(table.softAssetId, table.userId)
    .where(sql`${table.revokedAt} IS NULL`),
  softAssetIdx: index('soft_asset_staff_memberships_soft_asset_idx').on(table.softAssetId),
  userIdx: index('soft_asset_staff_memberships_user_idx').on(table.userId),
  roleIdx: index('soft_asset_staff_memberships_role_idx').on(table.staffRole),
}));
```

- [ ] **Step 4: Add schema bootstrap SQL**

In `server/src/utils/boundarySchema.js`, add table creation SQL next to hard asset staff setup:

```js
await db.execute(sql`
    CREATE TABLE IF NOT EXISTS soft_asset_region_coverages (
        soft_asset_id INTEGER NOT NULL REFERENCES soft_assets(id) ON DELETE CASCADE,
        subregion_id INTEGER NOT NULL REFERENCES subregions(id) ON DELETE CASCADE,
        created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        updated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (soft_asset_id, subregion_id)
    )
`);
await db.execute(sql`
    CREATE TABLE IF NOT EXISTS soft_asset_staff_memberships (
        id SERIAL PRIMARY KEY,
        soft_asset_id INTEGER NOT NULL REFERENCES soft_assets(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        staff_role VARCHAR(40) NOT NULL DEFAULT 'staff',
        revoked_at TIMESTAMP,
        created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        updated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
    )
`);
await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS soft_asset_staff_memberships_active_user_unique ON soft_asset_staff_memberships (soft_asset_id, user_id) WHERE revoked_at IS NULL`);
await db.execute(sql`CREATE INDEX IF NOT EXISTS soft_asset_staff_memberships_soft_asset_idx ON soft_asset_staff_memberships (soft_asset_id)`);
await db.execute(sql`CREATE INDEX IF NOT EXISTS soft_asset_staff_memberships_user_idx ON soft_asset_staff_memberships (user_id)`);
await db.execute(sql`CREATE INDEX IF NOT EXISTS soft_asset_region_coverages_soft_asset_idx ON soft_asset_region_coverages (soft_asset_id)`);
await db.execute(sql`CREATE INDEX IF NOT EXISTS soft_asset_region_coverages_subregion_idx ON soft_asset_region_coverages (subregion_id)`);
```

- [ ] **Step 5: Run schema tests and bootstrap locally**

Run:

```bash
node --test test/softAssetAccess.test.js
npm run bootstrap:boundary-schema --workspace=server
```

Expected: schema tests pass and bootstrap completes without SQL errors.

- [ ] **Step 6: Commit Task 4**

Run:

```bash
git add server/src/db/schema.js server/src/utils/boundarySchema.js server/test/softAssetAccess.test.js
git commit -m "feat: add standalone soft asset access schema"
```

---

### Task 5: Implement Standalone Soft Asset Access Helpers and API

**Files:**
- Create: `server/src/utils/softAssetAccess.js`
- Create: `server/src/controllers/softAssetAccessController.js`
- Modify: `server/src/routes/softAssets.js`
- Modify: `server/src/controllers/authController.js`
- Modify: `server/src/controllers/userController.js`
- Modify: `server/src/utils/phoneLogin.js`
- Modify: `server/src/utils/sessionAuth.js`
- Modify: `server/src/middleware/auth.js`
- Test: `server/test/softAssetAccess.test.js`

- [ ] **Step 1: Add failing helper tests**

Append to `server/test/softAssetAccess.test.js`:

```js
import {
    canAssignSoftAssetStaffRole,
    canRevokeSoftAssetStaffMembership,
    hasSoftAssetStaffAccess,
} from '../src/utils/softAssetAccess.js';

function actor(overrides = {}) {
    return {
        id: 1,
        role: 'standard',
        softAssetStaffAccess: [],
        ...overrides,
    };
}

test('super admin can assign first standalone soft asset owner', () => {
    assert.equal(canAssignSoftAssetStaffRole(actor({ role: 'super_admin' }), { id: 50, activeOwnerCount: 0 }, 'owner'), true);
});

test('existing standalone soft asset owner can add owners and staff', () => {
    const owner = actor({
        softAssetStaffAccess: [{ softAssetId: 50, staffRole: 'owner' }],
    });
    assert.equal(canAssignSoftAssetStaffRole(owner, { id: 50, activeOwnerCount: 1 }, 'owner'), true);
    assert.equal(canAssignSoftAssetStaffRole(owner, { id: 50, activeOwnerCount: 1 }, 'staff'), true);
});

test('standalone soft asset staff cannot manage access', () => {
    const staff = actor({
        softAssetStaffAccess: [{ softAssetId: 50, staffRole: 'staff' }],
    });
    assert.equal(canAssignSoftAssetStaffRole(staff, { id: 50, activeOwnerCount: 1 }, 'staff'), false);
});

test('standalone soft asset cannot lose final owner', () => {
    const owner = actor({
        softAssetStaffAccess: [{ softAssetId: 50, staffRole: 'owner' }],
    });
    assert.equal(canRevokeSoftAssetStaffMembership(owner, { id: 50, activeOwnerCount: 1 }, { staffRole: 'owner' }), false);
});

test('hasSoftAssetStaffAccess accepts owner and staff roles only', () => {
    const user = actor({
        softAssetStaffAccess: [
            { softAssetId: 50, staffRole: 'owner' },
            { softAssetId: 51, staffRole: 'editor' },
        ],
    });
    assert.equal(hasSoftAssetStaffAccess(user, 50), true);
    assert.equal(hasSoftAssetStaffAccess(user, 51), false);
});
```

- [ ] **Step 2: Run helper tests to verify missing utility**

Run:

```bash
node --test test/softAssetAccess.test.js
```

Expected: failure for missing `server/src/utils/softAssetAccess.js`.

- [ ] **Step 3: Implement `softAssetAccess.js`**

Create `server/src/utils/softAssetAccess.js`:

```js
import { and, eq, inArray, isNull } from 'drizzle-orm';

import { softAssets, softAssetStaffMemberships, users } from '../db/schema.js';
import { normalizeRole } from './roles.js';

const STAFF_ROLES = new Set(['owner', 'staff']);

function toInteger(value) {
    const number = Number(value);
    return Number.isInteger(number) ? number : null;
}

export function normalizeSoftAssetStaffRole(value) {
    const role = String(value || '').trim().toLowerCase();
    return STAFF_ROLES.has(role) ? role : null;
}

export function getActiveSoftAssetStaffAccess(user, allowedRoles = ['owner', 'staff']) {
    const allowed = new Set(allowedRoles.map(normalizeSoftAssetStaffRole).filter(Boolean));
    const entries = Array.isArray(user?.softAssetStaffAccess) ? user.softAssetStaffAccess : [];
    return entries
        .map((entry) => ({
            softAssetId: toInteger(entry?.softAssetId),
            softAssetName: String(entry?.softAssetName || '').trim(),
            staffRole: normalizeSoftAssetStaffRole(entry?.staffRole),
            revokedAt: entry?.revokedAt || null,
        }))
        .filter((entry) => entry.softAssetId && entry.staffRole && !entry.revokedAt && (!allowed.size || allowed.has(entry.staffRole)));
}

export function hasSoftAssetStaffAccess(user, softAssetId, allowedRoles = ['owner', 'staff']) {
    const parsedSoftAssetId = toInteger(softAssetId);
    if (!parsedSoftAssetId) return false;
    return getActiveSoftAssetStaffAccess(user, allowedRoles)
        .some((entry) => entry.softAssetId === parsedSoftAssetId);
}

export function hasAnySoftAssetStaffAccess(user, allowedRoles = ['owner', 'staff']) {
    return getActiveSoftAssetStaffAccess(user, allowedRoles).length > 0;
}

function getActiveOwnerCount(softAsset) {
    const parsed = toInteger(softAsset?.activeOwnerCount);
    return parsed || 0;
}

export function canAssignSoftAssetStaffRole(actor, softAsset, staffRole) {
    const actorRole = normalizeRole(actor?.role);
    const nextRole = normalizeSoftAssetStaffRole(staffRole);
    if (!actor || !softAsset || !nextRole) return false;
    if (actorRole === 'super_admin') return true;
    if (hasSoftAssetStaffAccess(actor, softAsset.id, ['owner'])) {
        return getActiveOwnerCount(softAsset) > 0;
    }
    return false;
}

export function canRevokeSoftAssetStaffMembership(actor, softAsset, membership) {
    const actorRole = normalizeRole(actor?.role);
    const membershipRole = normalizeSoftAssetStaffRole(membership?.staffRole);
    if (!actor || !softAsset || !membershipRole) return false;
    if (membershipRole === 'owner' && getActiveOwnerCount(softAsset) <= 1) return false;
    if (actorRole === 'super_admin') return true;
    return hasSoftAssetStaffAccess(actor, softAsset.id, ['owner']);
}

export function buildSoftAssetStaffAccessPayload(rows = []) {
    return rows
        .map((row) => ({
            softAssetMembershipId: toInteger(row?.softAssetMembershipId ?? row?.id),
            softAssetId: toInteger(row?.softAssetId),
            softAssetName: String(row?.softAssetName || '').trim() || `Offering ${row?.softAssetId}`,
            staffRole: normalizeSoftAssetStaffRole(row?.staffRole),
            revokedAt: row?.revokedAt || null,
        }))
        .filter((entry) => entry.softAssetId && entry.staffRole && !entry.revokedAt)
        .map(({ revokedAt, ...entry }) => entry);
}

export async function loadSoftAssetStaffAccessForUser(db, userId) {
    const parsedUserId = toInteger(userId);
    if (!parsedUserId) return [];
    const rows = await db.select({
        softAssetMembershipId: softAssetStaffMemberships.id,
        softAssetId: softAssetStaffMemberships.softAssetId,
        softAssetName: softAssets.name,
        staffRole: softAssetStaffMemberships.staffRole,
        revokedAt: softAssetStaffMemberships.revokedAt,
    })
        .from(softAssetStaffMemberships)
        .innerJoin(softAssets, eq(softAssetStaffMemberships.softAssetId, softAssets.id))
        .where(and(
            eq(softAssetStaffMemberships.userId, parsedUserId),
            isNull(softAssetStaffMemberships.revokedAt),
        ));
    return buildSoftAssetStaffAccessPayload(rows);
}

export async function loadSoftAssetStaffRows(db, softAssetId) {
    const parsedSoftAssetId = toInteger(softAssetId);
    if (!parsedSoftAssetId) return [];
    return db.select({
        id: softAssetStaffMemberships.id,
        softAssetId: softAssetStaffMemberships.softAssetId,
        userId: softAssetStaffMemberships.userId,
        staffRole: softAssetStaffMemberships.staffRole,
        createdAt: softAssetStaffMemberships.createdAt,
        updatedAt: softAssetStaffMemberships.updatedAt,
        userName: users.name,
        username: users.username,
        email: users.email,
        userRole: users.role,
    })
        .from(softAssetStaffMemberships)
        .innerJoin(users, eq(softAssetStaffMemberships.userId, users.id))
        .where(and(
            eq(softAssetStaffMemberships.softAssetId, parsedSoftAssetId),
            isNull(softAssetStaffMemberships.revokedAt),
        ));
}
```

- [ ] **Step 4: Run helper tests**

Run:

```bash
node --test test/softAssetAccess.test.js
```

Expected: all soft asset access helper tests pass.

- [ ] **Step 5: Add session payload loading**

In `server/src/controllers/authController.js`, `server/src/controllers/userController.js`, and `server/src/utils/phoneLogin.js`, load soft asset staff access beside the existing hard asset staff access imports:

```js
import { loadSoftAssetStaffAccessForUser } from '../utils/softAssetAccess.js';
```

At each place that currently assigns `hardAssetStaffAccess`, also assign:

```js
user.softAssetStaffAccess = await loadSoftAssetStaffAccessForUser(db, user.id);
```

In `server/src/utils/sessionAuth.js`, add soft access to `buildSessionPayload`:

```js
...(Array.isArray(user.softAssetStaffAccess) ? { softAssetStaffAccess: user.softAssetStaffAccess } : {}),
```

- [ ] **Step 6: Add direct resource operator authorization**

In `server/src/middleware/auth.js`, import:

```js
import { hasAnySoftAssetStaffAccess } from '../utils/softAssetAccess.js';
```

Add the new authorization helper without removing the existing `authorize(...)` function yet:

```js
export function hasDirectResourceOperatorAccess(user) {
    const role = normalizeRole(user?.role);
    if (['super_admin', 'admin', 'regional_admin'].includes(role)) return true;
    return hasAnyHardAssetStaffAccess(user) || hasAnySoftAssetStaffAccess(user);
}

export function authorizeResourceOperator() {
    return async (c, next) => {
        const user = c.get('user');
        if (!user) return c.json({ error: 'Unauthorized' }, 401);
        if (!hasDirectResourceOperatorAccess(user)) {
            return c.json({ error: 'Insufficient permissions' }, 403);
        }

        const role = normalizeRole(user.role);
        if (role === 'regional_admin') {
            const scopedSubregionId = user.subregionId || user.subregionIds?.[0];
            if (!scopedSubregionId) {
                return c.json({ error: 'Account missing required scope (subregion_id)' }, 403);
            }
            c.set('subregionScope', scopedSubregionId);
        }

        await next();
    };
}
```

- [ ] **Step 7: Add soft asset access controller and routes**

Create `server/src/controllers/softAssetAccessController.js` by mirroring the hard asset access controller and replacing:

```js
hardAssetId -> softAssetId
hardAssetStaffMemberships -> softAssetStaffMemberships
loadHardAssetStaffRows -> loadSoftAssetStaffRows
canAssignHardAssetStaffRole -> canAssignSoftAssetStaffRole
canRevokeHardAssetStaffMembership -> canRevokeSoftAssetStaffMembership
```

The route responses must return:

```js
{
    asset: {
        id: softAsset.id,
        name: softAsset.name,
        assetMode: softAsset.assetMode || 'standalone',
    },
    permissions,
    staff,
    setupRequired: false,
}
```

In `server/src/routes/softAssets.js`, import controller functions and add before `router.get('/:id', ...)`:

```js
router.get('/:id/staff', authenticateToken, authorizeResourceOperator(), getSoftAssetStaff);
router.get('/:id/staff-candidates', authenticateToken, authorizeResourceOperator(), getSoftAssetStaffCandidates);
router.post('/:id/staff', authenticateToken, authorizeResourceOperator(), addSoftAssetStaff);
router.delete('/:id/staff/:membershipId', authenticateToken, authorizeResourceOperator(), revokeSoftAssetStaff);
```

- [ ] **Step 8: Run full server tests**

Run:

```bash
npm run test --workspace=server
```

Expected: full server test suite passes.

- [ ] **Step 9: Commit Task 5**

Run:

```bash
git add server/src/utils/softAssetAccess.js server/src/controllers/softAssetAccessController.js server/src/routes/softAssets.js server/src/controllers/authController.js server/src/controllers/userController.js server/src/utils/phoneLogin.js server/src/utils/sessionAuth.js server/src/middleware/auth.js server/test/softAssetAccess.test.js
git commit -m "feat: add standalone soft asset access API"
```

---

### Task 6: Replace Partner Role Gates with Direct Resource Operators

**Files:**
- Create: `server/test/assetOperatorAuthorization.test.js`
- Modify: `server/src/middleware/auth.js`
- Modify: `server/src/routes/hardAssets.js`
- Modify: `server/src/routes/softAssets.js`
- Modify: `server/src/routes/softAssetParents.js`
- Modify: `server/src/routes/audienceZones.js`
- Modify: `server/src/routes/upload.js`
- Modify: `server/src/routes/resourceTranslations.js`
- Modify: `server/src/routes/subCategories.js`
- Modify: `server/src/routes/subregions.js`
- Modify: `client/src/pages/dashboard/AdminPage.jsx`
- Test: `server/test/assetOperatorAuthorization.test.js`
- Test: `npm run build:client`

- [ ] **Step 1: Add failing authorization tests**

Create `server/test/assetOperatorAuthorization.test.js`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';

import { hasDirectResourceOperatorAccess } from '../src/middleware/auth.js';

test('standard hard asset staff can use dashboard resource routes', () => {
    assert.equal(hasDirectResourceOperatorAccess({
        role: 'standard',
        hardAssetStaffAccess: [{ hardAssetId: 10, staffRole: 'staff' }],
    }), true);
});

test('standard standalone soft asset staff can use dashboard resource routes', () => {
    assert.equal(hasDirectResourceOperatorAccess({
        role: 'standard',
        softAssetStaffAccess: [{ softAssetId: 50, staffRole: 'owner' }],
    }), true);
});

test('standard user without direct asset access cannot use dashboard resource routes', () => {
    assert.equal(hasDirectResourceOperatorAccess({ role: 'standard' }), false);
});

test('legacy partner role alone is not resource-operator access', () => {
    assert.equal(hasDirectResourceOperatorAccess({ role: 'partner' }), false);
});
```

- [ ] **Step 2: Run authorization tests**

Run:

```bash
node --test test/assetOperatorAuthorization.test.js
```

Expected: tests fail until `hasDirectResourceOperatorAccess` ignores legacy Partner role unless the user also has direct asset access.

- [ ] **Step 3: Replace resource route guards**

In each route file listed in this task, import `authorizeResourceOperator` from `server/src/middleware/auth.js`.

Replace dashboard resource workflow guards such as:

```js
authorize('partner', 'regional_admin', 'admin', 'super_admin')
```

with:

```js
authorizeResourceOperator()
```

Apply this to:

- hard asset create/import/edit/delete/staff routes.
- soft asset create/import/edit/delete/access routes.
- soft asset parent/template routes used by dashboard resource management.
- audience zone routes used by asset owners and staff.
- upload, resource translation, sub-category, and subregion lookup routes used by dashboard resource forms.

Do not widen Admin Users, recovery, impersonation, or global system-management routes. Those remain Super Admin or Region Admin responsibilities.

- [ ] **Step 4: Remove Partner from user type selection**

In `client/src/pages/dashboard/AdminPage.jsx`, remove the Partner option from the role dropdown:

```js
const assignableUserRoles = [
    { value: 'standard', label: 'User' },
    { value: 'regional_admin', label: 'Region Admin' },
    { value: 'super_admin', label: 'Super Admin' },
];
```

Keep backward-compatible display formatting for old rows that may still have `role === 'partner'`, but do not allow selecting Partner for new assignments.

- [ ] **Step 5: Verify Partner is not a new assignment path**

Run:

```bash
rg -n "Partner|partner" client/src/pages/dashboard/AdminPage.jsx server/src/routes/hardAssets.js server/src/routes/softAssets.js server/src/routes/softAssetParents.js server/src/routes/audienceZones.js server/src/routes/upload.js server/src/routes/resourceTranslations.js server/src/routes/subCategories.js server/src/routes/subregions.js
```

Expected:

- No Partner option remains in the Admin user-type dropdown.
- Resource route guards no longer depend on `authorize('partner', ...)`.
- Legacy partner routes/controllers may still exist outside this search scope for beta transition reads.

- [ ] **Step 6: Run tests and client build**

Run:

```bash
node --test test/assetOperatorAuthorization.test.js
npm run test --workspace=server
npm run build:client
```

Expected: authorization tests, server tests, and client build pass.

- [ ] **Step 7: Commit Task 6**

Run:

```bash
git add server/test/assetOperatorAuthorization.test.js server/src/middleware/auth.js server/src/routes/hardAssets.js server/src/routes/softAssets.js server/src/routes/softAssetParents.js server/src/routes/audienceZones.js server/src/routes/upload.js server/src/routes/resourceTranslations.js server/src/routes/subCategories.js server/src/routes/subregions.js client/src/pages/dashboard/AdminPage.jsx
git commit -m "feat: replace partner role gates with asset operators"
```

---

### Task 7: Add Standalone Soft Asset Service Coverage Logic

**Files:**
- Modify: `server/src/utils/regionScope.js`
- Modify: `server/src/controllers/softAssetsController.js`
- Test: `server/test/overlappingRegionResourceLists.test.js`

- [ ] **Step 1: Add failing tests for standalone coverage filtering**

Append to `server/test/overlappingRegionResourceLists.test.js`:

```js
import {
    attachStandaloneSoftAssetCoverage,
    filterSoftAssetsByRegionRelevance,
} from '../src/utils/regionScope.js';

test('standalone soft asset coverage attaches service region ids', () => {
    const offerings = [
        { id: 1, assetMode: 'standalone' },
        { id: 2, assetMode: 'standalone' },
    ];
    const coverageRows = [
        { softAssetId: 1, subregionId: 10 },
        { softAssetId: 1, subregionId: 30 },
        { softAssetId: 2, subregionId: 20 },
    ];

    const attached = attachStandaloneSoftAssetCoverage(offerings, coverageRows);

    assert.deepEqual(attached.map((offering) => [offering.id, offering.coverageRegionIds]), [
        [1, [10, 30]],
        [2, [20]],
    ]);
});

test('standalone soft asset list relevance follows coverage regions', () => {
    const offerings = [
        { id: 1, assetMode: 'standalone', coverageRegionIds: [10, 30] },
        { id: 2, assetMode: 'standalone', coverageRegionIds: [20] },
    ];

    const scoped = filterSoftAssetsByRegionRelevance(offerings, actor({ subregionIds: [30] }));

    assert.deepEqual(scoped.map((offering) => offering.id), [1]);
});

test('standalone soft asset direct staff access grants relevance without coverage match', () => {
    const offerings = [
        { id: 1, assetMode: 'standalone', coverageRegionIds: [] },
    ];

    const scoped = filterSoftAssetsByRegionRelevance(offerings, actor({
        subregionIds: [],
        softAssetStaffAccess: [{ softAssetId: 1, staffRole: 'staff' }],
    }));

    assert.deepEqual(scoped.map((offering) => offering.id), [1]);
});
```

- [ ] **Step 2: Run tests to verify missing exports**

Run:

```bash
node --test test/overlappingRegionResourceLists.test.js
```

Expected: failure for missing standalone soft asset coverage exports.

- [ ] **Step 3: Implement coverage helper functions**

In `server/src/utils/regionScope.js`, add the soft access import:

```js
import { hasSoftAssetStaffAccess } from './softAssetAccess.js';
```

Update the existing standalone relevance helper:

```js
export function standaloneSoftAssetMatchesActorRegions(actor, offering) {
    if (normalizeRole(actor?.role) === 'super_admin') return true;
    if (hasSoftAssetStaffAccess(actor, offering?.id, ['owner', 'staff'])) return true;
    return actorMatchesAnyRegion(actor, offering?.coverageRegionIds || []);
}
```

Then append the coverage helpers:

```js
export function attachStandaloneSoftAssetCoverage(offerings = [], coverageRows = []) {
    const coverageBySoftAssetId = new Map();
    for (const row of coverageRows) {
        const softAssetId = toInteger(row?.softAssetId);
        const subregionId = toInteger(row?.subregionId);
        if (!softAssetId || !subregionId) continue;
        if (!coverageBySoftAssetId.has(softAssetId)) coverageBySoftAssetId.set(softAssetId, []);
        coverageBySoftAssetId.get(softAssetId).push(subregionId);
    }

    return offerings.map((offering) => ({
        ...offering,
        coverageRegionIds: uniqueSortedIntegers(coverageBySoftAssetId.get(toInteger(offering?.id)) || []),
    }));
}

export function isStandaloneSoftAsset(offering) {
    const hasLinkedLocations = Array.isArray(offering?.locations) && offering.locations.length > 0;
    return !offering?.hostHardAssetId
        && !hasLinkedLocations
        && (offering?.assetMode || 'standalone') === 'standalone';
}

export function filterSoftAssetsByRegionRelevance(offerings = [], actor) {
    if (normalizeRole(actor?.role) === 'super_admin') return offerings;
    return offerings.filter((offering) => {
        if (isStandaloneSoftAsset(offering)) {
            return standaloneSoftAssetMatchesActorRegions(actor, offering);
        }
        const linkedRegionIds = uniqueSortedIntegers([
            ...(Array.isArray(offering?.matchingRegionIds) ? offering.matchingRegionIds : []),
            ...(Array.isArray(offering?.locations)
                ? offering.locations.flatMap((location) => location?.matchingRegionIds || [])
                : []),
        ]);
        return actorMatchesAnyRegion(actor, linkedRegionIds);
    });
}
```

- [ ] **Step 4: Wire controller coverage loading**

In `server/src/controllers/softAssetsController.js`, import:

```js
import { softAssetRegionCoverages, subregionPostalCodes } from '../db/schema.js';
import {
    attachStandaloneSoftAssetCoverage,
    attachHardAssetRegionMatches,
    filterSoftAssetsByRegionRelevance,
} from '../utils/regionScope.js';
```

After loading `assets`, add:

```js
const standaloneIds = assets
    .filter((asset) => !asset.hostHardAssetId && (!Array.isArray(asset.locations) || asset.locations.length === 0))
    .map((asset) => asset.id);
const coverageRows = standaloneIds.length > 0
    ? await db.select({
        softAssetId: softAssetRegionCoverages.softAssetId,
        subregionId: softAssetRegionCoverages.subregionId,
    })
        .from(softAssetRegionCoverages)
        .where(inArray(softAssetRegionCoverages.softAssetId, standaloneIds))
    : [];
const withStandaloneCoverage = attachStandaloneSoftAssetCoverage(assets, coverageRows);
const regionRelevantAssets = listScope === 'managed'
    ? filterSoftAssetsByRegionRelevance(withStandaloneCoverage, user)
    : withStandaloneCoverage;
```

Then pass `regionRelevantAssets` into `filterSoftAssetsForResourceList`.

- [ ] **Step 5: Run tests**

Run:

```bash
node --test test/overlappingRegionResourceLists.test.js
npm run test --workspace=server
```

Expected: overlap tests pass, then full server suite passes.

- [ ] **Step 6: Commit Task 7**

Run:

```bash
git add server/src/utils/regionScope.js server/src/controllers/softAssetsController.js server/test/overlappingRegionResourceLists.test.js
git commit -m "feat: scope standalone offerings by service coverage"
```

---

### Task 8: Add Row Permission Metadata

**Files:**
- Modify: `server/src/utils/ownership.js`
- Modify: `server/src/controllers/hardAssetsController.js`
- Modify: `server/src/controllers/softAssetsController.js`
- Test: `server/test/accessControlPrivacy.test.js`

- [ ] **Step 1: Add failing permission metadata tests**

Append to `server/test/accessControlPrivacy.test.js`:

```js
import {
    buildHardAssetPermissionSummary,
    buildSoftAssetPermissionSummary,
} from '../src/utils/ownership.js';

test('region overlap does not grant hard asset edit permissions', () => {
    const regionAdmin = { id: 9, role: 'regional_admin', subregionIds: [10], hardAssetStaffAccess: [] };
    const asset = { id: 1, partnerId: null, matchingRegionIds: [10] };

    assert.deepEqual(buildHardAssetPermissionSummary(regionAdmin, asset, null), {
        canEdit: false,
        canManageAccess: false,
        canDelete: false,
        canHide: false,
    });
});

test('hard asset owner gets edit and access management permissions', () => {
    const owner = {
        id: 9,
        role: 'standard',
        hardAssetStaffAccess: [{ hardAssetId: 1, staffRole: 'owner' }],
    };
    const asset = { id: 1, partnerId: null, matchingRegionIds: [10] };

    assert.equal(buildHardAssetPermissionSummary(owner, asset, null).canEdit, true);
    assert.equal(buildHardAssetPermissionSummary(owner, asset, null).canManageAccess, true);
});

test('standalone soft asset staff can edit but cannot manage access', () => {
    const staff = {
        id: 9,
        role: 'standard',
        softAssetStaffAccess: [{ softAssetId: 50, staffRole: 'staff' }],
    };
    const offering = { id: 50, assetMode: 'standalone' };

    assert.deepEqual(buildSoftAssetPermissionSummary(staff, offering, null), {
        canEdit: true,
        canManageAccess: false,
        canDelete: false,
        canHide: false,
    });
});
```

- [ ] **Step 2: Run test to verify missing exports**

Run:

```bash
node --test test/accessControlPrivacy.test.js
```

Expected: failure for missing permission summary exports.

- [ ] **Step 3: Implement permission summary helpers**

In `server/src/utils/ownership.js`, import:

```js
import { hasSoftAssetStaffAccess } from './softAssetAccess.js';
```

Add:

```js
export function buildHardAssetPermissionSummary(actor, asset, ownerUser) {
    const actorRole = normalizeRole(actor?.role);
    const isSuperAdmin = actorRole === 'super_admin';
    const isOwner = actorHasHardAssetStaffAccess(actor, asset, ['owner']);
    const isStaff = actorHasHardAssetStaffAccess(actor, asset, ['staff']);
    return {
        canEdit: isSuperAdmin || isOwner || isStaff,
        canManageAccess: isSuperAdmin || isOwner,
        canDelete: isSuperAdmin || isOwner,
        canHide: isSuperAdmin || isOwner,
    };
}

export function buildSoftAssetPermissionSummary(actor, offering, ownerUser) {
    const actorRole = normalizeRole(actor?.role);
    const isSuperAdmin = actorRole === 'super_admin';
    const isStandalone = !offering?.hostHardAssetId && (!Array.isArray(offering?.locations) || offering.locations.length === 0);
    if (isStandalone) {
        const isOwner = hasSoftAssetStaffAccess(actor, offering?.id, ['owner']);
        const isStaff = hasSoftAssetStaffAccess(actor, offering?.id, ['staff']);
        return {
            canEdit: isSuperAdmin || isOwner || isStaff,
            canManageAccess: isSuperAdmin || isOwner,
            canDelete: isSuperAdmin || isOwner,
            canHide: isSuperAdmin || isOwner,
        };
    }

    const canManageLinked = actorCanManageAsset(actor, offering, ownerUser);
    return {
        canEdit: isSuperAdmin || canManageLinked,
        canManageAccess: false,
        canDelete: isSuperAdmin || canManageLinked,
        canHide: isSuperAdmin || canManageLinked,
    };
}
```

- [ ] **Step 4: Attach permissions in controllers**

In `server/src/controllers/hardAssetsController.js`, add `permissions` and `matchingRegionIds` to each formatted hard asset after formatting. Preserve the current `formatHardAsset` argument list and wrap it with row permission metadata:

```js
const formatted = pagedAssets.map((asset) => {
    const base = formatHardAsset(
        asset,
        boundaryContext,
        user,
        allowedPartnerAudienceIds,
        allowedAudienceZoneIds,
        eligibilityContext,
        membershipHostIdMap,
        membershipSummariesByAssetId.get(asset.id) || null,
    );
    return {
        ...base,
        matchingRegionIds: asset.matchingRegionIds || [],
        primaryRegionId: asset.subregionId || null,
        permissions: buildHardAssetPermissionSummary(user, asset, asset.partner),
    };
});
```

In `server/src/controllers/softAssetsController.js`, after formatting each soft asset, add:

```js
permissions: buildSoftAssetPermissionSummary(user, asset, asset.partner),
coverageRegionIds: asset.coverageRegionIds || [],
matchingRegionIds: asset.matchingRegionIds || asset.coverageRegionIds || [],
primaryRegionId: asset.subregionId || null,
```

- [ ] **Step 5: Run tests and build**

Run:

```bash
node --test test/accessControlPrivacy.test.js
npm run test --workspace=server
npm run build:client
```

Expected: permission tests pass, server tests pass, client build passes.

- [ ] **Step 6: Commit Task 8**

Run:

```bash
git add server/src/utils/ownership.js server/src/controllers/hardAssetsController.js server/src/controllers/softAssetsController.js server/test/accessControlPrivacy.test.js
git commit -m "feat: expose explicit resource permissions"
```

---

### Task 9: Update Client Controls to Respect Permissions

**Files:**
- Modify: `client/src/pages/dashboard/ResourcesPage.jsx`
- Modify: `client/src/components/AssetAccessPanel.jsx`
- Modify: `client/src/lib/api.js`
- Test: `npm run build:client`

- [ ] **Step 1: Add soft asset access API client methods**

In `client/src/lib/api.js`, add near hard asset staff methods:

```js
getSoftAssetStaff: (id) => request('GET', `/soft-assets/${id}/staff`),
getSoftAssetStaffCandidates: (id, query = '') => request('GET', `/soft-assets/${id}/staff-candidates?q=${encodeURIComponent(query)}`),
addSoftAssetStaff: (id, body) => request('POST', `/soft-assets/${id}/staff`, body),
revokeSoftAssetStaff: (id, membershipId) => request('DELETE', `/soft-assets/${id}/staff/${membershipId}`),
```

- [ ] **Step 2: Generalize access panel API calls**

In `client/src/components/AssetAccessPanel.jsx`, change signature:

```js
export default function AssetAccessPanel({ asset, assetType = 'hard', onChanged }) {
```

Add:

```js
const accessApi = assetType === 'soft'
    ? {
        getStaff: api.getSoftAssetStaff,
        getCandidates: api.getSoftAssetStaffCandidates,
        addStaff: api.addSoftAssetStaff,
        revokeStaff: api.revokeSoftAssetStaff,
    }
    : {
        getStaff: api.getHardAssetStaff,
        getCandidates: api.getHardAssetStaffCandidates,
        addStaff: api.addHardAssetStaff,
        revokeStaff: api.revokeHardAssetStaff,
    };
```

Replace direct hard asset API calls:

```js
api.getHardAssetStaff(asset.id)
api.getHardAssetStaffCandidates(asset.id, query)
api.addHardAssetStaff(asset.id, { userId: Number(addUserId), staffRole: addRole })
api.revokeHardAssetStaff(asset.id, member.id)
```

with:

```js
accessApi.getStaff(asset.id)
accessApi.getCandidates(asset.id, query)
accessApi.addStaff(asset.id, { userId: Number(addUserId), staffRole: addRole })
accessApi.revokeStaff(asset.id, member.id)
```

Change the description copy:

```jsx
{assetType === 'soft'
    ? 'Owners and Staff can edit this standalone offering.'
    : 'Owners and Staff can edit this place and its linked offerings.'}
```

- [ ] **Step 3: Gate hard asset buttons by row permissions**

In `client/src/pages/dashboard/ResourcesPage.jsx`, for hard asset cards, replace role-only edit checks with:

```js
const permissions = asset.permissions || {};
const canEditAsset = Boolean(permissions.canEdit);
const canManageAssetAccess = Boolean(permissions.canManageAccess);
const canDeleteAsset = Boolean(permissions.canDelete);
const canHideAsset = Boolean(permissions.canHide);
```

Wrap the existing card actions with these conditions while preserving their current handlers and styling:

- `Hide from app`: render when `canHideAsset` is true.
- `Edit`: render when `canEditAsset` is true.
- `Access`: render when `canManageAssetAccess` is true.
- `Delete`: render when `canDeleteAsset` is true.

- [ ] **Step 4: Add standalone soft access panel entry**

For standalone soft asset cards, show access action only when:

```js
const canManageSoftAccess = Boolean(asset.permissions?.canManageAccess);
```

When rendering the panel:

```jsx
{inlineAction.type === 'access' && (
    <AssetAccessPanel
        asset={asset}
        assetType={activeTab === 'soft' ? 'soft' : 'hard'}
        onChanged={load}
    />
)}
```

- [ ] **Step 5: Build client**

Run:

```bash
npm run build:client
```

Expected: TypeScript and Vite build complete successfully.

- [ ] **Step 6: Commit Task 9**

Run:

```bash
git add client/src/lib/api.js client/src/components/AssetAccessPanel.jsx client/src/pages/dashboard/ResourcesPage.jsx
git commit -m "feat: respect explicit asset permissions in dashboard"
```

---

### Task 10: Add Standalone Service Coverage UI and API Payloads

**Files:**
- Modify: `server/src/controllers/softAssetsController.js`
- Modify: `client/src/pages/dashboard/ResourcesPage.jsx`
- Modify: `client/src/components/SoftAssetChildForm.jsx`
- Modify: `client/src/components/SoftAssetTemplateForm.jsx`
- Modify: `client/src/lib/api.js`
- Test: `server/test/overlappingRegionResourceLists.test.js`

- [ ] **Step 1: Add server validation test for standalone coverage**

Append to `server/test/overlappingRegionResourceLists.test.js`:

```js
import { normalizeStandaloneCoverageInput } from '../src/controllers/softAssetsController.js';

test('standalone coverage input accepts region and audience zone ids', () => {
    assert.deepEqual(normalizeStandaloneCoverageInput({
        coverageRegionIds: ['10', 20, 'bad'],
        audienceZoneIds: ['5', 6, 'bad'],
    }), {
        coverageRegionIds: [10, 20],
        audienceZoneIds: [5, 6],
    });
});
```

- [ ] **Step 2: Export normalizer and run failing test**

Run:

```bash
node --test test/overlappingRegionResourceLists.test.js
```

Expected: failure that `normalizeStandaloneCoverageInput` is not exported.

- [ ] **Step 3: Add coverage input normalizer**

In `server/src/controllers/softAssetsController.js`, export:

```js
export function normalizeStandaloneCoverageInput(body = {}) {
    const normalizeIds = (values) => [...new Set(
        (Array.isArray(values) ? values : [])
            .map((value) => Number.parseInt(String(value), 10))
            .filter(Number.isInteger)
    )].sort((left, right) => left - right);

    return {
        coverageRegionIds: normalizeIds(body.coverageRegionIds),
        audienceZoneIds: normalizeIds(body.audienceZoneIds),
    };
}
```

- [ ] **Step 4: Persist coverage links on create/update**

In `createSoftAsset` after inserting the soft asset, when it is standalone:

```js
const coverage = normalizeStandaloneCoverageInput(body);
if (linkedIds.length === 0 && coverage.coverageRegionIds.length === 0 && coverage.audienceZoneIds.length === 0) {
    return c.json({ error: 'Standalone offerings need at least one service Region or Audience Zone.' }, 400);
}
if (coverage.coverageRegionIds.length > 0) {
    await db.insert(softAssetRegionCoverages).values(
        coverage.coverageRegionIds.map((subregionId) => ({
            softAssetId: asset.id,
            subregionId,
            createdByUserId: user.id,
            updatedByUserId: user.id,
        }))
    ).onConflictDoNothing();
}
```

In `updateSoftAsset`, replace coverage rows for standalone offerings:

```js
await db.delete(softAssetRegionCoverages).where(eq(softAssetRegionCoverages.softAssetId, existing.id));
if (coverage.coverageRegionIds.length > 0) {
    await db.insert(softAssetRegionCoverages).values(
        coverage.coverageRegionIds.map((subregionId) => ({
            softAssetId: existing.id,
            subregionId,
            createdByUserId: user.id,
            updatedByUserId: user.id,
        }))
    ).onConflictDoNothing();
}
```

- [ ] **Step 5: Add UI fields for service coverage**

In the standalone offering form section in `client/src/pages/dashboard/ResourcesPage.jsx`, render a multi-select using existing `subregions` and `audienceZones` state:

```jsx
{form.assetMode === 'standalone' ? (
    <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
            <span className="text-sm font-bold text-slate-700">Service Regions</span>
            <select
                multiple
                value={form.coverageRegionIds || []}
                onChange={(event) => setForm({
                    ...form,
                    coverageRegionIds: Array.from(event.target.selectedOptions).map((option) => Number(option.value)),
                })}
                className="input-field mt-1 min-h-32"
            >
                {subregions.map((region) => (
                    <option key={region.id} value={region.id}>
                        {region.name || region.subregionCode || `Region ${region.id}`}
                    </option>
                ))}
            </select>
        </label>
        <label className="block">
            <span className="text-sm font-bold text-slate-700">Audience Zones</span>
            <select
                multiple
                value={form.audienceZoneIds || []}
                onChange={(event) => setForm({
                    ...form,
                    audienceZoneIds: Array.from(event.target.selectedOptions).map((option) => Number(option.value)),
                })}
                className="input-field mt-1 min-h-32"
            >
                {audienceZones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                        {zone.name || zone.zoneCode || `Zone ${zone.id}`}
                    </option>
                ))}
            </select>
        </label>
    </div>
) : null}
```

- [ ] **Step 6: Run tests and build**

Run:

```bash
node --test test/overlappingRegionResourceLists.test.js
npm run test --workspace=server
npm run build:client
```

Expected: overlap tests pass, server tests pass, client build passes.

- [ ] **Step 7: Commit Task 10**

Run:

```bash
git add server/src/controllers/softAssetsController.js client/src/pages/dashboard/ResourcesPage.jsx client/src/components/SoftAssetChildForm.jsx client/src/components/SoftAssetTemplateForm.jsx server/test/overlappingRegionResourceLists.test.js
git commit -m "feat: add standalone offering service coverage"
```

---

### Task 11: Update Hard Asset Create and Import Ambiguity Handling

**Files:**
- Modify: `server/src/utils/subregionRouting.js`
- Modify: `server/src/controllers/hardAssetsController.js`
- Modify: `server/src/controllers/workbookController.js`
- Test: `server/test/subregionRouting.test.js`

- [ ] **Step 1: Add routing tests for overlapping postal matches**

Create `server/test/subregionRouting.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import { selectPrimaryRegionForWrite } from '../src/utils/subregionRouting.js';

test('write routing selects only scoped match for region admin', () => {
    const matches = [
        { id: 10, subregionCode: 'A' },
        { id: 20, subregionCode: 'B' },
    ];
    const selected = selectPrimaryRegionForWrite(matches, { role: 'regional_admin', subregionIds: [20] });
    assert.equal(selected.id, 20);
});

test('write routing requires explicit selection for super admin when postal code overlaps', () => {
    const matches = [
        { id: 10, subregionCode: 'A' },
        { id: 20, subregionCode: 'B' },
    ];
    assert.throws(
        () => selectPrimaryRegionForWrite(matches, { role: 'super_admin' }),
        /Choose a primary Region/
    );
});

test('write routing accepts explicit primary region when it is one of the matches', () => {
    const matches = [
        { id: 10, subregionCode: 'A' },
        { id: 20, subregionCode: 'B' },
    ];
    const selected = selectPrimaryRegionForWrite(matches, { role: 'super_admin' }, 20);
    assert.equal(selected.id, 20);
});
```

- [ ] **Step 2: Run routing tests to verify missing export**

Run:

```bash
node --test test/subregionRouting.test.js
```

Expected: failure for missing `selectPrimaryRegionForWrite`.

- [ ] **Step 3: Add write-routing selection helper**

In `server/src/utils/subregionRouting.js`, export:

```js
export function selectPrimaryRegionForWrite(matches = [], actor, explicitPrimaryRegionId = null) {
    const ordered = sortSubregionMatches(matches);
    if (ordered.length === 0) {
        throw clientError('Postal code does not match any configured Region boundary.', 400);
    }

    const explicitId = Number.parseInt(String(explicitPrimaryRegionId ?? ''), 10);
    if (Number.isInteger(explicitId)) {
        const explicitMatch = ordered.find((match) => Number(match.id) === explicitId);
        if (!explicitMatch) throw clientError('Selected primary Region does not match this postal code.', 400);
        return explicitMatch;
    }

    const actorRole = normalizeRole(actor?.role);
    const scopedIds = actorRole === 'super_admin'
        ? []
        : Array.isArray(actor?.subregionIds)
            ? actor.subregionIds.map((value) => Number.parseInt(String(value), 10)).filter(Number.isInteger)
            : [];

    if (actorRole !== 'super_admin') {
        const scopedMatches = ordered.filter((match) => scopedIds.includes(Number(match.id)));
        if (scopedMatches.length === 1) return scopedMatches[0];
        if (scopedMatches.length > 1) {
            throw clientError('Choose a primary Region for this overlapping postal code.', 409);
        }
        throw clientError('Postal code is outside your assigned Regions.', 403);
    }

    if (ordered.length === 1) return ordered[0];
    throw clientError('Choose a primary Region for this overlapping postal code.', 409);
}
```

- [ ] **Step 4: Use helper in hard asset create/update**

In `server/src/controllers/hardAssetsController.js`, when resolving writable subregion, pass `body.primaryRegionId` or `body.subregionId`:

```js
const derivedRouting = await resolveWritableSubregionByPostal(db, nextPostalCode, user, 'Postal code', body.primaryRegionId ?? body.subregionId);
```

Update `resolveWritableSubregionByPostal` signature in `server/src/utils/subregionRouting.js`:

```js
export async function resolveWritableSubregionByPostal(db, rawPostalCode, actor, entityLabel = 'Postal code', explicitPrimaryRegionId = null) {
```

Then use:

```js
const selected = selectPrimaryRegionForWrite(matches, actor, explicitPrimaryRegionId);
```

- [ ] **Step 5: Run tests**

Run:

```bash
node --test test/subregionRouting.test.js
npm run test --workspace=server
```

Expected: routing tests pass, server suite passes.

- [ ] **Step 6: Commit Task 11**

Run:

```bash
git add server/src/utils/subregionRouting.js server/src/controllers/hardAssetsController.js server/src/controllers/workbookController.js server/test/subregionRouting.test.js
git commit -m "feat: handle overlapping region write routing"
```

---

### Task 12: Add Region Coverage Audit

**Files:**
- Create: `server/src/utils/regionCoverageAudit.js`
- Modify: `server/src/controllers/subregionsController.js`
- Modify: `server/src/routes/subregions.js`
- Modify: `client/src/lib/api.js`
- Modify: `client/src/pages/dashboard/AdminPage.jsx`
- Test: `server/test/regionCoverageAudit.test.js`

- [ ] **Step 1: Add failing pure audit tests**

Create `server/test/regionCoverageAudit.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import { summarizeRegionOverlapPairs, findPrimaryRegionMismatches } from '../src/utils/regionCoverageAudit.js';

test('summarizeRegionOverlapPairs counts shared postal codes between regions', () => {
    const rows = [
        { postalCode: '111111', subregionId: 1 },
        { postalCode: '111111', subregionId: 2 },
        { postalCode: '222222', subregionId: 1 },
        { postalCode: '222222', subregionId: 2 },
        { postalCode: '333333', subregionId: 2 },
        { postalCode: '333333', subregionId: 3 },
    ];

    assert.deepEqual(summarizeRegionOverlapPairs(rows), [
        { leftRegionId: 1, rightRegionId: 2, overlapCount: 2 },
        { leftRegionId: 2, rightRegionId: 3, overlapCount: 1 },
    ]);
});

test('findPrimaryRegionMismatches reports assets whose primary region is absent from matching regions', () => {
    const assets = [
        { id: 1, postalCode: '111111', subregionId: 1, matchingRegionIds: [1, 2] },
        { id: 2, postalCode: '222222', subregionId: 3, matchingRegionIds: [1, 2] },
    ];

    assert.deepEqual(findPrimaryRegionMismatches(assets).map((asset) => asset.id), [2]);
});
```

- [ ] **Step 2: Run audit tests to verify missing module**

Run:

```bash
node --test test/regionCoverageAudit.test.js
```

Expected: failure for missing `regionCoverageAudit.js`.

- [ ] **Step 3: Implement audit helpers**

Create `server/src/utils/regionCoverageAudit.js`:

```js
function toInteger(value) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isInteger(parsed) ? parsed : null;
}

export function summarizeRegionOverlapPairs(rows = []) {
    const regionsByPostal = new Map();
    for (const row of rows) {
        const postalCode = String(row?.postalCode || '').trim();
        const subregionId = toInteger(row?.subregionId);
        if (!postalCode || !subregionId) continue;
        if (!regionsByPostal.has(postalCode)) regionsByPostal.set(postalCode, new Set());
        regionsByPostal.get(postalCode).add(subregionId);
    }

    const pairCounts = new Map();
    for (const regionSet of regionsByPostal.values()) {
        const ids = [...regionSet].sort((left, right) => left - right);
        for (let leftIndex = 0; leftIndex < ids.length; leftIndex += 1) {
            for (let rightIndex = leftIndex + 1; rightIndex < ids.length; rightIndex += 1) {
                const key = `${ids[leftIndex]}:${ids[rightIndex]}`;
                pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
            }
        }
    }

    return [...pairCounts.entries()]
        .map(([key, overlapCount]) => {
            const [leftRegionId, rightRegionId] = key.split(':').map(Number);
            return { leftRegionId, rightRegionId, overlapCount };
        })
        .sort((left, right) => right.overlapCount - left.overlapCount || left.leftRegionId - right.leftRegionId || left.rightRegionId - right.rightRegionId);
}

export function findPrimaryRegionMismatches(assets = []) {
    return assets.filter((asset) => {
        const primaryRegionId = toInteger(asset?.subregionId);
        const matchingRegionIds = new Set((asset?.matchingRegionIds || []).map(toInteger).filter(Number.isInteger));
        return primaryRegionId && matchingRegionIds.size > 0 && !matchingRegionIds.has(primaryRegionId);
    });
}
```

- [ ] **Step 4: Add admin endpoint**

In `server/src/controllers/subregionsController.js`, add `getRegionCoverageAudit` that returns:

```js
{
    regionCount,
    postalCodeAssignmentCount,
    overlapPairs,
    hardAssetPrimaryRegionMismatches,
    standaloneOfferingsWithoutCoverage
}
```

In `server/src/routes/subregions.js`, add:

```js
router.get('/coverage-audit', authenticateToken, authorize('regional_admin', 'admin', 'super_admin'), getRegionCoverageAudit);
```

- [ ] **Step 5: Add Admin UI summary**

In `client/src/lib/api.js`, add:

```js
getRegionCoverageAudit: () => request('GET', '/subregions/coverage-audit'),
```

In `client/src/pages/dashboard/AdminPage.jsx`, add a “Coverage Audit” panel inside the Regions tab that shows:

```jsx
<div className="rounded-2xl border border-slate-200 bg-white p-4">
    <h3 className="text-lg font-bold text-slate-900">Coverage Audit</h3>
    <p className="mt-1 text-sm text-slate-500">Review overlapping Regions and resources that need coverage attention.</p>
    <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase text-slate-400">Overlap pairs</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{coverageAudit?.overlapPairs?.length || 0}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase text-slate-400">Primary mismatches</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{coverageAudit?.hardAssetPrimaryRegionMismatches?.length || 0}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase text-slate-400">Standalone without coverage</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{coverageAudit?.standaloneOfferingsWithoutCoverage?.length || 0}</p>
        </div>
    </div>
</div>
```

- [ ] **Step 6: Run tests and build**

Run:

```bash
node --test test/regionCoverageAudit.test.js
npm run test --workspace=server
npm run build:client
```

Expected: audit tests pass, server suite passes, client build passes.

- [ ] **Step 7: Commit Task 12**

Run:

```bash
git add server/src/utils/regionCoverageAudit.js server/src/controllers/subregionsController.js server/src/routes/subregions.js server/test/regionCoverageAudit.test.js client/src/lib/api.js client/src/pages/dashboard/AdminPage.jsx
git commit -m "feat: add region coverage audit"
```

---

### Task 13: End-to-End Verification and Release Prep

**Files:**
- Create: `scripts/probe-overlapping-region-counts.mjs`
- Modify: `docs/regression-ledger.md`
- Modify: `docs/release-checklist.md`

- [ ] **Step 1: Run full automated verification**

Run:

```bash
npm run test --workspace=server
npm run build:client
git diff --check
```

Expected:

- Server tests pass.
- Client build passes.
- `git diff --check` has no output and exit code 0.

- [ ] **Step 2: Create local API probe script**

Create `scripts/probe-overlapping-region-counts.mjs`:

```js
import { sign } from 'hono/jwt';

const baseUrl = process.env.API_BASE_URL || 'http://localhost:8787/api';
const jwtSecret = process.env.JWT_SECRET || 'seniorcare-secret-key';
const superAdminUserId = Number(process.env.PROBE_SUPER_ADMIN_USER_ID || 1);
const regionAdminUserId = Number(process.env.PROBE_REGION_ADMIN_USER_ID || 2);
const regionAdminSubregionId = Number(process.env.PROBE_REGION_ADMIN_SUBREGION_ID || 1);

function assertOk(condition, message) {
    if (!condition) throw new Error(message);
}

async function tokenFor(payload) {
    const exp = Math.floor(Date.now() / 1000) + 60 * 30;
    return sign({ ...payload, exp }, jwtSecret);
}

async function getJson(path, token) {
    const response = await fetch(`${baseUrl}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const body = await response.json().catch(() => ({}));
    assertOk(response.ok, `${path} returned ${response.status}: ${JSON.stringify(body)}`);
    return body;
}

const superToken = await tokenFor({
    id: superAdminUserId,
    userId: superAdminUserId,
    role: 'super_admin',
    name: 'Probe Super Admin',
});

const regionToken = await tokenFor({
    id: regionAdminUserId,
    userId: regionAdminUserId,
    role: 'regional_admin',
    name: 'Probe Region Admin',
    subregionId: regionAdminSubregionId,
});

const superHardAssets = await getJson('/hard-assets?page=1&pageSize=1&scope=managed', superToken);
const regionHardAssets = await getJson('/hard-assets?page=1&pageSize=1&scope=managed', regionToken);
const superSoftAssets = await getJson('/soft-assets?page=1&pageSize=1&scope=managed', superToken);
const regionSoftAssets = await getJson('/soft-assets?page=1&pageSize=1&scope=managed', regionToken);
const audit = await getJson('/subregions/coverage-audit', superToken);
const auditRows = audit.overlapPairs || audit.items || audit.rows || [];

assertOk(Number(superHardAssets.total || 0) >= Number(regionHardAssets.total || 0), 'Super Admin hard asset count should be global.');
assertOk(Number(superSoftAssets.total || 0) >= Number(regionSoftAssets.total || 0), 'Super Admin soft asset count should be global.');
assertOk(Array.isArray(auditRows), 'Coverage audit should return an array payload.');

const firstRegionAsset = Array.isArray(regionHardAssets.items) ? regionHardAssets.items[0] : null;
if (firstRegionAsset) {
    assertOk(firstRegionAsset.permissions, 'Region-scoped hard asset rows should include permissions.');
    assertOk(typeof firstRegionAsset.permissions.canEdit === 'boolean', 'permissions.canEdit should be boolean.');
}

console.log(JSON.stringify({
    superHardAssets: superHardAssets.total,
    regionHardAssets: regionHardAssets.total,
    superSoftAssets: superSoftAssets.total,
    regionSoftAssets: regionSoftAssets.total,
    auditKeys: Object.keys(audit),
}, null, 2));
```

- [ ] **Step 3: Run local API probes**

Run:

```bash
curl -sS http://localhost:8787/api/health
```

Expected:

```json
{"status":"ok"}
```

Use a local signed Super Admin session and Region Admin session to verify:

```bash
node --env-file=server/.env scripts/probe-overlapping-region-counts.mjs
```

Expected:

- Super Admin sees global counts.
- Region Admin sees resources matching assigned Region boundaries, including overlapping postal-code matches.
- Region Admin receives `permissions.canEdit = false` for region-relevant assets without explicit Owner/Staff access.

- [ ] **Step 4: Manual browser verification**

Open:

```text
http://localhost:5173/dashboard/resources
http://localhost:5173/dashboard/admin
```

Check:

- A Region Admin sees region-relevant hard assets from overlapping postal coverage.
- Edit/Delete/Hide/Access buttons are hidden or disabled when `permissions.canEdit` or `permissions.canManageAccess` is false.
- Super Admin can assign first Owner.
- Owner can add another Owner.
- Owner cannot remove final Owner.
- Standalone offering can be assigned service Regions.
- Standalone offering appears in matching Region dashboards.
- Standalone offering access panel uses direct soft-asset Owners/Staff.

- [ ] **Step 5: Update docs**

In `docs/regression-ledger.md`, add a dated row:

```markdown
| Overlapping Regions and explicit asset access | Region boundaries can overlap for read relevance while edit rights come only from explicit hard-asset or standalone-soft-asset Owner/Staff access; standalone services use service coverage Regions/Audience Zones | User architecture review on 2026-05-15 | Test overlapping postal coverage, first Owner assignment, Owner handover, last Owner guard, standalone service coverage, and Region Admin read-only access | Region overlap never grants edit rights; Super Admin first-assigns Owner; Owners manage Owner/Staff access; standalone services are coverage-based | 2026-05-15 |
```

In `docs/release-checklist.md`, add verification bullets for:

```markdown
- Overlapping Region read scope verified against at least one postal code in multiple Regions.
- Region Admin edit controls verified absent without explicit asset access.
- First Owner assignment and last Owner guard verified.
- Standalone soft asset service coverage verified with Region and Audience Zone coverage.
```

- [ ] **Step 6: Final commit for verification docs**

Run:

```bash
git add docs/regression-ledger.md docs/release-checklist.md scripts/probe-overlapping-region-counts.mjs
git commit -m "docs: record overlapping region access verification"
```

---

## Self-Review Checklist

- Spec coverage: Regions overlap, read relevance is separate from edit authority, Super Admin first Owner assignment, immediate Owner activation, last Owner guard, standalone service coverage, and standalone soft-asset access are each represented by tasks.
- Blast radius control: read scope, access lifecycle, schema, standalone coverage, UI, routing, and audit are separated into independent commits.
- Test coverage: every behavior change starts with a failing test or a build-gated client task.
- Migration safety: no task removes legacy `subregion_id`; new behavior is layered through helpers and explicit schema additions.
- Deployment safety: release prep requires full server tests, client build, diff check, local API probes, and browser verification.
