// Actual App against fictional intercepted APIs; never opens a production map.
// Usage: node tests/browser/care-map-area-resources.mjs --out=/absolute/output
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {startAreaFixture,fingerprint,existingAssets,keyFor,clone} from '../fixtures/care-map-area-resources/runtime.mjs';
import {wholeArea,wholeAreaAnnotation} from '../fixtures/care-map-area-resources/whole-area-addresses.mjs';

const out=process.argv.find(value=>value.startsWith('--out='))?.slice(6)||await fs.mkdtemp(path.join(os.tmpdir(),'care-map-area-resources-'));
const caseFilter=process.argv.find(value=>value.startsWith('--case='))?.slice(7);
const probeAddressFooter=process.argv.includes('--probe-address-footer');
await fs.mkdir(out,{recursive:true});
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const harnessPaths=[fileURLToPath(import.meta.url),...[
 '../fixtures/care-map-area-resources/runtime.mjs','../fixtures/care-map-area-resources/whole-area-addresses.mjs','../fixtures/care-map-floating-canvas/runtime.mjs',
 '../fixtures/care-map-floating-canvas/data.mjs','../fixtures/caremap-spatial-tools/fictional-api.mjs','../fixtures/care-map-view-controls/vite.config.mjs',
 '../../scripts/build-address-snapshot.mjs','../../server/src/routes/addressSnapshot.js','../../server/src/controllers/addressSnapshotController.js',
 '../../server/src/utils/addressSnapshotRepository.js','../../server/src/utils/addressSnapshotScanRepository.js','../../server/src/utils/addressSnapshotConfig.js',
 '../../server/src/middleware/auth.js','../../server/src/utils/sessionAuth.js','../../package-lock.json',
].map(filename=>fileURLToPath(new URL(filename,import.meta.url)))];
async function harnessFingerprint(){return Object.fromEntries(await Promise.all(harnessPaths.map(async filename=>[filename,createHash('sha256').update(await fs.readFile(filename)).digest('hex')])));}
async function runtimeFingerprint(){const sharedRoot=fileURLToPath(new URL('../../shared/',import.meta.url)),paths=(await fs.readdir(sharedRoot,{recursive:true})).filter(filename=>/\.(?:m?js|json)$/.test(filename)).sort();return{...await fingerprint(),shared:Object.fromEntries(await Promise.all(paths.map(async filename=>[filename,createHash('sha256').update(await fs.readFile(path.join(sharedRoot,filename))).digest('hex')])))};}
const report={boundary:'Local actual-App client-flow proof. Fictional intercepted resource state simulates the additive endpoint and canonical venue scope. Whole-area cases use genuine address routes and verified readers over synthetic in-memory objects. Client, shared modules, provider and harness sources are hashed before/after. No production sessions, data, geometry edits, or external calls.',sourceBefore:await runtimeFingerprint(),harnessBefore:await harnessFingerprint(),cases:[],pageErrors:[],unexpectedWrites:[]};
await fs.mkdir(path.join(out,'harness-source'),{recursive:true});
report.harnessCopies=await Promise.all(Object.entries(report.harnessBefore).map(async([filename,sha256])=>{const destination=path.join(out,'harness-source',`${sha256}-${path.basename(filename)}`);await fs.copyFile(filename,destination);return{path:destination,sha256};}));
let fixture,browser,activeCase='entry';
async function until(fn,message,timeout=12000){const end=Date.now()+timeout;while(Date.now()<end){if(await fn())return;await new Promise(resolve=>setTimeout(resolve,40));}throw Error(message);}
async function check(name,fn){if(caseFilter&&!name.includes(caseFilter))return;activeCase=name.toLowerCase().replace(/[^a-z0-9]+/g,'-');try{report.cases.push({name,passed:true,evidence:await fn()});}catch(error){report.cases.push({name,passed:false,error:error.stack});}}
async function createPage(options={}){const context=await browser.newContext({viewport:options.viewport||{width:1470,height:801}}),page=await context.newPage();page.setDefaultTimeout(12000);const state=await fixture.install(page,options);if(options.startFromDirectory){await page.goto(new URL('/my-directory?section=my-maps',fixture.base).href);await page.locator(`a[href="/my-directory/maps/${fixture.mapId}"]`).first().click();}else await page.goto(new URL('/my-directory/maps/'+fixture.mapId+(options.uiMode==='stable'?'?ui=stable':''),fixture.base).href);await page.locator('[data-owner-canvas-enter]').waitFor();return{context,page,state};}
async function exposeAreaControl(page,control){let value,nativeWheels=0;for(let attempt=0;attempt<15;attempt++){
 value=await control.evaluate(node=>{const b=node.getBoundingClientRect(),workspace=node.closest('[data-map-area-workspace]'),resourceList=workspace.querySelector('[data-map-area-resource-chooser]>ul'),owner=getComputedStyle(workspace).overflowY==='auto'?workspace:resourceList||workspace,l=owner.getBoundingClientRect(),footer=workspace.querySelector('[data-map-area-resource-chooser]>footer,#map-area-panel-addresses>footer'),f=footer?.getBoundingClientRect(),viewBottom=f&&getComputedStyle(footer).position==='sticky'&&f.top>l.top&&f.top<l.bottom?f.top:l.bottom,x=b.x+b.width/2,y=b.y+b.height/2,hit=document.elementFromPoint(x,y);return{top:b.top,bottom:b.bottom,x,y,owner:{x:l.x+l.width/2,y:l.top+(viewBottom-l.top)/2,top:l.top,bottom:l.bottom,visibleBottom:viewBottom,height:l.height,scrollTop:owner.scrollTop,scrollHeight:owner.scrollHeight},exposed:node.contains(hit)&&b.top>=l.top&&b.bottom<=viewBottom};});
 if(value.exposed)return{...value,nativeWheels};assert.ok(value.owner.height>0,'area controls need a nonempty scroll viewport');await page.mouse.move(value.owner.x,Math.max(1,Math.min(await page.evaluate(()=>innerHeight-1),value.owner.y)));await page.mouse.wheel(0,Math.max(-350,Math.min(350,value.y-value.owner.y)));nativeWheels++;await page.waitForTimeout(80);
 }assert.equal(value.exposed,true,'native wheel must expose the requested area control');return{...value,nativeWheels};}
async function openArea(page,{narrow=false,waitForResources=true,annotationId='preview-circle'}={}){
 if(narrow){await page.locator('[data-owner-canvas-enter]').click();await page.locator('[data-owner-canvas-tool="content"]').click();await page.getByRole('button',{name:'Manage resources',exact:true}).click();}
 else await page.getByRole('button',{name:'Manage resources',exact:true}).click();
 await page.locator('[data-map-resources-tab="area"]').click();
 await page.locator('[data-map-area-choice]').selectOption(annotationId);
 if(waitForResources)await page.locator('[data-map-area-resource="soft-82201"]').waitFor();
 assert.equal(await page.getByRole('dialog').count(),1,'one shared resource chooser');
}
function savedDocuments(state){return{originalAssets:state.assets.filter(asset=>existingAssets.some(old=>keyFor(old)===keyFor(asset))),personalPlaces:state.personalPlaces,studio:state.core.document,annotations:state.core.annotations,annotationRevision:state.core.annotationRevision};}
function assertCleanBoundary(state){assert.deepEqual(state.core.unexpectedWrites,[]);assert.deepEqual(state.core.errors,[]);assert.ok(state.writes.every(write=>write.method==='POST'&&(write.path==='/api/favorites/save'||write.path===`/api/my-maps/${fixture.mapId}/assets`)||write.method==='DELETE'&&state.allowLegacyRemove.has(write.explicitLegacyRemoval)));assert.equal(state.core.allowedWrites.length,0);}
async function finishPage(context,page,state){report.pageErrors.push(...state.core.errors);report.unexpectedWrites.push(...state.core.unexpectedWrites);await fs.writeFile(path.join(out,activeCase+'-dom.txt'),await page.locator('body').innerText()).catch(()=>{});await page.screenshot({path:path.join(out,activeCase+'.png')}).catch(()=>{});state.holdCataloguePages?.clear();state.releaseCatalogue?.();for(const pending of state.pendingAddresses||[])state.releaseAddress(pending);await context.close();}

