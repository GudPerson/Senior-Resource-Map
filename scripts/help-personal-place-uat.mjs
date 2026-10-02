// Actual local UI/controllers over disposable data; address lookup is a replay.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
assert.equal(process.env.CAREAROUND_SUPPORT_FIXTURE, 'true');
const app = 'http://127.0.0.1:5181', api = 'http://127.0.0.1:8793';
const output = new URL('../output/help-centre/personal-place-workflow/', import.meta.url);
await mkdir(output, { recursive: true });
const content = JSON.parse(await readFile(new URL('../client/src/generated/helpArticles.json', import.meta.url), 'utf8'));
const report = { contentVersion: content.version, startedAt: new Date().toISOString(), proof: 'real local UI and controllers; disposable accounts; simulated OneMap lookup, not live address verification', checks: [], pageErrors: [] };
const runId = Date.now();
const browser = await chromium.launch({ headless: true });
try {
    for (const width of [1440, 390]) {
        const context = await browser.newContext({ viewport: { width, height: 1000 }, serviceWorkers: 'block' });
        await context.addCookies([{ name: 'carearound_support_fixture', value: 'member', domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' }]);
        let lookups = 0;
        await context.route('**/*', route => {
            const url = new URL(route.request().url());
            if (url.origin === 'https://www.onemap.gov.sg' && url.pathname === '/api/common/elastic/search') {
                lookups++;
                const results = url.searchParams.get('searchVal') === '123456' ? [{ POSTAL: '123456', ADDRESS: 'FICTIONAL DEMONSTRATION ADDRESS', BUILDING: 'FICTIONAL DEMONSTRATION POINT', LATITUDE: '1.294', LONGITUDE: '103.821' }] : [];
                return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ results }) });
            }
            return [app, api].includes(url.origin) ? route.continue() : route.abort('blockedbyclient');
        });
        const page = await context.newPage(); page.setDefaultTimeout(15000);
        page.on('pageerror', error => report.pageErrors.push(error.message));
        const mapResponse = await context.request.post(api + '/api/my-maps', { data: { name: 'Fictional procedure map ' + width, description: 'Disposable Help Centre procedure check.' } });
        assert.equal(mapResponse.status(), 201, await mapResponse.text());
        const map = await mapResponse.json();
        const resource = await context.request.post(api + '/api/my-maps/' + map.id + '/assets', { data: { resourceType: 'hard', resourceId: 100 } });
        assert.equal(resource.status(), 201, await resource.text());
        await page.goto(app + '/my-directory/maps/' + map.id);
        await page.locator('.leaflet-container:visible').first().waitFor().catch(async error => {
            await page.screenshot({ path: new URL('diagnostic.png', output).pathname, fullPage: true });
            await writeFile(new URL('diagnostic.txt', output), await page.locator('body').innerText());
            throw error;
        });
        for (const mode of ['addressed', 'map_only']) {
            const visibleEntry = page.getByRole('button', { name: 'Personal place', exact: true });
            if (!await visibleEntry.count()) await page.getByRole('button', { name: 'Open map controls', exact: true }).click();
            await visibleEntry.click();
            const chooser = page.getByRole('dialog', { name: 'Add personal place to map', exact: true }); await chooser.waitFor();
            await chooser.getByRole('button', { name: 'Choose map location', exact: true }).first().click();
            const surface = page.locator('.leaflet-container:visible').first(); await surface.waitFor();
            await surface.scrollIntoViewIfNeeded();
            const size = await surface.boundingBox();
            await surface.click({ position: { x: Math.min(size.width * 0.65, size.width - 20), y: Math.min(size.height * 0.65, size.height - 20) } });
            const editor = page.getByRole('dialog', { name: 'Add personal place', exact: true }); await editor.waitFor().catch(async error => { await page.screenshot({ path: new URL('selection-diagnostic.png', output).pathname, fullPage: true }); await writeFile(new URL('selection-diagnostic.txt', output), await page.locator('body').innerText()); throw error; });
            const name = 'Fictional ' + mode + ' ' + width + ' ' + runId;
            await editor.locator('input[required][type="text"]').fill(name);
            const category = editor.locator('select');
            const options = await category.locator('option').evaluateAll(elements => elements.map(e => e.value).filter(Boolean));
            assert.ok(options.length > 0); await category.selectOption(options[0]);
            if (mode === 'addressed') {
                assert.equal(await editor.getByRole('button', { name: 'Save', exact: true }).isEnabled(), false);
                await editor.locator('#personal-place-lookup').fill('123456');
                await editor.getByRole('button', { name: 'Find location', exact: true }).click();
                await editor.getByRole('button', { name: 'Save', exact: true }).waitFor();
                await page.waitForFunction(() => document.querySelector('input#personal-place-lookup')?.value === '123456' && !document.querySelector('section[role="dialog"] button[type="submit"]')?.disabled);
            } else {
                await editor.getByRole('checkbox', { name: /This point has no postal address/ }).check();
                assert.equal(await editor.locator('#personal-place-lookup').count(), 0);
            }
            await editor.screenshot({ path: new URL(`${width}-${mode}-editor.png`, output).pathname });
            const savedResponse = page.waitForResponse(response => response.url().endsWith('/api/my-maps/' + map.id + '/personal-places') && response.request().method() === 'POST');
            await editor.getByRole('button', { name: 'Save', exact: true }).click();
            const saved = await savedResponse; assert.equal(saved.status(), 201, await saved.text());
            await editor.waitFor({ state: 'hidden' });
            const libraryResponse = await context.request.get(api + '/api/personal-places');
            const library = await libraryResponse.json();
            const rows = Array.isArray(library) ? library : library.places;
            assert.equal(rows.filter(entry => entry.name === name).length, 1);
            const place = rows.find(entry => entry.name === name); assert.ok(place, 'Created location must be reusable in My Places.');
            assert.ok(place.mapIds.some(id => Number(id) === map.id), 'Place must attach to the selected owned map.');
            if (mode === 'map_only') assert.equal(place.address || '', '');
            else assert.equal(place.postalCode, '123456');
            assert.equal((await context.request.get(api + '/api/help/articles/add-a-personal-place-to-your-map')).status(), 200);
            report.checks.push({ width, mode, passed: true, savedRows: 1, selectedMapMembership: true, myPlacesReuse: true, lookup: mode === 'addressed' ? 'simulated result accepted by actual controller' : 'no lookup', productionWrites: 0 });
            console.log(`PASS ${width} ${mode}`);
        }
        assert.equal(lookups, 1); await context.close();
    }
    assert.deepEqual(report.pageErrors, []);
} finally { report.finishedAt = new Date().toISOString(); await writeFile(new URL('report.json', output), JSON.stringify(report, null, 2)); await browser.close(); }
console.log('PASS 4/4 actual local Personal place workflows; simulated geocoding only.');
