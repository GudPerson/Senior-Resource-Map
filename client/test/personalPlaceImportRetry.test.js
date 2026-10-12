import test from 'node:test';
import assert from 'node:assert/strict';
import { lookupPersonalPlaceImportLocations, parsePersonalPlaceImportGrid } from '../src/lib/personalPlaceImport.js';

const location = { postalCode: '680503', address: '503 CHOA CHU KANG STREET 51 SINGAPORE 680503', lat: 1.388, lng: 103.742 };
const rows = () => parsePersonalPlaceImportGrid([['Name', 'Postal Code'], ['503', '680503']]);

test('temporary API transport failure remains processing and recovers without exposing a row error', async () => {
    const outcomes = [];
    let calls = 0;
    await lookupPersonalPlaceImportLocations(rows(), async () => {
        calls += 1;
        if (calls === 1) throw new TypeError('Failed to fetch');
        return location;
    }, (postalCode, outcome) => outcomes.push(outcome), () => true, {
        concurrency: 1, retryAttempts: 2,
        wait: async () => assert.equal(outcomes.length, 0),
    });
    assert.equal(calls, 2);
    assert.equal(outcomes.length, 1);
    assert.equal(outcomes[0].location.postalCode, '680503');
    assert.equal(outcomes[0].error, undefined);
});

test('API rate limiting retries automatically while confirmed invalid postal codes finish with a real error', async () => {
    for (const status of [429, 400]) {
        let calls = 0;
        const outcomes = [];
        await lookupPersonalPlaceImportLocations(rows(), async () => {
            calls += 1;
            if (status === 400 || calls === 1) throw Object.assign(new Error(status === 400 ? 'No exact address was found. Check the postal code.' : 'Rate limited'), { status });
            return location;
        }, (postal, outcome) => outcomes.push(outcome), () => true, { retryAttempts: 2, wait: async () => {} });
        assert.equal(calls, status === 400 ? 1 : 2);
        assert.equal(Boolean(outcomes[0].error), status === 400);
    }
});

test('server exhaustion stays bounded and does not start another upstream retry cycle', async () => {
    let calls = 0;
    const outcomes = [];
    await lookupPersonalPlaceImportLocations(rows(), async () => {
        calls += 1;
        throw Object.assign(new Error('The location service is temporarily unavailable. Try again later.'), { status: 503, code: 'postal_lookup_unavailable' });
    }, (postal, outcome) => outcomes.push(outcome), () => true, { retryAttempts: 3, wait: async () => {} });
    assert.equal(calls, 1);
    assert.match(outcomes[0].error, /service is temporarily unavailable/);
    assert.doesNotMatch(outcomes[0].error, /correct the file|postal code could not/);
});

test('cancellation during automatic retry stops further requests and stale outcomes', async () => {
    let active = true;
    let calls = 0;
    let callbacks = 0;
    await lookupPersonalPlaceImportLocations(rows(), async () => {
        calls += 1;
        throw new TypeError('Failed to fetch');
    }, () => { callbacks += 1; }, () => active, {
        retryAttempts: 3, wait: async () => { active = false; },
    });
    assert.equal(calls, 1);
    assert.equal(callbacks, 0);
});

test('bulk lookup can use a paced single worker and still deduplicates postal codes', async () => {
    const bulk = parsePersonalPlaceImportGrid([['Name', 'Postal Code'], ['503', '680503'], ['504', '680504'], ['503 again', '680503'], ['505', '680505']]);
    const called = [];
    const pauses = [];
    await lookupPersonalPlaceImportLocations(bulk, async postalCode => {
        called.push(postalCode);
        return { ...location, postalCode };
    }, () => {}, () => true, { concurrency: 1, spacingMs: 600, wait: async ms => pauses.push(ms) });
    assert.deepEqual(called, ['680503', '680504', '680505']);
    assert.deepEqual(pauses, [600, 600]);
});
