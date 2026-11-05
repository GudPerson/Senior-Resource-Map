// Actual App with fictional records. No production network or saved user data.
// node tests/browser/care-map-annotation-groups.mjs [--out=PATH]
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {startFixture,fingerprint} from '../fixtures/care-map-floating-canvas/runtime.mjs';
import {createAnnotations} from '../fixtures/care-map-floating-canvas/data.mjs';
import {createPrintAnnotation} from '../../client/src/lib/printAnnotations.js';
const out=process.argv.find(v=>v.startsWith('--out='))?.slice(6)||await fs.mkdtemp(path.join(os.tmpdir(),'care-map-groups-'));
await fs.mkdir(out,{recursive:true});
const report={boundary:'Local actual App/router, fictional 97 annotations/intercepted APIs/synthetic pixels. Deliberate group and view-visibility writes affect in-memory fixture only. No production, physical-device or export-quality claim.',sourceBefore:await fingerprint(),cases:[],errors:[],unexpectedWrites:[]};
let fixture,browser,page;
async function check(name,fn){try{report.cases.push({name,passed:true,evidence:await fn()});}catch(e){report.cases.push({name,passed:false,error:e.message});throw e;}}
async function until(fn,message,timeout=10000){const start=Date.now();while(Date.now()-start<timeout){if(await fn())return;await new Promise(r=>setTimeout(r,40));}throw Error(message);}
const withoutGroups=items=>items.map(({groupName,...rest})=>{void groupName;return rest;});
try{
 fixture=await startFixture(out);browser=await chromium.launch({headless:true});page=await browser.newPage({viewport:{width:1470,height:801}});
 const annotations=createAnnotations();annotations[1].groupName='Health teams';annotations[2].groupName='Health teams';
 annotations[95]={...createPrintAnnotation({type:'circle',points:[[1.37,103.74],[1.375,103.745]],text:'Fictional walking circle'}),id:'fictional_circle'};
 annotations[96]={...createPrintAnnotation({type:'line',points:[[1.37,103.74],[1.375,103.745]],text:'Fictional walking line'}),id:'fictional_line',groupName:'Other team'};
 const state=await fixture.install(page,{annotations});state.allowAnnotationWrites=true;
 const ids=annotations.slice(1,4).map(a=>a.id),offFilter=annotations[96].id,stale='retained_hidden_deleted_id';
 state.document.views[0].design.layers.hiddenAnnotationIds=[ids[0],offFilter,stale];
 const original=structuredClone(state.annotations),studioWrites=[];
 await page.route(`**/api/my-maps/${fixture.mapId}/studio`,async route=>{
  const request=route.request();
  if(request.method()==='PUT'){
   const body=request.postDataJSON();assert.equal(body.revision,state.document.revision);
   const prior=structuredClone(state.document);state.document={...body,revision:body.revision+1};studioWrites.push({before:prior,after:structuredClone(state.document)});
   return route.fulfill({json:{mapId:fixture.mapId,document:state.document,updatedAt:null}});
  }
  return route.fallback();
 });
 await page.goto(new URL(`/my-directory/maps/${fixture.mapId}`,fixture.base).href);
 await page.locator('[data-owner-canvas-enter]').click();await page.locator('[data-owner-canvas-tool="studio"]').click();
 await page.locator('[data-map-studio-annotation-layers]>summary').click();
 let manager=page.locator('[data-annotation-layer-manager]');await manager.waitFor({state:'visible'});
 const search=()=>manager.getByRole('searchbox',{name:'Search annotations',exact:true});
 const type=()=>manager.getByRole('combobox',{name:'Type',exact:true});
 const group=()=>manager.getByRole('combobox',{name:'Group',exact:true});
 const rows=()=>manager.locator('[data-annotation-layer-item]');
 const all=()=>manager.getByRole('checkbox',{name:'Show all matching annotations',exact:true});
 const hidden=()=>[...state.document.views[0].design.layers.hiddenAnnotationIds].sort();
 const initialHidden=hidden();
 await check('search/type/custom group filters never write either document',async()=>{
  await search().fill('dense');await type().selectOption('boundary');await group().selectOption('group:Health teams');
  assert.equal(await rows().count(),2);
  await search().fill('missing');assert.equal(await rows().count(),0);assert.equal(await all().isDisabled(),true);
  await search().fill('walking');await group().selectOption('all');await type().selectOption('circle');assert.equal(await rows().count(),1);
  await type().selectOption('all');await search().fill('dense');assert.equal(await rows().count(),3);
  await page.waitForTimeout(1000);assert.equal(studioWrites.length,0);assert.equal(state.allowedWrites.length,0);assert.deepEqual(hidden(),initialHidden);
  return{intersectedMatches:2,zeroMatchesDisabled:true,typeMatches:1,studioWrites:0,annotationWrites:0};
 });
 await check('filtered check all is mixed and preserves off-filter and stale visibility ids',async()=>{
  assert.equal(await all().getAttribute('aria-checked'),'mixed');assert.equal(await all().evaluate(n=>n.indeterminate),true);
  await all().check();await until(()=>studioWrites.length===1,'show matching did not persist');
  assert.deepEqual(hidden(),[offFilter,stale].sort());assert.equal(await all().isChecked(),true);
  await all().uncheck();await until(()=>studioWrites.length===2,'hide matching did not persist');
  assert.deepEqual(hidden(),[...ids,offFilter,stale].sort());
  await rows().first().getByRole('checkbox').check();await until(()=>studioWrites.length===3,'individual visibility did not persist');
  assert.equal(await all().getAttribute('aria-checked'),'mixed');assert.equal(state.allowedWrites.length,0);
  for(const write of studioWrites){const after=structuredClone(write.after),before=structuredClone(write.before);assert.equal(after.revision,before.revision+1);assert.equal(after.views[0].revision,before.views[0].revision+1);delete after.revision;delete before.revision;after.views[0].revision=before.views[0].revision;after.views[0].design.layers.hiddenAnnotationIds=before.views[0].design.layers.hiddenAnnotationIds;assert.deepEqual(after,before);}
  return{studioWrites:3,annotationWrites:0,offFilterAndStalePreserved:true,mixed:true};
 });
 const hiddenBeforeGroup=hidden();
 await manager.locator('details.annotation-layer-organise>summary').click();
 const name=()=>manager.getByRole('combobox',{name:'Group name',exact:true});
 await check('typing a group is local; explicit move persists only metadata using current revision',async()=>{
  await name().fill('  Community   partners  ');await page.waitForTimeout(1000);assert.equal(state.allowedWrites.length,0);
  await manager.getByRole('button',{name:'Move 3 matching items',exact:true}).click();
  await until(()=>state.allowedWrites.length===1,'group action did not save');await manager.getByRole('status').filter({hasText:'Group saved.'}).waitFor();
  for(const id of ids)assert.equal(state.annotations.find(a=>a.id===id).groupName,'Community partners');
  assert.deepEqual(withoutGroups(state.annotations),withoutGroups(original));assert.deepEqual(hidden(),hiddenBeforeGroup);assert.equal(studioWrites.length,3);
  assert.equal(state.annotationRevision,2);
  await page.screenshot({path:path.join(out,'annotation-groups.png')});
  return{annotationWrites:1,revision:2,changedIds:3,geometryAndStyleExact:true,viewVisibilityUnchanged:true};
 });
 await check('identical normalized assignment is disabled and Enter cannot create a no-op save',async()=>{
  await group().selectOption('group:Community partners');await name().fill('Community partners');
  assert.equal(await manager.getByRole('button',{name:'Move 3 matching items',exact:true}).isDisabled(),true);
  await name().press('Enter');await page.waitForTimeout(1000);assert.equal(state.allowedWrites.length,1);
  return{noOpWrites:0,groupFilter:'Community partners'};
 });
 await check('inline Undo reverses exactly the latest group action; removed group filter resets honestly',async()=>{
  await manager.getByRole('button',{name:'Undo group change',exact:true}).click();
  await until(()=>state.allowedWrites.length===2,'Undo did not persist');assert.deepEqual(state.annotations,original);
  await manager.waitFor({state:'visible'});
  await until(async()=>await group().inputValue()==='all','removed custom group left a stale filter');
  assert.equal(await group().inputValue(),'all');assert.equal(await rows().count(),3);assert.deepEqual(hidden(),hiddenBeforeGroup);
  return{undoWrites:1,allAnnotationsExact:true,invalidGroupFilterReset:'all',viewVisibilityUnchanged:true};
 });
 await check('explicit ungroup persists only matching group metadata and survives ordinary reload',async()=>{
  await group().selectOption('group:Health teams');assert.equal(await rows().count(),2);await name().fill('');
  await manager.getByRole('button',{name:'Ungroup 2 matching items',exact:true}).click();await until(()=>state.allowedWrites.length===3,'Ungroup did not save');
  assert.equal(Object.hasOwn(state.annotations[1],'groupName'),false);assert.equal(Object.hasOwn(state.annotations[2],'groupName'),false);
  assert.deepEqual(withoutGroups(state.annotations),withoutGroups(original));assert.deepEqual(hidden(),hiddenBeforeGroup);
  await page.reload();await page.locator('[data-owner-canvas-enter]').click();await page.locator('[data-owner-canvas-tool="studio"]').click();await page.locator('[data-map-studio-annotation-layers]>summary').click();manager=page.locator('[data-annotation-layer-manager]');
  assert.equal(await manager.getByRole('combobox',{name:'Group',exact:true}).locator('option').filter({hasText:'Health teams'}).count(),0);assert.equal(await rows().count(),97);
  assert.deepEqual(hidden(),hiddenBeforeGroup);assert.equal(state.allowedWrites.length,3);assert.equal(studioWrites.length,3);
  return{ungroupWrites:1,reloadCount:97,revision:state.annotationRevision,visibilityUnchanged:true};
 });
 await check('a newly named group survives a fresh owner-page reload',async()=>{
  await search().fill('dense');await manager.locator('details.annotation-layer-organise>summary').click();await name().fill('Persisted team');
  await manager.getByRole('button',{name:'Move 3 matching items',exact:true}).click();await until(()=>state.allowedWrites.length===4,'new group did not persist');
  await page.reload();await page.locator('[data-owner-canvas-enter]').click();await page.locator('[data-owner-canvas-tool="studio"]').click();await page.locator('[data-map-studio-annotation-layers]>summary').click();manager=page.locator('[data-annotation-layer-manager]');
  await group().selectOption('group:Persisted team');assert.equal(await rows().count(),3);await group().selectOption('all');
  assert.deepEqual(withoutGroups(state.annotations),withoutGroups(original));assert.deepEqual(hidden(),hiddenBeforeGroup);assert.equal(state.allowedWrites.length,4);assert.equal(studioWrites.length,3);
  return{positiveGroupReload:true,matchingItems:3,geometryAndVisibilityUnchanged:true};
 });
 await check('failed group save retains its local draft and offers an immediate retry',async()=>{
  let failuresLeft=2,failedAttempts=0;
  await page.route(`**/api/my-maps/${fixture.mapId}/print-annotations`,async route=>{
   if(route.request().method()==='PUT'&&failuresLeft>0){failuresLeft--;failedAttempts++;return route.fulfill({status:503,json:{error:'Fictional group save failure'}});}
   return route.fallback();
  });
  const savedBefore=structuredClone(state.annotations),beforeWrites=state.allowedWrites.length;
  await search().fill('dense');await manager.locator('details.annotation-layer-organise>summary').click();await name().fill('Recovery team');
  await manager.getByRole('button',{name:'Move 3 matching items',exact:true}).click();await manager.getByRole('alert').waitFor();
  assert.deepEqual(state.annotations,savedBefore);assert.equal(state.allowedWrites.length,beforeWrites);
  assert.equal(await page.locator('[data-owner-canvas-save]').getAttribute('data-owner-canvas-save'),'failed');
  await page.locator('[data-owner-canvas-exit]').click();await page.locator('[data-owner-canvas-enter]').click();await page.locator('[data-owner-canvas-tool="studio"]').click();
  const itemDetails=page.locator('[data-map-studio-annotation-layers]');if(await itemDetails.getAttribute('open')===null)await itemDetails.locator(':scope>summary').click();manager=page.locator('[data-annotation-layer-manager]');
  const organise=manager.locator('details.annotation-layer-organise');if(await organise.getAttribute('open')===null)await organise.locator(':scope>summary').click();
  const retry=manager.getByRole('button',{name:'Retry saving group',exact:true});assert.equal(await retry.count(),1,'a failed group action must offer retry in its own inspector');
  await retry.click();await until(()=>failedAttempts===2,'second deliberate failure not observed');await manager.getByRole('alert').waitFor();assert.equal(state.allowedWrites.length,beforeWrites);
  await retry.click();await until(()=>state.allowedWrites.length===beforeWrites+1,'group retry did not persist');
  for(const id of ids)assert.equal(state.annotations.find(a=>a.id===id).groupName,'Recovery team');
  assert.deepEqual(withoutGroups(state.annotations),withoutGroups(original));assert.deepEqual(hidden(),hiddenBeforeGroup);
  await manager.getByRole('button',{name:'Undo group change',exact:true}).click();await until(()=>state.allowedWrites.length===beforeWrites+2,'Undo after Retry did not persist');
  assert.deepEqual(state.annotations,savedBefore);assert.deepEqual(hidden(),hiddenBeforeGroup);
  return{retainedUntilRetry:true,retrySurvivesReturn:true,failedAttempts:2,successfulRetryWrites:1,undoWrites:1,noDuplicatedHistory:true,geometryAndVisibilityExact:true};
 });
 report.allowedAnnotationWrites=state.allowedWrites;report.allowedStudioWrites=studioWrites.length;report.errors=state.errors;report.unexpectedWrites=state.unexpectedWrites;assert.deepEqual(report.errors,[]);assert.deepEqual(report.unexpectedWrites,[]);
 // The unchanged GoogleOAuthProvider attempts its SDK once per document. The
 // fixture aborts it before network; keep those attempts explicit and bounded.
 report.blockedGoogleSdkAttempts=state.blockedExternal.filter(value=>value.origin==='https://accounts.google.com'&&value.path==='/gsi/client').length;
 assert.ok(report.blockedGoogleSdkAttempts<=3);
 report.otherBlockedExternal=state.blockedExternal.filter(value=>value.origin!=='https://accounts.google.com'||value.path!=='/gsi/client');assert.deepEqual(report.otherBlockedExternal,[]);
}catch(error){report.failure=error.stack;process.exitCode=1;if(page&&!page.isClosed()){await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});await fs.writeFile(path.join(out,'failure-dom.txt'),await page.locator('body').innerText()).catch(()=>{});}console.error(error.stack);}
finally{report.sourceAfter=await fingerprint();report.sourceUnchanged=JSON.stringify(report.sourceBefore)===JSON.stringify(report.sourceAfter);if(!report.sourceUnchanged){report.failure||='Source changed during browser checks';process.exitCode=1;}report.summary={passed:report.cases.filter(c=>c.passed).length,failed:report.cases.filter(c=>!c.passed).length};await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser?.close();await fixture?.server.close();console.log(JSON.stringify({out,summary:report.summary,failure:report.failure,sourceUnchanged:report.sourceUnchanged},null,2));}
