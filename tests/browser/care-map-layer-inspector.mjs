// Actual App/Leaflet, wholly fictional data and intercepted APIs. Not device UAT.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {startFixture,pixel} from '../fixtures/care-map-floating-canvas/runtime.mjs';
import {fingerprint} from '../fixtures/care-map-layer-inspector/source-fingerprint.mjs';
import {annotationsForInspection,directoryForInspection,centre} from '../fixtures/care-map-layer-inspector/data.mjs';

const out=process.argv.find(x=>x.startsWith('--out='))?.slice(6)||await fs.mkdtemp(path.join(os.tmpdir(),'care-map-layer-inspector-'));
const only=process.argv.find(x=>x.startsWith('--only='))?.slice(7);
const traceNative=process.argv.includes('--trace-native');
const traceHover=process.argv.includes('--trace-hover');
const diagnosticTransformPath=process.argv.find(x=>x.startsWith('--probe-transform='))?.slice(18);
const diagnosticTransform=diagnosticTransformPath?(await import(new URL('file://'+diagnosticTransformPath))).instrumentProbeResponse:null;
await fs.mkdir(out,{recursive:true});
const report={boundary:'Local actual App/Leaflet with fictional overlaps and media; native scripted pointer/key/wheel inputs, no production or physical-device claim.',sourceBefore:await fingerprint(),cases:[]};
const extraObserverFiles=['../../package-lock.json',...['owner-selected','owner-unavailable','shared-selected','shared-withdrawn'].map(name=>'../fixtures/care-map-area-resources/server-dto/'+name+'.json')];
async function extraObserverFingerprint(){return Object.fromEntries(await Promise.all(extraObserverFiles.map(async p=>[p,createHash('sha256').update(await fs.readFile(new URL(p,import.meta.url))).digest('hex')])));}
report.extraObserverBefore=await extraObserverFingerprint();
if(diagnosticTransformPath)report.diagnosticTransform={path:diagnosticTransformPath,sha256:createHash('sha256').update(await fs.readFile(diagnosticTransformPath)).digest('hex'),boundary:'Local response-instrumented diagnostic, not unmodified acceptance execution'};
let fixture,browser,current;
const scenes=[];
const assetId=createHash('sha256').update(pixel).digest('hex');
const menu=page=>page.locator('[data-owner-canvas-context-menu]');
const card=page=>page.locator('[data-map-layer-pointer-card]');
async function until(fn,message,timeout=7000){const t=Date.now();while(Date.now()-t<timeout){if(await fn())return;await new Promise(r=>setTimeout(r,40));}throw Error(message);}
async function check(name,fn){if(only&&!name.includes(only))return;try{const evidence=await fn();report.cases.push({name,passed:true,evidence});}catch(error){report.cases.push({name,passed:false,error:error.message});throw error;}}
async function scene({width=1600,height=1100,extraAreas=0,image=true,annotations='show',resources='show',owner=true,directory=null,hiddenPlaces=[]}={}){
  const page=await browser.newPage({viewport:{width,height},hasTouch:true});
  const saved=annotationsForInspection(assetId,{extraAreas,image});
  const state=await fixture.install(page,{zoom:16,annotations:saved,annotationWriteCounts:[saved.length]});
  state.directory=directory?structuredClone(directory):directoryForInspection();
  state.directory.id=fixture.mapId;
  state.directory.viewer={...state.directory.viewer,isOwner:owner};
  state.document.views[0].design.layers.annotations=annotations;
  state.document.views[0].design.layers.resources=resources;
  state.document.views[0].design.layers.hiddenAnnotationIds=['layer-hidden'];
  state.document.views[0].design.pins.hiddenPlaceKeys=hiddenPlaces;
  await page.route('**/api/my-maps/'+fixture.mapId+'/annotation-media/'+assetId,route=>route.fulfill({body:pixel,contentType:'image/png'}));
  if(diagnosticTransform)await page.route('**/OwnerMapLayerProbe.jsx*',async route=>{
    const response=await route.fetch(),source=await response.text();await fs.writeFile(path.join(out,'diagnostic-response-original.js'),source);const changed=diagnosticTransform(source),headers={...response.headers()};delete headers['content-length'];headers['content-type']='application/javascript';
    report.diagnosticResponse={url:route.request().url(),originalSha256:createHash('sha256').update(source).digest('hex'),executedSha256:createHash('sha256').update(changed.code).digest('hex'),edits:changed.edits,boundary:changed.boundary};
    await fs.writeFile(path.join(out,'diagnostic-response-original.js'),source);await fs.writeFile(path.join(out,'diagnostic-response-executed.js'),changed.code);
    await route.fulfill({response,headers,body:changed.code});
  });
  const s={page,state,originalStudio:JSON.stringify(state.document),originalAnnotations:JSON.stringify(state.annotations)};
  scenes.push(s);current=s;
  await page.goto(fixture.base+'my-directory/maps/'+fixture.mapId);
  await page.getByText(state.directory.name,{exact:true}).first().waitFor();
  if(diagnosticTransform)assert.ok(report.diagnosticResponse?.executedSha256,'Diagnostic response interception must execute before any test input');
  await page.locator('.leaflet-container').waitFor();
  await until(()=>page.evaluate(owner=>[...window.__qaMaps].some(m=>m.getContainer().isConnected&&m._loaded&&(!owner||m.getZoom()>=15.5)),owner),'Expected fixture map not admitted');
  await page.locator('.leaflet-container').scrollIntoViewIfNeeded();
  // The existing fixture may complete its normal initial location focus after
  // first map admission. Wait for that camera AND ancestor scroll to settle;
  // never count that mount-time movement as an input-induced regression.
  const settleStart=Date.now();let last='',stableSince=0;
  await until(async()=>{
    const value=JSON.stringify(await page.evaluate(()=>{const m=[...window.__qaMaps].find(m=>m.getContainer().isConnected&&m.getContainer().getBoundingClientRect().width>0);return{zoom:m?.getZoom(),bearing:m?.getBearing(),centre:m?[m.getCenter().lat,m.getCenter().lng]:null,scrollY};}));
    if(value!==last){last=value;stableSince=Date.now();}
    return Date.now()-settleStart>=2200&&Date.now()-stableSince>=700;
  },'Initial camera/ancestor-scroll did not settle',7000);
  s.initialSettled=JSON.parse(last);
  return s;
}
async function camera(s){return s.page.evaluate(()=>{const m=[...window.__qaMaps].find(m=>m.getContainer().isConnected&&m.getContainer().getBoundingClientRect().width>0);return{index:[...window.__qaMaps].indexOf(m),zoom:m.getZoom(),bearing:m.getBearing(),centre:[m.getCenter().lat,m.getCenter().lng],canvas:document.querySelector('[data-owner-editing-canvas]')?.dataset.ownerCanvasActive};});}
async function resourceHit(s){return s.page.evaluate(()=>{
  const container=document.querySelector('.leaflet-container'),b=container.getBoundingClientRect();
  const zones=[...container.querySelectorAll('[data-category-bubble-place-key],[data-print-lobe-place-key],.directory-asset-spread-cluster__hit-zone[data-place-key]')];
  const markers=zones.length?zones:[...container.querySelectorAll('.leaflet-marker-icon')].filter(n=>!n.classList.contains('carearound-print-annotation-marker'));
  const candidates=markers.map(n=>{const r=n.getBoundingClientRect();return{r,x:r.left+r.width/2,y:r.top+r.height/2};}).filter(p=>p.r.width&&p.r.height&&p.x>0&&p.y>0&&p.x<innerWidth&&p.y<innerHeight).sort((a,c)=>Math.hypot(a.x-b.left-b.width/2,a.y-b.top-b.height/2)-Math.hypot(c.x-b.left-b.width/2,c.y-b.top-b.height/2));
  if(!candidates.length)throw Error('No actual visible native resource marker');
  const p=candidates[0],target=document.elementFromPoint(p.x,p.y);
  return{x:p.x,y:p.y,tag:target?.tagName,className:typeof target?.className==='string'?target.className:target?.className?.baseVal,nativeMarker:Boolean(target?.closest('.leaflet-marker-icon'))};
});}
async function mapPoint(s,point=centre){return s.page.evaluate(point=>{const m=[...window.__qaMaps].find(m=>m.getContainer().isConnected),p=m.latLngToContainerPoint(point),b=m.getContainer().getBoundingClientRect();return{x:b.left+p.x,y:b.top+p.y};},point);}
async function startNativeTrace(s,p){
  report.currentProbe={point:p,beforeCamera:await camera(s)};
  await s.page.evaluate(()=>{
    const events=[],cleanup=[],start=performance.now(),root=document.querySelector('[data-owner-editing-canvas]'),map=document.querySelector('.leaflet-container');
    const describe=n=>n instanceof Element?{tag:n.tagName,role:n.getAttribute('role'),class:typeof n.className==='string'?n.className:n.className?.baseVal,id:n.id,annotationPin:n.getAttribute('data-annotation-pin-id'),annotationLabel:n.getAttribute('data-annotation-label-id'),placeKey:n.getAttribute('data-place-key'),printPlaceKey:n.getAttribute('data-print-lobe-place-key'),categoryPlaceKey:n.getAttribute('data-category-bubble-place-key')}:null;
    const exclusions=['button','a','.leaflet-control','[data-care-map-gesture-ui]','[role=dialog]','[data-print-annotation-toolbar]','[data-map-settings-control]','.leaflet-marker-icon'];
    function add(target,type,fn,capture){target.addEventListener(type,fn,capture);cleanup.push(()=>target.removeEventListener(type,fn,capture));}
    for(const type of ['pointerdown','mousedown','contextmenu','mouseup','click','auxclick']) for(const phase of [true,false]) add(document,type,e=>{
      const row={type,phase:phase?'capture':'bubble',t:+(performance.now()-start).toFixed(2),button:e.button,buttons:e.buttons,x:e.clientX,y:e.clientY,defaultPrevented:e.defaultPrevented,connected:e.target?.isConnected,target:describe(e.target),chain:e.composedPath().filter(n=>n instanceof Element).slice(0,10).map(describe),rootContains:root?.contains(e.target),mapContains:map?.contains(e.target),matches:Object.fromEntries(exclusions.map(q=>[q,Boolean(e.target?.closest?.(q))])),menuCount:document.querySelectorAll('[data-owner-canvas-context-menu]').length};
      events.push(row);queueMicrotask(()=>{row.afterDispatchPrevented=e.defaultPrevented;row.afterDispatchConnected=e.target?.isConnected;});requestAnimationFrame(()=>{row.frameMenuCount=document.querySelectorAll('[data-owner-canvas-context-menu]').length;row.frameConnected=e.target?.isConnected;});
    },phase);
    add(window,'scroll',e=>{const n=e.target;events.push({type:'scroll',t:+(performance.now()-start).toFixed(2),target:describe(n),mapAncestor:n===document||n===window||n?.contains?.(map),scrollY});},true);
    for(const m of window.__qaMaps) if(m.getContainer().isConnected) for(const type of ['movestart','moveend','zoomstart','zoomend','rotatestart','rotate']){const fn=()=>events.push({type,t:+(performance.now()-start).toFixed(2),zoom:m.getZoom(),bearing:m.getBearing()});m.on(type,fn);cleanup.push(()=>m.off(type,fn));}
    window.__nativeTargetTrace={events,cleanup};
  });
}
async function collectNativeTrace(s){if(!traceNative)return;report.nativeTargetTrace=await s.page.evaluate(()=>{const t=window.__nativeTargetTrace;t?.cleanup.forEach(fn=>fn());return t?.events;});report.currentProbe.afterCamera=await camera(s);}
async function hoverTrace(s,p){
  if(diagnosticTransform){report.callsiteBeforeHover=await s.page.evaluate(()=>globalThis.__carearoundHoverDiagnostic);await s.page.evaluate(()=>{globalThis.__carearoundHoverDiagnostic={events:[],dropped:0};});}
  await s.page.evaluate(()=>{
    const container=document.querySelector('.leaflet-container'),cleanup=[],counts={},events=[],timers=new Set();
    const originalSet=window.setTimeout,originalClear=window.clearTimeout;
    const record={counts,events,queued:0,fired:0,canceled:0,steps:[]};
    const add=(node,type,capture,label)=>{const fn=e=>{const key=label+':'+type;counts[key]=(counts[key]||0)+1;if(events.length<20)events.push({key,tag:e.target.tagName,class:typeof e.target.className==='string'?e.target.className:e.target.className?.baseVal,buttons:e.buttons,ui:Boolean(e.target.closest?.('button,a,.leaflet-control,[data-care-map-gesture-ui]'))});};node.addEventListener(type,fn,capture);cleanup.push(()=>node.removeEventListener(type,fn,capture));};
    for(const type of ['pointermove','mousemove']){add(document,type,true,'documentCapture');add(container,type,true,'containerCapture');add(container,type,false,'containerBubble');}
    const m=[...window.__qaMaps].find(m=>m.getContainer().isConnected);for(const type of ['mousemove','movestart','moveend','zoomstart','zoomend']){const fn=()=>{counts['Leaflet:'+type]=(counts['Leaflet:'+type]||0)+1;};m.on(type,fn);cleanup.push(()=>m.off(type,fn));}
    function timer(fn,delay,...args){const tracked=delay===80&&new Error().stack.includes('OwnerMapLayerProbe');if(!tracked)return originalSet.call(this,fn,delay,...args);record.queued++;let id;id=originalSet.call(this,(...v)=>{timers.delete(id);record.fired++;return fn(...v);},delay,...args);timers.add(id);return id;}
    function clear(id){if(timers.delete(id))record.canceled++;return originalClear.call(this,id);}
    window.setTimeout=timer;window.clearTimeout=clear;
    cleanup.push(()=>{if(window.setTimeout===timer)window.setTimeout=originalSet;if(window.clearTimeout===clear)window.clearTimeout=originalClear;});
    window.__hoverTrace={record,cleanup};
  });
  const step=async name=>s.page.evaluate(name=>{const m=[...window.__qaMaps].find(m=>m.getContainer().isConnected);window.__hoverTrace.record.steps.push({name,cardCount:document.querySelectorAll('[data-map-layer-pointer-card]').length,route:location.pathname,zoom:m.getZoom(),animatingZoom:Boolean(m._animatingZoom),panInProgress:Boolean(m._panAnim?._inProgress),scrollY});},name);
  await s.page.mouse.move(p.x+1,p.y);await s.page.waitForTimeout(500);await step('nativeResource');
  const nativeCount=await card(s.page).count(),b=await s.page.locator('.leaflet-container').boundingBox();
  await s.page.mouse.move(b.x+b.width*.2,b.y+b.height*.25);await s.page.waitForTimeout(500);await step('mapBackground');
  const fresh=await resourceHit(s);await s.page.mouse.move(fresh.x+1,fresh.y);await s.page.waitForTimeout(500);await step('nativeResourceAgain');
  await open(s,fresh);report.hoverToggleAfter=await menu(s.page).locator('[data-map-layer-toggle]').getAttribute('aria-checked');await close(s);
  report.hoverTrace=await s.page.evaluate(()=>{const t=window.__hoverTrace;t.cleanup.forEach(fn=>fn());return t.record;});
  if(diagnosticTransform)report.callsiteAfterHover=await s.page.evaluate(()=>globalThis.__carearoundHoverDiagnostic);
  assert.ok(nativeCount>0,'Native resource hover must produce pointer readout');
}
async function open(s,p){await s.page.mouse.click(p.x,p.y,{button:'right'});await menu(s.page).waitFor({state:'visible',timeout:2500});}
async function close(s){await s.page.keyboard.press('Escape');await menu(s.page).waitFor({state:'detached'});}
async function readout(locator){return locator.evaluate(n=>Object.fromEntries(['resources','areas','annotations'].map(group=>[group,[...n.querySelectorAll('[data-map-layer-group="'+group+'"] [data-map-layer-id]')].map(x=>({id:x.dataset.mapLayerId,name:x.querySelector('span')?.textContent}))])));}
async function passiveLayout(s){return card(s.page).evaluate(n=>{
  const box=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right};};
  const footer=n.querySelector('[data-map-layer-passive-footer]'),name=n.querySelector('[data-map-layer-id] span');
  return{card:box(n),footer:footer?box(footer):null,footerText:footer?.textContent,nameFontPx:name?parseFloat(getComputedStyle(name).fontSize):null,viewport:{width:innerWidth,height:innerHeight}};
});}
function assertPassiveLayout(value){assert.ok(value.footer);assert.ok(value.footerText.includes('Right-click for full list'));assert.ok(value.nameFontPx>=12);assert.ok(value.card.height<=190.01);assert.ok(value.footer.bottom<=value.card.bottom+.01);assert.ok(value.card.x>=0&&value.card.y>=0&&value.card.right<=value.viewport.width&&value.card.bottom<=value.viewport.height,'Passive readout/footer outside viewport');}
function assertNames(rows){const names=rows.resources.map(x=>x.name);assert.ok(names.includes('Fictional resource Alpha'));assert.ok(names.includes('Fictional resource Beta'));const areas=rows.areas.map(x=>x.id);for(const id of ['layer-rhs','layer-grc','layer-circle'])assert.ok(areas.includes(id),'Missing '+id);assert.ok(!Object.values(rows).flat().some(x=>x.id==='layer-hidden'||x.name?.includes('Never shown')));}
function assertSaved(s){assert.equal(JSON.stringify(s.state.document),s.originalStudio);assert.equal(JSON.stringify(s.state.annotations),s.originalAnnotations);assert.deepEqual(s.state.allowedWrites,[]);assert.deepEqual(s.state.unexpectedWrites,[]);}

