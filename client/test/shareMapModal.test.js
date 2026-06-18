import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const shareMapModalSource = readFileSync(
    new URL('../src/components/ShareMapModal.jsx', import.meta.url),
    'utf8',
);

test('share map modal prompts owners to update stale shared links intentionally', () => {
    assert.match(
        shareMapModalSource,
        /import \{ hasSharedMapUpdates \} from '\.\.\/lib\/shareMapStatus\.js';/,
    );
    assert.match(
        shareMapModalSource,
        /const hasPendingShareUpdates = hasSharedMapUpdates\(map\);/,
    );
    assert.match(
        shareMapModalSource,
        /hasPendingShareUpdates \? t\('shareLinkNeedsUpdateTitle'\) : t\('sharedLinkIsLive'\)/,
    );
    assert.match(
        shareMapModalSource,
        /hasPendingShareUpdates \? t\('shareLinkNeedsUpdateDescription'\) : t\('sharedLinkDescription'\)/,
    );
});

test('share map modal keeps copy-existing separate from update-shared-link', () => {
    assert.match(
        shareMapModalSource,
        /hasPendingShareUpdates \? t\('copyExistingLink'\) : t\('copyLink'\)/,
    );
    assert.match(
        shareMapModalSource,
        /hasPendingShareUpdates \? 'btn-primary' : 'btn-ghost border border-brand-200 text-brand-700 hover:bg-brand-50'/,
    );
    assert.match(
        shareMapModalSource,
        /onClick=\{\(\) => onPublish\?\.\(\)\}/,
    );
});
