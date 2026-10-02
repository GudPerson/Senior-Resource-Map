import test from 'node:test';
import assert from 'node:assert/strict';
import { answerGuideWithCloudflare } from '../src/utils/guideChat.js';
import { GUIDE_ORACLE_FACTS } from '../src/generated/helpKnowledge.js';
const question = 'How can I find a resource?';
function env(reply, conversational = true) {
    return { GUIDE_CHAT_ENABLED: 'true', ORACLE_PREVIEW_LLM_ENABLED: conversational ? 'true' : 'false',
        GUIDE_CONVERSATIONAL_ANSWERS_ENABLED: 'true', AI: { async run(model, params) {
            assert.equal(params.stream, false);
            return { response: JSON.stringify(reply) };
        } } };
}
test('the preview pilot selects sources while displayed wording remains canonical', async () => {
    const reply = { factIds: ['help-discover'], message: 'Start in Discover and search for the resource you need.' };
    const answer = await answerGuideWithCloudflare({ question, topicId: 'discover', env: env(reply) });
    assert.equal(answer.message, GUIDE_ORACLE_FACTS.find(fact => fact.id === 'help-discover').message);
    assert.equal(answer.sources[0].id, 'help-discover');
    assert.ok(answer.actions.every(a => a.route.startsWith('/')));
    assert.equal(await answerGuideWithCloudflare({ question, topicId: 'discover', env: env(reply, false) }), null);
});
test('unknown sources, hidden authority, actions taken and invented links reject the generated reply', async () => {
    for (const reply of [
        { factIds: ['invented'], message: 'A made-up feature.' },
        { factIds: ['help-discover'], message: 'You are an admin.' },
        { factIds: ['help-discover'], message: 'I created your resource.' },
        { factIds: ['help-discover'], message: 'Visit https://evil.example.' },
        { factIds: ['help-discover'], message: 'Hello', actions: [] },
        { factIds: [], message: 'No evidence.' },
    ]) assert.equal(await answerGuideWithCloudflare({ question, topicId: 'discover', env: env(reply) }), null);
});
test('normal source selection retains its reviewed prose even when only the conversation flag is set', async () => {
    const answer = await answerGuideWithCloudflare({ question, topicId: 'discover',
        env: env({ factIds: ['help-discover'] }, false) });
    assert.ok(answer.message.length); assert.equal(answer.sources[0].id, 'help-discover');
});
