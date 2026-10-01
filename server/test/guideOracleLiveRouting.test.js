import test from 'node:test';
import assert from 'node:assert/strict';
import { createGuideRoutes } from '../src/routes/guide.js';
import { guideManagedResourceIntent } from '../src/utils/guideManagedResources.js';
import { safeGuideChatTurns } from '../src/utils/guideChat.js';
import { answerGuideStudioFollowup } from '../src/utils/guideProductFollowup.js';

const actor = { id: 104, role: 'standard', hardAssetStaffAccess: [{ hardAssetId: 91, staffRole: 'staff' }] };
const accessQuestion = 'Tell me which Places and Programmes I currently have edit access to, and where I should open them.';
let requestNumber = 0;
function harness(user = actor) {
    const calls = { model: 0, managed: 0, plans: 0, personalPlaces: 0 };
    const env = { SUPPORT_INBOX_ENABLED: 'true', GUIDE_CHAT_ENABLED: 'true', GUIDE_SEMANTIC_RETRIEVAL_ENABLED: 'true',
        AI: { run: async () => { calls.model++; return { response: 'An unrelated model answer.' }; } } };
    const router = createGuideRoutes({
        authenticate: async (c, next) => { c.set('user', user); await next(); },
        directoryAccess: async (c, next) => next(),
        managed: async () => { calls.managed++; return [
            { type: 'hard', totalCount: 1, names: ['Assigned Centre'] },
            { type: 'soft', totalCount: 1, names: ['Assigned Programme'] },
            { type: 'group', totalCount: 0, names: [] },
        ]; },
        plans: async () => { calls.plans++; throw new Error('Product instructions must not read private plans.'); },
        personalPlaces: async () => { calls.personalPlaces++; throw new Error('Product export instructions must not read private addresses.'); },
    });
    return { calls, ask: async (question, turns = []) => {
        const response = await router.request('/answer', { method: 'POST', headers: {
            'Content-Type': 'application/json', 'cf-connecting-ip': `198.51.100.${++requestNumber}` },
            body: JSON.stringify({ question, turns, useAi: true }) }, env);
        assert.equal(response.status, 200);
        return response.json();
    } };
}

test('own edit-access lists use current scoped resources and are excluded from model history', async () => {
    const h = harness();
    for (const question of [accessQuestion, 'Show me Programmes I have permission to edit.', 'Which Places fall under my editing permissions?']) {
        const answer = await h.ask(question);
        assert.equal(answer.answerSource, 'account');
        assert.match(answer.message, /Assigned Centre.*Assigned Programme/s);
        assert.match(answer.message, /My Directory holds resources you saved/);
        assert.deepEqual(answer.actions, [{ label: 'Open Manage My Resources', route: '/dashboard/resources' }]);
        assert.deepEqual(safeGuideChatTurns([{ question, answer: answer.message }]), []);
    }
    assert.equal(h.calls.managed, 3); assert.equal(h.calls.model, 0);
    assert.equal(guideManagedResourceIntent('How does edit access work for Programmes?'), null);
    assert.equal(guideManagedResourceIntent('Show me which Places my colleague has edit access to.'), null);
});

test('the new edit-access wording preserves guest, ordinary-member and User View denials', async () => {
    for (const [user, expected] of [[null, /Sign in/], [{ id: 105, role: 'standard' }, /does not currently have access/],
        [{ ...actor, isImpersonating: true }, /Exit User View/]]) {
        const h = harness(user); const answer = await h.ask(accessQuestion);
        assert.equal(answer.answerSource, 'account'); assert.match(answer.message, expected);
        assert.equal(h.calls.managed, 0); assert.equal(h.calls.model, 0);
    }
});

test('schedule-change acknowledgement instructions do not become a private My Plans listing', async () => {
    const h = harness();
    for (const question of [
        'A timetable entry I chose last week has since moved to a different day. What does acknowledging the update change, and what stays in my plans?',
        'The activity in My Plans has moved to a later day. What happens if I acknowledge the update?',
    ]) {
        const answer = await h.ask(question);
        assert.equal(answer.answerSource, 'reviewed'); assert.equal(answer.topicId, 'plan-schedule-update');
        assert.match(answer.message, /old choice is not moved automatically/);
        assert.match(answer.message, /Acknowledging.*removes the notice.*does not add a new plan or book/s);
        assert.equal(answer.actions[0].route, '/dashboard/calendar?section=updates');
    }
    assert.equal(h.calls.plans, 0); assert.equal(h.calls.model, 0);
});

test('private planning-pin export answers explain both public-map exclusion and owner-download disclosure', async () => {
    const h = harness();
    for (const question of [
        'I made a private address pin for planning. Could it appear in the spreadsheet I send to colleagues even though it is absent from the public map link?',
        'Could the spreadsheet contain private planning pins when the public map omits them?',
    ]) {
        const answer = await h.ask(question);
        assert.equal(answer.answerSource, 'reviewed'); assert.equal(answer.topicId, 'personal-place-sharing');
        assert.match(answer.message, /excluded from a published Shared Map/);
        assert.match(answer.message, /ledger downloads can include them.*review an export/s);
        assert.equal(answer.actions[0].route, '/my-directory?section=my-places');
    }
    assert.equal(h.calls.personalPlaces, 0); assert.equal(h.calls.model, 0);
});


