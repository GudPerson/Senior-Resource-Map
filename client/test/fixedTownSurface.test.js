import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    FIXED_TOWN_SURFACE_SCHEMA,
    FIXED_TOWN_SURFACE_SCHEMA_VERSION,
    doWsenBoundsIntersect,
    isFixedTownSurfaceZoomEligible,
    isPointWithinWsenBounds,
    normalizeFixedTownAssetBaseUrl,
    parseFixedTownSurfaceManifest,
    resolveFixedTownChunkUrl,
    resolveFixedTownBasemapMode,
    resolveFixedTownManifestUrl,
    selectVisibleFixedTownChunks,
    validateFixedTownSurfaceManifest,
} from '../src/lib/fixedTownSurface.js';

const GENERATED_MANIFEST_URL = new URL(
    '../../output/town-map-proof/assets/v1/w01/manifest.json',
    import.meta.url,
);
const GENERATED_MANIFEST = JSON.parse(readFileSync(GENERATED_MANIFEST_URL, 'utf8'));

function buildManifest() {
    return structuredClone(GENERATED_MANIFEST);
}

function cloneManifest() {
    return structuredClone(buildManifest());
}

test('fixed town surface manifest accepts the complete v1 contract', () => {
    const manifest = buildManifest();

    assert.equal(FIXED_TOWN_SURFACE_SCHEMA, 'carearound.fixed-town-surface');
    assert.equal(FIXED_TOWN_SURFACE_SCHEMA_VERSION, 1);
    assert.equal(validateFixedTownSurfaceManifest(manifest), true);
    assert.equal(parseFixedTownSurfaceManifest(manifest), manifest);
});

function assertManifestMutationRejected(label, mutate) {
    const manifest = cloneManifest();
    mutate(manifest);
    assert.equal(validateFixedTownSurfaceManifest(manifest), false, label);
    assert.equal(parseFixedTownSurfaceManifest(manifest), null, `${label} parse`);
}

test('fixed town surface manifest fails closed for schema and W01 identity drift', () => {
    const mutations = [
        ['schema', (manifest) => { manifest.schema = 'carearound.other-surface'; }],
        ['schema version', (manifest) => { manifest.schemaVersion = 2; }],
        ['map ID', (manifest) => { manifest.map.id = 'W02'; }],
        ['map name', (manifest) => { manifest.map.name = 'Another Town'; }],
        ['version hash prefix', (manifest) => {
            manifest.map.version = 'w01-s50-q95-g3-0000000000000000';
        }],
        ['missing source', (manifest) => { manifest.source = null; }],
        ['attribution required flag', (manifest) => { manifest.attribution.required = false; }],
        ['attribution providers', (manifest) => { manifest.attribution.html = 'Map data'; }],
    ];

    mutations.forEach(([label, mutate]) => assertManifestMutationRejected(label, mutate));
});

test('fixed town surface manifest rejects source and accepted-readability profile drift', () => {
    const mutations = [
        ['provider', (manifest) => { manifest.source.provider = 'OtherMap'; }],
        ['CRS', (manifest) => { manifest.source.crs = 'EPSG:4326'; }],
        ['source zoom', (manifest) => { manifest.source.zoom = 18; }],
        ['tile size', (manifest) => { manifest.source.tileSize = 512; }],
        ['retained scale', (manifest) => { manifest.source.retainedScale = 0.75; }],
        ['JPEG quality', (manifest) => { manifest.source.jpegQuality = 90; }],
        ['generator', (manifest) => { manifest.source.generatorVersion = 4; }],
        ['profile', (manifest) => { manifest.source.profile = 'urban-75'; }],
        ['native labels', (manifest) => { manifest.source.onemapNativeLabels = false; }],
        ['readability percent', (manifest) => { manifest.source.readabilityPercent = 174; }],
        ['readability edition', (manifest) => {
            manifest.source.readability.edition = 'readability-150';
        }],
        ['readability scale', (manifest) => {
            manifest.source.readability.scaleFactor = 1.5;
        }],
        ['readability raster resampling', (manifest) => {
            manifest.source.readability.rasterResampled = true;
        }],
        ['readability content', (manifest) => {
            manifest.source.readability.contentPreserved = false;
        }],
    ];

    mutations.forEach(([label, mutate]) => assertManifestMutationRejected(label, mutate));
});

