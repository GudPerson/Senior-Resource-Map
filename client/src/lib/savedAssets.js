function normalizeText(value) {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text ? text : null;
}

function parseCoordinate(value) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export function buildSavedAssetKey(resourceType, resourceId) {
    return `${resourceType}-${resourceId}`;
}

export function buildSavedAssetDetailPath(resourceType, resourceId) {
    return `/resource/${resourceType}/${resourceId}`;
}

export function buildOptimisticSavedAsset(resourceType, resourceId, summary = {}) {
    return {
        id: null,
        userId: null,
        resourceType,
        resourceId,
        createdAt: new Date().toISOString(),
        assetKey: buildSavedAssetKey(resourceType, resourceId),
        status: 'available',
        hasCoordinates: parseCoordinate(summary?.lat) !== null && parseCoordinate(summary?.lng) !== null,
        name: normalizeText(summary?.name) || 'Saved resource',
        subCategory: normalizeText(summary?.subCategory) || (resourceType === 'hard' ? 'Place' : 'Offering'),
        address: normalizeText(summary?.address),
        lat: parseCoordinate(summary?.lat),
        lng: parseCoordinate(summary?.lng),
        detailPath: normalizeText(summary?.detailPath) || buildSavedAssetDetailPath(resourceType, resourceId),
    };
}
