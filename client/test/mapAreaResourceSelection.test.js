import test from 'node:test';
import assert from 'node:assert/strict';
import { filterAreaResources, getAreaResourcePlaceIds, mergeNewMapMembershipKeys, runAreaResourceAddition } from '../src/lib/mapAreaResourceSelection.js';
import { canApplySavedAssetsSnapshot } from '../src/lib/savedAssets.js';
import { getMapAreaResourceMessages } from '../src/lib/mapAreaResourceMessages.js';

test('area search filters results without changing typed identities or scope choices', () => {
    const rows = [{ resourceType: 'hard', resourceId: 1, name: 'North', locations: [{ address: 'Garden Road' }] }, { resourceType: 'soft', resourceId: 1, name: 'Garden class', locations: [] }];
    assert.deepEqual(filterAreaResources(rows, 'garden', 'hard'), [rows[0]]);
    assert.deepEqual(getAreaResourcePlaceIds({ locations: [{ id: 3 }, { id: '3' }, { id: null }, { id: -1 }, { id: 8 }] }), [3, 8]);
});

test('new area membership preserves pending Saved-tab unticks and not-yet-persisted ticks', () => {
    const pending = new Set(['hard-90', 'soft-2']);
    const merged = mergeNewMapMembershipKeys(pending, ['hard-90', 'soft-1'], ['hard-90', 'soft-1', 'soft-3']);
    assert.deepEqual([...merged], ['hard-90', 'soft-2', 'soft-3']);
    assert.deepEqual([...pending], ['hard-90', 'soft-2'], 'pending selection is not mutated');
    assert.deepEqual([...mergeNewMapMembershipKeys(merged, ['hard-90', 'soft-1', 'soft-3'], ['hard-90', 'soft-1', 'soft-3'])], [...merged]);
});

function fixture() {
    const original = { assetKey: 'hard-90', resourceType: 'hard', resourceId: 90, notes: [{ text: 'Preserve' }] };
    const assets = [original], saved = [], writes = [];
    return { original, assets, saved, writes, options: {
        items: [{ resourceType: 'soft', resourceId: 1, selectedPlaceIds: [3] }, { resourceType: 'hard', resourceId: 90 }],
        getMap: async () => ({ viewer: { isOwner: true }, assets: structuredClone(assets) }),
        getSaved: async () => structuredClone(saved),
        ensureSaved: async item => { writes.push(['save', structuredClone(item)]); saved.push(item); return { saved: true }; },
        addToMap: async item => { writes.push(['add', structuredClone(item)]); assets.push(item); },
    } };
}

test('area addition saves/adds only selected missing IDs and retains all existing resource bytes', async () => {
    const f = fixture();
    const result = await runAreaResourceAddition(f.options);
    assert.deepEqual(result.items.map(row => row.status), ['added', 'already_on_map']);
    assert.deepEqual(f.writes, [['save', { resourceType: 'soft', resourceId: 1 }], ['add', { resourceType: 'soft', resourceId: 1, selectedPlaceIds: [3] }]]);
    assert.deepEqual(f.assets[0], f.original);
});

test('accepted save with lost response reconciles as saved-not-added without toggling or deleting', async () => {
    const f = fixture();
    f.options.ensureSaved = async item => { f.saved.push(item); throw new Error('Lost response'); };
    const result = await runAreaResourceAddition(f.options);
    assert.equal(result.items[0].status, 'saved_not_added');
    assert.deepEqual(f.writes, []);
});

test('an ambiguous Add still absent from the first fresh read is unconfirmed, not definitely absent', async () => {
    const f = fixture();
    f.options.addToMap = async () => { throw new Error('Connection lost before acknowledgement'); };
    const result = await runAreaResourceAddition(f.options);
    assert.equal(result.items[0].status, 'unknown');
});

test('an ambiguous Save still absent from the first fresh read is unconfirmed, not definitely rejected', async () => {
    const f = fixture();
    f.options.ensureSaved = async () => { throw new Error('Connection lost before acknowledgement'); };
    const result = await runAreaResourceAddition(f.options);
    assert.equal(result.items[0].status, 'unknown');
});

test('duplicate addition and ambiguous accepted response reconcile to current membership', async () => {
    const f = fixture();
    f.options.addToMap = async item => { f.assets.push(item); throw new Error('409 / lost response'); };
    assert.equal((await runAreaResourceAddition(f.options)).items[0].status, 'added');
});

