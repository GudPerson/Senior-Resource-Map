// Local Chromium fixtures with synthetic data and production dialog components.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { startAreaFixture, fingerprint } from '../fixtures/care-map-area-resources/runtime.mjs';
import { owner } from '../fixtures/care-map-floating-canvas/data.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const out = process.argv.find(value => value.startsWith('--out='))?.slice(6)
    || await fs.mkdtemp(path.join(os.tmpdir(), 'roomier-dialogs-'));
const filter = process.argv.find(value => value.startsWith('--case='))?.slice(7);
await fs.mkdir(out, { recursive: true });

const desktop = { width: 1440, height: 900 };
const phone = { width: 390, height: 844 };
const smallTreatments = [
    { name: 'small portrait', viewport: { width: 320, height: 640 }, scale: 1.1 },
    { name: 'phone portrait', viewport: phone, scale: 1 },
    { name: 'short phone', viewport: { width: 390, height: 500 }, scale: 1.1 },
    { name: 'landscape', viewport: { width: 844, height: 390 }, scale: 1.1 },
    { name: 'equivalent 200% reflow', viewport: { width: 720, height: 450 }, scale: 1, deviceScaleFactor: 2 },
];
const fixtureEntry = '/__roomier-dialogs.jsx';
const componentFixture = `
    import React, { useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import ConfirmDialog from '/src/components/ConfirmDialog.jsx';
    import MapSpatialDialog from '/src/components/MapSpatialDialog.jsx';
    import MobileBottomSheet from '/src/components/mobile/MobileBottomSheet.jsx';
    import { CmsDialog } from '/src/features/help-content/CmsControls.jsx';
    import '/src/index.css';
    import '/src/features/help-content/helpContent.css';

    const longTamil = 'தேர்ந்தெடுத்த வளங்களின் வெளியீட்டு மாற்றங்களை உறுதிப்படுத்தவும்';
    const definition = {
        title: 'Review fictional publication',
        description: longTamil.repeat(3),
        details: Array.from({ length: 22 }, (_, i) => i + ' ' + longTamil),
        fields: [{ name: 'review', label: 'Review note' }],
    };
    function Fixture() {
        const [open, setOpen] = useState('');
        const close = () => setOpen('');
        return <>
            <button onClick={() => setOpen('confirm')}>Open confirmation</button>
            <button onClick={() => setOpen('cms')}>Open publication review</button>
            <button onClick={() => setOpen('spatial')}>Open spatial picker</button>
            <button onClick={() => setOpen('sheet')}>Open mobile sheet</button>
            <ConfirmDialog open={open === 'confirm'} title="Confirm fictional change" message={longTamil.repeat(3)}
                details={definition.details} onCancel={close} onConfirm={close} />
            <CmsDialog definition={open === 'cms' ? definition : null} onComplete={close} />
            {open === 'spatial' && <MapSpatialDialog title="Spatial picker" onClose={close}>
                <div className="min-h-0 overflow-y-auto p-4">
                    {definition.details.map(row => <p key={row}>{row}</p>)}
                    <label>Final spatial field <input type="text" /></label>
                </div>
                <button type="button" className="shrink-0" onClick={close}>Use selection</button>
            </MapSpatialDialog>}
            <MobileBottomSheet open={open === 'sheet'} onOpenChange={next => !next && close()} title="Mobile controls"
                description={longTamil} headerActions={<button onClick={close}>Close sheet</button>}>
                {definition.details.map(row => <p key={row}>{row}</p>)}
                <label>Final sheet field <input type="text" /></label>
                <button onClick={close} className="block">Apply sheet</button>
            </MobileBottomSheet>
        </>;
    }
    createRoot(document.getElementById('root')).render(<Fixture />);
`;

async function sourceFingerprint() {
    const files = [
        import.meta.filename, path.join(root, 'tests/fixtures/care-map-area-resources/runtime.mjs'),
        path.join(root, 'tests/fixtures/care-map-floating-canvas/runtime.mjs'),
        path.join(root, 'tests/fixtures/care-map-floating-canvas/data.mjs'),
        path.join(root, 'tests/fixtures/care-map-view-controls/vite.config.mjs'),
    ];
    const harness = Object.fromEntries(await Promise.all(files.map(async file => [
        path.relative(root, file), createHash('sha256').update(await fs.readFile(file)).digest('hex'),
    ])));
    return { product: await fingerprint(), harness };
}

