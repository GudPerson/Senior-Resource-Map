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

export function selectBulkSavedAssetTargets(items, savedAssetKeys, shouldSave) {
    const currentKeys = savedAssetKeys instanceof Set ? savedAssetKeys : new Set();
    const desiredSavedState = Boolean(shouldSave);
    const seenKeys = new Set();

    return (Array.isArray(items) ? items : []).reduce((targets, item) => {
        const resourceType = String(item?.resourceType || '').trim().toLowerCase();
        const resourceId = Number(item?.resourceId);
        if (!['hard', 'soft'].includes(resourceType) || !Number.isInteger(resourceId) || resourceId <= 0) {
            return targets;
        }

        const assetKey = buildSavedAssetKey(resourceType, resourceId);
        if (seenKeys.has(assetKey)) return targets;
        seenKeys.add(assetKey);

        if (currentKeys.has(assetKey) !== desiredSavedState) {
            targets.push({ resourceType, resourceId });
        }
        return targets;
    }, []);
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
