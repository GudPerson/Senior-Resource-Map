import assert from 'node:assert/strict';
import test, {before,after} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import * as schema from '../src/db/schema.js';
import {replaceRegionalDiscoveryDocument} from '../src/controllers/regionalDiscoveryController.js';
import {prepareRegionalDiscoveryPublication} from '../src/utils/regionalDiscoveryPublication.js';
import {evaluateRegionalDiscoverySnapshot,loadRegionalDiscoveryEffectiveCoverage} from '../src/utils/regionalDiscoveryEvaluation.js';
import {normalizeRegionalDiscoveryPayload} from '../../client/src/features/regional-discovery/regionalDiscoveryContract.js';
import {normalizeRegionalDiscoverySnapshot} from '../src/utils/regionalDiscoveryConfig.js';
import {publishMyMap} from '../src/controllers/myMapsController.js';

let pg,db;
const writes=[];
const reads=[];
const owner={id:1,role:'standard'};
const entry=(resourceType,resourceId,extra={})=>({resourceType,resourceId,mapPlacement:'published-locations',distanceSource:'published-locations',emailMode:'hidden',phoneMode:'original',...extra});
const config=entries=>({schemaVersion:1,mode:'regional-discovery',includedSubregionIds:[91001],regionExtent:[103.6,1.15,104.1,1.5],entries});
const fetchImpl=async url=>({ok:true,json:async()=>({results:[{POSTAL:new URL(url).searchParams.get('searchVal'),LATITUDE:'1.30',LONGITUDE:'103.80'}]})});
const evaluate=(snapshot,postalCode='000001')=>evaluateRegionalDiscoverySnapshot(db,snapshot,{postalCode,fetchImpl});
async function publish(entries,mapId=9) {
    const existing=await db.query.myMapRegionalDiscoveryDocuments.findFirst({where:(table,{eq})=>eq(table.mapId,mapId)});
    const saved=await replaceRegionalDiscoveryDocument(db,owner,mapId,{revision:existing?.revision || 0,config:config(entries)});
    const map=await db.query.myMaps.findFirst({where:(table,{eq})=>eq(table.id,mapId),with:{assets:true}});
    return prepareRegionalDiscoveryPublication(db,owner,map,{embeddedView:{mode:'regional-discovery',revision:saved.revision}});
}
before(async()=>{
    pg=new PGlite(); db=drizzle(pg,{schema,logger:{logQuery(query){if (/^(insert|update|delete)/i.test(query)) writes.push(query); if (/^select/i.test(query)) reads.push(query);}}});
    const journal=JSON.parse(await readFile(new URL('../drizzle/meta/_journal.json',import.meta.url),'utf8'));
    for(const {tag} of journal.entries) await pg.exec(await readFile(new URL(`../drizzle/${tag}.sql`,import.meta.url),'utf8'));
    await pg.exec(`INSERT INTO users(id,username,email,password_hash,name,role) VALUES
      (1,'fixture','fixture@example.invalid','fixture','Fictional curator','standard'),(2,'provider','private-account@example.invalid','fixture','Fictional provider','partner'),(3,'foreign','foreign@example.invalid','fixture','Fictional foreign','partner');
      INSERT INTO subregions(id,subregion_code,name) VALUES(91001,'S1','Fictional S1'),(91002,'S2','Fictional S2');
      INSERT INTO subregion_postal_codes(subregion_id,postal_code) VALUES(91001,'000001'),(91002,'000002'),(91001,'000003'),(91002,'000003');
      INSERT INTO my_maps(id,user_id,name) VALUES(9,1,'Fictional scope'),(10,1,'Fictional zones');
      INSERT INTO hard_assets(id,name,lat,lng,address,partner_id,subregion_id,phone) VALUES
      (101,'Fictional A',1.31,103.81,'PUBLIC A',2,91001,'60001001'),(102,'Fictional B',1.32,103.82,'PRIVATE B',2,91002,'60001002');
      INSERT INTO soft_assets(id,name,sub_category,partner_id,contact_phone,contact_email) VALUES
      (201,'Fictional multiple venues','Services',2,'60002001','Service@Example.invalid'),
      (202,'Fictional local zone','Services',2,'60002002',NULL),(203,'Fictional foreign zone','Services',2,NULL,NULL),
      (204,'Fictional no-pin','Services',2,NULL,NULL);
      INSERT INTO soft_asset_locations(soft_asset_id,hard_asset_id) VALUES(201,101),(201,102),(202,101);
      INSERT INTO soft_asset_region_coverages(soft_asset_id,subregion_id) VALUES(201,91001),(202,91001),(203,91001),(204,91001);
      INSERT INTO my_map_assets(map_id,resource_type,resource_id,snapshot) VALUES
      (9,'soft',201,'{"version":2,"places":[],"mapLocationScope":{"version":1,"placeIds":[102]}}'),
      (9,'hard',101,NULL),(9,'soft',204,NULL),(10,'soft',202,NULL),(10,'soft',203,NULL);
      UPDATE my_map_assets SET private_note='MAP PRIVATE NOTE',handoff_note='MAP SHARED NOTE',short_descriptor='OWNER ONLY DESCRIPTION';
      INSERT INTO audience_zones(id,name,partner_user_id,sharing_status) VALUES(501,'Fictional owned zone',2,'local'),(502,'Fictional borrowed zone',3,'approved');
      INSERT INTO soft_asset_audience_zones(soft_asset_id,audience_zone_id) VALUES(202,501),(203,502);
      INSERT INTO audience_zone_postal_codes(audience_zone_id,postal_code) VALUES(501,'000001'),(502,'000001');`);
});
after(async()=>{await pg?.close();});

