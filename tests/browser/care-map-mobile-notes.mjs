// Isolated native browser replay: fictional accounts/resources, memory R2,
// intercepted APIs and synthetic imagery. Never contacts production.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { Hono } from 'hono';
import { createMapStudioDocument } from '../../client/src/lib/mapStudioState.js';
import { validatePrintAnnotationDocumentInput } from '../../server/src/controllers/printAnnotationsController.js';
import { createMapAnnotationMediaHandlers } from '../../server/src/controllers/mapAnnotationMediaController.js';
import { createMapNoteImageHandlers } from '../../server/src/controllers/mapNoteImagesController.js';
import { attachMapNoteImages, createMapNoteImageRepository } from '../../server/src/utils/mapNoteImages.js';
import { MapMediaBucket, whereValues } from '../../server/test/helpers/mapAnnotationFixtures.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const out = process.argv.find(arg => arg.startsWith('--out='))?.slice(6) || await fs.mkdtemp(path.join(os.tmpdir(), 'care-map-mobile-notes-'));
await fs.mkdir(out, { recursive: true });
const report = { boundary: 'Actual owner/shared pages, native Chromium touch, fictional API/DB, memory R2, synthetic images. No production requests/writes or physical-device proof.',
    cases: [], errors: [], writes: [], unexpectedWrites: [], blocked: [] };
const check = (name, value) => { report.cases.push({ name, passed: Boolean(value) }); assert.ok(value, name); console.log(`PASS: ${name}`); };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function png(red, blue) {
    const crc = buffer => { let value = 0xffffffff; for (const b of buffer) { value ^= b; for (let n = 0; n < 8; n++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0); } return (value ^ 0xffffffff) >>> 0; };
    const chunk = (name, data) => { const content = Buffer.concat([Buffer.from(name), data]), size = Buffer.alloc(4), checksum = Buffer.alloc(4); size.writeUInt32BE(data.length); checksum.writeUInt32BE(crc(content)); return Buffer.concat([size, content, checksum]); };
    const header = Buffer.alloc(13); header.writeUInt32BE(256); header.writeUInt32BE(128, 4); header[8] = 8; header[9] = 6;
    const rows = Buffer.alloc(128 * (1 + 256 * 4));
    for (let y = 0; y < 128; y++) for (let x = 0; x < 256; x++) { const n = y * 1025 + 1 + x * 4; rows[n] = red; rows[n + 1] = Math.round(x / 2); rows[n + 2] = blue; rows[n + 3] = 255; }
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}
const fileOne = path.join(out, 'fictional-red.png'), fileTwo = path.join(out, 'fictional-blue.png');
await fs.writeFile(fileOne, png(210, 50)); await fs.writeFile(fileTwo, png(50, 210));
const moreFiles = [];
for (const [index, red, blue] of [[3, 120, 120], [4, 80, 80], [5, 20, 200]]) {
    const file = path.join(out, `fictional-image-${index}.png`); await fs.writeFile(file, png(red, blue)); moreFiles.push(file);
}
const server = await createServer({ configFile: path.join(root, 'tests/fixtures/care-map-view-controls/vite.config.mjs'), server: { port: 4199 } });
await server.listen(); const origin = server.resolvedUrls.local[0]; let browser;
let lastPage;

