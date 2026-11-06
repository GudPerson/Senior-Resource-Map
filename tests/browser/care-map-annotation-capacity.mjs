// Local actual App/Leaflet stress proof. All APIs, annotations and pixels are fictional.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { startFixture, fingerprint } from '../fixtures/care-map-floating-canvas/runtime.mjs';
import { createPrintAnnotation } from '../../client/src/lib/printAnnotations.js';

const out = process.argv.find(value => value.startsWith('--out='))?.slice(6)
    || await fs.mkdtemp(path.join(os.tmpdir(), 'care-map-capacity-'));
await fs.mkdir(out, { recursive: true });
const report = { boundary: 'Actual App/Leaflet with fictional99/200 annotations, synthetic pixels and intercepted in-memory APIs. Explicit circle creation/history/order/delete and view visibility writes only. DOM/PNG/PDF structure is not physical-device performance or visual-quality acceptance.', sourceBefore: await fingerprint(), cases: [], downloads: [] };
let fixture, browser, page, state, studioWrites = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function wait(fn, message, ms = 10000) {
    const start = Date.now(); while (Date.now() - start < ms) { if (await fn()) return; await sleep(40); }
    throw new Error(message);
}
async function check(name, fn) {
    try { report.cases.push({ name, passed: true, evidence: await fn() }); }
    catch (error) { report.cases.push({ name, passed: false, error: error.message }); throw error; }
}
function circles(count) {
    return Array.from({ length: count }, (_, index) => {
        const row = Math.floor(index / 20), column = index % 20;
        const centre = [1.35 + row * .004, 103.72 + column * .004];
        return { ...createPrintAnnotation({ type: 'circle', points: [centre, [centre[0] + .0013, centre[1]]], text: `Capacity circle ${index}` }), id: `capacity_${index}` };
    });
}
const mapJs = () => [...window.__qaMaps].find(map => map.getContainer().isConnected && map.getContainer().getBoundingClientRect().width > 0);
async function read() {
    return page.evaluate(() => {
        const map = [...window.__qaMaps].find(value => value.getContainer().isConnected && value.getContainer().getBoundingClientRect().width > 0);
        const frame = map?.getContainer();
        return { zoom: map?.getZoom(), controlled: map ? window.__qaControlledInputs.get(map)?.zoom : null,
            active: map ? window.__qaMapGestureActive.get(map)?.() : null, mapIndex: [...window.__qaMaps].indexOf(map),
            editor: window.__qaEditorState, editorEvents: window.__qaEditorEvents, studioEvents: window.__qaStudioEvents,
            paneCount: map ? Object.keys(map._panes).filter(name => /^print-annotation-capacity_\d+$/.test(name)).length : 0,
            tiles: [...(frame?.querySelectorAll('.leaflet-tile-pane img,.leaflet-image-layer') || [])].filter(image => image.complete && image.naturalWidth).length,
            tier: frame?.closest('[data-fixed-town-surface-tier]')?.getAttribute('data-fixed-town-surface-tier'),
            readout: [...document.querySelectorAll('[aria-label^="Zoom level "]')].find(node => node.getBoundingClientRect().width > 0)?.getAttribute('aria-label'),
            bearing: map?.getBearing?.() || 0 };
    });
}
async function settle(expectedZoom = null, trace = null) {
    let stableSince = null, lastKey = '';
    await wait(async () => {
        const result = await read();
        const key = JSON.stringify([result.zoom, result.controlled, result.active, result.readout, result.tier]);
        if (trace && key !== lastKey) { trace.push({ ...result, at: Date.now() }); lastKey = key; }
        const matches = !result.active && result.tiles > 0 && Math.abs(result.zoom - result.controlled) < .001
            && (expectedZoom === null || (Math.abs(result.zoom - expectedZoom) < .001
                && result.readout === `Zoom level ${Number(expectedZoom.toFixed(1))}`));
        if (!matches) { stableSince = null; return false; }
        stableSince ??= Date.now();
        return Date.now() - stableSince >= 300;
    }, `map camera/paint did not settle${expectedZoom === null ? '' : ` at expected${expectedZoom}`}`);
    return read();
}
async function open(annotations, counts = [annotations.length]) {
    page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
    state = await fixture.install(page, { annotations, annotationWriteCounts: counts }); studioWrites = [];
    await page.route(`**/api/my-maps/${fixture.mapId}/studio`, async route => {
        if (route.request().method() !== 'PUT') return route.fallback();
        const body = route.request().postDataJSON(); assert.equal(body.revision, state.document.revision);
        const before = structuredClone(state.document); state.document = { ...body, revision: body.revision + 1 };
        studioWrites.push({ before, after: structuredClone(state.document) });
        return route.fulfill({ json: { mapId: fixture.mapId, document: state.document, updatedAt: null } });
    });
    await page.goto(new URL(`/my-directory/maps/${fixture.mapId}`, fixture.base).href);
    await page.locator('[data-owner-canvas-enter]').waitFor(); await settle();
    await page.locator('[data-owner-canvas-enter]').click(); await settle();
}
async function point(coordinates) {
    return page.evaluate(coordinate => {
        const map = [...window.__qaMaps].find(value => value.getContainer().isConnected && value.getContainer().getBoundingClientRect().width > 0);
        const box = map.getContainer().getBoundingClientRect(), local = map.latLngToContainerPoint(coordinate);
        return { x: box.x + local.x, y: box.y + local.y };
    }, coordinates);
}
async function addCircle(centre, edge, expectedWrites) {
    await page.getByRole('button', { name: 'Draw circle', exact: true }).click();
    const a = await point(centre), b = await point(edge);
    await page.mouse.click(a.x, a.y); await wait(async () => (await read()).editor.draftCount === 1, 'circle centre did not create a draft');
    await page.mouse.click(b.x, b.y); await wait(() => state.allowedWrites.length === expectedWrites, 'circle did not persist');
}
async function connectedFirstHundred(expectedCount) {
    return page.evaluate(count => {
        const map = [...window.__qaMaps].find(value => value.getContainer().isConnected && value.getContainer().getBoundingClientRect().width > 0);
        return window.__capacityLegacyPanes.slice(0, count).every((pane, index) => pane.isConnected
            && map.getPane(`print-annotation-${window.__capacityLegacyIds[index]}`) === pane
            && pane.style.zIndex === String(450 + index));
    }, expectedCount);
}
async function pinHits() {
    return page.evaluate(() => {
        const map = [...window.__qaMaps].find(value => value.getContainer().isConnected && value.getContainer().getBoundingClientRect().width > 0);
        return Object.values(map._layers).filter(layer => layer.options?.alt?.startsWith('Fictional community place') && layer.getElement?.())
            .map(layer => {
                const element = layer.getElement(), box = element.getBoundingClientRect(), x = box.x + box.width / 2, y = box.y + box.height / 2;
                const hit = document.elementFromPoint(x, y);
                return { title: layer.options.alt, exposed: hit === element || element.contains(hit), x, y,
                    hitPane: hit?.closest('.leaflet-pane')?.className, markerPaneZ: getComputedStyle(map.getPane('markerPane')).zIndex };
            });
    });
}
async function orderingHit(text) {
    return page.evaluate(label => {
        const node = [...document.querySelectorAll('[data-annotation-shape-text]')].find(item => item.textContent === label);
        if (!node) return { missing: true };
        const box = node.getBoundingClientRect(), x = box.x + box.width / 2, y = box.y + box.height / 2, hit = document.elementFromPoint(x, y);
        return { text: hit?.closest('[data-annotation-shape-text]')?.textContent, x, y };
    }, text);
}
async function finish() {
    assert.deepEqual(state.errors, []); assert.deepEqual(state.unexpectedWrites, []);
    // The baseline GoogleAuthProvider can request its optional GIS script even
    // for this fictional signed-in owner. It remains ABORTED by the fixture.
    assert.ok(state.blockedExternal.every(item => item.origin === 'https://accounts.google.com' && item.path === '/gsi/client'));
    report.blockedGoogleSdkRequests = (report.blockedGoogleSdkRequests || 0) + state.blockedExternal.length;
    await page.close();
}

