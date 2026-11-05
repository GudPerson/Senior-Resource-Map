import {createMapStudioDocument} from '../../../client/src/lib/mapStudioState.js';
import {createPrintAnnotation} from '../../../client/src/lib/printAnnotations.js';
import {appendKmlBoundaries} from '../../../client/src/lib/kmlBoundaries.js';
export const mapId=91261012;
export const owner={id:91261,name:'Fictional canvas owner',role:'standard',locale:'en'};
export const clone=value=>structuredClone(value);
export function createDirectory(){
 const rows=Array.from({length:8},(_,i)=>({rowKey:`personal:${91261+i}`,assetKey:`personal:${91261+i}`,resourceType:'personal',resourceId:91261+i,personalPlaceId:91261+i,name:`Fictional community place ${i+1}`,personalPlaceCategory:'home',subCategory:'Personal place',address:'Fictional address',lat:1.374+(i%4)*.004,lng:103.742+Math.floor(i/4)*.012,isPersonalPlace:true,saveEligible:false,status:'active',mapShortDescriptors:[]}));
 return {id:mapId,name:'Fictional Care Map canvas',description:'Local regression fixture with97 fictional annotations',categoryOrder:[],summary:{resourceCount:8,savedResourceCount:0,personalPlaceCount:8,placeCount:8,mappablePlaceCount:8},share:{isShared:false,shareToken:null,embedEnabled:false,embedAllowedOrigins:[]},assets:[],personalPlaces:rows.map(r=>({...r,shortDescription:'',shortDescriptors:[]})),places:rows.map(r=>({pinKey:r.assetKey,placeKey:r.assetKey,title:r.name,name:r.name,address:r.address,lat:r.lat,lng:r.lng,hasCoordinates:true,openProgrammeServiceCount:0,rows:[r]})),pins:rows.map(r=>({pinKey:r.assetKey,placeKey:r.assetKey,title:r.name,lat:r.lat,lng:r.lng,curatedCount:0,previewResourceNames:[]})),viewer:{isAuthenticated:true,isOwner:true,canSaveCopy:false,canSaveResources:true}};
}
export function createStudio(){const d=createMapStudioDocument();d.revision=1;d.views[0].revision=1;d.views[0].design.camera={mode:'fixed',view:{center:[1.38,103.75],zoom:13}};d.views[0].design.layout.preset='full-map';d.views[0].design.pins.style='numbered';d.views.push({...clone(d.views[0]),id:'fictional-second-view',name:'Fictional partner view'});d.views[1].design.camera.view={center:[1.39,103.77],zoom:13};return d;}
export function createAnnotations(){
 const a=[createPrintAnnotation({type:'polygon',points:[[1.34,103.72],[1.34,103.80],[1.42,103.80],[1.42,103.72]],text:'Fictional editable boundary',style:{color:'#056e5b',weight:4.2,fillColor:'#64b78a',fillOpacity:.11,fontSize:16,textColor:'#334155'}})];
 for(const [count,lat,lng,radius] of [[981,1.43,103.81,.016],[441,1.33,103.81,.012],[812,1.44,103.71,.014]]){const points=Array.from({length:count},(_,i)=>[lat+radius*Math.sin(i*2*Math.PI/count),lng+radius*Math.cos(i*2*Math.PI/count)]);a.push(appendKmlBoundaries([],[{points,name:`Fictional dense boundary ${a.length}`,style:{color:'#4b7b6a',weight:2,fillColor:'#90c8a5',fillOpacity:.1}}])[0]);}
 for(let i=a.length;i<97;i++){const lat=1.362+Math.floor((i-4)/12)*.004,lng=103.725+((i-4)%12)*.004;a.push(createPrintAnnotation({type:'polygon',points:[[lat,lng],[lat,lng+.0025],[lat+.0025,lng+.0025],[lat+.0025,lng]],text:`Fictional boundary ${String(i+1).padStart(2,'0')}`,style:{color:'#498c7d',weight:1.6,fillColor:'#aed9c5',fillOpacity:.1,fontSize:11,textColor:'#38564e'}}));}
 return a;
}
