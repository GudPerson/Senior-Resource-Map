import test from 'node:test';
import assert from 'node:assert/strict';
import { updateBoundaryLibrarySelection, resolveSelectedBoundarySnapshots } from '../src/lib/boundaryLibrarySelection.js';
import { collectMatchingBoundaryIds, loadBoundarySnapshots, createBoundaryOwnerScope, createBoundaryLibrarySaveOperation } from '../src/lib/boundaryLibraryPickerModel.js';
import * as boundaryModel from '../src/lib/boundaryLibraryPickerModel.js';
const {readBoundaryLibrarySource}=boundaryModel;
const drawing = () => ({type:'rectangle', points:[[1,103],[2,104]],text:'Source',style:{}});
const detail = id => ({id,revision:1,name:`Boundary ${id}`,groupName:null,sourceGroupName:null,sourceName:'Source',drawing:drawing(),pointCount:2,source:{mapId:7,annotationId:'a',revision:0}});

test('selection retains hidden choices, normalizes numeric keys and keeps stable order across pages', () => {
    assert.deepEqual(updateBoundaryLibrarySelection([9], [1,2], 'select-all-visible'), ['9','1','2']);
    assert.deepEqual(updateBoundaryLibrarySelection(['9','1','2'], [1], 'clear-visible'), ['9','2']);
    assert.deepEqual(updateBoundaryLibrarySelection([9,1], [], {toggleId:'9'}), ['1']);
    assert.deepEqual(updateBoundaryLibrarySelection([9], [1,9], 'select-all-visible'), ['9','1']);
});
test('selected details resolve in selection order with canonical numeric IDs; missing or invalid details reject all', () => {
    assert.deepEqual(resolveSelectedBoundarySnapshots(['2','1'], {1:detail(1),2:detail(2)}).map(x=>x.id), [2,1]);
    assert.throws(()=>resolveSelectedBoundarySnapshots([1,2], {1:detail(1)}));
    assert.throws(()=>resolveSelectedBoundarySnapshots([1,2], {1:detail(1),2:{...detail(2),drawing:{type:'image'}}}));
});
test('select all follows opaque cursors with unchanged filters, and refuses oversized or looping pages', async () => {
    const queries=[];
    const ids=await collectMatchingBoundaryIds(async q=>{queries.push(q);return q.cursor?{items:[{id:51}],nextCursor:null}:{items:Array.from({length:50},(_,i)=>({id:i+1})),nextCursor:'opaque-next'};},{search:'north',group:'Team'},{maxSelection:256});
    assert.equal(ids.length,51); assert.equal(ids.at(-1),'51');
    assert.deepEqual(queries,[{search:'north',group:'Team',limit:100},{search:'north',group:'Team',limit:100,cursor:'opaque-next'}]);
    await assert.rejects(collectMatchingBoundaryIds(async()=>({items:[{id:1},{id:2}],nextCursor:null}),{},{maxSelection:1}),/limit/i);
    await assert.rejects(collectMatchingBoundaryIds(async()=>({items:[{id:1}],nextCursor:'same'}),{}),/pagination/i);
});
test('detail admission stops before loading an unbounded or over-budget selection', async () => {
    let calls=0;
    await assert.rejects(loadBoundarySnapshots(Array.from({length:257},(_,i)=>i+1),async id=>{calls++;return detail(id);}),/limit/i);
    assert.equal(calls,0);
    const large={...detail(1),drawing:{type:'polygon',boundarySource:'kml',points:Array.from({length:1000},(_,i)=>[1+Math.sin(i*Math.PI/500)/100,103+Math.cos(i*Math.PI/500)/100]),controlPoints:Array.from({length:1000},(_,i)=>[1+Math.sin(i*Math.PI/500)/100,103+Math.cos(i*Math.PI/500)/100])}};
    await assert.rejects(loadBoundarySnapshots(Array.from({length:12},(_,i)=>i+1),async id=>{calls++;return {...large,id};}),/budget/i);
    assert.equal(calls,11,'stop at first excess detail rather than load the remaining selection');
});
test('owner scope rejects old list/detail work after account change', async () => {
    const scope=createBoundaryOwnerScope('a');const token=scope.capture(); scope.setOwner('b');
    assert.equal(scope.isCurrent(token),false);const tokenB=scope.capture();assert.equal(scope.isCurrent(tokenB),true);
    await assert.rejects(loadBoundarySnapshots([1],async()=>{scope.setOwner('c');return detail(1);},{isCurrent:()=>scope.isCurrent(tokenB)}));
});
test('curation requires successful flush, uses acknowledged revision zero and retries identical request after unknown ACK', async () => {
    const payloads=[];let first=true;let flushes=0;
    const operation=createBoundaryLibrarySaveOperation({selectedDrawing:drawing(),requestId:'fixed-key',metadata:{name:'North',groupName:''},source:{mapId:7,annotationId:'a'},flushPendingChanges:async()=>{flushes++;return true;},readSavedDocument:async()=>({revision:0,annotations:[{id:'a',...drawing()}]}),create:async body=>{payloads.push(body);if(first){first=false;throw new Error('Lost ACK');}return {item:detail(1)};}});
    await assert.rejects(operation.save(),/Lost ACK/); await operation.save();
    assert.deepEqual(payloads,[{requestId:'fixed-key',name:'North',groupName:null,source:{mapId:7,annotationId:'a',revision:0}},{requestId:'fixed-key',name:'North',groupName:null,source:{mapId:7,annotationId:'a',revision:0}}]);
    assert.equal(flushes,1);
    let posts=0;
    const refused=createBoundaryLibrarySaveOperation({selectedDrawing:drawing(),requestId:'new-key',metadata:{name:'North'},source:{mapId:7,annotationId:'a'},flushPendingChanges:async()=>false,readSavedDocument:async()=>({revision:8}),create:async()=>{posts++;}});
    await assert.rejects(refused.save(),/save/i); assert.equal(posts,0);
});
test('owner change during source flush prevents curation POST', async () => {
    let current=true,posts=0;
    const operation=createBoundaryLibrarySaveOperation({selectedDrawing:drawing(),requestId:'key',metadata:{name:'N'},source:{mapId:7,annotationId:'a'},isCurrent:()=>current,flushPendingChanges:async()=>{current=false;return true;},readSavedDocument:async()=>({revision:1}),create:async()=>posts++});
    await assert.rejects(operation.save(),/changed/i);assert.equal(posts,0);
});