test('fixed town surface manifest rejects missing, mismatched, or unaccepted integrity', () => {
    const mutations = [
        ['missing integrity', (manifest) => { delete manifest.integrity; }],
        ['algorithm', (manifest) => { manifest.integrity.algorithm = 'sha512'; }],
        ['chunk set', (manifest) => { manifest.integrity.chunkSetSha256 = '0'.repeat(64); }],
        ['canonicalization', (manifest) => {
            manifest.integrity.chunkSetCanonicalization = 'filename only';
        }],
        ['source manifest hash', (manifest) => {
            manifest.integrity.sourceManifestSha256 = '0'.repeat(64);
        }],
        ['readability validation hash', (manifest) => {
            manifest.integrity.readabilityValidationSha256 = '0'.repeat(64);
        }],
        ['integrity count', (manifest) => { manifest.integrity.chunkCount -= 1; }],
        ['integrity bytes', (manifest) => { manifest.integrity.chunkBytes -= 1; }],
    ];

    mutations.forEach(([label, mutate]) => assertManifestMutationRejected(label, mutate));
});

test('fixed town surface manifest rejects geographic and world-pixel drift', () => {
    const mutations = [
        ['nominal geography', (manifest) => { manifest.bounds.nominal[0] += 0.000001; }],
        ['surface geography', (manifest) => { manifest.bounds.surface[0] += 0.000001; }],
        ['nominal world pixels', (manifest) => {
            manifest.source.worldPixelBounds.nominal[0] += 0.01;
        }],
        ['surface world pixels', (manifest) => {
            manifest.source.worldPixelBounds.surface[0] += 1;
        }],
        ['chunk geography', (manifest) => { manifest.chunks[0].bounds[0] += 0.000001; }],
        ['chunk world pixels', (manifest) => { manifest.chunks[0].worldPixelBounds[0] += 1; }],
        ['fractional chunk world pixels', (manifest) => {
            manifest.chunks[0].worldPixelBounds[2] += 0.5;
        }],
    ];

    mutations.forEach(([label, mutate]) => assertManifestMutationRejected(label, mutate));
});

test('fixed town surface manifest rejects retained dimensions and grid drift', () => {
    const mutations = [
        ['native dimensions', (manifest) => { manifest.source.nativePixelDimensions[0] += 1; }],
        ['nominal retained dimensions', (manifest) => {
            manifest.retainedPixelDimensions.nominal[0] += 1;
        }],
        ['chunk grid retained dimensions', (manifest) => {
            manifest.retainedPixelDimensions.chunkGrid[1] += 1;
        }],
        ['chunk pixel dimensions', (manifest) => { manifest.chunks[0].pixelSize[0] += 1; }],
        ['source tile columns', (manifest) => { manifest.source.tileGrid.columns -= 1; }],
        ['source tile rows', (manifest) => { manifest.source.tileGrid.rows -= 1; }],
        ['source tile count', (manifest) => { manifest.source.tileGrid.sourceTiles -= 1; }],
        ['chunk columns', (manifest) => { manifest.source.tileGrid.chunkColumns -= 1; }],
        ['chunk rows', (manifest) => { manifest.source.tileGrid.chunkRows -= 1; }],
        ['duplicate grid cell', (manifest) => {
            manifest.chunks[1].column = manifest.chunks[0].column;
        }],
        ['row out of range', (manifest) => {
            manifest.chunks[0].row = manifest.source.tileGrid.chunkRows;
        }],
        ['column out of range', (manifest) => {
            manifest.chunks[0].column = manifest.source.tileGrid.chunkColumns;
        }],
        ['chunk order', (manifest) => {
            [manifest.chunks[0], manifest.chunks[1]] = [manifest.chunks[1], manifest.chunks[0]];
        }],
    ];

    mutations.forEach(([label, mutate]) => assertManifestMutationRejected(label, mutate));
});

