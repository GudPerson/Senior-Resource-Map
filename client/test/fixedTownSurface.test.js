import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    FIXED_TOWN_SURFACE_SCHEMA,
    FIXED_TOWN_SURFACE_INDEX_SCHEMA,
    FIXED_TOWN_SURFACE_INDEX_SCHEMA_VERSION,
    FIXED_TOWN_SURFACE_SCHEMA_VERSION,
    FIXED_TOWN_OVERVIEW_MIN_ZOOM,
    areWsenBoundsContained,
    doWsenBoundsIntersect,
    fetchFixedTownSurfaceManifest,
    fetchFixedTownSurfaceSource,
    isFixedTownSurfaceZoomEligible,
    isFixedTownSurfaceViewportCovered,
    isPointWithinWsenBounds,
    normalizeFixedTownStandardZoom,
    normalizeFixedTownAssetBaseUrl,
    parseFixedTownSurfaceIndex,
    parseFixedTownSurfaceManifest,
    resolveFixedTownChunkUrl,
    resolveFixedTownDisplayZoomStep,
    resolveFixedTownBasemapMode,
    resolveFixedTownMinimumZoomSnap,
    resolveFixedTownManifestUrl,
    resolveFixedTownSurfaceAssetBaseUrl,
    resolveFixedTownSurfaceManifestPath,
    resolveFixedTownSurfaceTier,
    resolveFixedTownTransitionMinZoom,
    selectFixedTownSurfaceForViewport,
    selectVisibleFixedTownChunks,
    shouldCapFixedTownRequestedLiveTiles,
    shouldDeferFixedTownContainmentToLowerTier,
    shouldRetryFixedTownSurfaceMemoryFallback,
    validateFixedTownSurfaceIndex,
    validateFixedTownSurfaceManifest,
} from '../src/lib/fixedTownSurface.js';

const GENERATED_MANIFEST_URL = new URL(
    '../../output/town-map-proof/assets/v1/w01/manifest.json',
    import.meta.url,
);
const GENERATED_MANIFEST = JSON.parse(readFileSync(GENERATED_MANIFEST_URL, 'utf8'));
const GENERATED_GRAY_MANIFEST = JSON.parse(readFileSync(new URL(
    '../../output/town-map-proof/assets/v1/w01/gray/manifest.json',
    import.meta.url,
), 'utf8'));
const GENERATED_ISLANDWIDE_ROOT = new URL(
    '../../output/town-map-proof/assets/v1/islandwide/',
    import.meta.url,
);

function buildManifest() {
    return structuredClone(GENERATED_MANIFEST);
}

function cloneManifest() {
    return structuredClone(buildManifest());
}

function buildOverviewManifest() {
    const manifest = cloneManifest();
    const sourceManifestSha256 = 'b'.repeat(64);
    const sourceCollectionManifestSha256 = 'c'.repeat(64);
    manifest.map.version = 'w01-overview-z17-s25-q95-g1-81bd26441edaff1d';
    manifest.source.retainedScale = 0.25;
    manifest.source.generatorVersion = 1;
    manifest.source.profile = 'overview-25';
    manifest.source.profileLabel = '25% z19 zoom-14 overview';
    manifest.source.cartographicRenderZoom = 17;
    manifest.source.labelTarget = 'native OneMap zoom-17 proportions';
    manifest.source.readability = {
        edition: 'zoom14-overview-v1',
        scaleFactor: 0.5,
        rasterResampled: true,
        embeddedImageStreamsPreserved: false,
        textPreserved: true,
        contentPreserved: true,
    };
    manifest.source.overview = {
        edition: 'zoom14-overview-v1',
        targetDisplayZoom: 14,
        sourceCartographicRenderZoom: 18,
        sourceRetainedScale: 0.5,
        resampling: 'LANCZOS',
        sourceManifestSha256,
        sourceCollectionManifestSha256,
    };
    manifest.integrity.sourceManifestSha256 = sourceManifestSha256;
    manifest.integrity.sourceCollectionManifestSha256 = sourceCollectionManifestSha256;

    const columnWidths = new Map();
    const rowHeights = new Map();
    manifest.chunks.forEach((chunk) => {
        const [left, top, right, bottom] = chunk.worldPixelBounds;
        chunk.pixelSize = [
            Math.round((right - left) * 0.25),
            Math.round((bottom - top) * 0.25),
        ];
        columnWidths.set(chunk.column, chunk.pixelSize[0]);
        rowHeights.set(chunk.row, chunk.pixelSize[1]);
    });
    const [left, top, right, bottom] = manifest.source.worldPixelBounds.nominal;
    manifest.retainedPixelDimensions.nominal = [
        Math.round((right - left) * 0.25),
        Math.round((bottom - top) * 0.25),
    ];
    manifest.retainedPixelDimensions.chunkGrid = [
        [...columnWidths.entries()]
            .sort(([leftColumn], [rightColumn]) => leftColumn - rightColumn)
            .reduce((sum, [, width]) => sum + width, 0),
        [...rowHeights.entries()]
            .sort(([leftRow], [rightRow]) => leftRow - rightRow)
            .reduce((sum, [, height]) => sum + height, 0),
    ];
    return manifest;
}

