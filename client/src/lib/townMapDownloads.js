export const TOWN_MAP_DOWNLOADS_SCHEMA = 'carearound.town-map-download-catalogue/v1';
export const TOWN_MAP_DOWNLOADS_VERSION = 'town-map-downloads-20260801-r2-default';
export const TOWN_MAP_DOWNLOADS_ATTRIBUTION = 'OneMap (c) contributors | Singapore Land Authority';
export const TOWN_MAP_DOWNLOADS_PUBLIC_BASE_URL = 'https://maps.carearound.sg/v4/town-map-downloads-20260801-r2/default';
export const TOWN_MAP_DOWNLOADS_CATALOGUE_URL = `${TOWN_MAP_DOWNLOADS_PUBLIC_BASE_URL}/catalogue.json`;
export const TOWN_MAP_DOWNLOADS_LOCAL_PROXY_PREFIX = '/__carearound-town-map-downloads';
export const TOWN_MAP_DOWNLOADS_LOCAL_CATALOGUE_URL = `${TOWN_MAP_DOWNLOADS_LOCAL_PROXY_PREFIX}/v4/town-map-downloads-20260801-r2/default/catalogue.json`;
export const TOWN_MAP_DOWNLOADS_ALLOWED_ORIGINS = Object.freeze(['https://app.carearound.sg']);
export const TOWN_MAP_DOWNLOAD_IDS = Object.freeze([
    'C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C08',
    'E01', 'E02', 'E03', 'E04', 'E05', 'E06',
    'N01', 'N02',
    'NE01', 'NE02', 'NE03', 'NE04', 'NE05',
    'NW01', 'NW02', 'NW03',
    'S01',
    'W01', 'W02', 'W03', 'W04', 'W05', 'W06', 'W07',
]);

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const SAFE_FILE_NAME_PATTERN = /^[a-z0-9][a-z0-9.-]+\.(png|pdf)$/;

function invariant(condition, message) {
    if (!condition) throw new Error(message);
}

function expectedIdsMatch(maps) {
    const actual = maps.map((map) => map.code).sort();
    return JSON.stringify(actual) === JSON.stringify([...TOWN_MAP_DOWNLOAD_IDS].sort());
}

function validateAsset(asset, {
    code,
    label,
    mimeType,
    baseUrl,
    seenUrls,
}) {
    invariant(asset && typeof asset === 'object' && !Array.isArray(asset), `${code} ${label} metadata is missing`);
    invariant(asset.mimeType === mimeType, `${code} ${label} MIME type is invalid`);
    invariant(Number.isSafeInteger(asset.bytes) && asset.bytes > 0, `${code} ${label} size is invalid`);
    invariant(SHA256_PATTERN.test(asset.sha256 || ''), `${code} ${label} hash is invalid`);
    invariant(typeof asset.url === 'string' && asset.url.startsWith(`${baseUrl}/`), `${code} ${label} URL is invalid`);
    const url = new URL(asset.url);
    invariant(url.protocol === 'https:' && url.hostname === 'maps.carearound.sg', `${code} ${label} URL is not a CareAround HTTPS URL`);
    invariant(url.search === '' && url.hash === '', `${code} ${label} URL must not contain query or hash data`);
    invariant(!seenUrls.has(asset.url), `${code} ${label} URL is duplicated`);
    seenUrls.add(asset.url);
}

export function parseTownMapDownloadCatalogue(value) {
    invariant(value && typeof value === 'object' && !Array.isArray(value), 'Town-map catalogue is not an object');
    invariant(value.schema === TOWN_MAP_DOWNLOADS_SCHEMA, 'Town-map catalogue schema is not supported');
    invariant(value.version === TOWN_MAP_DOWNLOADS_VERSION, 'Town-map catalogue version is not supported');
    invariant(value.style === 'default', 'Town-map catalogue style is not supported');
    invariant(value.attribution === TOWN_MAP_DOWNLOADS_ATTRIBUTION, 'Town-map catalogue attribution is invalid');
    invariant(value.mapCount === 32, 'Town-map catalogue count is invalid');
    invariant(Array.isArray(value.allowedOrigins), 'Town-map catalogue allowed origins are missing');
    invariant(
        JSON.stringify(value.allowedOrigins) === JSON.stringify(TOWN_MAP_DOWNLOADS_ALLOWED_ORIGINS),
        'Town-map catalogue allowed origins are invalid',
    );
    invariant(Array.isArray(value.maps) && value.maps.length === 32, 'Town-map catalogue is incomplete');
    invariant(expectedIdsMatch(value.maps), 'Town-map catalogue map codes are incomplete or duplicated');

    const seenUrls = new Set();
    value.maps.forEach((map) => {
        invariant(TOWN_MAP_DOWNLOAD_IDS.includes(map.code), `Town-map catalogue contains unexpected code ${map.code}`);
        invariant(typeof map.name === 'string' && map.name.trim(), `${map.code} name is missing`);
        invariant(Array.isArray(map.planningAreas) && map.planningAreas.length >= 1, `${map.code} planning areas are missing`);
        invariant(map.attribution === TOWN_MAP_DOWNLOADS_ATTRIBUTION, `${map.code} attribution is invalid`);
        validateAsset(map.thumbnail, {
            code: map.code,
            label: 'thumbnail',
            mimeType: 'image/jpeg',
            baseUrl: TOWN_MAP_DOWNLOADS_PUBLIC_BASE_URL,
            seenUrls,
        });
        validateAsset(map.png, {
            code: map.code,
            label: 'PNG',
            mimeType: 'image/png',
            baseUrl: TOWN_MAP_DOWNLOADS_PUBLIC_BASE_URL,
            seenUrls,
        });
        validateAsset(map.pdf, {
            code: map.code,
            label: 'PDF',
            mimeType: 'application/pdf',
            baseUrl: TOWN_MAP_DOWNLOADS_PUBLIC_BASE_URL,
            seenUrls,
        });
        invariant(map.thumbnail.width === 1000 && map.thumbnail.height === 700, `${map.code} thumbnail dimensions are invalid`);
        invariant(map.png.width === 10000 && map.png.height === 7000, `${map.code} PNG dimensions are invalid`);
        invariant(Array.isArray(map.png.dpi) && map.png.dpi.every((dpi) => Math.abs(dpi - 300) < 0.05), `${map.code} PNG DPI is invalid`);
        invariant(map.png.lossless === true, `${map.code} PNG is not marked lossless`);
        invariant(map.pdf.pageCount === 1, `${map.code} PDF page count is invalid`);
        invariant(
            Array.isArray(map.pdf.pageSizeMm)
                && Math.abs(map.pdf.pageSizeMm[0] - 1750) < 0.05
                && Math.abs(map.pdf.pageSizeMm[1] - 1225) < 0.05,
            `${map.code} PDF page geometry is invalid`,
        );
        invariant(map.pdf.readabilityPercent === 175, `${map.code} PDF scale is invalid`);
        invariant(SAFE_FILE_NAME_PATTERN.test(map.png.fileName || '') && map.png.fileName.endsWith('.png'), `${map.code} PNG filename is invalid`);
        invariant(SAFE_FILE_NAME_PATTERN.test(map.pdf.fileName || '') && map.pdf.fileName.endsWith('.pdf'), `${map.code} PDF filename is invalid`);
    });

    return value;
}

