import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileAddressSnapshotRecords } from './build-address-snapshot.mjs';
import { loadAddressPublicationPlan, publishAddressSnapshot, verifyAddressPublication, runAddressPublisher, validateAddressOperatorConfig } from './publish-address-snapshot.mjs';

async function fixture(t) {
    const directory = await mkdtemp(join(tmpdir(), 'address-publisher-test-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const compiled = compileAddressSnapshotRecords([
        ['012345', '1', 'Fictional Road', 'Fictional block', '1 Fictional Road', '1.38', '103.75'],
        ['012346', '2', 'Fictional Road', 'Fictional block', '2 Fictional Road', '1.3801', '103.7501'],
    ], { sourceSha256: 'a'.repeat(64), preparedAt: '2026-11-03T00:00:00.000Z' });
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
    await assert.rejects(publishAddressSnapshot(remote.bucket, plan), /occupied/);
    assert.equal(remote.calls.filter(c => c.type === 'put').length, 0);
});

test('an object appearing between head and put is never overwritten or retried', async t => {
    const plan = await fixture(t), remote = fakeR2(), put = remote.bucket.put;
    remote.bucket.put = async (key, bytes, options) => { remote.objects.set(key, { bytes: Buffer.from('concurrent-original') }); return put(key, bytes, options); };
    await assert.rejects(publishAddressSnapshot(remote.bucket, plan), /Atomic create-only/);
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
        await assert.rejects(publishAddressSnapshot(remote.bucket, plan), /verification failed/);
        assert.equal(remote.objects.has(plan.manifest.key), false);
    }
});

test('local artifact changes after review fail before writing and a partial prefix cannot resume', async t => {
    const plan = await fixture(t), remote = fakeR2();
    await writeFile(plan.objects[0].file, 'changed');
    await assert.rejects(publishAddressSnapshot(remote.bucket, plan), /Local artifact changed/);
    assert.equal(remote.calls.filter(c => c.type === 'put').length, 0);
    remote.objects.set(plan.objects[0].key, { bytes: Buffer.from('partial') });
    await assert.rejects(publishAddressSnapshot(remote.bucket, plan), /occupied/);
});

test('write-intent checkpoint failure prevents that write and no automatic retry occurs', async t => {
    const plan = await fixture(t), remote = fakeR2();
    await assert.rejects(publishAddressSnapshot(remote.bucket, plan, { checkpoint: async value => { if (value.stage === 'write-intent') throw Error('Receipt unavailable'); } }), /Receipt unavailable/);
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
