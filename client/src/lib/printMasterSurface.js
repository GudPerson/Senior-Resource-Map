const PRINT_MASTER_SCHEMAS = new Set([
    'carearound.print-master/v1',
    'carearound.grey-print-master/v1',
]);

const WEB_MERCATOR_TILE_SIZE = 256;
const PRINT_MASTER_CHUNK_FETCH_ATTEMPTS = 5;
const PRINT_MASTER_CHUNK_RETRY_DELAYS_MS = [500, 1000, 2000, 4000];

function isFiniteNumber(value) {
    return Number.isFinite(Number(value));
}

function normalizeBounds(value) {
    if (!Array.isArray(value) || value.length !== 4 || !value.every(isFiniteNumber)) return null;
    const [west, south, east, north] = value.map(Number);
    if (west >= east || south >= north) return null;
    return [west, south, east, north];
}

function normalizeChunk(chunk) {
    const worldPixelBounds = [chunk?.left, chunk?.top, chunk?.right, chunk?.bottom].map(Number);
    const width = Number(chunk?.width ?? chunk?.retained_width);
    const height = Number(chunk?.height ?? chunk?.retained_height);
    const url = String(chunk?.url || '').trim();
    if (
        !chunk?.id
        || worldPixelBounds.some((value) => !Number.isFinite(value))
        || worldPixelBounds[0] >= worldPixelBounds[2]
        || worldPixelBounds[1] >= worldPixelBounds[3]
        || !Number.isFinite(width)
        || width <= 0
        || !Number.isFinite(height)
        || height <= 0
        || !url
        || url.startsWith('/')
        || url.includes('..')
        || /^[a-z]+:/i.test(url)
    ) {
        return null;
    }
    return {
        ...chunk,
        id: String(chunk.id),
        url,
        worldPixelBounds,
        pixelSize: [Math.round(width), Math.round(height)],
    };
}

export function normalizePrintMasterAssetBaseUrl(value) {
    return String(value || '').trim().replace(/\/+$/, '');
}

export function resolveFixedTownSurfaceId(manifest) {
    return String(manifest?.map?.id || manifest?.id || '').trim().toUpperCase();
}

export function validatePrintMasterManifest(value, { expectedSurfaceId = '' } = {}) {
    if (!value || typeof value !== 'object' || !PRINT_MASTER_SCHEMAS.has(value.schema)) {
        throw new Error('Print master files use an unsupported manifest version.');
    }
    const surfaceId = String(value.id || value.mapId || '').trim().toUpperCase();
    if (!surfaceId || (expectedSurfaceId && surfaceId !== String(expectedSurfaceId).trim().toUpperCase())) {
        throw new Error('Print master files do not match the current map area.');
    }
    const bounds = normalizeBounds(value.bounds?.surface || value.bounds);
    const sourceZoom = Number(value.source?.detail_equivalent_zoom ?? value.source?.zoom ?? value.zoom ?? 19);
    const retentionScale = Number(value.source_retention_scale ?? value.source?.retentionScale ?? 1);
    const chunks = Array.isArray(value.chunks) ? value.chunks.map(normalizeChunk) : [];
    if (!bounds || !Number.isFinite(sourceZoom) || sourceZoom < 0 || retentionScale !== 1 || !chunks.length || chunks.some((chunk) => !chunk)) {
        throw new Error('Print master files are incomplete or invalid.');
    }
    return {
        ...value,
        id: surfaceId,
        bounds,
        sourceZoom,
        sourceRetentionScale: retentionScale,
        chunks,
    };
}

export function resolvePrintMasterManifestUrl(assetBaseUrl, surfaceId, mapStyle = 'default') {
    const baseUrl = normalizePrintMasterAssetBaseUrl(assetBaseUrl);
    const normalizedSurfaceId = String(surfaceId || '').trim().toLowerCase();
    if (!baseUrl || !normalizedSurfaceId) return '';
    const styleSlug = mapStyle === 'gray' ? 'grey' : 'default';
    return `${baseUrl}/manifests/${normalizedSurfaceId}-${styleSlug}-print-master-100.json`;
}

