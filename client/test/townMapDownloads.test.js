import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
    TOWN_MAP_DOWNLOADS_ATTRIBUTION,
    TOWN_MAP_DOWNLOADS_CATALOGUE_URL,
    TOWN_MAP_DOWNLOADS_LOCAL_CATALOGUE_URL,
    TOWN_MAP_DOWNLOADS_PUBLIC_BASE_URL,
    TOWN_MAP_DOWNLOAD_IDS,
    fetchTownMapDownloadCatalogue,
    formatDownloadBytes,
    getTownMapDownloadCatalogueUrl,
    parseTownMapDownloadCatalogue,
    preflightTownMapDownload,
    resolveTownMapAssetUrl,
} from '../src/lib/townMapDownloads.js';
import { LOCALES, translateUi } from '../src/lib/i18n.js';

const appSource = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const pageSource = fs.readFileSync(new URL('../src/pages/TownMapDownloadsPage.jsx', import.meta.url), 'utf8');
const cardSource = fs.readFileSync(new URL('../src/components/townMaps/TownMapDownloadCard.jsx', import.meta.url), 'utf8');
const navigationSource = fs.readFileSync(new URL('../src/components/dashboard/DashboardNavigation.jsx', import.meta.url), 'utf8');
const myMapSource = fs.readFileSync(new URL('../src/pages/MyMapDetailPage.jsx', import.meta.url), 'utf8');
const serviceWorkerSource = fs.readFileSync(new URL('../public/pwa/carearound-sw', import.meta.url), 'utf8');
const viteConfigSource = fs.readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');

function validCatalogue() {
    return {
        schema: 'carearound.town-map-download-catalogue/v1',
        version: 'town-map-downloads-20260801-r2-default',
        releaseDate: '2026-08-01',
        style: 'default',
        edition: 'clean-175-percent',
        attribution: TOWN_MAP_DOWNLOADS_ATTRIBUTION,
        mapCount: 32,
        allowedOrigins: ['https://app.carearound.sg'],
        provenanceUrl: `${TOWN_MAP_DOWNLOADS_PUBLIC_BASE_URL}/provenance.json`,
        validationUrl: `${TOWN_MAP_DOWNLOADS_PUBLIC_BASE_URL}/validation.json`,
        maps: TOWN_MAP_DOWNLOAD_IDS.map((code, index) => ({
            code,
            name: `${code} Town`,
            planningAreas: [`AREA ${index + 1}`],
            attribution: TOWN_MAP_DOWNLOADS_ATTRIBUTION,
            thumbnail: {
                url: `${TOWN_MAP_DOWNLOADS_PUBLIC_BASE_URL}/thumbnails/${code.toLowerCase()}-preview.jpg`,
                mimeType: 'image/jpeg',
                bytes: 1000 + index,
                sha256: String(index + 1).padStart(64, '0'),
                width: 1000,
                height: 700,
            },
            png: {
                url: `${TOWN_MAP_DOWNLOADS_PUBLIC_BASE_URL}/png/${code.toLowerCase()}-town-map.png`,
                fileName: `${code.toLowerCase()}-town-map.png`,
                mimeType: 'image/png',
                bytes: 20_000_000 + index,
                sha256: String(index + 101).padStart(64, '0'),
                width: 10000,
                height: 7000,
                dpi: [299.999, 299.999],
                lossless: true,
            },
            pdf: {
                url: `${TOWN_MAP_DOWNLOADS_PUBLIC_BASE_URL}/pdf/${code.toLowerCase()}-town-map.pdf`,
                fileName: `${code.toLowerCase()}-town-map.pdf`,
                mimeType: 'application/pdf',
                bytes: 10_000_000 + index,
                sha256: String(index + 201).padStart(64, '0'),
                pageCount: 1,
                pageSizeMm: [1750, 1225],
                readabilityPercent: 175,
            },
        })),
    };
}

