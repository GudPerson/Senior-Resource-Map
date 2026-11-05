// Actual owner App; fictional APIs, annotations and synthetic map pixels only.
// node tests/browser/care-map-canvas-studio-layout.mjs [--out=PATH]
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { fingerprint, startFixture } from '../fixtures/care-map-floating-canvas/runtime.mjs';

const out = process.argv.find(value => value.startsWith('--out='))?.slice(6)
    || await fs.mkdtemp(path.join(os.tmpdir(), 'care-map-canvas-studio-layout-'));
await fs.mkdir(out, { recursive: true });
const report = {
    boundary: 'Local actual App with fictional records and synthetic imagery. Trusted scripted wheel/keyboard inputs; no production, physical trackpad or exported-image acceptance.',
    sourceBefore: await fingerprint(), cases: [], screenshots: [], errors: [], unexpectedWrites: [], expectedRejectedWrites: [],
};
let browser, fixture, current;
const wait = async (fn, message) => {
    const started = Date.now();
    while (Date.now() - started < 10000) {
        if (await fn()) return;
        await new Promise(resolve => setTimeout(resolve, 40));
    }
    throw new Error(message);
};
async function check(name, action) {
    try { report.cases.push({ name, passed: true, evidence: await action() }); }
    catch (error) { report.cases.push({ name, passed: false, error: error.message }); throw error; }
}
async function sample(page) {
    return page.evaluate(() => {
        const owner = document.querySelector('[data-map-studio-owner-panel]');
        const design = owner?.querySelector('[data-map-studio-design-settings-panel]');
        const select = owner?.querySelector('select');
        const header = document.querySelector('.owner-canvas-header');
        const rect = node => node ? Object.fromEntries(['x', 'y', 'width', 'height'].map(key => [key, node.getBoundingClientRect()[key]])) : null;
        const maps = [...window.__qaMaps].filter(map => map.getContainer().isConnected);
        const map = maps.find(map => map.getContainer().getBoundingClientRect().width > 0);
        return {
            owner: owner && { clientWidth: owner.clientWidth, scrollWidth: owner.scrollWidth, scrollTop: owner.scrollTop, ...rect(owner) },
            design: design && { overflowY: getComputedStyle(design).overflowY, overscrollY: getComputedStyle(design).overscrollBehaviorY, scrollTop: design.scrollTop },
            select: rect(select), header: rect(header), viewName: header?.querySelector('.owner-canvas-view-name')?.textContent,
            zoom: map?.getZoom(), controlledZoom: window.__qaControlledInputs.get(map)?.zoom,
            backgrounds: map?.getContainer().querySelectorAll('.leaflet-tile-pane img,.leaflet-image-layer').length || 0,
            mapIndex: [...window.__qaMaps].indexOf(map), connectedMaps: maps.length,
            studioEvents: window.__qaStudioEvents, editorEvents: window.__qaEditorEvents,
            pageOverflow: document.documentElement.scrollWidth - innerWidth,
            canvasSelectCount: document.querySelector('[data-owner-canvas-chrome]')?.querySelectorAll('select').length,
        };
    });
}
async function screenshot(page, name) {
    const file = path.join(out, `${name}.png`);
    await page.screenshot({ path: file });
    report.screenshots.push(file);
}
async function resetPanel(page) {
    await page.locator('[data-map-studio-owner-panel]').evaluate(node => { node.scrollTop = 0; });
    await page.waitForTimeout(80);
}

