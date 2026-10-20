// Actual Care Map page, real downloads and image decoding; all data is fictional.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { unzipSync, strFromU8 } from 'fflate';
import { createMapStudioDocument } from '../../client/src/lib/mapStudioState.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const out = process.argv.find(arg => arg.startsWith('--out='))?.slice(6) || '/tmp/care-map-notes-export-browser';
await fs.mkdir(out, { recursive: true });
const report = { boundary: 'Actual local owner page; synthetic images, intercepted APIs; no production reads/writes or physical-device proof.', cases: [], errors: [], writes: [] };
const server = await createServer({ configFile: path.join(root, 'tests/fixtures/care-map-view-controls/vite.config.mjs'), server: { port: 4217 } });
let browser;
try {
    await server.listen();
    browser = await chromium.launch({ headless: true });
    const setup = await browser.newPage();
    const samples = await setup.evaluate(() => ['image/png', 'image/jpeg', 'image/webp'].map((mimeType, index) => {
        const canvas = document.createElement('canvas');
        canvas.width = index === 1 ? 900 : 150; canvas.height = index === 1 ? 150 : 900;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = ['#be123c', '#0f766e', '#1d4ed8'][index];
        ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = 'white'; ctx.font = 'bold 24px sans-serif';
        ctx.fillText(`Image ${index + 1}`, 12, 40);
        return { mimeType, width: canvas.width, height: canvas.height, base64: canvas.toDataURL(mimeType).split(',')[1] };
    }));
    await setup.close();
    const images = samples.map((item, index) => ({ assetId: String(index + 1).repeat(64), mimeType: item.mimeType,
        size: Buffer.from(item.base64, 'base64').length, width: item.width, height: item.height, isShared: false }));
    const bytes = new Map(images.map((image, index) => [image.assetId, Buffer.from(samples[index].base64, 'base64')]));
    const rows = [
        { resourceType: 'hard', resourceId: 1, name: 'Fictional Community Hub', notes: { items: [{ id: 1, text: 'First resource note\nBring these documents.', createdAt: '2026-10-17T02:00:00Z' }, { id: 2, text: 'Second resource note' }], images: images.slice(0, 2) } },
        { resourceType: 'personal_place', resourceId: 2, name: 'Fictional Personal Place', isPersonalPlace: true, personalPlaceId: 2, notes: { items: [], images: [images[2]] } },
        { resourceType: 'soft', resourceId: 3, name: 'Fictional List-only Service', notes: { items: [{ text: 'Islandwide referral note' }], images: [images[0]] } },
    ].map(row => ({ ...row, assetKey: `${row.resourceType}-${row.resourceId}`, rowKey: `${row.resourceType}-${row.resourceId}`,
        address: `${row.resourceId} Fictional Road Singapore 123456`, bucket: 'Community', subCategory: 'Community', saveEligible: false, status: 'available' }));
    const directory = { id: 91261017, name: 'Fictional Notes Export', assets: rows.filter(row => !row.isPersonalPlace), personalPlaces: [rows[1]],
        places: rows.map((row, index) => ({ placeKey: `fixture-${index}`, name: row.name, address: row.address, rows: [row], hasCoordinates: index < 2,
            ...(index < 2 ? { lat: 1.3 + index * 0.001, lng: 103.85 + index * 0.001 } : {}) })),
        pins: rows.slice(0, 2).map((row, index) => ({ pinKey: `fixture-${index}`, placeKey: `fixture-${index}`, title: row.name,
            lat: 1.3 + index * 0.001, lng: 103.85 + index * 0.001, curatedCount: 1, previewResourceNames: [row.name] })),
        categoryOrder: [], summary: { resourceCount: 3, personalPlaceCount: 1, mappablePlaceCount: 2 }, share: { isShared: false },
        viewer: { isAuthenticated: true, isOwner: true, canSaveResources: true } };
    const studio = createMapStudioDocument(); studio.revision = 1; studio.views[0].revision = 1;
    for (const [device, viewport] of Object.entries({ desktop: { width: 1440, height: 1000 }, phone: { width: 390, height: 844 }, tablet: { width: 768, height: 1024 } })) {
        const context = await browser.newContext({ viewport, hasTouch: device !== 'desktop', isMobile: device !== 'desktop', acceptDownloads: true });
        let rejectImages = false, downloads = 0;
        const reads = [];
        await context.route('**/*', route => {
            const request = route.request(), url = new URL(request.url());
            if (url.hostname === '127.0.0.1' && !url.pathname.startsWith('/api/')) return route.continue();
            if (!url.pathname.startsWith('/api/')) return route.abort();
            if (!['GET', 'HEAD'].includes(request.method())) report.writes.push({ path: url.pathname, method: request.method() });
            if (url.pathname.includes('/api/auth/')) return route.fulfill({ json: { user: { id: 7, name: 'Fictional owner', role: 'standard', locale: 'en' } } });
            if (url.pathname.includes('/annotation-media/')) {
                reads.push(url.pathname);
                const assetId = url.pathname.split('/').at(-1), image = images.find(item => item.assetId === assetId);
                return rejectImages || !image ? route.fulfill({ status: 404, body: 'Not found' })
                    : route.fulfill({ contentType: image.mimeType, body: bytes.get(assetId) });
            }
            if (url.pathname.endsWith('/studio')) return route.fulfill({ json: { mapId: directory.id, document: studio } });
            if (url.pathname.endsWith('/print-annotations')) return route.fulfill({ json: { revision: 0, annotations: [] } });
            if (url.pathname.endsWith(`/my-maps/${directory.id}`)) return route.fulfill({ json: directory });
            return route.fulfill({ json: [] });
        });
        const page = await context.newPage(); page.on('pageerror', error => report.errors.push(`${device}: ${error.message}`));
        page.on('download', () => downloads++);
        await page.goto(`${server.resolvedUrls.local[0]}?route=/my-directory/maps/${directory.id}`);
        if (device !== 'desktop') await page.getByRole('button', { name: 'Open map controls', exact: true }).click();
        const button = page.getByRole('button', { name: 'Download notes & images (ZIP)', exact: true });
        await button.waitFor();
        await page.screenshot({ path: path.join(out, `${device}-action.png`) });
        rejectImages = true;
        await button.click();
        await page.getByRole('alert').filter({ hasText: 'complete download could not be prepared' }).waitFor();
        assert.equal(downloads, 0);
        assert.equal(await button.isEnabled(), true);
        report.cases.push(`${device}: a missing image produces a retryable error and no partial download`);
        rejectImages = false; reads.length = 0;
        const pending = page.waitForEvent('download');
        await button.click();
        const download = await pending;
        assert.equal(download.suggestedFilename(), 'fictional-notes-export-notes-and-images.zip');
        const filename = path.join(out, `${device}.zip`); await download.saveAs(filename);
        const files = unzipSync(new Uint8Array(await fs.readFile(filename)));
        const manifest = JSON.parse(strFromU8(files['notes-and-images.json']));
        assert.equal(manifest.resources.length, 3);
        assert.equal(manifest.resources.flatMap(resource => resource.images).length, 4);
        const pdf = strFromU8(files['fictional-notes-export-ledger.pdf']);
        let previous = -1;
        for (const resource of manifest.resources) {
            for (const attachment of [...resource.notes, ...resource.images]) {
                const position = pdf.indexOf(attachment.reference);
                assert.ok(position > previous, 'photos stay with their own resource notes before the next resource');
                previous = position;
            }
        }
        assert.ok(!pdf.includes('see image pages'));
        for (const resource of manifest.resources) {
            const source = rows.find(row => row.name === resource.name);
            assert.ok(source);
            assert.ok(resource.images.every(image => image.filename.startsWith(`images/${resource.reference}-${source.name.replace(/ /g, '-')}/`)));
            assert.deepEqual(resource.notes.map(note => note.text), source.notes.items.map(note => note.text));
            resource.images.forEach((image, index) => assert.deepEqual(Buffer.from(files[image.filename]), bytes.get(source.notes.images[index].assetId)));
        }
        assert.equal(reads.length, 3, 'shared file is fetched once, with distinct resource references');
        assert.equal(downloads, 1);
        assert.equal(await page.getByRole('alert').count(), 0);
        const extracted = path.join(out, device); await fs.mkdir(extracted, { recursive: true });
        for (const [name, data] of Object.entries(files)) {
            const destination = path.join(extracted, name); await fs.mkdir(path.dirname(destination), { recursive: true }); await fs.writeFile(destination, data);
        }
        report.cases.push(`${device}: complete ZIP contains all notes, image-only personal place, list-only resource, PNG/JPEG/WebP originals and PDF`);
        report.cases.push(`${device}: exact image bytes, note references, unique names and deduplicated authenticated reads`);
        await context.close();
    }
    assert.deepEqual(report.errors, []); assert.deepEqual(report.writes, []);
} catch (error) {
    report.failure = error.stack;
    throw error;
} finally {
    await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    await browser?.close(); await server.close();
}