const report = {
    boundary: 'Local actual App or actual production component with fictional state and intercepted requests.',
    sourceBefore: await sourceFingerprint(), cases: [],
};
let browser, app, componentServer, componentOrigin;

async function check(name, run) {
    if (filter && !name.includes(filter)) return;
    try {
        report.cases.push({ name, passed: true, evidence: await run() });
    } catch (error) {
        report.cases.push({ name, passed: false, error: error.stack });
        console.error('FAIL', name, error.message.split('\n')[0]);
    }
}

async function prepareLocalPage(page) {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === componentOrigin
        ? route.continue() : route.abort());
    await page.goto(componentOrigin + '/__roomier-dialogs');
    try {
        await button(page, 'Open confirmation').waitFor({ timeout: 6000 });
    } catch (error) {
        throw new Error('Component fixture did not mount: ' + JSON.stringify(errors), { cause: error });
    }
    return errors;
}

async function startComponents() {
    if (componentServer) return;
    const id = path.join(root, 'client', fixtureEntry.slice(1));
    componentServer = await createServer({
        configFile: path.join(root, 'tests/fixtures/care-map-view-controls/vite.config.mjs'),
        root: path.join(root, 'client'),
        cacheDir: path.join(out, 'component-cache'),
        server: { host: '127.0.0.1', port: 0, strictPort: false, fs: { allow: [root] } },
        plugins: [{
            name: 'roomier-dialogs-fixture',
            resolveId(source) { if (source === fixtureEntry) return id; },
            load(source) { if (source === id) return componentFixture; },
            configureServer(server) {
                server.middlewares.use(async (request, response, next) => {
                    if (request.url !== '/__roomier-dialogs') return next();
                    const html = '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>'
                        + '<body><div id="root"></div><script type="module" src="' + fixtureEntry + '"></script></body></html>';
                    response.setHeader('Content-Type', 'text/html');
                    response.end(await server.transformIndexHtml('/__roomier-dialogs', html));
                });
            },
        }],
    });
    await componentServer.listen();
    componentOrigin = new URL(componentServer.resolvedUrls.local[0]).origin;
}

async function readBounds(panel, expectedWidth) {
    await panel.waitFor({ state: 'visible' });
    const bounds = await panel.evaluate(async node => {
        // Let the resized App switch responsive branches and finish the dialog's transitions.
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        await Promise.allSettled(node.getAnimations().map(animation => animation.finished));
        const { left, top, right, bottom, width, height } = node.getBoundingClientRect();
        return {
            left, top, right, bottom, width, height, viewport: [innerWidth, innerHeight],
            documentWidth: document.documentElement.scrollWidth,
            panelOverflowX: node.scrollWidth - node.clientWidth,
            scale: getComputedStyle(document.documentElement).getPropertyValue('--font-scale').trim(),
        };
    });
    const [width, height] = bounds.viewport;
    assert.ok(bounds.left >= -1 && bounds.right <= width + 1 && bounds.top >= -1 && bounds.bottom <= height + 1, JSON.stringify(bounds));
    assert.ok(bounds.documentWidth <= width && bounds.panelOverflowX <= 1, JSON.stringify(bounds));
    if (expectedWidth != null) assert.ok(Math.abs(bounds.width - expectedWidth) <= 1, JSON.stringify({ expectedWidth, bounds }));
    return bounds;
}

async function exposed(control) {
    await control.scrollIntoViewIfNeeded();
    const result = await control.evaluate(node => {
        const { left, top, right, bottom, width, height } = node.getBoundingClientRect();
        const hit = document.elementFromPoint(left + width / 2, top + height / 2);
        return { left, top, right, bottom, focused: document.activeElement === node, hit: node.contains(hit) };
    });
    assert.ok(result.hit, 'Control must receive pointer input: ' + JSON.stringify(result));
    return result;
}

