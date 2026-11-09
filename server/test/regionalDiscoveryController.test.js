import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../src/db/schema.js';
import { getRegionalDiscoveryDocument, replaceRegionalDiscoveryDocument, previewRegionalDiscovery } from '../src/controllers/regionalDiscoveryController.js';
import { publishMyMap, unpublishMyMap } from '../src/controllers/myMapsController.js';
import { duplicateMyMap } from '../src/controllers/myMapCopiesController.js';
import { evaluateRegionalDiscoverySnapshot } from '../src/utils/regionalDiscoveryEvaluation.js';

const owner = { id: 1, role: 'standard' };
const config = () => ({ schemaVersion: 1, mode: 'regional-discovery', includedSubregionIds: [91001], regionExtent: [103.6,1.15,104.1,1.5], entries: [{resourceType:'soft',resourceId:201,mapPlacement:'unplotted',distanceSource:'none',emailMode:'hidden',phoneMode:'hidden'}] });

test('draft save does not publish; owner CAS, readback and preview preserve frozen publication', async () => {
    const pg = new PGlite();
    const writes = [];
    const db = drizzle(pg, { schema, logger:{logQuery(q) { if (/^(insert|update|delete)/i.test(q)) writes.push(q); }} });
    try {
        const journal = JSON.parse(await readFile(new URL('../drizzle/meta/_journal.json',import.meta.url),'utf8'));
        for (const {tag} of journal.entries) await pg.exec(await readFile(new URL(`../drizzle/${tag}.sql`,import.meta.url),'utf8'));
        await pg.exec(`INSERT INTO users(id,username,email,password_hash,name) VALUES(1,'fiction','fiction@example.invalid','fixture','Fiction');
          INSERT INTO my_maps(id,user_id,name) VALUES(9,1,'Fictional regional map');
          INSERT INTO subregions(id,subregion_code,name) VALUES(91001,'S1','Fictional S1');
          INSERT INTO soft_assets(id,name,sub_category,contact_phone) VALUES(201,'Fictional home service','Services','60001111');
          INSERT INTO my_map_assets(map_id,resource_type,resource_id) VALUES(9,'soft',201);`);
        const initial = await getRegionalDiscoveryDocument(db,owner,9);
        assert.equal(initial.revision,0);
        assert.deepEqual(initial.publication,{mode:'compact',available:false,snapshotRevision:null,publishedConfigRevision:null,regionalUrl:null});
        await assert.rejects(getRegionalDiscoveryDocument(db,{id:2,role:'standard'},9),{status:404});
        const saved = await replaceRegionalDiscoveryDocument(db,owner,9,{revision:0,config:config()});
        assert.equal(saved.revision,1);
        await assert.rejects(replaceRegionalDiscoveryDocument(db,owner,9,{revision:0,config:config()}),{status:409});
        const beforePreview = writes.length;
        const preview = await previewRegionalDiscovery(db,owner,9,{revision:1});
        assert.equal(writes.length,beforePreview);
        assert.equal(preview.entries.length,1);
        assert.equal(preview.entries[0].placement,'intentionally-unplotted');
        assert.deepEqual(preview.pins,[]);
        await publishMyMap(db,owner,9,null,{embeddedView:{mode:'regional-discovery',revision:1}});
        const published = (await pg.query('SELECT snapshot FROM my_map_share_snapshots')).rows[0].snapshot;
        assert.equal(published.embeddedRegionalDiscovery.publishedConfigRevision,1);
        const revised = config(); revised.mode='compact'; revised.entries=[];
        await replaceRegionalDiscoveryDocument(db,owner,9,{revision:1,config:revised});
        assert.deepEqual((await pg.query('SELECT snapshot FROM my_map_share_snapshots')).rows[0].snapshot,published);
        await publishMyMap(db,owner,9);
        const retained = (await pg.query('SELECT snapshot FROM my_map_share_snapshots')).rows[0].snapshot.embeddedRegionalDiscovery;
        assert.deepEqual(retained,published.embeddedRegionalDiscovery);
        const readback = await getRegionalDiscoveryDocument(db,owner,9);
        assert.equal(readback.revision,2);
        assert.equal(readback.publication.mode,'regional-discovery');
        assert.equal(readback.publication.publishedConfigRevision,1);
        assert.equal(readback.publication.available,false);
        await pg.exec(`UPDATE my_maps SET embed_enabled=true,embed_allowed_origins='["https://example.invalid"]' WHERE id=9`);
        const enabled=await getRegionalDiscoveryDocument(db,owner,9);
        assert.equal(enabled.publication.available,true);
        assert.match(enabled.publication.regionalUrl,/^\/embed\/maps\/.+\/regional-discovery$/);
        await pg.exec(`UPDATE my_maps SET embed_allowed_origins='["http://localhost:3000"]' WHERE id=9`);
        assert.equal((await getRegionalDiscoveryDocument(db,owner,9)).publication.available,false,'regional publication requires HTTPS framing origins');
        await pg.exec(`UPDATE my_maps SET embed_allowed_origins='["https://example.invalid"]' WHERE id=9`);
        const copy=await duplicateMyMap(db,owner,9);
        const copyState=await getRegionalDiscoveryDocument(db,owner,copy.id);
        assert.equal(copyState.revision,0);
        assert.equal(copyState.publication.mode,'compact');
        assert.equal(copyState.publication.available,false);
        const race=await Promise.allSettled([
            replaceRegionalDiscoveryDocument(db,owner,9,{revision:2,config:revised}),
            replaceRegionalDiscoveryDocument(db,owner,9,{revision:2,config:revised}),
        ]);
        assert.equal(race.filter(result=>result.status==='fulfilled').length,1);
        assert.equal(race.find(result=>result.status==='rejected').reason.status,409);
        const beforeInvalid = writes.length;
        await assert.rejects(publishMyMap(db,owner,9,null,{embeddedView:{mode:'regional-discovery',revision:1}}),{status:409});
        assert.equal(writes.length,beforeInvalid);
        const replacement=config(); replacement.entries[0].phoneMode='home-sr';
        await replaceRegionalDiscoveryDocument(db,owner,9,{revision:3,config:replacement});
        const beforeUnapproved=writes.length;
        await assert.rejects(publishMyMap(db,owner,9,null,{embeddedView:{mode:'regional-discovery',revision:4}}),{status:400});
        assert.equal(writes.length,beforeUnapproved,'unapproved replacement performs zero writes');
        await pg.exec(`UPDATE my_map_share_snapshots SET snapshot=jsonb_set(snapshot,'{embeddedRegionalDiscovery,version}','99') WHERE map_id=9`);
        await publishMyMap(db,owner,9);
        assert.equal((await pg.query('SELECT snapshot FROM my_map_share_snapshots')).rows[0].snapshot.embeddedRegionalDiscovery,undefined,'unknown metadata disables only regional publication');
        await publishMyMap(db,owner,9,null,{embeddedView:{mode:'compact'}});
        assert.equal((await pg.query('SELECT snapshot FROM my_map_share_snapshots')).rows[0].snapshot.embeddedRegionalDiscovery,undefined);
        await unpublishMyMap(db,owner,9);
        await publishMyMap(db,owner,9);
        assert.equal((await getRegionalDiscoveryDocument(db,owner,9)).publication.mode,'compact','new token never activates saved regional draft');
    } finally { await pg.close(); }
});