function buildOverviewAtlasManifest(style = 'default') {
    const manifest = buildOverviewManifest();
    manifest.map.id = 'SG14';
    manifest.map.name = 'Singapore Zoom-14 Detailed Map Atlas';
    manifest.map.style = style;
    manifest.map.version = `sg14-atlas-z17-${style}-s25-q95-g1-81bd26441edaff1d`;
    manifest.source.readability = {
        ...manifest.source.readability,
        edition: 'zoom14-overview-atlas-v1',
        scaleFactor: 1,
        rasterResampled: false,
    };
    manifest.source.overview = {
        ...manifest.source.overview,
        edition: 'zoom14-overview-atlas-v1',
        sourceCartographicRenderZoom: 17,
        sourceRetainedScale: 1,
        resampling: 'NONE',
    };
    if (style === 'gray') manifest.source.style = 'Grey';
    return manifest;
}

test('fixed town surface manifest accepts the complete v1 contract', () => {
    const manifest = buildManifest();

    assert.equal(FIXED_TOWN_SURFACE_SCHEMA, 'carearound.fixed-town-surface');
    assert.equal(FIXED_TOWN_SURFACE_SCHEMA_VERSION, 1);
    assert.equal(validateFixedTownSurfaceManifest(manifest), true);
    assert.equal(parseFixedTownSurfaceManifest(manifest), manifest);
});

test('fixed town surface manifest accepts the completed native Gray W01 edition', () => {
    assert.equal(validateFixedTownSurfaceManifest(GENERATED_GRAY_MANIFEST), true);
    assert.equal(parseFixedTownSurfaceManifest(GENERATED_GRAY_MANIFEST), GENERATED_GRAY_MANIFEST);

    const changedStyle = structuredClone(GENERATED_GRAY_MANIFEST);
    changedStyle.map.style = 'default';
    assert.equal(validateFixedTownSurfaceManifest(changedStyle), false);

    const changedSource = structuredClone(GENERATED_GRAY_MANIFEST);
    changedSource.integrity.sourceAlignmentSha256 = '0'.repeat(64);
    assert.equal(validateFixedTownSurfaceManifest(changedSource), false);
});

test('fixed town surface manifest accepts generic non-W01 islandwide plates without weakening W01 identity checks', () => {
    const genericManifest = buildManifest();
    genericManifest.map.id = 'NW01';
    genericManifest.map.name = 'Woodlands';
    genericManifest.map.version = 'nw01-s50-q95-g3-81bd26441edaff1d';
    genericManifest.map.style = 'default';

    assert.equal(validateFixedTownSurfaceManifest(genericManifest), true);
    assert.equal(parseFixedTownSurfaceManifest(genericManifest), genericManifest);

    const mismatchedVersion = structuredClone(genericManifest);
    mismatchedVersion.map.version = 'w01-s50-q95-g3-81bd26441edaff1d';
    assert.equal(validateFixedTownSurfaceManifest(mismatchedVersion), false);

    const sparseSourceTileCount = structuredClone(genericManifest);
    sparseSourceTileCount.source.tileGrid.sourceTiles -= 1;
    assert.equal(validateFixedTownSurfaceManifest(sparseSourceTileCount), true);
    sparseSourceTileCount.source.tileGrid.sourceTiles = sparseSourceTileCount.source.tileGrid.columns
        * sparseSourceTileCount.source.tileGrid.rows
        + 1;
    assert.equal(validateFixedTownSurfaceManifest(sparseSourceTileCount), false);
});

