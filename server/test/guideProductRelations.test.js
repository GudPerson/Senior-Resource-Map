import test from 'node:test';
import assert from 'node:assert/strict';
import { guideReviewedRelationFact, guideHiddenSavedResourceFact, guidePlaceAssignmentScopeFact, guideSavedIdentityPrivacyFact, guideHostMembershipRelationFact,
    guideSavedMembershipRelationFact, guideProviderIdentityCheckFact, guideProviderUsageLookup,
    guideMembershipNavigationFact } from '../src/utils/guideProductRelations.js';
import { answerGuideOracleFact, retrieveGuideOracleFacts, guideOracleDiscoveryFacts, guideProviderUsageIntent } from '../src/utils/guideOracleKnowledge.js';
import { safeGuideChatTurns } from '../src/utils/guideChat.js';
import { createGuideRoutes } from '../src/routes/guide.js';
import { guideVerifiedBoundaryIntent } from '../src/utils/guideVerifiedBoundary.js';
import { guideSavedResourceIntent } from '../src/utils/guideSavedResources.js';

const cases = [
    ['Does hiding erase the directory entry permanently?', 'resource-hide-delete', /visibility.*separate from Delete/s],
    ['Is everyone shown the same set of restricted Offerings?', 'offering-eligibility', /profile criteria.*active membership.*cannot confirm/s],
    ['Are exported resource workbooks refreshed after the listing changes?', 'resource-export-context', /Which download.*snapshot.*another screen/s],
    ['Do I become a listing editor by saving an Offering?', 'saved-versus-managed', /does not itself give you permission to edit/s],
    ['Are in-app updates the same as WhatsApp or email alerts?', 'notification-delivery-channels', /preferences only.*external delivery remains disabled/s],
    ['Does hiding a listing remove everybody’s saved copy?', 'hidden-saved-resources', /does not automatically remove.*unavailable.*visible to that viewer again/s],
    ['Guide, can you turn on WhatsApp alerts for me?', 'guide-notification-controls', /cannot change your preferences.*external delivery.*has not changed any setting/s],
    ['Does an Owner assignment on one Place let me manage every Place?', 'place-assignment-scope', /exact Place assigned.*does not grant.*every Place.*not whether your account/s],
    ['I saved a Programme. Can the provider see my name just because I hearted it?', 'saved-identity-privacy', /Save action does not send your name.*Joining a Place.*managers can see.*names/s],
    ['Is the host location of a service the same thing as a user’s Place membership?', 'offering-host-versus-membership', /Host Locations connect that listing.*membership connects.*separate relationships.*does not make you a member/s],
    ['If I bookmark a service, does its owner receive my personal information?', 'saved-identity-privacy', /Save action does not send your name.*Joining a Place/s],
    ['Can the organisation running a listing recognise me from my favourite?', 'saved-identity-privacy', /not a public saver list.*managers can see membership details/s],
    ['I used a membership QR. Is that the same as making a private bookmark?', 'saved-versus-membership', /Saving.*private bookmark.*Joining.*membership.*managers.*names/s],
    ['Does adding a host centre to an Offering enrol everyone who saved it?', 'offering-host-versus-membership', /People who saved.*not enrolled by.*host change/s],
    ['Can you check whether the provider has already been told my name?', 'guide-provider-identity-check', /cannot check whether.*received.*cannot inspect.*has not contacted/s],
    ['Does the organisation learn who I am when I mark its class as a favourite?', 'saved-identity-privacy', /Save action does not send your name.*Joining a Place/s],
    ['If I have joined a Place, is its listing now automatically in My Directory?', 'saved-versus-membership', /joining does not automatically save/s],
    ['Would linking another venue enrol the people who bookmarked my programme?', 'offering-host-versus-membership', /People who saved.*not enrolled by.*host change/s],
    ['How can I see which centres have my membership without showing you my profile?', 'place-membership-navigation', /Profile.*Linked places.*not checked.*My Directory/s],
];

test('Recorded product gaps have reviewed answers and context independent of AI selection', () => {
    for (const [question, id, wording] of cases) {
        assert.equal(guideReviewedRelationFact(question), id, question);
        const answer = answerGuideOracleFact(question);
        assert.equal(answer.topicId, id, question);
        assert.match(answer.message, wording, question);
        assert.deepEqual(retrieveGuideOracleFacts(question).map((fact) => fact.id), [id], question);
    }
});

