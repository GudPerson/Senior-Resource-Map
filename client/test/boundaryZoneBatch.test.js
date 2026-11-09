import test from 'node:test';
import assert from 'node:assert/strict';
import * as workflow from '../src/lib/boundaryZoneWorkflow.js';

test('each boundary requires a named Place assignment; same and different Places preserve optional codes', () => {
    const rows = [{rowKey:'one',name:' North  zone ',zoneCode:' Ab-C ',source:{libraryId:2,revision:1,origin:{mapId:7}}},
        {rowKey:'two',name:'South',hardAssetId:9,source:{mapId:3,annotationId:'shape',revision:0}}];
    assert.throws(() => workflow.buildBoundaryJobRows(rows), /one.*Place/);
    rows[0].hardAssetId=9;
    assert.deepEqual(workflow.buildBoundaryJobRows(rows), [
        {rowKey:'one',name:'North zone',zoneCode:'Ab-C',hardAssetId:9,source:{libraryId:2,revision:1},saveToLibrary:false},
        {rowKey:'two',name:'South',zoneCode:null,hardAssetId:9,source:{mapId:3,annotationId:'shape',revision:0},saveToLibrary:false},
    ]);
    rows[1].hardAssetId=10;
    assert.deepEqual(workflow.buildBoundaryJobRows(rows).map(row=>row.hardAssetId), [9,10]);
});

const sequence=()=>{let n=0;return()=>`request-${++n}`;};
const row={rowKey:'one',name:'North',zoneCode:'Code-a',hardAssetId:9,source:{libraryId:2,revision:1}};
const job=(state,revision=1,rows=[{...row,status:'ready',postalCount:3,zoneId:null,libraryId:null}])=>({id:12,state,revision,rows});
const deferred=()=>{let resolve;const promise=new Promise(yes=>resolve=yes);return {promise,resolve};};

test('preparation serially reaches READY with no commit; frozen rows survive Back and unknown preparation replay',async()=>{
    const writes=[];let uncertain=true;
    const session=workflow.createBoundaryWorkflowSession({ownerId:'A',id:sequence(),api:{
        createBoundaryZoneJob:async payload=>{writes.push(structuredClone(payload));if(uncertain){uncertain=false;throw new Error('Unknown ACK');}return job('preparing');},
        advanceBoundaryZoneJob:async()=>job('ready',2),commitBoundaryZoneJob:async()=>{throw new Error('Must remain explicit');},
    }});
    session.begin({rows:[row],selectedIds:['2']});
    await assert.rejects(session.prepare([row]),/Unknown ACK/);
    session.update({rows:[{...row,name:'Changed draft'}],wizardOpen:false});
    await session.prepare(session.draft.rows);await session.continueJob();
    assert.deepEqual(writes[0],writes[1]);assert.equal(session.draft.job.state,'ready');assert.equal(session.draft.rows[0].name,'Changed draft');
});

test('pause and cancel wait for the accepted in-flight step, retaining created outcomes',async()=>{
    const gate=deferred(),actions=[];
    const partial=job('committing',2,[{...row,status:'created',postalCount:3,zoneId:41,libraryId:null},{...row,rowKey:'two',status:'ready',postalCount:2,zoneId:null,libraryId:null}]);
    const session=workflow.createBoundaryWorkflowSession({ownerId:'A',id:sequence(),api:{
        getBoundaryZoneJob:async()=>partial,
        advanceBoundaryZoneJob:async()=>{actions.push('advance');return gate.promise;},
        cancelBoundaryZoneJob:async(_id,payload)=>{actions.push(['cancel',payload.expectedRevision]);return {...partial,state:'cancelled',revision:3};},
    }});
    session.begin({job:job('committing'),jobId:12});
    const continuation=session.continueJob();await Promise.resolve();await Promise.resolve();
    const cancelled=session.interruptJob('cancel');gate.resolve(partial);
    await continuation;await cancelled;
    assert.deepEqual(actions,['advance',['cancel',2]]);assert.equal(session.draft.job.rows[0].zoneId,41);
    assert.match(workflow.boundaryCancellationMessage(session.draft.job),/1 audience zone/);
    assert.doesNotMatch(workflow.boundaryCancellationMessage(session.draft.job),/No audience zone/);
});

