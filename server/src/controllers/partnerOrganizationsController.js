import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import { getDb } from '../db/index.js';
import { partnerStaffMemberships, users } from '../db/schema.js';
import { ensureBoundarySchema } from '../utils/boundarySchema.js';
import {
    canAdminManagePartnerOrganization,
    formatPartnerOrganization,
    formatPartnerStaffMember,
    handoverPartnerOrganizationOwnerMemberships,
    isMissingPartnerOrganizationBridgeTableError,
    listPartnerOrganizationsForActor,
    loadPartnerOrganization,
    logPartnerStaffEvent,
    normalizeStaffRoleInput,
    partnerOrganizationError,
    partnerStaffMembershipCanChangeRole,
    partnerStaffMembershipCanRevoke,
} from '../utils/partnerOrganizations.js';
import {
    cleanOneLineText,
    optionalOneLineTextSchema,
    parsePositiveInt,
    positiveIntValueSchema,
    validateRequestBody,
} from '../utils/inputValidation.js';

const addStaffBodySchema = z.object({
    userId: positiveIntValueSchema('userId'),
    staffRole: optionalOneLineTextSchema(40).default('editor'),
});

const updateStaffRoleBodySchema = z.object({
    staffRole: optionalOneLineTextSchema(40).default('editor'),
});

const handoverBodySchema = z.object({
    newOwnerUserId: positiveIntValueSchema('newOwnerUserId'),
});

function httpError(message, status = 400) {
    const err = new Error(message);
    err.status = status;
    return err;
}

function handlePartnerOrganizationError(c, err, fallback) {
    if (isMissingPartnerOrganizationBridgeTableError(err)) {
        return c.json({
            error: 'Partner staff setup is not ready yet. Run the partner staff schema setup before managing organisation staff.',
            setupRequired: true,
        }, 503);
    }
    if (
        err?.code === '23505'
        && String(err?.constraint || err?.message || '').includes('partner_staff_memberships_active_owner_unique')
    ) {
        return c.json({
            error: 'This partner organisation already has an active Owner. Refresh and try the handover again.',
        }, 409);
    }
    console.error(fallback, err);
    return c.json({ error: err.message || fallback }, err.status || 500);
}