try {
    fixture = await startFixture(out);
    browser = await chromium.launch({ headless: true });
    for (const viewport of [{ width: 1470, height: 801 }, { width: 1280, height: 600 }, { width: 390, height: 844 }]) {
        const page = current = await browser.newPage({ viewport });
        const state = await fixture.install(page);
        await page.goto(new URL(`/my-directory/maps/${fixture.mapId}`, fixture.base).href);
        await page.locator('[data-owner-canvas-enter]').waitFor();
        await wait(async () => {
            const row = await sample(page);
            return row.connectedMaps === 1 && row.backgrounds > 0 && Number.isFinite(row.zoom)
                && Math.abs(row.zoom - row.controlledZoom) < .001;
        }, 'initial displayed/controlled fictional camera not ready');
        const normal = await sample(page), saved = JSON.stringify(state.document), annotations = JSON.stringify(state.annotations);
        await page.locator('[data-owner-canvas-enter]').click();
        await page.locator('[data-owner-canvas-active="true"]').waitFor();
        await page.locator('[data-owner-canvas-context]').click();
        const panel = page.locator('[data-map-studio-owner-panel]');
        await panel.locator('[data-map-studio-design-settings-panel]').waitFor();
        await check(`${viewport.width}x${viewport.height} compact Studio fits one inspector`, async () => {
            const row = await sample(page);
            assert.ok(row.owner.scrollWidth <= row.owner.clientWidth + 1, JSON.stringify(row));
            assert.ok(row.select.width >= 180, JSON.stringify(row));
            assert.ok(row.owner.x >= 0 && row.owner.y >= 0 && row.owner.x + row.owner.width <= viewport.width + 1);
            assert.ok(row.owner.y + row.owner.height <= viewport.height);
            assert.ok(row.header.height <= 60);
            assert.equal(row.canvasSelectCount, 0, 'only Studio owns a functional view selector');
            assert.equal(row.mapIndex, normal.mapIndex);
            assert.deepEqual(row.studioEvents, normal.studioEvents);
            assert.deepEqual(row.editorEvents, normal.editorEvents);
            assert.equal(row.design.overflowY, 'visible');
            assert.equal(row.design.overscrollY, 'auto');
            assert.ok(row.pageOverflow <= 1);
            const label = await panel.getByRole('group', { name: 'Pin style', exact: true })
                .getByRole('button', { name: 'Numbered pins', exact: true }).evaluate(button => {
                    const span = button.querySelector('span'), range = document.createRange();
                    range.setStart(span.firstChild, 0);
                    range.setEnd(span.firstChild, 'Numbered'.length);
                    return { wordRectangles: range.getClientRects().length, fontSize: getComputedStyle(span).fontSize };
                });
            assert.equal(label.wordRectangles, 1, 'Numbered must wrap at the space, not inside the word');
            row.numberedLabel = label;
            const context = await page.locator('[data-owner-canvas-context]').evaluate(node => ({ title: node.title, label: node.getAttribute('aria-label') }));
            assert.ok(context.title.includes(state.directory.name) && context.label.includes(state.directory.name));
            assert.ok(context.title.includes(row.viewName) && context.label.includes(row.viewName));
            row.accessibleContext = context;
            await screenshot(page, `studio-${viewport.width}`);
            return row;
        });
        await check(`${viewport.width}px trusted wheel over layout scrolls inspector without zoom`, async () => {
            await resetPanel(page);
            const field = panel.locator('[data-map-studio-design-settings-panel] fieldset').first();
            await field.scrollIntoViewIfNeeded();
            const box = await field.boundingBox(), outer = await panel.boundingBox();
            const hit = { x: box.x + box.width * .6, y: Math.max(outer.y + 15, Math.min(box.y + 20, outer.y + outer.height - 20)) };
            assert.ok(hit.y >= box.y && hit.y < box.y + box.height, 'wheel target must be actual layout field');
            const before = await sample(page);
            await page.mouse.move(hit.x, hit.y);
            await page.mouse.wheel(0, 260);
            await page.waitForTimeout(200);
            const after = await sample(page);
            assert.ok(after.owner.scrollTop > before.owner.scrollTop, JSON.stringify({ before, after }));
            assert.equal(after.design.scrollTop, 0);
            assert.equal(after.zoom, before.zoom);
            assert.equal(after.mapIndex, before.mapIndex);
            return { hit, before: before.owner.scrollTop, after: after.owner.scrollTop, zoom: after.zoom };
        });
        await check(`${viewport.width}px view actions remain bounded and retain default safeguards`, async () => {
            await resetPanel(page);
            const actions = panel.locator('.map-studio-canvas-view-actions');
            await actions.locator('summary').click();
            assert.equal(await actions.getByRole('button', { name: 'Set default', exact: true }).isDisabled(), true);
            assert.equal(await actions.getByRole('button', { name: 'Delete', exact: true }).isEnabled(), true);
            const rectangles = await actions.locator('button').evaluateAll(nodes => nodes.map(node => {
                const b = node.getBoundingClientRect(); return { text: node.textContent.trim(), x: b.x, right: b.right, width: b.width };
            }));
            const b = await panel.boundingBox();
            assert.ok(rectangles.every(r => r.x >= b.x && r.right <= b.x + b.width + 1 && r.width > 90), JSON.stringify(rectangles));
            await actions.locator('summary').click();
            return rectangles;
        });
        await check(`${viewport.width}px existing saved-view selection updates slim context and keeps controller`, async () => {
            await panel.locator('select[id^="map-studio-view-"]').selectOption('fictional-second-view');
            await wait(async () => (await sample(page)).viewName === 'Fictional partner view', 'slim context did not follow existing saved-view state');
            const after = await sample(page);
            assert.equal(after.mapIndex, normal.mapIndex);
            assert.deepEqual(after.studioEvents, normal.studioEvents);
            assert.deepEqual(state.allowedWrites, []);
            assert.deepEqual(state.unexpectedWrites, []);
            assert.equal(JSON.stringify(state.document), saved);
            assert.equal(JSON.stringify(state.annotations), annotations);
            await screenshot(page, `view-name-${viewport.width}`);
            return { viewName: after.viewName, mapIndex: after.mapIndex, writes: 0 };
        });
        if (viewport.width === 1470) {
            await check('failed design flush retains current view and original explicit discard recovery', async () => {
                const rejected = [];
                await page.route(`**/api/my-maps/${fixture.mapId}/studio`, async route => {
                    if (route.request().method() !== 'PUT') return route.fallback();
                    rejected.push(route.request().postDataJSON());
                    return route.fulfill({ status: 503, json: { error: 'Fictional rejected Studio save' } });
                });
                await panel.getByRole('group', { name: 'Map colour', exact: true }).getByRole('button', { name: 'Gray', exact: true }).click();
                await resetPanel(page);
                await panel.locator('select[id^="map-studio-view-"]').selectOption(state.document.views[0].id);
                await panel.getByRole('button', { name: 'Retry save', exact: true }).waitFor();
                assert.equal(await panel.locator('select[id^="map-studio-view-"]').inputValue(), 'fictional-second-view');
                assert.equal((await sample(page)).viewName, 'Fictional partner view');
                assert.equal(rejected.length, 1);
                await panel.locator('.map-studio-canvas-view-actions summary').click();
                await panel.getByRole('button', { name: 'Discard', exact: true }).click();
                const dialog = page.getByRole('dialog', { name: 'Discard all Map Studio changes?', exact: true });
                await dialog.waitFor();
                await dialog.getByRole('button', { name: 'Discard', exact: true }).click();
                await wait(async () => (await sample(page)).viewName === 'Fictional partner view' && await panel.getByRole('button', { name: 'Gray', exact: true }).getAttribute('aria-pressed') === 'false', 'discard did not restore original persisted design');
                report.expectedRejectedWrites.push({ method: 'PUT', type: 'fictional Studio design', status: 503, count: rejected.length });
                return { selectedViewRetained: true, rejectedWrites: rejected.length, recoveredByConfirmedDiscard: true };
            });
        }
        await page.locator('[data-owner-canvas-exit]').click();
        await page.waitForTimeout(140);
        await check(`${viewport.width}px Return restores classic presentation without data writes`, async () => {
            assert.equal(await page.locator('[data-map-studio-owner-panel]').getAttribute('data-map-studio-canvas'), null);
            const row = await sample(page);
            assert.equal(row.mapIndex, normal.mapIndex);
            assert.deepEqual(row.studioEvents, normal.studioEvents);
            assert.deepEqual(state.unexpectedWrites, []);
            assert.deepEqual(state.allowedWrites, []);
            assert.equal(JSON.stringify(state.document), saved);
            assert.equal(JSON.stringify(state.annotations), annotations);
            return { sameMap: true, sameStudio: true, persistedDocumentsUnchanged: true };
        });
        report.errors.push(...state.errors);
        report.unexpectedWrites.push(...state.unexpectedWrites);
        assert.deepEqual(state.errors, []);
        await page.close();
    }
} catch (error) {
    report.failure = error.stack;
    process.exitCode = 1;
    if (current && !current.isClosed()) {
        report.failureState = await sample(current).catch(() => null);
        await screenshot(current, 'failure').catch(() => {});
    }
} finally {
    report.sourceAfter = await fingerprint();
    report.sourceChanged = JSON.stringify(report.sourceBefore) !== JSON.stringify(report.sourceAfter);
    if (report.sourceChanged) { report.failure ||= 'Source changed during checks'; process.exitCode = 1; }
    await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    await browser?.close();
    await fixture?.server.close();
    console.log(JSON.stringify({ out, passed: report.cases.filter(row => row.passed).length, total: report.cases.length, failure: report.failure || null }));
}
