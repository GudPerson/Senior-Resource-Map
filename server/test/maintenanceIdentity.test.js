import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { neonConfig } from '@neondatabase/serverless';
import { createHelpCmsRoutes, createMaintenanceIdentityHandler, maintenanceIdentityRequest } from '../src/routes/helpCms.js';
import { createRequestObservability } from '../src/middleware/requestObservability.js';
import { getDb, readMaintenanceDatabaseIdentity } from '../src/db/index.js';
import { makeWorkerReleaseManifest } from '../src/utils/workerRelease.js';

const path = '/api/help/cms/binding-observation', url = 'https://api.carearound.sg' + path;
const origin = 'https://app.carearound.sg', start = Date.parse('2000-01-01T00:00:00.000Z');
const policy = {opensUtc:new Date(start).toISOString(), closesUtc:new Date(start+60000).toISOString()};
const row = {branch_id:'br-green-union-ailxs0g3', database:'neondb', effective_role:'fixture_role',session_role:'fixture_login'};
const rev = 'a'.repeat(40), id='12345678-1234-1234-1234-123456789012';
const release = makeWorkerReleaseManifest(rev, {id,tag:'git-'+rev,timestamp:policy.opensUtc});
const fixtureEnv = {HELP_CMS_OWNER_ID:'11', HELP_CMS_ENABLED:'true', HELP_CMS_BUCKET:{get(){throw Error('storage read');},put(){throw Error('storage write');}}, NODE_ENV:'production'};

function harness(opts = {}) {
    const calls = {auth:0, identity:0, clock:0};
    const app = new Hono(), logs = [];
    app.use('*', createRequestObservability({log: event => logs.push(event), random:()=>0, createRequestId:()=>'fixture'}));
    app.use(path, maintenanceIdentityRequest);
    const authenticate = async (c,next) => {
        calls.auth++;
        if (opts.anonymous) return c.json({error:'No token provided'},401);
        c.set('user',{id:11,role:'super_admin',...opts.user});
        await next();
    };
    const handler = createMaintenanceIdentityHandler({
        ...(opts.defaultPolicy ? {} : {policy:{...policy,...opts.policy}}),
        now: () => { calls.clock++; return opts.now ? opts.now() : start + 1; },
        observe: () => opts.noVersion ? null : release,
        read: async () => { calls.identity++; if (opts.error) throw Error('error_CANARY'); return opts.row || row; },
    });
    app.route('/api/help/cms',createHelpCmsRoutes({authenticate,identityHandler:handler}));
    return {calls, request: async (dest = url, init = {}) => {
        const res = await app.request(dest,{method:'POST',headers:{Origin:origin},...init}, {...fixtureEnv,...opts.env,REQUEST_LOG_SAMPLE_RATE:'1'});
        assert.match(res.headers.get('Cache-Control') || '',/no-store/);
        const data = await res.json();
        assert.doesNotMatch(JSON.stringify(data),/CANARY/);
        assert.equal(logs.length,1);
        assert.doesNotMatch(JSON.stringify(logs),/CANARY|fixture_role|fixture_login|br-green|neondb|postgresql:|sourceRevision/);
        return {status:res.status,data};
    }};
}

