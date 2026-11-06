/** Explicit regeneration only. Consumers validate frozen hashes; never auto-refresh evidence. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {relative,resolve,dirname} from 'node:path';
import {createRegionalDiscoveryServerFixture,createRegionalDiscoveryFixtureApp,fixtureToken,fixtureOwner} from './server-fixture.mjs';
import {getMyMapDetail} from '../../../server/src/controllers/myMapsController.js';
import {getRegionalDiscoveryDocument} from '../../../server/src/controllers/regionalDiscoveryController.js';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const output=new URL('./server-dto/',import.meta.url);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function sourceBindings(){
 const paths=new Set();
 async function visit(path){if(paths.has(path)) return;paths.add(path);const source=await readFile(resolve(root,path),'utf8');for(const match of source.matchAll(/(?:from\s*|import\s*\()\s*['"](\.[^'"]+)['"]/g)){const target=relative(root,resolve(root,dirname(path),match[1]));if(/\.(?:js|mjs|json)$/.test(target)) await visit(target);}}
 for(const path of ['tests/fixtures/regional-discovery/serialize.mjs','tests/fixtures/regional-discovery/server-fixture.mjs','server/src/routes/sharedMaps.js','server/src/middleware/security.js','client/functions/embed/maps/[token]/regional-discovery.js']) await visit(path);
 const journal=JSON.parse(await readFile(resolve(root,'server/drizzle/meta/_journal.json'),'utf8'));
 paths.add('server/drizzle/meta/_journal.json');
 for(const {tag} of journal.entries) paths.add(`server/drizzle/${tag}.sql`);
 return Promise.all([...paths].sort().map(async path=>{const bytes=await readFile(resolve(root,path));return {path,bytes:bytes.length,sha256:hash(bytes)};}));
}
export async function validateFrozenRegionalDiscoveryFixtures(){
 const manifest=JSON.parse(await readFile(new URL('manifest.json',output),'utf8'));
 assert.equal(manifest.controllerSerialized,true);assert.equal(manifest.realRoutingAuthority,false);
 for(const binding of [...manifest.sources,...manifest.serializedArtifacts]){const path=binding.path;const bytes=await readFile(resolve(root,path));assert.equal(bytes.length,binding.bytes,`stale bytes ${path}`);assert.equal(hash(bytes),binding.sha256,`stale source or fixture ${path}; explicitly review and regenerate`);}
 return manifest;
}
export async function serializeRegionalDiscoveryFixtures(){
 const fixture=await createRegionalDiscoveryServerFixture();const artifacts=[];
 try{
  globalThis.__carearoundRateLimitBuckets=new Map();const app=await createRegionalDiscoveryFixtureApp(fixture);
  const path=`/api/shared-maps/${fixtureToken}/embed/regional-discovery`;
  await mkdir(output,{recursive:true});
  async function save(name,response,producer){assert.equal(response.status,200,name);const bytes=Buffer.from(await response.arrayBuffer());await writeFile(new URL(`${name}.json`,output),bytes);artifacts.push({path:`tests/fixtures/regional-discovery/server-dto/${name}.json`,status:response.status,contentType:response.headers.get('content-type'),bytes:bytes.length,sha256:hash(bytes),producer});}
  await save('base',await app.request(path),'actual Hono guest GET');
  for(const [name,postalCode] of [['inside-s1','000001'],['inside-s2','000002'],['outside','000009'],['coverage-unconfirmed','000003'],['postal-unresolved','000004']]) await save(name,await app.request(path+'/evaluate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({postalCode})}),'actual Hono guest POST evaluate with controlled fictional fetch');
  await save('owner-map',Response.json(await getMyMapDetail(fixture.db,fixtureOwner,9)),'getMyMapDetail controller + Response.json bytes');
  await save('owner-settings',Response.json(await getRegionalDiscoveryDocument(fixture.db,fixtureOwner,9)),'getRegionalDiscoveryDocument controller + Response.json bytes');
  await save('framing-config',await app.request(path+'-config'),'actual Hono regional config GET');
  await fixture.pg.exec("UPDATE subregion_enquiry_contact_fields SET status='withdrawn',value=NULL,value_hash=NULL,withdrawn_by_user_id=99002,withdrawn_at=now(),withdrawal_reason='Fictional withdrawal'; UPDATE regional_embed_email_grants SET status='withdrawn',approved_original_email=NULL,value_hash=NULL,withdrawn_by_user_id=99002,withdrawn_at=now(),withdrawal_reason='Fictional withdrawal'");
  await save('contact-withdrawn',await app.request(path+'/evaluate',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"postalCode":"000001"}'}),'actual Hono evaluation after fictional contact withdrawal');
  await fixture.pg.exec('UPDATE hard_assets SET is_hidden=true WHERE id=101');
  await save('resource-withdrawn',await app.request(path),'actual Hono GET after fictional live resource withdrawal');
 } finally {await fixture.close();}
 const unplotted=await createRegionalDiscoveryServerFixture();
 try {await unplotted.publish({...unplotted.config,entries:unplotted.config.entries.map(entry=>({...entry,mapPlacement:'unplotted',distanceSource:'none'}))});const app=await createRegionalDiscoveryFixtureApp(unplotted);const response=await app.request(`/api/shared-maps/${fixtureToken}/embed/regional-discovery`);assert.equal(response.status,200);const bytes=Buffer.from(await response.arrayBuffer());await writeFile(new URL('all-unplotted.json',output),bytes);artifacts.push({path:'tests/fixtures/regional-discovery/server-dto/all-unplotted.json',status:200,contentType:response.headers.get('content-type'),bytes:bytes.length,sha256:hash(bytes),producer:'actual Hono GET after explicit wholly-unplotted fictional publication'});}finally{await unplotted.close();}
 const manifest={sourceIdentity:{baseRevision:'07d4ed0489cb15cf7f906c7097c8b73e690ba3c8',state:'uncommitted task6 working tree; exact sources are bound below, not a claim that base commit contains this implementation'},fixtureSchemaVersion:1,status:'controller-serialized-fictional',controllerSerialized:true,provenanceKind:'disposable-pglite-controlled-fetch',realRoutingAuthority:false,realContactApproval:false,productionProof:false,command:'node tests/fixtures/regional-discovery/serialize.mjs --write',sources:await sourceBindings(),serializedArtifacts:artifacts,limitations:'Wholly fictional SRs, exact postal memberships, service coverage, permissions, historical approval actors and destinations. Actual local controller/Response bytes, not real coverage, contact routing, deploy, physical-device or production acceptance evidence. No external data request.'};
 await writeFile(new URL('manifest.json',output),JSON.stringify(manifest,null,2)+'\n');return manifest;
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){if(process.argv[2]==='--write'){const manifest=await serializeRegionalDiscoveryFixtures();console.log(`Serialized ${manifest.serializedArtifacts.length} genuine controller artifacts; ${manifest.sources.length} source bindings.`);}else {const manifest=await validateFrozenRegionalDiscoveryFixtures();console.log(`Validated ${manifest.serializedArtifacts.length} frozen artifacts; ${manifest.sources.length} source bindings.`);}}