test('fixed town surface manifest accepts only the explicit zoom-14 overview profile', () => {
    const overviewManifest = buildOverviewManifest();
    assert.equal(validateFixedTownSurfaceManifest(overviewManifest), true);
    assert.equal(FIXED_TOWN_OVERVIEW_MIN_ZOOM, 14);

    const wrongResampling = structuredClone(overviewManifest);
    wrongResampling.source.overview.resampling = 'BILINEAR';
    assert.equal(validateFixedTownSurfaceManifest(wrongResampling), false);

    const wrongDisplayZoom = structuredClone(overviewManifest);
    wrongDisplayZoom.source.overview.targetDisplayZoom = 13;
    assert.equal(validateFixedTownSurfaceManifest(wrongDisplayZoom), false);

    const untrackedRaster = structuredClone(overviewManifest);
    untrackedRaster.source.readability.rasterResampled = false;
    assert.equal(validateFixedTownSurfaceManifest(untrackedRaster), false);
});

test('fixed town surface manifest accepts the complete zoom-14 atlas provenance profile', () => {
    const atlasManifest = buildOverviewAtlasManifest();
    assert.equal(validateFixedTownSurfaceManifest(atlasManifest), true);

    const grayAtlasManifest = buildOverviewAtlasManifest('gray');
    assert.equal(validateFixedTownSurfaceManifest(grayAtlasManifest), true);

    const atlasWithLegacyResampling = structuredClone(atlasManifest);
    atlasWithLegacyResampling.source.overview.resampling = 'LANCZOS';
    assert.equal(validateFixedTownSurfaceManifest(atlasWithLegacyResampling), false);

    const atlasWithUntrackedScale = structuredClone(atlasManifest);
    atlasWithUntrackedScale.source.readability.scaleFactor = 0.5;
    assert.equal(validateFixedTownSurfaceManifest(atlasWithUntrackedScale), false);
});

