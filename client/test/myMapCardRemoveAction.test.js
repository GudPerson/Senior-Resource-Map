import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const myMapDetailSource = fs.readFileSync(
    new URL('../src/pages/MyMapDetailPage.jsx', import.meta.url),
    'utf8',
);
const directoryListSource = fs.readFileSync(
    new URL('../src/components/SharedMapDirectoryList.jsx', import.meta.url),
    'utf8',
);

test('owner interactive resource rows expose a guarded remove-from-map action', () => {
    assert.match(
        directoryListSource,
        /const canRemoveMapResource = interactive\s*&& mode === 'owner'\s*&& !personalPlace\s*&& Boolean\(onRemoveResource\)/,
    );
    assert.match(directoryListSource, /data-my-map-resource-remove="true"/);
    assert.match(directoryListSource, /className="inline-flex h-11/);
    assert.match(directoryListSource, /disabled=\{removePending\}/);
    assert.match(directoryListSource, /removePending \? 'removingFromMap' : 'remove'/);
});

test('resource-card removal confirms the named resource and reloads authoritative membership', () => {
    assert.match(myMapDetailSource, /useConfirmDialog\(\)/);
    assert.match(myMapDetailSource, /mapCardRemovalInFlightRef/);
    assert.match(myMapDetailSource, /title: t\('removeMapResourceTitle'\)/);
    assert.match(myMapDetailSource, /message: t\('removeMapResourceMessage', \{ name:/);
    assert.match(myMapDetailSource, /details: \[t\('removeMapResourceDetail'\)\]/);
    assert.match(myMapDetailSource, /await api\.removeMyMapAsset\(directory\.id, row\.resourceType, row\.resourceId\)/);
    assert.match(myMapDetailSource, /const refreshed = await loadMap\(\)/);
    assert.match(myMapDetailSource, /\{confirmDialog\}/);
});
