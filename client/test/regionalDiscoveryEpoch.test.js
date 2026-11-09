import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateFrozenRegionalDiscoveryFixtures } from '../../tests/fixtures/regional-discovery/serialize.mjs';
import { createRegionalDiscoveryController } from '../src/features/regional-discovery/useRegionalDiscovery.js';
import { buildRegionalDiscoveryPresentation } from '../src/features/regional-discovery/regionalDiscoveryPresentation.js';
import { createRegionalDiscoverySelection, regionalDiscoverySelectionReducer } from '../src/features/regional-discovery/regionalDiscoverySelection.js';
await validateFrozenRegionalDiscoveryFixtures();
const fixture=name=>JSON.parse(readFileSync(new URL(`../../tests/fixtures/regional-discovery/server-dto/${name}.json`,import.meta.url),'utf8'));
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function setup(initial='inside-s1') {
    const requests=[];
    const controller=createRegionalDiscoveryController({token:'fictional-token',initialPayload:fixture(initial),evaluateImpl:(token,options)=>{const request={...deferred(),token,...options};requests.push(request);return request.promise;}});
    return {controller,requests};
}
function assertRetired(payload) {
    assert.equal(payload.evaluation.status,'none');
    assert.ok(payload.entries.every(entry=>!entry.recommended && entry.distanceMeters===null));
    for (const entry of payload.entries) for (const contact of Object.values(entry.contacts)) if(contact.appliesTo==='entered-location') { assert.notEqual(contact.status,'available'); assert.equal(contact.href,undefined); assert.equal(contact.value,undefined); }
}
test('edit_retires_old_recipient_before_response', async () => {
    const {controller,requests}=setup();
    controller.setPostalInput('000002');
    assertRetired(controller.getSnapshot().state.payload);
    const pending=controller.submitPostal('000002');
    assertRetired(controller.getSnapshot().state.payload);
    controller.setPostalInput('00000');
    assert.equal(requests[0].signal.aborted,true);
    assert.equal(controller.getSnapshot().postalInput,'00000');
    requests[0].resolve(fixture('inside-s2'));await pending;
    assertRetired(controller.getSnapshot().state.payload);
    assert.equal(controller.getSnapshot().postalInput,'00000');
});
test('late_response_cannot_restore_old_sr', async () => {
    const {controller,requests}=setup('base');
    controller.setPostalInput('000001');const first=controller.submitPostal('000001');
    controller.setPostalInput('000002');const second=controller.submitPostal('000002');
    const s1=fixture('inside-s1'),s2=fixture('inside-s2');
    assert.equal(s1.snapshotRevision,s2.snapshotRevision);
    // Explicit unit-test channel variation of genuine DTOs; never serialized/browser fixtures.
    s1.entries[0].contacts.email={status:'available',appliesTo:'entered-location',label:'Enquiry',value:'s1@example.test',href:'mailto:s1@example.test'};
    s2.entries[0].contacts.email={status:'available',appliesTo:'entered-location',label:'Enquiry',value:'s2@example.test',href:'mailto:s2@example.test'};
    requests[1].resolve(s2);await second;
    const final=controller.getSnapshot().state.payload;
    assert.equal(final.entries[0].contacts.email.value,'s2@example.test');
    requests[0].resolve(s1);await first;
    assert.equal(controller.getSnapshot().state.payload,final);
    assert.equal(controller.getSnapshot().postalInput,'000002');
});
test('Clear is idempotent after the form empty edit and ignores late successes and errors',async()=>{
    const {controller,requests}=setup();
    const pending=controller.submitPostal('000001');
    controller.setPostalInput('');controller.clearPostal();controller.clearPostal();
    assert.equal(controller.getSnapshot().postalInput,'');assertRetired(controller.getSnapshot().state.payload);
    requests[0].reject(Object.assign(new Error('private error'),{status:404}));await pending;
    assert.equal(controller.getSnapshot().state.error,'');assertRetired(controller.getSnapshot().state.payload);
});
test('Retry advances epoch even for the same postal and validates the whole replacement',async()=>{
    const {controller,requests}=setup();
    const first=controller.retry();const second=controller.retry();
    assert.equal(requests[0].signal.aborted,true);
    requests[1].resolve(fixture('inside-s1'));await second;
    const current=controller.getSnapshot();
    requests[0].reject(new Error('old'));await first;
    assert.equal(controller.getSnapshot(),current);
    const third=controller.retry();const invalid=fixture('inside-s1');invalid.entries[1].name='';
    requests[2].resolve(invalid);await third;
    assertRetired(controller.getSnapshot().state.payload);
    assert.equal(controller.getSnapshot().state.error,'request-failed');
});
test('token teardown aborts and clears the previous viewer before a new identity loads',async()=>{
    const {controller,requests}=setup();const pending=controller.retry();controller.stop();
    assert.equal(requests[0].signal.aborted,true);assert.equal(controller.getSnapshot().state.payload,null);
    const other=createRegionalDiscoveryController({token:'new-token',initialPayload:fixture('base'),evaluateImpl:()=>{throw Error('no implicit evaluate');}});
    await other.start();assert.equal(other.getSnapshot().state.payload.evaluation.status,'none');
    requests[0].resolve(fixture('inside-s1'));await pending;
    assert.equal(controller.getSnapshot().state.payload,null);
});
test('revoked embed clears everything; isolated resource withdrawal replaces only live membership',async()=>{
    const {controller,requests}=setup();
    const first=controller.retry();const withdrawn=fixture('resource-withdrawn');
    // This frozen controller artifact is an unevaluated GET result, so use a base reload.
    controller.clearPostal();
    requests[0].resolve(fixture('inside-s1'));await first;
    const guest=createRegionalDiscoveryController({token:'t',loadImpl:async()=>withdrawn});await guest.start();
    assert.equal(guest.getSnapshot().state.payload.entries.length,3);
    const revoked=setup();const pending=revoked.controller.retry();revoked.requests[0].reject(Object.assign(new Error('no'),{status:404}));await pending;
    assert.equal(revoked.controller.getSnapshot().state.payload,null);assert.equal(revoked.controller.getSnapshot().state.error,'unavailable');
});
test('invalid and uncertain lookups never assert outside; confirmed outside retains curated list',async()=>{
    const {controller,requests}=setup('base');
    await controller.submitPostal('bad');assert.equal(requests.length,0);assert.equal(controller.getSnapshot().state.error,'invalid-postal');
    for(const name of ['coverage-unconfirmed','postal-unresolved','outside']) {
        const dto=fixture(name);controller.setPostalInput(dto.evaluation.postalCode);const pending=controller.submitPostal(dto.evaluation.postalCode);requests.at(-1).resolve(dto);await pending;
        assert.equal(controller.getSnapshot().state.payload.evaluation.status,dto.evaluation.status);
        assert.equal(controller.getSnapshot().state.payload.entries.length,4);
        assert.ok(controller.getSnapshot().state.payload.entries.every(e=>e.distanceMeters===null&&!e.recommended));
    }
});
test('filter_change_prunes_selection without re-geocoding or retiring valid postal evaluation',()=>{
    const {controller,requests}=setup();const snapshot=controller.getSnapshot();
    const base=buildRegionalDiscoveryPresentation(snapshot.state.payload);
    let selected=regionalDiscoverySelectionReducer(createRegionalDiscoverySelection(),{type:'VIEW_SERVICE',entryKey:'hard:101',placeKeys:['hard-101']});
    const filtered=buildRegionalDiscoveryPresentation(snapshot.state.payload,{selectedServiceKey:'services'});
    selected=regionalDiscoverySelectionReducer(selected,{type:'VISIBLE_ENTRIES_CHANGED',entryKeys:filtered.entries.map(e=>e.entryKey),placeKeysByEntryKey:Object.fromEntries(filtered.entries.map(e=>[e.entryKey,e.pinPlaceKeys]))});
    assert.ok(base.entries.length>filtered.entries.length);assert.equal(selected.pane,'list');assert.equal(selected.entryKey,null);
    assert.equal(requests.length,0);assert.equal(controller.getSnapshot(),snapshot);
    assert.equal(snapshot.state.payload.evaluation.status,'inside-region');
});
test('injected owner evaluator with initial payload never performs a guest directory fetch',async()=>{
    let loads=0,evaluations=0;
    const controller=createRegionalDiscoveryController({token:'owner:7:4',initialPayload:fixture('base'),loadImpl:async()=>{loads++;throw Error('guest forbidden');},evaluateImpl:async(token,{postalCode,signal})=>{evaluations++;assert.equal(token,'owner:7:4');assert.equal(postalCode,'000002');assert.equal(signal.aborted,false);return fixture('inside-s2');}});
    await controller.start();controller.setPostalInput('000002');await controller.submitPostal('000002');controller.clearPostal();
    assert.equal(loads,0);assert.equal(evaluations,1);assertRetired(controller.getSnapshot().state.payload);
});

