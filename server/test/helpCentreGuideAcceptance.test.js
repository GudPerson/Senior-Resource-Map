import { helpCentreGuideCases } from './fixtures/helpCentreGuideCases.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGuideRoutes } from '../src/routes/guide.js';
import { answerGuideWithCloudflare } from '../src/utils/guideChat.js';
import { GUIDE_ORACLE_FACTS, HELP_ARTICLES } from '../src/generated/helpKnowledge.js';
import { addGuideHelpCitations, answerGuideHelpWorkflow, guideHelpWorkflowIntent } from '../src/utils/guideHelpWorkflows.js';
import { sanitizeSupportContext } from '../src/utils/supportDomain.js';

// Frozen offline acceptance v1: five wording/context cases for each of the
// twelve plan scenarios. Actual routes, classifiers and canonical evidence
// construct the answers. No stub supplies the expected evidence selection.
const cases = helpCentreGuideCases;
assert.equal(cases.length, 60, 'The frozen acceptance set contains exactly 60 independent cases.');

for (const [caseNumber, item] of cases.entries()) {
    test(`Help Centre fixed60 ${item.caseId}`, async () => {
        let modelCalls = 0;
        let accountReads = 0;
        const actor = { id: 20000 + caseNumber, role: 'standard' };
        const router = createGuideRoutes({
            authenticate: async (c, next) => { c.set('user', actor); await next(); },
            directoryAccess: async (_c, next) => next(),
            organizationAccess: async () => { accountReads++; return { platformAdmin: false, workspaceAdmin: true, workspaceView: true }; },
            saved: async () => { accountReads++; return { totalCount: 1, placeCount: 1, offeringCount: 0, names: [{ name: 'PRIVATE_FIXTURE_NAME', unavailable: false }] }; },
            helpCapabilities: async () => ({ organization: { workspaceView: true }, audit: { mode: 'none' } }),
        });
        const env = { NODE_ENV: 'test', SUPPORT_INBOX_ENABLED: 'true',
            ...(item.id === 'missing-private-place' ? { GUIDE_CHAT_ENABLED: 'true', GUIDE_SEMANTIC_RETRIEVAL_ENABLED: 'true',
                AI: { run: async () => { modelCalls++; return { response: { factIds: ['help-add-resource'] } }; } } } : {}),
        };
        const response = await router.request('/answer', { method: 'POST', headers: { 'Content-Type': 'application/json',
            'cf-connecting-ip': `198.51.100.${caseNumber + 1}` }, body: JSON.stringify({ question: item.question,
                ...(item.pageContext ? { pageContext: item.pageContext } : {}), ...(item.turns ? { turns: item.turns } : {}),
                ...(item.id === 'missing-private-place' ? { useAi: true } : {}) }) }, env);
        assert.equal(response.status, 200);
        const answer = await response.json();
        for (const pattern of item.required || item.requiredByIndex?.[item.index] || []) assert.match(answer.message, pattern, item.caseId);
        for (const pattern of item.forbidden || []) assert.doesNotMatch(answer.message, pattern, item.caseId);
        if (item.topic) assert.equal(answer.topicId, item.topic, item.caseId);
        if (item.id === 'missing-private-place') {
            const canonical = GUIDE_ORACLE_FACTS.find(fact => fact.id === 'personal-place-map-create');
            assert.equal(answer.message, canonical.message, 'The complete ordered procedure must survive every wording variant.');
            for (const pattern of [/signed in.*map you own/i, /My Directory.*My Maps/i, /name and category/i, /Review.*Save/i]) assert.match(answer.message, pattern);
        }
        if (item.answerSource) assert.equal(answer.answerSource, item.answerSource);
        if (item.noAccountRead) assert.equal(accountReads, 0, 'Another person’s facts must not load the current account as a substitute.');
        assert.equal(modelCalls, 0, 'These fixed offline routes must not infer a procedure or spend a model call.');
        for (const source of answer.sources || []) {
            assert.match(source.articleRoute, /^\/help-centre\/[a-z0-9-]+#[a-z0-9-]+$/);
            assert.ok(source.articleId && source.sectionId, 'Every product citation points to its reviewed section.');
        }
    });
}

test('An inappropriate model source cannot replace the private-place procedure, including direct Guide seam', async () => {
    let calls = 0;
    const answer = await answerGuideWithCloudflare({ question: 'how can i add places that are not found in carearound SG',
        pageContext: 'My Maps', env: { GUIDE_CHAT_ENABLED: 'true', GUIDE_SEMANTIC_RETRIEVAL_ENABLED: 'true',
            AI: { run: async () => { calls++; return { response: { factIds: ['help-add-resource'] } }; } } } });
    assert.equal(answer.topicId, 'personal-place-map-create');
    assert.match(answer.message, /Choose map location/);
    assert.doesNotMatch(answer.message, /New Place|Manage My Resources/);
    assert.equal(calls, 0);
});

test('Restricted facts stay out of inference and deterministic denied answers reveal no content or citation', async () => {
    let calls = 0;
    const router = createGuideRoutes({ authenticate: async (c, next) => { c.set('user', { id: 98765, role: 'standard' }); await next(); },
        helpCapabilities: async () => ({ audit: { mode: 'none' }, organization: { workspaceView: false } }) });
    const response = await router.request('/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: 'What is Audit Trail?', useAi: true }) }, { NODE_ENV: 'test', SUPPORT_INBOX_ENABLED: 'true' });
    const answer = await response.json();
    assert.equal(answer.topicId, 'help-access');
    assert.deepEqual(answer.sources, []);
    assert.doesNotMatch(answer.message, /Category|Action type|Organisation filter/i);
    const restricted = GUIDE_ORACLE_FACTS.find((fact) => fact.id === 'audit-trail');
    assert.equal(restricted.visibility, 'audit');
    const modelAnswer = await answerGuideWithCloudflare({ question: 'What is Audit Trail?', env: {
        GUIDE_CHAT_ENABLED: 'true', AI: { run: async (_model, body) => {
            calls++; assert.doesNotMatch(JSON.stringify(body), /audit-trail|Audit Trail/);
            return { response: { factIds: ['audit-trail'] } };
        } } } });
    assert.equal(modelAnswer, null);
    assert.equal(calls, 0);
});

test('Help Centre report context remains coarse and strips article identity', () => {
    assert.equal(sanitizeSupportContext({ pathname: '/help-centre/private-name?token=private#steps' }).pathname, '/help-centre');
    assert.equal(sanitizeSupportContext({ pathname: '/help-centre' }).pathname, '/help-centre');
});

test('ordinary map-location variants retain the complete private workflow', async () => {
    const router = createGuideRoutes({ authenticate: async (c, next) => { c.set('user', { id: 89001, role: 'standard' }); await next(); } });
    for (const question of ['How do I add a place that isn’t in the directory to my map?', 'How do I add a new location on my map?', 'Can I put a point on this map?', 'Add a missing spot to my own map.']) {
        const response = await router.request('/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, pageContext: 'My Maps' }) }, { NODE_ENV: 'test', SUPPORT_INBOX_ENABLED: 'true' });
        const answer = await response.json();
        assert.equal(answer.topicId, 'personal-place-map-create', question);
        assert.equal(answer.message, GUIDE_ORACLE_FACTS.find(fact => fact.id === answer.topicId).message);
    }
});

test('a valid legacy citation cannot authenticate contradictory model prose through the real route', async () => {
    for (const [index, specimen] of [
        ['How do I create a map?', 'help-maps', 'Open Manage My Resources and choose New Place. This publishes it for everyone.'],
        ['How can I find a resource?', 'help-discover', 'Search reserves a seat and confirms your eligibility.'],
        ['How can I print my own map?', 'my-map-exports', 'Your private map notes and Personal places are published to everyone.'],
    ].entries()) {
        const [question, id, invented] = specimen;
        let calls = 0;
        const router = createGuideRoutes({ authenticate: async (c, next) => { c.set('user', { id: 89500 + index, role: 'standard' }); await next(); } });
        const response = await router.request('/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, pageContext: 'My Maps', useAi: true }) }, {
            NODE_ENV: 'test', SUPPORT_INBOX_ENABLED: 'true', GUIDE_CHAT_ENABLED: 'true', GUIDE_SEMANTIC_RETRIEVAL_ENABLED: 'true',
            ORACLE_PREVIEW_LLM_ENABLED: 'true', GUIDE_CONVERSATIONAL_ANSWERS_ENABLED: 'true',
            AI: { run: async (_model, body) => { calls++; return { response: JSON.stringify(body.messages[0].content.startsWith('You locate') ? { factIds: [id] } : { factIds: [id], message: invented }) }; } },
        });
        const answer = await response.json();
        assert.equal(response.status, 200);
        assert.equal(calls, 2, 'This is a two-stage transport replay, not a deterministic-only test.');
        assert.equal(answer.answerSource, 'ai');
        assert.equal(answer.message, GUIDE_ORACLE_FACTS.find(fact => fact.id === id).message);
        assert.notEqual(answer.message, invented);
        assert.ok(answer.sources.some(source => source.id === id && source.articleRoute));
    }
});

test('a valid public-listing source cannot substitute for private map creation', async () => {
    let calls = 0;
    const router = createGuideRoutes({ authenticate: async (c, next) => { c.set('user', { id: 89599, role: 'standard' }); await next(); } });
    const response = await router.request('/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: 'How do I create a map?', pageContext: 'My Maps', useAi: true }) }, {
        NODE_ENV: 'test', SUPPORT_INBOX_ENABLED: 'true', GUIDE_CHAT_ENABLED: 'true', GUIDE_SEMANTIC_RETRIEVAL_ENABLED: 'true',
        ORACLE_PREVIEW_LLM_ENABLED: 'true', GUIDE_CONVERSATIONAL_ANSWERS_ENABLED: 'true',
        AI: { run: async (_model, body) => { calls++; return { response: JSON.stringify(body.messages[0].content.startsWith('You locate') ? { factIds: ['help-add-resource'] } : { factIds: ['help-add-resource'], message: 'Use the public Place editor.' }) }; } },
    });
    const answer = await response.json();
    assert.equal(calls, 2);
    assert.equal(answer.answerSource, 'reviewed');
    assert.equal(answer.topicId, 'maps');
    assert.doesNotMatch(answer.message, /New Place|Manage My Resources/);
});

test('unavailable AI gives a direct reviewed manual-help answer without inference', async () => {
    let modelCalls = 0;
    const router = createGuideRoutes({ authenticate: async (_c, next) => next() });
    for (const question of ['What happens when AI is unavailable? Can I still read help?', 'The AI budget expired. What can I do?', 'The Guide isn’t working. Where can I read the instructions?']) {
        const response = await router.request('/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question, useAi: true }) }, { NODE_ENV: 'test', SUPPORT_INBOX_ENABLED: 'true',
            GUIDE_CHAT_ENABLED: 'true', AI: { run: async () => { modelCalls++; throw new Error('unavailable'); } } });
        const answer = await response.json();
        assert.equal(response.status, 200);
        assert.equal(answer.topicId, 'article-hc-29-read-help-without-ai');
        assert.match(answer.message, /^Yes\. You can still read the public Help Centre without AI\./);
        assert.match(answer.message, /normal controls/);
        assert.match(answer.message, /has not created, saved or changed anything/);
        assert.match(answer.sources[0].articleRoute, /ask-the-guide.*#read-help-without-ai$/);
        const steps = answer.message.split('\n').filter((line) => /^\d+\. /.test(line));
        assert.match(steps[0], /^1\. Open the CareAround Help Centre\.$/);
        assert.match(steps[1], /Browse by topic.*Search help articles.*Search/);
        assert.match(steps[2], /Open the matching article.*read its numbered steps and notes/);
        assert.match(steps[3], /normal controls.*Review and confirm/);
        assert.doesNotMatch(steps.join('\n'), /(?:send|submit).*(?:question|request)|wait|Read the response|Open CareAround Guide/i);
        assert.equal(answer.sources.length, 1);
    }
    assert.equal(modelCalls, 0);
    assert.equal(guideHelpWorkflowIntent('How do I ask the Guide a question?'), null);
});


test('combined map-note and annotation sharing uses complete canonical controls and public boundaries', async () => {
    const factIds = ['article-hc-15-private-map-note-steps', 'article-hc-16-draw-annotation-steps',
        'article-hc-15-shared-map-note-steps', 'article-hc-16-share-annotation-steps'];
    const facts = factIds.map((id) => GUIDE_ORACLE_FACTS.find((fact) => fact.id === id));
    const sections = facts.map((fact) => HELP_ARTICLES.find((article) => article.id === fact.articleId)
        .sections.find((section) => section.id === fact.sectionId));
    const expected = [sections[0].paragraphs[0], sections[1].notes[0],
        sections[2].title + '\n\n' + facts[2].message,
        sections[3].title + '\n\n' + facts[3].message].join('\n\n');
    let modelCalls = 0;
    let accountReads = 0;
    const router = createGuideRoutes({
        authenticate: async (c, next) => { c.set('user', { id: 89610, role: 'standard' }); await next(); },
        saved: async () => { accountReads++; throw new Error('General sharing guidance must not load private records.'); },
        personalPlaces: async () => { accountReads++; throw new Error('General sharing guidance must not load private records.'); },
    });
    for (const question of ['How are My Map notes and annotations shared?', 'Are private map notes and annotations automatically public?']) {
        const response = await router.request('/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question, pageContext: 'My Maps', useAi: true }) }, {
            NODE_ENV: 'test', SUPPORT_INBOX_ENABLED: 'true', GUIDE_CHAT_ENABLED: 'true',
            GUIDE_SEMANTIC_RETRIEVAL_ENABLED: 'true', AI: { run: async () => { modelCalls++; throw new Error('No inference needed.'); } },
        });
        assert.equal(response.status, 200);
        const answer = await response.json();
        assert.equal(answer.topicId, 'map-note-annotation-sharing');
        assert.equal(answer.answerSource, 'reviewed');
        assert.equal(answer.message, expected, 'The served prose is composed from current approved sections, not a second authored answer.');
        for (const clause of [/New notes have Share this note turned off/, /New annotations are private unless/,
            /Share this note/, /Share this annotation/, /Include annotations/, /selects all saved annotations or none/,
            /Publish share link/, /Update shared link/, /do not automatically refresh/,
            /Preview the actual published or embedded view/, /website embed omits resource-note rows/]) assert.match(answer.message, clause);
        assert.deepEqual(answer.sources.map((source) => source.id), factIds);
        assert.deepEqual(answer.sources.map((source) => source.articleRoute), facts.map((fact) => fact.articleRoute));
        assert.deepEqual(answer.actions, [{ label: 'Open My Maps', route: '/my-directory?section=my-maps' }]);
        assert.doesNotMatch(answer.message, /I (?:created|saved|updated|published)|successfully (?:created|saved|published)/i);
    }
    assert.equal(modelCalls, 0);
    assert.equal(accountReads, 0);
});

