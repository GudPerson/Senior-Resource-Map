import test from 'node:test';
import assert from 'node:assert/strict';
import { answerGuideWithCloudflare, guideChatAvailable, GUIDE_CHAT_MODEL } from '../src/utils/guideChat.js';
import { createGuideRoutes } from '../src/routes/guide.js';
import { guideLifecycleAccessIntent } from '../src/utils/guideAccess.js';
import { answerGuideQuestion } from '../src/utils/guideKnowledge.js';

const post = (router, body, env, headers = {}) => router.request('/answer', { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }, env);
const makeRouter = (user = { id: 4, role: 'standard' }) => createGuideRoutes({
    authenticate: async (c, next) => { c.set('user', user); await next(); },
});

test('Care Map questions keep the former My Map workflows and scoped actions', async () => {
    const router = makeRouter();
    const env = { SUPPORT_INBOX_ENABLED: 'true' };
    const headers = { 'cf-connecting-ip': '198.51.100.240' };
    for (const [question, topicId, expected] of [
        ['How do I add a missing place to My Map?', 'personal-place-map-create', /signed in.*map you own.*Care Maps.*Personal place/s],
        ['How do I remove a Place from My Map?', 'my-map-resource-removal', /Care Maps.*does not unsave.*or delete the public listing/s],
        ['Can I import a workbook into My Map?', 'unverified-workflow', /cannot verify a workbook-upload workflow for Care Maps/],
        ['How do I add notes to a resource in My Map?', 'my-map-note-edit', /Care Maps.*map you own.*Open Map Notes.*Share this note/s],
        ['How do I add notes to a resource in My Maps?', 'my-map-note-edit', /Care Maps.*map you own.*Open Map Notes.*Share this note/s],
        ['Can visitors see my private My Map notes?', 'map-note-privacy', /Care Map stay private unless.*Share this note/s],
        ['Can someone else add a Place to my private My Map?', 'shared-map-copy', /Only the owner can add.*does not let a visitor add/s],
        ['How do I create My Maps?', 'maps', /choose Care Maps to create or open a map/],
    ]) {
        const renamedQuestion = question.replace(/My Map/g, 'Care Map');
        const former = await (await post(router, { question, pageContext: 'My Maps' }, env, headers)).json();
        const renamed = await (await post(router, { question: renamedQuestion, pageContext: 'My Maps' }, env, headers)).json();
        assert.equal(former.topicId, topicId, question);
        assert.equal(renamed.topicId, topicId, renamedQuestion);
        assert.equal(renamed.answerSource, 'reviewed', renamedQuestion);
        assert.equal(renamed.message, former.message, renamedQuestion);
        assert.deepEqual(renamed.actions, former.actions, renamedQuestion);
        assert.deepEqual(renamed.sources, former.sources, renamedQuestion);
        assert.match(renamed.message, expected, renamedQuestion);
        assert.doesNotMatch(JSON.stringify({ message: renamed.message, actions: renamed.actions, sources: renamed.sources }), /\bMy Maps?\b/);
        assert.deepEqual(renamed.input, { question: renamedQuestion });
    }
});

test('Care Map map help retains guest sign-in and historical input support', async () => {
    const router = makeRouter(null);
    const env = { SUPPORT_INBOX_ENABLED: 'true' };
    const headers = { 'cf-connecting-ip': '198.51.100.241' };
    for (const question of ['How do I create My Maps?', 'How do I create Care Maps?']) {
        const answer = await (await post(router, { question }, env, headers)).json();
        assert.equal(answer.topicId, 'maps', question);
        assert.equal(answer.answerSource, 'reviewed', question);
        assert.match(answer.message, /choose Care Maps to create or open a map/);
        assert.deepEqual(answer.actions, [{ label: 'Sign in to continue', route: '/login' }]);
        assert.deepEqual(answer.input, { question });
    }
});