async function fixture(context) {
    const mapId = 91261013, ownerId = 7, bucket = new MapMediaBucket(), repo = createMapNoteImageRepository(bucket, ownerId);
    let annotations = [], annotationRevision = 0, textSaves = 0, shared = null, owner = true;
    const row = { rowKey: 'hard-11', assetKey: 'hard-11', resourceType: 'hard', resourceId: 11, name: 'Fictional resource',
        subCategory: 'Active Ageing Centre', bucket: 'Active Ageing Centre', address: 'Fictional test address', status: 'available',
        detailPath: '/resource/hard/11', saveEligible: true, notes: { items: [] }, mapShortDescriptors: [] };
    const pin = { pinKey: 'fictional-place', placeKey: 'fictional-place', title: row.name, lat: 1.3, lng: 103.85,
        curatedCount: 1, previewResourceNames: [row.name] };
    const directory = { id: mapId, name: 'Fictional mobile Care Map', description: '', updatedAt: new Date().toISOString(),
        summary: { resourceCount: 1, savedResourceCount: 1, personalPlaceCount: 0, placeCount: 1, mappablePlaceCount: 1 }, categoryOrder: [],
        share: { isShared: false, shareToken: null, sharePath: null, embedEnabled: false, embedAllowedOrigins: [] }, assets: [row], personalPlaces: [],
        places: [{ ...pin, placeId: 11, name: row.name, address: row.address, hasCoordinates: true, rows: [row] }], pins: [pin],
        viewer: { isAuthenticated: true, isOwner: true, canSaveCopy: false, canSaveResources: true } };
    const studio = createMapStudioDocument(); studio.revision = 1; studio.views[0].revision = 1;
    studio.views[0].design.camera = { mode: 'fixed', view: { center: [1.3, 103.85], zoom: 16.1 } };
    const db = { query: {
        myMaps: { findFirst: async ({ where }) => { const values = whereValues(where);
            return values[0] === mapId && values[1] === ownerId ? { id: mapId }
                : values[0] === 'fictional-shared' && values[1] === true && shared ? { userId: ownerId } : null; } },
        myMapAssets: { findFirst: async ({ where }) => JSON.stringify(whereValues(where)) === JSON.stringify([mapId, 'hard', 11]) ? { id: 31 } : null },
    } };
    const app = new Hono(); app.use('*', async (c, next) => { c.set('user', owner ? { id: ownerId, role: 'standard' } : null); await next(); });
    const imageHandlers = createMapAnnotationMediaHandlers({ dbForContext: () => db, bucketForContext: () => bucket });
    const noteHandlers = createMapNoteImageHandlers({ dbForContext: () => db, bucketForContext: () => bucket,
        sharedDirectory: async () => { if (!shared) throw Object.assign(new Error('revoked'), { status: 404 }); return shared; } });
    app.post('/api/my-maps/:id/annotation-media', imageHandlers.upload); app.get('/api/my-maps/:id/annotation-media/:assetId', imageHandlers.read);
    app.get('/api/my-maps/:id/note-images/:resourceType/:resourceId', noteHandlers.read); app.put('/api/my-maps/:id/note-images/:resourceType/:resourceId', noteHandlers.replace);
    app.get('/api/shared-maps/:token/note-images/:assetId', noteHandlers.sharedRead);
    await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url()), method = request.method();
        if (url.pathname.includes('/api/auth/')) return route.fulfill({ json: { user: owner ? { id: ownerId, name: 'Fictional owner', role: 'standard', locale: 'en' } : null } });
        if (url.pathname.includes('/note-images/') || url.pathname.includes('/annotation-media')) {
            if (!['GET', 'OPTIONS'].includes(method)) report.writes.push({ method, path: url.pathname });
            const response = await app.request(`http://fixture.invalid${url.pathname}`, { method, headers: request.headers(),
                ...(!['GET', 'HEAD'].includes(method) ? { body: request.postDataBuffer() } : {}) });
            return route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
        }
        if (url.pathname.endsWith(`/my-maps/${mapId}/print-annotations`)) {
            if (method === 'PUT') {
                const input = validatePrintAnnotationDocumentInput(request.postDataJSON());
                assert.equal(input.revision, annotationRevision); annotations = input.annotations; annotationRevision++;
                report.writes.push({ method, path: url.pathname });
            }
            return route.fulfill({ json: { mapId, schemaVersion: 1, annotations, revision: annotationRevision } });
        }
        if (url.pathname.endsWith(`/my-maps/${mapId}/assets/hard/11/notes`)) {
            const input = request.postDataJSON(); textSaves++;
            row.notes = { ...row.notes, items: input.notes.map((item, index) => ({ ...item, id: 500 + textSaves + index })), notesUpdatedAt: new Date().toISOString() };
            report.writes.push({ method, path: url.pathname }); return route.fulfill({ json: { ...row } });
        }
        if (url.pathname.endsWith(`/my-maps/${mapId}/share`)) {
            const { document } = await repo.read(mapId); assert.equal(request.postDataJSON().noteImagesRevision, document.revision);
            shared = attachMapNoteImages(structuredClone(directory), { assets: [{ id: 31, resourceType: 'hard', resourceId: 11 }] }, document, { shared: true });
            for (const item of [...shared.assets, ...shared.places.flatMap(place => place.rows)]) {
                item.notes = { ...(item.notes || {}), items: (item.notes?.items || []).filter(note => note.isShared) };
            }
            directory.share = { ...directory.share, isShared: true, shareToken: 'fictional-shared', sharePath: '/shared/maps/fictional-shared', shareUpdatedAt: new Date().toISOString() };
            shared.share = directory.share; shared.viewer = { isAuthenticated: false, isOwner: false, canSaveCopy: false, canSaveResources: false };
            report.writes.push({ method, path: url.pathname }); return route.fulfill({ json: directory.share });
        }
        if (url.pathname.endsWith(`/my-maps/${mapId}/studio`)) return route.fulfill({ json: { mapId, document: studio, updatedAt: null } });
        if (url.pathname.endsWith(`/my-maps/${mapId}`)) {
            const { document } = await repo.read(mapId);
            return route.fulfill({ json: { ...attachMapNoteImages(directory, { assets: [{ id: 31, resourceType: 'hard', resourceId: 11 }] }, document),
                noteImagesRevision: document.revision, noteImagesUpdatedAt: document.updatedAt || null } });
        }
        if (url.pathname.endsWith('/shared-maps/fictional-shared')) return route.fulfill({ status: shared ? 200 : 404, json: shared || { error: 'revoked' } });
        if (url.pathname.startsWith('/api/')) {
            if (!['GET', 'OPTIONS'].includes(method)) report.unexpectedWrites.push({ method, path: url.pathname });
            return route.fulfill({ json: [] });
        }
        if (url.hostname === '127.0.0.1') return route.continue();
        if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ body: '', contentType: 'text/css' });
        if (url.hostname.includes('onemap.gov.sg')) return route.fulfill({ body: png(245, 245), contentType: 'image/png' });
        report.blocked.push(url.hostname); return route.abort();
    });
    return { mapId, bucket, repo, annotations: () => structuredClone(annotations), textSaves: () => textSaves,
        shared: () => shared, guest: () => { owner = false; }, revoke: () => { shared = null; }, app };
}

