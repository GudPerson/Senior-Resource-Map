import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import { getDb } from '../db/index.js';
import { softAssets, softAssetStaffMemberships, users } from '../db/schema.js';
import { ensureBoundarySchema } from '../utils/boundarySchema.js';
import {
    canAssignSoftAssetStaffRole,
    canRevokeSoftAssetStaffMembership,
    formatSoftAssetStaffMember,
    hasSoftAssetStaffAccess,
    loadSoftAssetStaffRows,
    normalizeSoftAssetStaffRole,
} from '../utils/softAssetAccess.js';
import {
    cleanOneLineText,
    optionalOneLineTextSchema,
    parsePositiveInt,
    positiveIntValueSchema,
    validateRequestBody,
} from '../utils/inputValidation.js';
import {
    assertAssetOperatorOrganizationEligibility,
    filterAssetAccessCandidatesByOrganization,
} from '../utils/organizationGuardrails.js';
import { normalizeRole } from '../utils/roles.js';
import { SOFT_ASSET_MODES } from '../utils/softAssetHierarchy.js';
import {
    buildResourceAuditPayload,
    loadResourceAuditOrganizationId,
    safelyRecordAuditLog,
} from '../utils/auditTrail.js';

const addStaffBodySchema = z.object({
    userId: positiveIntValueSchema('userId'),
    staffRole: optionalOneLineTextSchema(40).default('staff'),
});

function httpError(message, status = 400) {
    const err = new Error(message);
    err.status = status;
    return err;
}

function isMissingSoftAssetStaffTableError(error) {
    const message = String(error?.message || '').toLowerCase();
    return error?.code === '42P01' && message.includes('soft_asset_staff_memberships');
}

function handleSoftAssetStaffError(c, err, fallback) {
    if (isMissingSoftAssetStaffTableError(err)) {
        return c.json({
            error: 'Standalone offering access setup is not ready yet. Run the soft-asset staff schema setup before managing access.',
            setupRequired: true,
        }, 503);
    }
    if (
        err?.code === '23505'
        && String(err?.constraint || err?.message || '').includes('soft_asset_staff_memberships_active_user_unique')
    ) {
        return c.json({ error: 'This user already has active access to this offering.' }, 409);
    }
    console.error(fallback, err);
    return c.json({ error: err.message || fallback }, err.status || 500);
}

function normalizeStaffRoleInput(value) {
    const staffRole = normalizeSoftAssetStaffRole(value || 'staff');
    if (!staffRole) throw httpError('Staff role must be Owner or Staff.', 400);
    return staffRole;
}

function canViewSoftAssetAccess(actor, softAsset) {
    if (normalizeRole(actor?.role) === 'super_admin') return true;
    return hasSoftAssetStaffAccess(actor, softAsset?.id, ['owner', 'staff']);
}

function buildAccessPermissions(actor, softAsset) {
    return {
        canAddOwner: canAssignSoftAssetStaffRole(actor, softAsset, 'owner'),
        canAddStaff: canAssignSoftAssetStaffRole(actor, softAsset, 'staff'),
        canRemoveOwner: canRevokeSoftAssetStaffMembership(actor, softAsset, { staffRole: 'owner' }),
        canRemoveStaff: canRevokeSoftAssetStaffMembership(actor, softAsset, { staffRole: 'staff' }),
    };
}

async function loadSoftAssetForAccess(db, softAssetId) {
    const softAsset = await db.query.softAssets.findFirst({
        where: eq(softAssets.id, softAssetId),
        with: { locations: true },
    });
    if (!softAsset || softAsset.isDeleted) throw httpError('Offering was not found.', 404);
    if (
        softAsset.assetMode !== SOFT_ASSET_MODES.STANDALONE
        || softAsset.hostHardAssetId
        || (Array.isArray(softAsset.locations) && softAsset.locations.length > 0)
    ) {
        throw httpError('Linked offerings inherit access from their places. Use the place Access panel.', 400);
    }
    const staff = await loadSoftAssetStaffRows(db, softAsset.id);
    return {
        ...softAsset,
        activeOwnerCount: staff.filter((row) => normalizeSoftAssetStaffRole(row.staffRole) === 'owner').length,
        activeStaffCount: staff.length,
    };
}

async function loadUserById(db, userId) {
    const [row] = await db.select({
        id: users.id,
        username: users.username,
        email: users.email,
        name: users.name,
        role: users.role,
    })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
    return row || null;
}

async function recordSoftAssetAccessAudit(db, actor, softAsset, targetUserId, action, staffRole) {
    const organizationId = await loadResourceAuditOrganizationId(db, 'soft', softAsset.id);
    const payload = buildResourceAuditPayload({
        action,
        resourceType: 'soft',
        resourceId: softAsset.id,
        resourceName: softAsset.name,
        organizationId,
        changedFields: ['access'],
        metadata: { staffRole },
    });
    await safelyRecordAuditLog(db, actor, { ...payload, targetUserId });
}

async function loadActiveStaffMembership(db, softAssetId, membershipId) {
    const [row] = await db.select({
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
            eq(softAssetStaffMemberships.softAssetId, softAssetId),
            eq(softAssetStaffMemberships.id, membershipId),
            isNull(softAssetStaffMemberships.revokedAt),
        ))
        .limit(1);
    return row || null;
}

