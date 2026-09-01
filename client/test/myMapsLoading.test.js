import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    fetchMyMapWithResilience,
    fetchMyMapsWithResilience,
    getMyMapsListStatus,
} from '../src/lib/myMapsLoading.js';

const myDirectoryPageSource = readFileSync(
    new URL('../src/pages/MyDirectoryPage.jsx', import.meta.url),
    'utf8',
);
const myMapDetailPageSource = readFileSync(
    new URL('../src/pages/MyMapDetailPage.jsx', import.meta.url),
    'utf8',
);
const mobileMyMapEntryScrollResetSource = readFileSync(
    new URL('../src/components/MobileMyMapEntryScrollReset.jsx', import.meta.url),
    'utf8',
);
const myMapCardSource = readFileSync(
    new URL('../src/components/MyMapCard.jsx', import.meta.url),
    'utf8',
);
const createMapModalSource = readFileSync(
    new URL('../src/components/CreateMapModal.jsx', import.meta.url),
    'utf8',
);
const apiSource = readFileSync(
    new URL('../src/lib/api.js', import.meta.url),
    'utf8',
);
const i18nSource = readFileSync(
    new URL('../src/locales/en.js', import.meta.url),
    'utf8',
);
const appSource = readFileSync(
    new URL('../src/App.jsx', import.meta.url),
    'utf8',
);

test('my maps list retries a transient first load failure', async () => {
    let attempts = 0;
    const maps = await fetchMyMapsWithResilience(async () => {
        attempts += 1;
        if (attempts === 1) {
            throw new Error('temporary My Maps load failure');
        }
        return [{ id: 87, name: 'My Partners' }];
    }, {
        maxAttempts: 2,
        waitMs: async () => {},
    });

    assert.equal(attempts, 2);
    assert.deepEqual(maps, [{ id: 87, name: 'My Partners' }]);
});

test('my map detail retries a transient first load failure', async () => {
    let attempts = 0;
    const map = await fetchMyMapWithResilience(async () => {
        attempts += 1;
        if (attempts === 1) {
            throw new Error('temporary My Map detail load failure');
        }
        return { id: 87, name: 'My Partners' };
    }, {
        maxAttempts: 2,
        waitMs: async () => {},
    });

    assert.equal(attempts, 2);
    assert.deepEqual(map, { id: 87, name: 'My Partners' });
});

test('my maps loading does not retry expired sessions or access failures', async () => {
    let attempts = 0;

    await assert.rejects(
        fetchMyMapsWithResilience(async () => {
            attempts += 1;
            throw new Error('Session expired. Please log in again.');
        }, {
            maxAttempts: 3,
            waitMs: async () => {},
        }),
        /Session expired/,
    );

    assert.equal(attempts, 1);
});

test('my maps list status avoids empty state before first load settles', () => {
    assert.equal(getMyMapsListStatus({
        mapsLoading: false,
        mapsLoaded: false,
        mapsError: '',
        mapCount: 0,
    }), 'loading');

    assert.equal(getMyMapsListStatus({
        mapsLoading: false,
        mapsLoaded: false,
        mapsError: 'Failed to load your maps.',
        mapCount: 0,
    }), 'load-error');

    assert.equal(getMyMapsListStatus({
        mapsLoading: false,
        mapsLoaded: true,
        mapsError: '',
        mapCount: 0,
    }), 'empty');

    assert.equal(getMyMapsListStatus({
        mapsLoading: false,
        mapsLoaded: true,
        mapsError: '',
        mapCount: 2,
    }), 'ready');
});

