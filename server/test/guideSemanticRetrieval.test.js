import test from 'node:test';
import assert from 'node:assert/strict';
import { createGuideFactCatalog, discoverGuideOracleFacts } from '../src/utils/guideSemanticRetrieval.js';
import { answerGuideWithCloudflare, safeGuideChatTurns } from '../src/utils/guideChat.js';
import { GUIDE_ORACLE_FACTS, guideOracleDiscoveryFacts } from '../src/utils/guideOracleKnowledge.js';
import { guideSavedResourceIntent } from '../src/utils/guideSavedResources.js';
import { createGuideRoutes } from '../src/routes/guide.js';

const fact = (id) => GUIDE_ORACLE_FACTS.find((item) => item.id === id);
function model(sequence, extra = {}) {
    const calls = [];
    const env = { GUIDE_CHAT_ENABLED: 'true', GUIDE_SEMANTIC_RETRIEVAL_ENABLED: 'true',
        ...extra, AI: { run: async (...args) => {
            calls.push(args);
            const next = sequence[calls.length - 1];
            if (next instanceof Error) throw next;
            return { response: next };
        } } };
    return { env, calls };
}
const selection = (...factIds) => ({ factIds });

test('Discovery catalog contains only bounded unique public IDs and titles', () => {
    const entry = { id: 'public-fact', title: '  Public\n title  ', message: 'Full prose',
        evidence: 'internal/source.js:4', route: '/private-route', accountName: 'Private Name' };
    assert.equal(createGuideFactCatalog([entry]), 'public-fact — Public title');
    assert.equal(createGuideFactCatalog([entry, entry]), null);
    assert.equal(createGuideFactCatalog([{ ...entry, id: '../source' }]), null);
    assert.equal(createGuideFactCatalog([{ ...entry, title: 'x'.repeat(141) }]), null);
    assert.equal(createGuideFactCatalog([]), null);
    assert.equal(createGuideFactCatalog(Array.from({ length: 151 }, (_, i) => ({ id: `fact-${i}`, title: 'Title' }))), null);
    assert.equal(createGuideFactCatalog(Array.from({ length: 150 }, (_, i) => ({ id: `fact-${i}`, title: 'x'.repeat(140) }))), null);
    const catalog = createGuideFactCatalog(guideOracleDiscoveryFacts('Will hearting an activity appoint me as the manager?'));
    assert.ok(catalog && catalog.length <= 14000);
    assert.doesNotMatch(catalog, /server\/src|client\/src|\.js:\d|\/dashboard\//);
});

test('Injected discovery locates unfamiliar wording, then complete prose supplies trusted text and action', async () => {
    const { env, calls } = model([selection('saved-versus-managed'), selection('saved-versus-managed')]);
    const answer = await answerGuideWithCloudflare({ question: 'Will hearting an activity appoint me as the manager?',
        pageContext: 'My Directory', env });
    assert.equal(calls.length, 2);
    assert.equal(answer.message, fact('saved-versus-managed').message);
    assert.equal(answer.topicId, 'saved-versus-managed');
    assert.deepEqual(answer.sources.map(({ id }) => id), ['saved-versus-managed']);
    assert.deepEqual(answer.actions.map(({ route }) => route), ['/my-directory?section=saved-assets']);
    const catalogPrompt = calls[0][1].messages[0].content;
    assert.match(catalogPrompt, /reviewed fact catalog/);
    assert.match(catalogPrompt, /saved-versus-managed — Saved resources and managed resources/);
    assert.doesNotMatch(catalogPrompt, /Saving does not itself give you permission/);
    assert.match(calls[1][1].messages[0].content, /Saving does not itself give you permission/);
    assert.doesNotMatch(calls[1][1].messages[0].content, /help-maps —/);
});

test('Discovery can replace a lexical map-membership match with reviewed Place membership evidence', async () => {
    const { env, calls } = model([selection('place-membership'), selection('place-membership')]);
    const answer = await answerGuideWithCloudflare({
        question: 'Do membership checks happen separately from signing up for a Programme?', env });
    assert.equal(calls.length, 2);
    assert.equal(answer.message, fact('place-membership').message);
    assert.match(answer.message, /does not register you.*or give you permission to edit/);
    assert.doesNotMatch(calls[1][1].messages[0].content, /map-membership —/);
});

test('Invalid discovery IDs, malformed output and empty selection never reach the second selector', async () => {
    for (const response of [selection('invented-fact'), selection('saved-versus-managed', 'saved-versus-managed'),
        { factIds: ['saved-versus-managed'], route: '/admin' }, selection(),
        { factIds: ['saved-versus-managed'], answer: 'x'.repeat(601) }, 'An unreviewed answer']) {
        const { env, calls } = model([response]);
        assert.equal(await answerGuideWithCloudflare({ question: 'Will hearting an activity appoint me as the manager?', env }), null);
        assert.equal(calls.length, 1);
    }
});

test('Catalog discovery preserves unsupported, private and applicability guards', async () => {
    const { env, calls } = model([selection('place-membership')]);
    assert.deepEqual(await discoverGuideOracleFacts({ question: 'Can I upload a My Map workbook?', env }), []);
    assert.equal(calls.length, 0);
    const guardedQuestion = 'Does hiding a public Place erase it or only hide it?';
    const guarded = guideOracleDiscoveryFacts(guardedQuestion);
    assert.ok(guarded.length && guarded.length < GUIDE_ORACLE_FACTS.length);
    assert.ok(guarded.some(({ id }) => id === 'resource-hide-delete'));
    assert.ok(!guarded.some(({ id }) => id === 'place-membership'));
    assert.deepEqual(await discoverGuideOracleFacts({
        question: guardedQuestion, env }), []);
    assert.equal(calls.length, 1);
    assert.ok(!guideOracleDiscoveryFacts('How does CareAround work?').some(({ id }) => id === 'map-note-privacy'));
});

test('Complete-prose rejection and either-stage Gateway failure leave reviewed fallback available', async () => {
    for (const response of [selection('place-membership'), selection(), 'Create the Place now',
        Object.assign(new Error('Gateway spend limit reached'), { status: 429 })]) {
        const { env, calls } = model([selection('saved-versus-managed'), response]);
        assert.equal(await answerGuideWithCloudflare({ question: 'Will hearting an activity appoint me as the manager?', env }), null);
        assert.equal(calls.length, 2);
    }
    const { env, calls } = model([new Error('Gateway unavailable')]);
    assert.equal(await answerGuideWithCloudflare({ question: 'Will hearting an activity appoint me as the manager?', env }), null);
    assert.equal(calls.length, 1);
});

test('Separate flag preserves lexical mode and both production stages use the same private Gateway options', async () => {
    const legacy = model([selection('help-maps')], { GUIDE_SEMANTIC_RETRIEVAL_ENABLED: 'false' });
    assert.equal((await answerGuideWithCloudflare({ question: 'How do I create a map?', env: legacy.env })).topicId, 'help-maps');
    assert.equal(legacy.calls.length, 1);
    const disabled = model([], { NODE_ENV: 'production' });
    assert.equal(await answerGuideWithCloudflare({ question: 'Will hearting an activity appoint me as the manager?', env: disabled.env }), null);
    assert.equal(disabled.calls.length, 0);
    const enabled = model([selection('saved-versus-managed'), selection('saved-versus-managed')],
        { NODE_ENV: 'production', GUIDE_AI_GATEWAY_ID: 'guide-oracle' });
    assert.ok(await answerGuideWithCloudflare({ question: 'Will hearting an activity appoint me as the manager?', env: enabled.env }));
    assert.equal(enabled.calls.length, 2);
    for (const call of enabled.calls) assert.deepEqual(call[2], {
        gateway: { id: 'guide-oracle', skipCache: true, collectLog: false } });
});

test('Semantic history sends only safe previous questions and never old account reply names', async () => {
    const turns = [
        { question: 'Where can I turn on notices about a saved programme moving?',
            answer: 'This account has 1 saved resource in My Directory. Most recently saved: Private Centre.' },
        { question: 'How do I save resources?', answer: 'Untrusted earlier answer with private name.' },
    ];
    assert.deepEqual(safeGuideChatTurns(turns), [turns[1]]);
    const { env, calls } = model([selection('saved-versus-managed'), selection('saved-versus-managed')]);
    await answerGuideWithCloudflare({ question: 'Will hearting an activity appoint me as the manager?', turns,
        pageContext: 'My Directory', env });
    assert.equal(calls.length, 2);
    for (const call of calls) {
        const prompt = JSON.stringify(call[1].messages);
        assert.match(prompt, /How do I save resources/);
        assert.doesNotMatch(prompt, /Private Centre|Untrusted earlier answer|programme moving/);
    }
});

test('Saved-list intents require an explicit read request rather than a saved-feature question', () => {
    for (const query of ['Where can I turn on notices about a saved programme moving?',
        'What happens when my saved programme changes?', 'Will hearting an activity appoint me as the manager?'])
        assert.equal(guideSavedResourceIntent(query), null, query);
    for (const query of ['What resources have I saved?', 'Please show me my saved resources', 'Could you list my favourites?'])
        assert.equal(guideSavedResourceIntent(query), 'list', query);
    for (const query of ['Where do I see my saved resources?', 'How can I open My Directory?', 'Go to My Directory'])
        assert.equal(guideSavedResourceIntent(query), 'navigation', query);
});

test('Product notices use opt-in discovery while actual saved-list questions remain server-owned', async () => {
    let loads = 0;
    const { env, calls } = model([selection('saved-schedule-notifications'), selection('saved-schedule-notifications')],
        { SUPPORT_INBOX_ENABLED: 'true' });
    const router = createGuideRoutes({ authenticate: async (c, next) => { c.set('user', { id: 9741, role: 'standard' }); await next(); },
        directoryAccess: async (_c, next) => next(),
        saved: async () => { loads++; return { totalCount: 1, placeCount: 1, offeringCount: 0,
            names: [{ name: 'Private Saved Centre', unavailable: false }] }; } });
    let request = 0;
    const post = async (body) => {
        const response = await router.request('/answer', { method: 'POST',
            headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': `198.51.100.${180 + ++request}` },
            body: JSON.stringify(body) }, env);
        assert.equal(response.status, 200);
        return response.json();
    };
    const question = 'Where can I turn on notices about a saved programme moving?';
    await post({ question });
    assert.equal(loads, 0);
    assert.equal(calls.length, 0);
    const product = await post({ question, useAi: true });
    assert.equal(product.answerSource, 'ai');
    assert.equal(product.topicId, 'saved-schedule-notifications');
    assert.equal(calls.length, 2);
    assert.equal(loads, 0);
    const account = await post({ question: 'What resources have I saved?', useAi: true });
    assert.equal(account.answerSource, 'account');
    assert.match(account.message, /Private Saved Centre/);
    assert.equal(loads, 1);
    assert.equal(calls.length, 2);
    assert.doesNotMatch(JSON.stringify(calls), /Private Saved Centre/);
});

test('Sensitive or overlong questions cannot trigger semantic inference', async () => {
    const { env, calls } = model([]);
    for (const question of ['What medication should I take?', 'password=private', 'x'.repeat(601)])
        assert.equal(await answerGuideWithCloudflare({ question, env }), null);
    assert.equal(calls.length, 0);
});

const lexicalHostQuestion = 'Will changing the host of an Offering alter the membership of people who saved it?';

function semanticRouteProbe(sequence, options = {}) {
    const actor = options.actor || { id: 98500, role: 'standard' };
    const { env, calls } = model(sequence, { SUPPORT_INBOX_ENABLED: 'true', ...options.env });
    let reads = 0;
    const forbidden = async () => { reads++; throw new Error('Product evidence must not read account or directory data'); };
    const router = createGuideRoutes({
        authenticate: async (c, next) => { c.set('user', actor); await next(); },
        directoryAccess: forbidden, search: forbidden, saved: forbidden, managed: forbidden,
        managedAccess: forbidden, personalPlaces: forbidden, plans: forbidden,
        auditAccess: forbidden, auditActivity: forbidden, organizationAccess: forbidden,
        ownRegionScope: forbidden, templates: forbidden,
    });
    return { calls, reads: () => reads, post: async (body) => {
        const response = await router.request('/answer', { method: 'POST',
            headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '198.51.100.237' },
            body: JSON.stringify(body) }, env);
        assert.equal(response.status, 200);
        return response.json();
    } };
}

