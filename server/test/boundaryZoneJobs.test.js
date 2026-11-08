import test from 'node:test';
import assert from 'node:assert/strict';
import { jobsFixture, path } from './helpers/boundaryJobFixture.js';

test('the last invalid Place, stale source, duplicate normalized code or oversized request leaves no job', async (t) => {
    const { row, post, request, rows, pg, source } = await jobsFixture(t);
    const second = { ...row, rowKey: 'second', zoneCode: null };
    assert.equal((await post([row, { ...second, hardAssetId: 22 }])).status, 403);
    assert.equal((await post([row, { ...second, source: { ...source, revision: 6 } }])).status, 409);
    assert.equal((await post([row, { ...second, zoneCode: 'MiX 7' }])).status, 409);
    assert.equal((await request(path, { method: 'POST', body: { padding: 'a'.repeat(70000) } })).status, 413);
    // A large stored rendering list must not reach projection across a batch.
    await pg.query("UPDATE my_map_print_annotation_documents SET annotations=$1 WHERE map_id=41", [JSON.stringify([
            { id: 'source-shape', type: 'polygon', boundarySource: 'kml', points: Array(4200).fill([1, 103]), controlPoints: Array(4200).fill([1, 103]) }
        ])]);
    assert.equal((await post([row, second, { ...second, rowKey: 'third' }])).json.code, 'BOUNDARY_FREEZE_BUDGET');
    assert.deepEqual(await rows('SELECT id FROM boundary_zone_jobs'), []);
});

test('private recovery, freeze, lease expiry, stale action and explicit pause/resume preserve staged progress', async (t) => {
    const { row, post, act, request, pg, advance, rows } = await jobsFixture(t);
    const res = await post();
    assert.equal(res.status, 202);
    let j = res.json;
    assert.equal(j.rows[0].zoneCode, 'MiX 7');
    assert.equal((await post([{ ...row, zoneCode: 'different' }])).status, 409);
    assert.equal((await request(path + '/' + j.id, { user: 12 })).status, 404);
    assert.deepEqual((await request(path, { user: 12 })).json.items, []);
    assert.equal((await request(path)).json.items[0].id, j.id);
    await pg.exec("UPDATE boundary_zone_jobs SET lease_id='busy',lease_until=now()+interval '1 hour'");
    assert.equal((await act(j, 'advance')).status, 409);
    await pg.exec("UPDATE boundary_zone_jobs SET lease_until=now()-interval '1 second'");
    const p = (await act(j, 'pause')).json;
    assert.equal(p.state, 'paused');
    assert.equal((await act(j, 'advance')).status, 409);
    j = (await act(p, 'resume')).json;
    await pg.exec('DELETE FROM my_maps WHERE id=41');
    j = await advance(j);
    assert.equal(j.state, 'ready');
    assert.equal(j.rows[0].postalCount, 2);
    assert.equal(j.rows[0].zoneId, null);
    assert.equal(j.rows[0].libraryId, null);
    assert.deepEqual(await rows('SELECT id FROM audience_zones'), []);
    assert.deepEqual(await rows('SELECT id FROM boundary_library_items'), []);
    assert.equal((await act(j, 'cancel')).json.state, 'cancelled');
});

test('both saved-map consumers accept actual revision zero but reject stale zero and raw drawings', async (t) => {
    const f = await jobsFixture(t), { source, row, pg } = f;
    const legacy = { ...source, revision: 0 };
    const request = f.originalRequest;
    const save = (key) => request('boundary-library', { method: 'POST', body: { requestId: key, name: 'Legacy', source: legacy } });
    await pg.exec('UPDATE my_map_print_annotation_documents SET revision=0 WHERE map_id=41');
    assert.equal((await save('zero')).status, 201);
    assert.equal((await f.post([{ ...row, source: legacy }])).status, 202);
    await pg.exec('UPDATE my_map_print_annotation_documents SET revision=8 WHERE map_id=41');
    assert.equal((await save('stale-zero')).status, 409);
    assert.equal((await f.post([{ ...row, source: legacy }], 'stale-job')).status, 409);
    assert.equal((await f.post([{ ...row, source: { ...legacy, points: [] } }], 'raw')).status, 400);
});