test('the exact no-store guard precedes early exits; default owner mount is the sole registration', async () => {
    const app = await readFile(new URL('../src/app.js',import.meta.url),'utf8');
    const route = await readFile(new URL('../src/routes/helpCms.js',import.meta.url),'utf8');
    const guard = app.indexOf("app.use('/api/help/cms/binding-observation', maintenanceIdentityRequest)");
    assert.ok(guard !== -1 && guard < app.indexOf("app.use('*', (c, next)"));
    assert.equal((route.match(/\.post\('\/binding-observation'/g)||[]).length,1);
    assert.match(route,/owners\.post\('\/binding-observation', identityHandler\)/);
    assert.ok(route.indexOf("owners.use('*', authenticate)") < route.indexOf('requireHelpCmsOwner(c.get'));
    assert.ok(route.indexOf('requireHelpCmsOwner(c.get') < route.indexOf("owners.post('/binding-observation'"));
});

for (const [name,opts,dest,init] of [
    ['anonymous',{anonymous:true}],['ordinary signed-in user',{user:{role:'standard'}}],
    ['another super admin',{user:{id:12}}],['impersonation',{user:{isImpersonating:true}}],
    ['former configured owner',{env:{HELP_CMS_OWNER_ID:'12'}}],
    ['expired',{now:()=>start+60000}],['not open',{now:()=>start-1}],
    ['excessive window',{policy:{closesUtc:new Date(start+901000).toISOString()}}],
    ['unusable clock',{now:()=>NaN}],['invalid UTC',{policy:{opensUtc:'2000-01-01'}}],['missing version',{noVersion:true}],
    ['workers.dev',{},'https://fixture.workers.dev'+path],['scheme',{},url.replace('https:','http:')],['port',{},url.replace('.sg/','.sg:8443/')],
    ['query',{},url+'?unknown=CANARY'],['empty query',{},url+'?'],
    ['body',{},url,{body:'CANARY'}],['wrong method',{},url,{method:'GET'}],
    ['declared body',{},url,{headers:{Origin:origin,'Content-Length':'1'}}],
    ['unapproved origin',{},url,{headers:{Origin:'https://unknown.invalid'}}],
]) test(name+' does not open an identity query',async()=>{
    const h=harness(opts); const res=await h.request(dest,init);
    assert.notEqual(res.status,200); assert.equal(h.calls.identity,0);
});

test('unconfigured policy closes before the clock; the compiled approved window and open control admit only inside bounds', async () => {
    const instant = Date.now();
    const currentOwner = { user: {id:29}, env: {HELP_CMS_OWNER_ID:'29'}, now: () => instant };
    const disabled = harness({ ...currentOwner, policy:{opensUtc:null,closesUtc:null} });
    const closed = await disabled.request();
    assert.deepEqual(closed, {status:403,data:{ok:false,code:'observation_closed'}});
    assert.equal(disabled.calls.auth, 1);
    assert.equal(disabled.calls.clock, 0);
    assert.equal(disabled.calls.identity, 0);

    const ready = harness({ ...currentOwner, policy:{
        opensUtc: new Date(instant - 1000).toISOString(), closesUtc: new Date(instant + 1000).toISOString(),
    }});
    assert.equal((await ready.request()).status, 200);
    assert.equal(ready.calls.clock, 2);
    assert.equal(ready.calls.identity, 1);

    const opensUtc = '2026-11-08T15:00:00.000Z', closesUtc = '2026-11-08T15:15:00.000Z';
    const source = await readFile(new URL('../src/routes/helpCms.js',import.meta.url),'utf8');
    assert.ok(source.includes(`const observationPolicy = Object.freeze({ opensUtc: '${opensUtc}', closesUtc: '${closesUtc}' });`));
    const first = Date.parse(opensUtc), last = Date.parse(closesUtc);
    assert.equal(last - first, 15 * 60 * 1000);
    for (const [time, admitted] of [[first-1,false],[first,true],[last-1,true],[last,false]]) {
        const compiled = harness({ ...currentOwner, defaultPolicy:true, now:()=>time });
        const result = await compiled.request();
        assert.equal(result.status, admitted ? 200 : 403);
        if (!admitted) assert.deepEqual(result.data,{ok:false,code:'observation_closed'});
        assert.equal(compiled.calls.auth, 1);
        assert.equal(compiled.calls.clock, admitted ? 2 : 1);
        assert.equal(compiled.calls.identity, admitted ? 1 : 0);
    }
});

test('matching owner and destination: observed fields only',async()=>{
    const h=harness({row:{...row, ignored:'CANARY'}}); const res=await h.request();
    assert.equal(h.calls.identity,1); assert.equal(res.status,200);
    assert.deepEqual(res.data,{ok:true,...row,workerVersionId:id,sourceRevision:rev,observedAt:new Date(start+1).toISOString()});
});
for (const [name,opts,category] of [
    ['mismatch branch',{row:{...row,branch_id:'branch_CANARY'}},'target_mismatch'],
    ['mismatch DB',{row:{...row,database:'database_CANARY'}},'target_mismatch'],
    ['missing GUC',{row:{...row,branch_id:null}},'identity_inconclusive'],
    ['missing role',{row:{...row,session_role:null}},'identity_inconclusive'],
    ['unexpected role syntax',{row:{...row,effective_role:'https://CANARY.invalid'}},'identity_inconclusive'],
    ['driver failure',{error:true},'identity_unavailable'],
    ['expiration in flight',{now:(()=>{let n=0;return ()=>n++ ? start+60000 : start+1;})()},'observation_closed'],
]) test(name+' returns a fixed category',async()=>{
    const h=harness(opts); const res=await h.request();
    assert.notEqual(res.status,200); assert.deepEqual(res.data,{ok:false,code:category}); assert.equal(h.calls.identity,1);
});

test('actual pinned Neon/Drizzle serialization: one bounded read-only batch, no application query',async()=>{
    const batches=[];
    const originalFetch=neonConfig.fetchFunction;
    neonConfig.fetchFunction=async (_url,init)=>{
        const parsed=JSON.parse(init.body);
        batches.push({queries:parsed.queries,readOnly:init.headers['Neon-Batch-Read-Only'],signal:init.signal});
        const result={fields:Object.keys(row).map(name=>({name,dataTypeID:25})),rows:[Object.values(row)]};
        return Response.json({results:[{fields:[],rows:[]},{fields:[],rows:[]},result]});
    };
    try {
        const syntheticUrl = new URL('postgresql://fixture.invalid/fixture');
        syntheticUrl.username='synthetic'; syntheticUrl.password='synthetic';
        assert.deepEqual(await readMaintenanceDatabaseIdentity({DATABASE_URL:syntheticUrl.href}),row);
        assert.equal(batches.length,1); assert.equal(batches[0].readOnly,'true');
        assert.ok(batches[0].signal instanceof AbortSignal);
        assert.deepEqual(batches[0].queries.map(q=>[q.query.replace(/\s+/g,' ').trim(),q.params]),[
            ["SET LOCAL statement_timeout = '1500ms'",[]],["SET LOCAL lock_timeout = '500ms'",[]],
            ["SELECT current_setting('neon.branch_id', true) AS branch_id, current_database() AS database, current_user AS effective_role, session_user AS session_role;",[]],
        ]);
    } finally {neonConfig.fetchFunction=originalFetch;}
});

test('ordinary getDb keeps its baseline constructor semantics and shares no diagnostic options',async()=>{
    const sent=[];
    const saved=neonConfig.fetchFunction;
    neonConfig.fetchFunction=async(_url,opts)=>{
        sent.push({signal:opts.signal,readOnly:opts.headers['Neon-Batch-Read-Only'],body:JSON.parse(opts.body)});
        return Response.json({results:[{fields:[{name:'ok',dataTypeID:25}],rows:[['fixture']]}]});
    };
    try {
        const u = new URL('postgresql://fixture.invalid/fixture'); u.username = u.password = 'synthetic';
        for (const env of [{DATABASE_URL:u.href},{env:{DATABASE_URL:u.href}}]) {
            const db=getDb(env); const [answer]=await db.batch([db.execute(sql`SELECT 'fixture' AS ok`)]);
            assert.deepEqual(answer.rows,[{ok:'fixture'}]);
        }
        assert.equal(sent.length,2);
        for (const s of sent) {
            assert.equal(s.signal,undefined); assert.equal(s.readOnly,undefined);
            assert.deepEqual(s.body,{queries:[{query:"SELECT 'fixture' AS ok",params:[]}]});
        }
        await assert.rejects(readMaintenanceDatabaseIdentity({}),/not set/);
        assert.equal(sent.length,2);
    } finally {neonConfig.fetchFunction=saved;}
});

test('adjacent owner and public paths retain their behavior; unrelated paths do not invoke diagnostics',async()=>{
    let diagnosticCalls=0;
    const app=new Hono();
    app.use('/api/help/cms/binding-observation',maintenanceIdentityRequest);
    app.route('/api/help/cms',createHelpCmsRoutes({
        authenticate:async (c,next)=>{c.set('user',{id:11,role:'super_admin'});await next();},
        identityHandler:()=>{diagnosticCalls++; throw Error('unexpected');}
    }));
    app.get('/api/health',c=>c.json({fixture:true}));
    const cap=await app.request('https://fixture.invalid/api/help/cms/capability',{},fixtureEnv);
    assert.deepEqual(await cap.json(),{canEdit:true});
    const health=await app.request('https://fixture.invalid/api/health',{},fixtureEnv);
    assert.equal(health.headers.get('Cache-Control'),null); assert.deepEqual(await health.json(),{fixture:true});
    for (const alias of [path+'/',path+'-x','/api/release/binding-observation','/api/help/cms/release/binding-observation/receipt']) {
        const resp=await app.request('https://fixture.invalid'+alias,{method:'POST'},fixtureEnv);
        assert.notEqual(resp.status,200);
    }
    assert.equal(diagnosticCalls,0);
});
