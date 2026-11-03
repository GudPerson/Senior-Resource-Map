import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileAddressSnapshotRecords } from './build-address-snapshot.mjs';
import { loadAddressPublicationPlan, publishAddressSnapshot, verifyAddressPublication, runAddressPublisher, validateAddressOperatorConfig, verifyAddressObject, addressPublicationFailure } from './publish-address-snapshot.mjs';

async function fixture(t, { tiles = 1 } = {}) {
    const directory = await mkdtemp(join(tmpdir(), 'address-publisher-test-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const compiled = compileAddressSnapshotRecords(Array.from({ length: tiles }, (_, tile) => [
        ['012345', String(tile * 2 + 1), 'Fictional Road', 'Fictional block', '1 Fictional Road', String(1.385 + tile * .02), '103.755'],
        ['012346', String(tile * 2 + 2), 'Fictional Road', 'Fictional block', '2 Fictional Road', String(1.3851 + tile * .02), '103.7551'],
    ]).flat(), { sourceSha256: 'a'.repeat(64), preparedAt: '2026-11-03T00:00:00.000Z' });
    for (const [key, object] of compiled.objects) {
        const file = join(directory, key.slice(compiled.config.prefix.length + 1));
        await mkdir(join(file, '..'), { recursive: true }); await writeFile(file, object.bytes);
    }
    return loadAddressPublicationPlan(directory, { expected: compiled.config });
}
function fakeR2() {
    const objects = new Map(), calls = [];
    const bucket = {
        async list({ prefix, limit }) { calls.push({ type: 'list', prefix }); const all = [...objects.keys()].filter(k => k.startsWith(prefix)).sort(); return { objects: all.slice(0, limit).map(key => ({ key })), truncated: all.length > limit, ...(all.length > limit ? { cursor: 'next' } : {}) }; },
        async head(key) { calls.push({ type: 'head', key }); return objects.has(key) ? { size: objects.get(key).bytes.length } : null; },
        async put(key, bytes, options) {
            calls.push({ type: 'put', key }); assert.deepEqual(options.onlyIf, { etagDoesNotMatch: '*' }); assert.match(options.sha256, /^[a-f0-9]{64}$/);
            if (objects.has(key)) return null;
            objects.set(key, { bytes: Buffer.from(bytes), httpMetadata: options.httpMetadata }); return { key };
        },
        async get(key) { calls.push({ type: 'get', key }); const o = objects.get(key); return o ? { size: o.bytes.length, httpMetadata: o.httpMetadata, arrayBuffer: async () => o.bytes } : null; },
    };
    return { bucket, objects, calls };
}

test('immutable publication verifies every data object before manifest-last and independently reads the complete inventory', async t => {
    const plan = await fixture(t), remote = fakeR2(), checkpoints = [];
    const result = await publishAddressSnapshot(remote.bucket, plan, { checkpoint: async value => checkpoints.push(value) });
    assert.equal(result.objectCount, 3);
    const at = remote.calls.findIndex(c => c.type === 'put' && c.key === plan.manifest.key);
    for (const o of plan.objects) assert.ok(remote.calls.slice(0, at).some(c => c.type === 'get' && c.key === o.key));
    assert.equal(checkpoints.at(-1).stage, 'verified');
    assert.equal((await verifyAddressPublication(remote.bucket, plan)).verified, true);
    assert.ok(remote.calls.every(c => c.key === undefined || c.key.startsWith(plan.publicPlan.prefix)));
});

test('occupied prefix stops before any put, including an unexpected key', async t => {
    const plan = await fixture(t), remote = fakeR2(); remote.objects.set(plan.publicPlan.prefix + 'unexpected', { bytes: Buffer.from('x') });
    await assert.rejects(publishAddressSnapshot(remote.bucket, plan), /PREFIX_OCCUPIED/);
    assert.equal(remote.calls.filter(c => c.type === 'put').length, 0);
});

test('an object appearing between head and put is never overwritten or retried', async t => {
    const plan = await fixture(t), remote = fakeR2(), put = remote.bucket.put;
    remote.bucket.put = async (key, bytes, options) => { remote.objects.set(key, { bytes: Buffer.from('concurrent-original') }); return put(key, bytes, options); };
    await assert.rejects(publishAddressSnapshot(remote.bucket, plan), /ATOMIC_CREATE_REJECTED/);
    assert.equal(remote.calls.filter(c => c.type === 'put').length, 1);
    assert.equal(remote.objects.get(plan.objects[0].key).bytes.toString(), 'concurrent-original');
    assert.equal(remote.objects.has(plan.manifest.key), false);
});