test('same and different assignment metadata survives selection/filter/Back without library provenance resubmission',()=>{
    const snapshots=[{id:2,revision:1,name:'Library north',drawing:{}},{id:3,revision:2,name:'Library south',drawing:{}}];
    const selected=workflow.mergeBoundaryBatchSelection([],snapshots,{hardAssetId:9});
    selected[0].name='Edited name';selected[0].zoneCode='Case-Preserved';selected[1].hardAssetId=10;
    const retained=workflow.mergeBoundaryBatchSelection(selected,snapshots,{hardAssetId:99});
    assert.deepEqual(retained.map(row=>[row.hardAssetId,row.name,row.zoneCode]),[[9,'Edited name','Case-Preserved'],[10,'Library south','']]);
    assert.equal(workflow.mergeBoundaryBatchSelection([],snapshots)[0].hardAssetId,'');
    assert.throws(()=>workflow.buildBoundaryJobRows([{...row,zoneCode:' A  B '},{...row,rowKey:'two',zoneCode:'A B'}]),/unique/);
});

test('unknown commit ACK reconciles accepted intent and pauses; explicit resume never creates a second intent',async()=>{
    let commits=0,advances=0;
    const session=workflow.createBoundaryWorkflowSession({ownerId:'A',id:sequence(),api:{
        commitBoundaryZoneJob:async()=>{commits++;throw Object.assign(new Error('lost ACK'),{status:503});},
        getBoundaryZoneJob:async()=>job('committing',3),
        advanceBoundaryZoneJob:async()=>{advances++;return job('complete',4,[{...row,status:'created',zoneId:44,postalCount:3}]);},
    }});
    session.begin({job:job('ready',2),jobId:12});
    await assert.rejects(session.jobAction('commit'),/lost ACK/);
    const identity=session.draft.commitPayload.requestId;
    await session.continueJob();assert.equal(advances,0);assert.equal(session.draft.needsResume,true);
    await session.getJob(12);session.update({needsResume:false});await session.continueJob();
    assert.equal(commits,1);assert.equal(advances,1);assert.equal(session.draft.commitPayload.requestId,identity);assert.equal(session.draft.job.rows[0].zoneId,44);
});

test('conflicting revision or expired lease stops continuation after GET until explicit Resume',async()=>{
    let advances=0;
    const session=workflow.createBoundaryWorkflowSession({ownerId:'A',id:sequence(),api:{
        advanceBoundaryZoneJob:async()=>{advances++;throw Object.assign(new Error('Lease expired'),{status:409,code:'BOUNDARY_JOB_CONFLICT'});},getBoundaryZoneJob:async()=>job('preparing',7),
    }});
    session.begin({job:job('preparing'),jobId:12});await assert.rejects(session.continueJob(),/Lease expired/);
    await session.continueJob();assert.equal(advances,1);assert.equal(session.draft.job.revision,7);assert.equal(session.draft.needsResume,true);
});

test('multiple mounted clients coalesce each owner/job continuation and close stops the following step',async()=>{
    const gate=deferred();let advances=0;
    const session=workflow.createBoundaryWorkflowSession({ownerId:'A',id:sequence(),api:{advanceBoundaryZoneJob:async()=>{advances++;return gate.promise;}}});
    session.begin({job:job('preparing'),jobId:12});
    const first=session.continueJob(),second=session.continueJob();await Promise.resolve();await Promise.resolve();
    session.stop();gate.resolve(job('preparing',2));await Promise.all([first,second]);assert.equal(advances,1);assert.equal(session.draft.job.revision,2);
});

test('recent-job recovery is a historical read before explicit Resume and reports empty and failed separately',async()=>{
    let advances=0;
    const historical=job('paused',4,[{...row,status:'created',zoneId:99},{...row,rowKey:'two',status:'empty',postalCount:0},{...row,rowKey:'three',status:'failed',errorCode:'BOUNDARY_ZONE_CODE_CONFLICT'}]);
    const session=workflow.createBoundaryWorkflowSession({ownerId:'A',id:sequence(),api:{getBoundaryZoneJob:async()=>historical,advanceBoundaryZoneJob:async()=>{advances++;}}});
    session.begin();await session.getJob(12);await session.continueJob();
    assert.equal(advances,0);assert.deepEqual(workflow.boundaryOutcomeSummary(session.draft.job),{created:1,library:0,ready:0,empty:1,failed:1});
});