test('generated islandwide indexes and per-surface manifests pass the fixed-surface contract', () => {
    const defaultIndex = JSON.parse(readFileSync(new URL('manifest.json', GENERATED_ISLANDWIDE_ROOT), 'utf8'));
    const grayIndex = JSON.parse(readFileSync(new URL('gray/manifest.json', GENERATED_ISLANDWIDE_ROOT), 'utf8'));

    assert.equal(validateFixedTownSurfaceIndex(defaultIndex), true);
    assert.equal(validateFixedTownSurfaceIndex(grayIndex), true);
    assert.equal(defaultIndex.surfaces.length, 32);
    assert.equal(grayIndex.surfaces.length, 32);
    assert.equal(defaultIndex.transport.chunkCount, 9127);
    assert.equal(grayIndex.transport.chunkCount, 2741);

    for (const surface of defaultIndex.surfaces) {
        const manifest = JSON.parse(readFileSync(new URL(surface.manifestPath, GENERATED_ISLANDWIDE_ROOT), 'utf8'));
        assert.equal(validateFixedTownSurfaceManifest(manifest), true, `default ${surface.id}`);
        assert.equal(manifest.chunks.length, surface.chunkCount, `default ${surface.id} chunk count`);
    }

    for (const surface of grayIndex.surfaces) {
        const manifest = JSON.parse(readFileSync(new URL(`gray/${surface.manifestPath}`, GENERATED_ISLANDWIDE_ROOT), 'utf8'));
        assert.equal(validateFixedTownSurfaceManifest(manifest), true, `gray ${surface.id}`);
        assert.equal(manifest.chunks.length, surface.chunkCount, `gray ${surface.id} chunk count`);
    }
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

test('fixed town surface index selects a viewport plate and resolves per-surface asset roots', () => {
    const manifest = buildManifest();
    const surface = {
        id: 'W01',
        name: manifest.map.name,
        style: 'default',
        version: manifest.map.version,
        planningAreas: manifest.planningAreas,
        profile: manifest.source.profile,
        retainedScale: manifest.source.retainedScale,
        retainedPixelDimensions: manifest.retainedPixelDimensions.chunkGrid,
        bounds: manifest.bounds,
        manifestPath: 'surfaces/W01/manifest.json',
        assetBasePath: 'surfaces/W01',
        chunkCount: manifest.transport.chunkCount,
        totalBytes: manifest.transport.totalBytes,
        chunkSetSha256: manifest.integrity.chunkSetSha256,
    };
    const nearbySurface = {
        ...surface,
        id: 'W02',
        name: 'Bukit Panjang',
        version: 'w02-s50-q95-g3-81bd26441edaff1d',
        bounds: {
            nominal: [103.79, 1.33, 103.83, 1.39],
            surface: [103.79, 1.33, 103.83, 1.39],
        },
        manifestPath: 'surfaces/W02/manifest.json',
        assetBasePath: 'surfaces/W02',
    };
    const broadOverlapSurface = {
        ...surface,
        id: 'N02',
        name: 'Mandai - Central Catchment',
        version: 'n02-s40-q95-g3-81bd26441edaff1d',
        bounds: {
            nominal: [103.72, 1.33, 103.88, 1.45],
            surface: [103.72, 1.33, 103.88, 1.45],
        },
        manifestPath: 'surfaces/N02/manifest.json',
        assetBasePath: 'surfaces/N02',
    };
    const index = {
        schema: FIXED_TOWN_SURFACE_INDEX_SCHEMA,
        schemaVersion: FIXED_TOWN_SURFACE_INDEX_SCHEMA_VERSION,
        collection: {
            id: 'sg-islandwide-fixed-town-surfaces',
            name: 'Singapore Islandwide Detailed Map',
            style: 'default',
            version: 'sg-islandwide-default-81bd26441edaff1d',
        },
        bounds: { surface: [103.68, 1.32, 103.84, 1.41] },
        source: {
            provider: 'OneMap',
            crs: 'EPSG:3857',
            zoom: 19,
            tileSize: 256,
            readabilityPercent: 175,
        },
        attribution: manifest.attribution,
        transport: {
            surfaceCount: 2,
            chunkCount: surface.chunkCount + nearbySurface.chunkCount,
            totalBytes: surface.totalBytes + nearbySurface.totalBytes,
        },
        integrity: {
            algorithm: 'sha256',
            surfaceSetSha256: 'a'.repeat(64),
        },
        surfaces: [surface, nearbySurface],
    };

    assert.equal(validateFixedTownSurfaceIndex(index), true);
    assert.equal(parseFixedTownSurfaceIndex(index), index);
    assert.equal(resolveFixedTownSurfaceManifestPath(surface), 'surfaces/W01/manifest.json');
    assert.equal(
        resolveFixedTownSurfaceAssetBaseUrl('https://maps.example.test/v1/islandwide', surface),
        'https://maps.example.test/v1/islandwide/surfaces/W01',
    );
    assert.equal(
        selectFixedTownSurfaceForViewport(index, [103.70, 1.34, 103.74, 1.38], []).id,
        'W01',
    );
    assert.equal(
        selectFixedTownSurfaceForViewport(index, [103.80, 1.34, 103.82, 1.38], [
            { id: 'older-cck-pin', lat: 1.35, lng: 103.70 },
            { id: 'another-cck-pin', lat: 1.36, lng: 103.71 },
        ]).id,
        'W02',
    );
    assert.equal(
        selectFixedTownSurfaceForViewport(index, [103.90, 1.20, 103.91, 1.21], [
            { id: 'older-cck-pin', lat: 1.35, lng: 103.70 },
        ]),
        null,
    );

    const overlapIndex = {
        ...index,
        bounds: { surface: [103.68, 1.32, 103.89, 1.46] },
        transport: {
            surfaceCount: 3,
            chunkCount: surface.chunkCount + nearbySurface.chunkCount + broadOverlapSurface.chunkCount,
            totalBytes: surface.totalBytes + nearbySurface.totalBytes + broadOverlapSurface.totalBytes,
        },
        surfaces: [broadOverlapSurface, surface, nearbySurface],
    };
    assert.equal(validateFixedTownSurfaceIndex(overlapIndex), true);
    assert.equal(
        selectFixedTownSurfaceForViewport(overlapIndex, [103.743, 1.383, 103.745, 1.385], [
            { id: 'cck-pin', lat: 1.384, lng: 103.744 },
            { id: 'woodlands-pin-on-broad-overlap', lat: 1.438, lng: 103.796 },
        ]).id,
        'W01',
    );
    assert.equal(
        selectFixedTownSurfaceForViewport(overlapIndex, [103.743, 1.383, 103.85, 1.385], [
            { id: 'cck-pin', lat: 1.384, lng: 103.744 },
        ]).id,
        'N02',
    );
    assert.equal(
        areWsenBoundsContained([103.743, 1.383, 103.745, 1.385], surface.bounds.surface),
        true,
    );
    assert.equal(
        areWsenBoundsContained([103.743, 1.383, 103.88, 1.385], surface.bounds.surface),
        false,
    );

    const unsafeIndex = structuredClone(index);
    unsafeIndex.surfaces[0].manifestPath = '../W01/manifest.json';
    assert.equal(validateFixedTownSurfaceIndex(unsafeIndex), false);
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

test('fixed town source loading accepts either a single manifest or an islandwide index', async () => {
    const manifestSource = await fetchFixedTownSurfaceSource('https://maps.example.test/v1/w01', {
        fetchImpl: async () => ({
            ok: true,
            status: 200,
            json: async () => buildManifest(),
        }),
        retryDelaysMs: [0],
    });
    assert.equal(manifestSource.type, 'manifest');
    assert.equal(manifestSource.manifest.map.id, 'W01');

    const indexSource = await fetchFixedTownSurfaceSource('https://maps.example.test/v1/islandwide', {
        fetchImpl: async () => ({
            ok: true,
            status: 200,
            json: async () => ({
                schema: FIXED_TOWN_SURFACE_INDEX_SCHEMA,
                schemaVersion: FIXED_TOWN_SURFACE_INDEX_SCHEMA_VERSION,
                collection: {
                    id: 'sg-islandwide-fixed-town-surfaces',
                    style: 'default',
                    version: 'sg-islandwide-default-81bd26441edaff1d',
                },
                surfaces: [{
                    id: 'W01',
                    name: GENERATED_MANIFEST.map.name,
                    style: 'default',
                    version: GENERATED_MANIFEST.map.version,
                    bounds: GENERATED_MANIFEST.bounds,
                    manifestPath: 'surfaces/W01/manifest.json',
                    assetBasePath: 'surfaces/W01',
                }],
            }),
        }),
        retryDelaysMs: [0],
    });
    assert.equal(indexSource.type, 'index');
    assert.equal(indexSource.index.surfaces[0].id, 'W01');
});

test('fixed town manifest loading retries transient failures and then returns the accepted manifest', async () => {
    const responses = [
        () => Promise.reject(new TypeError('temporary network failure')),
        () => Promise.resolve({ ok: false, status: 503 }),
        () => Promise.resolve({
            ok: true,
            status: 200,
            json: async () => buildManifest(),
        }),
    ];
    const requestedUrls = [];
    const fetchImpl = async (url) => {
        requestedUrls.push(url);
        return responses.shift()();
    };

    const manifest = await fetchFixedTownSurfaceManifest('https://maps.example.test/v1/w01', {
        fetchImpl,
        retryDelaysMs: [0, 0, 0],
    });

    assert.equal(manifest.map.id, 'W01');
    assert.deepEqual(requestedUrls, [
        'https://maps.example.test/v1/w01/manifest.json',
        'https://maps.example.test/v1/w01/manifest.json',
        'https://maps.example.test/v1/w01/manifest.json',
    ]);
});

test('fixed town manifest loading fails closed without retrying permanent responses', async () => {
    let requestCount = 0;
    const fetchImpl = async () => {
        requestCount += 1;
        return { ok: false, status: 404 };
    };

    await assert.rejects(
        fetchFixedTownSurfaceManifest('https://maps.example.test/v1/w01', {
            fetchImpl,
            retryDelaysMs: [0, 0, 0],
        }),
        /failed \(404\)/,
    );
    assert.equal(requestCount, 1);
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

test('zoom-14 overview tier never replaces the native zoom-15 tier', () => {
    const resolveTier = (zoom, overviewConfigured = true) => resolveFixedTownSurfaceTier({
        zoom,
        nativeMinZoom: 15,
        overviewMinZoom: FIXED_TOWN_OVERVIEW_MIN_ZOOM,
        overviewConfigured,
    });

    assert.equal(resolveTier(null), 'native');
    assert.equal(resolveTier(13.5), 'native');
    assert.equal(resolveTier(13.99), 'native');
    assert.equal(resolveTier(14), 'overview');
    assert.equal(resolveTier(14.49), 'overview');
    assert.equal(resolveTier(14.5), 'overview');
    assert.equal(resolveTier(14.99), 'overview');
    assert.equal(resolveTier(15), 'native');
    assert.equal(resolveTier(14, false), 'native');
});

test('continuous overview is a recovery tier when zoom-15 native coverage is unavailable', () => {
    assert.equal(resolveFixedTownSurfaceTier({
        zoom: 15,
        nativeMinZoom: 15,
        overviewMinZoom: 14,
        overviewConfigured: true,
        nativeUnavailable: true,
    }), 'overview');
    assert.equal(resolveFixedTownSurfaceTier({
        zoom: 15,
        nativeMinZoom: 15,
        overviewMinZoom: 14,
        overviewConfigured: false,
        nativeUnavailable: true,
    }), 'native');
    assert.equal(resolveFixedTownSurfaceTier({
        zoom: 13.9,
        nativeMinZoom: 15,
        overviewMinZoom: 14,
        overviewConfigured: true,
        nativeUnavailable: true,
    }), 'native');
});

test('fixed town viewport coverage requires full bounds and at least one visible chunk', () => {
    const manifest = {
        bounds: { surface: [103.7, 1.3, 103.8, 1.4] },
        chunks: [
            { id: 'inside', bounds: [103.72, 1.32, 103.78, 1.38] },
        ],
    };

    assert.equal(isFixedTownSurfaceViewportCovered(
        manifest,
        [103.73, 1.33, 103.77, 1.37],
    ), true);
    assert.equal(isFixedTownSurfaceViewportCovered(
        manifest,
        [103.69, 1.33, 103.77, 1.37],
    ), false);
    assert.equal(isFixedTownSurfaceViewportCovered(manifest, null), null);
    assert.equal(isFixedTownSurfaceViewportCovered(null, [103.73, 1.33, 103.77, 1.37]), null);
});

test('fixed town transition threshold expands only when overview assets are configured', () => {
    assert.equal(resolveFixedTownTransitionMinZoom(), 15);
    assert.equal(resolveFixedTownTransitionMinZoom({
        nativeMinZoom: 15,
        overviewMinZoom: 14,
        overviewConfigured: false,
    }), 15);
    assert.equal(resolveFixedTownTransitionMinZoom({
        nativeMinZoom: 15,
        overviewMinZoom: 14,
        overviewConfigured: true,
    }), 14);
    assert.equal(resolveFixedTownTransitionMinZoom({
        nativeMinZoom: 15,
        overviewMinZoom: 'invalid',
        overviewConfigured: true,
    }), 15);
});

test('native containment yields while a configured lower tier takes over', () => {
    assert.equal(shouldDeferFixedTownContainmentToLowerTier({
        zoom: 14.6,
        activeMinZoom: 15,
        transitionMinZoom: 14,
    }), true);
    assert.equal(shouldDeferFixedTownContainmentToLowerTier({
        zoom: 15,
        activeMinZoom: 15,
        transitionMinZoom: 14,
    }), false);
    assert.equal(shouldDeferFixedTownContainmentToLowerTier({
        zoom: 14.6,
        activeMinZoom: 15,
        transitionMinZoom: 15,
    }), false);
    assert.equal(shouldDeferFixedTownContainmentToLowerTier({
        zoom: 13.9,
        activeMinZoom: 15,
        transitionMinZoom: 14,
    }), false);
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

test('Standard map normalizes only the fractional gap below Detailed', () => {
    assert.equal(normalizeFixedTownStandardZoom(14.3, 15), 14);
    assert.equal(normalizeFixedTownStandardZoom(14.49, 15), 14);
    assert.equal(normalizeFixedTownStandardZoom(14, 15), 14);
    assert.equal(normalizeFixedTownStandardZoom(13.5, 15), 13.5);
    assert.equal(normalizeFixedTownStandardZoom(14.5, 15), 14.5);
    assert.equal(normalizeFixedTownStandardZoom(15, 15), 15);
    assert.equal(normalizeFixedTownStandardZoom(14.3, null), 14.3);
    assert.equal(normalizeFixedTownStandardZoom(undefined, 15), Number.NaN);
});

test('print-only Detailed recovery snaps a rounded eligible zoom to the exact minimum', () => {
    assert.equal(resolveFixedTownMinimumZoomSnap({
        enabled: true,
        zoom: 14.9,
        minZoom: 15,
        viewportEligible: false,
    }), 15);
    assert.equal(resolveFixedTownMinimumZoomSnap({
        enabled: true,
        zoom: 14.49,
        minZoom: 15,
        viewportEligible: false,
    }), null);
    assert.equal(resolveFixedTownMinimumZoomSnap({
        enabled: true,
        zoom: 14.9,
        minZoom: 15,
        viewportEligible: true,
    }), null);
    assert.equal(resolveFixedTownMinimumZoomSnap({
        enabled: false,
        zoom: 14.9,
        minZoom: 15,
        viewportEligible: false,
    }), null);
    assert.equal(resolveFixedTownMinimumZoomSnap({
        enabled: true,
        zoom: 15,
        minZoom: 15,
        viewportEligible: false,
    }), null);
});

test('memory fallback retries after fractional containment advances within displayed zoom 15', () => {
    assert.equal(shouldRetryFixedTownSurfaceMemoryFallback({
        currentZoom: 15,
        fallbackZoom: 15,
    }), false);
    assert.equal(shouldRetryFixedTownSurfaceMemoryFallback({
        currentZoom: 15.04,
        fallbackZoom: 15,
    }), false);
    assert.equal(shouldRetryFixedTownSurfaceMemoryFallback({
        currentZoom: 15.1,
        fallbackZoom: 15,
    }), true);
    assert.equal(shouldRetryFixedTownSurfaceMemoryFallback({
        currentZoom: 15.2,
        fallbackZoom: 15.1,
    }), true);
    assert.equal(shouldRetryFixedTownSurfaceMemoryFallback({
        currentZoom: 14.9,
        fallbackZoom: 15,
    }), false);
    assert.equal(shouldRetryFixedTownSurfaceMemoryFallback({
        currentZoom: null,
        fallbackZoom: 15,
    }), false);
    assert.equal(shouldRetryFixedTownSurfaceMemoryFallback({
        currentZoom: 15.1,
        fallbackZoom: null,
    }), false);
});

test('print containment keeps fractional Detailed zooms in their visible integer step', () => {
    assert.equal(resolveFixedTownDisplayZoomStep({
        zoom: 15.6,
        preserveContainmentStep: true,
    }), 15);
    assert.equal(resolveFixedTownDisplayZoomStep({
        zoom: 16.6,
        preserveContainmentStep: true,
    }), 16);
    assert.equal(resolveFixedTownDisplayZoomStep({
        zoom: 15.6,
    }), 16);
    assert.equal(resolveFixedTownDisplayZoomStep({
        zoom: undefined,
        preserveContainmentStep: true,
    }), null);
});

test('requested Detailed mode caps live tiles only while its viewport can be covered', () => {
    assert.equal(shouldCapFixedTownRequestedLiveTiles({
        townRequested: true,
        surfaceConfigured: true,
        viewportEligible: null,
    }), true);
    assert.equal(shouldCapFixedTownRequestedLiveTiles({
        townRequested: true,
        surfaceConfigured: true,
        viewportEligible: true,
    }), true);
    assert.equal(shouldCapFixedTownRequestedLiveTiles({
        townRequested: true,
        surfaceConfigured: true,
        viewportEligible: false,
    }), false);
    assert.equal(shouldCapFixedTownRequestedLiveTiles({
        townRequested: true,
        surfaceConfigured: true,
        viewportEligible: true,
        surfaceFaulted: true,
    }), false);
    assert.equal(shouldCapFixedTownRequestedLiveTiles({
        townRequested: false,
        surfaceConfigured: true,
        viewportEligible: true,
    }), false);
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
