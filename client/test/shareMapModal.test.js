import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { build } from 'esbuild';
import { createRequire } from 'node:module';

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
    assert.match(shareMapModalSource, /shareableAnnotations\.filter\(\(annotation\) => Boolean\(annotation\?\.isShared\)\)\.length/);
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

let shareRenderer;
async function renderShare(props) {
    if (!shareRenderer) {
        const require = createRequire(import.meta.url);
        const { outputFiles } = await build({
            stdin: { contents: `import React from 'react'; import { renderToStaticMarkup } from 'react-dom/server'; import Modal from './ShareMapModal.jsx'; export const render=(props)=>renderToStaticMarkup(<Modal {...props}/>);`, resolveDir: new URL('../src/components', import.meta.url).pathname, loader: 'jsx' },
            bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', loader: { '.css': 'empty' }, logLevel: 'silent',
        });
        const module = { exports: {} };
        new Function('require', 'module', 'exports', outputFiles[0].text)(require, module, module.exports);
        shareRenderer = module.exports.render;
    }
    return shareRenderer({ isOpen: true, map: { id: 7, name: 'Fictional map', share: { isShared: true, sharePath: '/shared/fictional' } }, ...props });
}

test('private images do not inflate the share count or change existing shape opt-in', async () => {
    const annotations = [
        { id: 'shared-shape', type: 'rectangle', isShared: true },
        { id: 'private-image', type: 'image', isShared: false },
        { id: 'private-shape', type: 'circle', isShared: false },
    ];
    const before = structuredClone(annotations);
    const html = await renderShare({ annotations });
    assert.match(html, /1 of 2 saved annotations will be public/);
    assert.match(html, /Images are private and are not included in shared links/);
    assert.doesNotMatch(html, /1 of 3 saved annotations/);
    assert.deepEqual(annotations, before);
});

test('an image-only map cannot opt private images into the shared link', async () => {
    const html = await renderShare({ annotations: [{ id: 'image', type: 'image', isShared: true }] });
    assert.match(html, /<input[^>]*type="checkbox"[^>]*disabled=""/);
    assert.match(html, /Images are private and are not included in shared links/);
    assert.doesNotMatch(html, /1 of 1 saved annotations/);
});
