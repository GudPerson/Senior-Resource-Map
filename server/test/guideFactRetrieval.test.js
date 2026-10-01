import test from 'node:test';
import assert from 'node:assert/strict';
import { createGuideFactIndex } from '../src/utils/guideFactRetrieval.js';
import { retrieveGuideOracleFacts } from '../src/utils/guideOracleKnowledge.js';
import { answerGuideWithCloudflare } from '../src/utils/guideChat.js';

test('Content retrieval recovers reviewed explanations beyond anticipated keywords', () => {
    for (const [question, expected] of [
        ['Where can I amend the dated sessions on an existing service?', 'offering-schedule-edit'],
        ['Can a downloaded map file track later changes automatically?', 'my-map-exports'],
        ['What happens to local overrides when I propagate a template?', 'offering-template-propagation'],
        ['Are in-app updates the same as WhatsApp or email alerts?', 'notification-delivery-channels'],
        ['How do I choose a filtered count before hiding many listings?', 'resource-hide-delete'],
        ['Is the provider availability counter a confirmed seat?', 'provider-availability'],
    ]) assert.ok(retrieveGuideOracleFacts(question).some((fact) => fact.id === expected), question);
});

test('Unrelated words and a suggested help topic do not supply missing evidence', () => {
    for (const question of ['What is the weather forecast tomorrow?', 'How do I repair a broken washing machine?',
        'Can I upload a workbook to predict stock prices?', 'Do you support cryptocurrency portfolio rebalancing?'])
        assert.deepEqual(retrieveGuideOracleFacts(question, 'support'), [], question);
});

test('Index uses public reviewed prose only, applies explicit fact context and caps retrieval before prompts', () => {
    const facts = [
        { id: 'body', title: 'Download', keywords: ['download'], message: 'The exported workbook is a snapshot of resource contacts.',
            evidence: 'private source nonceword secretmarker', route: '/secretmarker' },
        { id: 'conditional', title: 'Volunteer workbook contacts', keywords: ['workbook contacts'],
            message: 'A volunteer workbook has resource contacts.', queryRequiresAny: ['volunteer'] },
        ...Array.from({ length: 5 }, (_, index) => ({ id: `contact-${index}`, title: 'Resource contacts',
            keywords: ['contacts'], message: 'Contact details are reviewed resource contacts.' })),
    ];
    const rank = createGuideFactIndex(facts);
    assert.deepEqual(rank('nonceword secretmarker'), []);
    assert.ok(rank('exported snapshot workbook').some((fact) => fact.id === 'body'));
    assert.equal(rank('resource contacts', { limit: 100 }).length, 4);
    assert.equal(rank('workbook contacts').some((fact) => fact.id === 'conditional'), false);
    assert.ok(rank('volunteer workbook contacts').some((fact) => fact.id === 'conditional'));
    assert.deepEqual(rank('exported snapshot workbook', { eligible: (fact) => fact.id === 'body' }).map((fact) => fact.id), ['body']);
    assert.deepEqual(rank('workbook contacts', { eligible: () => false }), []);
});

test('Literal anchors recognise plural phrases but do not match word fragments or a different role', () => {
    assert.equal(retrieveGuideOracleFacts('Can visitors see my private map notes?')[0]?.id, 'map-note-privacy');
    assert.equal(retrieveGuideOracleFacts('Can a membership QR make me a manager?')[0]?.id, 'place-membership');
    assert.equal(retrieveGuideOracleFacts('Can I add a new centre?').some((fact) => fact.id === 'volunteer-place-create-boundary'), false);
    assert.equal(retrieveGuideOracleFacts('Is everyone shown restricted Offerings?').some((fact) => fact.id === 'group-target-regions'), false);
    const rank = createGuideFactIndex([{ id: 'book', title: 'Booking a seat', keywords: ['booking'], message: 'A booking reserves a seat.' }]);
    assert.deepEqual(rank('bookkeeping accounts'), []);
});

test('Content-derived candidates still allow only selected reviewed IDs and no authored product text', async () => {
    const question = 'What happens to local overrides when I propagate a template?';
    let calls = 0;
    let prompt = '';
    const env = { GUIDE_CHAT_ENABLED: 'true', AI: { run: async (_model, request) => {
        calls++; prompt = request.messages[0].content;
        return { response: '{"factIds":["offering-template-propagation"]}' };
    } } };
    const answer = await answerGuideWithCloudflare({ question, env });
    assert.equal(calls, 1);
    assert.equal(answer.sources[0].id, 'offering-template-propagation');
    assert.equal(answer.topicId, 'offering-template-propagation');
    assert.deepEqual(answer.actions, [{ label: 'Open Manage My Resources', route: '/dashboard/resources' }]);
    assert.match(answer.message, /local override/);
    assert.doesNotMatch(prompt, /queryRequiresAny|server\/src\/|controllers\/|secretmarker/);
    const invalid = await answerGuideWithCloudflare({ question, env: { ...env, AI: { run: async () => ({ response: '{"factIds":["invented-template-rule"]}' }) } } });
    assert.equal(invalid, null);
});

test('Guide selected fact replaces unrelated fallback topic and navigation', async () => {
    const { createGuideRoutes } = await import('../src/routes/guide.js');
    const router = createGuideRoutes({ authenticate: async (c, next) => { c.set('user', { id: 4, role: 'standard' }); await next(); } });
    const result = await router.request('/answer', { method: 'POST', headers: {
        'Content-Type': 'application/json', 'cf-connecting-ip': '198.51.100.242' },
        body: JSON.stringify({ question: 'Where can I amend the dated sessions on an existing service?', useAi: true }) }, {
        SUPPORT_INBOX_ENABLED: 'true', GUIDE_CHAT_ENABLED: 'true',
        AI: { run: async () => ({ response: '{"factIds":["offering-schedule-edit"]}' }) },
    });
    const answer = await result.json();
    assert.equal(answer.topicId, 'offering-schedule-edit');
    assert.deepEqual(answer.actions, [{ label: 'Open Manage My Resources', route: '/dashboard/resources' }]);
    assert.doesNotMatch(JSON.stringify(answer.actions), /login|sign in|Draft a report/i);
});
