import test from 'node:test';
import assert from 'node:assert/strict';
import { answerGuideQuestion, GUIDE_TOPICS } from '../src/utils/guideKnowledge.js';
import { GUIDE_ORACLE_FACTS, answerGuideOracleFact, answerGuideUnverifiedWorkflow, guideOracleFactAction } from '../src/utils/guideOracleKnowledge.js';
import { answerGuideWithCloudflare } from '../src/utils/guideChat.js';

const savedRoute = '/my-directory?section=saved-assets';
const actor = { id: 4, role: 'standard' };

test('save and unsave quick topics open Saved Resources while map topics keep the Directory default', () => {
    for (const topicId of ['save', 'unsave']) {
        const topic = GUIDE_TOPICS.find(({ id }) => id === topicId);
        const original = JSON.stringify(topic);
        assert.equal(answerGuideQuestion({ topicId }, actor).actions[0].route, savedRoute);
        assert.equal(answerGuideQuestion({ topicId }).actions[0].route, '/login');
        assert.equal(topic.route, '/my-directory');
        assert.equal(JSON.stringify(topic), original);
    }
    for (const topicId of ['maps', 'sharing']) {
        assert.equal(answerGuideQuestion({ topicId }, actor).actions[0].route, '/my-directory');
        assert.equal(answerGuideQuestion({ topicId }).actions[0].route, '/login');
    }
});

test('saved-resource facts select the saved tab without rewriting published source routes', () => {
    for (const id of ['help-save', 'help-unsave', 'hidden-saved-resources', 'saved-versus-managed',
        'saved-identity-privacy', 'saved-list-privacy', 'other-account-saved-privacy',
        'saved-resource-removal', 'saved-not-eligible', 'saved-resource-status']) {
        const fact = GUIDE_ORACLE_FACTS.find((item) => item.id === id);
        assert.ok(fact, id);
        const original = JSON.stringify(fact);
        assert.equal(guideOracleFactAction(fact).route, savedRoute, id);
        assert.equal(fact.route, '/my-directory', id);
        assert.equal(JSON.stringify(fact), original, id);
    }
    const answer = answerGuideOracleFact('Can I delete a Place from My Directory?');
    assert.equal(answer.topicId, 'saved-resource-removal');
    assert.equal(answer.actions[0].route, savedRoute);
    assert.equal(answer.sources[0].route, '/my-directory');
    for (const id of ['help-maps', 'map-membership', 'saved-to-shared-map', 'directory-export-boundary']) {
        assert.equal(guideOracleFactAction(GUIDE_ORACLE_FACTS.find((item) => item.id === id)).route, '/my-directory', id);
    }
    assert.equal(guideOracleFactAction({ id: 'unreviewed-saved-fact', title: 'Saved', route: '/my-directory' }).route, '/my-directory');
    assert.equal(guideOracleFactAction({ id: 'help-save', title: 'Saved', route: '/discover' }).route, '/discover');
});

test('unverified saved-list controls open Saved Resources while Care Map controls open the default', () => {
    assert.equal(answerGuideUnverifiedWorkflow('How do I hide a saved Place from My Directory?').actions[0].route, savedRoute);
    assert.equal(answerGuideUnverifiedWorkflow('How do I edit a Place in my Care Map?').actions[0].route, '/my-directory');
    assert.equal(answerGuideUnverifiedWorkflow('Can I import a workbook into Care Maps?').actions[0].route, '/my-directory');
});

test('reviewed AI selection retains distinct saved and map destinations and deduplicates each tab', async () => {
    for (const [factIds, expectedRoutes] of [
        [['saved-versus-managed', 'map-membership'], [savedRoute, '/my-directory']],
        [['saved-versus-managed', 'saved-resource-status'], [savedRoute]],
    ]) {
        let calls = 0;
        const env = { GUIDE_CHAT_ENABLED: 'true', GUIDE_SEMANTIC_RETRIEVAL_ENABLED: 'true',
            AI: { run: async () => { calls++; return { response: { factIds } }; } } };
        const answer = await answerGuideWithCloudflare({
            question: 'What is the distinction between my saved resources, management access, and personal map membership?',
            pageContext: 'My Directory', env,
        });
        assert.equal(calls, 2);
        assert.equal(answer.topicId, 'reviewed-selection');
        assert.deepEqual(answer.actions.map(({ route }) => route), expectedRoutes);
        assert.deepEqual(answer.sources.map(({ id }) => id), factIds);
        assert.ok(answer.sources.every(({ route }) => route === '/my-directory'));
        assert.equal(answer.message, factIds.map((id) => GUIDE_ORACLE_FACTS.find((fact) => fact.id === id).message).join('\n\n'));
    }
});
