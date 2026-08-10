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
    assert.match(directoryListSource, /disabled=\{removePending\}/);
    assert.match(directoryListSource, /removePending \? 'removingFromMap' : 'remove'/);
});

test('owner removal actions are progressively disclosed from Edit content', () => {
    assert.match(myMapDetailSource, /data-owner-resource-removal-mode="true"/);
    assert.match(myMapDetailSource, /role="menuitemcheckbox"[\s\S]*aria-checked=\{resourceRemovalMode\}[\s\S]*t\('removeResources'\)/);
    assert.match(myMapDetailSource, /const \[resourceRemovalMode, setResourceRemovalMode\] = useState\(false\)/);
    assert.match(myMapDetailSource, /function toggleResourceRemovalMode\(\)/);
    assert.match(myMapDetailSource, /onRemoveResource=\{resourceRemovalMode \? handleRemoveResource : null\}/);
    assert.doesNotMatch(myMapDetailSource, /onRemoveResource=\{handleRemoveResource\}/);
    assert.match(myMapDetailSource, /const contentModeActive = shortDescriptionMode \|\| annotationEditing \|\| resourceRemovalMode/);
});

test('the repeated primary Place exposes removal on the ordinary card shell', () => {
    assert.match(directoryListSource, /const primaryManagedPlaceRow = getPrimaryManagedPlaceRow\(group\)/);
    assert.match(
        directoryListSource,
        /const canRemovePrimaryResource = interactive\s*&& mode === 'owner'\s*&& Boolean\(primaryManagedPlaceRow && onRemoveResource\)/,
    );
    assert.match(directoryListSource, /row=\{primaryManagedPlaceRow\}[\s\S]*onRemoveResource=\{onRemoveResource\}[\s\S]*card/);
    assert.match(directoryListSource, /data-my-map-card-remove=\{card \? 'true' : undefined\}/);
    assert.match(directoryListSource, /!canFocusCardOnMap && !canRemovePrimaryResource/);
    assert.doesNotMatch(directoryListSource, /show(?:Interactive)?ResourceRows && canRemovePrimaryResource/);
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