test('current-account managed-list wording checks authenticated scope without model inference', async () => {
    const questions = ['Which Places and Programmes does this account currently manage?',
        'Which resources does the current account manage?', 'Show Places assigned to this account.'];
    for (const [user, expected, loads] of [[actor, /Assigned Centre/, 3], [null, /Sign in/, 0],
        [{ id: 105, role: 'standard' }, /does not currently have access/, 0],
        [{ ...actor, isImpersonating: true }, /Exit User View/, 0]]) {
        const h = harness(user);
        for (const question of questions) {
            const answer = await h.ask(question);
            assert.equal(answer.answerSource, 'account'); assert.match(answer.message, expected);
            assert.deepEqual(safeGuideChatTurns([{ question, answer: answer.message }]), []);
        }
        assert.equal(h.calls.managed, loads); assert.equal(h.calls.model, 0);
    }
    assert.equal(guideManagedResourceIntent('Which Places does another account manage?'), null);
    assert.equal(guideManagedResourceIntent('What resources does a typical account manage?'), null);
});


test('permitted-to-create wording checks current account permission and keeps it out of model history', async () => {
    const questions = ['Is my account permitted to add a new Place?', 'Am I permitted to create a Place?'];
    for (const [user, expected] of [[null, /Sign in to check this account/],
        [actor, /This account cannot create a new Place/], [{ ...actor, isImpersonating: true }, /Exit User View/]]) {
        const h = harness(user);
        for (const question of questions) {
            const answer = await h.ask(question);
            assert.equal(answer.answerSource, 'account'); assert.equal(answer.topicId, 'resource-access');
            assert.match(answer.message, expected);
            assert.deepEqual(safeGuideChatTurns([{ question, answer: answer.message }]), []);
        }
        assert.equal(h.calls.model, 0); assert.equal(h.calls.managed, 0);
    }
});


test('contrasting Place and Programme creation permissions are independently answered', async () => {
    for (const [user, place, programme] of [[actor, /cannot create a new Place/, /can prepare a Programme/],
        [{ id: 105, role: 'standard' }, /cannot create a new Place/, /cannot create a Programme/],
        [{ id: 106, role: 'super_admin' }, /can open New Place/, /can prepare a Programme/]]) {
        const h = harness(user);
        for (const question of ['So am I allowed to create a Place, or only a Programme at a Place I manage?',
            'Can I create both a Place and a service?', 'Can I make a Programme and also a new Place?']) {
            const answer = await h.ask(question);
            assert.equal(answer.answerSource, 'account'); assert.match(answer.message, place); assert.match(answer.message, programme);
            assert.deepEqual(safeGuideChatTurns([{ question, answer: answer.message }]), []);
        }
        assert.equal(h.calls.model, 0); assert.equal(h.calls.managed, 0);
    }
    for (const [user, expected] of [[null, /Sign in/], [{ ...actor, isImpersonating: true }, /Exit User View/]]) {
        const h = harness(user); const answer = await h.ask('Can I create both a Place and a Programme?');
        assert.equal(answer.answerSource, 'account'); assert.match(answer.message, expected); assert.equal(h.calls.model, 0);
    }
});

test('Studio publication follow-ups use reviewed product instructions without claiming live map state', async () => {
    const turns = [{ question: 'I have just saved a new Map Studio presentation.',
        answer: 'Untrusted prior display claiming a map has already been published.' }];
    const h = harness();
    for (const question of ['Will that saved presentation be visible to visitors already using the map link, or is there another step?',
        'Will it refresh the shared map for visitors?', 'Can recipients see this view on the published map?']) {
        const answer = await h.ask(question, turns);
        assert.equal(answer.answerSource, 'reviewed'); assert.equal(answer.topicId, 'map-studio');
        assert.match(answer.message, /does not by itself refresh/); assert.match(answer.message, /Select the saved view/);
        assert.match(answer.message, /preview the embedded result/);
        assert.deepEqual(answer.sources.map(source => source.id), ['map-studio']);
        assert.doesNotMatch(answer.message, /already been published/);
    }
    assert.equal(h.calls.model, 0); assert.equal(h.calls.managed, 0); assert.equal(h.calls.personalPlaces, 0);
    const followup = 'Will it refresh the shared map for visitors?';
    assert.equal(answerGuideStudioFollowup(followup, []), null);
    assert.equal(answerGuideStudioFollowup(followup, [{ question: 'What Places do I manage?', answer: 'Private assigned resource names.' }]), null);
    assert.equal(answerGuideStudioFollowup(followup, [...turns, { question: 'How do I find activities?', answer: 'Use Discover.' }]), null);
    for (const question of ['Will it share my private notes with visitors?', 'Am I allowed to publish this view?',
        'Will this show private addresses on the shared map?', 'How do I delete it from the shared map?']) {
        assert.equal(answerGuideStudioFollowup(question, turns), null);
    }
});