try{
  fixture=await startFixture(out);browser=await chromium.launch({headless:true});
  await check('native resource overlap frozen menu and optional hover are complete and local',async()=>{
    const s=await scene(),p=await resourceHit(s),before=await camera(s);
    assert.equal(await card(s.page).count(),0);assert.equal(p.nativeMarker,true);
    if(traceNative)await startNativeTrace(s,p);
    try{await open(s,p);}finally{if(traceNative)await collectNativeTrace(s);}
    const rows=await readout(menu(s.page));assertNames(rows);
    for(const id of ['layer-line','layer-image','layer-pin'])assert.ok(rows.annotations.some(x=>x.id===id),'Missing overlap '+id);
    const toggle=menu(s.page).locator('[data-map-layer-toggle]');assert.equal(await toggle.getAttribute('aria-checked'),'false');
    await s.page.screenshot({path:path.join(out,'inspector-native-resource-menu.png')});
    const frozen=JSON.stringify(rows);await s.page.mouse.move(20,20);assert.equal(JSON.stringify(await readout(menu(s.page))),frozen);
    await toggle.click();assert.equal(await toggle.getAttribute('aria-checked'),'true');await close(s);
    if(traceHover)await hoverTrace(s,p);
    await s.page.mouse.move(p.x+1,p.y);await card(s.page).waitFor({timeout:2500});assertNames(await readout(card(s.page)));
    assert.equal(await card(s.page).evaluate(n=>getComputedStyle(n).pointerEvents),'none');
    const quietHoverNode=await card(s.page).elementHandle();await s.page.waitForTimeout(350);
    assert.equal(await quietHoverNode.evaluate(n=>n.isConnected),true,'Quiet native hover readout must remain mounted');assert.equal(await card(s.page).count(),1);assertNames(await readout(card(s.page)));const passive=await passiveLayout(s);assertPassiveLayout(passive);
    assert.deepEqual(await camera(s),before);assertSaved(s);
    await s.page.screenshot({path:path.join(out,'inspector-native-resource-classic.png')});
    // Explicit primary intent remains the established place-focus action; the
    // new owner-only secondary guard must not consume it.
    const primaryHit=await resourceHit(s);await s.page.mouse.click(primaryHit.x,primaryHit.y);
    await until(async()=>(await camera(s)).zoom>before.zoom,'Primary resource activation no longer focuses the map');
    const primaryAfter=await camera(s);assert.equal(primaryAfter.index,before.index);assertSaved(s);
    return{nativeHit:p,rows,frozen:true,passiveHover:true,passiveLayout:passive,inspectionCameraUnchanged:before,primaryActivation:{before:before.zoom,after:primaryAfter.zoom,sameMap:true},studioWrites:0,annotationWrites:0};
  });
  await check('enabled inspection preserves same map through canvas rotation Return and ancestor scroll',async()=>{
    const s=await scene(),p=await resourceHit(s),before=await camera(s);
    await open(s,p);await menu(s.page).locator('[data-map-layer-toggle]').click();await close(s);
    await open(s,p);const scrollBefore=await s.page.evaluate(()=>scrollY);
    await s.page.mouse.move(p.x-260,p.y);await s.page.mouse.wheel(0,160);
    await until(async()=>await menu(s.page).count()===0,'Page scroll did not close frozen anchor');
    const scrollAfter=await s.page.evaluate(()=>scrollY);assert.ok(scrollAfter>scrollBefore);
    assert.equal((await camera(s)).zoom,before.zoom);
    await s.page.locator('[data-owner-canvas-enter]').click();await s.page.waitForTimeout(180);assert.equal((await camera(s)).index,before.index);
    const q=await resourceHit(s);await s.page.mouse.move(q.x,q.y);await card(s.page).waitFor();assertNames(await readout(card(s.page)));
    await s.page.screenshot({path:path.join(out,'inspector-canvas-overlap.png')});
    await open(s,q);assert.equal(await menu(s.page).locator('[data-map-layer-toggle]').getAttribute('aria-checked'),'true');await close(s);
    const surface=await s.page.locator('.leaflet-container').boundingBox();const drag={x:surface.x+surface.width*.72,y:surface.y+surface.height*.68};
    await s.page.mouse.move(drag.x,drag.y);await s.page.mouse.down({button:'right'});await s.page.mouse.move(drag.x+24,drag.y,{steps:5});await s.page.mouse.up({button:'right'});await s.page.waitForTimeout(120);
    assert.equal(await menu(s.page).count(),0);assert.ok(Math.abs((await camera(s)).bearing)>1);
    await s.page.getByRole('button',{name:'Reset to north',exact:true}).click();
    await s.page.locator('[data-owner-canvas-exit]').click();await s.page.waitForTimeout(180);
    assert.equal((await camera(s)).index,before.index);assert.equal((await camera(s)).canvas,'false');assertSaved(s);
    return{mapIndex:before.index,nativeWheel:{before:scrollBefore,after:scrollAfter},rightDragSeparate:true,returned:true};
  });
  await check('native annotation pin hover uses live marker footprint without resource leakage',async()=>{
    const s=await scene({resources:'hide',image:false});
    const pin=s.page.locator('[data-annotation-pin-id="layer-pin"]');await pin.waitFor();
    const p=await pin.evaluate(n=>{const b=n.getBoundingClientRect(),x=b.left+b.width/2,y=b.top+b.height/2;return{x,y,nativePin:Boolean(document.elementFromPoint(x,y)?.closest('[data-annotation-pin-id]'))};});
    assert.equal(p.nativePin,true);await open(s,p);
    const rows=await readout(menu(s.page));assert.equal(rows.resources.length,0);assert.ok(rows.annotations.some(x=>x.id==='layer-pin'));
    await menu(s.page).locator('[data-map-layer-toggle]').click();await close(s);await s.page.mouse.move(p.x+1,p.y);
    await card(s.page).waitFor();const hover=await readout(card(s.page));assert.ok(hover.annotations.some(x=>x.id==='layer-pin'));assert.equal(hover.resources.length,0);assertSaved(s);return{nativeHit:p,hover};
  });
  await check('master annotation Hide and resource Hide use only visible projected layers',async()=>{
    const hidden=await scene({annotations:'hide'});await open(hidden,await resourceHit(hidden));const rows=await readout(menu(hidden.page));assert.equal(rows.areas.length,0);assert.equal(rows.annotations.length,0);assert.equal(rows.resources.length,2);await close(hidden);assertSaved(hidden);
    const resources=await scene({resources:'hide'});await open(resources,await mapPoint(resources));const other=await readout(menu(resources.page));assert.equal(other.resources.length,0);assert.ok(other.areas.some(x=>x.id==='layer-rhs'));assertSaved(resources);
    const oneHidden=await scene({hiddenPlaces:['personal:91261'],image:false});await open(oneHidden,await mapPoint(oneHidden));const itemHidden=await readout(menu(oneHidden.page));assert.equal(itemHidden.resources.length,0,'Hidden co-located place leaked resource names');assertSaved(oneHidden);return{allAnnotationsHidden:rows,resourcePinsHidden:other,individualPlaceHidden:itemHidden};
  });
  await check('long frozen list native wheel and keyboard remain usable in a narrow viewport',async()=>{
    const s=await scene({width:390,height:500,extraAreas:32});await open(s,await resourceHit(s));const region=menu(s.page).locator('[data-map-layer-scroll]');
    const rect=await menu(s.page).boundingBox();assert.ok(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=390&&rect.y+rect.height<=500,'Menu is clipped outside narrow viewport');
    const b=await region.boundingBox();assert.ok(b.height>20);await s.page.mouse.move(b.x+b.width*.5,b.y+b.height*.5);await s.page.mouse.wheel(0,330);
    await until(async()=>await region.evaluate(n=>n.scrollTop)>0,'Layer list native wheel did not scroll');assert.equal(await menu(s.page).count(),1);
    await region.focus();const before=await region.evaluate(n=>n.scrollTop);await s.page.keyboard.press('ArrowDown');await s.page.waitForTimeout(150);assert.equal(await region.evaluate(n=>n===document.activeElement),true);const after=await region.evaluate(n=>n.scrollTop);assert.ok(after>before,'Native ArrowDown must scroll the focused readout');
    await s.page.screenshot({path:path.join(out,'inspector-narrow-long-list.png')});await menu(s.page).locator('[data-map-layer-toggle]').click();await close(s);
    const point=await resourceHit(s);await s.page.mouse.move(point.x+1,point.y);await card(s.page).waitFor();const passive=await passiveLayout(s);assertPassiveLayout(passive);assert.ok(passive.footerText.includes('40'));await s.page.screenshot({path:path.join(out,'inspector-narrow-passive-footer.png')});assertSaved(s);return{menuRect:rect,listBefore:before,listAfter:after,nativeListScroll:true,nativeArrowScroll:true,passiveLayout:passive};
  });
  await check('real serialized scoped DTOs expose only mapped permitted resources and no raw-asset fallback',async()=>{
    const fixturePath=name=>new URL('../fixtures/care-map-area-resources/server-dto/'+name+'.json',import.meta.url);
    const selected=JSON.parse(await fs.readFile(fixturePath('owner-selected'),'utf8'));
    const unavailable=JSON.parse(await fs.readFile(fixturePath('owner-unavailable'),'utf8'));
    const admitted=await scene({directory:selected,image:false});await open(admitted,await resourceHit(admitted));
    const rows=await readout(menu(admitted.page));assert.equal(rows.resources.length,1);
    assert.ok(!JSON.stringify(rows.resources).includes('82103'),'Outside venue leaked through scope');await close(admitted);assertSaved(admitted);
    const withdrawn=await scene({directory:unavailable,image:false});await open(withdrawn,await mapPoint(withdrawn));
    const empty=await readout(menu(withdrawn.page));assert.equal(empty.resources.length,0,'Unavailable scoped venue leaked from raw asset');assertSaved(withdrawn);
    return{source:'Unchanged real-controller fictional serialized DTOs; only route map ID adapted',selected:rows.resources,unavailable:empty.resources};
  });
  await check('pending SPA map route clears prior anchors and owner-inspection state before the next response',async()=>{
    const s=await scene(),p=await resourceHit(s);await open(s,p);await menu(s.page).locator('[data-map-layer-toggle]').click();await close(s);await open(s,p);
    let held=0;await s.page.route('**/api/my-maps/91261013',async route=>{held++;await new Promise(resolve=>s.releaseRoute=resolve);await route.abort().catch(()=>{});});
    await s.page.evaluate(()=>{history.pushState({},'', '/my-directory/maps/91261013');dispatchEvent(new PopStateEvent('popstate'));});
    await until(async()=>held>0,'New map request not held');
    await until(async()=>await menu(s.page).count()===0&&await card(s.page).count()===0,'Old route inspection anchor survived pending map change');
    assert.equal(await s.page.locator('[data-map-layer-toggle]').count(),0);assertSaved(s);
    return{newRouteRequestHeld:held,oldMenu:0,oldPointerCard:0,savedWrites:0,pendingResponseNotReleased:true};
  });
  await check('non-owner map has no editing menu or layer inspector controls',async()=>{
    const s=await scene({owner:false});await s.page.mouse.click((await mapPoint(s)).x,(await mapPoint(s)).y,{button:'right'});await s.page.waitForTimeout(150);assert.equal(await menu(s.page).count(),0);assert.equal(await card(s.page).count(),0);assert.equal(await s.page.locator('[data-map-layer-toggle]').count(),0);assertSaved(s);return{owner:false,menus:0,cards:0};
  });
  for(const s of scenes){assertSaved(s);assert.deepEqual(s.state.errors,[]);}
  report.errors=[];report.unexpectedWrites=[];report.allowedWrites=[];
}catch(error){report.failure=error.stack;process.exitCode=1;if(current?.page){report.failureState=await camera(current).catch(()=>null);await current.page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});await fs.writeFile(path.join(out,'failure-dom.txt'),await current.page.locator('body').innerText()).catch(()=>{});}}
finally{
  report.errors=scenes.flatMap(s=>s.state.errors);report.unexpectedWrites=scenes.flatMap(s=>s.state.unexpectedWrites);report.allowedWrites=scenes.flatMap(s=>s.state.allowedWrites);
  if(diagnosticTransformPath){report.diagnosticTransform.afterSha256=createHash('sha256').update(await fs.readFile(diagnosticTransformPath)).digest('hex');assert.equal(report.diagnosticTransform.sha256,report.diagnosticTransform.afterSha256);}
  report.sourceAfter=await fingerprint();report.extraObserverAfter=await extraObserverFingerprint();report.extraObserverUnchanged=JSON.stringify(report.extraObserverBefore)===JSON.stringify(report.extraObserverAfter);report.sourceUnchanged=JSON.stringify(report.sourceBefore)===JSON.stringify(report.sourceAfter)&&report.extraObserverUnchanged;
  if(!report.sourceUnchanged){report.failure||='Source changed during focused checks';process.exitCode=1;}
  report.summary={passed:report.cases.filter(x=>x.passed).length,failed:report.cases.filter(x=>!x.passed).length};
  await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  await browser?.close();await fixture?.server.close();
  console.log(JSON.stringify({out,summary:report.summary,sourceUnchanged:report.sourceUnchanged,failure:report.failure,cases:report.cases},null,2));
}