test('publication rejects unsafe canonical public text before any publisher write',async()=>{
    await pg.query('UPDATE soft_assets SET name=$1 WHERE id=204',['Fictional\u0001service']);
    try {
        const saved=await replaceRegionalDiscoveryDocument(db,owner,9,{revision:0,config:config([entry('soft',204,{mapPlacement:'unplotted',distanceSource:'none'})])});
        writes.length=0;
        await assert.rejects(publishMyMap(db,owner,9,null,{embeddedView:{mode:'regional-discovery',revision:saved.revision}}));
        assert.deepEqual(writes,[]);
    } finally {await pg.exec("UPDATE soft_assets SET name='Fictional no-pin' WHERE id=204");}
});

test('frozen public text and geometry match the consumer without rejecting cleared nullable copy',async()=>{
    const snapshot=await publish([entry('hard',101)]);
    for(const mutate of [
        value=>{value.snapshotRevision=' \t ';},
        value=>{value.entries[0].categoryKey='  ';},
        value=>{value.entries[0].categoryLabel='\t';},
        value=>{value.entries[0].name='  ';},
        value=>{value.entries[0].name='service\u0001name';},
        value=>{value.entries[0].shortDescription='copy\u007f';},
        value=>{value.entries[0].description='copy\u000b';},
        value=>{value.entries[0].addressText='address\u000c';},
        value=>{value.entries[0].points[0].placeKey='  ';},
        value=>{value.entries[0].points[0].latitude=Infinity;},
        value=>{value.entries[0].points[0].longitude=NaN;},
        value=>{value.entries[0].points[0].latitude=91;},
    ]) {
        const malformed=structuredClone(snapshot); mutate(malformed);
        assert.throws(()=>normalizeRegionalDiscoverySnapshot(malformed));
    }
    snapshot.entries[0].shortDescription='';
    snapshot.entries[0].description=' \t\n ';
    snapshot.entries[0].addressText='';
    const normalized=normalizeRegionalDiscoverySnapshot(snapshot);
    assert.equal(normalized.entries[0].description,' \t\n ');
    assert.equal(normalized.entries[0].shortDescription,'');
    assert.equal(normalized.entries[0].addressText,'');
});

