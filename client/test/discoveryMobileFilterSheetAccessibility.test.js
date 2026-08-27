import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
    new URL('../src/features/discover/DiscoveryFilterPanel.jsx', import.meta.url),
    'utf8',
);

test('mobile Discover filters keep a visible localized close action', () => {
    assert.match(source, /headerActions=\{\([\s\S]*?onClick=\{\(\) => onOpenChange\(false\)\}[\s\S]*?t\('done'\)/);
});
