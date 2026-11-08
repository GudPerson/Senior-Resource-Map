import test from 'node:test';
import assert from 'node:assert/strict';
import { appendBoundaryDrawingCopies, createBoundaryImportOperation } from '../src/lib/boundaryLibraryImport.js';
import { validatePrintAnnotationDocumentInput, buildEmbeddedPrintAnnotationSnapshot } from '../../server/src/controllers/printAnnotationsController.js';
import { normalizePrintAnnotations } from '../src/lib/printAnnotations.js';
const rect=()=>({type:'rectangle',points:[[1,103],[2,104]],text:'Exact source',name:'Original',style:{color:'#FF0000',weight:3},isShared:true,resourceLinks:[{type:'hard',id:9}],image:{id:1}});
const polygon=()=>({type:'polygon',points:[[1,103],[1,104],[2,104],[2,103]],controlPoints:[[3,105],[3,106],[4,106]],text:'Separate lists',style:{}});

test('copies preserve original position/style, get independent IDs and exclude privileges/media/resource bindings',()=>{
    const source=rect(), existing=[{id:'old',type:'pin',points:[[1,103]],text:'Old'}];
    const a=appendBoundaryDrawingCopies(existing,[source]), b=appendBoundaryDrawingCopies(existing,[source]);
    assert.equal(a[0],existing[0]);assert.notEqual(a[1].id,b[1].id);assert.match(a[1].id,/^annotation_/);
    assert.deepEqual(a[1].points,[[1,103],[2,104]]);assert.equal(a[1].style.color,'#FF0000');assert.equal(a[1].text,'Exact source');assert.equal(a[1].name,'Original');assert.equal(a[1].isShared,false);
    assert.equal(a[1].resourceLinks,undefined);assert.equal(a[1].image,undefined);a[1].points[0][0]=8;assert.equal(source.points[0][0],1);
});
test('separate polygon lists survive both import and actual persistence normalization',()=>{
    const imported=appendBoundaryDrawingCopies([],[polygon()]);
    assert.deepEqual(imported[0].points,[[1,103],[1,104],[2,104],[2,103]]);
    assert.deepEqual(normalizePrintAnnotations(imported)[0].points,[[1,103],[1,104],[2,104],[2,103]]);
    assert.deepEqual(normalizePrintAnnotations(imported)[0].controlPoints,[[3,105],[3,106],[4,106]]);
});
test('invalid second drawing and latest hidden capacity reject without partial append',()=>{
    const existing=Array.from({length:199},(_,i)=>({...rect(),id:`old${i}`}));
    assert.throws(()=>appendBoundaryDrawingCopies(existing,[rect(),rect()]),e=>e.code==='count');
    assert.equal(existing.length,199);
    assert.throws(()=>appendBoundaryDrawingCopies([],[rect(),{type:'polygon',points:[[NaN,1]]}]));
});
test('one operation records one whole history entry, retries persistence of same IDs, later import gets new IDs',async()=>{
    let doc=[],fail=true;const history=[];
    const replace=fn=>{const next=fn(doc);history.push(doc);doc=next;};
    const op=createBoundaryImportOperation({drawings:[rect(),polygon()],replaceAnnotations:replace,flushPendingChanges:async()=>{if(fail){fail=false;return false;}return true;}});
    await assert.rejects(op.apply(),/sav/i);const ids=doc.map(x=>x.id);await op.apply();
    assert.equal(history.length,1);assert.deepEqual(doc.map(x=>x.id),ids);
    const later=createBoundaryImportOperation({drawings:[rect()],replaceAnnotations:replace,flushPendingChanges:async()=>true});await later.apply();assert.notEqual(doc[2].id,ids[0]);
    doc=history.pop();assert.equal(doc.length,2);doc=history.pop();assert.deepEqual(doc,[]);
});
test('capacity rechecks latest full document before one append and control points count in budget',async()=>{
    let doc=Array.from({length:200},(_,i)=>({...rect(),id:`hidden${i}`})),writes=0;
    const op=createBoundaryImportOperation({drawings:[rect()],replaceAnnotations:fn=>{const next=fn(doc);doc=next;writes++;},flushPendingChanges:async()=>true});
    await assert.rejects(op.apply(),e=>e.code==='count');assert.equal(writes,0);assert.equal(doc.length,200);
    const big=Array.from({length:40},(_,i)=>({id:`p${i}`,type:'polygon',points:Array.from({length:300},(_,j)=>[1+j/10000,103+(j%2)/100]),controlPoints:Array.from({length:200},(_,j)=>[1+j/10000,103+(j%2)/100])}));
    assert.throws(()=>appendBoundaryDrawingCopies(big,[rect()]),e=>e.code==='budget');
});