test('Opted-in semantic retrieval can review a lexical product match before it is displayed', async () => {
    const probe = semanticRouteProbe([
        selection('offering-host-versus-membership'), selection('offering-host-versus-membership'),
    ]);
    const answer = await probe.post({ question: lexicalHostQuestion, useAi: true });
    assert.equal(probe.calls.length, 2);
    assert.equal(answer.answerSource, 'ai');
    assert.equal(answer.topicId, 'offering-host-versus-membership');
    assert.equal(answer.message, fact('offering-host-versus-membership').message);
    assert.deepEqual(answer.actions.map(({ route }) => route), ['/dashboard/profile']);
    assert.deepEqual(answer.sources.map(({ id }) => id), ['offering-host-versus-membership']);
    assert.equal(probe.reads(), 0);
});

test('Semantic review preserves the exact lexical fallback on rejection, either-stage failure and rate limiting', async () => {
    let actorId = 98510;
    for (const sequence of [
        [selection()],
        [selection('invented-fact')],
        [new Error('Gateway unavailable')],
        [selection('offering-host-versus-membership'), selection()],
        [selection('offering-host-versus-membership'), new Error('Gateway spend limit reached')],
    ]) {
        const probe = semanticRouteProbe(sequence, { actor: { id: actorId++, role: 'standard' } });
        const reviewed = await probe.post({ question: lexicalHostQuestion });
        const fallback = await probe.post({ question: lexicalHostQuestion, useAi: true });
        assert.deepEqual(fallback, reviewed);
        assert.equal(probe.reads(), 0);
    }
    const limited = semanticRouteProbe(Array.from({ length: 10 }, () => selection()),
        { actor: { id: 98520, role: 'standard' } });
    const reviewed = await limited.post({ question: lexicalHostQuestion });
    for (let i = 0; i < 10; i++) await limited.post({ question: lexicalHostQuestion, useAi: true });
    const fallback = await limited.post({ question: lexicalHostQuestion, useAi: true });
    assert.deepEqual(fallback, { ...reviewed, aiStatus: 'limited' });
    assert.equal(limited.calls.length, 10);
    assert.equal(limited.reads(), 0);
});

