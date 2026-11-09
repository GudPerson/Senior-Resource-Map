import test from 'node:test';
import assert from 'node:assert/strict';
import { jobsFixture } from './helpers/boundaryJobFixture.js';

test('one accepted commit publishes an entire exact postal set, checked private snapshot and outcomes atomically', async (t) => {
    const { pg, post, row, act, advance, rows } = await jobsFixture(t);
    const res = await post([row, { ...row, hardAssetId: 23, rowKey: 'next', zoneCode: 'mix 7', saveToLibrary: false }]);
    assert.equal(res.status, 202);
    const ready = await advance(res.json);
    await pg.exec('UPDATE hard_asset_staff_memberships SET revoked_at=now() WHERE hard_asset_id=23');
    assert.equal((await act(ready, 'commit', { requestId: 'create' })).status, 403);
    await pg.exec('UPDATE hard_asset_staff_memberships SET revoked_at=NULL WHERE hard_asset_id=23');
    const commit = () => act(ready, 'commit', { requestId: 'create' });
    const [a, b] = await Promise.all([commit(), commit()]);
    assert.equal(a.json.state, 'committing');
    assert.deepEqual(b.json, a.json);
    const job = a.json;
    await pg.exec("ALTER TABLE audience_zone_postal_codes ADD CONSTRAINT fictional_failure CHECK (postal_code<>'001235')");
    assert.equal((await act(job, 'advance')).status, 503);
    assert.deepEqual(await rows('SELECT id FROM audience_zones'), []);
    assert.deepEqual(await rows('SELECT id FROM boundary_library_items'), []);
    await pg.exec('ALTER TABLE audience_zone_postal_codes DROP CONSTRAINT fictional_failure');
    const first = (await act(job, 'advance')).json;
    assert.equal(first.rows[0].status, 'created');
    assert.equal(first.rows[1].status, 'ready');
    await pg.exec("INSERT INTO audience_zones(name,zone_code) VALUES ('code reserved','mix 7')");
    const done = await advance(first);
    assert.equal(done.rows[1].errorCode, 'BOUNDARY_ZONE_CODE_CONFLICT');
    assert.equal(done.rows[0].zoneId, first.rows[0].zoneId);
    assert.deepEqual(await rows("SELECT postal_code FROM audience_zone_postal_codes ORDER BY postal_code"), [{ postal_code: '001234' }, { postal_code: '001235' }]);
    assert.deepEqual(await rows("SELECT zone_code,hard_asset_id,sharing_status FROM audience_zones WHERE created_by_user_id=11"), [{ zone_code: 'MiX 7', hard_asset_id: 21, sharing_status: 'local' }]);
    assert.deepEqual(await rows("SELECT id FROM boundary_library_items"), [{ id: first.rows[0].libraryId }]);
    assert.deepEqual((await commit()).json, done);
});