test('Stop stops queued work and reports a save already accepted before stopping', async () => {
    const f = fixture(); let stopped = false;
    f.options.items = [{ resourceType: 'soft', resourceId: 1 }, { resourceType: 'soft', resourceId: 2 }];
    f.options.shouldStop = () => stopped;
    f.options.concurrency = 1;
    f.options.ensureSaved = async item => { f.saved.push(item); stopped = true; return { saved: true }; };
    const result = await runAreaResourceAddition(f.options);
    assert.deepEqual(result.items.map(row => row.status), ['saved_not_added', 'not_started']);
    assert.deepEqual(f.writes, []);
});

test('failed authoritative read never claims success or performs a write', async () => {
    const f = fixture(); f.options.getMap = async () => { throw new Error('Unavailable'); };
    await assert.rejects(runAreaResourceAddition(f.options), /Unavailable/);
    assert.deepEqual(f.writes, []);
});

test('invalid explicit venue scope fails before saving and never falls back to all venues', async () => {
    const f = fixture(); f.options.items = [{ resourceType: 'soft', resourceId: 1, selectedPlaceIds: [] }];
    await assert.rejects(runAreaResourceAddition(f.options), /location/i);
    assert.deepEqual(f.writes, []);
});

test('unconfirmable final state is unknown rather than a successful add', async () => {
    const f = fixture(); let reads = 0;
    f.options.getMap = async () => { if (++reads > 1) throw new Error('Offline'); return { viewer: { isOwner: true }, assets: f.assets }; };
    const result = await runAreaResourceAddition(f.options);
    assert.equal(result.items[0].status, 'unknown');
    assert.equal(result.reconciled, false);
});

test('a concurrent duplicate never claims the attempted venue scope replaced existing scope', async () => {
    const f = fixture();
    f.options.addToMap = async item => { f.assets.push({ ...item, selectedPlaceIds: [999] }); throw Object.assign(new Error('Already in map'), { status: 409 }); };
    const result = await runAreaResourceAddition(f.options);
    assert.equal(result.items[0].status, 'already_on_map');
    assert.deepEqual(f.assets[1].selectedPlaceIds, [999]);
    assert.deepEqual(result.items[0].selectedPlaceIds, [3], 'attempted selection remains distinct from existing scope');
});

test('identity or area change after Save stops Add, queued Saves and old-context reconciliation', async () => {
    const f = fixture(); let current = true, mapReads = 0, savedReads = 0;
    f.options.items = [{ resourceType: 'soft', resourceId: 1 }, { resourceType: 'soft', resourceId: 2 }];
    f.options.concurrency = 1;
    f.options.isCurrent = () => current;
    f.options.getMap = async () => { mapReads++; return { viewer: { isOwner: true }, assets: f.assets }; };
    f.options.getSaved = async () => { savedReads++; return []; };
    f.options.ensureSaved = async item => { f.saved.push(item); current = false; return { saved: true }; };
    const result = await runAreaResourceAddition(f.options);
    assert.deepEqual(result.items.map(row => row.status), ['unknown', 'not_started']);
    assert.equal(mapReads, 1); assert.equal(savedReads, 0); assert.deepEqual(f.writes, []);
});

test('rate limiting pauses unscheduled items instead of continuing through the catalogue', async () => {
    const f = fixture(); let attempts = 0;
    f.options.items = [{ resourceType: 'soft', resourceId: 1 }, { resourceType: 'soft', resourceId: 2 }];
    f.options.concurrency = 1;
    f.options.ensureSaved = async () => { attempts++; throw Object.assign(new Error('Wait'), { status: 429 }); };
    const result = await runAreaResourceAddition(f.options);
    assert.equal(attempts, 1); assert.equal(result.rateLimited, true);
    assert.deepEqual(result.items.map(row => row.status), ['failed', 'not_started']);
});

test('verified Saved snapshots cannot overwrite a newly signed-in or signed-out account', () => {
    assert.equal(canApplySavedAssetsSnapshot([], 1, 1), true);
    assert.equal(canApplySavedAssetsSnapshot([], 1, 2), false);
    assert.equal(canApplySavedAssetsSnapshot([], 1, null), false);
    assert.equal(canApplySavedAssetsSnapshot(null, 1, 1), false);
});

test('area resource controls and diagnostics have complete localized messages', () => {
    const keys = Object.keys(getMapAreaResourceMessages('en')).sort();
    for (const locale of ['zh', 'ms', 'ta']) {
        const messages = getMapAreaResourceMessages(locale);
        assert.deepEqual(Object.keys(messages).sort(), keys);
        assert.ok(keys.every(key => typeof messages[key] === 'string' && messages[key].trim()));
        assert.notEqual(messages.withinArea, getMapAreaResourceMessages('en').withinArea);
    }
});
