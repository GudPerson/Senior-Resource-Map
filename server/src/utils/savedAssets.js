import { eq } from 'drizzle-orm';

import { hardAssets, softAssets } from '../db/schema.js';
import { resolveStandardAudienceZoneIds } from './audienceZones.js';
import { resolveStandardAudiencePartnerIds } from './partnerBoundaries.js';
import { isChildSoftAsset, getSoftAssetLocations } from './softAssetHierarchy.js';
import { isAssetVisible } from './visibility.js';

function normalizeText(value) {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text ? text : null;
}

function parseCoordinate(value) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function hasCoordinates(source) {
    return parseCoordinate(source?.lat) !== null && parseCoordinate(source?.lng) !== null;
}

function buildDetailPath(resourceType, resourceId) {
    return `/resource/${resourceType}/${resourceId}`;
}

function buildAssetKey(resourceType, resourceId) {
    return `${resourceType}-${resourceId}`;
}

function flattenSnapshot(resourceType, resourceId, snapshot, favorite) {
    return {
        id: favorite?.id ?? null,
        userId: favorite?.userId ?? null,
        resourceType,
        resourceId,
        createdAt: favorite?.createdAt ?? null,
        assetKey: buildAssetKey(resourceType, resourceId),
        status: 'unavailable',
        hasCoordinates: hasCoordinates(snapshot),
        name: normalizeText(snapshot?.name) || 'Saved resource',
        subCategory: normalizeText(snapshot?.subCategory) || (resourceType === 'hard' ? 'Place' : 'Offering'),
        address: normalizeText(snapshot?.address),
        lat: parseCoordinate(snapshot?.lat),
        lng: parseCoordinate(snapshot?.lng),
        detailPath: normalizeText(snapshot?.detailPath) || buildDetailPath(resourceType, resourceId),
        hostHardAssetIds: Array.isArray(snapshot?.hostHardAssetIds) ? snapshot.hostHardAssetIds : [],
    };
}

export function buildSavedAssetSnapshot(summary) {
    return {
        name: normalizeText(summary?.name),
        subCategory: normalizeText(summary?.subCategory),
        address: normalizeText(summary?.address),
        lat: parseCoordinate(summary?.lat),
        lng: parseCoordinate(summary?.lng),
        detailPath: normalizeText(summary?.detailPath),
        hostHardAssetIds: Array.isArray(summary?.hostHardAssetIds) ? summary.hostHardAssetIds : [],
    };
}

function flattenLiveSummary(resourceType, resourceId, favorite, summary, status = 'available') {
    return {
        id: favorite?.id ?? null,
        userId: favorite?.userId ?? null,
        resourceType,
        resourceId,
        createdAt: favorite?.createdAt ?? null,
        assetKey: buildAssetKey(resourceType, resourceId),
        status,
        hasCoordinates: hasCoordinates(summary),
        name: normalizeText(summary?.name) || 'Saved resource',
        subCategory: normalizeText(summary?.subCategory) || (resourceType === 'hard' ? 'Place' : 'Offering'),
        address: normalizeText(summary?.address),
        lat: parseCoordinate(summary?.lat),
        lng: parseCoordinate(summary?.lng),
        detailPath: normalizeText(summary?.detailPath) || buildDetailPath(resourceType, resourceId),
        hostHardAssetIds: Array.isArray(summary?.hostHardAssetIds) ? summary.hostHardAssetIds : [],
    };
}

function summarizeHardAsset(asset) {
    if (!asset) return null;

    return {
        name: asset.name,
        subCategory: asset.subCategory,
        address: asset.address,
        lat: asset.lat,
        lng: asset.lng,
        detailPath: buildDetailPath('hard', asset.id),
    };
}

function summarizeSoftAsset(asset, location) {
    if (!asset) return null;

    const allLocations = getSoftAssetLocations(asset);
    const hostIds = new Set(allLocations.map(loc => loc.id).filter(Boolean));
    if (asset.hostHardAssetId) hostIds.add(asset.hostHardAssetId);

    return {
        name: asset.name,
        subCategory: asset.subCategory,
        address: location?.address || null,
        lat: location?.lat ?? null,
        lng: location?.lng ?? null,
        detailPath: buildDetailPath('soft', asset.id),
        hostHardAssetIds: [...hostIds],
    };
}

function canExposeSoftAsset(asset, visibleLocations) {
    const allLocations = getSoftAssetLocations(asset);
    if (isChildSoftAsset(asset)) {
        return visibleLocations.length > 0;
    }

    return allLocations.length === 0 || visibleLocations.length > 0;
}

