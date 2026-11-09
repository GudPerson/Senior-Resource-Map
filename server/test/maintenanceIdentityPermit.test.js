import test from 'node:test';
import assert from 'node:assert/strict';
import {makeWorkerReleaseManifest} from '../src/utils/workerRelease.js';
let helper;
try { helper=await import('../src/utils/maintenanceIdentityPermit.js'); } catch(e) { if(e.code!=='ERR_MODULE_NOT_FOUND')throw e; }
const start=Date.parse('2000-01-01T00:00:00.000Z');
const source='a'.repeat(40),build='d'.repeat(40),digest='b'.repeat(64);
const id='12345678-1234-1234-1234-123456789012',pages='87654321-4321-4321-4321-210987654321',job='11111111-2222-4333-8444-555555555555';
const releaseId='0946684800000-11111111-2222-4333-8444-555555555555';
class Bucket {
    data=new Map();writes=[];beforePut=null;afterPut=null;
    set(key,value){this.data.set(key,{value:structuredClone(value),etag:`e${this.data.size}-${this.writes.length}`});}
    async get(key){const row=this.data.get(key);if(!row)return null;const text=JSON.stringify(row.value);return {etag:row.etag,size:new TextEncoder().encode(text).length,json:async()=>JSON.parse(text)};}
    async put(key,text,options){if(this.beforePut)await this.beforePut(key,text,options);const old=this.data.get(key);
        if(options.onlyIf instanceof Headers&&options.onlyIf.get('If-None-Match')==='*'&&old)return null;
        if(options.onlyIf?.etagMatches&&old?.etag!==options.onlyIf.etagMatches)return null;
        this.writes.push({key,text,options});this.data.set(key,{value:JSON.parse(text),etag:`written-${this.writes.length}`});
        if(this.afterPut)await this.afterPut(key,text,options);return {etag:`written-${this.writes.length}`};}
}
function fixture(){
    const bucket=new Bucket(),env={HELP_CMS_ENABLED:'true',HELP_CMS_OWNER_ID:'11',HELP_CMS_SOURCE_REVISION:source};
    const release={id:releaseId,jobId:job,ownerId:11,version:'2000-01-01.help-cms.0946684800000',baseSourceRevision:source,snapshotDigest:digest};
    const publishedStatus={...release,state:'published',buildSourceRevision:build,compiledContentDigest:'c'.repeat(64),workerVersionId:id,pagesDeploymentId:pages,publishedAt:new Date(start).toISOString(),readiness:{help:true,guide:true,client:true}};
    const runtime=makeWorkerReleaseManifest(build,{id,tag:'git-'+build,timestamp:new Date(start-1).toISOString()});
    bucket.set('published/current.json',{releaseId,version:release.version,snapshotDigest:digest});
    bucket.set(`release-status/${releaseId}.json`,publishedStatus);bucket.set('publication/active.json',{releaseId:null});
    return {bucket,env,release,publishedStatus,runtime,workspacePromoted:true,lockCompleted:true,now:start+1};
}
const arm=f=>helper.armMaintenanceIdentityPermit(f);
const claim=f=>helper.claimMaintenanceIdentityPermit({bucket:f.bucket,env:f.env,ownerId:11,runtime:f.runtime,now:f.now});

