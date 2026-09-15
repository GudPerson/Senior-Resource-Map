import { and, desc, eq, ilike, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import { getDb } from '../db/index.js';
import {
    hardAssets,
    hardAssetStaffMemberships,
    organizationAccessMemberships,
    organizationAgreements,
    organizationResourceLinks,
    partnerOrganizations,
    resourcePublicationPermissions,
    sensitiveAuditLogs,
    softAssets,
    softAssetStaffMemberships,
    users,
} from '../db/schema.js';
import { executeAtomicBatch, buildResourceWriteLockQuery, reserveSerialId } from '../utils/atomicWrites.js';
import { ensureBoundarySchema } from '../utils/boundarySchema.js';
import { canManageOrganizationGovernance, canViewOrganizationGovernance, isOrganizationOpenForNewRecords } from '../utils/governance.js';
import {
    cleanOneLineText,
    parsePositiveInt,
    positiveIntValueSchema,
    validateRequestBody,
} from '../utils/inputValidation.js';
import { ORGANIZATION_PILOT_TERMS_VERSION } from '../utils/organizationOnboarding.js';
import {
    hasRequestedPublicationScope,
    isPublicationScopeWithinRequest,
    normalizeResourceClaimFields,
    normalizeResourceClaimUses,
    resourceClaimDisplayStatus,
    resourceFieldHasValue,
} from '../utils/resourceClaims.js';
import { normalizeRole } from '../utils/roles.js';

const resourceTypeSchema = z.enum(['hard', 'soft']);
const claimScopeSchema = z.object({
    requestedFields: z.array(z.string()).max(7),
    requestedUses: z.record(z.boolean()),
    evidenceNote: z.string().trim().min(20).max(2000),
    attestedOwnerAuthority: z.literal(true),
});
const submitClaimSchema = claimScopeSchema.extend({
    organizationId: positiveIntValueSchema('organizationId'),
    resourceType: resourceTypeSchema,
    resourceId: positiveIntValueSchema('resourceId'),
});
const resubmitClaimSchema = claimScopeSchema.extend({
    expectedRevision: positiveIntValueSchema('expectedRevision'),
});
const verifyClaimSchema = z.object({
    ownerUserId: positiveIntValueSchema('ownerUserId'),
    expectedRevision: positiveIntValueSchema('expectedRevision'),
});
const publicationApprovalSchema = z.object({
    agreementId: positiveIntValueSchema('agreementId'),
    approvedFields: z.array(z.string()).max(7),
    allowedUses: z.record(z.boolean()),
    expectedRevision: positiveIntValueSchema('expectedRevision'),
});
const reasonSchema = z.object({
    reason: z.string().trim().min(10).max(1000),
    expectedRevision: positiveIntValueSchema('expectedRevision'),
});

function httpError(message, status = 400) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function requireSuperAdmin(actor) {
    if (normalizeRole(actor?.role) !== 'super_admin') throw httpError('Super Admin access is required.', 403);
}

function resourceTable(resourceType) {
    return resourceType === 'hard' ? hardAssets : softAssets;
}

function staffTable(resourceType) {
    return resourceType === 'hard' ? hardAssetStaffMemberships : softAssetStaffMemberships;
}

function staffResourceColumn(resourceType) {
    return resourceType === 'hard' ? hardAssetStaffMemberships.hardAssetId : softAssetStaffMemberships.softAssetId;
}

function resourceLockType(resourceType) {
    return resourceType === 'hard' ? 'hardAsset' : 'softAsset';
}

function buildClaimMutationGuard(db, claim) {
    return db.select({
        verified: sql`jsonb_array_length(
            CASE
                WHEN EXISTS (
                    SELECT 1 FROM ${resourcePublicationPermissions}
                    WHERE ${resourcePublicationPermissions.id} = ${claim.id}
                      AND ${resourcePublicationPermissions.revision} = ${claim.revision}
                      AND ${resourcePublicationPermissions.status} = ${claim.status}
                    FOR UPDATE
                ) THEN '[]'::jsonb
                ELSE jsonb_build_object('error', 'claim_changed')
            END
        )`,
    }).from(sql`(
        SELECT pg_advisory_xact_lock(43113, ${claim.id}) AS locked
    ) AS resource_claim_write_lock`);
}

function buildClaimAvailabilityGuard(db, organizationId, resourceType, resourceId, { excludeClaimId = null } = {}) {
    const excludedClaimFilter = excludeClaimId === null
        ? sql``
        : sql`AND ${resourcePublicationPermissions.id} <> ${parsePositiveInt(excludeClaimId, 'excludeClaimId')}`;
    return db.select({
        verified: sql`jsonb_array_length(
            CASE
                WHEN NOT EXISTS (
                    SELECT 1 FROM ${organizationResourceLinks}
                    WHERE ${organizationResourceLinks.resourceType} = ${resourceType}
                      AND ${organizationResourceLinks.resourceId} = ${resourceId}
                      AND ${organizationResourceLinks.organizationId} <> ${organizationId}
                      AND ${organizationResourceLinks.unlinkedAt} IS NULL
                ) AND NOT EXISTS (
                    SELECT 1 FROM ${resourcePublicationPermissions}
                    WHERE ${resourcePublicationPermissions.resourceType} = ${resourceType}
                      AND ${resourcePublicationPermissions.resourceId} = ${resourceId}
                      ${excludedClaimFilter}
                      AND (
                          ${resourcePublicationPermissions.organizationId} = ${organizationId}
                          OR ${resourcePublicationPermissions.status} <> 'permission_withdrawn'
                      )
                ) THEN '[]'::jsonb
                ELSE jsonb_build_object('error', 'resource_claim_unavailable')
            END
        )`,
    }).from(sql`(select 1) AS resource_claim_availability`);
}

function buildResourceLinkAvailabilityGuard(db, organizationId, resourceType, resourceId) {
    return db.select({
        verified: sql`jsonb_array_length(
            CASE
                WHEN NOT EXISTS (
                    SELECT 1 FROM ${organizationResourceLinks}
                    WHERE ${organizationResourceLinks.resourceType} = ${resourceType}
                      AND ${organizationResourceLinks.resourceId} = ${resourceId}
                      AND ${organizationResourceLinks.organizationId} <> ${organizationId}
                      AND ${organizationResourceLinks.unlinkedAt} IS NULL
                ) THEN '[]'::jsonb
                ELSE jsonb_build_object('error', 'resource_link_unavailable')
            END
        )`,
    }).from(sql`(select 1) AS resource_link_availability`);
}

function buildPublishingAgreementGuard(db, agreementId, organizationId) {
    return db.select({
        verified: sql`jsonb_array_length(
            CASE
                WHEN EXISTS (
                    SELECT 1 FROM ${organizationAgreements}
                    WHERE ${organizationAgreements.id} = ${agreementId}
                      AND ${organizationAgreements.organizationId} = ${organizationId}
                      AND ${organizationAgreements.status} = 'active'
                      AND ${organizationAgreements.revokedAt} IS NULL
                      AND ${organizationAgreements.approvedAt} IS NOT NULL
                      AND ${organizationAgreements.allowedUses} @> '{"publicListing":true,"externalSharing":true}'::jsonb
                      AND (
                          ${organizationAgreements.effectiveAt} IS NULL
                          OR ${organizationAgreements.effectiveAt} <= CURRENT_TIMESTAMP
                      )
                      AND (
                          ${organizationAgreements.expiresAt} IS NULL
                          OR ${organizationAgreements.expiresAt} >= CURRENT_TIMESTAMP
                      )
                    FOR UPDATE
                ) THEN '[]'::jsonb
                ELSE jsonb_build_object('error', 'agreement_unavailable')
            END
        )`,
    }).from(sql`(select 1) AS publishing_agreement_availability`);
}

async function executeGuardedClaimBatch(db, queries, operation, conflictMessage) {
    try {
        return await executeAtomicBatch(db, queries, operation);
    } catch (error) {
        if (error?.code === '22023' && /array length|jsonb_array_length/i.test(String(error?.message || ''))) {
            throw httpError(conflictMessage, 409);
        }
        throw error;
    }
}

function normalizeClaimScope(body, resourceType) {
    const fields = normalizeResourceClaimFields(body.requestedFields, resourceType);
    const uses = normalizeResourceClaimUses(body.requestedUses);
    if (!hasRequestedPublicationScope(fields, uses)) {
        throw httpError('Choose at least one content field and one public use for this claim.', 400);
    }
    return { fields, uses, evidenceNote: String(body.evidenceNote).trim() };
}

async function loadOrganizationAccessRows(db, organizationId) {
    return db.select().from(organizationAccessMemberships).where(and(
        eq(organizationAccessMemberships.organizationId, organizationId),
        isNull(organizationAccessMemberships.revokedAt),
    ));
}

async function loadOrganizationForActor(db, actor, organizationId, { manage = false } = {}) {
    const [organization] = await db.select().from(partnerOrganizations)
        .where(eq(partnerOrganizations.id, organizationId)).limit(1);
    if (!organization) throw httpError('Organisation was not found.', 404);
    const accessRows = await loadOrganizationAccessRows(db, organizationId);
    const allowed = manage
        ? canManageOrganizationGovernance(actor, organization, accessRows)
        : canViewOrganizationGovernance(actor, organization, accessRows);
    if (!allowed) throw httpError('Organisation access is required.', 403);
    if (manage && !isOrganizationOpenForNewRecords(organization)) {
        throw httpError('This organisation is not open for new resource claims.', 409);
    }
    return { organization, accessRows };
}

async function loadClaim(db, claimId) {
    const [claim] = await db.select().from(resourcePublicationPermissions)
        .where(eq(resourcePublicationPermissions.id, claimId)).limit(1);
    if (!claim) throw httpError('Resource claim was not found.', 404);
    return claim;
}

async function loadResource(db, resourceType, resourceId) {
    const table = resourceTable(resourceType);
    const [resource] = await db.select().from(table).where(and(
        eq(table.id, resourceId),
        eq(table.isDeleted, false),
    )).limit(1);
    if (!resource) throw httpError('Resource was not found.', 404);
    return resource;
}

function claimPermissionSummary(actor, organization, accessRows, claim) {
    const superAdmin = normalizeRole(actor?.role) === 'super_admin';
    const manager = canManageOrganizationGovernance(actor, organization, accessRows);
    const displayStatus = resourceClaimDisplayStatus(claim);
    return {
        canVerifyOwner: superAdmin && claim.status === 'claim_pending',
        canReject: superAdmin && claim.status === 'claim_pending',
        canApprovePublication: superAdmin && claim.status === 'owner_verified',
        canWithdraw: manager && claim.status !== 'permission_withdrawn',
        canResubmit: manager && claim.status === 'permission_withdrawn',
        canEditResource: manager && ['owner_verified', 'publishing_approved'].includes(claim.status),
        displayStatus,
    };
}

async function formatClaims(db, actor, claims) {
    if (!claims.length) return [];
    const organizationIds = [...new Set(claims.map((claim) => Number(claim.organizationId)).filter(Boolean))];
    const hardIds = [...new Set(claims.filter((claim) => claim.resourceType === 'hard').map((claim) => Number(claim.resourceId)))];
    const softIds = [...new Set(claims.filter((claim) => claim.resourceType === 'soft').map((claim) => Number(claim.resourceId)))];
    const userIds = [...new Set(claims.flatMap((claim) => [claim.requestedByUserId, claim.reviewedByUserId]).map(Number).filter(Boolean))];
    const agreementIds = [...new Set(claims.map((claim) => Number(claim.agreementId)).filter(Boolean))];
    const [organizations, accessRows, hardRows, softRows, userRows, agreementRows] = await Promise.all([
        db.select().from(partnerOrganizations).where(inArray(partnerOrganizations.id, organizationIds)),
        db.select().from(organizationAccessMemberships).where(and(
            inArray(organizationAccessMemberships.organizationId, organizationIds),
            isNull(organizationAccessMemberships.revokedAt),
        )),
        hardIds.length ? db.select({ id: hardAssets.id, name: hardAssets.name, address: hardAssets.address, postalCode: hardAssets.postalCode }).from(hardAssets).where(inArray(hardAssets.id, hardIds)) : [],
        softIds.length ? db.select({ id: softAssets.id, name: softAssets.name, subCategory: softAssets.subCategory }).from(softAssets).where(inArray(softAssets.id, softIds)) : [],
        userIds.length ? db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(inArray(users.id, userIds)) : [],
        agreementIds.length ? db.select({ id: organizationAgreements.id, agreementReference: organizationAgreements.agreementReference, status: organizationAgreements.status }).from(organizationAgreements).where(inArray(organizationAgreements.id, agreementIds)) : [],
    ]);
    const organizationById = new Map(organizations.map((row) => [Number(row.id), row]));
    const accessByOrganization = new Map();
    for (const row of accessRows) {
        const key = Number(row.organizationId);
        if (!accessByOrganization.has(key)) accessByOrganization.set(key, []);
        accessByOrganization.get(key).push(row);
    }
    const resourceByKey = new Map([
        ...hardRows.map((row) => [`hard:${row.id}`, row]),
        ...softRows.map((row) => [`soft:${row.id}`, row]),
    ]);
    const userById = new Map(userRows.map((row) => [Number(row.id), row]));
    const agreementById = new Map(agreementRows.map((row) => [Number(row.id), row]));

    return claims.map((claim) => {
        const organization = organizationById.get(Number(claim.organizationId));
        const access = accessByOrganization.get(Number(claim.organizationId)) || [];
        return {
            id: claim.id,
            organization: organization ? { id: organization.id, name: organization.name, governanceStatus: organization.governanceStatus } : null,
            resourceType: claim.resourceType,
            resource: resourceByKey.get(`${claim.resourceType}:${claim.resourceId}`) || { id: claim.resourceId, name: `Resource ${claim.resourceId}` },
            status: claim.status,
            approvedFields: Array.isArray(claim.approvedFields) ? claim.approvedFields : [],
            allowedUses: normalizeResourceClaimUses(claim.allowedUses),
            provenanceNote: claim.provenanceNote,
            termsVersion: claim.termsVersion,
            requestedBy: userById.get(Number(claim.requestedByUserId)) || null,
            reviewedBy: userById.get(Number(claim.reviewedByUserId)) || null,
            agreement: agreementById.get(Number(claim.agreementId)) || null,
            approvedAt: claim.approvedAt,
            withdrawnAt: claim.withdrawnAt,
            withdrawalReason: claim.withdrawalReason,
            revision: claim.revision,
            createdAt: claim.createdAt,
            updatedAt: claim.updatedAt,
            permissions: claimPermissionSummary(actor, organization, access, claim),
        };
    });
}

async function visibleOrganizationIds(db, actor, requestedOrganizationId) {
    if (normalizeRole(actor?.role) === 'super_admin') {
        return requestedOrganizationId ? [requestedOrganizationId] : null;
    }
    const rows = await db.select({ organizationId: organizationAccessMemberships.organizationId })
        .from(organizationAccessMemberships)
        .where(and(
            eq(organizationAccessMemberships.userId, actor.id),
            eq(organizationAccessMemberships.accessRole, 'admin'),
            isNull(organizationAccessMemberships.revokedAt),
        ));
    const ids = [...new Set(rows.map((row) => Number(row.organizationId)).filter(Boolean))];
    if (ids.length === 0) throw httpError('Organisation Admin access is required.', 403);
    if (requestedOrganizationId && !ids.includes(requestedOrganizationId)) throw httpError('Organisation access is required.', 403);
    return requestedOrganizationId ? [requestedOrganizationId] : ids;
}

function buildClaimAuditInsert(db, actor, claim, actionType, metadata = {}) {
    return db.insert(sensitiveAuditLogs).values({
        actorUserId: actor.id,
        actionType,
        entityType: 'resource_publication_permission',
        entityId: claim.id,
        resourceType: claim.resourceType,
        resourceId: claim.resourceId,
        organizationId: claim.organizationId,
        metadata,
    });
}

async function claimResponse(db, actor, claimId) {
    return (await formatClaims(db, actor, [await loadClaim(db, claimId)]))[0];
}

export const listResourceClaims = async (c) => {
    try {
        const actor = c.get('user');
        const requestedOrganizationId = c.req.query('organizationId')
            ? parsePositiveInt(c.req.query('organizationId'), 'organizationId')
            : null;
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const organizationIds = await visibleOrganizationIds(db, actor, requestedOrganizationId);
        if (Array.isArray(organizationIds) && organizationIds.length === 0) return c.json({ claims: [] });
        const status = cleanOneLineText(c.req.query('status') || '', 32);
        const clauses = [];
        if (organizationIds) clauses.push(inArray(resourcePublicationPermissions.organizationId, organizationIds));
        if (status) clauses.push(eq(resourcePublicationPermissions.status, status));
        const claims = await db.select().from(resourcePublicationPermissions)
            .where(clauses.length ? and(...clauses) : undefined)
            .orderBy(desc(resourcePublicationPermissions.updatedAt), desc(resourcePublicationPermissions.id))
            .limit(250);
        return c.json({ claims: await formatClaims(db, actor, claims) });
    } catch (error) {
        console.error('listResourceClaims Error:', error);
        return c.json({ error: error.message || 'Failed to load resource claims.' }, error.status || 500);
    }
};

export const listResourceClaimCandidates = async (c) => {
    try {
        const actor = c.get('user');
        const organizationId = parsePositiveInt(c.req.query('organizationId'), 'organizationId');
        const resourceType = resourceTypeSchema.parse(cleanOneLineText(c.req.query('type') || 'hard', 20));
        const query = cleanOneLineText(c.req.query('q') || '', 100);
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        await loadOrganizationForActor(db, actor, organizationId, { manage: true });
        const table = resourceTable(resourceType);
        const rows = resourceType === 'hard'
            ? await db.select({ id: hardAssets.id, name: hardAssets.name, address: hardAssets.address, postalCode: hardAssets.postalCode })
                .from(hardAssets).where(and(
                    eq(hardAssets.isDeleted, false),
                    query ? or(ilike(hardAssets.name, `%${query}%`), ilike(hardAssets.address, `%${query}%`), ilike(hardAssets.postalCode, `%${query}%`)) : undefined,
                )).orderBy(hardAssets.name).limit(160)
            : await db.select({ id: softAssets.id, name: softAssets.name, subCategory: softAssets.subCategory })
                .from(softAssets).where(and(
                    eq(softAssets.isDeleted, false),
                    query ? or(ilike(softAssets.name, `%${query}%`), ilike(softAssets.subCategory, `%${query}%`)) : undefined,
                )).orderBy(softAssets.name).limit(160);
        const ids = rows.map((row) => Number(row.id));
        if (!ids.length) return c.json({ candidates: [] });
        const [links, permissions] = await Promise.all([
            db.select().from(organizationResourceLinks).where(and(
                eq(organizationResourceLinks.resourceType, resourceType),
                inArray(organizationResourceLinks.resourceId, ids),
                isNull(organizationResourceLinks.unlinkedAt),
            )),
            db.select().from(resourcePublicationPermissions).where(and(
                eq(resourcePublicationPermissions.resourceType, resourceType),
                inArray(resourcePublicationPermissions.resourceId, ids),
                ne(resourcePublicationPermissions.status, 'permission_withdrawn'),
            )),
        ]);
        const blocked = new Set([
            ...links.filter((row) => Number(row.organizationId) !== organizationId).map((row) => Number(row.resourceId)),
            ...permissions.map((row) => Number(row.resourceId)),
        ]);
        return c.json({ candidates: rows.filter((row) => !blocked.has(Number(row.id))).slice(0, 80).map((row) => ({ ...row, resourceType })) });
    } catch (error) {
        console.error('listResourceClaimCandidates Error:', error);
        const status = error instanceof z.ZodError ? 400 : error.status || 500;
        return c.json({ error: error instanceof z.ZodError ? 'Resource type must be hard or soft.' : error.message || 'Failed to load resource candidates.' }, status);
    }
};

export const submitResourceClaim = async (c) => {
    try {
        const actor = c.get('user');
        const body = validateRequestBody(await c.req.json(), submitClaimSchema, 'Resource claim');
        const scope = normalizeClaimScope(body, body.resourceType);
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        await loadOrganizationForActor(db, actor, body.organizationId, { manage: true });
        await loadResource(db, body.resourceType, body.resourceId);
        const [conflictingLink] = await db.select().from(organizationResourceLinks).where(and(
            eq(organizationResourceLinks.resourceType, body.resourceType),
            eq(organizationResourceLinks.resourceId, body.resourceId),
            isNull(organizationResourceLinks.unlinkedAt),
            ne(organizationResourceLinks.organizationId, body.organizationId),
        )).limit(1);
        if (conflictingLink) throw httpError('This resource is already linked to another organisation.', 409);
        const [existingClaim] = await db.select().from(resourcePublicationPermissions).where(and(
            eq(resourcePublicationPermissions.organizationId, body.organizationId),
            eq(resourcePublicationPermissions.resourceType, body.resourceType),
            eq(resourcePublicationPermissions.resourceId, body.resourceId),
        )).limit(1);
        if (existingClaim) {
            throw httpError(existingClaim.status === 'permission_withdrawn'
                ? 'Use the existing claim to resubmit after a rejection or withdrawal.'
                : 'This resource already has an active claim for the organisation.', 409);
        }
        const claimId = await reserveSerialId(db, 'resourcePublicationPermissions');
        const claimInsert = db.insert(resourcePublicationPermissions).values({
            id: claimId,
            organizationId: body.organizationId,
            resourceType: body.resourceType,
            resourceId: body.resourceId,
            status: 'claim_pending',
            approvedFields: scope.fields,
            allowedUses: scope.uses,
            provenanceNote: scope.evidenceNote,
            termsVersion: ORGANIZATION_PILOT_TERMS_VERSION,
            requestedByUserId: actor.id,
        }).returning();
        const claimSummary = { id: claimId, organizationId: body.organizationId, resourceType: body.resourceType, resourceId: body.resourceId };
        const [, , claimRows] = await executeGuardedClaimBatch(db, [
            buildResourceWriteLockQuery(db, resourceLockType(body.resourceType), body.resourceId),
            buildClaimAvailabilityGuard(db, body.organizationId, body.resourceType, body.resourceId),
            claimInsert,
            buildClaimAuditInsert(db, actor, claimSummary, 'resource_claim_submitted', {
                requestedFields: scope.fields,
                requestedUses: scope.uses,
                evidenceLength: scope.evidenceNote.length,
                ownerAuthorityAttested: true,
            }),
        ], 'resource claim submission', 'This resource claim is no longer available. Refresh and try again.');
        const [claim] = claimRows || [];
        if (!claim) throw httpError('Resource claim could not be created.', 409);
        return c.json({ claim: await claimResponse(db, actor, claim.id) }, 201);
    } catch (error) {
        console.error('submitResourceClaim Error:', error);
        if (error?.code === '23505') return c.json({ error: 'This organisation already has a claim for the resource.' }, 409);
        return c.json({ error: error.message || 'Failed to submit resource claim.' }, error.status || 500);
    }
};

export const resubmitResourceClaim = async (c) => {
    try {
        const actor = c.get('user');
        const claimId = parsePositiveInt(c.req.param('id'), 'claimId');
        const body = validateRequestBody(await c.req.json(), resubmitClaimSchema, 'Resource claim resubmission');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const claim = await loadClaim(db, claimId);
        await loadOrganizationForActor(db, actor, claim.organizationId, { manage: true });
        if (claim.status !== 'permission_withdrawn') throw httpError('Only a rejected or withdrawn claim can be resubmitted.', 409);
        if (claim.revision !== body.expectedRevision) throw httpError('This claim changed before it could be resubmitted. Refresh and try again.', 409);
        const scope = normalizeClaimScope(body, claim.resourceType);
        const updateQuery = db.update(resourcePublicationPermissions).set({
            status: 'claim_pending',
            agreementId: null,
            approvedFields: scope.fields,
            allowedUses: scope.uses,
            provenanceNote: scope.evidenceNote,
            termsVersion: ORGANIZATION_PILOT_TERMS_VERSION,
            requestedByUserId: actor.id,
            reviewedByUserId: null,
            approvedAt: null,
            withdrawnAt: null,
            withdrawalReason: null,
            revision: claim.revision + 1,
            updatedAt: new Date(),
        }).where(and(
            eq(resourcePublicationPermissions.id, claim.id),
            eq(resourcePublicationPermissions.status, 'permission_withdrawn'),
            eq(resourcePublicationPermissions.revision, body.expectedRevision),
        )).returning();
        const [, , , updatedRows] = await executeGuardedClaimBatch(db, [
            buildClaimMutationGuard(db, claim),
            buildResourceWriteLockQuery(db, resourceLockType(claim.resourceType), claim.resourceId),
            buildClaimAvailabilityGuard(db, claim.organizationId, claim.resourceType, claim.resourceId, { excludeClaimId: claim.id }),
            updateQuery,
            buildClaimAuditInsert(db, actor, claim, 'resource_claim_resubmitted', {
                requestedFields: scope.fields,
                requestedUses: scope.uses,
                evidenceLength: scope.evidenceNote.length,
                ownerAuthorityAttested: true,
            }),
        ], 'resource claim resubmission', 'This claim or resource availability changed before it could be resubmitted. Refresh and try again.');
        const [updated] = updatedRows || [];
        if (!updated) throw httpError('This claim changed before it could be resubmitted. Refresh and try again.', 409);
        return c.json({ claim: await claimResponse(db, actor, claim.id) });
    } catch (error) {
        console.error('resubmitResourceClaim Error:', error);
        return c.json({ error: error.message || 'Failed to resubmit resource claim.' }, error.status || 500);
    }
};

async function assertExistingOperatorsBelongToOrganization(db, claim, ownerUserId) {
    const table = staffTable(claim.resourceType);
    const resourceColumn = staffResourceColumn(claim.resourceType);
    const operators = await db.select({ userId: table.userId }).from(table).where(and(
        eq(resourceColumn, claim.resourceId),
        isNull(table.revokedAt),
    ));
    const userIds = [...new Set([...operators.map((row) => Number(row.userId)), Number(ownerUserId)].filter(Boolean))];
    const memberships = await db.select({ userId: organizationAccessMemberships.userId }).from(organizationAccessMemberships).where(and(
        eq(organizationAccessMemberships.organizationId, claim.organizationId),
        inArray(organizationAccessMemberships.userId, userIds),
        isNull(organizationAccessMemberships.revokedAt),
    ));
    const covered = new Set(memberships.map((row) => Number(row.userId)));
    const missing = userIds.filter((id) => !covered.has(id));
    if (missing.length) throw httpError('Existing resource operators must be assigned to the claiming organisation before ownership can be verified.', 409);
    return operators;
}

export const verifyResourceClaimOwner = async (c) => {
    try {
        const actor = c.get('user');
        requireSuperAdmin(actor);
        const claimId = parsePositiveInt(c.req.param('id'), 'claimId');
        const body = validateRequestBody(await c.req.json(), verifyClaimSchema, 'Resource owner verification');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const claim = await loadClaim(db, claimId);
        if (claim.status !== 'claim_pending' || claim.revision !== body.expectedRevision) {
            throw httpError('This pending claim changed before it could be verified. Refresh and try again.', 409);
        }
        await loadResource(db, claim.resourceType, claim.resourceId);
        await loadOrganizationForActor(db, actor, claim.organizationId, { manage: true });
        const [ownerAccess] = await db.select().from(organizationAccessMemberships).where(and(
            eq(organizationAccessMemberships.organizationId, claim.organizationId),
            eq(organizationAccessMemberships.userId, body.ownerUserId),
            isNull(organizationAccessMemberships.revokedAt),
        )).limit(1);
        if (!ownerAccess) throw httpError('The selected Owner must have active access to the claiming organisation.', 409);
        const [conflictingLink] = await db.select().from(organizationResourceLinks).where(and(
            eq(organizationResourceLinks.resourceType, claim.resourceType),
            eq(organizationResourceLinks.resourceId, claim.resourceId),
            isNull(organizationResourceLinks.unlinkedAt),
            ne(organizationResourceLinks.organizationId, claim.organizationId),
        )).limit(1);
        if (conflictingLink) throw httpError('This resource is already linked to another organisation.', 409);
        await assertExistingOperatorsBelongToOrganization(db, claim, body.ownerUserId);
        const [existingLink] = await db.select().from(organizationResourceLinks).where(and(
            eq(organizationResourceLinks.organizationId, claim.organizationId),
            eq(organizationResourceLinks.resourceType, claim.resourceType),
            eq(organizationResourceLinks.resourceId, claim.resourceId),
            isNull(organizationResourceLinks.unlinkedAt),
        )).limit(1);
        const table = staffTable(claim.resourceType);
        const resourceColumn = staffResourceColumn(claim.resourceType);
        const [existingOwnerMembership] = await db.select().from(table).where(and(
            eq(resourceColumn, claim.resourceId),
            eq(table.userId, body.ownerUserId),
            isNull(table.revokedAt),
        )).limit(1);
        const now = new Date();
        const queries = [
            buildClaimMutationGuard(db, claim),
            buildResourceWriteLockQuery(db, resourceLockType(claim.resourceType), claim.resourceId),
            buildResourceLinkAvailabilityGuard(db, claim.organizationId, claim.resourceType, claim.resourceId),
        ];
        if (!existingLink) queries.push(db.insert(organizationResourceLinks).values({
            organizationId: claim.organizationId,
            resourceType: claim.resourceType,
            resourceId: claim.resourceId,
            linkStatus: 'active',
            agreementCoverageStatus: 'unknown',
            linkedByUserId: actor.id,
        }));
        if (existingOwnerMembership) {
            if (existingOwnerMembership.staffRole !== 'owner') queries.push(db.update(table).set({
                staffRole: 'owner', updatedByUserId: actor.id, updatedAt: now,
            }).where(eq(table.id, existingOwnerMembership.id)));
        } else {
            queries.push(db.insert(table).values({
                ...(claim.resourceType === 'hard' ? { hardAssetId: claim.resourceId } : { softAssetId: claim.resourceId }),
                userId: body.ownerUserId,
                staffRole: 'owner',
                createdByUserId: actor.id,
                updatedByUserId: actor.id,
            }));
        }
        queries.push(
            db.update(resourcePublicationPermissions).set({
                status: 'owner_verified', reviewedByUserId: actor.id, approvedAt: now,
                revision: claim.revision + 1, updatedAt: now,
            }).where(and(
                eq(resourcePublicationPermissions.id, claim.id),
                eq(resourcePublicationPermissions.status, 'claim_pending'),
                eq(resourcePublicationPermissions.revision, claim.revision),
            )),
            db.update(resourceTable(claim.resourceType)).set({
                verificationStatus: 'owner_verified', lastVerifiedByUserId: actor.id,
                lastReviewedAt: now, updatedAt: now,
            }).where(eq(resourceTable(claim.resourceType).id, claim.resourceId)),
            db.insert(sensitiveAuditLogs).values({
                actorUserId: actor.id,
                targetUserId: body.ownerUserId,
                actionType: 'resource_claim_owner_verified',
                entityType: 'resource_publication_permission',
                entityId: claim.id,
                resourceType: claim.resourceType,
                resourceId: claim.resourceId,
                organizationId: claim.organizationId,
                metadata: { ownerUserId: body.ownerUserId },
            }),
        );
        await executeGuardedClaimBatch(db, queries, 'resource claim owner verification', 'This claim or resource ownership changed before it could be verified. Refresh and try again.');
        return c.json({ claim: await claimResponse(db, actor, claim.id) });
    } catch (error) {
        console.error('verifyResourceClaimOwner Error:', error);
        return c.json({ error: error.message || 'Failed to verify resource ownership.' }, error.status || 500);
    }
};

function assertPublishingAgreementCandidate(agreement, organizationId) {
    if (!agreement || Number(agreement.organizationId) !== Number(organizationId)) throw httpError('Select an agreement for the claiming organisation.', 409);
    if (agreement.status !== 'active' || agreement.revokedAt || !agreement.approvedAt) throw httpError('The selected agreement is not active and approved.', 409);
    if (agreement.allowedUses?.publicListing !== true || agreement.allowedUses?.externalSharing !== true) {
        throw httpError('The selected agreement does not cover public listing and external sharing.', 409);
    }
}

export const approveResourcePublication = async (c) => {
    try {
        const actor = c.get('user');
        requireSuperAdmin(actor);
        const claimId = parsePositiveInt(c.req.param('id'), 'claimId');
        const body = validateRequestBody(await c.req.json(), publicationApprovalSchema, 'Publication approval');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const claim = await loadClaim(db, claimId);
        if (claim.status !== 'owner_verified' || claim.revision !== body.expectedRevision) {
            throw httpError('This owner-verified claim changed before publication approval. Refresh and try again.', 409);
        }
        const approvedFields = normalizeResourceClaimFields(body.approvedFields, claim.resourceType);
        const approvedUses = normalizeResourceClaimUses(body.allowedUses);
        if (!hasRequestedPublicationScope(approvedFields, approvedUses)) throw httpError('Approve at least one requested field and one requested public use.', 400);
        if (!isPublicationScopeWithinRequest({
            requestedFields: claim.approvedFields,
            requestedUses: normalizeResourceClaimUses(claim.allowedUses),
            approvedFields,
            approvedUses,
        })) throw httpError('Publication approval can narrow but cannot expand the organisation request.', 409);
        const resource = await loadResource(db, claim.resourceType, claim.resourceId);
        const emptyFields = approvedFields.filter((field) => !resourceFieldHasValue(resource, field));
        if (emptyFields.length) throw httpError(`The resource has no current value for: ${emptyFields.join(', ')}. Ask the Owner to supply it before approval.`, 409);
        const [agreement] = await db.select().from(organizationAgreements).where(eq(organizationAgreements.id, body.agreementId)).limit(1);
        assertPublishingAgreementCandidate(agreement, claim.organizationId);
        const [link] = await db.select().from(organizationResourceLinks).where(and(
            eq(organizationResourceLinks.organizationId, claim.organizationId),
            eq(organizationResourceLinks.resourceType, claim.resourceType),
            eq(organizationResourceLinks.resourceId, claim.resourceId),
            eq(organizationResourceLinks.linkStatus, 'active'),
            isNull(organizationResourceLinks.unlinkedAt),
        )).limit(1);
        if (!link) throw httpError('The verified organisation-resource link is missing.', 409);
        const now = new Date();
        await executeGuardedClaimBatch(db, [
            buildClaimMutationGuard(db, claim),
            buildResourceWriteLockQuery(db, resourceLockType(claim.resourceType), claim.resourceId),
            buildPublishingAgreementGuard(db, agreement.id, claim.organizationId),
            db.update(resourcePublicationPermissions).set({
                agreementId: agreement.id,
                status: 'publishing_approved',
                approvedFields,
                allowedUses: approvedUses,
                termsVersion: ORGANIZATION_PILOT_TERMS_VERSION,
                reviewedByUserId: actor.id,
                approvedAt: now,
                withdrawnAt: null,
                withdrawalReason: null,
                revision: claim.revision + 1,
                updatedAt: now,
            }).where(and(
                eq(resourcePublicationPermissions.id, claim.id),
                eq(resourcePublicationPermissions.status, 'owner_verified'),
                eq(resourcePublicationPermissions.revision, claim.revision),
            )),
            db.update(organizationResourceLinks).set({ agreementCoverageStatus: 'covered', updatedAt: now })
                .where(eq(organizationResourceLinks.id, link.id)),
            db.insert(sensitiveAuditLogs).values({
                actorUserId: actor.id,
                actionType: 'resource_publication_approved',
                entityType: 'resource_publication_permission',
                entityId: claim.id,
                resourceType: claim.resourceType,
                resourceId: claim.resourceId,
                organizationId: claim.organizationId,
                metadata: { agreementId: agreement.id, approvedFields, allowedUses: approvedUses },
            }),
        ], 'resource publication approval', 'This claim, resource or agreement changed before publication approval. Refresh and try again.');
        return c.json({ claim: await claimResponse(db, actor, claim.id) });
    } catch (error) {
        console.error('approveResourcePublication Error:', error);
        return c.json({ error: error.message || 'Failed to approve resource publication.' }, error.status || 500);
    }
};

export const rejectResourceClaim = async (c) => {
    try {
        const actor = c.get('user');
        requireSuperAdmin(actor);
        const claimId = parsePositiveInt(c.req.param('id'), 'claimId');
        const body = validateRequestBody(await c.req.json(), reasonSchema, 'Claim rejection');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const claim = await loadClaim(db, claimId);
        if (claim.status !== 'claim_pending' || claim.revision !== body.expectedRevision) throw httpError('This pending claim changed before rejection. Refresh and try again.', 409);
        const now = new Date();
        await executeGuardedClaimBatch(db, [
            buildClaimMutationGuard(db, claim),
            db.update(resourcePublicationPermissions).set({
                status: 'permission_withdrawn', reviewedByUserId: actor.id,
                withdrawnAt: now, withdrawalReason: body.reason,
                revision: claim.revision + 1, updatedAt: now,
            }).where(and(
                eq(resourcePublicationPermissions.id, claim.id),
                eq(resourcePublicationPermissions.status, 'claim_pending'),
                eq(resourcePublicationPermissions.revision, claim.revision),
            )),
            db.insert(sensitiveAuditLogs).values({
                actorUserId: actor.id,
                actionType: 'resource_claim_rejected',
                entityType: 'resource_publication_permission',
                entityId: claim.id,
                resourceType: claim.resourceType,
                resourceId: claim.resourceId,
                organizationId: claim.organizationId,
                metadata: { reasonLength: body.reason.length },
            }),
        ], 'resource claim rejection', 'This claim changed before rejection. Refresh and try again.');
        return c.json({ claim: await claimResponse(db, actor, claim.id) });
    } catch (error) {
        console.error('rejectResourceClaim Error:', error);
        return c.json({ error: error.message || 'Failed to reject resource claim.' }, error.status || 500);
    }
};

export const withdrawResourcePermission = async (c) => {
    try {
        const actor = c.get('user');
        const claimId = parsePositiveInt(c.req.param('id'), 'claimId');
        const body = validateRequestBody(await c.req.json(), reasonSchema, 'Permission withdrawal');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const claim = await loadClaim(db, claimId);
        await loadOrganizationForActor(db, actor, claim.organizationId, { manage: true });
        if (claim.status === 'permission_withdrawn' || claim.revision !== body.expectedRevision) throw httpError('This claim changed before withdrawal. Refresh and try again.', 409);
        const now = new Date();
        await executeGuardedClaimBatch(db, [
            buildClaimMutationGuard(db, claim),
            db.update(resourcePublicationPermissions).set({
                status: 'permission_withdrawn', withdrawnAt: now,
                withdrawalReason: body.reason, revision: claim.revision + 1, updatedAt: now,
            }).where(and(
                eq(resourcePublicationPermissions.id, claim.id),
                eq(resourcePublicationPermissions.revision, claim.revision),
                ne(resourcePublicationPermissions.status, 'permission_withdrawn'),
            )),
            db.insert(sensitiveAuditLogs).values({
                actorUserId: actor.id,
                actionType: 'resource_publication_withdrawn',
                entityType: 'resource_publication_permission',
                entityId: claim.id,
                resourceType: claim.resourceType,
                resourceId: claim.resourceId,
                organizationId: claim.organizationId,
                metadata: { previousStatus: claim.status, reasonLength: body.reason.length },
            }),
        ], 'resource permission withdrawal', 'This claim changed before withdrawal. Refresh and try again.');
        return c.json({ claim: await claimResponse(db, actor, claim.id) });
    } catch (error) {
        console.error('withdrawResourcePermission Error:', error);
        return c.json({ error: error.message || 'Failed to withdraw resource permission.' }, error.status || 500);
    }
};