test('a cancel action cannot silently coalesce into an advance result',async()=>{
    const gate=deferred();
    const session=workflow.createBoundaryWorkflowSession({ownerId:'A',id:sequence(),api:{advanceBoundaryZoneJob:()=>gate.promise}});
    session.begin({job:job('preparing'),jobId:12});const advancing=session.jobAction('advance');await Promise.resolve();
    const cancelling=session.jobAction('cancel');gate.resolve(job('preparing',2));
    await assert.rejects(cancelling,/in flight/);await advancing;
});

test('definitive preparation refusal permits explicit fresh review but uncertainty keeps its frozen key',async()=>{
    const attempts=[];let definitive=false;
    const session=workflow.createBoundaryWorkflowSession({ownerId:'A',id:sequence(),api:{createBoundaryZoneJob:async payload=>{
        attempts.push(payload);throw Object.assign(new Error(definitive?'Code unavailable':'Unknown ACK'),{status:definitive?409:503,code:definitive?'BOUNDARY_ZONE_CODE_CONFLICT':undefined});
    }}});
    session.begin();await assert.rejects(session.prepare([row]));
    assert.throws(()=>session.reviewPreparation(),/uncertain/);
    definitive=true;await assert.rejects(session.prepare([row]));
    assert.equal(attempts[0].requestId,attempts[1].requestId);
    session.reviewPreparation();await assert.rejects(session.prepare([{...row,zoneCode:'New-code'}]));
    assert.notEqual(attempts[1].requestId,attempts[2].requestId);assert.equal(attempts[2].rows[0].zoneCode,'New-code');
});

test('two clicks on explicit Create share one commit identity and exact reviewed revision',async()=>{
    const gate=deferred(),payloads=[];
    const session=workflow.createBoundaryWorkflowSession({ownerId:'A',id:sequence(),api:{commitBoundaryZoneJob:async(_id,payload)=>{payloads.push(payload);return gate.promise;}}});
    session.begin({job:job('ready',3),jobId:12});const first=session.jobAction('commit'),second=session.jobAction('commit');
    await Promise.resolve();gate.resolve(job('committing',4));await Promise.all([first,second]);
    assert.equal(payloads.length,1);assert.equal(payloads[0].expectedRevision,3);assert.equal(payloads[0].requestId,session.draft.commitPayload.requestId);
});

test('opening another durable job cannot be overwritten by a late step for the previous job',async()=>{
    const read=deferred(),step=deferred();
    const session=workflow.createBoundaryWorkflowSession({ownerId:'A',id:sequence(),api:{getBoundaryZoneJob:()=>read.promise,advanceBoundaryZoneJob:()=>step.promise}});
    session.begin({job:job('preparing'),jobId:12});
    const opening=session.getJob(13);const advancing=session.jobAction('advance');await Promise.resolve();
    read.resolve({...job('paused',4),id:13});await opening;
    step.resolve(job('preparing',2));await assert.rejects(advancing,{code:'BOUNDARY_SESSION_CHANGED'});
    assert.equal(session.draft.job.id,13);
});

test('historical job switches bind commit identity to owner/job and retain uncertain identity only for its own job',async()=>{
    const payloads=[];let activeId=12;
    const session=workflow.createBoundaryWorkflowSession({ownerId:'A',id:sequence(),api:{
        getBoundaryZoneJob:async id=>({...job('ready',3),id}),
        commitBoundaryZoneJob:async(id,payload)=>{payloads.push({id,...payload});if(id===12)throw Object.assign(new Error('Unknown ACK'),{status:503});return {...job('committing',4),id};},
    }});
    session.begin({job:job('ready',3),jobId:12});await assert.rejects(session.jobAction('commit'));
    const original=payloads[0].requestId;
    await session.getJob(13);session.update({needsResume:false});await session.jobAction('commit');
    assert.notEqual(payloads[1].requestId,original,'job B must not inherit job A key even with the same ready revision');
    await session.getJob(12);session.update({needsResume:false});await assert.rejects(session.jobAction('commit'));
    assert.equal(payloads[2].requestId,original,'unknown job A intent keeps its exact identity');
});

