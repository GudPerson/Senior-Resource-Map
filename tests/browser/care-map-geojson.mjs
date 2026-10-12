// Actual owner page with fictional APIs and synthetic imagery; never contacts production.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { createMapStudioDocument } from '../../client/src/lib/mapStudioState.js';
import { parseGeoJsonBoundaries } from '../../client/src/lib/geoJsonBoundaries.js';
import { validatePrintAnnotationDocumentInput } from '../../server/src/controllers/printAnnotationsController.js';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const out = process.argv.find(a => a.startsWith('--out='))?.slice(6) || await fs.mkdtemp(path.join(os.tmpdir(), 'care-map-geojson-'));
const sample = process.argv.find(a => a.startsWith('--sample='))?.slice(9);
await fs.mkdir(out, { recursive: true });
const report = { proof: 'Actual owner page, fictional persistence, synthetic tiles and emulated viewport. No production writes or physical-device proof.', cases: [], errors: [], writes: [], unexpectedWrites: [], blockedExternal: [] };
const server = await createServer({ configFile: path.join(repo, 'tests/fixtures/care-map-view-controls/vite.config.mjs'), server: { port: 4198 } });
await server.listen();
const origin = server.resolvedUrls.local[0];
const outer = [[103.848, 1.298], [103.852, 1.298], [103.852, 1.302], [103.848, 1.302], [103.848, 1.298]];
const hole = [[103.8493, 1.2993], [103.8507, 1.2993], [103.8507, 1.3007], [103.8493, 1.3007], [103.8493, 1.2993]];
const island = outer.map(([x, y]) => [x + 0.007, y]);
const source = { type: 'FeatureCollection', features: [
    { type: 'Feature', properties: { Name: 'Fictional mainland and island' }, geometry: { type: 'MultiPolygon', coordinates: [[outer, hole], [island]] } },
    { type: 'Feature', properties: { Name: 'Fictional second area' }, geometry: { type: 'Polygon', coordinates: [outer.map(([x, y]) => [x, y + 0.008])] } },
    { type: 'Feature', properties: { Name: 'Fictional pin' }, geometry: { type: 'Point', coordinates: outer[0] } },
] };
let annotations = [], revision = 1, browser;
const studio = createMapStudioDocument();
studio.revision = 1; studio.views[0].revision = 1;
studio.views[0].design.camera = { mode: 'fixed', view: { center: [1.30, 103.85], zoom: 16 } };
studio.views[0].design.layout.preset = 'full-map';
const row = { rowKey: 'personal:91261', assetKey: 'personal:91261', resourceType: 'personal', resourceId: 91261,
    personalPlaceId: 91261, name: 'Fictional centre', personalPlaceCategory: 'home', subCategory: 'Personal place',
    address: 'Fictional address', lat: 1.30, lng: 103.85, isPersonalPlace: true, saveEligible: false,
    status: 'active', mapShortDescriptors: [] };
const pin = { pinKey: 'personal:91261', placeKey: 'personal:91261', title: row.name, lat: row.lat, lng: row.lng,
    curatedCount: 0, previewResourceNames: [] };
const directory = { id: 91261012, name: 'Fictional GeoJSON map', description: '', categoryOrder: [],
    summary: { resourceCount: 1, savedResourceCount: 0, personalPlaceCount: 1, placeCount: 1, mappablePlaceCount: 1 },
    share: { isShared: false, shareToken: null, embedEnabled: false, embedAllowedOrigins: [] },
    assets: [], personalPlaces: [{ ...row, shortDescription: '', shortDescriptors: [] }],
    places: [{ ...pin, name: row.name, address: row.address, hasCoordinates: true, openProgrammeServiceCount: 0, rows: [row] }], pins: [pin],
    viewer: { isAuthenticated: true, isOwner: true, canSaveCopy: false, canSaveResources: true } };