test('late base directory fetch cannot overwrite an explicitly evaluated location',async()=>{
    const load=deferred();let loadSignal;
    const controller=createRegionalDiscoveryController({token:'t',loadImpl:(_token,{signal})=>{loadSignal=signal;return load.promise;},evaluateImpl:undefined});
    const initial=controller.start();controller.setPostalInput('000002');
    // Use the real public evaluator with an entirely local fetch boundary.
    const oldFetch=globalThis.fetch;globalThis.fetch=async()=>Response.json(fixture('inside-s2'));
    try {
        const selected=controller.submitPostal('000002');await selected;
        const final=controller.getSnapshot();assert.equal(loadSignal.aborted,true);
        load.resolve(fixture('base'));await initial;
        assert.equal(controller.getSnapshot(),final);assert.equal(final.state.payload.evaluation.postalCode,'000002');
    } finally {globalThis.fetch=oldFetch;}
});
test('injected evaluator must echo the exact entered postal context before atomic commit',async()=>{
    const {controller,requests}=setup();controller.setPostalInput('000002');const pending=controller.submitPostal('000002');
    requests[0].resolve(fixture('inside-s1'));await pending;
    assertRetired(controller.getSnapshot().state.payload);assert.equal(controller.getSnapshot().state.error,'request-failed');
    assert.equal(controller.getSnapshot().postalInput,'000002');
});
test('current lookup failures keep safe base browsing and a temporary draft without asserting outside',async()=>{
    const {controller,requests}=setup();controller.setPostalInput('000002');const pending=controller.submitPostal('000002');
    requests[0].reject(new Error('sensitive body / recipient / postal'));await pending;
    assertRetired(controller.getSnapshot().state.payload);assert.equal(controller.getSnapshot().postalInput,'000002');
    assert.equal(controller.getSnapshot().state.error,'request-failed');assert.equal(requests.length,1);
});

