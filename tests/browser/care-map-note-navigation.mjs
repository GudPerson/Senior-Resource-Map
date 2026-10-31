// Actual owner page and Leaflet pins, with fictional data and intercepted APIs.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { createMapStudioDocument } from '../../client/src/lib/mapStudioState.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const out = process.argv.find(arg => arg.startsWith('--out='))?.slice(6) || '/private/tmp/care-map-note-navigation-browser';
await fs.mkdir(out, { recursive: true });
const report = { boundary: 'Fictional actual-page Chromium replay; no production requests or physical-device proof.', cases: [], errors: [], writes: [] };
const rows = Array.from({ length: 91 }, (_, n) => ({ rowKey: `personal_place-${n + 1}`, assetKey: `personal_place-${n + 1}`,
    resourceType: 'personal_place', resourceId: n + 1, personalPlaceId: n + 1, isPersonalPlace: true,
    name: `Fictional pin ${n + 1}`, address: `${600 + n} Fictional Avenue Singapore ${String(680600 + n)}`,
    status: 'available', detailPath: null, saveEligible: false, bucket: 'Personal place', subCategory: 'Personal place', notes: { items: [], images: [] } }));
Object.assign(rows[4], { rowKey: 'hard-5', assetKey: 'hard-5', resourceType: 'hard', isPersonalPlace: false, personalPlaceId: null });
const pins = rows.slice(0, 7).map((row, n) => ({ pinKey: `personal-place-${n + 1}`, placeKey: `personal-place-${n + 1}`,
    title: row.name, lat: 1.3 + Math.floor(n / 3) * 0.0015, lng: 103.85 + n % 3 * 0.0015,
    curatedCount: 1, previewResourceNames: [row.name] }));
const places = rows.map((row, n) => ({ ...(pins[n] || { placeKey: `personal-place-${n + 1}`, hasCoordinates: false }),
    name: row.name, address: row.address, rows: [row], hasCoordinates: n < 7 }));
const otherResources = ['hard', 'soft'].map(resourceType => ({ ...rows[0], resourceType, resourceId: 1,
    isPersonalPlace: false, personalPlaceId: null, assetKey: `${resourceType}-1`, rowKey: `${resourceType}-1`,
    name: `Fictional ${resourceType} resource`, bucket: 'Community resource', subCategory: 'Community resource' }));
places[6].rows.push(...otherResources);
const directory = { id: 91261014, name: 'Fictional Notes Navigation', updatedAt: new Date().toISOString(), assets: [...otherResources, rows[4]], personalPlaces: rows.filter(row => row.isPersonalPlace),
    places, pins, categoryOrder: [], summary: { resourceCount: rows.length, personalPlaceCount: rows.length, mappablePlaceCount: pins.length },
    share: { isShared: false }, viewer: { isAuthenticated: true, isOwner: true, canSaveResources: true } };