test('bounded maintenance expires only an idle personal job and can purge staging without forgetting accepted outcomes', async (t) => {
    const { row, pg, post, act, advance, rows } = await jobsFixture(t);
    const ready = await advance((await post()).json), committed = await advance((await act(ready, 'commit', { requestId: 'commit' })).json);
    const idle = await advance((await post([{ ...row, zoneCode: null }], 'idle')).json);
    await pg.query(`INSERT INTO boundary_zone_staged_postals SELECT $1,'first',lpad(i::text,6,'0')
        FROM generate_series(2000,2399) i`, [committed.id]);
    await pg.exec("UPDATE boundary_zone_jobs SET updated_at=now()-interval '31 days'");
    await post([{ ...row, zoneCode: null }], 'newer');
    assert.deepEqual(await rows('SELECT id FROM audience_zones'), [{ id: committed.rows[0].zoneId }]);
    assert.deepEqual(await rows('SELECT id FROM boundary_library_items'), [{ id: committed.rows[0].libraryId }]);
    assert.deepEqual(await rows('SELECT id FROM my_maps'), [{ id: 41 }]);
    assert.equal((await rows('SELECT state FROM boundary_zone_jobs WHERE id=' + idle.id))[0].state, 'cancelled');
    assert.equal((await rows('SELECT * FROM boundary_zone_staged_postals')).length, 404 - 256);
    assert.equal((await rows('SELECT * FROM boundary_zone_staged_postals WHERE job_id=' + idle.id)).length, 2);
});

test('changed manifest ETag at READY fails durably and cannot be committed on a replacement release', async (t) => {
    const { row, pg, post, act, advance, request, data } = await jobsFixture(t);
    const ready = await advance((await post([row])).json), original = data.bucket.get.bind(data.bucket);
    data.bucket.get = async (key) => ({ ...await original(key), etag: 'replacement' });
    assert.equal((await act(ready, 'commit', { requestId: 'after-drift' })).json.code, 'BOUNDARY_SNAPSHOT_CHANGED');
    const current = (await request(path + '/' + ready.id)).json;
    assert.equal(current.state, 'failed');
    assert.equal(current.rows[0].errorCode, 'BOUNDARY_SNAPSHOT_CHANGED');
    assert.deepEqual((await pg.query('SELECT id FROM audience_zones')).rows, []);
});

test('projection and source-byte caps reject whole selections before canonical geometry work', async (t) => {
    const { pg, row, post, rows } = await jobsFixture(t);
    const saveShape = shape => pg.query("UPDATE my_map_print_annotation_documents SET annotations=$1 WHERE map_id=41", [JSON.stringify([{ id: 'source-shape', ...shape }])]);
    // 4,100 stored points are under the stored-point budget. Rounded polygon projections alone exceed the separate work budget.
    await saveShape({ type: 'polygon', points: Array(100).fill([1.31, 103.81]) });
    const batch = Array.from({ length: 41 }, (_, i) => ({ ...row, rowKey: 'row-' + i, zoneCode: null }));
    assert.equal((await post(batch)).json.code, 'BOUNDARY_FREEZE_BUDGET');
    await saveShape({ type: 'circle', points: [[1.31, 103.81], [1.32, 103.82]], obsoleteMetadata: 'x'.repeat(26000) });
    assert.equal((await post([...batch, ...batch.map(r => ({ ...r, rowKey: 'b-' + r.rowKey }))])).json.code, 'BOUNDARY_FREEZE_BUDGET');
    assert.deepEqual(await rows('SELECT id FROM boundary_zone_jobs'), []);
});

test('freeze write rechecks permissions and source revision after preflight but before creating a job', async (t) => {
    const { pg, post, rows, data } = await jobsFixture(t);
    const original = data.bucket.get.bind(data.bucket);
    data.bucket.get = async (key) => {
        await pg.exec('UPDATE hard_asset_staff_memberships SET revoked_at=now() WHERE hard_asset_id=21');
        return original(key);
    };
    assert.equal((await post()).status, 409);
    await pg.exec('UPDATE hard_asset_staff_memberships SET revoked_at=NULL WHERE hard_asset_id=21');
    data.bucket.get = async (key) => {
        await pg.exec('UPDATE my_map_print_annotation_documents SET revision=8 WHERE map_id=41');
        return original(key);
    };
    assert.equal((await post()).status, 409);
    assert.deepEqual(await rows('SELECT id FROM boundary_zone_jobs'), []);
    assert.deepEqual(await rows('SELECT row_key FROM boundary_zone_job_rows'), []);
});

