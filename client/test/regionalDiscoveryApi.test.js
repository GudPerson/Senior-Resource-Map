import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateFrozenRegionalDiscoveryFixtures } from '../../tests/fixtures/regional-discovery/serialize.mjs';
import { getRegionalDiscoveryDirectory, evaluateRegionalDiscovery, buildDiscoveryHandoffUrl } from '../src/lib/regionalDiscoveryApi.js';
await validateFrozenRegionalDiscoveryFixtures();
const fixture = name => JSON.parse(readFileSync(new URL(`../../tests/fixtures/regional-discovery/server-dto/${name}.json`, import.meta.url), 'utf8'));

test('guest endpoints omit credentials, disable caching and carry only explicit postal context', async () => {
    const calls = [], signal = new AbortController().signal;
    const options = { signal, baseCandidates:['https://api.example.test/api'], fetchImpl:async (url,init) => {
        calls.push({url,init}); return Response.json(fixture(init.method === 'POST' ? 'inside-s2' : 'base'));
    }};
    await getRegionalDiscoveryDirectory('shared token', options);
    await evaluateRegionalDiscovery('shared token', {...options,postalCode:'000002',profilePostal:'999999'});
    assert.deepEqual(calls.map(c=>c.url), ['https://api.example.test/api/shared-maps/shared%20token/embed/regional-discovery','https://api.example.test/api/shared-maps/shared%20token/embed/regional-discovery/evaluate']);
    for (const {init} of calls) { assert.equal(init.credentials,'omit'); assert.equal(init.cache,'no-store'); assert.equal(init.signal,signal); assert.equal(init.redirect,'error'); }
    assert.equal(calls[0].init.body,undefined);
    assert.deepEqual(JSON.parse(calls[1].init.body),{postalCode:'000002'});
});
test('invalid input makes zero requests and public errors never echo response bodies', async () => {
    let calls=0;
    await assert.rejects(()=>evaluateRegionalDiscovery('token',{postalCode:'123',fetchImpl:async()=>{calls++;}}),e=>e.code==='invalid-postal');
    assert.equal(calls,0);
    await assert.rejects(()=>getRegionalDiscoveryDirectory('token',{baseCandidates:['/api'],fetchImpl:async()=>Response.json({error:'private recipient 000002'},{status:404})}), e=>e.code==='unavailable' && e.status===404 && !/recipient|000002/.test(e.message));
});
test('entire DTO and matching postal context are validated before returning', async () => {
    const broken=fixture('inside-s2'); broken.entries[1].name='';
    for (const payload of [broken, fixture('inside-s1')]) {
        await assert.rejects(()=>evaluateRegionalDiscovery('token',{postalCode:'000002',baseCandidates:['/api'],fetchImpl:async()=>Response.json(payload)}), e=>e.code==='request-failed');
    }
    await assert.rejects(()=>getRegionalDiscoveryDirectory('token',{baseCandidates:['/api'],fetchImpl:async()=>Response.json(fixture('inside-s1'))}),e=>e.code==='request-failed');
});
test('abort does not start another fallback request', async () => {
    const controller=new AbortController();let calls=0;
    await assert.rejects(()=>getRegionalDiscoveryDirectory('token',{signal:controller.signal,baseCandidates:['/one','/two'],fetchImpl:async()=>{calls++;controller.abort();throw new DOMException('Aborted','AbortError');}}),e=>e.name==='AbortError');
    assert.equal(calls,1);
});
test('handoff URL encodes entered postal only and omits unsupported service filters', () => {
    assert.equal(buildDiscoveryHandoffUrl({postalCode:'000002',canonicalServiceQuery:'unknown / & ?',homePostalCode:'999999'}),'/discover?postal=000002');
    assert.equal(buildDiscoveryHandoffUrl({postalCode:'000002'}),'/discover?postal=000002');
    assert.equal(buildDiscoveryHandoffUrl({postalCode:'00000&',canonicalServiceQuery:'services'}),'/discover');
});

