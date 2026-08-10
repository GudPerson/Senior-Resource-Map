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
        /const hasPendingShareUpdates = hasSharedMapUpdates\(map\) \|\| includeAnnotationsSelection !== null;/,
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

test('share map modal exposes an explicit bulk annotation opt-in without bypassing annotation flags', () => {
    assert.match(shareMapModalSource, /annotations = \[\]/);
    assert.match(shareMapModalSource, /annotations\.filter\(\(annotation\) => Boolean\(annotation\?\.isShared\)\)\.length/);
    assert.match(shareMapModalSource, /includeAnnotationsRef\.current\.indeterminate = includesSomeAnnotations/);
    assert.match(shareMapModalSource, /setIncludeAnnotationsSelection\(event\.target\.checked\)/);
    assert.match(shareMapModalSource, /onPublish\?\.\(\{ includeAnnotations: includeAnnotationsSelection \}\)/);
    assert.match(shareMapModalSource, /t\('includeAnnotationsInShare'\)/);
    assert.match(shareMapModalSource, /disabled=\{!annotationCount \|\| !annotationsReady \|\| submitting\}/);
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
        /onClick=\{handlePublishClick\}/,
    );
});

test('share map modal explains and refreshes the frozen embed preview after publication', () => {
    assert.match(
        shareMapModalSource,
        /const \[embedPreviewRevision, setEmbedPreviewRevision\] = useState\(0\);/,
    );
    assert.match(
        shareMapModalSource,
        /const published = await onPublish\?\.\(\{ includeAnnotations: includeAnnotationsSelection \}\);/,
    );
    assert.match(
        shareMapModalSource,
        /if \(!published\) return;/,
    );
    assert.match(
        shareMapModalSource,
        /setEmbedPreviewRevision\(\(current\) => current \+ 1\);/,
    );
    assert.match(
        shareMapModalSource,
        /src=\{embedPreviewUrl\}/,
    );
    assert.match(
        shareMapModalSource,
        /t\('embedPreviewSnapshotTitle'\)/,
    );
    assert.match(
        shareMapModalSource,
        /t\('embedPreviewSnapshotDescription'\)/,
    );
});