const check = (name, passed) => { report.cases.push({ name, passed }); assert.ok(passed, name); };
async function install(page) {
    page.on('pageerror', e => report.errors.push(e.message));
    await page.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url()), method = request.method();
        if (url.pathname.includes('/api/auth/')) return route.fulfill({ json: { user: { id: 91261, name: 'Fictional owner', role: 'standard', locale: 'en' } } });
        if (url.pathname.endsWith('/my-maps/91261012/print-annotations')) {
            if (method === 'PUT') {
                const input = validatePrintAnnotationDocumentInput(request.postDataJSON());
                if (input.revision !== revision) return route.fulfill({ status: 409, json: { error: 'Revision conflict' } });
                annotations = input.annotations; revision++;
                report.writes.push({ path: url.pathname, method, revision, annotations: structuredClone(annotations) });
            } else if (!['GET', 'OPTIONS'].includes(method)) report.unexpectedWrites.push({ path: url.pathname, method });
            return route.fulfill({ json: { mapId: 91261012, schemaVersion: 1, annotations, revision } });
        }
        if (url.pathname.endsWith('/my-maps/91261012')) return route.fulfill({ json: directory });
        if (url.pathname.endsWith('/my-maps/91261012/studio')) {
            if (!['GET', 'OPTIONS'].includes(method)) report.unexpectedWrites.push({ path: url.pathname, method });
            return route.fulfill({ json: { mapId: 91261012, document: studio, updatedAt: null } });
        }
        if (url.pathname.startsWith('/api/')) {
            if (!['GET', 'OPTIONS'].includes(method)) report.unexpectedWrites.push({ path: url.pathname, method });
            return route.fulfill({ json: [] });
        }
        if (url.hostname === '127.0.0.1') return route.continue();
        if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ body: '', contentType: 'text/css' });
        if (url.hostname.includes('onemap.gov.sg')) return route.fulfill({ body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64'), contentType: 'image/png' });
        report.blockedExternal.push(url.hostname); return route.abort();
    });
}
async function openImport(page) {
    const trigger = page.getByRole('button', { name: 'Import boundaries', exact: true });
    if (!await trigger.isVisible()) {
        await page.getByRole('button', { name: 'Edit content', exact: true }).click();
        await page.getByText('Annotate', { exact: true }).click();
    }
    await trigger.click();
    await page.getByRole('dialog', { name: 'Import map boundaries' }).waitFor();
}
const input = page => page.locator('input[type=file][accept*=".geojson"]');
async function waitSaved(predicate) {
    for (let i = 0; i < 40; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 100)); }
    assert.ok(predicate(), 'Fictional save did not settle');
}
try {
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 1024 }, acceptDownloads: true });
    await install(page); await page.goto(origin);
    await page.getByRole('button', { name: 'Edit content', exact: true }).waitFor();
    await openImport(page);
    const kmlRing = ring => ring.map(([lng, lat]) => `${lng},${lat}`).join(' ');
    const polygon = (ring, cutout) => `<Polygon><outerBoundaryIs><LinearRing><coordinates>${kmlRing(ring)}</coordinates></LinearRing></outerBoundaryIs>${cutout ? `<innerBoundaryIs><LinearRing><coordinates>${kmlRing(cutout)}</coordinates></LinearRing></innerBoundaryIs>` : ''}</Polygon>`;
    const xml = `<kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><name>Fictional legacy KML</name><MultiGeometry>${polygon(outer, hole)}${polygon(island)}</MultiGeometry></Placemark></Document></kml>`;
    await input(page).setInputFiles({ name: 'legacy.kml', mimeType: 'application/vnd.google-earth.kml+xml', buffer: Buffer.from(xml) });
    await page.getByRole('dialog').getByRole('checkbox').first().waitFor();
    check('native KML still previews multipart areas and holes', (await page.getByRole('dialog').innerText()).includes('2 parts · 1 cut-outs · 12 corners'));
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).last().click();
    check('cancelling a KML preview starts no annotation save', report.writes.length === 0);
    await openImport(page);
    await input(page).setInputFiles({ name: 'not-geographic.json', mimeType: 'application/json', buffer: Buffer.from('{"name":"ordinary JSON"}') });
    await page.getByRole('dialog').getByRole('alert').waitFor();
    check('plain JSON receives an actionable GeoJSON refusal without changing the document', (await page.getByRole('dialog').getByRole('alert').innerText()).includes('could not be read as GeoJSON') && report.writes.length === 0);
    await input(page).setInputFiles({ name: 'fictional.geojson', mimeType: 'application/geo+json', buffer: Buffer.from(JSON.stringify(source)) });
    const dialog = page.getByRole('dialog', { name: 'Import map boundaries' });
    await dialog.getByRole('checkbox').first().waitFor();
    check('native GeoJSON preview shows named features and skips pins', await dialog.locator('label').filter({ hasText: 'Fictional second area' }).count() === 1 && (await dialog.innerText()).includes('Skipped items (1)'));
    check('multipart preview contains both outer rings and the hole', await dialog.getByRole('img', { name: 'Boundary preview' }).locator('path').count() === 3 && (await dialog.getByRole('img', { name: 'Boundary preview' }).locator('path').first().getAttribute('d')).split('M').length - 1 === 2);
    await dialog.getByRole('checkbox').nth(1).uncheck();
    await dialog.locator('summary').filter({ hasText: 'Adjust appearance' }).first().click();
    for (const [label, value] of [['Fill colour', '#ff0000'], ['Fill opacity', '1']]) {
        await dialog.getByLabel(`Fictional mainland and island — ${label}`, { exact: true }).evaluate((element, next) => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, next);
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
        }, value);
    }
    await dialog.screenshot({ path: path.join(out, 'geojson-preview.png') });
    await dialog.getByRole('button', { name: 'Add selected boundaries', exact: true }).click();
    await waitSaved(() => annotations.length === 1);
    const expected = parseGeoJsonBoundaries(JSON.stringify(source)).boundaries[0];
    check('selection persists only the chosen private GeoJSON feature', annotations.length === 1 && annotations[0].text === expected.name && annotations[0].boundarySource === 'kml' && annotations[0].isShared === false);
    assert.deepEqual(annotations[0].points, expected.points); assert.deepEqual(annotations[0].controlPoints, expected.points); assert.deepEqual(annotations[0].boundaryParts, expected.boundaryParts);
    check('save retains every exact source coordinate and ring length', true);
    const originalImport = structuredClone(annotations);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await waitSaved(() => annotations.length === 0);
    check('Undo removes the entire grouped import', annotations.length === 0);
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await waitSaved(() => annotations.length === 1);
    assert.deepEqual(annotations, originalImport);
    check('Redo restores every exact corner, hole and private source flag', true);
    const persisted = structuredClone(annotations);
    await page.reload(); await page.getByRole('button', { name: 'Edit content', exact: true }).waitFor();
    await page.waitForTimeout(600);
    check('reload restores grouped SVG geometry with nonzero fill', await page.locator('path[fill-rule="nonzero"]').count() >= 1);
    assert.deepEqual(annotations, persisted);
    await page.getByRole('button', { name: 'Export View', exact: true }).click();
    const save = page.locator('[data-print-export-page-action="map"]');
    await save.waitFor();
    for (let i = 0; i < 60 && await save.isDisabled(); i++) await page.waitForTimeout(500);
    assert.equal(await save.isDisabled(), false);
    let download = page.waitForEvent('download'); await save.click(); await (await download).saveAs(path.join(out, 'geojson.png'));
    download = page.waitForEvent('download'); await page.locator('[data-print-pdf-export="a3"]').click(); await (await download).saveAs(path.join(out, 'geojson.pdf'));
    check('owner PNG and PDF download with imported multipart boundary', (await fs.stat(path.join(out, 'geojson.png'))).size > 1000 && (await fs.stat(path.join(out, 'geojson.pdf'))).size > 1000);
    await page.getByRole('button', { name: 'Back to interactive view', exact: true }).click();
    await openImport(page);
    await input(page).setInputFiles({ name: 'fictional.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
    await page.getByRole('dialog').getByRole('checkbox').first().waitFor();
    const writeCount = report.writes.length;
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).last().click();
    await page.waitForTimeout(500);
    check('JSON extension previews and Cancel changes no saved document', report.writes.length === writeCount && JSON.stringify(annotations) === JSON.stringify(persisted));
    if (sample) {
        await openImport(page); await input(page).setInputFiles(sample);
        const parsed = parseGeoJsonBoundaries(await fs.readFile(sample, 'utf8'));
        await page.getByRole('dialog').getByRole('checkbox').first().waitFor();
        check('supplied electoral file previews every supported group with actionable skips', await page.getByRole('dialog').getByRole('checkbox').count() === parsed.boundaries.length && (await page.getByRole('dialog').innerText()).includes(`Skipped items (${parsed.skipped.length})`));
        await page.getByRole('dialog').screenshot({ path: path.join(out, 'electoral-preview.png') });
        await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).last().click();
        report.sample = { supported: parsed.boundaries.length, skipped: parsed.skipped, corners: parsed.boundaries.reduce((sum, item) => sum + item.points.length, 0) };
    }
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(600);
    check('phone-width viewing keeps exact imported geometry and saved data', await page.locator('path[fill-rule="nonzero"]').count() >= 1 && JSON.stringify(annotations) === JSON.stringify(persisted));
    await page.screenshot({ path: path.join(out, 'geojson-phone.png') });
    await page.close();
} catch (error) {
    report.failure = error.stack;
    const page = browser?.contexts()[0]?.pages()[0];
    if (page) {
        await fs.writeFile(path.join(out, 'failure-dom.txt'), await page.locator('body').innerText());
        await page.screenshot({ path: path.join(out, 'failure.png') });
    }
}
finally {
    await browser?.close(); await server.close();
    report.passed = report.cases.length > 0 && report.cases.every(c => c.passed) && !report.errors.length && !report.unexpectedWrites.length && !report.failure;
    await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ out, ...report })); if (!report.passed) process.exitCode = 1;
}
