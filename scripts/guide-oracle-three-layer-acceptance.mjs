// Repeatable, local-only Oracle boundary check. Never sends a model request.
// CAREAROUND_SUPPORT_FIXTURE=true node scripts/guide-oracle-three-layer-acceptance.mjs
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { GUIDE_ORACLE_VERSION } from '../server/src/utils/guideOracleKnowledge.js';

assert.equal(process.env.CAREAROUND_SUPPORT_FIXTURE, 'true', 'Explicit fictional fixture mode is required.');
const origin = process.env.CAREAROUND_SUPPORT_FIXTURE_PORT === '8793'
    ? 'http://127.0.0.1:8793' : 'http://127.0.0.1:8792';
const checkedAt = new Date().toISOString();
const results = [];
let ip = 100;

async function request(path, { role, method = 'GET', body } = {}) {
    const response = await fetch(`${origin}${path}`, {
        method,
        headers: {
            'cf-connecting-ip': `198.51.100.${ip++}`,
            ...(role ? { Cookie: `carearound_support_fixture=${role}` } : {}),
            ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
}

async function check(layer, name, work) {
    try {
        const observation = await work();
        results.push({ layer, name, passed: true, observation });
        console.log(`PASS ${layer}: ${name}`);
    } catch (error) {
        results.push({ layer, name, passed: false, error: error.message });
        console.error(`FAIL ${layer}: ${name}: ${error.message}`);
    }
}

async function answer(role, question, { source, topic, includes = [], excludes = [], pageContext = 'CareAround', useAi = false }) {
    const response = await request('/api/guide/answer', {
        role, method: 'POST', body: { question, pageContext, useAi },
    });
    assert.equal(response.status, 200, question);
    const data = response.body;
    assert.equal(data.answerSource, source, question);
    if (topic) assert.equal(data.topicId, topic, question);
    if (source === 'simulation') assert.deepEqual(data.actions, data.sources.map((item) => ({
        label: item.route === '/help?tab=inbox' ? 'Open Updates' : 'Open Manage My Resources',
        route: item.route,
    })), `${question}: selected evidence and navigation must agree`);
    for (const pattern of includes) assert.match(data.message, pattern, question);
    for (const pattern of excludes) assert.doesNotMatch(JSON.stringify(data), pattern, question);
    if (source === 'reviewed') {
        assert.ok(data.sources?.length > 0, `${question}: missing reviewed sources`);
        assert.ok(data.sources.every((item) => item.id && item.route && item.reviewed),
            `${question}: unreviewed source`);
    }
    return { role: role || 'guest', question, source: data.answerSource, topicId: data.topicId,
        sourceIds: data.sources?.map((item) => item.id) || [] };
}

const productCases = [
    ['saving is not enrolment', 'If I save a Programme, am I registered for it?', 'verified-boundary', [/does not.*register/i]],
    ['publishing requires refresh', 'Does saving Studio changes update my published Shared Map?', 'map-studio', [/does not.*refresh/i]],
    ['private places stay out of groups', 'Can I put a private My Place in a public Resource Group?', 'composite-guidance', [/private My Place.*cannot be selected/s]],
    ['whole-directory export is unverified', 'Can I export my entire My Directory to Excel?', 'directory-export-boundary', [/cannot verify/i]],
    ['provider usage does not identify savers', 'Can providers see who saved their listing?', 'provider-usage-boundary', [/cannot.*identify/i]],
    ['programme saver identities do not become own saved list', 'Can I see which people saved my Programme?', 'provider-usage-boundary', [/cannot.*identify those people/s]],
    ['hidden Programme keeps a separate personal plan', 'If I hide my Programme, do people who planned it still see it in My Plans?', 'provider-plan-lifecycle', [/does not automatically delete.*personal plan.*current sessions/s]],
    ['unpublished sessions do not erase old plans', 'If I unpublish the sessions, are people’s existing plans deleted?', 'provider-plan-lifecycle', [/turning off.*sessions.*personal plan/s]],
    ['provider cannot read planner identities', 'Can I see who planned my Programme?', 'provider-plan-privacy', [/cannot show.*who added.*My Plans/s]],
    ['vacancy is not a confirmed seat', 'Does a displayed vacancy guarantee me a seat?', 'provider-availability', [/not a confirmed seat/i]],
    ['tomorrow availability is not live', 'Will CareAround tell me if a provider has free places tomorrow?', 'provider-availability', [/remaining-seat count is live.*contact the provider/s]],
    ['opening-hour correction uses exact Place editor', 'How do I correct a centre opening hour on its public listing?', 'place-contact-edit', [/Location.*Hours.*Guide cannot change/s]],
    ['one service across Places uses standard editor', 'Can I create one service at several Places?', 'offering-multi-host', [/multiple Host Locations.*same service area.*each linked Place.*Guide.*one Place/s]],
    ['Malay Programme text uses Translate review', 'How can I make my Programme available in Malay?', 'offering-translation-review', [/Edit → Translate.*Save review/s]],
    ['saving a Place does not add map membership', 'If I save a Place, does it appear on My Map?', 'map-membership', [/Saving a resource adds it to My Directory.*choose separately/s]],
    ['standalone Programme host change uses editor and scope checks', 'How do I move a Programme from one Place to another?', 'offering-host-change', [/standalone Programme\/service.*Host & coverage.*Host Locations.*permission for both the Offering and each new linked Place/s]],
    ['service host Place paraphrase uses the same boundary', 'How do I switch the host Place for a service?', 'offering-host-change', [/standalone Programme\/service.*Host & coverage.*Host Locations/s]],
    ['Place access is not organisation ownership transfer', 'Can I transfer a Place to another organisation?', 'place-owner-transfer-boundary', [/cannot verify a self-service control.*adding an Owner is not an organisation-ownership transfer/s]],
    ['owner change to another organisation is not staff access', 'Can I change the owner of our Place to another organisation?', 'place-owner-transfer-boundary', [/cannot verify a self-service control.*adding an Owner is not an organisation-ownership transfer/s]],
    ['saving does not auto-publish to a Shared Map', 'If I save a Place, will it appear on my Shared Map automatically?', 'saved-to-shared-map', [/not automatically.*explicitly update the shared version/s]],
    ['Resource Group has no staff-only audience', 'Can I make a Resource Group visible only to staff?', 'group-staff-visibility', [/Public or Target region\/s, not a staff-only audience/]],
    ['a visitor cannot add to the owner My Map', 'Can someone else add a Place to my private My Map?', 'shared-map-copy', [/Only the owner can add.*does not change the original map/s]],
    ['contact editor is a page workflow', 'How do I change the phone number on a programme I manage?', 'offering-contact-edit', [/Public contact.*permission/s]],
    ['map notes have individual sharing', 'Can I share one map note without sharing all notes?', 'map-note-privacy', [/for each note/i]],
    ['removing a bookmark does not delete a listing', 'Can I delete a Place from My Directory?', 'saved-resource-removal', [/does not delete the public listing/i]],
    ['volunteer title is not authority', 'Can a volunteer create a Place for our organisation?', null, [/volunteer.*not.*permission/is]],
    ['regional scope is not edit permission', 'Does a Region Admin role let me edit any Place?', null, [/not.*edit.*every Place/is]],
    ['colleague saved list stays private', 'What is in my colleague’s saved list?', 'other-account-saved-privacy', [/cannot show a colleague’s saved list/i]],
    ['Guide cannot book for a visitor', 'Can you book a seat for me in a programme?', 'provider-contact', [/cannot.*book a seat for you/i]],
    ['named eligibility is not inferred', 'Am I eligible for Havelock Restricted Activity?', 'verified-boundary', [/cannot confirm your eligibility for a particular listing/i]],
    ['live wait time is not invented', 'Can you tell me the current wait time at Havelock Demo Centre?', 'provider-wait-time', [/cannot verify.*current wait time/i]],
    ['Audit Trail how-to is sourced', 'Where is Audit Trail?', 'audit-trail', [/dashboard page.*organisation-admin access/s]],
    ['Organisation Workspace how-to is sourced', 'How does Organisation Workspace work?', 'organization-workspace', [/Staff can view.*Admin can manage/s]],
    ['governance groups differ from public groups', 'What is a governance coordination group?', 'governance-group-overview', [/separate from public Resource Groups.*Org Group.*Region Group/s]],
    ['Org Group path is sourced', 'How are Org Groups created?', 'governance-org-group', [/Organisation Workspace.*Org Groups.*New Group/s]],
    ['Region Group path is sourced', 'How are Region Groups created?', 'governance-region-group', [/Only Super Admin.*Admin.*Region Groups/s]],
    ['governance member access is separate from creation', 'How do I add a member to an Org Group?', 'governance-group-membership', [/Group access.*Org Group member.*server checks the exact group/s]],
    ['governance archive is not public Group deletion', 'Can I archive a governance group?', 'governance-group-overview', [/Archived status.*cannot archive a group/s]],
    ['Region layers do not imply operational routing', 'How do I configure Regions?', 'region-boundary-layers', [/Only Subregion postcodes route.*Replace listed subregions removes existing codes/s]],
    ['Admin Region Scope is not resource editing', 'Does Region Scope let me edit every Place?', 'admin-region-scope', [/does not grant editing of a Place.*cannot show or change another account’s assignment/s]],
    ['existing Programme translation uses editor review', 'Can the Guide translate a Programme I manage?', 'offering-translation-review', [/Guide cannot translate or edit.*Edit → Translate.*Save review/s]],
    ['Offering template creation is a separate workflow', 'How do I create an Offering template?', 'offering-template-overview', [/shared Programme\/service content.*starts hidden/s]],
    ['template edits preserve local overrides', 'If I update a template, what happens to its place versions?', 'offering-template-propagation', [/unless a field has a local override.*does not automatically unhide/s]],
    ['template Delete includes all generated versions', 'How do I delete an Offering template?', 'offering-template-delete', [/also deletes all of its generated place versions/s]],
    ['template edit does not publish versions', 'Will changing a template publish every place version?', 'offering-template-propagation', [/does not automatically unhide or publish a hidden version/]],
    ['Guide cannot create an Offering template in chat', 'Can you make a reusable service template for my Places?', 'offering-template-overview', [/Guide’s direct Create action.*not a template/s]],
    ['template workbook download stays in Data Tools', 'How do I download the Offering Templates workbook?', 'asset-workbook-import', [/Admin.*Data Tools.*Download the Excel template/s]],
    ['saved privacy survives Shared Map wording', 'Can my colleague see my private saved resources if I publish a Shared Map?', 'composite-guidance', [/does not expose your whole saved list/]],
    ['another account template list stays private', "Can you list my colleague's templates?", 'composite-guidance', [/cannot list a colleague’s Offering templates/]],
    ['another person group role is not inferred', 'Can you tell me whether Jane is a Group Admin?', 'composite-guidance', [/cannot check another person’s Group Admin role/]],
    ['Region Admin and template rights stay separate', 'I have Region Admin access; can I edit all Places in my Region and all Offering templates?', 'composite-guidance', [/does not let someone edit every Place.*particular template/s]],
    ['archived group members are not promised', 'Can I archive an Org Group and still see its members?', 'composite-guidance', [/cannot archive it in chat or verify that its members will remain visible/]],
    ['plans grant neither booking nor editing', 'Does adding a Programme to My Plans book me a seat or let me edit it?', 'composite-guidance', [/does not book or reserve a seat.*does not grant permission to edit/s]],
    ['saved names do not imply live vacancy', 'Can you tell me which saved resource has vacancies today?', 'composite-guidance', [/cannot determine which of your saved resources has a vacancy today/]],
    ['private My Place is not public Place creation', 'Can I make my private My Place public directly?', 'verified-boundary', [/private My Place.*not a public directory Place.*cannot verify a one-click conversion/s]],
    ['deleted template recovery is not creation', 'Can you recover a deleted Offering template and its generated versions?', 'offering-template-delete', [/no reviewed restore workflow/]],
    ['deleted template regret is not creation', 'I deleted a template by mistake. Can I get it back?', 'offering-template-delete', [/no reviewed restore workflow/]],
    ['saved schedule changes have conditional in-app updates', 'Will CareAround notify me when a saved Programme changes date?', 'saved-schedule-notifications', [/Inbox → Updates.*in-app notifications.*must not be muted/is]],
    ['Shared Map viewer identities are not inferred', 'Can I see who opened a Shared Map I published?', 'shared-map-viewer-boundary', [/cannot show who opened a Shared Map/]],
    ['Shared Map visitor count is not invented', 'Can I tell if my Shared Map has any visitors?', 'shared-map-viewer-boundary', [/cannot show who opened a Shared Map/]],
    ['saved Programme is separate from My Map', 'Why is my saved Programme not showing on my map?', 'map-membership', [/Saving a resource adds it to My Directory.*choose that map and use its resource controls/s]],
    ['staff role does not expose saved list', 'Can staff see my saved list?', 'saved-list-privacy', [/staff role alone does not grant another person a view/]],
    ['family booking remains provider action', 'Can I book a seat for my parent through CareAround?', 'provider-contact', [/cannot.*book a seat for you/]],
    ['missing saved Programme cause is not guessed', 'Can you tell me why a specific saved Programme disappeared?', 'saved-resource-status', [/cannot tell why a particular saved resource is missing or unavailable/]],
    ['third-party Organisation Admin role stays private', 'Can you show whether another user is an Organisation Admin?', 'composite-guidance', [/cannot check another person’s Organisation Admin role/]],
    ['public Resource Groups do not contain people', 'Can you create a Resource Group and add people as members?', 'composite-guidance', [/people are not added as its members.*Org Groups and Region Groups.*Guide cannot create either Group/s]],
    ['Resource Group people account paraphrase is distinguished', 'Do people need accounts to belong to my Resource Group?', 'composite-guidance', [/people are not added as its members/]],
    ['Programme Malay version distinguishes reading and editing', 'How do I get a Malay version of my Programme?', 'composite-guidance', [/Language selector.*provider listing may still have missing.*Edit → Translate.*Guide cannot translate/s]],
    ['hiding is not permanent erasure', 'Does hiding erase the directory entry permanently?', 'resource-hide-delete', [/visibility.*separate from Delete/s]],
    ['restricted Offerings are not shown identically to everyone', 'Is everyone shown the same set of restricted Offerings?', 'offering-eligibility', [/profile criteria.*active membership.*cannot confirm/s]],
    ['unknown workbook screen is clarified before download advice', 'Are exported resource workbooks refreshed after the listing changes?', 'resource-export-context', [/Which download.*snapshot.*another screen/s]],
    ['saving does not grant listing-editor rights', 'Do I become a listing editor by saving an Offering?', 'saved-versus-managed', [/does not itself give you permission to edit/s]],
    ['in-app and external notification channels are distinguished', 'Are in-app updates the same as WhatsApp or email alerts?', 'notification-delivery-channels', [/preferences only.*external delivery remains disabled/s]],
    ['public hiding preserves saved entries', 'Does hiding a listing remove everybody’s saved copy?', 'hidden-saved-resources', [/does not automatically remove.*unavailable.*visible to that viewer again/s]],
    ['hidden Programme effect is not an eligibility diagnosis', 'If a saved Programme is hidden, will my Directory entry vanish?', 'hidden-saved-resources', [/saved entry can remain.*other audience rules still apply/s]],
    ['Guide notification request makes no preference change', 'Guide, can you turn on WhatsApp alerts for me?', 'guide-notification-controls', [/cannot change your preferences.*external delivery.*has not changed any setting/s]],
    ['one Place Owner assignment does not manage every Place', 'Does an Owner assignment on one Place let me manage every Place?', 'place-assignment-scope', [/exact Place assigned.*does not grant.*every Place.*not whether your account/s]],
    ['linked host Place is not an account membership', 'If I change a linked Place, will the Guide change an existing Programme for me?', 'guide-existing-resource-edit-scope', [/cannot edit an existing public Place or Offering.*exact resource.*server checks permission/s]],
    ['personal account linking still does not grant resource editing', 'If I link my account to a Place, can I manage its services?', 'verified-boundary', [/does not grant editing rights to its Programmes\/services/]],
    ['saving does not disclose a saver identity to the provider', 'I saved a Programme. Can the provider see my name just because I hearted it?', 'saved-identity-privacy', [/Save action does not send your name.*Joining a Place.*managers can see.*names/s]],
    ['host locations are separate from personal membership', 'Is the host location of a service the same thing as a user’s Place membership?', 'offering-host-versus-membership', [/Host Locations connect that listing.*membership connects.*separate relationships.*does not make you a member/s]],
    ['privacy check cannot become an own-saved-list request', 'Can you show me if the provider sees my name after I saved a Programme?', 'saved-identity-privacy', [/not a public saver list.*Shared Map.*separate from saving/s]],
    ['bookmark owner receiving identity has a privacy answer', 'If I bookmark a service, does its owner receive my personal information?', 'saved-identity-privacy', [/Save action does not send your name.*Joining a Place/s]],
    ['favourite recognition is separate from joining', 'Can the organisation running a listing recognise me from my favourite?', 'saved-identity-privacy', [/not a public saver list.*managers can see membership details/s]],
    ['membership QR is distinct from a private bookmark', 'I used a membership QR. Is that the same as making a private bookmark?', 'saved-versus-membership', [/private bookmark.*separate membership.*names.*does not automatically save/s]],
    ['changing a host does not enrol savers', 'Does adding a host centre to an Offering enrol everyone who saved it?', 'offering-host-versus-membership', [/People who saved.*not enrolled by.*host change/s]],
    ['Guide cannot inspect past provider identity delivery', 'Can you check whether the provider has already been told my name?', 'guide-provider-identity-check', [/cannot check whether.*cannot inspect.*does not establish.*has not contacted/s]],
    ['favourited class identity reaches the Save privacy rule', 'Does the organisation learn who I am when I mark its class as a favourite?', 'saved-identity-privacy', [/Save action does not send your name.*Joining a Place/s]],
    ['joining does not automatically bookmark a Place', 'If I have joined a Place, is its listing now automatically in My Directory?', 'saved-versus-membership', [/joining does not automatically save/s]],
    ['host effect relative clause is not a saver lookup', 'Would linking another venue enrol the people who bookmarked my programme?', 'offering-host-versus-membership', [/People who saved.*not enrolled by.*host change/s]],
    ['membership navigation needs no profile fields in chat', 'How can I see which centres have my membership without showing you my profile?', 'place-membership-navigation', [/Profile.*Linked places.*has not checked.*My Directory/s]],
    ['explicit relative-clause saver lookup remains private', 'Show me people who bookmarked my Programme', 'provider-usage-boundary', [/cannot.*identify those people/s]],
];

for (const [name, question, topic, includes] of productCases) {
    await check('product knowledge', name, () => answer('staff', question,
        { source: 'reviewed', topic, includes, pageContext: 'My Directory' }));
}

for (const [name, question, expected, includes] of [
    ['unanticipated session-edit wording reaches reviewed explanation', 'Where can I amend the dated sessions on an existing service?', 'offering-schedule-edit', [/In Schedule.*dated sessions.*Guide cannot edit/s]],
    ['filtered bulk-hiding wording reaches reviewed explanation', 'How do I choose a filtered count before hiding many listings?', 'resource-hide-delete', [/count-and-filter confirmation.*Delete/s]],
]) {
    await check('retrieval integration', name, async () => {
        const observation = await answer('staff', question, { source: 'simulation', topic: expected, includes, useAi: true });
        assert.deepEqual(observation.sourceIds, [expected]);
        return { ...observation, realModelSelectionProven: false,
            completeAnswerRelevanceProven: false };
    });
}

const optInBoundaryNames = new Set([
    'public hiding preserves saved entries', 'hidden Programme effect is not an eligibility diagnosis',
    'Guide notification request makes no preference change',
    'one Place Owner assignment does not manage every Place', 'linked host Place is not an account membership',
    'personal account linking still does not grant resource editing',
    'saving does not disclose a saver identity to the provider', 'host locations are separate from personal membership',
    'privacy check cannot become an own-saved-list request',
    'bookmark owner receiving identity has a privacy answer', 'favourite recognition is separate from joining',
    'membership QR is distinct from a private bookmark', 'changing a host does not enrol savers',
    'Guide cannot inspect past provider identity delivery',
    'favourited class identity reaches the Save privacy rule', 'joining does not automatically bookmark a Place',
    'host effect relative clause is not a saver lookup', 'membership navigation needs no profile fields in chat',
    'explicit relative-clause saver lookup remains private',
    'Guide cannot book for a visitor', 'named eligibility is not inferred', 'live wait time is not invented',
    'hiding is not permanent erasure', 'restricted Offerings are not shown identically to everyone',
    'unknown workbook screen is clarified before download advice', 'saving does not grant listing-editor rights',
    'in-app and external notification channels are distinguished',
]);
for (const [name, question, topic, includes] of productCases.filter(([name]) => optInBoundaryNames.has(name))) {
    await check('opt-in boundary', name, () => answer('staff', question,
        { source: 'reviewed', topic, includes, useAi: true }));
}

await check('truthful limits', 'unverified Archive control is not invented', async () => {
    const response = await request('/api/guide/answer', { role: 'staff', method: 'POST',
        body: { question: 'Can I archive a Place?', pageContext: 'Manage resources', useAi: false } });
    assert.equal(response.status, 200);
    assert.equal(response.body.topicId, 'unverified-workflow');
    assert.match(response.body.message, /cannot verify an Archive control/);
    return { topicId: response.body.topicId, claim: 'Archive is unverified' };
});

const accountCases = [
    ['organisation-admin update summary stays scoped', 'orgadmin', 'Show resource updates yesterday', [/active organisation-admin scope/, /Assigned Place Staff — Havelock Demo Activity/], [/Havelock List-only Service/, /fixture-audit-secret/, /example.test/]],
    ['other organisation summary stays separate', 'otherorgadmin', 'Show resource updates yesterday', [/Other Place Staff — Havelock List-only Service/], [/Havelock Demo Activity/, /fixture-other-audit-secret/, /example.test/]],
    ['Super Admin recorded updates are global', 'admin', 'Show resource updates yesterday', [/across CareAround SG/, /Havelock Demo Activity/, /Havelock List-only Service/], [/fixture-audit-secret/, /example.test/]],
    ['Programme-only audit query does not include Resource Groups', 'orgadmin', 'Show Programme edits yesterday', [/same resource type.*Resource Groups.*No update records were loaded/s], [/Assigned Place Staff —/, /Havelock Demo Activity/]],
    ['staff cannot identify an editor without audit access', 'staff', 'Can you show me who changed my Place listing yesterday?', [/not currently available.*cannot identify an editor/s], [/Assigned Place Staff —/, /Havelock Demo Activity/]],
    ['named listing never widens into broad events', 'orgadmin', 'Who edited my Programme yesterday?', [/cannot match an exact listing.*verified selection/s], [/Assigned Place Staff —/, /Havelock Demo Activity/]],
    ['custom date never widens into recent events', 'orgadmin', 'Show Programme edits last month', [/cannot match an exact listing or custom date/], [/Assigned Place Staff —/, /Havelock Demo Activity/]],
    ['guest cannot read audit updates', null, 'Show resource updates yesterday', [/Sign in/], [/Havelock Demo Activity/]],
    ['User View cannot read audit updates', 'impersonating', 'Show resource updates yesterday', [/Exit User View/], [/Havelock Demo Activity/]],
    ['Place staff cannot make a standalone Offering through Guide', 'staff', 'Can I create a public event that is not attached to a Place?', [/supports a standalone Programme\/service.*cannot open New Offering/s], [/can open Manage My Resources → New Offering/]],
    ['Place staff cannot publish a standalone Offering', 'staff', 'Can I publish a Programme without linking a Place?', [/supports a standalone Programme\/service.*cannot open New Offering.*Visibility/s], [/can open Manage My Resources → New Offering/]],
    ['ordinary hide permission stays account scoped', 'staff', 'Can I hide a Programme I manage?', [/particular Place or Offering.*server rechecks permission/s], [/does not automatically delete an existing personal plan/]],
    ['Super Admin can open standalone Offering form', 'admin', 'Can I create a public event that is not attached to a Place?', [/can open Manage My Resources → New Offering.*Guide’s reviewed Create action currently requires a manageable Place/s], []],
    ['Super Admin standalone publication still needs visibility review', 'admin', 'Can I publish a Programme without linking a Place?', [/can open Manage My Resources → New Offering.*Visibility.*Guide’s reviewed Create action currently requires a manageable Place/s], []],
    ['guest cannot infer standalone creation permission', null, 'Can I create a public event that is not attached to a Place?', [/Sign in to check/], [/This account can open/]],
    ['User View cannot start standalone creation', 'impersonating', 'Can I create a public event that is not attached to a Place?', [/Exit User View/], [/This account can open/]],
    ['scoped Admin reads own live Subregion', 'regionadmin', 'Which Subregions am I assigned to administer?', [/1 Subregion: Synthetic region/, /does not itself grant editing rights/], [/Other synthetic region/]],
    ['other scoped Admin reads only own Subregion', 'otherregionadmin', 'Can I see my current assigned Region Scope?', [/1 Subregion: Other synthetic region/], [/1 Subregion: Synthetic region[.;]/]],
    ['Place staff has no Admin Region Scope', 'staff', 'Which Subregions am I assigned to administer?', [/not an Admin with an assigned Admin Region Scope/], [/Synthetic region/]],
    ['Super Admin has global role rather than assignment', 'admin', 'Can I see my current assigned Region Scope?', [/Super Admin account.*not limited to an assigned Admin Region Scope/s], [/Synthetic region/]],
    ['guest cannot read an Admin Region Scope', null, 'Which Subregions am I assigned to administer?', [/Sign in to check/], [/Synthetic region/]],
    ['User View cannot read an Admin Region Scope', 'impersonating', 'Which Subregions am I assigned to administer?', [/Exit User View/], [/Synthetic region/]],
    ['staff managed list', 'staff', 'What resources do I manage?', [/Havelock Demo Centre/, /Havelock Staff Group/], [/Out-of-scope Demo Centre/, /Other Staff Group/]],
    ['other staff managed list', 'otherstaff', 'What resources do I manage?', [/Out-of-scope Demo Centre/, /Other Staff Group/], [/Havelock Demo Centre/, /Havelock Staff Group/]],
    ['member cannot infer management', 'member', 'What resources do I manage?', [/does not currently have access/i], [/Havelock Demo Centre/]],
    ['guest cannot read saved list', null, 'What resources have I saved?', [/Sign in/], [/Havelock Demo Centre/]],
    ['member owner saved list', 'member', 'What resources have I saved?', [/Havelock Demo Centre/], [/Other Private Pin/]],
    ['staff private place', 'staff', 'What personal places have I created?', [/Staff Planning Pin/], [/Other Private Pin/, /Private fixture staff address/]],
    ['other staff private place', 'otherstaff', 'What personal places have I created?', [/Other Private Pin/], [/Staff Planning Pin/]],
    ['staff plans', 'staff', 'What plans do I have?', [/Staff Future Session/], [/Other Private Session/]],
    ['other staff plans', 'otherstaff', 'What plans do I have?', [/Other Private Session/], [/Staff Future Session/]],
    ['User View cannot read private places', 'impersonating', 'What personal places have I created?', [/Exit User View/], [/Staff Planning Pin/, /Other Private Pin/]],
    ['Super Admin Audit Trail access', 'admin', 'Can I open Audit Trail?', [/can open Audit Trail across CareAround SG/], [/Havelock Demo Centre/]],
    ['Place staff is not Audit Trail admin', 'staff', 'Can I open Audit Trail?', [/not currently available.*Place staff or Region Admin title alone/s], [/Open Audit Trail/]],
    ['guest Audit Trail access is unknown', null, 'Can I open Audit Trail?', [/Sign in to check/], [/can open Audit Trail across/]],
    ['User View Audit Trail access is denied', 'impersonating', 'Can I open Audit Trail?', [/Exit User View/], [/can open Audit Trail across/]],
    ['Super Admin organisation governance access', 'admin', 'Can I manage organisations?', [/Super Admin.*Admin.*Organisations/s], [/Havelock Demo Centre/]],
    ['Place staff is not organisation admin', 'staff', 'Can I open Organisation Workspace?', [/not currently available.*active organisation access/s], [/Open Organisation Workspace/]],
    ['guest organisation access is unknown', null, 'Can I open Organisation Workspace?', [/Sign in to check/], [/currently has active/]],
    ['User View organisation access is denied', 'impersonating', 'Can I open Organisation Workspace?', [/Exit User View/], [/currently has active/]],
    ['Super Admin may create both governance types', 'admin', 'Can I create a governance group?', [/create Org Groups.*Region Groups/s], [/Havelock Demo Centre/]],
    ['Place staff cannot infer Org Group creation', 'staff', 'Can I create an Org Group?', [/cannot currently create an Org Group/], [/Open Organisation Workspace/]],
    ['Place staff cannot infer Region Group creation', 'staff', 'Can I create a Region Group?', [/cannot create a Region Group.*Super Admin/s], [/Open Admin/]],
    ['guest governance-group access is unknown', null, 'Can I create a governance group?', [/Sign in to check/], [/can create/]],
    ['User View governance-group access is denied', 'impersonating', 'Can I create a governance group?', [/Exit User View/], [/can create/]],
    ['Super Admin sees New Template gate', 'admin', 'Can I create an Offering template?', [/can open New Template.*does not confirm permission to generate/s], [/Havelock Demo Centre/]],
    ['Place staff does not gain template creation', 'staff', 'Can I create an Offering template?', [/does not currently have access.*Managing an assigned Place alone/s], [/prepare a Programme\/service/]],
    ['template generation still needs exact host scope', 'admin', 'Can I generate place versions from a template?', [/particular template and each selected host Place.*server checks/s], [/Havelock Demo Centre/]],
    ['guest template access is unknown', null, 'Can I create an Offering template?', [/Sign in to check/], [/can open New Template/]],
    ['User View template access is denied', 'impersonating', 'Can I create an Offering template?', [/Exit User View/], [/can open New Template/]],
    ['Super Admin template list uses current scope', 'admin', 'Which templates can I edit?', [/can manage 1 Offering template: Fixture Shared Care Template/], [/Havelock Demo Centre/]],
    ['Super Admin can download but download does not import', 'admin', 'Can I download the Offering Templates workbook?', [/Downloading does not import or create anything/], [/Havelock Demo Centre/]],
    ['Place staff cannot download template workbook', 'staff', 'Can I download the Offering Templates workbook?', [/not available to this account/], [/Download Template/]],
    ['Place staff cannot read managed templates', 'staff', 'Which templates can I edit?', [/does not currently have access/], [/Fixture Shared Care Template/]],
    ['User View cannot read managed templates', 'impersonating', 'Which templates can I edit?', [/Exit User View/], [/Fixture Shared Care Template/]],
    ['managed Places and templates use separate scopes', 'admin', 'Which Places and templates can I manage?', [/Havelock Demo Centre/, /Fixture Shared Care Template/], []],
    ['Place staff cannot read combined template list', 'staff', 'Which Places and templates can I manage?', [/Havelock Demo Centre/, /does not currently have access to create or manage Offering templates/], [/Fixture Shared Care Template/]],
    ['workbook import is not Guide publication', 'admin', 'Can I import a workbook and have the Guide publish the new services?', [/cannot publish services created or updated by an import/], [/Fixture Shared Care Template/]],
];

for (const [name, role, question, includes, excludes] of accountCases) {
    await check('account facts', name, () => answer(role, question,
        { source: 'account', includes, excludes, pageContext: 'My Directory' }));
}

await check('account facts', 'provider planner question cannot load own plans', () => answer('staff',
    'Can I see a list of members who added my Programme to My Plans?', {
        source: 'reviewed', topic: 'provider-plan-privacy',
        includes: [/cannot show.*who added.*My Plans/s],
        excludes: [/Staff Future Session/, /Other Private Session/],
        pageContext: 'My Directory',
    }));

await check('reviewed actions', 'creation place choices are actor scoped', async () => {
    const staff = await request('/api/guide/actions/programmes/places', { role: 'staff' });
    const member = await request('/api/guide/actions/programmes/places', { role: 'member' });
    const userView = await request('/api/guide/actions/programmes/places', { role: 'impersonating' });
    assert.equal(staff.status, 200);
    assert.equal(staff.body.canCreate, true);
    assert.deepEqual(staff.body.places.map(({ name }) => name), ['Havelock Demo Centre']);
    assert.equal(member.status, 200);
    assert.equal(member.body.canCreate, false);
    assert.deepEqual(member.body.places, []);
    assert.equal(userView.status, 403);
    return { staffPlaces: staff.body.places.length, memberCanCreate: false, userViewStatus: userView.status };
});

await check('reviewed actions', 'programme review does not write; changed review cannot create', async () => {
    const before = (await request('/__fixture/guide/state')).body;
    const name = `Oracle acceptance ${randomUUID()}`;
    const draft = { name, locationId: 100, description: 'Fictional acceptance preview' };
    const requestId = randomUUID();
    const review = await request('/api/guide/actions/programmes/review', {
        role: 'staff', method: 'POST', body: { draft, requestId },
    });
    assert.equal(review.status, 200, JSON.stringify(review.body));
    assert.ok(review.body.reviewToken);
    const afterReview = (await request('/__fixture/guide/state')).body;
    assert.deepEqual(afterReview.resources, before.resources);
    const changed = await request('/api/guide/actions/programmes/create', {
        role: 'staff', method: 'POST', body: { draft: { ...draft, name: `${name} changed` },
            requestId, reviewToken: review.body.reviewToken },
    });
    assert.equal(changed.status, 409, JSON.stringify(changed.body));
    assert.equal(changed.body.code, 'GUIDE_REVIEW_REQUIRED');
    const afterReject = (await request('/__fixture/guide/state')).body;
    assert.deepEqual(afterReject.resources, before.resources);
    return { reviewStatus: review.status, changedCreateStatus: changed.status, createdRows: 0 };
});

await check('reviewed actions', 'one-way Save stays in one account and is retry safe', async () => {
    const first = await request('/api/guide/actions/saved-resources', { role: 'staff', method: 'POST',
        body: { resourceType: 'hard', resourceId: 103 } });
    const retry = await request('/api/guide/actions/saved-resources', { role: 'staff', method: 'POST',
        body: { resourceType: 'hard', resourceId: 103 } });
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(retry.status, 200, JSON.stringify(retry.body));
    assert.equal(retry.body.alreadySaved, true);
    const state = (await request('/__fixture/guide/state')).body;
    assert.equal(state.favorites.filter((item) => item.user_id === 4 && item.resource_type === 'hard'
        && item.resource_id === 103).length, 1);
    assert.equal(state.favorites.filter((item) => item.user_id === 5 && item.resource_id === 103).length, 0);
    return { firstAlreadySaved: first.body.alreadySaved, retryAlreadySaved: true, staffRows: 1, otherStaffRows: 0 };
});

await check('account facts', 'bookmarking a hosted Programme does not join its Place or expose another saver list', async () => {
    const providerBefore = await request('/api/favorites', { role: 'staff' });
    const managerBefore = await request('/api/hard-assets/100', { role: 'staff' });
    assert.equal(providerBefore.status, 200);
    assert.equal(managerBefore.status, 200);
    assert.equal(managerBefore.body.membershipCount, 0);
    const save = await request('/api/guide/actions/saved-resources', { role: 'other', method: 'POST',
        body: { resourceType: 'soft', resourceId: 200 } });
    assert.equal(save.status, 200, JSON.stringify(save.body));
    assert.equal(save.body.alreadySaved, false);
    const saver = await request('/api/favorites', { role: 'other' });
    assert.equal(saver.status, 200);
    assert.ok(saver.body.some((row) => row.resourceType === 'soft' && row.resourceId === 200));
    // Caller query parameters cannot replace the authenticated account.
    const providerAfter = await request('/api/favorites?userId=2', { role: 'staff' });
    assert.equal(providerAfter.status, 200);
    assert.deepEqual(providerAfter.body, providerBefore.body);
    const managerAfter = await request('/api/hard-assets/100', { role: 'staff' });
    assert.equal(managerAfter.status, 200);
    assert.equal(managerAfter.body.membershipCount, managerBefore.body.membershipCount);
    assert.deepEqual(managerAfter.body.memberPreview, managerBefore.body.memberPreview);
    return { saverAccountOnly: true, providerSavedListUnchanged: true, callerCannotSelectSaver: true,
        newPlaceMemberships: 0, membershipPreviewUnchanged: true, realProviderDeliveryTested: false };
});

await check('account facts', 'real fixture Hide and Show keep the same saved Offering entry', async () => {
    const save = await request('/api/guide/actions/saved-resources', { role: 'member', method: 'POST',
        body: { resourceType: 'soft', resourceId: 202 } });
    assert.equal(save.status, 200, JSON.stringify(save.body));
    const read = async () => {
        const response = await request('/api/favorites', { role: 'member' });
        assert.equal(response.status, 200);
        return response.body.find((item) => item.resourceType === 'soft' && item.resourceId === 202);
    };
    const original = await read();
    assert.equal(original.status, 'available');
    try {
        const hide = await request('/api/soft-assets/202', { role: 'admin', method: 'PUT', body: { isHidden: true } });
        assert.equal(hide.status, 200, JSON.stringify(hide.body));
        const hidden = await read();
        assert.equal(hidden.id, original.id);
        assert.equal(hidden.status, 'unavailable');
    } finally {
        const show = await request('/api/soft-assets/202', { role: 'admin', method: 'PUT', body: { isHidden: false } });
        assert.equal(show.status, 200, JSON.stringify(show.body));
    }
    const restored = await read();
    assert.equal(restored.id, original.id);
    assert.equal(restored.status, 'available');
    return { syntheticWritesOnly: true, sameFavoriteId: true, statuses: ['available', 'unavailable', 'available'] };
});

await check('knowledge', 'injected semantic selection uses two stages without converting product notices to an account list', async () => {
    const control = await request('/__fixture/guide/semantic', { method: 'POST',
        body: { enabled: true, factIds: ['saved-schedule-notifications'] } });
    assert.equal(control.status, 200);
    try {
        const answer = await request('/api/guide/answer', { role: 'staff', method: 'POST', body: {
            question: 'Where can I turn on notices about a saved programme moving?', useAi: true, pageContext: 'My Directory' } });
        assert.equal(answer.status, 200);
        assert.equal(answer.body.answerSource, 'simulation');
        assert.equal(answer.body.topicId, 'saved-schedule-notifications');
        assert.match(answer.body.message, /Open Inbox → Updates and enable Saved schedule changes/);
        assert.doesNotMatch(answer.body.message, /This account has|Most recently saved:/);
        const state = (await request('/__fixture/guide/semantic')).body;
        assert.equal(state.modelCalls, 2);
        return { injectedSelectionOnly: true, simulatedModelCalls: state.modelCalls, liveModelCalls: 0 };
    } finally {
        assert.equal((await request('/__fixture/guide/semantic', { method: 'POST', body: { enabled: false } })).status, 200);
    }
});

await check('knowledge', 'opted-in semantic review can replace a lexical product match while saver lookup stays private', async () => {
    const before = (await request('/__fixture/guide/state')).body;
    const question = 'Will changing the host of an Offering alter the membership of people who saved it?';
    const reviewed = await request('/api/guide/answer', { role: 'member', method: 'POST', body: { question } });
    assert.equal(reviewed.status, 200);
    assert.equal(reviewed.body.topicId, 'saved-versus-managed');
    const control = await request('/__fixture/guide/semantic', { method: 'POST',
        body: { enabled: true, factIds: ['offering-host-versus-membership'] } });
    assert.equal(control.status, 200);
    try {
        const selected = await request('/api/guide/answer', { role: 'member', method: 'POST',
            body: { question, useAi: true, pageContext: 'My Directory' } });
        assert.equal(selected.status, 200);
        assert.equal(selected.body.answerSource, 'simulation');
        assert.equal(selected.body.topicId, 'offering-host-versus-membership');
        assert.match(selected.body.message, /People who saved.*not enrolled by.*host change/s);
        assert.deepEqual(selected.body.sources.map(({ id }) => id), ['offering-host-versus-membership']);
        assert.deepEqual(selected.body.actions.map(({ route }) => route), ['/dashboard/profile']);
        const privateLookup = await request('/api/guide/answer', { role: 'member', method: 'POST',
            body: { question: 'Show me the members who bookmarked our service.', useAi: true } });
        assert.equal(privateLookup.status, 200);
        assert.equal(privateLookup.body.topicId, 'provider-usage-boundary');
        assert.equal(privateLookup.body.answerSource, 'reviewed');
        const mode = (await request('/__fixture/guide/semantic')).body;
        assert.equal(mode.modelCalls, 2);
        assert.deepEqual((await request('/__fixture/guide/state')).body, before);
        return { injectedSelectionOnly: true, simulatedModelCalls: 2, liveModelCalls: 0,
            lexicalMatchReviewed: true, privateLookupNotInferred: true, syntheticResourceStateUnchanged: true };
    } finally {
        assert.equal((await request('/__fixture/guide/semantic', { method: 'POST', body: { enabled: false } })).status, 200);
    }
});

const evidence = { fictionalFixtureOnly: true, liveModelRequests: 0, oracleVersion: GUIDE_ORACLE_VERSION,
    checkedAt, scope: 'Selected API integration checks, not a whole-product or real-account accuracy score. Browser review/Create remains covered by the separate Guide action browser suite.',
    summary: { passed: results.filter((item) => item.passed).length,
        failed: results.filter((item) => !item.passed).length, total: results.length }, results };
await writeFile(new URL('../docs/evidence/guide-oracle-three-layer-acceptance-20260929.json', import.meta.url),
    `${JSON.stringify(evidence, null, 2)}\n`);
assert.equal(evidence.summary.failed, 0, `${evidence.summary.failed} Oracle acceptance checks failed`);
