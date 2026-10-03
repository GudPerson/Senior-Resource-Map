import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { cmsSectionMessage, cmsSeedWorkspace, validateCmsWorkspace } from '../../shared/helpContentCms.js';
import { cloneCms, cmsAddStep, cmsArticleImpact, cmsCanRequest, cmsCanSave, cmsChangeSummary, cmsDirty, cmsLocalId, cmsLoadEnvelope, cmsGuideMessages, cmsMoveArticleWithinTopic, cmsMoveMedia, cmsMoveStep, cmsRemoveStep, cmsSafeVideo, cmsUpdateMedia, updateCmsArticle, updateCmsSection } from '../src/features/help-content/helpContentDraftModel.js';

const section = { id: 'instructions', title: 'Instructions', paragraphs: ['Use your own map.'], steps: ['Choose a point.', 'Review the details.', 'Save the place.'], stepIds: ['point', 'review', 'save'], notes: ['A failed save is not confirmation.'], facts: [{ id: 'help-maps', answerKind: 'procedure' }], media: [
    { id: 'image-one', type: 'image', afterStepId: 'review', caption: 'Review', alt: 'Details', assetId: 'a'.repeat(64) },
    { id: 'intro-image', type: 'image', afterStepId: null, caption: 'Introduction', alt: 'Example', assetId: 'b'.repeat(64) },
    { id: 'video-one', type: 'video', afterStepId: 'review', caption: 'How to review', url: 'https://youtu.be/AbcDef12345', transcript: 'Review and confirm.', transcriptReviewed: true },
] };
const workspace = { manifest: { categories: [{ id: 'maps', title: 'Maps' }, { id: 'other', title: 'Other' }], articleOrder: ['HC-01', 'HC-02', 'HC-03'], topics: [{ id: 'maps', label: 'Maps' }] }, articles: [
    { id: 'HC-01', title: 'First map article', category: 'maps', status: 'approved', sections: [section], relatedArticleIds: [] },
    { id: 'HC-02', title: 'Other article', category: 'other', status: 'approved', sections: [], relatedArticleIds: ['HC-01'] },
    { id: 'HC-03', title: 'Second map article', category: 'maps', status: 'draft', sections: [], relatedArticleIds: [] },
] };

test('instruction reorder retains stable attachment owners and derives new numbers', () => {
    const before = cloneCms(section), changed = cmsMoveStep(section, 'review', -1);
    assert.deepEqual(changed.stepIds, ['review', 'point', 'save']);
    assert.deepEqual(changed.steps, ['Review the details.', 'Choose a point.', 'Save the place.']);
    assert.deepEqual(changed.media, section.media);
    assert.match(cmsSectionMessage(changed), /1\. Review the details\./);
    assert.match(cmsSectionMessage(changed), /2\. Choose a point\./);
    assert.deepEqual(section, before);
    assert.equal(cmsMoveStep(section, 'point', -1), section);
    assert.equal(cmsMoveStep(section, 'missing', 1), section);
});

test('instruction removal requires explicit attachment placement and never silently reassigns', () => {
    assert.throws(() => cmsRemoveStep(section, 'review'), /Choose where/);
    assert.throws(() => cmsRemoveStep(section, 'review', 'review'), /existing instruction/);
    assert.throws(() => cmsRemoveStep(section, 'review', 'missing'), /existing instruction/);
    const introduction = cmsRemoveStep(section, 'review', null);
    assert.deepEqual(introduction.stepIds, ['point', 'save']);
    assert.equal(introduction.media.every((value) => value.afterStepId === null), true);
    const relocated = cmsRemoveStep(section, 'review', 'save');
    assert.equal(relocated.media.find((value) => value.id === 'video-one').afterStepId, 'save');
    const removed = cmsRemoveStep(section, 'review', 'remove');
    assert.deepEqual(removed.media.map((value) => value.id), ['intro-image']);
    assert.deepEqual(cmsRemoveStep(section, 'point').steps, ['Review the details.', 'Save the place.']);
});

test('new instruction identity does not collide after movement or deletion', () => {
    const value = { ...section, stepIds: ['step-1', 'step-3', 'step-2'] };
    const next = cmsAddStep(value);
    assert.equal(next.stepIds.at(-1), 'step-4');
    assert.equal(cmsLocalId('media', ['media-1', 'media-3']), 'media-2');
});

test('attachment ordering stays within its instruction and transcript edits clear review', () => {
    const moved = cmsMoveMedia(section, 'video-one', -1);
    assert.deepEqual(moved.media.map((value) => value.id), ['video-one', 'intro-image', 'image-one']);
    assert.equal(moved.media[1].afterStepId, null);
    assert.equal(cmsMoveMedia(section, 'intro-image', -1), section);
    const text = cmsUpdateMedia(section, 'video-one', 'transcript', 'Changed instructions.');
    assert.equal(text.media[2].transcriptReviewed, false);
    assert.doesNotMatch(cmsSectionMessage(text), /Changed instructions/);
    assert.equal(cmsUpdateMedia(section, 'video-one', 'url', 'https://vimeo.com/1234567').media[2].transcriptReviewed, false);
    assert.equal(cmsUpdateMedia(section, 'video-one', 'caption', 'New caption').media[2].transcriptReviewed, true);
});

test('article movement is scoped to a topic without moving unrelated catalogue entries', () => {
    const moved = cmsMoveArticleWithinTopic(workspace, 'HC-03', -1);
    assert.deepEqual(moved.manifest.articleOrder, ['HC-03', 'HC-02', 'HC-01']);
    assert.deepEqual(workspace.manifest.articleOrder, ['HC-01', 'HC-02', 'HC-03']);
    assert.equal(cmsMoveArticleWithinTopic(workspace, 'HC-02', 1), workspace);
});