test('co-located services preserve category and reciprocal pin invariants atomically',async()=>{
    await pg.exec("INSERT INTO my_map_assets(map_id,resource_type,resource_id) VALUES(9,'soft',202)");
    const snapshot=await publish([entry('hard',101),entry('soft',202)]);
    const dto=await evaluate(snapshot);
    assert.equal(dto.entries.length,2);
    assert.equal(dto.pins.length,1);
    assert.deepEqual(new Set(dto.pins[0].entryKeys),new Set(['hard:101','soft:202']));
    assert.deepEqual(normalizeRegionalDiscoveryPayload(dto),dto);
    const inconsistent=structuredClone(snapshot);
    inconsistent.entries[1].categoryKey=inconsistent.entries[0].categoryKey;
    inconsistent.entries[1].categoryLabel='Contradictory category';
    await assert.rejects(evaluate(inconsistent),TypeError);
    // The same aggregate conflict must prevent an actual successful publication.
    await pg.exec("UPDATE hard_assets SET sub_category='Services' WHERE id=101; UPDATE soft_assets SET sub_category='services' WHERE id=202");
    try {
        const document=await db.query.myMapRegionalDiscoveryDocuments.findFirst({where:(table,{eq})=>eq(table.mapId,9)});
        writes.length=0;
        await assert.rejects(publishMyMap(db,owner,9,null,{embeddedView:{mode:'regional-discovery',revision:document.revision}}));
        assert.deepEqual(writes,[]);
    } finally {
        await pg.exec("UPDATE hard_assets SET sub_category='Active Ageing Centres' WHERE id=101; UPDATE soft_assets SET sub_category='Services' WHERE id=202");
    }
});

test('per-entry selected venue, unplotted distance, frozen service phone, and public allowlist',async()=>{
    const snapshot=await publish([entry('soft',201,{mapPlacement:'unplotted'}),entry('hard',101),entry('soft',204,{mapPlacement:'unplotted',distanceSource:'none'})]);
    assert.deepEqual(snapshot.entries[0].publishedDistancePlaceKeys,['hard-102']);
    const dto=await evaluate(snapshot);
    assert.equal(dto.entries.find(e=>e.entryKey==='soft:201').distanceMeters>2000,true);
    assert.deepEqual(dto.entries.find(e=>e.entryKey==='soft:201').pinPlaceKeys,[]);
    assert.equal(dto.entries.find(e=>e.entryKey==='soft:204').distanceMeters,null);
    assert.equal(dto.entries.find(e=>e.entryKey==='soft:201').contacts.phone.value,'60002001');
    assert.doesNotThrow(()=>normalizeRegionalDiscoveryPayload(dto));
    const serialized=JSON.stringify(dto);
    for(const forbidden of ['publishedDistancePlaceKeys','homeSubregionId','audienceZone','valueHash','private-account','mapLocationScope','resourceId','contactPhone','MAP PRIVATE NOTE','MAP SHARED NOTE','OWNER ONLY DESCRIPTION']) assert.equal(serialized.includes(forbidden),false,forbidden);
    // Owner privilege must never be used for public venue visibility.
    await pg.exec("UPDATE hard_assets SET is_hidden=true WHERE id=102; UPDATE soft_assets SET contact_phone='60009999' WHERE id=201");
    const withdrawn=await evaluate(snapshot);
    const service=withdrawn.entries.find(e=>e.entryKey==='soft:201');
    assert.equal(service.distanceMeters,null);
    assert.equal(service.addressText,null);
    assert.equal(service.contacts.phone.value,'60002001');
    assert.equal(withdrawn.pins.some(pin=>pin.placeKey==='hard-102'),false);
    assert.equal(withdrawn.entries.length,3);
    const noPointPublication=await publish([entry('soft',201)]);
    assert.deepEqual(noPointPublication.entries[0].points,[]);
    const noPointDirectory=await evaluate(noPointPublication);
    assert.equal(noPointDirectory.entries.length,1);
    assert.equal(noPointDirectory.entries[0].placement,'coordinates-unavailable');
    assert.deepEqual(noPointDirectory.pins,[]);
    await pg.exec('UPDATE hard_assets SET is_hidden=false WHERE id=102');
});