export function resolvePrintMasterChunkUrl(assetBaseUrl, chunkUrl) {
    const baseUrl = normalizePrintMasterAssetBaseUrl(assetBaseUrl);
    const safeChunkUrl = String(chunkUrl || '').replace(/^\/+/, '');
    return baseUrl && safeChunkUrl ? `${baseUrl}/${safeChunkUrl}` : '';
}

export async function fetchPrintMasterManifest({
    assetBaseUrl,
    surfaceId,
    mapStyle = 'default',
    fetchImpl = fetch,
} = {}) {
    const manifestUrl = resolvePrintMasterManifestUrl(assetBaseUrl, surfaceId, mapStyle);
    if (!manifestUrl) {
        throw new Error('Print master files are not configured for this map colour.');
    }
    const response = await fetchImpl(manifestUrl, { cache: 'no-store', mode: 'cors' });
    if (!response.ok) {
        throw new Error('Print master files are not available for this map area yet.');
    }
    return validatePrintMasterManifest(await response.json(), { expectedSurfaceId: surfaceId });
}

export function projectLonLatToWorldPixel(lng, lat, zoom = 19) {
    const scale = WEB_MERCATOR_TILE_SIZE * (2 ** Number(zoom));
    const safeLat = Math.max(-85.05112878, Math.min(85.05112878, Number(lat)));
    const sin = Math.sin((safeLat * Math.PI) / 180);
    return [
        ((Number(lng) + 180) / 360) * scale,
        (0.5 - (Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI))) * scale,
    ];
}

export function getPrintMasterViewportWorldBounds(bounds, sourceZoom = 19) {
    const normalized = normalizeBounds(bounds);
    if (!normalized) throw new Error('Print master export could not read the current map view.');
    const [west, south, east, north] = normalized;
    const [left, top] = projectLonLatToWorldPixel(west, north, sourceZoom);
    const [right, bottom] = projectLonLatToWorldPixel(east, south, sourceZoom);
    return [left, top, right, bottom];
}

export function selectPrintMasterChunks(chunks = [], viewportWorldBounds = []) {
    if (!Array.isArray(viewportWorldBounds) || viewportWorldBounds.length !== 4) return [];
    const [left, top, right, bottom] = viewportWorldBounds.map(Number);
    return chunks
        .filter((chunk) => {
            const [chunkLeft, chunkTop, chunkRight, chunkBottom] = chunk.worldPixelBounds || [];
            return chunkRight > left && chunkLeft < right && chunkBottom > top && chunkTop < bottom;
        })
        .sort((a, b) => (
            a.worldPixelBounds[1] - b.worldPixelBounds[1]
            || a.worldPixelBounds[0] - b.worldPixelBounds[0]
        ));
}

function shouldRetryChunkResponse(response) {
    return response?.status === 408 || response?.status === 429 || response?.status >= 500;
}

export async function fetchPrintMasterChunkResponse(
    url,
    fetchImpl = fetch,
    {
        attempts = PRINT_MASTER_CHUNK_FETCH_ATTEMPTS,
        waitImpl = (delayMs) => new Promise((resolve) => window.setTimeout(resolve, delayMs)),
    } = {},
) {
    const maxAttempts = Math.max(1, Math.round(Number(attempts) || 1));
    let lastError = null;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
            const response = await fetchImpl(url, {
                cache: attempt === 0 ? 'force-cache' : 'reload',
                mode: 'cors',
            });
            if (response.ok || !shouldRetryChunkResponse(response) || attempt === maxAttempts - 1) {
                return response;
            }
            lastError = new Error(`Print master map section failed to load (${response.status}).`);
        } catch (error) {
            lastError = error;
            if (attempt === maxAttempts - 1) throw error;
        }
        const retryDelay = PRINT_MASTER_CHUNK_RETRY_DELAYS_MS[
            Math.min(attempt, PRINT_MASTER_CHUNK_RETRY_DELAYS_MS.length - 1)
        ];
        await waitImpl(retryDelay);
    }
    throw lastError || new Error('Print master map section failed to load.');
}

