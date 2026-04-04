import { desc, eq, inArray } from 'drizzle-orm';

import { userAssetMemberships } from '../db/schema.js';

function formatMembershipUser(user) {
    if (!user) return null;
    return {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
    };
}

function formatMembershipPlace(hardAsset) {
    if (!hardAsset) return null;
    return {
        id: hardAsset.id,
        name: hardAsset.name,
        address: hardAsset.address,
        subCategory: hardAsset.subCategory,
        logoUrl: hardAsset.logoUrl,
        partnerName: hardAsset.partner?.name || null,
    };
}

function formatMembershipPreview(row) {
    return {
        id: row.id,
        userId: row.userId,
        status: row.status,
        joinMethod: row.joinMethod,
        linkedAt: row.updatedAt || row.createdAt || null,
        user: formatMembershipUser(row.user),
    };
}

function formatUserMembership(row) {
    return {
        id: row.id,
        hardAssetId: row.hardAssetId,
        status: row.status,
        joinMethod: row.joinMethod,
        linkedAt: row.updatedAt || row.createdAt || null,
        place: formatMembershipPlace(row.hardAsset),
    };
}

export async function loadMembershipSummariesForAssets(db, hardAssetIds, { previewLimit = 5 } = {}) {
    const ids = [...new Set((hardAssetIds || []).filter(Number.isInteger))];
    const grouped = new Map();

    for (const id of ids) {
        grouped.set(id, {
            membershipCount: 0,
            memberPreview: [],
            hasMoreMembers: false,
        });
    }

    if (ids.length === 0) return grouped;

    const rows = await db.query.userAssetMemberships.findMany({
        where: inArray(userAssetMemberships.hardAssetId, ids),
        columns: {
            id: true,
            userId: true,
            hardAssetId: true,
            status: true,
            joinMethod: true,
            createdAt: true,
            updatedAt: true,
        },
        with: {
            user: {
                columns: {
                    id: true,
                    name: true,
                    username: true,
                    email: true,
                },
            },
        },
        orderBy: [
            desc(userAssetMemberships.updatedAt),
            desc(userAssetMemberships.createdAt),
        ],
    });

    for (const row of rows) {
        const current = grouped.get(row.hardAssetId);
        if (!current) continue;

        current.membershipCount += 1;
        if (current.memberPreview.length < previewLimit) {
            current.memberPreview.push(formatMembershipPreview(row));
        }
    }

    for (const value of grouped.values()) {
        value.hasMoreMembers = value.membershipCount > value.memberPreview.length;
    }

    return grouped;
}

export async function loadMembershipsForUser(db, userId) {
    if (!Number.isInteger(userId)) return [];

    const rows = await db.query.userAssetMemberships.findMany({
        where: eq(userAssetMemberships.userId, userId),
        columns: {
            id: true,
            hardAssetId: true,
            status: true,
            joinMethod: true,
            createdAt: true,
            updatedAt: true,
        },
        with: {
            hardAsset: {
                columns: {
                    id: true,
                    name: true,
                    address: true,
                    subCategory: true,
                    logoUrl: true,
                    isDeleted: true,
                },
                with: {
                    partner: {
                        columns: {
                            name: true,
                        },
                    },
                },
            },
        },
        orderBy: [
            desc(userAssetMemberships.updatedAt),
            desc(userAssetMemberships.createdAt),
        ],
    });

    return rows
        .filter((row) => row.hardAsset && !row.hardAsset.isDeleted)
        .map(formatUserMembership);
}