try {
    fixture = await startFixture(out); browser = await chromium.launch({ headless: true });
    await open(circles(99), [99, 100, 101]);
    await page.locator('[data-owner-canvas-tool="draw"]').click();
    await page.getByRole('button', { name: 'Select or adjust', exact: true }).click();
    const thresholdBaseline = await read();
    await page.evaluate(ids => {
        const map = [...window.__qaMaps].find(value => value.getContainer().isConnected && value.getContainer().getBoundingClientRect().width > 0);
        window.__capacityLegacyIds = ids; window.__capacityLegacyPanes = ids.map(id => map.getPane(`print-annotation-${id}`));
    }, state.annotations.map(item => item.id));
    state.allowAnnotationWrites = true;
    await check('99→100→101 retains the original100 pane identities and creates only the additional nested stack', async () => {
        await addCircle([1.39, 103.775], [1.394, 103.78], 1); assert.equal(state.annotations.length, 100); assert.equal(await connectedFirstHundred(99), true);
        await page.evaluate(id => { const map = [...window.__qaMaps].find(value => value.getContainer().isConnected && value.getContainer().getBoundingClientRect().width > 0);
            window.__capacityLegacyIds.push(id); window.__capacityLegacyPanes.push(map.getPane(`print-annotation-${id}`)); }, state.annotations.at(-1).id);
        await addCircle([1.40, 103.785], [1.405, 103.79], 2); assert.equal(state.annotations.length, 101); assert.equal(await connectedFirstHundred(100), true);
        const stack = await page.evaluate(id => { const map = [...window.__qaMaps].find(value => value.getContainer().isConnected && value.getContainer().getBoundingClientRect().width > 0);
            const parent = map.getPane('print-annotation-additional-stack'), child = map.getPane(`print-annotation-${id}`);
            return { rootZ: parent?.style.zIndex, parentCorrect: child?.parentElement === parent, innerZ: child?.style.zIndex }; }, state.annotations.at(-1).id);
        assert.deepEqual(stack, { rootZ: '550', parentCorrect: true, innerZ: '550' });
        assert.equal((await read()).mapIndex, thresholdBaseline.mapIndex); assert.deepEqual((await read()).editorEvents, thresholdBaseline.editorEvents);
        return { count: 101, retainedLegacyPanes: 100, stack, writes: 2, sameMapAndEditor: true };
    });
    await check('Undo101→100 removes the extra stack; Redo101 restores it without replacing the first100 panes', async () => {
        const saved = structuredClone(state.annotations);
        await page.getByRole('button', { name: 'Undo', exact: true }).click(); await wait(() => state.allowedWrites.length === 3, 'threshold Undo did not persist');
        assert.equal(state.annotations.length, 100); assert.equal(await connectedFirstHundred(100), true);
        assert.equal(await page.evaluate(() => { const map = [...window.__qaMaps].find(value => value.getContainer().isConnected && value.getContainer().getBoundingClientRect().width > 0); return Boolean(map.getPane('print-annotation-additional-stack')); }), false);
        await page.getByRole('button', { name: 'Redo', exact: true }).click(); await wait(() => state.allowedWrites.length === 4, 'threshold Redo did not persist');
        assert.deepEqual(state.annotations, saved); assert.equal(await connectedFirstHundred(100), true);
        return { undoCount: 100, redoCount: 101, legacyPanesRetained: 100, explicitWrites: 4 };
    });
    report.thresholdWrites = state.allowedWrites; await finish();

    const mixed = circles(200);
    mixed[100] = { ...createPrintAnnotation({ type: 'pin', points: [[1.374, 103.742]], text: 'Additional pin100' }), id: 'capacity_100' };
    mixed[150] = { ...createPrintAnnotation({ type: 'circle', points: [[1.378, 103.742], [1.384, 103.742]], text: 'Additional circle150' }), id: 'capacity_150' };
    for (const [index, text] of [[196, 'Order pair A'], [197, 'Order pair B']]) mixed[index] = { ...createPrintAnnotation({ type: 'rectangle',
        points: [[1.39, 103.785], [1.40, 103.795]], text }), id: `capacity_${index}` };
    mixed[199] = { ...createPrintAnnotation({ type: 'rectangle', points: [[1.377, 103.737], [1.387, 103.747]], text: 'Additional shape199' }), id: 'capacity_199' };
    await open(mixed, [199, 200]);
    const mixedBaseline = await read();
    await check('all200 mixed annotations render and resource pins remain above extra labels, pins and geographic shapes', async () => {
        const inventory = await page.evaluate(() => {
            const map = [...window.__qaMaps].find(value => value.getContainer().isConnected && value.getContainer().getBoundingClientRect().width > 0);
            return { count: Object.keys(map._panes).filter(name => /^print-annotation-capacity_\d+$/.test(name)).length,
                extras: [100, 150, 199].map(index => { const pane = map.getPane(`print-annotation-capacity_${index}`), geographic = map.getPane(`care-map-geographic-print-annotation-capacity_${index}`);
                    return { index, parentZ: pane.parentElement.style.zIndex, ownZ: pane.style.zIndex, geographicInRotatePane: !geographic || geographic.parentElement === map._rotatePane }; }) };
        });
        assert.equal(inventory.count, 200); assert.ok(inventory.extras.every(item => item.parentZ === '550' && item.geographicInRotatePane));
        const hits = await pinHits(); assert.equal(hits.length, 8); assert.ok(hits.every(item => item.exposed), JSON.stringify(hits));
        return { ...inventory, resourcePins: hits };
    });
    await check('200 annotations at1280x800 retain exact half-step zoom/readout and painted native map at16', async () => {
        // The separately retained100-vs200 counterfactual proves that the
        //1600x1000 footprint receives the same existing14→14.2 containment
        // correction at both counts. This declared supported viewport keeps
        // strict half-step assertions without resetting or forcing the camera.
        await page.setViewportSize({ width: 1280, height: 800 }); await settle(13);
        const values = [];
        report.cameraSteps = [];
        for (let index = 0; index < 6; index++) {
            const before = await settle(), expected = before.zoom + .5, trace = [];
            report.cameraSteps.push({ before: before.zoom, expected, trace });
            await page.getByRole('button', { name: 'Zoom in', exact: true }).click(); values.push((await settle(expected, trace)).zoom);
        }
        const native = await read(); assert.ok(Math.abs(native.zoom - 16) < .001); assert.match(native.readout, /16$/); assert.equal(native.tier, 'native'); assert.ok(native.tiles > 0);
        for (let index = 0; index < 6; index++) {
            const before = await settle(), expected = before.zoom - .5, trace = [];
            report.cameraSteps.push({ before: before.zoom, expected, trace });
            await page.getByRole('button', { name: 'Zoom out', exact: true }).click(); await settle(expected, trace);
        }
        assert.ok(Math.abs((await read()).zoom - 13) < .001); assert.equal(state.allowedWrites.length, 0);
        await page.setViewportSize({ width: 1600, height: 1000 }); await settle(13);
        return { viewport: { width: 1280, height: 800 }, zooms: values, nativeZoom: native.zoom, nativeReadout: native.readout, nativeTiles: native.tiles, returnedZoom: 13, annotationWrites: 0 };
    });
    await check('bearing30 keeps extra annotation geometry aligned once and all resource hit targets exposed', async () => {
        const start = await point([1.40, 103.80]);
        await page.mouse.move(start.x, start.y); await page.mouse.down({ button: 'right' }); await page.mouse.move(start.x + 60, start.y, { steps: 12 }); await page.mouse.up({ button: 'right' });
        await sleep(150); const rotated = await read(); assert.ok(Math.abs(Math.abs(rotated.bearing) - 30) < 1);
        const hits = await pinHits(); assert.equal(hits.length, 8); assert.ok(hits.every(item => item.exposed), JSON.stringify(hits));
        const geometry = await page.evaluate(() => {
            const map = [...window.__qaMaps].find(value => value.getContainer().isConnected && value.getContainer().getBoundingClientRect().width > 0);
            return [150, 199].map(index => { const pane = map.getPane(`care-map-geographic-print-annotation-capacity_${index}`);
                const point = map.latLngToContainerPoint(index === 150 ? [1.378, 103.742] : [1.382, 103.742]); const box = map.getContainer().getBoundingClientRect();
                const path = pane?.querySelector('path'); const local = new DOMPoint(box.x + point.x, box.y + point.y).matrixTransform(path.getScreenCTM().inverse());
                return { index, parentIsRotate: pane.parentElement === map._rotatePane, centreInsideFill: path.isPointInFill(local), transforms: pane.style.transform }; });
        });
        assert.ok(geometry.every(item => item.parentIsRotate && item.centreInsideFill));
        await page.getByRole('button', { name: 'Reset to north', exact: true }).click(); await wait(async () => Math.abs((await read()).bearing) < .001, 'North did not reset');
        return { bearing: rotated.bearing, geometry, exposedResourcePins: 8, annotationWrites: 0 };
    });
    await check('a named view can hide and restore all200 objects without deleting annotations', async () => {
        await page.locator('[data-owner-canvas-tool="studio"]').click();
        await page.locator('[data-map-studio-annotation-layers]>summary').click();
        const manager = page.locator('[data-annotation-layer-manager]'); const all = manager.locator('[data-annotation-group-visibility="ungrouped"]');
        await all.click(); await wait(() => studioWrites.length === 1, 'hide200 did not persist');
        assert.equal(state.document.views[0].design.layers.hiddenAnnotationIds.length, 200);
        await all.click(); await wait(() => studioWrites.length === 2, 'show200 did not persist');
        assert.deepEqual(state.document.views[0].design.layers.hiddenAnnotationIds, []); assert.deepEqual(state.annotations, mixed);
        assert.equal(state.allowedWrites.length, 0);
        return { hiddenIds: 200, restoredIds: 200, studioWrites: 2, annotationWrites: 0, otherViewHiddenIds: state.document.views[1].design.layers.hiddenAnnotationIds };
    });
    await page.locator('[data-owner-canvas-tool="draw"]').click(); state.allowAnnotationWrites = true;
    await check('unique extra ordering survives backward/forward, Undo/Redo and deletion/Undo without portal tie dependence', async () => {
        let hit = await orderingHit('Order pair B'); assert.equal(hit.text, 'Order pair B'); await page.mouse.click(hit.x, hit.y);
        await wait(async () => (await read()).editor.selectedId === 'capacity_197', 'top order-pair annotation was not selected');
        await page.getByRole('button', { name: 'Send backward', exact: true }).click(); await wait(() => state.allowedWrites.length === 1, 'backward did not persist');
        assert.equal((await orderingHit('Order pair A')).text, 'Order pair A');
        await page.getByRole('button', { name: 'Bring forward', exact: true }).click(); await wait(() => state.allowedWrites.length === 2, 'forward did not persist');
        assert.equal((await orderingHit('Order pair B')).text, 'Order pair B'); assert.deepEqual(state.annotations, mixed);
        await page.getByRole('button', { name: 'Undo', exact: true }).click(); await wait(() => state.allowedWrites.length === 3, 'order Undo did not persist');
        assert.equal((await orderingHit('Order pair A')).text, 'Order pair A');
        await page.getByRole('button', { name: 'Redo', exact: true }).click(); await wait(() => state.allowedWrites.length === 4, 'order Redo did not persist');
        assert.equal((await orderingHit('Order pair B')).text, 'Order pair B');
        await page.getByRole('button', { name: 'Delete annotation', exact: true }).click(); await wait(() => state.allowedWrites.length === 5, 'delete did not persist'); assert.equal(state.annotations.length, 199);
        await page.getByRole('button', { name: 'Undo', exact: true }).click(); await wait(() => state.allowedWrites.length === 6, 'delete Undo did not persist'); assert.deepEqual(state.annotations, mixed);
        assert.equal((await orderingHit('Order pair B')).text, 'Order pair B');
        assert.equal((await read()).mapIndex, mixedBaseline.mapIndex); assert.deepEqual((await read()).editorEvents, mixedBaseline.editorEvents);
        state.allowAnnotationWrites = false;
        return { intentionalAnnotationWrites: 6, original200Restored: true, exactOrderingHits: true, sameMapAndEditor: true };
    });
    report.mixedWrites = state.allowedWrites;
    await check('Export retains all200 annotation IDs and produces valid PNG/PDF downloads', async () => {
        await page.locator('[data-owner-canvas-exit]').click();
        await page.getByRole('button', { name: 'Export View', exact: true }).click();
        await page.locator('[data-print-export-readiness="ready"]').waitFor({ timeout: 45000 });
        const inventories = await page.evaluate(ids => [...window.__qaMaps].filter(map => map.getContainer().isConnected).map(map => ({
            visible: map.getContainer().getBoundingClientRect().width > 0,
            count: ids.filter(id => map.getPane(`print-annotation-${id}`)?.isConnected).length,
            stackZ: map.getPane('print-annotation-additional-stack')?.style.zIndex,
        })).filter(item => item.count > 0), state.annotations.map(item => item.id));
        assert.ok(inventories.length >= 1); assert.ok(inventories.every(item => item.count === 200 && item.stackZ === '550'), JSON.stringify(inventories));
        for (const [name, file, signature] of [['Save Map PNG', '200-annotations.png', 'PNG'], ['Save PDF', '200-annotations.pdf', '%PDF']]) {
            const pending = page.waitForEvent('download', { timeout: 45000 }); await page.getByRole('button', { name, exact: true }).click();
            const download = await pending, target = path.join(out, file); await download.saveAs(target);
            const bytes = await fs.readFile(target); assert.ok(bytes.subarray(0, 8).toString('latin1').includes(signature));
            report.downloads.push({ file, bytes: bytes.length, signature });
        }
        assert.deepEqual(state.annotations, mixed); assert.equal(state.allowedWrites.length, 6);
        return { inventories, downloads: report.downloads, savedCount: 200, additionalAnnotationWrites: 0 };
    });
    await finish();

    await open(circles(200));
    await check('200 saved circles render400 SVG paths and200 radius guides without a product256 truncation', async () => {
        const counts = await page.evaluate(() => {
            const map = [...window.__qaMaps].find(value => value.getContainer().isConnected && value.getContainer().getBoundingClientRect().width > 0);
            return { annotationPanes: Object.keys(map._panes).filter(name => /^print-annotation-capacity_\d+$/.test(name)).length,
                paths: Object.entries(map._panes).filter(([name]) => /^care-map-geographic-print-annotation-capacity_\d+$/.test(name)).reduce((sum, [, pane]) => sum + pane.querySelectorAll('path').length, 0),
                radiusLabels: map.getContainer().querySelectorAll('[data-map-radius-label]').length,
                textLabels: map.getContainer().querySelectorAll('[data-annotation-shape-text]').length };
        });
        assert.deepEqual(counts, { annotationPanes: 200, paths: 400, radiusLabels: 200, textLabels: 200 });
        assert.equal(state.allowedWrites.length, 0); assert.equal((await read()).paneCount, 200);
        await page.screenshot({ path: path.join(out, '200-circles.png') });
        return { ...counts, annotationWrites: 0, physicalPerformanceClaim: false };
    });
    await finish();
} catch (error) {
    report.failure = error.stack; process.exitCode = 1;
    if (page && !page.isClosed()) {
        report.failureState = await read().catch(() => null); report.errors = state?.errors; report.unexpectedWrites = state?.unexpectedWrites;
        await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
        await fs.writeFile(path.join(out, 'failure-dom.txt'), await page.locator('body').innerText()).catch(() => {});
    }
    console.error(error.stack);
} finally {
    report.sourceAfter = await fingerprint(); report.sourceChanged = JSON.stringify(report.sourceBefore) !== JSON.stringify(report.sourceAfter);
    if (report.sourceChanged) { report.failure ||= 'Source changed during checks'; process.exitCode = 1; }
    report.summary = { passed: report.cases.filter(item => item.passed).length, failed: report.cases.filter(item => !item.passed).length };
    await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    await browser?.close(); await fixture?.server.close();
    console.log(JSON.stringify({ out, summary: report.summary, sourceChanged: report.sourceChanged, failure: report.failure }, null, 2));
}
