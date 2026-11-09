import test from 'node:test';
import assert from 'node:assert/strict';
import { jobsFixture } from './helpers/boundaryJobFixture.js';
import { createBoundaryPostgres } from './helpers/boundaryPostgres.js';
import { isAssetVisible } from '../src/utils/visibility.js';

test('full App starter with unrelated Saved item creates exactly one canonical private Place pin',async t=>{
 const f=await createBoundaryPostgres(t);
 await f.pg.exec("INSERT INTO user_favorites(user_id,resource_type,resource_id) VALUES(11,'hard',21),(11,'hard',22)");
 const payload={requestId:'journey-starter',hardAssetId:21},post=()=>f.request('boundary-zone-workflows/map',{method:'POST',body:payload});
 const result=await post();assert.equal(result.status,200);
 const map=(await f.pg.query('SELECT * FROM my_maps WHERE id=$1',[result.json.mapId])).rows[0];
 assert.equal(map.name,'Fictional Cedar Place');assert.equal(map.is_shared,false);assert.equal(map.embed_enabled,false);
 const all=(await f.pg.query('SELECT * FROM my_map_assets WHERE map_id=$1 ORDER BY id',[map.id])).rows;
 assert.deepEqual(all.map(a=>a.resource_id),[21]);assert.deepEqual(all.flatMap(a=>a.snapshot.places.map(p=>[p.placeId,p.lat,p.lng])),[[21,1.31,103.81]]);
 assert.deepEqual((await post()).json,result.json);assert.equal((await f.request('boundary-zone-workflows/map/journey-starter',{user:12})).status,404);
});

test('real job factory and PostgreSQL: library freeze, DIFFERENT/SAME Place batches, explicit commit, recovery and exact postal membership',async t=>{
 // Job factory injects a pinned fictional R2 snapshot; starter/library endpoints use the full App.
 const f=await jobsFixture(t),{pg,source}=f;
 await pg.exec("UPDATE hard_asset_staff_memberships SET staff_role='owner' WHERE user_id=11 AND hard_asset_id=22");
 const saved=await f.originalRequest('boundary-library',{method:'POST',body:{requestId:'journey-library',name:'Fictional frozen north',source}});
 assert.equal(saved.status,201);const item=saved.json.item;
 const selections=[21,22].map((hardAssetId,i)=>({...f.row,rowKey:'row-'+i,hardAssetId,name:i?'Birch South':'Cedar North',zoneCode:i?'Case-S':'Case-N',source:{libraryId:item.id,revision:item.revision},saveToLibrary:false}));
 const first=await f.post(selections,'journey-different');assert.equal(first.status,202);
 let ready=await f.advance(first.json);assert.equal(ready.state,'ready');assert.deepEqual(ready.rows.map(r=>r.postalCount),[2,2]);
 assert.deepEqual(await f.rows('SELECT id FROM audience_zones'),[]);assert.equal((await f.rows('SELECT id FROM boundary_library_items')).length,1);
 await pg.exec('UPDATE boundary_library_items SET retired_at=now(); DELETE FROM my_maps WHERE id=41');
 const frozen=await f.request(`boundary-zone-jobs/${ready.id}/rows/row-0/source`);assert.equal(frozen.status,200);assert.deepEqual(frozen.json.drawing,item.drawing);
 assert.equal(frozen.json.source.displayName,"Fictional frozen north");
 assert.equal((await f.request(`boundary-zone-jobs/${ready.id}/rows/row-0/source`,{user:12})).status,404);
 const commit=()=>f.act(ready,'commit',{requestId:'journey-create'});
 const accepted=await commit();assert.equal(accepted.json.state,'committing');
 // Treat its response as lost. Durable GET + identical commit replay must recover one intent.
 assert.deepEqual((await f.request(`boundary-zone-jobs/${ready.id}`)).json,accepted.json);
 assert.deepEqual((await commit()).json,accepted.json);
 const done=await f.advance(accepted.json);assert.equal(done.state,'complete');
 assert.deepEqual(done.rows.map(r=>r.status),['created','created']);
 assert.deepEqual(await f.rows('SELECT hard_asset_id,zone_code FROM audience_zones ORDER BY id'),[{hard_asset_id:21,zone_code:'Case-N'},{hard_asset_id:22,zone_code:'Case-S'}]);
 assert.deepEqual(await f.rows('SELECT audience_zone_id,postal_code FROM audience_zone_postal_codes ORDER BY audience_zone_id,postal_code'),done.rows.flatMap(r=>['001234','001235'].map(postal_code=>({audience_zone_id:r.zoneId,postal_code}))));
 assert.deepEqual(await f.rows('SELECT * FROM soft_asset_audience_zones'),[],'creating zones never binds an Offering');
 assert.deepEqual((await commit()).json,done);assert.equal((await f.rows('SELECT id FROM boundary_library_items')).length,1);
 // The frozen job survives source retirement. New intent cannot use a retired source.
 assert.equal((await f.post(selections,'retired-source')).status,409);
 await pg.exec('UPDATE boundary_library_items SET retired_at=NULL');
 const same=selections.map((r,i)=>({...r,hardAssetId:21,zoneCode:'same-'+i}));
 const sameReady=await f.advance((await f.post(same,'journey-same')).json);
 const sameDone=await f.advance((await f.act(sameReady,'commit',{requestId:'same-create'})).json);
 assert.deepEqual(sameDone.rows.map(r=>r.hardAssetId),[21,21]);
 // Owner history remains after Place authority disappears; fresh materialization does not.
 await pg.exec('UPDATE hard_asset_staff_memberships SET revoked_at=now() WHERE user_id=11');
 assert.equal((await f.request(`boundary-zone-jobs/${done.id}`)).json.state,'complete');
 assert.equal((await f.request('boundary-zone-jobs')).json.items.length,2);
 assert.equal((await f.post(same,'no-rights')).status,403);
});