test('strict client catalogue validation accepts exactly the 32 immutable CareAround maps', () => {
    const catalogue = validCatalogue();
    assert.equal(parseTownMapDownloadCatalogue(catalogue), catalogue);

    const incomplete = structuredClone(catalogue);
    incomplete.maps.pop();
    assert.throws(() => parseTownMapDownloadCatalogue(incomplete), /incomplete/);

    const badHash = structuredClone(catalogue);
    badHash.maps[0].png.sha256 = 'invalid';
    assert.throws(() => parseTownMapDownloadCatalogue(badHash), /hash/);

    const badUrl = structuredClone(catalogue);
    badUrl.maps[0].pdf.url = 'https://example.com/map.pdf';
    assert.throws(() => parseTownMapDownloadCatalogue(badUrl), /URL/);

    const badOrigin = structuredClone(catalogue);
    badOrigin.allowedOrigins = ['*'];
    assert.throws(() => parseTownMapDownloadCatalogue(badOrigin), /allowed origins/);

    const badMime = structuredClone(catalogue);
    badMime.maps[0].thumbnail.mimeType = 'application/octet-stream';
    assert.throws(() => parseTownMapDownloadCatalogue(badMime), /MIME type/);
});

test('catalogue fetch rejects non-JSON and unavailable responses with no fallback data', async () => {
    const catalogue = validCatalogue();
    const loaded = await fetchTownMapDownloadCatalogue({
        url: TOWN_MAP_DOWNLOADS_CATALOGUE_URL,
        fetchImpl: async (_url, options) => {
            assert.equal(options.method, 'GET');
            assert.equal(options.credentials, 'omit');
            return new Response(JSON.stringify(catalogue), {
                status: 200,
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
            });
        },
    });
    assert.equal(loaded.mapCount, 32);

    await assert.rejects(fetchTownMapDownloadCatalogue({
        fetchImpl: async () => new Response('<html></html>', {
            status: 200,
            headers: { 'Content-Type': 'text/html' },
        }),
    }), /did not return JSON/);
    await assert.rejects(fetchTownMapDownloadCatalogue({
        fetchImpl: async () => new Response('', { status: 503 }),
    }), /HTTP 503/);
});

