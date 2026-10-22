// Actual page and upload/gallery handlers; fictional accounts, memory R2 only.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { Hono } from 'hono';
import { unzipSync, strFromU8 } from 'fflate';
import { createMapStudioDocument } from '../../client/src/lib/mapStudioState.js';
import { createMapAnnotationMediaHandlers } from '../../server/src/controllers/mapAnnotationMediaController.js';
import { createMapNoteImageHandlers } from '../../server/src/controllers/mapNoteImagesController.js';
import { attachMapNoteImages, createMapNoteImageRepository } from '../../server/src/utils/mapNoteImages.js';
import { createPrivateMapMediaRepository } from '../../server/src/utils/privateMapMedia.js';
import { MapMediaBucket, whereValues } from '../../server/test/helpers/mapAnnotationFixtures.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const out = process.argv.find(arg => arg.startsWith('--out='))?.slice(6) || '/tmp/care-map-image-allowance';
await fs.mkdir(out, { recursive: true });
const report = { boundary: 'Actual Chromium pages/handlers, fictional API/DB, memory R2. No production data, requests or physical-device proof.', cases: [], errors: [], unexpectedWrites: [] };
const server = await createServer({ configFile: path.join(root, 'tests/fixtures/care-map-view-controls/vite.config.mjs'), server: { port: 4220 } });
let browser, page;
const check = (name, value) => { assert.ok(value, name); report.cases.push(name); console.log(`PASS: ${name}`); };
try {
    await server.listen(); browser = await chromium.launch({ headless: true });
    const setup = await browser.newPage();
    const samples = await setup.evaluate(() => Array.from({ length: 61 }, (_, index) => {
        const canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 16;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = `rgb(${index * 4},80,160)`; ctx.fillRect(0, 0, 16, 16);
        return canvas.toDataURL('image/png').split(',')[1];
    }));
    const cameraPhoto = await setup.evaluate(() => {
        const canvas = document.createElement('canvas'); canvas.width = 4000; canvas.height = 3000;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = '#f0fdfa'; ctx.fillRect(0, 0, 4000, 3000);
        ctx.fillStyle = '#134e4a'; ctx.font = 'bold 160px sans-serif'; ctx.fillText('Fictional camera photo', 200, 400);
        ctx.font = '80px sans-serif'; ctx.fillText('Visits by appointment', 200, 650);
        return canvas.toDataURL('image/jpeg', 0.96).split(',')[1];
    });
    await setup.close();
    for (const [device, viewport] of Object.entries({ desktop: { width: 1440, height: 1000 }, phone: { width: 390, height: 844 }, tablet: { width: 768, height: 1024 } })) {
        const context = await browser.newContext({ viewport, hasTouch: device !== 'desktop', isMobile: device !== 'desktop', acceptDownloads: true });
        const bucket = new MapMediaBucket(), media = createPrivateMapMediaRepository(bucket, 7), repo = createMapNoteImageRepository(bucket, 7);
        let mediaUploads = 0, holdNextUpload = false, releaseHeldUpload;
        const mapId = 91261020, secondMapId = mapId + 1, images = [];
        for (const sample of samples.slice(0, 60)) images.push({ ...await media.saveAsset(Buffer.from(sample, 'base64'), 'image/png'), isShared: false });
        await repo.replace(mapId, 'asset:31', { revision: 0, images: images.slice(0, 20) });
        const rows = ['Alpha', 'Beta', 'Gamma'].map((name, index) => ({ rowKey: `hard-${index + 1}`, assetKey: `hard-${index + 1}`,
            resourceType: 'hard', resourceId: index + 1, name: `Fictional ${name}`, address: 'Fictional Road', bucket: 'Community',
            subCategory: 'Community', notes: { items: [] }, saveEligible: true, status: 'available' }));
        const mapAssets = id => rows.map((row, i) => ({ id: (id === mapId ? 31 : 41) + i, resourceType: 'hard', resourceId: row.resourceId }));
        const directory = id => ({ id, name: 'Fictional image allowance', assets: rows, places: rows.map((row, i) => ({
            placeKey: `fixture-${i}`, name: row.name, address: row.address, rows: [row], hasCoordinates: true, lat: 1.3 + i * .001, lng: 103.85 })),
            pins: [], categoryOrder: [], summary: { resourceCount: 3, mappablePlaceCount: 3 }, share: { isShared: false },
            viewer: { isAuthenticated: true, isOwner: true, canSaveResources: true } });
        const studio = createMapStudioDocument(); studio.revision = 1; studio.views[0].revision = 1;
        const db = { query: {
            myMaps: { findFirst: async ({ where }) => { const [id, owner] = whereValues(where); return [mapId, secondMapId].includes(id) && owner === 7 ? { id } : null; } },
            myMapAssets: { findFirst: async ({ where }) => { const [id, type, resourceId] = whereValues(where);
                return [mapId, secondMapId].includes(id) && type === 'hard' ? mapAssets(id).find(item => item.resourceId === resourceId) : null; } },
        } };
        const app = new Hono(); app.use('*', async (c, next) => { c.set('user', { id: 7, role: 'standard' }); await next(); });
        const upload = createMapAnnotationMediaHandlers({ dbForContext: () => db, bucketForContext: () => bucket });
        const notes = createMapNoteImageHandlers({ dbForContext: () => db, bucketForContext: () => bucket });
        app.post('/api/my-maps/:id/annotation-media', upload.upload); app.get('/api/my-maps/:id/annotation-media/:assetId', upload.read);
        app.get('/api/my-maps/:id/note-images/:resourceType/:resourceId', notes.read); app.put('/api/my-maps/:id/note-images/:resourceType/:resourceId', notes.replace);
        await context.route('**/*', async route => {
            const request = route.request(), url = new URL(request.url()), method = request.method();
            if (url.hostname === '127.0.0.1' && !url.pathname.startsWith('/api/')) return route.continue();
            if (!url.pathname.startsWith('/api/')) return route.abort();
            if (url.pathname.includes('/api/auth/')) return route.fulfill({ json: { user: { id: 7, name: 'Fictional owner', role: 'standard', locale: 'en' } } });
            if (url.pathname.includes('/note-images/') || url.pathname.includes('/annotation-media')) {
                if (method === 'POST' && url.pathname.endsWith('/annotation-media')) {
                    mediaUploads++;
                    if (holdNextUpload) {
                        holdNextUpload = false;
                        await new Promise(resolve => { releaseHeldUpload = resolve; });
                    }
                }
                const response = await app.request(`http://fixture.invalid${url.pathname}`, { method, headers: request.headers(),
                    ...(!['GET', 'HEAD'].includes(method) ? { body: request.postDataBuffer() } : {}) });
                return route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
            }
            if (!['GET', 'HEAD'].includes(method)) report.unexpectedWrites.push({ path: url.pathname, method });
            if (url.pathname.endsWith('/studio')) return route.fulfill({ json: { document: studio } });
            if (url.pathname.endsWith('/print-annotations')) return route.fulfill({ json: { revision: 0, annotations: [] } });
            const id = Number(url.pathname.split('/').at(-1));
            if ([mapId, secondMapId].includes(id)) return route.fulfill({ json: attachMapNoteImages(directory(id), { assets: mapAssets(id) }, (await repo.read(id)).document) });
            return route.fulfill({ json: [] });
        });
        page = await context.newPage(); page.on('pageerror', error => report.errors.push(`${device}: ${error.message}`));
        const visit = async id => { await page.goto(`${server.resolvedUrls.local[0]}?route=/my-directory/maps/${id}`); await page.getByRole('button', { name: 'Open map notes', exact: true }).click(); };
        const select = async name => { await page.getByRole('dialog').getByRole('button', { name: new RegExp(`^Fictional ${name}`) }).click(); };
        const gallery = page.locator('[data-map-note-images]'), add = gallery.getByRole('button', { name: 'Add image to notes', exact: true }).last();
        const takePhoto = gallery.getByRole('button', { name: 'Take photo', exact: true });
        await visit(mapId); await select('Alpha');
        await gallery.getByText('20 / 20 images for this resource', { exact: false }).waitFor();
        check(`${device}: 20-image resource is full with explicit per-resource count and 1 GB storage usage`, await add.isDisabled() && /MB used of 1 GB/.test(await gallery.innerText()));
        check(`${device}: camera also respects the full resource gallery`, await takePhoto.isDisabled());
        await page.getByRole('button', { name: 'Back to map notes', exact: true }).click(); await select('Beta');
        await gallery.getByText('0 / 20 images for this resource', { exact: false }).waitFor();
        check(`${device}: another resource has its own allowance after more than 20 account uploads`, await add.isEnabled());
        await gallery.locator('input[type=file]:not([capture])').setInputFiles({ name: 'fictional.png', mimeType: 'image/png', buffer: Buffer.from(samples[60], 'base64') });
        await gallery.getByText('1 / 20 images for this resource', { exact: false }).waitFor();
        check(`${device}: actual normalized upload saves to the selected resource beyond the old account cap`, (await repo.read(mapId)).document.entries.find(entry => entry.membershipKey === 'asset:32').images.length === 1);
        const beforeCancel = mediaUploads;
        let chooserPending = page.waitForEvent('filechooser'); await takePhoto.click();
        let chooser = await chooserPending;
        assert.equal(await chooser.element().getAttribute('capture'), 'environment');
        assert.equal(await chooser.element().getAttribute('accept'), 'image/*');
        assert.equal(await gallery.locator('input[type=file]:not([capture])').getAttribute('capture'), null);
        await chooser.setFiles([]);
        check(`${device}: canceling the camera leaves the gallery ready without an upload`, mediaUploads === beforeCancel && await takePhoto.isEnabled());
        holdNextUpload = true;
        chooserPending = page.waitForEvent('filechooser'); await takePhoto.click(); chooser = await chooserPending;
        const uploadArrived = page.waitForRequest(request => request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/annotation-media'));
        await chooser.setFiles({ name: 'camera-photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(cameraPhoto, 'base64') });
        await uploadArrived;
        // The held response makes the busy-state check deterministic.
        await page.waitForFunction(() => document.querySelector('[data-map-note-images] input[capture]')?.disabled === true);
        check(`${device}: both attachment controls are disabled while a camera photo uploads`, await takePhoto.isDisabled()
            && await gallery.locator('input[type=file]:not([capture])').isDisabled());
        releaseHeldUpload();
        await gallery.getByText('2 / 20 images for this resource', { exact: false }).waitFor();
        const cameraImages = (await repo.read(mapId)).document.entries.find(entry => entry.membershipKey === 'asset:32').images;
        const captured = cameraImages.find(item => item.mimeType === 'image/jpeg');
        check(`${device}: camera JPEG is resized, compressed and saved privately to the selected resource`, captured?.width === 1600
            && captured?.height === 1200 && captured?.size <= 500 * 1024 && captured?.isShared === false && cameraImages.length === 2);
        await page.screenshot({ path: path.join(out, `${device}-gallery.png`) });
        await visit(secondMapId); await select('Alpha');
        await gallery.getByText('0 / 20 images for this resource', { exact: false }).waitFor();
        check(`${device}: the same resource in another map has an independent gallery`, await add.isEnabled());
        const revision = (await repo.read(mapId)).document.revision;
        await repo.replace(mapId, 'asset:32', { revision, images: images.slice(20, 40) });
        await repo.replace(mapId, 'asset:33', { revision: revision + 1, images: images.slice(40, 60) });
        await visit(mapId); await select('Alpha');
        await gallery.getByText('20 / 20 images for this resource', { exact: false }).waitFor();
        await gallery.getByRole('button', { name: 'Remove image', exact: true }).first().click();
        await gallery.getByText('19 / 20 images for this resource', { exact: false }).waitFor();
        check(`${device}: removing an image frees a resource slot`, await add.isEnabled());
        await repo.replace(mapId, 'asset:31', { revision: (await repo.read(mapId)).document.revision, images: images.slice(0, 20) });
        await page.reload();
        if (device !== 'desktop') await page.getByRole('button', { name: 'Open map controls', exact: true }).click();
        const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download notes & images (ZIP)', exact: true }).click();
        const download = await pending, filename = path.join(out, `${device}-60-images.zip`); await download.saveAs(filename);
        const files = unzipSync(new Uint8Array(await fs.readFile(filename))), manifest = JSON.parse(strFromU8(files['notes-and-images.json']));
        assert.equal(manifest.resources.length, 3); assert.ok(manifest.resources.every(resource => resource.images.length === 20));
        for (const resource of manifest.resources) for (const image of resource.images) {
            const id = createHash('sha256').update(files[image.filename]).digest('hex');
            assert.ok(images.some(item => item.assetId === id));
        }
        check(`${device}: a 60-image map exports all three resource folders with exact stored bytes`, manifest.resources.flatMap(resource => resource.images).length === 60);
        await context.close();
    }
    assert.deepEqual(report.errors, []); assert.deepEqual(report.unexpectedWrites, []);
} catch (error) {
    report.failure = error.stack; if (page && !page.isClosed()) await page.screenshot({ path: path.join(out, 'failure.png') }); throw error;
} finally {
    await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); await browser?.close(); await server.close();
}
