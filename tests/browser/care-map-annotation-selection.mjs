// Actual App/router. Every map, annotation, pixel and write is fictional.
// node tests/browser/care-map-annotation-selection.mjs [--out=PATH]
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { startFixture, fingerprint } from '../fixtures/care-map-floating-canvas/runtime.mjs';
import { createAnnotations } from '../fixtures/care-map-floating-canvas/data.mjs';
import { createPrintAnnotation } from '../../client/src/lib/printAnnotations.js';

const out = process.argv.find(value => value.startsWith('--out='))?.slice(6)
    || await fs.mkdtemp(path.join(os.tmpdir(), 'care-map-annotation-selection-'));
await fs.mkdir(out, { recursive: true });
const report = { boundary: 'Local actual App/router with100 fictional annotations, intercepted APIs and synthetic pixels. Deliberate group/visibility writes affect in-memory fixtures only. No production, physical-device or exported-image quality claim.',
    sourceBefore: await fingerprint(), cases: [], errors: [], unexpectedWrites: [] };
let fixture, browser, page, state, manager;
const studioWrites = [], annotationRequests = [];
async function check(name, action) {
    try { report.cases.push({ name, passed: true, evidence: await action() }); }
    catch (error) { report.cases.push({ name, passed: false, error: error.message }); throw error; }
}
async function until(fn, message, timeout = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (await fn()) return;
        await new Promise(resolve => setTimeout(resolve, 40));
    }
    throw Error(message);
}
const hidden = () => [...state.document.views[0].design.layers.hiddenAnnotationIds].sort();
const search = () => manager.getByRole('searchbox', { name: 'Search annotations', exact: true });
const type = () => manager.getByRole('combobox', { name: 'Type', exact: true });
const group = () => manager.getByRole('combobox', { name: 'Group', exact: true });
const count = async () => { const value = (await manager.locator('[data-annotation-selection-count]').textContent())?.match(/\d+/); return value ? Number(value[0]) : null; };
const all = () => manager.locator('[data-annotation-select-all]');
const clear = () => manager.locator('[data-annotation-selection-clear]');
const name = () => manager.getByRole('combobox', { name: 'Group name', exact: true });
const apply = () => manager.locator('[data-annotation-group-apply]');
const row = id => manager.locator('[data-annotation-layer-item="' + id + '"]');
const eye = id => manager.locator('[data-annotation-visibility="' + id + '"]');
const groupEye = value => manager.locator('[data-annotation-group-visibility="group:' + value + '"]');
async function resetFilters() { await search().fill(''); await type().selectOption('all'); await group().selectOption('all'); }
async function expandGroups() {
    for (const toggle of await manager.locator('[data-annotation-group-toggle]').all()) {
        if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
    }
}
async function selectIds(ids, annotations) {
    if (await count()) await clear().click();
    await resetFilters();
    for (const id of ids) {
        await search().fill(annotations.find(item => item.id === id).text);
        await expandGroups();
        await row(id).getByRole('checkbox').check();
    }
}
async function openGroupForm() { await manager.locator('[data-annotation-group-selected]').click(); }
async function saveGroup(value, nextWrites) {
    await openGroupForm(); await name().fill(value); await apply().click();
    await until(() => state.allowedWrites.length === nextWrites, 'group save did not persist');
    await until(async () => await count() === 0, 'successful group acknowledgement did not clear completed selection');
}
async function lowerInspector() {
    const outer = page.locator('[data-map-studio-owner-panel][data-map-studio-canvas="true"]'); const box = await outer.boundingBox();
    await page.mouse.move(box.x + box.width - 24, box.y + box.height / 2); await page.mouse.wheel(0, 12000);
    await until(() => outer.evaluate(node => node.scrollTop > 300), 'native lower-list scroll did not move outer Studio');
    await page.waitForTimeout(180); return outer;
}
async function assertExposed(locator, outer) {
    const target = await locator.boundingBox(), bounds = await outer.boundingBox();
    assert.ok(target && bounds && target.y >= bounds.y - 1 && target.y + target.height <= bounds.y + bounds.height + 1, 'action/status must stay inside outer Studio');
    assert.equal(await locator.evaluate(node => { const b = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)); }), true, 'action/status must remain exposed at its actual point');
}
const withoutGroups = annotations => annotations.map(({ groupName, ...item }) => { void groupName; return item; });
try {
    fixture = await startFixture(out); browser = await chromium.launch({ headless: true });
    page = await browser.newPage({ viewport: { width: 1470, height: 801 } });
    const annotations = createAnnotations();
    for (let i = 97; i < 100; i++) annotations.push({ ...structuredClone(annotations[0]), text: 'Fictional extra ' + i });
    annotations.forEach((item, index) => { item.id = 'selection_' + String(index).padStart(3, '0'); item.text = 'Fictional area ' + String(index).padStart(3, '0'); });
    const ids = [annotations[0].id, annotations[47].id, annotations[96].id];
    annotations[0].text = 'North clinic'; annotations[47].text = 'East garden'; annotations[96].text = 'West circle';
    annotations[0] = { ...createPrintAnnotation({ type: 'polygon', points: [[1.39, 103.79], [1.395, 103.79], [1.395, 103.795]], text: 'North clinic' }), id: ids[0] };
    annotations[0].groupName = 'Original team'; annotations[47].groupName = 'Original team';
    annotations[1].groupName = 'Health teams'; annotations[2].groupName = 'Health teams';
    state = await fixture.install(page, { annotations, annotationWriteCounts: [99, 100] }); state.allowAnnotationWrites = true;
    const offFilter = annotations[99].id, stale = 'retained_deleted_visibility_id';
    state.document.views[0].design.layers.hiddenAnnotationIds = [ids[1], offFilter, stale];
    state.document.views[1].design.layers.annotations = 'hide';
    const original = structuredClone(state.annotations), originalStudio = structuredClone(state.document), initialHidden = hidden();
    await page.route('**/api/my-maps/' + fixture.mapId + '/print-annotations', async route => {
        if (route.request().method() === 'PUT') annotationRequests.push(structuredClone(route.request().postDataJSON()));
        return route.fallback();
    });
    await page.route('**/api/my-maps/' + fixture.mapId + '/studio', async route => {
        if (route.request().method() !== 'PUT') return route.fallback();
        const body = route.request().postDataJSON(); assert.equal(body.revision, state.document.revision);
        const before = structuredClone(state.document); state.document = { ...body, revision: body.revision + 1 };
        studioWrites.push({ before, after: structuredClone(state.document) });
        return route.fulfill({ json: { mapId: fixture.mapId, document: state.document, updatedAt: null } });
    });
    await page.goto(new URL('/my-directory/maps/' + fixture.mapId, fixture.base).href);
    await page.locator('[data-owner-canvas-enter]').click(); await page.locator('[data-owner-canvas-tool="studio"]').click();
    await page.locator('[data-map-studio-annotation-layers]>summary').click(); manager = page.locator('[data-annotation-layer-manager]');
    await check('three unrelated checkboxes retain selection across three searches and never write visibility or groups', async () => {
        assert.equal(await count(), 0);
        for (let i = 0; i < ids.length; i++) {
            await search().fill(annotations.find(item => item.id === ids[i]).text); await expandGroups();
            assert.equal(await manager.locator('[data-annotation-layer-item]').count(), 1);
            assert.equal(await count(), i, 'filtering must not select its matching row');
            if (i === 1) { await row(ids[i]).getByRole('checkbox').focus(); await row(ids[i]).getByRole('checkbox').press('Space'); }
            else await row(ids[i]).getByRole('checkbox').check();
            assert.equal(await count(), i + 1);
        }
        await page.waitForTimeout(900); assert.equal(state.allowedWrites.length, 0); assert.equal(studioWrites.length, 0);
        assert.deepEqual(hidden(), initialHidden);
        return { selected: 3, searches: 3, hiddenSelectedId: ids[1], groupWrites: 0, studioWrites: 0 };
    });
    await check('type/group filters, group collapse and cancelling organisation retain the explicit selection', async () => {
        await resetFilters(); await group().selectOption('group:Health teams'); assert.equal(await count(), 3);
        const toggle = manager.locator('[data-annotation-group-toggle="group:Health teams"]');
        await toggle.click(); assert.equal(await toggle.getAttribute('aria-expanded'), 'false'); assert.equal(await count(), 3);
        await toggle.click(); await type().selectOption('boundary'); assert.equal(await count(), 3); await resetFilters();
        await openGroupForm(); await name().fill(''); assert.equal(await apply().isDisabled(), true);
        await name().press('Enter'); await page.waitForTimeout(350); assert.equal(state.allowedWrites.length, 0);
        await name().fill('Cancelled name'); await manager.locator('[data-annotation-group-cancel]').click(); assert.equal(await count(), 3);
        assert.equal(state.allowedWrites.length, 0); assert.equal(studioWrites.length, 0);
        return { retainedSelectedIds: 3, collapsedGroupIndependent: true, emptyNameDoesNotUngroup: true, cancelWrites: 0 };
    });
    await check('Group selected moves exactly three IDs including the hidden item; all other97 records remain exact', async () => {
        await search().fill('North clinic'); assert.equal(await manager.locator('[data-annotation-layer-item]').count(), 1);
        assert.match(await manager.locator('[data-annotation-group-selected]').innerText(), /3/);
        await resetFilters(); await openGroupForm(); await name().fill('  Neighbourhood   partners  '); const lower = await lowerInspector();
        await apply().click(); await until(() => state.allowedWrites.length === 1, 'selected group did not save'); await until(async () => await count() === 0, 'success did not clear completed selection');
        await assertExposed(manager.getByRole('status').filter({ hasText: 'Group saved.' }), lower);
        for (const id of ids) assert.equal(state.annotations.find(item => item.id === id).groupName, 'Neighbourhood partners');
        assert.deepEqual(state.annotations.filter(item => !ids.includes(item.id)), original.filter(item => !ids.includes(item.id)));
        assert.deepEqual(withoutGroups(state.annotations), withoutGroups(original)); assert.deepEqual(hidden(), initialHidden);
        assert.equal(studioWrites.length, 0); assert.equal(annotationRequests.length, 1); assert.equal(await count(), 0);
        await page.screenshot({ path: path.join(out, 'three-selected-grouped.png') });
        return { annotationWrites: 1, selectedMetadataChanges: 3, unrelatedRecordsExact: 97, geometryStyleExact: true, visibilityUnchanged: true, completionClearsSelection: true };
    });
    await check('item eyes and full-membership mixed/group eyes change only this view and preserve selection', async () => {
        await selectIds(ids, annotations); await search().fill('North clinic'); const visibility = groupEye('Neighbourhood partners');
        assert.equal(await visibility.getAttribute('aria-pressed'), 'mixed'); assert.match(await visibility.getAttribute('title'), /3/);
        await visibility.click(); await until(() => studioWrites.length === 1, 'mixed group show did not save');
        assert.deepEqual(hidden(), [offFilter, stale].sort()); assert.equal(await visibility.getAttribute('aria-pressed'), 'true');
        await visibility.click(); await until(() => studioWrites.length === 2, 'full group hide did not save');
        assert.deepEqual(hidden(), [...ids, offFilter, stale].sort());
        await visibility.click(); await until(() => studioWrites.length === 3, 'hidden group show did not save');
        await search().fill('East garden'); await eye(ids[1]).click(); await until(() => studioWrites.length === 4, 'item eye did not save');
        assert.deepEqual(hidden(), initialHidden); assert.equal(await count(), 3); assert.equal(state.allowedWrites.length, 1);
        assert.deepEqual(state.document.views[1], originalStudio.views[1]);
        for (const write of studioWrites) {
            const before = structuredClone(write.before), after = structuredClone(write.after);
            assert.equal(after.revision, before.revision + 1); assert.equal(after.views[0].revision, before.views[0].revision + 1);
            after.revision = before.revision; after.views[0].revision = before.views[0].revision;
            after.views[0].design.layers.hiddenAnnotationIds = before.views[0].design.layers.hiddenAnnotationIds;
            assert.deepEqual(after, before);
        }
        return { currentViewWrites: 4, groupWrites: 0, fullGroupMembers: 3, filteredRows: 1, selectedIdsRetained: 3, otherViewExact: true, staleAndOffFilterPreserved: true };
    });
    await check('master Hide/Show and same-map hidden saved-view roundtrip retain selection without accessible hidden controls', async () => {
        assert.equal(await count(), 3); const fields = page.getByRole('group', { name: 'Annotations', exact: true });
        await fields.getByRole('button', { name: 'Hide', exact: true }).click(); await until(() => studioWrites.length === 5, 'master Hide did not persist');
        assert.equal(await manager.isVisible(), false); assert.equal(await count(), 3);
        assert.equal(await page.getByRole('searchbox', { name: 'Search annotations', exact: true }).count(), 0);
        await fields.getByRole('button', { name: 'Show', exact: true }).click(); await until(() => studioWrites.length === 6, 'master Show did not persist');
        assert.equal(await manager.isVisible(), true); assert.equal(await count(), 3); assert.deepEqual(hidden(), initialHidden);
        const selector = page.locator('[data-map-studio-view-controls] select');
        await selector.selectOption(state.document.views[1].id); await until(async () => !(await manager.isVisible()), 'hidden saved view did not hide annotation controls');
        assert.equal(await count(), 3); await selector.selectOption(state.document.views[0].id); await until(() => manager.isVisible(), 'return saved view did not show annotation controls');
        assert.equal(await count(), 3); await page.waitForTimeout(500); assert.equal(studioWrites.length, 6); assert.equal(state.allowedWrites.length, 1);
        return { masterDesignWrites: 2, selectedIdsRetained: 3, hiddenControlsInaccessible: true, savedViewRoundtripWrites: 0, groupWrites: 0 };
    });
    await check('select matching adds/removes only the filtered set and Clear is explicit and local', async () => {
        await clear().click(); await resetFilters(); await search().fill('North clinic'); await all().check();
        await search().fill('Fictional area'); const matching = await manager.locator('[data-annotation-layer-item]').count();
        assert.equal(await count(), 1); await all().check(); assert.equal(await count(), matching + 1);
        await all().uncheck(); assert.equal(await count(), 1); await clear().click(); assert.equal(await count(), 0);
        assert.equal(state.allowedWrites.length, 1); assert.equal(studioWrites.length, 6);
        return { explicitMatchingSelection: matching, retainedOffFilterSelection: 1, clearWrites: 0 };
    });
    await check('existing group assignment, disabled normalized no-op and explicit Ungroup keep their separate meanings', async () => {
        await selectIds([annotations[1].id], annotations); await saveGroup('Neighbourhood partners', 2);
        await selectIds([ids[0]], annotations); await openGroupForm(); await name().fill(' Neighbourhood partners ');
        assert.equal(await apply().isDisabled(), true); await name().press('Enter'); await page.waitForTimeout(400); assert.equal(state.allowedWrites.length, 2);
        await manager.locator('[data-annotation-group-cancel]').click(); assert.equal(await count(), 1);
        await selectIds([ids[0], annotations[1].id], annotations); await manager.locator('[data-annotation-group-ungroup]').click();
        await until(() => state.allowedWrites.length === 3, 'explicit Ungroup did not persist'); assert.equal(await count(), 0);
        assert.equal(Object.hasOwn(state.annotations.find(item => item.id === ids[0]), 'groupName'), false);
        assert.equal(Object.hasOwn(state.annotations.find(item => item.id === annotations[1].id), 'groupName'), false);
        assert.deepEqual(withoutGroups(state.annotations), withoutGroups(original)); assert.deepEqual(hidden(), initialHidden);
        return { existingGroupWrites: 1, noOpWrites: 0, explicitUngroupWrites: 1, selectedClearedAfterSuccess: true, visibilityExact: true };
    });
    await check('failed group action retains selection; Retry and one Undo remain available after explicit Clear', async () => {
        let failuresLeft = 2, failedAttempts = 0;
        await page.route('**/api/my-maps/' + fixture.mapId + '/print-annotations', async route => {
            if (route.request().method() === 'PUT' && failuresLeft > 0) {
                failuresLeft--; failedAttempts++; return route.fulfill({ status: 503, json: { error: 'Fictional selected group save failure' } });
            }
            return route.fallback();
        });
        const before = structuredClone(state.annotations); await selectIds(ids, annotations); await resetFilters(); await openGroupForm(); await name().fill('Recovery team'); const lower = await lowerInspector(); await apply().click();
        await manager.getByRole('alert').waitFor(); assert.equal(await count(), 3); assert.equal(state.allowedWrites.length, 3); assert.deepEqual(state.annotations, before);
        await assertExposed(manager.getByRole('button', { name: 'Retry saving group', exact: true }), lower);
        await clear().click(); assert.equal(await count(), 0);
        const retry = manager.getByRole('button', { name: 'Retry saving group', exact: true }); await retry.click();
        await until(() => failedAttempts === 2, 'second deliberate failure not observed'); await manager.getByRole('alert').waitFor(); assert.equal(await count(), 0);
        await retry.click(); await until(() => state.allowedWrites.length === 4, 'successful Retry did not persist'); assert.equal(await count(), 0);
        for (const id of ids) assert.equal(state.annotations.find(item => item.id === id).groupName, 'Recovery team');
        await manager.getByRole('button', { name: 'Undo group change', exact: true }).click(); await until(() => state.allowedWrites.length === 5, 'single Undo after Retry did not save');
        assert.deepEqual(state.annotations, before); assert.equal(await count(), 0); assert.deepEqual(hidden(), initialHidden);
        return { retainedOnFailure: 3, explicitClear: true, failedAttempts: 2, retryWrites: 1, singleUndoWrites: 1, noDuplicateHistory: true, selectionAfterRecovery: 0 };
    });
    await check('real drawing deletion prunes only the missing selected ID; Undo restores geometry without reselecting it', async () => {
        await selectIds(ids, annotations); assert.equal(await count(), 3); const before = structuredClone(state.annotations);
        await page.locator('[data-owner-canvas-tool="draw"]').click();
        const deletedId = ids[1]; const label = page.locator('[data-annotation-shape-text]').filter({ hasText: 'East garden' }); await label.waitFor();
        const hit = await label.evaluate(node => { const box = node.getBoundingClientRect(), x = box.x + box.width / 2, y = box.y + box.height / 2;
            return { x, y, exposed: document.elementFromPoint(x, y)?.closest('[data-annotation-shape-text]') === node }; });
        assert.equal(hit.exposed, true, 'fictional target must be selected through its actual exposed label');
        await page.mouse.click(hit.x, hit.y); await until(() => page.evaluate(id => window.__qaEditorState.selectedId === id, deletedId), 'real label click did not select annotation');
        await page.getByRole('button', { name: 'Delete annotation', exact: true }).click(); await until(() => state.allowedWrites.length === 6, 'drawing deletion did not save');
        await until(async () => await count() === 2, 'catalogue deletion did not prune only the absent selected ID');
        assert.equal(state.annotations.length, 99); assert.equal(state.annotations.some(item => item.id === deletedId), false);
        await page.getByRole('button', { name: 'Undo', exact: true }).click(); await until(() => state.allowedWrites.length === 7, 'drawing Undo did not save');
        assert.deepEqual(state.annotations, before); await page.locator('[data-owner-canvas-tool="studio"]').click(); await resetFilters(); await expandGroups();
        assert.equal(await count(), 2); assert.equal(await row(deletedId).getByRole('checkbox').isChecked(), false);
        assert.equal(await row(ids[0]).getByRole('checkbox').isChecked(), true); assert.equal(await row(ids[2]).getByRole('checkbox').isChecked(), true);
        assert.deepEqual(hidden(), initialHidden); assert.equal(studioWrites.length, 6);
        return { actualLabelHit: true, deletionWrites: 1, undoWrites: 1, prunedSelectedIds: 1, retainedSelectedIds: 2, restoredRecordUnselected: true, geometryRestored: true };
    });
    await check('same-SPA map change clears selection even when the next map has identical annotation IDs', async () => {
        await selectIds(ids, annotations); assert.equal(await count(), 3); const otherId = fixture.mapId + 1;
        await page.route('**/api/my-maps/' + otherId + '**', async route => {
            assert.equal(route.request().method(), 'GET'); const url = new URL(route.request().url());
            if (url.pathname.endsWith('/print-annotations')) return route.fulfill({ json: { mapId: otherId, schemaVersion: 1, annotations: state.annotations, revision: state.annotationRevision } });
            if (url.pathname.endsWith('/studio')) return route.fulfill({ json: { mapId: otherId, document: state.document, updatedAt: null } });
            return route.fulfill({ json: { ...state.directory, id: otherId, name: 'Second fictional selection map' } });
        });
        await page.evaluate(id => { history.pushState(null, '', '/my-directory/maps/' + id); dispatchEvent(new PopStateEvent('popstate')); }, otherId);
        await page.locator('[data-owner-canvas-enter]').waitFor(); await page.locator('[data-owner-canvas-enter]').click(); await page.locator('[data-owner-canvas-tool="studio"]').click();
        const details = page.locator('[data-map-studio-annotation-layers]'); if (await details.getAttribute('open') === null) await details.locator(':scope>summary').click();
        manager = page.locator('[data-annotation-layer-manager]'); await until(async () => await count() === 0, 'selection leaked into another map with identical IDs');
        assert.equal(await manager.locator('[data-annotation-group-selected]').isDisabled(), true); assert.equal(state.allowedWrites.length, 7); assert.equal(studioWrites.length, 6);
        return { sameIds: 100, selectionReset: true, mapChangeWrites: 0 };
    });
    report.shortViewportEvidence = [];
    for (const viewport of [{ width: 390, height: 500 }, { width: 390, height: 844 }, { width: 1280, height: 500 }]) {
        await check('static-from-start form and failed Retry/Undo remain reachable at ' + viewport.width + 'x' + viewport.height, async () => {
            const current = await browser.newPage({ viewport }); const scoped = await fixture.install(current, { annotations, annotationWriteCounts: [100] }); scoped.allowAnnotationWrites = true;
            let reject = true, failedAttempts = 0;
            await current.route('**/api/my-maps/' + fixture.mapId + '/print-annotations', async route => {
                if (route.request().method() === 'PUT' && reject) { failedAttempts++; return route.fulfill({ status: 503, json: { error: 'Fictional short-viewport group failure' } }); }
                return route.fallback();
            });
            await current.goto(new URL('/my-directory/maps/' + fixture.mapId, fixture.base).href); await current.locator('[data-owner-canvas-enter]').click(); await current.locator('[data-owner-canvas-tool="studio"]').click(); await current.locator('[data-map-studio-annotation-layers]>summary').click();
            const local = current.locator('[data-annotation-layer-manager]'), outer = current.locator('[data-map-studio-owner-panel][data-map-studio-canvas="true"]');
            const bar = local.locator('.annotation-layer-selection'); assert.equal(await bar.evaluate(node => getComputedStyle(node).position), 'static', 'fallback must apply before opening the form');
            await local.locator('[data-annotation-select-all]').check(); await local.locator('[data-annotation-group-selected]').click();
            const field = local.getByRole('combobox', { name: 'Group name', exact: true }); await field.fill('Narrow viewport draft'); await field.press('Tab');
            const applyButton = local.locator('[data-annotation-group-apply]'); assert.equal(await applyButton.evaluate(node => node === document.activeElement), true); await assertExposed(applyButton, outer);
            await applyButton.press('Tab'); const cancel = local.locator('[data-annotation-group-cancel]'); assert.equal(await cancel.evaluate(node => node === document.activeElement), true); await assertExposed(cancel, outer);
            const widths = await current.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth })); assert.ok(widths.page <= widths.viewport + 1);
            await cancel.click(); assert.equal(Number((await local.locator('[data-annotation-selection-count]').textContent()).match(/\d+/)[0]), 100);
            assert.equal(await bar.evaluate(node => getComputedStyle(node).position), 'static'); assert.deepEqual(scoped.allowedWrites, []);
            await local.locator('[data-annotation-group-selected]').click(); await field.fill('Short recovery group'); await applyButton.click(); await local.getByRole('alert').waitFor();
            assert.equal(Number((await local.locator('[data-annotation-selection-count]').textContent()).match(/\d+/)[0]), 100);
            await local.locator('[data-annotation-selection-clear]').click(); assert.equal(Number((await local.locator('[data-annotation-selection-count]').textContent()).match(/\d+/)[0]), 0);
            const box = await outer.boundingBox(), beforeWheel = await outer.evaluate(node => node.scrollTop);
            await current.mouse.move(box.x + box.width - 24, box.y + box.height / 2); await current.mouse.wheel(0, 800); await current.waitForTimeout(180);
            const afterWheel = await outer.evaluate(node => node.scrollTop); assert.ok(afterWheel > beforeWheel, 'the one outer scroller must accept native wheel over recovery content');
            async function tabTo(target) {
                await local.getByRole('searchbox', { name: 'Search annotations', exact: true }).focus();
                for (let step = 0; step < 20; step++) {
                    if (await target.evaluate(node => node === document.activeElement)) return;
                    await current.keyboard.press('Tab');
                }
                throw Error('recovery action not reached by native Tab navigation');
            }
            const retry = local.getByRole('button', { name: 'Retry saving group', exact: true }); await tabTo(retry); await assertExposed(retry, outer);
            reject = false; await retry.click(); await until(() => scoped.allowedWrites.length === 1, 'short recovery Retry did not persist');
            const undo = local.getByRole('button', { name: 'Undo group change', exact: true }); await tabTo(undo); await assertExposed(undo, outer); await undo.click(); await until(() => scoped.allowedWrites.length === 2, 'short recovery Undo did not persist');
            assert.deepEqual(scoped.annotations, annotations); assert.deepEqual(scoped.unexpectedWrites, []); assert.deepEqual(scoped.errors, []);
            const evidence = { viewport, staticBeforeForm: true, applyAndCancelKeyboardExposed: true, selectedAfterCancel: 100, recoverySelectedCount: 0, failedAttempts, retryWrites: 1, undoWrites: 1, outerWheel: [beforeWheel, afterWheel], horizontalSpill: 0 };
            report.shortViewportEvidence.push(evidence); await current.screenshot({ path: path.join(out, 'form-recovery-' + viewport.width + 'x' + viewport.height + '.png') }); await current.close(); return evidence;
        });
    }
    await check('classic short Edit layout retains natural form flow and keyboard reachability', async () => {
        const current = await browser.newPage({ viewport: { width: 390, height: 500 } }); const scoped = await fixture.install(current, { annotations, annotationWriteCounts: [100] });
        await current.goto(new URL('/my-directory/maps/' + fixture.mapId, fixture.base).href); await current.locator('[data-owner-map-mobile-header] button').first().click(); await current.getByRole('button', { name: 'Edit layout', exact: true }).click();
        await current.locator('[data-map-studio-annotation-layers]>summary').click(); const local = current.locator('[data-annotation-layer-manager]');
        assert.equal(await current.locator('[data-owner-canvas-exit]').isVisible(), false); assert.equal(await local.locator('.annotation-layer-selection').evaluate(node => getComputedStyle(node).position), 'static');
        await local.locator('[data-annotation-select-all]').check(); await local.locator('[data-annotation-group-selected]').click();
        const field = local.getByRole('combobox', { name: 'Group name', exact: true }); await field.fill('Classic local draft'); await field.press('Tab');
        const applyButton = local.locator('[data-annotation-group-apply]'), outer = current.locator('[data-map-studio-design-controls]');
        assert.equal(await applyButton.evaluate(node => node === document.activeElement), true); await assertExposed(applyButton, outer);
        await applyButton.press('Tab'); const cancel = local.locator('[data-annotation-group-cancel]'); assert.equal(await cancel.evaluate(node => node === document.activeElement), true); await assertExposed(cancel, outer); await cancel.click();
        assert.deepEqual(scoped.allowedWrites, []); assert.deepEqual(scoped.unexpectedWrites, []); assert.deepEqual(scoped.errors, []);
        const widths = await current.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth })); assert.ok(widths.page <= widths.viewport + 1);
        await current.screenshot({ path: path.join(out, 'classic-short-form.png') }); await current.close();
        return { viewport: { width: 390, height: 500 }, classicCanvasInactive: true, barStatic: true, applyCancelKeyboardExposed: true, savedWrites: 0, horizontalSpill: 0 };
    });
    report.intentionalAnnotationWrites = state.allowedWrites; report.intentionalStudioWrites = studioWrites.length;
    report.errors = state.errors; report.unexpectedWrites = state.unexpectedWrites; assert.deepEqual(state.errors, []); assert.deepEqual(state.unexpectedWrites, []);
    report.blockedGoogleSdkAttempts = state.blockedExternal.filter(item => item.origin === 'https://accounts.google.com' && item.path === '/gsi/client').length;
    report.otherBlockedExternal = state.blockedExternal.filter(item => item.origin !== 'https://accounts.google.com' || item.path !== '/gsi/client'); assert.deepEqual(report.otherBlockedExternal, []);
} catch (error) {
    report.failure = error.stack; process.exitCode = 1;
    if (page) { await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {}); await fs.writeFile(path.join(out, 'failure-dom.txt'), await page.locator('body').innerText()).catch(() => {}); }
    console.error(error.stack);
} finally {
    report.sourceAfter = await fingerprint(); report.sourceUnchanged = JSON.stringify(report.sourceBefore) === JSON.stringify(report.sourceAfter);
    if (!report.sourceUnchanged) { report.failure ||= 'Runtime source changed during acceptance'; process.exitCode = 1; }
    report.summary = { passed: report.cases.filter(item => item.passed).length, failed: report.cases.filter(item => !item.passed).length };
    await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n'); await browser?.close(); await fixture?.server.close();
    console.log(JSON.stringify({ out, summary: report.summary, failure: report.failure, sourceUnchanged: report.sourceUnchanged }));
}