test('implicit republish survives withdrawn regional contact, zone, removed member and unknown namespace without regional queries',async()=>{
    const pg=new PGlite(); const queries=[];
    const db=drizzle(pg,{schema,logger:{logQuery(query){queries.push(query);}}});
    try {
        const journal=JSON.parse(await readFile(new URL('../drizzle/meta/_journal.json',import.meta.url),'utf8'));
        for(const {tag} of journal.entries) await pg.exec(await readFile(new URL(`../drizzle/${tag}.sql`,import.meta.url),'utf8'));
        await pg.exec(`INSERT INTO users(id,username,email,password_hash,name) VALUES(1,'fixture','fixture@example.invalid','fixture','Fiction');
          INSERT INTO my_maps(id,user_id,name) VALUES(9,1,'Fictional regional map');
          INSERT INTO subregions(id,subregion_code,name) VALUES(91001,'S1','Fictional S1');
          INSERT INTO soft_assets(id,name,sub_category) VALUES(201,'Fictional service','Services');
          INSERT INTO my_map_assets(map_id,resource_type,resource_id) VALUES(9,'soft',201);
          INSERT INTO audience_zones(id,name,sharing_status) VALUES(501,'Fictional shared zone','approved');
          INSERT INTO soft_asset_audience_zones(soft_asset_id,audience_zone_id) VALUES(201,501);
          INSERT INTO soft_asset_region_coverages(soft_asset_id,subregion_id) VALUES(201,91001);
          INSERT INTO subregion_postal_codes(subregion_id,postal_code) VALUES(91001,'000001');
          INSERT INTO audience_zone_postal_codes(audience_zone_id,postal_code) VALUES(501,'000001');`);
        const value='+6560000001';
        await db.insert(schema.subregionEnquiryContactFields).values({subregionId:91001,field:'phone',status:'approved',value,valueHash:createHash('sha256').update(value).digest('hex'),provenance:'Fictional review',approvedByUserId:99001,approvedAt:new Date()});
        const intent=config(); intent.entries[0].phoneMode='home-sr';
        await replaceRegionalDiscoveryDocument(db,owner,9,{revision:0,config:intent});
        await publishMyMap(db,owner,9,null,{embeddedView:{mode:'regional-discovery',revision:1}});
        const frozen=(await pg.query('SELECT snapshot FROM my_map_share_snapshots')).rows[0].snapshot.embeddedRegionalDiscovery;
        const evaluate=()=>evaluateRegionalDiscoverySnapshot(db,frozen,{postalCode:'000001',fetchImpl:async()=>({ok:true,json:async()=>({results:[{POSTAL:'000001',LATITUDE:'1.3',LONGITUDE:'103.8'}]})})});
        assert.equal((await evaluate()).entries[0].recommended,true);
        for(const mutation of [
            "UPDATE subregion_enquiry_contact_fields SET status='withdrawn',value=NULL,value_hash=NULL,withdrawn_by_user_id=99002,withdrawn_at=now(),withdrawal_reason='Fictional withdrawal'",
            "UPDATE audience_zones SET sharing_status='local' WHERE id=501",
            "DELETE FROM my_map_assets WHERE map_id=9",
        ]) {
            await pg.exec(mutation);
            queries.length=0;
            await publishMyMap(db,owner,9);
            assert.equal(queries.some(query=>/my_map_regional_discovery_documents|subregion_enquiry_contact_fields|regional_embed_email_grants/.test(query)),false,'implicit publisher makes no regional store query');
            assert.deepEqual((await pg.query('SELECT snapshot FROM my_map_share_snapshots')).rows[0].snapshot.embeddedRegionalDiscovery,frozen);
            const writesBefore=queries.filter(query=>/^(insert|update|delete)/i.test(query)).length;
            await assert.rejects(publishMyMap(db,owner,9,null,{embeddedView:{mode:'regional-discovery',revision:1}}),{status:400});
            assert.equal(queries.filter(query=>/^(insert|update|delete)/i.test(query)).length,writesBefore,'explicit invalid regional publication still writes nothing');
            const live=await evaluate();
            assert.equal(live.entries[0].contacts.phone.status,'temporarily-unavailable','retention cannot restore withdrawn replacement authority');
            if (!mutation.startsWith('UPDATE subregion_enquiry')) assert.equal(live.entries[0].recommended,false,'withdrawn zone cannot use explicit SR fallback');
        }
        await pg.exec("UPDATE my_map_share_snapshots SET snapshot=jsonb_set(snapshot,'{embeddedRegionalDiscovery,version}','999')");
        await publishMyMap(db,owner,9);
        assert.equal((await pg.query('SELECT snapshot FROM my_map_share_snapshots')).rows[0].snapshot.embeddedRegionalDiscovery,undefined);
    } finally {await pg.close();}
});

