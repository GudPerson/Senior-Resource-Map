import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
    DISCOVER_DETAILED_MAX_DECODED_BYTES,
    DISCOVER_DETAILED_UAT_MAX_DECODED_BYTES,
    isDiscoverDetailedMapFeatureEnabled,
    resolveDiscoverDetailedContainmentCamera,
    resolveDiscoverDetailedBasemap,
    resolveDiscoverDetailedMaxDecodedBytes,
} from '../src/features/discover/discoverDetailedMap.js';

const discoveryMapSource = await readFile(
    new URL('../src/features/discover/DiscoveryMap.jsx', import.meta.url),
    'utf8',
);
const detailedBasemapSource = await readFile(
    new URL('../src/features/discover/DiscoverDetailedBasemap.jsx', import.meta.url),
    'utf8',
);
const detailedBasemapDecisionSource = await readFile(
    new URL('../src/features/discover/discoverDetailedMap.js', import.meta.url),
    'utf8',
);
const ownerMapSource = await readFile(
    new URL('../src/pages/MyMapDetailPage.jsx', import.meta.url),
    'utf8',
);
const embeddedMapSource = await readFile(
    new URL('../src/hooks/useEmbeddedDetailedMap.js', import.meta.url),
    'utf8',
);

const VIEWPORT = [103.70, 1.34, 103.72, 1.36];

function buildManifest({
    id,
    bytesPerChunk = 4 * 1024 * 1024,
    chunkCount = 2,
} = {}) {
    const side = Math.sqrt(bytesPerChunk / 4);
    return {
        map: { id },
        bounds: { surface: [103.68, 1.32, 103.75, 1.40] },
        chunks: Array.from({ length: chunkCount }, (_, index) => ({
            id: `${id}-${index}`,
            bounds: [103.68, 1.32, 103.75, 1.40],
            pixelSize: [side, side],
        })),
    };
}

function readySurface(id, options) {
    return {
        configured: true,
        status: 'ready',
        candidate: true,
        surfaceId: id,
        manifest: buildManifest({ id, ...options }),
        assetBaseUrl: `https://maps.example/${id}`,
    };
}

test('Discover Detailed activation requires its own client flag and the established map contract', () => {
    assert.equal(isDiscoverDetailedMapFeatureEnabled({}), false);
    assert.equal(isDiscoverDetailedMapFeatureEnabled({
        VITE_DISCOVER_DETAILED_MAP_ENABLED: 'true',
    }), false);
    assert.equal(isDiscoverDetailedMapFeatureEnabled({
        VITE_DISCOVER_DETAILED_MAP_ENABLED: 'true',
        VITE_TOWN_MAP_PROOF_ENABLED: 'true',
    }), true);
});

test('Discover retains 256 MiB by default and raises only the explicitly feature-gated UAT ceiling to 384 MiB', () => {
    assert.equal(resolveDiscoverDetailedMaxDecodedBytes({}), 256 * 1024 * 1024);
    assert.equal(resolveDiscoverDetailedMaxDecodedBytes({
        VITE_DISCOVER_DETAILED_MAP_UAT_384_MIB_ENABLED: 'true',
    }), 256 * 1024 * 1024);
    assert.equal(resolveDiscoverDetailedMaxDecodedBytes({
        VITE_DISCOVER_DETAILED_MAP_ENABLED: 'true',
        VITE_TOWN_MAP_PROOF_ENABLED: 'true',
    }), 256 * 1024 * 1024);
    assert.equal(resolveDiscoverDetailedMaxDecodedBytes({
        VITE_DISCOVER_DETAILED_MAP_ENABLED: 'true',
        VITE_TOWN_MAP_PROOF_ENABLED: 'true',
        VITE_DISCOVER_DETAILED_MAP_UAT_384_MIB_ENABLED: 'true',
    }), 384 * 1024 * 1024);
});

test('Discover uses live at displayed 13, overview at 14, native at 15, and reverses without changing fractional zoom', () => {
    const native = readySurface('native');
    const overview = readySurface('overview');
    const samples = [13.49, 13.5, 14.5, 14.49, 13.49].map((zoom) => (
        resolveDiscoverDetailedBasemap({
            enabled: true,
            zoom,
            viewportBounds: VIEWPORT,
            native,
            overview,
        })
    ));

    assert.deepEqual(samples.map((sample) => [sample.displayedZoom, sample.mode, sample.tier]), [
        [13, 'live', 'live'],
        [14, 'detailed', 'overview'],
        [15, 'detailed', 'native'],
        [14, 'detailed', 'overview'],
        [13, 'live', 'live'],
    ]);
});

