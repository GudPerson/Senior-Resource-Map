import test from 'node:test';
import assert from 'node:assert/strict';
import { createGuideRoutes } from '../src/routes/guide.js';
import { createGuideManagedAccessLoader, createGuideManagedResourceLoader, guideManagedResourceIntent } from '../src/utils/guideManagedResources.js';
import { safeGuideChatTurns } from '../src/utils/guideChat.js';
import { createGuideSavedResourceLoader, guideSavedResourceIntent } from '../src/utils/guideSavedResources.js';
import { createGuidePersonalPlaceLoader, guidePersonalPlaceIntent } from '../src/utils/guidePersonalPlaces.js';
import { createGuidePlansLoader, guidePlansIntent } from '../src/utils/guidePlans.js';
import { guideLifecycleAccessIntent, guideStandaloneOfferingIntent, guideTemplateAccessIntent, isGuideResourceAccessQuestion } from '../src/utils/guideAccess.js';
import { guideAuditAccessIntent, answerGuideAuditAccess } from '../src/utils/guideAuditAccess.js';
import { guideOrganizationAccessIntent, answerGuideOrganizationAccess } from '../src/utils/guideOrganizationAccess.js';
import { guideGovernanceGroupCreationIntent } from '../src/utils/guideGovernanceGroups.js';
import { guideCompositeIntent } from '../src/utils/guideCompositeQuestions.js';
import { answerGuideOwnRegionScope, guideOwnRegionScopeIntent } from '../src/utils/guideOwnRegionScope.js';

const env = { SUPPORT_INBOX_ENABLED: 'true', GUIDE_CHAT_ENABLED: 'true', AI: { run: () => { throw new Error('The model must not answer account facts.'); } } };
const actor = { id: 4, role: 'standard', hardAssetStaffAccess: [{ hardAssetId: 91, staffRole: 'staff' }] };
let guideAccountRequest = 0;
const post = (router, body) => router.request('/answer', { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': `198.51.100.${++guideAccountRequest}` },
    body: JSON.stringify(body) }, env);
const routerFor = (user, options = {}) => createGuideRoutes({
    authenticate: async (c, next) => { c.set('user', user); await next(); },
    directoryAccess: async (c, next) => next(), ...options,
});

test('Guide reads only the signed-in Admin Region Scope and never sends it to AI', async () => {
    assert.equal(guideOwnRegionScopeIntent('Which Subregions am I assigned to administer?'), true);
    assert.equal(guideOwnRegionScopeIntent('Which Subregions are assigned to me?'), true);
    assert.equal(guideOwnRegionScopeIntent('Can I see my colleague’s Region Scope?'), false);
    assert.equal(guideOwnRegionScopeIntent('Can I see Jane Region Scope?'), false);
    assert.equal(guideOwnRegionScopeIntent('Does Region Scope let me edit every Place?'), false);
    let loads = 0;
    const ownRegionScope = async (user) => {
        loads++;
        return user.id === 6
            ? [{ id: 20, code: 'B', name: 'Other scope' }, { id: 10, code: 'A', name: 'Own scope' }]
            : [];
    };
    const regionalAdmin = { id: 6, role: 'regional_admin', subregionIds: [10, 20] };
    const question = 'Which Subregions am I assigned to administer?';
    const answer = await (await post(routerFor(regionalAdmin, { ownRegionScope }),
        { question, useAi: true })).json();
    assert.equal(answer.topicId, 'own-region-scope');
    assert.equal(answer.answerSource, 'account');
    assert.match(answer.message, /2 Subregions: A · Own scope; B · Other scope/);
    assert.match(answer.message, /does not itself grant editing rights/);
    assert.equal(loads, 1);
    assert.deepEqual(safeGuideChatTurns([{ question, answer: answer.message }]), []);
    for (const [user, expected] of [
        [null, /Sign in/], [actor, /not an Admin/],
        [{ id: 3, role: 'super_admin' }, /Super Admin account/],
        [{ ...regionalAdmin, isImpersonating: true }, /Exit User View/],
    ]) {
        const result = await (await post(routerFor(user, { ownRegionScope }),
            { question, useAi: true })).json();
        assert.match(result.message, expected);
    }
    assert.equal(loads, 1);
    const empty = await (await post(routerFor({ id: 7, role: 'regional_admin', subregionIds: [] },
        { ownRegionScope: async () => [] }), { question, useAi: true })).json();
    assert.match(empty.message, /no assigned Subregions/);
    const foreign = await post(routerFor({ id: 7, role: 'regional_admin', subregionIds: [20] },
        { ownRegionScope: async () => [{ id: 10, name: 'Foreign scope' }] }), { question, useAi: true });
    assert.equal(foreign.status, 503);
    assert.doesNotMatch(JSON.stringify(await foreign.json()), /Foreign scope/);
    const manyIds = Array.from({ length: 30 }, (_, index) => index + 1);
    const many = answerGuideOwnRegionScope({ id: 6, role: 'regional_admin', subregionIds: manyIds },
        manyIds.map((id) => ({ id, name: `Synthetic Subregion ${id}` })));
    assert.match(many.message, /more not shown in chat/);
    assert.ok(many.message.length <= 1600);
});

test('Guide distinguishes standalone Offering creation from its Place-linked Create action', async () => {
    const question = 'Can I create a public event that is not attached to a Place?';
    assert.equal(guideStandaloneOfferingIntent(question), true);
    const staff = await (await post(routerFor(actor), { question, useAi: true })).json();
    assert.equal(staff.topicId, 'resource-access');
    assert.equal(staff.answerSource, 'account');
    assert.match(staff.message, /supports a standalone Programme\/service.*cannot open New Offering/s);
    assert.match(staff.message, /Guide’s reviewed Create action also requires a manageable Place/);
    const admin = await (await post(routerFor({ id: 3, role: 'super_admin' }),
        { question, useAi: true })).json();
    assert.match(admin.message, /can open Manage My Resources → New Offering.*Host Locations empty/s);
    assert.match(admin.message, /Guide’s reviewed Create action currently requires a manageable Place/);
    const guest = await (await post(routerFor(null), { question, useAi: true })).json();
    assert.match(guest.message, /Sign in to check/);
    const userView = await (await post(routerFor({ ...actor, isImpersonating: true }),
        { question, useAi: true })).json();
    assert.match(userView.message, /Exit User View/);
    assert.deepEqual(safeGuideChatTurns([{ question, answer: admin.message }]), []);
});

