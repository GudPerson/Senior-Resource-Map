import { eq } from 'drizzle-orm';

import { hardAssets, softAssets, subCategories } from '../db/schema.js';
import { getSoftAssetLocations, isChildSoftAsset } from './softAssetHierarchy.js';
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

function normalizeCategoryKey(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim().toLowerCase();
}

function buildAssetKey(resourceType, resourceId) {
    return `${resourceType}-${resourceId}`;
}

function buildDetailPath(resourceType, resourceId) {
    return `/resource/${resourceType}/${resourceId}`;
}

function buildPlaceKey(place) {
    if (Number.isInteger(place?.placeId) && place.placeId > 0) {
        return `hard-${place.placeId}`;
    }

    if (normalizeText(place?.placeKey)) {
        return normalizeText(place.placeKey);
    }

    const name = normalizeText(place?.name) || 'place';
    const address = normalizeText(place?.address) || 'address';
    const lat = parseCoordinate(place?.lat);
    const lng = parseCoordinate(place?.lng);
    return `snapshot-${name}-${address}-${lat ?? 'na'}-${lng ?? 'na'}`.toLowerCase();
}

function hasCoordinates(source) {
    return parseCoordinate(source?.lat) !== null && parseCoordinate(source?.lng) !== null;
}

function createFallbackPlace(resourceType, resourceId, snapshot = null) {
    const address = normalizeText(snapshot?.address);
    const lat = parseCoordinate(snapshot?.lat);
    const lng = parseCoordinate(snapshot?.lng);
    const name = normalizeText(snapshot?.name) || 'Location unavailable';
    return {
        placeId: null,
        placeKey: `fallback-${resourceType}-${resourceId}`,
        name,
        address,
        lat,
        lng,
        hasCoordinates: lat !== null && lng !== null,
    };
}

function normalizePlaceSnapshot(place, fallbackIndex = 0) {
    const normalized = {
        placeId: Number.isInteger(place?.placeId) ? place.placeId : null,
        placeKey: normalizeText(place?.placeKey) || null,
        name: normalizeText(place?.name) || 'Location unavailable',
        address: normalizeText(place?.address),
        lat: parseCoordinate(place?.lat),
        lng: parseCoordinate(place?.lng),
        hasCoordinates: Boolean(place?.hasCoordinates) || hasCoordinates(place),
    };

    if (!normalized.placeKey) {
        normalized.placeKey = buildPlaceKey({ ...normalized, placeKey: `snapshot-place-${fallbackIndex}` });
    }

    return normalized;
}

function normalizeLegacySnapshot(resourceType, resourceId, snapshot) {
    const detailPath = normalizeText(snapshot?.detailPath) || buildDetailPath(resourceType, resourceId);
    return {
        version: 2,
        resourceType,
        resourceId,
        name: normalizeText(snapshot?.name) || 'Saved resource',
        bucket: normalizeText(snapshot?.bucket),
        subCategory: normalizeText(snapshot?.subCategory) || (resourceType === 'hard' ? 'Place' : 'Offering'),
        detailPath,
        descriptor: normalizeText(snapshot?.descriptor),
        logoUrl: normalizeText(snapshot?.logoUrl),
        places: [createFallbackPlace(resourceType, resourceId, snapshot)],
    };
}

export function normalizeMyMapAssetSnapshot(resourceType, resourceId, snapshot) {
    if (!snapshot || typeof snapshot !== 'object') {
        return normalizeLegacySnapshot(resourceType, resourceId, null);
    }

    if (Number(snapshot?.version) === 2 && Array.isArray(snapshot?.places)) {
        return {
            version: 2,
            resourceType,
            resourceId,
            name: normalizeText(snapshot?.name) || 'Saved resource',
            bucket: normalizeText(snapshot?.bucket),
            subCategory: normalizeText(snapshot?.subCategory) || (resourceType === 'hard' ? 'Place' : 'Offering'),
            detailPath: normalizeText(snapshot?.detailPath) || buildDetailPath(resourceType, resourceId),
            descriptor: normalizeText(snapshot?.descriptor),
            logoUrl: normalizeText(snapshot?.logoUrl),
            places: snapshot.places.map((place, index) => normalizePlaceSnapshot(place, index)),
        };
    }

    return normalizeLegacySnapshot(resourceType, resourceId, snapshot);
}

function getResourceDescriptor(resourceType, asset) {
    if (resourceType === 'soft') {
        return normalizeText(asset?.schedule) || normalizeText(asset?.venueNote) || null;
    }

    return normalizeText(asset?.hours) || null;
}