test('actual owner/staff zone authority, foreign approval withdrawal, missing zone and no SR fallback',async()=>{
    const snapshot=await publish([entry('soft',202),entry('soft',203)],10);
    assert.deepEqual((await evaluate(snapshot)).entries.map(e=>e.recommended),[true,true]);
    await pg.exec("UPDATE audience_zones SET sharing_status='local' WHERE id=502");
    const withdrawn=await evaluate(snapshot);
    assert.equal(withdrawn.entries.find(e=>e.entryKey==='soft:203').recommended,false);
    assert.equal(withdrawn.entries.length,2);
    await assert.rejects(publish([entry('soft',202),entry('soft',203)],10),{status:400});
    await pg.exec("UPDATE audience_zones SET hard_asset_id=101,partner_user_id=NULL WHERE id=501");
    assert.equal((await evaluate(snapshot)).entries.find(e=>e.entryKey==='soft:202').recommended,false,'host association alone is not staff authority');
    await pg.exec("INSERT INTO hard_asset_staff_memberships(hard_asset_id,user_id,staff_role) VALUES(101,2,'staff')");
    assert.equal((await evaluate(snapshot)).entries.find(e=>e.entryKey==='soft:202').recommended,true,'actual linked staff may use local zone');
    await pg.exec("UPDATE hard_asset_staff_memberships SET revoked_at=now() WHERE user_id=2");
    assert.equal((await evaluate(snapshot)).entries.find(e=>e.entryKey==='soft:202').recommended,false);
    await pg.exec("UPDATE soft_assets SET audience_mode='audience_zones' WHERE id=203; DELETE FROM audience_zones WHERE id=502");
    const missing=await loadRegionalDiscoveryEffectiveCoverage(db,[entry('soft',203)]);
    assert.equal(missing[0].zoneState,'invalid');
    await pg.exec("UPDATE soft_assets SET audience_mode='public' WHERE id=203; UPDATE audience_zones SET hard_asset_id=NULL,partner_user_id=2 WHERE id=501");
});

test('none/outside/ambiguous/unresolved retain published order without recommendation, distance or replacement',async()=>{
    const hash=value=>createHash('sha256').update(value).digest('hex');
    await db.insert(schema.subregionEnquiryContactFields).values({subregionId:91001,field:'phone',status:'approved',value:'+6560007777',valueHash:hash('+6560007777'),provenance:'Fictional steward',approvedByUserId:99001,approvedAt:new Date()});
    const snapshot=await publish([entry('soft',201,{phoneMode:'home-sr'}),entry('hard',101)]);
    for(const postalCode of [null,'000002','000003','000099']) {
        const dto=await evaluate(snapshot,postalCode);
        assert.deepEqual(dto.entries.map(e=>e.entryKey),['soft:201','hard:101']);
        assert.equal(dto.entries.every(e=>!e.recommended && e.distanceMeters===null),true);
        assert.deepEqual(dto.entries[0].contacts.phone,{status:'needs-postal',appliesTo:'entered-location'});
    }
    const unresolved=await evaluateRegionalDiscoverySnapshot(db,snapshot,{postalCode:'000001',fetchImpl:async()=>({ok:false})});
    assert.equal(unresolved.evaluation.status,'postal-unresolved');
    assert.equal(unresolved.entries.every(e=>!e.recommended && e.distanceMeters===null),true);
    assert.equal((await evaluate(snapshot)).entries.find(e=>e.entryKey==='soft:201').contacts.phone.value,'+6560007777');
});

test('unscoped publication never freezes a private first venue address beside another public point',async()=>{
    await pg.exec("UPDATE my_map_assets SET snapshot=NULL WHERE map_id=9 AND resource_type='soft' AND resource_id=201; UPDATE hard_assets SET is_hidden=true,address='PRIVATE FIRST VENUE' WHERE id=101");
    const snapshot=await publish([entry('soft',201)]);
    const dto=await evaluate(snapshot);
    assert.equal(dto.entries[0].addressText,'PRIVATE B');
    assert.equal(JSON.stringify(dto).includes('PRIVATE FIRST VENUE'),false);
    assert.deepEqual(dto.entries[0].pinPlaceKeys,['hard-102']);
    await pg.exec("UPDATE hard_assets SET is_hidden=false,address='PUBLIC A' WHERE id=101");
});