test('a stale reviewed commit revision is refused before POST until explicit fresh review',async()=>{
    let writes=0,revision=3;
    const session=workflow.createBoundaryWorkflowSession({ownerId:'A',id:sequence(),api:{getBoundaryZoneJob:async()=>job('ready',revision),commitBoundaryZoneJob:async()=>{writes++;throw Object.assign(new Error('Conflict'),{status:409});}}});
    session.begin({job:job('ready',3),jobId:12});await assert.rejects(session.jobAction('commit'));revision=5;await session.getJob(12);
    await assert.rejects(session.jobAction('commit'),{code:'BOUNDARY_COMMIT_REVIEW_REQUIRED'});assert.equal(writes,1);
});

test('frozen preview and Create admission belong to exact durable job/snapshot and use its own source label',async()=>{
    const a={...job('ready',3),snapshotSha256:'snapshot-A',manifestSha256:'manifest'},b={...job('ready',3),id:13,snapshotSha256:'snapshot-B',manifestSha256:'manifest'};
    const source={rowKey:'one',drawing:{type:'circle',name:'Frozen A label',points:[[1.3,103.8],[1.301,103.8]],style:{}},pointCount:2};
    const ready=await workflow.loadBoundaryFrozenReview(a,async()=>source);
    assert.equal(workflow.boundaryFrozenReviewForJob(ready,a).items.one.label,'Frozen A label');assert.equal(workflow.canCommitBoundaryReview(ready,a),true);
    assert.deepEqual(workflow.boundaryFrozenReviewForJob(ready,b).items,{});assert.equal(workflow.canCommitBoundaryReview(ready,b),false);
    assert.equal(workflow.canCommitBoundaryReview(ready,{...a,revision:4}),false);
    await assert.rejects(workflow.loadBoundaryFrozenReview(b,async()=>{throw new Error('B unavailable');}),/B unavailable/);
    assert.deepEqual(workflow.boundaryFrozenReviewForJob(ready,b).items,{});
    const result=await workflow.loadBoundaryFrozenReview(b,async()=>({...source,drawing:{...source.drawing,name:'Frozen B label'}}));
    assert.equal(result.items.one.label,'Frozen B label');assert.equal(workflow.canCommitBoundaryReview(result,b),true);
});

test('owner can list other historical jobs while its current job is complete and Place rights are absent',async()=>{
    const session=workflow.createBoundaryWorkflowSession({ownerId:'A',id:sequence(),api:{listBoundaryZoneJobs:async()=>({items:[{id:13,state:'paused'}],nextCursor:null})}});
    session.begin({job:job('complete',4),jobId:12});
    const recent=await session.listRecentJobs();assert.equal(recent.items[0].id,13);assert.equal(session.draft.job.id,12);
});

