import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRegionalDiscoveryResponse,onRequest} from '../functions/embed/maps/[token]/regional-discovery.js';
function fixture(method='GET') {const assets=[];return {assets,context:{params:{token:'fictional-token'},request:new Request('https://app.example.invalid/embed/maps/fictional-token/regional-discovery',{method}),env:{CAREAROUND_EMBED_API_BASE_URL:'https://api.example.invalid/api',ASSETS:{fetch:async url=>{assets.push(String(url));return new Response('<html>APP ROOT</html>',{headers:{'X-Frame-Options':'DENY'}});}}}}};}
const valid={schemaVersion:1,view:'regional-discovery',allowedOrigins:['https://host.example.invalid']};
test('regional_nested_path_enforces_current_origin',async()=>{const {context,assets}=fixture(); const response=await buildRegionalDiscoveryResponse(context,async(url,options)=>{assert.match(url,/\/embed\/regional-discovery-config$/);assert.equal(options.credentials,'omit');return Response.json(valid);});assert.equal(response.status,200);assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'self' https:\/\/host.example.invalid/);assert.equal(response.headers.get('x-frame-options'),null);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('permissions-policy'),'camera=(), microphone=(), geolocation=(), payment=()');assert.equal(assets.length,1);});
test('unavailable_config_never_serves_app',async()=>{for(const config of [{...valid,allowedOrigins:['http://localhost:3000']},{...valid,allowedOrigins:['https://host.example.invalid/path']},{...valid,allowedOrigins:['https://*.example.invalid']},{...valid,allowedOrigins:[]},{...valid,view:'compact'},{...valid,schemaVersion:999}]){const {context,assets}=fixture();const response=await buildRegionalDiscoveryResponse(context,async()=>Response.json(config));assert.equal(response.status,404);assert.deepEqual(assets,[]);assert.doesNotMatch(await response.text(),/APP ROOT/);assert.equal(response.headers.get('cache-control'),'no-store');assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'none'/);}
for(const status of [404,503]){const {context,assets}=fixture();const response=await buildRegionalDiscoveryResponse(context,async()=>Response.json({}, {status}));assert.equal(response.status,status);assert.deepEqual(assets,[]);}
const {context,assets}=fixture();assert.equal((await buildRegionalDiscoveryResponse(context,async()=>{throw Error('offline');})).status,503);assert.deepEqual(assets,[]);});
test('regional HEAD preserves verified headers and all other methods fail without loading assets',async()=>{const original=globalThis.fetch;globalThis.fetch=async()=>Response.json(valid);try{const head=fixture('HEAD');const response=await onRequest(head.context);assert.equal(response.status,200);assert.equal(await response.text(),'');assert.equal(response.headers.get('cache-control'),'no-store');const post=fixture('POST');const denied=await onRequest(post.context);assert.equal(denied.status,405);assert.equal(denied.headers.get('cache-control'),'no-store');assert.equal(post.assets.length,0);}finally{globalThis.fetch=original;}});

test('Wrangler compiled Pages matcher dispatches the actual nested and compact URLs',{skip:!process.env.CAREAROUND_PAGES_WRANGLER},async()=>{
    const {mkdtemp,rm,copyFile}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {fileURLToPath,pathToFileURL}=await import('node:url');const {execFileSync}=await import('node:child_process');
    const temp=await mkdtemp(join(tmpdir(),'carearound-regional-pages-'));
    const originalFetch=globalThis.fetch;const calls=[];
    try {
        const output=join(temp,'compiled.mjs');
        execFileSync(process.execPath,[process.env.CAREAROUND_PAGES_WRANGLER,'pages','functions','build',fileURLToPath(new URL('../functions/',import.meta.url)),'--outdir',join(temp,'bundle'),'--compatibility-date','2026-11-01'],{cwd:temp,env:{...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_LOG_PATH:join(temp,'wrangler.log')},stdio:'pipe'});
        await copyFile(join(temp,'bundle/index.js'),output);
        const worker=(await import(pathToFileURL(output))).default;
        let enabled=true;
        globalThis.fetch=async url=>{calls.push(String(url));if(!enabled)return Response.json({},{status:404});return Response.json(valid);};
        const env={CAREAROUND_EMBED_API_BASE_URL:'https://fixture.invalid/api',ASSETS:{fetch:async()=>new Response('<html>APP ROOT</html>',{headers:{'X-Frame-Options':'DENY','Content-Security-Policy':"frame-ancestors 'none'"}})}};
        const invoke=(path,method='GET')=>worker.fetch(new Request('https://app.example.invalid'+path,{method}),env,{waitUntil(){},passThroughOnException(){}});
        const nested=await invoke('/embed/maps/frozen-token/regional-discovery');assert.equal(nested.status,200);assert.match(calls.at(-1),/\/frozen-token\/embed\/regional-discovery-config$/);assert.match(nested.headers.get('content-security-policy'),/host.example.invalid/);
        const compact=await invoke('/embed/maps/frozen-token');assert.equal(compact.status,200);assert.match(calls.at(-1),/\/frozen-token\/embed-config$/);
        const ordinary=await invoke('/ordinary');assert.equal(ordinary.headers.get('x-frame-options'),'DENY');assert.equal(ordinary.headers.get('content-security-policy'),"frame-ancestors 'none'");
        enabled=false;for(const method of ['GET','HEAD']){const denied=await invoke('/embed/maps/frozen-token/regional-discovery',method);assert.equal(denied.status,404);assert.equal(denied.headers.get('cache-control'),'no-store');assert.doesNotMatch(await denied.text(),/APP ROOT/);}
    } finally {globalThis.fetch=originalFetch;await rm(temp,{recursive:true,force:true});}
});
