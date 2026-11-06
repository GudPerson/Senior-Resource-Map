export const MAX_MAP_SELECTED_PLACES = 500;

const positiveId = value => Number.isSafeInteger(value) && value > 0;

export function invalidMapLocationScope() {
    const error = new Error('The selected venues are no longer available for this resource. Refresh the results and choose again.');
    error.status = 400;
    error.code = 'MAP_LOCATION_SCOPE_INVALID';
    return error;
}

export function validateSelectedPlaceIds(value) {
    if (value === undefined || value === null) return null;
    if (!Array.isArray(value) || value.length < 1 || value.length > MAX_MAP_SELECTED_PLACES
        || !value.every(positiveId) || new Set(value).size !== value.length) throw invalidMapLocationScope();
    return [...value].sort((a, b) => a - b);
}

// Missing/null is the legacy all-venues contract. A corrupt non-null scope is
// explicitly empty, never converted into all venues by a normalizer or refresh.
export function normalizeMapLocationScope(value) {
    if (value === undefined || value === null) return null;
    try {
        if (!value || value.version !== 1) return { version: 1, placeIds: [] };
        const placeIds = validateSelectedPlaceIds(value.placeIds);
        return { version: 1, placeIds: placeIds || [] };
    } catch { return { version: 1, placeIds: [] }; }
}

export function snapshotMapLocationScope(snapshot) {
    return normalizeMapLocationScope(snapshot?.mapLocationScope);
}

export function applyMapLocationScope(snapshot, scope) {
    if (scope === null) return snapshot;
    const ids = new Set(scope.placeIds);
    return { ...snapshot, mapLocationScope: { version: 1, placeIds: [...scope.placeIds] },
        places: (snapshot?.places || []).filter(place => ids.has(place.placeId)) };
}

export function projectScopedMapPlaces(places, scope, permittedIds, { owner = false, resourceKey = '' } = {}) {
    const selected = new Set(scope.placeIds);
    const visible = places.filter(place => selected.has(place.placeId) && permittedIds.has(place.placeId));
    if (owner && (visible.length < selected.size || selected.size === 0)) visible.push({
        placeId: null, placeKey: `unavailable-scope-${resourceKey}`, name: 'Selected venue unavailable',
        address: null, postalCode: null, lat: null, lng: null, hasCoordinates: false,
        mapScopeUnavailable: true,
    });
    return visible;
}

export function scopedResourceKeysFromMapAssets(assets = []) {
    return [...new Set(assets.filter(asset => snapshotMapLocationScope(asset.snapshot) !== null)
        .map(asset => `${asset.resourceType}-${asset.resourceId}`))].sort();
}

export function normalizeScopedResourceKeys(value, fallbackAssets = [], version) {
    if (value === undefined && version === undefined) return new Set();
    if (version !== 1 || !Array.isArray(value) || value.length === 0
        || !value.every(key => typeof key === 'string' && /^(hard|soft)-[1-9]\d*$/.test(key))) {
        return new Set(fallbackAssets.map(asset => `${asset.resourceType}-${asset.resourceId}`));
    }
    return new Set(value);
}

export function stripMapLocationScopeMetadata(value) {
    if (Array.isArray(value)) return value.map(stripMapLocationScopeMetadata);
    if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) return value;
    return Object.fromEntries(Object.entries(value)
        .filter(([key]) => !['mapLocationScope', 'mapLocationScopeVersion', 'scopedResourceKeys'].includes(key))
        .map(([key, item]) => [key, stripMapLocationScopeMetadata(item)]));
}
