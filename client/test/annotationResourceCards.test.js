import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';

const row = { rowKey: '100:place:1', resourceType: 'hard', resourceId: 1, name: 'Fictional Centre', status: 'available', detailPath: '/resource/hard/1', assetKey: 'hard-1' };
const programme = { rowKey: '101:place:1', resourceType: 'soft', resourceId: 2, name: 'Fictional Programme', status: 'available', detailPath: '/resource/soft/2', assetKey: 'soft-2' };
const group = { placeKey: 'place:1', placeId: 1, name: row.name, hasCoordinates: true, rows: [row, programme], memberPlaceKeys: ['place:1'], categoryLabel: 'Fictional care', number: 1 };
const presentation = { mappedGroups: [group], displayGroups: [group], mobileDisplayGroups: [group], leftGroups: [group], rightGroups: [], mapColumnGroups: [], unmappedRows: [] };
let loaded;
async function renderer() {
    if (loaded) return loaded;
    const require = createRequire(import.meta.url), runtimePath = require.resolve('react/jsx-runtime');
    const { outputFiles } = await build({ stdin: { contents: `import React from 'react'; import { renderToStaticMarkup } from 'react-dom/server'; import { MemoryRouter } from 'react-router-dom'; import Directory from './SharedMapDirectoryList.jsx'; import Picker from './AnnotationResourcePicker.jsx'; import { captured } from 'test:jsx-capture'; export const render=(presentation,mode,interaction)=>{captured.length=0; const html=renderToStaticMarkup(<MemoryRouter><Directory presentation={presentation} mode={mode} layout='desktop' onViewOnMap={globalThis.__annotationMapFocus} annotationResourceInteraction={interaction} canSaveResources={false} /></MemoryRouter>);return {html,nodes:[...captured]};}; export const picker=(directory,annotation)=>renderToStaticMarkup(<Picker directory={directory} annotation={annotation} />);`,
        resolveDir: new URL('../src/components', import.meta.url).pathname, loader: 'jsx' },
        bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', loader: { '.css': 'empty' }, logLevel: 'silent',
        plugins: [{ name: 'fictional-map-render', setup(build) {
            build.onResolve({ filter: /^(react\/jsx-runtime|test:jsx-capture)$/ }, () => ({ path: 'capture', namespace: 'capture' }));
            build.onLoad({ filter: /.*/, namespace: 'capture' }, () => ({ contents: `import runtime from ${JSON.stringify(runtimePath)}; export const captured=[]; export const Fragment=runtime.Fragment; export function jsx(type,props,key){captured.push({type,props});return runtime.jsx(type,props,key)} export function jsxs(type,props,key){captured.push({type,props});return runtime.jsxs(type,props,key)}`, resolveDir: new URL('../src/components', import.meta.url).pathname }));
            build.onLoad({ filter: /\/AuthContext\.jsx$/ }, () => ({ contents: "export const useAuth=()=>({user:{id:4,role:'standard'},isAuth:true});" }));
            build.onLoad({ filter: /\/hooks\/useSavedAssets\.js$/ }, () => ({ contents: "export const useSavedAssets=()=>({isSaved:()=>false,isSavedAssetPending:()=>false,toggleSavedAsset:async()=>{}});" }));
        } }] });
    const module = { exports: {} }; new Function('require', 'module', 'exports', outputFiles[0].text)(require, module, module.exports);
    loaded = module.exports; return loaded;
}

const interaction = (onActivateResources) => ({ onActivateResources, taggedResourceKeys: new Set(['soft:2']), activeResourceKeys: new Set(['soft:2']), pulsingResourceKeys: new Set(['soft:2']) });
function event(nested = false, key = undefined) { return { target: { closest: () => nested ? {} : null }, key, prevented: false, preventDefault() { this.prevented = true; } }; }

