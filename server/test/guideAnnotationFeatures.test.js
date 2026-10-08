import test from 'node:test';
import assert from 'node:assert/strict';
import { createGuideRoutes } from '../src/routes/guide.js';
import { answerGuideWithCloudflare } from '../src/utils/guideChat.js';
import { answerGuideHelpWorkflow } from '../src/utils/guideHelpWorkflows.js';
import { guideAnnotationFeatureFact, guideAnnotationFeatureIntent, guideAnnotationGroundingFacts,
    qualifyGuideAnnotationAnswer } from '../src/utils/guideAnnotationFeatures.js';
import { GUIDE_ORACLE_FACTS } from '../src/generated/helpKnowledge.js';
import { guideHistoryInputSchema, restoreGuideHistory } from '../src/utils/guideHistory.js';

let sequence = 0;
const user = { id: 9126, role: 'standard' };
function fixture(actor = user) {
    const calls = { model: 0, private: 0 };
    const forbidden = async () => { calls.private++; throw new Error('Product instructions must not read account records.'); };
    const router = createGuideRoutes({ authenticate: async (c, next) => { c.set('user', actor); await next(); },
        directoryAccess: async (c, next) => next(), saved: forbidden, personalPlaces: forbidden,
        plans: forbidden, managed: forbidden, helpCapabilities: forbidden });
    const env = { NODE_ENV: 'test', SUPPORT_INBOX_ENABLED: 'true', GUIDE_CHAT_ENABLED: 'true',
        GUIDE_SEMANTIC_RETRIEVAL_ENABLED: 'true', AI: { run: async () => { calls.model++; throw new Error('No model call expected.'); } } };
    return { calls, ask: async (body) => {
        const response = await router.request('/answer', { method: 'POST', headers: { 'Content-Type': 'application/json',
            'cf-connecting-ip': `198.51.100.${++sequence}` }, body: JSON.stringify({ useAi: true, ...body }) }, env);
        return { status: response.status, answer: await response.json() };
    } };
}

test('actual Guide route gives current private image and tagging procedures without model or account reads', async () => {
    const h = fixture();
    for (const [question, expectedId, clauses] of [
        ['How do I add a photo to my Care Map?', 'map-private-image-annotations', [/Edit content → Annotate → Add image/, /PNG, JPEG or WebP/, /centre handle/, /keeping its proportions/, /wait for Saved/]],
        ['How do I link one annotation to multiple map resource cards?', 'map-annotation-resource-links', [/Tag Resources/, /resources already in that map/, /Appear/, /Pulse/, /Highlight/, /every map location/, /Saved-view hidden annotations stay hidden/]],
        ['How do I tag resources on an image annotation in Care Maps?', 'map-annotation-resource-links', [/Tag Resources/, /Selecting an annotation identifies its linked cards/, /selecting a card activates linked annotations/]],
        ['Can image annotations on my map be shared in website embeds?', 'map-private-image-annotations', [/owner-private/, /excluded from shared links and website embeds/, /only to shareable drawing shapes/]],
        ['How are map annotations shared?', 'map-annotation-private-sharing-boundary', [/Share this annotation/, /existing explicit publishing rules/, /temporary selection and pulse effects are not saved or exported/]],
    ]) {
        const { status, answer } = await h.ask({ question, pageContext: 'My Maps' });
        assert.equal(status, 200); assert.equal(answer.topicId, expectedId); assert.equal(answer.answerSource, 'reviewed');
        for (const clause of clauses) assert.match(answer.message, clause);
        assert.match(answer.message, /owner-private/); assert.match(answer.message, /PNG\/PDF downloads can include private images/);
        assert.deepEqual(answer.actions, [{ label: 'Open Care Maps', route: '/my-directory?section=my-maps' }]);
        assert.deepEqual(answer.input, { question });
        assert.doesNotMatch(JSON.stringify(answer), /client\/src|server\/src|resourceId|assetId|resourceLinks|DATABASE|Bearer/);
    }
    assert.deepEqual(h.calls, { model: 0, private: 0 });
});

test('four locale replies use available tool names, preserve old request shape, and reject unknown locale fields', async () => {
    const h = fixture();
    const expected = { en: 'Tag Resources', 'zh-CN': '关联资源', ms: 'Pautkan Sumber', ta: 'வளங்களை இணைக்கவும்' };
    for (const locale of Object.keys(expected)) {
        const question = 'How do I link an annotation to resource cards on my map?';
        const { status, answer } = await h.ask({ question, locale });
        assert.equal(status, 200); assert.ok(answer.message.includes(expected[locale]));
        assert.ok(answer.message.length <= 1600); assert.deepEqual(answer.input, { question });
        assert.equal(guideHistoryInputSchema.safeParse(answer.input).success, true);
        assert.equal(guideHistoryInputSchema.safeParse({ ...answer.input, locale }).success, false);
    }
    assert.equal((await h.ask({ question: 'How do I add an image to my map?' })).status, 200);
    assert.equal((await h.ask({ question: 'How do I add an image to my map?', locale: 'fr' })).status, 400);
});

