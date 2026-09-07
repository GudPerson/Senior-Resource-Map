import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const resourcesPageSource = readFileSync(
    new URL('../src/pages/dashboard/ResourcesPage.jsx', import.meta.url),
    'utf8',
);
const myDirectoryPageSource = readFileSync(
    new URL('../src/pages/MyDirectoryPage.jsx', import.meta.url),
    'utf8',
);

test('Manage Resources expands into wide screens and wraps its growing toolset', () => {
    assert.match(resourcesPageSource, /max-w-\[1680px\]/);
    assert.match(resourcesPageSource, /md:flex-row md:flex-wrap/);
    assert.match(resourcesPageSource, /md:flex-\[2_1_360px\]/);
    assert.match(resourcesPageSource, /xl:flex-row xl:items-center xl:justify-between/);
});

test('My Directory expands into wide screens with controlled three-column results', () => {
    assert.match(myDirectoryPageSource, /max-w-\[1680px\]/);
    assert.match(myDirectoryPageSource, /grid gap-4 md:grid-cols-2 2xl:grid-cols-3/);
    assert.doesNotMatch(myDirectoryPageSource, /repeat\(auto-fit,minmax\(290px,1fr\)\)/);
});