test('another public entry at the same place cannot authorize a removed per-service distance point',async()=>{
    await pg.exec(`UPDATE my_map_assets SET snapshot='{"version":2,"places":[],"mapLocationScope":{"version":1,"placeIds":[102]}}' WHERE map_id=9 AND resource_type='soft' AND resource_id=201;
      INSERT INTO my_map_assets(map_id,resource_type,resource_id) VALUES(9,'hard',102)`);
    const snapshot=await publish([entry('soft',201),entry('hard',102)]);
    await pg.exec('DELETE FROM soft_asset_locations WHERE soft_asset_id=201 AND hard_asset_id=102');
    const dto=await evaluate(snapshot);
    const service=dto.entries.find(e=>e.entryKey==='soft:201');
    assert.equal(service.distanceMeters,null);
    assert.deepEqual(service.pinPlaceKeys,[]);
    assert.equal(service.placement,'coordinates-unavailable');
    assert.deepEqual(dto.pins[0].entryKeys,['hard:102']);
    await pg.exec('INSERT INTO soft_asset_locations(soft_asset_id,hard_asset_id) VALUES(201,102)');
});

test('original email freezes verified approval; live withdrawal and content permission revocation remain independent',async()=>{
    const hash=value=>createHash('sha256').update(value).digest('hex');
    await pg.exec(`INSERT INTO partner_organizations(id,name,governance_status) VALUES(1,'Fictional organisation','active');
      INSERT INTO organization_agreements(id,organization_id,agreement_reference,status,expires_at,allowed_uses,approved_at)
        VALUES(1,1,'FICTIONAL','active','2099-01-01','{"publicListing":true,"externalSharing":true}',now());
      INSERT INTO organization_resource_links(organization_id,resource_type,resource_id,link_status) VALUES(1,'soft',201,'active');
      INSERT INTO resource_publication_permissions(organization_id,agreement_id,resource_type,resource_id,status,approved_fields,allowed_uses,terms_version,requested_by_user_id,reviewed_by_user_id,approved_at)
        VALUES(1,1,'soft',201,'publishing_approved','["description","website","logoUrl"]','{"embeds":true}','fiction',1,1,now());
      UPDATE soft_assets SET description='APPROVED DESCRIPTION',schedule='APPROVED SHORT',website='https://example.invalid/service',logo_url='https://example.invalid/logo.png' WHERE id=201;`);
    await db.insert(schema.regionalEmbedEmailGrants).values({resourceType:'soft',resourceId:201,status:'approved',approvedOriginalEmail:'Service@Example.invalid',valueHash:hash('Service@Example.invalid'),provenance:'Fictional verified permission',approvedByUserId:99001,approvedAt:new Date()});
    const snapshot=await publish([entry('soft',201,{emailMode:'original'})]);
    assert.deepEqual(snapshot.entries[0].originalContacts.email,{value:'Service@Example.invalid',valueHash:hash('Service@Example.invalid')});
    const first=(await evaluate(snapshot)).entries[0];
    assert.equal(first.contacts.email.value,'Service@Example.invalid');
    assert.equal(first.description,'APPROVED DESCRIPTION');
    assert.equal(first.shortDescription,'APPROVED SHORT');
    assert.equal(first.logoUrl,'https://example.invalid/logo.png');
    await pg.exec("UPDATE resource_publication_permissions SET approved_fields='[]'");
    const noContent=(await evaluate(snapshot)).entries[0];
    assert.equal(noContent.description,null);
    assert.equal(noContent.shortDescription,null);
    assert.equal(noContent.websiteUrl,null);
    assert.equal(noContent.logoUrl,null);
    assert.equal(noContent.contacts.email.value,'Service@Example.invalid','empty field set still retains base email authority');
    await pg.exec("UPDATE soft_assets SET contact_email='Changed@Example.invalid' WHERE id=201");
    await db.update(schema.regionalEmbedEmailGrants).set({approvedOriginalEmail:'Changed@Example.invalid',valueHash:hash('Changed@Example.invalid')});
    assert.equal((await evaluate(snapshot)).entries[0].contacts.email.status,'temporarily-unavailable','reapproval cannot activate a different frozen email');
    const republished=await publish([entry('soft',201,{emailMode:'original'})]);
    assert.equal((await evaluate(republished)).entries[0].contacts.email.value,'Changed@Example.invalid');
    await pg.exec("UPDATE regional_embed_email_grants SET status='withdrawn',approved_original_email=NULL,value_hash=NULL,withdrawn_by_user_id=99002,withdrawn_at=now(),withdrawal_reason='Fictional withdrawal'");
    const withdrawn=(await evaluate(republished)).entries[0];
    assert.equal(withdrawn.contacts.email.status,'temporarily-unavailable');
    assert.equal(withdrawn.contacts.phone.status,'available');
    assert.equal('value' in withdrawn.contacts.email,false);
});