test('account cycling invalidates old work, including saved-source readback and accepted POST responses',async()=>{
    const scope=createBoundaryOwnerScope('a'),token=scope.capture();scope.setOwner('b');scope.setOwner('a');assert.equal(scope.isCurrent(token),false);
    let current=true,posts=0;
    const readChange=createBoundaryLibrarySaveOperation({selectedDrawing:drawing(),requestId:'read-key',metadata:{name:'N'},source:{mapId:7,annotationId:'a'},isCurrent:()=>current,flushPendingChanges:async()=>true,readSavedDocument:async()=>{current=false;return {revision:0,annotations:[{id:'a',...drawing()}]};},create:async()=>posts++});
    await assert.rejects(readChange.save(),/changed/i);assert.equal(posts,0);
    current=true;
    const postChange=createBoundaryLibrarySaveOperation({selectedDrawing:drawing(),requestId:'post-key',metadata:{name:'N'},source:{mapId:7,annotationId:'a'},isCurrent:()=>current,flushPendingChanges:async()=>true,readSavedDocument:async()=>({revision:4,annotations:[{id:'a',...drawing()}]}),create:async()=>{posts++;current=false;return {item:detail(1)};}});
    await assert.rejects(postChange.save(),/changed/i);assert.equal(posts,1);
});

