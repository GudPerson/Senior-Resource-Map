import { and, eq, inArray, isNull, sql } from 'drizzle-orm';

import { partnerOrganizations, partnerStaffEvents, partnerStaffMemberships, users, userSubregions } from '../db/schema.js';
import { normalizeRole } from './roles.js';

const PARTNER_ORGANIZATION_BRIDGE_TABLES = [
    'partner_organizations',
    'partner_staff_memberships',
    'partner_staff_events',
];

export function partnerOrganizationError(message, status = 400) {
    const err = new Error(message);
    err.status = status;
    return err;
}

export function isMissingPartnerOrganizationBridgeTableError(error) {
    const message = String(error?.message || '').toLowerCase();
    return error?.code === '42P01'
        && PARTNER_ORGANIZATION_BRIDGE_TABLES.some((tableName) => message.includes(tableName));
}

export function normalizeStaffRoleInput(value) {
    const role = String(value || '').trim().toLowerCase();
    if (role === 'owner' || role === 'editor') return role;
    throw partnerOrganizationError('Staff role must be Owner or Editor.', 400);
}

export function partnerStaffMembershipCanChangeRole(membership, nextRole) {
    const currentRole = String(membership?.staffRole || '').trim().toLowerCase();
    const normalizedNextRole = String(nextRole || '').trim().toLowerCase();

    if (currentRole === 'owner') {
        return { ok: false, message: 'Use owner handover before changing the current Owner.' };
    }

    if (normalizedNextRole === 'owner') {
        return { ok: false, message: 'Use owner handover to make someone the Owner.' };
    }

    return { ok: true };
}

export function partnerStaffMembershipCanRevoke(membership) {
    const currentRole = String(membership?.staffRole || '').trim().toLowerCase();
    if (currentRole === 'owner') {
        return { ok: false, message: 'Use owner handover before removing the current Owner.' };
    }
    return { ok: true };
}

export function formatPartnerOrganization(row) {
    if (!row) return null;
    return {
        id: row.id,
        legacyPartnerUserId: row.legacyPartnerUserId,
        name: row.name || row.legacyPartnerName || row.legacyPartnerUsername || `Partner organisation ${row.id}`,
        createdAt: row.createdAt || null,
        updatedAt: row.updatedAt || null,
        legacyPartner: row.legacyPartnerUserId ? {
            id: row.legacyPartnerUserId,
            name: row.legacyPartnerName || null,
            username: row.legacyPartnerUsername || null,
            managerUserId: row.legacyPartnerManagerUserId || null,
            subregionIds: Array.isArray(row.legacyPartnerSubregionIds) ? row.legacyPartnerSubregionIds : [],
        } : null,
    };
}

export function formatPartnerStaffMember(row) {
    if (!row) return null;
    return {
        id: row.id,
        organizationId: row.organizationId,
        userId: row.userId,
        staffRole: row.staffRole,
        createdAt: row.createdAt || null,
        updatedAt: row.updatedAt || null,
        user: {
            id: row.userId,
            name: row.userName || null,
            username: row.username || null,
            email: row.email || null,
            role: row.userRole || null,
        },
    };
}

export function canAdminManagePartnerOrganization(actor, organization) {
    const actorRole = normalizeRole(actor?.role);
    if (!actor || !organization) return false;
    if (actorRole === 'super_admin') return true;
    if (actorRole !== 'regional_admin') return false;

    const partnerManagerId = Number(organization.legacyPartnerManagerUserId);
    if (partnerManagerId !== Number(actor.id)) return false;

    const actorSubregions = Array.isArray(actor.subregionIds) ? actor.subregionIds.map(Number) : [];
    const orgSubregions = Array.isArray(organization.legacyPartnerSubregionIds)
        ? organization.legacyPartnerSubregionIds.map(Number)
        : [];
    return orgSubregions.some((subregionId) => actorSubregions.includes(subregionId));
}

function toInt(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : null;
}

function organizationNameForUser(user) {
    return String(user?.name || user?.username || '').trim() || `Partner ${user?.id}`;
}

export async function loadPartnerOrganization(db, organizationId) {
    const parsedId = toInt(organizationId);
    if (!parsedId) return null;

    const [row] = await db.select({
        id: partnerOrganizations.id,
        legacyPartnerUserId: partnerOrganizations.legacyPartnerUserId,
        name: partnerOrganizations.name,
        createdAt: partnerOrganizations.createdAt,
        updatedAt: partnerOrganizations.updatedAt,
        legacyPartnerName: users.name,
        legacyPartnerUsername: users.username,
        legacyPartnerManagerUserId: users.managerUserId,
    })
        .from(partnerOrganizations)
        .leftJoin(users, eq(partnerOrganizations.legacyPartnerUserId, users.id))
        .where(eq(partnerOrganizations.id, parsedId))
        .limit(1);

    if (!row) return null;

    const subregionRows = row.legacyPartnerUserId
        ? await db.select({ subregionId: userSubregions.subregionId })
            .from(userSubregions)
            .where(eq(userSubregions.userId, row.legacyPartnerUserId))
        : [];

    return {
        id: row.id,
        legacyPartnerUserId: row.legacyPartnerUserId,
        name: row.name,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        legacyPartnerName: row.legacyPartnerName,
        legacyPartnerUsername: row.legacyPartnerUsername,
        legacyPartnerManagerUserId: row.legacyPartnerManagerUserId,
        legacyPartnerSubregionIds: subregionRows.map((item) => item.subregionId),
    };
}

