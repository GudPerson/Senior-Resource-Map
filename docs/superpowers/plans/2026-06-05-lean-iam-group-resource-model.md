# Lean IAM Group Resource Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add lightweight Org Group and Region Group coordination records without changing resource ownership, publishing, restricted-content access, public Discover visibility, auth behavior, external notifications, or approval flows.

**Architecture:** Add group coordination as additive governance metadata behind the existing `/api/governance` surface. The server owns the permission boundary with pure helpers and tests proving group roles do not become resource roles; the client renders a small management surface inside existing governance workspaces.

**Tech Stack:** Node test runner, Hono Worker controllers, Drizzle ORM schema, existing schema bootstrap, React, existing dashboard components, existing `api` client, existing release gate.

---

## Source Documents

- `/Users/sweetbuns/CareAroundSG/AGENTS.md`
- `/Users/sweetbuns/CareAroundSG/docs/regression-ledger.md`
- `/Users/sweetbuns/CareAroundSG/docs/release-checklist.md`
- `/Users/sweetbuns/CareAroundSG/docs/superpowers/specs/2026-06-05-lean-iam-group-resource-model-design.md`

## Scope And Blast Radius

This plan touches governance metadata, group membership, group-resource context, dashboard organisation UI, and schema bootstrap. It must stay narrow.

Do not change:

- production auth behavior, Gmail/email, WhatsApp/SMS delivery, GudAuth, secrets, or environment files
- public Discover ranking, sorting, filtering, eligibility, saved maps, shared maps, or public labels
- resource Owner/Staff permission checks
- restricted notes/files permission checks
- existing Region Admin behavior or global role enum values
- Audit Trail Phase 1 visibility scope beyond basic group-management audit rows
- inter-organisation approval, partner correction, or publishing gates

Schema risk:

- This plan adds tables. Local and preview execution can use the existing schema bootstrap pattern.
- Before production deploy, run the schema bootstrap gate from `/Users/sweetbuns/CareAroundSG/docs/release-checklist.md`.
- Do not deploy the Worker until the schema bootstrap has completed successfully for the intended production database.

## File Map

- Modify: `/Users/sweetbuns/CareAroundSG/server/src/db/schema.js`
  - Add additive group metadata tables and relations.
- Modify: `/Users/sweetbuns/CareAroundSG/server/src/utils/boundarySchema.js`
  - Add idempotent bootstrap SQL and indexes for the group tables.
- Modify: `/Users/sweetbuns/CareAroundSG/server/test/phoneIdentitySchema.test.js`
  - Add bootstrap coverage for group tables and indexes.
- Create: `/Users/sweetbuns/CareAroundSG/server/src/utils/governanceGroups.js`
  - Pure helpers for group type, group role, and permission boundaries.
- Create: `/Users/sweetbuns/CareAroundSG/server/test/governanceGroups.test.js`
  - Tests for group role normalization and "group roles are not resource roles".
- Modify: `/Users/sweetbuns/CareAroundSG/server/src/controllers/governanceController.js`
  - Add group list/create/update/member/link endpoints using the helper boundary.
- Modify: `/Users/sweetbuns/CareAroundSG/server/src/routes/governance.js`
  - Register group routes under `/api/governance/groups`.
- Modify: `/Users/sweetbuns/CareAroundSG/server/test/privateResourceContent.test.js`
  - Prove group roles do not grant restricted notes/files access.
- Modify: `/Users/sweetbuns/CareAroundSG/server/test/hardAssetStaff.test.js`
  - Prove group roles do not grant place Owner/Staff management power.
- Modify: `/Users/sweetbuns/CareAroundSG/server/test/softAssetAccess.test.js`
  - Prove group roles do not grant offering Owner/Staff management power.
- Modify: `/Users/sweetbuns/CareAroundSG/client/src/lib/api.js`
  - Add group API methods.
- Modify: `/Users/sweetbuns/CareAroundSG/client/src/lib/governanceOrganizationUi.js`
  - Add group copy helpers and hidden internal-label checks.
- Modify: `/Users/sweetbuns/CareAroundSG/client/test/governanceOrganizationUi.test.js`
  - Add group display helper tests.
- Create: `/Users/sweetbuns/CareAroundSG/client/src/components/admin/GovernanceGroupsPanel.jsx`
  - Group coordination panel for admin and organisation workspace contexts.
- Modify: `/Users/sweetbuns/CareAroundSG/client/src/components/admin/GovernanceOrganizationsPanel.jsx`
  - Show Org Groups for the selected organisation.
- Modify: `/Users/sweetbuns/CareAroundSG/client/src/lib/roles.js`
  - Add the Super Admin-only Region Groups tab key without changing Regional Admin tabs.
- Modify: `/Users/sweetbuns/CareAroundSG/client/src/pages/dashboard/AdminPage.jsx`
  - Show Region Groups in the Super Admin governance area without changing existing resource/admin tabs for other roles.
- Modify after behavior is verified: `/Users/sweetbuns/CareAroundSG/docs/regression-ledger.md`
  - Add the locked behavior and verification evidence.

## Task 1: Pure Group Permission Helpers

**Files:**
- Create: `/Users/sweetbuns/CareAroundSG/server/src/utils/governanceGroups.js`
- Create: `/Users/sweetbuns/CareAroundSG/server/test/governanceGroups.test.js`

- [ ] **Step 1: Write the failing helper tests**

Create `/Users/sweetbuns/CareAroundSG/server/test/governanceGroups.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    canCreateGovernanceGroup,
    canManageGovernanceGroup,
    canManageGovernanceGroupMemberRole,
    governanceGroupRolesGrantResourceEditRights,
    governanceGroupRolesGrantRestrictedContentAccess,
    normalizeGovernanceGroupRole,
    normalizeGovernanceGroupType,
} from '../src/utils/governanceGroups.js';

function actor(overrides = {}) {
    return {
        id: 20,
        role: 'standard',
        ...overrides,
    };
}

const org = { id: 7, name: 'Healthcare Group' };
const orgAccess = [
    { organizationId: 7, userId: 21, accessRole: 'admin', revokedAt: null },
    { organizationId: 7, userId: 22, accessRole: 'staff', revokedAt: null },
];

test('governance group types and roles stay narrow', () => {
    assert.equal(normalizeGovernanceGroupType('org'), 'org');
    assert.equal(normalizeGovernanceGroupType('organisation'), 'org');
    assert.equal(normalizeGovernanceGroupType('region'), 'region');
    assert.equal(normalizeGovernanceGroupType('ICCP SR'), 'region');
    assert.equal(normalizeGovernanceGroupType('owner'), null);

    assert.equal(normalizeGovernanceGroupRole('admin'), 'admin');
    assert.equal(normalizeGovernanceGroupRole(' staff '), 'staff');
    assert.equal(normalizeGovernanceGroupRole('owner'), null);
    assert.equal(normalizeGovernanceGroupRole('resource_staff'), null);
});

test('group roles never grant resource editing or restricted content', () => {
    assert.equal(governanceGroupRolesGrantResourceEditRights(), false);
    assert.equal(governanceGroupRolesGrantRestrictedContentAccess(), false);
});

test('organisation admins and super admins can create org groups', () => {
    assert.equal(canCreateGovernanceGroup(actor({ role: 'super_admin' }), { groupType: 'org', organization: org, organizationAccessRows: [] }).allowed, true);
    assert.equal(canCreateGovernanceGroup(actor({ id: 21 }), { groupType: 'org', organization: org, organizationAccessRows: orgAccess }).allowed, true);

    const staffDecision = canCreateGovernanceGroup(actor({ id: 22 }), { groupType: 'org', organization: org, organizationAccessRows: orgAccess });
    assert.equal(staffDecision.allowed, false);
    assert.match(staffDecision.reason, /Organisation Admin/);
});

test('only super admins create region groups in V1', () => {
    assert.equal(canCreateGovernanceGroup(actor({ role: 'super_admin' }), { groupType: 'region' }).allowed, true);

    const decision = canCreateGovernanceGroup(actor({ role: 'regional_admin' }), { groupType: 'region' });
    assert.equal(decision.allowed, false);
    assert.match(decision.reason, /Super Admin/);
});

test('active group admins can manage coordination membership but not promote other admins', () => {
    const group = { id: 90, groupType: 'org', organizationId: 7 };
    const groupMemberships = [
        { groupId: 90, userId: 23, groupRole: 'admin', revokedAt: null },
        { groupId: 90, userId: 24, groupRole: 'staff', revokedAt: null },
    ];

    assert.equal(canManageGovernanceGroup(actor({ id: 21 }), group, groupMemberships, orgAccess).allowed, true);
    assert.equal(canManageGovernanceGroup(actor({ id: 23 }), group, groupMemberships, orgAccess).allowed, true);

    const staffDecision = canManageGovernanceGroup(actor({ id: 24 }), group, groupMemberships, orgAccess);
    assert.equal(staffDecision.allowed, false);

    assert.equal(canManageGovernanceGroupMemberRole(actor({ id: 23 }), group, groupMemberships, orgAccess, 'staff').allowed, true);

    const promoteDecision = canManageGovernanceGroupMemberRole(actor({ id: 23 }), group, groupMemberships, orgAccess, 'admin');
    assert.equal(promoteDecision.allowed, false);
    assert.match(promoteDecision.reason, /Organisation Admin or Super Admin/);
});
```

- [ ] **Step 2: Run the failing helper tests**

Run:

```bash
node --test server/test/governanceGroups.test.js
```

Expected: FAIL because `/Users/sweetbuns/CareAroundSG/server/src/utils/governanceGroups.js` does not exist.

- [ ] **Step 3: Create the helper module**

Create `/Users/sweetbuns/CareAroundSG/server/src/utils/governanceGroups.js`:

