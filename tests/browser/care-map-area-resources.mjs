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
async function createPage(options={}){const context=await browser.newContext({viewport:options.viewport||{width:1470,height:801}}),page=await context.newPage();page.setDefaultTimeout(12000);const state=await fixture.install(page,options);options.configureState?.(state);if(options.startFromDirectory){await page.goto(new URL('/my-directory?section=my-maps',fixture.base).href);await page.locator(`a[href="/my-directory/maps/${fixture.mapId}"]`).first().click();}else await page.goto(new URL('/my-directory/maps/'+fixture.mapId+(options.uiMode==='stable'?'?ui=stable':''),fixture.base).href);await page.locator('[data-owner-canvas-enter]').waitFor();return{context,page,state};}
async function exposeAreaControl(page,control,{centerOnly=false}={}){let value,nativeWheels=0;for(let attempt=0;attempt<15;attempt++){
 value=await control.evaluate((node,centerOnly)=>{
  const dialog=node.closest('[role="dialog"]'),workspace=dialog.querySelector('[data-map-area-workspace]');
  const resourceList=workspace.querySelector('[data-map-area-resource-chooser]>ul');
  const owner=getComputedStyle(dialog).overflowY==='auto'?dialog:getComputedStyle(workspace).overflowY==='auto'?workspace:resourceList||workspace;
  const footer=workspace.querySelector('[data-map-area-resource-chooser]>footer,#map-area-panel-addresses>footer');
  const f=footer?.getBoundingClientRect(),l=owner.getBoundingClientRect(),b=node.getBoundingClientRect();
  const viewBottom=f&&!footer.contains(node)&&getComputedStyle(footer).position==='sticky'&&f.top>l.top&&f.top<l.bottom?f.top:l.bottom;
  const x=b.x+b.width/2,y=b.y+b.height/2,hit=document.elementFromPoint(x,y);
  return {top:b.top,bottom:b.bottom,x,y,owner:{x:l.x+l.width/2,y:l.top+(viewBottom-l.top)/2,top:l.top,bottom:l.bottom,
   visibleBottom:viewBottom,height:l.height,scrollTop:owner.scrollTop,scrollHeight:owner.scrollHeight},
   exposed:node.contains(hit)&&(centerOnly||(b.top>=l.top&&b.bottom<=viewBottom))};
 },centerOnly);
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
function ordinaryOracle(total){
  return Array.from({length:total},(_,i)=>({postalCode:i<2?'012345':String(100000+i),block:String(i+1),
   roadName:'Fictional Preview Road',building:'Fictional building '+(i+1),address:(i+1)+' Fictional Preview Road',lat:1.38,lng:103.75}));
 }
function expectedAddressCsv(rows){
 const quote=value=>'"'+String(value).replaceAll('"','""')+'"';
 const header='"postalCode","block","roadName","building","address","lat","lng"';
 return Buffer.from('\ufeff'+[header,...rows.map(row=>[
  "'"+row.postalCode,row.block,row.roadName,row.building,row.address,row.lat,row.lng,
 ].map(quote).join(','))].join('\r\n')+'\r\n');
}
async function readAddressCsv(page,button,filename,expected,suggested='carearound-area-addresses.csv',activate=()=>button.click()){
 const pending=page.waitForEvent('download');
 await activate();
 const download=await pending;
 assert.equal(download.suggestedFilename(),suggested);
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
 for(const failFirst of [false,true]){
  await check('final interaction explicit row edit wins during '+(failFirst?'retried':'initial')+' blank Select all',async()=>{
   const {context,page,state}=await createPage({addressRowCount:425});
   let release;
   const gate=new Promise(resolve=>{release=resolve;});
   try{
    const reads=[],oracle=ordinaryOracle(425);
    await context.grantPermissions(['clipboard-read','clipboard-write']);
    await page.route('**/api/address-snapshot/area',async route=>{
     const body=route.request().postDataJSON();reads.push(body);
     if(body.limit===1000){
      if(failFirst&&reads.length===2)return route.fulfill({status:503,json:{code:'ADDRESS_SNAPSHOT_UNAVAILABLE',error:'Fictional continuation unavailable'}});
      await gate;
     }
     return route.fallback();
    });
    await openArea(page);await addressTab(page).click();
    const panel=page.locator('#map-area-panel-addresses'),checks=addressChecks(panel);
    await checks.nth(199).waitFor({state:'attached'});
    await checks.nth(0).check();await checks.nth(1).check();await checks.nth(2).check();
    const master=panel.getByRole('checkbox',{name:'Select all',exact:true});
    await master.click();
    if(failFirst)await panel.getByRole('alert').getByRole('button',{name:'Retry'}).click();
    await until(()=>reads.length===(failFirst?3:2),'blank master continuation held');
    await checks.nth(0).uncheck();assert.equal(await checks.nth(0).isChecked(),false);
    release();await panel.getByText('Preparing all addresses for search…',{exact:true}).waitFor({state:'hidden'});
    assert.equal(await checks.nth(0).isChecked(),false,'later explicit edit must survive the deferred master');
    assert.equal(await checks.count(),200);assert.equal(await master.evaluate(node=>node.indeterminate),true);
    await panel.getByRole('button',{name:'Copy selected postal codes'}).click();
    await panel.getByText('Postal codes copied.',{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'012345\n100002');
    const selectedCsv=await readAddressCsv(page,panel.getByRole('button',{name:'Download selected CSV'}),'explicit-after-'+(failFirst?'retry':'hold')+'.csv',oracle.slice(1,3));
    assert.deepEqual(reads.map(({offset,limit})=>[offset,limit]),failFirst?[[0,200],[200,1000],[200,1000]]:[[0,200],[200,1000]]);
    assert.ok(reads.every(body=>body.snapshotSha256===reads[0].snapshotSha256));assert.equal(state.writes.length,0);assertCleanBoundary(state);
    return {selectedCsv,reads:reads.length,renderedRows:200,zeroWrites:true};
   }finally{release();await finishPage(context,page,state);}
  });
 }
 await check('final interaction verified completion retires a failed manual page action',async()=>{
  const {context,page,state}=await createPage({addressRowCount:425});
  try{
   const reads=[],oracle=ordinaryOracle(425);
   await page.route('**/api/address-snapshot/area',async route=>{
    const body=route.request().postDataJSON();reads.push(body);
    if(body.offset===200&&body.limit===200)return route.fulfill({status:503,json:{code:'ADDRESS_SNAPSHOT_UNAVAILABLE',error:'Fictional visible page unavailable'}});
    return route.fallback();
   });
   await openArea(page);await addressTab(page).click();
   const panel=page.locator('#map-area-panel-addresses'),checks=addressChecks(panel);
   await checks.nth(199).waitFor({state:'attached'});await checks.nth(1).check();
   await panel.getByRole('button',{name:'Load more addresses'}).click();
   await panel.getByRole('alert').getByRole('button',{name:'Retry'}).waitFor();
   await panel.getByRole('searchbox',{name:'Search addresses or postal codes'}).fill('100424');
   await panel.getByText('Showing 1 of 1 matches').waitFor();
   assert.equal(await panel.getByRole('alert').count(),0,'the verified full source supersedes its manual-page alert');
   assert.equal(await panel.getByRole('button',{name:'Retry'}).count(),0);
   await panel.getByText('1 selected outside the filter').waitFor();
   const selectedCsv=await readAddressCsv(page,panel.getByRole('button',{name:'Download selected CSV'}),'selected-after-page-recovery.csv',oracle.slice(1,2));
   await panel.getByRole('button',{name:'Clear search'}).click();assert.equal(await checks.nth(1).isChecked(),true);
   const fullCsv=await readAddressCsv(page,panel.getByRole('button',{name:'Download all CSV'}),'full-after-page-recovery.csv',oracle);
   assert.deepEqual(reads.map(({offset,limit})=>[offset,limit]),[[0,200],[200,200],[200,1000]]);
   assert.ok(reads.every(body=>body.snapshotSha256===reads[0].snapshotSha256));assert.equal(state.writes.length,0);assertCleanBoundary(state);
   return {selectedCsv,fullCsv,reads:reads.length,zeroWrites:true};
  }finally{await finishPage(context,page,state);}
 });
 await check('final interface actual Chinese locale reaches the area selector and guidance',async()=>{
  const {context,page,state}=await createPage();
  try{
   await page.locator('#locale-select').selectOption('zh-CN');
   await page.getByRole('button',{name:'管理资源',exact:true}).click();
   await page.getByRole('tab',{name:'区域内',exact:true}).click();
   const workspace=page.locator('[data-map-area-workspace]');
   await workspace.getByRole('combobox',{name:'选择已绘制的区域'}).selectOption('preview-circle');
   await workspace.getByRole('button',{name:'绘制区域',exact:true}).waitFor();
   await workspace.getByText('使用已保存的圆形、矩形或边界查找资源；不会更改图形。',{exact:true}).waitFor();
   assert.equal(await page.locator('html').getAttribute('lang'),'zh-CN');
   assert.equal(state.writes.length,0);assertCleanBoundary(state);
   return {actualLocale:'zh-CN',zeroWrites:true};
  }finally{await finishPage(context,page,state);}
 });
 for(const clearWhilePending of [false,true]){
  await check('ordinary pager recovery after Clear '+(clearWhilePending?'before':'after')+' transient failure',async()=>{
   const {context,page,state}=await createPage({addressRowCount:425});
   let release;
   const gate=new Promise(resolve=>{release=resolve;});
   try{
    const reads=[];
    await page.route('**/api/address-snapshot/area',async route=>{
     const body=route.request().postDataJSON();reads.push(body);
     if(body.offset===200&&body.limit===1000){
      await gate;
      return route.fulfill({status:503,json:{error:'Fictional continuation unavailable',code:'ADDRESS_SNAPSHOT_UNAVAILABLE'}});
     }
     return route.fallback();
    });
    await openArea(page);await addressTab(page).click();
    const panel=page.locator('#map-area-panel-addresses'),checks=addressChecks(panel);
    const search=panel.getByRole('searchbox',{name:'Search addresses or postal codes'});
    const pager=panel.getByRole('button',{name:'Load more addresses'});
    await checks.nth(199).waitFor({state:'attached'});await checks.first().check();
    await search.fill('100424');await until(()=>reads.length===2,'completion held');
    if(clearWhilePending){
     await panel.getByRole('button',{name:'Clear search'}).click();
     assert.equal(await pager.isDisabled(),true,'pending preparation still owns the source');
     release();
    }else{
     release();await panel.getByRole('alert').getByRole('button',{name:'Retry'}).waitFor();
     await panel.getByRole('button',{name:'Clear search'}).click();
    }
    await until(()=>pager.isEnabled(),'settled transient search failure must permit manual paging',3000);
    assert.equal(await checks.count(),200);assert.equal(await checks.first().isChecked(),true);
    await pager.click();await checks.nth(399).waitFor({state:'attached'});
    await search.fill('100424');await panel.getByText('Showing 1 of 1 matches').waitFor();
    assert.match(await checks.first().getAttribute('aria-label'),/^100424 /);
    const paging=reads.map(({offset,limit})=>[offset,limit]);
    assert.deepEqual(paging,[[0,200],[200,1000],[200,200],[400,1000]]);
    assert.ok(reads.every(read=>read.snapshotSha256===reads[0].snapshotSha256));
    assert.equal(state.writes.length,0);assertCleanBoundary(state);
    return {paging,clearWhilePending,originalSelectionPreserved:true,zeroWrites:true};
   }finally{release();await finishPage(context,page,state);}
  });
 }
 await check('Saved type selector fits beside search at desktop, breakpoint and phone scales',async()=>{
  const {context,page,state}=await createPage();
  try{
   await page.getByRole('button',{name:'Manage resources',exact:true}).click();
   const dialog=page.getByRole('dialog'),search=dialog.locator('#create-map-search');
   const offering=dialog.getByRole('button',{name:'Programme/service',exact:true});
   const geometry=[];
   for(const width of [1470,640,320]){
    await page.setViewportSize({width,height:801});
    for(const scale of [0.6,1,1.1]){
     await page.evaluate(value=>document.documentElement.style.setProperty('--font-scale',value),scale);
     const measured=await offering.evaluate(node=>{
      const range=document.createRange();range.selectNodeContents(node);
      const lines=[...range.getClientRects()].filter(r=>r.width>0);
      const search=document.querySelector('#create-map-search').getBoundingClientRect();
      const button=node.getBoundingClientRect(),group=node.parentElement.getBoundingClientRect();
      return {lines:lines.length,searchWidth:search.width,left:search.x,right:group.right,
       searchBottom:search.bottom,buttonTop:button.top,buttonHeight:button.height,
       root:Number.parseFloat(getComputedStyle(document.documentElement).fontSize)};
     });
     assert.ok(Math.abs(measured.root-16*scale)<0.02,'actual requested root scale');
     assert.ok(measured.left>=0&&measured.right<=width&&measured.searchWidth>=100,'usable on-screen search and type group');
     if(width>=640)assert.equal(measured.lines,1,'desktop Programme/service type must occupy one line');
     else assert.ok(measured.searchBottom<=measured.buttonTop+1,'phone keeps its stacked selector');
     await search.fill('Fictional');await offering.click();
     await dialog.getByRole('button',{name:'All',exact:true}).click();
     geometry.push({width,scale,...measured});
    }
   }
   await page.setViewportSize({width:1470,height:801});
   await page.evaluate(()=>document.documentElement.style.setProperty('--font-scale','1'));
   await page.screenshot({path:path.join(out,'desktop-saved-filter-master.png'),animations:'disabled'});
   assert.equal(state.writes.length,0);assertCleanBoundary(state);
   return {geometry,zeroWrites:true};
  }finally{await finishPage(context,page,state);}
 });
 for (const scenario of ['visible pager','retry','changed','cancel intent','leave and reopen','close and reopen','small source']) {
  await check('ordinary prepared search '+scenario,async()=>{
   const total=scenario==='visible pager'?425:scenario==='small source'?12:225;
   const {context,page,state}=await createPage({addressRowCount:total});
   let release;
   const gate=new Promise(resolve=>{release=resolve;});
   const reads=[];
   try{
    let fail=true,blocked=true;
    await page.route('**/api/address-snapshot/area',async route=>{
     const body=route.request().postDataJSON();reads.push(body);
     if(scenario==='visible pager'&&body.offset===200&&body.limit===200)await gate;
     if(body.limit===1000&&fail&&['retry','changed'].includes(scenario)){
      fail=false;
      if(scenario==='changed')state.ordinarySnapshot={...state.ordinarySnapshot,sha256:'b'.repeat(64)};
      return route.fulfill({status:scenario==='changed'?409:503,json:{error:'Fictional address request interrupted',code:scenario==='changed'?'ADDRESS_SNAPSHOT_CHANGED':'ADDRESS_SNAPSHOT_UNAVAILABLE'}});
     }
     if(body.limit===1000&&blocked&&['cancel intent','leave and reopen','close and reopen'].includes(scenario)){blocked=false;await gate;}
     return route.fallback();
    });
    await openArea(page);await addressTab(page).click();
    const panel=page.locator('#map-area-panel-addresses'),search=panel.getByRole('searchbox',{name:'Search addresses or postal codes'});
    const checks=addressChecks(panel),master=panel.getByRole('checkbox',{name:'Select all',exact:true});
    await checks.nth(Math.min(200,total)-1).waitFor({state:'attached'});
    if(scenario==='visible pager'){
     await panel.getByRole('button',{name:'Load more addresses'}).click();
     await until(()=>reads.length===2,'visible page in flight');
    }
    if(scenario==='cancel intent')await master.click();
    await search.fill(String(100000+total-1));
    if(scenario==='visible pager'){
     await panel.getByText('Preparing all addresses for search…').waitFor();
     assert.equal(reads.length,2);release();
    }
    if(scenario==='retry'||scenario==='changed'){
     if(scenario==='changed'){
      await panel.getByRole('alert').getByRole('button',{name:'Restart search'}).waitFor();
      await panel.getByRole('button',{name:'Clear search'}).click();
      assert.equal(await panel.getByRole('button',{name:'Load more addresses'}).isDisabled(),true);
      await search.fill(String(100000+total-1));
     }
     const action=scenario==='retry'?'Retry':'Restart search';
     await panel.getByRole('alert').getByRole('button',{name:action}).click();
    }
    if(['cancel intent','leave and reopen','close and reopen'].includes(scenario)){
     await until(()=>reads.length===2,'first preparation held');
     if(scenario==='cancel intent'){
      await panel.getByRole('button',{name:'Clear search'}).click();await search.fill('012345');
      release();await panel.getByText('Showing 2 of 2 matches').waitFor();
      assert.equal(await panel.getByRole('button',{name:'Download selected CSV'}).isDisabled(),true);
     }else if(scenario==='close and reopen'){
      await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();release();
      await openArea(page);await addressTab(page).click();
      await checks.nth(199).waitFor({state:'attached'});
      assert.equal(await search.inputValue(),'');assert.equal(await master.isChecked(),false);
      await search.fill(String(100000+total-1));
     }else{
      await page.getByRole('tab',{name:/CareAround resources/}).click();release();
      await addressTab(page).click();
     }
    }
    if(scenario!=='cancel intent')await panel.getByText('Showing 1 of 1 matches').waitFor();
    const expected=scenario==='small source'?[]:scenario==='visible pager'?[400]:['leave and reopen','close and reopen','retry','changed'].includes(scenario)?[200,200]:[200];
    assert.deepEqual(reads.filter(body=>body.limit===1000).map(body=>body.offset),expected);
    if(scenario==='visible pager'){
     await panel.getByRole('button',{name:'Clear search'}).click();assert.equal(await checks.count(),400);
    }
    if(scenario==='changed'){
     assert.deepEqual(reads.map(body=>body.offset),[0,200,0,200]);
     assert.deepEqual(reads.map(body=>body.snapshotSha256),['a','a','b','b'].map(char=>char.repeat(64)));
    }
    assert.equal(state.writes.length,0);assertCleanBoundary(state);
    return {reads:reads.map(({offset,limit})=>({offset,limit})),zeroWrites:true};
   }finally{release();await finishPage(context,page,state);}
  });
 }
 await check('large completed scan searches and selects 52911 addresses with bounded DOM',async()=>{
  const {context,page,state}=await createPage({wholeAddressFixture:'large'});
  try{
   const panel=await openWholeArea(page),checks=addressChecks(panel);
   await checks.nth(199).waitFor({state:'attached',timeout:120000});
   const reads=state.addressRequests.length,allRequests=state.requests.length;
   const search=panel.getByRole('searchbox',{name:'Search addresses or postal codes'});
   const timing={};
   for(const [label,query] of [['cold','whole'],['warm','area']]){
    const start=performance.now();
    await search.fill(query);
    await panel.getByText('Showing 200 of 52911 matches').waitFor();
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    timing[label]=Math.round(performance.now()-start);
    assert.equal(await checks.count(),200);
   }
   const start=performance.now();
   await panel.getByRole('checkbox',{name:'Select all',exact:true}).check();
   await panel.getByText(/52911 selected/).waitFor();
   timing.select=Math.round(performance.now()-start);
   assert.equal(await checks.count(),200);assert.equal(state.addressRequests.length,reads);assert.equal(state.requests.length,allRequests);
   assert.equal(state.writes.length,0);assertCleanBoundary(state);
   return {timingMs:timing,rowsMounted:200,matches:52911,scanReads:reads,zeroWrites:true};
  }finally{await finishPage(context,page,state);}
 });
 await check('Saved master filters matching keys and leaves catalogue and map-only members intact',async()=>{
  const {context,page,state}=await createPage({configureState(state){
   state.saved=state.saved.filter(asset=>keyFor(asset)!=='soft-82203');
   state.extraCatalogue=Array.from({length:43},(_,i)=>({...state.saved[0],id:96000+i,resourceId:96000+i,assetKey:'hard-'+(96000+i),name:'Catalogue-only synthetic '+i,lat:1.42,lng:103.82}));
   state.saved.push({...state.saved[0],id:82102,resourceId:82102,resourceType:'soft',assetKey:'soft-82102',name:'Matching offering',hostHardAssetIds:[82102]});
  }});
  try{
   await page.getByRole('button',{name:'Manage resources',exact:true}).click();
   const dialog=page.getByRole('dialog'),search=dialog.locator('#create-map-search');
   const master=dialog.getByRole('checkbox',{name:'Select all matching Saved resources'});
   await until(()=>master.evaluate(node=>node.indeterminate),'mixed seeded Saved selection');
   await search.fill('Catalogue-only synthetic');
   await dialog.locator('[data-testid^="manage-map-catalog-row-"]').nth(39).waitFor({state:'attached'});
   assert.equal(await dialog.locator('[data-testid^="manage-map-catalog-row-"]').count(),40);
   assert.equal(await master.isDisabled(),true);
   await search.fill('Matching offering');await master.check();
   await dialog.getByText('3 selected outside the filter').waitFor();
   await dialog.getByRole('button',{name:'Place',exact:true}).click();
   assert.equal(await master.isDisabled(),true);
   await dialog.getByRole('button',{name:'All',exact:true}).click();
   await search.fill('catalogue centre');assert.equal(await master.isChecked(),true);
   await master.click();assert.equal(await master.isChecked(),true);
   await dialog.getByText(/Keep .* selected while programmes/).waitFor();
   await search.fill('Matching offering');await master.uncheck();await search.fill('catalogue centre');await master.uncheck();
   await search.fill('Fictional');await page.screenshot({path:path.join(out,'desktop-saved-filter-master.png')});
   assert.equal(state.writes.length,0);
   await dialog.getByTestId('create-map-submit').click();await dialog.waitFor({state:'hidden'});
   assert.ok(state.assets.some(asset=>keyFor(asset)==='soft-82203'));assert.equal(state.writes.length,0);
   await openArea(page);
   const chooser=page.locator('[data-map-area-resource-chooser]');
   await chooser.getByRole('checkbox',{name:'Select available results'}).check();
   assert.equal(await chooser.locator('[data-map-area-resource-select^="hard-96"]').count(),0);
   assert.equal(state.saved.filter(asset=>asset.resourceId>=96000).length,0);
   assert.equal(state.writes.length,0);assertCleanBoundary(state);
   return {mapOnlyRetained:true,zeroWrites:true};
  }finally{await finishPage(context,page,state);}
 });
 await check('Create Saved master submits 501 explicit selections without truncation',async()=>{
  const {context,page,state}=await createPage({configureState(state){
   state.saved=Array.from({length:501},(_,i)=>({...state.saved[0],id:95000+i,resourceId:95000+i,assetKey:'hard-'+(95000+i),name:'Fictional create place '+i}));
  }});
  try{
   let submissions=0;
   await page.route('**/api/my-maps',async route=>{
    if(route.request().method()!=='POST')return route.fallback();
    const body=route.request().postDataJSON();
    assert.equal(body.assets.length,501);assert.equal(new Set(body.assets.map(keyFor)).size,501);
    assert.equal('retainedExistingKeys' in body,false);submissions++;
    return route.fulfill({status:400,json:{error:'Map details must contain at most 500 resources.'}});
   });
   await page.getByRole('link',{name:'Care Maps',exact:true}).click();
   await page.getByRole('button',{name:/^create.*map$/i}).click();
   const dialog=page.getByRole('dialog');await dialog.locator('input[type=text]').fill('Fictional large map');
   await dialog.getByRole('checkbox',{name:'Select all matching Saved resources'}).check();
   assert.equal(submissions,0);assert.equal(state.writes.length,0);
   await dialog.getByTestId('create-map-submit').click();
   await dialog.getByText('Map details must contain at most 500 resources.').waitFor();
   assert.equal(submissions,1);assert.equal(await dialog.getByTestId('create-map-asset-hard-95500').isChecked(),true);
   assert.equal(state.writes.length,0);assertCleanBoundary(state);
   return {explicitRefs:501,partialCreates:0};
  }finally{await finishPage(context,page,state);}
 });
 await check('ordinary full CSV already in flight serializes before filter preparation',async()=>{
  const {context,page,state}=await createPage({addressRowCount:225});
  let release;
  const gate=new Promise(resolve=>{release=resolve;});
  try{
   const requests=[];
   await page.route('**/api/address-snapshot/area',async route=>{
    const {offset,limit}=route.request().postDataJSON();
    requests.push([offset,limit]);
    if(requests.length===2)await gate;
    return route.fallback();
   });
   await openArea(page);await addressTab(page).click();
   const panel=page.locator('#map-area-panel-addresses');
   await addressChecks(panel).nth(199).waitFor({state:'attached'});
   const oracle=ordinaryOracle(225);
   const csv=readAddressCsv(page,panel.getByRole('button',{name:'Download all CSV'}),'legacy-export-while-searching.csv',oracle);
   await until(()=>requests.length===2,'unfiltered export in flight');
   await panel.getByRole('searchbox',{name:'Search addresses or postal codes'}).fill('100224');
   await panel.getByText('Preparing all addresses for search…').waitFor();
   assert.deepEqual(requests,[[0,200],[0,200]]);
   release();const exportEvidence=await csv;
   await panel.getByText('Showing 1 of 1 matches').waitFor();
   assert.deepEqual(requests,[[0,200],[0,200],[200,200],[200,1000]]);
   assert.equal(state.writes.length,0);assertCleanBoundary(state);
   return {requests,exportEvidence,zeroWrites:true};
  }finally{release();await finishPage(context,page,state);}
 });
 await check('Manage intersects disappeared map-only selection after same-scope area reconciliation',async()=>{
  const {context,page,state}=await createPage({configureState(state){
   state.saved=state.saved.filter(asset=>keyFor(asset)!=='soft-82203');
  }});
  try{
   await openArea(page);
   assert.equal(state.writes.length,0);
   // A second fictional editor removes the map-only resource before the real area flow refreshes the map.
   state.assets=state.assets.filter(asset=>keyFor(asset)!=='soft-82203');
   await page.locator('[data-map-area-resource-select="soft-82201"]').check();
   await page.locator('[data-map-area-save-add]').click();
   await until(async()=>state.assets.some(asset=>keyFor(asset)==='soft-82201')&&await page.locator('[data-map-area-stop]').count()===0,'area add reconciled');
   const writes=state.writes.length;assert.ok(writes>0);
   await page.locator('[data-map-resources-tab="saved"]').click();
   await page.getByTestId('create-map-submit').click();
   await page.getByRole('dialog').waitFor({state:'hidden'});
   assert.equal(state.writes.length,writes);assert.equal(state.assets.some(asset=>keyFor(asset)==='soft-82203'),false);assertCleanBoundary(state);
   return {disappearedKey:'soft-82203',writesOnUpdate:0};
  }finally{await finishPage(context,page,state);}
 });
 await check('roomier-dialog-geometry',async()=>{
  const evidence=[];
  for(const viewport of [{width:1440,height:900},{width:1920,height:1080}]){
   const {context,page,state}=await createPage({
    viewport,holdCataloguePages:['hard:1','soft:1'],
    configureState(state){
     state.saved.push(...Array.from({length:48},(_,i)=>({...state.saved[0],resourceId:91000+i,name:`Fictional saved resource ${i+1}`})));
    },
   });
   try{
    await openArea(page,{waitForResources:false});
    await until(()=>state.pendingCatalogue.length===2,'area results must still be loading');
    const dialog=page.getByRole('dialog');
    const readPanel=()=>dialog.evaluate(node=>{
     const {left,right,top,bottom,width,height}=node.getBoundingClientRect();
     return {left,right,top,bottom,width,height};
    });
    const loading=await readPanel();
    assert.equal(loading.width,1120,'the mounted Manage panel should use the desktop workspace width');
    state.holdCataloguePages.clear();
    state.releaseCatalogue();
    await page.locator('[data-map-area-resource="soft-82201"]').waitFor();
    const results=await readPanel();
    assert.equal(results.height,loading.height,'loading and populated area results share the same outer height');
    await page.locator('[data-map-resources-tab="saved"]').click();
    const lastRow=page.getByTestId(`create-map-row-${state.saved[0].resourceType}-91047`);
    await lastRow.waitFor({state:'attached'});
    const list=lastRow.locator('..');
    const submit=page.getByTestId('create-map-submit');
    for(const scale of [0.6,1,1.1]){
     await page.evaluate(value=>document.documentElement.style.setProperty('--font-scale',value),scale);
     const panel=await readPanel();
     assert.equal(panel.width,1120,`workspace width at app text scale ${scale}`);
     assert.equal(panel.height,loading.height);
     assert.ok(panel.left>=16&&panel.right<=viewport.width-16&&panel.top>=0&&panel.bottom<=viewport.height);
     const listBox=await list.evaluate(node=>({height:node.clientHeight,scrollHeight:node.scrollHeight}));
     assert.ok(listBox.height>360&&listBox.scrollHeight>listBox.height,'the large Saved list uses its available height and remains scrollable');
     await lastRow.scrollIntoViewIfNeeded();
     assert.ok(await list.evaluate(node=>node.scrollTop)>0,'the last saved row is reached by scrolling the list');
     await submit.click({trial:true});
     await dialog.getByRole('button',{name:'Close',exact:true}).click({trial:true});
     evidence.push({viewport,scale,loading,results,panel,listBox});
    }
    await page.locator('#create-map-search').press('Escape');
    await dialog.waitFor({state:'hidden'});
    assert.equal(state.writes.length,0);
    assertCleanBoundary(state);
   }finally{await finishPage(context,page,state);}
  }
  return evidence;
 });
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
   const master=page.getByRole('checkbox',{name:'Select available results'});
   await page.locator('[data-map-area-resource-select="hard-82102"]').check();
   assert.equal(await master.evaluate(el=>el.indeterminate),true);
   const areaSearch=page.locator('[data-map-area-resource-chooser] input[type=search]');
   await areaSearch.fill('multi-venue');await master.check();
   await page.getByText('1 selected outside these results').waitFor();await master.uncheck();
   await areaSearch.fill('');assert.equal(await page.locator('[data-map-area-resource-select="hard-82102"]').isChecked(),true);
   await page.locator('[data-map-area-resource-select="soft-82201"]').check();
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
   const search=panel.getByRole('searchbox',{name:'Search addresses or postal codes'});
   const master=panel.getByRole('checkbox',{name:'Select all',exact:true});
   const filtered=panel.getByRole('button',{name:'Download filtered CSV'});
   await search.fill(oracle[500].postalCode);await expectAddressRows(panel,[oracle[500]]);
   await master.check();await search.fill('012345');await expectAddressRows(panel,oracle.slice(0,2));
   const subsetCsv=await readAddressCsv(page,filtered,'filtered-shared-postal.csv',oracle.slice(0,2),'carearound-area-addresses-filtered.csv');
   await addressChecks(panel).first().check();assert.equal(await master.evaluate(el=>el.indeterminate),true);
   await panel.getByText('1 selected outside the filter').waitFor();await master.check();
   await panel.getByRole('button',{name:'Copy selected postal codes'}).click();
   assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'012345\n'+oracle[500].postalCode);
   await readAddressCsv(page,panel.getByRole('button',{name:'Download selected CSV'}),'selection-across-filters.csv',[...oracle.slice(0,2),oracle[500]]);
   await master.uncheck();await search.fill('whole area');await expectAddressRows(panel,oracle.slice(0,200));
   assert.equal(await master.evaluate(el=>el.indeterminate),true);
   await readAddressCsv(page,filtered,'filtered-entire-match-set.csv',oracle,'carearound-area-addresses-filtered.csv');
   await search.fill('nothing matches');await panel.getByText('No matching addresses').waitFor();
   assert.equal(await master.isDisabled(),true);assert.equal(await filtered.isDisabled(),true);
   await readAddressCsv(page,panel.getByRole('button',{name:'Download all CSV'}),'full-with-no-matches.csv',oracle);
   await panel.getByRole('button',{name:'Clear search'}).click();await master.check();
   assert.equal(await addressChecks(panel).count(),200);
   await readAddressCsv(page,panel.getByRole('button',{name:'Download selected CSV'}),'blank-select-all.csv',oracle);
   await master.uncheck();
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
   assert.notEqual(subsetCsv.sha256,allCsv.sha256,'two matching addresses differ from the full 696-row export');
   return{candidateTiles:300,subsetCsv,scanSteps:batchReads.length,emptySteps:batchReads.filter(r=>r.response.rows===0).length,selectedCsv,allCsv,zeroWrites:true};
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
 await check('short address workspace keeps search, result checkboxes, filtered CSV and Close reachable',async()=>{
  const evidence=[];
  for(const [width,height] of [[320,401],[320,340],[320,400],[320,450],[320,500],[320,560],[320,561],[390,500],[390,600]]){
   const {context,page,state}=await createPage({viewport:{width,height:844},addressRowCount:225});
   try{
    const before=savedDocuments(state);
    await openArea(page,{narrow:true});
    if(height===401){
     await page.evaluate(()=>document.documentElement.style.setProperty('--font-scale','1.1'));
     await page.setViewportSize({width,height});
     const resourceLayout=await page.locator('[data-map-area-workspace]').evaluate(workspace=>({
      workspace:getComputedStyle(workspace).overflowY,dialog:getComputedStyle(workspace.closest('[role="dialog"]')).overflowY,
      footer:getComputedStyle(workspace.querySelector('[data-map-area-resource-chooser]>footer')).position}));
     assert.deepEqual(resourceLayout,{workspace:'auto',dialog:'hidden',footer:'sticky'});
    }
    await addressTab(page).click();
    const dialog=page.getByRole('dialog'),panel=dialog.locator('#map-area-panel-addresses'),rows=addressChecks(panel);
    await rows.nth(199).waitFor({state:'attached'});
    await page.evaluate(()=>document.documentElement.style.setProperty('--font-scale','1.1'));
    await page.setViewportSize({width,height});
    const mapState=()=>page.evaluate(()=>{
     const maps=[...window.__qaMaps],map=maps.find(item=>item.getContainer().isConnected);
     return {mapIndex:maps.indexOf(map),zoom:map.getZoom(),center:map.getCenter(),pageScroll:scrollY,
      ownerMounts:window.__qaPageEvents.filter(event=>event.type==='mount').length};
    });
    const initialMap=await mapState(),interactions=[];
    const nativeClick=async(control)=>{
     const point=await exposeAreaControl(page,control,{centerOnly:true});
     interactions.push(point.nativeWheels);
     await page.mouse.click(point.x,point.y);
    };
    const search=panel.getByRole('searchbox',{name:'Search addresses or postal codes'});
    const master=panel.getByRole('checkbox',{name:'Select all',exact:true});
    await nativeClick(search);assert.ok(await search.evaluate(node=>node===document.activeElement));
    await page.keyboard.type('100224');await panel.getByText('Showing 1 of 1 matches').waitFor();
    await nativeClick(master);assert.ok(await master.isChecked());
    await nativeClick(panel.getByRole('button',{name:'Clear search'}));
    assert.ok(await search.evaluate(node=>node===document.activeElement));assert.equal(await search.inputValue(),'');
    await page.keyboard.type('012345');await panel.getByText('Showing 2 of 2 matches').waitFor();
    await nativeClick(rows.first());assert.ok(await master.evaluate(node=>node.indeterminate));
    await nativeClick(master);assert.ok(await rows.nth(1).isChecked());
    await nativeClick(master);assert.equal(await rows.first().isChecked(),false);
    await panel.getByText('1 selected outside the filter').waitFor();
    const filtered=panel.getByRole('button',{name:'Download filtered CSV'});
    const oracle=[1,2].map(n=>({postalCode:'012345',block:String(n),roadName:'Fictional Preview Road',
     building:'Fictional building '+n,address:n+' Fictional Preview Road',lat:1.38,lng:103.75}));
    const csv=await readAddressCsv(page,filtered,'keyboard-height-'+width+'.csv',oracle,
     'carearound-area-addresses-filtered.csv',()=>nativeClick(filtered));
    const geometry=await dialog.evaluate(node=>{
     const workspace=node.querySelector('[data-map-area-workspace]');
     const owners=[node,...node.querySelectorAll('*')].filter(el=>['auto','scroll'].includes(getComputedStyle(el).overflowY)&&el.scrollHeight>el.clientHeight+1);
     return {owners:owners.map(el=>el===workspace?'workspace':el===node?'dialog':el.tagName),modalScroll:node.scrollTop,
      sticky:getComputedStyle(node.querySelector('#map-area-panel-addresses>footer')).position,documentWidth:document.documentElement.scrollWidth};
    });
    assert.deepEqual(geometry.owners,[height<=560?'dialog':'workspace']);assert.equal(geometry.sticky,'sticky');
    assert.ok(geometry.documentWidth<=width);if(height>560)assert.equal(geometry.modalScroll,0);
    await nativeClick(dialog.getByRole('button',{name:'Close',exact:true}));await dialog.waitFor({state:'hidden'});
    assert.deepEqual(await mapState(),initialMap);readOnlyAddressProof(state,before);
    const reads=state.readQueries.map(({body})=>body);
    assert.deepEqual(reads.map(({offset,limit})=>[offset,limit]),[[0,200],[200,1000]]);
    assert.equal(reads[0].snapshotSha256,reads[1].snapshotSha256);
    evidence.push({width,height,geometry,csv,interactions,zeroWrites:true});
   }finally{await finishPage(context,page,state);}
  }
  return evidence;
 });
 await check('narrow Addresses CSV actions stay reachable before the end of200 address rows',async()=>{
  const{context,page,state}=await createPage({viewport:{width:390,height:600},addressRowCount:225});try{
   await openArea(page,{narrow:true});await page.getByRole('tab',{name:/addresses.*postal/i}).click();const addressPanel=page.locator('#map-area-panel-addresses');await addressPanel.locator('li input[type="checkbox"]').nth(199).waitFor({state:'attached'});const first=addressPanel.locator('li input[type="checkbox"]').first(),point=await exposeAreaControl(page,first);await page.mouse.click(point.x,point.y);const download=page.getByRole('button',{name:'Download selected CSV',exact:true});
   const readGeometry=()=>download.evaluate(node=>{const b=node.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2),w=node.closest('[data-map-area-workspace]'),close=w.closest('[role="dialog"]').querySelector('button[aria-label="Close"]'),c=close.getBoundingClientRect();return{top:b.top,bottom:b.bottom,exposed:node.contains(hit),workspaceScrollTop:w.scrollTop,workspaceScrollHeight:w.scrollHeight,workspaceHeight:w.clientHeight,modalScrollTop:w.closest('[role="dialog"]').scrollTop,headerClose:{top:c.top,bottom:c.bottom,exposed:close.contains(document.elementFromPoint(c.x+c.width/2,c.y+c.height/2))},activeScrollers:[w,...w.querySelectorAll('*')].filter(element=>['auto','scroll'].includes(getComputedStyle(element).overflowY)&&element.scrollHeight>element.clientHeight+1).length};});
   report.mobileAddressBefore=await readGeometry();
   if(probeAddressFooter){report.counterfactualOnly=true;await page.addStyleTag({content:'[data-map-area-workspace] #map-area-panel-addresses>footer{position:sticky!important;bottom:0!important;z-index:2!important;background:white!important}'});}
   const geometry=await readGeometry();assert.ok(geometry.top>=0&&geometry.bottom<=600&&geometry.exposed,'CSV action must remain visible without scrolling through200 rows: '+JSON.stringify(geometry));assert.equal(geometry.modalScrollTop,0);assert.equal(geometry.headerClose.exposed,true);assert.equal(geometry.activeScrollers,1);const pending=page.waitForEvent('download');await download.click();const file=path.join(out,'narrow-selected-addresses.csv');await(await pending).saveAs(file);const csv=await fs.readFile(file,'utf8');assert.match(csv,/012345/);assert.equal(csv.trim().split(/\r?\n/).length,2);assert.equal(state.writes.length,0);assertCleanBoundary(state);return{loadedAddressRows:200,selectedRows:1,csvRows:1,file,geometry,nativeWheels:point.nativeWheels,zeroSavedWrites:true};
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