test('local UAT uses an isolated proxy while production keeps direct R2 URLs', () => {
    assert.equal(getTownMapDownloadCatalogueUrl({ DEV: true }), TOWN_MAP_DOWNLOADS_LOCAL_CATALOGUE_URL);
    assert.equal(getTownMapDownloadCatalogueUrl({ DEV: false }), TOWN_MAP_DOWNLOADS_CATALOGUE_URL);
    assert.equal(
        getTownMapDownloadCatalogueUrl({ DEV: true, VITE_TOWN_MAP_DOWNLOAD_CATALOGUE_URL: 'http://127.0.0.1:4176/custom.json' }),
        'http://127.0.0.1:4176/custom.json',
    );
    assert.equal(
        resolveTownMapAssetUrl(
            `${TOWN_MAP_DOWNLOADS_PUBLIC_BASE_URL}/png/e01-town-map.png`,
            TOWN_MAP_DOWNLOADS_LOCAL_CATALOGUE_URL,
        ),
        '/__carearound-town-map-downloads/v4/town-map-downloads-20260801-r2/default/png/e01-town-map.png',
    );
    assert.match(viteConfigSource, /['"]\/__carearound-town-map-downloads['"][\s\S]*target:\s*['"]http:\/\/127\.0\.0\.1:4176['"]/);
    assert.match(viteConfigSource, /path\.replace\(\/\^\\\/__carearound-town-map-downloads\//);
});

test('download preflight checks MIME and then uses the reliable catalogue filename', async () => {
    const file = validCatalogue().maps[0].png;
    const calls = [];
    const anchor = {
        click: () => calls.push('click'),
        remove: () => calls.push('remove'),
    };
    const documentLike = {
        body: { append: (element) => calls.push(['append', element]) },
        createElement: (tag) => {
            assert.equal(tag, 'a');
            return anchor;
        },
    };
    await preflightTownMapDownload(file, {
        documentLike,
        fetchImpl: async (url, options) => {
            assert.equal(url, file.url);
            assert.equal(options.method, 'HEAD');
            return new Response(null, { status: 200, headers: { 'Content-Type': 'image/png' } });
        },
    });
    assert.equal(anchor.href, file.url);
    assert.equal(anchor.download, file.fileName);
    assert.deepEqual(calls.slice(-2), ['click', 'remove']);

    await assert.rejects(preflightTownMapDownload(file, {
        documentLike,
        fetchImpl: async () => new Response(null, { status: 404 }),
    }), /HTTP 404/);
    await assert.rejects(preflightTownMapDownload(file, {
        documentLike,
        fetchImpl: async () => new Response(null, { status: 200, headers: { 'Content-Type': 'text/html' } }),
    }), /format/);
});

test('file sizes are readable and locale-aware', () => {
    assert.equal(formatDownloadBytes(10 * 1024 * 1024, 'en-SG'), '10.0 MB');
    assert.match(formatDownloadBytes(15_000_000, 'ms-SG'), /14[,.]3 MB/);
    assert.equal(formatDownloadBytes(0), '');
});

test('the module is route-lazy, protected by directory access, and discoverable without a My Map shortcut', () => {
    assert.match(appSource, /const TownMapDownloadsPage = lazy\(\(\) => import\('\.\/pages\/TownMapDownloadsPage\.jsx'\)\)/);
    assert.match(appSource, /path="\/my-directory\/town-maps"[\s\S]*<ProtectedRoute requireDirectoryAccess><TownMapDownloadsPage \/><\/ProtectedRoute>/);
    assert.match(navigationSource, /to="\/my-directory\/town-maps"/);
    assert.match(navigationSource, /label=\{t\('townMapsNav'\)\}/);
    assert.doesNotMatch(myMapSource, /TownMapDownloads|town-map-downloads|townMapsNav/);
});

test('previews are intersection-gated and the page includes loading, unavailable, empty, mobile, and download-error states', () => {
    assert.match(cardSource, /IntersectionObserver/);
    assert.match(cardSource, /rootMargin: '160px 0px'/);
    assert.match(cardSource, /loading="lazy"/);
    assert.match(cardSource, /decoding="async"/);
    assert.match(pageSource, /CatalogueLoadingState/);
    assert.match(pageSource, /CatalogueUnavailable/);
    assert.match(pageSource, /townMapsNoResultsTitle/);
    assert.match(pageSource, /townMapsMobileDownloadTitle/);
    assert.match(pageSource, /role="alert"/);
    assert.match(pageSource, /townMapsDownloadFailed/);
    assert.match(pageSource, /fetchTownMapDownloadCatalogue/);
});

test('all town-map module strings are complete translations in English, Chinese, Malay, and Tamil', () => {
    const keys = [
        'townMapsNav',
        'townMapsTitle',
        'townMapsBackToDirectory',
        'townMapsEyebrow',
        'townMapsIntro',
        'townMapsMobileDownloadHelp',
        'townMapsUnavailableTitle',
        'townMapsSearchPlaceholder',
        'townMapsPngDetails',
        'townMapsPdfDetails',
        'townMapsDownloadFailed',
        'townMapsNoResultsHelp',
    ];
    for (const { code } of LOCALES) {
        for (const key of keys) {
            assert.notEqual(translateUi(code, key), key, `${code} should define ${key}`);
            if (code !== 'en') {
                assert.notEqual(translateUi(code, key), translateUi('en', key), `${code} should translate ${key}`);
            }
        }
    }
});

test('large map binaries stay outside the client bundle and PWA caches', () => {
    assert.doesNotMatch(serviceWorkerSource, /maps\.carearound\.sg|town-map-downloads/);
    assert.match(serviceWorkerSource, /if \(!isSameOrigin\(url\)\) return false/);
    assert.match(serviceWorkerSource, /return isSameOrigin\(url\) && url\.pathname\.startsWith\('\/assets\/'\)/);
    assert.doesNotMatch(pageSource, /\.png['"]|\.pdf['"]|import\([^)]*town-map/);
    assert.match(pageSource, /fetchTownMapDownloadCatalogue/);
});