test('actual application mount denies anonymous and guest callers while ordinary account can list empty private jobs', async (t) => {
    const { originalRequest } = await jobsFixture(t);
    assert.equal((await originalRequest(path, { user: null })).status, 401);
    assert.equal((await originalRequest(path, { user: 13 })).status, 403);
    assert.deepEqual((await originalRequest(path)).json, { items: [], nextCursor: null });
    assert.equal((await originalRequest(path + '?limit=101')).status, 400);
});

test('cleanup runs on new personal jobs, protecting current replays, foreign jobs and active leases', async (t) => {
    const { pg, row, post, request, act } = await jobsFixture(t);
    const start = async (key) => (await post([{ ...row, zoneCode: null }], key)).json;
    const current = await start('current');
    const foreign = await start('foreign');
    const leased = await start('leased');
    await start('idle');
    const next = await start('next');
    await pg.query('UPDATE boundary_zone_jobs SET owner_id=12 WHERE id=$1', [foreign.id]);
    await pg.query("UPDATE boundary_zone_jobs SET lease_id='active', lease_until=now()+interval '1 hour' WHERE id=$1", [leased.id]);
    await pg.exec("UPDATE boundary_zone_jobs SET updated_at=now()-interval '31 days'");
    const states = async () => (await pg.query('SELECT state FROM boundary_zone_jobs ORDER BY id')).rows.map(r => r.state);
    assert.equal((await request(path)).status, 200);
    assert.equal((await act(current, 'advance', { expectedRevision: current.revision + 1 })).status, 409);
    assert.deepEqual(await states(), Array(5).fill('preparing'));
    assert.equal((await start('current')).id, current.id);
    assert.deepEqual(await states(), Array(5).fill('preparing'));
    const created = await start('fresh');
    assert.ok(created.id > next.id);
    assert.deepEqual(await states(), ['cancelled', 'preparing', 'preparing', 'preparing', 'preparing', 'preparing']);
    await start('second-fresh');
    assert.deepEqual(await states(), ['cancelled', 'preparing', 'preparing', 'cancelled', 'preparing', 'preparing', 'preparing']);
});

test('accepted prepare and commit replays are read-only after revocation; outstanding work still requires live Place access', async (t) => {
    const { pg, post, request, act, advance, row, statements } = await jobsFixture(t);
    const outstanding = (await post([{ ...row, zoneCode: null }], 'outstanding')).json;
    const paused = (await act(outstanding, 'pause')).json;
    const ready = await advance((await post()).json);
    const commit = () => act(ready, 'commit', { requestId: 'reviewed' });
    const committing = (await commit()).json;
    await pg.exec('UPDATE hard_asset_staff_memberships SET revoked_at=now() WHERE hard_asset_id=21');
    const sqlStart = statements.length;
    assert.deepEqual((await post()).json, committing);
    assert.deepEqual((await commit()).json, committing);
    assert.ok(statements.length > sqlStart);
    assert.equal(statements.slice(sqlStart).some(sql => /\b(?:insert|update|delete)\b/i.test(sql)), false);
    assert.equal((await post([{ ...row, name: 'different' }])).status, 409);
    assert.equal((await post([row], 'new-request')).status, 403);
    assert.equal((await act(paused, 'resume')).status, 403);
    assert.equal((await act(committing, 'advance')).status, 403);
    assert.equal((await request(path + '/' + ready.id)).json.state, 'committing');
    assert.equal((await request(path)).json.items[0].id, ready.id);
    assert.equal((await act(committing, 'cancel')).json.state, 'cancelled');
});

for (const scenario of ['ready-revoked', 'preparing-revoked', 'committing-expired']) {
    test('manifest drift preserves the job when its failure transition is fenced: ' + scenario, async t => {
        const { pg, post, act, advance, request, data } = await jobsFixture(t);
        let job = (await post()).json;
        if (scenario !== 'preparing-revoked') job = await advance(job);
        if (scenario === 'committing-expired') job = (await act(job, 'commit', { requestId: 'accepted' })).json;
        const read = data.bucket.get.bind(data.bucket);
        data.bucket.get = async key => {
            if (scenario === 'committing-expired') {
                await pg.query("UPDATE boundary_zone_jobs SET lease_until=now()-interval '1 second' WHERE id=$1", [job.id]);
            } else {
                await pg.exec('UPDATE hard_asset_staff_memberships SET revoked_at=now() WHERE hard_asset_id=21');
            }
            return { ...await read(key), etag: 'changed' };
        };
        const action = job.state === 'ready' ? 'commit' : 'advance';
        const res = await act(job, action, action === 'commit' ? { requestId: 'new-intent' } : {});
        assert.equal(res.status, 409);
        assert.deepEqual((await request(path + '/' + job.id)).json, job);
    });
}

