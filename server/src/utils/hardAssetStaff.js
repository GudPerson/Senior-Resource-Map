import { and, eq, inArray, isNull } from 'drizzle-orm';

import { hardAssets, hardAssetStaffMemberships, users } from '../db/schema.js';
import { normalizeRole } from './roles.js';

const STAFF_ROLES = new Set(['owner', 'staff']);
const OPTIONAL_STAFF_TABLE_NAMES = ['hard_asset_staff_memberships'];

function toInteger(value) {
    const number = Number(value);
    return Number.isInteger(number) ? number : null;
}

export function normalizeHardAssetStaffRole(value) {
    const role = String(value || '').trim().toLowerCase();
    return STAFF_ROLES.has(role) ? role : null;
}

export function getActiveHardAssetStaffAccess(user, allowedRoles = ['owner', 'staff']) {
    const allowed = new Set(allowedRoles.map(normalizeHardAssetStaffRole).filter(Boolean));
    const entries = Array.isArray(user?.hardAssetStaffAccess) ? user.hardAssetStaffAccess : [];

    return entries
        .map((entry) => ({
            ...entry,
            hardAssetId: toInteger(entry?.hardAssetId),
            staffRole: normalizeHardAssetStaffRole(entry?.staffRole),
            subregionId: toInteger(entry?.subregionId),
        }))
        .filter((entry) => (
            entry.hardAssetId
            && entry.staffRole
            && !entry.revokedAt
            && (!allowed.size || allowed.has(entry.staffRole))
        ));
}

export function hasHardAssetStaffAccess(user, hardAssetId, allowedRoles = ['owner', 'staff']) {
    const parsedHardAssetId = toInteger(hardAssetId);
    if (!parsedHardAssetId) return false;

    return getActiveHardAssetStaffAccess(user, allowedRoles)
        .some((entry) => entry.hardAssetId === parsedHardAssetId);
}

export function hasAnyHardAssetStaffAccess(user, allowedRoles = ['owner', 'staff']) {
    return getActiveHardAssetStaffAccess(user, allowedRoles).length > 0;
}

function getActiveOwnerCount(hardAsset) {
    const parsed = toInteger(hardAsset?.activeOwnerCount);
    return parsed || 0;
}

export function canAssignHardAssetStaffRole(actor, hardAsset, staffRole) {
    const actorRole = normalizeRole(actor?.role);
    const nextRole = normalizeHardAssetStaffRole(staffRole);
    if (!actor || !hardAsset || !nextRole) return false;
    if (actorRole === 'super_admin') return true;
    if (hasHardAssetStaffAccess(actor, hardAsset.id, ['owner'])) {
        return getActiveOwnerCount(hardAsset) > 0;
    }
    return false;
}

export function canRevokeHardAssetStaffMembership(actor, hardAsset, membership) {
    const actorRole = normalizeRole(actor?.role);
    const membershipRole = normalizeHardAssetStaffRole(membership?.staffRole);
    if (!actor || !hardAsset || !membershipRole) return false;
    if (membershipRole === 'owner' && getActiveOwnerCount(hardAsset) <= 1) return false;
    if (actorRole === 'super_admin') return true;
    return hasHardAssetStaffAccess(actor, hardAsset.id, ['owner']);
}

export function buildHardAssetStaffAccessPayload(rows = []) {
    return rows
        .map((row) => ({
            hardAssetMembershipId: toInteger(row?.hardAssetMembershipId ?? row?.id),
            hardAssetId: toInteger(row?.hardAssetId),
            hardAssetName: String(row?.hardAssetName || '').trim() || `Place ${row?.hardAssetId}`,
            staffRole: normalizeHardAssetStaffRole(row?.staffRole),
            subregionId: toInteger(row?.subregionId),
            revokedAt: row?.revokedAt || null,
        }))
        .filter((entry) => entry.hardAssetId && entry.staffRole && !entry.revokedAt)
        .map(({ revokedAt, ...entry }) => entry);
}

function isMissingOptionalStaffTableError(error) {
    const message = String(error?.message || '').toLowerCase();
    return error?.code === '42P01'
        && OPTIONAL_STAFF_TABLE_NAMES.some((tableName) => message.includes(tableName));
}

export async function loadHardAssetStaffAccessForUser(db, userId) {
    const parsedUserId = toInteger(userId);
    if (!parsedUserId) return [];

    let membershipRows;
    try {
        membershipRows = await db.select({
            hardAssetMembershipId: hardAssetStaffMemberships.id,
            hardAssetId: hardAssetStaffMemberships.hardAssetId,
            hardAssetName: hardAssets.name,
            subregionId: hardAssets.subregionId,
            hardAssetDeleted: hardAssets.isDeleted,
            staffRole: hardAssetStaffMemberships.staffRole,
            revokedAt: hardAssetStaffMemberships.revokedAt,
        })
            .from(hardAssetStaffMemberships)
            .innerJoin(hardAssets, eq(hardAssetStaffMemberships.hardAssetId, hardAssets.id))
            .where(and(
                eq(hardAssetStaffMemberships.userId, parsedUserId),
                isNull(hardAssetStaffMemberships.revokedAt),
            ));
    } catch (error) {
        if (isMissingOptionalStaffTableError(error)) return [];
        throw error;
    }

    return buildHardAssetStaffAccessPayload(
        membershipRows.filter((row) => !row.hardAssetDeleted)
    );
}

export async function loadHardAssetStaffRows(db, hardAssetId) {
    const parsedHardAssetId = toInteger(hardAssetId);
    if (!parsedHardAssetId) return [];

    return db.select({
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
            eq(hardAssetStaffMemberships.hardAssetId, parsedHardAssetId),
            isNull(hardAssetStaffMemberships.revokedAt),
        ));
}

export function formatHardAssetStaffMember(row) {
    if (!row) return null;
    return {
        id: row.id,
        hardAssetId: row.hardAssetId,
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

export async function loadUsersByIds(db, userIds) {
    const ids = [...new Set((userIds || []).map(toInteger).filter(Boolean))];
    if (ids.length === 0) return [];

    return db.select({
        id: users.id,
        username: users.username,
        email: users.email,
        name: users.name,
        role: users.role,
    })
        .from(users)
        .where(inArray(users.id, ids));
}