const legacyAddressPath='/api/address-snapshot/area';
const addressScanPath=legacyAddressPath+'/scan';
const addressMetadataPath='/api/address-snapshot/metadata';
const addressTab=page=>page.getByRole('tab',{name:/^Addresses \/ postal codes/});
const addressChecks=panel=>panel.locator('li input[type="checkbox"]');
async function openWholeArea(page){
 await openArea(page,{waitForResources:false,annotationId:wholeAreaAnnotation.id});
 await addressTab(page).click();
 return page.locator('#map-area-panel-addresses');
}
async function nextHeldAddress(state,pathname){
 await until(()=>state.pendingAddresses.some(({entry})=>entry.path===pathname),`Expected held ${pathname} request`);
 return state.pendingAddresses.find(({entry})=>entry.path===pathname);
}
function readOnlyAddressProof(state,before){
 assert.deepEqual(savedDocuments(state),before);
 assert.equal(state.writes.length,0);
 assert.deepEqual(state.addressProvider?.writes||[],[]);
 assertCleanBoundary(state);
}
async function assertUnfinishedAddresses(page,panel){
 assert.equal(await addressTab(page).innerText(),'Addresses / postal codes');
 assert.equal(await addressChecks(panel).count(),0);
 assert.equal(await panel.getByRole('checkbox').count(),0);
 assert.equal(await panel.getByRole('button',{name:/Download .* CSV|Copy selected postal/}).count(),0);
 assert.equal(await panel.getByText(/No addresses in this snapshot/).count(),0);
}
async function expectAddressRows(panel,expected){
 const checks=addressChecks(panel);
 await checks.nth(expected.length-1).waitFor({state:'attached'});
 assert.deepEqual(await checks.evaluateAll(nodes=>nodes.map(node=>node.getAttribute('aria-label'))),
  expected.map(row=>`${row.postalCode} ${row.address}`));
}
function expectedAddressCsv(rows){
 const quote=value=>'"'+String(value).replaceAll('"','""')+'"';
 const header='"postalCode","block","roadName","building","address","lat","lng"';
 return Buffer.from('\ufeff'+[header,...rows.map(row=>[
  "'"+row.postalCode,row.block,row.roadName,row.building,row.address,row.lat,row.lng,
 ].map(quote).join(','))].join('\r\n')+'\r\n');
}
async function readAddressCsv(page,button,filename,expected){
 const pending=page.waitForEvent('download');
 await button.click();
 const download=await pending;
 const location=path.join(out,filename);
 await download.saveAs(location);
 const actual=await fs.readFile(location);
 const csvHash=createHash('sha256').update(actual).digest('hex');
 assert.equal(actual.toString().split('\r\n').length-2,expected.length);
 assert.equal(csvHash,createHash('sha256').update(expectedAddressCsv(expected)).digest('hex'));
 return {rows:expected.length,sha256:csvHash};
}