test('guest and User View responses describe owner tools without granting edit access or reading data', async () => {
    for (const actor of [null, { id: 55, role: 'guest' }, { ...user, isImpersonating: true }]) {
        const h = fixture(actor), { answer, status } = await h.ask({ question: 'How can I tag resources on a map annotation?' });
        assert.equal(status, 200); assert.deepEqual(answer.actions, [{ label: 'Sign in to continue', route: '/login' }]);
        assert.match(answer.message, /Care Map you own/); assert.deepEqual(h.calls, { model: 0, private: 0 });
    }
    for (const question of ['Extract programmes from a flyer image into my Care Map', 'How do I upload an image to a public Place?',
        'How do I upload a resource photo while using my Care Map?', "Show my colleague's map images", 'What is a healthy pulse?', 'What is my normal pulse rate?', 'How do I update a map resource address?']) {
        assert.equal(guideAnnotationFeatureIntent(question), null, question);
        assert.equal(guideAnnotationFeatureIntent(question, 'My Maps'), null, question);
    }
});

test('the reviewed shape sharing answer retains exact library text and citations after the new privacy qualification', () => {
    const before = JSON.stringify(GUIDE_ORACLE_FACTS);
    const answer = answerGuideHelpWorkflow({ question: 'How are Care Map notes and annotations shared?', actor: user });
    const privacy = guideAnnotationFeatureFact('privacy');
    assert.equal(answer.topicId, 'map-note-annotation-sharing'); assert.ok(answer.message.startsWith(privacy.message + '\n\n'));
    assert.match(answer.message, /Share this note/); assert.match(answer.message, /Share this annotation/);
    assert.match(answer.message, /selects all saved annotations or none/); assert.match(answer.message, /Update shared link/);
    assert.equal(answer.sources.at(-1).id, privacy.id);
    assert.equal(qualifyGuideAnnotationAnswer(answer), answer);
    const source = GUIDE_ORACLE_FACTS.find(f => f.id === 'article-hc-16-share-annotation-steps');
    const facts = [source], grounding = guideAnnotationGroundingFacts(facts, { question: 'Review my drawings' });
    assert.equal(grounding[0], source); assert.equal(grounding[1].id, privacy.id); assert.equal(facts.length, 1);
    assert.equal(JSON.stringify(GUIDE_ORACLE_FACTS), before);
});

test('actual semantic AI grounding includes the separate private boundary and server qualifies the selected reviewed text', async () => {
    const fact = GUIDE_ORACLE_FACTS.find(f => f.id === 'article-hc-16-annotation-boundary');
    const calls = [];
    const env = { NODE_ENV: 'test', GUIDE_CHAT_ENABLED: 'true', GUIDE_SEMANTIC_RETRIEVAL_ENABLED: 'true',
        AI: { run: async (_model, input) => { calls.push(input); return { response: JSON.stringify({ factIds: [fact.id] }) }; } } };
    const answer = await answerGuideWithCloudflare({ question: 'Why should I review drawings on my Care Map?', env });
    assert.equal(calls.length, 2);
    assert.match(calls[1].messages[0].content, /map-annotation-private-sharing-boundary/);
    assert.match(calls[1].messages[0].content, /owner-private.*excluded from shared links and website embeds/);
    assert.equal(answer.message, guideAnnotationFeatureFact('privacy').message + '\n\n' + fact.message);
    assert.equal(answer.sources.at(-1).id, guideAnnotationFeatureFact('privacy').id);
    assert.equal(calls[0].max_tokens, 90); assert.equal(calls[1].max_tokens, 90);
    assert.equal(calls[1].temperature, 0);
});

test('saved question-only history restores current image/tag instructions and old inputs remain valid', () => {
    const inputs = [{ question: 'How do I add an image to my Care Map?' }, { question: 'How do I tag resources on a map annotation?' },
        { question: 'How are my map notes and annotations shared?' }, { topicId: 'maps' }];
    const before = structuredClone(inputs);
    const restored = restoreGuideHistory({ id: 'history-fictional', title: 'Fictional history', revision: 1, inputs }, user);
    assert.equal(restored.messages[0].topicId, 'map-private-image-annotations');
    assert.equal(restored.messages[1].topicId, 'map-annotation-resource-links');
    assert.equal(restored.messages[2].topicId, 'map-note-annotation-sharing');
    for (const message of restored.messages.slice(0, 3)) assert.match(message.message, /owner-private/);
    assert.equal(restored.messages[3].topicId, 'maps'); assert.deepEqual(inputs, before);
    assert.deepEqual(restored.messages.map(m => m.input), inputs);
});
