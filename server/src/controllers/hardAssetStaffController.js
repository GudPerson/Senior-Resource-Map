import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import { getDb } from '../db/index.js';
import { hardAssets, hardAssetStaffMemberships, users } from '../db/schema.js';
import { ensureBoundarySchema } from '../utils/boundarySchema.js';
import {
    canAssignHardAssetStaffRole,
    canRevokeHardAssetStaffMembership,
    formatHardAssetStaffMember,
    hasHardAssetStaffAccess,
    loadHardAssetStaffRows,
    normalizeHardAssetStaffRole,
} from '../utils/hardAssetStaff.js';
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

const addStaffBodySchema = z.object({
    userId: positiveIntValueSchema('userId'),
    staffRole: optionalOneLineTextSchema(40).default('staff'),
});

const updateStaffRoleBodySchema = z.object({
    staffRole: optionalOneLineTextSchema(40).default('staff'),
});

function httpError(message, status = 400) {
    const err = new Error(message);
    err.status = status;
    return err;
}

function isMissingHardAssetStaffTableError(error) {
    const message = String(error?.message || '').toLowerCase();
    return error?.code === '42P01' && message.includes('hard_asset_staff_memberships');
}

function handleHardAssetStaffError(c, err, fallback) {
    if (isMissingHardAssetStaffTableError(err)) {
        return c.json({
            error: 'Asset access setup is not ready yet. Run the hard-asset staff schema setup before managing access.',
            setupRequired: true,
        }, 503);
    }
    if (
        err?.code === '23505'
        && String(err?.constraint || err?.message || '').includes('hard_asset_staff_memberships_active_user_unique')
    ) {
        return c.json({ error: 'This user already has active access to this place.' }, 409);
    }
    console.error(fallback, err);
    return c.json({ error: err.message || fallback }, err.status || 500);
}

function normalizeStaffRoleInput(value) {
    const staffRole = normalizeHardAssetStaffRole(value || 'staff');
    if (!staffRole) throw httpError('Staff role must be Owner or Staff.', 400);
    return staffRole;
}

function canViewHardAssetAccess(actor, hardAsset) {
    const role = normalizeRole(actor?.role);
    if (role === 'super_admin') return true;
    return hasHardAssetStaffAccess(actor, hardAsset?.id, ['owner', 'staff']);
}

function buildAccessPermissions(actor, hardAsset) {
    return {
        canAddOwner: canAssignHardAssetStaffRole(actor, hardAsset, 'owner'),
        canAddStaff: canAssignHardAssetStaffRole(actor, hardAsset, 'staff'),
        canRemoveOwner: canRevokeHardAssetStaffMembership(actor, hardAsset, { staffRole: 'owner' }),
        canRemoveStaff: canRevokeHardAssetStaffMembership(actor, hardAsset, { staffRole: 'staff' }),
    };
}