test('Guide chat is off without both its flag and Cloudflare binding', () => {
    assert.equal(guideChatAvailable({ GUIDE_CHAT_ENABLED: 'true' }), false);
    assert.equal(guideChatAvailable({ AI: { run() {} } }), false);
    assert.equal(guideChatAvailable({ GUIDE_CHAT_ENABLED: 'true', AI: { run() {} } }), true);
    assert.equal(guideChatAvailable({ NODE_ENV: 'production', GUIDE_CHAT_ENABLED: 'true', AI: { run() {} } }), false);
    assert.equal(guideChatAvailable({ NODE_ENV: 'production', GUIDE_CHAT_ENABLED: 'true',
        GUIDE_AI_GATEWAY_ID: 'guide-oracle', AI: { run() {} } }), true);
    assert.equal(guideChatAvailable({ NODE_ENV: 'production', GUIDE_CHAT_ENABLED: 'true',
        GUIDE_AI_GATEWAY_ID: 'bad gateway id', AI: { run() {} } }), false);
});

test('Guide routes production inference through a named gateway without cache or prompt logs', async () => {
    const calls = [];
    const env = { NODE_ENV: 'production', GUIDE_CHAT_ENABLED: 'true', GUIDE_AI_GATEWAY_ID: 'guide-oracle',
        AI: { run: async (...args) => { calls.push(args); return { response: '{"factIds":["help-maps"]}' }; } } };
    const result = await answerGuideWithCloudflare({ question: 'How do I create a map?', topicId: 'maps', env });
    assert.match(result.message, /My Directory.*choose Care Maps/);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0][2], { gateway: { id: 'guide-oracle', skipCache: true, collectLog: false } });
});

test('Production Guide without a named gateway keeps reviewed answers available', async () => {
    const env = { NODE_ENV: 'production', SUPPORT_INBOX_ENABLED: 'true', GUIDE_CHAT_ENABLED: 'true',
        AI: { run: () => { throw new Error('Inference must remain disabled.'); } } };
    const router = makeRouter();
    const headers = { 'cf-connecting-ip': '198.51.100.88' };
    const topics = await (await router.request('/topics', { headers }, env)).json();
    assert.equal(topics.chatMode, 'guide');
    const answer = await (await post(router, { question: 'How do I create a map?', useAi: true }, env, headers)).json();
    assert.equal(answer.answerSource, 'reviewed');
    assert.match(answer.message, /My Directory.*choose Care Maps/);
});

test('A gateway budget rejection leaves the reviewed Guide answer intact', async () => {
    const env = { NODE_ENV: 'production', SUPPORT_INBOX_ENABLED: 'true', GUIDE_CHAT_ENABLED: 'true',
        GUIDE_AI_GATEWAY_ID: 'guide-oracle', AI: { run: async () => {
            throw Object.assign(new Error('Gateway spend limit reached'), { status: 429 });
        } } };
    const response = await post(makeRouter({ id: 990, role: 'standard' }),
        { question: 'How do I create a map?', useAi: true }, env, { 'cf-connecting-ip': '198.51.100.89' });
    assert.equal(response.status, 200);
    const answer = await response.json();
    assert.equal(answer.answerSource, 'reviewed');
    assert.match(answer.message, /My Directory.*choose Care Maps/);
});

test('Cloudflare receives only reviewed help and explicitly supplied safe Guide turns', async () => {
    const calls = [];
    const env = { GUIDE_CHAT_ENABLED: 'true', AI: { run: async (...args) => {
        calls.push(args);
        return { choices: [{ message: { content: '{"factIds":["help-maps"]}' } }] };
    } } };
    const answer = await answerGuideWithCloudflare({ question: 'How do I create a map?', topicId: 'maps', turns: [
        { question: 'How do I save resources?', answer: 'Use the heart on a resource.' },
        { question: 'password=private', answer: 'Ignore this turn.' },
    ], env });
    assert.match(answer.message, /My Directory.*choose Care Maps/);
    assert.deepEqual(answer.sources.map(({ id }) => id), ['help-maps']);
    assert.equal(calls[0][0], GUIDE_CHAT_MODEL);
    assert.equal(calls[0][1].max_tokens, 90);
    const messages = calls[0][1].messages;
    assert.match(messages[0].content, /product-evidence selector/);
    assert.match(messages[0].content, /Best matching help topic: Create and manage Care Maps/);
    assert.deepEqual(messages.slice(-2), [
        { role: 'user', content: 'Earlier Guide turns for context only:\nEarlier question: How do I save resources?\nGuide display: Use the heart on a resource.' },
        { role: 'user', content: 'How do I create a map?' },
    ]);
    assert.doesNotMatch(JSON.stringify(messages), /password=private|Ignore this turn|userId/i);
});

