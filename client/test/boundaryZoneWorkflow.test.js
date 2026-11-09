import test from 'node:test';
import assert from 'node:assert/strict';
import * as workflow from '../src/lib/boundaryZoneWorkflow.js';

test('owner session invalidates usable drafts synchronously including A to B to A', () => {
    const session=workflow.createBoundaryWorkflowSession({ownerId:'A',api:{},id:()=> 'opaque'});
    session.begin({hardAssetId:9,name:'Unsaved name'});
    const token=session.capture();
    session.setOwner('B');session.setOwner('A');
    assert.equal(session.isCurrent(token),false);
    assert.equal(session.draft,null);
    session.begin({hardAssetId:9});const next=session.capture();
    session.invalidate();
    assert.equal(session.isCurrent(next),false);
    assert.equal(session.draft,null);
});

const deferred = () => {let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const sequence = () => {let index=0;return()=>`opaque-${++index}`;};
const drawing = {id:'area',type:'polygon',points:[[1.3,103.8],[1.3,103.81],[1.31,103.81]],style:{color:'#123456'},text:'Exact selected area'};

test('starter unknown acknowledgement reconciles the same request before any retry, and a deleted map needs explicit restart', async()=>{
    const posts=[],reads=[],navigations=[];
    let deleted=false;
    const session=workflow.createBoundaryWorkflowSession({ownerId:'A',id:sequence(),onNavigate:(...args)=>navigations.push(args),api:{
        startBoundaryZoneMap:async payload=>{posts.push(payload);throw new Error('Lost acknowledgement');},
        getBoundaryZoneMap:async requestId=>{reads.push(requestId);if(deleted)throw Object.assign(new Error('Deleted'),{status:404,code:'BOUNDARY_ZONE_MAP_UNAVAILABLE'});return {mapId:12,hardAssetId:9,name:'Canonical Place'};},
    }});
    await assert.rejects(session.startDraw({hardAssetId:9,name:'Unsaved name'}),/Lost/);
    const request=session.draft.requestId;
    await session.startDraw();
    assert.equal(posts.length,1);assert.deepEqual(reads,[request]);assert.equal(navigations[0][0],'/my-directory/maps/12?workspace=current');
    assert.deepEqual(Object.keys(navigations[0][1]).sort(),['boundaryRequestId','boundaryWorkflowId']);
    deleted=true;await assert.rejects(session.startDraw(),/Deleted/);
    assert.equal(session.draft.phase,'map-unavailable');assert.equal(posts.length,1);
    await assert.rejects(session.restart(),/Lost/);
    assert.notEqual(posts[1].requestId,request);
});

test('a successful flush needs canonical saved content and accepts saved revision zero',async()=>{
    const options={mapId:12,selectedAnnotation:drawing,flushPendingChanges:async()=>true,readSavedDocument:async()=>({revision:0,annotations:[drawing]})};
    assert.equal((await workflow.acknowledgeBoundarySelection(options)).source.revision,0);
    await assert.rejects(workflow.acknowledgeBoundarySelection({...options,flushPendingChanges:async()=>false}),/Save the map/);
    await assert.rejects(workflow.acknowledgeBoundarySelection({...options,hasUnfinishedDraft:true}),/unfinished/);
    await assert.rejects(workflow.acknowledgeBoundarySelection({...options,readSavedDocument:async()=>({revision:1,annotations:[{...drawing,text:'Another tab substituted this'}]})}),{code:'BOUNDARY_SOURCE_REVIEW_REQUIRED'});
});

test('logout during favorite save prevents Saved application, starter POST and navigation before auth settles',async()=>{
    const gate=deferred(),effects=[];
    const session=workflow.createBoundaryWorkflowSession({ownerId:'A',id:sequence(),onSavedAssets:()=>effects.push('saved'),onNavigate:()=>effects.push('navigate'),api:{
        ensureSavedAsset:()=>gate.promise,getSavedAssets:async()=>{effects.push('getSaved');return[];},startBoundaryZoneMap:async()=>effects.push('starter'),
    }});
    session.begin({hardAssetId:9});const operation=session.startDraw(null,{savePlace:true});
    await Promise.resolve();session.invalidate();gate.resolve({});
    await assert.rejects(operation,{code:'BOUNDARY_SESSION_CHANGED'});assert.deepEqual(effects,[]);
});

test('reload recovers durable map identity while truthfully losing unsaved text',async()=>{
    const session=workflow.createBoundaryWorkflowSession({ownerId:'A',id:sequence(),api:{getBoundaryZoneMap:async()=>({mapId:14,hardAssetId:9,name:'Canonical Place'})}});
    await session.recoverPointers({boundaryWorkflowId:'opaque-workflow',boundaryRequestId:'opaque-request',name:'Must not recover'});
    assert.equal(session.draft.lostText,true);assert.equal(session.draft.name,'');assert.equal(session.draft.mapId,14);assert.equal(session.draft.requestId,'opaque-request');
});

test('Place readiness protects unrelated edits and busy state',()=>{
    assert.match(workflow.boundaryPlaceReadiness({hardAssetId:9,current:{phone:'new'},baseline:{phone:'old'}}),/Save or discard/);
    assert.equal(workflow.boundaryPlaceReadiness({hardAssetId:9,current:{b:2,a:1},baseline:{a:1,b:2}}),'');
    assert.match(workflow.boundaryPlaceReadiness({hardAssetId:9,current:{},baseline:{},enriching:true}),/finish/);
});

for (const phase of ['starter-post','starter-get','flush','saved-read','prepare','advance','commit','resume']) {
    test(`account A to B to A during ${phase} rejects the old completion without follow-up`,async()=>{
        const gate=deferred(),effects=[];
        const api={startBoundaryZoneMap:()=>gate.promise,getBoundaryZoneMap:()=>gate.promise,createBoundaryZoneJob:()=>gate.promise,
            advanceBoundaryZoneJob:()=>gate.promise,commitBoundaryZoneJob:()=>gate.promise,resumeBoundaryZoneJob:()=>gate.promise,
            getBoundaryZoneJob:async()=>{effects.push('reconcile');return{};}};
        const session=workflow.createBoundaryWorkflowSession({ownerId:'A',id:sequence(),api,onNavigate:()=>effects.push('navigate')});
        session.begin({hardAssetId:9,mapId:12,starterAttempted:phase==='starter-get',jobId:12,job:{id:12,revision:1,state:phase==='commit'?'ready':'preparing',rows:[]}});
        let operation;
        if(phase==='starter-post'||phase==='starter-get') operation=session.startDraw();
        if(phase==='prepare')operation=session.prepare([{rowKey:'one',hardAssetId:9,name:'Name',source:{libraryId:2,revision:1}}]);
        if(['advance','commit','resume'].includes(phase))operation=session.jobAction(phase);
        if(phase==='flush'||phase==='saved-read')operation=session.acceptSavedBoundary({mapId:12,selectedAnnotation:drawing,
            flushPendingChanges:phase==='flush'?()=>gate.promise:async()=>true,readSavedDocument:phase==='saved-read'?()=>gate.promise:async()=>{effects.push('saved-read');return{};}});
        await Promise.resolve();await Promise.resolve();
        session.setOwner('B');session.setOwner('A');gate.resolve(phase==='flush'?true:phase==='saved-read'?{revision:0,annotations:[drawing]}:{id:12,mapId:12,hardAssetId:9,revision:2,state:'ready'});
        await assert.rejects(operation,{code:'BOUNDARY_SESSION_CHANGED'});
        assert.equal(session.draft,null);assert.deepEqual(effects,[]);
    });
}

test('zone management candidates exclude staff-only, favorite-only and mismatched regional access',()=>{
    const asset={id:9,subregionId:3};
    assert.equal(workflow.canManageBoundaryPlace({id:1,role:'standard'},asset),false);
    assert.equal(workflow.canManageBoundaryPlace({id:1,role:'regional_admin',subregionIds:[4]},asset),false);
    assert.equal(workflow.canManageBoundaryPlace({id:1,role:'regional_admin',subregionIds:['3']},asset),true);
    assert.equal(workflow.canManageBoundaryPlace({id:1,role:'super_admin'},asset),true);
});

test('registered live Place guard blocks every drawing entry before starter writes and retains the zone draft',async()=>{
    let writes=0,dirty=true;
    const session=workflow.createBoundaryWorkflowSession({ownerId:'A',id:sequence(),api:{startBoundaryZoneMap:async()=>{writes++;return{mapId:12};}}});
    const unregister=session.registerPlaceGuard(()=>dirty?'Save or discard current Place edits.':'');
    await assert.rejects(session.startDraw({hardAssetId:9,name:'Zone draft'}),/Save or discard/);
    assert.equal(writes,0);assert.equal(session.draft.name,'Zone draft');
    dirty=false;await session.startDraw();assert.equal(writes,1);unregister();
});

test('changing the local selection while saving requires review before handoff',async()=>{
    const gate=deferred();let selected=drawing;
    const operation=workflow.acknowledgeBoundarySelection({mapId:12,selectedAnnotation:drawing,flushPendingChanges:()=>gate.promise,
        readCurrentSelection:()=>({annotation:selected,hasUnfinishedDraft:false}),readSavedDocument:async()=>({revision:0,annotations:[drawing]})});
    selected={...drawing,id:'another-area'};gate.resolve(true);
    await assert.rejects(operation,{code:'BOUNDARY_SOURCE_REVIEW_REQUIRED'});
});

// Fix 1: durable pointers and route entry are observable workflow boundaries.
test('starter records its opaque pointer before any write; reload resumes with GET only',async()=>{
    const events=[];let history;
    const session=workflow.createBoundaryWorkflowSession({ownerId:'A',id:sequence(),onPointers:value=>{history=structuredClone(value);events.push('pointer');},api:{startBoundaryZoneMap:async()=>{events.push('POST');throw new Error('Lost ACK');}}});
    await assert.rejects(session.startDraw({hardAssetId:9,name:'Unsaved zone'}),/Lost ACK/);
    assert.deepEqual(events.slice(0,2),['pointer','POST']);assert.equal(history.boundaryRequestId,session.draft.requestId);
    const reads=[],posts=[];
    const recovered=workflow.createBoundaryWorkflowSession({ownerId:'A',id:sequence(),api:{
        getBoundaryZoneMap:async request=>{reads.push(request);return {mapId:12,hardAssetId:9,name:'Canonical Place'};},startBoundaryZoneMap:async payload=>{posts.push(payload);return {mapId:99};},
    }});
    await recovered.recoverPointers(history);await recovered.startDraw();
    assert.deepEqual(reads,[history.boundaryRequestId,history.boundaryRequestId]);assert.deepEqual(posts,[]);assert.equal(recovered.draft.name,'');
});

test('a recovered deleted-map request remains read-only without a Place ID',async()=>{
    const posts=[],reads=[];
    const session=workflow.createBoundaryWorkflowSession({ownerId:'A',id:sequence(),api:{getBoundaryZoneMap:async request=>{reads.push(request);throw Object.assign(new Error('Deleted'),{status:404,code:'BOUNDARY_ZONE_MAP_UNAVAILABLE'});},startBoundaryZoneMap:async payload=>posts.push(payload)}});
    await session.recoverPointers({boundaryWorkflowId:'workflow-old',boundaryRequestId:'request-old'});
    await assert.rejects(session.startDraw(),/Deleted/);
    assert.equal(session.draft.phase,'map-unavailable');assert.deepEqual(reads,['request-old','request-old']);assert.deepEqual(posts,[]);
});

for(const phase of ['favorite-save','starter-ack','drawing-ack'])test(`leaving the initiating route during ${phase} stops follow-ups and retains memory`,async()=>{
    const gate=deferred(),effects=[];
    const session=workflow.createBoundaryWorkflowSession({ownerId:'A',id:sequence(),onNavigate:()=>effects.push('navigate'),api:{
        ensureSavedAsset:()=>gate.promise,getSavedAssets:async()=>{effects.push('saved-read');return[];},startBoundaryZoneMap:async()=>{effects.push('starter');return gate.promise;},
    }});
    session.setRouteEntry('origin');session.begin({hardAssetId:9,mapId:12,name:'Keep zone text'});
    const token=session.capture();
    const operation=phase==='drawing-ack' ? session.acceptSavedBoundary({mapId:12,selectedAnnotation:drawing,flushPendingChanges:async()=>true,readSavedDocument:()=>gate.promise}) : session.startDraw(null,{savePlace:phase==='favorite-save'});
    await Promise.resolve();await Promise.resolve();session.setRouteEntry('elsewhere');session.setRouteEntry('origin');
    gate.resolve(phase==='drawing-ack'?{revision:0,annotations:[drawing]}:{mapId:12,hardAssetId:9});
    await assert.rejects(operation,{code:'BOUNDARY_SESSION_CHANGED'});
    assert.equal(session.isCurrent(token),false);assert.equal(session.draft.name,'Keep zone text');assert.deepEqual(effects,phase==='starter-ack'?['starter']:[]);
});

test('remembering pointers preserves the router entry identity and raw form text never enters history',()=>{
    const history={state:{key:'origin',idx:3,usr:{old:true}},replaceState(next){this.state=next;}};
    workflow.rememberBoundaryWorkflowPointers(history,{boundaryWorkflowId:'workflow',boundaryRequestId:'request'});
    assert.deepEqual(history.state,{key:'origin',idx:3,usr:{boundaryWorkflowId:'workflow',boundaryRequestId:'request'}});
});

test('only explicit matching guided history and allowed draw phases can open guided map mode',()=>{
    const draft={ownerId:'A',workflowId:'workflow',requestId:'request',mapId:12,phase:'drawing'};
    const state={boundaryWorkflowId:'workflow',boundaryRequestId:'request'};
    assert.equal(workflow.isGuidedBoundaryEntry({draft,state,mapId:12,ownerId:'A'}),true);
    for(const phase of ['assigning','job','returned','cancelled','zone-edit'])assert.equal(workflow.isGuidedBoundaryEntry({draft:{...draft,phase},state,mapId:12,ownerId:'A'}),false);
    assert.equal(workflow.isGuidedBoundaryEntry({draft,state:null,mapId:12,ownerId:'A'}),false);
    assert.equal(workflow.isGuidedBoundaryEntry({draft,state:{...state,boundaryWorkflowId:'another'},mapId:12,ownerId:'A'}),false);
    assert.equal(workflow.isGuidedBoundaryEntry({draft,state,mapId:12,ownerId:'B'}),false);
});

// Fix 2: a persisted request may legitimately not have reached the server yet.
test('reload not-found offers explicit authorized Place choice then retries the original request key',async()=>{
    const events=[],navigations=[];
    const session=workflow.createBoundaryWorkflowSession({ownerId:'A',id:sequence(),onNavigate:(...args)=>navigations.push(args),api:{
        getBoundaryZoneMap:async request=>{events.push(['GET',request]);throw Object.assign(new Error('Request not found'),{status:404,code:'BOUNDARY_REQUEST_NOT_FOUND'});},
        startBoundaryZoneMap:async payload=>{events.push(['POST',payload]);return {mapId:12,hardAssetId:9,name:'Canonical Place'};},
    }});
    await session.recoverPointers({boundaryWorkflowId:'workflow-old',boundaryRequestId:'request-old'});
    assert.equal(session.draft.hardAssetId,undefined);assert.equal(events.length,1);
    assert.equal(session.requestStarterRetry(),true);assert.equal(session.draft.wizardOpen,true);assert.equal(session.draft.requestId,'request-old');
    await assert.rejects(session.retryStarterWithPlace('',[{id:9}]),/Choose/);
    await assert.rejects(session.retryStarterWithPlace(10,[{id:9}]),/authorized/);
    assert.equal(events.length,1,'missing or noncandidate Place must not start another request');
    await session.retryStarterWithPlace('9',[{id:9,name:'Authorized Place'}]);
    assert.deepEqual(events,[['GET','request-old'],['GET','request-old'],['POST',{requestId:'request-old',hardAssetId:9}]]);
    assert.equal(navigations[0][1].boundaryRequestId,'request-old');
    assert.equal('hardAssetId' in navigations[0][1],false);
});

test('same-key retry reports a changed-payload refusal and deleted maps keep their separate new-request path',async()=>{
    let attempts=0;
    const session=workflow.createBoundaryWorkflowSession({ownerId:'A',id:sequence(),api:{
        getBoundaryZoneMap:async()=>{throw Object.assign(new Error('Request not found'),{status:404,code:'BOUNDARY_REQUEST_NOT_FOUND'});},
        startBoundaryZoneMap:async()=>{attempts++;throw Object.assign(new Error('This request was already used for another Place. Read its saved result.'),{status:409,code:'BOUNDARY_REQUEST_CONFLICT'});},
    }});
    await session.recoverPointers({boundaryWorkflowId:'workflow-old',boundaryRequestId:'request-old'});session.requestStarterRetry();
    await assert.rejects(session.retryStarterWithPlace(9,[{id:9}]),{code:'BOUNDARY_REQUEST_CONFLICT'});
    assert.equal(session.draft.requestId,'request-old');assert.match(session.draft.error,/another Place/);assert.equal(session.draft.wizardOpen,true);assert.equal(attempts,1);
    session.update({phase:'map-unavailable',starterErrorCode:'BOUNDARY_ZONE_MAP_UNAVAILABLE'});
    assert.equal(session.requestStarterRetry(),false);assert.match(session.draft.error,/new Care Map/);assert.equal(attempts,1);
});

test('retry GET tombstone clears retry mode and only the explicit authorized restart mints a fresh request',async()=>{
    const posts=[];let reads=0;
    const session=workflow.createBoundaryWorkflowSession({ownerId:'A',id:sequence(),api:{
        getBoundaryZoneMap:async()=>{reads++;throw Object.assign(new Error(reads===1?'Not found':'Map deleted'),{status:404,code:reads===1?'BOUNDARY_REQUEST_NOT_FOUND':'BOUNDARY_ZONE_MAP_UNAVAILABLE'});},
        startBoundaryZoneMap:async payload=>{posts.push(payload);return {mapId:22,hardAssetId:9,name:'Canonical Place'};},
    }});
    await session.recoverPointers({boundaryWorkflowId:'workflow-old',boundaryRequestId:'request-old'});session.requestStarterRetry();
    await assert.rejects(session.retryStarterWithPlace(9,[{id:9}]),/Map deleted/);
    assert.equal(session.draft.retryingStarter,false);assert.equal(session.draft.requestId,'request-old');assert.deepEqual(posts,[]);
    session.update({wizardOpen:false});assert.equal(session.requestStarterRestart(),true);
    assert.equal(session.draft.phase,'restart');assert.equal(session.draft.retryingStarter,false);assert.equal(session.draft.requestId,'request-old');
    await assert.rejects(session.restart([]),/authorized/);assert.equal(session.draft.requestId,'request-old');assert.deepEqual(posts,[]);
    await session.restart([{id:9}]);assert.equal(posts.length,1);assert.notEqual(posts[0].requestId,'request-old');assert.equal(posts[0].hardAssetId,9);
});

test('accepted starter cancellation survives older history recovery and a new Draw gets fresh identity',async()=>{
    const accepted=new Map(), posts=[],navigation=[],pointer=[];
    const api={startBoundaryZoneMap:async payload=>{posts.push(payload.requestId);const result={...payload,mapId:10+posts.length,name:'Place'};accepted.set(payload.requestId,result);return result;},
        cancelBoundaryZoneMap:async id=>{accepted.get(id).guidanceCancelled=true;return accepted.get(id);},getBoundaryZoneMap:async id=>accepted.get(id)};
    const session=workflow.createBoundaryWorkflowSession({ownerId:'A',id:sequence(),api,onNavigate:(url,state)=>navigation.push(state),onPointers:state=>pointer.push(state)});
    await session.startDraw({hardAssetId:21});
    const prior=navigation[0];
    await session.cancel();
    assert.equal(pointer.at(-1)?.boundaryWorkflowId,undefined);
    const fresh=workflow.createBoundaryWorkflowSession({ownerId:'A',id:sequence(),api});
    await fresh.recoverPointers(prior);
    assert.equal(workflow.isGuidedBoundaryEntry({draft:fresh.draft,state:prior,ownerId:'A',mapId:11}),false);
    await session.startDraw({hardAssetId:21});assert.equal(posts.length,2);assert.notEqual(posts[0],posts[1]);
});

test('cancelling an in-flight starter fences navigation and reconciles a lost cancellation ACK on its original identity',async()=>{
    const gate=deferred(),history=[],navigate=[],events=[];
    const outcome={mapId:5,hardAssetId:21};
    const api={startBoundaryZoneMap:async({requestId})=>{outcome.requestId=requestId;events.push('start');await gate.promise;return outcome;},
        cancelBoundaryZoneMap:async id=>{assert.equal(id,outcome.requestId);events.push('cancel');throw new Error('lost ACK');},
        getBoundaryZoneMap:async id=>{assert.equal(id,outcome.requestId);events.push('get');return {...outcome,guidanceCancelled:true};}};
    const session=workflow.createBoundaryWorkflowSession({ownerId:'A',api,id:sequence(),onPointers:s=>history.push(s),onNavigate:url=>navigate.push(url)});
    const started=session.startDraw({hardAssetId:21});await new Promise(resolve=>setImmediate(resolve));
    const cancelled=session.cancel();
    assert.equal(history.length,1);assert.equal(session.draft.cancelPending,true);
    gate.resolve();await assert.rejects(started,{code:'BOUNDARY_SESSION_CHANGED'});await cancelled;
    assert.deepEqual(events,['start','cancel','get']);assert.deepEqual(navigate,[]);assert.deepEqual(history.at(-1),{});
});
test('unconfirmed cancellation preserves the pointer and reports uncertainty until the accepted request is readable',async()=>{
    const pointer=[],api={startBoundaryZoneMap:async()=>{throw Error('lost');},cancelBoundaryZoneMap:async()=>{throw Error('lost');},getBoundaryZoneMap:async()=>{throw Error('not found');}};
    const session=workflow.createBoundaryWorkflowSession({ownerId:'A',api,id:sequence(),onPointers:s=>pointer.push(s)});
    await assert.rejects(session.startDraw({hardAssetId:21}));const requestId=session.draft.requestId;
    await assert.rejects(session.cancel(),/unconfirmed/);assert.equal(session.draft.cancelPending,true);
    assert.equal(pointer.at(-1).boundaryRequestId,requestId);assert.notEqual(session.draft.phase,'cancelled');
    await assert.rejects(session.startDraw({hardAssetId:21}),/cancellation/);
    api.getBoundaryZoneMap=async()=>({requestId,guidanceCancelled:true});await session.cancel();assert.deepEqual(pointer.at(-1),{});
});