test('Guide distinguishes Offering-template access from Programme creation and workbook templates', async () => {
    assert.equal(guideTemplateAccessIntent('Can I create an Offering template?'), 'create');
    assert.equal(guideTemplateAccessIntent('Can I generate place versions from a template?'), 'generate');
    assert.equal(guideTemplateAccessIntent('Can I edit a template’s place version?'), 'edit');
    assert.equal(guideTemplateAccessIntent('How do I create an Offering template?'), null);
    assert.equal(guideTemplateAccessIntent('Can I upload an Offering Templates workbook?'), null);
    assert.equal(guideTemplateAccessIntent('Which templates can I edit?'), 'list');
    assert.equal(isGuideResourceAccessQuestion('Can I create an Offering template?'), true);

    const staff = await (await post(routerFor(actor), { question: 'Can I create an Offering template?', useAi: true })).json();
    assert.equal(staff.topicId, 'template-access');
    assert.equal(staff.answerSource, 'account');
    assert.match(staff.message, /does not currently have access.*Managing an assigned Place alone/s);
    assert.doesNotMatch(staff.message, /prepare a Programme\/service/);
    const admin = await (await post(routerFor({ id: 3, role: 'super_admin' }),
        { question: 'Can I create an Offering template?', useAi: true })).json();
    assert.match(admin.message, /can open New Template.*does not confirm permission to generate/s);
    const generate = await (await post(routerFor({ id: 3, role: 'super_admin' }),
        { question: 'Can I generate place versions from a template?', useAi: true })).json();
    assert.match(generate.message, /particular template and each selected host Place.*server checks/s);
    const partnerStaff = await (await post(routerFor({ id: 7, role: 'standard', partnerStaffAccess: [
        { organizationId: 3, legacyPartnerUserId: 20, staffRole: 'editor', subregionIds: [4] },
    ] }), { question: 'Can I create an Offering template?', useAi: true })).json();
    assert.match(partnerStaff.message, /can open New Template/);
    const guest = await (await post(routerFor(null), { question: 'Can I create an Offering template?', useAi: true })).json();
    assert.match(guest.message, /Sign in to check/);
    const userView = await (await post(routerFor({ ...actor, isImpersonating: true }),
        { question: 'Can I create an Offering template?', useAi: true })).json();
    assert.match(userView.message, /Exit User View/);
    const howTo = await (await post(routerFor(actor), { question: 'How do I create an Offering template?', useAi: true })).json();
    assert.equal(howTo.topicId, 'offering-template-overview');
    assert.equal(howTo.answerSource, 'reviewed');
    const askGuide = await (await post(routerFor(actor),
        { question: 'Can you make a reusable service template for my Places?', useAi: true })).json();
    assert.equal(askGuide.topicId, 'offering-template-overview');
    assert.match(askGuide.message, /Guide’s direct Create action.*not a template/s);
    const list = await (await post(routerFor({ id: 3, role: 'super_admin' }, { templates: async () => ({
        totalCount: 2, names: ['Shared Care Template', 'Another Template'],
    }) }),
        { question: 'Which templates can I edit?', useAi: true })).json();
    assert.equal(list.topicId, 'template-access');
    assert.match(list.message, /can manage 2 Offering templates: Shared Care Template; Another Template/);
    assert.doesNotMatch(JSON.stringify(list), /partnerId|description|hostHardAssetId/);
    const workbook = await (await post(routerFor({ id: 3, role: 'super_admin' }),
        { question: 'Can I upload an Offering Templates workbook?', useAi: true })).json();
    assert.equal(workbook.topicId, 'workbook-access');
    const download = await (await post(routerFor({ id: 3, role: 'super_admin' }),
        { question: 'Can I download the Offering Templates workbook?', useAi: true })).json();
    assert.equal(download.topicId, 'workbook-access');
    assert.match(download.message, /Downloading does not import or create anything/);
    const howDownload = await (await post(routerFor(actor),
        { question: 'How do I download the Offering Templates workbook?', useAi: true })).json();
    assert.equal(howDownload.topicId, 'help-access');
    assert.equal(howDownload.answerSource, 'reviewed');
    assert.deepEqual(howDownload.sources, []);
    const permittedHowDownload = await (await post(routerFor({ id: 3, role: 'super_admin' }),
        { question: 'How do I download the Offering Templates workbook?', useAi: true })).json();
    assert.equal(permittedHowDownload.topicId, 'asset-workbook-import');
    assert.ok(permittedHowDownload.sources.some(source => source.id === 'asset-workbook-import'));
    assert.deepEqual(safeGuideChatTurns([{ question: 'Can I create an Offering template?', answer: admin.message }]), []);
});

test('Guide joins managed Places and scoped templates without loading denied template data', async () => {
    let templateLoads = 0;
    const options = {
        managed: async () => [
            { type: 'hard', totalCount: 1, names: ['Assigned Centre'] },
            { type: 'soft', totalCount: 0, names: [] },
            { type: 'group', totalCount: 0, names: [] },
        ],
        templates: async () => { templateLoads++; return { totalCount: 1, names: ['Scoped Template'] }; },
    };
    const question = 'Which Places and templates can I manage?';
    const admin = await (await post(routerFor({ id: 3, role: 'super_admin' }, options),
        { question, useAi: true })).json();
    assert.equal(admin.answerSource, 'account');
    assert.match(admin.message, /Assigned Centre[\s\S]*Scoped Template/);
    assert.equal(templateLoads, 1);
    const staff = await (await post(routerFor(actor, options), { question, useAi: true })).json();
    assert.match(staff.message, /Assigned Centre[\s\S]*does not currently have access to create or manage Offering templates/);
    assert.doesNotMatch(staff.message, /Scoped Template/);
    assert.equal(templateLoads, 1);
    const userView = await (await post(routerFor({ ...actor, isImpersonating: true }, options),
        { question, useAi: true })).json();
    assert.match(userView.message, /Exit User View/);
    assert.doesNotMatch(userView.message, /Assigned Centre|Scoped Template/);
    assert.equal(templateLoads, 1);
    assert.deepEqual(safeGuideChatTurns([{ question, answer: admin.message }]), []);
});