async function defaultLoadChunkImage(url, fetchImpl) {
    const response = await fetchPrintMasterChunkResponse(url, fetchImpl);
    if (!response.ok) throw new Error(`Print master map section failed to load (${response.status}).`);
    const blob = await response.blob();
    if (typeof createImageBitmap === 'function') {
        const bitmap = await createImageBitmap(blob);
        return { image: bitmap, close: () => bitmap.close?.() };
    }
    const objectUrl = URL.createObjectURL(blob);
    const image = await new Promise((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error('Print master map section could not be decoded.'));
        element.src = objectUrl;
    });
    return { image, close: () => URL.revokeObjectURL(objectUrl) };
}

export async function composePrintMasterBasemap({
    manifest,
    assetBaseUrl,
    viewportBounds,
    width,
    height,
    fetchImpl = fetch,
    canvasFactory = () => document.createElement('canvas'),
    loadChunkImage = defaultLoadChunkImage,
    onProgress = null,
} = {}) {
    const validated = validatePrintMasterManifest(manifest);
    const outputWidth = Math.max(1, Math.round(Number(width) || 0));
    const outputHeight = Math.max(1, Math.round(Number(height) || 0));
    const viewportWorldBounds = getPrintMasterViewportWorldBounds(viewportBounds, validated.sourceZoom);
    const [viewportLeft, viewportTop, viewportRight, viewportBottom] = viewportWorldBounds;
    const visibleChunks = selectPrintMasterChunks(validated.chunks, viewportWorldBounds);
    if (!visibleChunks.length) {
        throw new Error('Print master files do not cover the current map view.');
    }

    const canvas = canvasFactory();
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Print master export could not create an image canvas.');
    context.fillStyle = validated.presentation?.backgroundColor || '#f4f2ed';
    context.fillRect(0, 0, outputWidth, outputHeight);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    const viewportWidth = viewportRight - viewportLeft;
    const viewportHeight = viewportBottom - viewportTop;
    for (let index = 0; index < visibleChunks.length; index += 1) {
        const chunk = visibleChunks[index];
        const [chunkLeft, chunkTop, chunkRight, chunkBottom] = chunk.worldPixelBounds;
        const intersectionLeft = Math.max(viewportLeft, chunkLeft);
        const intersectionTop = Math.max(viewportTop, chunkTop);
        const intersectionRight = Math.min(viewportRight, chunkRight);
        const intersectionBottom = Math.min(viewportBottom, chunkBottom);
        if (intersectionLeft >= intersectionRight || intersectionTop >= intersectionBottom) continue;

        const sourceScaleX = chunk.pixelSize[0] / (chunkRight - chunkLeft);
        const sourceScaleY = chunk.pixelSize[1] / (chunkBottom - chunkTop);
        const sx = (intersectionLeft - chunkLeft) * sourceScaleX;
        const sy = (intersectionTop - chunkTop) * sourceScaleY;
        const sw = (intersectionRight - intersectionLeft) * sourceScaleX;
        const sh = (intersectionBottom - intersectionTop) * sourceScaleY;
        const dx = ((intersectionLeft - viewportLeft) / viewportWidth) * outputWidth;
        const dy = ((intersectionTop - viewportTop) / viewportHeight) * outputHeight;
        const dw = ((intersectionRight - intersectionLeft) / viewportWidth) * outputWidth;
        const dh = ((intersectionBottom - intersectionTop) / viewportHeight) * outputHeight;
        const loaded = await loadChunkImage(
            resolvePrintMasterChunkUrl(assetBaseUrl, chunk.url),
            fetchImpl,
        );
        try {
            context.drawImage(loaded.image, sx, sy, sw, sh, dx, dy, dw + 0.35, dh + 0.35);
        } finally {
            loaded.close?.();
        }
        onProgress?.({ completed: index + 1, total: visibleChunks.length, chunkId: chunk.id });
    }
    return canvas;
}