test('combined sharing answer fails closed when any required approved public section is unavailable', () => {
    const requiredId = 'article-hc-16-share-annotation-steps';
    for (const facts of [GUIDE_ORACLE_FACTS.filter((fact) => fact.id !== requiredId),
        GUIDE_ORACLE_FACTS.map((fact) => fact.id === requiredId ? { ...fact, visibility: 'admin' } : fact)]) {
        const answer = answerGuideHelpWorkflow({ question: 'How are My Map notes and annotations shared?', facts });
        assert.notEqual(answer.topicId, 'map-note-annotation-sharing');
        assert.deepEqual(answer.sources, []);
        assert.match(answer.message, /complete reviewed instructions.*not available yet/i);
        assert.doesNotMatch(answer.message, /Include annotations/);
    }
});

test('combined map sharing does not capture another person, provider, edit or Personal place export workflows', () => {
    for (const question of ['How are my colleague’s map notes and annotations shared?',
        'How are Offering notes and annotations shared?', 'How are Resource Group notes and annotations shared?',
        'How do I edit private map notes and annotations?']) {
        assert.notEqual(guideHelpWorkflowIntent(question, 'My Maps'), 'map-note-annotation-sharing', question);
    }
    for (const question of ['Are personal places included in a public Shared Map or my owner exports?',
        'Are personal places, map notes and annotations included in public Shared Maps or my exports?']) {
        const answer = answerGuideHelpWorkflow({ question, pageContext: 'My Maps' });
        assert.equal(answer.topicId, 'personal-place-sharing');
        assert.equal(answer.message, ['personal-place-sharing', 'my-places']
            .map((id) => GUIDE_ORACLE_FACTS.find((fact) => fact.id === id).message).join('\n\n'));
    }
});


