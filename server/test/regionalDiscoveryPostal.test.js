import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveRegionalDiscoveryPostal } from '../src/utils/regionalDiscoveryPostal.js';

// Controlled OneMap-shaped results only; these postals are not claims about real coverage.
const result = {POSTAL:'000001',LATITUDE:'1.3',LONGITUDE:'103.8',ADDRESS:'Fictional address'};
const response = results => ({ok:true,json:async()=>({results})});
test('leading_zero_is_preserved and exact result is selected', async () => {
    const resolved = await resolveRegionalDiscoveryPostal('000001',{fetchImpl:async url=>{
        assert.equal(new URL(url).searchParams.get('searchVal'),'000001');
        return response([{...result,POSTAL:'000002'},result]);
    }});
    assert.deepEqual(resolved,{status:'resolved',postalCode:'000001',location:{lat:1.3,lng:103.8}});
    assert.equal(Object.hasOwn(resolved,'address'),false);
});
test('invalid postal formats never issue lookup', async () => {
    for (const postal of [1, null,'12345','1234567',' 000001','000001 ','00000x']) {
        const resolved = await resolveRegionalDiscoveryPostal(postal,{fetchImpl:()=>{throw new Error('must not fetch');}});
        assert.equal(resolved.status,'postal-unresolved');
        assert.equal(resolved.reason,'invalid-format');
    }
});
test('nonexact result, non-Singapore and malformed coordinates fail closed', async () => {
    for (const candidate of [
        {...result,POSTAL:'000002'}, {...result,LATITUDE:'51.5',LONGITUDE:'-0.1'},
        {...result,LATITUDE:'1.3junk'}, {...result,LATITUDE:null},
    ]) {
        const resolved=await resolveRegionalDiscoveryPostal('000001',{fetchImpl:async()=>response([candidate])});
        assert.equal(resolved.status,'postal-unresolved');
        assert.equal(Object.hasOwn(resolved,'location'),false);
    }
});
test('failed status, invalid JSON and fetch failure are unresolved', async () => {
    for (const fetchImpl of [async()=>({ok:false}),async()=>({ok:true,json:async()=>{throw new Error('invalid');}}),async()=>{throw new Error('offline');}]) {
        assert.equal((await resolveRegionalDiscoveryPostal('000001',{fetchImpl})).status,'postal-unresolved');
    }
});
test('pre-abort never fetches and stale response after cancellation is ignored', async () => {
    const pre=new AbortController(); pre.abort();
    assert.equal((await resolveRegionalDiscoveryPostal('000001',{signal:pre.signal,fetchImpl:()=>{throw new Error('must not fetch');}})).reason,'aborted');
    const active=new AbortController();
    const pending=resolveRegionalDiscoveryPostal('000001',{signal:active.signal,fetchImpl:async()=>{
        active.abort(); return response([result]);
    }});
    const resolved=await pending;
    assert.equal(resolved.reason,'aborted');
    assert.equal(Object.hasOwn(resolved,'location'),false);
});
test('timeout bounds fetch and response body even when fetch ignores abort', async () => {
    for (const fetchImpl of [()=>new Promise(()=>{}),async()=>({ok:true,json:()=>new Promise(()=>{})})]) {
        const resolved=await resolveRegionalDiscoveryPostal('000001',{timeoutMs:5,fetchImpl});
        assert.equal(resolved.reason,'timeout');
        assert.equal(Object.hasOwn(resolved,'location'),false);
    }
});
