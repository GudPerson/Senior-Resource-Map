import { and, eq, inArray, isNull } from 'drizzle-orm';

import {
    hardAssets,
    hardAssetStaffMemberships,
    organizationAccessMemberships,
    organizationResourceLinks,
    partnerOrganizations,
    softAssetLocations,
    softAssets,
    softAssetStaffMemberships,
    users,
} from '../db/schema.js';
import {
    evaluateAssetOperatorOrganizationEligibility,
    evaluateOrganizationUserAssignment,
    evaluateResourceOrganizationLink,
} from './governance.js';

function guardrailError(message, status = 409) {
    const err = new Error(message);
    err.status = status;
    return err;
}

function formatOperator(row, membershipsByUserId) {
    return {
        userId: row.userId,
        userName: row.userName || row.name || row.username || row.email,
        organizationMemberships: membershipsByUserId.get(Number(row.userId)) || [],
    };
}

async function loadOrganizationMembershipsForUserIds(db, userIds) {
    const ids = [...new Set(userIds.map(Number).filter(Boolean))];
    const grouped = new Map();
    if (!ids.length) return grouped;

    const rows = await db.select({
        id: organizationAccessMemberships.id,
        organizationId: organizationAccessMemberships.organizationId,
        organizationName: partnerOrganizations.name,
        userId: organizationAccessMemberships.userId,
        accessRole: organizationAccessMemberships.accessRole,
        revokedAt: organizationAccessMemberships.revokedAt,
    })
        .from(organizationAccessMemberships)
        .innerJoin(partnerOrganizations, eq(organizationAccessMemberships.organizationId, partnerOrganizations.id))
        .where(and(
            inArray(organizationAccessMemberships.userId, ids),
            isNull(organizationAccessMemberships.revokedAt),
        ));

    for (const row of rows) {
        const key = Number(row.userId);
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(row);
    }
    return grouped;
}

async function loadActiveResourceOrganizationLinks(db, resourceType, resourceId) {
    return db.select({
        id: organizationResourceLinks.id,
        organizationId: organizationResourceLinks.organizationId,
        organizationName: partnerOrganizations.name,
        resourceType: organizationResourceLinks.resourceType,
        resourceId: organizationResourceLinks.resourceId,
        linkStatus: organizationResourceLinks.linkStatus,
        unlinkedAt: organizationResourceLinks.unlinkedAt,
    })
        .from(organizationResourceLinks)
        .innerJoin(partnerOrganizations, eq(organizationResourceLinks.organizationId, partnerOrganizations.id))
        .where(and(
            eq(organizationResourceLinks.resourceType, resourceType),
            eq(organizationResourceLinks.resourceId, resourceId),
            isNull(organizationResourceLinks.unlinkedAt),
        ));
}

async function loadSoftAssetLocationIds(db, softAssetId) {
    const [asset] = await db.select({
        id: softAssets.id,
        hostHardAssetId: softAssets.hostHardAssetId,
    })
        .from(softAssets)
        .where(eq(softAssets.id, softAssetId))
        .limit(1);

    const ids = [];
    if (asset?.hostHardAssetId) ids.push(Number(asset.hostHardAssetId));

    const locations = await db.select({ hardAssetId: softAssetLocations.hardAssetId })
        .from(softAssetLocations)
        .where(eq(softAssetLocations.softAssetId, softAssetId));
    ids.push(...locations.map((row) => Number(row.hardAssetId)));

    return [...new Set(ids.filter(Boolean))];
}

export async function loadOfferingsCoveredByHardAssetLinks(db, hardAssetIds = []) {
    const ids = [...new Set((hardAssetIds || []).map(Number).filter(Boolean))];
    if (!ids.length) return [];

    const hostedRows = await db.select({
        id: softAssets.id,
        name: softAssets.name,
        hostHardAssetId: softAssets.hostHardAssetId,
    })
        .from(softAssets)
        .where(and(
            inArray(softAssets.hostHardAssetId, ids),
            eq(softAssets.isDeleted, false),
        ));

    const linkedRows = await db.select({
        id: softAssets.id,
        name: softAssets.name,
        hardAssetId: softAssetLocations.hardAssetId,
    })
        .from(softAssetLocations)
        .innerJoin(softAssets, eq(softAssetLocations.softAssetId, softAssets.id))
        .where(and(
            inArray(softAssetLocations.hardAssetId, ids),
            eq(softAssets.isDeleted, false),
        ));

    const byId = new Map();
    for (const row of hostedRows) {
        byId.set(Number(row.id), {
            id: row.id,
            resourceType: 'soft',
            resourceId: row.id,
            resourceName: row.name,
            coveredByHardAssetId: Number(row.hostHardAssetId),
            coverageSource: 'linked_place',
        });
    }
    for (const row of linkedRows) {
        byId.set(Number(row.id), {
            id: row.id,
            resourceType: 'soft',
            resourceId: row.id,
            resourceName: row.name,
            coveredByHardAssetId: Number(row.hardAssetId),
            coverageSource: 'linked_place',
        });
    }
    return [...byId.values()];
}

