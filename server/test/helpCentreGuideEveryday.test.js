import test from 'node:test';
import assert from 'node:assert/strict';
import { createGuideRoutes } from '../src/routes/guide.js';
import { guideHelpWorkflowIntent } from '../src/utils/guideHelpWorkflows.js';
import { answerGuideWithCloudflare } from '../src/utils/guideChat.js';
import { GUIDE_ORACLE_FACTS, HELP_ARTICLES } from '../src/generated/helpKnowledge.js';

// Supplemental cases came from real local-route probes after the first draft.
// The original sixty scenarios and their scoring are unchanged.
const cases = [
    ['How can I save a new address onto my map?', 'My Maps', 'personal-place-map-create', [/Choose map location/, /Find location/, /no postal address/, /private/]],
    ['Add somewhere that is not listed to this map.', 'My Maps', 'personal-place-map-create', [/Choose map location/, /Find location/]],
    ['Can I put a meeting point on my map without a postal address?', 'My Maps', 'personal-place-map-create', [/no postal address/, /My Places/]],
    ['I saved the map view but the share link still has the old layout. What now?', 'My Maps', 'map-studio-share-update', [/Update shared link/, /does not automatically/, /snapshot/]],
    ['Will publishing my map show my personal places to visitors?', 'My Maps', 'personal-place-sharing', [/excluded/, /Shared Map/]],
    ['If I export my own map, will my private places be included?', 'My Maps', 'personal-place-sharing', [/owner map/, /include/, /review an export/]],
    ['I saved this centre. Why is it not inside my map?', 'My Maps', 'map-membership', [/choose separately whether to add/i, /map/i]],
    ['Where can I see the listings I actually manage?', 'My Directory', 'article-hc-06-manage-listings', [/dashboard/i, /Manage My Resources/, /separate/i]],
    ['Does organisation membership let me edit its programmes?', 'Dashboard', 'article-hc-33-organisation-edit-boundary', [/^No\./, /Programme\/service/, /separate/i]],
    ['Does organization membership let me edit its programmes?', 'Dashboard', 'article-hc-33-organisation-edit-boundary', [/^No\./, /Programme\/service/, /separate/i]],
    ['Does adding an event to my plans register me for it?', 'Care Calendar', 'plans-not-bookings', [/not a booking, registration/, /contact them when registration is needed/]],
    ['The Guide is unavailable. How can I still read the instructions?', 'Help Centre', 'article-hc-29-read-help-without-ai', [/read the public Help Centre without AI/]],
];
for (const [index, [question, pageContext, topicId, required]] of cases.entries()) {
    test('Everyday Guide question: ' + question, async () => {
        let calls = 0;
        const router = createGuideRoutes({ authenticate: async (c, next) => { c.set('user', { id: 95000 + index, role: 'standard' }); await next(); } });
        const response = await router.request('/answer', { method: 'POST', headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': `198.51.100.${150 + index}` }, body: JSON.stringify({ question, pageContext, useAi: true }) }, {
            NODE_ENV: 'test', SUPPORT_INBOX_ENABLED: 'true', GUIDE_CHAT_ENABLED: 'true', AI: { run: async () => { calls++; throw Error('No inference in offline regression.'); } },
        });
        assert.equal(response.status, 200);
        const answer = await response.json();
        assert.equal(answer.topicId, topicId);
        for (const pattern of required) assert.match(answer.message, pattern);
        assert.equal(calls, 0);
        for (const action of answer.actions || []) {
            if (action.route === '/my-directory?section=my-places') assert.equal(action.label, 'Open My Places');
            if (action.route.startsWith('/help-centre/')) assert.equal(action.label, 'Read instructions');
            if (action.route === '/dashboard/calendar') assert.equal(action.label, 'Open Care Calendar');
        }
        for (const source of answer.sources || []) assert.match(source.articleRoute, /^\/help-centre\/[a-z0-9-]+#[a-z0-9-]+$/);
    });
}

test('New everyday routing keeps account reads, edits, public creation and other-person scope with their existing paths', () => {
    for (const question of ['Which resources do I manage?', 'Can I edit this Programme?', 'Do I have organisation access?', 'Edit the address of my personal place.', 'Where can I see the listings my colleague manages?', 'Update my colleague’s shared map.', 'Which staff members manage this Place?']) {
        assert.equal(guideHelpWorkflowIntent(question, 'My Maps'), null, question);
    }
    assert.equal(guideHelpWorkflowIntent('Create a public Place on my map', 'My Maps'), 'public-place-create');
});


test('task-specific map questions serve their exact canonical answer through route and Cloudflare seams', async () => {
    let modelCalls = 0;
    let accountReads = 0;
    const router = createGuideRoutes({
        authenticate: async (_c, next) => next(),
        saved: async () => { accountReads++; throw Error('General guidance must not read saved resources.'); },
    });
    const env = { NODE_ENV: 'test', SUPPORT_INBOX_ENABLED: 'true', GUIDE_CHAT_ENABLED: 'true',
        AI: { run: async () => { modelCalls++; throw Error('Canonical instructions need no inference.'); } } };
    const fact = (id) => GUIDE_ORACLE_FACTS.find((entry) => entry.id === id);
    const cancellation = HELP_ARTICLES.find((article) => article.id === 'HC-07')
        .sections.find((section) => section.id === 'create-map').notes[1];
    const checks = [
        { question: 'I saved this centre. Why is it not inside my map?', topicId: 'map-membership',
            sourceId: 'map-resource-update-procedure', expected: fact('map-resource-update-procedure').message, kind: 'procedure' },
        { question: 'I saved a Programme but it is not on my map. What should I do?', topicId: 'map-membership',
            sourceId: 'map-resource-update-procedure', expected: fact('map-resource-update-procedure').message, kind: 'procedure' },
        { question: 'I used Save and add, then cancelled creating my map. Is the resource still saved?',
            topicId: 'map-create-cancel-save-effects', sourceId: 'map-create-cancel-save-effects', expected: cancellation, kind: 'reviewed' },
        { question: 'Does cancelling map creation undo Save and add?',
            topicId: 'map-create-cancel-save-effects', sourceId: 'map-create-cancel-save-effects', expected: cancellation, kind: 'reviewed' },
        { question: 'The resource is in the list but has no pin on the map. What should I check?',
            topicId: 'map-missing-pin', sourceId: 'map-missing-pin', expected: fact('map-missing-pin').message, kind: 'procedure' },
        { question: 'How do Studio changes reach my published Shared Map?', topicId: 'map-studio-share-update',
            sourceId: 'map-studio-share-update', expected: fact('map-studio-share-update').message, kind: 'procedure' },
    ];
    for (const [index, check] of checks.entries()) {
        const response = await router.request('/answer', { method: 'POST',
            headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': `203.0.113.${100 + index}` },
            body: JSON.stringify({ question: check.question, pageContext: 'My Maps', useAi: true }) }, env);
        assert.equal(response.status, 200);
        const answers = [await response.json(), await answerGuideWithCloudflare({
            question: check.question, pageContext: 'My Maps', env,
        })];
        for (const answer of answers) {
            assert.equal(answer?.topicId, check.topicId, check.question);
            assert.equal(answer.answerKind, check.kind, check.question);
            assert.equal(answer.message, check.expected, check.question);
            assert.equal(answer.sources[0].id, check.sourceId);
            assert.equal(answer.sources[0].articleRoute, fact(check.sourceId).articleRoute);
            if (check.topicId === 'map-membership') {
                assert.match(answer.message, /^Saving a Place or Programme\/service adds it to My Directory\./);
                assert.match(answer.message, /choose separately.*particular My Map/);
                assert.match(answer.message, /Manage resources/);
                assert.match(answer.message, /Update map/);
                assert.doesNotMatch(answer.message, /If a saved Programme\/service is missing/);
            } else if (check.topicId === 'map-create-cancel-save-effects') {
                assert.match(answer.message, /^Save and add.*immediately\./);
                assert.doesNotMatch(answer.message, /Choose Create map|^\d+\. /m);
                assert.deepEqual(answer.actions, [{ label: 'Read instructions', route: fact(check.sourceId).articleRoute }]);
            } else if (check.topicId === 'map-missing-pin') {
                assert.match(answer.message, /If you own this map.*View.*Edit layout/);
                assert.match(answer.message, /phone.*Open map controls.*Edit layout/);
                assert.match(answer.message, /Map pins.*Show.*Resource categories/);
                assert.match(answer.message, /cannot supply.*coordinates.*List only/);
            }
        }
    }
    assert.equal(modelCalls, 0);
    assert.equal(accountReads, 0);
});

test('explicit Studio publishing how-to keeps conceptual, privacy and permission questions separate', () => {
    for (const question of ['How do Studio changes reach my published Shared Map?',
        'How can I publish my Studio view to a Shared Map?', 'How do I update my published Shared Map from Studio?']) {
        assert.equal(guideHelpWorkflowIntent(question, 'My Maps'), 'map-studio-share-update', question);
    }
    for (const question of ['What is Map Studio?', 'How does Map Studio differ from a Shared Map?',
        'Does saving a Studio view automatically change a Shared Map?',
        'How do I change Studio permissions for a published Shared Map?',
        'How do I publish my colleague’s Studio changes to their Shared Map?',
        'How do I publish Studio private notes on a Shared Map?']) {
        assert.notEqual(guideHelpWorkflowIntent(question, 'My Maps'), 'map-studio-share-update', question);
    }
});