function buildPlaceSnapshot(place, fallbackIndex = 0) {
    return normalizePlaceSnapshot({
        placeId: Number.isInteger(place?.id) ? place.id : null,
        placeKey: Number.isInteger(place?.id) ? `hard-${place.id}` : `place-${fallbackIndex}`,
        name: normalizeText(place?.name) || 'Location unavailable',
        address: normalizeText(place?.address),
        lat: parseCoordinate(place?.lat),
        lng: parseCoordinate(place?.lng),
        hasCoordinates: hasCoordinates(place),
    }, fallbackIndex);
}

export function buildMyMapAssetSnapshot(resourceType, asset) {
    if (!asset) {
        return normalizeLegacySnapshot(resourceType, 0, null);
    }

    if (resourceType === 'hard') {
        return {
            version: 2,
            resourceType,
            resourceId: asset.id,
            name: normalizeText(asset.name) || 'Saved resource',
            bucket: normalizeText(asset.bucket),
            subCategory: normalizeText(asset.subCategory) || 'Place',
            detailPath: buildDetailPath('hard', asset.id),
            descriptor: getResourceDescriptor('hard', asset),
            logoUrl: normalizeText(asset.logoUrl),
            places: [buildPlaceSnapshot(asset)],
        };
    }

    const places = getSoftAssetLocations(asset).map((place, index) => buildPlaceSnapshot(place, index));
    return {
        version: 2,
        resourceType,
        resourceId: asset.id,
        name: normalizeText(asset.name) || 'Saved resource',
        bucket: normalizeText(asset.bucket),
        subCategory: normalizeText(asset.subCategory) || 'Offering',
        detailPath: buildDetailPath('soft', asset.id),
        descriptor: getResourceDescriptor('soft', asset),
        logoUrl: normalizeText(asset.logoUrl),
        places: places.length > 0 ? places : [createFallbackPlace('soft', asset.id, null)],
    };
}

function snapshotNeedsRefresh(snapshot, nextSnapshot) {
    if (!snapshot || Number(snapshot?.version) !== 2) return true;
    return JSON.stringify(normalizeMyMapAssetSnapshot(nextSnapshot.resourceType, nextSnapshot.resourceId, snapshot))
        !== JSON.stringify(normalizeMyMapAssetSnapshot(nextSnapshot.resourceType, nextSnapshot.resourceId, nextSnapshot));
}