test('one-use permit helper is available',()=>assert.equal(typeof helper?.armMaintenanceIdentityPermit,'function'));
test('verified completion arms one private record with fixed attempt and exclusive fifteen-minute expiry',async()=>{
    const f=fixture(),result=await arm(f);assert.equal(result.state,'armed');assert.equal(f.bucket.writes.length,1);
    const write=f.bucket.writes[0],record=JSON.parse(write.text);assert.match(write.key,/^maintenance\//);assert.equal(write.key,helper.maintenanceIdentityPermitKey);
    assert.equal(write.options.onlyIf.get('If-None-Match'),'*');assert.equal(write.options.httpMetadata.cacheControl,'private, no-store');
    assert.equal(record.ownerId,11);assert.equal(record.publicSourceRevision,source);assert.equal(record.buildSourceRevision,build);assert.equal(record.workerVersionId,id);assert.equal(record.pagesDeploymentId,pages);assert.equal(record.releaseId,releaseId);assert.equal(record.jobId,job);
    assert.equal(Date.parse(record.expiresAt)-Date.parse(record.publishedAt),900000);assert.equal(record.publishedAt,f.publishedStatus.publishedAt);
});
for(const field of ['workspacePromoted','lockCompleted','readiness','state','owner','publicSource','runtimeSource','runtimeVersion','pages','job','release','future','late'])test(`cannot arm ${field} mismatch or unfinished completion`,async()=>{
    const f=fixture();
    if(field==='workspacePromoted'||field==='lockCompleted')f[field]=false;
    if(field==='readiness')f.publishedStatus.readiness.client=false;
    if(field==='state')f.publishedStatus.state='partially-released';
    if(field==='owner')f.release.ownerId=12;
    if(field==='publicSource')f.env.HELP_CMS_SOURCE_REVISION='e'.repeat(40);
    if(field==='runtimeSource')f.runtime.sourceRevision='f'.repeat(40);
    if(field==='runtimeVersion')f.runtime.deploymentId=pages;
    if(field==='pages')f.publishedStatus.pagesDeploymentId='not-a-uuid';
    if(field==='job')f.publishedStatus.jobId=pages;
    if(field==='release')f.publishedStatus.id='0946684800001-'+job;
    if(field==='future')f.publishedStatus.publishedAt=new Date(start+2).toISOString();
    if(field==='late')f.now=start+900000;
    assert.equal((await arm(f)).state,'hold');assert.equal(f.bucket.writes.length,0);
});
test('duplicate receipts, expiry, consumption and source clones cannot renew or replace the fixed record',async()=>{
    const f=fixture();await arm(f);const original=JSON.stringify(f.bucket.data.get(helper.maintenanceIdentityPermitKey));
    f.now+=1000;assert.equal((await arm(f)).state,'hold');assert.equal(JSON.stringify(f.bucket.data.get(helper.maintenanceIdentityPermitKey)),original);
    assert.equal((await claim(f)).ok,true);const consumed=JSON.stringify(f.bucket.data.get(helper.maintenanceIdentityPermitKey));
    f.now=start+899999;assert.equal((await arm(f)).state,'hold');assert.equal(JSON.stringify(f.bucket.data.get(helper.maintenanceIdentityPermitKey)),consumed);
    f.now=start+900000;assert.equal((await claim(f)).ok,false);assert.equal((await arm(f)).state,'hold');
    f.env.HELP_CMS_SOURCE_REVISION=f.release.baseSourceRevision=f.publishedStatus.baseSourceRevision='9'.repeat(40);f.publishedStatus.publishedAt=new Date(f.now).toISOString();
    assert.equal((await arm(f)).state,'hold');assert.equal(JSON.stringify(f.bucket.data.get(helper.maintenanceIdentityPermitKey)),consumed);
});
test('exact expiry is exclusive and a current arm can be claimed once immediately before it',async()=>{
    const before=fixture();await arm(before);before.now=start+899999;assert.equal((await claim(before)).ok,true);
    const expired=fixture();await arm(expired);expired.now=start+900000;assert.equal((await claim(expired)).ok,false);assert.equal(expired.bucket.writes.length,1);
});
test('two concurrent R2 ETag claims acknowledge at most one; both readers can observe the same armed ETag',async()=>{
    const f=fixture();await arm(f);let entered=0,release;const gate=new Promise(r=>release=r);
    f.bucket.beforePut=async(_key,text)=>{if(JSON.parse(text).state==='consumed'){entered++;if(entered===2)release();await gate;}};
    const results=await Promise.all([claim(f),claim(f)]);assert.equal(entered,2);assert.equal(results.filter(x=>x.ok).length,1);assert.equal(f.bucket.writes.length,2);
});
for(const field of ['owner','source','version','pages','release','job','active','malformed','missing'])test(`claim rejects ${field} mismatch without a consumed write`,async()=>{
    const f=fixture();await arm(f);
    if(field==='owner')f.env.HELP_CMS_OWNER_ID='12';
    if(field==='source')f.env.HELP_CMS_SOURCE_REVISION='9'.repeat(40);
    if(field==='version')f.runtime.deploymentId=pages;
    if(field==='pages')f.bucket.data.get(`release-status/${releaseId}.json`).value.pagesDeploymentId=job;
    if(field==='release')f.bucket.data.get('published/current.json').value.releaseId='0946684800001-'+job;
    if(field==='job')f.bucket.data.get(`release-status/${releaseId}.json`).value.jobId=pages;
    if(field==='active')f.bucket.data.get('publication/active.json').value.releaseId=releaseId;
    if(field==='malformed')f.bucket.data.get(helper.maintenanceIdentityPermitKey).value.secret='PRIVATE_CANARY';
    if(field==='missing')f.bucket.data.delete(helper.maintenanceIdentityPermitKey);
    const result=await claim(f);assert.equal(result.ok,false);assert.doesNotMatch(JSON.stringify(result),/PRIVATE_CANARY/);assert.equal(f.bucket.writes.length,1);
});
test('unacknowledged claim remains consumed and never authorizes a query/retry',async()=>{
    const f=fixture();await arm(f);f.bucket.afterPut=async()=>{throw Error('PRIVATE_STORAGE_CANARY');};
    const result=await claim(f);assert.equal(result.ok,false);assert.doesNotMatch(JSON.stringify(result),/PRIVATE_STORAGE_CANARY/);
    assert.equal(f.bucket.data.get(helper.maintenanceIdentityPermitKey).value.state,'consumed');f.bucket.afterPut=null;assert.equal((await claim(f)).ok,false);
});
test('ambiguous arming returns HOLD without rollback, deletion or automatic retry',async()=>{
    const f=fixture();f.bucket.afterPut=async()=>{throw Error('PRIVATE_ARM_CANARY');};assert.equal((await arm(f)).state,'hold');
    assert.equal(f.bucket.writes.length,1);assert.equal(f.bucket.data.get(helper.maintenanceIdentityPermitKey).value.state,'armed');
});

test('permit readiness is read-only, strictly projected and becomes closed after consumption',async()=>{
    const f=fixture();await arm(f);assert.equal(typeof helper.readMaintenanceIdentityPermitStatus,'function');const before=f.bucket.writes.length;
    const read=()=>helper.readMaintenanceIdentityPermitStatus({bucket:f.bucket,env:f.env,ownerId:11,runtime:f.runtime,now:f.now});
    assert.deepEqual(await read(),{armed:true,expiresAt:new Date(start+900000).toISOString()});assert.equal(f.bucket.writes.length,before);assert.equal(f.bucket.data.get(helper.maintenanceIdentityPermitKey).value.state,'armed');
    assert.equal((await claim(f)).ok,true);const consumed=f.bucket.writes.length;assert.deepEqual(await read(),{armed:false,expiresAt:null});assert.equal(f.bucket.writes.length,consumed);
});
for(const mode of ['missing','expired','owner','source','runtime','publication','lock','storage'])test(`read-only status closes for ${mode} without a write or claim`,async()=>{
    const f=fixture();if(mode!=='missing')await arm(f);const before=f.bucket.writes.length;
    if(mode==='expired')f.now=start+900000;if(mode==='owner')f.env.HELP_CMS_OWNER_ID='12';if(mode==='source')f.env.HELP_CMS_SOURCE_REVISION='9'.repeat(40);if(mode==='runtime')f.runtime.deploymentId=pages;if(mode==='publication')f.bucket.data.get('published/current.json').value.releaseId='0946684800001-'+job;if(mode==='lock')f.bucket.data.get('publication/active.json').value.releaseId=releaseId;if(mode==='storage')f.bucket.get=async()=>{throw Error('PRIVATE_CANARY');};
    assert.equal(typeof helper.readMaintenanceIdentityPermitStatus,'function');const result=await helper.readMaintenanceIdentityPermitStatus({bucket:f.bucket,env:f.env,ownerId:11,runtime:f.runtime,now:f.now});assert.deepEqual(result,{armed:false,expiresAt:null});assert.equal(f.bucket.writes.length,before);
});
