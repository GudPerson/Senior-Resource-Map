import test from 'node:test';
import assert from 'node:assert/strict';

import {
    DEFAULT_EMBEDDED_MAP_PRESENTATION,
    buildEmbeddedMapPresentationSnapshot,
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