test('Guide answers mixed privacy, permissions and live-data questions without partial advice', async () => {
    assert.equal(guideCompositeIntent('Can a Group Admin add members?'), null);
    const cases = [
        ['Can my colleague see my private saved resources if I publish a Shared Map?', /does not expose your whole saved list/, /Use the heart/],
        ["Can you list my colleague's templates?", /cannot list a colleague’s Offering templates/, /choose New Template/],
        ['Can you tell me whether Jane is a Group Admin?', /cannot check another person’s Group Admin role/, /Which task did you mean/],
        ['Can you show whether another user is an Organisation Admin?', /cannot check another person’s Organisation Admin role/, /Organisation Staff can view/],
        ['Can you create a Resource Group and add people as members?', /people are not added as its members.*Org Groups and Region Groups.*Guide cannot create either Group/s, /add eligible Places as members/],
        ['Do people need accounts to belong to my Resource Group?', /people are not added as its members/, /A Resource Group can include an eligible public/],
        ['How do I get a Malay version of my Programme?', /Language selector.*provider listing may still have missing.*Edit → Translate.*Guide cannot translate/s, /The app offers English/],
        ['I have Region Admin access; can I edit all Places in my Region and all Offering templates?', /does not let someone edit every Place.*particular template/s, /can open New Template/],
        ['Can I archive an Org Group and still see its members?', /cannot archive it in chat or verify that its members will remain visible/, /choose an eligible user/],
        ['Can I import a workbook and have the Guide publish the new services?', /cannot publish services created or updated by an import/, /This is separate from the Guide’s reviewed Programme/],
        ['Does adding a Programme to My Plans book me a seat or let me edit it?', /does not book or reserve a seat.*does not grant permission to edit/s, /Do you mean changing your own planned session/],
        ['Can you tell me which saved resource has vacancies today?', /cannot determine which of your saved resources has a vacancy today/, /Most recently saved/],
    ];
    for (const [question, expected, wrong] of cases) {
        const result = await (await post(routerFor(actor), { question, useAi: true })).json();
        assert.equal(result.topicId, 'composite-guidance', question);
        assert.match(result.message, expected, question);
        assert.doesNotMatch(result.message, wrong, question);
        assert.ok(result.sources?.length && result.sources.every((item) => item.id && item.route && item.reviewed), question);
        if (/private saved resources|saved resource has vacancies/.test(question)) {
            assert.deepEqual(result.actions, [{ label: 'Open My Directory', route: '/my-directory?section=saved-assets' }]);
        }
    }
});

test('Guide checks Audit Trail access without reading or sending audit records to AI', async () => {
    assert.equal(guideAuditAccessIntent('Can I open Audit Trail?'), true);
    assert.equal(guideAuditAccessIntent('Where is Audit Trail?'), false);
    assert.equal(guideAuditAccessIntent('Can Audit Trail show who saved my listing?'), false);
    let loads = 0;
    const scope = (mode) => async () => { loads++; return { mode, organizationIds: mode === 'organizations' ? [11] : [] }; };
    const all = await (await post(routerFor({ id: 3, role: 'super_admin' }, { auditAccess: scope('all') }),
        { question: 'Can I open Audit Trail?', useAi: true })).json();
    assert.equal(all.answerSource, 'account');
    assert.match(all.message, /can open Audit Trail across CareAround SG/);
    assert.deepEqual(all.actions, [{ label: 'Open Audit Trail', route: '/dashboard/audit' }]);
    const organization = await (await post(routerFor(actor, { auditAccess: scope('organizations') }),
        { question: 'Do I have access to audit logs?', useAi: true })).json();
    assert.match(organization.message, /active admin access.*server limits the records/s);
    assert.equal(organization.organizationIds, undefined);
    assert.doesNotMatch(organization.message, /\b11\b|audit entries?:/);
    const none = await (await post(routerFor(actor, { auditAccess: scope('none') }),
        { question: 'Can I see Audit Trail?', useAi: true })).json();
    assert.match(none.message, /not currently available.*Place staff or Region Admin title alone/s);
    assert.equal(none.actions[0].route, '/dashboard');
    const guest = await (await post(routerFor(null, { auditAccess: scope('all') }),
        { question: 'Can I open Audit Trail?', useAi: true })).json();
    assert.match(guest.message, /Sign in/);
    const userView = await (await post(routerFor({ ...actor, isImpersonating: true }, { auditAccess: scope('all') }),
        { question: 'Can I open Audit Trail?', useAi: true })).json();
    assert.match(userView.message, /Exit User View/);
    assert.equal(loads, 3);
    assert.deepEqual(safeGuideChatTurns([{ question: 'Can I open Audit Trail?', answer: organization.message }]), []);
    assert.equal(answerGuideAuditAccess(actor, { mode: 'none' }).answerSource, 'account');
    const failed = await post(routerFor(actor, { auditAccess: async () => { throw new Error('No database'); } }),
        { question: 'Can I open Audit Trail?', useAi: true });
    assert.equal(failed.status, 503);
    assert.match((await failed.json()).error, /No permission has been inferred/);
});

test('Guide checks current organisation access without reading or sending organisation records to AI', async () => {
    assert.equal(guideOrganizationAccessIntent('Can I open Organisation Workspace?'), true);
    assert.equal(guideOrganizationAccessIntent('Can I manage organisations?'), true);
    assert.equal(guideOrganizationAccessIntent('How does Organisation Workspace work?'), false);
    assert.equal(guideOrganizationAccessIntent('Can I create an organisation?'), false);
    assert.equal(guideOrganizationAccessIntent('Can I manage my organisation’s Programme?'), false);
    let loads = 0;
    const access = (scope) => async () => { loads++; return scope; };
    const admin = await (await post(routerFor({ id: 3, role: 'super_admin' }, {
        organizationAccess: access({ platformAdmin: true, workspaceAdmin: false, workspaceView: false }),
    }), { question: 'Can I manage organisations?', useAi: true })).json();
    assert.equal(admin.answerSource, 'account');
    assert.match(admin.message, /Super Admin.*Admin.*Organisations/s);
    assert.deepEqual(admin.actions, [{ label: 'Open Admin', route: '/dashboard/admin' }]);
    const orgAdmin = await (await post(routerFor(actor, {
        organizationAccess: access({ platformAdmin: false, workspaceAdmin: true, workspaceView: true }),
    }), { question: 'Can I open Organisation Workspace?', useAi: true })).json();
    assert.match(orgAdmin.message, /active Organisation Admin.*server/s);
    assert.equal(orgAdmin.actions[0].route, '/dashboard/organization');
    assert.equal(orgAdmin.organizationIds, undefined);
    const staff = await (await post(routerFor(actor, {
        organizationAccess: access({ platformAdmin: false, workspaceAdmin: false, workspaceView: true }),
    }), { question: 'Do I have organisation access?', useAi: true })).json();
    assert.match(staff.message, /Organisation Staff access.*read-only/s);
    const none = await (await post(routerFor(actor, {
        organizationAccess: access({ platformAdmin: false, workspaceAdmin: false, workspaceView: false }),
    }), { question: 'Can I open Organisation Workspace?', useAi: true })).json();
    assert.match(none.message, /not currently available.*active organisation access/s);
    const guest = await (await post(routerFor(null, { organizationAccess: access({ platformAdmin: true }) }),
        { question: 'Can I open Organisation Workspace?', useAi: true })).json();
    assert.match(guest.message, /Sign in/);
    const userView = await (await post(routerFor({ ...actor, isImpersonating: true }, {
        organizationAccess: access({ platformAdmin: true }),
    }), { question: 'Can I open Organisation Workspace?', useAi: true })).json();
    assert.match(userView.message, /Exit User View/);
    assert.equal(loads, 4);
    assert.deepEqual(safeGuideChatTurns([{ question: 'Can I open Organisation Workspace?', answer: orgAdmin.message }]), []);
    assert.equal(answerGuideOrganizationAccess(actor, { platformAdmin: false, workspaceAdmin: false, workspaceView: false }).answerSource, 'account');
    const failed = await post(routerFor(actor, { organizationAccess: async () => { throw new Error('No database'); } }),
        { question: 'Can I open Organisation Workspace?', useAi: true });
    assert.equal(failed.status, 503);
    assert.match((await failed.json()).error, /No permission has been inferred/);
});