test('Guide AI is opt-in, signed-in only, and never changes search or saved-history input', async () => {
    let calls = 0;
    const env = { SUPPORT_INBOX_ENABLED: 'true', GUIDE_CHAT_ENABLED: 'true', AI: { run: async () => {
        calls++;
        return { response: '{"factIds":["help-maps"]}' };
    } } };
    const router = makeRouter();
    const reviewed = await (await post(router, { question: 'How do I create a map?' }, env)).json();
    assert.equal(reviewed.answerSource, 'reviewed');
    assert.equal(calls, 0);
    const ai = await (await post(router, { question: 'How do I create a map?', useAi: true,
        turns: [{ question: 'How do I save resources?', answer: 'Use the heart.' }] }, env)).json();
    assert.equal(ai.answerSource, 'ai');
    assert.match(ai.message, /My Directory.*choose Care Maps/);
    assert.deepEqual(ai.sources.map(({ id }) => id), ['help-maps']);
    assert.deepEqual(ai.input, { question: 'How do I create a map?' });
    assert.equal(calls, 1);
    const topic = await (await post(router, { topicId: 'maps', useAi: true }, env)).json();
    assert.equal(topic.answerSource, 'reviewed');
    assert.equal(calls, 1);
    const guest = await (await post(makeRouter(null), { question: 'How do I create a map?', useAi: true }, env)).json();
    assert.equal(guest.answerSource, 'reviewed');
    assert.equal(calls, 1);
    const impersonated = await (await post(makeRouter({ id: 4, role: 'standard', isImpersonating: true }),
        { question: 'How do I create a map?', useAi: true }, env)).json();
    assert.equal(impersonated.answerSource, 'reviewed');
    assert.equal(calls, 1);
});

