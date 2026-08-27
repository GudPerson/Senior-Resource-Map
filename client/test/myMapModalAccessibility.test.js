import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const createMapModalSource = readFileSync(
    new URL('../src/components/CreateMapModal.jsx', import.meta.url),
    'utf8',
);
const renameMapModalSource = readFileSync(
    new URL('../src/components/RenameMapModal.jsx', import.meta.url),
    'utf8',
);
const shareMapModalSource = readFileSync(
    new URL('../src/components/ShareMapModal.jsx', import.meta.url),
    'utf8',
);

for (const [name, source] of [
    ['Create map', createMapModalSource],
    ['Rename map', renameMapModalSource],
    ['Share map', shareMapModalSource],
]) {
    test(`${name} overlay exposes modal dialog semantics`, () => {
        assert.match(source, /role="presentation"/);
        assert.match(source, /role="dialog"/);
        assert.match(source, /aria-modal="true"/);
        assert.match(source, /aria-labelledby=\{titleId\}/);
        assert.match(source, /<h2 id=\{titleId\}/);
        assert.match(source, /onKeyDown=\{handleDialogKeyDown\}/);
        assert.match(source, /handleModalKeyboardEvent\(event/);
    });
}

test('Share map modal moves initial focus inside the dialog', () => {
    assert.match(shareMapModalSource, /const closeButtonRef = useRef\(null\)/);
    assert.match(shareMapModalSource, /const returnFocusTarget = document\.activeElement/);
    assert.match(shareMapModalSource, /closeButtonRef\.current\?\.focus\(\)/);
    assert.match(shareMapModalSource, /returnFocusTarget\?\.focus\?\.\(\)/);
    assert.match(shareMapModalSource, /ref=\{closeButtonRef\}/);
});