test('Guide checks governance-group creation scope without treating it as public Resource Group access', async () => {
    assert.equal(guideGovernanceGroupCreationIntent('Can I create an Org Group?'), 'org');
    assert.equal(guideGovernanceGroupCreationIntent('Can I create a Region Group?'), 'region');
    assert.equal(guideGovernanceGroupCreationIntent('Can I create a governance group?'), 'unspecified');
    assert.equal(guideGovernanceGroupCreationIntent('Can I create a Resource Group?'), null);
    assert.equal(guideGovernanceGroupCreationIntent('How do I edit an Org Group?'), null);
    assert.equal(guideGovernanceGroupCreationIntent('Can I add a member to an Org Group?'), null);
    let loads = 0;
    const access = (scope) => async () => { loads++; return scope; };
    const orgAdmin = { platformAdmin: false, workspaceAdmin: true, workspaceView: true };
    const staff = { platformAdmin: false, workspaceAdmin: false, workspaceView: true };
    const platformAdmin = { platformAdmin: true, workspaceAdmin: false, workspaceView: false };
    const org = await (await post(routerFor(actor, { organizationAccess: access(orgAdmin) }),
        { question: 'Can I create an Org Group?', useAi: true })).json();
    assert.equal(org.topicId, 'governance-group-access');
    assert.equal(org.answerSource, 'account');
    assert.match(org.message, /active Organisation Admin.*server checks the selected organisation/s);
    assert.equal(org.actions[0].route, '/dashboard/organization');
    const regionDenied = await (await post(routerFor(actor, { organizationAccess: access(orgAdmin) }),
        { question: 'Can I create a Region Group?', useAi: true })).json();
    assert.match(regionDenied.message, /cannot create a Region Group.*Super Admin/s);
    const both = await (await post(routerFor({ id: 3, role: 'super_admin' }, { organizationAccess: access(platformAdmin) }),
        { question: 'Can I create a governance group?', useAi: true })).json();
    assert.match(both.message, /create Org Groups.*Region Groups/s);
    assert.equal(both.actions[0].route, '/dashboard/admin');
    const staffDenied = await (await post(routerFor(actor, { organizationAccess: access(staff) }),
        { question: 'Can I create an Org Group?', useAi: true })).json();
    assert.match(staffDenied.message, /cannot currently create an Org Group.*Organisation Staff can view/s);
    const guest = await (await post(routerFor(null, { organizationAccess: access(platformAdmin) }),
        { question: 'Can I create a governance group?', useAi: true })).json();
    assert.match(guest.message, /Sign in/);
    const userView = await (await post(routerFor({ ...actor, isImpersonating: true }, { organizationAccess: access(platformAdmin) }),
        { question: 'Can I create a governance group?', useAi: true })).json();
    assert.match(userView.message, /Exit User View/);
    assert.equal(loads, 4);
    assert.deepEqual(safeGuideChatTurns([{ question: 'Can I create an Org Group?', answer: org.message }]), []);
    const failed = await post(routerFor(actor, { organizationAccess: async () => { throw new Error('No database'); } }),
        { question: 'Can I create an Org Group?', useAi: true });
    assert.equal(failed.status, 503);
    assert.match((await failed.json()).error, /No permission has been inferred/);
});

test('Guide separates account management questions from saved resources and public search', () => {
    assert.equal(guideManagedResourceIntent('what are the resources I manage?'), 'list');
    assert.equal(guideManagedResourceIntent('where do I see if I manage any resources?'), 'navigation');
    assert.equal(guideManagedResourceIntent('show me resources I manage'), 'list');
    assert.equal(guideManagedResourceIntent('How many resources do I manage?'), 'list');
    assert.equal(guideManagedResourceIntent('How do I change the phone number on a programme I manage?'), null);
    assert.equal(guideManagedResourceIntent('How do I update the contact email on a Place I manage?'), null);
    assert.equal(guideManagedResourceIntent('What Resource Groups do I manage?'), 'groups');
    assert.equal(guideManagedResourceIntent('What governance groups do I manage?'), null);
    assert.equal(guideManagedResourceIntent('How do I save resources?'), null);
    assert.equal(guideManagedResourceIntent('How do I add a Programme to a Place I manage?'), null);
    assert.equal(isGuideResourceAccessQuestion('How do I add a new Place?'), true);
    assert.equal(isGuideResourceAccessQuestion('How do I add a Programme to a Place I manage?'), true);
    assert.deepEqual(safeGuideChatTurns([{ question: 'What resources do I manage?', answer: 'Private Place' }]), []);
    assert.deepEqual(safeGuideChatTurns([{ question: 'Can providers see how many people saved their listing?', answer: 'No verified provider report.' }]), []);
});

