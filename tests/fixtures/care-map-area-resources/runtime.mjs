// Fictional HTTP boundary for the actual-App within-area resource workflow.
// It verifies client intent; genuine controller tests own persistence/privacy proof.
import assert from 'node:assert/strict';
import {startFixture, fingerprint} from '../care-map-floating-canvas/runtime.mjs';
import {catalogueHard, catalogueSoft, annotations} from '../caremap-spatial-tools/fictional-api.mjs';
import {owner} from '../care-map-floating-canvas/data.mjs';
import {createWholeAreaFixture,wholeAreaAnnotation} from './whole-area-addresses.mjs';

export {fingerprint};
export const clone=value=>structuredClone(value);
export const keyFor=value=>`${value.resourceType}-${value.resourceId}`;
const typed=(value,type=value._type)=>({...clone(value),resourceType:type,resourceId:value.id,assetKey:`${type}-${value.id}`,status:'available'});
export const hard=[...catalogueHard.map(value=>typed(value)),...Array.from({length:3},(_,index)=>typed({...catalogueHard[1],id:82105+index,name:`Fictional unsaved nearby centre ${index+1}`}))];
export const soft=[typed(catalogueSoft[0]),typed(catalogueSoft[1]),typed({...catalogueSoft[0],id:82203,name:'Fictional existing all-venue programme'})];
export const existingAssets=[hard[0],soft[1],soft[2]];
export const snapshot={label:'Fictional bounded address snapshot',sha256:'a'.repeat(64)};

function projectDirectory(state){
 const groups=new Map(state.personalPlaces.map(place=>[place.assetKey,{pinKey:place.assetKey,placeKey:place.assetKey,title:place.name,name:place.name,address:place.address,lat:place.lat,lng:place.lng,hasCoordinates:true,openProgrammeServiceCount:0,rows:[clone(place)]}]));
 for(const asset of state.assets){
  const scope=asset.mapLocationScope;
  const locations=asset.resourceType==='hard'?[asset]:Array.isArray(asset.locations)?asset.locations:[];
  const selected=scope&&Array.isArray(scope.placeIds)?locations.filter(location=>scope.placeIds.includes(location.id)):locations;
  const projected=selected.length?selected:[null];
  for(const location of projected){
   const located=location&&Number.isFinite(location.lat)&&Number.isFinite(location.lng);
   const placeKey=located?`hard-${location.id}`:`unlocated-${asset.assetKey}`;
   let place=groups.get(placeKey);
   if(!place){place={pinKey:placeKey,placeKey,title:location?.name||asset.name,name:location?.name||asset.name,address:location?.address||'',postalCode:location?.postalCode||'',lat:located?location.lat:null,lng:located?location.lng:null,hasCoordinates:Boolean(located),openProgrammeServiceCount:0,rows:[]};groups.set(placeKey,place);}
   place.rows.push({...clone(asset),rowKey:asset.assetKey,placeKey,mapShortDescriptors:asset.mapShortDescriptors||[],notes:asset.notes||[]});
   if(asset.resourceType==='soft')place.openProgrammeServiceCount++;
  }
 }
 const places=[...groups.values()];
 return{...clone(state.baseDirectory),assets:clone(state.assets),places,pins:places.filter(place=>place.hasCoordinates).map(place=>({pinKey:place.pinKey,placeKey:place.placeKey,title:place.title,lat:place.lat,lng:place.lng,curatedCount:place.rows.length,previewResourceNames:place.rows.map(row=>row.name)})),summary:{resourceCount:state.assets.length+state.personalPlaces.length,savedResourceCount:state.assets.length,personalPlaceCount:state.personalPlaces.length,placeCount:places.length,mappablePlaceCount:places.filter(place=>place.hasCoordinates).length}};
}

