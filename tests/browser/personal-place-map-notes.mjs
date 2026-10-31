// Actual owner page with fictional personal places and intercepted persistence.
// No production requests, real accounts, or writes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { createMapStudioDocument } from '../../client/src/lib/mapStudioState.js';
import { Hono } from 'hono';
import { createPersonalPlaceMapNotesHandlers } from '../../server/src/controllers/personalPlaceMapNotesController.js';
import { attachPersonalPlaceMapNotes, createPersonalPlaceMapNotesRepository } from '../../server/src/utils/personalPlaceMapNotes.js';
import { createMapAnnotationMediaHandlers } from '../../server/src/controllers/mapAnnotationMediaController.js';
import { createMapNoteImageHandlers } from '../../server/src/controllers/mapNoteImagesController.js';
import { attachMapNoteImages, createMapNoteImageRepository } from '../../server/src/utils/mapNoteImages.js';
import { MapMediaBucket, whereValues } from '../../server/test/helpers/mapAnnotationFixtures.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const device = process.argv.find(arg => arg.startsWith('--device='))?.slice(9) || 'phone';
const devices = { phone: { width: 390, height: 844 }, tablet: { width: 768, height: 1024 }, desktop: { width: 1280, height: 900 } };
assert.ok(devices[device], 'Choose phone, tablet or desktop');
const out = process.argv.find(arg => arg.startsWith('--out='))?.slice(6) || await fs.mkdtemp(path.join(os.tmpdir(), 'personal-place-map-notes-'));
await fs.mkdir(out, { recursive: true });
const report = { boundary: 'Actual owner page, fictional personal place and intercepted persistence. No production requests or device proof.',
    device, cases: [], writes: [], errors: [] };
const mapId = 91261014;
const bucket = new MapMediaBucket(), repo = createPersonalPlaceMapNotesRepository(bucket, 7), images = createMapNoteImageRepository(bucket, 7);
const memberships = { assets: [], personalPlaceLinks: [{ id: 71, personalPlaceId: 21 }] };
const db = { query: {
    myMaps: { findFirst: async ({ where }) => JSON.stringify(whereValues(where)) === `[${mapId},7]` ? { id: mapId } : null },
    userPersonalPlaces: { findFirst: async ({ where }) => JSON.stringify(whereValues(where)) === '[21,7]' ? { id: 21 } : null },
    myMapPersonalPlaceLinks: { findFirst: async ({ where }) => JSON.stringify(whereValues(where)) === `[${mapId},21]` ? { id: 71 } : null },
} };
const app = new Hono(); app.use('*', async (c, next) => { c.set('user', { id: 7, role: 'standard' }); await next(); });
const options = { dbForContext: () => db, bucketForContext: () => bucket };
app.patch('/api/my-maps/:id/personal-places/:placeId/notes', createPersonalPlaceMapNotesHandlers(options).replace);
const media = createMapAnnotationMediaHandlers(options), gallery = createMapNoteImageHandlers(options);
app.post('/api/my-maps/:id/annotation-media', media.upload); app.get('/api/my-maps/:id/annotation-media/:assetId', media.read);
app.get('/api/my-maps/:id/note-images/:resourceType/:resourceId', gallery.read); app.put('/api/my-maps/:id/note-images/:resourceType/:resourceId', gallery.replace);
let failNextSave = false;
const row = { rowKey: 'personal_place-21', assetKey: 'personal_place-21', resourceType: 'personal_place', resourceId: 21,
    personalPlaceId: 21, isPersonalPlace: true, name: 'Fictional personal place', subCategory: 'Personal place', bucket: 'Personal place',
    address: 'Fictional address', status: 'available', detailPath: null, saveEligible: false, notes: { items: [] }, mapShortDescriptors: [] };
const pin = { pinKey: 'personal-place-21', placeKey: 'personal-place-21', title: row.name, lat: 1.3, lng: 103.85,
    curatedCount: 1, previewResourceNames: [row.name] };
const directory = { id: mapId, name: 'Fictional Care Map', description: '', updatedAt: new Date().toISOString(),
    summary: { resourceCount: 1, savedResourceCount: 0, personalPlaceCount: 1, placeCount: 1, mappablePlaceCount: 1 }, categoryOrder: [],
    share: { isShared: false, shareToken: null, sharePath: null, embedEnabled: false, embedAllowedOrigins: [] }, assets: [], personalPlaces: [row],
    places: [{ ...pin, name: row.name, address: row.address, hasCoordinates: true, rows: [row] }], pins: [pin],
    viewer: { isAuthenticated: true, isOwner: true, canSaveCopy: false, canSaveResources: true } };
