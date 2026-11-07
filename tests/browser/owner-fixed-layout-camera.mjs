// Actual App/Leaflet with the existing fictional transport and read-only identity
// observers. No camera/timer/event method wrappers or forced camera mutations.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {startFixture} from '../fixtures/care-map-floating-canvas/runtime.mjs';
const out=process.argv.find(x=>x.startsWith('--out='))?.slice(6);
assert.ok(out,'Explicit evidence directory required');
await fs.mkdir(out,{recursive:true});
const report={boundary:'Actual local App and Leaflet; fictional intercepted APIs; existing read-only identity/controlled-input observers, no diagnostic camera wrappers. Not device or production proof.',cases:[]};
const fixture=await startFixture(out);let browser;
async function until(fn,message){for(let i=0;i<200;i++){if(await fn())return;await new Promise(r=>setTimeout(r,40));}throw Error(message);}
async function camera(page){return page.evaluate(()=>{const m=[...window.__qaMaps].find(m=>m.getContainer().isConnected&&m._loaded);return m?{id:m._leaflet_id,zoom:m.getZoom(),center:[m.getCenter().lat,m.getCenter().lng],controlled:window.__qaControlledInputs.get(m),frame:{width:m.getContainer().clientWidth,height:m.getContainer().clientHeight}}:null;});}
async function settled(page){await page.waitForTimeout(1200);const samples=[];for(let i=0;i<4;i++){samples.push(await camera(page));await page.waitForTimeout(150);}return samples;}
function fixed(samples,view,id){for(const value of samples){assert.equal(value.id,id,'same mounted map');assert.equal(value.zoom,view.zoom,'saved fixed zoom must remain after all layout timers settle');assert.ok(Math.abs(value.center[0]-view.center[0])<.0001&&Math.abs(value.center[1]-view.center[1])<.0001,'fixed center retained');assert.equal(value.controlled?.zoom,view.zoom,'controlled exploration agrees with retained camera');}}
try{
 browser=await chromium.launch({headless:true});
 for(const ui of ['stable','v2'])for(const viewport of [{width:390,height:500},{width:1600,height:1100}]){
  const entry={name:`${ui} ${viewport.width}x${viewport.height} delayed hydration and layout`,passed:false,observations:[]};report.cases.push(entry);
  const page=await browser.newPage({viewport});const state=await fixture.install(page,{zoom:16,studioLoad:'hold',annotations:[]});
  state.document.views[0].design.layout.preset='balanced';
  state.document.views[1].design.camera.view={center:[1.382,103.752],zoom:16};
  state.document.views[1].design.layout.mapHeight='compact';state.document.views[1].design.layout.preset='balanced';state.document.views[1].design.layout.mapSide='right';
  const auto=structuredClone(state.document.views[0]);auto.id='fictional-auto-view';auto.name='Fictional automatic view';auto.design.camera={mode:'fit',view:null};state.document.views.push(auto);
  const original=JSON.stringify(state.document);
  try{
   await page.goto(`${fixture.base}my-directory/maps/${fixture.mapId}?ui=${ui}`);
   await until(()=>camera(page),'map mounted before Studio hydration');await until(()=>state.studioWaiters.length>0,'Studio response held');
   await page.waitForTimeout(600);const initial=await camera(page);entry.initial=initial;
   state.releaseStudio();
   const hydrated=await settled(page);entry.observations.push({phase:'hydrated',samples:hydrated});
   // Desktop legacy-to-Studio hydration can mount its existing layout branch.
   // This case locks continuity of the hydrated fixed-view map, not that transition.
   const mapId=viewport.width>=1024?hydrated[0].id:initial.id;entry.hydrationRemounted=mapId!==initial.id;
   fixed(hydrated,state.document.views[0].design.camera.view,mapId);
   // Native expansion/return and viewport resize exercise real height changes.
   await page.locator('[data-owner-canvas-enter]').click();const expanded=await settled(page);entry.observations.push({phase:'expanded',samples:expanded});fixed(expanded,state.document.views[0].design.camera.view,mapId);
   await page.locator('[data-owner-canvas-exit]').click();await page.setViewportSize({...viewport,height:viewport.height+80});const resized=await settled(page);entry.observations.push({phase:'returned-resized',samples:resized});fixed(resized,state.document.views[0].design.camera.view,mapId);
   await page.locator('[data-owner-canvas-enter]').click();await page.locator('[data-owner-canvas-context]').click();
   await page.locator('[data-map-studio-owner-panel] select').first().selectOption('fictional-second-view');
   const switched=await settled(page);entry.observations.push({phase:'fixed-view-layout-height-switch',samples:switched});fixed(switched,state.document.views[1].design.camera.view,mapId);
   const selector=page.locator('[data-map-studio-owner-panel] select').first();
   await selector.selectOption('fictional-auto-view');const automatic=await settled(page);entry.observations.push({phase:'automatic-layout-refit',samples:automatic});assert.ok(automatic.every(x=>x.id===mapId&&Math.abs(x.center[0]-state.document.views[1].design.camera.view.center[0])>.0001),'auto mode refits points away from the saved fixed center');
   await selector.selectOption('fictional-second-view');const restored=await settled(page);entry.observations.push({phase:'fixed-after-auto',samples:restored});fixed(restored,state.document.views[1].design.camera.view,mapId);
   // Supersede pending automatic resize work inside its 330ms settle interval.
   await selector.selectOption('fictional-auto-view');await selector.selectOption('fictional-second-view');const superseded=await settled(page);entry.observations.push({phase:'superseded-auto-timers',samples:superseded});fixed(superseded,state.document.views[1].design.camera.view,mapId);
   assert.equal(JSON.stringify(state.document),original,'no saved Studio changes');assert.deepEqual(state.allowedWrites,[]);assert.deepEqual(state.unexpectedWrites,[]);assert.deepEqual(state.errors,[]);entry.passed=true;
  }catch(error){entry.error=error.stack;entry.final=await camera(page);await page.screenshot({path:path.join(out,`${ui}-${viewport.width}-failure.png`)});}
  finally{state.releaseStudio();entry.writes=state.unexpectedWrites;entry.errors=state.errors;await page.close();}
 }
}finally{await browser?.close();await fixture.server.close();await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify(report.cases.map(({name,passed,error})=>({name,passed,error})),null,2));if(report.cases.some(x=>!x.passed))process.exitCode=1;
