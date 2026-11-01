// Portable actual-App restoration check. Fictional APIs/pixels only; no production credentials.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { createServer } from 'vite';
const arg = name => process.argv.find(v => v.startsWith(`--${name}=`))?.slice(name.length + 3);
const repo=arg('repo') || fileURLToPath(new URL('../../', import.meta.url));
const baseline='2361d3c94238c2dd57da0c501dad426fafb24635';
execFileSync('git',['cat-file','-e',baseline+'^{commit}'],{cwd:repo,stdio:'ignore'});
const {createMapStudioDocument}=await import(pathToFileURL(path.join(repo,'client/src/lib/mapStudioState.js')));
const out=arg('out') || await fs.mkdtemp(path.join(os.tmpdir(),'carearound-original-ui-'));
await fs.mkdir(out,{recursive:true});
const experiment=arg('experiment');
assert.ok(experiment===undefined || experiment==='false','Only production-default absent/false profiles are allowed');
const report={boundary:'Actual App/router/providers with intercepted fictional APIs/resources and synthetic map pixels. Historical2361 client source loaded directly from Git objects in a test-only Vite loader; no old checkout, production data or physical-device proof.',profile:{commonExperiment:experiment??'absent/undefined',legacyOwnerFlag:arg('owner-flag')??'absent/source-default',productionDefaultProof:true},baseline,cases:[],errors:[],unexpectedWrites:[],expectedDraftSaveAttempts:[],screenshots:[],comparisons:[]};
let base;
const sha=v=>createHash('sha256').update(v).digest('hex');
const files=['client/src/lib/mapPresentationPolicy.js','client/src/lib/ownerMapWorkspace.js','client/src/pages/DiscoverPage.jsx','client/src/pages/MyMapDetailPage.jsx','client/src/components/SharedMapDirectoryList.jsx','client/src/components/MyMapV2PreviewScaffold.jsx','client/src/components/MapStudioViewsPanel.jsx','client/src/features/discover/DiscoveryFilterPanel.jsx','client/src/features/discover/DiscoveryPinLayerControl.jsx','client/src/features/discover/DiscoveryResultsList.jsx','client/src/components/DirectoryMap.jsx','client/src/components/DirectoryMapRequestedScaleSync.jsx','client/src/components/DirectoryPrintView.jsx','client/src/lib/fixedTownZoomRecovery.js','client/src/lib/printMapState.js'];
async function sourceSnapshot(){return {head:execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),files:Object.fromEntries(await Promise.all(files.map(async f=>[f,sha(await fs.readFile(path.join(repo,f)))]))),harnessSha256:sha(await fs.readFile(fileURLToPath(import.meta.url))) };}
report.sourceBefore=await sourceSnapshot();
const port=Number(arg('port')||4491),servers=[],baselineCache=new Map();
for(const historical of [true,false]) {
 const sourceCache=historical?baselineCache:new Map();
 const server=await createServer({configFile:path.join(repo,'tests/fixtures/care-map-view-controls/vite.config.mjs'),root:path.join(repo,'client'),cacheDir:path.join(out,historical?'baseline-vite-cache':'rollback-vite-cache'),server:{host:'127.0.0.1',port:port+(historical?0:1),strictPort:true,fs:{allow:[repo,out]}},plugins:[{name:'qa-immutable-baseline-client',enforce:'pre',load(id){const file=id.split('?')[0];if(!historical||!file.startsWith(path.join(repo,'client/src')+path.sep))return null;const rel=path.relative(repo,file).split(path.sep).join('/');if(!/\.(?:jsx?|tsx?|css|json)$/.test(rel))return null;if(!sourceCache.has(rel)){try{sourceCache.set(rel,execFileSync('git',['show',`${baseline}:${rel}`],{cwd:repo,encoding:'utf8',stdio:['ignore','pipe','ignore']}));}catch{throw Error('Cannot load immutable baseline client file '+rel);}}return sourceCache.get(rel);}}],define:{'import.meta.env.VITE_MAP_FIRST_EXPERIMENT_ENABLED':experiment===undefined?'undefined':JSON.stringify(experiment),'import.meta.env.VITE_OWNER_MAP_WORKSPACE_ENABLED':arg('owner-flag')===undefined?'undefined':JSON.stringify(arg('owner-flag')),'import.meta.env.VITE_API_URL':'"/api"','import.meta.env.VITE_SUPPORT_INBOX_ENABLED':'"true"','import.meta.env.VITE_TOWN_MAP_PROOF_ENABLED':'"true"','import.meta.env.VITE_TOWN_MAP_ZOOM14_OVERVIEW_ENABLED':'"true"',...Object.fromEntries([['ASSET_BASE_URL','v2/native-scale-20260722/default'],['GRAY_ASSET_BASE_URL','v2/native-scale-20260722/gray'],['OVERVIEW_ASSET_BASE_URL','v3/zoom14-atlas-20260730/default'],['GRAY_OVERVIEW_ASSET_BASE_URL','v3/zoom14-atlas-20260730/gray']].map(([key,value])=>[`import.meta.env.VITE_TOWN_MAP_${key}`,JSON.stringify(`/__carearound-town-maps/${value}`)]))}});
 await server.listen();servers.push(server);
}
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64');
const asset = { id: 82001, name: 'Fictional Alpha Centre', category: 'Fixture support', subCategory: 'Fixture centre', type: 'hard', resourceType: 'hard', resourceId: 82001, status: 'active', visibility: 'public', address: 'Fictional address', postalCode: '680001', lat: 1.38, lng: 103.75 };
const secondAsset = { ...asset, id: 82002, resourceId: 82002, name: 'Fictional Beta Centre', subCategory: 'Fixture outreach', postalCode: '680002', address: 'Fictional Beta address', lat: 1.381, lng: 103.751 };
const resources = [asset, secondAsset, ...Array.from({ length: 28 }, (_, index) => ({ ...secondAsset, id: 82003 + index, resourceId: 82003 + index, name: `Fictional support resource ${index + 3}` }))];
const mapId = 91261012;
const documentFor = (gray = false) => {
  const value = createMapStudioDocument();
  value.revision = 1;
  value.views[0].revision = 1;
  value.views[0].design.camera = { mode: 'fixed', view: { center: [1.38, 103.75], zoom: 16 } };
  value.views[0].design.layout.preset = 'balanced';
  if (gray) value.views[0].design.basemap.style = 'gray';
  return value;
};
function directoryFor(kind = 'mixed', shared = false) {
  const makeRow = (id, mapped) => ({ rowKey: `personal:${id}`, assetKey: `personal:${id}`, resourceType: 'personal', resourceId: id, personalPlaceId: id, name: mapped ? 'Fictional mapped resource' : 'Fictional list-only resource', personalPlaceCategory: 'home', subCategory: 'Personal place', address: 'Fictional address', lat: mapped ? 1.38 : null, lng: mapped ? 103.75 : null, isPersonalPlace: true, saveEligible: false, status: 'active', mapShortDescriptors: [], notes: [{ id: `note-${id}`, text: 'Fictional stored owner note', isShared: false }] });
  const rows = kind === 'empty' ? [] : kind === 'list-only' ? [makeRow(91262, false)] : kind === 'mapped' ? [makeRow(91261, true)] : [makeRow(91261, true), { ...makeRow(91264, true), name: 'Fictional second mapped resource', lat: 1.3802, lng: 103.7502 }, { ...makeRow(91265, true), name: 'Fictional third mapped resource', lat: 1.3804, lng: 103.7504 }, makeRow(91262, false)];
  if(kind==='mixed') rows.splice(3,0,...Array.from({length:15},(_,index)=>({...makeRow(91300+index,true),name:`Fictional extra mapped resource ${index+1}`,lat:1.38+index*.00005,lng:103.75+index*.00005})));
  const mapped = rows.filter(row => Number.isFinite(row.lat));
  const directory = { id: mapId, name: 'Fictional Care Map', description: 'Entry-state regression fixture', categoryOrder: [], summary: { resourceCount: rows.length, savedResourceCount: 0, personalPlaceCount: rows.length, placeCount: rows.length, mappablePlaceCount: mapped.length }, share: { isShared: shared, shareToken: shared ? 'fictional-map-first' : null, embedEnabled: false, embedAllowedOrigins: [] }, assets: [], personalPlaces: rows.map(row => ({ ...row, shortDescription: '', shortDescriptors: [] })), places: rows.map(row => ({ pinKey: row.assetKey, placeKey: row.assetKey, title: row.name, name: row.name, address: row.address, lat: row.lat, lng: row.lng, hasCoordinates: Number.isFinite(row.lat), openProgrammeServiceCount: 0, rows: [row] })), pins: mapped.map(row => ({ pinKey: row.assetKey, placeKey: row.assetKey, title: row.name, lat: row.lat, lng: row.lng, curatedCount: 0, previewResourceNames: [] })), viewer: { isAuthenticated: !shared, isOwner: !shared, canSaveCopy: shared, canSaveResources: !shared } };
  if (kind === 'mixed') {
    const group = { rowKey:'soft-91263:group', assetKey:'soft-91263', resourceType:'soft', resourceId:91263, name:'Fictional list-only Group', subCategory:'Group', assetMode:'group', status:'list_only', mapFocusPlaceKeys:['personal:91261'], mapShortDescriptors:[] };
    directory.assets.push(group);
    directory.places[0].rows.push({ ...asset, rowKey: 'hard-82001:linked', assetKey: 'hard-82001', name: 'Fictional linked place resource', mapShortDescriptors: [] });
    directory.places.push({placeKey:'fallback-soft-91263',placeId:null,name:group.name,address:null,postalCode:'',lat:null,lng:null,hasCoordinates:false,rows:[group]});
    directory.summary.resourceCount++;
    directory.summary.savedResourceCount++;
    directory.summary.placeCount++;
  }
  return directory;
}
const metadata = Object.fromEntries(await Promise.all(['native-index', 'native-w01', 'overview-index', 'overview-sg14'].map(async key => [key, gunzipSync(await fs.readFile(path.join(repo, 'tests/fixtures/care-map-export-zoom', `${key}.json.gz`))).toString()])));
async function install(page, { owner = true, kind = 'mixed', shared = false, fontScale = 1, gray = false, saved = false } = {}) {
  const directory = directoryFor(kind, shared);
  page.on('pageerror', error => report.errors.push({ url: page.url(), message: error.message }));
  page.on('console', message => {if(message.type()==='error')(report.consoleErrors||=[]).push({url:page.url(),text:message.text()});});
  await page.addInitScript(scale => {
    localStorage.setItem('qa-original-ui-preserved', 'unchanged'); localStorage.setItem('carearound-map-first', 'true'); localStorage.setItem('mapFirstOpen', 'true'); localStorage.setItem('carearound-owner-workspace', 'split');
    window.__mapFirstMaps = new Set();
    window.__mapFirstEvents = [];
    window.__registerMapFirst = map => {
      if (window.__mapFirstMaps.has(map)) return;
      window.__mapFirstMaps.add(map);
      map.on('zoomstart zoomend movestart moveend resize', event => window.__mapFirstEvents.push({ type: event.type, id: map._leaflet_id, zoom: map.getZoom(), at: performance.now() }));
    };
    const apply = () => document.documentElement.style.setProperty('--font-scale', String(scale));
    if (document.documentElement) apply(); else addEventListener('DOMContentLoaded', apply, { once: true });
  }, fontScale);
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.pathname.startsWith('/__carearound-town-maps/')) {
      const overview = url.pathname.includes('zoom14-atlas');
      if (url.pathname.endsWith('.json')) {
        const index = !url.pathname.includes('/surfaces/');
        return route.fulfill({ body: metadata[overview ? index ? 'overview-index' : 'overview-sg14' : index ? 'native-index' : 'native-w01'], contentType: 'application/json' });
      }
      return route.fulfill({ body: pixel, contentType: 'image/png' });
    }
    if (url.pathname.startsWith('/api/')) {
      if (url.pathname === '/api/discovery/location-indicators' && request.method() === 'POST') return route.fulfill({ json: { indicators: {} } }); // Existing read-only POST lookup.
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
        const attempt = { method: request.method(), path: url.pathname };
        if (request.method() === 'PATCH' && new RegExp(`^/api/my-maps/${mapId}/(?:assets/(?:hard|soft)/[0-9]+|personal-places/[0-9]+)/notes$`).test(url.pathname)) {
          report.expectedDraftSaveAttempts.push(attempt);
          return route.fulfill({ status: 503, json: { error: 'Fictional save held to retain an unfinished draft.' } });
        }
        report.unexpectedWrites.push(attempt);
        return route.fulfill({ status: 409, json: { error: 'Unexpected fixture write.' } });
      }
      if (url.pathname === '/api/platform-access') return route.fulfill({ json: { settings: { publicDirectoryMode: 'open', publicRegistrationMode: 'open', publicLoginMode: 'open' } } });
      if (url.pathname.startsWith('/api/auth/')) return route.fulfill({ json: { user: owner ? { id: 91261, name: 'Fictional owner', role: 'standard', locale: 'en', postalCode: '680001' } : null } });
      if ((/^\/api\/my-maps\/\d+$/.test(url.pathname)) || url.pathname.endsWith('/shared-maps/fictional-map-first')) return route.fulfill({ json: { ...directory, id: /^\/api\/my-maps\/\d+$/.test(url.pathname) ? Number(url.pathname.split('/').pop()) : directory.id } });
      if (/^\/api\/my-maps\/\d+\/studio$/.test(url.pathname)) return route.fulfill({ json: { mapId, document: documentFor(gray), updatedAt: null } });
      if (/^\/api\/my-maps\/\d+\/print-annotations$/.test(url.pathname)) return route.fulfill({ json: { mapId, schemaVersion: 1, annotations: [], revision: 1 } });
      if (url.pathname === '/api/favorites') return route.fulfill({ json: saved ? [asset,secondAsset].map(item=>({...item,resourceType:'hard',resourceId:item.id})) : [] });
      if (url.pathname === '/api/hard-assets') return route.fulfill({ json: resources });
      if (url.pathname === '/api/sub-categories') return route.fulfill({ json: [{ id: 82001, name: 'Fixture centre', type: 'hard', color: '#0f766e' },{id:82002,name:'Fixture outreach',type:'hard',color:'#0369a1'}] });
      return route.fulfill({ json: [] });
    }
    if (url.origin === new URL(base).origin) return route.continue();
    if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ body: '', contentType: 'text/css' });
    if (/onemap\.gov\.sg|maps\.carearound\.sg/.test(url.hostname)) return route.fulfill({ body: pixel, contentType: 'image/png' });
    return route.abort();
  });
}