const studio = createMapStudioDocument(); studio.revision = 1; studio.views[0].revision = 1;
const server = await createServer({ configFile: path.join(root, 'tests/fixtures/care-map-view-controls/vite.config.mjs'), server: { port: 4202 + Object.keys(devices).indexOf(device) } });
let browser, page;
async function openNotes() {
    await page.getByRole('button', { name: 'Open map notes', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: /^Fictional personal place/ }).click();
}
try {
    await server.listen();
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: devices[device], hasTouch: device !== 'desktop', isMobile: device !== 'desktop', acceptDownloads: true });
    await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url()), method = request.method();
        if (url.pathname.includes('/api/auth/')) return route.fulfill({ json: { user: { id: 7, name: 'Fictional owner', role: 'standard', locale: 'en' } } });
        if (url.pathname.includes('/note-images/') || url.pathname.includes('/annotation-media') || url.pathname.endsWith('/notes')) {
            if (method === 'PATCH' && url.pathname.endsWith('/notes')) {
                report.writes.push({ path: url.pathname, input: request.postDataJSON() });
                if (failNextSave) { failNextSave = false; return route.fulfill({ status: 503, json: { error: 'Fictional temporary save failure' } }); }
            }
            const response = await app.request(`http://fixture.invalid${url.pathname}`, { method, headers: request.headers(),
                ...(!['GET', 'HEAD'].includes(method) ? { body: request.postDataBuffer() } : {}) });
            return route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
        }
        if (url.pathname.endsWith(`/my-maps/${mapId}/studio`)) return route.fulfill({ json: { mapId, document: studio, updatedAt: null } });
        if (url.pathname.endsWith(`/my-maps/${mapId}/print-annotations`)) return route.fulfill({ json: { mapId, schemaVersion: 1, revision: 0, annotations: [] } });
        if (url.pathname.endsWith(`/my-maps/${mapId}`)) return route.fulfill({ json: attachMapNoteImages(
            attachPersonalPlaceMapNotes(directory, memberships, (await repo.read(mapId)).document), memberships, (await images.read(mapId)).document) });
        if (url.pathname.startsWith('/api/')) return route.fulfill({ json: [] });
        if (url.hostname === '127.0.0.1') return route.continue();
        return route.abort();
    });
    page = await context.newPage(); page.on('pageerror', error => report.errors.push(error.message));
    await page.goto(`${server.resolvedUrls.local[0]}?route=/my-directory/maps/${mapId}?workspace=current`);
    // Current reload/entry starts map-first; use its real return before legacy notes assertions.
    await page.locator('[data-map-first-exit="true"]').click();
    await openNotes();
    await page.getByRole('dialog').locator('textarea').first().fill('Personal place note must survive closing and reload.');
    const file = path.join(out, 'fictional.png');
    const png = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 32;
        const context = canvas.getContext('2d'); context.fillStyle = '#ff7800'; context.fillRect(0, 0, 32, 32); return canvas.toDataURL('image/png').split(',')[1]; });
    await fs.writeFile(file, Buffer.from(png, 'base64'));
    for (let n = 0; n < 40 && !await page.getByRole('button', { name: 'Add image to notes', exact: true }).last().isEnabled(); n++) await page.waitForTimeout(50);
    await page.locator('[data-map-note-images] input[type=file]:not([capture])').setInputFiles(file);
    await page.getByRole('link', { name: 'Download image', exact: true }).waitFor();
    const downloadPromise = page.waitForEvent('download'); await page.getByRole('link', { name: 'Download image', exact: true }).click();
    const download = await downloadPromise, imagePath = path.join(out, 'download.png'); await download.saveAs(imagePath);
    assert.equal(createHash('sha256').update(await fs.readFile(imagePath)).digest('hex'), (await images.read(mapId)).document.entries[0].images[0].assetId);
    report.cases.push('Personal-place image download matches the stored image exactly');
    assert.equal(report.writes.length, 0, 'Image upload preserves unsaved text without forcing a text write');
    report.cases.push('Personal-place image upload preserves the active text draft');
    await page.getByRole('button', { name: 'Close map notes', exact: true }).click();
    for (let n = 0; n < 30 && report.writes.length === 0; n++) await page.waitForTimeout(50);
    assert.equal(report.writes.length, 1, 'Closing personal-place notes must persist the text exactly once');
    report.cases.push('Personal-place note emits one persistence request on close');
    await page.reload(); await page.locator('[data-map-first-exit="true"]').click(); await openNotes();
    assert.ok((await page.getByRole('dialog').innerText()).includes('Personal place note must survive closing and reload.'), 'Personal-place note survives reload');
    report.cases.push('Personal-place text survives reload');
    await page.getByRole('link', { name: 'Download image', exact: true }).waitFor();
    assert.equal(await page.getByRole('checkbox', { name: 'Share this note', exact: true }).count(), 0);
    assert.equal(await page.getByRole('link', { name: 'Add to Care Calendar', exact: true }).count(), 0);
    report.cases.push('Personal-place notes and images remain private without SQL-calendar links');
    await page.getByRole('button', { name: 'Add another note', exact: true }).click();
    await page.getByRole('dialog').locator('textarea').last().fill('A second private note.');
    failNextSave = true;
    await page.getByRole('button', { name: 'Close map notes', exact: true }).click();
    await page.getByRole('button', { name: 'Save notes', exact: true }).waitFor();
    assert.equal(await page.getByRole('dialog').locator('textarea').last().inputValue(), 'A second private note.');
    report.cases.push('Failed save leaves personal notes open with the draft and Retry');
    await page.getByRole('button', { name: 'Save notes', exact: true }).click();
    for (let n = 0; n < 40 && (await repo.read(mapId)).document.entries[0].items.length !== 2; n++) await page.waitForTimeout(50);
    assert.equal((await repo.read(mapId)).document.entries[0].items.length, 2);
    await page.getByRole('dialog').locator('header button').first().click();
    await page.getByRole('dialog').getByRole('button', { name: /^Fictional personal place/ }).click();
    assert.ok((await page.getByRole('dialog').innerText()).includes('A second private note.'));
    assert.equal((await images.read(mapId)).document.entries[0].images.length, 1);
    report.cases.push('Retry and back/reopen persist multiple notes without losing the image');
    assert.deepEqual(report.errors, []);
    console.log(JSON.stringify(report, null, 2));
} catch (error) {
    report.failure = error.message;
    if (page) await page.screenshot({ path: path.join(out, 'failure.png') });
    throw error;
} finally {
    await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    await browser?.close(); await server.close();
}
