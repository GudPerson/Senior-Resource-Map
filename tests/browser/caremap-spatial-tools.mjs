// Actual App/router QA with fictional resources and a real local snapshot service over synthetic rows.
// Interactive preview defaults to the separately started real-CSV sidecar; it never uses production auth.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createServer } from 'vite';
import { buildAddressSnapshotIndex, createAddressSnapshotServer } from '../../scripts/address-snapshot-service.mjs';
import { createSpatialAreaFromAnnotation } from '../../client/src/lib/mapSpatialGeometry.js';
import { mapId, center, annotations } from '../fixtures/caremap-spatial-tools/fictional-api.mjs';
const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const repo = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(import.meta.url);
const playwrightPath = process.env.PLAYWRIGHT_MODULE || require.resolve('playwright');
const playwright = await import(pathToFileURL(playwrightPath));
const { chromium } = playwright.default || playwright;
const realSnapshot = arg('snapshot') === 'real';
const productionProvider = arg('provider') === 'production';
const snapshotPrefix = productionProvider ? '/api/address-snapshot' : '/__carearound-addresses';
if (realSnapshot && productionProvider) throw new Error('Actual CSV replay uses the explicitly local provider; production replay uses only fictional in-memory R2.');
process.env.SPATIAL_SNAPSHOT_PROVIDER = productionProvider ? 'production' : 'local';
const out = path.resolve(arg('out') || await fs.mkdtemp(path.join(os.tmpdir(), 'caremap-spatial-qa-')));
await fs.mkdir(out, { recursive: true });
const report = { provider: productionProvider ? 'authenticated API with real Hono routes/repository and fictional in-memory R2' : 'explicit local sidecar', boundary: 'Actual App/router/providers and real snapshot HTTP/index over fictional rows; fictional authenticated owner/catalogue, synthetic map pixels. No production, physical-device, complete-address-coverage, freshness or live postal-verification proof.', cases: [], errors: [], consoleErrors: [], unexpectedRemoteRequests: [], screenshots: [], downloads: [] };
async function inventory(directory) {
    const paths = [];
    for (const item of await fs.readdir(directory, { withFileTypes: true })) {
        const full = path.join(directory, item.name);
        if (item.isDirectory()) paths.push(...await inventory(full));
        else if (/\.(jsx?|tsx?|css|json|mjs|html)$/.test(item.name)) paths.push(full);
    }
    return paths;
}
async function sourceSnapshot() {
    const files = [...await inventory(path.join(repo, 'client/src')), ...await inventory(path.join(repo, 'tests/fixtures/caremap-spatial-tools')), ...['scripts/address-snapshot-service.mjs', ...(productionProvider ? ['scripts/build-address-snapshot.mjs', 'shared/addressSnapshotSpatial.js', 'server/src/routes/addressSnapshot.js', 'server/src/controllers/addressSnapshotController.js', 'server/src/utils/addressSnapshotConfig.js', 'server/src/utils/addressSnapshotRepository.js', 'server/src/middleware/auth.js', 'server/src/utils/sessionAuth.js'] : [])].map(file => path.join(repo, file)), fileURLToPath(import.meta.url)].sort();
    return { head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(), files: Object.fromEntries(await Promise.all(files.map(async file => [path.relative(repo, file), createHash('sha256').update(await fs.readFile(file)).digest('hex')])))};
}
report.sourceBefore = await sourceSnapshot();
const rows = Array.from({ length: 225 }, (_, index) => ({ id: `fictional-address-${index}`, postalCode: index < 2 ? '012345' : String(100000 + index), block: String(index + 1), roadName: 'Fictional Preview Road', building: index === 0 ? '=1+1' : `Fictional block ${index + 1}`, address: index === 0 ? '=HYPERLINK("https://invalid.example")' : `${index + 1} Fictional Preview Road`, lat: center[0] + (index % 15) * 0.000005, lng: center[1] + Math.floor(index / 15) * 0.000005 }));
const snapshot = { label: 'Fictional QA address snapshot', preparedAt: '2026-11-03T00:00:00.000Z', source: 'Fictional test records only', coverage: 'Synthetic coverage only; never current Singapore address proof.', sha256: '0'.repeat(64), recordCount: rows.length, postalCodeCount: rows.length - 1 };
const snapshotServer = realSnapshot || productionProvider ? null : createAddressSnapshotServer(buildAddressSnapshotIndex(rows, snapshot));
if (snapshotServer) await new Promise(resolve => snapshotServer.listen(0, '127.0.0.1', resolve));
process.env.SPATIAL_SNAPSHOT_TARGET = realSnapshot ? (arg('snapshot-url') || 'http://127.0.0.1:8796') : snapshotServer ? `http://127.0.0.1:${snapshotServer.address().port}` : '';
report.dataset = productionProvider ? '225 fictional address rows compiled into verified in-memory R2 artifacts; real API session/router/repository' : realSnapshot ? 'Actual audited prepared CSV via existing read-only sidecar; fictional owner/catalogue' : '225 fictional address rows via actual local snapshot index and HTTP service';
const vite = await createServer({ configFile: path.join(repo, 'tests/fixtures/caremap-spatial-tools/vite.config.mjs'), cacheDir: path.join(out, 'vite-cache'), server: { host: '127.0.0.1', port: Number(arg('port') || 4497), strictPort: true } });
await vite.listen();
const base = vite.resolvedUrls.local[0];
let browser;
async function audit(page) { return page.evaluate(() => fetch('/__preview/audit').then(response => response.json())); }
async function capture(page, name) { const file = path.join(out, `${name}.png`); await page.screenshot({ path: file, fullPage: false, animations: 'disabled' }); report.screenshots.push(file); }
async function check(name, run) {
    if (arg('case') && !name.includes(arg('case'))) return;
    if (realSnapshot !== name.startsWith('real-csv-')) return;
    try { const details = await run(); report.cases.push({ name, passed: true, ...details }); console.log(`PASS ${name}`); }
    catch (error) { report.cases.push({ name, passed: false, error: error.stack }); console.error(`FAIL ${name}: ${error.message}`); }
}
async function createPage(phone = false, route = `/my-directory/maps/${mapId}`) {
    const context = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1728, height: 1000 }, hasTouch: phone, deviceScaleFactor: 1, reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
    await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin === new URL(base).origin || url.protocol === 'data:') return route.continue();
        if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ body: '', contentType: 'text/css' });
        if (url.hostname === 'accounts.google.com') return route.fulfill({ body: '', contentType: 'text/javascript' });
        report.unexpectedRemoteRequests.push({ method: route.request().method(), host: url.hostname, path: url.pathname });
        return route.abort();
    });
    if (productionProvider) { const session = await context.request.get(new URL('/__preview/address-session', base).href); assert.equal(session.status(), 200); }
    await page.goto(new URL(route, base).href);
    await Promise.race([
        page.getByText('Fictional Care Map spatial preview', { exact: true }).first().waitFor({ state: 'attached' }),
        page.getByText('Something stopped this page from opening', { exact: true }).waitFor().then(async () => { await capture(page, `render-failure-${report.screenshots.length}`); throw Error('Actual App route error boundary rendered; inspect consoleErrors and screenshot'); }),
    ]);
    if (!route.includes('view=print')) await page.locator('[data-map-studio-owner-panel]').first().waitFor({ state: 'attached' });
    else await page.getByRole('button', { name: 'Save PNG', exact: true }).waitFor();
    await page.locator('.leaflet-container').filter({ visible: true }).first().waitFor();
    await page.waitForTimeout(700);
    return { page, context };
}
async function clickMap(page, lat = center[0] + 0.0006, lng = center[1] + 0.0006, action = 'click') {
    const p = await page.evaluate(([lat, lng]) => {
        const maps = [...window.__spatialPreviewMaps].filter(map => map.getContainer().isConnected && map.getContainer().getBoundingClientRect().width > 0);
        const map = maps.at(-1); if (!map) throw Error('No active preview map');
        const position = map.latLngToContainerPoint([lat, lng]), rect = map.getContainer().getBoundingClientRect();
        return { x: rect.x + position.x, y: rect.y + position.y };
    }, [lat, lng]);
    await page.mouse[action === 'move' ? 'move' : 'click'](p.x, p.y);
}
async function openAnnotation(page, phone = false) {
    if (phone) {
        await page.getByRole('button', { name: 'Open map controls', exact: true }).click();
        const dialog = page.getByRole('dialog').filter({ visible: true }).first();
        await dialog.getByRole('button', { name: 'Edit content', exact: true }).click();
        await dialog.getByRole('menuitemcheckbox', { name: 'Annotate', exact: true }).click();
    } else {
        await page.getByRole('button', { name: 'Edit content', exact: true }).click();
        await page.getByRole('menuitemcheckbox', { name: 'Annotate', exact: true }).click();
    }
    await page.waitForTimeout(650);
}
async function startPointPicker(page, phone = false) {
    if (phone) await page.getByRole('button', { name: 'Open map controls', exact: true }).click();
    await page.getByRole('button', { name: 'Personal place', exact: true }).filter({ visible: true }).first().click();
    const chooser = page.getByRole('dialog', { name: 'Add personal place to map', exact: true }); await chooser.waitFor();
    await chooser.getByRole('button', { name: 'Choose map location', exact: true }).first().click();
    await page.waitForTimeout(800);
}
async function selectCircle(page) { await clickMap(page, center[0] + 0.0044966, center[1]); }
async function selectVisiblePhoneCircle(page) {
    const annotation = annotations.find(value => value.id === 'preview-circle');
    assert.equal(annotation?.type, 'circle', 'Phone selection targets the intended fixture circle');
    const target = await page.evaluate(id => {
        const map = [...window.__spatialPreviewMaps].filter(value => value.getContainer().isConnected && value.getContainer().getBoundingClientRect().width > 0).at(-1);
        if (!map) throw Error('No active phone preview map');
        const container = map.getContainer(), rect = container.getBoundingClientRect();
        const shape = container.querySelector(`.leaflet-print-annotation-${id}-pane path.leaflet-interactive`);
        if (!shape) throw Error(`No rendered path for phone annotation ${id}`);
        const transform = shape.getScreenCTM(), length = shape.getTotalLength();
        if (!transform || !length) throw Error(`No measurable phone annotation path ${id}`);
        for (let index = 0; index < 512; index++) {
            const point = shape.getPointAtLength(length * index / 512).matrixTransform(transform);
            const x = Math.round(point.x), y = Math.round(point.y);
            if (x <= rect.left + 4 || x >= rect.right - 4 || y <= rect.top + 4 || y >= rect.bottom - 4 || x < 0 || x >= innerWidth || y < 0 || y >= innerHeight) continue;
            if (document.elementFromPoint(x, y) !== shape) continue;
            return { x, y, annotationId: id, receiverVerified: true, mapId: map._leaflet_id, zoom: map.getZoom(), center: map.getCenter(), rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom } };
        }
        throw Error(`No exposed native stroke target inside the visible phone map for ${id}`);
    }, annotation.id);
    assert.equal(target.zoom, 16, 'Phone selection preserves the saved fixed zoom 16');
    await page.mouse.click(target.x, target.y);
    await page.waitForFunction(text => document.querySelector('[data-print-annotation-toolbar] textarea[placeholder="Optional note"]')?.value === text, annotation.text);
    const after = await page.evaluate(() => {
        const map = [...window.__spatialPreviewMaps].filter(value => value.getContainer().isConnected && value.getContainer().getBoundingClientRect().width > 0).at(-1);
        return { mapId: map._leaflet_id, zoom: map.getZoom(), center: map.getCenter() };
    });
    assert.deepEqual(after, { mapId: target.mapId, zoom: target.zoom, center: target.center }, 'Native circle selection keeps the same map and fixed camera');
    assert.equal(await page.locator('[data-print-annotation-toolbar] textarea[placeholder="Optional note"]').inputValue(), annotation.text, 'The intended circle text is selected');
    return { ...target, annotationType: annotation.type, selectedText: annotation.text, after };
}
async function areaDialog(page) {
    // Draw and Manage now share one workspace; explicitly enter its address tab.
    const panel = page.getByRole('dialog').filter({ has: page.locator('[data-map-area-results]') });
    await panel.waitFor();
    await panel.getByRole('tab', { name: /Addresses.*postal codes/ }).click();
    return panel;
}
try {
    browser = await chromium.launch({ headless: true });
    report.browserVersion = browser.version();
    for (const phone of [false, true]) await check(`${phone ? 'phone' : 'desktop'}-original-owner-entry`, async () => {
        const { page, context } = await createPage(phone);
        try {
            assert.equal(await page.locator('[data-map-first],[data-owner-workspace="split"]').count(), 0, 'Original owner layout remains default');
            assert.equal(await page.locator('[data-map-studio-owner-panel]').count(), 1, 'Single existing Studio controller');
            assert.ok(await page.getByRole('note').filter({ hasText: 'Local preview' }).isVisible(), 'Preview provenance is visible');
            if (!phone) { await page.getByRole('button', { name: 'Manage resources', exact: true }).waitFor(); await page.getByRole('button', { name: 'Edit layout', exact: true }).waitFor(); }
            assert.equal((await audit(page)).unexpectedWrites.length, 0, 'Entry creates no writes');
            await capture(page, `${phone ? 'phone' : 'desktop'}-original-entry`);
            return { width: phone ? 390 : 1728 };
        } finally { await context.close(); }
    });
    await check('circle-label-selected-area-catalogue-and-addresses', async () => {
        const { page, context } = await createPage();
        try {
            const before = await audit(page);
            await openAnnotation(page);
            await selectCircle(page);
            const find = page.getByRole('button', { name: 'Find within area', exact: true }); await find.waitFor();
            const label = page.locator('[data-map-radius-label]').filter({ visible: true }).first(); await label.waitFor();
            const radiusText = (await label.innerText()).trim(); assert.match(radiusText, /radius/i);
            await find.click();
            const panel = await areaDialog(page);
            await panel.getByText(productionProvider ? 'Singapore address snapshot' : 'Fictional QA address snapshot', { exact: false }).first().waitFor();
            await capture(page, 'desktop-area-addresses');
            assert.equal(await panel.locator('li input[type=checkbox]').count(), 200, 'Bounded first address page');
            await panel.getByRole('button', { name: 'Load more addresses', exact: true }).click();
            await panel.locator('li input[type=checkbox]').nth(224).waitFor({ state: 'attached' });
            assert.equal(await panel.locator('li input[type=checkbox]').count(), 225, 'All distinct address rows remain, including shared postal');
            await panel.locator('li input[type=checkbox]').nth(0).check(); await panel.locator('li input[type=checkbox]').nth(1).check();
            await panel.getByRole('button', { name: 'Copy selected postal codes', exact: true }).click();
            const clipboard = await page.evaluate(() => navigator.clipboard.readText()); assert.equal(clipboard.trim(), '012345', 'Postal copy preserves leading zero and deduplicates postal strings');
            const downloaded = page.waitForEvent('download'); await panel.getByRole('button', { name: 'Download selected CSV', exact: true }).click();
            const download = await downloaded, file = path.join(out, 'selected-addresses.csv'); await download.saveAs(file); report.downloads.push(file);
            const csv = await fs.readFile(file, 'utf8'); assert.match(csv, /012345/); assert.match(csv, /'=1\+1/); assert.match(csv, /'\=HYPERLINK/); assert.equal(csv.trim().split(/\r?\n/).length, 3, 'Two address rows with same postal retained');
            const allDownloaded = page.waitForEvent('download'); await panel.getByRole('button', { name: 'Download all CSV', exact: true }).click();
            const allDownload = await allDownloaded, allFile = path.join(out, 'all-addresses.csv'); await allDownload.saveAs(allFile); report.downloads.push(allFile);
            assert.equal((await fs.readFile(allFile, 'utf8')).trim().split(/\r?\n/).length, 226, 'All-results CSV fetches every address page');
            await panel.getByRole('tab', { name: /^CareAround resources(?: \(.*\))?$/ }).click();
            await panel.getByRole('link', { name: 'Fictional catalogue centre outside saved map', exact: true }).waitFor();
            await panel.getByRole('link', { name: 'Fictional multi-venue programme', exact: true }).waitFor();
            assert.equal(await panel.getByText('Fictional distant centre', { exact: true }).count(), 0, 'Outside area excluded');
            assert.match(await panel.locator('[data-map-area-unlocated]').innerText(), /\b2\b/, 'Unlocated centre and online programme are explicitly unassessed');
            assert.equal(await panel.getByText('Fictional private restricted resource', { exact: true }).count(), 0, 'Unavailable resources absent');
            await capture(page, 'desktop-area-catalogue');
            await panel.getByRole('button', { name: /close/i }).first().click();
            await page.waitForTimeout(1200); const after = await audit(page);
            assert.deepEqual(after.annotations, before.annotations, 'Queries never mutate selected or saved annotations');
            assert.equal(after.revision, before.revision); assert.equal(after.unexpectedWrites.length, before.unexpectedWrites.length);
            assert.ok(after.requests.some(r => r.path === '/api/hard-assets' && /page=2/.test(r.search)), 'Full visible catalogue pages were requested');
            assert.ok(after.requests.filter(r => /\/(hard|soft)-assets$/.test(r.path)).every(r => !/scope=managed/.test(r.search)), 'Uses existing visible API only');
            return { radiusText, addressRows: 225, selectedCsvRows: 2 };
        } finally { await context.close(); }
    });
    await check('area-too-large-shrink-and-changed-snapshot-retry', async () => {
        const { page, context } = await createPage(); let failure = 'oversized';
        try {
            await page.route(`**${snapshotPrefix}/area`, async route => failure === 'oversized'
                ? route.fulfill({ status: 422, json: { error: 'Choose a smaller area.', code: 'ADDRESS_SNAPSHOT_AREA_TOO_LARGE', addressLimit: { reason: 'geometryWork', observed: 250100, allowed: 250000 } } })
                : failure === 'changed' ? route.fulfill({ status: 409, json: { error: 'Changed snapshot.', code: 'ADDRESS_SNAPSHOT_CHANGED' } }) : route.continue());
            await openAnnotation(page); await selectCircle(page); await page.getByRole('button', { name: 'Find within area', exact: true }).click();
            let panel = await areaDialog(page);
            await panel.locator('[data-map-area-address-error="ADDRESS_SNAPSHOT_AREA_TOO_LARGE"]').waitFor();
            await panel.locator('[data-map-area-address-limit="geometryWork"]').waitFor();
            await panel.getByRole('button', { name: 'Choose a smaller or simpler area', exact: true }).click();
            await panel.waitFor({ state: 'detached' });
            failure = 'changed'; await page.locator('[data-map-area-choice]').selectOption('preview-circle');
            panel = await areaDialog(page);
            const changedAlert = panel.locator('[data-map-area-address-error="ADDRESS_SNAPSHOT_CHANGED"]');
            await changedAlert.waitFor();
            assert.match(await changedAlert.innerText(), /snapshot changed.*Restart this search/s);
            failure = null; await panel.getByRole('button', { name: 'Retry', exact: true }).click();
            await panel.locator('li input[type=checkbox]').nth(199).waitFor();
            assert.equal((await audit(page)).unexpectedWrites.length, 0);
        } finally { await context.close(); }
    });
    await check('catalogue-timeout-aborts-siblings-retry-and-map-change', async () => {
        const { page, context } = await createPage();
        try {
            await page.evaluate(() => {
                const originalFetch = window.fetch.bind(window);
                window.__stallSpatialCatalogue = true; window.__spatialCatalogueCalls = [];
                window.fetch = (input, options) => {
                    const url = new URL(input instanceof Request ? input.url : input, location.href);
                    if (window.__stallSpatialCatalogue && ['/api/hard-assets', '/api/soft-assets'].includes(url.pathname) && url.searchParams.get('scope') === 'visible') {
                        const record = { aborted: false }; window.__spatialCatalogueCalls.push(record);
                        return new Promise((resolve, reject) => {
                            record.lateResolve = () => resolve(new Response(JSON.stringify({ data: [], pagination: { totalPages: 1 } }), { headers: { 'content-type': 'application/json' } }));
                            options.signal.addEventListener('abort', () => { record.aborted = true; reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
                        });
                    }
                    return originalFetch(input, options);
                };
            });
            await openAnnotation(page); await selectCircle(page); await page.getByRole('button', { name: 'Find within area', exact: true }).click();
            let panel = await areaDialog(page);
            await panel.getByRole('tab', { name: /CareAround resources/ }).click();
            await panel.getByText('CareAround resource results are unavailable. Retry to check the full accessible catalogue.', { exact: true }).waitFor({ timeout: 22000 });
            assert.deepEqual(await page.evaluate(() => window.__spatialCatalogueCalls.map(value => value.aborted)), [true, true], 'Real page deadline cancels both pending catalogue transports');
            await page.evaluate(() => { window.__stallSpatialCatalogue = false; });
            await panel.getByRole('button', { name: 'Retry', exact: true }).click();
            await panel.locator('a[href^="/resource/"]').first().waitFor();
            await panel.getByRole('button', { name: 'Close', exact: true }).click();
            await page.evaluate(() => { window.__stallSpatialCatalogue = true; });
            await openAnnotation(page); await selectCircle(page);
            await page.getByRole('button', { name: 'Find within area', exact: true }).click();
            await page.waitForFunction(() => window.__spatialCatalogueCalls.length === 4);
            await page.evaluate(route => { history.pushState({}, '', route); dispatchEvent(new PopStateEvent('popstate')); }, `/my-directory/maps/${mapId + 1}`);
            await page.waitForFunction(() => window.__spatialCatalogueCalls.every(value => value.aborted));
            await page.evaluate(() => { for (const call of window.__spatialCatalogueCalls) call.lateResolve(); });
            await page.waitForTimeout(300);
            assert.equal(await page.locator('[data-map-area-results]').count(), 0, 'Late catalogue callbacks cannot reopen results after map change');
            assert.equal((await audit(page)).unexpectedWrites.length, 0);
            return { timeoutTransportAborts: 2, mapChangeTransportAborts: 2, retryRecovered: true };
        } finally { await context.close(); }
    });
    await check('point-candidate-review-and-cancel', async () => {
        const { page, context } = await createPage();
        try {
            const before = await audit(page);
            let selectedPoint; page.on('request', request => { if (request.url().includes(`${snapshotPrefix}/nearby`)) selectedPoint = request.postDataJSON(); });
            await startPointPicker(page);
            await clickMap(page);
            const picker = page.getByRole('dialog', { name: 'Choose address for this point', exact: true }); await picker.waitFor();
            await picker.getByRole('button', { name: 'Use this address', exact: true }).first().waitFor();
            await capture(page, 'desktop-point-candidates');
            await picker.getByRole('button', { name: 'Use this address', exact: true }).first().click();
            const editor = page.getByRole('dialog', { name: 'Add personal place', exact: true }); await editor.waitFor();
            assert.equal((await audit(page)).unexpectedWrites.length, before.unexpectedWrites.length, 'Candidate selection has not created a private place');
            assert.ok(await editor.getByRole('button', { name: 'Save', exact: true }).isDisabled(), 'Prepared snapshot does not bypass existing live postal verification');
            assert.ok(await editor.locator('[data-address-location-review]').isVisible(), 'Selected point and snapshot review notice visible');
            await capture(page, 'desktop-address-review-verification-required');
            await editor.getByRole('checkbox', { name: /^This point has no postal address/ }).check();
            assert.ok(Math.abs(Number(await editor.getByRole('spinbutton', { name: 'Latitude', exact: true }).inputValue()) - selectedPoint.lat) < 1e-7, 'Switching snapshot candidate to map-only restores clicked latitude');
            assert.ok(Math.abs(Number(await editor.getByRole('spinbutton', { name: 'Longitude', exact: true }).inputValue()) - selectedPoint.lng) < 1e-7, 'Switching snapshot candidate to map-only restores clicked longitude');
            await editor.getByRole('button', { name: /cancel/i }).click(); await page.waitForTimeout(1200);
            const after = await audit(page); assert.equal(after.unexpectedWrites.length, before.unexpectedWrites.length); assert.deepEqual(after.annotations, before.annotations);
        } finally { await context.close(); }
    });
    await check('point-no-address-review-cancel', async () => {
        const { page, context } = await createPage();
        try {
            const before = await audit(page); await startPointPicker(page); await clickMap(page);
            const picker = page.getByRole('dialog', { name: 'Choose address for this point', exact: true }); await picker.waitFor();
            await picker.getByRole('button', { name: 'Use selected point without an address', exact: true }).click();
            const editor = page.getByRole('dialog').filter({ has: page.getByRole('checkbox', { name: /^This point has no postal address/ }) }).first(); await editor.waitFor();
            assert.ok(await editor.getByRole('checkbox', { name: /^This point has no postal address/ }).isChecked(), 'Explicit coordinate-only mode');
            await capture(page, 'desktop-coordinate-only-review');
            await editor.getByRole('button', { name: /cancel/i }).click(); await page.waitForTimeout(1200);
            const after = await audit(page); assert.equal(after.unexpectedWrites.length, before.unexpectedWrites.length); assert.equal(after.explicitWrites.length, before.explicitWrites.length);
        } finally { await context.close(); }
    });
    for (const switchMap of [false, true]) await check(`point-stale-nearby-${switchMap ? 'map-change' : 'cancel'}`, async () => {
        const { page, context } = await createPage();
        let release;
        const held = new Promise(resolve => { release = resolve; });
        let received;
        const requestSeen = new Promise(resolve => { received = resolve; });
        await page.route(`**${snapshotPrefix}/nearby`, async route => {
            received(); await held;
            await route.fulfill({ json: { snapshot, total: 1, rows: [rows[0]], offset: 0, limit: 10, truncated: false } }).catch(() => {});
        });
        try {
            const before = await audit(page); await startPointPicker(page); await clickMap(page); await Promise.race([requestSeen, new Promise((_, reject) => setTimeout(() => reject(Error('Nearby request was not sent after placement click')), 15000))]);
            const picker = page.getByRole('dialog', { name: 'Choose address for this point', exact: true }); await picker.waitFor();
            if (switchMap) await page.evaluate(route => { history.pushState({}, '', route); dispatchEvent(new PopStateEvent('popstate')); }, `/my-directory/maps/${mapId + 1}`);
            else await picker.getByRole('button', { name: /close|cancel/i }).first().click();
            release(); await page.waitForTimeout(1500);
            assert.equal(await page.locator('[data-nearby-address-picker]').filter({ visible: true }).count(), 0, 'Late response cannot reopen picker');
            assert.equal(await page.getByRole('button', { name: /Find location/i }).filter({ visible: true }).count(), 0, 'Late response cannot open review');
            const after = await audit(page); assert.equal(after.unexpectedWrites.length, before.unexpectedWrites.length); assert.equal(after.explicitWrites.length, before.explicitWrites.length);
            return { lateResponseReleased: true };
        } finally { release(); await context.close(); }
    });
    await check('point-snapshot-unavailable-retry', async () => {
        const { page, context } = await createPage();
        let attempts = 0;
        await page.route(`**${snapshotPrefix}/nearby`, async route => {
            attempts++;
            if (attempts === 1) return route.fulfill({ status: 503, json: { error: 'Unavailable' } });
            return route.fallback();
        });
        try {
            const before = await audit(page); await startPointPicker(page); await clickMap(page);
            const picker = page.getByRole('dialog', { name: 'Choose address for this point', exact: true }); await picker.waitFor();
            await picker.getByRole('button', { name: 'Retry', exact: true }).click();
            await picker.getByRole('button', { name: 'Use this address', exact: true }).first().waitFor();
            assert.equal(attempts, 2); await picker.getByRole('button', { name: /close|cancel/i }).first().click();
            await page.waitForTimeout(1000); assert.equal((await audit(page)).unexpectedWrites.length, before.unexpectedWrites.length);
        } finally { await context.close(); }
    });
    await check('circle-print-and-real-png-export', async () => {
        const { page, context } = await createPage(false, `/my-directory/maps/${mapId}?view=print&studioView=view-default`);
        try {
            const before = await audit(page);
            const label = page.locator('[data-map-radius-label]').filter({ visible: true }).first(); await label.waitFor();
            const text = (await label.innerText()).trim(); assert.match(text, /500\s*m.*radius/i);
            await capture(page, 'print-circle-radius');
            const downloaded = page.waitForEvent('download', { timeout: 60000 });
            await page.getByRole('button', { name: 'Save PNG', exact: true }).click();
            const download = await downloaded, file = path.join(out, 'circle-radius-export.png'); await download.saveAs(file); report.downloads.push(file);
            const bytes = await fs.readFile(file); assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
            const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20); assert.ok(width > 500 && height > 300, 'Actual PNG download has substantive dimensions');
            assert.equal((await audit(page)).unexpectedWrites.length, before.unexpectedWrites.length);
            return { text, png: { file, width, height, sha256: createHash('sha256').update(bytes).digest('hex') } };
        } finally { await context.close(); }
    });
    await check('real-csv-point-and-selected-circle-area', async () => {
        const { page, context } = await createPage();
        try {
            const before = await audit(page);
            const metadata = await page.evaluate(() => fetch('/__carearound-addresses/metadata').then(response => response.json()));
            assert.equal(metadata.snapshot.recordCount, 143807); assert.equal(metadata.snapshot.postalCodeCount, 122261);
            assert.equal(metadata.snapshot.sha256, '2d9740ed84cea78fd571ddc5c06e14c13d780bf47f4d50f405804c2e473b18e4');
            await openAnnotation(page); await selectCircle(page);
            const areaReady = page.waitForResponse(response => response.url().includes(`${snapshotPrefix}/area`) && response.status() === 200);
            await page.getByRole('button', { name: 'Find within area', exact: true }).click();
            const areaResponse = await areaReady;
            const panel = await areaDialog(page);
            await panel.locator('li input[type=checkbox]').first().waitFor();
            assert.ok(await panel.locator('li input[type=checkbox]').count() > 0, 'Actual CSV supplies address rows inside saved circle');
            await capture(page, 'real-csv-desktop-selected-circle-addresses');
            const area = areaResponse ? await areaResponse.json() : null;
            await panel.getByRole('button', { name: /close/i }).first().click();
            await startPointPicker(page); const nearbyReady = page.waitForResponse(response => response.url().includes(`${snapshotPrefix}/nearby`) && response.status() === 200);
            await clickMap(page); const nearby = await (await nearbyReady).json();
            assert.ok(nearby.total > 0, 'Actual CSV supplies nearby candidate rows');
            const picker = page.getByRole('dialog', { name: 'Choose address for this point', exact: true });
            await picker.getByRole('button', { name: 'Use this address', exact: true }).first().waitFor();
            await capture(page, 'real-csv-desktop-point-candidates');
            await picker.getByRole('button', { name: 'Use this address', exact: true }).first().click();
            const editor = page.getByRole('dialog', { name: 'Add personal place', exact: true }); await editor.waitFor();
            assert.ok(await editor.getByRole('button', { name: 'Save', exact: true }).isDisabled(), 'Real snapshot candidate still needs existing live postal verification');
            await capture(page, 'real-csv-desktop-address-review');
            await editor.getByRole('button', { name: /cancel/i }).click(); await page.waitForTimeout(1200);
            const after = await audit(page); assert.deepEqual(after.annotations, before.annotations); assert.equal(after.unexpectedWrites.length, before.unexpectedWrites.length);
            report.realSnapshot = { metadata: metadata.snapshot, areaTotal: area?.total, nearbyTotal: nearby.total, nearbyReturned: nearby.rows.length, noWrites: true };
            return { areaTotal: area?.total, nearbyTotal: nearby.total };
        } finally { await context.close(); }
    });
    await check('phone-new-area-and-point-review', async () => {
        const { page, context } = await createPage(true);
        try {
            const before = await audit(page); await openAnnotation(page, true);
            const selection = await selectVisiblePhoneCircle(page);
            await page.getByRole('button', { name: 'Find within area', exact: true }).click();
            const panel = await areaDialog(page);
            assert.equal(await panel.locator('[data-map-area-choice]').inputValue(), selection.annotationId, 'Area query uses the intended selected circle');
            await panel.locator('li input[type=checkbox]').first().waitFor();
            await capture(page, 'phone-area-addresses');
            assert.ok(await panel.getByRole('button', { name: 'Download all CSV', exact: true }).isVisible(), 'Phone CSV actions reachable');
            await panel.getByRole('tab', { name: /^CareAround resources/ }).click();
            await panel.getByRole('link', { name: 'Fictional catalogue centre outside saved map', exact: true }).waitFor();
            await capture(page, 'phone-area-catalogue');
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth <= 1), 'No phone horizontal overflow');
            await panel.getByRole('button', { name: /close/i }).first().click();
            await startPointPicker(page, true); await clickMap(page);
            const picker = page.getByRole('dialog', { name: 'Choose address for this point', exact: true });
            await picker.getByRole('button', { name: 'Use this address', exact: true }).first().waitFor();
            await capture(page, 'phone-point-candidates');
            await picker.getByRole('button', { name: 'Use selected point without an address', exact: true }).click();
            const editor = page.getByRole('dialog', { name: 'Add personal place', exact: true });
            await editor.locator('[data-address-location-review]').waitFor();
            await capture(page, 'phone-coordinate-only-review');
            await editor.getByRole('button', { name: /cancel/i }).click(); await page.waitForTimeout(1200);
            const after = await audit(page); assert.deepEqual(after.annotations, before.annotations); assert.equal(after.unexpectedWrites.length, before.unexpectedWrites.length);
            return { selection };
        } finally { await context.close(); }
    });
    await check('circle-live-radius-preview-without-save', async () => {
        const { page, context } = await createPage();
        try {
            const before = await audit(page); await openAnnotation(page);
            await page.getByRole('button', { name: 'Draw circle', exact: true }).click();
            await clickMap(page, 1.382, 103.7535);
            await clickMap(page, 1.383, 103.7545, 'move'); await page.waitForTimeout(200);
            const labels = page.locator('[data-map-radius-label]').filter({ visible: true });
            assert.ok(await labels.count() >= 2, 'Unfinished circle has its own radius label alongside the saved circle');
            const first = await labels.allTextContents();
            await clickMap(page, 1.3834, 103.7545, 'move'); await page.waitForTimeout(200);
            const second = await labels.allTextContents(); assert.notDeepEqual(second, first, 'Live radius follows pointer distance');
            assert.ok(await page.locator('[data-map-radius-guide]').count() >= 2, 'Live radius line is rendered');
            await capture(page, 'desktop-circle-live-radius-preview');
            await page.getByRole('button', { name: 'Select or adjust', exact: true }).click(); await page.waitForTimeout(1200);
            const after = await audit(page); assert.deepEqual(after.annotations, before.annotations); assert.equal(after.revision, before.revision); assert.equal(after.unexpectedWrites.length, before.unexpectedWrites.length);
        } finally { await context.close(); }
    });
    for (const shape of ['rotated-box', 'rounded-polygon']) await check(`selected-${shape}-area-query`, async () => {
        const { page, context } = await createPage();
        try {
            const before = await audit(page); await openAnnotation(page);
            if (shape === 'rounded-polygon') await clickMap(page, 1.383, 103.7515);
            else {
                const area = createSpatialAreaFromAnnotation(annotations.find(value => value.id === 'preview-box'));
                const lowest = area.coordinates[0].slice(0, -1).reduce((left, right) => left[1] < right[1] ? left : right);
                await clickMap(page, lowest[1], lowest[0]);
            }
            const sent = page.waitForRequest(request => request.url().includes(`${snapshotPrefix}/area`));
            await page.getByRole('button', { name: 'Find within area', exact: true }).click();
            const query = (await sent).postDataJSON().area;
            assert.equal(query.type, 'Polygon');
            if (shape === 'rounded-polygon') assert.ok(query.coordinates[0].length > 5, 'Query follows rendered rounded boundary');
            else { const [a, b] = query.coordinates[0]; assert.ok(a[0] !== b[0] && a[1] !== b[1], 'Query preserves rectangle rotation'); }
            const panel = await areaDialog(page); await panel.locator('li input[type=checkbox]').first().waitFor();
            await capture(page, `desktop-${shape}-area`); await panel.getByRole('button', { name: /close/i }).first().click();
            await page.waitForTimeout(1200); const after = await audit(page); assert.deepEqual(after.annotations, before.annotations); assert.equal(after.unexpectedWrites.length, before.unexpectedWrites.length);
            return { geometryType: query.type, ringPoints: query.coordinates[0].length };
        } finally { await context.close(); }
    });
    await check('area-cancel-held-response-no-saved-mutation', async () => {
        const { page, context } = await createPage();
        let release; const held = new Promise(resolve => { release = resolve; });
        await page.route(`**${snapshotPrefix}/area`, async route => { await held; await route.fulfill({ json: { snapshot, total: 1, rows: [rows[0]], offset: 0, limit: 200, truncated: false } }).catch(() => {}); });
        try {
            const before = await audit(page); await openAnnotation(page); await selectCircle(page);
            await page.getByRole('button', { name: 'Find within area', exact: true }).click();
            const panel = await areaDialog(page); await panel.waitFor();
            await panel.getByRole('button', { name: /close/i }).first().click(); release(); await page.waitForTimeout(1200);
            assert.equal(await page.locator('[data-map-area-results]').filter({ visible: true }).count(), 0, 'Late area response does not reopen results');
            const after = await audit(page); assert.deepEqual(after.annotations, before.annotations); assert.equal(after.revision, before.revision); assert.equal(after.unexpectedWrites.length, before.unexpectedWrites.length);
        } finally { release(); await context.close(); }
    });
    report.sourceAfter = await sourceSnapshot();
    report.sourceUnchanged = JSON.stringify(report.sourceBefore) === JSON.stringify(report.sourceAfter);
    assert.ok(report.sourceUnchanged, 'Source and harness must be frozen during evidence run');
    assert.equal(report.errors.length, 0, 'No page errors');
    assert.equal(report.unexpectedRemoteRequests.length, 0, 'No unapproved external requests from the preview');
    assert.equal(report.consoleErrors.filter(value => /Route failed to render|ReferenceError:|TypeError:/.test(value)).length, 0, 'No caught render errors');
    assert.ok(report.cases.length > 0 && report.cases.every(value => value.passed)); report.passed = true;
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
    await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    await browser?.close(); await vite.close(); if (snapshotServer) await new Promise(resolve => snapshotServer.close(resolve));
}
console.log(JSON.stringify({ out, passed: Boolean(report.passed), cases: report.cases.map(({ name, passed }) => ({ name, passed })), errors: report.errors, failure: report.failure }, null, 2));