function visible(e){const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&!e.closest('[inert],[aria-hidden="true"]')&&r.bottom>0&&r.right>0&&r.left<innerWidth;}
async function metrics(page){return page.evaluate(()=>{
 const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&!e.closest('[inert],[aria-hidden="true"]')&&r.bottom>0&&r.right>0&&r.left<innerWidth;};
 const rect=e=>{const r=e.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)};};
 return {overflow:document.documentElement.scrollWidth-innerWidth,bodyOverflow:document.body.style.overflow,workspace:document.querySelectorAll('[data-map-first],[data-owner-workspace="split"],[data-map-first-enter]').length,ownerV2:document.querySelectorAll('[data-my-map-ui="v2"]').length,controller:document.querySelectorAll('[data-map-studio-owner-panel]').length,searches:[...document.querySelectorAll('input[type=search]')].filter(visible).map(rect),layers:[...document.querySelectorAll('[data-discovery-pin-layer-control]')].filter(visible).map(rect),maps:[...document.querySelectorAll('.leaflet-container')].filter(visible).map(rect),topRows:[...document.querySelectorAll('[data-map-studio-top-row]')].filter(visible).map(rect),savedOnly:[...document.querySelectorAll('label')].filter(e=>visible(e)&&/^saved only$/i.test(e.textContent.trim())).map(rect),usingHome:[...document.querySelectorAll('span')].filter(e=>visible(e)&&/^Using (?:your )?Home$/i.test(e.textContent.trim())).map(e=>rect(e.closest('div.rounded-2xl.border')||e.parentElement)),mapFirstLocationRows:document.querySelectorAll('[data-map-first-location-row],[data-map-first-card-grid]').length,headings:[...document.querySelectorAll('h1,h2,h3')].filter(visible).map(e=>e.innerText.trim()).filter(Boolean),preserved:localStorage.getItem('qa-original-ui-preserved')==='unchanged'};
 });}