export async function loadOfferingsCoveredByHardAssetLinksForOrganizations(db, hardIdsByOrganization = new Map()) {
    const hardIdToOrganizationIds = new Map();
    for (const [organizationId, hardAssetIds] of hardIdsByOrganization.entries()) {
        const organizationKey = Number(organizationId);
        if (!organizationKey) continue;
        for (const hardAssetId of hardAssetIds || []) {
            const hardKey = Number(hardAssetId);
            if (!hardKey) continue;
            if (!hardIdToOrganizationIds.has(hardKey)) hardIdToOrganizationIds.set(hardKey, []);
            hardIdToOrganizationIds.get(hardKey).push(organizationKey);
        }
    }

    const hardAssetIds = [...hardIdToOrganizationIds.keys()];
    if (!hardAssetIds.length) return [];

    const hostedRows = await db.select({
        id: softAssets.id,
        name: softAssets.name,
        hostHardAssetId: softAssets.hostHardAssetId,
    })
        .from(softAssets)
        .where(and(
            inArray(softAssets.hostHardAssetId, hardAssetIds),
            eq(softAssets.isDeleted, false),
        ));

    const linkedRows = await db.select({
        id: softAssets.id,
        name: softAssets.name,
        hardAssetId: softAssetLocations.hardAssetId,
    })
        .from(softAssetLocations)
        .innerJoin(softAssets, eq(softAssetLocations.softAssetId, softAssets.id))
        .where(and(
            inArray(softAssetLocations.hardAssetId, hardAssetIds),
            eq(softAssets.isDeleted, false),
        ));

    const rows = [];
    const seenKeys = new Set();
    const addRow = (row, hardAssetId) => {
        const hardKey = Number(hardAssetId);
        const organizationIds = hardIdToOrganizationIds.get(hardKey) || [];
        for (const organizationId of organizationIds) {
            const key = `${organizationId}:${Number(row.id)}`;
            if (seenKeys.has(key)) continue;
            seenKeys.add(key);
            rows.push({
                id: row.id,
                organizationId,
                resourceType: 'soft',
                resourceId: row.id,
                resourceName: row.name,
                coveredByHardAssetId: hardKey,
                coverageSource: 'linked_place',
            });
        }
    };

    for (const row of hostedRows) addRow(row, row.hostHardAssetId);
    for (const row of linkedRows) addRow(row, row.hardAssetId);
    return rows;
}

export async function loadHardOrganizationResourceLinkCandidateSeeds(db, accessRows = [], options = {}) {
    const accessUserIds = [...new Set((accessRows || [])
        .map((row) => Number(row?.userId))
        .filter(Boolean))];
    if (!accessUserIds.length) return [];

    const rows = await db.select({
        id: hardAssets.id,
        name: hardAssets.name,
        address: hardAssets.address,
        postalCode: hardAssets.postalCode,
    })
        .from(hardAssetStaffMemberships)
        .innerJoin(hardAssets, eq(hardAssetStaffMemberships.hardAssetId, hardAssets.id))
        .where(and(
            inArray(hardAssetStaffMemberships.userId, accessUserIds),
            isNull(hardAssetStaffMemberships.revokedAt),
            eq(hardAssets.isDeleted, false),
        ))
        .orderBy(hardAssets.name)
        .limit(options.limit || 240);

    const byId = new Map();
    for (const row of rows) {
        const key = Number(row.id);
        if (!key || byId.has(key)) continue;
        byId.set(key, row);
    }
    return [...byId.values()];
}