test('wrong remote MIME or data bytes prevents the manifest write', async t => {
    for (const corrupt of ['mime', 'bytes']) {
        const plan = await fixture(t), remote = fakeR2(), get = remote.bucket.get;
        remote.bucket.get = async key => { const object = await get(key); if (object && key === plan.objects[0].key) {
            if (corrupt === 'mime') object.httpMetadata = { ...object.httpMetadata, contentType: 'text/plain' };
            else object.arrayBuffer = async () => Buffer.alloc(object.size);
        } return object; };
        await assert.rejects(publishAddressSnapshot(remote.bucket, plan), /REMOTE_(METADATA|HASH)_MISMATCH/);
        assert.equal(remote.objects.has(plan.manifest.key), false);
    }
});

test('local artifact changes after review fail before writing and a partial prefix cannot resume', async t => {
    const plan = await fixture(t), remote = fakeR2();
    await writeFile(plan.objects[0].file, 'changed');
    await assert.rejects(publishAddressSnapshot(remote.bucket, plan), /LOCAL_ARTIFACT_CHANGED/);
    assert.equal(remote.calls.filter(c => c.type === 'put').length, 0);
    remote.objects.set(plan.objects[0].key, { bytes: Buffer.from('partial') });
    await assert.rejects(publishAddressSnapshot(remote.bucket, plan), /PREFIX_OCCUPIED/);
});

test('write-intent checkpoint failure prevents that write and no automatic retry occurs', async t => {
    const plan = await fixture(t), remote = fakeR2();
    await assert.rejects(publishAddressSnapshot(remote.bucket, plan, { checkpoint: async value => { if (value.stage === 'write-intent') throw Error('Receipt unavailable'); } }), /JOURNAL_FAILURE/);
    assert.equal(remote.calls.filter(c => c.type === 'put').length, 0);
});

test('publisher refuses ambiguous mutation modes before opening a transport', async () => {
    await assert.rejects(runAddressPublisher(['--apply', '--verify']), /Choose publication/);
    await assert.rejects(runAddressPublisher(['--unknown']), /Unknown publisher/);
});

test('operator configuration fails closed for local bindings, public sockets or unrelated resources', () => {
    const valid = { name: 'fictional-operator', account_id: 'a'.repeat(32), compatibility_date: '2026-03-12', compatibility_flags: ['nodejs_compat'], dev: { ip: '127.0.0.1' }, r2_buckets: [{ binding: 'SNAPSHOT_OPERATOR_BUCKET', bucket_name: 'carearound-help-content-private', remote: true }] };
    assert.equal(validateAddressOperatorConfig(valid), true);
    for (const change of [v => { v.r2_buckets[0].remote = false; }, v => { v.dev.ip = '0.0.0.0'; }, v => { v.vars = {}; }, v => { delete v.account_id; }, v => { v.r2_buckets[0].bucket_name = 'unrelated'; }]) {
        const config = structuredClone(valid); change(config); assert.throws(() => validateAddressOperatorConfig(config));
    }
});


test('invalid worker concurrency fails before opening any storage operation', async t => {
    const plan = await fixture(t);
    for (const concurrency of [0, 5, 1.5]) {
        const remote = fakeR2();
        await assert.rejects(publishAddressSnapshot(remote.bucket, plan, { concurrency }), /concurrency/);
        assert.equal(remote.calls.length, 0);
    }
});

test('explicit auth and missing-object statuses take precedence over network-shaped errors', async t => {
    const plan = await fixture(t);
    for (const status of [401, 403, 404]) {
        let calls = 0; const waits = [];
        const bucket = { get: async () => { calls++; throw Object.assign(new TypeError('fetch failed https://fictional.invalid/?secret=withheld'), { status }); } };
        await assert.rejects(verifyAddressObject(bucket, plan.objects[0], { sleep: async ms => waits.push(ms) }), error => {
            assert.equal(error.code, 'READ_FAILED'); assert.equal(error.status, status); assert.equal(error.errorClass, 'http');
            assert.equal(JSON.stringify(addressPublicationFailure(error)).includes('secret='), false);
            return true;
        });
        assert.equal(calls, 1); assert.deepEqual(waits, []);
    }
});

