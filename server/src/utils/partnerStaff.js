import { and, eq, inArray, isNull } from 'drizzle-orm';

import { partnerOrganizations, partnerStaffMemberships, users, userSubregions } from '../db/schema.js';

const STAFF_ROLES = new Set(['owner', 'editor']);
const OPTIONAL_STAFF_TABLE_NAMES = [
    'partner_staff_memberships',
    'partner_organizations',
];

function toInteger(value) {
    const number = Number(value);
    return Number.isInteger(number) ? number : null;
}

export function normalizePartnerStaffRole(value) {
    const role = String(value || '').trim().toLowerCase();
    return STAFF_ROLES.has(role) ? role : null;
}

export function getActivePartnerStaffAccess(user, allowedRoles = ['owner', 'editor']) {
    const allowed = new Set(allowedRoles.map(normalizePartnerStaffRole).filter(Boolean));
    const entries = Array.isArray(user?.partnerStaffAccess) ? user.partnerStaffAccess : [];

    return entries
        .map((entry) => ({
            ...entry,
            organizationId: toInteger(entry?.organizationId),
            legacyPartnerUserId: toInteger(entry?.legacyPartnerUserId),
            staffRole: normalizePartnerStaffRole(entry?.staffRole),
        }))
        .filter((entry) => (
            entry.organizationId
            && entry.legacyPartnerUserId
            && entry.staffRole
            && !entry.revokedAt
            && (!allowed.size || allowed.has(entry.staffRole))
        ));
}

export function hasPartnerStaffAccess(user, legacyPartnerUserId, allowedRoles = ['owner', 'editor']) {
    const partnerId = toInteger(legacyPartnerUserId);
    if (!partnerId) return false;

    return getActivePartnerStaffAccess(user, allowedRoles)
        .some((entry) => entry.legacyPartnerUserId === partnerId);
}

export function hasAnyPartnerStaffAccess(user, allowedRoles = ['owner', 'editor']) {
    return getActivePartnerStaffAccess(user, allowedRoles).length > 0;
}

export function getPrimaryPartnerStaffAccess(user, allowedRoles = ['owner', 'editor']) {
    return getActivePartnerStaffAccess(user, allowedRoles)[0] || null;
}

export function buildPartnerStaffAccessPayload(rows = []) {
    const byOrganization = new Map();

    for (const row of rows) {
        const organizationId = toInteger(row?.organizationId);
        const legacyPartnerUserId = toInteger(row?.legacyPartnerUserId);
        const staffRole = normalizePartnerStaffRole(row?.staffRole);
        if (!organizationId || !legacyPartnerUserId || !staffRole || row?.revokedAt) continue;

        if (!byOrganization.has(organizationId)) {
            byOrganization.set(organizationId, {
                organizationId,
                legacyPartnerUserId,
                organizationName: String(row?.organizationName || '').trim() || `Partner organisation ${organizationId}`,
                staffRole,
                subregionIds: [],
            });
        }

        const entry = byOrganization.get(organizationId);
        const subregionIds = Array.isArray(row?.subregionIds)
            ? row.subregionIds
            : [row?.subregionId];
        for (const subregionId of subregionIds) {
            const parsed = toInteger(subregionId);
            if (parsed && !entry.subregionIds.includes(parsed)) {
                entry.subregionIds.push(parsed);
            }
        }
    }

    return [...byOrganization.values()];
}

function isMissingOptionalStaffTableError(error) {
    const message = String(error?.message || '').toLowerCase();
    return error?.code === '42P01'
        && OPTIONAL_STAFF_TABLE_NAMES.some((tableName) => message.includes(tableName));
}

export async function loadPartnerStaffAccessForUser(db, userId) {
    const parsedUserId = toInteger(userId);
    if (!parsedUserId) return [];

    let membershipRows;
    try {
        membershipRows = await db.select({
            organizationId: partnerOrganizations.id,
            legacyPartnerUserId: partnerOrganizations.legacyPartnerUserId,
            organizationName: partnerOrganizations.name,
            staffRole: partnerStaffMemberships.staffRole,
            revokedAt: partnerStaffMemberships.revokedAt,
            legacyPartnerName: users.name,
        })
            .from(partnerStaffMemberships)
            .innerJoin(partnerOrganizations, eq(partnerStaffMemberships.organizationId, partnerOrganizations.id))
            .leftJoin(users, eq(partnerOrganizations.legacyPartnerUserId, users.id))
            .where(and(
                eq(partnerStaffMemberships.userId, parsedUserId),
                isNull(partnerStaffMemberships.revokedAt),
            ));
    } catch (error) {
        if (isMissingOptionalStaffTableError(error)) return [];
        throw error;
    }

    const legacyPartnerIds = [...new Set(
        membershipRows.map((row) => toInteger(row.legacyPartnerUserId)).filter(Boolean)
    )];
    const subregionsByPartner = new Map();

    if (legacyPartnerIds.length) {
        const subregionRows = await db.select({
            userId: userSubregions.userId,
            subregionId: userSubregions.subregionId,
        })
            .from(userSubregions)
            .where(inArray(userSubregions.userId, legacyPartnerIds));

        for (const row of subregionRows) {
            const partnerId = toInteger(row.userId);
            const subregionId = toInteger(row.subregionId);
            if (!partnerId || !subregionId) continue;
            if (!subregionsByPartner.has(partnerId)) subregionsByPartner.set(partnerId, []);
            subregionsByPartner.get(partnerId).push(subregionId);
        }
    }

    return buildPartnerStaffAccessPayload(membershipRows.map((row) => ({
        ...row,
        organizationName: row.organizationName || row.legacyPartnerName,
        subregionIds: subregionsByPartner.get(toInteger(row.legacyPartnerUserId)) || [],
    })));
}