```js
import { canManageOrganizationGovernance, normalizeOrganizationAccessRole } from './governance.js';
import { normalizeRole } from './roles.js';

const GROUP_TYPES = new Map([
    ['org', 'org'],
    ['organisation', 'org'],
    ['organization', 'org'],
    ['org_group', 'org'],
    ['region', 'region'],
    ['regional', 'region'],
    ['region_group', 'region'],
    ['iccp', 'region'],
    ['iccp_sr', 'region'],
]);

const GROUP_ROLES = new Set(['admin', 'staff']);

function normalizeValue(value) {
    return String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function isActiveRow(row) {
    return row && !row.revokedAt && !row.unlinkedAt;
}

function actorId(actor) {
    const id = Number(actor?.id);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function groupId(group) {
    const id = Number(group?.id);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function findActiveGroupMembership(actor, group, memberships = []) {
    const userId = actorId(actor);
    const targetGroupId = groupId(group);
    if (!userId || !targetGroupId) return null;
    return (memberships || []).find((membership) => (
        Number(membership?.groupId) === targetGroupId
        && Number(membership?.userId) === userId
        && isActiveRow(membership)
        && normalizeGovernanceGroupRole(membership?.groupRole)
    )) || null;
}

export function normalizeGovernanceGroupType(value) {
    return GROUP_TYPES.get(normalizeValue(value)) || null;
}

export function normalizeGovernanceGroupRole(value) {
    const normalized = normalizeValue(value);
    return GROUP_ROLES.has(normalized) ? normalized : null;
}

export function governanceGroupRolesGrantResourceEditRights() {
    return false;
}

export function governanceGroupRolesGrantRestrictedContentAccess() {
    return false;
}

export function canCreateGovernanceGroup(actor, {
    groupType,
    organization = null,
    organizationAccessRows = [],
} = {}) {
    const type = normalizeGovernanceGroupType(groupType);
    if (!type) {
        return { allowed: false, reason: 'Choose Org Group or Region Group.' };
    }

    if (normalizeRole(actor?.role) === 'super_admin') {
        return { allowed: true, reason: null };
    }

    if (type === 'org' && canManageOrganizationGovernance(actor, organization, organizationAccessRows)) {
        return { allowed: true, reason: null };
    }

    if (type === 'org') {
        return { allowed: false, reason: 'Only Organisation Admins and Super Admins can create Org Groups.' };
    }

    return { allowed: false, reason: 'Only Super Admins can create Region Groups in V1.' };
}

export function canManageGovernanceGroup(actor, group, groupMemberships = [], organizationAccessRows = []) {
    if (normalizeRole(actor?.role) === 'super_admin') {
        return { allowed: true, reason: null };
    }

    const type = normalizeGovernanceGroupType(group?.groupType);
    if (type === 'org' && canManageOrganizationGovernance(actor, {
        id: group?.organizationId,
    }, organizationAccessRows)) {
        return { allowed: true, reason: null };
    }

    const membership = findActiveGroupMembership(actor, group, groupMemberships);
    if (normalizeGovernanceGroupRole(membership?.groupRole) === 'admin') {
        return { allowed: true, reason: null };
    }

    return { allowed: false, reason: 'Group coordination is outside your access.' };
}

export function canManageGovernanceGroupMemberRole(actor, group, groupMemberships = [], organizationAccessRows = [], targetRole) {
    const role = normalizeGovernanceGroupRole(targetRole);
    if (!role) {
        return { allowed: false, reason: 'Choose Admin or Staff group membership.' };
    }

    const manageDecision = canManageGovernanceGroup(actor, group, groupMemberships, organizationAccessRows);
    if (!manageDecision.allowed) return manageDecision;

    if (role === 'staff') {
        return { allowed: true, reason: null };
    }

    if (normalizeRole(actor?.role) === 'super_admin') {
        return { allowed: true, reason: null };
    }

    const type = normalizeGovernanceGroupType(group?.groupType);
    if (type === 'org' && canManageOrganizationGovernance(actor, {
        id: group?.organizationId,
    }, organizationAccessRows)) {
        return { allowed: true, reason: null };
    }

    return {
        allowed: false,
        reason: 'Only an Organisation Admin or Super Admin can add another group Admin.',
    };
}

export function filterExistingOrganizationUsersForOrgGroup(candidates = [], organizationAccessRows = []) {
    const activeOrgUserIds = new Set((organizationAccessRows || [])
        .filter((row) => !row?.revokedAt && normalizeOrganizationAccessRole(row?.accessRole))
        .map((row) => Number(row.userId))
        .filter(Boolean));

    return (candidates || []).filter((candidate) => activeOrgUserIds.has(Number(candidate?.id)));
}
```

- [ ] **Step 4: Verify Task 1**

Run:

```bash
node --test server/test/governanceGroups.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add server/src/utils/governanceGroups.js server/test/governanceGroups.test.js
git commit -m "Add governance group permission helpers"
```

## Task 2: Schema And Bootstrap

**Files:**
- Modify: `/Users/sweetbuns/CareAroundSG/server/src/db/schema.js`
- Modify: `/Users/sweetbuns/CareAroundSG/server/src/utils/boundarySchema.js`
- Modify: `/Users/sweetbuns/CareAroundSG/server/test/phoneIdentitySchema.test.js`

- [ ] **Step 1: Add failing bootstrap test**

Append this test to `/Users/sweetbuns/CareAroundSG/server/test/phoneIdentitySchema.test.js`:

```js
test('runtime schema bootstrap includes governance group coordination tables', async () => {
    const executed = [];
    const fakeDb = {
        execute: async (query) => {
            executed.push(String(query?.sql || query));
        },
    };

    resetBoundarySchemaBootstrapForTests();
    await ensureBoundarySchema(fakeDb, { NODE_ENV: 'development' });

    const combined = executed.join('\n');
    assert.match(combined, /CREATE TABLE IF NOT EXISTS governance_groups/i);
    assert.match(combined, /CREATE TABLE IF NOT EXISTS governance_group_memberships/i);
    assert.match(combined, /CREATE TABLE IF NOT EXISTS governance_group_organizations/i);
    assert.match(combined, /CREATE TABLE IF NOT EXISTS governance_group_resource_links/i);
    assert.match(combined, /governance_groups_type_idx/i);
    assert.match(combined, /governance_group_memberships_active_user_unique/i);
    assert.match(combined, /governance_group_resource_links_active_resource_unique/i);
});
```

- [ ] **Step 2: Run the failing bootstrap test**

Run:

```bash
node --test server/test/phoneIdentitySchema.test.js
```

Expected: FAIL because the bootstrap SQL does not yet create group coordination tables.

- [ ] **Step 3: Add group tables to Drizzle schema**

In `/Users/sweetbuns/CareAroundSG/server/src/db/schema.js`, add these table definitions after `organizationResourceLinks`:

```js
export const governanceGroups = pgTable('governance_groups', {
  id: serial('id').primaryKey(),
  groupType: varchar('group_type', { length: 20 }).notNull(),
  organizationId: integer('organization_id').references(() => partnerOrganizations.id, { onDelete: 'cascade' }),
  subregionId: integer('subregion_id').references(() => subregions.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  coordinationStatus: varchar('coordination_status', { length: 40 }).notNull().default('active'),
  publicLabel: varchar('public_label', { length: 255 }),
  publicSummary: text('public_summary'),
  archivedAt: timestamp('archived_at'),
  createdByUserId: integer('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  updatedByUserId: integer('updated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  typeIdx: index('governance_groups_type_idx').on(table.groupType),
  organizationIdx: index('governance_groups_organization_idx').on(table.organizationId),
  subregionIdx: index('governance_groups_subregion_idx').on(table.subregionId),
  statusIdx: index('governance_groups_status_idx').on(table.coordinationStatus),
}));

export const governanceGroupMemberships = pgTable('governance_group_memberships', {
  id: serial('id').primaryKey(),
  groupId: integer('group_id').references(() => governanceGroups.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  groupRole: varchar('group_role', { length: 40 }).notNull().default('staff'),
  revokedAt: timestamp('revoked_at'),
  createdByUserId: integer('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  updatedByUserId: integer('updated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  activeUserUnique: uniqueIndex('governance_group_memberships_active_user_unique')
    .on(table.groupId, table.userId)
    .where(sql`${table.revokedAt} IS NULL`),
  groupIdx: index('governance_group_memberships_group_idx').on(table.groupId),
  userIdx: index('governance_group_memberships_user_idx').on(table.userId),
  roleIdx: index('governance_group_memberships_role_idx').on(table.groupRole),
}));

export const governanceGroupOrganizations = pgTable('governance_group_organizations', {
  id: serial('id').primaryKey(),
  groupId: integer('group_id').references(() => governanceGroups.id, { onDelete: 'cascade' }).notNull(),
  organizationId: integer('organization_id').references(() => partnerOrganizations.id, { onDelete: 'cascade' }).notNull(),
  linkStatus: varchar('link_status', { length: 40 }).notNull().default('active'),
  unlinkedAt: timestamp('unlinked_at'),
  linkedByUserId: integer('linked_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  unlinkedByUserId: integer('unlinked_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  activeOrganizationUnique: uniqueIndex('governance_group_organizations_active_unique')
    .on(table.groupId, table.organizationId)
    .where(sql`${table.unlinkedAt} IS NULL`),
  groupIdx: index('governance_group_organizations_group_idx').on(table.groupId),
  organizationIdx: index('governance_group_organizations_organization_idx').on(table.organizationId),
}));

export const governanceGroupResourceLinks = pgTable('governance_group_resource_links', {
  id: serial('id').primaryKey(),
  groupId: integer('group_id').references(() => governanceGroups.id, { onDelete: 'cascade' }).notNull(),
  resourceType: varchar('resource_type', { length: 20 }).notNull(),
  resourceId: integer('resource_id').notNull(),
  linkStatus: varchar('link_status', { length: 40 }).notNull().default('active'),
  unlinkedAt: timestamp('unlinked_at'),
  linkedByUserId: integer('linked_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  unlinkedByUserId: integer('unlinked_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  activeResourceUnique: uniqueIndex('governance_group_resource_links_active_resource_unique')
    .on(table.groupId, table.resourceType, table.resourceId)
    .where(sql`${table.unlinkedAt} IS NULL`),
  groupIdx: index('governance_group_resource_links_group_idx').on(table.groupId),
  resourceIdx: index('governance_group_resource_links_resource_idx').on(table.resourceType, table.resourceId),
}));
```