test('explicit other-person Directory and membership requests receive a scoped canonical refusal without account reads', async () => {
    let accountReads = 0;
    let modelCalls = 0;
    const deniedRead = async () => { accountReads++; throw new Error('Do not substitute this account for another person.'); };
    const router = createGuideRoutes({ authenticate: async (c, next) => { c.set('user', { id: 89620, role: 'standard' }); await next(); },
        saved: deniedRead, personalPlaces: deniedRead, managed: deniedRead, managedAccess: deniedRead, organizationAccess: deniedRead,
    });
    for (const [question, factId] of [['Can I see another person’s My Directory?', 'other-account-saved-privacy'],
        ['Show my colleague’s My Directory.', 'other-account-saved-privacy'],
        ['Can you show another person’s Place memberships?', 'other-place-memberships'],
        ['Can you list my friend’s centre memberships?', 'other-place-memberships']]) {
        const response = await router.request('/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question, useAi: true }) }, { NODE_ENV: 'test', SUPPORT_INBOX_ENABLED: 'true', GUIDE_CHAT_ENABLED: 'true',
            AI: { run: async () => { modelCalls++; throw new Error('No model should infer another person’s records.'); } } });
        assert.equal(response.status, 200);
        const answer = await response.json();
        const fact = GUIDE_ORACLE_FACTS.find((item) => item.id === factId);
        assert.equal(answer.message, fact.message);
        assert.equal(answer.topicId, factId);
        assert.equal(answer.sources[0].articleRoute, fact.articleRoute);
        assert.match(answer.message, /cannot/);
        assert.match(answer.message, /own|your own/);
    }
    assert.equal(accountReads, 0);
    assert.equal(modelCalls, 0);
    for (const question of ['Can I show another person my Directory?', 'Can I show another person my Place memberships?',
        'Where can I see my saved resources to tell a colleague?']) {
        assert.equal(guideHelpWorkflowIntent(question), null, 'Recipient wording must not replace this account’s subject.');
    }
});