test('Guide answers common product questions when the model repeats a generic no-answer reply', async () => {
    const env = { SUPPORT_INBOX_ENABLED: 'true', GUIDE_CHAT_ENABLED: 'true', AI: { run: async () => ({
        response: 'I don\'t have a verified answer for that. However, I suggest checking the Help topics or support report.',
    }) } };
    const router = makeRouter();
    for (const [question, topicId, expected] of [
        ['what can i do with carearound SG', 'overview', /Discover.*My Directory.*Care Maps/i],
        ['How do I add a resource?', 'add-resource', /save.*existing.*Programme\/service/is],
        ['How do I save a resource?', 'save', /heart.*My Directory/i],
    ]) {
        const response = await (await post(router, { question, useAi: true }, env)).json();
        assert.equal(response.topicId, topicId, question);
        assert.equal(response.answerSource, 'reviewed', question);
        assert.match(response.message, expected, question);
        if (topicId === 'add-resource') assert.match(response.message, /Manage My Resources.*New Place.*standard resource form/i);
        assert.doesNotMatch(response.message, /I don't have a verified answer|suggest checking the Help topics/i);
    }
});

test('Guide treats private chat content as privacy help without treating every private product item as a privacy question', () => {
    assert.equal(answerGuideQuestion({ question: 'Are private sharing links safe to paste into the Guide?' }).topicId,
        'privacy');
    assert.equal(answerGuideQuestion({ question: 'How do I keep private information out of chat?' }).topicId,
        'privacy');
    assert.notEqual(answerGuideQuestion({ question: 'Can a private planning location go on a map?' }).topicId,
        'privacy');
});

test('Guide answers current resource permissions without asking the model to infer account access', async () => {
    let calls = 0;
    const env = { SUPPORT_INBOX_ENABLED: 'true', GUIDE_CHAT_ENABLED: 'true', GUIDE_ACTIONS_ENABLED: 'true', AI: { run: async () => {
        calls++;
        return { response: 'Are you an authorized resource manager?' };
    } } };
    const staffActor = { id: 4, role: 'standard', hardAssetStaffAccess: [
        { hardAssetId: 100, staffRole: 'staff', subregionId: 10 },
    ] };
    const staff = makeRouter(staffActor);
    for (const question of [
        'am i allow to creata place?',
        'im not sure are you able to tell me if im an authorized resource manager',
    ]) {
        const answer = await (await post(staff, { question, useAi: true }, env)).json();
        assert.equal(answer.topicId, 'resource-access');
        assert.equal(answer.answerSource, 'account');
        assert.match(answer.message, /cannot create a new Place/i);
        assert.match(answer.message, /Programme\/service/i);
        assert.doesNotMatch(JSON.stringify(answer), /hardAssetId|subregionId|100/);
    }
    const admin = await (await post(makeRouter({ id: 3, role: 'super_admin' }),
        { question: 'Am I allowed to create a Place?', useAi: true }, env)).json();
    assert.match(admin.message, /can open New Place/i);
    const guest = await (await post(makeRouter(null),
        { question: 'Am I allowed to create a Place?', useAi: true }, env)).json();
    assert.match(guest.message, /sign in/i);
    const userView = await (await post(makeRouter({ ...staffActor, isImpersonating: true }),
        { question: 'Am I allowed to create a Place?', useAi: true }, env)).json();
    assert.match(userView.message, /Exit User View/i);
    assert.equal(calls, 0);
});

test('private My Places questions do not inherit public Place creation permissions', async () => {
    let calls = 0;
    const env = { SUPPORT_INBOX_ENABLED: 'true', GUIDE_CHAT_ENABLED: 'true', AI: { run: async () => {
        calls++;
        return { response: { factIds: ['my-places'] } };
    } } };
    const router = makeRouter({ id: 4, role: 'standard' });
    const personal = await (await post(router, { question: 'Can I create a personal place?', useAi: true }, env)).json();
    assert.equal(personal.answerSource, 'reviewed');
    assert.equal(personal.topicId, 'my-places');
    assert.match(personal.message, /Add personal place/);
    assert.deepEqual(personal.actions, [{ label: 'Open My Places', route: '/my-directory?section=my-places' }]);
    const publicPlace = await (await post(router, { question: 'Can I create a new public Place?', useAi: true }, env)).json();
    assert.equal(publicPlace.topicId, 'resource-access');
    assert.match(publicPlace.message, /cannot create a new Place/);
    assert.equal(calls, 0);
});

test('Resource Group questions distinguish how-to, account creation rights and governance groups', async () => {
    let calls = 0;
    const env = { SUPPORT_INBOX_ENABLED: 'true', GUIDE_CHAT_ENABLED: 'true', AI: { run: async () => {
        calls++;
        return { response: '{"factIds":["group-create"]}' };
    } } };
    const directPlaceStaff = { id: 4, role: 'standard', hardAssetStaffAccess: [{ hardAssetId: 100, staffRole: 'staff' }] };
    const howTo = await (await post(makeRouter(directPlaceStaff),
        { question: 'How do I edit a Resource Group?', useAi: true }, env)).json();
    assert.equal(howTo.answerSource, 'reviewed');
    assert.equal(howTo.topicId, 'group-edit');
    assert.match(howTo.message, /Edit.*eligible public, non-hidden resources/s);
    const staff = await (await post(makeRouter(directPlaceStaff),
        { question: 'Can I create a Resource Group?', useAi: true }, env)).json();
    assert.equal(staff.answerSource, 'account');
    assert.equal(staff.topicId, 'group-access');
    assert.match(staff.message, /cannot create a new Resource Group.*assigned Place alone/s);
    assert.equal(staff.canCheckManagedListing, undefined);
    const addMember = await (await post(makeRouter(directPlaceStaff),
        { question: 'Can I add a Place to a Resource Group?', useAi: true }, env)).json();
    assert.equal(addMember.topicId, 'group-access');
    assert.match(addMember.message, /Edit is available only on a Group this account may edit/);
    assert.equal(addMember.canCheckManagedListing, true);
    assert.doesNotMatch(addMember.message, /cannot create a new Resource Group/);
    const removeMember = await (await post(makeRouter(directPlaceStaff),
        { question: 'Can I remove a Programme from a Resource Group?', useAi: true }, env)).json();
    assert.equal(removeMember.topicId, 'group-access');
    assert.match(removeMember.message, /Edit is available only on a Group this account may edit/);
    const deleteGroup = await (await post(makeRouter(directPlaceStaff),
        { question: 'Can I delete a Resource Group?', useAi: true }, env)).json();
    assert.equal(deleteGroup.topicId, 'group-access');
    assert.match(deleteGroup.message, /does not confirm it may delete a particular Group.*server rechecks/s);
    assert.equal(deleteGroup.canCheckManagedListing, true);
    const admin = await (await post(makeRouter({ id: 3, role: 'super_admin' }),
        { question: 'Can I create a Resource Group?', useAi: true }, env)).json();
    assert.match(admin.message, /can open New Group.*requires an owner.*not ready for Discover/s);
    const partnerStaff = await (await post(makeRouter({ id: 7, role: 'standard', partnerStaffAccess: [
        { organizationId: 2, legacyPartnerUserId: 9, staffRole: 'editor' },
    ] }), { question: 'Can I create a Resource Group?', useAi: true }, env)).json();
    assert.match(partnerStaff.message, /can open New Group/);
    const guest = await (await post(makeRouter(null),
        { question: 'Can I create a Resource Group?', useAi: true }, env)).json();
    assert.match(guest.message, /Sign in/);
    const userView = await (await post(makeRouter({ ...directPlaceStaff, isImpersonating: true }),
        { question: 'Can I create a Resource Group?', useAi: true }, env)).json();
    assert.match(userView.message, /Exit User View/);
    const governance = await (await post(makeRouter(directPlaceStaff),
        { question: 'How are governance groups created?', useAi: true }, env,
        { 'cf-connecting-ip': '203.0.113.211' })).json();
    assert.equal(governance.topicId, 'help-access');
    assert.deepEqual(governance.sources, []);
    assert.doesNotMatch(governance.message, /Org Group.*Region Group/s);
    const permittedGovernance = createGuideRoutes({ authenticate: async (c, next) => { c.set('user', directPlaceStaff); await next(); },
        helpCapabilities: async () => ({ organization: { workspaceView: true } }) });
    const permitted = await (await post(permittedGovernance, { question: 'How are governance groups created?' }, env)).json();
    assert.equal(permitted.topicId, 'governance-group-overview');
    assert.match(permitted.message, /separate from public Resource Groups.*Org Group.*Region Group/s);
    assert.equal(calls, 0);
});

test('Cross-provider Group membership advice does not grant Group or member-listing edit rights', async () => {
    const env = { SUPPORT_INBOX_ENABLED: 'true', GUIDE_CHAT_ENABLED: 'true', AI: { run: () => {
        throw new Error('Reviewed Group and account boundaries must bypass AI.');
    } } };
    const question = 'Can I add another organisation’s public Place to my Resource Group?';
    const headers = { 'cf-connecting-ip': '198.51.100.77' };
    const staff = { id: 4, role: 'standard', hardAssetStaffAccess: [{ hardAssetId: 100, staffRole: 'staff' }] };
    const account = await (await post(makeRouter(staff), { question, useAi: true }, env, headers)).json();
    assert.equal(account.answerSource, 'account');
    assert.match(account.message, /another provider.*does not give you editing rights.*exact managed Group/s);
    assert.equal(account.canCheckManagedListing, true);
    const member = await (await post(makeRouter({ id: 9, role: 'standard' }), { question, useAi: true }, env, headers)).json();
    assert.equal(member.answerSource, 'account');
    assert.match(member.message, /another provider.*does not give you editing rights.*does not currently have Manage My Resources access/s);
    const guest = await (await post(makeRouter(null), { question, useAi: true }, env, headers)).json();
    assert.equal(guest.answerSource, 'account');
    assert.match(guest.message, /Sign in to check/);
    const userView = await (await post(makeRouter({ ...staff, isImpersonating: true }), { question, useAi: true }, env, headers)).json();
    assert.equal(userView.answerSource, 'account');
    assert.match(userView.message, /Exit User View/);
    const concept = await (await post(makeRouter(staff), {
        question: 'Can a Resource Group include another organisation’s public Place?', useAi: true,
    }, env, headers)).json();
    assert.equal(concept.answerSource, 'reviewed');
    assert.equal(concept.topicId, 'group-other-provider-members');
});

test('Workbook import questions use the Data Tools role gate and do not imply a Guide preview', async () => {
    let calls = 0;
    const env = { SUPPORT_INBOX_ENABLED: 'true', GUIDE_CHAT_ENABLED: 'true', AI: { run: async () => {
        calls++;
        return { response: '{"factIds":["asset-workbook-import"]}' };
    } } };
    const staff = makeRouter({ id: 4, role: 'standard', hardAssetStaffAccess: [{ hardAssetId: 100, staffRole: 'staff' }] });
    const staffPermission = await (await post(staff,
        { question: 'Can I import a workbook to create programmes?', useAi: true }, env)).json();
    assert.equal(staffPermission.answerSource, 'account');
    assert.equal(staffPermission.topicId, 'composite-guidance');
    assert.match(staffPermission.message, /prepare a Programme\/service at a Place it manages/);
    assert.match(staffPermission.message, /not available to this account.*Super Admin.*does not grant bulk workbook import/s);
    const admin = await (await post(makeRouter({ id: 3, role: 'super_admin' }),
        { question: 'Can I import a workbook to create programmes?', useAi: true }, env)).json();
    assert.equal(admin.answerSource, 'account');
    assert.match(admin.message, /Admin.*Data Tools.*Upload Workbook.*starts the bulk import immediately/s);
    const howTo = await (await post(staff,
        { question: 'How do I import a workbook to create programmes?', useAi: true }, env)).json();
    assert.equal(howTo.answerSource, 'reviewed');
    assert.equal(howTo.topicId, 'help-access');
    assert.deepEqual(howTo.sources, []);
    assert.doesNotMatch(howTo.message, /Upload Workbook starts the import immediately/s);
    const permittedHowTo = await (await post(makeRouter({ id: 3, role: 'super_admin' }),
        { question: 'How do I import a workbook to create programmes?' }, env)).json();
    assert.equal(permittedHowTo.topicId, 'asset-workbook-import');
    assert.match(permittedHowTo.message, /Super Admin.*Upload Workbook starts the import immediately/s);
    const map = await (await post(staff,
        { question: 'Can I import a workbook into My Map?', useAi: true }, env)).json();
    assert.equal(map.topicId, 'unverified-workflow');
    assert.match(map.message, /cannot verify a workbook-upload workflow for Care Maps/);
    assert.doesNotMatch(map.message, /starts the import immediately/);
    const guest = await (await post(makeRouter(null),
        { question: 'Can I import a workbook to create programmes?', useAi: true }, env)).json();
    assert.match(guest.message, /Sign in/);
    const userView = await (await post(makeRouter({ id: 3, role: 'super_admin', isImpersonating: true }),
        { question: 'Can I import a workbook to create programmes?', useAi: true }, env)).json();
    assert.match(userView.message, /Exit User View/);
    assert.equal(calls, 0);
});

test('resource lifecycle questions separate reviewed controls from per-listing permission', async () => {
    for (const question of ['Can I delete a saved Place?', 'Can I remove a Place from My Map?',
        'Can I delete a Programme from My Plans?', 'Can I edit a personal place?']) {
        assert.equal(guideLifecycleAccessIntent(question), null, question);
    }
    let calls = 0;
    const env = { SUPPORT_INBOX_ENABLED: 'true', GUIDE_CHAT_ENABLED: 'true', AI: { run: async () => {
        calls++;
        return { response: '{"factIds":["resource-edit"]}' };
    } } };
    const directPlaceStaff = { id: 4, role: 'standard', hardAssetStaffAccess: [{ hardAssetId: 100, staffRole: 'staff' }] };
    const howTo = await (await post(makeRouter(directPlaceStaff),
        { question: 'How do I edit a Place?', useAi: true }, env)).json();
    assert.equal(howTo.answerSource, 'reviewed');
    assert.equal(howTo.topicId, 'resource-edit');
    const hideVsDelete = await (await post(makeRouter(directPlaceStaff),
        { question: 'What is the difference between hiding and deleting a resource?', useAi: true }, env)).json();
    assert.equal(hideVsDelete.topicId, 'resource-hide-delete');
    assert.match(hideVsDelete.message, /Hide from app.*separate from Delete.*UI does not offer an undo/s);
    const staff = await (await post(makeRouter(directPlaceStaff),
        { question: 'Can I delete a Place?', useAi: true }, env)).json();
    assert.equal(staff.answerSource, 'account');
    assert.equal(staff.topicId, 'lifecycle-access');
    assert.match(staff.message, /does not confirm it may delete a particular Place or Offering.*server rechecks permission/s);
    assert.doesNotMatch(staff.message, /This account can delete/);
    const unnamed = await (await post(makeRouter(directPlaceStaff),
        { question: 'Can I edit this one?', useAi: true }, env)).json();
    assert.equal(unnamed.topicId, 'lifecycle-access');
    assert.match(unnamed.message, /Choose the exact managed listing/);
    const member = await (await post(makeRouter({ id: 8, role: 'standard' }),
        { question: 'Can I edit a Place?', useAi: true }, env)).json();
    assert.match(member.message, /does not currently have Manage My Resources access/);
    const guest = await (await post(makeRouter(null),
        { question: 'Can I hide a Place?', useAi: true }, env)).json();
    assert.match(guest.message, /Sign in/);
    const userView = await (await post(makeRouter({ ...directPlaceStaff, isImpersonating: true }),
        { question: 'Can I hide a Place?', useAi: true }, env)).json();
    assert.match(userView.message, /Exit User View/);
    const archive = await (await post(makeRouter(directPlaceStaff),
        { question: 'Can I archive a Place?', useAi: true }, env)).json();
    assert.equal(archive.topicId, 'unverified-workflow');
    assert.match(archive.message, /cannot verify an Archive control.*Hide from app and Delete/s);
    assert.equal(calls, 0);
});

test('private-list changes never turn into public resource deletion advice', async () => {
    let calls = 0;
    const env = { SUPPORT_INBOX_ENABLED: 'true', GUIDE_CHAT_ENABLED: 'true', AI: { run: async () => {
        calls++;
        return { response: '{"factIds":["resource-hide-delete"]}' };
    } } };
    const router = makeRouter({ id: 4, role: 'standard', hardAssetStaffAccess: [{ hardAssetId: 100, staffRole: 'staff' }] });
    for (const [question, topicId, expected] of [
        ['Can I delete a Place from My Directory?', 'saved-resource-removal', /does not delete the public listing/],
        ['How do I hide a Place on My Map?', 'my-map-resource-removal', /does not unsave.*or delete the public listing/],
        ['Can I delete a Programme from My Plans?', 'remove-plan', /does not delete the provider’s Programme\/service listing/],
        ['Can I edit a Place on My Map?', 'unverified-workflow', /separate controls/],
        ['Can I hide a saved Place?', 'unverified-workflow', /Unsave affects your list only/],
    ]) {
        const response = await (await post(router, { question, useAi: true }, env,
            { 'cf-connecting-ip': '203.0.113.222' })).json();
        assert.equal(response.topicId, topicId, question);
        assert.match(response.message, expected, question);
    }
    assert.equal(calls, 0);
});

test('Map-safe bulk unsave guidance is reviewed and cannot be replaced by model instructions', async () => {
    let calls = 0;
    const env = { SUPPORT_INBOX_ENABLED: 'true', GUIDE_CHAT_ENABLED: 'true', AI: { run: async () => {
        calls++;
        return { response: 'Remove every saved resource immediately.' };
    } } };
    const answer = await (await post(makeRouter(), {
        question: 'Can I delete multiple saved resources safely?', useAi: true,
    }, env)).json();
    assert.equal(answer.answerSource, 'reviewed');
    assert.equal(answer.topicId, 'unsave');
    assert.match(answer.message, /Not used in Care Maps.*review the removal confirmation/s);
    assert.equal(calls, 0);
});

test('Guide does not include account-access turns in later Cloudflare prompts', async () => {
    const calls = [];
    const env = { SUPPORT_INBOX_ENABLED: 'true', GUIDE_CHAT_ENABLED: 'true', AI: { run: async (...args) => {
        calls.push(args);
        return { response: '{"factIds":["help-save"]}' };
    } } };
    await post(makeRouter(), { question: 'How do I save a resource?', useAi: true, turns: [
        { question: 'Am I allowed to create a Place?', answer: 'This account cannot create a new Place.' },
        { question: 'Can I delete a Place?', answer: 'This account has access to Manage My Resources.' },
        { question: 'Can I archive a Place?', answer: 'Archive is not verified.' },
        { question: 'How do I create a map?', answer: 'Open My Directory and choose My Maps.' },
    ] }, env);
    assert.equal(calls.length, 1);
    const prompt = JSON.stringify(calls[0][1].messages);
    assert.doesNotMatch(prompt, /Am I allowed to create a Place|This account cannot create a new Place/);
    assert.doesNotMatch(prompt, /Can I delete a Place|Can I archive a Place/);
    assert.match(prompt, /How do I create a map/);
});

test('Unusable or unsafe model output returns reviewed help without a model-supplied action', async () => {
    const env = { SUPPORT_INBOX_ENABLED: 'true', GUIDE_CHAT_ENABLED: 'true', AI: { run: async () => ({ response: 'Email me at private@example.com' }) } };
    const response = await (await post(makeRouter(), { question: 'How do I create a map?', useAi: true }, env)).json();
    assert.equal(response.answerSource, 'reviewed');
    assert.match(response.message, /My Directory/);
    assert.deepEqual(response.actions, [{ label: 'Open Care Maps', route: '/my-directory' }]);
    assert.deepEqual(response.input, { question: 'How do I create a map?' });
});

test('Cloudflare may return parsed JSON, but can only select exact reviewed facts', async () => {
    const question = 'What does Detailed map show at zoom 15?';
    const env = { SUPPORT_INBOX_ENABLED: 'true', GUIDE_CHAT_ENABLED: 'true', AI: {
        run: async () => ({ response: { factIds: ['help-detailed-map'] } }),
    } };
    const answer = await (await post(makeRouter(), { question, useAi: true }, env)).json();
    assert.equal(answer.answerSource, 'ai');
    assert.deepEqual(answer.sources.map(({ id }) => id), ['help-detailed-map']);
    assert.match(answer.message, /zoom 14 up to, but not including, zoom 16/);
    assert.match(answer.message, /Care Map and its owner Print View keep native detail from zoom 15/);

    const invented = { ...env, AI: { run: async () => ({ response: { factIds: ['You always see block numbers at zoom 15'] } }) } };
    const fallback = await (await post(makeRouter(), { question, useAi: true }, invented)).json();
    assert.equal(fallback.answerSource, 'reviewed');
    assert.doesNotMatch(fallback.message, /You always see block numbers at zoom 15/);
});

test('Guide rejects model claims about this account\'s editing rights or provider outcome', async () => {
    for (const modelMessage of [
        'You can\'t edit it, even if another manager assigned you.',
        'Your account is eligible for this service.',
        'You have permission to manage this Place.',
        'You can create a new Place.',
    ]) {
        const env = { SUPPORT_INBOX_ENABLED: 'true', GUIDE_CHAT_ENABLED: 'true', AI: {
            run: async () => ({ response: modelMessage }),
        } };
        const response = await (await post(makeRouter(), { question: 'How do I create a map?', useAi: true }, env)).json();
        assert.equal(response.answerSource, 'reviewed', modelMessage);
        assert.doesNotMatch(response.message, /eligible for this service|permission to manage|can.t edit it/i);
        assert.match(response.message, /My Directory/);
    }
    const benign = await answerGuideWithCloudflare({ question: 'How do I create a map?', topicId: 'maps',
        env: { GUIDE_CHAT_ENABLED: 'true', AI: { run: async () => ({ response: '{"factIds":["help-maps"]}' }) } } });
    assert.match(benign.message, /My Directory.*choose Care Maps/);
});

test('Guide AI request limit returns reviewed help and stops additional inference', async () => {
    let calls = 0;
    const env = { SUPPORT_INBOX_ENABLED: 'true', GUIDE_CHAT_ENABLED: 'true', AI: { run: async () => {
        calls++;
        return { response: '{"factIds":["help-maps"]}' };
    } } };
    const router = makeRouter({ id: 933, role: 'standard' });
    let last;
    for (let index = 0; index < 11; index++) last = await post(router, { question: 'How do I create a map?', useAi: true }, env);
    assert.equal(last.status, 200);
    assert.equal(calls, 10);
    const answer = await last.json();
    assert.equal(answer.answerSource, 'reviewed');
    assert.equal(answer.aiStatus, 'limited');
    assert.match(answer.message, /My Directory/);
});
