import test from 'node:test';
import assert from 'node:assert/strict';
import { createGuideRoutes } from '../src/routes/guide.js';
import { restoreGuideHistory } from '../src/utils/guideHistory.js';
import { safeGuideChatTurns } from '../src/utils/guideChat.js';
import { GUIDE_ORACLE_FACTS } from '../src/utils/guideOracleKnowledge.js';
import { guideVerifiedBoundaryIntent } from '../src/utils/guideVerifiedBoundary.js';

const actor = { id: 4, role: 'standard', hardAssetStaffAccess: [{ hardAssetId: 100, staffRole: 'staff' }] };
const env = { SUPPORT_INBOX_ENABLED: 'true', GUIDE_CHAT_ENABLED: 'true', AI: { run: () => {
    throw new Error('The model must not answer eligibility or staff-access facts.');
} } };
const routerFor = (user, options = {}) => createGuideRoutes({
    authenticate: async (c, next) => { c.set('user', user); await next(); },
    directoryAccess: async (_c, next) => next(), ...options,
});
const ask = async (router, question) => {
    const response = await router.request('/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, useAi: true }) }, env);
    assert.equal(response.status, 200, question);
    return response.json();
};

test('restricted Offering questions use reviewed eligibility rules, not resource-management permission', async () => {
    const router = routerFor(actor);
    const cases = [
        ['How do I know whether I can access a member-only Programme?', /active membership at a linked Place.*cannot confirm your eligibility/s],
        ['My CHAS details are missing. Will a restricted Programme appear?', /required field is missing.*access check unresolved/s],
        ['Does saving a restricted Programme mean I am eligible?', /personal bookmark.*does not satisfy profile criteria/s],
        ['Why is a Programme hidden from me when my friend can see it?', /cannot determine from chat why.*not visible/s],
        ['Can you tell whether I personally qualify for the senior exercise class?', /cannot confirm your eligibility for a particular listing/],
        ['Am I eligible for Havelock Restricted Activity?', /cannot confirm your eligibility for a particular listing/],
        ['Can an admin see a Programme even if they are not eligible?', /account role alone does not bypass those checks/],
        ['If I join a Place, can I edit its Programmes?', /does not grant editing rights to its Programmes\/services/],
    ];
    for (const [question, expected] of cases) {
        const result = await ask(router, question);
        assert.equal(result.topicId, 'verified-boundary', question);
        assert.equal(result.answerSource, 'reviewed', question);
        assert.match(result.message, expected, question);
        assert.doesNotMatch(result.message, /This account (?:has resource-management access|can open New Place)/, question);
        assert.ok(result.sources?.length === 1 && result.sources[0].reviewed, question);
    }
});

test('Place staff assignment and unavailable Guide writes have explicit, permission-aware answers', async () => {
    const staffRouter = routerFor(actor);
    const staff = await ask(staffRouter, 'Can I add staff to a Place I manage?');
    assert.equal(staff.topicId, 'verified-boundary');
    assert.match(staff.message, /Only a Super Admin or an Owner of that particular Place can add Staff/);
    assert.doesNotMatch(staff.message, /can open New Place/);
    const volunteer = await ask(staffRouter, 'Can my centre volunteer edit our listing?');
    assert.equal(volunteer.topicId, 'verified-boundary');
    assert.equal(volunteer.answerSource, 'reviewed');
    assert.match(volunteer.message, /volunteer or colleague title does not tell me.*access to the exact Place/s);
    assert.equal(volunteer.sources[0].id, 'place-staff-assignment');
    for (const [question, expected] of [
        ['Can you create a Place for me?', /Guide cannot submit a new public Place.*This account cannot create a new Place/s],
        ['Can you create a Group for me?', /Guide cannot submit a new public Place or Resource Group.*This account cannot create a new Resource Group/s],
    ]) {
        const result = await ask(staffRouter, question);
        assert.equal(result.answerSource, 'account');
        assert.match(result.message, expected);
    }
    const admin = await ask(routerFor({ id: 3, role: 'super_admin' }), 'Can you create a Group for me?');
    assert.match(admin.message, /cannot submit.*can open New Group/s);
    const guest = await ask(routerFor(null), 'Can you create a Place for me?');
    assert.match(guest.message, /Sign in/);
    assert.equal((await ask(staffRouter, 'Am I allowed to create a Place?')).answerSource, 'account');
});

test('private My Place cannot inherit public Place creation guidance', async () => {
    const question = 'Can I make my private My Place public directly?';
    assert.equal(guideVerifiedBoundaryIntent(question), 'private-place-public');
    const result = await ask(routerFor(actor), question);
    assert.equal(result.answerSource, 'reviewed');
    assert.equal(result.topicId, 'verified-boundary');
    assert.match(result.message, /private My Place.*not a public directory Place.*cannot verify a one-click conversion/s);
    assert.doesNotMatch(result.message, /This account cannot create a new Place/);
    assert.deepEqual(result.sources.map((source) => source.id), ['personal-place-sharing', 'guide-create-scope']);
    assert.deepEqual(safeGuideChatTurns([{ question, answer: result.message }]), []);
    assert.equal(guideVerifiedBoundaryIntent('Can I create a private My Place?'), null);
});

test('linked host Places do not imply personal membership or give the Guide an edit action', async () => {
    for (const question of [
        'If I change a linked Place, will the Guide change an existing Programme for me?',
        'Can you update an existing service at a linked centre?',
    ]) {
        assert.equal(guideVerifiedBoundaryIntent(question), null, question);
        const result = await ask(routerFor(actor), question);
        assert.equal(result.answerSource, 'reviewed');
        assert.equal(result.topicId, 'guide-existing-resource-edit-scope');
        assert.deepEqual(result.sources.map(({ id }) => id), ['guide-existing-resource-edit-scope']);
        assert.match(result.message, /cannot edit an existing public Place or Offering.*exact resource.*server checks permission/s);
        assert.doesNotMatch(result.message, /Joining a Place|membership/i);
        assert.equal(result.actionPlan, undefined);
    }
    const host = await ask(routerFor(actor), 'How do I change the linked Place for a Programme?');
    assert.equal(host.topicId, 'offering-host-change');
    assert.match(host.message, /Host Locations.*permission for both the Offering and each new linked Place/s);
    for (const question of [
        'If I join a Place, can I edit its Programmes?',
        'If I link my account to a Place, can I manage its services?',
        'My account is connected to a Place. Can I change its Programme?',
        'If I link myself to a centre, can I edit its listing?',
        'Does my Place membership let me edit the listing?',
    ]) {
        assert.equal(guideVerifiedBoundaryIntent(question), 'membership-edit', question);
        const result = await ask(routerFor(actor), question);
        assert.equal(result.topicId, 'verified-boundary');
        assert.equal(result.sources[0].id, 'place-membership');
        assert.match(result.message, /does not grant editing rights/);
    }
});

test('the scope of an Owner assignment is not an instruction to assign staff', async () => {
    for (const user of [actor, { id: 1, role: 'standard' }, null, { ...actor, isImpersonating: true }]) {
        const router = routerFor(user, {
            managed: async () => { throw new Error('A product scope rule must not load an account list.'); },
        });
        for (const question of [
            'Does an Owner assignment on one Place let me manage every Place?',
            'Can I edit all Places because I am an Owner of one Place?',
            'Does a Staff role at one centre let me manage another centre?',
        ]) {
            assert.equal(guideVerifiedBoundaryIntent(question), null, question);
            const result = await ask(router, question);
            assert.equal(result.topicId, 'place-assignment-scope');
            assert.equal(result.answerSource, 'reviewed');
            assert.deepEqual(result.sources.map(({ id }) => id), ['place-assignment-scope']);
            assert.match(result.message, /exact Place assigned.*does not grant.*every Place.*Super Admin.*not whether your account/s);
            assert.doesNotMatch(result.message, /Only a Super Admin or an Owner.*add Staff|This account can/);
        }
    }
    for (const question of ['Can I assign Owners to all Places?', 'How do I manage Place access for Staff?']) {
        assert.equal(guideVerifiedBoundaryIntent(question), 'place-staff', question);
        assert.equal((await ask(routerFor(actor), question)).sources[0].id, 'place-staff-assignment');
    }
});

test('sensitive boundary questions stay out of later model turns and reopen from current facts', () => {
    const question = 'My CHAS details are missing. Will a restricted Programme appear?';
    assert.equal(guideVerifiedBoundaryIntent(question), 'missing-profile');
    assert.deepEqual(safeGuideChatTurns([{ question, answer: 'A private profile answer' }]), []);
    assert.equal(guideVerifiedBoundaryIntent('Find member-only Programmes'), null);
    assert.equal(guideVerifiedBoundaryIntent('Can I create a governance group?'), null);
    assert.equal(guideVerifiedBoundaryIntent('Can my centre volunteer edit our listing?'), 'third-party-place-editor');
    const row = { id: 123, title: 'Eligibility', revision: 1, updated_at: '2026-09-29T00:00:00Z',
        inputs: [{ question }, { question: 'Can you create a Place for me?' }] };
    const restored = restoreGuideHistory(row, actor).messages;
    assert.equal(restored[0].topicId, 'verified-boundary');
    assert.match(restored[0].message, /access check unresolved/);
    assert.equal(restored[1].answerSource, 'account');
    assert.match(restored[1].message, /cannot create a new Place/);
    for (const id of ['offering-eligibility', 'offering-profile-missing', 'saved-not-eligible',
        'offering-not-visible', 'place-staff-assignment', 'guide-create-scope']) {
        const fact = GUIDE_ORACLE_FACTS.find((item) => item.id === id);
        assert.ok(fact?.evidence && fact.route && fact.reviewed, id);
    }
});