test('Product relations recognise concepts while preserving adjacent account, editing and contact workflows', () => {
    for (const [question, id] of [
        ['Does bookmarking a service grant editing rights?', 'saved-versus-managed'],
        ['Is hiding a Place the same as deleting it?', 'resource-hide-delete'],
        ['Could two friends see different restricted programmes?', 'offering-eligibility'],
        ['Will a saved schedule alert arrive by SMS?', 'notification-delivery-channels'],
        ['Does a downloaded My Map spreadsheet track future changes?', 'my-map-exports'],
        ['Will my downloaded private My Map spreadsheet track changes when I share it?', 'private-map-export-sharing'],
    ]) assert.equal(guideReviewedRelationFact(question), id, question);
    for (const question of [
        'Can I save changes to an Offering as its editor?', 'How can I edit my saved Programme?',
        'Can I edit notes on a Place in My Map after saving it?', 'Can I delete a Place from My Directory?',
        'Does deleting a saved Place remove it from My Map?', 'How do I enable WhatsApp sign-in?',
        'How do I contact a provider by email for programme updates?', 'Verify my email for schedule alerts',
        'Can I get email alerts for cryptocurrency prices?', 'Refresh the uploaded boundary workbook',
        'Can I edit a downloaded template and import it?', 'What resources do I manage?',
        'Hide a saved Place from My Directory', 'Can you enable WhatsApp sign-in?',
        'Please contact the provider to turn on email alerts',
    ]) assert.equal(guideReviewedRelationFact(question), null, question);
});

test('Public hiding effects stay distinct from eligibility, private removal and provider plans', () => {
    for (const question of [
        'If a saved Programme is hidden, will my Directory entry vanish?',
        'When a provider hides a Place, what happens to the saved resource?',
    ]) {
        assert.equal(guideHiddenSavedResourceFact(question), 'hidden-saved-resources');
        assert.equal(guideVerifiedBoundaryIntent(question), null);
        assert.equal(answerGuideOracleFact(question).topicId, 'hidden-saved-resources');
        assert.deepEqual(guideOracleDiscoveryFacts(question).map(({ id }) => id), ['hidden-saved-resources']);
    }
    for (const question of ['Hide a Place from My Directory', 'Does hiding a Place on My Map remove my saved copy?',
        'Will hiding my Programme delete people’s existing plans?', 'Why is a member-only Programme hidden?'])
        assert.equal(guideHiddenSavedResourceFact(question), null, question);
    assert.equal(guideVerifiedBoundaryIntent('Why is a member-only Programme hidden?'), 'not-visible');
    assert.equal(answerGuideOracleFact('Will hiding my Programme delete people’s existing plans?').topicId, 'provider-plan-lifecycle');
    assert.equal(answerGuideOracleFact('Does deleting a saved Place remove it from My Map?').topicId, 'my-map-resource-removal');
});

test('Guide notification requests give manual controls without asserting a preference change', () => {
    for (const question of ['Please enable saved schedule changes for me', 'Can you mute my notifications?',
        'Guide, disable in-app notifications for me']) {
        assert.equal(guideReviewedRelationFact(question), 'guide-notification-controls', question);
        const answer = answerGuideOracleFact(question);
        assert.match(answer.message, /has not changed any setting/);
        assert.deepEqual(answer.actions, [{ label: 'Open Updates', route: '/help?tab=inbox' }]);
    }
    assert.equal(guideReviewedRelationFact('How do I enable Saved schedule changes?'), null);
});

test('Place assignment scope retains its reviewed catalog boundary without swallowing assignments or other products', () => {
    const question = 'Can I edit all Places because I am an Owner of one Place?';
    assert.equal(guidePlaceAssignmentScopeFact(question), 'place-assignment-scope');
    assert.deepEqual(guideOracleDiscoveryFacts(question).map(({ id }) => id), ['place-assignment-scope']);
    for (const other of ['Can I assign Owners to all Places?', 'Can I manage my private map as its owner?',
        'Does a Staff role in an Org Group let me edit every Place?', 'Can I transfer a Place to another organisation?',
        'Can I change the owner of our Place to another organisation?', 'Can I transfer ownership of all Places?',
        'What Places am I assigned to manage?', 'Can I edit all my personal Places?',
        'Does being a member of one Place allow me to edit another Place?'])
        assert.equal(guidePlaceAssignmentScopeFact(other), null, other);
});