test('Discover keeps live tiles and Detailed imagery mutually exclusive while manifests resolve', () => {
    const loading = resolveDiscoverDetailedBasemap({
        enabled: true,
        zoom: 14,
        viewportBounds: VIEWPORT,
        native: readySurface('native'),
        overview: { configured: true, status: 'loading', candidate: true },
    });
    const ready = resolveDiscoverDetailedBasemap({
        enabled: true,
        zoom: 14,
        viewportBounds: VIEWPORT,
        native: readySurface('native'),
        overview: readySurface('overview'),
    });

    assert.equal(loading.pending, true);
    assert.equal(loading.renderLiveTiles, false);
    assert.equal(loading.renderSurface, false);
    assert.equal(ready.renderLiveTiles, false);
    assert.equal(ready.renderSurface, true);
});

test('Discover falls back to live OneMap outside coverage and after source or chunk loading failures', () => {
    const outside = resolveDiscoverDetailedBasemap({
        enabled: true,
        zoom: 15,
        viewportBounds: [103.90, 1.40, 103.92, 1.42],
        native: readySurface('native'),
        overview: readySurface('overview'),
    });
    const sourceFailure = resolveDiscoverDetailedBasemap({
        enabled: true,
        zoom: 15,
        viewportBounds: VIEWPORT,
        native: { configured: true, status: 'error', candidate: true },
        overview: readySurface('overview'),
    });
    const chunkFailure = resolveDiscoverDetailedBasemap({
        enabled: true,
        zoom: 15,
        viewportBounds: VIEWPORT,
        native: readySurface('native'),
        overview: readySurface('overview'),
        faultReason: 'chunk-load-error',
    });

    [outside, sourceFailure, chunkFailure].forEach((decision) => {
        assert.equal(decision.mode, 'live');
        assert.equal(decision.renderLiveTiles, true);
        assert.equal(decision.renderSurface, false);
    });
});

test('Discover enforces the standard 256 MiB decoded-memory ceiling before mounting a surface', () => {
    const decision = resolveDiscoverDetailedBasemap({
        enabled: true,
        zoom: 15,
        viewportBounds: VIEWPORT,
        native: readySurface('native', {
            bytesPerChunk: 128 * 1024 * 1024,
            chunkCount: 3,
        }),
        overview: readySurface('overview'),
    });

    assert.equal(DISCOVER_DETAILED_MAX_DECODED_BYTES, 256 * 1024 * 1024);
    assert.equal(decision.reason, 'viewport-memory-limit');
    assert.equal(decision.renderLiveTiles, true);
    assert.equal(decision.renderSurface, false);
});

test('Discover UAT ceiling admits the observed 347 MiB viewport and still fails closed above 384 MiB', () => {
    const eligible = resolveDiscoverDetailedBasemap({
        enabled: true,
        zoom: 15,
        viewportBounds: VIEWPORT,
        native: readySurface('native', {
            bytesPerChunk: 1 * 1024 * 1024,
            chunkCount: 347,
        }),
        overview: readySurface('overview'),
        maxDecodedBytes: DISCOVER_DETAILED_UAT_MAX_DECODED_BYTES,
    });
    const overLimit = resolveDiscoverDetailedBasemap({
        enabled: true,
        zoom: 15,
        viewportBounds: VIEWPORT,
        native: readySurface('native', {
            bytesPerChunk: 1 * 1024 * 1024,
            chunkCount: 385,
        }),
        overview: readySurface('overview'),
        maxDecodedBytes: DISCOVER_DETAILED_UAT_MAX_DECODED_BYTES,
    });

    assert.equal(DISCOVER_DETAILED_UAT_MAX_DECODED_BYTES, 384 * 1024 * 1024);
    assert.equal(eligible.visibleDecodedBytes, 347 * 1024 * 1024);
    assert.equal(eligible.reason, 'surface-ready');
    assert.equal(eligible.renderLiveTiles, false);
    assert.equal(eligible.renderSurface, true);
    assert.equal(overLimit.reason, 'viewport-memory-limit');
    assert.equal(overLimit.renderLiveTiles, true);
    assert.equal(overLimit.renderSurface, false);
});

