import test from 'node:test';
import assert from 'node:assert/strict';
import { HELP_CMS_SEED } from '../server/src/generated/helpCmsSeed.js';
import { cmsSeedWorkspace, validateCmsWorkspace, prepareCmsPublication, createCmsCategory, createCmsArticle, changeCmsArticleStatus, reorderCmsItems, validateCmsImage, safeCmsVideoUrl } from '../shared/helpContentCms.js';
import { compileHelpContent } from './build-help-content.mjs';
import { cmsAddStep, cmsGuideMessages, cmsRemoveStep } from '../client/src/features/help-content/helpContentDraftModel.js';
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
 const compiled=compile(t,prepareCmsPublication(w,options)); const before=compileHelpContent(); assert.deepEqual(compiled.facts,before.facts); assert.deepEqual(compiled.topics,before.topics);
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


test('an empty HC-01 section can add instructions and survive save/reload/publication compilation', t => {
 const source = cmsSeedWorkspace(HELP_CMS_SEED);
 const article = source.articles.find(a => a.id === 'HC-01'), original = article.sections[0];
 assert.equal(original.steps.length, 0);
 let section = cmsAddStep(original);
 section.steps[0] = 'Open Discover to begin browsing.';
 const firstId = section.stepIds[0];
 section = cmsAddStep(section);
 section.steps[1] = 'Open a result to review its details.';
 section.media = [{ id: 'step-video', type: 'video', afterStepId: firstId, url: 'https://youtu.be/AbcDef12345', caption: 'Browse walkthrough', transcript: 'Check the listing before planning a visit.', transcriptReviewed: true }];
 article.sections[0] = section;
 const saved = JSON.parse(JSON.stringify(validateCmsWorkspace(source, HELP_CMS_SEED)));
 assert.equal(saved.articles.find(a => a.id === 'HC-01').sections[0].stepIds[0], firstId);
 assert.equal(saved.articles.find(a => a.id === 'HC-01').sections[0].media[0].afterStepId, firstId);
 validateCmsWorkspace(saved, HELP_CMS_SEED);
 const published = prepareCmsPublication(saved, options), compiled = compile(t, published);
 const actual = compiled.facts.find(f => f.id === original.facts[0].id);
 assert.equal(actual.message, cmsGuideMessages(section)[0].text);
 assert.match(actual.message, /1\. Open Discover to begin browsing\./);
 assert.match(actual.message, /2\. Open a result to review its details\./);
 assert.match(actual.message, /Check the listing before planning a visit\./);
 assert.equal(actual.articleId, article.id);
 const reading = compiled.publicData.articles.find(a => a.id === article.id).sections.find(s => s.id === section.id);
 assert.deepEqual(reading.steps, section.steps);
 assert.deepEqual(reading.stepIds, section.stepIds);
 assert.equal(reading.media[0].afterStepId, firstId);
 const stable = original.facts[0];
 for (const key of ['id', 'title', 'answerKind', 'visibility', 'access', 'path', 'articleId', 'sectionId']) {
     assert.deepEqual(published.articles.find(a => a.id === article.id).sections[0].facts[0][key], stable[key]);
 }
});

test('common added instructions retain separate factual meanings in preview and publication', t => {
 const base = JSON.parse(JSON.stringify(HELP_CMS_SEED));
 const baseArticle = base.articles.find(a => a.id === 'HC-01'), original = baseArticle.sections[0];
 const first = original.facts[0], second = baseArticle.sections[1].facts[0];
 original.facts = [first, second];
 baseArticle.sections = [original];
 const workspace = cmsSeedWorkspace(base), article = workspace.articles.find(a => a.id === 'HC-01'), section = article.sections[0];
 section.paragraphs = ['First answer alone.', 'Second answer alone.'];
 section.steps = ['Open the relevant page.', 'Check its current details.']; section.stepIds = ['open-page', 'check-details'];
 section.notes = ['One shared boundary.'];
 section.media = [{ id: 'shared-video', type: 'video', afterStepId: 'check-details', url: 'https://youtu.be/AbcDef12345', caption: 'Shared walkthrough', transcript: 'One reviewed transcript.', transcriptReviewed: true }];
 validateCmsWorkspace(workspace, base);
 const publication = prepareCmsPublication(workspace, { ...options, seed: base });
 const published = publication.articles.find(a => a.id === article.id).sections[0];
 const compiled = compile(t, publication);
 const preview = cmsGuideMessages(section);
 assert.equal(preview.length, 2);
 for (let i = 0; i < 2; i++) {
     assert.equal(published.facts[i].message, preview[i].text);
     assert.equal(compiled.facts.find(f => f.id === section.facts[i].id).message, preview[i].text);
     assert.ok(published.facts[i].message.includes(section.paragraphs[i]));
     assert.ok(!published.facts[i].message.includes(section.paragraphs[1 - i]));
     assert.match(published.facts[i].message, /1\. Open the relevant page\./);
     assert.match(published.facts[i].message, /2\. Check its current details\./);
     assert.match(published.facts[i].message, /One shared boundary\./);
     assert.match(published.facts[i].message, /One reviewed transcript\./);
     assert.equal(published.facts[i].id, section.facts[i].id);
     assert.equal(published.facts[i].title, section.facts[i].title);
 }
});

test('blank instructions and mismatched separate-answer paragraphs remain rejected', () => {
 const blank = cmsSeedWorkspace(HELP_CMS_SEED), article = blank.articles.find(a => a.id === 'HC-01');
 article.sections[0] = cmsAddStep(article.sections[0]);
 assert.throws(() => validateCmsWorkspace(blank, HELP_CMS_SEED), /Steps must contain valid text/);
 const mismatch = cmsSeedWorkspace(HELP_CMS_SEED), changed = mismatch.articles.find(a => a.id === 'HC-01').sections[0];
 changed.steps = ['An optional instruction.']; changed.stepIds = ['optional-instruction']; changed.paragraphs.push('An unmatched extra answer.');
 assert.throws(() => prepareCmsPublication(mismatch, options), /Keep one paragraph per existing Guide answer/);
});

test('removing the last optional instruction restores original answers while procedures retain their minimum', t => {
 const workspace = cmsSeedWorkspace(HELP_CMS_SEED), article = workspace.articles.find(a => a.id === 'HC-01'), original = article.sections[0];
 const added = cmsAddStep(original); added.steps[0] = 'An optional instruction.';
 article.sections[0] = cmsRemoveStep(added, added.stepIds[0]);
 validateCmsWorkspace(workspace, HELP_CMS_SEED);
 assert.deepEqual(article.sections[0], original);
 const compiled = compile(t, prepareCmsPublication(workspace, options));
 assert.deepEqual(compiled.facts, compileHelpContent().facts);
 const map = workspace.articles.find(a => a.id === 'HC-09'), procedure = map.sections.find(s => s.facts.some(f => f.answerKind === 'procedure'));
 for (const id of [...procedure.stepIds]) Object.assign(procedure, cmsRemoveStep(procedure, id));
 assert.throws(() => validateCmsWorkspace(workspace, HELP_CMS_SEED), /existing procedure must retain numbered instructions/);
});