Add these relation entries near the existing organisation relations:

```js
export const governanceGroupsRelations = relations(governanceGroups, ({ one, many }) => ({
  organization: one(partnerOrganizations, {
    fields: [governanceGroups.organizationId],
    references: [partnerOrganizations.id],
  }),
  subregion: one(subregions, {
    fields: [governanceGroups.subregionId],
    references: [subregions.id],
  }),
  memberships: many(governanceGroupMemberships),
  organizations: many(governanceGroupOrganizations),
  resources: many(governanceGroupResourceLinks),
}));

export const governanceGroupMembershipsRelations = relations(governanceGroupMemberships, ({ one }) => ({
  group: one(governanceGroups, {
    fields: [governanceGroupMemberships.groupId],
    references: [governanceGroups.id],
  }),
  user: one(users, {
    fields: [governanceGroupMemberships.userId],
    references: [users.id],
  }),
}));

export const governanceGroupOrganizationsRelations = relations(governanceGroupOrganizations, ({ one }) => ({
  group: one(governanceGroups, {
    fields: [governanceGroupOrganizations.groupId],
    references: [governanceGroups.id],
  }),
  organization: one(partnerOrganizations, {
    fields: [governanceGroupOrganizations.organizationId],
    references: [partnerOrganizations.id],
  }),
}));

export const governanceGroupResourceLinksRelations = relations(governanceGroupResourceLinks, ({ one }) => ({
  group: one(governanceGroups, {
    fields: [governanceGroupResourceLinks.groupId],
    references: [governanceGroups.id],
  }),
}));
```

Also extend `usersRelations` with:

```js
  governanceGroupMemberships: many(governanceGroupMemberships),
```

And extend `partnerOrganizationsRelations` with:

```js
  governanceGroups: many(governanceGroups),
  groupLinks: many(governanceGroupOrganizations),
```

- [ ] **Step 4: Add idempotent bootstrap SQL**

In `/Users/sweetbuns/CareAroundSG/server/src/utils/boundarySchema.js`, add this block after the `organization_resource_links` table/bootstrap block:

```js
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS governance_groups (
                    id SERIAL PRIMARY KEY,
                    group_type VARCHAR(20) NOT NULL,
                    organization_id INTEGER REFERENCES partner_organizations(id) ON DELETE CASCADE,
                    subregion_id INTEGER REFERENCES subregions(id) ON DELETE SET NULL,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    coordination_status VARCHAR(40) NOT NULL DEFAULT 'active',
                    public_label VARCHAR(255),
                    public_summary TEXT,
                    archived_at TIMESTAMP,
                    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    updated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS governance_group_memberships (
                    id SERIAL PRIMARY KEY,
                    group_id INTEGER NOT NULL REFERENCES governance_groups(id) ON DELETE CASCADE,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    group_role VARCHAR(40) NOT NULL DEFAULT 'staff',
                    revoked_at TIMESTAMP,
                    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    updated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS governance_group_organizations (
                    id SERIAL PRIMARY KEY,
                    group_id INTEGER NOT NULL REFERENCES governance_groups(id) ON DELETE CASCADE,
                    organization_id INTEGER NOT NULL REFERENCES partner_organizations(id) ON DELETE CASCADE,
                    link_status VARCHAR(40) NOT NULL DEFAULT 'active',
                    unlinked_at TIMESTAMP,
                    linked_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    unlinked_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS governance_group_resource_links (
                    id SERIAL PRIMARY KEY,
                    group_id INTEGER NOT NULL REFERENCES governance_groups(id) ON DELETE CASCADE,
                    resource_type VARCHAR(20) NOT NULL,
                    resource_id INTEGER NOT NULL,
                    link_status VARCHAR(40) NOT NULL DEFAULT 'active',
                    unlinked_at TIMESTAMP,
                    linked_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    unlinked_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);
```

Add these index statements near the organisation governance indexes:

