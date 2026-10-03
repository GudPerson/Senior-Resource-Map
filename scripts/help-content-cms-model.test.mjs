import test from 'node:test';
import assert from 'node:assert/strict';
import { HELP_CMS_SEED } from '../server/src/generated/helpCmsSeed.js';
import { cmsSeedWorkspace, validateCmsWorkspace, prepareCmsPublication, createCmsCategory, createCmsArticle, changeCmsArticleStatus, reorderCmsItems, validateCmsImage, safeCmsVideoUrl } from '../shared/helpContentCms.js';
import { compileHelpContent } from './build-help-content.mjs';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const options = { seed: HELP_CMS_SEED, owner: 'Owner', reviewNote: 'Reviewed article changes', date: '2026-10-03', version: 'cms.test.1', sourceRevision: 'a'.repeat(40) };
function compile(t, publication) {
 const root = mkdtempSync(join(tmpdir(), 'cms-compile-')); t.after(()=>rmSync(root,{recursive:true,force:true}));
 mkdirSync(join(root,'content/help/articles'),{recursive:true}); writeFileSync(join(root,'content/help/manifest.json'),JSON.stringify(publication.manifest));
 for(const a of publication.articles)writeFileSync(join(root,'content/help/articles',a.id+'.json'),JSON.stringify(a));
 return compileHelpContent({root});
}
test('seed uses all current articles, stable step IDs and untouched Guide facts', t=>{
 const w=cmsSeedWorkspace(HELP_CMS_SEED);assert.equal(w.articles.length,48);validateCmsWorkspace(w,HELP_CMS_SEED);
 const compiled=compile(t,prepareCmsPublication(w,options)); const before=compileHelpContent(); assert.deepEqual(compiled.facts,before.facts);
});
test('topic and article additions/order persist without changing published identity',t=>{
 let w=createCmsCategory(cmsSeedWorkspace(HELP_CMS_SEED),'Another topic');let c=w.manifest.categories.at(-1);
 w=createCmsArticle(w,c.id,'A new task');let id=w.articles.at(-1).id;
 w=changeCmsArticleStatus(w,id,'approved');w.manifest.articleOrder=reorderCmsItems(w.manifest.articleOrder,id,'up');validateCmsWorkspace(w,HELP_CMS_SEED);
 const compiled=compile(t,prepareCmsPublication(w,options));assert.equal(compiled.articles.length,49);assert.equal(compiled.articles.at(-2).id,id);assert.ok(compiled.facts.some(f=>f.articleId===id));
});
test('archive withdraws facts, quick topic and incoming links while retaining source identity',t=>{
 let w=changeCmsArticleStatus(cmsSeedWorkspace(HELP_CMS_SEED),'HC-01','retired');validateCmsWorkspace(w,HELP_CMS_SEED);
 const p=prepareCmsPublication(w,options);let compiled=compile(t,p);assert.ok(!compiled.articles.some(a=>a.id==='HC-01'));assert.ok(!compiled.topics.some(x=>x.id==='overview'));assert.ok(!compiled.facts.some(x=>x.articleId==='HC-01'));assert.ok(p.articles.some(a=>a.id==='HC-01'));
 w=changeCmsArticleStatus(w,'HC-01','approved');assert.ok(compile(t,prepareCmsPublication(w,options)).articles.some(a=>a.id==='HC-01'));
});
test('topic archive requires moving or archiving articles',()=>{
 let w=cmsSeedWorkspace(HELP_CMS_SEED);w.manifest.categories[0].archived=true;assert.throws(()=>validateCmsWorkspace(w,HELP_CMS_SEED),/Move or archive/);
});
test('existing permissions, evidence, section anchors and source identities cannot be erased',()=>{
 for(const mutate of [w=>w.articles[0].visibility='public-other',w=>w.articles[0].slug='different',w=>w.articles.shift(),w=>w.articles[0].sections[0].facts[0].message='invented',w=>w.articles[0].sections.shift()]){const w=cmsSeedWorkspace(HELP_CMS_SEED);mutate(w);assert.throws(()=>validateCmsWorkspace(w,HELP_CMS_SEED));}
});
test('edited conceptual text synchronises corresponding Guide evidence, procedure keeps steps in order',t=>{
 let w=cmsSeedWorkspace(HELP_CMS_SEED);let a=w.articles[0];a.sections[0].paragraphs[0]='Reviewed corrected overview.';validateCmsWorkspace(w,HELP_CMS_SEED);
 let compiled=compile(t,prepareCmsPublication(w,options));assert.equal(compiled.facts.find(f=>f.id===a.sections[0].facts[0].id).message,'Reviewed corrected overview.');
 const map=w.articles.find(x=>x.id==='HC-09');const s=map.sections.find(s=>s.steps.length);[s.steps[0],s.steps[1]]=[s.steps[1],s.steps[0]];[s.stepIds[0],s.stepIds[1]]=[s.stepIds[1],s.stepIds[0]];
 compiled=compile(t,prepareCmsPublication(w,options));assert.ok(compiled.facts.find(f=>f.id==='personal-place-map-create').message.includes('1. '+s.steps[0]));
});
test('multiple step attachments follow stable IDs and public output omits draft/internal fields',t=>{
 let w=cmsSeedWorkspace(HELP_CMS_SEED);const a=w.articles.find(x=>x.id==='HC-09'),s=a.sections.find(x=>x.steps.length);
 s.media=[1,2].map(i=>({id:'image-'+i,type:'image',afterStepId:s.stepIds[1],assetId:String(i).repeat(64),caption:'Shown step',alt:'Step screenshot'}));validateCmsWorkspace(w,HELP_CMS_SEED);
 const p=prepareCmsPublication(w,options),compiled=compile(t,p);const out=compiled.publicData.articles.find(x=>x.id===a.id).sections.find(x=>x.id===s.id);assert.equal(out.media.length,2);assert.equal(out.media[0].afterStepId,s.stepIds[1]);assert.ok(!JSON.stringify(compiled.publicData).includes('sourceRevision'));
});
test('restricted attachments and unsafe video hosts are denied before publication',()=>{
 for(const article of ['HC-09',HELP_CMS_SEED.articles.find(a=>a.visibility!=='public').id]){const w=cmsSeedWorkspace(HELP_CMS_SEED),a=w.articles.find(x=>x.id===article);a.sections[0].media=[{id:'video-1',type:'video',afterStepId:null,url:'https://example.org/video',caption:'Video',transcript:'Reviewed steps',transcriptReviewed:true}];assert.throws(()=>validateCmsWorkspace(w,HELP_CMS_SEED));}
});

