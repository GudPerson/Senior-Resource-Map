// Actual App and Leaflet, fictional overlapping boundaries, local intercepted writes only.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { startFixture, fingerprint } from '../fixtures/care-map-floating-canvas/runtime.mjs';
import { createPrintAnnotation } from '../../client/src/lib/printAnnotations.js';
const out=process.argv.find(v=>v.startsWith('--out='))?.slice(6)||await fs.mkdtemp(path.join(os.tmpdir(),'care-map-visible-boundary-'));
await fs.mkdir(out,{recursive:true});
const report={limitations:['After closing a library modal, subsequent Studio pointer activation was intercepted by the map in prior runs. Baseline status is unverified; these scenarios reload before later interactions.'],boundary:'Local actual App/Leaflet; synthetic geometry; in-memory annotation, Studio and library writes; no external API access.',sourceBefore:await fingerprint(),cases:[]};
let fixture,browser,page,state;const libraryWrites=[],studioWrites=[];
async function until(fn,message){for(let n=0;n<250;n++){if(await fn())return;await new Promise(r=>setTimeout(r,40));}throw Error(message);}
async function check(name,fn){const evidence=await fn();report.cases.push({name,passed:true,evidence});}
const editor=()=>page.evaluate(()=>window.__qaEditorState);
async function rendered(ids){return page.evaluate(ids=>{const m=[...window.__qaMaps].find(m=>m.getContainer().isConnected&&m.getContainer().getBoundingClientRect().width>0);return ids.filter(id=>Object.keys(m._panes).filter(k=>k==='print-annotation-'+id||k==='care-map-geographic-print-annotation-'+id).some(k=>m.getPane(k)?.querySelector('path,[data-annotation-shape-text],img[data-private-annotation-image]')));},ids);}
async function clickAt(latlng){const p=await page.evaluate(ll=>{const m=[...window.__qaMaps].find(m=>m.getContainer().isConnected&&m.getContainer().getBoundingClientRect().width>0),b=m.getContainer().getBoundingClientRect(),p=m.latLngToContainerPoint(ll);return{x:b.x+p.x,y:b.y+p.y};},latlng);await page.mouse.click(p.x,p.y);}
try{
 fixture=await startFixture(out);browser=await chromium.launch({headless:true});page=await browser.newPage({viewport:{width:1470,height:801}});
 const shape={type:'polygon',points:[[1.38,103.76],[1.38,103.78],[1.40,103.78],[1.40,103.76]],text:'Visible target'};
 const visible={...createPrintAnnotation(shape),id:'visible_boundary'};
 const hidden={...createPrintAnnotation({...shape,text:'Hidden overlapping boundary'}),id:'hidden_boundary'};
 state=await fixture.install(page,{annotations:[visible,hidden],annotationWriteCounts:[2,3,4,5]});state.allowAnnotationWrites=true;
 state.document.views[0].design.layers.hiddenAnnotationIds=[hidden.id];
 await page.route('**/api/my-maps/'+fixture.mapId+'/studio',async route=>{if(route.request().method()!=='PUT')return route.fallback();const body=route.request().postDataJSON();assert.equal(body.revision,state.document.revision);state.document={...body,revision:body.revision+1};studioWrites.push(body);return route.fulfill({json:{mapId:fixture.mapId,document:state.document}});});
 await page.route('**/api/boundary-library',async route=>{if(route.request().method()!=='POST')return route.fallback();const body=route.request().postDataJSON();libraryWrites.push(body);return route.fulfill({json:{id:'fictional-library-boundary',...body}});});
 const libraryItem={id:91261,revision:1,name:'Fictional imported boundary',type:'polygon',drawing:visible,pointCount:4};
 await page.route('**/api/boundary-library?**',route=>route.fulfill({json:{items:[libraryItem],nextCursor:null}}));
 await page.route('**/api/boundary-library/91261',route=>route.fulfill({json:libraryItem}));
 await page.goto(new URL('/my-directory/maps/'+fixture.mapId,fixture.base).href);await page.locator('[data-owner-canvas-enter]').click();await page.locator('[data-owner-canvas-tool="draw"]').click();
 await until(async()=>(await editor())?.annotationCount===2,'annotations not loaded');
 await check('only the visible overlapping boundary is rendered and selectable in Draw',async()=>{
  assert.deepEqual(await rendered([visible.id,hidden.id]),[visible.id]);await clickAt([1.385,103.775]);await until(async()=>(await editor()).selectedId===visible.id,'visible overlapping boundary was not selected');
  return{selectedId:(await editor()).selectedId,documentCount:(await editor()).annotationCount};
 });
 await check('edit and save retain the hidden boundary byte-for-byte',async()=>{
  await page.getByRole('textbox',{name:'Note inside shape'}).fill('Edited visible target');await page.getByRole('textbox',{name:'Note inside shape'}).press('Tab');
  await until(()=>state.annotations[0].text==='Edited visible target','visible text did not save');assert.deepEqual(state.annotations[1],hidden);assert.equal(state.annotations.length,2);
  return{annotationWrites:state.allowedWrites.length,hiddenDocumentExact:true};
 });
 await check('Save boundary to library uses the selected visible boundary and saved revision',async()=>{
  await page.getByRole('button',{name:'Save boundary to library',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Save a library boundary'});
  await dialog.getByRole('checkbox',{name:'Save to Boundary Library',exact:true}).check();await dialog.getByRole('button',{name:'Save snapshot',exact:true}).click();
  await until(()=>libraryWrites.length===1,'library snapshot not requested');assert.equal(libraryWrites[0].source.annotationId,visible.id);assert.equal(libraryWrites[0].source.mapId,fixture.mapId);assert.equal(libraryWrites[0].source.revision,state.annotationRevision);
  await dialog.getByRole('button',{name:'Done',exact:true}).click();await page.reload();await page.locator('[data-owner-canvas-enter]').click();await page.locator('[data-owner-canvas-tool="draw"]').click();await until(async()=>(await editor())?.annotationCount===2,'reloaded annotations missing');await clickAt([1.385,103.775]);await until(async()=>(await editor()).selectedId===visible.id,'reloaded visible boundary not selectable');assert.deepEqual(state.annotations[1],hidden);
  return{source:libraryWrites[0].source,hiddenDocumentExact:true};
 });
 await check('hiding the selected object clears selection and reopening cannot restore it',async()=>{
  await page.locator('[data-owner-canvas-tool="studio"]').click();await page.locator('[data-map-studio-annotation-layers]>summary').click();await page.locator('[data-annotation-visibility="'+visible.id+'"]').click();await until(()=>studioWrites.length===1,'item hide not saved');
  await page.locator('[data-owner-canvas-tool="draw"]').click();await until(async()=>(await editor()).enabled,'Draw not reopened');assert.equal((await editor()).selectedId,null);assert.deepEqual(await rendered([visible.id,hidden.id]),[]);
  await page.locator('[data-owner-canvas-tool="studio"]').click();await page.getByRole('group',{name:'Annotations',exact:true}).getByRole('button',{name:'Hide',exact:true}).click();await until(()=>studioWrites.length===2,'global hide not saved');
  return{selectionCleared:true,savedAnnotations:state.annotations.length};
 });
 await check('new drawing and duplicate stay editable under global hide, but disappear on reopen',async()=>{
  await page.locator('[data-owner-canvas-tool="draw"]').click();await page.getByRole('button',{name:'Draw circle',exact:true}).click();await clickAt([1.40,103.80]);await clickAt([1.405,103.805]);
  await until(()=>state.annotations.length===3,'new circle not saved');const created=state.annotations[2].id;assert.deepEqual(await rendered([visible.id,hidden.id,created]),[created]);
  await page.getByRole('button',{name:'Duplicate annotation',exact:true}).click();await until(()=>state.annotations.length===4,'duplicate not saved');const duplicated=state.annotations[3].id;
  assert.deepEqual(await rendered([visible.id,hidden.id,created,duplicated]),[created,duplicated]);assert.equal((await editor()).selectedId,duplicated);assert.deepEqual(state.annotations[1],hidden);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await until(async()=>(await editor()).annotationCount===3,'Undo did not remove duplicate');assert.deepEqual(await rendered([visible.id,hidden.id,created,duplicated]),[created]);
  await page.getByRole('button',{name:'Redo',exact:true}).click();await until(async()=>(await editor()).annotationCount===4,'Redo did not restore duplicate');assert.deepEqual(await rendered([visible.id,hidden.id,created,duplicated]),[created,duplicated]);assert.deepEqual(state.annotations[1],hidden);
  await page.locator('[data-owner-canvas-tool="studio"]').click();await page.locator('[data-owner-canvas-tool="draw"]').click();await until(async()=>(await editor()).enabled,'Draw not reopened');assert.deepEqual(await rendered(state.annotations.map(a=>a.id)),[]);assert.equal((await editor()).annotationCount,4);assert.equal((await editor()).selectedId,null);
  return{documentCount:4,newAndDuplicateEditable:true,undoRedoRetainsTemporaryVisibility:true,reopenedHidden:true,hiddenDocumentExact:true};
 });
 await check('Boundary Library import remains visible and editable while saved boundaries stay globally hidden',async()=>{
  await page.getByRole('button',{name:'Boundary Library',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Boundary Library',exact:true});
  await dialog.getByRole('checkbox',{name:/Fictional imported boundary/}).check();await dialog.getByRole('button',{name:'Add boundaries to map',exact:true}).click();
  await until(()=>state.annotations.length===5,'library import not saved');const imported=state.annotations[4].id;assert.deepEqual(await rendered(state.annotations.map(a=>a.id)),[imported]);
  await clickAt([1.385,103.775]);await until(async()=>(await editor()).selectedId===imported,'imported boundary was not selectable');assert.deepEqual(state.annotations[1],hidden);
  await page.reload();await page.locator('[data-owner-canvas-enter]').click();await page.locator('[data-owner-canvas-tool="draw"]').click();await until(async()=>(await editor())?.enabled&&(await editor()).annotationCount===5,'Draw not reloaded');assert.deepEqual(await rendered(state.annotations.map(a=>a.id)),[]);assert.equal((await editor()).annotationCount,5);
  return{importedEditable:true,documentCount:5,reloadedHidden:true};
 });
 await check('explicitly showing a formerly hidden boundary makes it selectable again',async()=>{
  await page.locator('[data-owner-canvas-tool="studio"]').click();await page.getByRole('group',{name:'Annotations',exact:true}).getByRole('button',{name:'Show',exact:true}).click();await until(()=>studioWrites.length===3,'global show not saved');await page.locator('[data-map-studio-annotation-layers]>summary').click();
  await page.locator('[data-annotation-visibility="'+visible.id+'"]').click();await until(()=>studioWrites.length===4,'item show not saved');await page.locator('[data-owner-canvas-tool="draw"]').click();
  await until(async()=>(await editor()).enabled,'Draw not reopened');assert.ok((await rendered([visible.id,hidden.id])).includes(visible.id));assert.ok(!(await rendered([visible.id,hidden.id])).includes(hidden.id));
  // A later imported snapshot overlaps this boundary, so explicitly hide it first through Studio.
  await page.locator('[data-owner-canvas-tool="studio"]').click();const imported=state.annotations[4].id;await page.locator('[data-annotation-visibility="'+imported+'"]').click();await until(()=>studioWrites.length===5,'imported overlap hide not saved');await page.locator('[data-owner-canvas-tool="draw"]').click();
  await clickAt([1.385,103.775]);await until(async()=>(await editor()).selectedId===visible.id,'shown boundary not selectable');assert.deepEqual(state.annotations[1],hidden);
  return{shownBoundarySelectable:true,hiddenSiblingExact:true};
 });
 assert.deepEqual(state.errors,[]);assert.deepEqual(state.unexpectedWrites,[]);await page.screenshot({path:out+'/reopened-global-hide.png'});
}catch(error){report.failure=error.stack;process.exitCode=1;await fs.writeFile(out+'/failure-dom.txt',await page?.locator('body').innerText()||'').catch(()=>{});}
finally{report.sourceAfter=await fingerprint();report.sourceUnchanged=JSON.stringify(report.sourceBefore)===JSON.stringify(report.sourceAfter);report.errors=state?.errors;report.unexpectedWrites=state?.unexpectedWrites;report.libraryWrites=libraryWrites;report.annotationWrites=state?.allowedWrites;report.summary={passed:report.cases.length,failed:report.failure?1:0};if(!report.sourceUnchanged)process.exitCode=1;await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');await browser?.close();await fixture?.server.close();console.log(JSON.stringify({out,summary:report.summary,failure:report.failure,sourceUnchanged:report.sourceUnchanged}));}
