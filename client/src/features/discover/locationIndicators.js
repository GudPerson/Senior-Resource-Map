function hasAnyIndicator(indicators) {
    return Boolean(
        indicators?.withinAudienceZone
        || indicators?.withinHomeRegion
        || indicators?.withinContextRegion
    );
}

function normalizeIndicator(indicators) {
    return {
        withinAudienceZone: Boolean(indicators?.withinAudienceZone),
        withinHomeRegion: Boolean(indicators?.withinHomeRegion),
        withinContextRegion: Boolean(indicators?.withinContextRegion),
    };
}

function normalizePostalCode(value) {
    const digits = String(value || '').replace(/\D/g, '');
    return digits.length === 6 ? digits : '';
}

function normalizeCoordinate(value) {
    const parsed = Number.parseFloat(String(value ?? ''));
    return Number.isFinite(parsed) ? parsed : null;
}

export const LOCATION_INDICATOR_RESOURCE_LIMIT = 1000;

export function getLocationIndicatorKey(resource) {
    const type = String(resource?._type || resource?.type || resource?.resourceType || resource?.asset_type || '').trim().toLowerCase();
    const id = Number.parseInt(String(resource?.id ?? resource?.resourceId ?? ''), 10);
    if (!['hard', 'soft'].includes(type) || !Number.isInteger(id) || id <= 0) return '';
    return `${type}:${id}`;
}

export function buildLocationIndicatorResourceRefs(resources = []) {
    const seen = new Set();
    const refs = [];

    for (const resource of Array.isArray(resources) ? resources : []) {
        const key = getLocationIndicatorKey(resource);
        if (!key || seen.has(key)) continue;

        seen.add(key);
        const [type, id] = key.split(':');
        refs.push({ type, id: Number.parseInt(id, 10) });
    }

    return refs;
}

export function buildLocationIndicatorPrefetchResourceRefs(options = {}) {
    const limit = Number.isInteger(options.limit) && options.limit > 0
        ? Math.min(options.limit, LOCATION_INDICATOR_RESOURCE_LIMIT)
        : LOCATION_INDICATOR_RESOURCE_LIMIT;

    return buildLocationIndicatorResourceRefs([
        ...(Array.isArray(options.visibleResources) ? options.visibleResources : []),
        ...(Array.isArray(options.prefetchResources) ? options.prefetchResources : []),
    ]).slice(0, limit);
}

export function applyLocationIndicators(resources = [], indicatorsByKey = {}) {
    return (Array.isArray(resources) ? resources : []).map((resource) => {
        const key = getLocationIndicatorKey(resource);
        const indicators = key ? normalizeIndicator(indicatorsByKey[key]) : null;
        if (!hasAnyIndicator(indicators)) return resource;

        return {
            ...resource,
            _locationIndicators: indicators,
        };
    });
}

export function getDiscoveryLocationIndicatorPresentation(indicators = {}) {
    const normalized = normalizeIndicator(indicators);

    return {
        showAudienceStar: normalized.withinAudienceZone,
        recommendationKey: normalized.withinContextRegion
            ? 'discoveryRecommendedForThisLocation'
            : (normalized.withinHomeRegion ? 'discoveryRecommendedForYou' : ''),
    };
}

export function buildLocationIndicatorContextRequest(searchOrigin) {
    if (!searchOrigin) {
        return { payload: {}, key: '' };
    }

    if (searchOrigin.source === 'postal') {
        const contextPostalCode = normalizePostalCode(searchOrigin.postalCode);
        return contextPostalCode
            ? {
                payload: { contextPostalCode },
                key: `postal:${contextPostalCode}`,
            }
            : { payload: {}, key: '' };
    }

    if (searchOrigin.source === 'geolocation') {
        const lat = normalizeCoordinate(searchOrigin.lat);
        const lng = normalizeCoordinate(searchOrigin.lng);
        if (lat === null || lng === null) {
            return { payload: {}, key: '' };
        }

        return {
            payload: {
                contextLocation: { lat, lng },
            },
            key: `geo:${lat.toFixed(5)},${lng.toFixed(5)}`,
        };
    }

    return { payload: {}, key: '' };
}
