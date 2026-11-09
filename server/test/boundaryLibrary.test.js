import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoundaryPostgres } from './helpers/boundaryPostgres.js';

test('private library freezes exact owner drawing and replays even after source deletion and retirement', async t => {
    const { pg, source, request } = await createBoundaryPostgres(t);
    const path = 'boundary-library';
    const payload = { requestId: 'save-one', name: '  North  ', groupName: ' Parks ', source };
    const post = (body, user) => request(path, { method: 'POST', body, user });
    assert.equal((await request(path,{user:null})).status,401);
    assert.equal((await request(path,{user:13})).status,403);
    assert.equal((await post(payload,12)).status,404);
    assert.equal((await post({...payload, drawing:{} })).status,400);
    for (const [override, code] of [[{revision:8},'BOUNDARY_SOURCE_STALE'],
        [{annotationId:'gone'},'BOUNDARY_SOURCE_STALE'],[{annotationId:'line'},'BOUNDARY_SOURCE_UNSUPPORTED']]) {
        assert.equal((await post({...payload, source:{...source,...override}})).json.code,code);
    }
    const saves = await Promise.all([post(payload),post(payload)]);
    assert.deepEqual(saves.map(r=>r.json.replayed).sort(),[false,true]);
    const item = saves[0].json.item;
    assert.deepEqual(saves[1].json.item,item);
    assert.equal(item.name,'North');
    assert.equal(item.groupName,'Parks');
    assert.equal(item.sourceName,'Original shape');
    assert.equal(item.sourceGroupName,'Original group');
    assert.deepEqual(item.source,source);
    assert.equal(item.pointCount,2);
    assert.equal(item.area.type,'circle');
    assert.match(item.snapshotSha256,/^[a-f0-9]{64}$/);
    for (const key of ['id','isShared','resourceLinks','image']) assert.equal(key in item.drawing,false);
    assert.deepEqual((await request(path+'/'+item.id)).json,item);
    assert.deepEqual((await request(path,{user:12})).json.items,[]);
    assert.equal((await request(path+'/'+item.id,{user:12})).status,404);
    assert.equal((await request(path+'/'+item.id,{user:12,method:'DELETE'})).status,404);
    await pg.exec('DELETE FROM my_maps WHERE id=41');
    assert.deepEqual((await request(path+'/'+item.id)).json,item);
    for (let i=0;i<2;i++) assert.deepEqual((await request(path+'/'+item.id,{method:'DELETE'})).json,{id:item.id,retired:true});
    assert.equal((await request(path+'/'+item.id)).status,404);
    assert.deepEqual((await request(path)).json.items,[]);
    assert.deepEqual((await post({...payload,name:'North',groupName:'Parks'})).json,{item,replayed:true});
    assert.equal((await post({...payload,name:'Other'})).json.code,'BOUNDARY_REQUEST_CONFLICT');
});

test('library pages expose only summary fields and respect literal metadata filters', async t => {
    const {source,request} = await createBoundaryPostgres(t);
    for (const [name,groupName] of [['Red %','Art'],['Blue','Art'],['Green','Trails']]) {
        const result = await request('boundary-library',{method:'POST',body:{name,groupName,source,requestId:'save-'+groupName+name.length}});
        assert.equal(result.status,201);
    }
    const page = (params='') => request('boundary-library'+params).then(r=>r.json);
    const first = await page('?limit=2');
    assert.equal(first.items.length,2);
    assert.deepEqual(Object.keys(first.items[0]).sort(),['id','revision','name','groupName','sourceGroupName','type','sourceName','createdAt','snapshotSha256'].sort());
    const second = await page('?limit=2&cursor='+first.nextCursor);
    assert.equal(second.nextCursor,null);
    assert.equal(new Set([...first.items,...second.items].map(row=>row.id)).size,3);
    assert.deepEqual((await page('?search=%25')).items.map(i=>i.name),['Red %']);
    assert.deepEqual((await page('?name=green&group=Trails')).items.map(i=>i.name),['Green']);
    assert.equal((await page('?search=original')).items.length,3);
    assert.equal((await request('boundary-library?limit=100000')).status,400);
    assert.equal((await request('boundary-library?cursor=broken')).status,400);
});

test('owner pagination continues beyond the first 50 matches and ends at the last visible entry', async t => {
    const { pg, source, request } = await createBoundaryPostgres(t);
    const saved = await request('boundary-library', { method: 'POST',
        body: { requestId: 'seed', name: 'Matched', source } });
    assert.equal(saved.status, 201);
    await pg.exec(`INSERT INTO boundary_library_items(owner_id,request_id,payload_hash,name,source_name,type,
        source,drawing,area,point_count,snapshot_sha256)
        SELECT owner_id,'seed-' || i,payload_hash,name,source_name,type,source,drawing,area,point_count,snapshot_sha256
        FROM boundary_library_items CROSS JOIN generate_series(1,52) AS i`);
    const { json: first } = await request('boundary-library?name=Matched');
    const { json: last } = await request('boundary-library?name=Matched&cursor=' + first.nextCursor);
    assert.equal(first.items.length, 50);
    assert.equal(last.items.length, 3);
    assert.equal(last.nextCursor, null);
    assert.equal(new Set([...first.items, ...last.items].map(row => row.id)).size, 53);
});

test('a source revision advanced during snapshot validation cannot be persisted under the old revision', async t => {
    const { createBoundaryLibraryRepository } = await import('../src/utils/boundaryLibraryRepository.js');
    const { pg, source } = await createBoundaryPostgres(t);
    const repo = createBoundaryLibraryRepository(async (sql, params) => {
        const { rows } = await pg.query(sql, params);
        if (sql.includes('jsonb_array_elements')) await pg.exec('UPDATE my_map_print_annotation_documents SET revision=8 WHERE map_id=41');
        return rows;
    });
    await assert.rejects(repo.save(11, { requestId: 'source-race', name: 'North', source }),
        { status: 409, code: 'BOUNDARY_SOURCE_STALE' });
    assert.deepEqual((await pg.query('SELECT id FROM boundary_library_items')).rows, []);
});
