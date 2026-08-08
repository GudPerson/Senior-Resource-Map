import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readSource = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

const mainSource = readSource('../src/main.jsx');
const standardRootSource = readSource('../src/StandardAppRoot.jsx');
const embeddedAppSource = readSource('../src/EmbeddedApp.jsx');
const embeddedPageSource = readSource('../src/pages/EmbeddedMapPage.jsx');
const shareModalSource = readSource('../src/components/ShareMapModal.jsx');
const myMapPageSource = readSource('../src/pages/MyMapDetailPage.jsx');
const apiSource = readSource('../src/lib/api.js');
const appSource = readSource('../src/App.jsx');
const directoryMapSource = readSource('../src/components/DirectoryMap.jsx');
const headersSource = readSource('../public/_headers');

test('embedded maps boot outside authenticated, saved-resource, Google, and PWA providers', () => {
    assert.match(mainSource, /window\.location\.pathname\.startsWith\('\/embed\/maps\/'\)/);
    assert.match(mainSource, /import\('\.\/EmbeddedApp\.jsx'\)/);
    assert.match(mainSource, /import\('\.\/StandardAppRoot\.jsx'\)/);
    assert.match(mainSource, /registerCareAroundPwa\(\)/);

    assert.match(standardRootSource, /GoogleOAuthProvider/);
    assert.match(standardRootSource, /AuthProvider/);
    assert.doesNotMatch(embeddedAppSource, /GoogleOAuthProvider|AuthProvider|SavedAssetsProvider|registerCareAroundPwa/);
    assert.doesNotMatch(appSource, /\/embed\/maps\//);
});

test('map-only page uses the guest endpoint and omits private-map tool surfaces', () => {
    assert.match(embeddedPageSource, /fetchEmbeddedMap\(token\)/);
    assert.match(embeddedPageSource, /buildEmbeddedMapPresentation/);
    assert.match(embeddedPageSource, /buildEmbedCategoryOptions/);
    assert.match(embeddedPageSource, /getEmbedListOnlyResourceCount/);
    assert.match(embeddedPageSource, /markerMode="category-bubble"/);
    assert.match(embeddedPageSource, /clusterMarkerMode="bubble"/);
    assert.match(embeddedPageSource, /showMapStyleControl=\{false\}/);
    assert.match(embeddedPageSource, /coarsePointer && !touchInteractionEnabled/);
    assert.match(embeddedPageSource, /absolute left-3 top-3/);
    assert.match(embeddedPageSource, /h-screen min-h-\[400px\].*overflow-hidden/);
    assert.match(embeddedPageSource, /embedded-map-height-warning/);
    assert.match(embeddedPageSource, /mapHeightClassName="h-full"/);
    assert.match(embeddedPageSource, /target="_blank"/);
    assert.match(directoryMapSource, /title=\{pin\.title \|\| pin\.previewResourceNames\?\.join\(', '\) \|\| 'Map resource'\}/);
    assert.doesNotMatch(embeddedPageSource, /useAuth|SavedAssets|Print|Annotat|geolocation|fixedTown|removeMyMap|updateMyMap/);
});

test('owners explicitly configure exact websites before copying iframe code', () => {
    assert.match(shareModalSource, /normalizeWebsiteOrigin/);
    assert.match(shareModalSource, /url\.protocol !== 'https:'/);
    assert.match(shareModalSource, /raw\.includes\('\*'\)/);
    assert.match(shareModalSource, /allowedOrigins: embedOrigins/);
    assert.match(shareModalSource, /onUpdateEmbed/);
    assert.match(shareModalSource, /loading="lazy"/);
    assert.match(shareModalSource, /h-\[440px\].*sm:h-\[520px\]/);
    assert.match(shareModalSource, /min-width:400px/);
    assert.match(myMapPageSource, /api\.updateMyMapEmbed\(directory\.id, settings\)/);
    assert.match(apiSource, /PATCH', `\/my-maps\/\$\{id\}\/embed`/);
});

test('ordinary app routes keep the global anti-framing policy', () => {
    assert.match(headersSource, /frame-ancestors 'none'/);
    assert.match(headersSource, /frame-src 'self' https:\/\/accounts\.google\.com/);
    assert.match(headersSource, /X-Frame-Options: DENY/);
});