test('Guide keeps export and one-map removal outside saved-list and public-listing account reads', async () => {
    assert.equal(guideSavedResourceIntent('Can I download every resource I have saved?'), null);
    assert.equal(guideLifecycleAccessIntent('Can I remove a resource from one map without unsaving it?'), null);
    let savedLoads = 0;
    const router = routerFor(actor, { saved: async () => { savedLoads++; throw new Error('Export is not a list read.'); } });
    const exported = await (await post(router, { question: 'Can I download every resource I have saved?', useAi: true })).json();
    assert.equal(exported.topicId, 'directory-export-boundary');
    assert.equal(exported.answerSource, 'reviewed');
    assert.match(exported.message, /cannot verify a one-click export.*not your whole saved list/s);
    const map = await (await post(router, { question: 'Can I remove a resource from one map without unsaving it?', useAi: true })).json();
    assert.equal(map.topicId, 'my-map-resource-removal');
    assert.equal(map.answerSource, 'reviewed');
    assert.match(map.message, /does not unsave.*My Directory/s);
    assert.equal(savedLoads, 0);
});

test('Guide will not read a colleague’s saved list and offers exact-listing edit checks', async () => {
    assert.equal(guideSavedResourceIntent('What resources did my colleague save?'), null);
    assert.equal(guideSavedResourceIntent('What is in my colleague’s saved list?'), null);
    assert.equal(guideSavedResourceIntent('Can I see which people saved my Programme?'), null);
    assert.equal(guideLifecycleAccessIntent('Can you tell me which resources I can edit?'), 'edit');
    let savedLoads = 0;
    const router = routerFor(actor, { saved: async () => { savedLoads++; throw new Error('Another account must not be read.'); } });
    const colleague = await (await post(router, { question: 'What resources did my colleague save?', useAi: true })).json();
    assert.equal(colleague.answerSource, 'reviewed');
    assert.equal(colleague.topicId, 'other-account-saved-privacy');
    assert.match(colleague.message, /signed-in account.*cannot show a colleague’s saved list/s);
    const possessive = await (await post(router, { question: 'What is in my colleague’s saved list?', useAi: true })).json();
    assert.equal(possessive.topicId, 'other-account-saved-privacy');
    const provider = await (await post(router, { question: 'Can I see which people saved my Programme?', useAi: true })).json();
    assert.equal(provider.answerSource, 'reviewed');
    assert.equal(provider.topicId, 'provider-usage-boundary');
    assert.match(provider.message, /cannot.*identify those people/s);
    const edit = await (await post(router, { question: 'Can you tell me which resources I can edit?', useAi: true })).json();
    assert.equal(edit.answerSource, 'account');
    assert.equal(edit.topicId, 'lifecycle-access');
    assert.equal(edit.canCheckManagedListing, true);
    assert.match(edit.message, /exact managed listing.*current edit/s);
    assert.equal(savedLoads, 0);
});

test('Guide creation how-to checks the actor instead of listing managed names or asking AI', async () => {
    let managedLoads = 0;
    const options = { managed: async () => { managedLoads++; throw new Error('Creation advice must not load managed names.'); } };
    const staff = routerFor(actor, options);
    const programme = await (await post(staff, { question: 'How do I add a Programme to a Place I manage?', useAi: true })).json();
    assert.equal(programme.answerSource, 'account');
    assert.equal(programme.topicId, 'resource-access');
    assert.match(programme.message, /Ask the Guide to create a Programme\/service.*review the draft.*Create/is);
    assert.doesNotMatch(programme.message, /Neighbourhood Centre|cannot create a new Place\./);
    const place = await (await post(staff, { question: 'How do I add a new Place?', useAi: true })).json();
    assert.equal(place.answerSource, 'account');
    assert.match(place.message, /cannot create a new Place/);
    const admin = await (await post(routerFor({ id: 2, role: 'super_admin' }, options),
        { question: 'How do I add a new Place?', useAi: true })).json();
    assert.match(admin.message, /open New Place in Manage My Resources/);
    const guest = await (await post(routerFor({ role: 'guest' }, options),
        { question: 'How do I add a new Place?', useAi: true })).json();
    assert.match(guest.message, /Sign in to check/);
    assert.equal(managedLoads, 0);
});

test('Guide reads the existing managed scope with the authenticated actor and exposes only names and totals', async () => {
    const seen = [];
    const handler = (type) => (c) => {
        seen.push({ type, user: c.get('user'), params: c.req.query() });
        return c.json({ data: [{ id: 91, name: type === 'hard' ? 'Neighbourhood Centre'
            : c.req.query('assetMode') === 'group' ? 'Community Group' : 'Weekly Gathering',
            privateNote: 'do not expose', permissions: { edit: true } }],
        pagination: { totalCount: 1 } });
    };
    const managed = createGuideManagedResourceLoader({ hard: handler('hard'), soft: handler('soft') });
    const result = await managed(actor, env);
    assert.deepEqual(result, [
        { type: 'hard', totalCount: 1, names: ['Neighbourhood Centre'] },
        { type: 'soft', totalCount: 1, names: ['Weekly Gathering'] },
        { type: 'group', totalCount: 1, names: ['Community Group'] },
    ]);
    assert.equal(seen.length, 3);
    for (const call of seen) {
        assert.equal(call.user, actor);
        assert.equal(call.params.scope, 'managed');
        assert.equal(call.params.summary, 'true');
        assert.equal(call.params.pageSize, '5');
    }
    assert.equal(seen.find((call) => call.type === 'soft').params.assetMode, 'offerings');
    assert.ok(seen.some((call) => call.params.assetMode === 'group'));
    assert.doesNotMatch(JSON.stringify(result), /privateNote|do not expose|permissions|id/);
});

