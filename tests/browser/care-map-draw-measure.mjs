// Local actual-App/Leaflet proof; fictional annotations and intercepted APIs only.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { startFixture, fingerprint } from '../fixtures/care-map-floating-canvas/runtime.mjs';
import { createAnnotations } from '../fixtures/care-map-floating-canvas/data.mjs';
import { createPrintAnnotation } from '../../client/src/lib/printAnnotations.js';

const out = process.argv.find(value => value.startsWith('--out='))?.slice(6)
    || await fs.mkdtemp(path.join(os.tmpdir(), 'care-map-draw-measure-'));
await fs.mkdir(out, { recursive: true });
const report = { boundary: 'Actual App/Leaflet with fictional 199/200 annotations, in-memory APIs and synthetic map pixels. Only saved circle creation and its Undo/Redo may write the fictional annotation endpoint. Scripted browser input is not physical-device or production acceptance.',
    sourceBefore: await fingerprint(), cases: [] };
let fixture, browser, page, state;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function wait(fn, message, ms = 10000) {
    const start = Date.now();
    while (Date.now() - start < ms) { if (await fn()) return; await sleep(40); }
    throw new Error(message);
}
async function read() {
    return page.evaluate(() => {
        const map = [...window.__qaMaps].find(value => value.getContainer().isConnected
            && value.getContainer().getBoundingClientRect().width > 0);
        return { zoom: map?.getZoom(), controlled: map ? window.__qaControlledInputs.get(map)?.zoom : null,
            active: map ? window.__qaMapGestureActive.get(map)?.() : null,
            mapIndex: [...window.__qaMaps].indexOf(map), dragging: map?.dragging.enabled(),
            cursor: map?.getContainer().style.cursor, editor: window.__qaEditorState,
            editorEvents: window.__qaEditorEvents, studioEvents: window.__qaStudioEvents,
            panel: document.querySelector('[data-owner-editing-canvas]')?.dataset.ownerCanvasPanel,
            canvas: Boolean(document.querySelector('[data-owner-canvas-active="true"]')),
            tiles: [...(map?.getContainer().querySelectorAll('.leaflet-tile-pane img,.leaflet-image-layer') || [])]
                .filter(image => image.complete && image.naturalWidth).length };
    });
}
async function settle() {
    await wait(async () => { const value = await read(); return !value.active && value.tiles > 0
        && Math.abs(value.zoom - value.controlled) < .001; }, 'camera did not settle');
    await sleep(100); return read();
}
async function check(name, fn) {
    try { report.cases.push({ name, passed: true, evidence: await fn() }); }
    catch (error) { report.cases.push({ name, passed: false, error: error.message }); throw error; }
}
function annotationsAt(count) {
    const annotations = createAnnotations();
    while (annotations.length < count) annotations.push(createPrintAnnotation({ type: 'circle',
        points: [[1.342 + Math.floor((annotations.length - 97) / 12) * .004, 103.727 + ((annotations.length - 97) % 12) * .004], [1.343 + Math.floor((annotations.length - 97) / 12) * .004, 103.727 + ((annotations.length - 97) % 12) * .004]],
        text: `Fictional capacity circle ${annotations.length + 1}` }));
    return annotations;
}
async function open(count) {
    page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    state = await fixture.install(page, { annotations: annotationsAt(count), annotationWriteCounts: [199, 200] });
    await page.goto(new URL(`/my-directory/maps/${fixture.mapId}`, fixture.base).href);
    await page.locator('[data-owner-canvas-enter]').waitFor(); await settle();
    await enter(); await page.locator('[data-owner-canvas-tool="draw"]').click();
    await page.locator('[data-annotation-tool-mode]').waitFor();
}
async function enter() {
    await page.locator('[data-owner-canvas-enter]').click();
    await page.locator('[data-owner-canvas-active="true"]').waitFor(); await settle();
}
async function mapPoint(coordinates) {
    return page.evaluate(coordinate => {
        const map = [...window.__qaMaps].find(value => value.getContainer().isConnected
            && value.getContainer().getBoundingClientRect().width > 0);
        const rect = map.getContainer().getBoundingClientRect(), point = map.latLngToContainerPoint(coordinate);
        const x = rect.x + point.x, y = rect.y + point.y, hit = document.elementFromPoint(x, y);
        const graphic = [...map.getContainer().querySelectorAll('svg path')].some(shape => {
            if (!shape.isPointInFill || !shape.getScreenCTM() || shape.getAttribute('fill') === 'none') return false;
            const local = new DOMPoint(x, y).matrixTransform(shape.getScreenCTM().inverse());
            return shape.isPointInFill(local);
        });
        return { x, y, paintedFill: graphic, hitMap: Boolean(hit?.closest('.leaflet-container')),
            hitUi: Boolean(hit?.closest('[data-care-map-gesture-ui],button,input,select,textarea,.leaflet-control')) };
    }, coordinates);
}
async function graphicLabelPoint() {
    return page.evaluate(() => {
        for (const label of document.querySelectorAll('[data-annotation-shape-text]')) {
            const box = label.getBoundingClientRect(), x = box.x + box.width / 2, y = box.y + box.height / 2;
            if (x < 500 || x > innerWidth - 80 || y < 130 || y > innerHeight - 100) continue;
            const hit = document.elementFromPoint(x, y);
            if (hit?.closest('.leaflet-container') && !hit.closest('[data-care-map-gesture-ui],.leaflet-control')) return { x, y, text: label.textContent };
        }
        throw new Error('No exposed geographic annotation label');
    });
}
async function persistentCircle(points) {
    return page.evaluate(coordinates => {
        const map = [...window.__qaMaps].find(value => value.getContainer().isConnected
            && value.getContainer().getBoundingClientRect().width > 0);
        return Object.values(map._layers).filter(layer => typeof layer.getRadius === 'function'
            && layer.getRadius() > 10 && typeof layer.getLatLng === 'function'
            && Math.abs(layer.getLatLng().lat - coordinates[0][0]) < .00003
            && Math.abs(layer.getLatLng().lng - coordinates[0][1]) < .00003).map(layer => ({ radius: layer.getRadius() }));
    }, points);
}
async function finish() {
    assert.deepEqual(state.errors, []); assert.deepEqual(state.unexpectedWrites, []);
    await page.close();
}