test('global zone-code lookup is skipped for every unauthorized Place assignment', async t => {
    const { pg, row, post, statements } = await jobsFixture(t);
    await pg.exec("INSERT INTO audience_zones(name,zone_code) VALUES ('Fictional', 'Existing')");
    const from = statements.length;
    const existing = await post([{ ...row, hardAssetId: 22, zoneCode: 'Existing' }]);
    const unknown = await post([{ ...row, hardAssetId: 22, zoneCode: 'Unknown' }]);
    assert.equal(unknown.status, 403);
    assert.deepEqual(existing, unknown);
    assert.equal(statements.slice(from).some(sql => /from\s+audience_zones\s+where\s+zone_code/i.test(sql)), false);
});

test('map document admission rejects unselected heavy content before expanding either annotation array', async t => {
    const { pg, row, post, statements } = await jobsFixture(t);
    await pg.exec("INSERT INTO my_maps(id,user_id,name) VALUES (42,11,'Second'); ALTER TABLE my_map_print_annotation_documents ALTER COLUMN annotations SET STORAGE EXTERNAL");
    await pg.exec(`UPDATE my_map_print_annotation_documents SET annotations = annotations ||
        jsonb_build_array(jsonb_build_object('id','unselected','type','line','text',repeat('x',2200000))) WHERE map_id=41`);
    await pg.exec('INSERT INTO my_map_print_annotation_documents(map_id,revision,annotations) SELECT 42,revision,annotations FROM my_map_print_annotation_documents WHERE map_id=41');
    const from = statements.length;
    const second = { ...row, rowKey: 'second', zoneCode: null, source: { ...row.source, mapId: 42 } };
    const res = await post([row, second]);
    assert.equal(res.json.code, 'BOUNDARY_FREEZE_BUDGET');
    assert.equal(statements.slice(from).some(sql => /jsonb_array_elements\s*\(/i.test(sql)), false);
});

test('each distinct chosen map drawing is inspected once before reusing it across rows', async t => {
    const { pg, post, row } = await jobsFixture(t);
    const inspections = [];
    const query = pg.query.bind(pg);
    pg.query = async (sql, ...args) => {
        const result = await query(sql, ...args);
        if (/my_map_print_annotation_documents/i.test(sql) && /jsonb_array_elements\s*\(/i.test(sql) && !/insert into/i.test(sql)) {
            inspections.push(result.rows.length);
        }
        return result;
    };
    const repeated = Array.from({ length: 24 }, (_, i) => ({ ...row, zoneCode: null, rowKey: 'r' + i }));
    const res = await post(repeated);
    assert.equal(res.status, 202);
    assert.equal(res.json.rows.length, 24);
    assert.deepEqual(inspections, [1]);
});

test('the raw map document cap leaves a 201-item private library selection available', async t => {
    const { pg, post, row, source, originalRequest, statements } = await jobsFixture(t);
    const tooManyMaps = [41, 42, 43, 44, 45].map(mapId =>
        ({ ...row, rowKey: 'm' + mapId, zoneCode: null, source: { ...source, mapId } }));
    const start = statements.length;
    assert.equal((await post(tooManyMaps)).json.code, 'BOUNDARY_FREEZE_BUDGET');
    assert.equal(statements.slice(start).some(sql => /my_map_print_annotation_documents/i.test(sql)), false);

    const initial = await originalRequest('boundary-library', {
        method: 'POST', body: { requestId: 'first', source, name: 'Fictional source', groupName: 'Example' },
    });
    assert.equal(initial.status, 201);
    await pg.query(`INSERT INTO boundary_library_items
        (owner_id,request_id,payload_hash,name,group_name,type,source,drawing,area,point_count,snapshot_sha256)
        SELECT owner_id,'example-'||n,payload_hash,name,group_name,type,source,drawing,area,point_count,snapshot_sha256
        FROM boundary_library_items CROSS JOIN generate_series(1,200) n WHERE id=$1`, [initial.json.item.id]);
    const candidates = (await pg.query('SELECT id,revision FROM boundary_library_items ORDER BY id')).rows
        .map(({ id, revision }) => ({ ...row, rowKey: 'l' + id, zoneCode: null, source: { libraryId: id, revision } }));
    const result = await post(candidates, 'all-library');
    assert.equal(result.status, 202);
    assert.equal(result.json.rows.length, 201);
});
