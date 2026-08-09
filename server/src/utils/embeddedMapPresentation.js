export const EMBEDDED_MAP_PRESENTATION_VERSION = 1;

export const DEFAULT_EMBEDDED_MAP_PRESENTATION = Object.freeze({
    version: EMBEDDED_MAP_PRESENTATION_VERSION,
    mapStyle: 'default',
    detailMode: 'auto',
    pinStyle: 'category-bubble',
    pinSize: 'standard',
    pinsVisible: true,
    annotationsVisible: true,
});

const RESOURCE_GROUP_CAREAROUND = 'resource:carearound';
const RESOURCE_GROUP_PERSONAL = 'resource:personal';

function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeLayerLabel(value, fallback = 'Other') {
    const label = String(value || '').trim().replace(/\s+/g, ' ');
    return label || fallback;
}

function normalizeLayerToken(value) {
    return normalizeLayerLabel(value)
        .normalize('NFKC')
        .toLocaleLowerCase('en-SG')
        .slice(0, 160);
}

function getResourceGroupKey(row = {}) {
    return row.resourceType === 'personal_place'
        ? RESOURCE_GROUP_PERSONAL
        : RESOURCE_GROUP_CAREAROUND;
}

function getResourceCategoryLayerKey(row = {}) {
    const groupKey = getResourceGroupKey(row);
    return `${groupKey}:category:${normalizeLayerToken(row.subCategory)}`;
}

function getResourceKey(row = {}) {
    const explicitKey = String(row.assetKey || '').trim();
    if (explicitKey) return explicitKey;
    const resourceType = String(row.resourceType || '').trim();
    const resourceId = Number(row.resourceId);
    return resourceType && Number.isSafeInteger(resourceId) && resourceId > 0
        ? `${resourceType}-${resourceId}`
        : '';
}

/**
 * Resolve persisted resource-layer choices into a content allowlist without
 * publishing the private Studio layer ids themselves.
 */
export function buildEmbeddedMapResourceAllowlist(directory, design) {
    const hiddenLayerKeys = new Set(
        Array.isArray(design?.layers?.hiddenResourceLayerKeys)
            ? design.layers.hiddenResourceLayerKeys.map((key) => String(key || '').trim()).filter(Boolean)
            : [],
    );
    const resourceKeys = [];

    for (const place of directory?.places || []) {
        for (const row of place?.rows || []) {
            const resourceKey = getResourceKey(row);
            if (!resourceKey) continue;
            const groupKey = getResourceGroupKey(row);
            const categoryKey = getResourceCategoryLayerKey(row);
            if (hiddenLayerKeys.has(groupKey) || hiddenLayerKeys.has(categoryKey)) continue;
            resourceKeys.push(resourceKey);
        }
    }

    return [...new Set(resourceKeys)].sort();
}

export function filterEmbeddedMapDirectoryByResourceAllowlist(directory, resourceKeys) {
    if (!directory || !Array.isArray(resourceKeys)) return directory;
    const allowedKeys = new Set(resourceKeys.map((key) => String(key || '').trim()).filter(Boolean));
    const assets = Array.isArray(directory.assets)
        ? directory.assets.filter((asset) => allowedKeys.has(getResourceKey(asset)))
        : directory.assets;
    let resourceCount = 0;
    const places = (directory.places || []).flatMap((place) => {
        const rows = (place.rows || []).filter((row) => allowedKeys.has(getResourceKey(row)));
        if (!rows.length) return [];
        resourceCount += rows.length;
        return [{ ...place, rows, curatedCount: rows.length }];
    });
    const visiblePlaceKeys = new Set(places.map((place) => String(place.placeKey || '')));
    const pins = Array.isArray(directory.pins)
        ? directory.pins.filter((pin) => visiblePlaceKeys.has(String(pin.placeKey || '')))
        : directory.pins;

    return {
        ...directory,
        ...(Array.isArray(directory.assets) ? { assets } : {}),
        places,
        ...(Array.isArray(directory.pins) ? { pins } : {}),
        summary: {
            ...(directory.summary || {}),
            resourceCount,
            savedResourceCount: resourceCount,
            placeCount: places.length,
            mappablePlaceCount: places.filter((place) => place.hasCoordinates).length,
        },
    };
}

export function filterEmbeddedMapAnnotationsByDesign(annotations, design) {
    const source = Array.isArray(annotations) ? annotations : [];
    if (design?.layers?.annotations === 'hide') return [];
    const hiddenIds = new Set(
        Array.isArray(design?.layers?.hiddenAnnotationIds)
            ? design.layers.hiddenAnnotationIds.map((id) => String(id || '').trim()).filter(Boolean)
            : [],
    );
    return source.filter((annotation) => !hiddenIds.has(String(annotation?.id || '')));
}

export function buildEmbeddedMapPresentationSnapshot(design) {
    return {
        version: EMBEDDED_MAP_PRESENTATION_VERSION,
        mapStyle: design?.basemap?.style === 'gray' ? 'gray' : 'default',
        detailMode: design?.basemap?.detailMode === 'live' ? 'live' : 'auto',
        pinStyle: ['numbered', 'category-icon'].includes(design?.pins?.style)
            ? design.pins.style
            : 'category-bubble',
        pinSize: ['large', 'extra-large'].includes(design?.pins?.size)
            ? design.pins.size
            : 'standard',
        pinsVisible: design?.layers?.resources !== 'hide',
        annotationsVisible: design?.layers?.annotations !== 'hide',
    };
}

export function normalizeEmbeddedMapPresentationSnapshot(value) {
    if (!isObject(value) || Number(value.version) !== EMBEDDED_MAP_PRESENTATION_VERSION) {
        return { ...DEFAULT_EMBEDDED_MAP_PRESENTATION };
    }
    return buildEmbeddedMapPresentationSnapshot({
        basemap: {
            style: value.mapStyle,
            detailMode: value.detailMode,
        },
        pins: {
            style: value.pinStyle,
            size: value.pinSize,
        },
        layers: {
            resources: value.pinsVisible === false ? 'hide' : 'show',
            annotations: value.annotationsVisible === false ? 'hide' : 'show',
        },
    });
}