try {
    fixture = await startFixture(out); browser = await chromium.launch({ headless: true });
    await open(199);
    const original = structuredClone(state.annotations), originalMap = await read();
    const circlePoints = [[1.385, 103.775], [1.390, 103.790]];
    await check('saved circle at199: first point previews without writing, second point saves one real circle', async () => {
        const draw = page.getByRole('button', { name: 'Draw circle', exact: true });
        assert.equal(await draw.isDisabled(), false); await draw.click();
        const centre = await mapPoint(circlePoints[0]), edge = await mapPoint(circlePoints[1]);
        assert.equal(centre.hitMap, true); assert.equal(centre.hitUi, false); assert.equal(centre.paintedFill, true);
        await page.mouse.click(centre.x, centre.y);
        await wait(async () => (await read()).editor.draftCount === 1, 'saved circle first point did not create a draft');
        await page.mouse.move(edge.x, edge.y); await sleep(120);
        assert.equal(state.allowedWrites.length, 0);
        state.allowAnnotationWrites = true; await page.mouse.click(edge.x, edge.y);
        await wait(() => state.allowedWrites.length === 1, 'saved circle did not autosave');
        assert.equal(state.annotations.length, 200); assert.deepEqual(state.annotations.slice(0, 199), original);
        const circle = state.annotations.at(-1); assert.equal(circle.type, 'circle');
        const layers = await persistentCircle(circle.points); assert.equal(layers.length, 1); assert.ok(layers[0].radius > 1000);
        assert.equal((await read()).editor.selectedId, circle.id);
        return { firstPointWrites: 0, completedWrites: 1, count: 200, circle: { type: circle.type, radius: layers[0].radius }, paintedFill: true };
    });
    const saved = structuredClone(state.annotations);
    await check('Undo and Redo retain all199 prior annotations and restore the identical saved circle', async () => {
        await page.getByRole('button', { name: 'Undo', exact: true }).click();
        await wait(() => state.allowedWrites.length === 2, 'Undo did not save'); assert.deepEqual(state.annotations, original);
        await page.getByRole('button', { name: 'Redo', exact: true }).click();
        await wait(() => state.allowedWrites.length === 3, 'Redo did not save'); assert.deepEqual(state.annotations, saved);
        state.allowAnnotationWrites = false;
        assert.equal((await read()).mapIndex, originalMap.mapIndex);
        assert.deepEqual((await read()).editorEvents, originalMap.editorEvents);
        return { explicitWrites: 3, priorAnnotationsUntouched: 199, sameMap: true, sameEditor: true };
    });
    await check('saved circle survives ordinary local reload while full capacity gives explicit feedback', async () => {
        await page.reload(); await page.locator('[data-owner-canvas-enter]').waitFor(); await settle(); await enter();
        await page.locator('[data-owner-canvas-tool="draw"]').click();
        await page.locator('[data-annotation-capacity-notice]').waitFor();
        assert.match(await page.locator('[data-annotation-capacity-notice]').innerText(), /200 saved annotation limit/);
        assert.equal(await page.getByRole('button', { name: 'Draw circle', exact: true }).isDisabled(), true);
        assert.equal(await page.getByRole('button', { name: 'Select or adjust', exact: true }).isEnabled(), true);
        assert.equal((await persistentCircle(saved.at(-1).points)).length, 1);
        assert.deepEqual(state.annotations, saved); assert.equal(state.allowedWrites.length, 3);
        return { count: 200, creationDisabled: true, selectEnabled: true, persistedCircle: true };
    });
    report.savedCircleWrites = state.allowedWrites; await finish();

    await open(200);
    const hundred = structuredClone(state.annotations), baseline = await read();
    await page.getByRole('button', { name: 'Measure', exact: true }).click();
    await page.getByRole('button', { name: 'Radius', exact: true }).click();
    const label = await graphicLabelPoint();
    await check('temporary radius works over a geographic annotation label at200 with no saved writes', async () => {
        await page.mouse.click(label.x, label.y); await page.mouse.move(label.x + 130, label.y + 35); await sleep(120);
        assert.equal(await page.locator('[data-map-temporary-measurement-label]').count(), 1);
        assert.equal(await page.locator('[data-temporary-measurement-result]').count(), 0);
        assert.equal(state.allowedWrites.length, 0);
        await page.mouse.click(label.x + 130, label.y + 35);
        await page.locator('[data-temporary-measurement-result]').waitFor();
        const result = await page.locator('[data-temporary-measurement-result]').innerText(); assert.match(result, /[\d.]+ (m|km).*Radius/);
        assert.deepEqual(state.annotations, hundred); assert.equal(state.allowedWrites.length, 0);
        assert.equal((await read()).dragging, true, 'finished measurement restores normal panning');
        return { label: label.text, result, count: 200, writes: 0 };
    });
    await check('Escape clears the temporary result before closing the tool panel or canvas', async () => {
        await page.keyboard.press('Escape');
        await wait(async () => await page.locator('[data-map-temporary-measurement-label]').count() === 0, 'Escape did not clear measurement');
        assert.equal((await read()).canvas, true); assert.equal((await read()).panel, 'annotations');
        assert.equal(await page.locator('[data-temporary-measurement-controls]').isVisible(), true);
        return { resultCleared: true, panel: 'annotations', canvasStillOpen: true };
    });
    await check('temporary distance uses two painted map points; ordinary wheel leaves zoom unchanged and Ctrl still zooms', async () => {
        await page.getByRole('button', { name: 'Distance', exact: true }).click();
        const first = await mapPoint([1.385, 103.775]), second = await mapPoint([1.393, 103.79]);
        assert.equal(first.paintedFill, true); assert.equal(second.paintedFill, true);
        await page.mouse.click(first.x, first.y); await page.mouse.click(second.x, second.y);
        await page.locator('[data-temporary-measurement-result]').waitFor();
        const result = await page.locator('[data-temporary-measurement-result]').innerText(); assert.match(result, /Distance/);
        const before = await read(); await page.mouse.move(second.x, second.y); await page.mouse.wheel(0, 80); await sleep(160);
        assert.equal((await read()).zoom, before.zoom);
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: second.x, y: second.y, deltaX: 0, deltaY: -1, modifiers: 2 });
        await cdp.detach(); await sleep(220); const after = await settle();
        assert.ok(Math.abs(after.zoom - before.zoom - .1) < .001);
        assert.deepEqual(state.annotations, hundred); assert.equal(state.allowedWrites.length, 0);
        return { result, ordinaryZoom: before.zoom, ctrlZoom: after.zoom, writes: 0 };
    });
    await check('switching to Studio removes temporary geometry and drawing interaction without remounting the map', async () => {
        await page.locator('[data-owner-canvas-tool="studio"]').click();
        await wait(async () => (await read()).panel === 'studio', 'Studio did not open');
        await wait(async () => await page.locator('[data-map-temporary-measurement-label]').count() === 0, 'measurement remained after panel switch');
        const after = await read(); assert.equal(after.dragging, true); assert.notEqual(after.cursor, 'crosshair');
        assert.equal(after.mapIndex, baseline.mapIndex); assert.deepEqual(after.editorEvents, baseline.editorEvents);
        assert.deepEqual(state.annotations, hundred); assert.equal(state.allowedWrites.length, 0);
        return { cleared: true, normalMapInteraction: true, sameMap: true, writes: 0 };
    });
    await check('Return clears a fresh temporary result and reentry starts in Saved drawings', async () => {
        await page.locator('[data-owner-canvas-tool="draw"]').click();
        await page.getByRole('button', { name: 'Measure', exact: true }).click();
        const first = await mapPoint([1.385, 103.775]), second = await mapPoint([1.393, 103.79]);
        await page.mouse.click(first.x, first.y); await page.mouse.click(second.x, second.y);
        await page.locator('[data-temporary-measurement-result]').waitFor();
        await page.locator('[data-owner-canvas-exit]').click(); await settle();
        assert.equal(await page.locator('[data-map-temporary-measurement-label]').count(), 0);
        await enter(); await page.locator('[data-owner-canvas-tool="draw"]').click();
        assert.equal(await page.getByRole('button', { name: 'Saved drawings', exact: true }).getAttribute('aria-pressed'), 'true');
        assert.equal(await page.locator('[data-temporary-measurement-controls]').count(), 0);
        assert.deepEqual(state.annotations, hundred); assert.equal(state.allowedWrites.length, 0);
        assert.equal((await read()).mapIndex, baseline.mapIndex);
        return { resultCleared: true, savedDrawingMode: true, count: 200, writes: 0 };
    });
    await page.screenshot({ path: path.join(out, 'saved-drawing-capacity.png') });
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
    report.sourceAfter = await fingerprint();
    report.sourceChanged = JSON.stringify(report.sourceBefore) !== JSON.stringify(report.sourceAfter);
    if (report.sourceChanged) { process.exitCode = 1; report.failure ||= 'Source changed during checks'; }
    report.summary = { passed: report.cases.filter(value => value.passed).length, failed: report.cases.filter(value => !value.passed).length };
    await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    await browser?.close(); await fixture?.server.close();
    console.log(JSON.stringify({ out, summary: report.summary, sourceChanged: report.sourceChanged, failure: report.failure }, null, 2));
}