test('legacy publish and republish perform no regional store query on a database without regional tables',async()=>{
    const pg=new PGlite(); const newQueries=[];
    const db=drizzle(pg,{schema,logger:{logQuery(query){if (/regional_discovery_documents|regional_embed_email_grants|subregion_enquiry_contact_fields/.test(query)) newQueries.push(query);}}});
    try {
        const journal=JSON.parse(await readFile(new URL('../drizzle/meta/_journal.json',import.meta.url),'utf8'));
        for(const {tag} of journal.entries) {if(tag==='0011_regional_discovery') break; await pg.exec(await readFile(new URL(`../drizzle/${tag}.sql`,import.meta.url),'utf8'));}
        await pg.exec("INSERT INTO users(id,username,email,password_hash,name) VALUES(1,'legacy','legacy@example.invalid','fixture','Fiction'); INSERT INTO my_maps(id,user_id,name) VALUES(9,1,'Legacy map')");
        await publishMyMap(db,owner,9);
        await publishMyMap(db,owner,9);
        assert.deepEqual(newQueries,[]);
    } finally {await pg.close();}
});

test('regional_route_is_opt_in and guest_dto_has_no_private_context',async()=>{
    const {createRegionalDiscoveryServerFixture,fixtureToken}=await import('../../tests/fixtures/regional-discovery/server-fixture.mjs');
    const {getPublishedRegionalDiscoveryDirectory}=await import('../src/controllers/regionalDiscoveryController.js');
    const fixture=await createRegionalDiscoveryServerFixture();
    try {
        const dto=await getPublishedRegionalDiscoveryDirectory(fixture.db,fixtureToken);
        assert.equal(dto.entries.length,4);
        for(const value of ['PRIVATE','private-owner','private-provider','mapLocationScope','publishedDistancePlaceKeys','homeSubregionId','audienceZone']) assert.equal(JSON.stringify(dto).includes(value),false,value);
        const original=(await fixture.pg.query('SELECT snapshot FROM my_map_share_snapshots')).rows[0].snapshot;
        for(const mutate of [value=>{delete value.embeddedRegionalDiscovery;},value=>{value.embeddedRegionalDiscovery.version=999;},value=>{value.embeddedRegionalDiscovery.shareToken='different-token';},value=>{value.embeddedRegionalDiscovery.entries=Array(501).fill(value.embeddedRegionalDiscovery.entries[0]);}]) {
            const value=structuredClone(original);mutate(value);
            await fixture.pg.query('UPDATE my_map_share_snapshots SET snapshot=$1',[JSON.stringify(value)]);
            await assert.rejects(getPublishedRegionalDiscoveryDirectory(fixture.db,fixtureToken),{status:404});
        }
    } finally {await fixture.close();}
});

