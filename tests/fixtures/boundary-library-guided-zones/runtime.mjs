// Feature-local actual-App adapter. Fictional DTOs are UI proof, never SQL proof.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createServer } from 'vite';
import { createMapStudioDocument } from '../../../client/src/lib/mapStudioState.js';
import { canonicalizeBoundaryDrawing } from '../../../shared/boundaryDrawing.js';
export const repo = fileURLToPath(new URL('../../../', import.meta.url));
export const clone = structuredClone;
export const owner = { id:11, name:'Fictional boundary owner', role:'standard', locale:'en', hardAssetStaffAccess:[21,22,23].map(hardAssetId=>({hardAssetId,staffRole:'owner'})) };
export const places = [21,22,23,24].map((id,i)=>({id,name:`Fictional ${['Cedar','Birch','Unlocated','Unrelated Saved'][i]} Place`,category:'Community',subCategory:'Fictional centres',status:'active',visibility:'public',address:'Fictional address',postalCode:'001234',subregionId:1,lat:id===23?null:1.31+i*.01,lng:id===23?null:103.81+i*.01,resourceType:'hard',resourceId:id,_type:'hard',tags:[],locations:[]}));
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGO48OwDAAUwAqemVUSMAAAAAElFTkSuQmCC','base64');
export function libraryItem(id) { const drawing=canonicalizeBoundaryDrawing({type:'rectangle',name:`Frozen ${id}`,points:[[1.308,103.808],[1.313,103.814]]});return {id,revision:1,name:`Boundary ${String(id).padStart(3,'0')}`,groupName:id%2?'North':'South',drawing,type:drawing.type,pointCount:2}; }
export async function fingerprint() {
 const files=[...execFileSync('rg',['--files','--hidden','client/src','client/test','shared','server/src','server/test','server/drizzle','tests/fixtures','scripts'],{cwd:repo,encoding:'utf8'}).trim().split('\n'),'package.json','package-lock.json','client/package.json','server/package.json','client/tailwind.config.js'].filter(p=>!p.includes('/node_modules/')&&!p.split('/').some(s=>s.startsWith('.env'))).sort();
 return {head:execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),files:Object.fromEntries(await Promise.all(files.map(async p=>[p,createHash('sha256').update(await fs.readFile(path.join(repo,p))).digest('hex')])))};
}
export async function startFixture(out) {
 const baseline=process.env.BOUNDARY_TASK6_BASELINE==='1'?await fs.readFile(path.join(repo,'.superpowers/sdd/2026-11-07-boundary-library-guided-zones/task-5-baseline/client/src/App.jsx'),'utf8'):null;
 const server=await createServer({configFile:path.join(repo,'tests/fixtures/care-map-view-controls/vite.config.mjs'),root:path.join(repo,'tests/fixtures/caremap-spatial-tools'),envDir:path.join(repo,'tests/fixtures/boundary-library-guided-zones'),cacheDir:path.join(out,'vite-cache'),server:{host:'127.0.0.1',port:0,strictPort:false,fs:{allow:[repo]}},define:{'import.meta.env.VITE_API_URL':'"/api"','import.meta.env.VITE_GOOGLE_CLIENT_ID':'"fictional-boundary-client"','import.meta.env.VITE_TOWN_MAP_PROOF_ENABLED':'"false"'},plugins:[{name:'feature-local-provenance-banner',transformIndexHtml(html){return html.replace('z-index:99999','z-index:1100').replace('Local preview · fictional owner and CareAround resources · prepared address snapshot; coverage and freshness unverified · changes remain in this preview','Local acceptance · fictional data · no production');}},...(baseline?[{name:'captured-pre-task5-negative-control',enforce:'pre',transform(source,id){if(id.endsWith('/client/src/App.jsx'))return baseline;}}]:[])]});
 try {await server.listen();}catch(e){await server.close();throw e;}const base=server.resolvedUrls.local[0],origin=new URL(base).origin;
 const originalFetch=globalThis.fetch;
 globalThis.fetch=(input,options)=>{const u=new URL(typeof input==='string'?input:input.url);if(u.origin!==origin)throw new Error(`Node external request blocked: ${u.origin}`);return originalFetch(input,options);};
 async function install(context,{saved=true,libraryCount=55}={}) {
  const state={user:clone(owner),places:clone(places),favorites:clone(saved?[places[0],places[3]]:[places[3]]),library:Array.from({length:libraryCount},(_,i)=>libraryItem(i+1)),maps:new Map(),starters:new Map(),jobs:new Map(),zones:[],audit:[],unexpected:[],blocked:[],errors:[],console:[],holds:new Map(),modes:{},nextMap:101,nextJob:201};
  state.hold=(key)=>{let release;const promise=new Promise(r=>release=r);state.holds.set(key,promise);return()=>{state.holds.delete(key);release();};};
  const entries=new WeakMap();
  const json=(route,value,status=200)=>{const entry=entries.get(route.request());if(entry){entry.status=status;entry.outcome={state:value?.state,revision:value?.revision,mapId:value?.mapId,id:value?.id,code:value?.code,zoneIds:value?.rows?.filter(r=>r.zoneId).map(r=>r.zoneId)};}return route.fulfill({json:clone(value),status});};
  context.on('page',page=>{page.on('pageerror',e=>state.errors.push(e.message));page.on('console',message=>{if(['error','warning','warn'].includes(message.type()))state.console.push({type:message.type(),text:message.text(),location:message.location()});});});
  await context.routeWebSocket('**/*',socket=>{const u=new URL(socket.url());if(u.host===new URL(origin).host)socket.connectToServer();else{state.blocked.push({method:'WS',url:u.origin+u.pathname});socket.close();}});
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url()),method=req.method(),p=u.pathname;
   if(u.origin!==origin){
    if(u.hostname==='fonts.googleapis.com')return route.fulfill({body:'',contentType:'text/css'});
    if(u.hostname==='accounts.google.com')return route.fulfill({body:'',contentType:'text/javascript'});
    if(/(?:^|\.)(?:onemap\.gov\.sg|maps\.carearound\.sg|tile\.openstreetmap\.org)$/.test(u.hostname))return route.fulfill({body:pixel,contentType:'image/png'});
    state.blocked.push({method,url:u.origin+p});return route.abort();
   }
   if(!p.startsWith('/api/'))return route.continue();
   const body=req.postData()?req.postDataJSON():null,entry={sequence:state.audit.length+1,method,path:p,query:u.search,body,owner:state.user?.id};state.audit.push(entry);entries.set(req,entry);
   if(state.audit.length>1200 || state.audit.filter(x=>!['GET','HEAD','OPTIONS'].includes(x.method)).length>100)throw new Error('Fictional journey request/write budget exceeded');
   const key=method+' '+p;
   if(state.holds.has(key))await state.holds.get(key);
   if(method==='GET'){
    if(p==='/api/auth/me')return json(route,{user:state.user});
    if(p==='/api/platform-access')return json(route,{settings:{publicDirectoryMode:'open',publicRegistrationMode:'open',publicLoginMode:'open'}});
    if(p==='/api/favorites')return json(route,state.favorites);
    if(p==='/api/hard-assets')return json(route,state.places);
    if(/^\/api\/hard-assets\/\d+$/.test(p))return json(route,state.places.find(x=>x.id===Number(p.split('/').pop())));
    if(p==='/api/audience-zones')return json(route,state.zones);
    if(p==='/api/sub-categories')return json(route,[{id:1,type:'hard',name:'Fictional centres',color:'#0f766e'},{id:2,type:'soft',name:'Fictional class',color:'#0f766e'}]);
    if(p==='/api/boundary-layers')return json(route,{regions:[],subregions:[],unmappedPostalCodes:[]});
    if(p==='/api/subregions')return json(route,[{id:1,name:'Fictional subregion',subregionCode:'FX',postalCodeCount:1,postalCodesList:['001234']}]);
    if(p==='/api/soft-assets')return json(route,state.offering?[state.offering]:[]);
    if(p==='/api/soft-assets/88'&&state.offering)return json(route,state.offering);
    if(['/api/soft-asset-parents','/api/regions','/api/tags','/api/personal-places','/api/personal-places/categories','/api/governed-maps/notifications','/api/organizations','/api/partners'].includes(p))return json(route,[]);
    if(p==='/api/my-maps')return json(route,[...state.maps.values()].map(x=>x.directory));
    if(p==='/api/boundary-library'){let a=state.library.filter(x=>(!u.searchParams.get('search')||x.name.toLowerCase().includes(u.searchParams.get('search').toLowerCase()))&&(!u.searchParams.get('group')||x.groupName===u.searchParams.get('group')));const offset=Number(u.searchParams.get('cursor')||0),limit=Math.min(50,Number(u.searchParams.get('limit')||50));return json(route,{items:a.slice(offset,offset+limit),nextCursor:offset+limit<a.length?String(offset+limit):null});}
    if(/^\/api\/boundary-library\/\d+$/.test(p))return json(route,state.library.find(x=>x.id===Number(p.split('/').pop())));
    if(p.startsWith('/api/boundary-zone-workflows/map/')){const s=state.starters.get(p.split('/').pop());return s?(state.maps.has(s.mapId)?json(route,s):json(route,{error:'Saved Care Map no longer exists',code:'BOUNDARY_ZONE_MAP_UNAVAILABLE'},409)):json(route,{error:'Request not found',code:'BOUNDARY_REQUEST_NOT_FOUND'},404);}
    if(p==='/api/boundary-zone-jobs')return json(route,{items:[...state.jobs.values()].map(j=>({...j,rowCount:j.rows.length,createdCount:j.rows.filter(r=>r.zoneId).length})),nextCursor:null});
    const jm=p.match(/^\/api\/boundary-zone-jobs\/(\d+)(?:\/rows\/([^/]+)\/source)?$/);
    if(jm){const j=state.jobs.get(Number(jm[1]));if(jm[2]){if(state.modes.sourceError)return json(route,{error:'Frozen B unavailable'},503);return json(route,j.frozen[jm[2]]);}return json(route,j);}
    const mm=p.match(/^\/api\/my-maps\/(\d+)(?:\/(studio|print-annotations))?$/);
    if(mm){const m=state.maps.get(Number(mm[1]));if(!m)return json(route,{error:'Map unavailable'},404);return json(route,mm[2]==='studio'?{mapId:Number(mm[1]),document:m.studio,updatedAt:null}:mm[2]==='print-annotations'?{mapId:Number(mm[1]),schemaVersion:1,serverCapabilities:{maxCount:200,groups:true,exactBoundaryGeometry:true},revision:m.revision,annotations:state.modes.stripAck?[]:m.annotations}:m.directory);}
   }
   if(method==='POST'&&p==='/api/auth/logout'){state.user=null;return json(route,{success:true});}
   if(method==='POST'&&p==='/api/favorites/save'){const a=state.places.find(x=>x.id===body.resourceId);if(!state.favorites.some(x=>x.id===a.id))state.favorites.push(a);return json(route,{saved:true});}
   if(method==='POST'&&p==='/api/boundary-library'){
    const m=state.maps.get(body.source.mapId),annotation=m?.annotations.find(x=>x.id===body.source.annotationId);
    if(!annotation||m.revision!==body.source.revision)return json(route,{error:'Saved boundary changed',code:'BOUNDARY_SOURCE_STALE'},409);
    const item={id:state.library.length+1,revision:1,name:body.name,groupName:body.groupName,drawing:canonicalizeBoundaryDrawing(annotation),pointCount:annotation.points.length};state.library.push(item);return json(route,{item},201);
   }
   const cancelStarter=p.match(/^\/api\/boundary-zone-workflows\/map\/([^/]+)\/cancel$/);
   if(method==='POST'&&cancelStarter){const s=state.starters.get(cancelStarter[1]);if(!s)return json(route,{code:'BOUNDARY_REQUEST_NOT_FOUND'},404);s.guidanceCancelled=true;return json(route,s);}
   if(method==='POST'&&p==='/api/boundary-zone-workflows/map'){
    entry.pointer=await req.frame().evaluate(()=>history.state?.usr).catch(()=>null);
    if(state.modes.abortStarterBeforeWrite){entry.expectedAbort=true;return route.abort('failed');}
    if(state.modes.starterConflict)return json(route,{error:'Changed-payload conflict for original request',code:'BOUNDARY_REQUEST_CONFLICT'},409);
    const old=state.starters.get(body.requestId);if(old)return json(route,old);
    const a=state.places.find(x=>x.id===body.hardAssetId);
    if(!state.favorites.some(x=>x.id===a.id))return json(route,{error:'Save this Place first',code:'BOUNDARY_ZONE_PLACE_NOT_SAVED'},409);
    if(a.lat===null)return json(route,{error:'Place location required',code:'BOUNDARY_ZONE_PLACE_LOCATION_REQUIRED'},422);
    const id=state.nextMap++,row={...a,rowKey:`hard-${a.id}`,assetKey:`hard-${a.id}`,mapShortDescriptors:[]},place={...a,pinKey:`hard-${a.id}`,placeKey:`hard-${a.id}`,title:a.name,hasCoordinates:true,rows:[row]};
    const directory={id,name:a.name,description:'',categoryOrder:[],assets:[row],personalPlaces:[],places:[place],pins:[place],share:{isShared:false,embedEnabled:false,shareToken:null},summary:{resourceCount:1,savedResourceCount:1,personalPlaceCount:0,placeCount:1,mappablePlaceCount:1},viewer:{isAuthenticated:true,isOwner:true,canSaveResources:true}};
    const studio=createMapStudioDocument();studio.revision=1;studio.views[0].revision=1;
    state.maps.set(id,{directory,studio,revision:0,annotations:[]});const s={requestId:body.requestId,hardAssetId:a.id,mapId:id,name:a.name,state:'ready',outcomeHash:'a'.repeat(64)};state.starters.set(body.requestId,s);
    if(state.modes.lostStarter){entry.expectedAbort=true;return route.abort('failed');}return json(route,s);
   }
   if(method==='PUT'&&/^\/api\/hard-assets\/(21|22|23)$/.test(p)){const a=state.places.find(x=>x.id===Number(p.split('/').pop()));Object.assign(a,body);return json(route,a);}
   const annotations=p.match(/^\/api\/my-maps\/(\d+)\/print-annotations$/);
   if(method==='PUT'&&annotations){const m=state.maps.get(Number(annotations[1]));if(state.modes.failSave)return json(route,{error:'Fictional save failed'},503);if(body.revision!==m.revision)return json(route,{error:'Revision conflict'},409);m.annotations=clone(body.annotations);m.revision++;entry.ids=m.annotations.map(a=>a.id);if(state.modes.lostSave){state.modes.lostSave=false;{entry.expectedAbort=true;return route.abort('failed');}}return json(route,{mapId:Number(annotations[1]),schemaVersion:1,serverCapabilities:{maxCount:200,groups:true,exactBoundaryGeometry:true},annotations:m.annotations,revision:m.revision});}
   if(method==='POST'&&p==='/api/boundary-zone-jobs'){
    const old=[...state.jobs.values()].find(j=>j.requestId===body.requestId);if(old)return json(route,old,202);
    const frozen=Object.fromEntries(body.rows.map(r=>{const item=r.source.libraryId?state.library.find(x=>x.id===r.source.libraryId):{drawing:canonicalizeBoundaryDrawing(state.maps.get(r.source.mapId).annotations.find(a=>a.id===r.source.annotationId))};return[r.rowKey,{rowKey:r.rowKey,drawing:clone(item.drawing),source:{...r.source,...(r.source.libraryId?{displayName:item.name}:{})},pointCount:2}];}));
    const j={id:state.nextJob++,requestId:body.requestId,state:'preparing',revision:1,snapshotSha256:'a'.repeat(64),manifestSha256:'b'.repeat(64),rows:body.rows.map(r=>({...r,status:'pending',postalCount:0,zoneId:null,libraryId:null})),frozen};state.jobs.set(j.id,j);return json(route,j,202);
   }
   const action=p.match(/^\/api\/boundary-zone-jobs\/(\d+)\/(advance|commit|pause|resume|cancel)$/);
   if(method==='POST'&&action){const j=state.jobs.get(Number(action[1]));if(state.modes.advanceConflict&&action[2]==='advance'){state.modes.advanceConflict=false;return json(route,{error:'Expired fictional lease',code:'BOUNDARY_JOB_CONFLICT'},409);}if(body.expectedRevision!==j.revision)return json(route,{error:'Revision changed',code:'BOUNDARY_JOB_CONFLICT'},409);j.revision++;
    if(action[2]==='advance'){if(j.state==='preparing'){j.state='ready';j.rows.forEach((r,i)=>{r.postalCount=state.modes.allEmpty||(state.modes.mixed&&i===1)?0:2;r.status=r.postalCount?'ready':'empty';});}else if(j.state==='committing'){const partial=state.modes.holdSecondRow && !j.rows.some(r=>r.zoneId);j.state=partial?'committing':'complete';
     if(partial)state.releaseSecondRow=state.hold('POST /api/boundary-zone-jobs/'+j.id+'/advance');
     j.rows.forEach((r,i)=>{if(r.status==='ready'&&(!partial||i===0)){if(state.modes.mixed&&i===2){r.status='failed';r.errorCode='BOUNDARY_ZONE_CODE_CONFLICT';}else{r.zoneId=state.zones.length+301;r.status='created';state.zones.push({...r,id:r.zoneId,postalCodeCount:r.postalCount,sharingStatus:'local'});}}});}}
    else if(action[2]==='commit'){j.state='committing';j.commitRequestId=body.requestId;if(state.modes.lostCommit){state.modes.lostCommit=false;{entry.expectedAbort=true;return route.abort('failed');}}}
    else if(action[2]==='pause'){j.previousState=j.state;j.state='paused';}else if(action[2]==='resume')j.state=j.previousState||'preparing';else j.state='cancelled';return json(route,j);
   }
   state.unexpected.push(entry);return json(route,{error:`Unexpected fixture request ${key}`},501);
  });return state;
 }
 return {base,install,server,async close(){globalThis.fetch=originalFetch;await server.close();}};
}