// Real wizard render/event wiring with a deterministic hook scheduler and inert
// dialog shell. This is not mounted React/DOM or browser acceptance evidence.
async function wizardRenderFixture(session,placeOptions=[]) {
    const {build}=await import('esbuild');
    const {readFile}=await import('node:fs/promises');
    const previous={workflow:globalThis.__boundaryFix1Workflow,api:globalThis.__boundaryFix1API};
    globalThis.__boundaryFix1Workflow={session,draft:session.draft,loggingOut:false};
    globalThis.__boundaryFix1API={};
    const scheduler=`const slots=[];let index=0;
        export const useState=initial=>{const i=index++;if(!slots[i])slots[i]={value:typeof initial==='function'?initial():initial};return [slots[i].value,next=>{slots[i].value=typeof next==='function'?next(slots[i].value):next;}];};
        export const useRef=initial=>{const i=index++;if(!slots[i])slots[i]={value:{current:initial}};return slots[i].value;};
        export const useEffect=()=>{};export const render=fn=>{index=0;return fn();};`;
    const {outputFiles}=await build({stdin:{contents:`export {default as Wizard} from './components/boundaries/BoundaryZoneBatchWizard.jsx';export {render} from 'fixture:hooks';`,resolveDir:new URL('../src/',import.meta.url).pathname,loader:'jsx'},bundle:true,platform:'node',format:'cjs',write:false,jsx:'automatic',logLevel:'silent',plugins:[{name:'wizard-event-boundary',setup(b){
        b.onResolve({filter:/^(react|react\/jsx-runtime|fixture:hooks|@radix-ui\/react-dialog)$/},args=>({path:args.path,namespace:'fixture'}));
        b.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({contents:path==='react/jsx-runtime'?`export const jsx=(type,props)=>({type,props});export const jsxs=jsx;export const Fragment='fragment';`:path==='react'?`export * from 'fixture:hooks';`:path==='@radix-ui/react-dialog'?`export const Root='root',Portal='portal',Overlay='overlay',Content='content',Title='title',Description='description';`:scheduler}));
        b.onLoad({filter:/BoundaryZoneWorkflowProvider\.jsx$/},()=>({contents:`export const useBoundaryZoneWorkflow=()=>globalThis.__boundaryFix1Workflow;`}));
        b.onLoad({filter:/AuthContext\.jsx$/},()=>({contents:`export const useAuth=()=>({user:{id:'A',role:'standard'}});`}));
        b.onLoad({filter:/\/lib\/api\.js$/},()=>({contents:`export const api=globalThis.__boundaryFix1API;`}));
        b.onLoad({filter:/BoundaryLibraryPicker\.jsx$/},()=>({contents:`export default function Picker(){return null;}export function FrozenPreview(){return null;}`}));
        if(process.env.BOUNDARY_TASK5_FIX1_BASELINE==='1' || process.env.BOUNDARY_TASK5_FIX2_BASELINE==='1')b.onLoad({filter:/BoundaryZoneBatchWizard\.jsx$/},async()=>({contents:await readFile(new URL(`../../.superpowers/sdd/2026-11-07-boundary-library-guided-zones/task-5-fix${process.env.BOUNDARY_TASK5_FIX2_BASELINE==='1'?'2':'1'}-baseline/client/src/components/boundaries/BoundaryZoneBatchWizard.jsx`,import.meta.url),'utf8'),loader:'jsx'}));
    }}]});
    const module={exports:{}};new Function('module','exports',outputFiles[0].text)(module,module.exports);
    return {render:()=>{globalThis.__boundaryFix1Workflow.draft=session.draft;return module.exports.render(()=>module.exports.Wizard({placeOptions}));},dispose:()=>{globalThis.__boundaryFix1Workflow=previous.workflow;globalThis.__boundaryFix1API=previous.api;}};
}
function buttonsInTree(node,result=[]) {
    if(!node || typeof node!=='object')return result;
    if(Array.isArray(node)){for(const child of node)buttonsInTree(child,result);return result;}
    if(node.type==='button')result.push(node);
    buttonsInTree(node.props?.children,result);return result;
}
function treeText(node) {
    if(typeof node==='string'||typeof node==='number')return String(node);
    if(Array.isArray(node))return node.map(treeText).join('');
    return node && typeof node==='object'?treeText(node.props?.children):'';
}

test('actual wizard offers recent listing in job mode and its event retrieves historical jobs with zero Place options',async()=>{
    let reads=0;
    const session=workflow.createBoundaryWorkflowSession({ownerId:'A',id:sequence(),api:{listBoundaryZoneJobs:async()=>{reads++;return {items:[{id:13,state:'paused',rowCount:1,createdCount:0}],nextCursor:null};}}});
    session.begin({job:job('complete',4),jobId:12});
    const fixture=await wizardRenderFixture(session);
    try {
        const find=buttonsInTree(fixture.render()).find(button=>treeText(button)==='Find recent jobs');
        assert.ok(find,'the existing current job must not hide historical listing');
        await find.props.onClick();assert.equal(reads,1);
        assert.ok(buttonsInTree(fixture.render()).some(button=>treeText(button)==='Read saved job'));
    } finally {fixture.dispose();}
});