export const getSoftAssetStaff = async (c) => {
    try {
        const actor = c.get('user');
        const softAssetId = parsePositiveInt(c.req.param('id'), 'offeringId');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const softAsset = await loadSoftAssetForAccess(db, softAssetId);
        if (!canViewSoftAssetAccess(actor, softAsset)) {
            return c.json({ error: 'Offering is outside your allowed access.' }, 403);
        }

        const staff = await loadSoftAssetStaffRows(db, softAsset.id);
        return c.json({
            asset: {
                id: softAsset.id,
                name: softAsset.name,
                assetMode: softAsset.assetMode || SOFT_ASSET_MODES.STANDALONE,
            },
            permissions: buildAccessPermissions(actor, softAsset),
            staff: staff.map(formatSoftAssetStaffMember),
            setupRequired: false,
        });
    } catch (err) {
        return handleSoftAssetStaffError(c, err, 'Failed to load offering access.');
    }
};

export const getSoftAssetStaffCandidates = async (c) => {
    try {
        const actor = c.get('user');
        const softAssetId = parsePositiveInt(c.req.param('id'), 'offeringId');
        const query = cleanOneLineText(c.req.query('q') || '', 80).toLowerCase();
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const softAsset = await loadSoftAssetForAccess(db, softAssetId);
        if (!canAssignSoftAssetStaffRole(actor, softAsset, 'staff') && !canAssignSoftAssetStaffRole(actor, softAsset, 'owner')) {
            return c.json({ error: 'Only Super Admins and offering Owners can add offering access.' }, 403);
        }

        const activeStaff = await loadSoftAssetStaffRows(db, softAsset.id);
        const activeUserIds = new Set(activeStaff.map((row) => Number(row.userId)));

        const rows = await db.select({
            id: users.id,
            username: users.username,
            email: users.email,
            name: users.name,
            role: users.role,
        })
            .from(users)
            .limit(200);

        const baseCandidates = rows
            .filter((row) => !activeUserIds.has(Number(row.id)))
            .filter((row) => {
                if (!query) return true;
                const haystack = `${row.name || ''} ${row.username || ''} ${row.email || ''}`.toLowerCase();
                return haystack.includes(query);
            })
            .slice(0, 120);
        const eligibleCandidates = await filterAssetAccessCandidatesByOrganization(db, 'soft', softAsset.id, baseCandidates);
        const candidates = eligibleCandidates
            .slice(0, 50)
            .map((row) => ({
                id: row.id,
                name: row.name,
                username: row.username,
                email: row.email,
                role: row.role,
            }));

        return c.json({ candidates });
    } catch (err) {
        return handleSoftAssetStaffError(c, err, 'Failed to load offering access candidates.');
    }
};

export const addSoftAssetStaff = async (c) => {
    try {
        const actor = c.get('user');
        const softAssetId = parsePositiveInt(c.req.param('id'), 'offeringId');
        const body = validateRequestBody(await c.req.json(), addStaffBodySchema, 'Offering access member');
        const staffRole = normalizeStaffRoleInput(body.staffRole || 'staff');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const softAsset = await loadSoftAssetForAccess(db, softAssetId);
        if (!canAssignSoftAssetStaffRole(actor, softAsset, staffRole)) {
            return c.json({
                error: staffRole === 'owner'
                    ? 'Only Super Admins and offering Owners can add offering Owners.'
                    : 'Only Super Admins and offering Owners can add offering Staff.',
            }, 403);
        }

        const targetUser = await loadUserById(db, body.userId);
        if (!targetUser) throw httpError('User was not found.', 404);
        await assertAssetOperatorOrganizationEligibility(db, 'soft', softAsset.id, targetUser.id);

        const [existingActive] = await db.select({ id: softAssetStaffMemberships.id })
            .from(softAssetStaffMemberships)
            .where(and(
                eq(softAssetStaffMemberships.softAssetId, softAsset.id),
                eq(softAssetStaffMemberships.userId, targetUser.id),
                isNull(softAssetStaffMemberships.revokedAt),
            ))
            .limit(1);
        if (existingActive) throw httpError('This user already has active access to this offering.', 409);

        const [membership] = await db.insert(softAssetStaffMemberships).values({
            softAssetId: softAsset.id,
            userId: targetUser.id,
            staffRole,
            createdByUserId: actor.id,
            updatedByUserId: actor.id,
        }).returning();

        const row = await loadActiveStaffMembership(db, softAsset.id, membership.id);
        await recordSoftAssetAccessAudit(db, actor, softAsset, targetUser.id, 'access_added', staffRole);
        return c.json({ staffMember: formatSoftAssetStaffMember(row) }, 201);
    } catch (err) {
        return handleSoftAssetStaffError(c, err, 'Failed to add offering access.');
    }
};

export const revokeSoftAssetStaff = async (c) => {
    try {
        const actor = c.get('user');
        const softAssetId = parsePositiveInt(c.req.param('id'), 'offeringId');
        const membershipId = parsePositiveInt(c.req.param('membershipId'), 'membershipId');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const softAsset = await loadSoftAssetForAccess(db, softAssetId);
        const membership = await loadActiveStaffMembership(db, softAsset.id, membershipId);
        if (!membership) throw httpError('Offering access membership was not found.', 404);

        if (!canRevokeSoftAssetStaffMembership(actor, softAsset, membership)) {
            return c.json({ error: 'Only Super Admins and offering Owners can remove offering access, and the final Owner cannot be removed.' }, 403);
        }

        await db.update(softAssetStaffMemberships)
            .set({ revokedAt: new Date(), updatedByUserId: actor.id, updatedAt: new Date() })
            .where(eq(softAssetStaffMemberships.id, membership.id));

        await recordSoftAssetAccessAudit(db, actor, softAsset, membership.userId, 'access_revoked', membership.staffRole);
        return c.json({ success: true });
    } catch (err) {
        return handleSoftAssetStaffError(c, err, 'Failed to revoke offering access.');
    }
};