async function loadManageableOrganization(db, actor, organizationId) {
    const organization = await loadPartnerOrganization(db, organizationId);
    if (!organization) throw httpError('Partner organisation was not found.', 404);
    if (!canAdminManagePartnerOrganization(actor, organization)) {
        throw httpError('Partner organisation is outside your allowed scope.', 403);
    }
    return organization;
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

async function loadActiveStaffMembership(db, organizationId, membershipId) {
    const [row] = await db.select({
        id: partnerStaffMemberships.id,
        organizationId: partnerStaffMemberships.organizationId,
        userId: partnerStaffMemberships.userId,
        staffRole: partnerStaffMemberships.staffRole,
        createdAt: partnerStaffMemberships.createdAt,
        updatedAt: partnerStaffMemberships.updatedAt,
        userName: users.name,
        username: users.username,
        email: users.email,
        userRole: users.role,
    })
        .from(partnerStaffMemberships)
        .innerJoin(users, eq(partnerStaffMemberships.userId, users.id))
        .where(and(
            eq(partnerStaffMemberships.organizationId, organizationId),
            eq(partnerStaffMemberships.id, membershipId),
            isNull(partnerStaffMemberships.revokedAt),
        ))
        .limit(1);
    return row || null;
}

async function listActiveStaffRows(db, organizationId) {
    return db.select({
        id: partnerStaffMemberships.id,
        organizationId: partnerStaffMemberships.organizationId,
        userId: partnerStaffMemberships.userId,
        staffRole: partnerStaffMemberships.staffRole,
        createdAt: partnerStaffMemberships.createdAt,
        updatedAt: partnerStaffMemberships.updatedAt,
        userName: users.name,
        username: users.username,
        email: users.email,
        userRole: users.role,
    })
        .from(partnerStaffMemberships)
        .innerJoin(users, eq(partnerStaffMemberships.userId, users.id))
        .where(and(
            eq(partnerStaffMemberships.organizationId, organizationId),
            isNull(partnerStaffMemberships.revokedAt),
        ));
}

export const listPartnerOrganizations = async (c) => {
    try {
        const actor = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const organizations = await listPartnerOrganizationsForActor(db, actor);
        return c.json({
            organizations: organizations.map(formatPartnerOrganization),
            setupRequired: false,
        });
    } catch (err) {
        if (isMissingPartnerOrganizationBridgeTableError(err)) {
            return c.json({
                organizations: [],
                setupRequired: true,
                message: 'Partner staff setup is not ready yet. Run the partner staff schema setup before adding staff access.',
            });
        }
        return handlePartnerOrganizationError(c, err, 'Failed to list partner organisations.');
    }
};

export const getPartnerOrganizationStaff = async (c) => {
    try {
        const actor = c.get('user');
        const organizationId = parsePositiveInt(c.req.param('id'), 'organizationId');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const organization = await loadManageableOrganization(db, actor, organizationId);
        const staff = await listActiveStaffRows(db, organization.id);
        return c.json({
            organization: formatPartnerOrganization(organization),
            staff: staff.map(formatPartnerStaffMember),
        });
    } catch (err) {
        return handlePartnerOrganizationError(c, err, 'Failed to load partner staff.');
    }
};

export const getPartnerOrganizationStaffCandidates = async (c) => {
    try {
        const actor = c.get('user');
        const organizationId = parsePositiveInt(c.req.param('id'), 'organizationId');
        const query = cleanOneLineText(c.req.query('q') || '', 80).toLowerCase();
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const organization = await loadManageableOrganization(db, actor, organizationId);
        const activeStaff = await listActiveStaffRows(db, organization.id);
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

        const candidates = rows
            .filter((row) => !activeUserIds.has(Number(row.id)))
            .filter((row) => {
                if (!query) return true;
                const haystack = `${row.name || ''} ${row.username || ''} ${row.email || ''}`.toLowerCase();
                return haystack.includes(query);
            })
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
        return handlePartnerOrganizationError(c, err, 'Failed to load staff candidates.');
    }
};

export const addPartnerOrganizationStaff = async (c) => {
    try {
        const actor = c.get('user');
        const organizationId = parsePositiveInt(c.req.param('id'), 'organizationId');
        const body = validateRequestBody(await c.req.json(), addStaffBodySchema, 'Staff member');
        const staffRole = normalizeStaffRoleInput(body.staffRole || 'editor');
        if (staffRole === 'owner') {
            throw partnerOrganizationError('Use owner handover to make someone the Owner.', 400);
        }

        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const organization = await loadManageableOrganization(db, actor, organizationId);
        const targetUser = await loadUserById(db, body.userId);
        if (!targetUser) throw httpError('User was not found.', 404);

        const [existingActive] = await db.select({ id: partnerStaffMemberships.id })
            .from(partnerStaffMemberships)
            .where(and(
                eq(partnerStaffMemberships.organizationId, organization.id),
                eq(partnerStaffMemberships.userId, targetUser.id),
                isNull(partnerStaffMemberships.revokedAt),
            ))
            .limit(1);
        if (existingActive) throw httpError('This user already has active staff access.', 409);

        const [membership] = await db.insert(partnerStaffMemberships).values({
            organizationId: organization.id,
            userId: targetUser.id,
            staffRole,
            createdByUserId: actor.id,
            updatedByUserId: actor.id,
        }).returning();

        await logPartnerStaffEvent(db, {
            organizationId: organization.id,
            actorUserId: actor.id,
            targetUserId: targetUser.id,
            eventType: 'staff_added',
            metadata: { staffRole },
        });

        const row = await loadActiveStaffMembership(db, organization.id, membership.id);
        return c.json({ staffMember: formatPartnerStaffMember(row) }, 201);
    } catch (err) {
        return handlePartnerOrganizationError(c, err, 'Failed to add partner staff.');
    }
};

export const updatePartnerOrganizationStaffRole = async (c) => {
    try {
        const actor = c.get('user');
        const organizationId = parsePositiveInt(c.req.param('id'), 'organizationId');
        const membershipId = parsePositiveInt(c.req.param('membershipId'), 'membershipId');
        const body = validateRequestBody(await c.req.json(), updateStaffRoleBodySchema, 'Staff role');
        const staffRole = normalizeStaffRoleInput(body.staffRole || 'editor');

        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const organization = await loadManageableOrganization(db, actor, organizationId);
        const membership = await loadActiveStaffMembership(db, organization.id, membershipId);
        if (!membership) throw httpError('Staff membership was not found.', 404);

        const allowed = partnerStaffMembershipCanChangeRole(membership, staffRole);
        if (!allowed.ok) throw partnerOrganizationError(allowed.message, 400);

        await db.update(partnerStaffMemberships)
            .set({ staffRole, updatedByUserId: actor.id, updatedAt: new Date() })
            .where(eq(partnerStaffMemberships.id, membership.id));

        await logPartnerStaffEvent(db, {
            organizationId: organization.id,
            actorUserId: actor.id,
            targetUserId: membership.userId,
            eventType: 'staff_role_changed',
            metadata: { staffRole },
        });

        const row = await loadActiveStaffMembership(db, organization.id, membership.id);
        return c.json({ staffMember: formatPartnerStaffMember(row) });
    } catch (err) {
        return handlePartnerOrganizationError(c, err, 'Failed to update partner staff role.');
    }
};

export const revokePartnerOrganizationStaff = async (c) => {
    try {
        const actor = c.get('user');
        const organizationId = parsePositiveInt(c.req.param('id'), 'organizationId');
        const membershipId = parsePositiveInt(c.req.param('membershipId'), 'membershipId');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const organization = await loadManageableOrganization(db, actor, organizationId);
        const membership = await loadActiveStaffMembership(db, organization.id, membershipId);
        if (!membership) throw httpError('Staff membership was not found.', 404);

        const allowed = partnerStaffMembershipCanRevoke(membership);
        if (!allowed.ok) throw partnerOrganizationError(allowed.message, 400);

        await db.update(partnerStaffMemberships)
            .set({ revokedAt: new Date(), updatedByUserId: actor.id, updatedAt: new Date() })
            .where(eq(partnerStaffMemberships.id, membership.id));

        await logPartnerStaffEvent(db, {
            organizationId: organization.id,
            actorUserId: actor.id,
            targetUserId: membership.userId,
            eventType: 'staff_revoked',
            metadata: { staffRole: membership.staffRole },
        });

        return c.json({ success: true });
    } catch (err) {
        return handlePartnerOrganizationError(c, err, 'Failed to revoke partner staff.');
    }
};

export const handoverPartnerOrganizationOwner = async (c) => {
    try {
        const actor = c.get('user');
        const organizationId = parsePositiveInt(c.req.param('id'), 'organizationId');
        const body = validateRequestBody(await c.req.json(), handoverBodySchema, 'Owner handover');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const organization = await loadManageableOrganization(db, actor, organizationId);
        const targetUser = await loadUserById(db, body.newOwnerUserId);
        if (!targetUser) throw httpError('New owner user was not found.', 404);

        await handoverPartnerOrganizationOwnerMemberships(db, {
            organizationId: organization.id,
            targetUserId: targetUser.id,
            actorUserId: actor.id,
        });

        await logPartnerStaffEvent(db, {
            organizationId: organization.id,
            actorUserId: actor.id,
            targetUserId: targetUser.id,
            eventType: 'owner_handover',
            metadata: { previousLegacyPartnerUserId: organization.legacyPartnerUserId },
        });

        const staff = await listActiveStaffRows(db, organization.id);
        return c.json({
            organization: formatPartnerOrganization(organization),
            staff: staff.map(formatPartnerStaffMember),
        });
    } catch (err) {
        return handlePartnerOrganizationError(c, err, 'Failed to hand over partner owner.');
    }
};