function controlsInTree(node,type,result=[]) {
    if(!node || typeof node!=='object')return result;
    if(Array.isArray(node)){for(const child of node)controlsInTree(child,type,result);return result;}
    if(node.type===type)result.push(node);
    controlsInTree(node.props?.children,type,result);return result;
}
for(const refusal of [false,true])test(`actual recovered retry chooser ${refusal?'keeps a server refusal visible':'posts the selected authorized Place with the original key'}`,async()=>{
    const posts=[];
    const session=workflow.createBoundaryWorkflowSession({ownerId:'A',id:sequence(),api:{
        getBoundaryZoneMap:async()=>{throw Object.assign(new Error('Request not found'),{status:404,code:'BOUNDARY_REQUEST_NOT_FOUND'});},
        startBoundaryZoneMap:async payload=>{posts.push(payload);if(refusal)throw Object.assign(new Error('This request belongs to another Place. Read its saved result.'),{status:409,code:'BOUNDARY_REQUEST_CONFLICT'});return {mapId:12,hardAssetId:9,name:'Canonical Place'};},
    }});
    await session.recoverPointers({boundaryWorkflowId:'workflow-old',boundaryRequestId:'request-old'});session.requestStarterRetry();
    const fixture=await wizardRenderFixture(session,[{id:9,name:'Authorized Place'}]);
    try {
        let tree=fixture.render();
        const button=buttonsInTree(tree).find(button=>treeText(button)==='Retry same draw request');
        assert.ok(button,'not-found recovery must expose its existing authorized Place chooser');assert.equal(button.props.disabled,true);
        const chooser=controlsInTree(tree,'select')[0];assert.ok(chooser);
        chooser.props.onChange({target:{value:'9'}});tree=fixture.render();
        const retry=buttonsInTree(tree).find(button=>treeText(button)==='Retry same draw request');assert.equal(retry.props.disabled,false);
        await retry.props.onClick();
        assert.deepEqual(posts,[{requestId:'request-old',hardAssetId:9}]);assert.equal(session.draft.requestId,'request-old');
        if(refusal){assert.match(treeText(fixture.render()),/This request belongs to another Place/);assert.equal(session.draft.wizardOpen,true);}
    } finally {fixture.dispose();}
});

test('Resources restart transition after a retry tombstone drives the actual wizard new-map button',async()=>{
    let reads=0;const posts=[];
    const session=workflow.createBoundaryWorkflowSession({ownerId:'A',id:sequence(),api:{
        getBoundaryZoneMap:async()=>{reads++;throw Object.assign(new Error(reads===1?'Not found':'Map deleted'),{status:404,code:reads===1?'BOUNDARY_REQUEST_NOT_FOUND':'BOUNDARY_ZONE_MAP_UNAVAILABLE'});},
        startBoundaryZoneMap:async payload=>{posts.push(payload);return {mapId:22,hardAssetId:9,name:'Canonical Place'};},
    }});
    await session.recoverPointers({boundaryWorkflowId:'workflow-old',boundaryRequestId:'request-old'});session.requestStarterRetry();
    await assert.rejects(session.retryStarterWithPlace(9,[{id:9}]),/Map deleted/);
    session.update({wizardOpen:false});session.requestStarterRestart(); // Same production seam used by the Resources button.
    assert.equal(session.draft.requestId,'request-old');assert.deepEqual(posts,[]);
    const fixture=await wizardRenderFixture(session,[{id:9,name:'Authorized Place'}]);
    try {
        const buttons=buttonsInTree(fixture.render());
        assert.equal(buttons.some(button=>treeText(button)==='Retry same draw request'),false);
        const restart=buttons.find(button=>treeText(button)==='Start a new Care Map');assert.ok(restart);assert.equal(restart.props.disabled,false);
        await restart.props.onClick();assert.equal(posts.length,1);assert.notEqual(posts[0].requestId,'request-old');assert.equal(reads,2,'explicit restart must not read the deleted request again');
    } finally {fixture.dispose();}
});