test('editing a section preserves unrelated articles, evidence and media', () => {
    const changed = updateCmsSection(workspace, 'HC-01', 'instructions', (value) => ({ ...value, title: 'Updated title' }));
    assert.equal(changed.articles[0].sections[0].title, 'Updated title');
    assert.deepEqual(changed.articles[0].sections[0].facts, section.facts);
    assert.deepEqual(changed.articles[0].sections[0].media, section.media);
    assert.equal(changed.articles[1], workspace.articles[1]);
    assert.equal(updateCmsArticle(workspace, 'missing', () => ({})).articles[0], workspace.articles[0]);
});

test('archive impact identifies incoming links, Guide evidence and quick topic mappings', () => {
    const impact = cmsArticleImpact(workspace, 'HC-01');
    assert.deepEqual(impact.incoming.map((value) => value.id), ['HC-02']);
    assert.equal(impact.factCount, 1);
    assert.deepEqual(impact.topicIds, ['maps']);
});

test('dirty and change summaries include topic edits, article order, text and attachments', () => {
    assert.equal(cmsDirty(workspace, cloneCms(workspace)), false);
    const changed = cloneCms(workspace); changed.manifest.categories.reverse(); changed.articles[0].sections[0].media[0].caption = 'Updated';
    assert.equal(cmsDirty(changed, workspace), true);
    assert.deepEqual(cmsChangeSummary(changed, workspace), ['Topic order changed', 'Article changed: First map article']);
});

test('CMS request gate denies loading, signed-out and User View identities without using role as authority', () => {
    assert.equal(cmsCanRequest(null), false);
    assert.equal(cmsCanRequest({ id: 1, role: 'super_admin' }, false, true), false);
    assert.equal(cmsCanRequest({ id: 1 }, true), false);
    assert.equal(cmsCanRequest({ id: 1, isImpersonating: true }), false);
    assert.equal(cmsCanRequest({ id: 1, role: 'standard_user' }), true);
});

test('video validation accepts specific links and rejects credentials, hosts, channels and scripts', () => {
    assert.equal(cmsSafeVideo('https://youtu.be/AbcDef12345#t=10'), 'https://youtu.be/AbcDef12345');
    assert.equal(cmsSafeVideo('https://vimeo.com/1234567'), 'https://vimeo.com/1234567');
    assert.equal(cmsSafeVideo('https://m.youtube.com/watch?v=AbcDef12345#t=10'), 'https://m.youtube.com/watch?v=AbcDef12345');
    assert.equal(cmsSafeVideo('https://www.youtu.be/AbcDef12345'), 'https://www.youtu.be/AbcDef12345');
    for (const value of ['javascript:alert(1)', 'http://youtu.be/AbcDef12345', 'https://youtu.be.evil.test/AbcDef12345', 'https://user:password@youtu.be/AbcDef12345', 'https://youtu.be:444/AbcDef12345', 'https://www.youtube.com/channel/AbcDef12345', 'https://vimeo.com/channels/1234567']) assert.throws(() => cmsSafeVideo(value), /specific HTTPS/);
});

test('initial owner workspace can be unsaved with a null ETag', () => {
    assert.equal(cmsLoadEnvelope({ workspace, etag: null }).etag, null);
    assert.equal(cmsLoadEnvelope({ workspace, etag: 'revision' }).etag, 'revision');
    assert.throws(() => cmsLoadEnvelope({ workspace }), /could not be opened/);
});
test('conceptual Guide preview synchronises each legacy answer without mixing sibling paragraphs', () => {
    const value = { ...section, steps: [], stepIds: [], paragraphs: ['First answer.', 'Second answer.'], facts: [{ id: 'first', title: 'First question', message: 'Old first.' }, { id: 'second', title: 'Second question', message: 'Old second.' }] };
    const messages = cmsGuideMessages(value);
    assert.equal(messages.length, 2);
    assert.match(messages[0].text, /First answer/); assert.doesNotMatch(messages[0].text, /Second answer|Old first/);
    assert.match(messages[1].text, /Second answer/); assert.doesNotMatch(messages[1].text, /First answer|Old second/);
    assert.match(messages[0].text, /Review and confirm/); assert.match(messages[1].text, /A failed save/);
});

test('first-save client contract accepts the complete seeded library including restricted evidence and null ETag', () => {
    const folder = new URL('../../content/help/', import.meta.url);
    const manifest = JSON.parse(readFileSync(new URL('manifest.json', folder), 'utf8'));
    const articles = readdirSync(new URL('articles/', folder)).filter((name) => name.endsWith('.json')).sort().map((name) => JSON.parse(readFileSync(new URL(`articles/${name}`, folder), 'utf8')));
    const initial = cmsSeedWorkspace({ manifest, articles });
    assert.ok(initial.articles.some((article) => article.visibility !== 'public'));
    assert.ok(initial.articles.some((article) => article.sections.some((section) => section.facts.length > 0)));
    assert.doesNotThrow(() => validateCmsWorkspace(initial));
    assert.equal(cmsCanSave(initial, cloneCms(initial), null, { configured: true }), true);
    assert.equal(cmsCanSave(initial, cloneCms(initial), 'saved-etag', { configured: true }), false);
    assert.equal(cmsCanSave(initial, cloneCms(initial), null, { configured: false }), false);
});
