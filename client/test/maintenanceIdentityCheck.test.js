import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {createHelpContentApi} from '../src/features/help-content/helpContentApi.js';
const json=(value,status=200)=>{const response=new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});Object.defineProperty(response,'url',{value:'https://api.carearound.sg/api/help/cms/binding-observation'});return response;};
const identity=()=>({ok:true,branch_id:'br-green-union-ailxs0g3',database:'neondb',effective_role:'fictional_role',session_role:'fictional_login',workerVersionId:'12345678-1234-1234-1234-123456789012',sourceRevision:'a'.repeat(40),observedAt:'2035-01-01T00:00:00.000Z'});
const unknown='Database identity could not be confirmed. Stop and do not retry.';
let loaded;
async function component(){
    if(loaded)return loaded;
    const {outputFiles}=await build({stdin:{contents:`import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import MaintenanceIdentityCheck,{observeIdentityOnce,identityPermitReady} from './MaintenanceIdentityCheck.jsx'; export {observeIdentityOnce,identityPermitReady}; export const render=(props={})=>renderToStaticMarkup(<MaintenanceIdentityCheck {...props}/>);`,resolveDir:new URL('../src/features/help-content',import.meta.url).pathname,loader:'jsx'},bundle:true,write:false,format:'cjs',platform:'node',jsx:'automatic',logLevel:'silent'});
    const module={exports:{}};new Function('require','module','exports',outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);loaded=module.exports;return loaded;
}
test('dedicated observation uses exactly the fixed cookie-only empty POST without generic session headers',async()=>{
    const calls=[],api=createHelpContentApi({base:'https://fictional.invalid/api',fetchImpl:async(url,options)=>{calls.push({url,options});return json(identity());}});
    assert.equal(typeof api.observeBindingOnce,'function');const result=await api.observeBindingOnce();assert.deepEqual(result,identity());assert.equal(calls.length,1);
    assert.equal(calls[0].url,'https://api.carearound.sg/api/help/cms/binding-observation');const o=calls[0].options;
    assert.equal(o.method,'POST');assert.equal(o.credentials,'include');assert.equal(o.cache,'no-store');assert.equal(o.redirect,'error');assert.ok(o.signal instanceof AbortSignal);assert.equal(Object.hasOwn(o,'body'),false);assert.equal(Object.hasOwn(o,'headers'),false);
});
for(const kind of ['extra-field','oversize','malformed','redirect','error','network'])test(`observation rejects ${kind} with fixed text and no retry`,async()=>{
    let calls=0;const api=createHelpContentApi({fetchImpl:async()=>{calls++;if(kind==='network')throw Error('PRIVATE_NETWORK_CANARY');if(kind==='redirect')return new Response(null,{status:302});if(kind==='error')return json({error:'PRIVATE_ERROR_CANARY'},503);if(kind==='malformed')return json({...identity(),sourceRevision:'PRIVATE_CANARY'});if(kind==='oversize')return json({...identity(),effective_role:'PRIVATE_CANARY'.repeat(500)});return json({...identity(),private:'PRIVATE_CANARY'});}});
    assert.equal(typeof api.observeBindingOnce,'function');await assert.rejects(api.observeBindingOnce(),error=>error.message===unknown);assert.equal(calls,1);
});
test('explicit permit refresh projects only server metadata and leaves saved/unsaved draft envelopes untouched',async()=>{
    const draft={articles:[{id:'fictional',title:'Unsaved private draft'}]},before=structuredClone(draft),calls=[];
    const envelope={workspace:{articles:[{id:'fictional',title:'Server version must not replace draft'}]},etag:'server-etag',maintenanceIdentityPermit:{armed:true,expiresAt:'2035-01-01T00:15:00.000Z'}};
    const api=createHelpContentApi({base:'/api',fetchImpl:async(url,options)=>{calls.push({url,options});return json(envelope);}});
    assert.equal(typeof api.identityPermitStatus,'function');const result=await api.identityPermitStatus();assert.deepEqual(result,envelope.maintenanceIdentityPermit);assert.deepEqual(draft,before);assert.equal(calls.length,1);assert.equal(calls[0].url,'/api/help/cms');assert.equal(calls[0].options.method,'GET');assert.equal(Object.hasOwn(result,'workspace'),false);assert.equal(Object.hasOwn(result,'etag'),false);
});
test('missing or malformed readiness metadata stays closed',async()=>{
    for(const value of [undefined,null,{armed:true},{armed:true,expiresAt:'invalid'},{armed:true,expiresAt:'2035-01-01T00:15:00.000Z',private:'PRIVATE_CANARY'}]){
        const api=createHelpContentApi({fetchImpl:async()=>json({maintenanceIdentityPermit:value})});assert.equal(typeof api.identityPermitStatus,'function');assert.deepEqual(await api.identityPermitStatus(),{armed:false,expiresAt:null});
    }
});
test('the temporary control makes no requests on render and starts disabled pending explicit refresh',async()=>{
    let calls=0;const html=(await component()).render({api:{identityPermitStatus:()=>{calls++;},observeBindingOnce:()=>{calls++;}},attemptLatch:{current:false}});
    assert.equal(calls,0);assert.match(html,/Refresh permit status/);assert.match(html,/Check database identity once/);assert.match(html,/disabled=""/);assert.doesNotMatch(html,/fictional_role|br-green|sourceRevision/);
});
test('one-shot action latches synchronously before dispatch and rejects double activation/remount',async()=>{
    const {observeIdentityOnce}=await component();let calls=0,finish;const latch={current:false},permit={armed:true,expiresAt:new Date(Date.now()+60000).toISOString()};
    const observe=()=>{calls++;assert.equal(latch.current,true);return new Promise(r=>finish=r);};
    const pending=observeIdentityOnce({latch,permit,observe});assert.equal(latch.current,true);assert.equal(calls,1);
    assert.deepEqual(await observeIdentityOnce({latch,permit,observe}),{state:'disabled'});finish(identity());assert.deepEqual(await pending,{state:'complete',value:identity()});assert.deepEqual(await observeIdentityOnce({latch,permit,observe}),{state:'disabled'});assert.equal(calls,1);
});
test('failure remains one-shot with a safe unknown result and no raw error/retry',async()=>{
    const {observeIdentityOnce}=await component();let calls=0;const latch={current:false},permit={armed:true,expiresAt:new Date(Date.now()+60000).toISOString()},observe=async()=>{calls++;throw Error('PRIVATE_CANARY');};
    assert.deepEqual(await observeIdentityOnce({latch,permit,observe}),{state:'unknown'});assert.deepEqual(await observeIdentityOnce({latch,permit,observe}),{state:'disabled'});assert.equal(calls,1);
});
test('expired, missing or malformed server readiness rejects before any observation',async()=>{
    const {observeIdentityOnce,identityPermitReady}=await component();let calls=0;
    for(const permit of [null,{armed:false,expiresAt:null},{armed:true,expiresAt:new Date(Date.now()-1).toISOString()},{armed:true,expiresAt:'invalid'}]){
        const latch={current:false};assert.equal(identityPermitReady(permit),false);assert.deepEqual(await observeIdentityOnce({latch,permit,observe:()=>{calls++;}}),{state:'disabled'});assert.equal(latch.current,false);
    }assert.equal(calls,0);
});