test('Guide selected-listing lookup reuses current managed permissions and strips private fields', async () => {
    const seen = [];
    const handler = (type) => (c) => {
        seen.push({ type, actor: c.get('user'), params: c.req.query() });
        const group = c.req.query('assetMode') === 'group';
        return c.json({ data: [{ id: type === 'hard' ? 91 : group ? 93 : 92,
            name: type === 'hard' ? 'Neighbourhood Centre' : group ? 'Neighbourhood Group' : 'Weekly Gathering',
            privateNote: 'never reveal this', permissions: { canEdit: true, canHide: false, canDelete: false, canManageAccess: true } }],
        pagination: { totalCount: 1 } });
    };
    const managedAccess = createGuideManagedAccessLoader({ hard: handler('hard'), soft: handler('soft') });
    const result = await managedAccess(actor, 'Neighbourhood', env);
    assert.deepEqual(result, { resources: [
        { id: 91, type: 'hard', name: 'Neighbourhood Centre', permissions: { canEdit: true, canHide: false, canDelete: false } },
        { id: 92, type: 'soft', name: 'Weekly Gathering', permissions: { canEdit: true, canHide: false, canDelete: false } },
        { id: 93, type: 'group', name: 'Neighbourhood Group', permissions: { canEdit: true, canHide: false, canDelete: false } },
    ], hasMore: false });
    assert.doesNotMatch(JSON.stringify(result), /privateNote|never reveal|canManageAccess/);
    assert.equal(seen.length, 3);
    for (const call of seen) {
        assert.equal(call.actor, actor);
        assert.equal(call.params.scope, 'managed');
        assert.equal(call.params.summary, 'true');
        assert.equal(call.params.q, 'Neighbourhood');
        assert.equal(call.params.pageSize, '10');
    }
    assert.equal(seen[1].params.assetMode, 'offerings');
    assert.equal(seen[2].params.assetMode, 'group');
    await assert.rejects(managedAccess({ ...actor, isImpersonating: true }, 'Neighbourhood', env));
    await assert.rejects(managedAccess({ id: 5, role: 'standard' }, 'Neighbourhood', env));
});

test('Guide managed-access endpoint rejects unscoped actors and does not consult AI', async () => {
    let loads = 0;
    const lookup = async () => { loads++; return { resources: [], hasMore: false }; };
    const ask = (user, query) => routerFor(user, { managedAccess: lookup }).request(`/managed-access?${new URLSearchParams({ q: query })}`, {}, env);
    assert.equal((await ask(actor, 'x')).status, 400);
    assert.equal((await ask(null, 'Centre')).status, 403);
    assert.equal((await ask({ ...actor, isImpersonating: true }, 'Centre')).status, 403);
    const noScope = await ask({ id: 5, role: 'standard' }, 'Centre');
    assert.deepEqual(await noScope.json(), { resources: [], hasMore: false, canManage: false });
    assert.equal(loads, 0);
    const scoped = await ask(actor, 'Centre');
    assert.equal(scoped.status, 200);
    assert.equal(loads, 1);
    assert.equal(scoped.headers.get('Cache-Control'), 'no-store');
});

test('Guide answers managed resources from account data without calling AI or public search', async () => {
    let loads = 0;
    let searches = 0;
    const router = routerFor(actor, {
        managed: async () => { loads++; return [
            { type: 'hard', totalCount: 1, names: ['Neighbourhood Centre'] },
            { type: 'soft', totalCount: 0, names: [] },
            { type: 'group', totalCount: 1, names: ['Community Group'] },
        ]; },
        search: async () => { searches++; throw new Error('wrong search'); },
    });
    const list = await (await post(router, { question: 'What are the resources I manage?', useAi: true })).json();
    assert.equal(list.answerSource, 'account');
    assert.match(list.message, /1 Place.*Neighbourhood Centre.*Manage My Resources/s);
    assert.match(list.message, /1 Resource Group.*Community Group/s);
    assert.doesNotMatch(list.message, /My Directory.*manage/i);
    assert.deepEqual(list.actions, [{ label: 'Open Manage My Resources', route: '/dashboard/resources' }]);
    const where = await (await post(router, { question: 'Where do I see if I manage any resources?', useAi: true })).json();
    assert.match(where.message, /Manage My Resources.*My Directory/s);
    assert.equal(loads, 1);
    assert.equal(searches, 0);
    const groupOnly = await (await post(router, { question: 'What Resource Groups do I manage?', useAi: true })).json();
    assert.equal(groupOnly.answerSource, 'account');
    assert.match(groupOnly.message, /1 Resource Group: Community Group/);
    assert.doesNotMatch(groupOnly.message, /Neighbourhood Centre/);
    assert.equal(loads, 2);
});

test('Guide answers compound Group, workbook and plan questions without misleading single-topic replies', async () => {
    const router = routerFor(actor, { managed: async () => [
        { type: 'hard', totalCount: 1, names: ['Neighbourhood Centre'] },
        { type: 'soft', totalCount: 0, names: [] },
        { type: 'group', totalCount: 1, names: ['Community Group'] },
    ] });
    const cases = [
        ['Can I create a Resource Group and add a Place I do not manage?', /cannot create a new Resource Group.*does not need to be assigned to you personally/s, /choose the exact managed Group/i],
        ['Can I hide a Group without hiding the Places in it?', /Group listing, not the visibility of its member Places.*exact managed Group/s, /Place or Offering.*particular/s],
        ['Can I create a Programme at my assigned Place and import it with a workbook?', /prepare a Programme\/service at a Place it manages.*workbook-import screen is not available/s, /Group listing/],
        ['If I remove a saved Programme from My Directory, will it cancel My Plans?', /does not itself remove a personal session already in My Plans.*saved schedule may stop appearing/s, /map membership/i],
        ['Can I share my private My Place on a public Group?', /private My Place.*cannot be selected as a member of a public Resource Group/s, /public directory matches/],
        ['Can I put a private location in a public resource collection?', /private My Place.*cannot be selected as a member of a public Resource Group.*excluded from a published Shared Map/s, /governance coordination group/],
        ['Can I add a hidden Place to a Group and publish it?', /hidden Place is not eligible.*does not publish or unhide/s, /This account can open New Place/],
        ['Does a Group I manage appear in Discover?', /does not mean it automatically appears in Discover.*owner.*public members/s, /Resource Group: Community Group/],
    ];
    for (const [question, expected, wrong] of cases) {
        const response = await (await post(router, { question, useAi: true })).json();
        assert.equal(response.topicId, 'composite-guidance', question);
        assert.match(response.message, expected, question);
        assert.doesNotMatch(response.message, wrong, question);
        if (question === 'Can I create a Programme at my assigned Place and import it with a workbook?') {
            // The checked account denial remains; inaccessible instructions are not cited.
            assert.deepEqual(response.sources, []);
            assert.equal(response.answerSource, 'account');
        } else assert.ok(response.sources?.length > 0 && response.sources.every((source) => source.reviewed && source.route), question);
    }
    const list = await (await post(router, { question: 'What Resource Groups do I manage, and can I delete them?', useAi: true })).json();
    assert.equal(list.answerSource, 'account');
    assert.match(list.message, /Community Group.*does not prove you can edit, hide or delete it/s);
    assert.equal(list.canCheckManagedListing, true);
    const where = await (await post(router, { question: 'Where do I see Resource Groups I manage?', useAi: true })).json();
    assert.equal(where.answerSource, 'account');
    assert.match(where.message, /Manage My Resources.*Groups/);
});