test('Discover can contain a zoom-15 entry camera without changing its displayed zoom step', () => {
    const manifest = {
        bounds: { surface: [0, 0, 100, 80] },
        chunks: [{
            id: 'native-0',
            bounds: [0, 0, 100, 80],
            pixelSize: [1024, 1024],
        }],
    };
    const project = ({ lat, lng }, zoom) => {
        const scale = 2 ** (zoom - 15);
        return { x: lng * scale, y: (80 - lat) * scale };
    };
    const unproject = ({ x, y }, zoom) => {
        const scale = 2 ** (zoom - 15);
        return { lat: 80 - (y / scale), lng: x / scale };
    };
    const camera = resolveDiscoverDetailedContainmentCamera({
        center: { lat: 40, lng: 95 },
        currentZoom: 15,
        manifest,
        maximumZoom: 18,
        project,
        unproject,
        viewportSize: { x: 20, y: 20 },
    });

    assert.ok(camera);
    assert.equal(camera.zoom, 15);
    assert.equal(Math.round(camera.zoom), 15);
    assert.equal(camera.center.lng, 88);
    assert.deepEqual(camera.viewportBounds, [78, 30, 98, 50]);
});

test('Discover containment stays fail-closed when no camera fits inside the current displayed zoom step', () => {
    const manifest = {
        bounds: { surface: [0, 0, 10, 10] },
        chunks: [{
            id: 'native-0',
            bounds: [0, 0, 10, 10],
            pixelSize: [1024, 1024],
        }],
    };
    const project = ({ lat, lng }, zoom) => {
        const scale = 2 ** (zoom - 15);
        return { x: lng * scale, y: (10 - lat) * scale };
    };
    const unproject = ({ x, y }, zoom) => {
        const scale = 2 ** (zoom - 15);
        return { lat: 10 - (y / scale), lng: x / scale };
    };

    assert.equal(resolveDiscoverDetailedContainmentCamera({
        center: { lat: 5, lng: 5 },
        currentZoom: 15,
        manifest,
        maximumZoom: 18,
        project,
        unproject,
        viewportSize: { x: 30, y: 30 },
    }), null);
});

test('Discover integrates a basemap-only adapter without replacing its map or touching My Map and embed loaders', () => {
    assert.match(discoveryMapSource, /<DiscoverDetailedBasemap/);
    assert.match(discoveryMapSource, /<SavedMapCameraController/);
    assert.match(discoveryMapSource, /<TrackedPinLayoutReporter/);
    assert.match(discoveryMapSource, /renderedPins\.map/);
    assert.doesNotMatch(discoveryMapSource, /<DirectoryMap|from ['"].*DirectoryMap/);

    assert.match(detailedBasemapDecisionSource, /VITE_DISCOVER_DETAILED_MAP_ENABLED/);
    assert.match(detailedBasemapDecisionSource, /VITE_DISCOVER_DETAILED_MAP_UAT_384_MIB_ENABLED/);
    assert.match(detailedBasemapSource, /VITE_TOWN_MAP_GRAY_ASSET_BASE_URL/);
    assert.match(detailedBasemapSource, /VITE_TOWN_MAP_GRAY_OVERVIEW_ASSET_BASE_URL/);
    assert.match(detailedBasemapSource, /<FixedTownSurfaceLayer/);
    assert.match(detailedBasemapSource, /map\.on\('zoom moveend resize'/);
    assert.match(detailedBasemapSource, /manifestInFlightRef/);
    assert.match(detailedBasemapSource, /manifestCacheRef/);
    assert.match(detailedBasemapSource, /function DiscoverDetailedZoomContainmentSync/);
    assert.match(detailedBasemapSource, /map\.on\('zoomend', handleZoomEnd\)/);
    assert.doesNotMatch(detailedBasemapSource, /map\.on\('moveend', handleZoomEnd\)/);
    assert.match(detailedBasemapSource, /decision\.renderLiveTiles \? liveTiles : null/);
    assert.match(detailedBasemapSource, /lockMinZoom=\{false\}/);
    assert.match(detailedBasemapSource, /fallbackBelowMinZoom=\{false\}/);

    assert.doesNotMatch(ownerMapSource, /VITE_DISCOVER_DETAILED_MAP_ENABLED/);
    assert.doesNotMatch(embeddedMapSource, /VITE_DISCOVER_DETAILED_MAP_ENABLED/);
    assert.doesNotMatch(ownerMapSource, /VITE_DISCOVER_DETAILED_MAP_UAT_384_MIB_ENABLED/);
    assert.doesNotMatch(embeddedMapSource, /VITE_DISCOVER_DETAILED_MAP_UAT_384_MIB_ENABLED/);
});
