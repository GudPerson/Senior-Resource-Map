import { and, desc, eq, gte, ilike, inArray, isNull, lt, lte, or } from 'drizzle-orm';
import { z } from 'zod';

import { getDb } from '../db/index.js';
import {
    hardAssets,
    notificationPreferences,
    organizationAccessMemberships,
    organizationAgreements,
    organizationResourceLinks,
    partnerOrganizations,
    retentionRecords,
    sensitiveAuditLogs,
    softAssetParents,
    softAssets,
    userConsentRecords,
    userOptOutRecords,
    users,
} from '../db/schema.js';
import { ensureBoundarySchema } from '../utils/boundarySchema.js';
import {
    buildAuditAccessScope,
    buildAuditChangeMetadata,
    formatAuditLogForResponse,
    normalizeAuditLogQuery,
} from '../utils/auditTrail.js';
import {
    buildAgreementCoverageSummary,
    canManageOrganizationGovernance,
    canViewOrganizationGovernance,
    isOrganizationDeletableDraft,
    isOrganizationOpenForNewRecords,
    isNotificationDeliveryAllowed,
    normalizeAgreementStatus,
    normalizeOrganizationGovernanceStatus,
    normalizeNotificationChannel,
    normalizeOrganizationAccessRole,
} from '../utils/governance.js';
import {
    cleanOneLineText,
    optionalOneLineTextSchema,
    optionalTextSchema,
    parsePositiveInt,
    positiveIntValueSchema,
    requiredOneLineTextSchema,
    validateRequestBody,
} from '../utils/inputValidation.js';
import {
    assertOrganizationUserAssignment,
    assertResourceOrganizationLinkEligibility,
    filterOrganizationAccessCandidates,
} from '../utils/organizationGuardrails.js';
import { normalizeRole } from '../utils/roles.js';

const AGREEMENT_USE_KEYS = [
    'publicListing',
    'restrictedFiles',
    'aggregateAnalytics',
    'aiAssistedEnrichment',
    'notifications',
    'externalSharing',
];

const orgBodySchema = z.object({
    name: requiredOneLineTextSchema('Organisation name', 255),
    description: optionalTextSchema(2000),
    governanceStatus: optionalOneLineTextSchema(40).default('active'),
    dataContactName: optionalOneLineTextSchema(255),
    dataContactEmail: optionalOneLineTextSchema(255),
});

const accessBodySchema = z.object({
    userId: positiveIntValueSchema('userId'),
    accessRole: optionalOneLineTextSchema(40).default('staff'),
});

const agreementBodySchema = z.object({
    agreementReference: requiredOneLineTextSchema('Agreement reference', 160),
    agreementType: optionalOneLineTextSchema(80).default('data_sharing'),
    fileUrl: optionalOneLineTextSchema(2000),
    fileName: optionalOneLineTextSchema(500),
    status: optionalOneLineTextSchema(40).default('draft'),
    effectiveAt: optionalOneLineTextSchema(80),
    expiresAt: optionalOneLineTextSchema(80),
    allowedUses: z.record(z.boolean()).optional().default({}),
});

const resourceLinkBodySchema = z.object({
    resourceType: z.enum(['hard', 'soft', 'template']),
    resourceId: positiveIntValueSchema('resourceId'),
});

const consentBodySchema = z.object({
    consentType: requiredOneLineTextSchema('Consent type', 80),
    consentVersion: requiredOneLineTextSchema('Consent version', 40),
    status: optionalOneLineTextSchema(40).default('accepted'),
    sourceSurface: optionalOneLineTextSchema(120),
    metadata: z.record(z.any()).optional().default({}),
});

const preferenceBodySchema = z.object({
    preferences: z.array(z.object({
        channel: optionalOneLineTextSchema(40).default('in_app'),
        category: optionalOneLineTextSchema(80).default('general'),
        enabled: z.boolean().default(true),
    })).max(40),
});

const optOutBodySchema = z.object({
    optOutType: requiredOneLineTextSchema('Opt-out type', 80),
    reason: optionalTextSchema(1000),
    active: z.boolean().optional().default(true),
    sourceSurface: optionalOneLineTextSchema(120),
});

const retentionBodySchema = z.object({
    deletionEligible: z.boolean().optional(),
    deletionStatus: optionalOneLineTextSchema(40),
    retainUntil: optionalOneLineTextSchema(80),
    notes: optionalTextSchema(2000),
});

const freshnessBodySchema = z.object({
    lastReviewedAt: optionalOneLineTextSchema(80),
    sourceType: optionalOneLineTextSchema(80),
    verificationStatus: optionalOneLineTextSchema(40).default('unverified'),
    verificationConfidence: optionalOneLineTextSchema(40),
});

function httpError(message, status = 400) {
    const err = new Error(message);
    err.status = status;
    return err;
}

function parseOptionalDate(value, label) {
    const text = cleanOneLineText(value || '', 80);
    if (!text) return null;
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) {
        throw httpError(`${label} must be a valid date.`, 400);
    }
    return date;
}

function requireSuperAdmin(actor) {
    if (normalizeRole(actor?.role) !== 'super_admin') {
        throw httpError('Super Admin access is required.', 403);
    }
}

function normalizeAllowedUses(value = {}) {
    return AGREEMENT_USE_KEYS.reduce((acc, key) => ({
        ...acc,
        [key]: value?.[key] === true,
    }), {});
}

function formatUser(row) {
    if (!row) return null;
    return {
        id: row.id,
        username: row.username,
        email: row.email,
        name: row.name,
        role: row.role,
    };
}