test('Save identity consequences do not load a private list or promise anonymity after membership or sharing', async () => {
    let accountReads = 0;
    const forbiddenRead = async () => { accountReads++; throw new Error('This is a product privacy rule.'); };
    const router = createGuideRoutes({ authenticate: async (c, next) => { c.set('user', { id: 4, role: 'standard' }); await next(); },
        saved: forbiddenRead, managed: forbiddenRead, plans: forbiddenRead, personalPlaces: forbiddenRead });
    for (const question of [
        'Does bookmarking a service tell the provider who I am?',
        'Can you show me if the provider sees my name after I saved a Programme?',
        'Will saving a Place share my profile with its owner?',
    ]) {
        assert.equal(guideSavedIdentityPrivacyFact(question), 'saved-identity-privacy', question);
        assert.equal(guideSavedResourceIntent(question), null, question);
        assert.equal(guideVerifiedBoundaryIntent(question), null, question);
        assert.deepEqual(guideOracleDiscoveryFacts(question).map(({ id }) => id), ['saved-identity-privacy']);
        const response = await router.request('/answer', { method: 'POST', headers: {
            'Content-Type': 'application/json', 'cf-connecting-ip': '198.51.100.246' },
            body: JSON.stringify({ question, useAi: true }) }, {
            SUPPORT_INBOX_ENABLED: 'true', GUIDE_CHAT_ENABLED: 'true', AI: { run: forbiddenRead },
        });
        assert.equal(response.status, 200);
        const answer = await response.json();
        assert.equal(answer.topicId, 'saved-identity-privacy');
        assert.equal(answer.answerSource, 'reviewed');
        assert.match(answer.message, /does not send your name or profile details.*not a public saver list.*managers can see membership details.*names.*Shared Map.*separate from saving/s);
        assert.doesNotMatch(answer.message, /provider can never|always anonymous|Most recently saved/i);
        assert.deepEqual(answer.sources.map(({ id }) => id), ['saved-identity-privacy']);
    }
    assert.equal(accountReads, 0);
    for (const question of ['Can you send my saved Programme and my name to its provider?',
        'Will my saved resources and my name appear on my Shared Map?',
        'Does saving my Programme and profile prove I am eligible?', 'Who saved my Programme?',
        'What resources have I saved?']) assert.equal(guideSavedIdentityPrivacyFact(question), null, question);
    assert.equal(guideSavedResourceIntent('What resources have I saved?'), 'list');
    assert.equal(answerGuideOracleFact('Who saved my Programme?').topicId, 'provider-usage-boundary');
});

test('Host relationships are explained on both sides without swallowing membership rights or host editing', () => {
    for (const question of [
        'Is a Programme’s linked Place equivalent to my Place membership?',
        'A Programme has two host Places. Does linking those locations make me a member?',
    ]) {
        assert.equal(guideHostMembershipRelationFact(question), 'offering-host-versus-membership', question);
        assert.equal(guideVerifiedBoundaryIntent(question), null, question);
        const answer = answerGuideOracleFact(question);
        assert.match(answer.message, /Host Locations.*person’s account.*separate relationships.*does not make you a member.*eligibility checks.*cannot grant membership/s);
        assert.deepEqual(retrieveGuideOracleFacts(question).map(({ id }) => id), ['offering-host-versus-membership']);
        assert.deepEqual(guideOracleDiscoveryFacts(question).map(({ id }) => id), ['offering-host-versus-membership']);
    }
    for (const question of ['If I join a Place, can I edit its Programmes?',
        'How do I change the linked Place for a Programme?', 'Does linking membership register me for a Programme?',
        'How do I generate template versions at member Places?', 'Does a Place in my Resource Group grant membership?',
        'Do all members see the same Programme at a linked Place?',
        'Why are different member-only Programmes hidden at their host Place?',
        'Does adding a saved Programme to My Map make me a member of its Place?'])
        assert.equal(guideHostMembershipRelationFact(question), null, question);
    assert.equal(guideVerifiedBoundaryIntent('If I join a Place, can I edit its Programmes?'), 'membership-edit');
    assert.equal(answerGuideOracleFact('How do I change the linked Place for a Programme?').topicId, 'offering-host-change');
});

