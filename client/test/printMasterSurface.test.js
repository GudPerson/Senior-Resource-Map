import test from 'node:test';
import assert from 'node:assert/strict';

import {
    composePrintMasterBasemap,
    fetchPrintMasterChunkResponse,
    getPrintMasterViewportWorldBounds,
    projectLonLatToWorldPixel,
    resolveFixedTownSurfaceId,
    resolvePrintMasterChunkUrl,
    resolvePrintMasterManifestUrl,
    selectPrintMasterChunks,
    validatePrintMasterManifest,
} from '../src/lib/printMasterSurface.js';

function buildManifest(bounds = [103.7, 1.33, 103.8, 1.41]) {
    const [left, top, right, bottom] = getPrintMasterViewportWorldBounds(bounds, 19);
    const middle = (left + right) / 2;
    return {
        schema: 'carearound.print-master/v1',
        id: 'W01',
        bounds,
        source_retention_scale: 1,
        source: { zoom: 19 },
        chunks: [
            {
                id: 'left', url: 'chunks/W01/left.jpg', left, top, right: middle, bottom,
                width: Math.round(middle - left), height: Math.round(bottom - top), sha256: 'a'.repeat(64),
            },
            {
                id: 'right', url: 'chunks/W01/right.jpg', left: middle, top, right, bottom,
                width: Math.round(right - middle), height: Math.round(bottom - top), sha256: 'b'.repeat(64),
            },
        ],
    };
}

test('print master manifest remains a separate strict 100% source contract', () => {
    const manifest = validatePrintMasterManifest(buildManifest(), { expectedSurfaceId: 'w01' });
    assert.equal(manifest.id, 'W01');
    assert.equal(manifest.sourceRetentionScale, 1);
    assert.equal(manifest.chunks.length, 2);
    assert.throws(() => validatePrintMasterManifest({ ...buildManifest(), source_retention_scale: 0.5 }));
    assert.throws(() => validatePrintMasterManifest({
        ...buildManifest(),
        chunks: [{ ...buildManifest().chunks[0], url: '../private.jpg' }],
    }));
});

test('print master URLs keep Default and Gray assets in versioned independent roots', () => {
    assert.equal(
        resolvePrintMasterManifestUrl('https://maps.example/print/default/', 'W01', 'default'),
        'https://maps.example/print/default/manifests/w01-default-print-master-100.json',
    );
    assert.equal(
        resolvePrintMasterManifestUrl('https://maps.example/print/gray', 'W01', 'gray'),
        'https://maps.example/print/gray/manifests/w01-grey-print-master-100.json',
    );
    assert.equal(
        resolvePrintMasterChunkUrl('https://maps.example/print/gray/', 'chunks/W01/chunk.jpg'),
        'https://maps.example/print/gray/chunks/W01/chunk.jpg',
    );
});

test('print master resolves the active surface from the fixed-town web manifest contract', () => {
    assert.equal(resolveFixedTownSurfaceId({ map: { id: 'w01' } }), 'W01');
    assert.equal(resolveFixedTownSurfaceId({ id: 'w02' }), 'W02');
    assert.equal(resolveFixedTownSurfaceId({}), '');
});

test('Web Mercator projection and viewport selection retain exact z19 alignment', () => {
    const singapore = projectLonLatToWorldPixel(103.75, 1.37, 19);
    assert.ok(singapore[0] > 105_000_000 && singapore[0] < 106_000_000);
    assert.ok(singapore[1] > 66_000_000 && singapore[1] < 67_000_000);
    const manifest = validatePrintMasterManifest(buildManifest());
    const viewport = getPrintMasterViewportWorldBounds([103.7, 1.33, 103.75, 1.41], 19);
    assert.deepEqual(selectPrintMasterChunks(manifest.chunks, viewport).map(({ id }) => id), ['left']);
});

test('print master composition loads and releases visible chunks sequentially', async () => {
    const events = [];
    const drawCalls = [];
    const context = {
        fillStyle: '',
        imageSmoothingEnabled: false,
        imageSmoothingQuality: '',
        fillRect() {},
        drawImage(image) { drawCalls.push(image.id); },
    };
    const canvas = { width: 0, height: 0, getContext: () => context };
    const result = await composePrintMasterBasemap({
        manifest: buildManifest(),
        assetBaseUrl: 'https://maps.example/print/default',
        viewportBounds: [103.7, 1.33, 103.8, 1.41],
        width: 2400,
        height: 1600,
        canvasFactory: () => canvas,
        loadChunkImage: async (url) => {
            const id = url.endsWith('left.jpg') ? 'left' : 'right';
            events.push(`load:${id}`);
            return { image: { id }, close: () => events.push(`close:${id}`) };
        },
    });
    assert.equal(result, canvas);
    assert.equal(canvas.width, 2400);
    assert.equal(canvas.height, 1600);
    assert.deepEqual(drawCalls, ['left', 'right']);
    assert.deepEqual(events, ['load:left', 'close:left', 'load:right', 'close:right']);
});

test('print master retries transient chunk fetch failures without hiding hard 4xx errors', async () => {
    const waits = [];
    const requestCacheModes = [];
    const transientStatuses = [new TypeError('Failed to fetch'), { ok: false, status: 503 }, { ok: true, status: 200 }];
    const recovered = await fetchPrintMasterChunkResponse(
        'https://maps.example/print/default/chunk.jpg',
        async (_url, options) => {
            requestCacheModes.push(options.cache);
            const next = transientStatuses.shift();
            if (next instanceof Error) throw next;
            return next;
        },
        { waitImpl: async (delayMs) => waits.push(delayMs) },
    );
    assert.equal(recovered.status, 200);
    assert.deepEqual(waits, [500, 1000]);
    assert.deepEqual(requestCacheModes, ['force-cache', 'reload', 'reload']);

    let hardFailureAttempts = 0;
    const notFound = await fetchPrintMasterChunkResponse(
        'https://maps.example/print/default/missing.jpg',
        async () => {
            hardFailureAttempts += 1;
            return { ok: false, status: 404 };
        },
        { waitImpl: async () => assert.fail('404 responses must not be retried') },
    );
    assert.equal(notFound.status, 404);
    assert.equal(hardFailureAttempts, 1);
});