test('guest HTTP config, cookies, exact body, live withdrawal and atomic bounded evaluation',async()=>{
    const {createRegionalDiscoveryServerFixture,createRegionalDiscoveryFixtureApp,fixtureToken}=await import('../../tests/fixtures/regional-discovery/server-fixture.mjs');
    const fixture=await createRegionalDiscoveryServerFixture();
    try {
        globalThis.__carearoundRateLimitBuckets=new Map();
        const app=await createRegionalDiscoveryFixtureApp(fixture);
        const path=`/api/shared-maps/${fixtureToken}/embed/regional-discovery`;
        const evaluate=(body,headers={})=>app.request(`${path}/evaluate`,{method:'POST',body:typeof body==='string'?body:JSON.stringify(body),headers:{'Content-Type':'application/json',...headers}});
        const get=await app.request(path+'?mode=compact&postalCode=000001');
        assert.equal(get.status,200);assert.equal(get.headers.get('cache-control'),'no-store');assert.equal((await get.json()).evaluation.status,'none');
        const guest=await evaluate({postalCode:'000001'});
        const cookie=await evaluate({postalCode:'000001'},{Cookie:'sc_token=fictional',Origin:'https://foreign.example.invalid'});
        assert.equal(cookie.status,200);assert.deepEqual(await guest.json(),await cookie.json());
        const framing=await app.request(path+'-config');assert.deepEqual(await framing.json(),{schemaVersion:1,view:'regional-discovery',allowedOrigins:['https://host.example.invalid']});
        for(const body of [{postalCode:1},{postalCode:'12345'},{postalCode:'1234567'},{postalCode:'000001',resourceIds:[101]},[],null,'{']) {const response=await evaluate(body);assert.equal(response.status,400);assert.equal(response.headers.get('cache-control'),'no-store');}
        const first=await (await evaluate({postalCode:'000001'})).json();
        assert.equal(first.entries.find(e=>e.entryKey==='soft:201').contacts.email.status,'available');
        await fixture.pg.exec("UPDATE regional_embed_email_grants SET status='withdrawn',approved_original_email=NULL,value_hash=NULL,withdrawn_by_user_id=99002,withdrawn_at=now(),withdrawal_reason='Fictional withdrawal'");
        const contacts=await (await evaluate({postalCode:'000001'})).json();
        assert.equal(contacts.entries.find(e=>e.entryKey==='soft:201').contacts.email.status,'temporarily-unavailable');
        assert.equal(contacts.entries.find(e=>e.entryKey==='soft:201').contacts.phone.status,'available');
        await fixture.pg.exec("UPDATE subregion_postal_codes SET subregion_id=91003 WHERE postal_code='000001'");
        const coverage=await (await evaluate({postalCode:'000001'})).json();assert.equal(coverage.evaluation.status,'outside-region');assert.equal(coverage.entries.every(e=>!e.recommended && e.distanceMeters===null),true);
        await fixture.pg.exec('UPDATE hard_assets SET is_hidden=true WHERE id=101');
        const withdrawn=await (await app.request(path)).json();assert.equal(withdrawn.entries.some(e=>e.entryKey==='hard:101'),false);assert.equal(withdrawn.pins.length,0);assert.equal(withdrawn.entries.length,3);
        await fixture.pg.exec("UPDATE my_map_share_snapshots SET snapshot=jsonb_set(snapshot,'{embeddedRegionalDiscovery,entries,0,name}','\" \"')");
        const invalid=await app.request(path);assert.equal(invalid.status,404);assert.equal((await invalid.json()).entries,undefined);
    } finally {await fixture.close();}
});