test('500 distinct current owners use bounded reads with shared then local authority, withdrawal and missing owners',async()=>{
    await pg.exec(`INSERT INTO users(id,username,email,password_hash,name,role)
      SELECT i,'scale-'||i,'scale-'||i||'@example.invalid','fixture','Fictional scale owner','standard' FROM generate_series(10000,10499) i;
      INSERT INTO hard_assets(id,name,partner_id,subregion_id,lat,lng,address) SELECT i,'Fictional scale place',i,91001,1.31,103.81,'Fictional test address' FROM generate_series(10000,10499) i;
      INSERT INTO audience_zones(id,name,hard_asset_id,sharing_status) SELECT i,'Fictional scale zone',i,'approved' FROM generate_series(10000,10499) i;`);
    const refs=Array.from({length:500},(_,i)=>entry('hard',10000+i));
    async function check(expected,maximum){
        reads.length=0;
        const result=await loadRegionalDiscoveryEffectiveCoverage(db,refs);
        assert.equal(result.length,500);
        assert.equal(result.filter(row=>row.zoneState==='configured').length,expected);
        assert.ok(reads.length<=maximum,`expected <=${maximum} reads, got ${reads.length}`);
        return [...reads];
    }
    const approvedReads=await check(500,6);
    assert.ok(approvedReads.every(query=>!query.includes('staff_memberships')),'shared approval needs no membership reads');
    await pg.exec("UPDATE audience_zones SET sharing_status='local' WHERE id BETWEEN 10000 AND 10499");
    await check(0,7); // A resource-owner/host association is not staff authority.
    await pg.exec(`INSERT INTO hard_asset_staff_memberships(hard_asset_id,user_id,staff_role)
      SELECT i,i,'staff' FROM generate_series(10000,10499) i;`);
    await check(500,7);
    await pg.exec('UPDATE hard_asset_staff_memberships SET revoked_at=now() WHERE user_id=10000; UPDATE hard_assets SET is_deleted=true WHERE id=10001; UPDATE hard_assets SET partner_id=NULL WHERE id=10002');
    await check(497,7);
    await pg.exec("UPDATE audience_zones SET sharing_status='approved' WHERE id IN(10000,10001,10002)");
    await check(500,7); // Missing current owner retains existing public shared-zone semantics.
});

test('local partner-zone batches retain real membership roles without borrowing other owners authority',async()=>{
    await pg.exec(`INSERT INTO partner_organizations(id,name,legacy_partner_user_id) VALUES(10000,'Fictional batch org',3);
      INSERT INTO partner_staff_memberships(organization_id,user_id,staff_role) SELECT 10000,i,'editor' FROM generate_series(10003,10499) i;
      INSERT INTO soft_assets(id,name,partner_id) SELECT i,'Fictional batch service',i FROM generate_series(10000,10499) i;
      INSERT INTO audience_zones(id,name,partner_user_id,sharing_status) VALUES(20000,'Fictional partner zone',3,'local');
      INSERT INTO soft_asset_audience_zones(soft_asset_id,audience_zone_id) SELECT i,20000 FROM generate_series(10000,10499) i;`);
    const refs=Array.from({length:500},(_,i)=>entry('soft',10000+i));
    reads.length=0;
    const result=await loadRegionalDiscoveryEffectiveCoverage(db,refs);
    assert.equal(result.filter(row=>row.zoneState==='configured').length,497);
    assert.ok(reads.length<=6,`expected <=6 reads, got ${reads.length}`);
    assert.ok(reads.every(query=>!query.includes('user_subregions')&&!query.includes('hard_asset_staff_memberships')),'partner-zone predicates require no geographic scopes or hard memberships');
    await pg.exec('UPDATE partner_staff_memberships SET revoked_at=now() WHERE user_id=10003');
    const withdrawn=await loadRegionalDiscoveryEffectiveCoverage(db,[entry('soft',10003),entry('soft',10004)]);
    assert.deepEqual(withdrawn.map(row=>row.zoneState),['invalid','configured']);
});