async function loadHardAssetOperators(db, hardAssetIds) {
    const ids = [...new Set(hardAssetIds.map(Number).filter(Boolean))];
    if (!ids.length) return [];
    return db.select({
        userId: hardAssetStaffMemberships.userId,
        userName: users.name,
        username: users.username,
        email: users.email,
    })
        .from(hardAssetStaffMemberships)
        .innerJoin(users, eq(hardAssetStaffMemberships.userId, users.id))
        .where(and(
            inArray(hardAssetStaffMemberships.hardAssetId, ids),
            isNull(hardAssetStaffMemberships.revokedAt),
        ));
}

async function filterHardOrganizationResourceLinkCandidates(db, organizationId, candidates) {
    const ids = [...new Set((candidates || []).map((candidate) => Number(candidate.id)).filter(Boolean))];
    if (!ids.length) return [];

    const [resourceLinks, operators] = await Promise.all([
        db.select({
            id: organizationResourceLinks.id,
            organizationId: organizationResourceLinks.organizationId,
            organizationName: partnerOrganizations.name,
            resourceType: organizationResourceLinks.resourceType,
            resourceId: organizationResourceLinks.resourceId,
            linkStatus: organizationResourceLinks.linkStatus,
            unlinkedAt: organizationResourceLinks.unlinkedAt,
        })
            .from(organizationResourceLinks)
            .innerJoin(partnerOrganizations, eq(organizationResourceLinks.organizationId, partnerOrganizations.id))
            .where(and(
                eq(organizationResourceLinks.resourceType, 'hard'),
                inArray(organizationResourceLinks.resourceId, ids),
                isNull(organizationResourceLinks.unlinkedAt),
            )),
        db.select({
            hardAssetId: hardAssetStaffMemberships.hardAssetId,
            userId: hardAssetStaffMemberships.userId,
            userName: users.name,
            username: users.username,
            email: users.email,
        })
            .from(hardAssetStaffMemberships)
            .innerJoin(users, eq(hardAssetStaffMemberships.userId, users.id))
            .where(and(
                inArray(hardAssetStaffMemberships.hardAssetId, ids),
                isNull(hardAssetStaffMemberships.revokedAt),
            )),
    ]);

    const membershipsByUserId = await loadOrganizationMembershipsForUserIds(
        db,
        operators.map((row) => row.userId),
    );

    const linksByResourceId = new Map();
    for (const link of resourceLinks) {
        const key = Number(link.resourceId);
        if (!linksByResourceId.has(key)) linksByResourceId.set(key, []);
        linksByResourceId.get(key).push(link);
    }

    const operatorsByHardAssetId = new Map();
    for (const operator of operators) {
        const key = Number(operator.hardAssetId);
        if (!operatorsByHardAssetId.has(key)) operatorsByHardAssetId.set(key, []);
        operatorsByHardAssetId.get(key).push(operator);
    }

    return (candidates || []).filter((candidate) => {
        const resourceId = Number(candidate.id);
        const result = evaluateResourceOrganizationLink({
            targetOrganizationId: organizationId,
            existingResourceLinks: linksByResourceId.get(resourceId) || [],
            activeOperators: (operatorsByHardAssetId.get(resourceId) || [])
                .map((row) => formatOperator(row, membershipsByUserId)),
        });
        return result.allowed;
    });
}

async function loadSoftAssetOperators(db, softAssetId) {
    return db.select({
        userId: softAssetStaffMemberships.userId,
        userName: users.name,
        username: users.username,
        email: users.email,
    })
        .from(softAssetStaffMemberships)
        .innerJoin(users, eq(softAssetStaffMemberships.userId, users.id))
        .where(and(
            eq(softAssetStaffMemberships.softAssetId, softAssetId),
            isNull(softAssetStaffMemberships.revokedAt),
        ));
}

async function loadActiveOperatorsForResource(db, resourceType, resourceId) {
    let operators = [];
    if (resourceType === 'hard') {
        operators = await loadHardAssetOperators(db, [resourceId]);
    } else if (resourceType === 'soft') {
        const hardAssetIds = await loadSoftAssetLocationIds(db, resourceId);
        operators = hardAssetIds.length
            ? await loadHardAssetOperators(db, hardAssetIds)
            : await loadSoftAssetOperators(db, resourceId);
    }

    const membershipsByUserId = await loadOrganizationMembershipsForUserIds(
        db,
        operators.map((row) => row.userId),
    );
    return operators.map((row) => formatOperator(row, membershipsByUserId));
}

