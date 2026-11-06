// Actual App and annotation hook, with fictional APIs and synthetic imagery.
// node tests/browser/care-map-annotation-compatibility.mjs [--out=PATH]
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { fingerprint, startFixture } from '../fixtures/care-map-floating-canvas/runtime.mjs';
import { owner } from '../fixtures/care-map-floating-canvas/data.mjs';
import { createPrintAnnotation, getAnnotationLocalDraftKey } from '../../client/src/lib/printAnnotations.js';
import { supportsCurrentAnnotationWrites } from '../../shared/annotationWriteCompatibility.js';

const out = process.argv.find(value => value.startsWith('--out='))?.slice(6)
    || await fs.mkdtemp(path.join(os.tmpdir(), 'care-map-annotation-compatibility-'));
await fs.mkdir(out, { recursive: true });
const report = { boundary: 'Local actual App with fictional records/intercepted APIs/synthetic pixels. Storage-quota and downlevel-Worker responses are simulated. No production or physical-device acceptance.',
    sourceBefore: await fingerprint(), cases: [], errors: [], unexpectedWrites: [] };
let browser, fixture, page;
const shape = index => ({ ...createPrintAnnotation({ type: 'rectangle',
    points: [[1.37 + index % 10 * .0001, 103.74], [1.371 + index % 10 * .0001, 103.741]],
    text: `Fictional saved area ${index}` }), id: `compat-area-${index}` });
