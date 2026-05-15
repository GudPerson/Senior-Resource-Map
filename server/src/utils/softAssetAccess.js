import { and, eq, isNull } from 'drizzle-orm';

import { softAssets, softAssetStaffMemberships, users } from '../db/schema.js';
import { normalizeRole } from './roles.js';

const STAFF_ROLES = new Set(['owner', 'staff']);
const OPTIONAL_STAFF_TABLE_NAMES = ['soft_asset_staff_memberships'];

function toInteger(value) {
    const number = Number(value);
    return Number.isInteger(number) ? number : null;
}

export function normalizeSoftAssetStaffRole(value) {
    const role = String(value || '').trim().toLowerCase();
    return STAFF_ROLES.has(role) ? role : null;
}

export function getActiveSoftAssetStaffAccess(user, allowedRoles = ['owner', 'staff']) {
    const allowed = new Set(allowedRoles.map(normalizeSoftAssetStaffRole).filter(Boolean));
    const entries = Array.isArray(user?.softAssetStaffAccess) ? user.softAssetStaffAccess : [];

    return entries
        .map((entry) => ({
            ...entry,
            softAssetId: toInteger(entry?.softAssetId),
            staffRole: normalizeSoftAssetStaffRole(entry?.staffRole),
        }))
        .filter((entry) => (
            entry.softAssetId
            && entry.staffRole
            && !entry.revokedAt
            && (!allowed.size || allowed.has(entry.staffRole))
        ));
}

export function hasSoftAssetStaffAccess(user, softAssetId, allowedRoles = ['owner', 'staff']) {
    const parsedSoftAssetId = toInteger(softAssetId);
    if (!parsedSoftAssetId) return false;

    return getActiveSoftAssetStaffAccess(user, allowedRoles)
        .some((entry) => entry.softAssetId === parsedSoftAssetId);
}

export function hasAnySoftAssetStaffAccess(user, allowedRoles = ['owner', 'staff']) {
    return getActiveSoftAssetStaffAccess(user, allowedRoles).length > 0;
}

function getActiveOwnerCount(softAsset) {
    const parsed = toInteger(softAsset?.activeOwnerCount);
    return parsed || 0;
}

export function canAssignSoftAssetStaffRole(actor, softAsset, staffRole) {
    const actorRole = normalizeRole(actor?.role);
    const nextRole = normalizeSoftAssetStaffRole(staffRole);
    if (!actor || !softAsset || !nextRole) return false;
    if (actorRole === 'super_admin') return true;
    if (hasSoftAssetStaffAccess(actor, softAsset.id, ['owner'])) {
        return getActiveOwnerCount(softAsset) > 0;
    }
    return false;
}

export function canRevokeSoftAssetStaffMembership(actor, softAsset, membership) {
    const actorRole = normalizeRole(actor?.role);
    const membershipRole = normalizeSoftAssetStaffRole(membership?.staffRole);
    if (!actor || !softAsset || !membershipRole) return false;
    if (membershipRole === 'owner' && getActiveOwnerCount(softAsset) <= 1) return false;
    if (actorRole === 'super_admin') return true;
    return hasSoftAssetStaffAccess(actor, softAsset.id, ['owner']);
}

export function buildSoftAssetStaffAccessPayload(rows = []) {
    return rows
        .map((row) => ({
            softAssetMembershipId: toInteger(row?.softAssetMembershipId ?? row?.id),
            softAssetId: toInteger(row?.softAssetId),
            softAssetName: String(row?.softAssetName || '').trim() || `Offering ${row?.softAssetId}`,
            staffRole: normalizeSoftAssetStaffRole(row?.staffRole),
            revokedAt: row?.revokedAt || null,
        }))
        .filter((entry) => entry.softAssetId && entry.staffRole && !entry.revokedAt)
        .map(({ revokedAt, ...entry }) => entry);
}

function isMissingOptionalStaffTableError(error) {
    const message = String(error?.message || '').toLowerCase();
    return error?.code === '42P01'
        && OPTIONAL_STAFF_TABLE_NAMES.some((tableName) => message.includes(tableName));
}

export async function loadSoftAssetStaffAccessForUser(db, userId) {
    const parsedUserId = toInteger(userId);
    if (!parsedUserId) return [];

    let rows;
    try {
        rows = await db.select({
            softAssetMembershipId: softAssetStaffMemberships.id,
            softAssetId: softAssetStaffMemberships.softAssetId,
            softAssetName: softAssets.name,
            softAssetDeleted: softAssets.isDeleted,
            staffRole: softAssetStaffMemberships.staffRole,
            revokedAt: softAssetStaffMemberships.revokedAt,
        })
            .from(softAssetStaffMemberships)
            .innerJoin(softAssets, eq(softAssetStaffMemberships.softAssetId, softAssets.id))
            .where(and(
                eq(softAssetStaffMemberships.userId, parsedUserId),
                isNull(softAssetStaffMemberships.revokedAt),
            ));
    } catch (error) {
        if (isMissingOptionalStaffTableError(error)) return [];
        throw error;
    }

    return buildSoftAssetStaffAccessPayload(rows.filter((row) => !row.softAssetDeleted));
}

export async function loadSoftAssetStaffRows(db, softAssetId) {
    const parsedSoftAssetId = toInteger(softAssetId);
    if (!parsedSoftAssetId) return [];

    return db.select({
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
            eq(softAssetStaffMemberships.softAssetId, parsedSoftAssetId),
            isNull(softAssetStaffMemberships.revokedAt),
        ));
}

export function formatSoftAssetStaffMember(row) {
    if (!row) return null;
    return {
        id: row.id,
        softAssetId: row.softAssetId,
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