export async function startAreaFixture(out){
 const fixture=await startFixture(out);
 async function install(page,{addressFailure=null,addressRowCount=0,failNextAdd=[],unknownNextAdd=[],holdNextAdd=[],failNextEnsure=[],conflictNextAdd=[],allowLegacyRemove=[],allShapes=false,holdCataloguePages=[],failCataloguePages=[],wholeAddressFixture=false,holdAddressPaths=[],ignoreAddressAbort=false}={}){
  const addressProvider=wholeAddressFixture?await createWholeAreaFixture():null;
  const core=await fixture.install(page,{annotations:addressProvider?[...annotations,wholeAreaAnnotation]:allShapes?annotations:[annotations[0]]});
  const state={core,baseDirectory:clone(core.directory),personalPlaces:clone(core.directory.personalPlaces),assets:clone(existingAssets),saved:clone([...existingAssets,hard[1]]),requests:[],writes:[],readQueries:[],pendingAdds:[],addressFailure,allowLegacyRemove:new Set(allowLegacyRemove),failNextAdd:new Set(failNextAdd),unknownNextAdd:new Set(unknownNextAdd),holdNextAdd:new Set(holdNextAdd),failNextEnsure:new Set(failNextEnsure),conflictNextAdd:new Set(conflictNextAdd)};
  if(addressProvider){
   state.addressProvider=addressProvider;
   state.addressVersion=0;state.addressRequests=[];state.pendingAddresses=[];
   state.holdAddressPaths=new Set(holdAddressPaths);state.failNextAddressPath=null;
   state.sessionUser=owner;state.sessionReads=0;
   state.releaseAddress=(request=state.pendingAddresses[0])=>{
    state.pendingAddresses=state.pendingAddresses.filter(item=>item!==request);
    request?.release();
   };
   await page.addInitScript(({ignoreAddressAbort})=>{
    const fetch=window.fetch;
    window.__qaAddressTransport=[];
    window.fetch=async(input,options)=>{
     const path=new URL(typeof input==='string'?input:input.url,location.href).pathname;
     if(!path.startsWith('/api/address-snapshot/'))return fetch.call(window,input,options);
     const observation={path,aborted:false,delivered:false};
     window.__qaAddressTransport.push(observation);
     options?.signal?.addEventListener('abort',()=>{observation.aborted=true;},{once:true});
     const response=await fetch.call(window,input,ignoreAddressAbort?{...options,signal:undefined}:options);
     const readJson=response.json.bind(response);
     response.json=async()=>{const value=await readJson();observation.delivered=true;return value;};
     return response;
    };
   },{ignoreAddressAbort});
  }
  state.directory=()=>projectDirectory(state);
  state.failMapReads=0;state.mapReadFailures=0;
  state.holdCataloguePages=new Set(holdCataloguePages);state.failCataloguePages=new Set(failCataloguePages);
  state.catalogueReads=[];state.catalogueAborts=[];state.pendingCatalogue=[];
  state.releaseCatalogue=(matches=()=>true)=>{const ready=state.pendingCatalogue.filter(matches);state.pendingCatalogue=state.pendingCatalogue.filter(item=>!matches(item));for(const item of ready)item.release();};
  page.on('requestfailed',request=>{const url=new URL(request.url());if(url.searchParams.get('scope')==='visible'&&['/api/hard-assets','/api/soft-assets'].includes(url.pathname))state.catalogueAborts.push({key:`${url.pathname.includes('hard-')?'hard':'soft'}:${url.searchParams.get('page')||1}`,failure:request.failure()?.errorText});});
  state.releaseAdds=()=>{for(const release of state.pendingAdds.splice(0))release();};
  const find=ref=>[...hard,...soft].find(asset=>keyFor(asset)===keyFor(ref));
  const paged=(rows,url)=>{const p=Math.max(1,Number(url.searchParams.get('page')||1)),pageSize=2;return{data:rows.slice((p-1)*pageSize,p*pageSize),pagination:{page:p,pageSize,totalCount:rows.length,totalPages:Math.ceil(rows.length/pageSize)}};};
  await page.route('**/api/**',async route=>{
   const request=route.request(),url=new URL(request.url()),method=request.method(),pathname=url.pathname;
   state.requests.push({method,path:pathname,search:url.search});
   if(method==='GET'&&pathname==='/api/my-maps')return route.fulfill({json:[{...clone(state.baseDirectory),resourceCount:state.assets.length+state.personalPlaces.length,updatedAt:'2026-11-06T00:00:00.000Z',createdAt:'2026-11-06T00:00:00.000Z'}]});
   if(method==='GET'&&pathname===`/api/my-maps/${fixture.mapId}`){if(state.failMapReads>0){state.failMapReads--;state.mapReadFailures++;return route.fulfill({status:503,json:{error:'Fictional map refresh failure. Retry this map.'}});}return route.fulfill({json:state.directory()});}
   if(method==='GET'&&['/api/hard-assets','/api/soft-assets'].includes(pathname)){
    const controlled=url.searchParams.get('scope')==='visible',key=`${pathname.includes('hard-')?'hard':'soft'}:${url.searchParams.get('page')||1}`;
    if(controlled){state.catalogueReads.push({key,search:url.search});if(state.holdCataloguePages.has(key))await new Promise(release=>state.pendingCatalogue.push({key,release}));
     if(state.failCataloguePages.delete(key))return route.fulfill({status:503,json:{error:'Controlled fictional catalogue page failure'}});}
    return route.fulfill({json:paged(pathname.includes('hard-')?hard:soft,url)}).catch(error=>{if(!controlled||!request.failure())throw error;});
   }
   if(method==='GET'&&pathname==='/api/favorites')return route.fulfill({json:clone(state.saved)});
   if(addressProvider&&method==='GET'&&pathname==='/api/auth/me'){
    state.sessionReads++;
    return route.fulfill({json:{user:state.sessionUser}});
   }
   if(addressProvider&&pathname.startsWith('/api/address-snapshot/')){
    const body=method==='POST'?request.postDataJSON():undefined;
    const entry={path:pathname,body};
    state.addressRequests.push(entry);
    if(state.holdAddressPaths.has(pathname))await new Promise(release=>state.pendingAddresses.push({entry,release}));
    if(state.failNextAddressPath===pathname){state.failNextAddressPath=null;return route.abort('failed');}
    const response=await addressProvider.request(state.addressVersion,method,pathname,body);
    const contentType=response.headers.get('content-type')||undefined;
    const payload=await response.text();
    const json=contentType?.startsWith('application/json')?JSON.parse(payload):{};
    entry.response={status:response.status,rows:json.rows?.length,progress:json.progress,code:json.code,limit:json.addressLimit};
    return route.fulfill({status:response.status,contentType,body:payload}).catch(error=>{if(!request.failure())throw error;});
   }
   if(method==='GET'&&pathname==='/api/address-snapshot/metadata')return route.fulfill({json:{ready:true,snapshot}});
   if(method==='POST'&&pathname==='/api/address-snapshot/area'){
    const body=request.postDataJSON();state.readQueries.push({path:pathname,body});
    if(state.addressFailure)return route.fulfill({status:state.addressFailure.status||422,json:state.addressFailure.body});
    const rows=Array.from({length:addressRowCount},(_,index)=>({id:`fictional-address-${index}`,postalCode:index<2?'012345':String(100000+index),block:String(index+1),roadName:'Fictional Preview Road',building:`Fictional building ${index+1}`,address:`${index+1} Fictional Preview Road`,lat:1.38,lng:103.75}));
    return route.fulfill({json:{snapshot,rows:rows.slice(body.offset||0,(body.offset||0)+(body.limit||200)),total:rows.length,offset:body.offset||0,limit:body.limit||200}});
   }
   if(method==='POST'&&pathname==='/api/favorites/save'){
    const body=request.postDataJSON(),key=keyFor(body),asset=find(body);state.writes.push({method,path:pathname,body:clone(body)});
    assert.ok(asset,'Only fictional visible catalogue references can be saved');
    if(state.failNextEnsure.delete(key))return route.fulfill({status:503,json:{error:'Fictional ensure-save failure'}});
    const alreadySaved=state.saved.some(item=>keyFor(item)===key);if(!alreadySaved)state.saved.push(clone(asset));
    return route.fulfill({json:{success:true,saved:true,alreadySaved,resourceType:body.resourceType,resourceId:body.resourceId}});
   }
   const removal=pathname.match(new RegExp(`^/api/my-maps/${fixture.mapId}/assets/(hard|soft)/(\\d+)$`));
   if(method==='DELETE'&&removal&&state.allowLegacyRemove.has(`${removal[1]}-${removal[2]}`)){
    const key=`${removal[1]}-${removal[2]}`;state.writes.push({method,path:pathname,explicitLegacyRemoval:key});state.assets=state.assets.filter(asset=>keyFor(asset)!==key);return route.fulfill({json:{success:true}});
   }
   if(method==='POST'&&pathname===`/api/my-maps/${fixture.mapId}/assets`){
    const body=request.postDataJSON(),key=keyFor(body),asset=find(body);state.writes.push({method,path:pathname,body:clone(body)});
    assert.ok(asset,'Only fictional visible catalogue references can be added');
    assert.ok(state.saved.some(item=>keyFor(item)===key),'Explicit ensure-save must precede map addition');
    if(state.holdNextAdd.delete(key))await new Promise(resolve=>state.pendingAdds.push(resolve));
    if(state.failNextAdd.delete(key))return route.fulfill({status:503,json:{error:'Fictional map-add failure'}});
    if(state.assets.some(item=>keyFor(item)===key))return route.fulfill({status:409,json:{error:'This asset is already in the map'}});
    if(state.conflictNextAdd.delete(key)){state.assets.push({...clone(asset),mapShortDescriptors:[],notes:[]});return route.fulfill({status:409,json:{error:'This asset is already in the map'}});}
    let scope=null;
    if(body.selectedPlaceIds!==undefined&&body.selectedPlaceIds!==null){
     const known=new Set((body.resourceType==='hard'?[asset]:asset.locations||[]).map(place=>place.id));
     assert.ok(Array.isArray(body.selectedPlaceIds)&&body.selectedPlaceIds.length>0&&body.selectedPlaceIds.length<=500);
     assert.ok(body.selectedPlaceIds.every(id=>Number.isSafeInteger(id)&&known.has(id)),'Map-local scope must use canonical known hard-place IDs');
     scope={version:1,placeIds:[...new Set(body.selectedPlaceIds)]};
    }
    const added={...clone(asset),...(scope?{mapLocationScope:scope}:{}),mapShortDescriptors:[],notes:[]};state.assets.push(added);
    if(state.unknownNextAdd.delete(key))return route.abort('failed');
    const locations=body.resourceType==='hard'?[asset]:asset.locations||[];
    const places=locations.filter(place=>!scope||scope.placeIds.includes(place.id)).map(place=>({placeId:place.id,placeKey:`hard-${place.id}`,name:place.name,address:place.address,lat:place.lat,lng:place.lng,hasCoordinates:Number.isFinite(place.lat)&&Number.isFinite(place.lng)}));
    return route.fulfill({status:201,json:{id:100000+body.resourceId,mapId:fixture.mapId,resourceType:body.resourceType,resourceId:body.resourceId,assetKey:key,snapshot:{version:2,name:asset.name,...(scope?{mapLocationScope:scope}:{}),places}}}).catch(error=>{state.requests.push({method:'FIXTURE_OBSERVATION',path:pathname,abortedDelivery:true,error:error.message.split('\n')[0]});});
   }
   return route.fallback();
  });
  return state;
 }
 return{...fixture,install};
}