async function loadRelatedResourceLinks(db, resourceType, resourceId) {
    const links = await loadActiveResourceOrganizationLinks(db, resourceType, resourceId);
    if (resourceType !== 'soft') return links;

    const hardAssetIds = await loadSoftAssetLocationIds(db, resourceId);
    if (!hardAssetIds.length) return links;

    const hardLinks = await db.select({
        id: organizationResourceLinks.id,
        organizationId: organizationResourceLinks.organizationId,
        organizationName: partnerOrganizations.name,
        resourceType: organizationResourceLinks.resourceType,
        resourceId: organizationResourceLinks.resourceId,
        linkStatus: organizationResourceLinks.linkStatus,
        unlinkedAt: organizationResourceLinks.unlinkedAt,
    })
        .from(organizationResourceLinks)
        .innerJoin(partnerOrganizations, eq(organizationResourceLinks.organizationId, partnerOrganizations.id))
        .where(and(
            eq(organizationResourceLinks.resourceType, 'hard'),
            inArray(organizationResourceLinks.resourceId, hardAssetIds),
            isNull(organizationResourceLinks.unlinkedAt),
        ));

    return [...links, ...hardLinks];
}

export async function assertOrganizationUserAssignment(db, organizationId, userId) {
    const membershipsByUserId = await loadOrganizationMembershipsForUserIds(db, [userId]);
    const result = evaluateOrganizationUserAssignment({
        targetOrganizationId: organizationId,
        existingMemberships: membershipsByUserId.get(Number(userId)) || [],
    });
    if (!result.allowed) throw guardrailError(result.reason);
}

export async function filterOrganizationAccessCandidates(db, organizationId, candidates) {
    const membershipsByUserId = await loadOrganizationMembershipsForUserIds(
        db,
        candidates.map((row) => row.id),
    );

    return candidates.filter((candidate) => evaluateOrganizationUserAssignment({
        targetOrganizationId: organizationId,
        existingMemberships: membershipsByUserId.get(Number(candidate.id)) || [],
    }).allowed);
}

export async function assertAssetOperatorOrganizationEligibility(db, resourceType, resourceId, userId) {
    const [resourceOrganizationLinks, membershipsByUserId] = await Promise.all([
        loadRelatedResourceLinks(db, resourceType, resourceId),
        loadOrganizationMembershipsForUserIds(db, [userId]),
    ]);
    const result = evaluateAssetOperatorOrganizationEligibility({
        resourceOrganizationLinks,
        userOrganizationMemberships: membershipsByUserId.get(Number(userId)) || [],
    });
    if (!result.allowed) throw guardrailError(result.reason);
}

export async function filterAssetAccessCandidatesByOrganization(db, resourceType, resourceId, candidates) {
    const resourceOrganizationLinks = await loadRelatedResourceLinks(db, resourceType, resourceId);
    if (!resourceOrganizationLinks.length) return candidates;

    const membershipsByUserId = await loadOrganizationMembershipsForUserIds(
        db,
        candidates.map((row) => row.id),
    );

    return candidates.filter((candidate) => evaluateAssetOperatorOrganizationEligibility({
        resourceOrganizationLinks,
        userOrganizationMemberships: membershipsByUserId.get(Number(candidate.id)) || [],
    }).allowed);
}

export async function evaluateResourceOrganizationLinkEligibility(db, organizationId, resourceType, resourceId) {
    const [existingResourceLinks, activeOperators] = await Promise.all([
        loadRelatedResourceLinks(db, resourceType, resourceId),
        loadActiveOperatorsForResource(db, resourceType, resourceId),
    ]);
    return evaluateResourceOrganizationLink({
        targetOrganizationId: organizationId,
        existingResourceLinks,
        activeOperators,
    });
}

export async function filterOrganizationResourceLinkCandidates(db, organizationId, resourceType, candidates) {
    if (resourceType === 'hard') {
        return filterHardOrganizationResourceLinkCandidates(db, organizationId, candidates);
    }

    const eligible = [];
    for (const candidate of candidates || []) {
        const result = await evaluateResourceOrganizationLinkEligibility(
            db,
            organizationId,
            resourceType,
            candidate.id,
        );
        if (result.allowed) eligible.push(candidate);
    }
    return eligible;
}

export async function assertResourceOrganizationLinkEligibility(db, organizationId, resourceType, resourceId) {
    const result = await evaluateResourceOrganizationLinkEligibility(db, organizationId, resourceType, resourceId);
    if (!result.allowed) throw guardrailError(result.reason);
}
