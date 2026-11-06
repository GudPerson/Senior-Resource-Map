// Actual App100 fictional annotations; run node tests/browser/care-map-annotation-visibility.mjs --out=PATH
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import os from 'node:os';
import path from 'node:path';
import {startFixture,fingerprint,pixel} from '../fixtures/care-map-floating-canvas/runtime.mjs';
import {owner} from '../fixtures/care-map-floating-canvas/data.mjs';
import {createPrintAnnotation,getAnnotationLocalDraftKey} from '../../client/src/lib/printAnnotations.js';
const out=process.argv.find(value=>value.startsWith('--out='))?.slice(6)||await fs.mkdtemp(path.join(os.tmpdir(),'care-map-annotation-visibility-'));
await fs.mkdir(out,{recursive:true});
const report={boundary:'Local actual App with100 fictional saved annotations including98 boundaries, circle and a resolved image. Intercepted APIs/synthetic pixels, one deliberate Studio global-hide save in memory, zero production access or successful annotation writes; synthetic503 annotation-PUT attempts are allowed in the final recovery case.',sourceBefore:await fingerprint(),cases:[],errors:[],unexpectedWrites:[]};
let fixture,browser,page,state;const studioWrites=[],observations={};
async function check(name,fn){try{report.cases.push({name,passed:true,evidence:await fn()});}catch(error){report.cases.push({name,passed:false,error:error.stack});}}
async function until(fn,message,timeout=10000){const start=Date.now();while(Date.now()-start<timeout){if(await fn())return;await new Promise(r=>setTimeout(r,40));}throw Error(message);}
async function read(ids){return page.evaluate(ids=>{
 const map=[...window.__qaMaps].find(m=>m.getContainer().isConnected&&m.getContainer().getBoundingClientRect().width>0);const container=map.getContainer();
 const rendered=ids.map(id=>{const names=Object.keys(map._panes).filter(name=>name==='print-annotation-'+id||name==='care-map-geographic-print-annotation-'+id);const panes=names.map(name=>map.getPane(name)).filter(n=>n?.isConnected);return{id,panes:names,paths:panes.reduce((n,p)=>n+p.querySelectorAll('path').length,0),labels:panes.reduce((n,p)=>n+p.querySelectorAll('[data-annotation-shape-text]').length,0),images:panes.reduce((n,p)=>n+p.querySelectorAll('img[data-private-annotation-image]').length,0)};});
 return{renderedIds:rendered.filter(r=>r.paths||r.labels||r.images).map(r=>r.id),paths:rendered.reduce((n,r)=>n+r.paths,0),labels:container.querySelectorAll('[data-annotation-shape-text]').length,images:container.querySelectorAll('img[data-private-annotation-image]').length,imageReady:[...container.querySelectorAll('img[data-private-annotation-image]')].every(n=>n.complete&&n.naturalWidth>0&&n.src.startsWith('blob:')),editor:window.__qaEditorState,mapIndex:[...window.__qaMaps].indexOf(map),readout:container.querySelector('[aria-label^="Zoom level"]')?.getAttribute('aria-label')||null};
 },ids);}