test('Reviewed relations bypass model inference with AI on and off and return trusted navigation', async () => {
    let calls = 0;
    const router = createGuideRoutes({ authenticate: async (c, next) => { c.set('user', { id: 4, role: 'standard' }); await next(); } });
    for (const useAi of [false, true]) for (const [question, id, wording] of cases) {
        const result = await router.request('/answer', { method: 'POST', headers: {
            'Content-Type': 'application/json', 'cf-connecting-ip': '198.51.100.244' },
            body: JSON.stringify({ question, useAi }) }, {
            SUPPORT_INBOX_ENABLED: 'true', GUIDE_CHAT_ENABLED: 'true',
            GUIDE_SEMANTIC_RETRIEVAL_ENABLED: 'true',
            AI: { run: async () => { calls++; throw new Error('Product relation must use reviewed wording'); } },
        });
        assert.equal(result.status, 200, question);
        const answer = await result.json();
        assert.equal(answer.answerSource, 'reviewed', question);
        assert.equal(answer.topicId, id, question);
        assert.match(answer.message, wording, question);
        assert.deepEqual(answer.sources.map((source) => source.id), [id]);
        assert.ok(answer.actions.every((action) => action.route.startsWith('/')));
        assert.doesNotMatch(JSON.stringify(answer.actions), /\/login|Draft a report/);
    }
    assert.equal(calls, 0);
});

test('Bookmark and membership comparison answers both concepts without replacing account reads or eligibility', () => {
    for (const question of ['I used a membership QR. Is that the same as making a private bookmark?',
        'Is joining a Place equivalent to saving it with the heart?']) {
        assert.equal(guideSavedMembershipRelationFact(question), 'saved-versus-membership');
        assert.equal(guideSavedResourceIntent(question), null);
        assert.equal(guideVerifiedBoundaryIntent(question), null);
        const answer = answerGuideOracleFact(question);
        assert.match(answer.message, /private bookmark.*Joining.*separate membership.*names.*does not automatically save.*does not register/s);
        assert.deepEqual(guideOracleDiscoveryFacts(question).map(({ id }) => id), ['saved-versus-membership']);
    }
    for (const question of ['What are my favourite resources?', 'If I join a Place can I edit its Programmes?',
        'Does saving a member-only Programme make me eligible?', 'Is my private My Map the same as a membership?',
        'How do I change the host Place of a saved Programme?', 'Is a Resource Group bookmark the same as a governance membership?'])
        assert.equal(guideSavedMembershipRelationFact(question), null, question);
    assert.equal(guideSavedResourceIntent('What are my favourite resources?'), 'list');
    assert.equal(guideVerifiedBoundaryIntent('If I join a Place can I edit its Programmes?'), 'membership-edit');
    assert.equal(guideVerifiedBoundaryIntent('Does saving a member-only Programme make me eligible?'), 'saved-eligibility');
});

test('External identity-delivery inspection never reads an account, contacts a provider or makes a model claim', async () => {
    let reads = 0;
    const forbiddenRead = async () => { reads++; throw new Error('No delivery or account inspection is available.'); };
    const actors = [{ id: 1, role: 'standard' }, { role: 'guest' }, { id: 9, role: 'super_admin', isImpersonating: true }];
    for (const [index, actor] of actors.entries()) {
        const router = createGuideRoutes({ authenticate: async (c, next) => { c.set('user', actor); await next(); },
            saved: forbiddenRead, managed: forbiddenRead, plans: forbiddenRead, personalPlaces: forbiddenRead });
        for (const question of ['Can you check whether the provider has already been told my name?',
            'Can you verify whether my name has already been sent to a provider after I saved this Programme?']) {
            assert.equal(guideProviderIdentityCheckFact(question), 'guide-provider-identity-check');
            assert.equal(guideSavedResourceIntent(question), null);
            assert.equal(guideVerifiedBoundaryIntent(question), null);
            assert.deepEqual(guideOracleDiscoveryFacts(question).map(({ id }) => id), ['guide-provider-identity-check']);
            const response = await router.request('/answer', { method: 'POST', headers: {
                'Content-Type': 'application/json', 'cf-connecting-ip': '198.51.100.' + (247 + index) },
                body: JSON.stringify({ question, useAi: true }) }, { SUPPORT_INBOX_ENABLED: 'true',
                GUIDE_CHAT_ENABLED: 'true', GUIDE_SEMANTIC_RETRIEVAL_ENABLED: 'true', AI: { run: forbiddenRead } });
            assert.equal(response.status, 200);
            const answer = await response.json();
            assert.equal(answer.topicId, 'guide-provider-identity-check');
            assert.equal(answer.answerSource, 'reviewed');
            assert.match(answer.message, /cannot check whether.*cannot inspect.*does not establish.*has not contacted/s);
            assert.doesNotMatch(answer.message, /provider did not receive|Most recently saved|always anonymous|I have contacted/i);
            assert.deepEqual(answer.actions, [{ label: 'Open Discover', route: '/discover' }]);
        }
    }
    assert.equal(reads, 0);
    for (const question of ['Can you verify my email for sign-in?', 'Can you check the provider’s availability?',
        'Can you confirm my Programme eligibility?', 'Can you send my name to the provider?',
        'Can you check whether my name appears on a shared My Map?', 'Which Programme owners saved my resources?'])
        assert.equal(guideProviderIdentityCheckFact(question), null, question);
});