test('real job factory SQL: failed membership transaction rolls back then pause/resume/cancel retains accepted progress',async t=>{
 const f=await jobsFixture(t);
 let j=await f.advance((await f.post([f.row,{...f.row,rowKey:'second',zoneCode:null}],'journey-rollback')).json);
 j=(await f.act(j,'commit',{requestId:'rollback-create'})).json;
 await f.pg.exec("ALTER TABLE audience_zone_postal_codes ADD CONSTRAINT journey_failure CHECK(postal_code<>'001235')");
 assert.equal((await f.act(j,'advance')).status,503);
 assert.deepEqual(await f.rows('SELECT id FROM audience_zones'),[]);assert.deepEqual(await f.rows('SELECT id FROM boundary_library_items'),[]);
 await f.pg.exec('ALTER TABLE audience_zone_postal_codes DROP CONSTRAINT journey_failure');
 j=(await f.act(j,'advance')).json;assert.equal(j.rows[0].status,'created');const kept=j.rows[0].zoneId;
 j=(await f.act(j,'pause')).json;assert.equal(j.state,'paused');j=(await f.act(j,'resume')).json;
 j=(await f.act(j,'cancel')).json;assert.equal(j.state,'cancelled');assert.equal(j.rows[0].zoneId,kept);
 assert.equal((await f.rows('SELECT id FROM audience_zones')).length,1);assert.equal((await f.rows('SELECT postal_code FROM audience_zone_postal_codes')).length,2);
});

test('full App manual postal entry and shared approval remain separate, and selected audience zones still match ANY',async t=>{
 const f=await createBoundaryPostgres(t),body={name:'Manual postal zone',hardAssetId:21,zoneCode:'Manual-Case',postalCodes:'001234\n001235',sharingStatus:'pending_approval'};
 const created=await f.request('audience-zones',{method:'POST',body});assert.equal(created.status,201);assert.equal(created.json.zoneCode,'Manual-Case');assert.equal(created.json.sharingStatus,'pending_approval');
 assert.equal((await f.request('audience-zones',{method:'POST',body:{...body,name:'No owner approval',zoneCode:'Other',sharingStatus:'approved'}})).status,403);
 const approved=await f.request('audience-zones/'+created.json.id,{user:12,method:'PUT',body:{sharingStatus:'approved'}});assert.equal(approved.status,200);assert.equal(approved.json.sharingStatus,'approved');
 assert.deepEqual((await f.pg.query('SELECT postal_code FROM audience_zone_postal_codes WHERE audience_zone_id=$1 ORDER BY postal_code',[created.json.id])).rows,[{postal_code:'001234'},{postal_code:'001235'}]);
 const offering={visibility:'public',status:'active',audienceMode:'audience_zones',audienceZones:[{id:created.json.id},{id:999}],isMemberOnly:false};
 assert.equal(isAssetVisible(offering,{id:11,role:'standard'},{allowedAudienceZoneIds:new Set([created.json.id])}),true);
 assert.equal(isAssetVisible(offering,{id:11,role:'standard'},{allowedAudienceZoneIds:new Set([999])}),true);
 assert.equal(isAssetVisible(offering,{id:11,role:'standard'},{allowedAudienceZoneIds:new Set([998])}),false);
 assert.deepEqual((await f.pg.query('SELECT id FROM boundary_zone_jobs')).rows,[]);assert.deepEqual((await f.pg.query('SELECT id FROM boundary_library_items')).rows,[]);
});