test('immediate resource save explains the approved review and confirmation path without performing a save', async () => {
    let writes = 0;
    let modelCalls = 0;
    const router = createGuideRoutes({ authenticate: async (c, next) => { c.set('user', { id: 89621, role: 'standard' }); await next(); },
        actionOptions: { saveResource: async () => { writes++; throw new Error('Question answering must not write.'); } } });
    const fact = GUIDE_ORACLE_FACTS.find((item) => item.id === 'article-hc-31-guide-review-resource-save-steps');
    for (const question of ['Can you save a Place immediately for me?', 'Save this resource right now without confirmation.']) {
        const response = await router.request('/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question, useAi: true }) }, { NODE_ENV: 'test', SUPPORT_INBOX_ENABLED: 'true', GUIDE_ACTIONS_ENABLED: 'true',
            GUIDE_CHAT_ENABLED: 'true', AI: { run: async () => { modelCalls++; throw new Error('Canonical instructions need no inference.'); } } });
        const answer = await response.json();
        assert.equal(response.status, 200);
        assert.equal(answer.message, fact.message);
        assert.match(answer.message, /Review save.*Save to My Directory to confirm the save/s);
        assert.deepEqual(answer.actions, [{ label: 'Read instructions', route: fact.articleRoute }]);
        assert.equal(answer.sources[0].articleRoute, fact.articleRoute);
        assert.doesNotMatch(answer.message, /I saved|I have saved|successfully saved/i);
    }
    assert.equal(writes, 0);
    assert.equal(modelCalls, 0);
    for (const question of ['Save a new personal place on my map now.', 'Save my private planning location now.',
        'What are my saved Places?', 'Create and save a new Place now.']) {
        assert.notEqual(guideHelpWorkflowIntent(question, 'My Maps'), fact.id, 'Keep resource-save instructions separate from other workflows.');
    }
});