async function loadHardAssetForAccess(db, hardAssetId) {
    const hardAsset = await db.query.hardAssets.findFirst({
        where: eq(hardAssets.id, hardAssetId),
        with: {
            partner: {
                columns: {
                    id: true,
                    name: true,
                    role: true,
                    managerUserId: true,
                },
            },
        },
    });
    if (!hardAsset || hardAsset.isDeleted) throw httpError('Place was not found.', 404);
    const staff = await loadHardAssetStaffRows(db, hardAsset.id);
    return {
        ...hardAsset,
        activeOwnerCount: staff.filter((row) => normalizeHardAssetStaffRole(row.staffRole) === 'owner').length,
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

async function loadActiveStaffMembership(db, hardAssetId, membershipId) {
    const [row] = await db.select({
        id: hardAssetStaffMemberships.id,
        hardAssetId: hardAssetStaffMemberships.hardAssetId,
        userId: hardAssetStaffMemberships.userId,
        staffRole: hardAssetStaffMemberships.staffRole,
        createdAt: hardAssetStaffMemberships.createdAt,
        updatedAt: hardAssetStaffMemberships.updatedAt,
        userName: users.name,
        username: users.username,
        email: users.email,
        userRole: users.role,
    })
        .from(hardAssetStaffMemberships)
        .innerJoin(users, eq(hardAssetStaffMemberships.userId, users.id))
        .where(and(
            eq(hardAssetStaffMemberships.hardAssetId, hardAssetId),
            eq(hardAssetStaffMemberships.id, membershipId),
            isNull(hardAssetStaffMemberships.revokedAt),
        ))
        .limit(1);
    return row || null;
}

export const getHardAssetStaff = async (c) => {
    try {
        const actor = c.get('user');
        const hardAssetId = parsePositiveInt(c.req.param('id'), 'placeId');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const hardAsset = await loadHardAssetForAccess(db, hardAssetId);
        if (!canViewHardAssetAccess(actor, hardAsset)) {
            return c.json({ error: 'Place is outside your allowed scope.' }, 403);
        }

        const staff = await loadHardAssetStaffRows(db, hardAsset.id);
        return c.json({
            asset: {
                id: hardAsset.id,
                name: hardAsset.name,
                subregionId: hardAsset.subregionId,
                ownershipMode: hardAsset.partnerId ? 'partner' : 'system',
                partnerName: hardAsset.partner?.name || null,
            },
            permissions: buildAccessPermissions(actor, hardAsset),
            staff: staff.map(formatHardAssetStaffMember),
            setupRequired: false,
        });
    } catch (err) {
        return handleHardAssetStaffError(c, err, 'Failed to load asset access.');
    }
};

export const getHardAssetStaffCandidates = async (c) => {
    try {
        const actor = c.get('user');
        const hardAssetId = parsePositiveInt(c.req.param('id'), 'placeId');
        const query = cleanOneLineText(c.req.query('q') || '', 80).toLowerCase();
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const hardAsset = await loadHardAssetForAccess(db, hardAssetId);
        if (!canAssignHardAssetStaffRole(actor, hardAsset, 'staff') && !canAssignHardAssetStaffRole(actor, hardAsset, 'owner')) {
            return c.json({ error: 'Only Super Admins and asset Owners can add asset access.' }, 403);
        }

        const activeStaff = await loadHardAssetStaffRows(db, hardAsset.id);
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
        const eligibleCandidates = await filterAssetAccessCandidatesByOrganization(db, 'hard', hardAsset.id, baseCandidates);
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
        return handleHardAssetStaffError(c, err, 'Failed to load asset access candidates.');
    }
};

export const addHardAssetStaff = async (c) => {
    try {
        const actor = c.get('user');
        const hardAssetId = parsePositiveInt(c.req.param('id'), 'placeId');
        const body = validateRequestBody(await c.req.json(), addStaffBodySchema, 'Asset access member');
        const staffRole = normalizeStaffRoleInput(body.staffRole || 'staff');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const hardAsset = await loadHardAssetForAccess(db, hardAssetId);
        if (!canAssignHardAssetStaffRole(actor, hardAsset, staffRole)) {
            return c.json({
                error: staffRole === 'owner'
                    ? 'Only Super Admins and asset Owners can add asset Owners.'
                    : 'Only Super Admins and asset Owners can add asset Staff.',
            }, 403);
        }

        const targetUser = await loadUserById(db, body.userId);
        if (!targetUser) throw httpError('User was not found.', 404);
        await assertAssetOperatorOrganizationEligibility(db, 'hard', hardAsset.id, targetUser.id);

        const [existingActive] = await db.select({ id: hardAssetStaffMemberships.id })
            .from(hardAssetStaffMemberships)
            .where(and(
                eq(hardAssetStaffMemberships.hardAssetId, hardAsset.id),
                eq(hardAssetStaffMemberships.userId, targetUser.id),
                isNull(hardAssetStaffMemberships.revokedAt),
            ))
            .limit(1);
        if (existingActive) throw httpError('This user already has active access to this place.', 409);

        const [membership] = await db.insert(hardAssetStaffMemberships).values({
            hardAssetId: hardAsset.id,
            userId: targetUser.id,
            staffRole,
            createdByUserId: actor.id,
            updatedByUserId: actor.id,
        }).returning();

        const row = await loadActiveStaffMembership(db, hardAsset.id, membership.id);
        return c.json({ staffMember: formatHardAssetStaffMember(row) }, 201);
    } catch (err) {
        return handleHardAssetStaffError(c, err, 'Failed to add asset access.');
    }
};

export const updateHardAssetStaffRole = async (c) => {
    try {
        const actor = c.get('user');
        const hardAssetId = parsePositiveInt(c.req.param('id'), 'placeId');
        const membershipId = parsePositiveInt(c.req.param('membershipId'), 'membershipId');
        const body = validateRequestBody(await c.req.json(), updateStaffRoleBodySchema, 'Asset access role');
        const staffRole = normalizeStaffRoleInput(body.staffRole || 'staff');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const hardAsset = await loadHardAssetForAccess(db, hardAssetId);
        const membership = await loadActiveStaffMembership(db, hardAsset.id, membershipId);
        if (!membership) throw httpError('Asset access membership was not found.', 404);

        if (
            !canRevokeHardAssetStaffMembership(actor, hardAsset, membership)
            || !canAssignHardAssetStaffRole(actor, hardAsset, staffRole)
        ) {
            return c.json({ error: 'Only Super Admins and asset Owners can change asset access.' }, 403);
        }

        await db.update(hardAssetStaffMemberships)
            .set({ staffRole, updatedByUserId: actor.id, updatedAt: new Date() })
            .where(eq(hardAssetStaffMemberships.id, membership.id));

        const row = await loadActiveStaffMembership(db, hardAsset.id, membership.id);
        return c.json({ staffMember: formatHardAssetStaffMember(row) });
    } catch (err) {
        return handleHardAssetStaffError(c, err, 'Failed to update asset access role.');
    }
};

export const revokeHardAssetStaff = async (c) => {
    try {
        const actor = c.get('user');
        const hardAssetId = parsePositiveInt(c.req.param('id'), 'placeId');
        const membershipId = parsePositiveInt(c.req.param('membershipId'), 'membershipId');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const hardAsset = await loadHardAssetForAccess(db, hardAssetId);
        const membership = await loadActiveStaffMembership(db, hardAsset.id, membershipId);
        if (!membership) throw httpError('Asset access membership was not found.', 404);

        if (!canRevokeHardAssetStaffMembership(actor, hardAsset, membership)) {
            return c.json({ error: 'Only Super Admins and asset Owners can remove asset access, and the final Owner cannot be removed.' }, 403);
        }

        await db.update(hardAssetStaffMemberships)
            .set({ revokedAt: new Date(), updatedByUserId: actor.id, updatedAt: new Date() })
            .where(eq(hardAssetStaffMemberships.id, membership.id));

        return c.json({ success: true });
    } catch (err) {
        return handleHardAssetStaffError(c, err, 'Failed to revoke asset access.');
    }
};
