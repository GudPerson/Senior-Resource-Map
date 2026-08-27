import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const navbarSource = readFileSync(
    new URL('../src/components/layout/Navbar.jsx', import.meta.url),
    'utf8',
);

function getOpeningTag(id) {
    const idIndex = navbarSource.indexOf(`id="${id}"`);
    assert.notEqual(idIndex, -1, `${id} should exist`);
    const tagStart = navbarSource.lastIndexOf('<', idIndex);
    const tagEnd = navbarSource.indexOf('>', idIndex);
    return navbarSource.slice(tagStart, tagEnd + 1);
}

test('mobile icon-only sign-in and sign-out controls keep accessible names', () => {
    for (const id of ['nav-login', 'nav-logout']) {
        const openingTag = getOpeningTag(id);
        assert.match(openingTag, /aria-label=/);
        assert.match(openingTag, /title=/);
    }
});
