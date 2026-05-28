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