test('Programme confirmation guidance includes the canonical server permission check without changing the action', () => {
    const scope = GUIDE_ORACLE_FACTS.find((fact) => fact.id === 'guide-create-scope');
    const confirmation = HELP_ARTICLES.find((article) => article.id === 'HC-31')
        .sections.find((section) => section.id === 'guide-programme-confirmation-steps');
    for (const question of ['Create a Programme right now without review.', 'Can you create a service without confirmation?']) {
        const answer = answerGuideHelpWorkflow({ question });
        assert.equal(answer.message, scope.message + '\n\n' + confirmation.notes[0]);
        assert.match(answer.message, /draft, review it, then choose Create/);
        assert.match(answer.message, /permissions, which are checked by the server/);
        assert.match(answer.message, /draft or review is not a saved resource/);
        assert.deepEqual(answer.actions, [{ label: 'Open Manage My Resources', route: '/dashboard/resources' }]);
        assert.ok(answer.sources.some((source) => source.sectionId === confirmation.id));
    }
});

test('denied public Place requests retain account denial and append only the canonical permission-review next step', async () => {
    const creation = HELP_ARTICLES.find((article) => article.id === 'HC-34').sections.find((section) => section.id === 'create-public-place');
    const router = createGuideRoutes({ authenticate: async (c, next) => { c.set('user', { id: 89622, role: 'standard' }); await next(); } });
    for (const question of ['How can I create a public Place not listed in CareAround?', 'Can I add a new public Place?']) {
        const response = await router.request('/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question, pageContext: 'My Maps' }) }, { NODE_ENV: 'test', SUPPORT_INBOX_ENABLED: 'true' });
        assert.equal(response.status, 200);
        const answer = await response.json();
        assert.match(answer.message, /^This account cannot create a new Place\. This account does not currently have resource-management access\./);
        assert.ok(answer.message.endsWith(creation.notes[0]));
        assert.equal(answer.answerSource, 'account');
        assert.deepEqual(answer.actions, []);
        assert.equal(answer.sources[0].articleId, 'HC-34');
        assert.equal(answer.sources[0].sectionId, creation.id);
    }
    const allowed = { topicId: 'resource-access', answerSource: 'account', message: 'Checked allowed result.',
        actions: [{ label: 'Open Manage My Resources', route: '/dashboard/resources' }], input: { question: 'Can I create a public Place?' } };
    assert.deepEqual(addGuideHelpCitations(allowed), allowed, 'Do not append denial guidance to an existing allowed navigation result.');
});

test('exact canonical basic-topic fallback receives its public article citation without manufacturing sources', async () => {
    const calendar = GUIDE_ORACLE_FACTS.find((fact) => fact.id === 'help-calendar');
    const router = createGuideRoutes({ authenticate: async (c, next) => { c.set('user', { id: 89623, role: 'standard' }); await next(); } });
    const response = await router.request('/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: 'Does a calendar plan register me for the programme?', pageContext: 'Care Calendar' }) },
        { NODE_ENV: 'test', SUPPORT_INBOX_ENABLED: 'true' });
    const answer = await response.json();
    assert.equal(answer.message, calendar.message);
    assert.equal(answer.sources[0].id, calendar.id);
    assert.equal(answer.sources[0].articleRoute, calendar.articleRoute);
    const unsupported = { topicId: 'calendar', message: 'An unrelated answer.', actions: [] };
    assert.deepEqual(addGuideHelpCitations(unsupported), unsupported);
});

test('Personal place export explanation includes the original private ownership and cross-map reuse evidence', () => {
    const sharing = GUIDE_ORACLE_FACTS.find((fact) => fact.id === 'personal-place-sharing');
    const places = GUIDE_ORACLE_FACTS.find((fact) => fact.id === 'my-places');
    const answer = answerGuideHelpWorkflow({ question: 'Do private planning locations appear in shared maps and exported files?', pageContext: 'My Maps' });
    assert.equal(answer.message, sharing.message + '\n\n' + places.message);
    assert.match(answer.message, /excluded from a published Shared Map/);
    assert.match(answer.message, /review an export before sharing/);
    assert.match(answer.message, /private planning locations you can reuse across your own maps/);
    assert.deepEqual(answer.sources.map((source) => source.id), [sharing.id, places.id]);
});