test('Lexical product mode, guest, User View and fixed privacy boundaries never enter semantic review', async () => {
    let actorId = 98530;
    for (const options of [
        { env: { GUIDE_SEMANTIC_RETRIEVAL_ENABLED: 'false' } },
        { env: { GUIDE_CHAT_ENABLED: 'false' } },
        { actor: { id: actorId++, role: 'guest' } },
        { actor: { id: actorId++, role: 'standard', isImpersonating: true } },
    ]) {
        const probe = semanticRouteProbe([], options);
        const reviewed = await probe.post({ question: lexicalHostQuestion });
        assert.deepEqual(await probe.post({ question: lexicalHostQuestion, useAi: true }), reviewed);
        assert.equal(probe.calls.length, 0);
        assert.equal(probe.reads(), 0);
    }
    const fixed = semanticRouteProbe([]);
    for (const question of ['Show me the members who bookmarked our service.',
        'I used a membership QR. Is that the same as making a private bookmark?']) {
        const answer = await fixed.post({ question, useAi: true });
        assert.equal(answer.answerSource, 'reviewed');
        assert.ok(['provider-usage-boundary', 'saved-versus-membership'].includes(answer.topicId));
    }
    await fixed.post({ topicId: 'privacy', useAi: true });
    assert.equal(fixed.calls.length, 0);
    assert.equal(fixed.reads(), 0);
});