async function touchDrag(page, from, to) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: from.x, y: from.y }] });
    for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1,
        x: from.x + (to.x - from.x) * i / 8, y: from.y + (to.y - from.y) * i / 8 }] }); await page.waitForTimeout(20); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach();
}
async function settle(predicate) { for (let n = 0; n < 50; n++) { if (await predicate()) return; await new Promise(resolve => setTimeout(resolve, 100)); } throw new Error('state did not settle'); }
async function menu(page, action) {
    const open = page.getByRole('button', { name: 'Open map controls', exact: true });
    if (await open.isVisible()) await open.click();
    await page.getByRole('button', { name: action, exact: true }).click();
}
async function notes(page) {
    await page.getByRole('button', { name: 'Open map notes', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: /^Fictional resource/ }).click();
}
async function upload(page, file) {
    await settle(async () => await page.getByRole('button', { name: 'Add image to notes', exact: true }).last().isEnabled());
    await page.locator('[data-map-note-images] input[type=file]:not([capture])').setInputFiles(file);
}

try {
    browser = await chromium.launch({ headless: true });
    for (const [name, viewport] of [['phone', { width: 390, height: 844 }], ['tablet', { width: 768, height: 1024 }]]) {
        const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true, acceptDownloads: true });
        await context.addInitScript(() => {
            const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
            window.__fixtureImageUrls = new Set();
            URL.createObjectURL = blob => { const url = create(blob); window.__fixtureImageUrls.add(url); return url; };
            URL.revokeObjectURL = url => { window.__fixtureImageUrls.delete(url); revoke(url); };
        });
        const f = await fixture(context), page = await context.newPage(); lastPage = page; page.on('pageerror', error => report.errors.push(error.message));
        await page.goto(`${origin}?route=/my-directory/maps/${f.mapId}?workspace=current`);
        await page.getByRole('button', { name: 'Open map controls', exact: true }).waitFor();
        await menu(page, 'Edit content');
        const annotate = page.getByRole('menuitemcheckbox', { name: 'Annotate', exact: true });
        await settle(() => annotate.isEnabled()); check(`${name}: coarse touch owner can open Annotate`, await annotate.isEnabled()); await annotate.click();
        await page.locator('[data-print-annotation-toolbar]').getByText('Saved', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Draw box', exact: true }).click();
        const maps = await page.locator('.leaflet-container').all(); let map;
        for (const candidate of maps) { const box = await candidate.boundingBox();
            if (box && box.y >= 0 && box.y < viewport.height && box.x >= 0 && box.x < viewport.width) map = candidate; }
        assert.ok(map, 'a real map is visible inside the viewport');
        const bounds = await map.boundingBox(); report.mapBounds = bounds;
        await page.touchscreen.tap(bounds.x + bounds.width * .2, bounds.y + bounds.height * .27);
        await page.touchscreen.tap(bounds.x + bounds.width * .78, bounds.y + bounds.height * .17);
        await settle(() => f.annotations().length === 1);
        const original = f.annotations(); check(`${name}: native taps create exactly one rectangle`, original[0].type === 'rectangle' && original[0].points.length === 2);
        let before;
        for (const handle of await page.locator('.carearound-print-annotation-vertex').all()) {
            const rect = await handle.boundingBox();
            if (rect && await page.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest('.carearound-print-annotation-vertex')),
                { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 })) { before = rect; break; }
        }
        assert.ok(before, 'a geographic edit handle is unobstructed');
        await touchDrag(page, { x: before.x + 22, y: before.y + 22 }, { x: before.x + 44, y: before.y + 30 });
        await settle(() => JSON.stringify(f.annotations()[0].points) !== JSON.stringify(original[0].points));
        const moved = f.annotations(); check(`${name}: native handle drag commits geographic geometry`, JSON.stringify(moved[0].points) !== JSON.stringify(original[0].points));
        await page.getByRole('button', { name: 'Undo', exact: true }).click(); await settle(() => JSON.stringify(f.annotations()) === JSON.stringify(original));
        await page.getByRole('button', { name: 'Redo', exact: true }).click(); await settle(() => JSON.stringify(f.annotations()) === JSON.stringify(moved));
        check(`${name}: Undo/Redo restore exact stored points`, true);
        await page.screenshot({ path: path.join(out, `${name}-annotations.png`) });
        await page.getByRole('button', { name: 'Annotation options', exact: true }).click();
        for (const label of ['Add image', 'Import boundaries', 'Tag Resources']) {
            const control = page.getByRole('button', { name: label, exact: true }).last();
            await control.scrollIntoViewIfNeeded();
            const rect = await control.boundingBox();
            check(`${name}: ${label} is reachable in mobile annotation options`, await page.evaluate(({ x, y, label }) => {
                const button = document.elementFromPoint(x, y)?.closest('button');
                return button?.textContent.trim() === label;
            }, { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, label }));
        }
        await page.getByRole('button', { name: 'Close annotations', exact: true }).click();
        await notes(page); const editor = page.getByRole('dialog').locator('textarea').first(); await editor.fill('Fictional text stays while images upload.');
        await upload(page, fileOne); await settle(async () => (await f.repo.read(f.mapId)).document.entries[0]?.images.length === 1);
        await page.getByRole('link', { name: 'Download image', exact: true }).waitFor();
        check(`${name}: image upload preserves active text and deferred text save`, await editor.inputValue() === 'Fictional text stays while images upload.' && f.textSaves() === 0);
        const firstImage = (await f.repo.read(f.mapId)).document.entries[0].images[0];
        check(`${name}: upload is private by default`, firstImage.isShared === false && !f.shared());
        const downloadPromise = page.waitForEvent('download'); await page.getByRole('link', { name: 'Download image', exact: true }).click();
        const download = await downloadPromise, saved = path.join(out, `${name}-download.png`); await download.saveAs(saved);
        check(`${name}: downloaded normalized image bytes match immutable asset digest`, sha(await fs.readFile(saved)) === firstImage.assetId);
        const imageUrl = await page.getByRole('img', { name: 'Map note image 1', exact: true }).getAttribute('src');
        await page.getByRole('checkbox', { name: 'Share this image', exact: true }).click();
        await settle(async () => (await f.repo.read(f.mapId)).document.entries[0].images[0].isShared);
        check(`${name}: share toggle leaves decoded image stable and does not publish`, await page.getByRole('img', { name: 'Map note image 1', exact: true }).getAttribute('src') === imageUrl && !f.shared());
        await upload(page, fileTwo); await settle(async () => (await f.repo.read(f.mapId)).document.entries[0]?.images.length === 2);
        await page.screenshot({ path: path.join(out, `${name}-note-images.png`) });
        for (let index = 0; index < moreFiles.length; index++) {
            await upload(page, moreFiles[index]); await settle(async () => (await f.repo.read(f.mapId)).document.entries[0]?.images.length === index + 3);
        }
        await settle(async () => await page.getByRole('link', { name: 'Download image', exact: true }).count() === 4);
        check(`${name}: gallery decodes at most four attachments`, await page.locator('[data-map-note-images] img').count() === 4
            && await page.evaluate(() => window.__fixtureImageUrls.size) === 4);
        await page.getByRole('button', { name: 'Next images', exact: true }).click();
        await page.getByRole('img', { name: 'Map note image 5', exact: true }).waitFor();
        check(`${name}: pagination releases previous image object URLs`, await page.locator('[data-map-note-images] img').count() === 1
            && await page.evaluate(() => window.__fixtureImageUrls.size) === 1);
        await page.getByRole('button', { name: 'Close map notes', exact: true }).click(); await settle(() => f.textSaves() === 1);
        await page.reload(); await page.getByRole('button', { name: 'Open map controls', exact: true }).waitFor();
        // Reload restores Current map-first entry; return through its visible action before the same notes assertions.
        await page.locator('[data-map-first-exit="true"]').click();
        await notes(page); await settle(async () => await page.getByRole('link', { name: 'Download image', exact: true }).count() === 4);
        check(`${name}: image attachments and text survive reload`, await page.getByRole('dialog').innerText().then(text => text.includes('Fictional text stays')));
        await page.getByRole('button', { name: 'Close map notes', exact: true }).click();
        await menu(page, 'Share'); await page.locator('[data-shared-note-image-review]').waitFor();
        check(`${name}: publish review names selected image count`, (await page.locator('[data-shared-note-image-review]').innerText()).includes('Selected images for this shared link: 1.'));
        await page.getByRole('button', { name: 'Publish share link', exact: true }).click(); await settle(() => Boolean(f.shared()));
        check(`${name}: explicit publication freezes only selected image and excludes private text`, f.shared().assets[0].notes.images.length === 1 && f.shared().assets[0].notes.items.length === 0);
        const privateImage = (await f.repo.read(f.mapId)).document.entries[0].images.find(image => !image.isShared);
        check(`${name}: private image cannot be read through the shared route`, (await f.app.request(`/api/shared-maps/fictional-shared/note-images/${privateImage.assetId}`)).status === 404);
        f.guest(); const publicPage = await context.newPage(); lastPage = publicPage; publicPage.on('pageerror', error => report.errors.push(error.message));
        await publicPage.goto(`${origin}?route=/shared/maps/fictional-shared`); await notes(publicPage);
        await publicPage.getByRole('link', { name: 'Download image', exact: true }).waitFor();
        check(`${name}: shared viewer sees one downloadable image and no upload/share controls`, await publicPage.getByRole('link', { name: 'Download image', exact: true }).count() === 1
            && await publicPage.getByRole('button', { name: 'Add image to notes', exact: true }).count() === 0
            && await publicPage.getByRole('button', { name: 'Take photo', exact: true }).count() === 0
            && await publicPage.locator('input[capture]').count() === 0);
        await publicPage.screenshot({ path: path.join(out, `${name}-shared-image.png`) });
        await publicPage.getByRole('button', { name: 'Back to map notes', exact: true }).click();
        const sharedList = publicPage.getByRole('dialog');
        check(`${name}: shared notes search has only the published resource and no owner recent pins`,
            await sharedList.getByRole('region', { name: 'All resources' }).getByRole('button').count() === 1
            && await sharedList.locator('[data-map-notes-recent-pin]').count() === 0);
        await sharedList.getByRole('searchbox', { name: 'Search resources' }).fill('Unpublished private resource');
        check(`${name}: shared notes search cannot find private resources`,
            await sharedList.getByText('No resources match your search.').count() === 1);
        f.revoke(); check(`${name}: link revocation denies new image reads`, (await f.app.request(`/api/shared-maps/fictional-shared/note-images/${firstImage.assetId}`)).status === 404);
        await context.close();
    }
    check('no page errors or unexpected application mutations', report.errors.length === 0 && report.unexpectedWrites.length === 0);
} catch (error) {
    report.failure = error.stack;
    if (lastPage && !lastPage.isClosed()) {
        await lastPage.screenshot({ path: path.join(out, 'failure.png') });
        await fs.writeFile(path.join(out, 'failure-controls.txt'), await lastPage.locator('body').innerText());
        report.failureMapRects = await lastPage.locator('.leaflet-container').evaluateAll(elements => elements.map(e => {
            const rect = e.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        }));
    }
    throw error;
}
finally { await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); await browser?.close(); await server.close(); }
