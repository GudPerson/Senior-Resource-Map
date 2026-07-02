function normalizePlaceKey(value) {
    const text = String(value || '').trim();
    return text || '';
}

function getMappedHardPlaceKeyById(directory = {}) {
    const lookup = new Map();

    (directory?.places || []).forEach((place) => {
        if (!place?.hasCoordinates) return;
        const placeKey = normalizePlaceKey(place.placeKey);
        if (!placeKey) return;

        if (Number.isInteger(place.placeId) && place.placeId > 0) {
            lookup.set(place.placeId, placeKey);
        }

        (place.rows || []).forEach((row) => {
            if (row?.resourceType !== 'hard') return;
            const id = Number(row.resourceId);
            if (Number.isInteger(id) && id > 0) {
                lookup.set(id, placeKey);
            }
        });
    });

    return lookup;
}

function resolveGroupFocusPlaceKeys(groupDetail = {}, mappedHardPlaceKeyById = new Map()) {
    if (groupDetail?.assetMode !== 'group') return [];

    const keys = [];
    const seen = new Set();
    const places = Array.isArray(groupDetail?.groupMembers?.places)
        ? groupDetail.groupMembers.places
        : [];

    places.forEach((place) => {
        const id = Number(place?.id);
        const key = Number.isInteger(id) && id > 0 ? mappedHardPlaceKeyById.get(id) : '';
        if (!key || seen.has(key)) return;
        keys.push(key);
        seen.add(key);
    });

    return keys;
}

function rowNeedsGroupFocusFallback(row = {}) {
    return row.resourceType === 'soft'
        && row.status !== 'unavailable'
        && !row.mapFocusPlaceKeys?.length
        && Number.isInteger(Number(row.resourceId));
}

export function getGroupFocusFallbackResourceIds(directory = {}) {
    const ids = new Set();

    (directory?.places || []).forEach((place) => {
        (place.rows || []).forEach((row) => {
            if (!rowNeedsGroupFocusFallback(row)) return;
            ids.add(Number(row.resourceId));
        });
    });

    return [...ids];
}

export function mergeGroupFocusDetailsIntoDirectory(directory, groupDetailsByResourceId = new Map()) {
    if (!directory || !groupDetailsByResourceId?.size) return directory;

    const mappedHardPlaceKeyById = getMappedHardPlaceKeyById(directory);
    if (!mappedHardPlaceKeyById.size) return directory;

    let changed = false;
    const places = (directory.places || []).map((place) => {
        let placeChanged = false;
        const rows = (place.rows || []).map((row) => {
            if (!rowNeedsGroupFocusFallback(row)) return row;

            const groupDetail = groupDetailsByResourceId.get(Number(row.resourceId));
            const mapFocusPlaceKeys = resolveGroupFocusPlaceKeys(groupDetail, mappedHardPlaceKeyById);
            if (!mapFocusPlaceKeys.length) return row;

            changed = true;
            placeChanged = true;
            return {
                ...row,
                mapFocusPlaceKeys,
            };
        });

        return placeChanged ? { ...place, rows } : place;
    });

    return changed ? { ...directory, places } : directory;
}