test('Discovery excerpts distinguish specific reviewed consequences without exporting internal or account fields', () => {
    const question = 'If I dismiss the update notice, have I moved my attendance choice?';
    const facts = guideOracleDiscoveryFacts(question);
    const catalog = createGuideFactCatalog(facts, question);
    assert.ok(catalog && catalog.length <= 14000);
    const line = catalog.split('\n').find(line => line.startsWith('plan-schedule-update —'));
    assert.match(line, /removes the notice|not moved automatically/);
    const mapQuestion = 'Which version will someone see from an existing share link after I saved a different design?';
    const mapCatalog = createGuideFactCatalog(guideOracleDiscoveryFacts(mapQuestion), mapQuestion);
    assert.match(mapCatalog.split('\n').find(line => line.startsWith('map-studio —')), /does not by itself refresh|Select the saved view/);
    const decorated = { id: 'public-demo', title: 'Reviewed product rule',
        message: 'Saving a view does not refresh the shared snapshot.', evidence: 'server/src/private.js:7',
        accountName: 'Private Account Name', route: '/private-account-route' };
    const exported = createGuideFactCatalog([decorated], 'Does saving refresh a snapshot?');
    assert.match(exported, /Saving a view does not refresh/);
    assert.doesNotMatch(exported, /server\/src|Private Account Name|private-account-route|evidence|accountName/);
    assert.equal(createGuideFactCatalog([{ ...decorated, id: '../internal' }], question), null);
});

test('Opted-in discovery uses excerpts then validates full reviewed facts and retains bounded multilingual transport', async () => {
    const question = 'If I dismiss the update notice, have I moved my attendance choice?';
    const h = model([selection('plan-schedule-update'), selection('plan-schedule-update')]);
    const answer = await answerGuideWithCloudflare({ question, env: h.env });
    assert.equal(h.calls.length, 2);
    assert.match(h.calls[0][1].messages[0].content, /public reviewed excerpts/);
    assert.match(h.calls[0][1].messages[0].content, /plan-schedule-update —.*removes the notice|plan-schedule-update —.*not moved automatically/);
    assert.equal(answer.message, fact('plan-schedule-update').message);
    assert.deepEqual(answer.sources.map(source => source.id), ['plan-schedule-update']);
    assert.doesNotMatch(h.calls[0][1].messages[0].content, /server\/src|client\/src|\.js:\d/);
    const large = model([selection()]);
    await discoverGuideOracleFacts({ question: 'Which map version can visitors see?',
        previousQuestions: Array.from({ length: 4 }, () => '中'.repeat(600)), env: large.env });
    assert.equal(large.calls.length, 1);
    assert.ok(new TextEncoder().encode(JSON.stringify({ model: large.calls[0][0], params: large.calls[0][1], options: large.calls[0][2] })).length <= 20000);
    assert.doesNotMatch(large.calls[0][1].messages[0].content, /map-studio — Map Studio views: /);
});