test('Actual saver lookups stay private while relative clauses and own saved counts keep their meaning', () => {
    for (const question of ['Can I see which people saved my Programme?', 'Show me people who bookmarked my Programme',
        'How many users viewed my listing?', 'Can providers see who saved their listing?', 'Who saved my Programme?']) {
        assert.equal(guideProviderUsageLookup(question), true, question);
        assert.equal(guideProviderUsageIntent(question), true, question);
        assert.deepEqual(safeGuideChatTurns([{ question, answer: 'No provider lookup is available.' }]), [], question);
    }
    for (const question of ['Would linking another venue enrol the people who bookmarked my programme?',
        'Does hiding a listing affect people who saved my Programme?', 'What happens to people who viewed my listing?',
        'How many resources have I saved?', 'Can a Place manager tell who I am after I saved a listing?'])
        assert.equal(guideProviderUsageLookup(question), false, question);
    assert.equal(answerGuideOracleFact('Show me people who bookmarked my Programme').topicId, 'provider-usage-boundary');
    assert.equal(guideSavedResourceIntent('Show me people who bookmarked my Programme'), null);
    assert.equal(guideSavedResourceIntent('How many resources have I saved?'), 'list');
    const effect = 'Would linking another venue enrol the people who bookmarked my programme?';
    assert.equal(answerGuideOracleFact(effect).topicId, 'offering-host-versus-membership');
    assert.equal(safeGuideChatTurns([{ question: effect, answer: answerGuideOracleFact(effect).message }]).length, 1);
});

test('Membership navigation gives exact Profile controls without loading account or personal fields', async () => {
    let reads = 0;
    const forbiddenRead = async () => { reads++; throw new Error('Navigation must not read account names.'); };
    for (const [index, actor] of [{ id: 1, role: 'standard' }, { role: 'guest' },
        { id: 9, role: 'super_admin', isImpersonating: true }].entries()) {
        const router = createGuideRoutes({ authenticate: async (c, next) => { c.set('user', actor); await next(); },
            saved: forbiddenRead, managed: forbiddenRead, plans: forbiddenRead, personalPlaces: forbiddenRead });
        const question = 'How can I see which centres have my membership without showing you my profile?';
        assert.equal(guideMembershipNavigationFact(question), 'place-membership-navigation');
        assert.equal(guideSavedResourceIntent(question), null);
        assert.deepEqual(guideOracleDiscoveryFacts(question).map(({ id }) => id), ['place-membership-navigation']);
        for (const useAi of [false, true]) {
            const response = await router.request('/answer', { method: 'POST', headers: {
                'Content-Type': 'application/json', 'cf-connecting-ip': '198.51.100.' + (250 + index) },
                body: JSON.stringify({ question, useAi }) }, { SUPPORT_INBOX_ENABLED: 'true',
                GUIDE_CHAT_ENABLED: 'true', GUIDE_SEMANTIC_RETRIEVAL_ENABLED: 'true', AI: { run: forbiddenRead } });
            assert.equal(response.status, 200);
            const answer = await response.json();
            assert.equal(answer.topicId, 'place-membership-navigation');
            assert.equal(answer.answerSource, 'reviewed');
            assert.match(answer.message, /sign in.*Profile.*Scroll below the profile form to Linked places.*has not checked your membership records/s);
            assert.deepEqual(answer.actions, [{ label: 'Open Profile', route: '/dashboard/profile' }]);
            assert.doesNotMatch(answer.message, /This account has|You belong to|Most recently saved/);
        }
    }
    assert.equal(reads, 0);
    for (const question of ['How can I see my colleague’s Place membership?', 'How can I change my Place membership?',
        'How do I check whether my Place membership makes me eligible?', 'How do I see my organisation memberships?',
        'How do I find templates at member Places?', 'How can I see my governance group membership?'])
        assert.equal(guideMembershipNavigationFact(question), null, question);
});