async function withComponents(options, run) {
    await startComponents();
    const page = await browser.newPage(options);
    page.setDefaultTimeout(6000);
    try {
        const errors = await prepareLocalPage(page);
        const evidence = await run(page);
        assert.deepEqual(errors, []);
        return evidence;
    } finally { await page.close(); }
}

async function withApp(options, route, run, user = owner) {
    app ||= await startAreaFixture(out);
    const page = await browser.newPage(options);
    page.setDefaultTimeout(6000);
    try {
        const state = await app.install(page);
        if (user !== owner) await page.route('**/api/auth/me', request => request.fulfill({ json: { user } }));
        if (route === '/dashboard/resources') {
            await page.route('**/api/subregions', request => request.fulfill({
                json: [{ id: 91263, name: 'Fictional postal coverage', postalCodeCount: 1, postalCodesList: ['012345'] }],
            }));
        }
        await page.goto(new URL(route === 'owner' ? '/my-directory/maps/' + app.mapId : route, app.base).href);
        const evidence = await run(page, state);
        assert.deepEqual(state.core.errors, []);
        assert.deepEqual(state.core.unexpectedWrites, []);
        assert.deepEqual(state.writes, []);
        return evidence;
    } finally { await page.close(); }
}

const button = (where, name) => where.getByRole('button', { name, exact: true });
async function applyTextScale(page, scale) {
    await page.evaluate(value => document.documentElement.style.setProperty('--font-scale', value), scale);
}