test('retired token callbacks cannot issue a fresh directory request',async()=>{
    let loads=0;
    const controller=createRegionalDiscoveryController({token:'old',loadImpl:async()=>{loads++;return fixture('base');}});
    controller.stop();await controller.retry();
    assert.equal(loads,0);assert.equal(controller.getSnapshot().state.payload,null);
});

for (const name of ['inside-s1','inside-s2']) {
    for (const action of ['edit','clear','retry','failure']) {
        test(`${name} retirement restores publication order on ${action} without mutation or withdrawn membership`,async()=>{
            const source=fixture(name), sourceBefore=structuredClone(source);
            // Explicit unit variation: retain only genuine live-withdrawal membership
            // in each genuine evaluated DTO. Frozen fixture files remain unchanged.
            const liveKeys=new Set(fixture('resource-withdrawn').entries.map(entry=>entry.entryKey));
            for (const withdraw of [false,true]) {
                const initial=structuredClone(source);
                if (withdraw) {
                    initial.entries=initial.entries.filter(entry=>liveKeys.has(entry.entryKey));
                    initial.pins=initial.pins.map(pin=>({...pin,entryKeys:pin.entryKeys.filter(key=>liveKeys.has(key))})).filter(pin=>pin.entryKeys.length);
                }
                const expected=initial.entries.map(entry=>({key:entry.entryKey,order:entry.publishedOrder})).sort((a,b)=>a.order-b.order);
                const requests=[];
                const controller=createRegionalDiscoveryController({token:'fictional-token',initialPayload:initial,evaluateImpl:(_token,options)=>{
                    const request={...deferred(),...options};requests.push(request);return request.promise;
                }});
                const previous=controller.getSnapshot().state.payload, previousBefore=structuredClone(previous);
                Object.freeze(previous.entries); // Sorting the previous DTO in place must fail.
                let pending;
                let draft=initial.evaluation.postalCode;
                if (action==='edit') {draft='00000';controller.setPostalInput(draft);}
                else if (action==='clear') {draft='';controller.setPostalInput('');controller.clearPostal();controller.clearPostal();}
                else if (action==='retry') pending=controller.retry();
                else pending=controller.submitPostal(draft);
                function assertPublicationRetirement() {
                    const snapshot=controller.getSnapshot(), retired=snapshot.state.payload;
                    assertRetired(retired);
                    assert.notEqual(retired,previous);
                    assert.deepEqual(retired.entries.map(entry=>entry.publishedOrder),expected.map(entry=>entry.order));
                    assert.deepEqual(retired.entries.map(entry=>entry.entryKey),expected.map(entry=>entry.key));
                    assert.deepEqual(retired.pins,previousBefore.pins);
                    assert.equal(snapshot.postalInput,draft);
                    assert.deepEqual(previous,previousBefore);
                    assert.deepEqual(initial,withdraw ? {...sourceBefore,
                        entries:sourceBefore.entries.filter(entry=>liveKeys.has(entry.entryKey)),
                        pins:sourceBefore.pins.map(pin=>({...pin,entryKeys:pin.entryKeys.filter(key=>liveKeys.has(key))})).filter(pin=>pin.entryKeys.length),
                    } : sourceBefore);
                    assert.deepEqual(source,sourceBefore);
                }
                assertPublicationRetirement();
                if (pending) {
                    assert.equal(requests.length,1);
                    if (action==='failure') {
                        requests[0].reject(new Error('Fictional lookup failure'));await pending;
                        assertPublicationRetirement();assert.equal(controller.getSnapshot().state.error,'request-failed');
                    } else {
                        requests[0].resolve(initial);await pending;
                        assert.deepEqual(controller.getSnapshot().state.payload,initial,'successful evaluations retain server ranking');
                        assert.deepEqual(previous,previousBefore);assert.deepEqual(source,sourceBefore);
                    }
                } else assert.equal(requests.length,0);
            }
        });
    }
}