const until = async (fn, message) => {
    const start = Date.now();
    while (Date.now() - start < 10000) {
        if (await fn()) return;
        await new Promise(resolve => setTimeout(resolve, 40));
    }
    throw new Error(message);
};
async function check(name, action) {
    try { report.cases.push({ name, passed: true, evidence: await action() }); }
    catch (error) { report.cases.push({ name, passed: false, error: error.message }); throw error; }
}
async function open(annotations, { legacyDraft = null, quota = false } = {}) {
    const current = page = await browser.newPage({ viewport: { width: 1470, height: 801 } });
    const state = await fixture.install(current, { annotations, annotationWriteCounts: [annotations.length] });
    // The owner session is fictional; the unrelated optional sign-in SDK must
    // also remain offline during this storage/write-compatibility check.
    await current.route('https://accounts.google.com/gsi/client', route => route.fulfill({ body: '', contentType: 'application/javascript' }));
    state.allowAnnotationWrites = true;
    const storageKey = getAnnotationLocalDraftKey(owner.id, fixture.mapId);
    if (legacyDraft) await current.addInitScript(({ storageKey, raw, quota }) => {
        localStorage.setItem(storageKey, raw);
        if (quota) {
            const original = Storage.prototype.setItem;
            Storage.prototype.setItem = function (key, value) {
                if (String(key).startsWith(`${storageKey}:preserved-legacy-draft`)) throw new DOMException('Fictional quota failure', 'QuotaExceededError');
                return original.call(this, key, value);
            };
        }
    }, { storageKey, raw: legacyDraft, quota });
    return { page: current, state, storageKey };
}
async function load(current) {
    await current.goto(new URL(`/my-directory/maps/${fixture.mapId}`, fixture.base).href);
    await current.locator('[data-owner-canvas-enter]').waitFor();
    await until(() => current.evaluate(() => Boolean(window.__qaEditorState?.annotationCount)), 'annotations were not loaded');
}
async function studio(current) {
    await current.locator('[data-owner-canvas-enter]').click();
    await current.locator('[data-owner-canvas-tool="studio"]').click();
    await current.locator('[data-map-studio-annotation-layers]>summary').click();
    const manager = current.locator('[data-annotation-layer-manager]');
    await manager.locator('[data-annotation-select-all]').check();
    await manager.locator('[data-annotation-group-selected]').click();
    return manager;
}
async function unmountOwner(current) {
    const previous = await current.evaluate(() => window.__qaPageEvents.filter(event => event.type === 'unmount').length);
    await current.evaluate(() => { history.pushState(null, '', '/privacy'); dispatchEvent(new PopStateEvent('popstate')); });
    await until(() => current.evaluate(count => window.__qaPageEvents.filter(event => event.type === 'unmount').length > count, previous), 'owner page did not unmount');
}
async function finish(current, state) {
    report.errors.push(...state.errors);
    report.unexpectedWrites.push(...state.unexpectedWrites);
    assert.deepEqual(state.errors, []);
    assert.deepEqual(state.unexpectedWrites, []);
    assert.deepEqual(state.blockedExternal, []);
    await current.close();
}
try {
    fixture = await startFixture(out);
    browser = await chromium.launch({ headless: true });
    await check('unchanged legacy100 map restores its same-revision local draft and saves through the original queue', async () => {
        const annotations = Array.from({ length: 100 }, (_, index) => shape(index));
        const local = structuredClone(annotations); local[0].text = 'Fictional legacy local edit';
        const raw = JSON.stringify({ schemaVersion: 1, baseRevision: 1, annotations: local });
        const { page: current, state, storageKey } = await open(annotations, { legacyDraft: raw });
        await load(current);
        await current.locator('[data-annotation-shape-text]').filter({ hasText: 'Fictional legacy local edit' }).waitFor({ state: 'attached' });
        assert.equal(await current.locator('[data-annotation-shape-text]').filter({ hasText: 'Fictional legacy local edit' }).count(), 1);
        assert.equal(state.allowedWrites.length, 0);
        await current.locator('[data-owner-canvas-enter]').click();
        await current.locator('[data-owner-canvas-tool="draw"]').click();
        await until(() => state.allowedWrites.length === 1, 'restored legacy draft did not autosave on editing');
        assert.deepEqual(state.annotations, local);
        assert.equal(state.annotationRevision, 2);
        await until(() => current.evaluate(key => localStorage.getItem(key) === null, storageKey), 'successful legacy save did not finish draft cleanup');
        await finish(current, state);
        return { restoredAnnotations: 100, explicitEditorEntry: true, saves: 1, revision: 2 };
    });
    for (const kind of ['expanded', 'grouped', 'quota']) {
        await check(`legacy draft against ${kind} map stays exact and cannot truncate its saved annotations`, async () => {
            const annotations = Array.from({ length: kind === 'grouped' ? 2 : 200 }, (_, index) => shape(index));
            if (kind === 'grouped') annotations[0].groupName = 'Fictional saved group';
            const legacy = annotations.slice(0, 100).map(({ groupName, ...annotation }) => { void groupName; return annotation; });
            legacy[0].text = 'Fictional old local draft';
            const raw = JSON.stringify({ schemaVersion: 1, baseRevision: 1, annotations: legacy,
                unknownOldField: 'retain exact\nbytes' }, null, 2);
            const { page: current, state, storageKey } = await open(annotations, { legacyDraft: raw, quota: kind === 'quota' });
            await load(current);
            await current.waitForTimeout(1100);
            assert.equal(await current.evaluate(() => window.__qaEditorState.annotationCount), annotations.length);
            assert.deepEqual(state.annotations, annotations);
            assert.equal(state.allowedWrites.length, 0);
            const stored = await current.evaluate(key => ({ primary: localStorage.getItem(key), backup: localStorage.getItem(`${key}:preserved-legacy-draft`) }), storageKey);
            if (kind === 'quota') { assert.equal(stored.primary, raw); assert.equal(stored.backup, null); }
            else { assert.equal(stored.primary, raw); assert.equal(stored.backup, raw); }
            await unmountOwner(current);
            assert.equal(await current.evaluate(key => localStorage.getItem(key), storageKey), raw,
                'loading and unmount without an edit must never remove the original draft');
            await current.evaluate(mapId => { history.pushState(null, '', `/my-directory/maps/${mapId}`); dispatchEvent(new PopStateEvent('popstate')); }, fixture.mapId);
            await current.locator('[data-owner-canvas-enter]').waitFor();
            await until(() => current.evaluate(count => window.__qaEditorState.annotationCount === count, annotations.length), 'saved annotations did not return on owner remount');
            const manager = await studio(current);
            await manager.getByRole('combobox', { name: 'Group name', exact: true }).fill('Fictional recovered group');
            await manager.locator('[data-annotation-group-apply]').click();
            await until(() => state.allowedWrites.length === 1, 'explicit current-client group save did not persist');
            await manager.getByRole('status').filter({ hasText: 'Group saved.' }).waitFor();
            assert.equal(state.annotations.length, annotations.length);
            assert.ok(state.annotations.every(annotation => annotation.groupName === 'Fictional recovered group'));
            assert.deepEqual(state.annotations.map(({ groupName, ...annotation }) => { void groupName; return annotation; }), annotations.map(({ groupName, ...annotation }) => { void groupName; return annotation; }));
            const afterSave = await current.evaluate(key => ({ primary: localStorage.getItem(key), backup: localStorage.getItem(`${key}:preserved-legacy-draft`) }), storageKey);
            assert.equal(kind === 'quota' ? afterSave.primary : afterSave.backup, raw);
            await unmountOwner(current);
            const retained = await current.evaluate(({ key, quota }) => localStorage.getItem(quota ? key : `${key}:preserved-legacy-draft`), { key: storageKey, quota: kind === 'quota' });
            assert.equal(retained, raw, 'successful-save cleanup and unmount must preserve the original legacy bytes');
            await finish(current, state);
            return { savedCount: annotations.length, unintendedAutosaves: 0, exactLegacyBytesRetained: true,
                quotaFailure: kind === 'quota', deliberateRemoteSaves: 1, retainedAfterSaveAndUnmount: true };
        });
    }
    await check('downlevel Worker group stripping cannot claim Saved and a later canonical Retry uses its acknowledged revision', async () => {
        const annotations = [shape(0), shape(1)], { page: current, state, storageKey } = await open(annotations);
        const writes = []; let downlevel = true;
        await current.route(`**/api/my-maps/${fixture.mapId}/print-annotations`, async route => {
            const request = route.request();
            if (request.method() !== 'PUT') return route.fallback();
            const body = request.postDataJSON();
            assert.equal(body.revision, state.annotationRevision);
            assert.equal(supportsCurrentAnnotationWrites(body.clientCapabilities), true);
            state.annotations = downlevel ? body.annotations.map(({ groupName, ...annotation }) => { void groupName; return annotation; }) : structuredClone(body.annotations);
            state.annotationRevision += 1;
            writes.push({ requestedRevision: body.revision, acknowledgedRevision: state.annotationRevision, strippedGroups: downlevel });
            return route.fulfill({ json: { mapId: fixture.mapId, schemaVersion: 1, revision: state.annotationRevision, annotations: state.annotations } });
        });
        await load(current);
        const manager = await studio(current);
        await manager.getByRole('combobox', { name: 'Group name', exact: true }).fill('Fictional retained group');
        await manager.locator('[data-annotation-group-apply]').click();
        await manager.getByRole('alert').waitFor();
        assert.equal(writes.length, 1);
        assert.equal(await current.locator('[data-owner-canvas-save]').getAttribute('data-owner-canvas-save'), 'failed');
        const draft = JSON.parse(await current.evaluate(key => localStorage.getItem(key), storageKey));
        assert.equal(draft.baseRevision, 2);
        assert.equal(supportsCurrentAnnotationWrites(draft.clientCapabilities), true);
        assert.ok(draft.annotations.every(annotation => annotation.groupName === 'Fictional retained group'));
        assert.equal(draft.annotations.length, 2);
        assert.deepEqual(state.annotations, annotations);
        downlevel = false;
        await manager.getByRole('button', { name: 'Retry saving group', exact: true }).click();
        await manager.getByRole('status').filter({ hasText: 'Group saved.' }).waitFor();
        await until(() => current.locator('[data-owner-canvas-save]').getAttribute('data-owner-canvas-save').then(value => value === 'saved'), 'canonical Retry did not become Saved');
        assert.equal(writes.length, 2);
        assert.deepEqual(writes.map(write => write.requestedRevision), [1, 2]);
        assert.ok(state.annotations.every(annotation => annotation.groupName === 'Fictional retained group'));
        assert.deepEqual(state.annotations.map(({ groupName, ...annotation }) => { void groupName; return annotation; }), annotations);
        assert.equal(await current.evaluate(key => localStorage.getItem(key), storageKey), null);
        await current.screenshot({ path: path.join(out, 'compatibility-recovered.png') });
        await finish(current, state);
        return { downlevelAckRemainedUnsaved: true, retainedDraftAndRevision: true, writes, successfulRetry: true };
    });
} catch (error) {
    report.failure = error.stack; process.exitCode = 1;
    if (page && !page.isClosed()) {
        await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
        await fs.writeFile(path.join(out, 'failure-dom.txt'), await page.locator('body').innerText()).catch(() => {});
    }
} finally {
    report.sourceAfter = await fingerprint();
    report.sourceChanged = JSON.stringify(report.sourceBefore) !== JSON.stringify(report.sourceAfter);
    if (report.sourceChanged) { report.failure ||= 'Source changed during checks'; process.exitCode = 1; }
    await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    await browser?.close(); await fixture?.server.close();
    console.log(JSON.stringify({ out, passed: report.cases.filter(row => row.passed).length, total: report.cases.length, failure: report.failure || null }));
}