let ui;
async function uiRenderers() {
    if(ui) return ui;
    const {build}=await import('esbuild');const {createRequire}=await import('node:module');
    const {outputFiles}=await build({
        stdin:{contents:`import React from 'react'; import {renderToReadableStream,renderToStaticMarkup} from 'react-dom/server';
            import App from './EmbeddedApp.jsx'; import Page,{getRegionalDiscoveryCopy} from './pages/RegionalDiscoveryPage.jsx';
            import Detail from './features/regional-discovery/RegionalServiceDetail.jsx';
            export async function app(){const stream=await renderToReadableStream(<App/>);await stream.allReady;return new Response(stream).text();}
            export const detail=props=>renderToStaticMarkup(<Detail {...props}/>);export const copy=getRegionalDiscoveryCopy;`,resolveDir:new URL('../src/',import.meta.url).pathname,loader:'jsx'},
        plugins:[{name:'regional-host-boundaries',setup(build){
            build.onResolve({filter:/^react-router-dom$/},()=>({path:'router',namespace:'regional-host'}));
            build.onResolve({filter:/useRegionalDiscovery\.js$/},()=>({path:'hook',namespace:'regional-host'}));
            build.onResolve({filter:/pages\/EmbeddedMapPage\.jsx$/},()=>({path:'compact',namespace:'regional-host'}));
            build.onResolve({filter:/components\/DirectoryMap\.jsx$/},()=>({path:'map',namespace:'regional-host'}));
            build.onResolve({filter:/^react-leaflet$/},()=>({path:'leaflet',namespace:'regional-host'}));
            build.onLoad({filter:/.*/,namespace:'regional-host'},args=>({loader:'jsx',resolveDir:process.cwd(),contents:args.path==='router' ? `import React from 'react';import{MemoryRouter}from 'react-router';export * from 'react-router';export const BrowserRouter=({children})=><MemoryRouter initialEntries={[globalThis.__regionalTestPath]}>{children}</MemoryRouter>;` : args.path==='hook' ? `export default function useRegionalDiscovery(){return globalThis.__regionalHostSnapshot;}` : args.path==='compact' ? `import React from 'react';export default function Compact(){return <p>Legacy compact page</p>;}` : args.path==='leaflet' ? 'export function useMap(){return {}}' : `import React from 'react';export default function Map(){return <p>Public map renderer boundary</p>}`}));
        }}],bundle:true,write:false,format:'cjs',platform:'node',jsx:'automatic',logLevel:'silent',
    });
    const module={exports:{}};new Function('require','module','exports',outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);ui=module.exports;return ui;
}
function hostSnapshot(payload,postalInput=payload?.evaluation.postalCode || '',error='') {
    return {postalInput,state:{payload,loading:false,evaluating:false,error},setPostalInput(){},submitPostal(){},clearPostal(){},retry(){}};
}
test('regional sibling renders with zero storage calls while compact retains its original preference wrapper',async()=>{
    const renderer=await uiRenderers();const original=globalThis.localStorage;let reads=0;
    globalThis.localStorage={getItem(){reads++;return null;},setItem(){throw Error('Unexpected storage write');}};
    try {
        globalThis.__regionalTestPath='/embed/maps/fictional-token/regional-discovery';globalThis.__regionalHostSnapshot=hostSnapshot(fixture('base'));
        assert.match(await renderer.app(),/Local services/);assert.equal(reads,0);
        globalThis.__regionalTestPath='/embed/maps/fictional-token';
        assert.match(await renderer.app(),/Legacy compact page/);assert.equal(reads,2,'legacy A11y initializers still read their existing preferences');
    } finally {globalThis.localStorage=original;delete globalThis.__regionalTestPath;delete globalThis.__regionalHostSnapshot;}
});
test('explicit confirmed-outside handoff opens a safe new tab using entered postal; uncertain and pending views do not hand off',async()=>{
    const renderer=await uiRenderers();globalThis.__regionalTestPath='/embed/maps/token/regional-discovery';
    try {
        const outside=fixture('outside');globalThis.__regionalHostSnapshot=hostSnapshot(outside);
        const html=await renderer.app();
        assert.match(html,new RegExp(`href="/discover\\?postal=${outside.evaluation.postalCode}" target="_blank" rel="noopener noreferrer"`));
        assert.doesNotMatch(html,/999999|Locate me|Save service/);
        for(const name of ['base','postal-unresolved','coverage-unconfirmed']) {globalThis.__regionalHostSnapshot=hostSnapshot(fixture(name));assert.doesNotMatch(await renderer.app(),/href="\/discover/);}
        globalThis.__regionalHostSnapshot=hostSnapshot(outside,'00000');assert.doesNotMatch(await renderer.app(),/href="\/discover/);
        globalThis.__regionalHostSnapshot=hostSnapshot(null,'000002','request-failed');const failed=await renderer.app();assert.match(failed,/Services could not be checked/);assert.doesNotMatch(failed,/outside the area/);
    } finally {delete globalThis.__regionalTestPath;delete globalThis.__regionalHostSnapshot;}
});
test('actual detail localizes available contact headings with exact default fallback and unchanged actions',async()=>{
    const renderer=await uiRenderers();const {translateUi}=await import('../src/lib/i18n.js');
    const entry=fixture('inside-s1').entries.find(e=>e.entryKey==='soft:202');
    const original=renderer.detail({entry});assert.match(original,/ICCP enquiry email for this location/);
    for(const locale of ['en','zh-CN','ms','ta']) {
        const copy=renderer.copy(key=>translateUi(locale,key));
        const html=renderer.detail({entry,copy});
        assert.ok(html.includes(copy.contactLabels['entered-location'].email));
        assert.ok(html.includes(entry.contacts.email.href));assert.ok(html.includes(entry.contacts.phone.href));
        const unavailable=renderer.detail({entry:fixture('base').entries.find(e=>e.entryKey==='soft:202'),copy});
        assert.doesNotMatch(unavailable,/mailto:|href="tel:/);
        assert.ok(unavailable.includes(copy.needsPostal));
        const withdrawn=renderer.detail({entry:fixture('contact-withdrawn').entries.find(e=>e.entryKey==='soft:202'),copy});
        assert.doesNotMatch(withdrawn,/mailto:|href="tel:/);assert.ok(withdrawn.includes(copy.unavailableContact));
    }
});

test('Discovery landing hook prioritizes the explicit handoff postal over saved Home',async()=>{
    const {build}=await import('esbuild');const {createRequire}=await import('node:module');
    const {outputFiles}=await build({entryPoints:[new URL('../src/features/discover/useDiscoveryLocation.js',import.meta.url).pathname],bundle:true,write:false,format:'cjs',platform:'node',logLevel:'silent',plugins:[{name:'landing-infrastructure',setup(build){
        build.onResolve({filter:/^(react)$|\/lib\/(geo|searchLocation)\.js$/},args=>({path:args.path,namespace:'landing-test'}));
        build.onLoad({filter:/.*/,namespace:'landing-test'},args=>({loader:'js',contents:args.path==='react' ? `export const useState=v=>globalThis.__regionalLanding.state(v);export const useRef=v=>globalThis.__regionalLanding.ref(v);export const useEffect=fn=>globalThis.__regionalLanding.effects.push(fn);export const useMemo=fn=>fn();export const useCallback=fn=>fn;` : args.path.endsWith('/geo.js') ? `export async function searchOneMap(){throw Error('Unexpected geocoding request');}` : 'export const GEOLOCATION_OPTIONS={};export function clearSearchLocation(){}export function saveSearchLocation(){}'}));
    }}]});
    const module={exports:{}};new Function('require','module','exports',outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
    const previousWindow=globalThis.window;const states=[],refs=[];let si=0,ri=0;
    const hooks={effects:[],state(value){const i=si++;if(!(i in states))states[i]=typeof value==='function'?value():value;return [states[i],v=>{states[i]=typeof v==='function'?v(states[i]):v;}];},ref(value){return refs[ri++] ||= {current:value};}};
    globalThis.__regionalLanding=hooks;
    globalThis.window={location:{search:'?postal=000002'},setTimeout:()=>1,clearTimeout(){}};
    try {
        const assets=[{postalCode:'000002',lat:1.3,lng:103.8,address:'Fictional entered location'},{postalCode:'999999',lat:1.4,lng:103.9,address:'Fictional saved Home'}];
        const render=()=>{si=0;ri=0;hooks.effects=[];return module.exports.useDiscoveryLocation(assets,'999999');};
        const initial=render();assert.equal(initial.postalInput,'000002');
        hooks.effects.forEach(effect=>effect());await Promise.resolve();await Promise.resolve();
        const landed=render();assert.equal(landed.effectiveOrigin.postalCode,'000002');assert.equal(landed.effectiveOrigin.source,'postal');assert.equal(landed.effectiveOrigin.address,'Fictional entered location');
    } finally {globalThis.window=previousWindow;delete globalThis.__regionalLanding;}
});