test('unpublished draft text is absent from release and private runtime seed', t => {
 let w = createCmsArticle(cmsSeedWorkspace(HELP_CMS_SEED), 'getting-started', 'NEVER PUBLISH THIS DRAFT');
 w.articles[0].status = 'draft'; w.articles[0].sections[0].paragraphs[0] = 'PRIVATE DRAFT CHANGE';
 const p = prepareCmsPublication(w, options); const serialized = JSON.stringify(p);
 assert.ok(!serialized.includes('NEVER PUBLISH THIS DRAFT')); assert.ok(!serialized.includes('PRIVATE DRAFT CHANGE'));
 assert.equal(compile(t, p).articles.length, 48);
});


test('client shape validation accepts the existing library without applying a missing authority baseline', () => {
    const workspace = cmsSeedWorkspace(HELP_CMS_SEED);
    assert.equal(validateCmsWorkspace(workspace), workspace);
});


test('image dimensions reject invalid headers and oversized decoded surfaces', () => {
    const bytes = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6VgAAAABJRU5ErkJggg==', 'base64'));
    assert.deepEqual(validateCmsImage(bytes, 'image/png'), {mime: 'image/png',size: bytes.length,width:1,height:1});
    const giant = bytes.slice(); new DataView(giant.buffer).setUint32(16,100000);
    assert.throws(()=>validateCmsImage(giant, 'image/png'), /8192/);
    assert.throws(()=>validateCmsImage(bytes, 'image/jpeg'), /matching file type/);
    assert.throws(()=>validateCmsImage(new Uint8Array([255,216,255,217]), 'image/jpeg'), /valid dimensions/);
});


test('the canonical video validator accepts specific video links consistently and rejects arbitrary host paths', () => {
    for (const url of ['https://m.youtube.com/watch?v=abcdefghi','https://www.youtu.be/abcdefghi','https://vimeo.com/12345678','https://player.vimeo.com/video/12345678']) assert.equal(safeCmsVideoUrl(url),url);
    for (const url of ['https://youtube.com/','https://youtube.com/account','https://vimeo.com/settings','javascript:alert(1)','https://youtube.com.attacker.example/watch?v=abcdefghi']) assert.equal(safeCmsVideoUrl(url),null);
});


test('archiving withdraws published content without releasing unfinished edits or never-published archives', t => {
    let w=createCmsArticle(cmsSeedWorkspace(HELP_CMS_SEED),'getting-started','Private archived draft');
    const created=w.articles.at(-1);created.status='retired';created.sections[0].paragraphs=['Never published private archive text'];
    w.articles[0].title='Unfinished edited archived title';w.articles[0].status='retired';
    const publication=prepareCmsPublication(w,options);
    assert.doesNotMatch(JSON.stringify(publication), /Private archived draft|Never published private archive text|Unfinished edited archived title/);
    assert.equal(publication.articles.find(a=>a.id==='HC-01').status,'retired');
    assert.equal(compile(t,publication).articles.some(a=>a.id==='HC-01'),false);
});
