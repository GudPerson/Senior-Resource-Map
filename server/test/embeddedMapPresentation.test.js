import test from 'node:test';
import assert from 'node:assert/strict';

import {
    DEFAULT_EMBEDDED_MAP_PRESENTATION,
    buildEmbeddedMapPresentationSnapshot,
    buildEmbeddedMapResourceAllowlist,
    filterEmbeddedMapAnnotationsByDesign,
    filterEmbeddedMapDirectoryByResourceAllowlist,
    normalizeEmbeddedMapPresentationSnapshot,
} from '../src/utils/embeddedMapPresentation.js';

test('embed presentation snapshots only the public-safe design fields', () => {
    const snapshot = buildEmbeddedMapPresentationSnapshot({
        basemap: { style: 'gray', detailMode: 'live' },
        camera: { mode: 'fixed', view: { center: [1.3, 103.8], zoom: 17 } },
        pins: { style: 'numbered', size: 'extra-large' },
        labels: { detail: 'full' },
        layers: {
            resources: 'hide',
            annotations: 'hide',
            hiddenResourceLayerKeys: ['hard:1'],
            hiddenAnnotationIds: ['private-annotation'],
        },
        layout: { preset: 'map-focus', mapSide: 'right', resourceColumnCount: 6 },
        exportSettings: { imageQuality: 'high', margins: 'wide' },
    });

    assert.deepEqual(snapshot, {
        version: 1,
        mapStyle: 'gray',
        detailMode: 'live',
        pinStyle: 'numbered',
        pinSize: 'extra-large',
        pinsVisible: false,
        annotationsVisible: false,
    });
    assert.deepEqual(Object.keys(snapshot), [
        'version',
        'mapStyle',
        'detailMode',
        'pinStyle',
        'pinSize',
        'pinsVisible',
        'annotationsVisible',
    ]);
});

test('invalid or legacy embed presentation payloads fail closed to stable defaults', () => {
    assert.deepEqual(
        normalizeEmbeddedMapPresentationSnapshot({ version: 99, mapStyle: 'gray' }),
        DEFAULT_EMBEDDED_MAP_PRESENTATION,
    );
    assert.deepEqual(
        normalizeEmbeddedMapPresentationSnapshot({
            version: 1,
            mapStyle: 'unsafe',
            detailMode: 'unsafe',
            pinStyle: 'unsafe',
            pinSize: 'unsafe',
            pinsVisible: 'no',
            annotationsVisible: null,
        }),
        DEFAULT_EMBEDDED_MAP_PRESENTATION,
    );
});

function createDirectory() {
    return {
        assets: [
            { assetKey: 'hard-1', resourceType: 'hard', resourceId: 1 },
            { assetKey: 'hard-2', resourceType: 'hard', resourceId: 2 },
        ],
        places: [
            {
                placeKey: 'hard-1',
                hasCoordinates: true,
                curatedCount: 1,
                rows: [{
                    assetKey: 'hard-1',
                    resourceType: 'hard',
                    resourceId: 1,
                    subCategory: ' Active   Ageing Centre ',
                }],
            },
            {
                placeKey: 'hard-2',
                hasCoordinates: true,
                curatedCount: 1,
                rows: [{
                    assetKey: 'hard-2',
                    resourceType: 'hard',
                    resourceId: 2,
                    subCategory: 'Senior Care Centre',
                }],
            },
        ],
        pins: [
            { placeKey: 'hard-1' },
            { placeKey: 'hard-2' },
        ],
        summary: {
            resourceCount: 2,
            savedResourceCount: 2,
            placeCount: 2,
            mappablePlaceCount: 2,
        },
    };
}

test('selected Studio resource layers become a public content allowlist', () => {
    const directory = createDirectory();
    const resourceKeys = buildEmbeddedMapResourceAllowlist(directory, {
        layers: {
            hiddenResourceLayerKeys: [
                'resource:carearound:category:active ageing centre',
            ],
        },
    });

    assert.deepEqual(resourceKeys, ['hard-2']);
    const filtered = filterEmbeddedMapDirectoryByResourceAllowlist(directory, resourceKeys);
    assert.deepEqual(filtered.assets.map((asset) => asset.assetKey), ['hard-2']);
    assert.deepEqual(filtered.places.map((place) => place.placeKey), ['hard-2']);
    assert.deepEqual(filtered.pins.map((pin) => pin.placeKey), ['hard-2']);
    assert.deepEqual(filtered.summary, {
        resourceCount: 1,
        savedResourceCount: 1,
        placeCount: 1,
        mappablePlaceCount: 1,
    });
});

test('absent resource allowlist preserves legacy snapshots', () => {
    const directory = createDirectory();
    assert.equal(filterEmbeddedMapDirectoryByResourceAllowlist(directory, undefined), directory);
});

test('selected Studio annotation layers only keep visible shared annotations', () => {
    const annotations = [{ id: 'visible' }, { id: 'hidden' }];
    assert.deepEqual(filterEmbeddedMapAnnotationsByDesign(annotations, {
        layers: {
            annotations: 'show',
            hiddenAnnotationIds: ['hidden'],
        },
    }), [{ id: 'visible' }]);
    assert.deepEqual(filterEmbeddedMapAnnotationsByDesign(annotations, {
        layers: {
            annotations: 'hide',
            hiddenAnnotationIds: [],
        },
    }), []);
});