try {
    browser = await chromium.launch({ headless: true });

    await check('production compact and native CMS at desktop text scales', () => withComponents({ viewport: desktop }, async page => {
        const evidence = [];
        for (const scale of [0.6, 1, 1.1]) {
            await applyTextScale(page, scale);
            await button(page, 'Open confirmation').click();
            const compact = page.getByRole('dialog', { name: 'Confirm fictional change' });
            const compactBox = await readBounds(compact, 480);
            await exposed(button(compact, 'Confirm'));
            await button(compact, 'Cancel').click();
            await button(page, 'Open publication review').click();
            const review = page.getByRole('dialog', { name: 'Review fictional publication' });
            const reviewBox = await readBounds(review, 640);
            assert.equal(await review.evaluate(node => node.matches(':modal')), true);
            assert.equal(await review.getByRole('textbox').evaluate(node => document.activeElement === node), true);
            await exposed(button(review, 'Continue'));
            await page.keyboard.press('Escape');
            await review.waitFor({ state: 'hidden' });
            assert.equal(await button(page, 'Open publication review').evaluate(node => document.activeElement === node), true);
            evidence.push({ scale, compactBox, reviewBox });
        }
        return evidence;
    }));

    for (const { name, viewport, scale, deviceScaleFactor } of smallTreatments) {
        await check('confirmation scroll and spatial keyboard at ' + name,
            () => withComponents({ viewport, deviceScaleFactor }, async page => {
                await applyTextScale(page, scale);
                await page.evaluate(() => document.documentElement.classList.add('high-contrast'));
                await button(page, 'Open confirmation').click();
                const compact = page.getByRole('dialog', { name: 'Confirm fictional change' });
                const compactBox = await readBounds(compact, Math.min(viewport.width - 32, 480));
                await exposed(button(compact, 'Confirm'));
                await button(compact, 'Cancel').click();
                const trigger = button(page, 'Open spatial picker');
                await trigger.click();
                const spatial = page.getByRole('dialog', { name: 'Spatial picker' });
                const spatialBox = await readBounds(spatial, Math.min(800, viewport.width - (viewport.width >= 640 ? 32 : 0)));
                const close = button(spatial, 'Close');
                assert.equal(await close.evaluate(node => document.activeElement === node), true);
                await page.keyboard.press('Shift+Tab');
                assert.equal(await button(spatial, 'Use selection').evaluate(node => document.activeElement === node), true);
                await page.keyboard.press('Shift+Tab');
                const input = spatial.getByRole('textbox', { name: 'Final spatial field' });
                assert.equal((await exposed(input)).focused, true);
                await page.keyboard.press('Escape');
                await spatial.waitFor({ state: 'hidden' });
                assert.equal(await trigger.evaluate(node => document.activeElement === node), true);
                return { compactBox, spatialBox, focusRestored: true, dpr: await page.evaluate(() => devicePixelRatio) };
            }));
    }

    await check('production mobile sheet with simulated keyboard viewport shrink', () => withComponents({
        viewport: phone, isMobile: true, hasTouch: true,
    }, async page => {
        await button(page, 'Open mobile sheet').tap();
        const sheet = page.getByRole('dialog', { name: 'Mobile controls' });
        await sheet.waitFor();
        await page.waitForFunction(() => document.querySelector('[data-vaul-drawer]')?.getBoundingClientRect().bottom <= innerHeight + 1);
        const initial = await readBounds(sheet, 390);
        const input = sheet.getByRole('textbox', { name: 'Final sheet field' });
        await input.fill('Fixture note');
        await page.setViewportSize({ width: 390, height: 340 });
        const shrunken = await readBounds(sheet, 390);
        assert.ok(shrunken.height <= 340 * 0.86 + 1, JSON.stringify(shrunken));
        assert.equal((await exposed(input)).focused, true);
        assert.equal(await input.inputValue(), 'Fixture note');
        await exposed(button(sheet, 'Close sheet'));
        await button(sheet, 'Apply sheet').tap();
        await sheet.waitFor({ state: 'hidden' });
        return { initial, shrunken, inputStayedFocused: true };
    }));

    await check('actual Create Map and short-phone Saved form', () => withApp({ viewport: desktop }, '/my-directory?section=my-maps', async page => {
        await button(page, 'Create map').click();
        const dialog = page.getByRole('dialog');
        const desktopBox = await readBounds(dialog, 1120);
        const submit = page.getByTestId('create-map-submit');
        await exposed(submit);
        await page.setViewportSize({ width: 320, height: 340 });
        const phoneBox = await readBounds(dialog, 320);
        const input = page.locator('#create-map-name');
        await input.fill('Fictional Care Map');
        assert.equal((await exposed(input)).focused, true);
        await exposed(submit);
        await button(dialog, 'Close').click();
        await dialog.waitFor({ state: 'hidden' });
        return { desktopBox, phoneBox, nameHadFocus: true };
    }));

    await check('actual Within-area search and sticky actions at short heights', () => withApp({ viewport: desktop }, 'owner', async page => {
        await button(page, 'Manage resources').click();
        await page.getByRole('tab', { name: 'Within area' }).click();
        await page.locator('[data-map-area-choice]').selectOption('preview-circle');
        const dialog = page.getByRole('dialog');
        const workspace = dialog.locator('[data-map-area-workspace]');
        const search = workspace.getByRole('searchbox');
        await search.waitFor();
        const evidence = [];
        for (const viewport of [{ width: 844, height: 390 }, { width: 390, height: 340 }]) {
            await page.setViewportSize(viewport);
            const panel = await readBounds(dialog, viewport.width - (viewport.width >= 640 ? 32 : 0));
            await search.evaluate(node => node.scrollIntoView({ block: 'start' }));
            await search.fill('programme');
            const field = await exposed(search);
            assert.equal(field.focused, true);
            const footer = await exposed(workspace.locator('[data-map-area-save-add]'));
            await exposed(button(dialog, 'Close'));
            const scrollOwners = await workspace.evaluate(node => [node, ...node.querySelectorAll('*')]
                .filter(child => getComputedStyle(child).overflowY === 'auto' && child.scrollHeight > child.clientHeight + 1)
                .map(child => child === node ? 'workspace' : child.tagName));
            assert.deepEqual(scrollOwners, ['workspace']);
            evidence.push({ viewport, panel, field, footer, scrollOwners });
        }
        await search.press('Escape');
        await dialog.waitFor({ state: 'hidden' });
        return evidence;
    }));

    await check('actual Resources Create and nested wizard preview', () => withApp({ viewport: desktop }, '/dashboard/resources', async page => {
        await button(page, 'New Place').click();
        const heading = page.getByRole('heading', { name: 'Create Place', exact: true });
        const outerPanel = heading.locator('xpath=../../..');
        const choice = await readBounds(outerPanel, 800);
        await page.getByRole('button', { name: /Manual entry/i }).click();
        const previewTrigger = page.getByRole('button', { name: /Preview/, exact: false });
        await previewTrigger.waitFor();
        const author = await readBounds(outerPanel, 1280);
        await previewTrigger.click();
        const preview = page.getByRole('dialog', { name: /preview/i });
        const previewBox = await readBounds(preview.locator('> div').first());
        assert.ok(previewBox.width > 1024 && previewBox.width <= 1280, JSON.stringify(previewBox));
        await preview.locator('button').first().click();
        await preview.waitFor({ state: 'hidden' });
        await page.setViewportSize({ width: 390, height: 340 });
        const authorPhone = await readBounds(outerPanel, 358);
        await exposed(page.getByRole('button', { name: /Save Place/i }));
        await previewTrigger.click();
        const previewPhone = await readBounds(preview.locator('> div').first());
        assert.ok(previewPhone.width > 300 && previewPhone.width < authorPhone.width, JSON.stringify(previewPhone));
        await preview.locator('button').first().click();
        await preview.waitFor({ state: 'hidden' });
        await button(outerPanel, 'Cancel').click();
        await outerPanel.waitFor({ state: 'hidden' });
        return { choice, author, previewBox, authorPhone, previewPhone };
    }, { ...owner, role: 'admin' }));

    await check('actual 200% Chromium browser zoom', async () => {
        await startComponents();
        const extension = path.join(out, 'zoom-extension');
        await fs.mkdir(extension, { recursive: true });
        await fs.writeFile(path.join(extension, 'manifest.json'), JSON.stringify({
            name: 'Local browser zoom fixture', version: '1.0', manifest_version: 3,
            permissions: ['tabs'], background: { service_worker: 'worker.js' },
        }));
        await fs.writeFile(path.join(extension, 'worker.js'), 'chrome.runtime.onInstalled.addListener(() => {});');
        const context = await chromium.launchPersistentContext(path.join(out, 'zoom-profile'), {
            channel: 'chromium', headless: true, viewport: desktop, serviceWorkers: 'allow',
            args: ['--disable-extensions-except=' + extension, '--load-extension=' + extension],
        });
        try {
            const page = context.pages()[0];
            const errors = await prepareLocalPage(page);
            const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 6000 });
            await button(page, 'Open spatial picker').click();
            const spatial = page.getByRole('dialog', { name: 'Spatial picker' });
            const before = await readBounds(spatial, 800);
            const actualZoom = await worker.evaluate(async url => {
                const [tab] = await chrome.tabs.query({ url });
                await chrome.tabs.setZoom(tab.id, 2);
                return chrome.tabs.getZoom(tab.id);
            }, page.url());
            assert.equal(actualZoom, 2);
            await page.waitForFunction(() => innerWidth <= 720 && devicePixelRatio === 2);
            const after = await readBounds(spatial, 688);
            await exposed(button(spatial, 'Close'));
            await page.keyboard.press('Escape');
            await spatial.waitFor({ state: 'hidden' });
            assert.deepEqual(errors, []);
            return { actualZoom, before, after, dpr: await page.evaluate(() => devicePixelRatio) };
        } finally { await context.close(); }
    });
} catch (error) {
    report.failure = error.stack;
} finally {
    await browser?.close();
    await app?.server.close();
    await componentServer?.close();
    report.sourceAfter = await sourceFingerprint();
    report.sourceUnchanged = JSON.stringify(report.sourceBefore) === JSON.stringify(report.sourceAfter);
    report.summary = {
        passed: report.cases.filter(c => c.passed).length,
        failed: report.cases.filter(c => !c.passed).length,
    };
    if (!report.cases.length || report.summary.failed || report.failure || !report.sourceUnchanged) process.exitCode = 1;
    await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ out, summary: report.summary, failure: report.failure, sourceUnchanged: report.sourceUnchanged }));
}
