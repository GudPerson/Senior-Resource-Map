import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoundaryPostgres } from './helpers/boundaryPostgres.js';

test('guided map preconditions, one-asset concurrent replay, and owner-scoped deleted-map tombstone', async t => {
    const {pg, request} = await createBoundaryPostgres(t);
    const path = 'boundary-zone-workflows/map', requestId = 'draw-once';
    const post = (hardAssetId=21,user=11) => request(path,{user,method:'POST',body:{requestId,hardAssetId}});
    const save = (resourceId,user=11) => request('favorites/save',{user,method:'POST',body:{resourceType:'hard',resourceId}});
    assert.equal((await request(path+'/'+requestId,{user:null})).status,401);
    assert.equal((await post(22)).status,403);
    assert.equal((await post()).json.code,'BOUNDARY_ZONE_PLACE_NOT_SAVED');
    await pg.exec("INSERT INTO user_favorites(user_id,resource_type,resource_id) VALUES(11,'hard',23)");
    assert.equal((await post(23)).json.code,'BOUNDARY_ZONE_PLACE_LOCATION_REQUIRED');
    assert.deepEqual((await pg.query('SELECT id FROM my_maps')).rows,[{id:41}]);
    assert.equal((await pg.query('SELECT * FROM boundary_map_requests')).rows.length,0);
    assert.equal((await pg.query('SELECT resource_id FROM user_favorites')).rows.length,1);
    assert.equal((await save(21)).json.saved,true);
    const [a,b] = await Promise.all([post(),post()]);
    assert.equal(a.json.state,'ready');
    assert.deepEqual(a.json,b.json);
    assert.equal(a.json.name,'Fictional Cedar Place');
    assert.match(a.json.outcomeHash,/^[a-f0-9]{64}$/);
    const [map] = (await pg.query('SELECT * FROM my_maps WHERE id=$1',[a.json.mapId])).rows;
    assert.equal(map.user_id,11);
    assert.equal(map.is_shared,false);
    assert.equal(map.embed_enabled,false);
    const [asset] = (await pg.query('SELECT * FROM my_map_assets')).rows;
    assert.equal(asset.resource_id,21);
    assert.equal(asset.map_id,map.id);
    assert.deepEqual(asset.snapshot.places.map(p=>[p.placeId,p.lat,p.lng]),[[21,1.31,103.81]]);
    assert.equal((await post(22)).json.code,'BOUNDARY_REQUEST_CONFLICT');
    assert.deepEqual((await request(path+'/'+requestId)).json,a.json);
    assert.equal((await request(path+'/'+requestId,{user:12})).status,404);
    // Discard the first POST response, then reconcile after Saved/authority changed.
    await pg.exec("DELETE FROM user_favorites WHERE user_id=11 AND resource_type='hard' AND resource_id=21");
    await pg.exec('UPDATE hard_asset_staff_memberships SET revoked_at=now() WHERE user_id=11 AND hard_asset_id=21');
    assert.deepEqual((await post()).json, a.json);
    assert.equal((await save(22,12)).json.saved,true);
    const other = await post(22,12);
    assert.equal(other.json.state,'ready');
    assert.notEqual(other.json.mapId,map.id);
    await pg.query('DELETE FROM my_maps WHERE id=$1',[map.id]);
    assert.equal((await request(path+'/'+requestId)).json.code,'BOUNDARY_ZONE_MAP_UNAVAILABLE');
    assert.equal((await post()).json.code,'BOUNDARY_ZONE_MAP_UNAVAILABLE');
    assert.equal((await pg.query('SELECT count(*)::int AS n FROM my_maps')).rows[0].n,2);
});

test('failed initial membership write rolls back claim and private map, permitting the same request', async t => {
    const {pg,request}=await createBoundaryPostgres(t);
    const body={requestId:'draw-rollback',hardAssetId:21};
    await pg.exec("INSERT INTO user_favorites(user_id,resource_type,resource_id) VALUES(11,'hard',21)");
    await pg.exec('ALTER TABLE my_map_assets ADD CONSTRAINT fictional_failure CHECK (resource_id <> 21)');
    const post=()=>request('boundary-zone-workflows/map',{method:'POST',body});
    assert.equal((await post()).status,503);
    assert.deepEqual((await pg.query('SELECT id FROM my_maps')).rows,[{id:41}]);
    assert.equal((await pg.query('SELECT * FROM boundary_map_requests')).rows.length,0);
    await pg.exec('ALTER TABLE my_map_assets DROP CONSTRAINT fictional_failure');
    assert.equal((await post()).json.state,'ready');
});

