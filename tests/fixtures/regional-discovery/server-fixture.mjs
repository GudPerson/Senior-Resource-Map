/** Wholly fictional disposable DB. Never imported by production. No external requests. */
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import * as schema from '../../../server/src/db/schema.js';
import {replaceRegionalDiscoveryDocument} from '../../../server/src/controllers/regionalDiscoveryController.js';
import {publishMyMap} from '../../../server/src/controllers/myMapsController.js';
export const fixtureOwner={id:1,role:'standard'};
export const fixtureToken='fictional-regional-token';
export const fixtureFetch=async url=>{
 const postal=new URL(url).searchParams.get('searchVal');
 return {ok:true,json:async()=>({results:postal==='000004' ? [] : [{POSTAL:postal,LATITUDE:postal==='000002'?'1.34':'1.30',LONGITUDE:'103.80'}]})};
};
export async function createRegionalDiscoveryServerFixture(){
 const pg=new PGlite(); const queries=[];
 const db=drizzle(pg,{schema,logger:{logQuery(query){queries.push(query);}}});
 const root=new URL('../../../server/drizzle/',import.meta.url);
 const journal=JSON.parse(await readFile(new URL('meta/_journal.json',root),'utf8'));
 for(const {tag} of journal.entries) await pg.exec(await readFile(new URL(`${tag}.sql`,root),'utf8'));
 await pg.exec(`INSERT INTO users(id,username,email,password_hash,name,role) VALUES(1,'fictional-curator','private-owner@example.invalid','fixture','Fictional curator','standard'),(2,'fictional-provider','private-provider@example.invalid','fixture','Fictional provider','partner');
 INSERT INTO my_maps(id,user_id,name,embed_enabled,embed_allowed_origins) VALUES(9,1,'Fictional regional directory',true,'["https://host.example.invalid"]');
 INSERT INTO subregions(id,subregion_code,name) VALUES(91001,'S1','Fictional S1'),(91002,'S2','Fictional S2'),(91003,'S3','Fictional outside');
 INSERT INTO subregion_postal_codes(subregion_id,postal_code) VALUES(91001,'000001'),(91002,'000002'),(91003,'000009'),(91001,'000003'),(91002,'000003'),(91001,'000004');
 INSERT INTO hard_assets(id,name,lat,lng,address,partner_id,subregion_id,phone) VALUES(101,'Fictional shared venue',1.31,103.81,'Fictional public address',2,91001,'60001001'),(102,'Fictional other public venue',1.32,103.82,'Fictional other public address',2,91002,'60001002'),(103,'Fictional private venue',1.33,103.83,'PRIVATE VENUE ADDRESS',2,91002,'60001003');
 UPDATE hard_assets SET is_hidden=true WHERE id=103;
 INSERT INTO soft_assets(id,name,sub_category,partner_id,contact_phone,contact_email) VALUES(201,'Fictional co-located service','Services',2,'60002001','Service@Example.invalid'),(202,'Fictional home service A','Services',2,'60002002',NULL),(203,'Fictional home service B','Services',2,'60002003',NULL);
 INSERT INTO soft_asset_locations(soft_asset_id,hard_asset_id) VALUES(201,101),(201,102),(201,103);
 INSERT INTO soft_asset_region_coverages(soft_asset_id,subregion_id) VALUES(201,91001),(202,91002),(203,91001);
 INSERT INTO my_map_assets(map_id,resource_type,resource_id,snapshot,private_note) VALUES(9,'hard',101,NULL,'PRIVATE MAP NOTE'),(9,'soft',201,'{"version":2,"places":[],"mapLocationScope":{"version":1,"placeIds":[101]}}','PRIVATE MAP NOTE'),(9,'soft',202,NULL,NULL),(9,'soft',203,NULL,NULL);`);
 await pg.exec(`INSERT INTO partner_organizations(id,name,governance_status) VALUES(1,'Fictional test organisation','active');
 INSERT INTO organization_agreements(id,organization_id,agreement_reference,status,expires_at,allowed_uses,approved_at) VALUES(1,1,'FICTIONAL-ONLY','active','2099-01-01','{"publicListing":true,"externalSharing":true}',now());
 INSERT INTO organization_resource_links(organization_id,resource_type,resource_id,link_status) VALUES(1,'soft',201,'active');
 INSERT INTO resource_publication_permissions(organization_id,agreement_id,resource_type,resource_id,status,approved_fields,allowed_uses,terms_version,requested_by_user_id,reviewed_by_user_id,approved_at) VALUES(1,1,'soft',201,'publishing_approved','["description","website"]','{"embeds":true}','fictional',1,1,now());
 UPDATE soft_assets SET description='Fictional approved service details',website='https://service.example.invalid' WHERE id=201;`);
 const hash=value=>createHash('sha256').update(value).digest('hex');
 for(const subregionId of [91001,91002]) for(const [field,value] of [['email',`enquiry${subregionId}@example.invalid`],['phone',`+656000${subregionId===91001?'1111':'2222'}`]]) await db.insert(schema.subregionEnquiryContactFields).values({subregionId,field,status:'approved',value,valueHash:hash(value),provenance:'Wholly fictional test authority',approvedByUserId:99001,approvedAt:new Date('2026-01-01')});
 await db.insert(schema.regionalEmbedEmailGrants).values({resourceType:'soft',resourceId:201,status:'approved',approvedOriginalEmail:'Service@Example.invalid',valueHash:hash('Service@Example.invalid'),provenance:'Wholly fictional test approval',approvedByUserId:99001,approvedAt:new Date('2026-01-01')});
 const entry=(resourceType,resourceId,extra={})=>({resourceType,resourceId,mapPlacement:'published-locations',distanceSource:'published-locations',emailMode:'hidden',phoneMode:'original',...extra});
 const config={schemaVersion:1,mode:'regional-discovery',includedSubregionIds:[91001,91002],regionExtent:[103.6,1.15,104.1,1.5],entries:[entry('hard',101),entry('soft',201,{emailMode:'original'}),entry('soft',202,{mapPlacement:'unplotted',distanceSource:'none',emailMode:'home-sr',phoneMode:'home-sr'}),entry('soft',203,{mapPlacement:'unplotted',distanceSource:'none'})]};
 let revision=0;
 async function publish(next=config){const saved=await replaceRegionalDiscoveryDocument(db,fixtureOwner,9,{revision,config:next});revision=saved.revision; await publishMyMap(db,fixtureOwner,9,null,{embeddedView:{mode:'regional-discovery',revision}}); await pg.query('UPDATE my_maps SET share_token=$1 WHERE id=9',[fixtureToken]);await pg.query("UPDATE my_map_share_snapshots SET share_token=$1::text,snapshot=jsonb_set(snapshot,'{embeddedRegionalDiscovery,shareToken}',to_jsonb($1::text)) WHERE map_id=9",[fixtureToken]);}
 await publish();
 return {pg,db,queries,config,publish,close:()=>pg.close()};
}

// Mount the same router and security guards as production, with only DB/fetch replaced.
export async function createRegionalDiscoveryFixtureApp(fixture,fetchImpl=fixtureFetch) {
 const {Hono}=await import('hono');
 const {createRegionalDiscoveryRouter}=await import('../../../server/src/routes/sharedMaps.js');
 const {securityHeaders,cookieSessionCsrfGuard,requestBodyGuard}=await import('../../../server/src/middleware/security.js');
 const {requestObservability}=await import('../../../server/src/middleware/requestObservability.js');
 const app=new Hono();
 app.use('*',requestObservability);
 app.use('*',securityHeaders);app.use('*',cookieSessionCsrfGuard);app.use('*',requestBodyGuard);
 app.route('/api/shared-maps',createRegionalDiscoveryRouter({getDatabase:()=>fixture.db,fetchImpl}));
 return app;
}