test('fixed town surface manifest rejects transport and chunk metadata drift', () => {
    const mutations = [
        ['transport count', (manifest) => { manifest.transport.chunkCount -= 1; }],
        ['transport bytes', (manifest) => { manifest.transport.totalBytes -= 1; }],
        ['self-consistent but unaccepted byte total', (manifest) => {
            manifest.chunks[0].byteSize += 1;
            manifest.transport.totalBytes += 1;
            manifest.integrity.chunkBytes += 1;
        }],
        ['chunk bytes', (manifest) => { manifest.chunks[0].byteSize += 1; }],
        ['chunk hash', (manifest) => { manifest.chunks[0].sha256 = 'not-a-sha256'; }],
        ['chunk ID', (manifest) => { manifest.chunks[0].id = 'w01-000-000'; }],
        ['chunk ID and URL range', (manifest) => {
            manifest.chunks[0].id = 'z19-413147-260091-413153-260098';
            manifest.chunks[0].url = `chunks/${manifest.chunks[0].id}.jpg`;
        }],
        ['duplicate chunk', (manifest) => {
            manifest.chunks[1].id = manifest.chunks[0].id;
        }],
        ['unsafe chunk URL', (manifest) => {
            manifest.chunks[0].url = 'javascript:alert(1)';
        }],
    ];

    mutations.forEach(([label, mutate]) => assertManifestMutationRejected(label, mutate));
});

test('asset base and fixed-surface URLs stay version-rooted and reject unsafe schemes', () => {
    assert.equal(
        normalizeFixedTownAssetBaseUrl('  http://127.0.0.1:4178/v1/w01///  '),
        'http://127.0.0.1:4178/v1/w01',
    );
    assert.equal(normalizeFixedTownAssetBaseUrl('/town-maps/v1/w01/'), '/town-maps/v1/w01');
    assert.equal(normalizeFixedTownAssetBaseUrl('javascript:alert(1)'), '');

    assert.equal(
        resolveFixedTownManifestUrl('http://127.0.0.1:4178/v1/w01/'),
        'http://127.0.0.1:4178/v1/w01/manifest.json',
    );
    assert.equal(
        resolveFixedTownManifestUrl('https://maps.example.test/v1/w01', '/manifests/w01.json'),
        'https://maps.example.test/v1/w01/manifests/w01.json',
    );
    assert.equal(
        resolveFixedTownChunkUrl('/town-maps/v1/w01/', 'chunks/part-001.jpg'),
        '/town-maps/v1/w01/chunks/part-001.jpg',
    );
    assert.equal(
        resolveFixedTownChunkUrl(
            'https://maps.example.test/v1/w01',
            'https://cdn.example.test/w01/part-001.jpg',
        ),
        'https://cdn.example.test/w01/part-001.jpg',
    );
    assert.equal(resolveFixedTownChunkUrl('https://maps.example.test/v1/w01', '../secret'), '');
    assert.equal(resolveFixedTownChunkUrl('https://maps.example.test/v1/w01', 'data:image/jpeg;base64,abc'), '');
    assert.equal(resolveFixedTownManifestUrl(''), '');
});