test('curation refuses changed geometry or canonical metadata under the same saved annotation ID before POST',async()=>{
    const selected={...drawing(),name:'Original name',groupName:'Original group',style:{color:'#123456'}};
    for(const patch of [{points:[[3,103],[4,104]]},{style:{color:'#654321'}},{name:'Replaced name'},{groupName:'Changed group'},{text:'Changed label'},{rotationDegrees:30}]){
        let posts=0;
        const op=createBoundaryLibrarySaveOperation({requestId:'unchanged-intent',metadata:{name:'Private entry'},source:{mapId:7,annotationId:'a'},selectedDrawing:selected,
            flushPendingChanges:async()=>true,readSavedDocument:async()=>({revision:8,annotations:[{id:'a',...selected,...patch}]}),create:async()=>posts++});
        await assert.rejects(op.save(),error=>error.code==='BOUNDARY_SOURCE_REVIEW_REQUIRED');
        assert.equal(posts,0);assert.equal(op.canReviewAgain,true);
    }
});
test('a definitive stale rejection stops obsolete retries and explicit current-source review permits a new request',async()=>{
    const payloads=[];let revision=1;
    const old=createBoundaryLibrarySaveOperation({requestId:'old-intent',metadata:{name:'Private entry'},source:{mapId:7,annotationId:'a'},selectedDrawing:drawing(),flushPendingChanges:async()=>true,
        readSavedDocument:async()=>({revision,annotations:[{id:'a',...drawing()}]}),create:async body=>{payloads.push(body);throw Object.assign(new Error('Source stale'),{status:409,code:'BOUNDARY_SOURCE_STALE'});}});
    await assert.rejects(old.save(),error=>error.code==='BOUNDARY_SOURCE_STALE');
    revision=2;
    await assert.rejects(old.save(),error=>error.code==='BOUNDARY_SOURCE_STALE');assert.equal(payloads.length,1,'known refusal must not send obsolete POST again');
    assert.equal(old.canReviewAgain,true);
    const source={mapId:7,annotationId:'a'};
    const reviewed=await readBoundaryLibrarySource({source,readSavedDocument:async()=>({revision:2,annotations:[{id:'a',...drawing(),text:'Reviewed replacement'}]})});
    const fresh=createBoundaryLibrarySaveOperation({requestId:'new-reviewed-intent',metadata:{name:'Private entry'},source,selectedDrawing:reviewed.drawing,flushPendingChanges:async()=>true,
        readSavedDocument:async()=>({revision:2,annotations:[{id:'a',...drawing(),text:'Reviewed replacement'}]}),create:async body=>{payloads.push(body);return {item:detail(1)};}});
    await fresh.save();assert.deepEqual(payloads.map(x=>[x.requestId,x.source.revision]),[['old-intent',1],['new-reviewed-intent',2]]);
    assert.equal(reviewed.drawing.text,'Reviewed replacement');
});
test('an edit after explicit fresh review is rejected again, while uncertain 5xx keeps its original payload and identity',async()=>{
    const source={mapId:7,annotationId:'a'},original=drawing();
    const reviewed=await readBoundaryLibrarySource({source,readSavedDocument:async()=>({revision:2,annotations:[{id:'a',...original}]})});
    let posts=0;
    const changed=createBoundaryLibrarySaveOperation({requestId:'reviewed-again',metadata:{name:'N'},source,selectedDrawing:reviewed.drawing,flushPendingChanges:async()=>true,
        readSavedDocument:async()=>({revision:3,annotations:[{id:'a',...original,style:{color:'#123456'}}]}),create:async()=>posts++});
    await assert.rejects(changed.save(),error=>error.code==='BOUNDARY_SOURCE_REVIEW_REQUIRED');assert.equal(posts,0);
    const payloads=[];let revision=4;
    const uncertain=createBoundaryLibrarySaveOperation({requestId:'uncertain',metadata:{name:'N'},source,selectedDrawing:original,flushPendingChanges:async()=>true,
        readSavedDocument:async()=>({revision,annotations:[{id:'a',...original}]}),create:async body=>{payloads.push(body);if(payloads.length===1)throw Object.assign(new Error('Unknown ACK'),{status:503});return {item:detail(1)};}});
    await assert.rejects(uncertain.save(),/Unknown ACK/);assert.equal(uncertain.canReviewAgain,false);revision=9;
    await uncertain.save();assert.deepEqual(payloads.map(x=>[x.requestId,x.source.revision]),[['uncertain',4],['uncertain',4]]);
});