const hardAssetQuery = {
    columns: {
        id: true,
        name: true,
        subCategory: true,
        address: true,
        lat: true,
        lng: true,
        hours: true,
        logoUrl: true,
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

const hardLocationQuery = {
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

const softAssetQuery = {
    columns: {
        id: true,
        name: true,
        bucket: true,
        subCategory: true,
        description: true,
        schedule: true,
        venueNote: true,
        logoUrl: true,
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
        hostHardAsset: hardLocationQuery,
        locations: {
            with: {
                hardAsset: hardLocationQuery,
            },
        },
    },
};

function canExposeSoftAsset(asset, visibleLocations) {
    const allLocations = getSoftAssetLocations(asset);
    if (isChildSoftAsset(asset)) {
        return visibleLocations.length > 0;
    }

    return allLocations.length === 0 || visibleLocations.length > 0;
}

async function loadLiveAsset(db, resourceType, resourceId) {
    if (resourceType === 'hard') {
        return db.query.hardAssets.findFirst({
            ...hardAssetQuery,
            where: eq(hardAssets.id, resourceId),
        });
    }

    if (resourceType === 'soft') {
        return db.query.softAssets.findFirst({
            ...softAssetQuery,
            where: eq(softAssets.id, resourceId),
        });
    }

    return null;
}

export async function buildLiveMyMapAssetSnapshotFromDb(db, resourceType, resourceId) {
    const liveAsset = await loadLiveAsset(db, resourceType, resourceId);
    return liveAsset ? buildMyMapAssetSnapshot(resourceType, liveAsset) : null;
}

function buildRow({
    mapAsset,
    place,
    snapshot,
    status,
    detailPath,
    saveEligible,
    categoryLookup,
}) {
    const categoryKey = normalizeCategoryKey(snapshot.subCategory);
    const categoryMeta = categoryKey ? categoryLookup.get(categoryKey) || null : null;

    return {
        rowKey: `${mapAsset.id}:${place.placeKey}`,
        resourceType: mapAsset.resourceType,
        resourceId: mapAsset.resourceId,
        name: snapshot.name || 'Saved resource',
        bucket: snapshot.bucket || null,
        subCategory: snapshot.subCategory || null,
        iconKey: categoryKey || null,
        categoryIconUrl: categoryMeta?.iconUrl || null,
        descriptor: snapshot.descriptor || null,
        logoUrl: snapshot.logoUrl || null,
        detailPath,
        status,
        saveEligible,
        assetKey: buildAssetKey(mapAsset.resourceType, mapAsset.resourceId),
        addedAt: mapAsset.addedAt ?? null,
    };
}

function addRowToPlace(placeMap, place, row) {
    const existing = placeMap.get(place.placeKey);
    if (existing) {
        existing.rows.push(row);
        existing.curatedCount += 1;
        return;
    }

    placeMap.set(place.placeKey, {
        placeKey: place.placeKey,
        placeId: place.placeId ?? null,
        name: place.name || 'Location unavailable',
        address: place.address || null,
        lat: place.lat ?? null,
        lng: place.lng ?? null,
        hasCoordinates: Boolean(place.hasCoordinates),
        curatedCount: 1,
        rows: [row],
    });
}

function sortDirectoryPlaces(placeMap) {
    return [...placeMap.values()]
        .map((place) => ({
            ...place,
            rows: [...place.rows].sort((a, b) => a.name.localeCompare(b.name)),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

function buildPins(places) {
    function resolveDirectoryPinCategoryIcon(place) {
        const hardPlaceRow = place.rows.find((row) => row.resourceType === 'hard' && row.categoryIconUrl);
        if (hardPlaceRow) {
            return hardPlaceRow.categoryIconUrl;
        }

        const categoryKeys = new Set();
        let sharedCategoryIconUrl = null;

        for (const row of place.rows) {
            if (!row.iconKey) continue;
            categoryKeys.add(row.iconKey);
            if (categoryKeys.size > 1) {
                return null;
            }
            sharedCategoryIconUrl = row.categoryIconUrl || null;
        }

        return categoryKeys.size === 1 ? sharedCategoryIconUrl : null;
    }

    return places
        .filter((place) => place.hasCoordinates && place.lat !== null && place.lng !== null)
        .map((place) => ({
            pinKey: place.placeKey,
            placeKey: place.placeKey,
            placeId: place.placeId,
            title: place.name,
            address: place.address,
            lat: place.lat,
            lng: place.lng,
            curatedCount: place.curatedCount,
            categoryIconUrl: resolveDirectoryPinCategoryIcon(place),
            previewResourceNames: place.rows.slice(0, 3).map((row) => row.name),
            hiddenPreviewCount: Math.max(0, place.rows.length - 3),
        }));
}

async function loadCategoryLookup(db) {
    let categoryRows = [];

    if (db.query?.subCategories?.findMany) {
        categoryRows = await db.query.subCategories.findMany({
            columns: {
                name: true,
                iconUrl: true,
            },
        });
    } else if (typeof db.select === 'function') {
        categoryRows = await db.select({
            name: subCategories.name,
            iconUrl: subCategories.iconUrl,
        }).from(subCategories);
    }

    return new Map(
        categoryRows
            .map((row) => ({
                key: normalizeCategoryKey(row.name),
                iconUrl: normalizeText(row.iconUrl),
            }))
            .filter((row) => row.key)
            .map((row) => [row.key, { iconUrl: row.iconUrl }])
    );
}

function createViewerSummary(viewerUser, ownerUserId, mapName) {
    const isAuthenticated = Boolean(viewerUser?.id);
    const isOwner = isAuthenticated && viewerUser.id === ownerUserId;
    return {
        isAuthenticated,
        isOwner,
        canSaveCopy: isAuthenticated && !isOwner,
        canSaveResources: isAuthenticated && !isOwner,
        copyDefaultName: isAuthenticated && !isOwner ? `Copy of ${mapName}` : null,
    };
}

export async function buildMyMapDirectory(db, {
    map,
    viewerUser = null,
    visibilityUser = null,
    resolutionContext = null,
    mode = 'owner',
}) {
    const placeMap = new Map();
    const snapshotUpdates = [];
    const assetSummaries = [];
    const categoryLookup = await loadCategoryLookup(db);
    const effectiveVisibilityUser = visibilityUser || viewerUser || { role: 'guest' };
    const effectiveResolutionContext = resolutionContext || {
        allowedPartnerAudienceIds: new Set(),
        allowedAudienceZoneIds: new Set(),
    };

    for (const mapAsset of map?.assets || []) {
        const snapshot = normalizeMyMapAssetSnapshot(mapAsset.resourceType, mapAsset.resourceId, mapAsset.snapshot);
        const liveAsset = await loadLiveAsset(db, mapAsset.resourceType, mapAsset.resourceId);
        const liveSnapshot = liveAsset ? buildMyMapAssetSnapshot(mapAsset.resourceType, liveAsset) : null;

        if (liveSnapshot && snapshotNeedsRefresh(mapAsset.snapshot, liveSnapshot)) {
            snapshotUpdates.push({
                mapAssetId: mapAsset.id,
                snapshot: liveSnapshot,
            });
        }

        let isLiveVisible = false;
        let sourceSnapshot = liveSnapshot || snapshot;

        if (liveAsset) {
            if (mapAsset.resourceType === 'hard') {
                isLiveVisible = isAssetVisible(liveAsset, effectiveVisibilityUser, {
                    ownerPartner: liveAsset.partner,
                    allowedPartnerAudienceIds: effectiveResolutionContext.allowedPartnerAudienceIds,
                    allowedAudienceZoneIds: effectiveResolutionContext.allowedAudienceZoneIds,
                });
            } else {
                const allLocations = getSoftAssetLocations(liveAsset);
                const visibleLocations = allLocations.filter((location) => isAssetVisible(location, effectiveVisibilityUser, {
                    ownerPartner: location.partner,
                    allowedPartnerAudienceIds: effectiveResolutionContext.allowedPartnerAudienceIds,
                    allowedAudienceZoneIds: effectiveResolutionContext.allowedAudienceZoneIds,
                }));
                const assetVisible = isAssetVisible(liveAsset, effectiveVisibilityUser, {
                    ownerPartner: liveAsset.partner,
                    allowedPartnerAudienceIds: effectiveResolutionContext.allowedPartnerAudienceIds,
                    allowedAudienceZoneIds: effectiveResolutionContext.allowedAudienceZoneIds,
                });

                isLiveVisible = assetVisible && canExposeSoftAsset(liveAsset, visibleLocations);
            }
        }

        if (!isLiveVisible) {
            sourceSnapshot = snapshot;
        }

        const detailPath = isLiveVisible ? buildDetailPath(mapAsset.resourceType, mapAsset.resourceId) : null;
        const rowBaseStatus = isLiveVisible ? 'available' : 'unavailable';
        const normalizedPlaces = Array.isArray(sourceSnapshot.places) && sourceSnapshot.places.length > 0
            ? sourceSnapshot.places.map((place, index) => normalizePlaceSnapshot(place, index))
            : [createFallbackPlace(mapAsset.resourceType, mapAsset.resourceId, sourceSnapshot)];

        assetSummaries.push({
            assetKey: buildAssetKey(mapAsset.resourceType, mapAsset.resourceId),
            resourceType: mapAsset.resourceType,
            resourceId: mapAsset.resourceId,
            status: rowBaseStatus,
        });

        for (const place of normalizedPlaces) {
            const rowStatus = rowBaseStatus === 'unavailable'
                ? 'unavailable'
                : (place.hasCoordinates ? 'available' : 'list_only');
            const row = buildRow({
                mapAsset,
                place,
                snapshot: sourceSnapshot,
                status: rowStatus,
                detailPath: rowStatus === 'unavailable' ? null : detailPath,
                saveEligible: mode === 'shared' && rowStatus !== 'unavailable',
                categoryLookup,
            });
            addRowToPlace(placeMap, place, row);
        }
    }

    const places = sortDirectoryPlaces(placeMap);
    const pins = buildPins(places);

    return {
        directory: {
            id: map.id,
            name: map.name,
            description: map.description || null,
            createdAt: map.createdAt || null,
            updatedAt: map.updatedAt || null,
            summary: {
                resourceCount: (map.assets || []).length,
                placeCount: places.length,
                mappablePlaceCount: pins.length,
            },
            share: {
                isShared: Boolean(map.isShared),
                shareToken: map.shareToken || null,
                sharePath: map.shareToken ? `/shared/maps/${map.shareToken}` : null,
                shareUpdatedAt: map.shareUpdatedAt || null,
            },
            assets: assetSummaries,
            places,
            pins,
            viewer: createViewerSummary(viewerUser, map.userId, map.name),
        },
        snapshotUpdates,
    };
}