```js
            await db.execute(sql`CREATE INDEX IF NOT EXISTS governance_groups_type_idx ON governance_groups (group_type)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS governance_groups_organization_idx ON governance_groups (organization_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS governance_groups_subregion_idx ON governance_groups (subregion_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS governance_groups_status_idx ON governance_groups (coordination_status)`);
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS governance_group_memberships_active_user_unique ON governance_group_memberships (group_id, user_id) WHERE revoked_at IS NULL`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS governance_group_memberships_group_idx ON governance_group_memberships (group_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS governance_group_memberships_user_idx ON governance_group_memberships (user_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS governance_group_memberships_role_idx ON governance_group_memberships (group_role)`);
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS governance_group_organizations_active_unique ON governance_group_organizations (group_id, organization_id) WHERE unlinked_at IS NULL`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS governance_group_organizations_group_idx ON governance_group_organizations (group_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS governance_group_organizations_organization_idx ON governance_group_organizations (organization_id)`);
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS governance_group_resource_links_active_resource_unique ON governance_group_resource_links (group_id, resource_type, resource_id) WHERE unlinked_at IS NULL`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS governance_group_resource_links_group_idx ON governance_group_resource_links (group_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS governance_group_resource_links_resource_idx ON governance_group_resource_links (resource_type, resource_id)`);
```

- [ ] **Step 5: Verify Task 2**

Run:

```bash
node --test server/test/phoneIdentitySchema.test.js
node --test server/test/governanceGroups.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add server/src/db/schema.js server/src/utils/boundarySchema.js server/test/phoneIdentitySchema.test.js
git commit -m "Add governance group coordination schema"
```

## Task 3: Server API Surface

**Files:**
- Modify: `/Users/sweetbuns/CareAroundSG/server/src/controllers/governanceController.js`
- Modify: `/Users/sweetbuns/CareAroundSG/server/src/routes/governance.js`
- Test: `/Users/sweetbuns/CareAroundSG/server/test/governanceGroups.test.js`

- [ ] **Step 1: Add route-shape tests for exported controller names**

Append this test to `/Users/sweetbuns/CareAroundSG/server/test/governanceGroups.test.js`:

```js
test('governance group controller exports are named for the route surface', async () => {
    const controller = await import('../src/controllers/governanceController.js');
    assert.equal(typeof controller.listGovernanceGroups, 'function');
    assert.equal(typeof controller.createGovernanceGroup, 'function');
    assert.equal(typeof controller.updateGovernanceGroup, 'function');
    assert.equal(typeof controller.addGovernanceGroupMember, 'function');
    assert.equal(typeof controller.revokeGovernanceGroupMember, 'function');
    assert.equal(typeof controller.linkGovernanceGroupOrganization, 'function');
    assert.equal(typeof controller.unlinkGovernanceGroupOrganization, 'function');
    assert.equal(typeof controller.linkGovernanceGroupResource, 'function');
    assert.equal(typeof controller.unlinkGovernanceGroupResource, 'function');
});
```

- [ ] **Step 2: Run the failing route-shape test**

Run:

```bash
node --test server/test/governanceGroups.test.js
```

Expected: FAIL because the controller exports do not exist yet.

- [ ] **Step 3: Import group tables and helper names**

In `/Users/sweetbuns/CareAroundSG/server/src/controllers/governanceController.js`, extend the schema import:

```js
    governanceGroupMemberships,
    governanceGroupOrganizations,
    governanceGroupResourceLinks,
    governanceGroups,
    subregions,
```

Add this import:

```js
import {
    canCreateGovernanceGroup,
    canManageGovernanceGroup,
    canManageGovernanceGroupMemberRole,
    filterExistingOrganizationUsersForOrgGroup,
    normalizeGovernanceGroupRole,
    normalizeGovernanceGroupType,
} from '../utils/governanceGroups.js';
```

- [ ] **Step 4: Add validation schemas**

Add these schemas near the other governance body schemas:

```js
const governanceGroupBodySchema = z.object({
    groupType: optionalOneLineTextSchema(20).default('org'),
    organizationId: positiveIntValueSchema('organizationId').optional(),
    subregionId: positiveIntValueSchema('subregionId').optional(),
    name: requiredOneLineTextSchema('Group name', 255),
    description: optionalTextSchema(2000),
    coordinationStatus: optionalOneLineTextSchema(40).default('active'),
    publicLabel: optionalOneLineTextSchema(255),
    publicSummary: optionalTextSchema(1000),
});

const governanceGroupMemberBodySchema = z.object({
    userId: positiveIntValueSchema('userId'),
    groupRole: optionalOneLineTextSchema(40).default('staff'),
});

const governanceGroupOrganizationBodySchema = z.object({
    organizationId: positiveIntValueSchema('organizationId'),
});

const governanceGroupResourceBodySchema = z.object({
    resourceType: z.enum(['hard', 'soft', 'template']),
    resourceId: positiveIntValueSchema('resourceId'),
});
```

- [ ] **Step 5: Add format and load helpers**

Add these helpers after `formatOrganization`:

```js
function parseOptionalPositiveInt(value, label = 'id') {
    if (value === undefined || value === null || String(value).trim() === '') return null;
    return parsePositiveInt(value, label);
}

function formatGovernanceGroupMember(row) {
    return {
        id: row.id,
        groupId: row.groupId,
        userId: row.userId,
        groupRole: row.groupRole,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        user: {
            id: row.userId,
            username: row.username,
            email: row.email,
            name: row.userName,
            role: row.userRole,
        },
    };
}

function formatGovernanceGroupOrganization(row) {
    return {
        id: row.id,
        groupId: row.groupId,
        organizationId: row.organizationId,
        organizationName: row.organizationName,
        linkStatus: row.linkStatus,
        unlinkedAt: row.unlinkedAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

function formatGovernanceGroupResource(row) {
    return {
        id: row.id,
        groupId: row.groupId,
        resourceType: row.resourceType,
        resourceId: row.resourceId,
        resourceName: row.resourceName || null,
        linkStatus: row.linkStatus,
        unlinkedAt: row.unlinkedAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

function formatGovernanceGroup(row, grouped = {}) {
    const groupId = Number(row.id);
    return {
        id: row.id,
        groupType: normalizeGovernanceGroupType(row.groupType),
        organizationId: row.organizationId || null,
        organizationName: row.organizationName || null,
        subregionId: row.subregionId || null,
        subregionName: row.subregionName || null,
        name: row.name,
        description: row.description || '',
        coordinationStatus: row.coordinationStatus || 'active',
        publicLabel: row.publicLabel || '',
        publicSummary: row.publicSummary || '',
        archivedAt: row.archivedAt || null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        members: (grouped.members?.get(groupId) || []).map(formatGovernanceGroupMember),
        organizations: (grouped.organizations?.get(groupId) || []).map(formatGovernanceGroupOrganization),
        resources: (grouped.resources?.get(groupId) || []).map(formatGovernanceGroupResource),
    };
}
```

Add these helpers near the organisation loading helpers:

```js
async function loadActiveGovernanceGroupMembershipRows(db, groupIds) {
    const ids = uniquePositiveIds(groupIds);
    if (!ids.length) return [];
    return db.select({
        id: governanceGroupMemberships.id,
        groupId: governanceGroupMemberships.groupId,
        userId: governanceGroupMemberships.userId,
        groupRole: governanceGroupMemberships.groupRole,
        revokedAt: governanceGroupMemberships.revokedAt,
        createdAt: governanceGroupMemberships.createdAt,
        updatedAt: governanceGroupMemberships.updatedAt,
        username: users.username,
        email: users.email,
        userName: users.name,
        userRole: users.role,
    })
        .from(governanceGroupMemberships)
        .innerJoin(users, eq(governanceGroupMemberships.userId, users.id))
        .where(and(
            inArray(governanceGroupMemberships.groupId, ids),
            isNull(governanceGroupMemberships.revokedAt),
        ));
}

async function loadGovernanceGroupOrganizations(db, groupIds) {
    const ids = uniquePositiveIds(groupIds);
    if (!ids.length) return [];
    return db.select({
        id: governanceGroupOrganizations.id,
        groupId: governanceGroupOrganizations.groupId,
        organizationId: governanceGroupOrganizations.organizationId,
        organizationName: partnerOrganizations.name,
        linkStatus: governanceGroupOrganizations.linkStatus,
        unlinkedAt: governanceGroupOrganizations.unlinkedAt,
        createdAt: governanceGroupOrganizations.createdAt,
        updatedAt: governanceGroupOrganizations.updatedAt,
    })
        .from(governanceGroupOrganizations)
        .innerJoin(partnerOrganizations, eq(governanceGroupOrganizations.organizationId, partnerOrganizations.id))
        .where(and(
            inArray(governanceGroupOrganizations.groupId, ids),
            isNull(governanceGroupOrganizations.unlinkedAt),
        ));
}

async function loadGovernanceGroupResources(db, groupIds) {
    const ids = uniquePositiveIds(groupIds);
    if (!ids.length) return [];
    const rows = await db.select().from(governanceGroupResourceLinks)
        .where(and(
            inArray(governanceGroupResourceLinks.groupId, ids),
            isNull(governanceGroupResourceLinks.unlinkedAt),
        ));
    return rows;
}

async function loadGovernanceGroupDetails(db, groups) {
    const groupIds = groups.map((group) => Number(group.id)).filter(Boolean);
    const [members, organizations, resources] = await Promise.all([
        loadActiveGovernanceGroupMembershipRows(db, groupIds),
        loadGovernanceGroupOrganizations(db, groupIds),
        loadGovernanceGroupResources(db, groupIds),
    ]);
    return {
        members: groupByOrganization(members.map((row) => ({ ...row, organizationId: row.groupId }))),
        organizations: groupByOrganization(organizations.map((row) => ({ ...row, organizationId: row.groupId }))),
        resources: groupByOrganization(resources.map((row) => ({ ...row, organizationId: row.groupId }))),
    };
}
```

- [ ] **Step 6: Add controller exports**

Add these exports near the organisation exports. Keep them small and reuse the helpers from Step 5.

```js
export const listGovernanceGroups = async (c) => {
    try {
        const actor = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const type = normalizeGovernanceGroupType(c.req.query('type') || '');
        const organizationId = parseOptionalPositiveInt(c.req.query('organizationId'), 'organizationId');

        let groups = [];
        if (normalizeRole(actor?.role) === 'super_admin') {
            groups = await db.select({
                id: governanceGroups.id,
                groupType: governanceGroups.groupType,
                organizationId: governanceGroups.organizationId,
                organizationName: partnerOrganizations.name,
                subregionId: governanceGroups.subregionId,
                subregionName: subregions.name,
                name: governanceGroups.name,
                description: governanceGroups.description,
                coordinationStatus: governanceGroups.coordinationStatus,
                publicLabel: governanceGroups.publicLabel,
                publicSummary: governanceGroups.publicSummary,
                archivedAt: governanceGroups.archivedAt,
                createdAt: governanceGroups.createdAt,
                updatedAt: governanceGroups.updatedAt,
            })
                .from(governanceGroups)
                .leftJoin(partnerOrganizations, eq(governanceGroups.organizationId, partnerOrganizations.id))
                .leftJoin(subregions, eq(governanceGroups.subregionId, subregions.id))
                .where(and(
                    type ? eq(governanceGroups.groupType, type) : undefined,
                    organizationId ? eq(governanceGroups.organizationId, organizationId) : undefined,
                    isNull(governanceGroups.archivedAt),
                ))
                .orderBy(governanceGroups.name);
        } else {
            const memberships = await db.select({ groupId: governanceGroupMemberships.groupId })
                .from(governanceGroupMemberships)
                .where(and(
                    eq(governanceGroupMemberships.userId, actor.id),
                    isNull(governanceGroupMemberships.revokedAt),
                ));
            const membershipGroupIds = uniquePositiveIds(memberships.map((row) => row.groupId));

            const orgAccessRows = await db.select({ organizationId: organizationAccessMemberships.organizationId })
                .from(organizationAccessMemberships)
                .where(and(
                    eq(organizationAccessMemberships.userId, actor.id),
                    isNull(organizationAccessMemberships.revokedAt),
                ));
            const orgIds = uniquePositiveIds(orgAccessRows.map((row) => row.organizationId));

            const visibleConditions = [];
            if (membershipGroupIds.length) visibleConditions.push(inArray(governanceGroups.id, membershipGroupIds));
            if (orgIds.length) visibleConditions.push(inArray(governanceGroups.organizationId, orgIds));

            groups = visibleConditions.length
                ? await db.select({
                    id: governanceGroups.id,
                    groupType: governanceGroups.groupType,
                    organizationId: governanceGroups.organizationId,
                    organizationName: partnerOrganizations.name,
                    subregionId: governanceGroups.subregionId,
                    subregionName: subregions.name,
                    name: governanceGroups.name,
                    description: governanceGroups.description,
                    coordinationStatus: governanceGroups.coordinationStatus,
                    publicLabel: governanceGroups.publicLabel,
                    publicSummary: governanceGroups.publicSummary,
                    archivedAt: governanceGroups.archivedAt,
                    createdAt: governanceGroups.createdAt,
                    updatedAt: governanceGroups.updatedAt,
                })
                    .from(governanceGroups)
                    .leftJoin(partnerOrganizations, eq(governanceGroups.organizationId, partnerOrganizations.id))
                    .leftJoin(subregions, eq(governanceGroups.subregionId, subregions.id))
                    .where(and(
                        or(...visibleConditions),
                        type ? eq(governanceGroups.groupType, type) : undefined,
                        organizationId ? eq(governanceGroups.organizationId, organizationId) : undefined,
                        isNull(governanceGroups.archivedAt),
                    ))
                    .orderBy(governanceGroups.name)
                : [];
        }

        const grouped = await loadGovernanceGroupDetails(db, groups);
        return c.json({ groups: groups.map((group) => formatGovernanceGroup(group, grouped)) });
    } catch (err) {
        console.error('listGovernanceGroups Error:', err);
        return c.json({ error: err.message || 'Failed to load groups.' }, err.status || 500);
    }
};

export const createGovernanceGroup = async (c) => {
    try {
        const actor = c.get('user');
        const body = validateRequestBody(await c.req.json(), governanceGroupBodySchema, 'Group');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const groupType = normalizeGovernanceGroupType(body.groupType);
        if (!groupType) throw httpError('Choose Org Group or Region Group.', 400);

        const organization = body.organizationId ? await loadOrganization(db, body.organizationId) : null;
        const accessRows = body.organizationId ? await loadActiveOrganizationAccessRows(db, body.organizationId) : [];
        const decision = canCreateGovernanceGroup(actor, { groupType, organization, organizationAccessRows: accessRows });
        if (!decision.allowed) throw httpError(decision.reason, 403);
        if (groupType === 'org' && !body.organizationId) throw httpError('Org Groups must belong to one organisation.', 400);
        if (groupType === 'region' && body.organizationId) throw httpError('Region Groups should not belong to a single organisation.', 400);

        const [created] = await db.insert(governanceGroups).values({
            groupType,
            organizationId: groupType === 'org' ? body.organizationId : null,
            subregionId: groupType === 'region' ? body.subregionId || null : null,
            name: body.name,
            description: body.description || null,
            coordinationStatus: body.coordinationStatus || 'active',
            publicLabel: body.publicLabel || null,
            publicSummary: body.publicSummary || null,
            createdByUserId: actor.id,
            updatedByUserId: actor.id,
        }).returning();

        await recordSensitiveAuditLog(db, actor, {
            actionType: 'governance_group_created',
            entityType: 'governance_group',
            entityId: created.id,
            organizationId: created.organizationId || null,
            metadata: { groupType: created.groupType, name: created.name },
        });

        return c.json(formatGovernanceGroup(created), 201);
    } catch (err) {
        console.error('createGovernanceGroup Error:', err);
        return c.json({ error: err.message || 'Group could not be created.' }, err.status || 500);
    }
};
```

Add the update export:

```js
export const updateGovernanceGroup = async (c) => {
    try {
        const actor = c.get('user');
        const groupId = parsePositiveInt(c.req.param('groupId'), 'groupId');
        const body = validateRequestBody(await c.req.json(), governanceGroupBodySchema, 'Group');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const [group] = await db.select().from(governanceGroups).where(eq(governanceGroups.id, groupId)).limit(1);
        if (!group || group.archivedAt) throw httpError('Group was not found.', 404);
        const memberships = await loadActiveGovernanceGroupMembershipRows(db, [groupId]);
        const accessRows = group.organizationId ? await loadActiveOrganizationAccessRows(db, group.organizationId) : [];
        const decision = canManageGovernanceGroup(actor, group, memberships, accessRows);
        if (!decision.allowed) throw httpError(decision.reason, 403);

        const [updated] = await db.update(governanceGroups).set({
            name: body.name,
            description: body.description || null,
            coordinationStatus: body.coordinationStatus || 'active',
            publicLabel: body.publicLabel || null,
            publicSummary: body.publicSummary || null,
            subregionId: normalizeGovernanceGroupType(group.groupType) === 'region' ? body.subregionId || null : null,
            updatedByUserId: actor.id,
            updatedAt: new Date(),
        }).where(eq(governanceGroups.id, groupId)).returning();

        await recordSensitiveAuditLog(db, actor, {
            actionType: 'governance_group_updated',
            entityType: 'governance_group',
            entityId: updated.id,
            organizationId: updated.organizationId || null,
            metadata: { groupType: updated.groupType, name: updated.name },
        });

        return c.json(formatGovernanceGroup(updated));
    } catch (err) {
        console.error('updateGovernanceGroup Error:', err);
        return c.json({ error: err.message || 'Group could not be updated.' }, err.status || 500);
    }
};
```

Add the member-add export:

```js
export const addGovernanceGroupMember = async (c) => {
    try {
        const actor = c.get('user');
        const groupId = parsePositiveInt(c.req.param('groupId'), 'groupId');
        const body = validateRequestBody(await c.req.json(), governanceGroupMemberBodySchema, 'Group member');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const [group] = await db.select().from(governanceGroups).where(eq(governanceGroups.id, groupId)).limit(1);
        if (!group || group.archivedAt) throw httpError('Group was not found.', 404);
        const memberships = await loadActiveGovernanceGroupMembershipRows(db, [groupId]);
        const accessRows = group.organizationId ? await loadActiveOrganizationAccessRows(db, group.organizationId) : [];
        const groupRole = normalizeGovernanceGroupRole(body.groupRole);
        const decision = canManageGovernanceGroupMemberRole(actor, group, memberships, accessRows, groupRole);
        if (!decision.allowed) throw httpError(decision.reason, 403);

        if (normalizeGovernanceGroupType(group.groupType) === 'org') {
            const filtered = filterExistingOrganizationUsersForOrgGroup([{ id: body.userId }], accessRows);
            if (!filtered.length) throw httpError('Org Group members must already have access to this organisation.', 409);
        }

        const [existing] = await db.select().from(governanceGroupMemberships)
            .where(and(
                eq(governanceGroupMemberships.groupId, groupId),
                eq(governanceGroupMemberships.userId, body.userId),
            ))
            .limit(1);

        const [membership] = existing
            ? await db.update(governanceGroupMemberships).set({
                groupRole,
                revokedAt: null,
                updatedByUserId: actor.id,
                updatedAt: new Date(),
            }).where(eq(governanceGroupMemberships.id, existing.id)).returning()
            : await db.insert(governanceGroupMemberships).values({
                groupId,
                userId: body.userId,
                groupRole,
                createdByUserId: actor.id,
                updatedByUserId: actor.id,
            }).returning();

        await recordSensitiveAuditLog(db, actor, {
            actionType: 'governance_group_member_added',
            entityType: 'governance_group_membership',
            entityId: membership.id,
            targetUserId: membership.userId,
            organizationId: group.organizationId || null,
            metadata: { groupId, groupRole },
        });

        return c.json(membership, 201);
    } catch (err) {
        console.error('addGovernanceGroupMember Error:', err);
        return c.json({ error: err.message || 'Group member could not be added.' }, err.status || 500);
    }
};
```

Add the member-revoke export:

```js
export const revokeGovernanceGroupMember = async (c) => {
    try {
        const actor = c.get('user');
        const groupId = parsePositiveInt(c.req.param('groupId'), 'groupId');
        const membershipId = parsePositiveInt(c.req.param('membershipId'), 'membershipId');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const [group] = await db.select().from(governanceGroups).where(eq(governanceGroups.id, groupId)).limit(1);
        if (!group || group.archivedAt) throw httpError('Group was not found.', 404);
        const memberships = await loadActiveGovernanceGroupMembershipRows(db, [groupId]);
        const accessRows = group.organizationId ? await loadActiveOrganizationAccessRows(db, group.organizationId) : [];
        const decision = canManageGovernanceGroup(actor, group, memberships, accessRows);
        if (!decision.allowed) throw httpError(decision.reason, 403);

        const [updated] = await db.update(governanceGroupMemberships).set({
            revokedAt: new Date(),
            updatedByUserId: actor.id,
            updatedAt: new Date(),
        }).where(and(
            eq(governanceGroupMemberships.id, membershipId),
            eq(governanceGroupMemberships.groupId, groupId),
            isNull(governanceGroupMemberships.revokedAt),
        )).returning();

        if (!updated) throw httpError('Group member was not found.', 404);
        return c.json({ success: true });
    } catch (err) {
        console.error('revokeGovernanceGroupMember Error:', err);
        return c.json({ error: err.message || 'Group member could not be removed.' }, err.status || 500);
    }
};
```

Add these link helpers:

```js
async function loadGovernanceGroupForManagement(db, actor, groupId) {
    const [group] = await db.select().from(governanceGroups).where(eq(governanceGroups.id, groupId)).limit(1);
    if (!group || group.archivedAt) throw httpError('Group was not found.', 404);

    const memberships = await loadActiveGovernanceGroupMembershipRows(db, [groupId]);
    const accessRows = group.organizationId ? await loadActiveOrganizationAccessRows(db, group.organizationId) : [];
    const decision = canManageGovernanceGroup(actor, group, memberships, accessRows);
    if (!decision.allowed) throw httpError(decision.reason, 403);

    return { group, memberships, accessRows };
}

async function assertResourceExistsForGroupLink(db, resourceType, resourceId) {
    const resource = await loadResourceForLink(db, resourceType, resourceId);
    if (!resource) throw httpError('Resource was not found.', 404);
    return resource;
}
```

Add the organisation link exports:

```js
export const linkGovernanceGroupOrganization = async (c) => {
    try {
        const actor = c.get('user');
        const groupId = parsePositiveInt(c.req.param('groupId'), 'groupId');
        const body = validateRequestBody(await c.req.json(), governanceGroupOrganizationBodySchema, 'Group organisation');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const { group } = await loadGovernanceGroupForManagement(db, actor, groupId);
        if (normalizeGovernanceGroupType(group.groupType) !== 'region') {
            throw httpError('Organisation links are for Region Groups only.', 400);
        }

        const organization = await loadOrganization(db, body.organizationId);
        if (!organization) throw httpError('Organisation was not found.', 404);

        const [existing] = await db.select().from(governanceGroupOrganizations)
            .where(and(
                eq(governanceGroupOrganizations.groupId, groupId),
                eq(governanceGroupOrganizations.organizationId, body.organizationId),
            ))
            .limit(1);

        const [link] = existing
            ? await db.update(governanceGroupOrganizations).set({
                linkStatus: 'active',
                unlinkedAt: null,
                linkedByUserId: actor.id,
                unlinkedByUserId: null,
                updatedAt: new Date(),
            }).where(eq(governanceGroupOrganizations.id, existing.id)).returning()
            : await db.insert(governanceGroupOrganizations).values({
                groupId,
                organizationId: body.organizationId,
                linkStatus: 'active',
                linkedByUserId: actor.id,
            }).returning();

        await recordSensitiveAuditLog(db, actor, {
            actionType: 'governance_group_organization_linked',
            entityType: 'governance_group_organization',
            entityId: link.id,
            organizationId: body.organizationId,
            metadata: { groupId, organizationName: organization.name },
        });

        return c.json(link, 201);
    } catch (err) {
        console.error('linkGovernanceGroupOrganization Error:', err);
        return c.json({ error: err.message || 'Organisation could not be linked to this group.' }, err.status || 500);
    }
};

export const unlinkGovernanceGroupOrganization = async (c) => {
    try {
        const actor = c.get('user');
        const groupId = parsePositiveInt(c.req.param('groupId'), 'groupId');
        const linkId = parsePositiveInt(c.req.param('linkId'), 'linkId');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        await loadGovernanceGroupForManagement(db, actor, groupId);

        const [updated] = await db.update(governanceGroupOrganizations).set({
            linkStatus: 'unlinked',
            unlinkedAt: new Date(),
            unlinkedByUserId: actor.id,
            updatedAt: new Date(),
        }).where(and(
            eq(governanceGroupOrganizations.id, linkId),
            eq(governanceGroupOrganizations.groupId, groupId),
            isNull(governanceGroupOrganizations.unlinkedAt),
        )).returning();

        if (!updated) throw httpError('Group organisation link was not found.', 404);
        return c.json({ success: true });
    } catch (err) {
        console.error('unlinkGovernanceGroupOrganization Error:', err);
        return c.json({ error: err.message || 'Organisation could not be unlinked from this group.' }, err.status || 500);
    }
};
```

Add the resource link exports:

```js
export const linkGovernanceGroupResource = async (c) => {
    try {
        const actor = c.get('user');
        const groupId = parsePositiveInt(c.req.param('groupId'), 'groupId');
        const body = validateRequestBody(await c.req.json(), governanceGroupResourceBodySchema, 'Group resource');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        await loadGovernanceGroupForManagement(db, actor, groupId);
        const resource = await assertResourceExistsForGroupLink(db, body.resourceType, body.resourceId);

        const [existing] = await db.select().from(governanceGroupResourceLinks)
            .where(and(
                eq(governanceGroupResourceLinks.groupId, groupId),
                eq(governanceGroupResourceLinks.resourceType, body.resourceType),
                eq(governanceGroupResourceLinks.resourceId, body.resourceId),
            ))
            .limit(1);

        const [link] = existing
            ? await db.update(governanceGroupResourceLinks).set({
                linkStatus: 'active',
                unlinkedAt: null,
                linkedByUserId: actor.id,
                unlinkedByUserId: null,
                updatedAt: new Date(),
            }).where(eq(governanceGroupResourceLinks.id, existing.id)).returning()
            : await db.insert(governanceGroupResourceLinks).values({
                groupId,
                resourceType: body.resourceType,
                resourceId: body.resourceId,
                linkStatus: 'active',
                linkedByUserId: actor.id,
            }).returning();

        await recordSensitiveAuditLog(db, actor, {
            actionType: 'governance_group_resource_linked',
            entityType: 'governance_group_resource_link',
            entityId: link.id,
            resourceType: body.resourceType,
            resourceId: body.resourceId,
            metadata: { groupId, resourceName: resource.name },
        });

        return c.json(link, 201);
    } catch (err) {
        console.error('linkGovernanceGroupResource Error:', err);
        return c.json({ error: err.message || 'Resource could not be linked to this group.' }, err.status || 500);
    }
};

export const unlinkGovernanceGroupResource = async (c) => {
    try {
        const actor = c.get('user');
        const groupId = parsePositiveInt(c.req.param('groupId'), 'groupId');
        const linkId = parsePositiveInt(c.req.param('linkId'), 'linkId');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        await loadGovernanceGroupForManagement(db, actor, groupId);

        const [updated] = await db.update(governanceGroupResourceLinks).set({
            linkStatus: 'unlinked',
            unlinkedAt: new Date(),
            unlinkedByUserId: actor.id,
            updatedAt: new Date(),
        }).where(and(
            eq(governanceGroupResourceLinks.id, linkId),
            eq(governanceGroupResourceLinks.groupId, groupId),
            isNull(governanceGroupResourceLinks.unlinkedAt),
        )).returning();

        if (!updated) throw httpError('Group resource link was not found.', 404);
        return c.json({ success: true });
    } catch (err) {
        console.error('unlinkGovernanceGroupResource Error:', err);
        return c.json({ error: err.message || 'Resource could not be unlinked from this group.' }, err.status || 500);
    }
};
```

These functions must only write group metadata rows. Do not call hard asset or soft asset access assignment helpers from any group link function.

- [ ] **Step 7: Register group routes**

In `/Users/sweetbuns/CareAroundSG/server/src/routes/governance.js`, import the new controller exports and add:

```js
router.get('/groups', listGovernanceGroups);
router.post('/groups', createGovernanceGroup);
router.put('/groups/:groupId', updateGovernanceGroup);
router.post('/groups/:groupId/members', addGovernanceGroupMember);
router.delete('/groups/:groupId/members/:membershipId', revokeGovernanceGroupMember);
router.post('/groups/:groupId/organizations', linkGovernanceGroupOrganization);
router.delete('/groups/:groupId/organizations/:linkId', unlinkGovernanceGroupOrganization);
router.post('/groups/:groupId/resources', linkGovernanceGroupResource);
router.delete('/groups/:groupId/resources/:linkId', unlinkGovernanceGroupResource);
```

Place the routes after the organisation routes and before `/me` routes.

- [ ] **Step 8: Verify Task 3**

Run:

```bash
node --test server/test/governanceGroups.test.js
node --test server/test/governance.test.js
```

Expected: PASS.

- [ ] **Step 9: Commit Task 3**

```bash
git add server/src/controllers/governanceController.js server/src/routes/governance.js server/test/governanceGroups.test.js
git commit -m "Add governance group API surface"
```

## Task 4: Permission Regression Tests

**Files:**
- Modify: `/Users/sweetbuns/CareAroundSG/server/test/privateResourceContent.test.js`
- Modify: `/Users/sweetbuns/CareAroundSG/server/test/hardAssetStaff.test.js`
- Modify: `/Users/sweetbuns/CareAroundSG/server/test/softAssetAccess.test.js`

- [ ] **Step 1: Add restricted-content regression test**

Append to `/Users/sweetbuns/CareAroundSG/server/test/privateResourceContent.test.js`:

```js
test('governance group roles do not grant restricted notes or file access', () => {
    const resource = { id: 12, partnerId: 41, subregionId: 4 };
    const groupAdmin = {
        id: 88,
        role: 'standard',
        governanceGroupMemberships: [{ groupId: 5, groupRole: 'admin', revokedAt: null }],
    };
    const groupStaff = {
        id: 89,
        role: 'standard',
        governanceGroupMemberships: [{ groupId: 5, groupRole: 'staff', revokedAt: null }],
    };

    assert.equal(canViewPrivateResource(groupAdmin, resource, []), false);
    assert.equal(canViewPrivateResource(groupStaff, resource, []), false);
    assert.equal(canManagePrivateResource(groupAdmin, resource), false);
    assert.equal(canManagePrivateResource(groupStaff, resource), false);
});
```

- [ ] **Step 2: Add hard-asset staff regression test**

Append to `/Users/sweetbuns/CareAroundSG/server/test/hardAssetStaff.test.js`:

```js
test('governance group roles do not grant hard asset staff management', () => {
    const asset = { id: 12, activeOwnerCount: 1 };
    const groupAdmin = actor({
        id: 88,
        role: 'standard',
        governanceGroupMemberships: [{ groupId: 5, groupRole: 'admin', revokedAt: null }],
    });

    assert.equal(canAssignHardAssetStaffRole(groupAdmin, asset, 'staff'), false);
    assert.equal(canAssignHardAssetStaffRole(groupAdmin, asset, 'owner'), false);
    assert.equal(canRevokeHardAssetStaffMembership(groupAdmin, asset, { staffRole: 'staff' }), false);
});
```

- [ ] **Step 3: Add soft-asset staff regression test**

Append to `/Users/sweetbuns/CareAroundSG/server/test/softAssetAccess.test.js`:

```js
test('governance group roles do not grant soft asset staff management', () => {
    const asset = { id: 50, assetMode: 'standalone', activeOwnerCount: 1 };
    const groupAdmin = actor({
        id: 88,
        role: 'standard',
        governanceGroupMemberships: [{ groupId: 5, groupRole: 'admin', revokedAt: null }],
    });

    assert.equal(canAssignSoftAssetStaffRole(groupAdmin, asset, 'staff'), false);
    assert.equal(canAssignSoftAssetStaffRole(groupAdmin, asset, 'owner'), false);
    assert.equal(canRevokeSoftAssetStaffMembership(groupAdmin, asset, { staffRole: 'staff' }), false);
});
```

- [ ] **Step 4: Run regression tests**

Run:

```bash
node --test server/test/privateResourceContent.test.js server/test/hardAssetStaff.test.js server/test/softAssetAccess.test.js
```

Expected: PASS. These should pass without production code changes because group memberships are intentionally ignored by the existing restricted-content and resource-staff helpers.

- [ ] **Step 5: Commit Task 4**

```bash
git add server/test/privateResourceContent.test.js server/test/hardAssetStaff.test.js server/test/softAssetAccess.test.js
git commit -m "Lock group roles out of resource permissions"
```

## Task 5: Client API And Presentation Helpers

**Files:**
- Modify: `/Users/sweetbuns/CareAroundSG/client/src/lib/api.js`
- Modify: `/Users/sweetbuns/CareAroundSG/client/src/lib/governanceOrganizationUi.js`
- Modify: `/Users/sweetbuns/CareAroundSG/client/test/governanceOrganizationUi.test.js`

- [ ] **Step 1: Add failing presentation helper tests**

Append to `/Users/sweetbuns/CareAroundSG/client/test/governanceOrganizationUi.test.js`:

```js
import {
    formatGovernanceGroupTypeLabel,
    formatGovernanceGroupRoleLabel,
    groupPublicCopyUsesInternalGovernanceLanguage,
} from '../src/lib/governanceOrganizationUi.js';

test('group labels separate internal roles from public copy', () => {
    assert.equal(formatGovernanceGroupTypeLabel('org'), 'Org Group');
    assert.equal(formatGovernanceGroupTypeLabel('region'), 'Region Group');
    assert.equal(formatGovernanceGroupRoleLabel('admin'), 'Group Admin');
    assert.equal(formatGovernanceGroupRoleLabel('staff'), 'Group Staff');

    assert.equal(groupPublicCopyUsesInternalGovernanceLanguage('Supported by multiple providers'), false);
    assert.equal(groupPublicCopyUsesInternalGovernanceLanguage('Part of ICCP SR approval workflow'), true);
    assert.equal(groupPublicCopyUsesInternalGovernanceLanguage('Region Group pending approval'), true);
});
```

If the file already has one import from `governanceOrganizationUi.js`, merge these names into the existing import instead of adding a duplicate import block.

- [ ] **Step 2: Run failing client helper tests**

Run:

```bash
node --test client/test/governanceOrganizationUi.test.js
```

Expected: FAIL because the group helper exports do not exist.

- [ ] **Step 3: Add client API methods**

In `/Users/sweetbuns/CareAroundSG/client/src/lib/api.js`, add these methods beside the existing governance methods:

```js
    getGovernanceGroups: (params = {}) => request('GET', withQuery('/governance/groups', params)),
    createGovernanceGroup: (body) => request('POST', '/governance/groups', body),
    updateGovernanceGroup: (groupId, body) => request('PUT', `/governance/groups/${groupId}`, body),
    addGovernanceGroupMember: (groupId, body) => request('POST', `/governance/groups/${groupId}/members`, body),
    revokeGovernanceGroupMember: (groupId, membershipId) => request('DELETE', `/governance/groups/${groupId}/members/${membershipId}`),
    linkGovernanceGroupOrganization: (groupId, body) => request('POST', `/governance/groups/${groupId}/organizations`, body),
    unlinkGovernanceGroupOrganization: (groupId, linkId) => request('DELETE', `/governance/groups/${groupId}/organizations/${linkId}`),
    linkGovernanceGroupResource: (groupId, body) => request('POST', `/governance/groups/${groupId}/resources`, body),
    unlinkGovernanceGroupResource: (groupId, linkId) => request('DELETE', `/governance/groups/${groupId}/resources/${linkId}`),
```

- [ ] **Step 4: Add presentation helpers**

In `/Users/sweetbuns/CareAroundSG/client/src/lib/governanceOrganizationUi.js`, add:

```js
const INTERNAL_GROUP_PUBLIC_TERMS = [
    'region group',
    'org group',
    'iccp sr',
    'approval',
    'pending approval',
    'internal boundary',
    'governance admin',
];

export function formatGovernanceGroupTypeLabel(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'org') return 'Org Group';
    if (normalized === 'region') return 'Region Group';
    return 'Group';
}

export function formatGovernanceGroupRoleLabel(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'admin') return 'Group Admin';
    if (normalized === 'staff') return 'Group Staff';
    return 'Group Member';
}

export function groupPublicCopyUsesInternalGovernanceLanguage(value = '') {
    const text = String(value || '').trim().toLowerCase();
    if (!text) return false;
    return INTERNAL_GROUP_PUBLIC_TERMS.some((term) => text.includes(term));
}
```

- [ ] **Step 5: Verify Task 5**

Run:

```bash
node --test client/test/governanceOrganizationUi.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit Task 5**

```bash
git add client/src/lib/api.js client/src/lib/governanceOrganizationUi.js client/test/governanceOrganizationUi.test.js
git commit -m "Add governance group client helpers"
```

## Task 6: Group Coordination UI

**Files:**
- Create: `/Users/sweetbuns/CareAroundSG/client/src/components/admin/GovernanceGroupsPanel.jsx`
- Modify: `/Users/sweetbuns/CareAroundSG/client/src/components/admin/GovernanceOrganizationsPanel.jsx`
- Modify: `/Users/sweetbuns/CareAroundSG/client/src/lib/roles.js`
- Modify: `/Users/sweetbuns/CareAroundSG/client/src/pages/dashboard/AdminPage.jsx`
- Test: `/Users/sweetbuns/CareAroundSG/client/test/governanceOrganizationUi.test.js`

- [ ] **Step 1: Add static UI contract tests**

Append to `/Users/sweetbuns/CareAroundSG/client/test/governanceOrganizationUi.test.js`:

```js
test('governance group panel source keeps groups as coordination-only', async () => {
    const fs = await import('node:fs/promises');
    const source = await fs.readFile(new URL('../src/components/admin/GovernanceGroupsPanel.jsx', import.meta.url), 'utf8');

    assert.match(source, /coordination-only/i);
    assert.match(source, /Group roles do not grant resource editing/i);
    assert.doesNotMatch(source, /approve publishing/i);
    assert.doesNotMatch(source, /pending approval/i);
});
```

- [ ] **Step 2: Run the failing static UI test**

Run:

```bash
node --test client/test/governanceOrganizationUi.test.js
```

Expected: FAIL because `GovernanceGroupsPanel.jsx` does not exist.

- [ ] **Step 3: Create group panel component**

Create `/Users/sweetbuns/CareAroundSG/client/src/components/admin/GovernanceGroupsPanel.jsx`:

```jsx
import { useEffect, useMemo, useState } from 'react';
import { Building2, Link2, Save, ShieldCheck, Trash2, Users } from 'lucide-react';

import { api } from '../../lib/api.js';
import {
    formatGovernanceActionError,
    formatGovernanceGroupRoleLabel,
    formatGovernanceGroupTypeLabel,
    groupPublicCopyUsesInternalGovernanceLanguage,
} from '../../lib/governanceOrganizationUi.js';

const EMPTY_GROUP_FORM = {
    groupType: 'org',
    organizationId: '',
    subregionId: '',
    name: '',
    description: '',
    coordinationStatus: 'active',
    publicLabel: '',
    publicSummary: '',
};

function normalizeGroupForm(group, fallback = {}) {
    if (!group) return { ...EMPTY_GROUP_FORM, ...fallback };
    return {
        groupType: group.groupType || fallback.groupType || 'org',
        organizationId: group.organizationId || fallback.organizationId || '',
        subregionId: group.subregionId || '',
        name: group.name || '',
        description: group.description || '',
        coordinationStatus: group.coordinationStatus || 'active',
        publicLabel: group.publicLabel || '',
        publicSummary: group.publicSummary || '',
    };
}

function Feedback({ feedback }) {
    if (!feedback) return null;
    const error = feedback.type === 'error';
    return (
        <div className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
            {feedback.message}
        </div>
    );
}

export default function GovernanceGroupsPanel({
    organizationId = null,
    mode = 'organization',
    readOnly = false,
} = {}) {
    const [groups, setGroups] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [form, setForm] = useState(() => normalizeGroupForm(null, {
        groupType: mode === 'region' ? 'region' : 'org',
        organizationId: organizationId || '',
    }));
    const [feedback, setFeedback] = useState(null);
    const [saving, setSaving] = useState(false);

    const selectedGroup = useMemo(() => (
        groups.find((group) => Number(group.id) === Number(selectedId)) || null
    ), [groups, selectedId]);

    async function loadGroups(nextSelectedId = selectedId) {
        try {
            const params = {
                type: mode === 'region' ? 'region' : 'org',
            };
            if (organizationId) params.organizationId = organizationId;
            const data = await api.getGovernanceGroups(params);
            const items = Array.isArray(data?.groups) ? data.groups : [];
            setGroups(items);
            const stillSelected = items.some((group) => Number(group.id) === Number(nextSelectedId));
            const resolvedSelectedId = stillSelected ? nextSelectedId : items[0]?.id || null;
            setSelectedId(resolvedSelectedId);
            setForm(normalizeGroupForm(items.find((group) => Number(group.id) === Number(resolvedSelectedId)), {
                groupType: mode === 'region' ? 'region' : 'org',
                organizationId: organizationId || '',
            }));
        } catch (err) {
            setFeedback({ type: 'error', message: formatGovernanceActionError(err, 'Groups failed to load.') });
        }
    }

    useEffect(() => {
        loadGroups(null);
    }, [organizationId, mode]);

    async function handleSaveGroup(event) {
        event.preventDefault();
        if (readOnly) return;
        if (groupPublicCopyUsesInternalGovernanceLanguage(form.publicLabel) || groupPublicCopyUsesInternalGovernanceLanguage(form.publicSummary)) {
            setFeedback({ type: 'error', message: 'Public-facing group wording should not expose internal governance terms.' });
            return;
        }
        setSaving(true);
        setFeedback(null);
        try {
            const payload = {
                ...form,
                organizationId: form.groupType === 'org' ? Number(form.organizationId || organizationId) : undefined,
                subregionId: form.groupType === 'region' && form.subregionId ? Number(form.subregionId) : undefined,
            };
            if (selectedGroup) {
                await api.updateGovernanceGroup(selectedGroup.id, payload);
                setFeedback({ type: 'success', message: 'Group updated.' });
                await loadGroups(selectedGroup.id);
            } else {
                const created = await api.createGovernanceGroup(payload);
                setFeedback({ type: 'success', message: 'Group created.' });
                await loadGroups(created.id);
            }
        } catch (err) {
            setFeedback({ type: 'error', message: formatGovernanceActionError(err, 'Group could not be saved.') });
        } finally {
            setSaving(false);
        }
    }

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-sky-50 p-3 text-sky-700">
                        <Users size={22} />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-slate-900">{mode === 'region' ? 'Region Groups' : 'Org Groups'}</h2>
                        <p className="mt-1 text-sm font-semibold text-slate-500">Groups are coordination-only. Group roles do not grant resource editing, publishing, or restricted notes/files access.</p>
                    </div>
                </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                <div className="space-y-2">
                    {groups.length ? groups.map((group) => (
                        <button
                            key={group.id}
                            type="button"
                            onClick={() => {
                                setSelectedId(group.id);
                                setForm(normalizeGroupForm(group, { organizationId: organizationId || '' }));
                            }}
                            className={`w-full rounded-xl border px-4 py-3 text-left transition ${Number(selectedId) === Number(group.id) ? 'border-brand-300 bg-brand-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <p className="truncate font-black text-slate-900">{group.name}</p>
                                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-bold text-slate-600">{formatGovernanceGroupTypeLabel(group.groupType)}</span>
                            </div>
                            <p className="mt-1 truncate text-xs font-semibold text-slate-500">{group.description || 'No coordination notes yet.'}</p>
                        </button>
                    )) : (
                        <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm font-semibold text-slate-500">
                            No groups yet.
                        </div>
                    )}
                </div>

                <form onSubmit={handleSaveGroup} className="space-y-4">
                    <Feedback feedback={feedback} />
                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block">
                            <span className="text-sm font-bold text-slate-700">Group type</span>
                            <select
                                value={form.groupType}
                                disabled={readOnly || Boolean(organizationId)}
                                onChange={(event) => setForm((current) => ({ ...current, groupType: event.target.value }))}
                                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold"
                            >
                                <option value="org">Org Group</option>
                                <option value="region">Region Group</option>
                            </select>
                        </label>
                        <label className="block">
                            <span className="text-sm font-bold text-slate-700">Status</span>
                            <select
                                value={form.coordinationStatus}
                                disabled={readOnly}
                                onChange={(event) => setForm((current) => ({ ...current, coordinationStatus: event.target.value }))}
                                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold"
                            >
                                <option value="active">Active</option>
                                <option value="paused">Paused</option>
                                <option value="archived">Archived</option>
                            </select>
                        </label>
                    </div>

                    <label className="block">
                        <span className="text-sm font-bold text-slate-700">Name</span>
                        <input
                            value={form.name}
                            disabled={readOnly}
                            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold"
                            placeholder="Bukit Batok care coordination"
                        />
                    </label>

                    <label className="block">
                        <span className="text-sm font-bold text-slate-700">Coordination notes</span>
                        <textarea
                            value={form.description}
                            disabled={readOnly}
                            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                            className="mt-1 min-h-[96px] w-full rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold"
                            placeholder="Internal coordination context for this group."
                        />
                    </label>

                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                        Optional public wording is resource-facing copy only. It should not mention Region Group, ICCP SR, approval, or internal boundaries.
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block">
                            <span className="text-sm font-bold text-slate-700">Optional public phrase</span>
                            <input
                                value={form.publicLabel}
                                disabled={readOnly}
                                onChange={(event) => setForm((current) => ({ ...current, publicLabel: event.target.value }))}
                                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold"
                                placeholder="Supported by multiple providers"
                            />
                        </label>
                        <label className="block">
                            <span className="text-sm font-bold text-slate-700">Optional public summary</span>
                            <input
                                value={form.publicSummary}
                                disabled={readOnly}
                                onChange={(event) => setForm((current) => ({ ...current, publicSummary: event.target.value }))}
                                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold"
                                placeholder="Delivered with community partners"
                            />
                        </label>
                    </div>

                    {selectedGroup ? (
                        <div className="grid gap-3 md:grid-cols-3">
                            <div className="rounded-xl border border-slate-200 p-3">
                                <div className="flex items-center gap-2 text-sm font-black text-slate-800"><ShieldCheck size={16} /> Members</div>
                                <p className="mt-2 text-sm font-semibold text-slate-500">{selectedGroup.members?.length || 0} assigned</p>
                                {(selectedGroup.members || []).slice(0, 4).map((member) => (
                                    <p key={member.id} className="mt-1 truncate text-xs font-bold text-slate-600">{member.user?.name || member.user?.email} · {formatGovernanceGroupRoleLabel(member.groupRole)}</p>
                                ))}
                            </div>
                            <div className="rounded-xl border border-slate-200 p-3">
                                <div className="flex items-center gap-2 text-sm font-black text-slate-800"><Building2 size={16} /> Organisations</div>
                                <p className="mt-2 text-sm font-semibold text-slate-500">{selectedGroup.organizations?.length || 0} linked</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 p-3">
                                <div className="flex items-center gap-2 text-sm font-black text-slate-800"><Link2 size={16} /> Resources</div>
                                <p className="mt-2 text-sm font-semibold text-slate-500">{selectedGroup.resources?.length || 0} linked</p>
                            </div>
                        </div>
                    ) : null}

                    {!readOnly ? (
                        <div className="flex flex-wrap gap-3">
                            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-black text-white shadow-sm disabled:opacity-60">
                                <Save size={18} /> Save Group
                            </button>
                            {selectedGroup ? (
                                <button type="button" disabled className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-400">
                                    <Trash2 size={18} /> Archive via status
                                </button>
                            ) : null}
                        </div>
                    ) : null}
                </form>
            </div>
        </section>
    );
}
```

- [ ] **Step 4: Add Org Groups to the selected organisation workspace**

In `/Users/sweetbuns/CareAroundSG/client/src/components/admin/GovernanceOrganizationsPanel.jsx`, add:

```js
import GovernanceGroupsPanel from './GovernanceGroupsPanel.jsx';
```

Render this after the linked resources card and before agreement records:

```jsx
            {selectedOrganization ? (
                <GovernanceGroupsPanel
                    organizationId={selectedOrganization.id}
                    mode="organization"
                    readOnly={readOnly}
                />
            ) : null}
```

- [ ] **Step 5: Add Super Admin Region Groups tab access**

In `/Users/sweetbuns/CareAroundSG/client/src/lib/roles.js`, update `getAdminTabs` so only Super Admin gets the new tab:

```js
export function getAdminTabs(role) {
    switch (normalizeRole(role)) {
        case 'super_admin':
            return ['resources', 'users', 'organizations', 'groups', 'audit', 'subregions', 'audiencezones', 'subcats', 'datatools'];
        case 'regional_admin':
            return ['resources', 'users', 'subregions', 'audiencezones'];
        default:
            return [];
    }
}
```

- [ ] **Step 6: Add Super Admin Region Groups panel**

In `/Users/sweetbuns/CareAroundSG/client/src/pages/dashboard/AdminPage.jsx`, import the panel:

```js
import GovernanceGroupsPanel from '../../components/admin/GovernanceGroupsPanel.jsx';
```

Add a Super Admin-only tab entry beside `organizations`:

```js
{ key: 'groups', label: 'Region Groups', Icon: Building2 },
```

Render it with:

```jsx
            ) : tab === 'groups' ? (
                <GovernanceGroupsPanel mode="region" />
```

Do not add this tab for Regional Admins in `getAdminTabs` unless a separate design approves replacing or expanding Region Admin behavior.

- [ ] **Step 7: Verify Task 6**

Run:

```bash
node --test client/test/governanceOrganizationUi.test.js
npm run build:client
```

Expected: PASS. The build may show the existing large chunk warning.

- [ ] **Step 8: Commit Task 6**

```bash
git add client/src/components/admin/GovernanceGroupsPanel.jsx client/src/components/admin/GovernanceOrganizationsPanel.jsx client/src/lib/roles.js client/src/pages/dashboard/AdminPage.jsx client/test/governanceOrganizationUi.test.js
git commit -m "Add governance group coordination UI"
```

## Task 7: Ledger And Release Verification

**Files:**
- Modify: `/Users/sweetbuns/CareAroundSG/docs/regression-ledger.md`

- [ ] **Step 1: Run focused tests**

Run:

```bash
node --test server/test/governanceGroups.test.js
node --test server/test/governance.test.js
node --test server/test/privateResourceContent.test.js server/test/hardAssetStaff.test.js server/test/softAssetAccess.test.js
node --test client/test/governanceOrganizationUi.test.js
```

Expected: PASS.

- [ ] **Step 2: Run release gate tests**

Run:

```bash
npm run test:server
npm run build:client
git diff --check
```

Expected: PASS. The client build may keep the known large chunk warning.

- [ ] **Step 3: Bootstrap schema before any production Worker deploy**

For local verification, run:

```bash
npm run bootstrap:boundary-schema --workspace=server
```

Expected: `Boundary schema bootstrap completed.`

For production, run the same command only with the intended production database environment loaded. Do not print database URLs or secrets.

- [ ] **Step 4: Update the regression ledger**

Add a new entry near the recent governance sections in `/Users/sweetbuns/CareAroundSG/docs/regression-ledger.md`:

```md
### 2026-06-05 Lean IAM group resource model

- Current behavior: Org Groups and Region Groups exist as coordination metadata only. Group Admin/Staff assignments do not grant resource Owner/Staff access, publishing control, restricted notes/files access, public Discover labels, or inter-organisation approval power.
- Known-good reference: `docs/superpowers/specs/2026-06-05-lean-iam-group-resource-model-design.md` and the implementation commit series for this plan.
- Reproduction steps: create an Org Group for an organisation, add a group Admin and Staff from existing organisation users, create a Region Group as Super Admin, link coordination resources, then confirm resource edit/publish controls still depend on direct resource Owner/Staff access and restricted notes/files still require existing restricted-content permission.
- Acceptance criteria: group roles organise coordination only; resource Owner/Staff remains the operational permission lane; public Discover does not expose Region Group, ICCP SR, Org Group, approval, or internal-boundary wording; no email, WhatsApp, SMS, Gmail, GudAuth, auth behavior, or secret changes are introduced.
- Verification result: Record the focused server/client tests, `npm run test:server`, `npm run build:client`, schema bootstrap result, and `git diff --check` before deployment.
```

- [ ] **Step 5: Commit Task 7**

```bash
git add docs/regression-ledger.md
git commit -m "Record lean IAM group model verification"
```

## Task 8: Pre-Deploy And Production Gate

**Files:**
- No code files.

- [ ] **Step 1: Confirm schema risk is accepted**

Before production deploy, confirm that the group tables are safe to create in production. This step matters because the user pre-authorized normal commit/push/deploy work but called out schema migration risk as an exception.

- [ ] **Step 2: Run full release gate**

Run:

```bash
npm run test:server
npm run build:client
git diff --check
```

Expected: PASS.

- [ ] **Step 3: Deploy only after schema bootstrap**

Use the existing Cloudflare Pages and Worker deployment workflow. Do not use Netlify.

After deploy, verify:

```bash
curl https://api.carearound.sg/api/health
```

Expected response includes:

```json
{ "status": "ok" }
```

- [ ] **Step 4: Manual UAT**

Use production or preview with a real signed-in session:

- Super Admin opens `/dashboard/admin`, then Organisations.
- Super Admin creates an Org Group inside an organisation and a Region Group from the Super Admin Region Groups panel.
- Organisation Admin opens `/dashboard/organization` and sees Org Groups for their organisation.
- Organisation Staff opens `/dashboard/organization` and sees group context read-only.
- A group Admin without direct resource Owner/Staff access does not see resource edit/publish controls for linked resources.
- Restricted notes/files remain unavailable unless the user already has direct resource access or an explicit restricted-content viewer grant.
- Discover cards and resource details do not display internal group labels or approval wording.