test('saved owner document retains optional name and separate geometry; public snapshot excludes private name',()=>{
 const imported=appendBoundaryDrawingCopies([],[{...polygon(),name:'Original name'}]);
 const saved=validatePrintAnnotationDocumentInput({schemaVersion:1,revision:0,annotations:imported});
 assert.equal(saved.annotations[0].name,'Original name');
 const reopened=normalizePrintAnnotations(JSON.parse(JSON.stringify(saved.annotations)));
 assert.deepEqual(reopened[0].points,[[1,103],[1,104],[2,104],[2,103]]);
 assert.deepEqual(reopened[0].controlPoints,[[3,105],[3,106],[4,106]]);
 assert.equal(reopened[0].name,'Original name');
 assert.equal(buildEmbeddedPrintAnnotationSnapshot([{...reopened[0],isShared:true}])[0].name,undefined);
});

test('legacy retired refinement and malformed point fallback retain control authority without weakening new import admission',()=>{
    const raw={...polygon(),id:'legacy',refinement:{kind:'road_centerline'}};
    assert.deepEqual(normalizePrintAnnotations([raw])[0].points,[[3,105],[3,106],[4,106]]);
    assert.equal(normalizePrintAnnotations([raw])[0].refinement,undefined);
    const malformed={...raw,refinement:undefined,points:[[1,103],[1,104],[2,104],[Infinity,103]]};
    assert.deepEqual(normalizePrintAnnotations([malformed])[0].points,[[3,105],[3,106],[4,106]]);
    assert.throws(()=>appendBoundaryDrawingCopies([],[malformed]),e=>e.code==='geometry');
});
test('owner change during save cannot acknowledge or duplicate a previously appended import',async()=>{
    let current=true,doc=[],writes=0;let finish;
    const saving=new Promise(resolve=>{finish=resolve;});
    const op=createBoundaryImportOperation({drawings:[rect()],isCurrent:()=>current,replaceAnnotations:fn=>{doc=fn(doc);writes++;},flushPendingChanges:()=>saving});
    const first=op.apply(),second=op.apply();assert.equal(first,second);current=false;finish(true);
    await assert.rejects(first,/changed/i);assert.equal(writes,1);assert.equal(doc.length,1);
});