export function getTownMapDownloadCatalogueUrl(env = import.meta.env || {}) {
    const configured = String(env.VITE_TOWN_MAP_DOWNLOAD_CATALOGUE_URL || '').trim();
    if (configured) return configured;
    return env.DEV ? TOWN_MAP_DOWNLOADS_LOCAL_CATALOGUE_URL : TOWN_MAP_DOWNLOADS_CATALOGUE_URL;
}

export function resolveTownMapAssetUrl(assetUrl, catalogueUrl = TOWN_MAP_DOWNLOADS_CATALOGUE_URL) {
    const canonical = new URL(assetUrl);
    const catalogue = String(catalogueUrl || '');
    if (catalogue.startsWith(TOWN_MAP_DOWNLOADS_LOCAL_PROXY_PREFIX)) {
        return `${TOWN_MAP_DOWNLOADS_LOCAL_PROXY_PREFIX}${canonical.pathname}`;
    }
    try {
        const catalogueAbsolute = new URL(catalogue);
        if (catalogueAbsolute.hostname !== 'maps.carearound.sg') {
            return `${catalogueAbsolute.origin}${canonical.pathname}`;
        }
    } catch {
        // Production uses the canonical absolute URL below.
    }
    return assetUrl;
}

export async function fetchTownMapDownloadCatalogue({
    fetchImpl = globalThis.fetch,
    url = getTownMapDownloadCatalogueUrl(),
    signal,
} = {}) {
    invariant(typeof fetchImpl === 'function', 'Catalogue request is unavailable');
    const response = await fetchImpl(url, {
        method: 'GET',
        cache: 'no-cache',
        credentials: 'omit',
        headers: { Accept: 'application/json' },
        signal,
    });
    invariant(response.ok, `Town-map catalogue returned HTTP ${response.status}`);
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    invariant(contentType.includes('application/json'), 'Town-map catalogue did not return JSON');
    return parseTownMapDownloadCatalogue(await response.json());
}

export function formatDownloadBytes(bytes, locale = 'en-SG') {
    const value = Number(bytes);
    if (!Number.isFinite(value) || value <= 0) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    const unitIndex = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
    const amount = value / (1024 ** unitIndex);
    return `${new Intl.NumberFormat(locale, {
        maximumFractionDigits: unitIndex === 0 ? 0 : 1,
        minimumFractionDigits: unitIndex >= 2 ? 1 : 0,
    }).format(amount)} ${units[unitIndex]}`;
}

export async function preflightTownMapDownload(file, {
    fetchImpl = globalThis.fetch,
    documentLike = globalThis.document,
    runtimeUrl = file?.url,
} = {}) {
    invariant(file && typeof file === 'object', 'Download metadata is missing');
    invariant(typeof runtimeUrl === 'string' && runtimeUrl, 'Download URL is missing');
    invariant(typeof fetchImpl === 'function', 'Download check is unavailable');
    const response = await fetchImpl(runtimeUrl, {
        method: 'HEAD',
        cache: 'no-store',
        credentials: 'omit',
        headers: { 'Cache-Control': 'no-cache' },
    });
    invariant(response.ok, `Download returned HTTP ${response.status}`);
    invariant(
        (response.headers.get('content-type') || '').toLowerCase().includes(file.mimeType),
        'Download format did not match the catalogue',
    );

    invariant(documentLike?.createElement && documentLike?.body, 'Download is unavailable in this browser');
    const anchor = documentLike.createElement('a');
    anchor.href = runtimeUrl;
    anchor.download = file.fileName;
    anchor.rel = 'noopener';
    anchor.hidden = true;
    documentLike.body.append(anchor);
    anchor.click();
    anchor.remove();
    return true;
}
