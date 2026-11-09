import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../src/db/schema.js';
import { buildChildValuesFromParent } from '../src/utils/softAssetHierarchy.js';
import {
    loadRegionalDiscoveryCoverage,
    resolveRegionalDiscoveryHomeSubregion,
    evaluateRegionalDiscoveryRecommendations,
    calculateRegionalDiscoveryDistance,
    sortRegionalDiscoveryEntries,
} from '../src/utils/regionalDiscoveryCoverage.js';

// All IDs, postal membership and service metadata below are fictional local fixtures.
let pg, db;
before(async () => {
    pg = new PGlite();
    db = drizzle(pg, { schema });
    const journal = JSON.parse(await readFile(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8'));
    for (const { tag } of journal.entries) await pg.exec(await readFile(new URL(`../drizzle/${tag}.sql`, import.meta.url), 'utf8'));
    await pg.exec(`
      INSERT INTO subregions(id,subregion_code,name) VALUES
        (91001,'S1','Fictional S1'),(91002,'S2','Fictional S2'),(91999,'SIN','Singapore');
      INSERT INTO subregion_postal_codes(subregion_id,postal_code) VALUES
        (91001,'000001'),(91002,'000002'),(91001,'000003'),(91002,'000003'),
        (91999,'000001'),(91999,'000004');
      INSERT INTO hard_assets(id,name,lat,lng,address,subregion_id,postal_code) VALUES
        (92001,'Fictional office',1.3,103.8,'Fictional',91002,'000001'),
        (92002,'Fictional assigned place',1.3,103.8,'Fictional',91001,'000002'),
        (92003,'Fictional national place',1.3,103.8,'Fictional',91999,'000001');
      INSERT INTO soft_asset_parents(id,name,audience_mode) VALUES
        (93001,'Fictional zoned parent','audience_zones'),(93002,'Fictional public parent','public');
      INSERT INTO soft_assets(id,name,subregion_id,host_hard_asset_id,audience_mode,asset_mode,parent_soft_asset_id) VALUES
        (94001,'Fictional multi SR',91002,NULL,'public','standalone',NULL),
        (94002,'Fictional invalid zone',91001,NULL,'audience_zones','standalone',NULL),
        (94003,'Fictional host zone',NULL,92001,'public','standalone',NULL),
        (94004,'Fictional parent zone',91002,NULL,'public','child',93001),
        (94005,'Fictional parent public',91002,NULL,'audience_zones','child',93002),
        (94006,'Fictional venue only',NULL,92002,'public','standalone',NULL);
      INSERT INTO soft_asset_region_coverages(soft_asset_id,subregion_id) VALUES(94001,91001),(94001,91002),(94001,91999);
      INSERT INTO audience_zones(id,name,hard_asset_id) VALUES(95001,'Fictional host zone',92001),(95002,'Fictional parent zone',NULL);
      INSERT INTO soft_asset_parent_audience_zones(soft_asset_parent_id,audience_zone_id) VALUES(93001,95002);
      INSERT INTO soft_asset_audience_zones(soft_asset_id,audience_zone_id) VALUES(94005,95002);
    `);
    const derivedChild = buildChildValuesFromParent(
        {id:93002,name:'Fictional derived child',audienceMode:'public'},
        {id:92002,subregionId:91001},
        {id:1},
    );
    await db.insert(schema.softAssets).values([
        {...derivedChild,id:94007,createdByUserId:null},
        {...derivedChild,id:94008,name:'Fictional explicitly covered child',createdByUserId:null},
    ]);
    await db.insert(schema.softAssetRegionCoverages).values({softAssetId:94008,subregionId:91002});
});
after(async () => { await pg?.close(); });

test('leading_zero_is_preserved and national fallback is ignored alongside one real-kind match', async () => {
    assert.deepEqual(await resolveRegionalDiscoveryHomeSubregion(db, '000001', [91001]), {
        status: 'inside-region', homeSubregionId: 91001,
    });
});
test('national_fallback_is_not_home_sr', async () => {
    const national = await resolveRegionalDiscoveryHomeSubregion(db, '000004', [91001]);
    assert.equal(national.status, 'coverage-unconfirmed');
    assert.equal(national.homeSubregionId, null);
});
test('ambiguous_coverage_is_not_outside, including a match beyond the curated region', async () => {
    const ambiguous = await resolveRegionalDiscoveryHomeSubregion(db, '000003', [91001]);
    assert.equal(ambiguous.status, 'coverage-unconfirmed');
    assert.equal(ambiguous.homeSubregionId, null);
    assert.equal((await resolveRegionalDiscoveryHomeSubregion(db, '000005', [91001])).status, 'coverage-unconfirmed');
});
test('unique_nonmember_is_outside', async () => {
    const outside = await resolveRegionalDiscoveryHomeSubregion(db, '000002', [91001]);
    assert.equal(outside.status, 'outside-region');
    assert.equal(outside.homeSubregionId, 91002);
});
test('missing canonical coverage, failed query and invalid input stay uncertain', async () => {
    assert.equal((await resolveRegionalDiscoveryHomeSubregion({}, '000001', [91001])).status, 'coverage-unconfirmed');
    assert.equal((await resolveRegionalDiscoveryHomeSubregion(db, '000001', [])).status, 'coverage-unconfirmed');
    assert.equal((await resolveRegionalDiscoveryHomeSubregion(db, ' 000001', [91001])).status, 'postal-unresolved');
});
test('loader uses hard canonical assignments and explicit soft coverage, never office or postal geography', async () => {
    const metadata = await loadRegionalDiscoveryCoverage(db, [
        { resourceType:'hard', resourceId:92001 }, { resourceType:'hard', resourceId:92003 },
        { resourceType:'soft', resourceId:94001 }, { resourceType:'soft', resourceId:94006 },
    ]);
    assert.deepEqual(metadata.map(row => [row.entryKey,row.assignedSubregionIds]), [
        ['hard:92001',[91002]], ['hard:92003',[]], ['soft:94001',[91001,91002]], ['soft:94006',[]],
    ]);
});
test('derived host SR cannot recommend a retained service; only explicit service coverage can', async () => {
    const metadata = await loadRegionalDiscoveryCoverage(db, [94007,94008].map(resourceId=>({resourceType:'soft',resourceId})));
    assert.deepEqual(evaluateRegionalDiscoveryRecommendations(metadata,{homeSubregionId:91001}),[
        {entryKey:'soft:94007',recommended:false},
        {entryKey:'soft:94008',recommended:false},
    ]);
    assert.deepEqual(evaluateRegionalDiscoveryRecommendations(metadata,{homeSubregionId:91002}),[
        {entryKey:'soft:94007',recommended:false},
        {entryKey:'soft:94008',recommended:true},
    ]);
    assert.deepEqual(metadata.map(row=>[row.entryKey,row.assignedSubregionIds]),[
        ['soft:94007',[]],['soft:94008',[91002]],
    ]);
});
test('loader preserves effective parent and host zones, including invalid configuration', async () => {
    const metadata = await loadRegionalDiscoveryCoverage(db, [94002,94003,94004,94005].map(resourceId => ({resourceType:'soft',resourceId})));
    assert.deepEqual(metadata.map(row => [row.entryKey,row.zoneState,row.audienceZoneIds]), [
        ['soft:94002','invalid',[]], ['soft:94003','configured',[95001]],
        ['soft:94004','configured',[95002]], ['soft:94005','absent',[]],
    ]);
});
test('configured_zone_never_falls_back and unmatched_service_stays_visible', () => {
    const entries = [
        {entryKey:'soft:1',zoneState:'configured',audienceZoneIds:[95001],assignedSubregionIds:[91001]},
        {entryKey:'soft:2',zoneState:'invalid',audienceZoneIds:[],assignedSubregionIds:[91001]},
        {entryKey:'soft:3',zoneState:'absent',audienceZoneIds:[],assignedSubregionIds:[91002,91001]},
    ];
    assert.deepEqual(evaluateRegionalDiscoveryRecommendations(entries, {homeSubregionId:91001,matchedZoneIds:[]}), [
        {entryKey:'soft:1',recommended:false}, {entryKey:'soft:2',recommended:false}, {entryKey:'soft:3',recommended:true},
    ]);
});
test('cross-SR zone match and same-pin services are independent', () => {
    const metadata = [
        {entryKey:'soft:1',zoneState:'configured',audienceZoneIds:[95001],assignedSubregionIds:[91002],pinPlaceKeys:['hard:7']},
        {entryKey:'soft:2',zoneState:'absent',audienceZoneIds:[],assignedSubregionIds:[91002],pinPlaceKeys:['hard:7']},
    ];
    assert.deepEqual(evaluateRegionalDiscoveryRecommendations(metadata, {homeSubregionId:91001,matchedZoneIds:[95001]}), [
        {entryKey:'soft:1',recommended:true}, {entryKey:'soft:2',recommended:false},
    ]);
    assert.equal(evaluateRegionalDiscoveryRecommendations(metadata,{matchedZoneIds:[]}).some(row=>row.recommended),false);
});
test('recommendation groups, known distances and stable publication ties', () => {
    const rows = [
        {entryKey:'a',recommended:false,distanceMeters:1,publishedOrder:0},
        {entryKey:'b',recommended:true,distanceMeters:null,publishedOrder:1},
        {entryKey:'c',recommended:true,distanceMeters:10,publishedOrder:3},
        {entryKey:'d',recommended:true,distanceMeters:10,publishedOrder:2},
        {entryKey:'e',recommended:false,distanceMeters:null,publishedOrder:4},
        {entryKey:'f',recommended:true,distanceMeters:null,publishedOrder:5},
    ];
    assert.deepEqual(sortRegionalDiscoveryEntries(rows).map(row=>row.entryKey),['d','c','b','f','a','e']);
    assert.deepEqual(rows.map(row=>row.entryKey),['a','b','c','d','e','f']);
});
const home = {lat:1.3,lng:103.8};
const points = [
    {placeKey:'office',latitude:1.3,longitude:103.81},
    {placeKey:'selected',latitude:1.3,longitude:103.82},
    {placeKey:'unselected-nearer',latitude:1.3,longitude:103.80001},
];
test('approved public office and nearest selected scoped venue supply real distances only', () => {
    const entry = {mapPlacement:'published-locations',distanceSource:'published-locations',publishedDistancePlaceKeys:['selected']};
    const distance = calculateRegionalDiscoveryDistance(entry,home,points);
    assert.ok(distance > 2200 && distance < 2230);
    assert.ok(calculateRegionalDiscoveryDistance({...entry,publishedDistancePlaceKeys:['office','selected']},home,points) < distance);
});
test('none, unplotted, withdrawn selected venue and absent appropriate point do not fabricate distance', () => {
    const entry = {mapPlacement:'published-locations',distanceSource:'published-locations',publishedDistancePlaceKeys:['selected']};
    assert.equal(calculateRegionalDiscoveryDistance({...entry,distanceSource:'none'},home,points),null);
    assert.equal(calculateRegionalDiscoveryDistance({...entry,mapPlacement:'unplotted',distanceSource:'none'},home,points),null);
    assert.ok(calculateRegionalDiscoveryDistance({...entry,mapPlacement:'unplotted',pinPlaceKeys:[]},home,points)>2200);
    assert.equal(calculateRegionalDiscoveryDistance({...entry,publishedDistancePlaceKeys:[],pinPlaceKeys:['office']},home,points),null);
    assert.equal(calculateRegionalDiscoveryDistance(entry,home,points.filter(p=>p.placeKey!=='selected')),null);
    assert.equal(calculateRegionalDiscoveryDistance(entry,null,points),null);
    assert.equal(calculateRegionalDiscoveryDistance(entry,home,[{placeKey:'selected',latitude:null,longitude:null}]),null);
});
test('malformed distance keys cannot authorize an unkeyed point', () => {
    assert.equal(calculateRegionalDiscoveryDistance({distanceSource:'published-locations',publishedDistancePlaceKeys:[undefined]},home,[
        {latitude:1.3,longitude:103.8},
    ]),null);
});