const studio = createMapStudioDocument(); studio.revision = 1; studio.views[0].revision = 1;
studio.views[0].design.pins.style = 'numbered';
const server = await createServer({ configFile: path.join(root, 'tests/fixtures/care-map-view-controls/vite.config.mjs'), server: { port: 4208 } });
let browser, page;
async function check(name, action) { await action(); report.cases.push(name); }
try {
    await server.listen(); browser = await chromium.launch({ headless: true });
    for (const [device, viewport] of Object.entries({ phone: { width: 390, height: 844 }, tablet: { width: 768, height: 1024 }, desktop: { width: 1280, height: 900 } })) {
        const context = await browser.newContext({ viewport, hasTouch: device !== 'desktop', isMobile: device !== 'desktop' });
        await context.route('**/*', async route => {
            const request = route.request(), url = new URL(request.url());
            if (url.hostname === '127.0.0.1' && !url.pathname.startsWith('/api/')) return route.continue();
            if (!url.pathname.startsWith('/api/')) return route.abort();
            if (!['GET', 'HEAD'].includes(request.method())) report.writes.push({ path: url.pathname, method: request.method() });
            if (url.pathname.includes('/api/auth/')) return route.fulfill({ json: { user: { id: 7, name: 'Fictional owner', role: 'standard', locale: 'en' } } });
            if (url.pathname.includes('/note-images/')) return route.fulfill({ json: { revision: 0, images: [] } });
            if (url.pathname.endsWith('/studio')) return route.fulfill({ json: { mapId: directory.id, document: studio } });
            if (url.pathname.endsWith('/print-annotations')) return route.fulfill({ json: { revision: 0, annotations: [] } });
            if (url.pathname.endsWith(`/my-maps/${directory.id}`) || url.pathname.endsWith(`/my-maps/${directory.id + 1}`))
                return route.fulfill({ json: { ...directory, id: Number(url.pathname.split('/').at(-1)) } });
            return route.fulfill({ json: [] });
        });
        page = await context.newPage(); page.on('pageerror', error => report.errors.push(`${device}: ${error.message}`));
        await page.goto(`${server.resolvedUrls.local[0]}?route=/my-directory/maps/${directory.id}?workspace=current`);
        // Keep legacy notes assertions on Current after its visible map-first return.
        await page.locator('[data-map-first-exit="true"]').click();
        const dialog = page.getByRole('dialog'), search = dialog.getByRole('searchbox', { name: 'Search resources' });
        const open = async () => { await page.getByRole('button', { name: 'Open map notes', exact: true }).click(); await search.waitFor(); };
        await check(`${device}: 93-resource search by postal code and name, empty result and clear`, async () => {
            await open(); await search.fill('680690');
            await dialog.getByRole('button', { name: /^Fictional pin 91/ }).waitFor();
            assert.equal(await dialog.getByRole('region', { name: 'All resources' }).getByRole('button').count(), 1);
            await search.fill('not a matching resource'); await dialog.getByText('No resources match your search.').waitFor();
            await dialog.getByRole('button', { name: 'Clear search', exact: true }).click();
            assert.equal(await dialog.getByRole('region', { name: 'All resources' }).getByRole('button').count(), 93);
            await search.fill('Fictional pin 91'); await dialog.getByRole('button', { name: /^Fictional pin 91/ }).click();
            await dialog.getByRole('button', { name: 'Back to map notes', exact: true }).click();
            assert.equal(await search.inputValue(), 'Fictional pin 91');
            await dialog.getByRole('button', { name: 'Close map notes', exact: true }).click();
        });
        // Selecting the actual numbered Leaflet marker exercises the live preview path.
        await check(`${device}: last five unique selections retain newest-first order`, async () => {
            for (let n = 1; n <= 7; n++) {
                const marker = page.locator(`.leaflet-marker-icon[title="Fictional pin ${n}"]`).first();
                await marker.waitFor(); await marker.dispatchEvent('click');
                await page.waitForTimeout(330);
            }
            await open();
            const keys = await dialog.locator('[data-map-notes-recent-pin]').evaluateAll(nodes => nodes.map(node => node.dataset.mapNotesRecentPin));
            assert.deepEqual(keys, [7, 6, 5, 4, 3].map(n => `personal-place-${n}`));
            assert.equal(await dialog.locator('[data-map-notes-recent-pin="personal-place-7"]').getByRole('button').count(), 3);
            await page.screenshot({ path: path.join(out, `${device}-list.png`) });
            await dialog.getByRole('region', { name: 'Recent pins' }).getByRole('button', { name: /^Fictional pin 5/ }).click();
            assert.match(await dialog.locator('header').innerText(), /Fictional pin 5/);
            await dialog.getByRole('button', { name: 'Close map notes', exact: true }).click();
        });
        await check(`${device}: a multi-resource pin opens each typed resource separately`, async () => {
            await open();
            for (const resourceType of ['hard', 'soft']) {
                await dialog.locator('[data-map-notes-recent-pin="personal-place-7"]').getByRole('button', { name: new RegExp(`^Fictional ${resourceType} resource`) }).click();
                assert.match(await dialog.locator('header').innerText(), new RegExp(`Fictional ${resourceType} resource`));
                await dialog.getByRole('button', { name: 'Back to map notes', exact: true }).click();
            }
            await dialog.getByRole('button', { name: 'Close map notes', exact: true }).click();
        });
        if (device !== 'desktop') await check(`${device}: empty personal-place preview shortcut opens its exact note with a 44px target`, async () => {
            await page.locator('.leaflet-marker-icon[title="Fictional pin 6"]').first().dispatchEvent('click');
            const shortcut = page.locator('[data-mobile-map-focus-tray-card]').getByRole('button', { name: 'View notes for Fictional pin 6', exact: true });
            await shortcut.waitFor(); const bounds = await shortcut.boundingBox(); assert.ok(bounds.height >= 44 && bounds.width >= 44);
            await page.screenshot({ path: path.join(out, `${device}-shortcut.png`) });
            await shortcut.click(); assert.match(await dialog.locator('header').innerText(), /Fictional pin 6/);
            assert.equal(await dialog.locator('textarea').count(), 1);
            await dialog.getByRole('button', { name: 'Close map notes', exact: true }).click();
        });
        if (device !== 'desktop') await check(`${device}: saved-resource preview shortcut also opens an empty note`, async () => {
            await page.locator('.leaflet-marker-icon[title="Fictional pin 5"]').first().dispatchEvent('click');
            await page.locator('[data-mobile-map-focus-tray-card]').getByRole('button', { name: 'View notes for Fictional pin 5', exact: true }).click();
            assert.match(await dialog.locator('header').innerText(), /Fictional pin 5/);
            assert.equal(await dialog.getByRole('checkbox', { name: 'Share this note', exact: true }).count(), 1);
            await dialog.getByRole('button', { name: 'Close map notes', exact: true }).click();
            await page.locator('.leaflet-marker-icon[title="Fictional pin 6"]').first().dispatchEvent('click');
        });
        if (device !== 'desktop') await check(`${device}: fullscreen preview notes remains accessible above the map`, async () => {
            await page.locator('[data-mobile-map-actions]').getByRole('button', { name: 'Full map', exact: true }).click();
            const full = page.locator('[data-map-first="care-map"]');
            await full.locator('.leaflet-marker-icon[title="Fictional pin 6"]').first().dispatchEvent('click');
            await full.locator('[data-mobile-map-focus-tray-card]').getByRole('button', { name: 'View notes for Fictional pin 6', exact: true }).click();
            assert.match(await dialog.locator('header').innerText(), /Fictional pin 6/);
            await dialog.getByRole('button', { name: 'Close map notes', exact: true }).click();
        });
        await check(`${device}: visit history resets on reload and search starts blank`, async () => {
            await page.reload(); await page.locator('[data-map-first-exit="true"]').click(); await open(); assert.equal(await search.inputValue(), '');
            assert.equal(await dialog.locator('[data-map-notes-recent-pin]').count(), 0);
        });
        await context.close();
    }
    assert.deepEqual(report.errors, []); assert.deepEqual(report.writes, []);
    console.log(JSON.stringify(report, null, 2));
} catch (error) {
    report.failure = error.message; if (page && !page.isClosed()) await page.screenshot({ path: path.join(out, 'failure.png') }); throw error;
} finally {
    await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); await browser?.close(); await server.close();
}