// Real hook and real server/SQL boundary; the hook scheduler supplies React's
// scheduling only. No view components are replaced or used as assertions.
async function annotationHookRuntime(apiBoundary, baseline = false) {
    const { build } = await import('esbuild');
    const fs = await import('node:fs/promises');
    const scheduler = `export const state={slots:[],index:0,effects:[],dirty:false};
      const same=(a,b)=>a&&b&&a.length===b.length&&a.every((x,i)=>Object.is(x,b[i]));
      export function useState(initial){const i=state.index++;if(!state.slots[i])state.slots[i]={value:typeof initial==='function'?initial():initial};return[state.slots[i].value,next=>{const value=typeof next==='function'?next(state.slots[i].value):next;if(!Object.is(value,state.slots[i].value)){state.slots[i].value=value;state.dirty=true;}}];}
      export function useRef(initial){const i=state.index++;if(!state.slots[i])state.slots[i]={value:{current:initial}};return state.slots[i].value;}
      export function useMemo(fn,deps){const i=state.index++,old=state.slots[i];if(!old||!same(old.deps,deps))state.slots[i]={value:fn(),deps};return state.slots[i].value;}
      export const useCallback=(fn,deps)=>useMemo(()=>fn,deps);
      export function useEffect(fn,deps){const i=state.index++,old=state.slots[i];if(!old||!same(old.deps,deps))state.effects.push(()=>{old?.cleanup?.();state.slots[i]={deps,cleanup:fn()};});}
      state.render=fn=>{let result,n=0;do{state.dirty=false;state.index=0;state.effects=[];result=fn();for(const effect of state.effects)effect();if(n++>30)throw Error('Unsettled hook');}while(state.dirty);return result;};
      state.cleanup=()=>{for(const slot of state.slots)slot?.cleanup?.();};`;
    const bundle=await build({stdin:{contents:`export {usePrintAnnotations} from './hooks/usePrintAnnotations.js'; export {state} from 'scheduler';`,resolveDir:new URL('../src/',import.meta.url).pathname},bundle:true,write:false,format:'cjs',platform:'node',logLevel:'silent',plugins:[{name:'hook-scheduling',setup(build){
        build.onResolve({filter:/^(react|scheduler)$/},()=>({path:'scheduler',namespace:'scheduler'}));
        build.onLoad({filter:/.*/,namespace:'scheduler'},()=>({contents:scheduler}));
        build.onLoad({filter:/\/lib\/api\.js$/},()=>({contents:'export const api=apiBoundary;'}));
        if(baseline)build.onLoad({filter:/\/lib\/printAnnotations\.js$/},async()=>({contents:await fs.readFile(new URL('../../.superpowers/sdd/2026-11-07-boundary-library-guided-zones/task-4-baseline/client/src/lib/printAnnotations.js',import.meta.url),'utf8')}));
    }}]});
    const module={exports:{}};new Function('module','exports','apiBoundary',bundle.outputFiles[0].text)(module,module.exports,apiBoundary);return module.exports;
}
test('actual annotation hook persists the full independent batch and one Undo removes it completely',async t=>{
    const {createBoundaryPostgres}=await import('../../server/test/helpers/boundaryPostgres.js');
    const {pg,request}=await createBoundaryPostgres(t);
    await pg.exec("UPDATE my_map_print_annotation_documents SET revision=0,annotations='[]' WHERE map_id=41");
    let savedIds=[], loadedResolve; const initialLoaded=new Promise(resolve=>{loadedResolve=resolve;});
    const apiBoundary={getMyMapPrintAnnotations:async()=>{const r=await request('my-maps/41/print-annotations');assert.equal(r.status,200);loadedResolve();return r.json;},updateMyMapPrintAnnotations:async(_,body)=>{savedIds=body.annotations.map(x=>x.id);const r=await request('my-maps/41/print-annotations',{method:'PUT',body});assert.equal(r.status,200);return r.json;}};
    const runtime=await annotationHookRuntime(apiBoundary,process.env.BOUNDARY_TASK4_BASELINE==='1');
    const oldWindow=globalThis.window;globalThis.window={setTimeout,clearTimeout,localStorage:null};t.after(()=>{runtime.state.cleanup();globalThis.window=oldWindow;});
    let hook;const render=()=>hook=runtime.state.render(()=>runtime.usePrintAnnotations({mapId:41,userId:11,enabled:true,autosave:false,restoreLocalDraft:false}));
    render();await initialLoaded;await new Promise(resolve=>setImmediate(resolve));render();assert.equal(hook.status,'saved');
    const operation=createBoundaryImportOperation({drawings:[{...polygon(),name:'Original name'},rect()],replaceAnnotations:hook.replaceAnnotations,flushPendingChanges:hook.flushPendingChanges});
    await operation.apply();render();
    assert.equal(hook.annotations.length,2);assert.equal(hook.canUndo,true);assert.equal(hook.annotations[0].name,'Original name');
    assert.deepEqual(hook.annotations[0].points,[[1,103],[1,104],[2,104],[2,103]]);
    assert.deepEqual(hook.annotations[0].controlPoints,[[3,105],[3,106],[4,106]]);
    const persisted=await request('my-maps/41/print-annotations');assert.deepEqual(persisted.json.annotations.map(x=>x.id),savedIds);assert.equal(persisted.json.annotations[0].name,'Original name');
    hook.undo();render();assert.deepEqual(hook.annotations,[]);assert.equal(hook.canUndo,false);
    await hook.flushPendingChanges();render();assert.deepEqual((await request('my-maps/41/print-annotations')).json.annotations,[]);
});