test('live opt-in framing, malformed namespace and rate thirty per minute',async()=>{
    const {createRegionalDiscoveryServerFixture,createRegionalDiscoveryFixtureApp,fixtureToken}=await import('../../tests/fixtures/regional-discovery/server-fixture.mjs');
    const fixture=await createRegionalDiscoveryServerFixture();
    try {
        globalThis.__carearoundRateLimitBuckets=new Map();const app=await createRegionalDiscoveryFixtureApp(fixture);const path=`/api/shared-maps/${fixtureToken}/embed/regional-discovery`;
        for(let i=1;i<=31;i++){const response=await app.request(path+'/evaluate',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"postalCode":"000009"}'});assert.equal(response.status,i===31?429:200);assert.equal(response.headers.get('cache-control'),'no-store');}
        for(const mutation of ["UPDATE my_maps SET embed_enabled=false","UPDATE my_maps SET embed_enabled=true,embed_allowed_origins='[]'","UPDATE my_maps SET embed_allowed_origins='[\"http://localhost:3000\"]'","UPDATE my_maps SET embed_allowed_origins='[\"https://host.example.invalid/path\"]'","UPDATE my_maps SET embed_allowed_origins='[\"https://host.example.invalid\"]',is_shared=false"]){await fixture.pg.exec(mutation);for(const suffix of ['', '-config']){const response=await app.request(path+suffix);assert.equal(response.status,404);assert.equal(response.headers.get('cache-control'),'no-store');}}
        await fixture.pg.exec("UPDATE my_maps SET is_shared=true; UPDATE my_map_share_snapshots SET snapshot=snapshot-'embeddedRegionalDiscovery'");assert.equal((await app.request(path+'?mode=regional-discovery')).status,404);
    } finally {await fixture.close();}
});

test('actual public controller bounds lookup to five seconds without logging postal or body',async()=>{
    const {createRegionalDiscoveryServerFixture,createRegionalDiscoveryFixtureApp,fixtureToken}=await import('../../tests/fixtures/regional-discovery/server-fixture.mjs');
    const fixture=await createRegionalDiscoveryServerFixture();const logs=[];const originalLog=console.log,originalError=console.error;
    try {
        console.log=(...args)=>logs.push(args);console.error=(...args)=>logs.push(args);
        globalThis.__carearoundRateLimitBuckets=new Map();let aborted=false;
        const app=await createRegionalDiscoveryFixtureApp(fixture,async(url,{signal})=>{signal.addEventListener('abort',()=>{aborted=true;});return new Promise(()=>{});});
        const start=performance.now();const response=await app.request(`/api/shared-maps/${fixtureToken}/embed/regional-discovery/evaluate`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{"postalCode":"000001"}'});
        assert.equal(response.status,200);assert.equal((await response.json()).evaluation.status,'postal-unresolved');assert.equal(aborted,true);assert.ok(performance.now()-start<5600);assert.ok(logs.length>0,'real slow-request observability emitted a log');assert.equal(JSON.stringify(logs).includes('000001'),false);
    } finally {console.log=originalLog;console.error=originalError;await fixture.close();}
});

test('frozen controller fixtures validate source bytes, DTO invariants and shared publication identity without regeneration',async()=>{
    const {validateFrozenRegionalDiscoveryFixtures}=await import('../../tests/fixtures/regional-discovery/serialize.mjs');
    const {normalizeRegionalDiscoveryPayload}=await import('../../shared/regionalDiscoveryContract.js');
    const manifest=await validateFrozenRegionalDiscoveryFixtures();assert.equal(manifest.serializedArtifacts.length,12);
    const load=async name=>JSON.parse(await readFile(new URL(`../../tests/fixtures/regional-discovery/server-dto/${name}.json`,import.meta.url),'utf8'));
    const base=await load('base');
    for(const name of ['base','inside-s1','inside-s2','outside','coverage-unconfirmed','postal-unresolved','contact-withdrawn','resource-withdrawn','all-unplotted']){const dto=await load(name);assert.deepEqual(normalizeRegionalDiscoveryPayload(dto),dto);if(name!=='all-unplotted')assert.equal(dto.snapshotRevision,base.snapshotRevision,name);}
    assert.equal(base.pins[0].entryKeys.length,2);assert.equal(base.entries.filter(entry=>entry.placement==='intentionally-unplotted').length,2);
    assert.equal(base.entries.find(entry=>entry.entryKey==='soft:201').contacts.email.status,'available');
    const withdrawn=await load('contact-withdrawn');assert.equal(withdrawn.entries.find(entry=>entry.entryKey==='soft:201').contacts.email.status,'temporarily-unavailable');assert.equal(withdrawn.entries.find(entry=>entry.entryKey==='soft:201').contacts.phone.status,'available');
    assert.equal((await load('all-unplotted')).pins.length,0);assert.equal((await load('resource-withdrawn')).entries.some(entry=>entry.entryKey==='hard:101'),false);
});