export async function listPartnerOrganizationsForActor(db, actor) {
    const actorRole = normalizeRole(actor?.role);
    const rows = await db.select({
        id: partnerOrganizations.id,
        legacyPartnerUserId: partnerOrganizations.legacyPartnerUserId,
        name: partnerOrganizations.name,
        createdAt: partnerOrganizations.createdAt,
        updatedAt: partnerOrganizations.updatedAt,
        legacyPartnerName: users.name,
        legacyPartnerUsername: users.username,
        legacyPartnerManagerUserId: users.managerUserId,
    })
        .from(partnerOrganizations)
        .leftJoin(users, eq(partnerOrganizations.legacyPartnerUserId, users.id));

    const legacyPartnerIds = [...new Set(rows.map((row) => toInt(row.legacyPartnerUserId)).filter(Boolean))];
    const subregionsByPartner = new Map();
    if (legacyPartnerIds.length) {
        const subregionRows = await db.select({
            userId: userSubregions.userId,
            subregionId: userSubregions.subregionId,
        })
            .from(userSubregions)
            .where(inArray(userSubregions.userId, legacyPartnerIds));

        for (const row of subregionRows) {
            const partnerId = toInt(row.userId);
            if (!partnerId) continue;
            if (!subregionsByPartner.has(partnerId)) subregionsByPartner.set(partnerId, []);
            subregionsByPartner.get(partnerId).push(row.subregionId);
        }
    }

    return rows
        .map((row) => ({
            ...row,
            legacyPartnerSubregionIds: subregionsByPartner.get(toInt(row.legacyPartnerUserId)) || [],
        }))
        .filter((row) => actorRole === 'super_admin' || canAdminManagePartnerOrganization(actor, row));
}

export async function ensurePartnerOrganizationForLegacyPartner(db, partnerUserId, actorUserId = null) {
    const parsedPartnerId = toInt(partnerUserId);
    if (!parsedPartnerId) return null;

    const [partnerUser] = await db.select({
        id: users.id,
        username: users.username,
        name: users.name,
        role: users.role,
        managerUserId: users.managerUserId,
    }).from(users).where(eq(users.id, parsedPartnerId)).limit(1);

    if (!partnerUser || normalizeRole(partnerUser.role) !== 'partner') return null;

    let [organization] = await db.select()
        .from(partnerOrganizations)
        .where(eq(partnerOrganizations.legacyPartnerUserId, parsedPartnerId))
        .limit(1);

    if (!organization) {
        [organization] = await db.insert(partnerOrganizations).values({
            legacyPartnerUserId: parsedPartnerId,
            name: organizationNameForUser(partnerUser),
            createdByUserId: actorUserId || partnerUser.managerUserId || null,
            updatedByUserId: actorUserId || partnerUser.managerUserId || null,
        }).returning();
    }

    const [activeOwner] = await db.select()
        .from(partnerStaffMemberships)
        .where(and(
            eq(partnerStaffMemberships.organizationId, organization.id),
            eq(partnerStaffMemberships.userId, parsedPartnerId),
            isNull(partnerStaffMemberships.revokedAt),
        ))
        .limit(1);

    if (!activeOwner) {
        await db.insert(partnerStaffMemberships).values({
            organizationId: organization.id,
            userId: parsedPartnerId,
            staffRole: 'owner',
            createdByUserId: actorUserId || partnerUser.managerUserId || null,
            updatedByUserId: actorUserId || partnerUser.managerUserId || null,
        });
    }

    return organization;
}

export async function handoverPartnerOrganizationOwnerMemberships(db, {
    organizationId,
    targetUserId,
    actorUserId,
}) {
    await db.execute(sql`
        UPDATE partner_staff_memberships
        SET revoked_at = NOW(),
            updated_by_user_id = ${actorUserId},
            updated_at = NOW()
        WHERE organization_id = ${organizationId}
            AND revoked_at IS NULL
            AND staff_role = 'owner'
            AND user_id <> ${targetUserId}
    `);

    await db.execute(sql`
        UPDATE partner_staff_memberships
        SET staff_role = 'owner',
            updated_by_user_id = ${actorUserId},
            updated_at = NOW()
        WHERE organization_id = ${organizationId}
            AND user_id = ${targetUserId}
            AND revoked_at IS NULL
    `);

    await db.execute(sql`
        INSERT INTO partner_staff_memberships (
            organization_id,
            user_id,
            staff_role,
            created_by_user_id,
            updated_by_user_id
        )
        SELECT ${organizationId}, ${targetUserId}, 'owner', ${actorUserId}, ${actorUserId}
        WHERE NOT EXISTS (
            SELECT 1
            FROM partner_staff_memberships
            WHERE organization_id = ${organizationId}
                AND user_id = ${targetUserId}
                AND revoked_at IS NULL
        )
    `);
}

export async function logPartnerStaffEvent(db, values) {
    await db.insert(partnerStaffEvents).values({
        organizationId: values.organizationId,
        actorUserId: values.actorUserId || null,
        targetUserId: values.targetUserId || null,
        eventType: values.eventType,
        metadata: values.metadata || {},
    });
}