const hardAssetSummaryQuery = {
    columns: {
        id: true,
        name: true,
        subCategory: true,
        address: true,
        lat: true,
        lng: true,
        isHidden: true,
        hideFrom: true,
        hideUntil: true,
        isDeleted: true,
    },
    with: {
        partner: {
            columns: {
                id: true,
                managerUserId: true,
            },
        },
    },
};

const hardAssetLocationQuery = {
    columns: {
        id: true,
        name: true,
        address: true,
        lat: true,
        lng: true,
        isHidden: true,
        hideFrom: true,
        hideUntil: true,
        isDeleted: true,
    },
    with: {
        partner: {
            columns: {
                id: true,
                managerUserId: true,
            },
        },
    },
};

const softAssetSummaryQuery = {
    columns: {
        id: true,
        name: true,
        subCategory: true,
        audienceMode: true,
        isMemberOnly: true,
        isHidden: true,
        hideFrom: true,
        hideUntil: true,
        isDeleted: true,
        assetMode: true,
        partnerId: true,
        subregionId: true,
        hostHardAssetId: true,
    },
    with: {
        partner: {
            columns: {
                id: true,
                managerUserId: true,
            },
        },
        parent: {
            columns: {
                id: true,
            },
            with: {
                audienceZones: {
                    with: {
                        audienceZone: {
                            columns: {
                                id: true,
                                zoneCode: true,
                                name: true,
                                partnerUserId: true,
                            },
                        },
                    },
                },
            },
        },
        audienceZones: {
            with: {
                audienceZone: {
                    columns: {
                        id: true,
                        zoneCode: true,
                        name: true,
                        partnerUserId: true,
                    },
                },
            },
        },
        hostHardAsset: hardAssetLocationQuery,
        locations: {
            with: {
                hardAsset: hardAssetLocationQuery,
            },
        },
    },
};

export async function createSavedAssetResolutionContext(db, user) {
    return {
        allowedPartnerAudienceIds: await resolveStandardAudiencePartnerIds(db, user),
        allowedAudienceZoneIds: await resolveStandardAudienceZoneIds(db, user),
    };
}

export async function resolveSavedAssetSummary(db, user, resourceType, resourceId, resolutionContext = null) {
    const context = resolutionContext || await createSavedAssetResolutionContext(db, user);

    if (resourceType === 'hard') {
        const asset = await db.query.hardAssets.findFirst({
            ...hardAssetSummaryQuery,
            where: eq(hardAssets.id, resourceId),
        });

        if (!asset) return null;

        const summary = summarizeHardAsset(asset);
        const isVisible = isAssetVisible(asset, user, {
            ownerPartner: asset.partner,
            allowedPartnerAudienceIds: context.allowedPartnerAudienceIds,
            allowedAudienceZoneIds: context.allowedAudienceZoneIds,
        });

        return {
            summary,
            status: isVisible ? 'available' : 'unavailable',
        };
    }

    if (resourceType === 'soft') {
        const asset = await db.query.softAssets.findFirst({
            ...softAssetSummaryQuery,
            where: eq(softAssets.id, resourceId),
        });

        if (!asset) return null;

        const allLocations = getSoftAssetLocations(asset);
        const visibleLocations = allLocations.filter((location) => isAssetVisible(location, user, {
            ownerPartner: location.partner,
            allowedPartnerAudienceIds: context.allowedPartnerAudienceIds,
            allowedAudienceZoneIds: context.allowedAudienceZoneIds,
        }));

        const assetVisible = isAssetVisible(asset, user, {
            ownerPartner: asset.partner,
            allowedPartnerAudienceIds: context.allowedPartnerAudienceIds,
            allowedAudienceZoneIds: context.allowedAudienceZoneIds,
        });

        const canExpose = canExposeSoftAsset(asset, visibleLocations);
        const primaryLocation = (assetVisible && canExpose)
            ? (visibleLocations[0] || null)
            : (allLocations[0] || null);

        return {
            summary: summarizeSoftAsset(asset, primaryLocation),
            status: assetVisible && canExpose ? 'available' : 'unavailable',
        };
    }

    return null;
}

export async function hydrateSavedAssetRecord(db, user, favorite, resolutionContext = null) {
    const resourceType = normalizeText(favorite?.resourceType);
    const resourceId = Number.parseInt(String(favorite?.resourceId ?? ''), 10);
    const snapshot = favorite?.snapshot || null;

    if (!resourceType || !Number.isInteger(resourceId)) {
        return flattenSnapshot(resourceType || 'asset', resourceId || 0, snapshot, favorite);
    }

    const resolved = await resolveSavedAssetSummary(db, user, resourceType, resourceId, resolutionContext);
    if (!resolved?.summary) {
        return flattenSnapshot(resourceType, resourceId, snapshot, favorite);
    }

    return flattenLiveSummary(resourceType, resourceId, favorite, resolved.summary, resolved.status);
}