test('point coverage uses lat and lng against nominal WSEN bounds', () => {
    const nominalBounds = [103.7, 1.33, 103.79, 1.4];

    assert.equal(isPointWithinWsenBounds({ lat: 1.36, lng: 103.75 }, nominalBounds), true);
    assert.equal(isPointWithinWsenBounds({ lat: '1.36', lng: '103.75' }, nominalBounds), true);
    assert.equal(isPointWithinWsenBounds({ lat: 1.33, lng: 103.7 }, nominalBounds), true);
    assert.equal(isPointWithinWsenBounds({ lat: 103.75, lng: 1.36 }, nominalBounds), false);
    assert.equal(isPointWithinWsenBounds({ lat: 1.41, lng: 103.75 }, nominalBounds), false);
    assert.equal(isPointWithinWsenBounds({ lat: null, lng: 103.75 }, nominalBounds), false);
});

test('WSEN viewport intersection includes touching edges and rejects invalid bounds', () => {
    const viewport = [103.7, 1.33, 103.75, 1.38];

    assert.equal(doWsenBoundsIntersect(viewport, [103.74, 1.37, 103.8, 1.41]), true);
    assert.equal(doWsenBoundsIntersect(viewport, [103.75, 1.38, 103.8, 1.41]), true);
    assert.equal(doWsenBoundsIntersect(viewport, [103.751, 1.381, 103.8, 1.41]), false);
    assert.equal(doWsenBoundsIntersect(viewport, [103.8, 1.4, 103.7, 1.3]), false);
});

test('visible chunk selection returns only chunks intersecting the viewport', () => {
    const chunks = [
        { id: 'west', bounds: [103.69, 1.32, 103.73, 1.36] },
        { id: 'center', bounds: [103.73, 1.32, 103.77, 1.36] },
        { id: 'east', bounds: [103.77, 1.32, 103.81, 1.36] },
        { id: 'invalid', bounds: null },
    ];

    assert.deepEqual(
        selectVisibleFixedTownChunks(chunks, [103.74, 1.33, 103.76, 1.35]).map((chunk) => chunk.id),
        ['center'],
    );
    assert.deepEqual(
        selectVisibleFixedTownChunks(chunks, [103.72, 1.33, 103.74, 1.35]).map((chunk) => chunk.id),
        ['west', 'center'],
    );
    assert.deepEqual(selectVisibleFixedTownChunks(chunks, null), []);
    assert.deepEqual(selectVisibleFixedTownChunks(null, [103.7, 1.33, 103.75, 1.38]), []);
});

test('town map zoom eligibility follows Leaflet\'s rounded tile level', () => {
    assert.equal(isFixedTownSurfaceZoomEligible(14.49, 15), false);
    assert.equal(isFixedTownSurfaceZoomEligible(14.5, 15), true);
    assert.equal(isFixedTownSurfaceZoomEligible(14.9, 15), true);
    assert.equal(isFixedTownSurfaceZoomEligible(15, 15), true);
    assert.equal(isFixedTownSurfaceZoomEligible(15.1, 15), true);
    assert.equal(isFixedTownSurfaceZoomEligible(undefined, 15), false);
    assert.equal(isFixedTownSurfaceZoomEligible(16, undefined), false);
});

test('town map auto mode respects availability, zoom, and the Live override', () => {
    assert.equal(resolveFixedTownBasemapMode({
        preference: 'auto',
        townAvailable: true,
        zoom: 15,
        minZoom: 15,
    }), 'town');
    assert.equal(resolveFixedTownBasemapMode({
        preference: 'auto',
        townAvailable: true,
        zoom: 14.49,
        minZoom: 15,
    }), 'live');
    assert.equal(resolveFixedTownBasemapMode({
        preference: 'auto',
        townAvailable: false,
        zoom: 18,
        minZoom: 15,
    }), 'live');
    assert.equal(resolveFixedTownBasemapMode({
        preference: 'live',
        townAvailable: true,
        zoom: 18,
        minZoom: 15,
    }), 'live');
    assert.equal(resolveFixedTownBasemapMode({
        preference: 'town',
        townAvailable: true,
        zoom: 16,
        minZoom: 15,
    }), 'town');
});