test('Guide combines owner-saved and managed scopes without treating saving as permission', async () => {
    let savedLoads = 0;
    let managedLoads = 0;
    const router = routerFor(actor, {
        saved: async () => { savedLoads++; return { totalCount: 1, placeCount: 1, offeringCount: 0,
            names: [{ name: 'Saved Centre', unavailable: false }] }; },
        managed: async () => { managedLoads++; return [
            { type: 'hard', totalCount: 1, names: ['Assigned Centre'] },
            { type: 'soft', totalCount: 0, names: [] },
            { type: 'group', totalCount: 0, names: [] },
        ]; },
    });
    const answer = await (await post(router, { question: 'What resources have I saved, and which can I manage?', useAi: true })).json();
    assert.equal(answer.answerSource, 'account');
    assert.match(answer.message, /Saved Centre.*Assigned Centre/s);
    assert.match(answer.message, /saved, not necessarily resources you manage/);
    assert.equal(savedLoads, 1);
    assert.equal(managedLoads, 1);
    assert.deepEqual(safeGuideChatTurns([{ question: 'What resources have I saved, and which can I manage?', answer: answer.message }]), []);
});

test('Guide refuses managed names to guests, User View and accounts without management access', async () => {
    let loads = 0;
    for (const [user, expected] of [
        [null, /Sign in/],
        [{ ...actor, isImpersonating: true }, /Exit User View/],
        [{ id: 5, role: 'standard' }, /does not currently have access/],
    ]) {
        const response = await (await post(routerFor(user, { managed: async () => { loads++; return []; } }),
            { question: 'What resources do I manage?', useAi: true })).json();
        assert.match(response.message, expected);
        assert.doesNotMatch(JSON.stringify(response), /Neighbourhood Centre/);
    }
    assert.equal(loads, 0);
});

test('Guide recognizes My Directory navigation and current page without asking AI', async () => {
    const router = routerFor(actor);
    const here = await (await post(router, { question: 'How do I go to My Directory?', pageContext: 'My Directory', useAi: true })).json();
    assert.match(here.message, /already on My Directory/);
    assert.deepEqual(here.actions, [{ label: 'Open My Directory', route: '/my-directory' }]);
    const elsewhere = await (await post(router, { question: 'Where is My Directory?', pageContext: 'Discover', useAi: true })).json();
    assert.match(elsewhere.message, /Open My Directory from the dashboard/);
    assert.deepEqual(elsewhere.actions, [{ label: 'Open My Directory', route: '/my-directory' }]);
    const saved = await (await post(router, { question: 'Where do I see my saved resources?', useAi: true })).json();
    assert.match(saved.message, /My Directory → Saved Resources/);
    assert.deepEqual(saved.actions, [{ label: 'Open My Directory', route: '/my-directory?section=saved-assets' }]);
    assert.equal((await post(router, { question: 'Where is My Directory?', pageContext: '/private/id' })).status, 400);
});

test('Guide distinguishes saved-resource questions from how-to and map questions', () => {
    assert.equal(guideSavedResourceIntent('What resources have I saved?'), 'list');
    assert.equal(guideSavedResourceIntent('Show me my saved resources'), 'list');
    assert.equal(guideSavedResourceIntent('Where do I see my saved resources?'), 'navigation');
    assert.equal(guideSavedResourceIntent('How do I save resources?'), null);
    assert.equal(guideSavedResourceIntent('What are my saved maps?'), null);
    assert.deepEqual(safeGuideChatTurns([{ question: 'What resources have I saved?', answer: 'A private resource' }]), []);
});

test('Guide saved-resource loader reuses the current account endpoint and strips private fields', async () => {
    let seenActor;
    const saved = createGuideSavedResourceLoader({ list: (c) => {
        seenActor = c.get('user');
        return c.json([
            { name: 'Saved Centre', resourceType: 'hard', status: 'available', userId: 4, privateNote: 'secret' },
            { name: 'Closed Programme', resourceType: 'soft', status: 'unavailable', userId: 4 },
        ]);
    } });
    const result = await saved(actor, env);
    assert.equal(seenActor, actor);
    assert.deepEqual(result, { totalCount: 2, placeCount: 1, offeringCount: 1, names: [
        { name: 'Saved Centre', unavailable: false },
        { name: 'Closed Programme', unavailable: true },
    ] });
    assert.doesNotMatch(JSON.stringify(result), /userId|privateNote|secret/);
    await assert.rejects(saved(null, env));
    await assert.rejects(saved({ ...actor, isImpersonating: true }, env));
});

test('Guide reads saved resources only for the signed-in account and never sends them to AI', async () => {
    let loads = 0;
    const saved = async () => { loads++; return { totalCount: 2, placeCount: 1, offeringCount: 1, names: [
        { name: 'Saved Centre', unavailable: false },
        { name: 'Closed Programme', unavailable: true },
    ] }; };
    const response = await (await post(routerFor(actor, { saved }),
        { question: 'What resources have I saved?', useAi: true })).json();
    assert.equal(response.answerSource, 'account');
    assert.match(response.message, /Saved Centre.*Closed Programme \(no longer available\)/s);
    assert.match(response.message, /saved, not necessarily resources you manage/);
    assert.match(response.message, /My Directory → Saved Resources/);
    assert.deepEqual(response.actions, [{ label: 'Open My Directory', route: '/my-directory?section=saved-assets' }]);
    assert.equal(loads, 1);
    for (const [user, expected] of [
        [null, /Sign in/],
        [{ ...actor, isImpersonating: true }, /Exit User View/],
    ]) {
        const denied = await (await post(routerFor(user, { saved }),
            { question: 'What resources have I saved?', useAi: true })).json();
        assert.match(denied.message, expected);
        assert.doesNotMatch(JSON.stringify(denied), /Saved Centre/);
        assert.equal(denied.actions.some(({ route }) => route === '/my-directory?section=saved-assets'), false);
    }
    assert.equal(loads, 1);
});

