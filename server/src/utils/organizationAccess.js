import { and, eq, isNull } from 'drizzle-orm';

import { organizationAccessMemberships, partnerOrganizations } from '../db/schema.js';
import { normalizeOrganizationAccessRole } from './governance.js';

const OPTIONAL_GOVERNANCE_TABLE_NAMES = [
    'organization_access_memberships',
    'partner_organizations',
];

function toInteger(value) {
    const number = Number(value);
    return Number.isInteger(number) ? number : null;
}

function isMissingOptionalGovernanceTableError(error) {
    const message = String(error?.message || '').toLowerCase();
    return error?.code === '42P01'
        && OPTIONAL_GOVERNANCE_TABLE_NAMES.some((tableName) => message.includes(tableName));
}

export function getActiveOrganizationAccess(user, allowedRoles = []) {
    const allowed = new Set(allowedRoles.map(normalizeOrganizationAccessRole).filter(Boolean));
    const entries = Array.isArray(user?.organizationAccess) ? user.organizationAccess : [];

    return entries
        .map((entry) => ({
            ...entry,
            organizationId: toInteger(entry?.organizationId),
            accessRole: normalizeOrganizationAccessRole(entry?.accessRole),
        }))
        .filter((entry) => (
            entry.organizationId
            && entry.accessRole
            && !entry.revokedAt
            && (!allowed.size || allowed.has(entry.accessRole))
        ));
}

export function hasOrganizationAdminAccess(user) {
    return getActiveOrganizationAccess(user, ['admin']).length > 0;
}

export function buildOrganizationAccessPayload(rows = []) {
    return rows
        .map((row) => {
            const organizationId = toInteger(row?.organizationId);
            const accessRole = normalizeOrganizationAccessRole(row?.accessRole);
            if (!organizationId || !accessRole || row?.revokedAt) return null;
            return {
                organizationId,
                organizationName: String(row?.organizationName || '').trim() || `Organisation ${organizationId}`,
                accessRole,
            };
        })
        .filter(Boolean)
        .sort((left, right) => left.organizationName.localeCompare(right.organizationName));
}

export async function loadOrganizationAccessForUser(db, userId) {
    const parsedUserId = toInteger(userId);
    if (!parsedUserId) return [];
    if (!db || typeof db.select !== 'function') return [];

    let rows;
    try {
        rows = await db.select({
            organizationId: organizationAccessMemberships.organizationId,
            organizationName: partnerOrganizations.name,
            accessRole: organizationAccessMemberships.accessRole,
            revokedAt: organizationAccessMemberships.revokedAt,
        })
            .from(organizationAccessMemberships)
            .innerJoin(partnerOrganizations, eq(organizationAccessMemberships.organizationId, partnerOrganizations.id))
            .where(and(
                eq(organizationAccessMemberships.userId, parsedUserId),
                isNull(organizationAccessMemberships.revokedAt),
            ));
    } catch (error) {
        if (isMissingOptionalGovernanceTableError(error)) return [];
        throw error;
    }

    return buildOrganizationAccessPayload(rows);
}