async function settle(page,c){
 let ready;
 if(c.route.startsWith('/discover'))ready=page.getByText('Fictional Alpha Centre',{exact:true}).filter({visible:true}).first().waitFor();
 else if(c.shared)ready=page.getByRole('heading',{name:'Fictional Care Map',exact:true}).waitFor();
 else if(c.print)ready=page.getByRole('button',{name:'Save PDF',exact:true}).waitFor();
 else ready=(async()=>{await page.getByText('Fictional Care Map',{exact:true}).first().waitFor({state:'attached'});await page.locator('[data-map-studio-owner-panel]').first().waitFor({state:'attached'});if(!c.phone)await page.getByRole('button',{name:'Manage resources',exact:true}).waitFor();})();
 await Promise.race([ready,page.getByText('Something stopped this page from opening',{exact:true}).waitFor().then(()=>{throw Error('Application route error boundary rendered; inspect consoleErrors');})]);
 await page.waitForTimeout(650);
}
async function capture(page,label){const file=path.join(out,label+'.png');await page.screenshot({path:file,fullPage:false,animations:'disabled'});report.screenshots.push(file);}
function compare(label,old,now){
 assert.equal(now.workspace,0,'no automatic map-first/split/reentry UI');assert.ok(now.preserved,'unrelated stored marker is preserved');
 for(const k of ['ownerV2','controller','mapFirstLocationRows'])assert.equal(now[k],old[k],`${label}: original ${k}`);
 assert.ok(now.overflow<=old.overflow+2,`${label}: no added horizontal overflow`);
 for(const key of ['searches','layers','maps','topRows','savedOnly','usingHome']){assert.equal(now[key].length,old[key].length,`${label}: original ${key} count`);for(let i=0;i<old[key].length;i++)for(const n of ['x','y','width','height'])assert.ok(Math.abs(now[key][i][n]-old[key][i][n])<=4,`${label}: ${key}${i}.${n} changed: ${JSON.stringify({old:old[key],now:now[key]})}`);}
 for(const heading of old.headings)assert.ok(now.headings.includes(heading),`${label}: original visible heading ${heading}`);
 if(old.savedOnly.length&&old.usingHome.length){assert.ok(now.usingHome[0].y>=now.savedOnly[0].y+now.savedOnly[0].height-2,`${label}: Saved only and Using Home retain original separate rows`);}
 report.comparisons.push({case:label,baseline:old,restored:now,passed:true});
}
async function nativeAndStudio(page,c,phase){
 if(c.phone && !c.shared && !c.print && !c.route.startsWith('/discover') && c.kind==='mixed'){
  const button=page.locator('[data-mobile-map-actions]').getByRole('button',{name:'Full map',exact:true});await button.click();const full=page.locator('[data-mobile-full-map]');await full.waitFor({state:'visible'});assert.equal(await page.locator('[data-map-first],[data-owner-workspace="split"]').count(),0,'old native full map is used');
  await capture(page,`${phase}-${c.name}-native-fullscreen`);

  const exit=full.getByRole('button',{name:/return|back|exit|close.*map/i}).filter({visible:true}).first();
  if(await exit.count())await exit.click();else {await page.keyboard.press('Escape');}
  await full.waitFor({state:'hidden'});assert.equal(await page.locator('[data-map-first]').count(),0,'native return never enters new workspace');
 }
 if(!c.shared&&!c.print&&!c.route.startsWith('/discover')&&c.kind==='mixed'){
  if(c.phone){await page.getByRole('button',{name:'Open map controls',exact:true}).click();const drawer=page.getByRole('dialog').filter({visible:true}).first();await drawer.getByRole('button',{name:/Map Studio/}).first().click();await page.locator('[data-mobile-map-studio-panel]').waitFor({state:'visible'});}
  else {await page.getByRole('button',{name:'Edit layout',exact:true}).click();}
  const panel=page.locator('[data-map-studio-owner-panel]');assert.equal(await panel.count(),1,'one actual Studio controller');assert.ok(await panel.locator('select').first().isVisible(),'original Studio view controls reachable');await capture(page,`${phase}-${c.name}-studio`);
 }
}
const desktop={width:1728,height:1000},phone={width:390,height:844};
const cases=[
 {name:'desktop-discover-auth-stale',viewport:desktop,owner:true,saved:true,route:'/discover?workspace=split'},
 {name:'phone-discover-guest',viewport:phone,phone:true,owner:false,route:'/discover'},
 ...['v2','classic'].flatMap(mode=>['mixed','empty'].map(kind=>({name:`desktop-owner-${mode}-${kind}${kind==='mixed'?'-stale':''}`,viewport:desktop,owner:true,kind,route:`/my-directory/maps/${mapId}?${mode==='classic'?'ui=stable&':''}${kind==='mixed'?'workspace=split':'workspace=current'}`}))),
 ...['v2','classic'].map(mode=>({name:`phone-owner-${mode}-mixed`,viewport:phone,phone:true,owner:true,kind:'mixed',route:`/my-directory/maps/${mapId}${mode==='classic'?'?ui=stable':''}`})),
 {name:'desktop-shared-excluded',viewport:desktop,owner:false,shared:true,kind:'mixed',route:'/shared/maps/fictional-map-first?workspace=split'},
 {name:'desktop-print-excluded',viewport:desktop,owner:true,print:true,kind:'mixed',route:`/my-directory/maps/${mapId}?view=print&studioView=view-default&workspace=split`}
];
let browser;
try {
 browser=await chromium.launch({headless:true});
 for(const c of cases){if(arg('case')&&!c.name.includes(arg('case')))continue;const observations=[];let failed=false;
  for(let i=0;i<2;i++){const phase=i?'restored':'baseline';base=servers[i].resolvedUrls.local[0];const context=await browser.newContext({viewport:c.viewport,hasTouch:Boolean(c.phone),deviceScaleFactor:1,reducedMotion:'reduce'});const page=await context.newPage();page.setDefaultTimeout(12000);
   try{await install(page,c);await page.goto(new URL(c.route,base).href);await settle(page,c);const value=await metrics(page);assert.equal(value.workspace,0,`${phase}: original entry has no newer workspace`);observations.push(value);if(!c.shared&&!c.print)await capture(page,`${phase}-${c.name}`);await nativeAndStudio(page,c,phase);if(!c.phone&&!c.shared&&!c.print&&c.kind==='mixed'&&!c.route.startsWith('/discover')){const next=c.route.replace(String(mapId),String(mapId+1));const received=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/my-maps/${mapId+1}`);await page.evaluate(route=>{history.pushState({},'',route);dispatchEvent(new PopStateEvent('popstate'));},next);await received;await settle(page,c);assert.equal((await metrics(page)).workspace,0,'mapId reset cannot reopen map-first');}}
   catch(error){failed=true;report.cases.push({name:c.name,phase,passed:false,error:error.stack});await capture(page,`${phase}-${c.name}-FAILED`).catch(()=>{});console.error(c.name,phase,error.message);}
   finally{await context.close();}
  }
  if(!failed){try{compare(c.name,observations[0],observations[1]);report.cases.push({name:c.name,passed:true});}catch(error){report.cases.push({name:c.name,passed:false,error:error.stack});console.error(c.name,error.message);}}
 }
 report.source=await sourceSnapshot();report.sourceUnchanged=JSON.stringify(report.sourceBefore)===JSON.stringify(report.source);assert.ok(report.cases.length>0);assert.ok(report.sourceUnchanged,'runtime source/harness frozen during proof');assert.equal(report.errors.length,0,'no page errors');assert.equal((report.consoleErrors||[]).filter(e=>/Route failed to render|ReferenceError:|TypeError:/.test(e.text)).length,0,'no caught application render errors');assert.equal(report.unexpectedWrites.length,0,'no unexpected fictional writes');assert.equal(report.expectedDraftSaveAttempts.length,0,'no note writes from browse/fullscreen/Studio entry');assert.ok(report.cases.every(c=>c.passed),'all original-layout cases pass');report.passed=true;
}catch(error){report.failure=error.stack;process.exitCode=1;}
finally{report.baselineInputs=Object.fromEntries([...baselineCache].filter(([f])=>/DiscoverPage|MyMapDetailPage|SharedMapDirectoryList|MyMapV2PreviewScaffold|DiscoveryFilterPanel|DiscoveryResultsList|DiscoveryPinLayerControl/.test(f)).map(([f,v])=>[f,{sha256:sha(v),gitBlob:execFileSync('git',['rev-parse',`${baseline}:${f}`],{cwd:repo,encoding:'utf8'}).trim()}]));await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser?.close();for(const server of servers)await server.close();}
console.log(JSON.stringify({out,profile:report.profile,passed:report.passed||false,cases:report.cases.map(({name,phase,passed})=>({name,phase,passed})),errors:report.errors,consoleErrors:report.consoleErrors,unexpectedWrites:report.unexpectedWrites,failure:report.failure},null,2));
