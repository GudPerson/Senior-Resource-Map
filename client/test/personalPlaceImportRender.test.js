import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { applyPersonalPlaceImportLookup, parsePersonalPlaceImportGrid, reviewPersonalPlaceImportRows } from '../src/lib/personalPlaceImport.js';

let render;
async function renderers() {
    if (render) return render;
    const { outputFiles } = await build({
        stdin: {
            contents: `import React from 'react'; import { renderToStaticMarkup } from 'react-dom/server'; import ImportModal, { PersonalPlaceImportRows } from './PersonalPlaceImportModal.jsx'; import Chooser from './AddPersonalPlaceChooserModal.jsx'; export function modal(open) { return renderToStaticMarkup(<ImportModal open={open} mapId={7} onImported={() => {}} />); } export function rows(rows, categories) { return renderToStaticMarkup(<PersonalPlaceImportRows rows={rows} categories={categories} />); } export function chooser(importEnabled) { return renderToStaticMarkup(<Chooser open mapId={7} onImport={importEnabled ? () => {} : undefined} />); }`,
            resolveDir: new URL('../src/components/personalPlaces/', import.meta.url).pathname,
            loader: 'jsx',
        },
        bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic',
        define: { 'import.meta.env': '{}' }, logLevel: 'silent',
    });
    const module = { exports: {} };
    new Function('require', 'module', 'exports', outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
    render = module.exports;
    return render;
}

function readyRow(patch = {}) {
    const row = parsePersonalPlaceImportGrid([['Name', 'Postal Code'], ['<script>Private place</script>', '070001']])[0];
    return { ...applyPersonalPlaceImportLookup(row, { location: { postalCode: '070001', address: 'Reviewed #02-05', lat: 1.3, lng: 103.8 } }), ...patch };
}

test('import dialog exposes private copy, exact file formats, template, cancel and disabled empty confirmation', async () => {
    const html = (await renderers()).modal(true);
    assert.match(html, /role="dialog"/); assert.match(html, /aria-modal="true"/);
    assert.match(html, /aria-label="Import personal places"/);
    assert.match(html, /aria-label="Select CSV or Excel spreadsheet"/);
    assert.match(html, /accept="\.csv,\.xlsx,\.xls"/);
    assert.match(html, /Download template/); assert.match(html, /Cancel/);
    assert.match(html, /excluded from shared links and embeds/);
    assert.match(html, /disabled=""[^>]*>Add 0 places to this map/);
    assert.match(html, /overflow-y-auto/); assert.match(html, /safe-area-inset-bottom/);
    assert.equal((await renderers()).modal(false), '');
});

test('preview safely renders spreadsheet text and address inputs with generic category default', async () => {
    const rows = reviewPersonalPlaceImportRows([readyRow()]);
    const html = (await renderers()).rows(rows, [{ id: 12, name: 'Neighbourhood', isArchived: false }]);
    assert.match(html, /&lt;script&gt;Private place&lt;\/script&gt;/); assert.doesNotMatch(html, /<script>/);
    assert.match(html, /aria-label="Address for row 2"/); assert.match(html, /value="Reviewed #02-05"/);
    assert.match(html, /aria-label="Category for row 2"/); assert.match(html, /value="" selected="">Personal place/);
    assert.match(html, /aria-label="Skip row 2"/); assert.match(html, /Ready to create/);
});

test('archived selected category remains visibly unavailable without changing other row details', async () => {
    const categories = [{ id: 12, name: 'Old category', isArchived: true }, { id: 14, name: 'New category' }];
    const rows = reviewPersonalPlaceImportRows([readyRow({ categoryId: 12 })], { categories });
    const html = (await renderers()).rows(rows, categories);
    assert.match(html, /Category unavailable — choose another/); assert.match(html, /value="12" selected=""/);
    assert.doesNotMatch(html, />Old category</); assert.match(html, /value="Reviewed #02-05"/);
    assert.match(html, /role="alert"/);
});

test('failed lookup exposes retry and an explicit skip control while saved rows cannot be edited', async () => {
    const failed = readyRow({ lookupStatus: 'failed', lookupError: 'Postal mismatch', location: null });
    const html = (await renderers()).rows(reviewPersonalPlaceImportRows([failed]), []);
    assert.match(html, /Postal mismatch/); assert.match(html, /aria-label="Retry location for row 2"/);
    const saved = readyRow({ result: { status: 'created', placeId: 91, confirmed: false } });
    const savedHtml = (await renderers()).rows(reviewPersonalPlaceImportRows([saved]), []);
    assert.match(savedHtml, /Refresh is required/); assert.match(savedHtml, /aria-label="Awaiting confirmation"/);
    assert.doesNotMatch(savedHtml, /aria-label="Skip row 2"/);
    assert.match(savedHtml, /disabled=""[^>]*aria-label="Address for row 2"/);
});

test('import entry is available only when the owner page supplies its callback', async () => {
    const renderer = await renderers();
    assert.match(renderer.chooser(true), /Import spreadsheet/);
    assert.doesNotMatch(renderer.chooser(false), /Import spreadsheet/);
    assert.match(renderer.chooser(true), /Choose map location/);
});
