import {createPrintAnnotation} from '../../../client/src/lib/printAnnotations.js';
import {createDirectory} from '../care-map-floating-canvas/data.mjs';
import {buildDirectoryPresentation} from '../../../client/src/lib/directoryPresentation.js';

export const centre=[1.38,103.75];
export function annotationsForInspection(assetId,{extraAreas=0,image=true}={}){
  const shape=(id,input)=>({...createPrintAnnotation(input),id});
  const style={fontSize:24,color:'#086f64',fillColor:'#84cdbf',fillOpacity:.12,weight:4};
  const rows=[
    shape('layer-rhs',{type:'polygon',points:[[1.35,103.72],[1.35,103.78],[1.41,103.78],[1.41,103.72]],text:'Fictional RHS boundary',style}),
    shape('layer-grc',{type:'rectangle',points:[[1.355,103.725],[1.405,103.775]],text:'Fictional GRC boundary',style}),
    shape('layer-circle',{type:'circle',points:[centre,[1.38,103.775]],text:'Fictional radius area',style}),
    shape('layer-line',{type:'line',points:[[1.35,103.75],[1.41,103.75]],text:'Fictional inspection line',style:{...style,weight:8}}),
    shape('layer-pin',{type:'pin',points:[centre],text:'Fictional annotation pin',style}),
    shape('layer-hidden',{type:'polygon',points:[[1.35,103.72],[1.35,103.78],[1.41,103.78],[1.41,103.72]],text:'Never shown hidden annotation',style}),
  ];
  if(image)rows.push(shape('layer-image',{type:'image',points:[[1.377,103.747],[1.383,103.753]],image:{assetId,width:1,height:1,alt:'Fictional inspection image'}}));
  for(let i=0;i<extraAreas;i++)rows.push(shape('layer-extra-'+i,{type:'polygon',points:[[1.35,103.72],[1.35,103.78],[1.41,103.78],[1.41,103.72]],text:'Fictional overlap '+String(i).padStart(2,'0'),style}));
  return rows;
}
export function directoryForInspection(){
  const directory=createDirectory();
  const first={...directory.places[0].rows[0],name:'Fictional resource Alpha',lat:centre[0],lng:centre[1]};
  const second={...directory.places[1].rows[0],name:'Fictional resource Beta',lat:centre[0],lng:centre[1]};
  directory.places[0]={...directory.places[0],name:'Fictional shared location',title:'Fictional shared location',lat:centre[0],lng:centre[1],rows:[first,second]};
  directory.places.splice(1,1);
  directory.personalPlaces[0]={...directory.personalPlaces[0],...first};
  directory.personalPlaces[1]={...directory.personalPlaces[1],...second};
  directory.summary={...directory.summary,placeCount:7,mappablePlaceCount:7};
  directory.pins=buildDirectoryPresentation(directory).pins;
  return directory;
}
