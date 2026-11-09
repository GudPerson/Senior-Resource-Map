import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalizeBoundaryDrawing } from '../../shared/boundaryDrawing.js';
import { createBoundaryImportOperation } from '../src/lib/boundaryLibraryImport.js';
import { createBoundaryWorkflowSession, acknowledgeBoundarySelection, mergeBoundaryBatchSelection, loadBoundaryFrozenReview, canCommitBoundaryReview } from '../src/lib/boundaryZoneWorkflow.js';

// Production helper composition; actual mounted React/DOM proof is the separate browser runner.
test('import → durable selected ACK → rows → frozen READY → explicit commit composes without duplicate append',async()=>{
 const drawing=canonicalizeBoundaryDrawing({type:'rectangle',name:'Frozen source',points:[[1.31,103.81],[1.32,103.82]]});
 let annotations=[],undos=0,saves=0;
 const operation=createBoundaryImportOperation({drawings:[drawing],replaceAnnotations:fn=>{annotations=fn(annotations);undos++;},flushPendingChanges:async()=>++saves>1});
 await assert.rejects(operation.apply(),/added once/);const accepted=await operation.apply();assert.equal(undos,1);assert.equal(annotations.length,1);assert.deepEqual(accepted[0].points,drawing.points);assert.equal(accepted[0].isShared,false);
 const ack=await acknowledgeBoundarySelection({mapId:41,selectedAnnotation:accepted[0],flushPendingChanges:async()=>true,readSavedDocument:async()=>({revision:0,annotations})});
 const writes=[];let n=0;
 const session=createBoundaryWorkflowSession({ownerId:11,id:()=>`intent-${++n}`,api:{createBoundaryZoneJob:async payload=>{writes.push(payload);return{id:7,state:'ready',revision:2,rows:payload.rows.map(r=>({...r,status:'ready',postalCount:2})),snapshotSha256:'a',manifestSha256:'b'};},getBoundaryZoneJobRowSource:async()=>({drawing}),commitBoundaryZoneJob:async(id,payload)=>{writes.push({id,...payload});return{...session.draft.job,state:'committing',revision:3};}}});
 session.begin({rows:[{rowKey:'drawn',name:'North',zoneCode:'Case',hardAssetId:21,source:ack.source}]});
 await session.prepare(session.draft.rows);assert.equal(writes.length,1);assert.equal(session.draft.job.state,'ready');
 const frozen=await loadBoundaryFrozenReview(session.draft.job,async(_id,rowKey)=>({rowKey,drawing}));assert.equal(canCommitBoundaryReview(frozen,session.draft.job),true);
 await session.jobAction('commit');assert.equal(writes.length,2);assert.equal(writes[0].rows[0].source.revision,0);assert.equal(writes[0].rows[0].saveToLibrary,false);
 const rows=mergeBoundaryBatchSelection([],[{id:1,revision:1,name:'A',drawing},{id:2,revision:1,name:'B',drawing}]);assert.deepEqual(rows.map(r=>r.hardAssetId),['','']);
});