try{
 fixture=await startAreaFixture(out);browser=await chromium.launch({headless:true});
 await check('catalogue slow first pages finish after15 seconds before the shared45 second deadline',async()=>{
  const{context,page,state}=await createPage({holdCataloguePages:['hard:1','soft:1']});try{
   const before=savedDocuments(state);await page.clock.install();await openArea(page,{waitForResources:false});await until(()=>state.pendingCatalogue.length===2,'both first pages held');
   await page.clock.fastForward(16000);const panel=page.locator('#map-area-panel-resources');assert.equal(await panel.getByRole('alert').count(),0,'a16-second catalogue page must remain loading');assert.equal(await panel.locator('[data-map-area-resource]').count(),0);
   state.holdCataloguePages.clear();state.releaseCatalogue();await page.locator('[data-map-area-resource="soft-82201"]').waitFor();assert.equal(state.catalogueAborts.length,0);assert.equal(new Set(state.catalogueReads.map(item=>item.key)).size,state.catalogueReads.length,'no automatic page retries');assert.deepEqual(savedDocuments(state),before);assert.equal(state.writes.length,0);assertCleanBoundary(state);return{virtualDelayMs:16000,completePages:state.catalogueReads,zeroWrites:true};
  }finally{await finishPage(context,page,state);}
 });
 await check('catalogue45 second deadline aborts transport and sibling once without partial rows',async()=>{
  const{context,page,state}=await createPage({holdCataloguePages:['hard:1','soft:1']});try{
   const before=savedDocuments(state);await page.clock.install();await openArea(page,{waitForResources:false});await until(()=>state.pendingCatalogue.length===2,'both first pages held');await page.clock.fastForward(44000);assert.equal(await page.locator('#map-area-panel-resources').getByRole('alert').count(),0);assert.equal(state.catalogueAborts.length,0);await page.clock.fastForward(2000);await page.locator('#map-area-panel-resources').getByRole('alert').waitFor();await until(()=>state.catalogueAborts.length===2,'deadline must cancel both transports');assert.equal(await page.locator('[data-map-area-resource]').count(),0);assert.equal(state.catalogueReads.length,2);assert.deepEqual(savedDocuments(state),before);assert.equal(state.writes.length,0);assertCleanBoundary(state);return{virtualDelayMs:46000,aborts:state.catalogueAborts,attempts:state.catalogueReads.length,zeroWrites:true};
  }finally{await finishPage(context,page,state);}
 });
 await check('catalogue later page failure cancels sibling and Retry restarts both complete lists',async()=>{
  const{context,page,state}=await createPage({holdCataloguePages:['soft:1'],failCataloguePages:['hard:2']});try{
   const before=savedDocuments(state);await openArea(page,{waitForResources:false});const panel=page.locator('#map-area-panel-resources');await panel.getByRole('alert').waitFor();await until(()=>state.catalogueAborts.some(item=>item.key==='soft:1'),'failed later page must abort pending sibling');assert.equal(await panel.locator('[data-map-area-resource]').count(),0,'no successful first-page rows may leak');assert.equal(await page.locator('[data-map-area-save-add]').count(),0);assert.equal(state.catalogueReads.filter(item=>item.key==='hard:2').length,1);
   state.holdCataloguePages.clear();state.releaseCatalogue();const start=state.catalogueReads.length;await panel.getByRole('button',{name:'Retry',exact:true}).click();await page.locator('[data-map-area-resource="soft-82201"]').waitFor();const retried=state.catalogueReads.slice(start);assert.ok(retried.some(item=>item.key==='hard:1')&&retried.some(item=>item.key==='soft:1'));assert.deepEqual(savedDocuments(state),before);assert.equal(state.writes.length,0);assertCleanBoundary(state);return{firstFailure:'hard:2',siblingAborted:true,retriedPages:retried,zeroWrites:true};
  }finally{await finishPage(context,page,state);}
 });
 await check('catalogue area change and Close cancel old requests and ignore late delivery',async()=>{
  const{context,page,state}=await createPage({allShapes:true,holdCataloguePages:['hard:1','soft:1']});try{
   const before=savedDocuments(state);await openArea(page,{waitForResources:false});await until(()=>state.pendingCatalogue.length===2,'old area pages held');const old=state.pendingCatalogue.slice();await page.locator('[data-map-area-choice]').selectOption('preview-box');await until(()=>state.pendingCatalogue.length===4,'new area starts fresh pages');await until(()=>state.catalogueAborts.length>=2,'old area transports cancelled');state.releaseCatalogue(item=>old.includes(item));await page.waitForTimeout(150);assert.equal(await page.locator('[data-map-area-resource]').count(),0,'late old-area delivery cannot populate new area');assert.equal(await page.locator('[data-map-area-choice]').inputValue(),'preview-box');
   await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();await until(()=>state.catalogueAborts.length===4,'Close cancels current area transports');state.holdCataloguePages.clear();state.releaseCatalogue();await page.waitForTimeout(150);assert.equal(await page.locator('[data-map-area-results]').count(),0);await openArea(page);assert.deepEqual(savedDocuments(state),before);assert.equal(state.writes.length,0);assertCleanBoundary(state);return{cancelledRequests:state.catalogueAborts,freshReopen:true,lateRowsSuppressed:true,zeroWrites:true};
  }finally{await finishPage(context,page,state);}
 });
 await check('original Saved and catalogue Manage submission preserves the unchanged complete membership',async()=>{
  const{context,page,state}=await createPage();try{
   const before=savedDocuments(state);await page.getByRole('button',{name:'Manage resources',exact:true}).click();await page.getByRole('button',{name:/^update.*map$/i}).click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.deepEqual(savedDocuments(state),before);assert.equal(state.writes.length,0);assertCleanBoundary(state);return{originalFullSelectionUnchanged:true,mapAssetKeys:state.assets.map(keyFor),savedMutations:0};
  }finally{await finishPage(context,page,state);}
 });
 await check('Create map keeps its original creation form and does not expose the Manage-only area tab',async()=>{
  const{context,page,state}=await createPage();try{
   await page.getByRole('link',{name:'Care Maps',exact:true}).click();await page.getByRole('button',{name:/^create.*map$/i}).click();const dialog=page.getByRole('dialog');await dialog.waitFor();assert.equal(await dialog.locator('[data-map-resources-tab="area"]').count(),0);assert.equal(await dialog.locator('input[type="text"]').count()>0,true);assert.equal(state.writes.length,0);assertCleanBoundary(state);return{manageOnlyAreaTab:true,creationInputsRetained:true,savedMutations:0};
  }finally{await finishPage(context,page,state);}
 });
 await check('retained stable owner mount exposes the same additive area chooser',async()=>{
  const{context,page,state}=await createPage({uiMode:'stable'});try{
   const before=savedDocuments(state);await openArea(page);await page.locator('[data-map-area-resource-select="soft-82201"]').check();await page.locator('[data-map-area-save-add]').click();await until(async()=>state.assets.some(asset=>keyFor(asset)==='soft-82201')&&await page.locator('[data-map-area-stop]').count()===0,'retained mount did not confirm additive membership');assert.deepEqual(state.assets.find(asset=>keyFor(asset)==='soft-82201').mapLocationScope,{version:1,placeIds:[82102]});assert.deepEqual(savedDocuments(state),before);assertCleanBoundary(state);return{retainedUi:'stable',sameChooser:true,oldMembersExact:true,newScope:[82102]};
  }finally{await finishPage(context,page,state);}
 });
 await check('Manage Within area selects matching catalogue resources locally and adds without replacing existing membership',async()=>{
  const{context,page,state}=await createPage();try{
   const before=savedDocuments(state);await openArea(page);
   assert.equal(await page.locator('[data-map-area-resource-select="hard-82101"]').isDisabled(),true);
   assert.equal(await page.locator('[data-map-area-resource-select="soft-82203"]').isDisabled(),true);
   assert.equal(await page.locator('[data-map-area-resource="hard-82103"]').count(),0,'outside hard resource excluded');
   await page.locator('[data-map-area-resource-select="hard-82102"]').check();await page.locator('[data-map-area-resource-select="soft-82201"]').check();
   assert.equal(await page.locator('[data-map-area-venue="soft-82201:82102"]').isChecked(),true);
   assert.equal(state.writes.length,0,'selection alone never saves');
   await page.screenshot({path:path.join(out,'area-selected-desktop.png')});
   await page.locator('[data-map-area-save-add]').click();
   await until(()=>state.assets.some(asset=>keyFor(asset)==='soft-82201')&&state.assets.some(asset=>keyFor(asset)==='hard-82102'),'both selected map memberships not confirmed');
   await until(async()=>!await page.locator('[data-map-area-save-add]').isDisabled()||await page.locator('[data-map-area-resource-state="already_on_map"]').count()>=4,'final queue state not reconciled');
   const added=state.assets.find(asset=>keyFor(asset)==='soft-82201');assert.deepEqual(added.mapLocationScope,{version:1,placeIds:[82102]});
   assert.deepEqual(savedDocuments(state),before);assert.equal(state.assets.length,5);assert.ok(state.saved.some(asset=>keyFor(asset)==='soft-82201'));
   const newRows=state.directory().places.filter(place=>place.rows.some(row=>keyFor(row)==='soft-82201'));assert.equal(newRows.length,1);assert.equal(newRows[0].placeKey,'hard-82102');
   assertCleanBoundary(state);return{selected:['hard-82102','soft-82201'],writes:state.writes,existingHash:hash(before),afterHash:hash(savedDocuments(state)),newOfferingPlaceKeys:newRows.map(row=>row.placeKey),noDeletes:true};
  }finally{await finishPage(context,page,state);}
 });
 await check('ENTER in Within-area search cannot submit the old membership form before or after an additive save',async()=>{
  const{context,page,state}=await createPage();try{
   const before=savedDocuments(state);await openArea(page);const search=page.locator('[data-map-area-resource-chooser] input[type="search"]');await search.fill('programme');assert.equal(await search.locator('xpath=ancestor::form').count(),0);await search.press('Enter');await page.waitForTimeout(150);assert.equal(state.writes.length,0);assert.equal(await page.getByRole('dialog').isVisible(),true);
   await page.locator('[data-map-area-resource-select="soft-82201"]').check();await page.locator('[data-map-area-save-add]').click();await until(async()=>state.assets.some(asset=>keyFor(asset)==='soft-82201')&&await page.locator('[data-map-area-stop]').count()===0&&await page.locator('[data-map-area-resource-select="soft-82201"]').isDisabled(),'addition not reconciled');const afterWrites=state.writes.length;await search.press('Enter');await page.waitForTimeout(150);assert.equal(state.writes.length,afterWrites);assert.equal(await page.getByRole('dialog').isVisible(),true);assert.equal(await page.locator('[data-map-resources-tab="area"]').getAttribute('aria-selected'),'true');assert.deepEqual(savedDocuments(state),before);assert.equal(state.assets.length,4);assertCleanBoundary(state);
   return{searchAncestorForms:0,enterBeforeSaveMutations:0,enterAfterSaveMutations:0,newMembershipRetained:true,workspaceRemainedOpen:true};
  }finally{await finishPage(context,page,state);}
 });
 for(const pendingChoice of [false,true])await check(`Saved-tab ${pendingChoice?'pending deselection survives':'unchanged submission retains'} an area addition`,async()=>{
  const{context,page,state}=await createPage({allowLegacyRemove:pendingChoice?['soft-82202']:[]});try{
   const before=savedDocuments(state);await page.getByRole('button',{name:'Manage resources',exact:true}).click();if(pendingChoice)await page.getByTestId('create-map-asset-soft-82202').uncheck();await page.locator('[data-map-resources-tab="area"]').click();await page.locator('[data-map-area-choice]').selectOption('preview-circle');await page.locator('[data-map-area-resource-select="soft-82201"]').check();await page.locator('[data-map-area-save-add]').click();await until(async()=>state.assets.some(asset=>keyFor(asset)==='soft-82201')&&await page.locator('[data-map-area-stop]').count()===0,'area addition not settled');
   await page.locator('[data-map-resources-tab="saved"]').click();assert.equal(await page.getByTestId('create-map-asset-soft-82201').isChecked(),true,'newly added membership must be included in the complete Saved selection');assert.equal(await page.getByTestId('create-map-asset-soft-82202').isChecked(),!pendingChoice,'prior pending Saved-tab choice must survive adding a different resource');
   const writes=state.writes.length;await page.getByTestId('create-map-submit').click();await page.getByRole('dialog').waitFor({state:'hidden'});
   if(pendingChoice){assert.equal(state.assets.length,3);assert.ok(!state.assets.some(asset=>keyFor(asset)==='soft-82202'));const expected=clone(before);expected.originalAssets=expected.originalAssets.filter(asset=>keyFor(asset)!=='soft-82202');assert.deepEqual(savedDocuments(state),expected);assert.equal(state.writes.length,writes+1);assert.equal(state.writes.at(-1).explicitLegacyRemoval,'soft-82202');assert.deepEqual(state.assets.find(asset=>keyFor(asset)==='soft-82201').mapLocationScope,{version:1,placeIds:[82102]});assert.ok(state.saved.some(asset=>keyFor(asset)==='soft-82202'),'explicit map removal must not unsave globally');}
   else{assert.equal(state.assets.length,4);assert.deepEqual(savedDocuments(state),before);assert.equal(state.writes.length,writes);}
   assertCleanBoundary(state);return{newMembershipChecked:true,pendingChoiceRetained:pendingChoice,explicitOldTabRemoval:pendingChoice?'soft-82202':null,otherOriginalMembersExact:true,newScopeExact:true,globalSavedKept:true,oldSubmitExtraWrites:pendingChoice?1:0};
  }finally{await finishPage(context,page,state);}
 });
 await check('zero chosen programme venues cannot silently widen scope or create a membership',async()=>{
  const{context,page,state}=await createPage();try{
   const before=savedDocuments(state);await openArea(page);await page.locator('[data-map-area-resource-select="soft-82201"]').check();await page.locator('[data-map-area-venue="soft-82201:82102"]').uncheck();
   assert.equal(await page.locator('[data-map-area-save-add]').isDisabled(),true);assert.equal(state.writes.length,0);assert.equal(state.assets.length,3);
   assert.equal(await page.locator('[data-map-area-resource-select="soft-82201"]').isDisabled(),false,'an invalid selected row can still be deselected');await page.locator('[data-map-area-resource-select="soft-82201"]').uncheck();
   assert.deepEqual(savedDocuments(state),before);assertCleanBoundary(state);return{emptyVenueSelectionRejectedBeforeRequest:true,existingListOnlyPreserved:true,noFabricatedCoordinates:true};
  }finally{await finishPage(context,page,state);}
 });
 await check('all-known venues require explicit opt-in and existing all-venue assets are never respecified',async()=>{
  const{context,page,state}=await createPage();try{
   const before=savedDocuments(state);await openArea(page);await page.locator('[data-map-area-resource-select="soft-82201"]').check();await page.locator('[data-map-area-all-venues="soft-82201"]').check();assert.equal(state.writes.length,0);await page.locator('[data-map-area-save-add]').click();
   await until(()=>state.assets.some(asset=>keyFor(asset)==='soft-82201'),'all-known membership not confirmed');
   const rows=state.directory().places.filter(place=>place.rows.some(row=>keyFor(row)==='soft-82201'));assert.deepEqual(rows.map(row=>row.placeKey).sort(),['hard-82102','hard-82103']);assert.deepEqual(savedDocuments(state),before);assertCleanBoundary(state);
   return{explicitAllKnown:true,mapAdd:state.writes.find(write=>write.path.endsWith('/assets')),renderedVenueKeys:rows.map(row=>row.placeKey)};
  }finally{await finishPage(context,page,state);}
 });
 await check('partial map-add failure leaves the resource Saved and retry preserves successful additions and existing membership',async()=>{
  const{context,page,state}=await createPage({failNextAdd:['hard-82105']});try{
   const before=savedDocuments(state);await openArea(page);await page.locator('[data-map-area-resource-select="hard-82105"]').check();await page.locator('[data-map-area-resource-select="soft-82201"]').check();await page.locator('[data-map-area-save-add]').click();
   await until(()=>state.assets.some(asset=>keyFor(asset)==='soft-82201'),'other selected resource did not complete after partial failure');await until(async()=>!await page.locator('[data-map-area-save-add]').isDisabled(),'retry did not become available');
   assert.ok(state.saved.some(asset=>keyFor(asset)==='hard-82105'));assert.ok(!state.assets.some(asset=>keyFor(asset)==='hard-82105'));assert.deepEqual(savedDocuments(state),before);
   await page.locator('[data-map-area-save-add]').click();await until(()=>state.assets.some(asset=>keyFor(asset)==='hard-82105'),'retry did not confirm failed membership');assert.equal(state.assets.filter(asset=>keyFor(asset)==='soft-82201').length,1);assert.deepEqual(savedDocuments(state),before);assertCleanBoundary(state);
   return{savedBeforeRetry:true,otherSelectedAddedDuringPartial:true,mapAddedAfterRetry:true,writes:state.writes,noToggleOrDelete:true};
  }finally{await finishPage(context,page,state);}
 });
 await check('accepted-but-lost add response is reconciled from authoritative membership without duplicate or rescope',async()=>{
  const{context,page,state}=await createPage({unknownNextAdd:['soft-82201']});try{
   const before=savedDocuments(state);await openArea(page);await page.locator('[data-map-area-resource-select="soft-82201"]').check();await page.locator('[data-map-area-save-add]').click();await until(()=>state.assets.some(asset=>keyFor(asset)==='soft-82201'),'fictional server did not accept request');
   await until(async()=>state.assets.some(asset=>keyFor(asset)==='soft-82201')&&await page.locator('[data-map-area-stop]').count()===0&&await page.locator('[data-map-area-resource-select="soft-82201"]').isDisabled(),'lost response not reconciled as already on map');assert.equal(state.assets.filter(asset=>keyFor(asset)==='soft-82201').length,1);assert.deepEqual(savedDocuments(state),before);assertCleanBoundary(state);
   return{oneStoredMembership:true,writes:state.writes,scope:state.assets.find(asset=>keyFor(asset)==='soft-82201').mapLocationScope};
  }finally{await finishPage(context,page,state);}
 });
 await check('concurrent409 membership keeps its authoritative all-venue scope and is never resubmitted as a replacement',async()=>{
  const{context,page,state}=await createPage({conflictNextAdd:['soft-82201']});try{
   const before=savedDocuments(state);await openArea(page);await page.locator('[data-map-area-resource-select="soft-82201"]').check();await page.locator('[data-map-area-save-add]').click();await until(async()=>state.assets.some(asset=>keyFor(asset)==='soft-82201')&&await page.locator('[data-map-area-stop]').count()===0&&await page.locator('[data-map-area-resource-select="soft-82201"]').isDisabled(),'concurrent membership not reconciled');
   const added=state.assets.find(asset=>keyFor(asset)==='soft-82201');assert.ok(added);assert.equal(added.mapLocationScope,undefined);assert.equal(state.writes.filter(write=>write.path.endsWith('/assets')).length,1);assert.deepEqual(savedDocuments(state),before);assertCleanBoundary(state);return{conflict409:true,concurrentAllVenueScopeRetained:true,replacementRequests:0,writes:state.writes};
  }finally{await finishPage(context,page,state);}
 });
 await check('Stop limits the queue to at most three in-flight additions and never removes accepted results',async()=>{
  const selected=['hard-82102','hard-82105','hard-82106','hard-82107','soft-82201'];
  const{context,page,state}=await createPage({holdNextAdd:selected});try{
   const before=savedDocuments(state);await openArea(page);for(const key of selected)await page.locator(`[data-map-area-resource-select="${key}"]`).check();await page.locator('[data-map-area-save-add]').click();
   await until(()=>state.pendingAdds.length===3,'three bounded in-flight additions were not held');await page.locator('[data-map-area-stop]').click();state.releaseAdds();
   await until(()=>state.assets.length===6,'already accepted in-flight additions did not finish');await page.waitForTimeout(200);
   const mapAdds=state.writes.filter(write=>write.path.endsWith('/assets'));assert.equal(mapAdds.length,3);assert.equal(state.assets.length,6);assert.deepEqual(savedDocuments(state),before);assertCleanBoundary(state);
   return{selected:5,inFlightBound:3,mapAddAttempts:mapAdds.length,acceptedResultsPreserved:true,queuedRemainderNotStarted:true,writes:state.writes};
  }finally{state.releaseAdds();await finishPage(context,page,state);}
 });
 await check('actual SPA back navigation stops queued work and never sends additions to another map',async()=>{
  const selected=['hard-82102','hard-82105','hard-82106','hard-82107','soft-82201'];
  const{context,page,state}=await createPage({holdNextAdd:selected,startFromDirectory:true});try{
   const before=savedDocuments(state);await openArea(page);for(const key of selected)await page.locator(`[data-map-area-resource-select="${key}"]`).check();await page.locator('[data-map-area-save-add]').click();await until(()=>state.pendingAdds.length===3,'three original-target in-flight additions were not held');
   const timeOrigin=await page.evaluate(()=>performance.timeOrigin);await page.goBack();await page.waitForURL(url=>url.pathname==='/my-directory');assert.equal(await page.evaluate(()=>performance.timeOrigin),timeOrigin,'navigation used the actual SPA history');state.releaseAdds();await until(()=>state.assets.length===6,'accepted original-target requests were not retained');await page.waitForTimeout(200);
   const adds=state.writes.filter(write=>write.path.endsWith('/assets'));assert.equal(adds.length,3);assert.ok(adds.every(write=>write.path===`/api/my-maps/${fixture.mapId}/assets`));assert.equal(await page.locator('[data-map-area-add-status]').count(),0,'old chooser completion must not reappear on the directory');assert.deepEqual(savedDocuments(state),before);assertCleanBoundary(state);
   return{actualSpaHistory:true,oldTargetOnly:fixture.mapId,acceptedInFlight:3,queuedRemainderStopped:true,staleChooserAbsent:true,writes:state.writes};
  }finally{state.releaseAdds();await finishPage(context,page,state);}
 });
 await check('Draw selected-area shortcut opens the same single chooser and clean Studio handoff remains intact',async()=>{
  const{context,page,state}=await createPage();try{
   const before=savedDocuments(state);await page.locator('[data-owner-canvas-enter]').click();await page.locator('[data-owner-canvas-tool="draw"]').click();await until(()=>page.evaluate(()=>window.__qaEditorState?.enabled),'Draw not ready');
   const beforeMap=await page.evaluate(()=>{const m=[...window.__qaMaps].find(m=>m.getContainer().isConnected&&m.getContainer().getBoundingClientRect().width>0),p=m.latLngToContainerPoint([1.3844966,103.75]),b=m.getContainer().getBoundingClientRect();return{index:[...window.__qaMaps].indexOf(m),zoom:m.getZoom(),point:{x:b.x+p.x,y:b.y+p.y}};});
   await page.mouse.click(beforeMap.point.x,beforeMap.point.y);await until(()=>page.evaluate(()=>window.__qaEditorState.selectedId==='preview-circle'),'circle selection failed');await page.getByRole('button',{name:'Find within area',exact:true}).click();await page.locator('[data-map-area-resource="soft-82201"]').waitFor();assert.equal(await page.getByRole('dialog').count(),1);assert.equal(await page.locator('[data-map-area-choice]').inputValue(),'preview-circle');
   await page.getByRole('dialog').getByRole('button',{name:/close|cancel/i}).first().click();await page.locator('[data-owner-canvas-tool="studio"]').click();await until(()=>page.evaluate(()=>window.__qaEditorState.enabled===false),'Studio did not close Draw ownership');
   const afterMap=await page.evaluate(()=>{const m=[...window.__qaMaps].find(m=>m.getContainer().isConnected&&m.getContainer().getBoundingClientRect().width>0);return{index:[...window.__qaMaps].indexOf(m),zoom:m.getZoom()};});assert.deepEqual(afterMap,{index:beforeMap.index,zoom:beforeMap.zoom});assert.deepEqual(savedDocuments(state),before);assert.equal(state.writes.length,0);assertCleanBoundary(state);return{sameChooser:true,sameLeafletAndZoom:true,zeroWrites:true};
  }finally{await finishPage(context,page,state);}
 });
 await check('whole-area automatically scans 300 tiles using exact multipart geometry and downloads source-ordered rows',async()=>{
  const{context,page,state}=await createPage({wholeAddressFixture:true,holdAddressPaths:[addressScanPath]});
  try{
   await context.grantPermissions(['clipboard-read','clipboard-write']);
   const before=savedDocuments(state);
   await openArea(page,{waitForResources:false,annotationId:wholeAreaAnnotation.id});
   await until(()=>state.addressRequests.some(request=>request.path===legacyAddressPath&&request.response),'Legacy admission must finish');
   const admission=state.addressRequests.find(request=>request.path===legacyAddressPath);
   assert.deepEqual(admission.body.area,wholeArea);
   assert.equal(admission.body.limit,200);
   assert.deepEqual(admission.response.limit,{reason:'tiles',observed:300,allowed:16});
   assert.equal(admission.response.status,422);
   assert.equal(admission.response.code,'ADDRESS_SNAPSHOT_AREA_TOO_LARGE');
   assert.equal(state.addressRequests.filter(request=>request.path===addressScanPath).length,0,'Resources tab does not start background address scans');
   await addressTab(page).click();
   const panel=page.locator('#map-area-panel-addresses');
   let pending=await nextHeldAddress(state,addressScanPath);
   assert.equal(pending.entry.body.cursor,null);
   await panel.getByRole('status').getByText('Searching the whole area…').waitFor();
   await assertUnfinishedAddresses(page,panel);
   do{
    const prior=pending;
    state.releaseAddress(prior);
    pending=await nextHeldAddress(state,addressScanPath);
    await panel.getByRole('status').getByText(`${prior.entry.response.progress.tilesCompleted} of 300 sections checked`).waitFor();
    await assertUnfinishedAddresses(page,panel);
    if(prior.entry.response.rows===0)break;
   }while(pending.entry.body.cursor.tile<300);
   assert.ok(state.addressRequests.some(request=>request.response?.rows===0&&request.response.progress?.tilesCompleted>0),
    'A real empty intermediate batch must advance visible progress');
   state.holdAddressPaths.clear();
   state.releaseAddress(pending);
   const {oracle,snapshot}=state.addressProvider.versions[0];
   await expectAddressRows(panel,oracle.slice(0,200));
   assert.equal(await addressTab(page).innerText(),`Addresses / postal codes (${oracle.length})`);
   assert.match(await panel.locator('[data-address-snapshot-notice]').innerText(),/Singapore address snapshot .*Prepared 3 Nov 2026.*may omit newer or changed addresses/);
   const batchReads=state.addressRequests.filter(request=>request.path===addressScanPath);
   assert.ok(batchReads.every(request=>JSON.stringify(request.body.area)===JSON.stringify(admission.body.area)));
   assert.ok(batchReads.every(request=>request.body.snapshotSha256===snapshot.sha256));
   assert.equal(batchReads.at(-1).response.progress.tilesCompleted,300);
   assert.equal(state.addressRequests.filter(request=>request.path===addressMetadataPath).length,2,'One legacy and one scan metadata pin');
   const requests=state.addressRequests.length;
   const checks=addressChecks(panel);
   await checks.nth(0).check();await checks.nth(1).check();
   await panel.getByRole('button',{name:'Load more addresses',exact:true}).click();
   await expectAddressRows(panel,oracle.slice(0,400));
   assert.equal(await checks.nth(0).isChecked(),true);
   await checks.nth(200).check();
   const selected=[oracle[0],oracle[1],oracle[200]];
   await panel.getByRole('button',{name:'Copy selected postal codes',exact:true}).click();
   await panel.getByText('Postal codes copied.',{exact:true}).waitFor();
   assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),`012345\n${oracle[200].postalCode}`);
   const selectedCsv=await readAddressCsv(page,panel.getByRole('button',{name:'Download selected CSV',exact:true}),
    'whole-area-selected.csv',selected);
   const allCsv=await readAddressCsv(page,panel.getByRole('button',{name:'Download all CSV',exact:true}),'whole-area-all.csv',oracle);
   assert.equal(state.addressRequests.length,requests,'Local paging, Copy and CSV must use completed rows without extra requests');
   readOnlyAddressProof(state,before);
   return{candidateTiles:300,scanSteps:batchReads.length,emptySteps:batchReads.filter(r=>r.response.rows===0).length,selectedCsv,allCsv,zeroWrites:true};
  }finally{await finishPage(context,page,state);}
 });
 await check('whole-area fallback ignores arbitrary errors and rejects invalid admission diagnostics',async()=>{
  const failures=[
   {status:422,body:{error:'Unrelated 422.',code:'ADDRESS_SNAPSHOT_INVALID_QUERY'}},
   {status:422,body:{error:'Invalid limit.',code:'ADDRESS_SNAPSHOT_AREA_TOO_LARGE',addressLimit:{reason:'tiles',observed:15,allowed:16}}},
   {status:413,body:{error:'Payload too large.',code:'ADDRESS_SNAPSHOT_AREA_TOO_LARGE',addressLimit:{reason:'tiles',observed:300,allowed:16}}},
   {status:503,body:{error:'Unavailable.',code:'ADDRESS_SNAPSHOT_UNAVAILABLE'}},
  ];
  for(const addressFailure of failures){
   const{context,page,state}=await createPage({addressFailure});
   try{
    const before=savedDocuments(state);
    await openArea(page);await addressTab(page).click();
    await page.locator('#map-area-panel-addresses').getByRole('alert').waitFor();
    assert.equal(state.readQueries[0].body.limit,200);
    assert.equal(state.requests.filter(request=>request.path===addressScanPath).length,0);
    assert.equal(state.requests.filter(request=>request.path===addressMetadataPath).length,1);
    readOnlyAddressProof(state,before);
   }finally{await finishPage(context,page,state);}
  }
  return{statuses:failures.map(failure=>failure.status),legacyPageSize:200,scanRequests:0};
 });
 await check('whole-area Retry preserves the pinned cursor and snapshot change requires a fresh Restart',async()=>{
  const{context,page,state}=await createPage({wholeAddressFixture:true,holdAddressPaths:[addressScanPath]});
  try{
   const before=savedDocuments(state);
   const panel=await openWholeArea(page);
   state.releaseAddress(await nextHeldAddress(state,addressScanPath));
   const failed=await nextHeldAddress(state,addressScanPath);
   assert.ok(failed.entry.body.cursor.tile>0);
   state.failNextAddressPath=addressScanPath;
   state.releaseAddress(failed);
   await panel.getByRole('alert').getByText(/search could not finish/).waitFor();
   await assertUnfinishedAddresses(page,panel);
   const count=state.addressRequests.length;
   await panel.getByRole('button',{name:'Retry',exact:true}).click();
   const retried=await nextHeldAddress(state,addressScanPath);
   assert.deepEqual(retried.entry.body,failed.entry.body);
   assert.equal(state.addressRequests.length,count+1,'Retry makes one request from the accepted pin and cursor');
   state.releaseAddress(retried);
   const changed=await nextHeldAddress(state,addressScanPath);
   assert.ok(changed.entry.body.cursor.tile>retried.entry.body.cursor.tile);
   state.addressVersion=1;
   state.releaseAddress(changed);
   const restart=panel.getByRole('button',{name:'Restart search',exact:true});
   await restart.waitFor();
   assert.equal(changed.entry.response.status,409);
   assert.equal(changed.entry.response.code,'ADDRESS_SNAPSHOT_CHANGED');
   await assertUnfinishedAddresses(page,panel);
   assert.equal(await panel.getByRole('button',{name:'Retry',exact:true}).count(),0);
   assert.equal(state.addressRequests.filter(request=>request.path===addressMetadataPath).length,2);
   await restart.click();
   const restarted=await nextHeldAddress(state,addressScanPath);
   assert.equal(restarted.entry.body.cursor,null);
   assert.equal(restarted.entry.body.snapshotSha256,state.addressProvider.versions[1].snapshot.sha256);
   assert.deepEqual(restarted.entry.body.area,wholeArea);
   state.holdAddressPaths.clear();
   state.releaseAddress(restarted);
   await expectAddressRows(panel,state.addressProvider.versions[1].oracle.slice(0,200));
   assert.equal(state.addressRequests.filter(request=>request.path===addressMetadataPath).length,3);
   readOnlyAddressProof(state,before);
   return{retryFromTile:retried.entry.body.cursor.tile,changedStatus:409,explicitFreshPin:true,zeroWrites:true};
  }finally{await finishPage(context,page,state);}
 });
 for(const lifecycle of ['close','area','user','tab'])await check(`whole-area ${lifecycle} cancels a pending step and ignores late delivery`,async()=>{
  const{context,page,state}=await createPage({wholeAddressFixture:true,holdAddressPaths:[addressScanPath],ignoreAddressAbort:true});
  try{
   const before=savedDocuments(state);
   const panel=await openWholeArea(page);
   state.releaseAddress(await nextHeldAddress(state,addressScanPath));
   const pending=await nextHeldAddress(state,addressScanPath);
   const sessionReads=state.sessionReads;
   if(lifecycle==='close'){
    await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
    await panel.waitFor({state:'detached'});
   }else if(lifecycle==='area'){
    await page.locator('[data-map-area-choice]').selectOption('preview-circle');
    await page.locator('[data-map-area-resource="soft-82201"]').waitFor();
   }else if(lifecycle==='user'){
    state.sessionUser={...state.sessionUser,id:state.sessionUser.id+1,name:'Second fictional owner'};
    await page.waitForTimeout(800); // existing AuthProvider session-check cooldown
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await until(()=>state.sessionReads>sessionReads,'Expected the real App to recheck session identity');
    await panel.waitFor({state:'detached'});
   }else{
    await page.getByRole('tab',{name:/CareAround resources/}).click();
    await panel.waitFor({state:'detached'});
   }
   const late=flags=>page.evaluate(({path,flags})=>window.__qaAddressTransport.filter(item=>item.path===path)
    .some(item=>item.aborted&&item.delivered===flags),{path:addressScanPath,flags});
   await until(()=>late(false),'Expected the panel to abort the held scan signal');
   const steps=state.addressRequests.filter(request=>request.path===addressScanPath).length;
   state.releaseAddress(pending);
   await until(()=>late(true),'Fixture must deliver the retired step even after abort');
   await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,0)));
   assert.equal(state.addressRequests.filter(request=>request.path===addressScanPath).length,steps);
   assert.equal(await panel.count(),0,'Retired addresses must remain hidden');
   if(lifecycle==='tab'){
    await addressTab(page).click();
    const fresh=await nextHeldAddress(state,addressScanPath);
    assert.equal(fresh.entry.body.cursor,null);
    state.holdAddressPaths.clear();state.releaseAddress(fresh);
    await expectAddressRows(panel,state.addressProvider.versions[0].oracle.slice(0,200));
   }
   readOnlyAddressProof(state,before);
   return{lifecycle,aborted:true,lateDeliveryIgnored:true,zeroWrites:true};
  }finally{await finishPage(context,page,state);}
 });
 await check('whole-area does not start after a late legacy workload failure from a closed panel',async()=>{
  const{context,page,state}=await createPage({wholeAddressFixture:true,holdAddressPaths:[legacyAddressPath],ignoreAddressAbort:true});
  try{
   const before=savedDocuments(state);
   const panel=await openWholeArea(page);
   const pending=await nextHeldAddress(state,legacyAddressPath);
   await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
   await panel.waitFor({state:'detached'});
   state.releaseAddress(pending);
   await until(()=>page.evaluate(path=>window.__qaAddressTransport.some(item=>item.path===path&&item.aborted&&item.delivered),legacyAddressPath),
    'Fixture must deliver the actual 422 after the panel has retired its legacy request');
   assert.equal(pending.entry.response.status,422);
   await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,0)));
   assert.equal(state.addressRequests.filter(request=>request.path===addressScanPath).length,0);
   assert.equal(state.addressRequests.filter(request=>request.path===addressMetadataPath).length,1);
   readOnlyAddressProof(state,before);
   return{lateTyped422:true,scanRequests:0,zeroWrites:true};
  }finally{await finishPage(context,page,state);}
 });
 await check('desktop1470x801 native pointer reaches resource rows and actions without scrolling away the modal header',async()=>{
  const{context,page,state}=await createPage();try{
   await openArea(page);const control=page.locator('[data-map-area-resource-select="soft-82201"]');report.desktopLayoutBefore=await control.evaluate(node=>{const w=node.closest('[data-map-area-workspace]'),l=w.querySelector('[data-map-area-resource-chooser]>ul'),m=w.closest('[role="dialog"]'),r=node.getBoundingClientRect(),b=l.getBoundingClientRect();return{row:{top:r.top,bottom:r.bottom},list:{top:b.top,bottom:b.bottom,height:b.height},workspaceHeight:w.clientHeight,workspaceScrollHeight:w.scrollHeight,modalHeight:m.clientHeight,modalScrollHeight:m.scrollHeight,modalScrollTop:m.scrollTop};});const pointer=await exposeAreaControl(page,control);await page.mouse.click(pointer.x,pointer.y);await until(()=>control.isChecked(),'native desktop resource selection missing');const button=await page.locator('[data-map-area-save-add]').evaluate(node=>{const b=node.getBoundingClientRect(),m=node.closest('[role="dialog"]');return{top:b.top,bottom:b.bottom,exposed:node.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)),modalScrollTop:m.scrollTop};});assert.ok(button.top>=0&&button.bottom<=801&&button.exposed,'desktop Save&add must be reachable without a hidden-modal focus scroll');assert.equal(button.modalScrollTop,0);assert.equal(state.writes.length,0);assertCleanBoundary(state);return{nativePointer:pointer,button,zeroWrites:true};
  }finally{await finishPage(context,page,state);}
 });
 await check('Draw area chooser reports initial map refresh failure instead of silently disabling every action',async()=>{
  const{context,page,state}=await createPage();try{
   await page.locator('[data-owner-canvas-enter]').click();await page.locator('[data-owner-canvas-tool="draw"]').click();await until(()=>page.evaluate(()=>window.__qaEditorState?.enabled),'Draw not ready');const point=await page.evaluate(()=>{const m=[...window.__qaMaps].find(m=>m.getContainer().isConnected&&m.getContainer().getBoundingClientRect().width>0),p=m.latLngToContainerPoint([1.3844966,103.75]),b=m.getContainer().getBoundingClientRect();return{x:b.x+p.x,y:b.y+p.y};});await page.mouse.click(point.x,point.y);await until(()=>page.evaluate(()=>window.__qaEditorState.selectedId==='preview-circle'),'circle not selected');state.failMapReads=10;await page.getByRole('button',{name:'Find within area',exact:true}).click();await until(()=>state.mapReadFailures>0,'refresh failure was not delivered');await page.locator('[data-map-area-resource="soft-82201"]').waitFor();const dialog=page.getByRole('dialog');await until(()=>dialog.getByRole('button',{name:'Close',exact:true}).isEnabled(),'map refresh resilience did not settle');const alerts=await dialog.getByRole('alert').allTextContents();report.refreshFailureObservation={mapReadFailures:state.mapReadFailures,alerts,settledCloseEnabled:true};assert.ok(alerts.some(text=>/(failed|could|unable).*(load|refresh|map)|retry/i.test(text)),'initial Within-area map failure must be visible');assert.equal(await page.locator('[data-map-area-choice]').isDisabled(),true);assert.equal(state.writes.length,0);assertCleanBoundary(state);return{mapReadFailures:state.mapReadFailures,visibleAlerts:alerts,recoveryGuidance:alerts.some(text=>/retry|reopen|close/i.test(text)),actionsDisabled:true,zeroWrites:true};
  }finally{await finishPage(context,page,state);}
 });
 await check('narrow Addresses CSV actions stay reachable before the end of200 address rows',async()=>{
  const{context,page,state}=await createPage({viewport:{width:390,height:500},addressRowCount:225});try{
   await openArea(page,{narrow:true});await page.getByRole('tab',{name:/addresses.*postal/i}).click();const addressPanel=page.locator('#map-area-panel-addresses');await addressPanel.locator('li input[type="checkbox"]').nth(199).waitFor({state:'attached'});const first=addressPanel.locator('li input[type="checkbox"]').first(),point=await exposeAreaControl(page,first);await page.mouse.click(point.x,point.y);const download=page.getByRole('button',{name:'Download selected CSV',exact:true});
   const readGeometry=()=>download.evaluate(node=>{const b=node.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2),w=node.closest('[data-map-area-workspace]'),close=w.closest('[role="dialog"]').querySelector('button[aria-label="Close"]'),c=close.getBoundingClientRect();return{top:b.top,bottom:b.bottom,exposed:node.contains(hit),workspaceScrollTop:w.scrollTop,workspaceScrollHeight:w.scrollHeight,workspaceHeight:w.clientHeight,modalScrollTop:w.closest('[role="dialog"]').scrollTop,headerClose:{top:c.top,bottom:c.bottom,exposed:close.contains(document.elementFromPoint(c.x+c.width/2,c.y+c.height/2))},activeScrollers:[w,...w.querySelectorAll('*')].filter(element=>['auto','scroll'].includes(getComputedStyle(element).overflowY)&&element.scrollHeight>element.clientHeight+1).length};});
   report.mobileAddressBefore=await readGeometry();
   if(probeAddressFooter){report.counterfactualOnly=true;await page.addStyleTag({content:'[data-map-area-workspace] #map-area-panel-addresses>footer{position:sticky!important;bottom:0!important;z-index:2!important;background:white!important}'});}
   const geometry=await readGeometry();assert.ok(geometry.top>=0&&geometry.bottom<=500&&geometry.exposed,'CSV action must remain visible without scrolling through200 rows: '+JSON.stringify(geometry));assert.equal(geometry.modalScrollTop,0);assert.equal(geometry.headerClose.exposed,true);assert.equal(geometry.activeScrollers,1);const pending=page.waitForEvent('download');await download.click();const file=path.join(out,'narrow-selected-addresses.csv');await(await pending).saveAs(file);const csv=await fs.readFile(file,'utf8');assert.match(csv,/012345/);assert.equal(csv.trim().split(/\r?\n/).length,2);assert.equal(state.writes.length,0);assertCleanBoundary(state);return{loadedAddressRows:200,selectedRows:1,csvRows:1,file,geometry,nativeWheels:point.nativeWheels,zeroSavedWrites:true};
  }finally{await finishPage(context,page,state);}
 });
 for(const height of [844,500])await check(`narrow390x${height} chooser exposes selection and Save & add within its existing scroll container`,async()=>{
  const{context,page,state}=await createPage({viewport:{width:390,height}});try{
   await openArea(page,{narrow:true});const resourceCheckbox=page.locator('[data-map-area-resource-select="soft-82201"]'),rowGeometry=await exposeAreaControl(page,resourceCheckbox);await page.mouse.click(rowGeometry.x,rowGeometry.y);await until(()=>resourceCheckbox.isChecked(),'native resource checkbox did not select');
   const list=page.locator('[data-map-area-resource-chooser]>ul'),venue=page.locator('[data-map-area-venue="soft-82201:82102"]');
   const initialList=await list.evaluate(node=>{const b=node.getBoundingClientRect(),owners=[];for(let parent=node;parent;parent=parent.parentElement){const style=getComputedStyle(parent);if(parent.scrollHeight>parent.clientHeight+1)owners.push({tag:parent.tagName,className:parent.className,overflowY:style.overflowY,clientHeight:parent.clientHeight,scrollHeight:parent.scrollHeight,scrollTop:parent.scrollTop});}return{top:b.top,bottom:b.bottom,height:b.height,clientHeight:node.clientHeight,scrollHeight:node.scrollHeight,scrollTop:node.scrollTop,owners};});
   const venueGeometry=await exposeAreaControl(page,venue);await venue.uncheck();await venue.check();const button=page.locator('[data-map-area-save-add]');
   const geometry=await button.evaluate(node=>{const b=node.getBoundingClientRect(),x=b.x+b.width/2,y=b.y+b.height/2;return{left:b.left,right:b.right,top:b.top,bottom:b.bottom,exposed:node.contains(document.elementFromPoint(x,y))||document.elementFromPoint(x,y)===node,viewport:[innerWidth,innerHeight],documentWidth:document.documentElement.scrollWidth};});
   const modal=await page.getByRole('dialog').evaluate(node=>({scrollTop:node.scrollTop,clientHeight:node.clientHeight,scrollHeight:node.scrollHeight}));assert.equal(modal.scrollTop,0,'header must never be auto-scrolled away');assert.equal(modal.clientHeight,modal.scrollHeight,'modal shell must not hide overflowing controls');assert.ok(geometry.left>=0&&geometry.right<=390&&geometry.top>=0&&geometry.bottom<=height);assert.equal(geometry.exposed,true);assert.ok(geometry.documentWidth<=390);assert.equal(state.writes.length,0);assertCleanBoundary(state);await page.screenshot({path:path.join(out,`area-selected-mobile-${height}.png`)});return{...geometry,modal,initialList,rowGeometry,venueGeometry,venueToggleWithoutWrites:true,footerReachableWithoutListEnd:true};
  }finally{await finishPage(context,page,state);}
 });
}catch(error){report.failure=error.stack;process.exitCode=1;}
finally{report.sourceAfter=await runtimeFingerprint();report.harnessAfter=await harnessFingerprint();report.sourceUnchanged=JSON.stringify(report.sourceBefore)===JSON.stringify(report.sourceAfter)&&JSON.stringify(report.harnessBefore)===JSON.stringify(report.harnessAfter);report.summary={passed:report.cases.filter(c=>c.passed).length,failed:report.cases.filter(c=>!c.passed).length};if(report.summary.failed||report.failure||!report.sourceUnchanged)process.exitCode=1;await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser?.close();await fixture?.server.close();console.log(JSON.stringify({out,summary:report.summary,failure:report.failure,sourceUnchanged:report.sourceUnchanged}));}