test('mixed same/different Places, declined curation, existing library and zero matches publish exactly the reviewed rows', async (t) => {
    const f = await jobsFixture(t), { pg, row, source, post, act, advance, rows, originalRequest } = f;
    const curated = (await originalRequest('boundary-library', { method: 'POST', body: { requestId: 'saved', name: 'Curated', source } })).json.item;
    await pg.exec(`UPDATE my_map_print_annotation_documents SET revision=8,annotations=annotations||
        '[{"id":"empty","type":"circle","points":[[1.5,104],[1.501,104]]}]'::jsonb WHERE map_id=41`);
    const selected = [
        { ...row, source: { libraryId: curated.id, revision: 1 } },
        { ...row, rowKey: 'other', hardAssetId: 23, source: { ...source, revision: 8 }, zoneCode: null, saveToLibrary: false },
        { ...row, rowKey: 'empty', source: { ...source, annotationId: 'empty', revision: 8 }, zoneCode: null }
    ];
    let j = (await post(selected)).json;
    assert.equal(j.state, 'preparing');
    // Removing the original sources must neither disrupt the scan nor change review geometry.
    await pg.exec("UPDATE boundary_library_items SET retired_at=now(); DELETE FROM my_maps WHERE id=41");
    const frozen = await f.request('boundary-zone-jobs/' + j.id + '/rows/first/source');
    assert.equal(frozen.status, 200);
    assert.deepEqual(frozen.json.drawing.points, [[1.31, 103.81], [1.32, 103.82]]);
    assert.equal(frozen.json.source.libraryId, curated.id);
    assert.equal(frozen.json.saveToLibrary, true);
    assert.equal((await f.request('boundary-zone-jobs/' + j.id + '/rows/first/source', { user: 12 })).status, 404);
    j = await advance(j);
    assert.deepEqual(j.rows.map(r => r.postalCount), [2, 2, 0]);
    j = await advance((await act(j, 'commit', { requestId: 'make' })).json);
    assert.deepEqual(j.rows.map(r => r.status), ['created', 'created', 'empty']);
    assert.deepEqual(await rows('SELECT hard_asset_id,zone_code FROM audience_zones ORDER BY id'), [
        { hard_asset_id: 21, zone_code: 'MiX 7' }, { hard_asset_id: 23, zone_code: null }
    ]);
    assert.deepEqual(await rows('SELECT id FROM boundary_library_items'), [{ id: curated.id }]);
    assert.deepEqual(await rows('SELECT audience_zone_id,postal_code FROM audience_zone_postal_codes ORDER BY audience_zone_id,postal_code'), j.rows.slice(0, 2).flatMap(r => ['001234', '001235'].map(postal_code => ({ audience_zone_id: r.zoneId, postal_code }))));
});

test('revocation of a different Place during finalization fences the SQL write; personal cancellation retains prior success', async (t) => {
    const { row, pg, post, act, advance, data, request, rows } = await jobsFixture(t);
    const j = await advance((await post([row, { ...row, rowKey: 'next', zoneCode: null, hardAssetId: 23 }])).json);
    const committing = (await act(j, 'commit', { requestId: 'make' })).json;
    const first = (await act(committing, 'advance')).json;
    const read = data.bucket.get.bind(data.bucket);
    data.bucket.get = async (key) => {
        await pg.exec('UPDATE hard_asset_staff_memberships SET revoked_at=now() WHERE hard_asset_id=21');
        return read(key);
    };
    assert.equal((await act(first, 'advance')).status, 409);
    const cancelled = (await act(first, 'cancel')).json;
    assert.equal(cancelled.state, 'cancelled');
    assert.equal(cancelled.rows[0].zoneId, first.rows[0].zoneId);
    assert.equal(cancelled.rows[1].zoneId, null);
    assert.equal((await request('boundary-zone-jobs/' + j.id)).json.state, 'cancelled');
    assert.deepEqual(await rows('SELECT id FROM audience_zones'), [{ id: first.rows[0].zoneId }]);
});

test('duplicate create/advance claims and a lost commit response never produce a second membership or library snapshot', async (t) => {
    const { post, act, advance, rows, request } = await jobsFixture(t);
    const [a, b] = await Promise.all([post(), post()]);
    assert.equal(a.status, 202);
    assert.equal(b.status, 202);
    assert.deepEqual(a.json, b.json);
    const [x, y] = await Promise.all([act(a.json, 'advance'), act(b.json, 'advance')]);
    assert.deepEqual([x.status, y.status].sort(), [200, 409]);
    const ready = await advance((await request('boundary-zone-jobs/' + a.json.id)).json);
    const committing = (await act(ready, 'commit', { requestId: 'unique' })).json;
    const completed = await advance(committing);
    assert.equal((await act(ready, 'commit', { requestId: 'other-key' })).status, 409);
    assert.deepEqual((await act(ready, 'commit', { requestId: 'unique' })).json, completed);
    assert.equal((await rows('SELECT id FROM audience_zones')).length, 1);
    assert.equal((await rows('SELECT id FROM boundary_library_items')).length, 1);
});