function formatAccessRow(row) {
    return {
        id: row.id,
        organizationId: row.organizationId,
        userId: row.userId,
        accessRole: row.accessRole,
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

function formatAgreement(row) {
    return {
        id: row.id,
        organizationId: row.organizationId,
        agreementReference: row.agreementReference,
        agreementType: row.agreementType,
        fileUrl: row.fileUrl,
        fileName: row.fileName,
        status: row.status,
        effectiveAt: row.effectiveAt,
        expiresAt: row.expiresAt,
        allowedUses: row.allowedUses || {},
        reviewedByUserId: row.reviewedByUserId,
        approvedByUserId: row.approvedByUserId,
        reviewedAt: row.reviewedAt,
        approvedAt: row.approvedAt,
        revokedAt: row.revokedAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

function formatResourceLink(row) {
    return {
        id: row.id,
        organizationId: row.organizationId,
        resourceType: row.resourceType,
        resourceId: row.resourceId,
        linkStatus: row.linkStatus,
        unlinkedAt: row.unlinkedAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        resourceName: row.resourceName || null,
    };
}

function formatResourceCandidate(row, resourceType) {
    if (!row) return null;
    const subtitle = resourceType === 'hard'
        ? [row.address, row.postalCode].filter(Boolean).join(' ')
        : [row.subCategory, row.postalCode].filter(Boolean).join(' · ');
    return {
        id: row.id,
        value: row.id,
        resourceType,
        label: row.name,
        name: row.name,
        subtitle,
    };
}

function formatOrganization(row, grouped = {}) {
    const agreements = grouped.agreements?.get(Number(row.id)) || [];
    const access = grouped.access?.get(Number(row.id)) || [];
    const resourceLinks = grouped.resourceLinks?.get(Number(row.id)) || [];
    return {
        id: row.id,
        legacyPartnerUserId: row.legacyPartnerUserId,
        name: row.name,
        description: row.description || '',
        governanceStatus: normalizeOrganizationGovernanceStatus(row.governanceStatus),
        dataContactName: row.dataContactName || '',
        dataContactEmail: row.dataContactEmail || '',
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        agreements: agreements.map(formatAgreement),
        access: access.map(formatAccessRow),
        resourceLinks: resourceLinks.map(formatResourceLink),
        agreementCoverage: buildAgreementCoverageSummary(agreements, 'restrictedFiles'),
    };
}

function assertOrganizationOpenForNewRecords(organization, actionLabel = 'This action') {
    if (isOrganizationOpenForNewRecords(organization)) return;
    const status = normalizeOrganizationGovernanceStatus(organization?.governanceStatus);
    throw httpError(`${actionLabel} is not available while this organisation is ${status}. Set the organisation back to active or draft first.`, 409);
}

async function loadActiveOrganizationDependencies(db, organizationId) {
    const [activeAccess, activeAgreements, activeResourceLinks] = await Promise.all([
        db.select().from(organizationAccessMemberships)
            .where(and(
                eq(organizationAccessMemberships.organizationId, organizationId),
                isNull(organizationAccessMemberships.revokedAt),
            )),
        db.select().from(organizationAgreements)
            .where(and(
                eq(organizationAgreements.organizationId, organizationId),
                isNull(organizationAgreements.revokedAt),
            )),
        db.select().from(organizationResourceLinks)
            .where(and(
                eq(organizationResourceLinks.organizationId, organizationId),
                isNull(organizationResourceLinks.unlinkedAt),
            )),
    ]);

    return { activeAccess, activeAgreements, activeResourceLinks };
}

function groupByOrganization(rows) {
    const grouped = new Map();
    for (const row of rows) {
        const key = Number(row.organizationId);
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(row);
    }
    return grouped;
}

async function recordSensitiveAuditLog(db, actor, payload) {
    await db.insert(sensitiveAuditLogs).values({
        actorUserId: actor?.id || null,
        targetUserId: payload.targetUserId || null,
        actionType: payload.actionType,
        entityType: payload.entityType || null,
        entityId: payload.entityId || null,
        resourceType: payload.resourceType || null,
        resourceId: payload.resourceId || null,
        organizationId: payload.organizationId || null,
        metadata: payload.metadata || {},
    });
}

async function loadOrganization(db, organizationId) {
    const [organization] = await db.select().from(partnerOrganizations)
        .where(eq(partnerOrganizations.id, organizationId))
        .limit(1);
    return organization || null;
}

async function loadActiveOrganizationAccessRows(db, organizationId) {
    return db.select({
        id: organizationAccessMemberships.id,
        organizationId: organizationAccessMemberships.organizationId,
        userId: organizationAccessMemberships.userId,
        accessRole: organizationAccessMemberships.accessRole,
        revokedAt: organizationAccessMemberships.revokedAt,
        createdAt: organizationAccessMemberships.createdAt,
        updatedAt: organizationAccessMemberships.updatedAt,
        username: users.username,
        email: users.email,
        userName: users.name,
        userRole: users.role,
    })
        .from(organizationAccessMemberships)
        .innerJoin(users, eq(organizationAccessMemberships.userId, users.id))
        .where(and(
            eq(organizationAccessMemberships.organizationId, organizationId),
            isNull(organizationAccessMemberships.revokedAt),
        ));
}

async function loadManageableOrganization(db, actor, organizationId) {
    const organization = await loadOrganization(db, organizationId);
    if (!organization) throw httpError('Organisation was not found.', 404);
    const accessRows = await loadActiveOrganizationAccessRows(db, organizationId);
    if (!canManageOrganizationGovernance(actor, organization, accessRows)) {
        throw httpError('Organisation governance is outside your access.', 403);
    }
    return { organization, accessRows };
}

async function loadViewableOrganization(db, actor, organizationId) {
    const organization = await loadOrganization(db, organizationId);
    if (!organization) throw httpError('Organisation was not found.', 404);
    const accessRows = await loadActiveOrganizationAccessRows(db, organizationId);
    if (!canViewOrganizationGovernance(actor, organization, accessRows)) {
        throw httpError('Organisation governance is outside your access.', 403);
    }
    return { organization, accessRows };
}

async function listOrganizationDetails(db, organizations) {
    const ids = organizations.map((org) => Number(org.id)).filter(Boolean);
    if (!ids.length) {
        return { access: new Map(), agreements: new Map(), resourceLinks: new Map() };
    }
    const [access, agreements, hardLinks, softLinks, templateLinks] = await Promise.all([
        db.select({
            id: organizationAccessMemberships.id,
            organizationId: organizationAccessMemberships.organizationId,
            userId: organizationAccessMemberships.userId,
            accessRole: organizationAccessMemberships.accessRole,
            revokedAt: organizationAccessMemberships.revokedAt,
            createdAt: organizationAccessMemberships.createdAt,
            updatedAt: organizationAccessMemberships.updatedAt,
            username: users.username,
            email: users.email,
            userName: users.name,
            userRole: users.role,
        }).from(organizationAccessMemberships)
            .innerJoin(users, eq(organizationAccessMemberships.userId, users.id))
            .where(and(inArray(organizationAccessMemberships.organizationId, ids), isNull(organizationAccessMemberships.revokedAt))),
        db.select().from(organizationAgreements)
            .where(and(inArray(organizationAgreements.organizationId, ids), isNull(organizationAgreements.revokedAt))),
        db.select({
            id: organizationResourceLinks.id,
            organizationId: organizationResourceLinks.organizationId,
            resourceType: organizationResourceLinks.resourceType,
            resourceId: organizationResourceLinks.resourceId,
            linkStatus: organizationResourceLinks.linkStatus,
            unlinkedAt: organizationResourceLinks.unlinkedAt,
            createdAt: organizationResourceLinks.createdAt,
            updatedAt: organizationResourceLinks.updatedAt,
            resourceName: hardAssets.name,
        }).from(organizationResourceLinks)
            .innerJoin(hardAssets, eq(organizationResourceLinks.resourceId, hardAssets.id))
            .where(and(
                inArray(organizationResourceLinks.organizationId, ids),
                eq(organizationResourceLinks.resourceType, 'hard'),
                isNull(organizationResourceLinks.unlinkedAt),
            )),
        db.select({
            id: organizationResourceLinks.id,
            organizationId: organizationResourceLinks.organizationId,
            resourceType: organizationResourceLinks.resourceType,
            resourceId: organizationResourceLinks.resourceId,
            linkStatus: organizationResourceLinks.linkStatus,
            unlinkedAt: organizationResourceLinks.unlinkedAt,
            createdAt: organizationResourceLinks.createdAt,
            updatedAt: organizationResourceLinks.updatedAt,
            resourceName: softAssets.name,
        }).from(organizationResourceLinks)
            .innerJoin(softAssets, eq(organizationResourceLinks.resourceId, softAssets.id))
            .where(and(
                inArray(organizationResourceLinks.organizationId, ids),
                eq(organizationResourceLinks.resourceType, 'soft'),
                isNull(organizationResourceLinks.unlinkedAt),
            )),
        db.select({
            id: organizationResourceLinks.id,
            organizationId: organizationResourceLinks.organizationId,
            resourceType: organizationResourceLinks.resourceType,
            resourceId: organizationResourceLinks.resourceId,
            linkStatus: organizationResourceLinks.linkStatus,
            unlinkedAt: organizationResourceLinks.unlinkedAt,
            createdAt: organizationResourceLinks.createdAt,
            updatedAt: organizationResourceLinks.updatedAt,
            resourceName: softAssetParents.name,
        }).from(organizationResourceLinks)
            .innerJoin(softAssetParents, eq(organizationResourceLinks.resourceId, softAssetParents.id))
            .where(and(
                inArray(organizationResourceLinks.organizationId, ids),
                eq(organizationResourceLinks.resourceType, 'template'),
                isNull(organizationResourceLinks.unlinkedAt),
            )),
    ]);

    return {
        access: groupByOrganization(access),
        agreements: groupByOrganization(agreements),
        resourceLinks: groupByOrganization([...hardLinks, ...softLinks, ...templateLinks]),
    };
}

async function loadResourceForLink(db, resourceType, resourceId) {
    if (resourceType === 'hard') {
        const [row] = await db.select({ id: hardAssets.id, name: hardAssets.name }).from(hardAssets)
            .where(eq(hardAssets.id, resourceId))
            .limit(1);
        return row || null;
    }
    if (resourceType === 'soft') {
        const [row] = await db.select({ id: softAssets.id, name: softAssets.name }).from(softAssets)
            .where(eq(softAssets.id, resourceId))
            .limit(1);
        return row || null;
    }
    const [row] = await db.select({ id: softAssetParents.id, name: softAssetParents.name }).from(softAssetParents)
        .where(eq(softAssetParents.id, resourceId))
        .limit(1);
    return row || null;
}

function buildAuditCategoryCondition(category) {
    switch (category) {
        case 'resource':
            return or(
                ilike(sensitiveAuditLogs.actionType, 'resource_%'),
                eq(sensitiveAuditLogs.entityType, 'resource'),
            );
        case 'organization':
            return ilike(sensitiveAuditLogs.actionType, 'organization_%');
        case 'access':
            return or(
                ilike(sensitiveAuditLogs.actionType, '%access%'),
                ilike(sensitiveAuditLogs.actionType, 'user_view_%'),
            );
        case 'restricted':
            return or(
                ilike(sensitiveAuditLogs.actionType, 'restricted_%'),
                ilike(sensitiveAuditLogs.actionType, 'private_file_%'),
            );
        case 'privacy':
            return inArray(sensitiveAuditLogs.actionType, [
                'consent_recorded',
                'notification_preferences_updated',
                'opt_out_recorded',
                'opt_out_revoked',
            ]);
        case 'workbook':
            return ilike(sensitiveAuditLogs.actionType, '%workbook%');
        default:
            return null;
    }
}

function uniquePositiveIds(values = []) {
    return [...new Set(values
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0))];
}

async function loadUsersForAudit(db, ids = []) {
    const uniqueIds = uniquePositiveIds(ids);
    if (!uniqueIds.length) return [];
    return db.select({
        id: users.id,
        username: users.username,
        email: users.email,
        name: users.name,
        role: users.role,
    })
        .from(users)
        .where(inArray(users.id, uniqueIds));
}

async function loadOrganizationsForAudit(db, ids = []) {
    const uniqueIds = uniquePositiveIds(ids);
    if (!uniqueIds.length) return [];
    return db.select({
        id: partnerOrganizations.id,
        name: partnerOrganizations.name,
        governanceStatus: partnerOrganizations.governanceStatus,
    })
        .from(partnerOrganizations)
        .where(inArray(partnerOrganizations.id, uniqueIds));
}

async function loadResourcesForAudit(db, table, logs = [], resourceType) {
    const uniqueIds = uniquePositiveIds(logs
        .filter((row) => row.resourceType === resourceType)
        .map((row) => row.resourceId));
    if (!uniqueIds.length) return [];
    const rows = await db.select({
        id: table.id,
        name: table.name,
    })
        .from(table)
        .where(inArray(table.id, uniqueIds));
    return rows.map((row) => ({ ...row, resourceType }));
}

export const listGovernanceOrganizations = async (c) => {
    try {
        const actor = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        let organizations = [];
        if (normalizeRole(actor?.role) === 'super_admin') {
            organizations = await db.select().from(partnerOrganizations).orderBy(partnerOrganizations.name);
        } else {
            const accessRows = await db.select({ organizationId: organizationAccessMemberships.organizationId })
                .from(organizationAccessMemberships)
                .where(and(
                    eq(organizationAccessMemberships.userId, actor.id),
                    isNull(organizationAccessMemberships.revokedAt),
                ));
            const ids = [...new Set(accessRows.map((row) => Number(row.organizationId)).filter(Boolean))];
            organizations = ids.length
                ? await db.select().from(partnerOrganizations).where(inArray(partnerOrganizations.id, ids)).orderBy(partnerOrganizations.name)
                : [];
        }

        const grouped = await listOrganizationDetails(db, organizations);
        return c.json({
            organizations: organizations.map((org) => formatOrganization(org, grouped)),
        });
    } catch (err) {
        console.error('listGovernanceOrganizations Error:', err);
        return c.json({ error: err.message || 'Failed to load organisations.' }, err.status || 500);
    }
};

export const createGovernanceOrganization = async (c) => {
    try {
        const actor = c.get('user');
        requireSuperAdmin(actor);
        const body = validateRequestBody(await c.req.json(), orgBodySchema, 'Organisation');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const [organization] = await db.insert(partnerOrganizations).values({
            name: body.name,
            description: body.description || null,
            governanceStatus: normalizeOrganizationGovernanceStatus(body.governanceStatus),
            dataContactName: body.dataContactName || null,
            dataContactEmail: body.dataContactEmail || null,
            createdByUserId: actor.id,
            updatedByUserId: actor.id,
        }).returning();

        await recordSensitiveAuditLog(db, actor, {
            actionType: 'organization_created',
            entityType: 'organization',
            entityId: organization.id,
            organizationId: organization.id,
        });

        return c.json(formatOrganization(organization), 201);
    } catch (err) {
        console.error('createGovernanceOrganization Error:', err);
        return c.json({ error: err.message || 'Failed to create organisation.' }, err.status || 500);
    }
};

export const updateGovernanceOrganization = async (c) => {
    try {
        const actor = c.get('user');
        const organizationId = parsePositiveInt(c.req.param('id'), 'organizationId');
        const body = validateRequestBody(await c.req.json(), orgBodySchema, 'Organisation');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const { organization: existingOrganization } = await loadManageableOrganization(db, actor, organizationId);
        const updatePatch = {
            name: body.name,
            description: body.description || null,
            governanceStatus: normalizeOrganizationGovernanceStatus(body.governanceStatus),
            dataContactName: body.dataContactName || null,
            dataContactEmail: body.dataContactEmail || null,
        };

        const [organization] = await db.update(partnerOrganizations)
            .set({
                ...updatePatch,
                updatedByUserId: actor.id,
                updatedAt: new Date(),
            })
            .where(eq(partnerOrganizations.id, organizationId))
            .returning();

        await recordSensitiveAuditLog(db, actor, {
            actionType: 'organization_updated',
            entityType: 'organization',
            entityId: organization.id,
            organizationId: organization.id,
            metadata: buildAuditChangeMetadata(existingOrganization, updatePatch),
        });

        return c.json(formatOrganization(organization));
    } catch (err) {
        console.error('updateGovernanceOrganization Error:', err);
        return c.json({ error: err.message || 'Failed to update organisation.' }, err.status || 500);
    }
};

export const deleteGovernanceOrganization = async (c) => {
    try {
        const actor = c.get('user');
        requireSuperAdmin(actor);
        const organizationId = parsePositiveInt(c.req.param('id'), 'organizationId');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const organization = await loadOrganization(db, organizationId);
        if (!organization) throw httpError('Organisation was not found.', 404);

        const dependencies = await loadActiveOrganizationDependencies(db, organizationId);
        if (!isOrganizationDeletableDraft({ organization, ...dependencies })) {
            throw httpError('Only empty draft organisations can be deleted. Archive this organisation instead, or remove active access, agreements, and resource links first.', 409);
        }

        await recordSensitiveAuditLog(db, actor, {
            actionType: 'organization_deleted',
            entityType: 'organization',
            entityId: organization.id,
            organizationId: organization.id,
            metadata: {
                name: organization.name,
                governanceStatus: normalizeOrganizationGovernanceStatus(organization.governanceStatus),
            },
        });

        await db.delete(partnerOrganizations).where(eq(partnerOrganizations.id, organizationId));

        return c.json({ deleted: true, id: organizationId });
    } catch (err) {
        console.error('deleteGovernanceOrganization Error:', err);
        return c.json({ error: err.message || 'Failed to delete organisation.' }, err.status || 500);
    }
};

export const getGovernanceOrganization = async (c) => {
    try {
        const actor = c.get('user');
        const organizationId = parsePositiveInt(c.req.param('id'), 'organizationId');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const { organization } = await loadViewableOrganization(db, actor, organizationId);
        const grouped = await listOrganizationDetails(db, [organization]);
        return c.json(formatOrganization(organization, grouped));
    } catch (err) {
        console.error('getGovernanceOrganization Error:', err);
        return c.json({ error: err.message || 'Failed to load organisation.' }, err.status || 500);
    }
};

export const getOrganizationAccessCandidates = async (c) => {
    try {
        const actor = c.get('user');
        const organizationId = parsePositiveInt(c.req.param('id'), 'organizationId');
        const query = cleanOneLineText(c.req.query('q') || '', 80).toLowerCase();
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const { accessRows } = await loadManageableOrganization(db, actor, organizationId);
        const activeUserIds = new Set(accessRows.map((row) => Number(row.userId)));
        const rows = await db.select({
            id: users.id,
            username: users.username,
            email: users.email,
            name: users.name,
            role: users.role,
        }).from(users).limit(250);

        const baseCandidates = rows
            .filter((row) => normalizeRole(row.role) !== 'guest')
            .filter((row) => !activeUserIds.has(Number(row.id)))
            .filter((row) => {
                if (!query) return true;
                return `${row.name || ''} ${row.username || ''} ${row.email || ''}`.toLowerCase().includes(query);
            })
            .slice(0, 160);
        const eligibleCandidates = await filterOrganizationAccessCandidates(db, organizationId, baseCandidates);
        const candidates = eligibleCandidates.slice(0, 80).map(formatUser);

        return c.json({ candidates });
    } catch (err) {
        console.error('getOrganizationAccessCandidates Error:', err);
        return c.json({ error: err.message || 'Failed to load organisation access candidates.' }, err.status || 500);
    }
};

export const getOrganizationResourceCandidates = async (c) => {
    try {
        const actor = c.get('user');
        const organizationId = parsePositiveInt(c.req.param('id'), 'organizationId');
        const resourceType = cleanOneLineText(c.req.query('type') || 'hard', 20);
        const query = cleanOneLineText(c.req.query('q') || '', 100);
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        await loadManageableOrganization(db, actor, organizationId);

        let rows = [];
        if (resourceType === 'hard') {
            rows = await db.select({
                id: hardAssets.id,
                name: hardAssets.name,
                address: hardAssets.address,
                postalCode: hardAssets.postalCode,
            })
                .from(hardAssets)
                .where(and(
                    eq(hardAssets.isDeleted, false),
                    query
                        ? or(
                            ilike(hardAssets.name, `%${query}%`),
                            ilike(hardAssets.address, `%${query}%`),
                            ilike(hardAssets.postalCode, `%${query}%`),
                        )
                        : undefined,
                ))
                .orderBy(hardAssets.name)
                .limit(80);
        } else if (resourceType === 'soft') {
            rows = await db.select({
                id: softAssets.id,
                name: softAssets.name,
                subCategory: softAssets.subCategory,
            })
                .from(softAssets)
                .where(and(
                    eq(softAssets.isDeleted, false),
                    query
                        ? or(
                            ilike(softAssets.name, `%${query}%`),
                            ilike(softAssets.subCategory, `%${query}%`),
                        )
                        : undefined,
                ))
                .orderBy(softAssets.name)
                .limit(80);
        } else if (resourceType === 'template') {
            rows = await db.select({
                id: softAssetParents.id,
                name: softAssetParents.name,
                subCategory: softAssetParents.subCategory,
            })
                .from(softAssetParents)
                .where(and(
                    eq(softAssetParents.isDeleted, false),
                    query
                        ? or(
                            ilike(softAssetParents.name, `%${query}%`),
                            ilike(softAssetParents.subCategory, `%${query}%`),
                        )
                        : undefined,
                ))
                .orderBy(softAssetParents.name)
                .limit(80);
        } else {
            throw httpError('Resource type must be hard, soft, or template.', 400);
        }

        return c.json({
            candidates: rows
                .map((row) => formatResourceCandidate(row, resourceType))
                .filter(Boolean),
        });
    } catch (err) {
        console.error('getOrganizationResourceCandidates Error:', err);
        return c.json({ error: err.message || 'Failed to load resource candidates.' }, err.status || 500);
    }
};

export const addOrganizationAccess = async (c) => {
    try {
        const actor = c.get('user');
        const organizationId = parsePositiveInt(c.req.param('id'), 'organizationId');
        const body = validateRequestBody(await c.req.json(), accessBodySchema, 'Organisation access');
        const accessRole = normalizeOrganizationAccessRole(body.accessRole);
        if (!accessRole) throw httpError('Organisation access role must be admin or staff.', 400);

        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const { organization } = await loadManageableOrganization(db, actor, organizationId);
        assertOrganizationOpenForNewRecords(organization, 'Adding organisation access');
        if (accessRole === 'admin' && normalizeRole(actor?.role) !== 'super_admin') {
            throw httpError('Only Super Admin can assign organisation admin access.', 403);
        }
        await assertOrganizationUserAssignment(db, organizationId, body.userId);

        const [membership] = await db.insert(organizationAccessMemberships).values({
            organizationId,
            userId: body.userId,
            accessRole,
            createdByUserId: actor.id,
            updatedByUserId: actor.id,
        }).returning();

        await recordSensitiveAuditLog(db, actor, {
            actionType: 'organization_access_added',
            entityType: 'organization_access',
            entityId: membership.id,
            organizationId,
            targetUserId: body.userId,
            metadata: { accessRole },
        });

        return c.json(membership, 201);
    } catch (err) {
        console.error('addOrganizationAccess Error:', err);
        if (err?.code === '23505') {
            return c.json({ error: 'This user already has active organisation access.' }, 409);
        }
        return c.json({ error: err.message || 'Failed to add organisation access.' }, err.status || 500);
    }
};

export const revokeOrganizationAccess = async (c) => {
    try {
        const actor = c.get('user');
        const organizationId = parsePositiveInt(c.req.param('id'), 'organizationId');
        const membershipId = parsePositiveInt(c.req.param('membershipId'), 'membershipId');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        await loadManageableOrganization(db, actor, organizationId);

        const [membership] = await db.select().from(organizationAccessMemberships)
            .where(and(
                eq(organizationAccessMemberships.id, membershipId),
                eq(organizationAccessMemberships.organizationId, organizationId),
                isNull(organizationAccessMemberships.revokedAt),
            ))
            .limit(1);
        if (!membership) throw httpError('Organisation access membership was not found.', 404);
        if (membership.accessRole === 'admin' && normalizeRole(actor?.role) !== 'super_admin') {
            throw httpError('Only Super Admin can revoke organisation admin access.', 403);
        }

        const [updated] = await db.update(organizationAccessMemberships)
            .set({ revokedAt: new Date(), updatedByUserId: actor.id, updatedAt: new Date() })
            .where(eq(organizationAccessMemberships.id, membershipId))
            .returning();

        await recordSensitiveAuditLog(db, actor, {
            actionType: 'organization_access_revoked',
            entityType: 'organization_access',
            entityId: membershipId,
            organizationId,
            targetUserId: membership.userId,
            metadata: { accessRole: membership.accessRole },
        });

        return c.json(updated);
    } catch (err) {
        console.error('revokeOrganizationAccess Error:', err);
        return c.json({ error: err.message || 'Failed to revoke organisation access.' }, err.status || 500);
    }
};

export const createOrganizationAgreement = async (c) => {
    try {
        const actor = c.get('user');
        const organizationId = parsePositiveInt(c.req.param('id'), 'organizationId');
        const body = validateRequestBody(await c.req.json(), agreementBodySchema, 'Agreement');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const { organization } = await loadManageableOrganization(db, actor, organizationId);
        assertOrganizationOpenForNewRecords(organization, 'Adding agreement records');
        const status = normalizeAgreementStatus(body.status);
        const now = new Date();

        const [agreement] = await db.insert(organizationAgreements).values({
            organizationId,
            agreementReference: body.agreementReference,
            agreementType: body.agreementType || 'data_sharing',
            fileUrl: body.fileUrl || null,
            fileName: body.fileName || null,
            status,
            effectiveAt: parseOptionalDate(body.effectiveAt, 'Effective date'),
            expiresAt: parseOptionalDate(body.expiresAt, 'Expiry date'),
            allowedUses: normalizeAllowedUses(body.allowedUses),
            reviewedByUserId: actor.id,
            approvedByUserId: status === 'active' ? actor.id : null,
            reviewedAt: now,
            approvedAt: status === 'active' ? now : null,
            createdByUserId: actor.id,
            updatedByUserId: actor.id,
        }).returning();

        await recordSensitiveAuditLog(db, actor, {
            actionType: 'organization_agreement_created',
            entityType: 'organization_agreement',
            entityId: agreement.id,
            organizationId,
            metadata: { status, allowedUses: agreement.allowedUses },
        });

        return c.json(formatAgreement(agreement), 201);
    } catch (err) {
        console.error('createOrganizationAgreement Error:', err);
        return c.json({ error: err.message || 'Failed to save agreement.' }, err.status || 500);
    }
};

export const updateOrganizationAgreement = async (c) => {
    try {
        const actor = c.get('user');
        const organizationId = parsePositiveInt(c.req.param('id'), 'organizationId');
        const agreementId = parsePositiveInt(c.req.param('agreementId'), 'agreementId');
        const body = validateRequestBody(await c.req.json(), agreementBodySchema, 'Agreement');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        await loadManageableOrganization(db, actor, organizationId);
        const status = normalizeAgreementStatus(body.status);
        const now = new Date();

        const [agreement] = await db.update(organizationAgreements)
            .set({
                agreementReference: body.agreementReference,
                agreementType: body.agreementType || 'data_sharing',
                fileUrl: body.fileUrl || null,
                fileName: body.fileName || null,
                status,
                effectiveAt: parseOptionalDate(body.effectiveAt, 'Effective date'),
                expiresAt: parseOptionalDate(body.expiresAt, 'Expiry date'),
                allowedUses: normalizeAllowedUses(body.allowedUses),
                reviewedByUserId: actor.id,
                approvedByUserId: status === 'active' ? actor.id : null,
                reviewedAt: now,
                approvedAt: status === 'active' ? now : null,
                updatedByUserId: actor.id,
                updatedAt: now,
            })
            .where(and(
                eq(organizationAgreements.id, agreementId),
                eq(organizationAgreements.organizationId, organizationId),
            ))
            .returning();

        if (!agreement) throw httpError('Agreement was not found.', 404);

        await recordSensitiveAuditLog(db, actor, {
            actionType: 'organization_agreement_updated',
            entityType: 'organization_agreement',
            entityId: agreement.id,
            organizationId,
            metadata: { status, allowedUses: agreement.allowedUses },
        });

        return c.json(formatAgreement(agreement));
    } catch (err) {
        console.error('updateOrganizationAgreement Error:', err);
        return c.json({ error: err.message || 'Failed to update agreement.' }, err.status || 500);
    }
};

export const revokeOrganizationAgreement = async (c) => {
    try {
        const actor = c.get('user');
        const organizationId = parsePositiveInt(c.req.param('id'), 'organizationId');
        const agreementId = parsePositiveInt(c.req.param('agreementId'), 'agreementId');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        await loadManageableOrganization(db, actor, organizationId);
        const [agreement] = await db.update(organizationAgreements)
            .set({
                status: 'revoked',
                revokedAt: new Date(),
                updatedByUserId: actor.id,
                updatedAt: new Date(),
            })
            .where(and(
                eq(organizationAgreements.id, agreementId),
                eq(organizationAgreements.organizationId, organizationId),
            ))
            .returning();
        if (!agreement) throw httpError('Agreement was not found.', 404);

        await recordSensitiveAuditLog(db, actor, {
            actionType: 'organization_agreement_revoked',
            entityType: 'organization_agreement',
            entityId: agreement.id,
            organizationId,
        });

        return c.json(formatAgreement(agreement));
    } catch (err) {
        console.error('revokeOrganizationAgreement Error:', err);
        return c.json({ error: err.message || 'Failed to revoke agreement.' }, err.status || 500);
    }
};

export const linkOrganizationResource = async (c) => {
    try {
        const actor = c.get('user');
        const organizationId = parsePositiveInt(c.req.param('id'), 'organizationId');
        const body = validateRequestBody(await c.req.json(), resourceLinkBodySchema, 'Resource link');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const { organization } = await loadManageableOrganization(db, actor, organizationId);
        assertOrganizationOpenForNewRecords(organization, 'Linking resources');
        const resource = await loadResourceForLink(db, body.resourceType, body.resourceId);
        if (!resource) throw httpError('Resource was not found.', 404);
        await assertResourceOrganizationLinkEligibility(db, organizationId, body.resourceType, body.resourceId);

        const [link] = await db.insert(organizationResourceLinks).values({
            organizationId,
            resourceType: body.resourceType,
            resourceId: body.resourceId,
            linkedByUserId: actor.id,
        }).returning();

        await recordSensitiveAuditLog(db, actor, {
            actionType: 'organization_resource_linked',
            entityType: 'organization_resource_link',
            entityId: link.id,
            organizationId,
            resourceType: body.resourceType,
            resourceId: body.resourceId,
        });

        return c.json(formatResourceLink({ ...link, resourceName: resource.name }), 201);
    } catch (err) {
        console.error('linkOrganizationResource Error:', err);
        if (err?.code === '23505') {
            return c.json({ error: 'This resource is already linked to the organisation.' }, 409);
        }
        return c.json({ error: err.message || 'Failed to link resource.' }, err.status || 500);
    }
};

export const unlinkOrganizationResource = async (c) => {
    try {
        const actor = c.get('user');
        const organizationId = parsePositiveInt(c.req.param('id'), 'organizationId');
        const linkId = parsePositiveInt(c.req.param('linkId'), 'linkId');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        await loadManageableOrganization(db, actor, organizationId);

        const [link] = await db.update(organizationResourceLinks)
            .set({
                linkStatus: 'unlinked',
                unlinkedByUserId: actor.id,
                unlinkedAt: new Date(),
                updatedAt: new Date(),
            })
            .where(and(
                eq(organizationResourceLinks.id, linkId),
                eq(organizationResourceLinks.organizationId, organizationId),
                isNull(organizationResourceLinks.unlinkedAt),
            ))
            .returning();
        if (!link) throw httpError('Organisation resource link was not found.', 404);

        await recordSensitiveAuditLog(db, actor, {
            actionType: 'organization_resource_unlinked',
            entityType: 'organization_resource_link',
            entityId: link.id,
            organizationId,
            resourceType: link.resourceType,
            resourceId: link.resourceId,
        });

        return c.json(link);
    } catch (err) {
        console.error('unlinkOrganizationResource Error:', err);
        return c.json({ error: err.message || 'Failed to unlink resource.' }, err.status || 500);
    }
};

export const getMyConsentStatus = async (c) => {
    try {
        const actor = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const records = await db.select().from(userConsentRecords)
            .where(eq(userConsentRecords.userId, actor.id))
            .orderBy(desc(userConsentRecords.createdAt));
        return c.json({ consents: records });
    } catch (err) {
        console.error('getMyConsentStatus Error:', err);
        return c.json({ error: err.message || 'Failed to load consent records.' }, err.status || 500);
    }
};

export const recordMyConsent = async (c) => {
    try {
        const actor = c.get('user');
        const body = validateRequestBody(await c.req.json(), consentBodySchema, 'Consent');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const status = cleanOneLineText(body.status || 'accepted', 40).toLowerCase() === 'withdrawn' ? 'withdrawn' : 'accepted';
        const now = new Date();
        const [record] = await db.insert(userConsentRecords).values({
            userId: actor.id,
            consentType: body.consentType,
            consentVersion: body.consentVersion,
            status,
            sourceSurface: body.sourceSurface || null,
            acceptedAt: status === 'accepted' ? now : null,
            withdrawnAt: status === 'withdrawn' ? now : null,
            metadata: body.metadata || {},
        }).returning();

        await recordSensitiveAuditLog(db, actor, {
            actionType: `consent_${status}`,
            entityType: 'user_consent',
            entityId: record.id,
            targetUserId: actor.id,
            metadata: { consentType: record.consentType, consentVersion: record.consentVersion },
        });

        return c.json(record, 201);
    } catch (err) {
        console.error('recordMyConsent Error:', err);
        return c.json({ error: err.message || 'Failed to save consent record.' }, err.status || 500);
    }
};

export const getMyNotificationPreferences = async (c) => {
    try {
        const actor = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const preferences = await db.select().from(notificationPreferences)
            .where(eq(notificationPreferences.userId, actor.id));
        return c.json({ preferences });
    } catch (err) {
        console.error('getMyNotificationPreferences Error:', err);
        return c.json({ error: err.message || 'Failed to load notification preferences.' }, err.status || 500);
    }
};

export const updateMyNotificationPreferences = async (c) => {
    try {
        const actor = c.get('user');
        const body = validateRequestBody(await c.req.json(), preferenceBodySchema, 'Notification preferences');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const saved = [];
        for (const preference of body.preferences) {
            const channel = normalizeNotificationChannel(preference.channel);
            const category = cleanOneLineText(preference.category || 'general', 80) || 'general';
            const payload = {
                userId: actor.id,
                channel,
                category,
                enabled: preference.enabled,
                deliveryAllowed: isNotificationDeliveryAllowed({ channel, enabled: preference.enabled }),
                updatedByUserId: actor.id,
                updatedAt: new Date(),
            };
            const [row] = await db.insert(notificationPreferences)
                .values(payload)
                .onConflictDoUpdate({
                    target: [notificationPreferences.userId, notificationPreferences.channel, notificationPreferences.category],
                    set: payload,
                })
                .returning();
            saved.push(row);
        }

        await recordSensitiveAuditLog(db, actor, {
            actionType: 'notification_preferences_updated',
            entityType: 'notification_preferences',
            targetUserId: actor.id,
            metadata: { count: saved.length },
        });

        return c.json({ preferences: saved });
    } catch (err) {
        console.error('updateMyNotificationPreferences Error:', err);
        return c.json({ error: err.message || 'Failed to update notification preferences.' }, err.status || 500);
    }
};

export const recordMyOptOut = async (c) => {
    try {
        const actor = c.get('user');
        const body = validateRequestBody(await c.req.json(), optOutBodySchema, 'Opt-out');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const [existingActive] = await db.select().from(userOptOutRecords)
            .where(and(
                eq(userOptOutRecords.userId, actor.id),
                eq(userOptOutRecords.optOutType, body.optOutType),
                eq(userOptOutRecords.active, true),
                isNull(userOptOutRecords.revokedAt),
            ))
            .limit(1);
        const optOutPayload = {
            reason: body.reason || null,
            active: body.active,
            sourceSurface: body.sourceSurface || null,
            revokedByUserId: body.active ? null : actor.id,
            revokedAt: body.active ? null : new Date(),
            updatedAt: new Date(),
        };
        const [record] = existingActive
            ? await db.update(userOptOutRecords)
                .set(optOutPayload)
                .where(eq(userOptOutRecords.id, existingActive.id))
                .returning()
            : await db.insert(userOptOutRecords).values({
                userId: actor.id,
                optOutType: body.optOutType,
                ...optOutPayload,
                createdByUserId: actor.id,
            }).returning();

        await recordSensitiveAuditLog(db, actor, {
            actionType: body.active ? 'opt_out_recorded' : 'opt_out_revoked',
            entityType: 'user_opt_out',
            entityId: record.id,
            targetUserId: actor.id,
            metadata: { optOutType: record.optOutType },
        });

        return c.json(record, 201);
    } catch (err) {
        console.error('recordMyOptOut Error:', err);
        return c.json({ error: err.message || 'Failed to save opt-out record.' }, err.status || 500);
    }
};

export const listAuditLogs = async (c) => {
    try {
        const actor = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        let accessRows = [];
        if (normalizeRole(actor?.role) !== 'super_admin') {
            accessRows = await db.select({
                userId: organizationAccessMemberships.userId,
                organizationId: organizationAccessMemberships.organizationId,
                accessRole: organizationAccessMemberships.accessRole,
                revokedAt: organizationAccessMemberships.revokedAt,
            })
                .from(organizationAccessMemberships)
                .where(and(
                    eq(organizationAccessMemberships.userId, actor.id),
                    eq(organizationAccessMemberships.accessRole, 'admin'),
                    isNull(organizationAccessMemberships.revokedAt),
                ));
        }

        const scope = buildAuditAccessScope(actor, accessRows);
        if (scope.mode === 'none') {
            throw httpError('Audit trail access is outside your organisation access.', 403);
        }

        const query = normalizeAuditLogQuery(c.req.query());
        if (scope.mode === 'organizations' && query.organizationId && !scope.organizationIds.includes(query.organizationId)) {
            throw httpError('Audit trail access is outside your organisation access.', 403);
        }

        const conditions = [];
        if (scope.mode === 'organizations') {
            conditions.push(inArray(sensitiveAuditLogs.organizationId, query.organizationId ? [query.organizationId] : scope.organizationIds));
        } else if (query.organizationId) {
            conditions.push(eq(sensitiveAuditLogs.organizationId, query.organizationId));
        }
        if (query.actorUserId) conditions.push(eq(sensitiveAuditLogs.actorUserId, query.actorUserId));
        if (query.targetUserId) conditions.push(eq(sensitiveAuditLogs.targetUserId, query.targetUserId));
        if (query.resourceType) conditions.push(eq(sensitiveAuditLogs.resourceType, query.resourceType));
        if (query.resourceId) conditions.push(eq(sensitiveAuditLogs.resourceId, query.resourceId));
        if (query.actionType) conditions.push(eq(sensitiveAuditLogs.actionType, query.actionType));
        if (query.category) {
            const categoryCondition = buildAuditCategoryCondition(query.category);
            if (categoryCondition) conditions.push(categoryCondition);
        }
        if (query.from) conditions.push(gte(sensitiveAuditLogs.createdAt, query.from));
        if (query.to) conditions.push(lte(sensitiveAuditLogs.createdAt, query.to));
        if (query.before && query.beforeId) {
            conditions.push(or(
                lt(sensitiveAuditLogs.createdAt, query.before),
                and(eq(sensitiveAuditLogs.createdAt, query.before), lt(sensitiveAuditLogs.id, query.beforeId)),
            ));
        } else if (query.before) {
            conditions.push(lt(sensitiveAuditLogs.createdAt, query.before));
        }

        const auditQuery = conditions.length
            ? db.select().from(sensitiveAuditLogs).where(and(...conditions))
            : db.select().from(sensitiveAuditLogs);
        const rows = await auditQuery
            .orderBy(desc(sensitiveAuditLogs.createdAt), desc(sensitiveAuditLogs.id))
            .limit(query.limit + 1);

        const logs = rows.slice(0, query.limit);
        const [actorRows, targetRows, orgRows, hardRows, softRows, templateRows] = await Promise.all([
            loadUsersForAudit(db, logs.map((row) => row.actorUserId)),
            loadUsersForAudit(db, logs.map((row) => row.targetUserId)),
            loadOrganizationsForAudit(db, logs.map((row) => row.organizationId)),
            loadResourcesForAudit(db, hardAssets, logs, 'hard'),
            loadResourcesForAudit(db, softAssets, logs, 'soft'),
            loadResourcesForAudit(db, softAssetParents, logs, 'template'),
        ]);
        const resources = new Map([...hardRows, ...softRows, ...templateRows].map((row) => [`${row.resourceType}:${row.id}`, row]));
        const nextRow = rows.length > query.limit ? logs[logs.length - 1] : null;

        return c.json({
            logs: logs.map((row) => formatAuditLogForResponse(row, {
                actors: new Map(actorRows.map((row) => [Number(row.id), row])),
                targets: new Map(targetRows.map((row) => [Number(row.id), row])),
                organizations: new Map(orgRows.map((row) => [Number(row.id), row])),
                resources,
            })),
            nextCursor: nextRow ? {
                before: nextRow.createdAt instanceof Date ? nextRow.createdAt.toISOString() : nextRow.createdAt,
                beforeId: nextRow.id,
            } : null,
            scope: scope.mode,
            organizationIds: scope.mode === 'organizations' ? scope.organizationIds : [],
            limit: query.limit,
        });
    } catch (err) {
        console.error('listAuditLogs Error:', err);
        return c.json({ error: err.message || 'Failed to load audit logs.' }, err.status || 500);
    }
};

export const listRetentionQueue = async (c) => {
    try {
        requireSuperAdmin(c.get('user'));
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const records = await db.select().from(retentionRecords)
            .orderBy(desc(retentionRecords.updatedAt))
            .limit(200);
        return c.json({ records });
    } catch (err) {
        console.error('listRetentionQueue Error:', err);
        return c.json({ error: err.message || 'Failed to load retention queue.' }, err.status || 500);
    }
};

export const updateRetentionRecord = async (c) => {
    try {
        const actor = c.get('user');
        requireSuperAdmin(actor);
        const retentionId = parsePositiveInt(c.req.param('id'), 'retentionId');
        const body = validateRequestBody(await c.req.json(), retentionBodySchema, 'Retention record');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const now = new Date();
        const [record] = await db.update(retentionRecords)
            .set({
                ...(body.deletionEligible !== undefined ? { deletionEligible: body.deletionEligible } : {}),
                ...(body.deletionStatus !== undefined ? { deletionStatus: body.deletionStatus || 'active' } : {}),
                ...(body.retainUntil !== undefined ? { retainUntil: parseOptionalDate(body.retainUntil, 'Retain until') } : {}),
                ...(body.notes !== undefined ? { notes: body.notes || null } : {}),
                reviewedByUserId: actor.id,
                reviewedAt: now,
                updatedAt: now,
            })
            .where(eq(retentionRecords.id, retentionId))
            .returning();
        if (!record) throw httpError('Retention record was not found.', 404);

        await recordSensitiveAuditLog(db, actor, {
            actionType: 'retention_record_updated',
            entityType: 'retention_record',
            entityId: record.id,
            metadata: { deletionEligible: record.deletionEligible, deletionStatus: record.deletionStatus },
        });

        return c.json(record);
    } catch (err) {
        console.error('updateRetentionRecord Error:', err);
        return c.json({ error: err.message || 'Failed to update retention record.' }, err.status || 500);
    }
};

export const updateResourceFreshness = async (c) => {
    try {
        const actor = c.get('user');
        requireSuperAdmin(actor);
        const resourceType = cleanOneLineText(c.req.param('type') || '', 20);
        const resourceId = parsePositiveInt(c.req.param('id'), 'resourceId');
        const body = validateRequestBody(await c.req.json(), freshnessBodySchema, 'Resource freshness');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const payload = {
            lastReviewedAt: parseOptionalDate(body.lastReviewedAt, 'Last reviewed date') || new Date(),
            lastVerifiedByUserId: actor.id,
            sourceType: body.sourceType || null,
            verificationStatus: cleanOneLineText(body.verificationStatus || 'unverified', 40) || 'unverified',
            verificationConfidence: body.verificationConfidence || null,
            updatedAt: new Date(),
        };
        const table = resourceType === 'hard'
            ? hardAssets
            : resourceType === 'soft'
                ? softAssets
                : resourceType === 'template'
                    ? softAssetParents
                    : null;
        if (!table) throw httpError('Resource type must be hard, soft, or template.', 400);

        const [resource] = await db.update(table)
            .set(payload)
            .where(eq(table.id, resourceId))
            .returning();
        if (!resource) throw httpError('Resource was not found.', 404);

        await recordSensitiveAuditLog(db, actor, {
            actionType: 'resource_freshness_updated',
            entityType: `${resourceType}_resource`,
            entityId: resourceId,
            resourceType,
            resourceId,
            metadata: {
                verificationStatus: payload.verificationStatus,
                verificationConfidence: payload.verificationConfidence,
            },
        });

        return c.json(resource);
    } catch (err) {
        console.error('updateResourceFreshness Error:', err);
        return c.json({ error: err.message || 'Failed to update resource freshness.' }, err.status || 500);
    }
};