test('owner annotation emphasis is separate from map selection and leaves shared rendering unchanged', async () => {
    const render = (await renderer()).render;
    const base = render(presentation, 'owner', null), active = render(presentation, 'owner', interaction(() => {}));
    assert.doesNotMatch(base.html, /annotation-resource-card-highlight|data-annotation-resource-active/);
    assert.match(active.html, /annotation-resource-card-highlight annotation-resource-card-pulse/);
    assert.match(active.html, /data-annotation-resource-active="true"/);
    assert.match(active.html, /href="\/resource\/hard\/1"/);
    assert.match(active.html, /href="\/resource\/soft\/2"/);
    assert.equal((active.html.match(/data-directory-place-card="true"/g) || []).length, (base.html.match(/data-directory-place-card="true"/g) || []).length);
    assert.equal(render(presentation, 'shared', interaction(() => {})).html, render(presentation, 'shared', null).html);
});

test('actual card handlers preserve nested controls and keyboard behavior while notifying resource activation', async () => {
    const focused = [], activated = [];
    globalThis.__annotationMapFocus = (key) => focused.push(key);
    try {
        const { nodes } = (await renderer()).render(presentation, 'owner', interaction((links) => activated.push(links)));
        const card = nodes.find(({ props }) => props['data-directory-place-card'] === 'true').props;
        card.onClick(event(true)); card.onKeyDown(event(true, 'Enter')); card.onKeyDown(event(false, 'Escape'));
        assert.deepEqual(focused, []); assert.deepEqual(activated, []);
        card.onClick(event()); card.onKeyDown(event(false, 'Enter')); card.onKeyDown(event(false, ' '));
        assert.deepEqual(focused, ['place:1', 'place:1', 'place:1']);
        assert.deepEqual(activated, Array.from({ length: 3 }, () => [{ type: 'hard', id: 1 }, { type: 'soft', id: 2 }]));
    } finally { delete globalThis.__annotationMapFocus; }
});

test('a linked list-only card activates its annotation without inventing a map focus target', async () => {
    const listGroup = { ...group, placeKey: 'unmapped:101', placeId: null, name: programme.name, hasCoordinates: false, rows: [programme], memberPlaceKeys: ['unmapped:101'], mapFocusPlaceKeys: [] };
    const value = { ...presentation, mappedGroups: [], displayGroups: [listGroup], leftGroups: [listGroup], mobileDisplayGroups: [listGroup], integratesUnmappedRowsAsCards: true };
    const focused = [], activated = []; globalThis.__annotationMapFocus = (key) => focused.push(key);
    try {
        const { nodes } = (await renderer()).render(value, 'owner', interaction((links) => activated.push(links)));
        const card = nodes.find(({ props }) => props['data-directory-place-card'] === 'true').props;
        assert.equal(card.role, 'button'); assert.equal(card.tabIndex, 0);
        card.onClick(event()); assert.deepEqual(focused, []); assert.deepEqual(activated, [[{ type: 'soft', id: 2 }]]);
        const unlinked = (await renderer()).render(value, 'owner', null).nodes.find(({ props }) => props['data-directory-place-card'] === 'true').props;
        assert.equal(unlinked.role, undefined);
    } finally { delete globalThis.__annotationMapFocus; }
});

test('tagging control is accessible and does not edit an annotation simply by rendering', async () => {
    const annotation = { id: 'a', type: 'rectangle', isShared: true, points: [[1, 103], [1.1, 103.1]], text: 'Fictional note', style: { color: '#0f766e' }, resourceLinks: [{ type: 'soft', id: 2 }], resourceBehaviour: 'pulse' };
    const before = structuredClone(annotation), directory = { id: 7, assets: [row, programme], personalPlaces: [], places: [{ placeKey: 'place:1', rows: [row, programme] }] };
    const html = (await renderer()).picker(directory, annotation);
    assert.match(html, /<button[^>]*type="button"[^>]*aria-expanded="false"[^>]*aria-controls=/);
    assert.match(html, /Tag Resources \(1\)/);
    assert.deepEqual(annotation, before); assert.doesNotMatch(html, /soft:2|101:place:1/);
});
