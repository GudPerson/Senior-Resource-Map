import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { HELP_CMS_SEED } from '../../server/src/generated/helpCmsSeed.js';
import { cmsSeedWorkspace } from '../../shared/helpContentCms.js';

const article = { id: 'HC-09', slug: 'personal-place', title: 'Add a Personal place', summary: 'Keep it private.', category: 'maps', audiences: ['everyone'], visibility: 'public', status: 'approved', review: { date: '2026-10-02' }, relatedArticleIds: [], sections: [
    { id: 'instructions', title: 'Add the place', paragraphs: ['<script>keep this literal</script>'], steps: ['Choose a point.', 'Review and save.'], stepIds: ['choose', 'save'], notes: [], facts: [], media: [
        { id: 'image-one', type: 'image', afterStepId: 'save', caption: 'Example form', alt: 'Location fields', assetId: 'a'.repeat(64) },
        { id: 'video-one', type: 'video', afterStepId: 'save', caption: 'Save procedure', url: 'https://youtu.be/AbcDef12345', transcript: 'Check location.', transcriptReviewed: true },
        { id: 'intro-image', type: 'image', afterStepId: null, caption: 'Overview', alt: 'Overview example', assetId: 'b'.repeat(64) },
    ] },
    { id: 'afterwards', title: 'After saving', paragraphs: ['Return to My Places.'], steps: [], stepIds: [], notes: ['Reuse the place.'], facts: [], media: [] },
] };
const workspace = { manifest: { categories: [{ id: 'maps', title: 'My Maps' }, { id: 'archived-topic', title: 'Old topic', archived: true }], articleOrder: ['HC-09', 'HC-10'] }, articles: [article, { ...article, id: 'HC-10', slug: 'old-place', title: 'Old article', category: 'archived-topic', status: 'retired' }] };
let loaded;
async function renderers() {
    if (loaded) return loaded;
    const { outputFiles } = await build({ stdin: { contents: `import React from 'react'; import { renderToStaticMarkup } from 'react-dom/server'; import { MemoryRouter, Routes, Route } from 'react-router-dom'; import HelpContentContext from './HelpContentContext.jsx'; import ArticleEditor from './ArticleEditor.jsx'; import HelpCatalogue from './HelpCatalogue.jsx'; import HelpContentPreview, { GuideDraftContent } from './HelpContentPreview.jsx'; import { CmsField } from './CmsControls.jsx'; import HelpContentPublications from './HelpContentPublications.jsx'; export const editor=(article,allowImageUpload=true)=>renderToStaticMarkup(<ArticleEditor article={article} allowImageUpload={allowImageUpload} categories={[{id:'maps',title:'My Maps'}]} onChange={()=>{}} onRemoveStep={()=>{}} onUpload={()=>{}} />); export const context=(workspace,article,disabled=false)=>renderToStaticMarkup(<MemoryRouter initialEntries={['/help-centre/'+article.slug]}><Routes><Route path='/help-centre/:slug' element={<HelpContentContext workspace={workspace} article={article} selectedId={article.id} selectArticle={()=>{}} editArticle={()=>{}} editTopic={()=>{}} tab='editor' openTab={()=>{}} disabled={disabled} uploadBusy={false} allowImageUpload={true} configured={true} dirty={false} canSave={false} save={()=>{}} pendingChanged={()=>{}} mediaUrls={{}} mediaErrors={[]} query='' initialEditing={true} />} /></Routes></MemoryRouter>); export const catalogue=(workspace,showArchived=false,query='')=>renderToStaticMarkup(<HelpCatalogue workspace={workspace} selectedId='HC-09' query={query} onQuery={()=>{}} showArchived={showArchived} onShowArchived={()=>{}} onSelect={()=>{}} onAddTopic={()=>{}} onTopicAction={()=>{}} onAddArticle={()=>{}} onTopicPlace={()=>{}} onArticlePlace={()=>{}} />); export const preview=(article)=>renderToStaticMarkup(<MemoryRouter><HelpContentPreview article={article} mediaUrls={{['a'.repeat(64)]:'blob:owner-image',['b'.repeat(64)]:'blob:owner-intro'}} /></MemoryRouter>); export const guide=(article)=>renderToStaticMarkup(<GuideDraftContent article={article} />); export const publications=(releases,publishingAvailable=true,activeReleaseId=null)=>renderToStaticMarkup(<HelpContentPublications releases={releases} publishingAvailable={publishingAvailable} activeReleaseId={activeReleaseId} onRetry={()=>{}} onCheck={()=>{}} />); export const select=()=>renderToStaticMarkup(<CmsField label='Topic'><select value='maps' onChange={()=>{}}><option value='maps'>My Maps</option></select></CmsField>);`, resolveDir: new URL('../src/features/help-content', import.meta.url).pathname, loader: 'jsx' }, bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', loader: { '.css': 'empty' }, logLevel: 'silent' });
    const module = { exports: {} }; new Function('require', 'module', 'exports', outputFiles[0].text)(createRequire(import.meta.url), module, module.exports); loaded = module.exports; return loaded;
}

test('catalogue shows approved and draft articles while archived items remain an explicit view', async () => {
    const render = await renderers();
    const normal = render.catalogue(workspace);
    assert.match(normal, /Care Maps/); assert.match(normal, /Add a Personal place/);
    assert.doesNotMatch(normal, /Old topic|Old article/);
    assert.match(normal, /aria-current="true"/);
    assert.match(normal, /aria-label="Reorder topic care maps"/);
    assert.match(normal, /aria-label="Reorder article add a personal place"/);
    assert.doesNotMatch(normal, /class="cms-order"/);
    const archived = render.catalogue(workspace, true);
    assert.match(archived, /Old topic/); assert.match(archived, /Old article/); assert.match(archived, /Archived topic/);
});

test('owner reading and catalogue display Care Map while raw draft metadata and both search names stay intact', async () => {
    const render = await renderers();
    const value = structuredClone(article);
    value.title = 'Create a My Map';
    value.summary = 'My Map notes stay private.';
    value.sections[0].title = 'My Map instructions';
    value.sections[0].paragraphs = ['Open My Maps.'];
    value.sections[0].steps = ['Choose My Map.', 'Save My Map.'];
    value.sections[0].notes = ['My Map notes stay private.'];
    value.sections[0].facts = [{ id: 'help-my-maps', title: 'My Maps', route: '/my-directory?section=my-maps', message: 'Open My Maps.' }];
    const draft = { ...structuredClone(workspace), articles: [value] };
    draft.manifest.articleOrder = [value.id];
    const before = structuredClone(draft);
    const html = render.context(draft, value);
    for (const name of ['Create a Care Map', 'Care Map notes stay private.', 'Care Map instructions', 'Open Care Maps.', 'Choose Care Map.', 'Save Care Map.']) assert.ok(html.includes(name), name);
    assert.match(html, /<option value="maps" selected="">Care Maps<\/option>/);
    for (const query of ['My Map', 'Care Map']) assert.match(render.catalogue(draft, false, query), /Create a Care Map/);
    assert.deepEqual(draft, before);
    assert.equal(draft.articles[0].sections[0].facts[0].title, 'My Maps');
    assert.equal(draft.manifest.categories[0].title, 'My Maps');
});

test('multi-section editor contains per-instruction attachment fields and no global media editor', async () => {
    const html = (await renderers()).editor(article);
    assert.match(html, /Edit section 1/); assert.match(html, /Edit section 2/);
    assert.match(html, /data-step-id="choose"/); assert.match(html, /data-step-id="save"/);
    assert.equal((html.match(/data-media-id=/g) || []).length, 3);
    assert.equal((html.match(/>Add images</g) || []).length, 4);
    assert.match(html, /Written transcript/); assert.match(html, /Accessible description/);
    assert.doesNotMatch(html, /Images and video editor/);
    assert.match(html, /&lt;script&gt;keep this literal&lt;\/script&gt;/);
    assert.doesNotMatch(html, /<script>/);
});

test('restricted article editor disables attachment creation without changing its access policy', async () => {
    const value = { ...article, visibility: 'resource-manager', sections: article.sections.map((section) => ({ ...section, media: [] })) };
    const html = (await renderers()).editor(value);
    assert.match(html, /Account access required/);
    assert.doesNotMatch(html, />Add images<|>Add video link</);
    assert.doesNotMatch(html, /name="visibility"/);
});

test('draft preview uses article renderer, safe literal text and no inherited reviewed stamp', async () => {
    const html = (await renderers()).preview(article);
    assert.match(html, /Unpublished draft/);
    assert.match(html, /Scrollable draft preview/);
    assert.match(html, /Add a Personal place/);
    assert.match(html, /Choose a point\./);
    assert.match(html, /After saving/);
    assert.doesNotMatch(html, /Reviewed <time/);
    assert.match(html, /&lt;script&gt;keep this literal&lt;\/script&gt;/);
    assert.doesNotMatch(html, /<iframe|<script/);
});

test('topic field has an explicit accessible association with its select', async () => {
    const html = (await renderers()).select();
    const labelId = html.match(/for="([^"]+)"/)[1], selectId = html.match(/<select id="([^"]+)"/)[1];
    assert.equal(labelId, selectId);
});

test('unsaved new article keeps image upload unavailable while video links remain editable', async () => {
    const html = (await renderers()).editor(article, false);
    assert.match(html, /Save this new article before uploading images/);
    const images = html.match(/<button[^>]*disabled=""[^>]*>Add images<\/button>/g) || [];
    assert.equal(images.length, 4);
    assert.match(html, />Add video link<\/button>/);
});
test('Guide view renders separate conceptual answers from their edited paragraphs', async () => {
    const value = { ...article, sections: [{ ...article.sections[0], title: 'Common questions', steps: [], stepIds: [], paragraphs: ['Changed first answer.', 'Changed second answer.'], facts: [{ id: 'first', title: 'First question' }, { id: 'second', title: 'Second question' }], media: [] }] };
    const html = (await renderers()).guide(value);
    assert.match(html, /First question/); assert.match(html, /Second question/);
    assert.equal((html.match(/class="cms-guide-text"/g) || []).length, 2);
    assert.match(html, /Changed first answer\./); assert.match(html, /Changed second answer\./);
});

test('publication list uses actual backend state records and offers exact-release recovery', async () => {
    const render = await renderers();
    const html = render.publications([{ id: 'release-one', state: 'published', version: 'content-one' }, { id: 'release-two', state: 'dispatch-unconfirmed', version: 'content-two', jobReconciled: true }, { id: 'release-three', state: 'partially-released', version: 'content-three' }]);
    assert.match(html, /Published and verified/); assert.match(html, /Publication needs confirmation/); assert.match(html, /Publication incomplete/);
    assert.equal((html.match(/Retry same publication/g) || []).length, 2);
    assert.doesNotMatch(render.publications([{ id: 'release-four', state: 'failed' }], false), /Retry same publication/);
});

test('published releases suppress obsolete recovery warnings while incomplete releases retain them', async () => {
    const render = await renderers();
    const message = 'Both Help and Guide versions have not been verified. Review recovery before retrying.';
    const release = { id: 'recovered', state: 'published', readiness: { help: true, guide: true, client: true }, message };
    const published = render.publications([release]);
    assert.match(published, /Published and verified/);
    assert.ok(!published.includes(message));
    assert.equal(release.message, message, 'Rendering must preserve the recorded recovery evidence.');
    for (const state of ['failed', 'partially-released', 'dispatch-unconfirmed']) {
        assert.ok(render.publications([{ ...release, state }]).includes(message), `Keep the warning for ${state}.`);
    }
    assert.ok(!render.publications([{ ...release, state: undefined, status: 'published' }]).includes(message));
});

test('uncertain or running publication jobs require a server job check before retry', async () => {
    const render = await renderers();
    const html = render.publications([{ id: 'queued', state: 'queued' }, { id: 'dispatched', state: 'dispatched' }, { id: 'uncertain', state: 'dispatch-unconfirmed' }]);
    assert.equal((html.match(/Check release job/g) || []).length, 3);
    assert.doesNotMatch(html, /Retry same publication/);
    const reconciled = render.publications([{ id: 'checked', state: 'dispatch-unconfirmed', jobReconciled: true }]);
    assert.match(reconciled, /Retry same publication/);
    assert.doesNotMatch(reconciled, /Check release job/);
});

test('verified releases with a remaining publication lock offer explicit final recovery', async () => {
    const render = await renderers();
    const release = { id: 'verified', state: 'published', jobReconciled: true };
    const html = render.publications([release], true, 'verified');
    assert.match(html, /Published and verified/);
    assert.match(html, /Check its job to finish recovery/);
    assert.match(html, /Check release job/);
    assert.doesNotMatch(html, /Retry same publication/);
    assert.doesNotMatch(render.publications([release], true, null), /Check release job/);
});

test('prepared checkpoint remains unpublished and offers an explicit release job check', async () => {
    const html = (await renderers()).publications([{ id: 'prepared-release', state: 'prepared' }]);
    assert.match(html, /Ready for release verification/);
    assert.match(html, /Check release job/);
    assert.doesNotMatch(html, /Published and verified|Retry same publication/);
});


test('both owner editors allow the first instruction on an existing conceptual section', async () => {
    const render = await renderers(), seeded = cmsSeedWorkspace(HELP_CMS_SEED);
    const source = seeded.articles.find((value) => value.id === 'HC-01');
    const value = { ...source, sections: [source.sections[0]] };
    const local = { ...seeded, articles: seeded.articles.map((item) => item.id === value.id ? value : item) };
    for (const html of [render.editor(value), render.context(local, value)]) {
        const buttons = html.match(/<button\b[^>]*>Add instruction<\/button>/g) || [];
        assert.equal(buttons.length, 1);
        assert.doesNotMatch(buttons[0], /\bdisabled=/);
        assert.doesNotMatch(html, />Add paragraph<|>Remove last paragraph</);
    }
    const withSteps = { ...value, sections: [{ ...value.sections[0], steps: ['An optional first instruction.'], stepIds: ['optional-first'] }] };
    const withStepWorkspace = { ...local, articles: local.articles.map((item) => item.id === value.id ? withSteps : item) };
    for (const html of [render.editor(withSteps), render.context(withStepWorkspace, withSteps)]) {
        assert.doesNotMatch(html, />Add paragraph<|>Remove last paragraph</);
    }
});

test('owner instruction controls retain the maximum and pending-operation locks', async () => {
    const render = await renderers(), seeded = cmsSeedWorkspace(HELP_CMS_SEED);
    const source = seeded.articles.find((value) => value.id === 'HC-01');
    const maximum = { ...source, sections: [{ ...source.sections[0], steps: Array.from({ length: 60 }, (_, i) => 'Instruction ' + (i + 1)), stepIds: Array.from({ length: 60 }, (_, i) => 'step-' + (i + 1)) }] };
    const local = { ...seeded, articles: seeded.articles.map((item) => item.id === maximum.id ? maximum : item) };
    for (const html of [render.editor(maximum), render.context(local, maximum)]) {
        const button = (html.match(/<button\b[^>]*>Add instruction<\/button>/g) || [])[0];
        assert.ok(button);
        assert.match(button, /\bdisabled=""/);
    }
    const empty = { ...source, sections: [source.sections[0]] };
    const disabled = render.context({ ...local, articles: local.articles.map((item) => item.id === empty.id ? empty : item) }, empty, true);
    const button = (disabled.match(/<button\b[^>]*>Add instruction<\/button>/g) || [])[0];
    assert.match(button, /\bdisabled=""/);
});