test('point-only 201-corner polygon survives the real hook and owner PUT/GET at exactly 20,000 points', async t => {
    const { boundaryDrawingToArea } = await import('../../shared/boundaryDrawing.js');
    const { createBoundaryPostgres } = await import('../../server/test/helpers/boundaryPostgres.js');
    const { pg, request } = await createBoundaryPostgres(t);
    const vertices = n => Array.from({length:n}, (_,i) => [
        1.34 + .01 * Math.cos(2*Math.PI*i/n), 103.8 + .01 * Math.sin(2*Math.PI*i/n),
    ]);
    const initial = normalizePrintAnnotations(Array.from({length:29}, (_,i) => ({
        id:'hidden-'+i, type:'polygon', points:vertices(i<28?500:196), controlPoints:vertices(i<28?200:3),
    })));
    const source = {type:'polygon',points:vertices(201)};
    await pg.query('UPDATE my_map_print_annotation_documents SET annotations=$1 WHERE map_id=41',[JSON.stringify(initial)]);
    const path='my-maps/41/print-annotations';
    let loaded;
    const ready = new Promise(resolve=>{loaded=resolve;});
    const runtime=await annotationHookRuntime({
        getMyMapPrintAnnotations:async()=>{const r=await request(path);loaded();return r.json;},
        updateMyMapPrintAnnotations:async(_,body)=>{const r=await request(path,{method:'PUT',body});assert.equal(r.status,200);return r.json;},
    });
    const previous=globalThis.window;
    globalThis.window={setTimeout,clearTimeout,localStorage:null};
    t.after(()=>{runtime.state.cleanup();globalThis.window=previous;});
    const render=()=>runtime.state.render(()=>runtime.usePrintAnnotations({mapId:41,userId:11,enabled:true,autosave:false,restoreLocalDraft:false}));
    render();await ready;await new Promise(resolve=>setImmediate(resolve));
    const hook=render();
    const [copy]=await createBoundaryImportOperation({drawings:[source],replaceAnnotations:hook.replaceAnnotations,flushPendingChanges:hook.flushPendingChanges}).apply();
    const saved=(await request(path)).json.annotations;
    assert.deepEqual(saved.map(a=>a.id),[...initial.map(a=>a.id),copy.id]);
    assert.equal(saved.reduce((sum,a)=>sum+a.points.length+(a.controlPoints?.length||0),0),20000);
    assert.deepEqual(saved.at(-1).points,source.points);
    assert.equal(Object.hasOwn(saved.at(-1),'controlPoints'),false);
    assert.deepEqual(boundaryDrawingToArea(saved.at(-1)),boundaryDrawingToArea(source));
    const [published]=buildEmbeddedPrintAnnotationSnapshot([{...saved.at(-1),isShared:true,name:'Private'}]);
    assert.equal(published.name,undefined);
    assert.deepEqual(boundaryDrawingToArea(normalizePrintAnnotations([published])[0]),boundaryDrawingToArea(source));
    render().undo();assert.equal(render().canUndo,false);
    assert.equal(await render().flushPendingChanges(),true);
    assert.deepEqual((await request(path)).json.annotations,initial);
});

test('downlevel GET and a stripped PUT acknowledgement keep the recoverable draft and never report Saved',async t=>{
    const restoredWindow=globalThis.window;
    t.after(()=>{globalThis.window=restoredWindow;});
    for(const mode of ['unsupported','stripped-with-capability','missing-capability','erase-loaded']){
        const capable=mode!=='unsupported' && mode!=='erase-loaded';
        const values=new Map();
        globalThis.window={setTimeout,clearTimeout,localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}};
        let writes=0,revision=0,loaded;
        const ready=new Promise(resolve=>{loaded=resolve;});
        const runtime=await annotationHookRuntime({getMyMapPrintAnnotations:async()=>{loaded();return {annotations:mode==='erase-loaded'?appendBoundaryDrawingCopies([],[{...polygon(),name:'Protected saved name'}]):[],revision,serverCapabilities:capable?{exactBoundaryGeometry:true}:undefined};},updateMyMapPrintAnnotations:async(_,body)=>{
            writes++;return {revision:++revision,serverCapabilities:mode==='stripped-with-capability'?{exactBoundaryGeometry:true}:undefined,
                annotations:mode==='missing-capability'?body.annotations:body.annotations.map(({name,controlPoints,...a})=>({...a,points:controlPoints,controlPoints}))};
        }});
        const render=()=>runtime.state.render(()=>runtime.usePrintAnnotations({mapId:41,userId:11,enabled:true,autosave:false}));
        render();await ready;await new Promise(resolve=>setImmediate(resolve));const hook=render();
        const expected=mode==='erase-loaded'?[]:appendBoundaryDrawingCopies([],[{...polygon(),name:'Private name'}]);
        hook.replaceAnnotations(expected);assert.equal(await hook.flushPendingChanges(),false);
        assert.equal(render().status,'error');assert.equal(writes,capable?2:0);
        const [backup]=[...values.values()].map(JSON.parse);
        if(mode==='erase-loaded')assert.deepEqual(backup.annotations,[]);
        else {assert.equal(backup.annotations[0].name,'Private name');assert.deepEqual(backup.annotations[0].points,expected[0].points);}
        assert.equal(backup.baseRevision,revision);runtime.state.cleanup();
    }
});
