import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientRoot = resolve(__dirname, '..');

function readSource(relativePath) {
    return readFileSync(resolve(clientRoot, relativePath), 'utf8');
}

test('admin single-resource delete ignores repeat clicks while the request is running', () => {
    const source = readSource('src/pages/dashboard/AdminPage.jsx');

    assert.match(source, /deletingResourceKeys/);
    assert.match(source, /if \(deletingResourceKeys\.includes\(resourceKey\)\) return;/);
    assert.match(source, /setDeletingResourceKeys\(\(prev\) => \[\.\.\.prev, resourceKey\]\)/);
    assert.match(source, /setDeletingResourceKeys\(\(prev\) => prev\.filter\(\(key\) => key !== resourceKey\)\)/);
    assert.match(source, /disabled=\{isDeletingResource\}/);
    assert.match(source, /title=\{isDeletingResource \? 'Deleting\.\.\.' : 'Delete'\}/);
});

test('resource dashboard confirmation modal disables delete while the request is running', () => {
    const source = readSource('src/pages/dashboard/ResourcesPage.jsx');

    assert.match(source, /deleteSubmitting/);
    assert.match(source, /if \(deleteSubmitting\) return;/);
    assert.match(source, /setDeleteSubmitting\(true\)/);
    assert.match(source, /setDeleteSubmitting\(false\)/);
    assert.match(source, /disabled=\{deleteSubmitting\}/);
    assert.match(source, /\{deleteSubmitting \? 'Deleting\.\.\.' : 'Delete'\}/);
});