const otherMembershipQuestions = [
    'Where can I see the Places my father has joined?',
    'Which Places is my friend a member of?',
    'Where can I see the Places my friend has joined?',
    'Can I check which centre another user belongs to?',
    'How can I review my mother’s Place memberships?',
    'Show me the centres my child belongs to',
    'Where can I see my colleague’s Place membership?',
    'Can you tell me which Places someone else has joined?',
    'Where can I find my neighbour’s centre membership?',
    'How do I see another account’s Place memberships?',
];

test('Other-person Place membership questions retain their subject and stay outside AI history', () => {
    for (const question of otherMembershipQuestions) {
        const answer = answerGuideOracleFact(question);
        assert.equal(answer?.topicId, 'other-place-memberships', question);
        assert.match(answer.message, /cannot check or list another person’s Place memberships.*signed-in account.*not a lookup/s);
        assert.doesNotMatch(answer.message, /To check your linked Place memberships yourself|Your (?:father|friend|mother) (?:has|belongs)/);
        assert.deepEqual(answer.actions, [{ label: 'Open help', route: '/help' }]);
        assert.deepEqual(guideOracleDiscoveryFacts(question).map(({ id }) => id), ['other-place-memberships']);
        assert.deepEqual(safeGuideChatTurns([{ question, answer: answer.message }]), [], question);
    }
    for (const question of [
        'Where can I see the Places I have joined?',
        'Where can I see the Places I have joined without my parents seeing my profile?',
        'Where can I see my Place memberships before discussing them with my father?',
        'Where can I check my joined centres without showing my mother my profile?',
    ]) assert.equal(answerGuideOracleFact(question).topicId, 'place-membership-navigation', question);
    assert.equal(answerGuideOracleFact('Is joining a Place the same as saving it?').topicId, 'saved-versus-membership');
});

test('Other-person membership answers make no account or AI reads across actor modes', async () => {
    let reads = 0;
    const forbiddenRead = async () => { reads++; throw new Error('No private membership lookup or inference is supported.'); };
    for (const [index, actor] of [{ role: 'guest' }, { id: 11, role: 'standard' },
        { id: 12, role: 'place_owner' }, { id: 13, role: 'super_admin' },
        { id: 14, role: 'super_admin', isImpersonating: true }].entries()) {
        const router = createGuideRoutes({ authenticate: async (c, next) => { c.set('user', actor); await next(); },
            directoryAccess: async (c, next) => { await next(); },
            saved: forbiddenRead, managed: forbiddenRead, managedAccess: forbiddenRead, plans: forbiddenRead,
            personalPlaces: forbiddenRead, ownRegionScope: forbiddenRead, organizationAccess: forbiddenRead,
            auditAccess: forbiddenRead, auditActivity: forbiddenRead, templates: forbiddenRead });
        for (const question of otherMembershipQuestions) {
            for (const useAi of [false, true]) {
                const response = await router.request('/answer', { method: 'POST', headers: {
                    'Content-Type': 'application/json', 'cf-connecting-ip': '198.51.100.' + (210 + index) },
                    body: JSON.stringify({ question, useAi }) }, { SUPPORT_INBOX_ENABLED: 'true',
                    GUIDE_CHAT_ENABLED: 'true', GUIDE_SEMANTIC_RETRIEVAL_ENABLED: 'true', AI: { run: forbiddenRead } });
                assert.equal(response.status, 200, question);
                const answer = await response.json();
                assert.equal(answer.topicId, 'other-place-memberships', question);
                assert.equal(answer.answerSource, 'reviewed');
                assert.match(answer.message, /cannot check or list another person’s Place memberships.*not checked anyone’s membership records/s);
                assert.deepEqual(answer.actions, [{ label: 'Open help', route: '/help' }]);
            }
        }
    }
    assert.equal(reads, 0);
});