test('Guide keeps private My Places separate from saved and managed public resources', () => {
    assert.equal(guidePersonalPlaceIntent('What personal places have I created?'), 'list');
    assert.equal(guidePersonalPlaceIntent('Show my personal places'), 'list');
    assert.equal(guidePersonalPlaceIntent('Where do I find My Places?'), 'navigation');
    assert.equal(guidePersonalPlaceIntent('What is My Places?'), null);
    assert.equal(isGuideResourceAccessQuestion('Can I create a personal place?'), false);
    assert.equal(isGuideResourceAccessQuestion('Can I create a public Place?'), true);
    assert.equal(guideManagedResourceIntent('Which personal places do I manage?'), null);
    assert.equal(guideSavedResourceIntent('What personal places have I saved?'), null);
    assert.deepEqual(safeGuideChatTurns([{ question: 'What personal places have I created?', answer: 'Private Home' }]), []);
});

test('Guide projects only owner-scoped personal-place names and never sends them to AI', async () => {
    let seenActor;
    const personalPlaces = createGuidePersonalPlaceLoader({ list: async (user) => {
        seenActor = user;
        return [{ name: 'Private Home', id: 71, address: 'Private address' }, { name: 'Neighbourhood pickup', id: 72 }];
    } });
    const projected = await personalPlaces(actor, env);
    assert.equal(seenActor, actor);
    assert.deepEqual(projected, { totalCount: 2, names: ['Private Home', 'Neighbourhood pickup'] });
    assert.doesNotMatch(JSON.stringify(projected), /Private address|"id"|71|72/);

    let loads = 0;
    const router = routerFor(actor, { personalPlaces: async (user) => {
        loads++;
        assert.equal(user.id, 4);
        return projected;
    } });
    const list = await (await post(router, { question: 'What personal places have I created?', useAi: true })).json();
    assert.equal(list.answerSource, 'account');
    assert.match(list.message, /Private Home.*Neighbourhood pickup.*private planning locations/s);
    assert.deepEqual(list.actions, [{ label: 'Open My Places', route: '/my-directory?section=my-places' }]);
    const navigation = await (await post(router, { question: 'Where do I find My Places?', useAi: true })).json();
    assert.equal(navigation.answerSource, 'account');
    assert.match(navigation.message, /Open My Directory and choose My Places/);
    assert.equal(loads, 1);

    for (const [user, expected] of [
        [null, /Sign in/],
        [{ ...actor, isImpersonating: true }, /Exit User View/],
    ]) {
        const denied = await (await post(routerFor(user, { personalPlaces: async () => { loads++; return projected; } }),
            { question: 'What personal places have I created?', useAi: true })).json();
        assert.match(denied.message, expected);
        assert.doesNotMatch(JSON.stringify(denied), /Private Home/);
    }
    assert.equal(loads, 1);
    await assert.rejects(personalPlaces(null, env));
    await assert.rejects(personalPlaces({ ...actor, isImpersonating: true }, env));
});

test('Guide separates account plan lists from planning instructions and excludes them from AI history', () => {
    assert.equal(guidePlansIntent('What plans do I have?'), 'list');
    assert.equal(guidePlansIntent('Show my upcoming plans'), 'list');
    assert.equal(guidePlansIntent('Where do I find My Plans?'), 'navigation');
    assert.equal(guidePlansIntent('How do I add a session to My Plans?'), null);
    assert.equal(guidePlansIntent('Does my plan reserve a seat?'), null);
    assert.equal(guidePlansIntent('Can I see a list of members who added my Programme to My Plans?'), null);
    assert.deepEqual(safeGuideChatTurns([{ question: 'What plans do I have?', answer: 'Private event' }]), []);
});

test('Guide reads owner Calendar plans and projects no map-note text or private IDs', async () => {
    let seenActor;
    let seenScope;
    const plans = createGuidePlansLoader({ calendar: (c) => {
        seenActor = c.get('user');
        seenScope = c.req.query('scope');
        return c.json({ range: { from: '2026-09-29T00:00:00.000Z', to: '2026-11-28T00:00:00.000Z' },
            personalItems: [
                { id: 81, itemType: 'planned_session', title: 'Coffee Morning', startsAt: '2026-10-01T01:00:00.000Z', status: 'planned', needsReview: true, privateNote: 'hidden' },
                { id: 82, itemType: 'map_note', title: 'Private appointment details', startsAt: '2026-10-02T01:00:00.000Z', status: 'planned' },
            ], occurrences: [{ title: 'Saved but not planned' }] });
    } });
    const projected = await plans(actor, env);
    assert.equal(seenActor, actor);
    assert.equal(seenScope, 'plans');
    assert.equal(projected.totalCount, 2);
    assert.equal(projected.sessionCount, 1);
    assert.equal(projected.noteCount, 1);
    assert.deepEqual(projected.sessions, [{ title: 'Coffee Morning', startsAt: '2026-10-01T01:00:00.000Z', status: 'planned', needsReview: true }]);
    assert.doesNotMatch(JSON.stringify(projected), /Private appointment|hidden|Saved but not planned|"id"|81|82/);
    await assert.rejects(plans(null, env));
    await assert.rejects(plans({ ...actor, isImpersonating: true }, env));

    let loads = 0;
    const router = routerFor(actor, { plans: async () => { loads++; return projected; } });
    const list = await (await post(router, { question: 'What plans do I have?', useAi: true })).json();
    assert.equal(list.answerSource, 'account');
    assert.match(list.message, /2 personal plans.*Coffee Morning.*check schedule update.*not a provider booking/s);
    assert.doesNotMatch(JSON.stringify(list), /Private appointment|hidden|Saved but not planned/);
    const where = await (await post(router, { question: 'Where do I find My Plans?', useAi: true })).json();
    assert.equal(where.answerSource, 'account');
    assert.match(where.message, /Open Care Calendar and choose My Plans/);
    const provider = await (await post(router, {
        question: 'Can I see a list of members who added my Programme to My Plans?', useAi: true,
    })).json();
    assert.equal(provider.answerSource, 'reviewed');
    assert.equal(provider.topicId, 'provider-plan-privacy');
    assert.doesNotMatch(JSON.stringify(provider), /Coffee Morning|Private appointment/);
    assert.equal(loads, 1);
    for (const [user, expected] of [[null, /Sign in/], [{ ...actor, isImpersonating: true }, /Exit User View/]]) {
        const denied = await (await post(routerFor(user, { plans: async () => { loads++; return projected; } }),
            { question: 'What plans do I have?', useAi: true })).json();
        assert.match(denied.message, expected);
        assert.doesNotMatch(JSON.stringify(denied), /Coffee Morning/);
    }
    assert.equal(loads, 1);
});
