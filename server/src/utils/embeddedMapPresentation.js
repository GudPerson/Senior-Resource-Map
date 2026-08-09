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

function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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
