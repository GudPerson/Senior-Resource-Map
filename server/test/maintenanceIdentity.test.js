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
import {armMaintenanceIdentityPermit, maintenanceIdentityPermitKey} from '../src/utils/maintenanceIdentityPermit.js';

const path = '/api/help/cms/binding-observation', url = 'https://api.carearound.sg' + path;
const origin = 'https://app.carearound.sg', start = Date.parse('2000-01-01T00:00:00.000Z');
const policy = {opensUtc:new Date(start).toISOString(), closesUtc:new Date(start+60000).toISOString()};
const row = {branch_id:'br-green-union-ailxs0g3', database:'neondb', effective_role:'fixture_role',session_role:'fixture_login'};
const rev = 'a'.repeat(40), id='12345678-1234-1234-1234-123456789012';
const release = makeWorkerReleaseManifest(rev, {id,tag:'git-'+rev,timestamp:policy.opensUtc});
const fixtureEnv = {HELP_CMS_OWNER_ID:'11', HELP_CMS_ENABLED:'true', HELP_CMS_BUCKET:{get(){throw Error('storage read');},put(){throw Error('storage write');}}, NODE_ENV:'production'};

class PermitBucket {
    data=new Map(); counter=0;
    set(key,value){this.data.set(key,{value:structuredClone(value),etag:'fixture-'+(++this.counter)});}
    async get(key){const item=this.data.get(key);if(!item)return null;const json=JSON.stringify(item.value);return {etag:item.etag,size:new TextEncoder().encode(json).length,json:async()=>JSON.parse(json)};}
    async put(key,text,options){const old=this.data.get(key);if(options.onlyIf instanceof Headers&&options.onlyIf.get('If-None-Match')==='*'&&old)return null;
        if(options.onlyIf?.etagMatches&&options.onlyIf.etagMatches!==old?.etag)return null;
        this.set(key,JSON.parse(text));if(this.lostClaimAck&&JSON.parse(text).state==='consumed')throw Error('PRIVATE_STORAGE_CANARY');return {etag:this.data.get(key).etag};}
}
function permitFixture(){
    const bucket=new PermitBucket(),publicSource='b'.repeat(40),job='11111111-2222-4333-8444-555555555555',releaseId='0946684800000-'+job,version='2000-01-01.help-cms.0946684800000',snapshotDigest='c'.repeat(64);
    const snapshot={id:releaseId,jobId:job,version,snapshotDigest,baseSourceRevision:publicSource,ownerId:11};
    const status={...snapshot,state:'published',buildSourceRevision:rev,compiledContentDigest:'d'.repeat(64),workerVersionId:id,pagesDeploymentId:'87654321-4321-4321-4321-210987654321',publishedAt:new Date(start).toISOString(),readiness:{help:true,guide:true,client:true}};
    bucket.set('published/current.json',{releaseId,version,snapshotDigest});bucket.set('release-status/'+releaseId+'.json',status);bucket.set('publication/active.json',{releaseId:null});
    const env={...fixtureEnv,HELP_CMS_BUCKET:bucket,HELP_CMS_SOURCE_REVISION:publicSource};
    return {bucket,env,snapshot,status};
}

function harness(opts = {}) {
    const calls = {auth:0, identity:0, clock:0};
    const fixture=permitFixture();let expireInRead=false,requestCount=0;
    const prepared=opts.noPermit?Promise.resolve():armMaintenanceIdentityPermit({bucket:fixture.bucket,env:fixture.env,release:fixture.snapshot,publishedStatus:fixture.status,runtime:release,workspacePromoted:true,lockCompleted:true,now:start+1}).then(()=>{if(opts.corruptPermit)fixture.bucket.data.get(maintenanceIdentityPermitKey).value.publishedAt='invalid';fixture.bucket.lostClaimAck=opts.lostClaimAck;});
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
        now: () => { calls.clock++; return expireInRead ? start+900000 : opts.now ? opts.now() : start + 1; },
        observe: () => opts.noVersion ? null : release,
        read: async () => { calls.identity++;assert.equal(fixture.bucket.data.get(maintenanceIdentityPermitKey).value.state,'consumed');if(opts.expireInRead)expireInRead=true; if (opts.error) throw Error('error_CANARY'); return opts.row || row; },
    });
    app.route('/api/help/cms',createHelpCmsRoutes({authenticate,identityHandler:handler}));
    return {calls,bucket:fixture.bucket, request: async (dest = url, init = {}) => {
        await prepared;requestCount++;
        const res = await app.request(dest,{method:'POST',headers:{Origin:origin},...init}, {...fixture.env,...opts.env,REQUEST_LOG_SAMPLE_RATE:'1'});
        assert.match(res.headers.get('Cache-Control') || '',/no-store/);
        const data = await res.json();
        assert.doesNotMatch(JSON.stringify(data),/CANARY/);
        assert.equal(logs.length,requestCount);
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
    ['expired',{now:()=>start+900000}],['not open',{now:()=>start-1}],
    ['missing permit',{noPermit:true}],
    ['unusable clock',{now:()=>NaN}],['invalid stored UTC',{corruptPermit:true}],['missing version',{noVersion:true}],
    ['workers.dev',{},'https://fixture.workers.dev'+path],['scheme',{},url.replace('https:','http:')],['port',{},url.replace('.sg/','.sg:8443/')],
    ['query',{},url+'?unknown=CANARY'],['empty query',{},url+'?'],
    ['body',{},url,{body:'CANARY'}],['wrong method',{},url,{method:'GET'}],
    ['declared body',{},url,{headers:{Origin:origin,'Content-Length':'1'}}],
    ['unapproved origin',{},url,{headers:{Origin:'https://unknown.invalid'}}],
    ['configured alternative origin',{env:{FRONTEND_URL:'https://alternative.invalid'}},url,{headers:{Origin:'https://alternative.invalid'}}],
]) test(name+' does not open an identity query',async()=>{
    const h=harness(opts); const res=await h.request(dest,init);
    assert.notEqual(res.status,200); assert.equal(h.calls.identity,0);
});

test('publication-derived permit admits only its first acknowledged claim',async()=>{
    const h=harness();assert.equal((await h.request()).status,200);
    assert.equal((await h.request()).status,403);assert.equal(h.calls.identity,1);
    const missing=harness({noPermit:true});assert.equal((await missing.request()).status,403);assert.equal(missing.calls.identity,0);
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
    ['expiration in flight',{expireInRead:true},'observation_closed'],
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

test('concurrent endpoint claims execute at most one database read',async()=>{
    const h=harness(),results=await Promise.all([h.request(),h.request()]);
    assert.equal(results.filter(r=>r.status===200).length,1);assert.equal(h.calls.identity,1);
});
test('lost conditional-claim acknowledgement performs zero queries and remains consumed',async()=>{
    const h=harness({lostClaimAck:true});assert.equal((await h.request()).status,503);assert.equal(h.calls.identity,0);
    assert.equal(h.bucket.data.get(maintenanceIdentityPermitKey).value.state,'consumed');
    assert.equal((await h.request()).status,403);assert.equal(h.calls.identity,0);
});
test('a database failure consumes the permit before the unchanged query and cannot retry',async()=>{
    const h=harness({error:true});assert.equal((await h.request()).status,503);assert.equal(h.calls.identity,1);
    assert.equal((await h.request()).status,403);assert.equal(h.calls.identity,1);
});
