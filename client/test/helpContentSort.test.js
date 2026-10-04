import test from 'node:test';
import assert from 'node:assert/strict';
import { moveCmsId, placeCmsItem, placeCmsArticle, placeCmsStep, cmsSortTarget } from '../src/features/help-content/helpContentSortModel.js';

test('reordering visible topics preserves hidden slots and every topic object', () => {
    const topics = [{ id: 'A' }, { id: 'hidden', archived: true }, { id: 'B' }, { id: 'C' }];
    const next = placeCmsItem(topics, 'A', 'B', ['A', 'B']);
    assert.deepEqual(next.map((value) => value.id), ['B', 'hidden', 'A', 'C']);
    assert.equal(next[1], topics[1]); assert.equal(next[0], topics[2]);
    assert.equal(placeCmsItem(topics, 'hidden', 'A', ['A', 'B']), topics);
});

test('reordering filtered articles preserves hidden and unrelated category positions', () => {
    const workspace = { manifest: { articleOrder: ['A', 'hidden', 'other', 'B', 'C'] }, articles: ['A', 'hidden', 'B', 'C'].map((id) => ({ id, category: 'one' })).concat({ id: 'other', category: 'two' }) };
    const next = placeCmsArticle(workspace, 'A', 'B', ['A', 'B']);
    assert.deepEqual(next.manifest.articleOrder, ['B', 'hidden', 'other', 'A', 'C']);
    assert.equal(next.articles, workspace.articles);
    assert.equal(placeCmsArticle(workspace, 'A', 'other'), workspace);
    assert.equal(placeCmsArticle(workspace, 'hidden', 'B', ['A', 'B']), workspace);
});

test('step text follows stable IDs while media and reviewed facts remain attached', () => {
    const section = { id: 'one', stepIds: ['first', 'second', 'third'], steps: ['Choose map', 'Add place', 'Save'], media: [{ id: 'image', afterStepId: 'second' }], facts: [{ id: 'reviewed' }] };
    const next = placeCmsStep(section, 'second', 'first');
    assert.deepEqual(next.stepIds, ['second', 'first', 'third']);
    assert.deepEqual(next.steps, ['Add place', 'Choose map', 'Save']);
    assert.equal(next.media, section.media); assert.equal(next.facts, section.facts);
    assert.equal(next.media[0].afterStepId, 'second');
    assert.deepEqual(section.stepIds, ['first', 'second', 'third']);
});

test('section order moves complete section identities and invalid destinations are no-ops', () => {
    const sections = [{ id: 'intro', steps: ['One'] }, { id: 'details', media: [{ afterStepId: 'step' }] }];
    const next = placeCmsItem(sections, 'details', 'intro');
    assert.equal(next[0], sections[1]); assert.equal(next[1], sections[0]);
    assert.equal(placeCmsItem(sections, 'missing', 'intro'), sections);
    const ids = ['one', 'two']; assert.equal(moveCmsId(ids, 'one', 'one'), ids);
    const duplicates = ['one', 'one']; assert.equal(moveCmsId(duplicates, 'one', 'two'), duplicates);
});

test('drop targeting resolves stable row IDs rather than a filtered model index', () => {
    const rows = [{ id: 'visible-A', top: 20, bottom: 80 }, { id: 'visible-B', top: 110, bottom: 170 }];
    assert.equal(cmsSortTarget(rows, 35), 'visible-A');
    assert.equal(cmsSortTarget(rows, 150), 'visible-B');
    assert.equal(cmsSortTarget(rows, 180), 'visible-B');
    assert.equal(cmsSortTarget(rows, NaN), null);
    assert.equal(cmsSortTarget([], 30), null);
});
