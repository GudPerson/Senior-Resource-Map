import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const savedAssetsContextSource = fs.readFileSync(new URL('../src/contexts/SavedAssetsContext.jsx', import.meta.url), 'utf8');
const saveAssetButtonSource = fs.readFileSync(new URL('../src/components/SaveAssetButton.jsx', import.meta.url), 'utf8');
const myDirectoryPageSource = fs.readFileSync(new URL('../src/pages/MyDirectoryPage.jsx', import.meta.url), 'utf8');

test('SavedAssetsProvider preserves saved rows when saved-resource loading fails', () => {
    assert.match(savedAssetsContextSource, /savedAssetsLoadError/);
    assert.match(savedAssetsContextSource, /setSavedAssetsLoadError/);
    assert.doesNotMatch(savedAssetsContextSource, /catch \(err\)[\s\S]{0,220}setSavedAssets\(\[\]\)/);
});

test('saved-resource toggles are blocked while saved state is not trusted', () => {
    assert.match(savedAssetsContextSource, /savedAssetsLoading \|\| savedAssetsLoadError/);
    assert.match(saveAssetButtonSource, /savedAssetsLoadError/);
    assert.match(saveAssetButtonSource, /savedAssetsUnavailable/);
    assert.match(saveAssetButtonSource, /disabled=\{disabled\}/);
});

test('My Directory shows a load failure instead of an empty saved-resource state', () => {
    assert.match(myDirectoryPageSource, /savedAssetsLoadError/);
    assert.match(myDirectoryPageSource, /savedResourcesLoadFailedTitle/);
    assert.match(myDirectoryPageSource, /savedResourcesLoadFailedAction/);
});