try{
 fixture=await startFixture(out);browser=await chromium.launch({headless:true});page=await browser.newPage({viewport:{width:1470,height:801}});
 const annotations=Array.from({length:98},(_,i)=>{const x=1.365+Math.floor(i/10)*.0005,y=103.732+(i%10)*.0005;return{...createPrintAnnotation({type:'polygon',points:[[x,y],[x+.0003,y],[x+.0003,y+.0003]],text:'Fictional boundary '+i}),id:'visibility_'+String(i).padStart(3,'0'),boundarySource:'kml'};});
 annotations.push({...createPrintAnnotation({type:'circle',points:[[1.37,103.74],[1.371,103.741]],text:'Fictional circle'}),id:'visibility_circle'});
 const assetId=createHash('sha256').update(pixel).digest('hex');annotations.push({...createPrintAnnotation({type:'image',points:[[1.388,103.78],[1.392,103.784]],image:{assetId,width:1,height:1,alt:'Fictional image overlay'}}),id:'visibility_image'});
 assert.equal(annotations[99].type,'image');const ids=annotations.map(a=>a.id);
 state=await fixture.install(page,{annotations,annotationWriteCounts:[100]});state.document.views[0].design.layers.hiddenAnnotationIds=ids;
 await page.route('**/api/my-maps/'+fixture.mapId+'/annotation-media/'+assetId,route=>route.fulfill({body:pixel,contentType:'image/png'}));
 await page.route('**/api/my-maps/'+fixture.mapId+'/studio',async route=>{if(route.request().method()!=='PUT')return route.fallback();const body=route.request().postDataJSON();assert.equal(body.revision,state.document.revision);state.document={...body,revision:body.revision+1};studioWrites.push(structuredClone(body));return route.fulfill({json:{mapId:fixture.mapId,document:state.document,updatedAt:null}});});
 await page.goto(new URL('/my-directory/maps/'+fixture.mapId,fixture.base).href);await page.locator('[data-owner-canvas-enter]').click();await page.locator('[data-owner-canvas-tool="studio"]').click();await page.locator('[data-map-studio-annotation-layers]>summary').click();
 await until(async()=>Boolean((await read(ids)).editor?.annotationCount),'annotations not loaded');
 observations.directStudio=await read(ids);observations.directStudioSummary=await page.locator('[data-map-studio-annotation-layers]>summary').innerText();
 await check('direct Studio respects all100 hidden IDs for actual saved SVG, text and image layers',async()=>{assert.equal(observations.directStudio.renderedIds.length,0);assert.equal(observations.directStudio.labels,0);assert.equal(observations.directStudio.images,0);return observations.directStudio;});
 await page.locator('[data-owner-canvas-tool="draw"]').click();
 await until(async()=>{const r=await read(ids);return r.renderedIds.length===100&&r.images===1&&r.imageReady;},'Draw did not render all100 saved annotations including resolved image');observations.draw=await read(ids);
 await page.locator('[data-owner-canvas-tool="studio"]').click();await page.waitForTimeout(250);observations.afterDrawStudio=await read(ids);
 await check('Draw to Studio restores per-view visibility and removes every hidden saved layer',async()=>{assert.equal(observations.afterDrawStudio.renderedIds.length,0);assert.equal(observations.afterDrawStudio.labels,0);assert.equal(observations.afterDrawStudio.images,0);return observations.afterDrawStudio;});
 await page.getByRole('group',{name:'Annotations',exact:true}).getByRole('button',{name:'Hide',exact:true}).click();await until(()=>studioWrites.length===1,'globalHide did not persist once');await page.waitForTimeout(250);observations.globalHide=await read(ids);
 await check('global Annotations Hide removes saved shape, label and image layers after Draw to Studio',async()=>{assert.equal(state.document.views[0].design.layers.annotations,'hide');assert.equal(observations.globalHide.renderedIds.length,0);assert.equal(observations.globalHide.labels,0);assert.equal(observations.globalHide.images,0);return observations.globalHide;});
 await page.screenshot({path:out+'/after-global-hide.png'});
 const savedDocument=structuredClone(state.document),savedAnnotations=structuredClone(state.annotations);
 await check('reopened Draw exposes hidden saved images for editing; Return/reenter/Studio closes actual editor ownership',async()=>{
  await page.locator('[data-owner-canvas-tool="draw"]').click();
  await until(async()=>{const r=await read(ids);return r.editor.enabled&&r.renderedIds.length===100&&r.imageReady;},'reopened Draw did not expose all hidden objects');
  const image=page.locator('img[data-private-annotation-image="visibility_image"]');
  const hit=await image.evaluate(node=>{const b=node.getBoundingClientRect(),x=b.x+b.width/2,y=b.y+b.height/2;return{x,y,exposed:document.elementFromPoint(x,y)===node};});
  assert.equal(hit.exposed,true);await page.mouse.click(hit.x,hit.y);await until(()=>page.evaluate(()=>window.__qaEditorState.selectedId==='visibility_image'),'hidden saved image was not editable in Draw');
  observations.reopenedDraw=await read(ids);
  await page.locator('[data-owner-canvas-exit]').click();observations.returnWithEditor=await read(ids);assert.equal(observations.returnWithEditor.editor.enabled,true,'Return retains original page editor behavior');
  await page.locator('[data-owner-canvas-enter]').click();await page.locator('[data-owner-canvas-tool="studio"]').click();
  await until(async()=>(await read(ids)).renderedIds.length===0,'Return/reenter/Studio left stale editor layers');observations.roundtripStudio=await read(ids);
  assert.equal(observations.roundtripStudio.editor.enabled,false);assert.equal(observations.roundtripStudio.labels,0);assert.equal(observations.roundtripStudio.images,0);
  assert.equal(observations.roundtripStudio.mapIndex,observations.directStudio.mapIndex);assert.equal(observations.roundtripStudio.readout,observations.directStudio.readout);
  assert.deepEqual(state.document,savedDocument);assert.deepEqual(state.annotations,savedAnnotations);assert.equal(studioWrites.length,1);assert.equal(state.allowedWrites.length,0);
  return{drawExposesHiddenSavedIds:100,actualImageSelected:true,returnPreservesEditor:true,reenterStudioRestoresHiddenState:true,sameMapAndCamera:true,extraWrites:0};
 });
 await check('unfinished drawing blocks Studio; first Escape cancels its draft and second closes the editor',async()=>{
  await page.locator('[data-owner-canvas-tool="draw"]').click();await page.getByRole('button',{name:'Draw circle',exact:true}).click();
  const point=await page.evaluate(()=>{const m=[...window.__qaMaps].find(m=>m.getContainer().isConnected&&m.getContainer().getBoundingClientRect().width>0),p=m.latLngToContainerPoint([1.40,103.80]),b=m.getContainer().getBoundingClientRect();return{x:b.x+p.x,y:b.y+p.y};});
  await page.mouse.click(point.x,point.y);await until(()=>page.evaluate(()=>window.__qaEditorState.draftCount===1),'one-point draft did not start');
  assert.equal(await page.locator('[data-owner-canvas-tool="studio"]').isDisabled(),true);assert.equal(await page.evaluate(()=>window.__qaEditorState.draftCount),1);assert.equal(await page.evaluate(()=>window.__qaEditorState.enabled),true);
  await page.keyboard.press('Escape');await until(()=>page.evaluate(()=>window.__qaEditorState.draftCount===0),'first Escape did not cancel draft');assert.equal(await page.evaluate(()=>window.__qaEditorState.enabled),true);
  await page.keyboard.press('Escape');await until(()=>page.evaluate(()=>window.__qaEditorState.enabled===false),'second Escape did not close editor');
  await until(async()=>(await read(ids)).renderedIds.length===0,'draft close did not restore globalHide');
  const after=await read(ids);assert.equal(after.mapIndex,observations.directStudio.mapIndex);assert.equal(after.readout,observations.directStudio.readout);assert.deepEqual(state.document,savedDocument);assert.deepEqual(state.annotations,savedAnnotations);assert.equal(studioWrites.length,1);assert.equal(state.allowedWrites.length,0);
  return{studioRefusedUnfinishedDraft:true,firstEscapeCancelsDraft:true,secondEscapeCloses:true,savedGeometryExact:true,extraWrites:0};
 });
 await check('accepted panel close after failed autosave preserves the existing local draft and never claims Saved',async()=>{
  let failedAttempts=0;await page.route('**/api/my-maps/'+fixture.mapId+'/print-annotations',async route=>{if(route.request().method()==='PUT'){failedAttempts++;return route.fulfill({status:503,json:{error:'Fictional geometry save failure'}});}return route.fallback();});
  await page.locator('[data-owner-canvas-tool="draw"]').click();await page.getByRole('button',{name:'Draw circle',exact:true}).click();
  const points=await page.evaluate(()=>{const m=[...window.__qaMaps].find(m=>m.getContainer().isConnected&&m.getContainer().getBoundingClientRect().width>0),b=m.getContainer().getBoundingClientRect();return[[1.40,103.80],[1.405,103.805]].map(v=>{const p=m.latLngToContainerPoint(v);return{x:b.x+p.x,y:b.y+p.y};});});
  for(const point of points)await page.mouse.click(point.x,point.y);
  await until(()=>failedAttempts>0,'deliberate failed geometry save not attempted');await until(()=>page.evaluate(()=>window.__qaEditorState.annotationCount===101),'completed local circle not retained');
  await until(async()=>await page.locator('[data-owner-canvas-save]').getAttribute('data-owner-canvas-save')==='failed','failed save indicator missing');
  const key=getAnnotationLocalDraftKey(owner.id,fixture.mapId);const before=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);assert.equal(before.annotations.length,101);
  await page.locator('[data-owner-canvas-tool="studio"]').click();await until(()=>page.evaluate(()=>window.__qaEditorState.enabled===false),'accepted clean transition did not close editor');
  await until(async()=>await page.locator('[data-owner-canvas-save]').getAttribute('data-owner-canvas-save')==='failed','accepted-close must not become Saved');
  const after=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);assert.deepEqual(after.annotations,before.annotations);assert.equal(after.baseRevision,before.baseRevision);
  assert.deepEqual(state.annotations,savedAnnotations);assert.equal(state.allowedWrites.length,0);assert.deepEqual(state.document,savedDocument);assert.equal(studioWrites.length,1);
  return{acceptedCloseIsNotSaveAck:true,failedAttempts,localAnnotationsRetained:101,savedRemoteAnnotations:100,failedStatusRetained:true,successfulAnnotationWrites:0};
 });
 observations.afterReturn=await read(ids);
 report.observations=observations;report.intentionalStudioWrites=studioWrites.length;report.annotationWrites=state.allowedWrites.length;report.expectedVisibilityRed=observations.directStudio.renderedIds.length===0&&observations.afterDrawStudio.renderedIds.length===100&&observations.globalHide.renderedIds.length===100;
 assert.equal(state.allowedWrites.length,0);assert.deepEqual(state.errors,[]);assert.deepEqual(state.unexpectedWrites,[]);
}catch(error){report.failure=error.stack;process.exitCode=1;if(page)await fs.writeFile(out+'/failure-dom.txt',await page.locator('body').innerText()).catch(()=>{});}
finally{report.errors=state?.errors||[];report.unexpectedWrites=state?.unexpectedWrites||[];report.sourceAfter=await fingerprint();report.sourceUnchanged=JSON.stringify(report.sourceBefore)===JSON.stringify(report.sourceAfter);report.summary={passed:report.cases.filter(c=>c.passed).length,failed:report.cases.filter(c=>!c.passed).length};if(report.summary.failed||!report.sourceUnchanged)process.exitCode=1;await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');await browser?.close();await fixture?.server.close();console.log(JSON.stringify({out,summary:report.summary,failure:report.failure,expectedVisibilityRed:report.expectedVisibilityRed,observations:Object.fromEntries(Object.entries(report.observations||{}).map(([k,v])=>[k,typeof v==='object'?{renderedIds:v.renderedIds?.length,paths:v.paths,labels:v.labels,images:v.images,editorEnabled:v.editor?.enabled,mapIndex:v.mapIndex,readout:v.readout}:v])),sourceUnchanged:report.sourceUnchanged}));}