test('my maps pages use resilient loading helpers', () => {
    assert.match(myDirectoryPageSource, /fetchMyMapsWithResilience\(\(\) => api\.getMyMaps\(\)\)/);
    assert.match(myDirectoryPageSource, /getMyMapsListStatus\(/);
    assert.match(myDirectoryPageSource, /MyMapsLoadErrorState/);
    assert.match(myMapDetailPageSource, /fetchMyMapWithResilience\(\(\) => api\.getMyMap\(mapId\)\)/);
    assert.match(myMapDetailPageSource, /getMyMapDetailCacheKey\(user, mapId\)/);
    assert.match(myMapDetailPageSource, /return `\$\{userId\}:\$\{resolvedMapId\}`/);
    assert.match(myMapDetailPageSource, /const cachedDirectory = getCachedMyMapDetail\(user, mapId\)/);
    assert.match(myMapDetailPageSource, /cacheMyMapDetail\(user, mapId, nextDirectory\)/);
});

test('map resource management refreshes authoritative membership and exposes busy feedback', () => {
    assert.match(myMapDetailPageSource, /const refreshedDirectory = await loadMap\(\)/);
    assert.match(myMapDetailPageSource, /await Promise\.allSettled\(\[/);
    assert.match(myMapDetailPageSource, /isMyMapAssetSelectionReconciled\(refreshedDirectory\.assets, targetKeys\)/);
    assert.match(myMapDetailPageSource, /loading=\{addLoading \|\| savedAssetsLoading\}/);
    assert.match(createMapModalSource, /initialAssetKeySignature/);
    assert.match(createMapModalSource, /data-testid="create-map-loading-status"/);
    assert.match(createMapModalSource, /aria-busy=\{dialogBusy\}/);
    assert.match(createMapModalSource, /<LoaderCircle size=\{17\} className="animate-spin"/);
});

test('map resource management can search all resources, save through shared favourites, and select the result', () => {
    assert.match(myMapDetailPageSource, /toggleSavedAsset,/);
    assert.match(myMapDetailPageSource, /async function handleSaveManageCatalogAsset\(asset\)/);
    assert.match(myMapDetailPageSource, /const result = await toggleSavedAsset\(/);
    assert.match(myMapDetailPageSource, /allowCatalogSearch/);
    assert.match(myMapDetailPageSource, /onSaveCatalogAsset=\{handleSaveManageCatalogAsset\}/);
    assert.match(createMapModalSource, /loadManageMapResourceCatalog\(\{/);
    assert.match(createMapModalSource, /filterManageMapResourceCatalog\(\{/);
    assert.match(createMapModalSource, /data-testid=\{`manage-map-save-add-\$\{key\}`\}/);
    assert.match(createMapModalSource, /const savedAsset = await onSaveCatalogAsset\(asset\)/);
    assert.match(createMapModalSource, /addAssetAndHostsToSelection\(/);
});

test('map resource management keeps mobile actions above the device safe area', () => {
    assert.match(createMapModalSource, /max-h-\[calc\(100svh-0\.75rem\)\]/);
    assert.match(createMapModalSource, /pb-\[calc\(env\(safe-area-inset-bottom\)\+16px\)\]/);
    assert.match(createMapModalSource, /min-h-0 flex-1 space-y-3 overflow-y-auto/);
    assert.match(createMapModalSource, /mt-5 flex shrink-0 flex-col gap-3 border-t/);
});

test('my maps list exposes an owner-only duplicate action that opens the copied map', () => {
    assert.match(apiSource, /duplicateMyMap: \(id\) => request\('POST', `\/my-maps\/\$\{id\}\/duplicate`\)/);
    assert.match(myDirectoryPageSource, /const \[duplicatingMapId, setDuplicatingMapId\] = useState\(null\)/);
    assert.match(myDirectoryPageSource, /const copied = await api\.duplicateMyMap\(map\.id\)/);
    assert.match(myDirectoryPageSource, /navigate\(`\/my-directory\/maps\/\$\{copied\.id\}`\)/);
    assert.match(myDirectoryPageSource, /onDuplicate=\{handleDuplicateMap\}/);
    assert.match(myMapCardSource, /import \{ ArrowRight, Copy, Map, Pencil, Trash2 \} from 'lucide-react'/);
    assert.match(myMapCardSource, /onDuplicate,\s+onRename,/);
    assert.match(myMapCardSource, /onClick=\{\(\) => onDuplicate\?\.\(map\)\}/);
    assert.match(myMapCardSource, /duplicating \? t\('duplicatingMap'\) : t\('duplicateMap'\)/);
    assert.match(i18nSource, /duplicateMap: 'Duplicate'/);
    assert.match(i18nSource, /failedDuplicateMap: 'Failed to duplicate this map\.'/);
});

test('mobile My Map entry resets restored card-list scroll before showing the map', () => {
    assert.match(appSource, /<MobileMyMapEntryScrollReset \/>/);
    assert.match(mobileMyMapEntryScrollResetSource, /MOBILE_MY_MAP_PATH_PATTERN/);
    assert.match(mobileMyMapEntryScrollResetSource, /new URLSearchParams\(location\.search\)\.get\('view'\) !== 'print'/);
    assert.match(mobileMyMapEntryScrollResetSource, /!window\.matchMedia\('\(min-width: 1024px\)'\)\.matches/);
    assert.match(mobileMyMapEntryScrollResetSource, /window\.scrollTo\(\{ top: 0, left: 0, behavior: 'auto' \}\)/);
    assert.match(mobileMyMapEntryScrollResetSource, /window\.requestAnimationFrame\(\(\) => \{/);
    assert.match(mobileMyMapEntryScrollResetSource, /window\.setTimeout\(resetEntryScroll, 50\)/);
    assert.match(mobileMyMapEntryScrollResetSource, /window\.addEventListener\('scroll', resetEntryScroll, \{ passive: true \}\)/);
    assert.match(mobileMyMapEntryScrollResetSource, /window\.removeEventListener\('scroll', resetEntryScroll\);[\s\S]*\}, 120\)/);
    assert.match(mobileMyMapEntryScrollResetSource, /\[location\.key, location\.pathname, location\.search\]/);
});