test('transient read-body failures retry at most three times with bounded backoff and sanitized failure proof', async t => {
    const plan = await fixture(t), remote = fakeR2();
    await publishAddressSnapshot(remote.bucket, plan);
    let attempts = 0; const get = remote.bucket.get, waits = [], events = [];
    remote.bucket.get = async key => {
        const object = await get(key); attempts++;
        object.arrayBuffer = async () => { throw Object.assign(new Error('HTTP 500 https://fictional.invalid/?secret=withheld'), { status: 500 }); };
        return object;
    };
    await assert.rejects(verifyAddressObject(remote.bucket, plan.objects[0], { sleep: async ms => waits.push(ms), checkpoint: async value => events.push(value) }), error => {
        assert.deepEqual(addressPublicationFailure(error), { code: 'TRANSIENT_READ_EXHAUSTED', phase: 'data-verify', errorClass: 'http', key: plan.objects[0].key, sha256: plan.objects[0].sha256, status: 500 });
        return true;
    });
    assert.equal(attempts, 3); assert.deepEqual(waits, [250, 1000]);
    assert.equal(events.filter(value => value.stage === 'read-retry').length, 2);
    assert.equal(JSON.stringify(events).includes('secret='), false);
});

test('failed row-pack canary prevents every bulk write and never retries an integrity mismatch', async t => {
    const plan = await fixture(t, { tiles: 4 }), remote = fakeR2(), get = remote.bucket.get;
    const rowKey = plan.objects[1].key;
    remote.bucket.get = async key => { const value = await get(key); if (key === rowKey) value.arrayBuffer = async () => Buffer.alloc(value.size); return value; };
    await assert.rejects(publishAddressSnapshot(remote.bucket, plan), /REMOTE_HASH_MISMATCH/);
    assert.deepEqual(remote.calls.filter(value => value.type === 'put').map(value => value.key), plan.objects.slice(0, 2).map(value => value.key));
    assert.equal(remote.calls.filter(value => value.type === 'get' && value.key === rowKey).length, 1);
    assert.equal(remote.objects.has(plan.manifest.key), false);
});

test('unknown concurrent PUT outcomes drain in-flight operations before failure without retry or further writes', async t => {
    const plan = await fixture(t, { tiles: 8 }), remote = fakeR2(), put = remote.bucket.put;
    const started = [], pending = []; let bulkActive = 0, peak = 0, failed = false;
    let releaseStarted; const ready = new Promise(resolve => { releaseStarted = resolve; });
    remote.bucket.put = async (key, bytes, options) => {
        if (plan.objects.slice(0, 2).some(object => object.key === key)) return put(key, bytes, options);
        assert.equal(failed, false, 'No new PUT may start after an unknown outcome');
        started.push(key); bulkActive++; peak = Math.max(peak, bulkActive);
        await new Promise(resolve => { pending.push(resolve); if (pending.length === 4) releaseStarted(); });
        await put(key, bytes, options); bulkActive--;
        failed = true; throw Object.assign(new Error('HTTP 500 https://fictional.invalid/?secret=withheld'), { status: 500 });
    };
    let settled = false;
    const publication = publishAddressSnapshot(remote.bucket, plan).finally(() => { settled = true; });
    const rejection = assert.rejects(publication, error => error.code === 'PUT_OUTCOME_UNKNOWN' && !JSON.stringify(addressPublicationFailure(error)).includes('secret='));
    await ready; assert.equal(peak, 4); pending[0]();
    await new Promise(resolve => setImmediate(resolve)); assert.equal(settled, false);
    for (const release of pending.slice(1)) release();
    await rejection;
    assert.equal(bulkActive, 0); assert.equal(started.length, 4);
    assert.equal(new Set(started).size, 4); assert.equal(remote.objects.has(plan.manifest.key), false);
    const calls = remote.calls.length; await new Promise(resolve => setImmediate(resolve)); assert.equal(remote.calls.length, calls);
});

test('concurrent publication serializes durable intents and omits local paths from every journal record', async t => {
    const plan = await fixture(t, { tiles: 6 }), remote = fakeR2(), put = remote.bucket.put;
    let journalActive = 0, journalPeak = 0; const intents = new Set(), events = [];
    remote.bucket.put = async (key, bytes, options) => { assert.ok(intents.has(key), 'durable intent precedes PUT'); return put(key, bytes, options); };
    await publishAddressSnapshot(remote.bucket, plan, { checkpoint: async value => {
        journalActive++; journalPeak = Math.max(journalPeak, journalActive);
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(value.object?.file, undefined);
        if (value.stage === 'write-intent') intents.add(value.object.key);
        events.push(value); journalActive--;
    } });
    assert.equal(journalPeak, 1); assert.equal(intents.size, plan.publicPlan.objectCount);
    const barrier = events.findIndex(value => value.stage === 'data-verified-manifest-absent');
    const manifestIntent = events.findIndex(value => value.stage === 'write-intent' && value.object.key === plan.manifest.key);
    assert.ok(barrier >= 0 && barrier < manifestIntent);
    assert.equal(events[barrier].verified, plan.objects.length);
    assert.equal(JSON.stringify(events).includes(plan.directory), false);
});
