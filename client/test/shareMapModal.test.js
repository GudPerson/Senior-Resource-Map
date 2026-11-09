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
    assert.match(shareMapModalSource, /onPublish\?\.\(\{ includeAnnotations: includeAnnotationsSelection,\s*noteImagesRevision: map\?\.noteImagesRevision,\s*\.\.\.\(embeddedView \? \{ embeddedView \} : \{\}\) \}\)/);
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
        /const published = await onPublish\?\.\(\{ includeAnnotations: includeAnnotationsSelection,\s*noteImagesRevision: map\?\.noteImagesRevision,\s*\.\.\.\(embeddedView \? \{ embeddedView \} : \{\}\) \}\);/,
    );
    assert.match(
        shareMapModalSource,
        /if \(!published\) return false;/,
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
async function renderShareWithActions(props) {
    if (!shareRenderer) {
        const require = createRequire(import.meta.url);
        const { outputFiles } = await build({
            stdin: { contents: `import React from 'react'; import { renderToStaticMarkup } from 'react-dom/server'; import Modal from './ShareMapModal.jsx';
                let buttons=[]; __shareTestFragment=React.Fragment;
                __shareTestElement=(type,props,...children)=>{ if(type==='button') buttons.push({...props,children}); return React.createElement(type,props,...children); };
                export const render=(props)=>{ buttons=[]; const html=renderToStaticMarkup(<Modal {...props}/>); return {html,buttons:[...buttons]}; };`,
                resolveDir: new URL('../src/components', import.meta.url).pathname, loader: 'jsx' },
            bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'transform', jsxFactory: '__shareTestElement', jsxFragment: '__shareTestFragment',
            banner: { js: 'var __shareTestElement, __shareTestFragment;' }, loader: { '.css': 'empty' }, logLevel: 'silent',
        });
        const module = { exports: {} };
        new Function('require', 'module', 'exports', outputFiles[0].text)(require, module, module.exports);
        shareRenderer = module.exports.render;
    }
    return shareRenderer({ isOpen: true, map: { id: 7, name: 'Fictional map', share: { isShared: true, sharePath: '/shared/fictional' } }, ...props });
}

async function renderShare(props) { return (await renderShareWithActions(props)).html; }

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


test('legacy callback never promotes an unpublished regional draft and retains image revision', async () => {
    const calls=[];
    let injected;
    const {buttons}=await renderShareWithActions({
        map:{id:7,name:'Fictional map',noteImagesRevision:9,share:{isShared:false}},
        RegionalDiscoverySettingsComponent:props=>{injected=props;return null;},
        onPublish:async options=>{calls.push(options);return true;},
    });
    assert.equal(injected.mapId,7);
    const publish=buttons.find(button=>button.children.join('')==='Publish share link');
    assert.ok(publish,'actual compact publish button');
    assert.equal(await publish.onClick(),true);
    assert.deepEqual(calls,[{includeAnnotations:null,noteImagesRevision:9}]);
});

test('explicit regional callback validates intent and uses the same share callback result', async () => {
    const calls=[];
    let injected;
    let succeeds=false;
    await renderShareWithActions({map:{id:7,name:'Fictional map',noteImagesRevision:9,share:{isShared:false}},
        RegionalDiscoverySettingsComponent:props=>{injected=props;return null;},
        onPublish:async options=>{calls.push(options);return succeeds;},
    });
    assert.equal(await injected.onPublish({mode:'regional-discovery',revision:3}),false);
    succeeds=true;
    assert.equal(await injected.onPublish({mode:'regional-discovery',revision:3}),true);
    assert.equal(await injected.onPublish({mode:'compact'}),true);
    assert.deepEqual(calls,[
        {includeAnnotations:null,noteImagesRevision:9,embeddedView:{mode:'regional-discovery',revision:3}},
        {includeAnnotations:null,noteImagesRevision:9,embeddedView:{mode:'regional-discovery',revision:3}},
        {includeAnnotations:null,noteImagesRevision:9,embeddedView:{mode:'compact'}},
    ]);
    assert.throws(()=>injected.onPublish({mode:'regional-discovery',revision:0}));
    assert.equal(calls.length,3);
});