test('membership revoked between Place validation and SQL claim leaves zero new writes', async t => {
    const { createBoundaryWorkflowRepository } = await import('../src/utils/boundaryWorkflowRepository.js');
    const { pg } = await createBoundaryPostgres(t);
    await pg.exec("INSERT INTO user_favorites(user_id,resource_type,resource_id) VALUES(11,'hard',21)");
    const repo = createBoundaryWorkflowRepository(async (sql, params) => {
        const { rows } = await pg.query(sql, params);
        if (sql.includes('xmin::text AS version')) {
            await pg.exec('UPDATE hard_asset_staff_memberships SET revoked_at=now() WHERE user_id=11 AND hard_asset_id=21');
        }
        return rows;
    });
    const actor = { id: 11, role: 'standard', hardAssetStaffAccess: [{ hardAssetId: 21, staffRole: 'owner' }] };
    await assert.rejects(repo.start(actor, { requestId: 'revoked', hardAssetId: 21 }), { status: 409 });
    assert.deepEqual((await pg.query('SELECT id FROM my_maps')).rows, [{ id: 41 }]);
    assert.deepEqual((await pg.query('SELECT request_id FROM boundary_map_requests')).rows, []);
});

test('durable cancellation is owner scoped, survives Place access revocation and retains the accepted map',async t=>{
    const {pg,request}=await createBoundaryPostgres(t);
    await pg.exec("INSERT INTO user_favorites(user_id,resource_type,resource_id) VALUES(11,'hard',21)");
    const path='boundary-zone-workflows/map',body={requestId:'cancel-owned-starter',hardAssetId:21};
    const accepted=(await request(path,{method:'POST',body})).json;
    const cancel=user=>request(path+'/'+body.requestId+'/cancel',{method:'POST',user});
    assert.equal((await cancel(12)).status,404);
    await pg.exec('UPDATE hard_asset_staff_memberships SET revoked_at=now() WHERE user_id=11');
    const expected={...accepted,guidanceCancelled:true};
    assert.deepEqual((await cancel(11)).json,expected);assert.deepEqual((await cancel(11)).json,expected);
    assert.deepEqual((await request(path+'/'+body.requestId)).json,expected);
    assert.deepEqual((await request(path,{method:'POST',body})).json,expected);
    assert.deepEqual((await pg.query('SELECT resource_id FROM my_map_assets WHERE map_id=$1',[accepted.mapId])).rows,[{resource_id:21}]);
});

test('cancelling after the guided map was deleted in another tab is owner-scoped, idempotent, reconcilable, and permits a new drawing', async t => {
    const { pg, request } = await createBoundaryPostgres(t);
    await pg.exec("INSERT INTO user_favorites(user_id,resource_type,resource_id) VALUES(11,'hard',21)");
    const path = 'boundary-zone-workflows/map', body = { requestId: 'cancel-deleted-map', hardAssetId: 21 };
    const accepted = (await request(path, { method: 'POST', body })).json;
    assert.equal(accepted.state, 'ready');

    // Simulate the owner deleting the guided Care Map in another tab (ON DELETE SET NULL).
    await pg.query('DELETE FROM my_maps WHERE id = $1', [accepted.mapId]);
    assert.equal((await request(path + '/' + body.requestId)).json.code, 'BOUNDARY_ZONE_MAP_UNAVAILABLE');
    assert.equal((await request(path, { method: 'POST', body })).json.code, 'BOUNDARY_ZONE_MAP_UNAVAILABLE');

    // Access protections remain enforced on the deleted-map tombstone.
    const cancel = user => request(path + '/' + body.requestId + '/cancel', { method: 'POST', user });
    assert.equal((await cancel(null)).status, 401);
    assert.equal((await cancel(12)).status, 404);
    assert.equal((await request(path + '/' + body.requestId)).json.code, 'BOUNDARY_ZONE_MAP_UNAVAILABLE');

    // Cancelling after map deletion succeeds, is idempotent on repeat calls, and reconciles on GET/replay.
    const expected = { ...accepted, mapId: null, guidanceCancelled: true };
    const firstCancel = await cancel(11);
    assert.equal(firstCancel.status, 200);
    assert.deepEqual(firstCancel.json, expected);
    const secondCancel = await cancel(11);
    assert.equal(secondCancel.status, 200);
    assert.deepEqual(secondCancel.json, expected);
    const reconciledGet = await request(path + '/' + body.requestId);
    assert.equal(reconciledGet.status, 200);
    assert.deepEqual(reconciledGet.json, expected);
    assert.equal((await request(path + '/' + body.requestId, { user: 12 })).status, 404);
    assert.deepEqual((await request(path, { method: 'POST', body })).json, expected);

    // Starting a new drawing afterward with a fresh request ID succeeds and creates a new map.
    const next = await request(path, { method: 'POST', body: { requestId: 'draw-after-deleted-cancel', hardAssetId: 21 } });
    assert.equal(next.status, 200);
    assert.equal(next.json.state, 'ready');
    assert.notEqual(next.json.mapId, accepted.mapId);
    assert.equal(next.json.guidanceCancelled, undefined);
});
